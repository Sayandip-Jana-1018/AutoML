import { NextResponse } from "next/server";
import { adminDb } from "@/lib/firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import { Storage } from "@google-cloud/storage";

export const runtime = "nodejs";

/**
 * POST /api/studio/jobs/[jobId]/sync-metrics
 * 
 * Manually sync metrics from GCS to Firestore for a specific job.
 * This bypasses the need for cross-project Cloud Function triggers.
 * 
 * The training script saves metrics.json to: gs://bucket/projects/{projectId}/jobs/{jobId}/metrics.json
 */
export async function POST(
    req: Request,
    context: { params: Promise<{ jobId: string }> }
) {
    try {
        const { jobId } = await context.params;
        const { projectId } = await req.json();

        if (!projectId || !jobId) {
            return NextResponse.json(
                { error: "Missing projectId or jobId" },
                { status: 400 }
            );
        }

        console.log(`[Metrics Sync] Syncing metrics for job ${jobId} in project ${projectId}`);

        // Get job document to find the metrics path
        const jobRef = adminDb.collection("projects").doc(projectId).collection("jobs").doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return NextResponse.json(
                { error: "Job not found" },
                { status: 404 }
            );
        }

        const jobData = jobDoc.data();

        // Check if metrics already synced
        if (jobData?.metrics?.accuracy || jobData?.metrics?.rmse) {
            return NextResponse.json({
                success: true,
                message: "Metrics already synced",
                metrics: jobData.metrics
            });
        }

        // Try to fetch metrics.json from GCS
        const storage = new Storage();
        const bucket = storage.bucket(process.env.TRAINING_BUCKET || "mlforge-fluent-cable-480715-c8");
        const metricsPath = `projects/${projectId}/jobs/${jobId}/metrics.json`;

        try {
            const file = bucket.file(metricsPath);
            const [exists] = await file.exists();

            if (!exists) {
                // Also try alternative path format
                const altPath = `${projectId}/jobs/${jobId}/metrics.json`;
                const altFile = bucket.file(altPath);
                const [altExists] = await altFile.exists();

                if (!altExists) {
                    return NextResponse.json({
                        success: false,
                        message: "Metrics file not found yet. Training may still be in progress.",
                        checkedPaths: [metricsPath, altPath]
                    });
                }

                const [contents] = await altFile.download();
                const metrics = JSON.parse(contents.toString("utf-8"));

                // Update job with metrics
                await jobRef.update({
                    metrics: {
                        accuracy: metrics.accuracy || null,
                        loss: metrics.loss || null,
                        rmse: metrics.rmse || null,
                        r2: metrics.r2 || null,
                        mae: metrics.mae || null,
                        raw: metrics
                    },
                    status: "succeeded",
                    metricsPath: `gs://${bucket.name}/${altPath}`,
                    metricsSyncedAt: FieldValue.serverTimestamp(),
                    updatedAt: FieldValue.serverTimestamp()
                });

                return NextResponse.json({
                    success: true,
                    message: "Metrics synced successfully",
                    metrics
                });
            }

            const [contents] = await file.download();
            const metrics = JSON.parse(contents.toString("utf-8"));

            // Update job with metrics
            await jobRef.update({
                metrics: {
                    accuracy: metrics.accuracy || null,
                    loss: metrics.loss || null,
                    rmse: metrics.rmse || null,
                    r2: metrics.r2 || null,
                    mae: metrics.mae || null,
                    raw: metrics
                },
                status: "succeeded",
                metricsPath: `gs://${bucket.name}/${metricsPath}`,
                metricsSyncedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });

            // Also update script version if linked
            if (jobData?.scriptVersionId) {
                try {
                    await adminDb
                        .collection("projects")
                        .doc(projectId)
                        .collection("scripts")
                        .doc(jobData.scriptVersionId)
                        .update({
                            metricsSummary: {
                                accuracy: metrics.accuracy || null,
                                loss: metrics.loss || null,
                                rmse: metrics.rmse || null
                            },
                            lastTrainingJobId: jobId,
                            updatedAt: FieldValue.serverTimestamp()
                        });
                } catch (e) {
                    console.warn("[Metrics Sync] Could not update script version:", e);
                }
            }

            return NextResponse.json({
                success: true,
                message: "Metrics synced successfully",
                metrics
            });

        } catch (gcsError: unknown) {
            console.error("[Metrics Sync] GCS error:", gcsError);
            const errorMessage = gcsError instanceof Error ? gcsError.message : "GCS error";
            return NextResponse.json({
                success: false,
                message: "Could not fetch metrics from GCS",
                error: errorMessage
            });
        }

    } catch (error: unknown) {
        console.error("[Metrics Sync] Error:", error);
        const errorMessage = error instanceof Error ? error.message : "Failed to sync metrics";
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
