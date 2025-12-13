/**
 * Metrics Sync Cloud Function
 * 
 * Triggered when metrics.json is uploaded to GCS after training.
 * Parses the metrics and updates the corresponding job document in Firestore.
 * 
 * Expected path format: projects/{projectId}/jobs/{jobId}/metrics.json
 */

import { onObjectFinalized } from "firebase-functions/v2/storage";
import { logger } from "firebase-functions";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { getStorage } from "firebase-admin/storage";

// Lazy initialization - getFirestore/getStorage will be called inside the function handlers
// This avoids the "no-app" error since initializeApp() is called in index.ts before these run

/**
 * Metrics Sync Handler
 * Triggered when metrics.json is uploaded to the training bucket
 */
export const onMetricsUploaded = onObjectFinalized(
    {
        bucket: "mlforge-fluent-cable-480715-c8", // GCP training bucket
        memory: "256MiB",
        timeoutSeconds: 60,
        region: "us-central1",
    },
    async (event) => {
        const filePath = event.data.name;
        const contentType = event.data.contentType;

        // Only process metrics.json files
        if (!filePath?.endsWith("metrics.json")) {
            return;
        }

        // Initialize inside handler (after initializeApp has been called)
        const db = getFirestore();
        const storage = getStorage();

        logger.info(`[onMetricsUploaded] Processing metrics file: ${filePath}`, {
            contentType,
            size: event.data.size,
        });

        // Parse path to extract projectId and jobId
        // Expected format: projects/{projectId}/jobs/{jobId}/metrics.json
        const pathParts = filePath.split("/");
        let projectId: string | null = null;
        let jobId: string | null = null;

        // Try to parse path
        const projectsIndex = pathParts.indexOf("projects");
        if (projectsIndex !== -1 && pathParts.length > projectsIndex + 3) {
            projectId = pathParts[projectsIndex + 1];
            const jobsIndex = pathParts.indexOf("jobs");
            if (jobsIndex !== -1 && pathParts.length > jobsIndex + 1) {
                jobId = pathParts[jobsIndex + 1];
            }
        }

        // Alternative path format: {projectId}/jobs/{jobId}/metrics.json
        if (!projectId && pathParts.length >= 3) {
            projectId = pathParts[0];
            if (pathParts[1] === "jobs") {
                jobId = pathParts[2];
            }
        }

        if (!projectId || !jobId) {
            logger.warn(`[onMetricsUploaded] Could not parse IDs from path: ${filePath}`);
            return;
        }

        logger.info(`[onMetricsUploaded] Project=${projectId}, Job=${jobId}`);

        try {
            // Download and parse metrics.json
            const bucket = storage.bucket(event.data.bucket);
            const file = bucket.file(filePath);

            const [contents] = await file.download();
            const metricsJson = contents.toString("utf-8");
            const metrics = JSON.parse(metricsJson);

            logger.info(`[onMetricsUploaded] Parsed metrics:`, metrics);

            // Update the job document with metrics
            const jobRef = db.collection("projects").doc(projectId).collection("jobs").doc(jobId);
            const jobDoc = await jobRef.get();

            if (!jobDoc.exists) {
                logger.warn(`[onMetricsUploaded] Job document not found: ${jobId}`);
                return;
            }

            // Update job with metrics and mark as complete
            await jobRef.update({
                metrics: {
                    accuracy: metrics.accuracy || null,
                    loss: metrics.loss || null,
                    rmse: metrics.rmse || null,
                    r2: metrics.r2 || null,
                    mae: metrics.mae || null,
                    num_classes: metrics.num_classes || null,
                    // Store raw metrics for future reference
                    raw: metrics,
                },
                status: "succeeded",
                finishedAt: FieldValue.serverTimestamp(),
                metricsPath: `gs://${event.data.bucket}/${filePath}`,
                updatedAt: FieldValue.serverTimestamp(),
            });

            // Also update the corresponding script version if it exists
            const jobData = jobDoc.data();
            if (jobData?.scriptVersion) {
                const scriptsQuery = db
                    .collection("projects")
                    .doc(projectId)
                    .collection("scripts")
                    .where("version", "==", jobData.scriptVersion)
                    .limit(1);

                const scriptsSnapshot = await scriptsQuery.get();
                if (!scriptsSnapshot.empty) {
                    const scriptDoc = scriptsSnapshot.docs[0];
                    await scriptDoc.ref.update({
                        metricsSummary: {
                            accuracy: metrics.accuracy || null,
                            loss: metrics.loss || null,
                            rmse: metrics.rmse || null,
                        },
                        lastTrainingJobId: jobId,
                        updatedAt: FieldValue.serverTimestamp(),
                    });
                }
            }

            // Update project with latest job metrics for quick access
            await db.collection("projects").doc(projectId).update({
                latestJobMetrics: {
                    accuracy: metrics.accuracy || null,
                    loss: metrics.loss || null,
                    jobId: jobId,
                    updatedAt: FieldValue.serverTimestamp(),
                },
                lastTrainingCompletedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`[onMetricsUploaded] ✅ Job ${jobId} updated with metrics`);

        } catch (error: unknown) {
            logger.error(`[onMetricsUploaded] Error processing metrics:`, error);

            // Try to update job with error status
            if (projectId && jobId) {
                const errorMessage = error instanceof Error ? error.message : "Unknown error";
                await db.collection("projects").doc(projectId).collection("jobs").doc(jobId).update({
                    metricsError: errorMessage,
                    updatedAt: FieldValue.serverTimestamp(),
                }).catch(() => { });
            }
        }
    }
);

/**
 * Model Upload Handler
 * Triggered when model.joblib is uploaded after training
 */
export const onModelUploaded = onObjectFinalized(
    {
        bucket: "mlforge-fluent-cable-480715-c8", // GCP training bucket
        memory: "256MiB",
        timeoutSeconds: 60,
        region: "us-central1",
    },
    async (event) => {
        const filePath = event.data.name;

        // Only process model files
        if (!filePath?.endsWith("model.joblib")) {
            return;
        }

        // Initialize inside handler (after initializeApp has been called)
        const db = getFirestore();

        logger.info(`[onModelUploaded] Model file uploaded: ${filePath}`);

        // Parse path
        const pathParts = filePath.split("/");
        let projectId: string | null = null;
        let jobId: string | null = null;

        const projectsIndex = pathParts.indexOf("projects");
        if (projectsIndex !== -1 && pathParts.length > projectsIndex + 3) {
            projectId = pathParts[projectsIndex + 1];
            const jobsIndex = pathParts.indexOf("jobs");
            if (jobsIndex !== -1 && pathParts.length > jobsIndex + 1) {
                jobId = pathParts[jobsIndex + 1];
            }
        }

        if (!projectId || !jobId) {
            logger.warn(`[onModelUploaded] Could not parse IDs from path: ${filePath}`);
            return;
        }

        try {
            // Update job document with model path
            await db.collection("projects").doc(projectId).collection("jobs").doc(jobId).update({
                modelPath: `gs://${event.data.bucket}/${filePath}`,
                modelSize: event.data.size,
                modelUploadedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
            });

            logger.info(`[onModelUploaded] ✅ Job ${jobId} updated with model path`);

        } catch (error: unknown) {
            logger.error(`[onModelUploaded] Error:`, error);
        }
    }
);
