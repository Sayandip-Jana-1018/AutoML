/**
 * MLForge Studio - Cloud Functions
 *
 * Event-driven functions for automated dataset processing
 */

import { setGlobalOptions } from "firebase-functions";
import { onObjectFinalized } from "firebase-functions/v2/storage";
import * as logger from "firebase-functions/logger";
import { initializeApp } from "firebase-admin/app";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { profileDatasetFromGCS, DatasetSchema } from "./schema-profiler";

// NOTE: Metrics sync functions require deployment to the GCP project that owns the bucket
// Firebase Functions v2 cannot trigger on buckets from different projects
// To enable: Deploy these functions separately to fluent-cable-480715-c8 project
// For now, metrics are stored in GCS and can be pulled on-demand via API
// export { onMetricsUploaded, onModelUploaded } from "./metrics-sync";

// Scheduled metrics sync - runs every 5 minutes to sync metrics from GCS
export { scheduledMetricsSync } from "./scheduled-sync";

// Initialize Firebase Admin
initializeApp();
const db = getFirestore();

// Global options for cost control
setGlobalOptions({ maxInstances: 10, region: "us-central1" });

/**
 * Dataset Upload Confirmation
 * Triggered by OBJECT_FINALIZE on GCS bucket
 *
 * Expected path format: projects/{projectId}/datasets/{datasetId}/{filename}
 * Or: mlforge-datasets/{userId}/{projectId}/{filename}
 */
export const onDatasetUploaded = onObjectFinalized(
    {
        bucket: "automl-dc494.firebasestorage.app", // Firebase Storage bucket
        memory: "512MiB",
        timeoutSeconds: 120,
        region: "us-central1",
    },
    async (event) => {
        const filePath = event.data.name;
        const contentType = event.data.contentType;

        logger.info(`[onDatasetUploaded] New file: ${filePath}`, {
            contentType,
            size: event.data.size,
        });

        // Only process CSV files
        if (!contentType?.includes("csv") && !filePath.endsWith(".csv")) {
            logger.info(`[onDatasetUploaded] Skipping non-CSV file: ${filePath}`);
            return;
        }

        // Parse path to extract project and dataset info
        // Expected: projects/{projectId}/datasets/{datasetId}/data.csv
        // Or: {userId}/{projectId}/datasets/{datasetId}.csv
        const pathParts = filePath.split("/");

        let projectId: string | null = null;
        let datasetId: string | null = null;

        // Try to extract IDs from path
        if (pathParts.includes("projects") && pathParts.includes("datasets")) {
            const projectIdx = pathParts.indexOf("projects");
            const datasetIdx = pathParts.indexOf("datasets");
            projectId = pathParts[projectIdx + 1] || null;
            datasetId = pathParts[datasetIdx + 1]?.replace(".csv", "") || null;
        } else if (pathParts.length >= 3) {
            // Alternative: userId/projectId/filename.csv
            projectId = pathParts[1] || null;
            datasetId = pathParts[2]?.replace(".csv", "") || null;
        }

        if (!projectId || !datasetId) {
            logger.warn(`[onDatasetUploaded] Could not parse IDs from path: ${filePath}`);
            return;
        }

        logger.info(`[onDatasetUploaded] Processing: Project=${projectId}, Dataset=${datasetId}`);

        const datasetRef = db.collection("projects").doc(projectId).collection("datasets").doc(datasetId);

        try {
            // 1. Update status to 'processing'
            await datasetRef.update({
                status: "processing",
                updatedAt: FieldValue.serverTimestamp(),
                triggeredBy: "cloud-function",
            });

            // 2. Profile the dataset
            const bucketName = event.data.bucket;
            let schema: DatasetSchema;

            try {
                schema = await profileDatasetFromGCS(bucketName, filePath);
                logger.info(`[onDatasetUploaded] Profiled: ${schema.rowCount} rows, ${schema.columnCount} cols, taskType=${schema.inferredTaskType}`);
            } catch (profileError: unknown) {
                const errorMessage = profileError instanceof Error ? profileError.message : "Unknown profiling error";
                logger.error(`[onDatasetUploaded] Profiling failed:`, profileError);
                await datasetRef.update({
                    status: "error",
                    error: errorMessage,
                    updatedAt: FieldValue.serverTimestamp(),
                });
                return;
            }

            // 3. Create version document for reproducibility
            const versionRef = datasetRef.collection("versions").doc();
            await versionRef.set({
                schema: {
                    columns: schema.columns.map((c) => ({
                        name: c.name,
                        type: c.type,
                        nullCount: c.nullCount,
                        uniqueCount: c.uniqueCount,
                    })),
                    rowCount: schema.rowCount,
                    columnCount: schema.columnCount,
                    missingValueStats: schema.missingValueStats,
                    inferredTaskType: schema.inferredTaskType,
                    taskTypeConfidence: schema.taskTypeConfidence,
                    targetColumnSuggestion: schema.targetColumnSuggestion,
                },
                gcsPath: `gs://${bucketName}/${filePath}`,
                createdAt: FieldValue.serverTimestamp(),
                versionNumber: 1, // Will be incremented on re-uploads
            });

            // 4. Update dataset with schema and mark as ready
            await datasetRef.update({
                status: "ready",
                currentVersionId: versionRef.id,
                // Task type with confidence
                taskType: schema.inferredTaskType,
                taskTypeConfidence: schema.taskTypeConfidence,
                // Schema details
                schema: {
                    columns: schema.columns.map((c) => ({
                        name: c.name,
                        type: c.type,
                        nullCount: c.nullCount,
                        uniqueCount: c.uniqueCount,
                    })),
                    rowCount: schema.rowCount,
                    columnCount: schema.columnCount,
                    missingValueStats: schema.missingValueStats,
                    inferredTaskType: schema.inferredTaskType,
                    taskTypeConfidence: schema.taskTypeConfidence,
                    targetColumnSuggestion: schema.targetColumnSuggestion,
                },
                columnNames: schema.columns.map((c) => c.name),
                rowCount: schema.rowCount,
                gcsPath: `gs://${bucketName}/${filePath}`,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // 5. Also update project with taskType for easy access
            await db.collection("projects").doc(projectId).update({
                taskType: schema.inferredTaskType,
                targetColumn: schema.targetColumnSuggestion || null,
                latestDatasetId: datasetId,
                lastDatasetUploadAt: FieldValue.serverTimestamp(),
            });

            logger.info(`[onDatasetUploaded] ✅ Dataset ${datasetId} ready. TaskType: ${schema.inferredTaskType}, Confidence: ${schema.taskTypeConfidence}`);
        } catch (error: unknown) {
            logger.error(`[onDatasetUploaded] Firestore error:`, error);
            const errorMessage = error instanceof Error ? error.message : "Unknown error";
            await datasetRef.update({
                status: "error",
                error: errorMessage,
                updatedAt: FieldValue.serverTimestamp(),
            }).catch(() => { });
        }
    }
);

/**
 * Dataset Re-upload Handler
 * Creates a new version when a dataset is updated
 */
export const onDatasetReUploaded = onObjectFinalized(
    {
        bucket: "automl-dc494.firebasestorage.app", // Firebase Storage bucket
        memory: "512MiB",
        timeoutSeconds: 120,
        region: "us-central1",
    },
    async (event) => {
        // Check if this is an overwrite (metageneration > 1)
        if (Number(event.data.metageneration) <= 1) {
            // First upload, handled by onDatasetUploaded
            return;
        }

        const filePath = event.data.name;
        logger.info(`[onDatasetReUploaded] File updated: ${filePath}`);

        // Same path parsing logic as above
        const pathParts = filePath.split("/");
        let projectId: string | null = null;
        let datasetId: string | null = null;

        if (pathParts.includes("projects") && pathParts.includes("datasets")) {
            const projectIdx = pathParts.indexOf("projects");
            const datasetIdx = pathParts.indexOf("datasets");
            projectId = pathParts[projectIdx + 1] || null;
            datasetId = pathParts[datasetIdx + 1]?.replace(".csv", "") || null;
        } else if (pathParts.length >= 3) {
            projectId = pathParts[1] || null;
            datasetId = pathParts[2]?.replace(".csv", "") || null;
        }

        if (!projectId || !datasetId) return;

        const datasetRef = db.collection("projects").doc(projectId).collection("datasets").doc(datasetId);

        try {
            // Get current version count
            const versionsSnapshot = await datasetRef.collection("versions").count().get();
            const newVersionNumber = versionsSnapshot.data().count + 1;

            // Profile the updated dataset
            const schema = await profileDatasetFromGCS(event.data.bucket, filePath);

            // Create new version
            const versionRef = datasetRef.collection("versions").doc();
            await versionRef.set({
                schema: {
                    columns: schema.columns.map((c) => ({
                        name: c.name,
                        type: c.type,
                        nullCount: c.nullCount,
                        uniqueCount: c.uniqueCount,
                    })),
                    rowCount: schema.rowCount,
                    columnCount: schema.columnCount,
                    missingValueStats: schema.missingValueStats,
                    inferredTaskType: schema.inferredTaskType,
                    taskTypeConfidence: schema.taskTypeConfidence,
                    targetColumnSuggestion: schema.targetColumnSuggestion,
                },
                gcsPath: `gs://${event.data.bucket}/${filePath}`,
                createdAt: FieldValue.serverTimestamp(),
                versionNumber: newVersionNumber,
            });

            // Update dataset with latest version
            await datasetRef.update({
                currentVersionId: versionRef.id,
                versionCount: newVersionNumber,
                taskType: schema.inferredTaskType,
                taskTypeConfidence: schema.taskTypeConfidence,
                schema: {
                    columns: schema.columns.map((c) => ({
                        name: c.name,
                        type: c.type,
                        nullCount: c.nullCount,
                        uniqueCount: c.uniqueCount,
                    })),
                    rowCount: schema.rowCount,
                    columnCount: schema.columnCount,
                    missingValueStats: schema.missingValueStats,
                },
                rowCount: schema.rowCount,
                gcsPath: `gs://${event.data.bucket}/${filePath}`,
                updatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`[onDatasetReUploaded] ✅ Created version ${newVersionNumber} for dataset ${datasetId}`);
        } catch (error) {
            logger.error(`[onDatasetReUploaded] Error:`, error);
        }
    }
);
