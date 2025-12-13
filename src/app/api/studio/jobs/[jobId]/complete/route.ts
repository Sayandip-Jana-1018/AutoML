import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { registerModel } from '@/lib/model-registry';
import { storage, TRAINING_BUCKET } from '@/lib/gcp';

export const runtime = 'nodejs';

/**
 * POST: Check job status in GCS and sync to Firestore
 * Also registers model if training completed successfully
 * This is called by frontend polling to detect job completion
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ jobId: string }> }
) {
    try {
        const { projectId } = await req.json();
        const { jobId } = await params;

        if (!projectId || !jobId) {
            return NextResponse.json({ error: 'Missing projectId or jobId' }, { status: 400 });
        }

        console.log(`[Job Complete] Checking job ${jobId} for project ${projectId} in bucket ${TRAINING_BUCKET}`);

        // Get job from Firestore
        const jobRef = adminDb.collection('projects').doc(projectId).collection('jobs').doc(jobId);
        const jobDoc = await jobRef.get();

        if (!jobDoc.exists) {
            return NextResponse.json({ error: 'Job not found' }, { status: 404 });
        }

        const job = jobDoc.data()!;

        // Check if already completed
        if (['completed', 'succeeded', 'failed'].includes(job.status)) {
            return NextResponse.json({
                status: job.status,
                metrics: job.metrics,
                alreadyComplete: true
            });
        }

        // Check GCS for status.json using correct training bucket
        const bucket = storage.bucket(TRAINING_BUCKET);
        const statusPath = `projects/${projectId}/jobs/${jobId}/status.json`;
        const statusFile = bucket.file(statusPath);

        const [exists] = await statusFile.exists();

        if (!exists) {
            return NextResponse.json({
                status: 'running',
                message: 'Still training...'
            });
        }

        // Download and parse status
        const [content] = await statusFile.download();
        const rawContent = content.toString();

        let statusData;
        try {
            statusData = JSON.parse(rawContent);
        } catch (parseError) {
            console.error(`[Job Complete] Failed to parse status.json. Raw content: "${rawContent.substring(0, 200)}..."`);
            // File exists but isn't valid JSON yet - training might still be writing it
            return NextResponse.json({
                status: 'running',
                message: 'Status file is being written, waiting...'
            });
        }

        console.log(`[Job Complete] Status from GCS:`, statusData);

        // Check for metrics
        let metrics = null;
        const metricsPath = `projects/${projectId}/jobs/${jobId}/metrics.json`;
        const metricsFile = bucket.file(metricsPath);
        const [metricsExists] = await metricsFile.exists();

        if (metricsExists) {
            const [metricsContent] = await metricsFile.download();
            // Sanitize JSON: Replace NaN, Infinity, -Infinity with null (not valid JSON)
            let metricsStr = metricsContent.toString();
            metricsStr = metricsStr.replace(/:\s*NaN\b/g, ': null');
            metricsStr = metricsStr.replace(/:\s*Infinity\b/g, ': null');
            metricsStr = metricsStr.replace(/:\s*-Infinity\b/g, ': null');
            try {
                metrics = JSON.parse(metricsStr);
                console.log(`[Job Complete] Metrics:`, metrics);
            } catch (parseErr) {
                console.error(`[Job Complete] Failed to parse metrics:`, parseErr);
                console.log(`[Job Complete] Raw metrics string:`, metricsStr.substring(0, 500));
                metrics = { parseError: true };
            }
        }

        // Calculate actual runtime and cost
        const USD_TO_INR = parseFloat(process.env.USD_TO_INR || '83.0');
        let actualRuntimeSeconds = 0;
        let actualCostUsd = 0;
        let actualCostInr = 0;
        let actualStartAt = null;
        let actualEndAt = null;

        // Get timestamps from status.json or job document
        const jobCreatedAt = job.createdAt?.toDate?.() || new Date(job.createdAt);
        const completedAtTime = statusData.completedAt ? new Date(statusData.completedAt) : new Date();

        // If status.json has start/end times, use them
        if (statusData.startedAt) {
            actualStartAt = statusData.startedAt;
            actualEndAt = statusData.completedAt || new Date().toISOString();
            actualRuntimeSeconds = Math.round(
                (new Date(actualEndAt).getTime() - new Date(actualStartAt).getTime()) / 1000
            );
        } else {
            // Fallback: use job creation time
            actualStartAt = jobCreatedAt.toISOString();
            actualEndAt = completedAtTime.toISOString();
            actualRuntimeSeconds = Math.round(
                (completedAtTime.getTime() - jobCreatedAt.getTime()) / 1000
            );
        }

        // Calculate cost based on runtime
        const costPerHourUsd = job.costPerHourUsd || job.estimatedCostPerHour || 0.04;
        const runtimeHours = actualRuntimeSeconds / 3600;
        actualCostUsd = parseFloat((costPerHourUsd * runtimeHours).toFixed(4));
        actualCostInr = parseFloat((actualCostUsd * USD_TO_INR).toFixed(2));

        // Update job in Firestore
        const updateData: Record<string, any> = {
            status: statusData.status === 'completed' ? 'succeeded' : statusData.status,
            completedAt: statusData.completedAt || FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp(),
            // Actual runtime and cost
            actualStartAt,
            actualEndAt,
            actualRuntimeSeconds,
            actualCostUsd,
            actualCostInr,
            // Phase info from status.json
            currentPhase: statusData.phase || 'completed',
            phaseProgress: statusData.progress || 100
        };

        if (metrics) {
            updateData.metrics = metrics;
        }

        await jobRef.update(updateData);

        // Also update the global jobs collection
        try {
            await adminDb.collection('jobs').doc(jobId).update({
                status: updateData.status,
                updatedAt: FieldValue.serverTimestamp()
            });
        } catch (e) {
            // Global job may not exist (legacy jobs), ignore
        }

        // If completed successfully, register in model registry (only if not already registered)
        // NOTE: Register even without metrics - model can still be deployed
        if (statusData.status === 'completed' && !job.modelId) {
            try {
                // Get project details
                const projectDoc = await adminDb.collection('projects').doc(projectId).get();
                const project = projectDoc.data();

                if (project?.ownerId || project?.owner_email) {
                    // Extract feature columns from project metadata
                    const featureColumns = project.inferredColumns ||
                        project.dataset?.columns?.filter((c: string) => c !== project.targetColumn) ||
                        [];
                    const targetColumn = project.targetColumn || project.dataset?.targetColumn || 'target';

                    const modelData = {
                        name: project.name || `Model ${jobId}`,
                        taskType: project.inferredTaskType || 'classification',
                        projectId,
                        ownerId: project.ownerId || project.owner_email,
                        ownerEmail: project.owner_email,
                        version: job.scriptVersion || 1,
                        metrics,
                        gcsPath: `gs://${bucket.name}/projects/${projectId}/jobs/${jobId}/model/`,
                        visibility: 'public' as const, // Changed to public for marketplace display
                        status: 'ready' as const,
                        trainedAt: statusData.completedAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        jobId,
                        // Add feature columns for prediction forms
                        feature_columns: featureColumns,
                        target_column: targetColumn,
                        algorithm: job.algorithm || job.config?.algorithm || 'Unknown'
                    };

                    const modelId = await registerModel(modelData);
                    console.log(`[Job Complete] Model registered: ${modelId}`);

                    // Link model to job
                    await jobRef.update({ modelId });
                }
            } catch (regError) {
                console.error('[Job Complete] Model registration failed:', regError);
                // Don't fail the whole request
            }
        }

        return NextResponse.json({
            status: updateData.status,
            metrics,
            completedAt: statusData.completedAt,
            registered: statusData.status === 'completed'
        });

    } catch (error: any) {
        console.error('[Job Complete] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
