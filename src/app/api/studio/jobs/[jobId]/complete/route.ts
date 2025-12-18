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
        } else {
            // Fallback: Try to extract metrics from output.log
            console.log(`[Job Complete] metrics.json not found, trying output.log...`);
            const outputLogPath = `projects/${projectId}/jobs/${jobId}/output.log`;
            const outputLogFile = bucket.file(outputLogPath);
            const [logExists] = await outputLogFile.exists();

            if (logExists) {
                try {
                    const [logContent] = await outputLogFile.download();
                    const logStr = logContent.toString();

                    // Parse common metric patterns from output
                    const extractedMetrics: Record<string, number | null> = {};

                    // Accuracy patterns
                    const accuracyMatch = logStr.match(/(?:accuracy|Accuracy|ACC|acc)[\s:=]+([0-9.]+)/i);
                    if (accuracyMatch) extractedMetrics.accuracy = parseFloat(accuracyMatch[1]);

                    // Precision patterns  
                    const precisionMatch = logStr.match(/(?:precision|Precision)[\s:=]+([0-9.]+)/i);
                    if (precisionMatch) extractedMetrics.precision = parseFloat(precisionMatch[1]);

                    // Recall patterns
                    const recallMatch = logStr.match(/(?:recall|Recall)[\s:=]+([0-9.]+)/i);
                    if (recallMatch) extractedMetrics.recall = parseFloat(recallMatch[1]);

                    // F1 patterns
                    const f1Match = logStr.match(/(?:f1[\s_-]?score|F1[\s_-]?Score|f1)[\s:=]+([0-9.]+)/i);
                    if (f1Match) extractedMetrics.f1 = parseFloat(f1Match[1]);

                    // MSE patterns
                    const mseMatch = logStr.match(/(?:mse|MSE|mean_squared_error)[\s:=]+([0-9.]+)/i);
                    if (mseMatch) extractedMetrics.mse = parseFloat(mseMatch[1]);

                    // RMSE patterns
                    const rmseMatch = logStr.match(/(?:rmse|RMSE|root_mean_squared_error)[\s:=]+([0-9.]+)/i);
                    if (rmseMatch) extractedMetrics.rmse = parseFloat(rmseMatch[1]);

                    // R2 patterns
                    const r2Match = logStr.match(/(?:r2[\s_-]?score|R2|r_squared)[\s:=]+([0-9.]+)/i);
                    if (r2Match) extractedMetrics.r2 = parseFloat(r2Match[1]);

                    // Silhouette score (for clustering)
                    const silhouetteMatch = logStr.match(/(?:silhouette[\s_-]?score|silhouette)[\s:=]+([0-9.-]+)/i);
                    if (silhouetteMatch) extractedMetrics.silhouette = parseFloat(silhouetteMatch[1]);

                    if (Object.keys(extractedMetrics).length > 0) {
                        metrics = { ...extractedMetrics, extractedFrom: 'output.log' };
                        console.log(`[Job Complete] Extracted metrics from output.log:`, metrics);
                    } else {
                        console.log(`[Job Complete] No metrics pattern found in output.log`);
                    }
                } catch (logErr) {
                    console.error(`[Job Complete] Failed to read output.log:`, logErr);
                }
            }

            // Also check status.json for metrics
            if (!metrics && statusData.metrics) {
                metrics = statusData.metrics;
                console.log(`[Job Complete] Using metrics from status.json:`, metrics);
            }
        }

        // FLATTEN METRICS HERE - before using them, regardless of source
        if (metrics && typeof metrics === 'object') {
            // Convert algorithm_comparison from nested object to array
            if (metrics.algorithm_comparison && typeof metrics.algorithm_comparison === 'object' && !Array.isArray(metrics.algorithm_comparison)) {
                const algComparison = metrics.algorithm_comparison as Record<string, any>;
                metrics.algorithm_comparison = Object.entries(algComparison).map(([algorithm, scores]) => ({
                    algorithm,
                    cv_score: scores.cv_score,
                    cv_std: scores.cv_std
                }));
                console.log(`[Job Complete] Flattened algorithm_comparison from object to array`);
            }

            // Flatten confusion_matrix - Firestore doesn't support nested arrays
            if (metrics.confusion_matrix && Array.isArray(metrics.confusion_matrix)) {
                // Check if it's a nested array (2D matrix)
                if (Array.isArray(metrics.confusion_matrix[0])) {
                    const matrix = metrics.confusion_matrix as number[][];
                    // Flatten the 2D array to 1D and store dimensions
                    const flatMatrix = matrix.flat();
                    const dimensions = [matrix.length, matrix[0]?.length || 0];
                    metrics.confusion_matrix_flat = flatMatrix;
                    metrics.confusion_matrix_dims = dimensions;
                    delete metrics.confusion_matrix; // Remove nested array
                    console.log(`[Job Complete] Flattened confusion_matrix from ${dimensions[0]}x${dimensions[1]} to flat array`);
                }
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
        if (statusData.status === 'completed' && !job.modelId) {
            try {
                // Get project details
                const projectDoc = await adminDb.collection('projects').doc(projectId).get();
                const project = projectDoc.data();

                if (project && (project.ownerId || project.owner_email)) {
                    // Extract feature columns from project metadata
                    const validFeatureColumns = project.inferredColumns ||
                        (project.dataset?.columns ? project.dataset.columns.filter((c: string) => c !== project.targetColumn) : []);

                    const targetColumn = project.targetColumn || project.dataset?.targetColumn || 'target';

                    const modelData = {
                        name: project.name || `Model ${jobId}`,
                        taskType: project.inferredTaskType || 'classification',
                        projectId,
                        ownerId: project.ownerId || project.owner_email,
                        ownerEmail: project.owner_email || project.ownerId || '',
                        version: job.scriptVersion || 1,
                        metrics: metrics || {}, // Ensure not null
                        gcsPath: `gs://${bucket.name}/projects/${projectId}/jobs/${jobId}/model/`,
                        visibility: 'public' as const,
                        status: 'ready' as const,
                        trainedAt: statusData.completedAt || new Date().toISOString(),
                        updatedAt: new Date().toISOString(),
                        jobId,
                        // Add feature columns for prediction forms
                        feature_columns: Array.isArray(validFeatureColumns) ? validFeatureColumns : [],
                        target_column: targetColumn,
                        algorithm: job.algorithm || job.config?.algorithm || 'Unknown'
                    };

                    const modelId = await registerModel(modelData);
                    console.log(`[Job Complete] Model registered: ${modelId}`);

                    // Link model to job
                    await jobRef.update({ modelId });
                } else {
                    console.warn(`[Job Complete] Could not register model: Project data missing or no owner. Project exists: ${projectDoc.exists}`);
                }
            } catch (regError: any) {
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
        const errorMessage = error?.message || error?.toString() || 'Unknown error';
        console.error('[Job Complete] Error:', errorMessage);
        if (error) console.error('[Job Complete] Error stack:', error.stack);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
