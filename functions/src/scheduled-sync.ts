"use server";

/**
 * Scheduled Metrics Sync
 * 
 * Runs every 5 minutes to sync metrics from GCS to Firestore
 * for all running/pending jobs across all projects.
 * 
 * Uses a global /jobs collection for efficient cross-project queries
 * (avoids N project reads + N job queries per run).
 */

import { onSchedule } from "firebase-functions/v2/scheduler";
import { getFirestore, FieldValue } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";
import { logger } from "firebase-functions";

const TRAINING_BUCKET = process.env.TRAINING_BUCKET || "mlforge-fluent-cable-480715-c8";
const MAX_CHUNK_SIZE = 64 * 1024; // 64KB max for logs

/**
 * Scheduled function that runs every 5 minutes
 * Queries global jobs index for efficiency
 */
export const scheduledMetricsSync = onSchedule({
    schedule: "*/5 * * * *", // Every 5 minutes
    region: "us-central1",
    timeoutSeconds: 300,
    memory: "512MiB",
}, async () => {
    const db = getFirestore();
    const storage = new Storage();
    const bucket = storage.bucket(TRAINING_BUCKET);

    logger.info("[Scheduled Sync] Starting metrics sync run...");

    try {
        // Query from global jobs index - much more efficient than per-project queries
        const jobsSnap = await db.collection("jobs")
            .where("status", "in", ["running", "pending", "RUNNING", "PENDING", "PROVISIONING"])
            .limit(100) // Process max 100 jobs per run
            .get();

        logger.info(`[Scheduled Sync] Found ${jobsSnap.size} running/pending jobs`);

        let synced = 0;
        let errors = 0;

        for (const jobDoc of jobsSnap.docs) {
            const jobData = jobDoc.data();
            const { projectId } = jobData;

            if (!projectId) {
                logger.warn(`[Scheduled Sync] Job ${jobDoc.id} missing projectId`);
                continue;
            }

            try {
                const result = await syncMetricsForJob(
                    bucket,
                    projectId,
                    jobDoc.id,
                    db.collection("projects").doc(projectId).collection("jobs").doc(jobDoc.id),
                    jobDoc.ref
                );

                if (result.synced) {
                    synced++;
                    logger.info(`[Scheduled Sync] ✅ Synced metrics for job ${jobDoc.id}`);
                }
            } catch (error) {
                errors++;
                logger.error(`[Scheduled Sync] Failed for job ${jobDoc.id}:`, error);
            }
        }

        logger.info(`[Scheduled Sync] Complete. Synced: ${synced}, Errors: ${errors}`);
    } catch (error) {
        logger.error("[Scheduled Sync] Fatal error:", error);
    }
});

/**
 * Sync metrics for a single job
 */
async function syncMetricsForJob(
    bucket: ReturnType<Storage["bucket"]>,
    projectId: string,
    jobId: string,
    projectJobRef: FirebaseFirestore.DocumentReference,
    globalJobRef: FirebaseFirestore.DocumentReference
): Promise<{ synced: boolean }> {
    // Try primary path format
    const metricsPath = `projects/${projectId}/jobs/${jobId}/metrics.json`;
    const file = bucket.file(metricsPath);

    const [exists] = await file.exists();
    if (!exists) {
        // Try alternative path
        const altPath = `${projectId}/jobs/${jobId}/metrics.json`;
        const altFile = bucket.file(altPath);
        const [altExists] = await altFile.exists();

        if (!altExists) {
            return { synced: false };
        }

        // Use alternative file
        return await processMetricsFile(altFile, altPath, bucket.name, projectJobRef, globalJobRef, jobId);
    }

    return await processMetricsFile(file, metricsPath, bucket.name, projectJobRef, globalJobRef, jobId);
}

/**
 * Process a metrics file and update Firestore
 */
async function processMetricsFile(
    file: ReturnType<ReturnType<Storage["bucket"]>["file"]>,
    path: string,
    bucketName: string,
    projectJobRef: FirebaseFirestore.DocumentReference,
    globalJobRef: FirebaseFirestore.DocumentReference,
    jobId: string
): Promise<{ synced: boolean }> {
    const [contents] = await file.download();
    const metrics = JSON.parse(contents.toString("utf-8"));

    const updateData = {
        metrics: {
            accuracy: metrics.accuracy || null,
            loss: metrics.loss || null,
            rmse: metrics.rmse || null,
            r2: metrics.r2 || null,
            mae: metrics.mae || null,
            f1: metrics.f1 || null,
            precision: metrics.precision || null,
            recall: metrics.recall || null,
            raw: metrics
        },
        status: "succeeded",
        metricsPath: `gs://${bucketName}/${path}`,
        metricsSyncedAt: FieldValue.serverTimestamp(),
        completedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp()
    };

    // Update both project-level job and global index
    await Promise.all([
        projectJobRef.update(updateData),
        globalJobRef.update({
            status: "succeeded",
            metricsSyncedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        })
    ]);

    logger.info(`[Scheduled Sync] Metrics synced for job ${jobId}:`, {
        accuracy: metrics.accuracy,
        loss: metrics.loss,
        rmse: metrics.rmse
    });

    return { synced: true };
}

/**
 * Helper to fetch logs from GCS with chunk limiting
 * Used by the logs API endpoint
 */
export async function fetchJobLogs(
    projectId: string,
    jobId: string,
    offset: number = 0
): Promise<{ logs: string; offset: number; complete: boolean }> {
    const storage = new Storage();
    const bucket = storage.bucket(TRAINING_BUCKET);
    const logPath = `projects/${projectId}/jobs/${jobId}/logs/output.log`;

    const file = bucket.file(logPath);
    const [exists] = await file.exists();

    if (!exists) {
        return { logs: "", offset: 0, complete: false };
    }

    const [metadata] = await file.getMetadata();
    const size = parseInt(metadata.size as string);

    // If offset is past file size, nothing new
    if (offset >= size) {
        return { logs: "", offset, complete: false };
    }

    // Limit chunk size to prevent huge responses
    const endByte = Math.min(offset + MAX_CHUNK_SIZE, size);
    const stream = file.createReadStream({ start: offset, end: endByte - 1 });
    const chunks: Buffer[] = [];

    for await (const chunk of stream) {
        chunks.push(chunk as Buffer);
    }

    const logs = Buffer.concat(chunks).toString("utf-8");
    const complete = logs.includes("[TRAINING COMPLETE]") || logs.includes("Training completed");

    return {
        logs,
        offset: endByte,
        complete
    };
}
