import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { registerModel } from '@/lib/model-registry';
import { storage, TRAINING_BUCKET } from '@/lib/gcp';

export const runtime = 'nodejs';

/**
 * POST: Sync ALL jobs for a project from GCS to Firestore
 * This is triggered automatically on polling or manually via sync button
 */
export async function POST(req: Request) {
    try {
        const { projectId } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        console.log(`[Sync All] Starting sync for project ${projectId} from bucket ${TRAINING_BUCKET}`);

        // Get all jobs for this project
        const jobsSnapshot = await adminDb
            .collection('projects')
            .doc(projectId)
            .collection('jobs')
            .get();

        const bucket = storage.bucket(TRAINING_BUCKET);
        const results: { jobId: string; status: string; updated: boolean; registered: boolean }[] = [];

        for (const jobDoc of jobsSnapshot.docs) {
            const job = jobDoc.data();
            const jobId = jobDoc.id;

            // Skip already completed jobs
            if (['completed', 'succeeded', 'failed'].includes(job.status)) {
                results.push({ jobId, status: job.status, updated: false, registered: false });
                continue;
            }

            // Check GCS for status.json
            const statusPath = `projects/${projectId}/jobs/${jobId}/status.json`;
            const statusFile = bucket.file(statusPath);
            const [exists] = await statusFile.exists();

            if (!exists) {
                results.push({ jobId, status: job.status, updated: false, registered: false });
                continue;
            }

            // Download and parse status
            const [content] = await statusFile.download();
            const statusData = JSON.parse(content.toString());

            console.log(`[Sync All] Job ${jobId} status from GCS:`, statusData.status);

            // Check for metrics
            let metrics = null;
            const metricsPath = `projects/${projectId}/jobs/${jobId}/metrics.json`;
            const metricsFile = bucket.file(metricsPath);
            const [metricsExists] = await metricsFile.exists();

            if (metricsExists) {
                const [metricsContent] = await metricsFile.download();
                metrics = JSON.parse(metricsContent.toString());
            }

            // Update Firestore
            const newStatus = statusData.status === 'completed' ? 'succeeded' : statusData.status;
            const updateData: Record<string, any> = {
                status: newStatus,
                completedAt: statusData.completedAt || FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            };

            if (metrics) {
                updateData.metrics = metrics;
            }

            await jobDoc.ref.update(updateData);

            // Register model if completed
            let registered = false;
            if (statusData.status === 'completed') {
                try {
                    const projectDoc = await adminDb.collection('projects').doc(projectId).get();
                    const project = projectDoc.data();

                    if (project?.ownerId || project?.owner_email) {
                        const modelData = {
                            name: project.name || `Model ${jobId}`,
                            taskType: project.inferredTaskType || 'classification',
                            projectId,
                            ownerId: project.ownerId || project.owner_email,
                            ownerEmail: project.owner_email,
                            version: job.scriptVersion || 1,
                            metrics: metrics || {},
                            gcsPath: `gs://${bucket.name}/projects/${projectId}/jobs/${jobId}/model/`,
                            visibility: 'private' as const,
                            status: 'ready' as const,
                            trainedAt: statusData.completedAt || new Date().toISOString(),
                            jobId
                        };

                        const modelId = await registerModel(modelData);
                        console.log(`[Sync All] Model registered: ${modelId}`);
                        await jobDoc.ref.update({ modelId });
                        registered = true;
                    }
                } catch (regError) {
                    console.error('[Sync All] Model registration failed:', regError);
                }
            }

            results.push({ jobId, status: newStatus, updated: true, registered });
        }

        console.log(`[Sync All] Completed sync for ${results.length} jobs`);

        return NextResponse.json({
            success: true,
            projectId,
            jobsProcessed: results.length,
            jobsUpdated: results.filter(r => r.updated).length,
            modelsRegistered: results.filter(r => r.registered).length,
            results
        });

    } catch (error: any) {
        console.error('[Sync All] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
