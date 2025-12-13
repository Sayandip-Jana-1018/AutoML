import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { uploadScriptToGCS } from '@/lib/gcp';
import { validateTrainingConfig, type SubscriptionTier } from '@/lib/resource-policy';
import { createCleaningMetadata, type CleaningConfig, DEFAULT_CLEANING_CONFIG } from '@/lib/data-cleaning';
import { submitComputeEngineJob, COMPUTE_ENGINE_CONFIGS, estimateTrainingCost } from '@/lib/compute-training';
import { routeTraining, detectDatasetType, validateDatasetSize, type DatasetType } from '@/lib/training-router';

export const runtime = 'nodejs'; // Required for Google Cloud SDK

export async function POST(req: Request) {
    try {
        const {
            projectId,
            script,
            config = {},
            tier = 'free' as SubscriptionTier,
            cleaningConfig = DEFAULT_CLEANING_CONFIG as CleaningConfig,
            datasetVersionId = null,
            taskType = 'classification',
            datasetFilename = 'dataset.csv',
            originalFilename = datasetFilename,
            datasetSizeMB = 5,
            datasetRows = 0,
            // Retry tracking
            retryOf = null,
            retryReason = null,
            // GPU preference (Gold tier only)
            preferGPU = false
        } = await req.json();

        if (!projectId || !script) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Train API] Starting training for Project: ${projectId} (Tier: ${tier}, TaskType: ${taskType})`);

        // 1. Validate training configuration against resource limits
        const validation = validateTrainingConfig(tier, config);
        if (!validation.valid) {
            console.warn(`[Train API] Config validation failed:`, validation.errors);
            return NextResponse.json({
                error: "Training configuration exceeds plan limits",
                violations: validation.errors
            }, { status: 403 });
        }

        // 2. Validate dataset size against tier limits
        const datasetValidation = validateDatasetSize(tier, datasetSizeMB);
        if (!datasetValidation.valid) {
            return NextResponse.json({
                error: "Dataset too large for your plan",
                message: datasetValidation.message,
                maxAllowed: datasetValidation.maxAllowed,
                currentSize: datasetSizeMB
            }, { status: 403 });
        }

        // 3. Detect dataset type and route to appropriate backend
        const datasetType: DatasetType = detectDatasetType(datasetFilename);
        const routeDecision = routeTraining({
            tier,
            datasetType,
            taskType,
            datasetSizeMB,
            userPreference: preferGPU ? 'gpu' : 'cpu'
        });

        console.log(`[Train API] Backend: ${routeDecision.backend}, Machine: ${routeDecision.machineType}`);

        // 4. Create cleaning metadata for job tracking
        const cleaningMetadata = createCleaningMetadata(cleaningConfig);

        // 5. Create versioned script snapshot
        const scriptsRef = adminDb.collection('projects').doc(projectId).collection('scripts');
        const scriptsSnapshot = await scriptsRef.count().get();
        const versionNumber = scriptsSnapshot.data().count + 1;

        const scriptVersionRef = await scriptsRef.add({
            content: script,
            options: {
                ...config,
                taskType,
                cleaningConfig
            },
            config,
            cleaningConfig,
            createdAt: FieldValue.serverTimestamp(),
            version: versionNumber,
            generatedBy: 'user'
        });

        const scriptVersionId = scriptVersionRef.id;
        console.log(`[Train API] Created script version: ${scriptVersionId} (v${versionNumber})`);

        // 6. Get dataset GCS path from project
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        const projectData = projectDoc.data();
        // Check all possible locations for dataset path
        const datasetGcsPath = projectData?.datasetGcsPath ||
            projectData?.dataset?.storageUrl ||  // This is the actual field name
            projectData?.dataset?.gcsPath ||
            projectData?.dataset?.url ||
            '';
        console.log(`[Train API] Dataset GCS path: ${datasetGcsPath || 'Not found'}`);

        // 7. Upload Script to GCS
        const gcsPath = await uploadScriptToGCS(projectId, script);

        // 8. Generate a jobId for the Firestore record
        const jobRef = adminDb.collection('projects').doc(projectId).collection('jobs').doc();
        const firestoreJobId = jobRef.id;

        // 9. Calculate model output path
        const trainingBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mlforge-fluent-cable-480715-c8';
        const modelOutputPath = `gs://${trainingBucket}/projects/${projectId}/jobs/${firestoreJobId}/model/`;

        // 10. Calculate retry count if this is a retry
        let retryCount = 0;
        if (retryOf) {
            const prevJobDoc = await adminDb.collection('projects').doc(projectId).collection('jobs').doc(retryOf).get();
            retryCount = (prevJobDoc.data()?.retryCount || 0) + 1;
        }

        // 11. Submit to appropriate backend based on routing decision
        let trainingResult: {
            vmName?: string;
            podId?: string;
            zone?: string;
            machineType: string;
            estimatedCostPerHour: number;
            maxDurationHours: number;
            consoleUrl: string;
        };

        if (routeDecision.backend === 'gcp-compute-engine') {
            // Use Compute Engine for CPU training
            const ceResult = await submitComputeEngineJob({
                projectId,
                jobId: firestoreJobId,
                scriptGcsPath: gcsPath,
                datasetGcsPath,
                tier
            });
            trainingResult = {
                vmName: ceResult.vmName,
                zone: ceResult.zone,
                machineType: ceResult.machineType,
                estimatedCostPerHour: ceResult.estimatedCostPerHour,
                maxDurationHours: ceResult.maxDurationHours,
                consoleUrl: ceResult.consoleUrl
            };
        } else {
            // Use RunPod for GPU training (Gold tier deep learning)
            const { submitRunPodTrainingJob, isRunPodConfigured } = await import('@/lib/runpod-training');

            if (!isRunPodConfigured()) {
                // Fallback to Compute Engine if RunPod not configured
                console.log(`[Train API] RunPod not configured, falling back to Compute Engine`);
                const ceResult = await submitComputeEngineJob({
                    projectId,
                    jobId: firestoreJobId,
                    scriptGcsPath: gcsPath,
                    datasetGcsPath,
                    tier
                });
                trainingResult = {
                    vmName: ceResult.vmName,
                    zone: ceResult.zone,
                    machineType: ceResult.machineType,
                    estimatedCostPerHour: ceResult.estimatedCostPerHour,
                    maxDurationHours: ceResult.maxDurationHours,
                    consoleUrl: ceResult.consoleUrl
                };
            } else {
                // Use RunPod GPU
                const rpResult = await submitRunPodTrainingJob({
                    projectId,
                    jobId: firestoreJobId,
                    scriptGcsPath: gcsPath,
                    datasetGcsPath,
                    gpuType: routeDecision.gpuType
                });
                trainingResult = {
                    podId: rpResult.podId,
                    machineType: rpResult.gpuType,
                    estimatedCostPerHour: rpResult.estimatedCostPerHour,
                    maxDurationHours: 8, // Default max for RunPod
                    consoleUrl: `https://www.runpod.io/console/pods/${rpResult.podId}`
                };
            }
        }

        // 12. Estimate training time and cost
        const costEstimate = estimateTrainingCost(tier, datasetSizeMB);

        // 13. Create enriched Job Record in Firestore
        await jobRef.set({
            // Backend Info
            backend: routeDecision.backend,
            vmName: trainingResult.vmName || null,
            vmZone: trainingResult.zone || null,
            podId: trainingResult.podId || null,
            status: 'PROVISIONING',

            // Script Versioning
            scriptVersionId,
            scriptGcsPath: gcsPath,
            scriptSnapshot: script,

            // Dataset Info
            datasetVersionId,
            datasetGcsPath,
            datasetType,
            datasetSizeMB,
            datasetRows,
            originalFilename: originalFilename || datasetFilename,

            // Task Type
            taskType,

            // Model Output
            modelOutputPath,

            // Configuration Snapshot
            config: {
                machineType: trainingResult.machineType,
                maxDurationHours: trainingResult.maxDurationHours,
                tier,
                gpuEnabled: routeDecision.gpuEnabled,
                gpuType: routeDecision.gpuType || null,
                ...config
            },

            // Cleaning Config
            cleaningConfig,
            cleaningMetadata: {
                ...cleaningMetadata,
                outlierRemovalApplied: cleaningConfig.removeOutliers,
                outlierMethod: cleaningConfig.removeOutliers
                    ? `IQR (threshold: ${cleaningConfig.outlierThreshold})`
                    : null,
                rowsDroppedEstimate: 0
            },

            // Retry tracking
            retryOf: retryOf || null,
            retryReason: retryReason || null,
            retryCount: retryCount,

            // Metrics (to be filled after completion)
            metrics: null,

            // Cost tracking
            estimatedCostPerHour: trainingResult.estimatedCostPerHour,
            costPerHourUsd: trainingResult.estimatedCostPerHour,
            estimatedTotalCost: costEstimate.estimatedCost,
            estimatedMinutes: costEstimate.estimatedMinutes,
            actualCostUsd: null,
            actualCostInr: null,
            actualRuntimeSeconds: null,

            // Timestamps
            createdAt: FieldValue.serverTimestamp(),
            startedAt: null,
            completedAt: null,

            // Algorithm from config
            algorithm: config.algorithm || 'RandomForest',

            // Logs - Use originalFilename and show cost in INR
            logs: [
                `Training job created (Backend: ${routeDecision.backend})`,
                `VM: ${trainingResult.vmName} (${trainingResult.machineType})`,
                `Script version: ${scriptVersionId} (v${versionNumber})`,
                `Dataset: ${originalFilename} (${datasetSizeMB} MB, ${datasetType})`,
                `Task Type: ${taskType}`,
                `Algorithm: ${config.algorithm || 'RandomForest'}`,
                `Estimated time: ${costEstimate.estimatedMinutes} minutes`,
                `Estimated cost: ₹${(costEstimate.estimatedCost * 83).toFixed(4)} (≈$${costEstimate.estimatedCost.toFixed(4)})`,
                ...(retryOf ? [`Retry #${retryCount} of job ${retryOf} (reason: ${retryReason || 'manual'})`] : [])
            ],
            progress: 0,
            consoleUrl: trainingResult.consoleUrl
        });

        // 14. Write to global jobs index
        await adminDb.collection('jobs').doc(firestoreJobId).set({
            projectId,
            status: 'PROVISIONING',
            backend: routeDecision.backend,
            vmName: trainingResult.vmName,
            createdAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        // 15. Update project with latest job reference
        await adminDb.collection('projects').doc(projectId).update({
            latestJobId: jobRef.id,
            latestScriptVersionId: scriptVersionId,
            lastTrainingAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            jobId: jobRef.id,
            vmName: trainingResult.vmName,
            backend: routeDecision.backend,
            scriptVersionId,
            versionNumber,
            status: 'PROVISIONING',
            machineType: trainingResult.machineType,
            specs: routeDecision.specs,
            maxDurationHours: trainingResult.maxDurationHours,
            estimatedCost: costEstimate.estimatedCost,
            estimatedMinutes: costEstimate.estimatedMinutes,
            gpuEnabled: routeDecision.gpuEnabled,
            taskType,
            datasetType,
            cleaningMetadata,
            consoleUrl: trainingResult.consoleUrl,
            message: `Training job dispatched to ${routeDecision.backend === 'gcp-compute-engine' ? 'Google Cloud Compute Engine' : 'RunPod GPU Cloud'}`
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to dispatch training job';
        console.error("Training Dispatch Error:", error);

        // Check for quota/resource exhausted errors
        const isQuotaError = errorMessage.includes('RESOURCE_EXHAUSTED') ||
            errorMessage.includes('quota') ||
            errorMessage.includes('Quota') ||
            errorMessage.includes('exceeded');

        if (isQuotaError) {
            return NextResponse.json({
                error: 'Training quota exceeded',
                code: 'RESOURCE_EXHAUSTED',
                details: 'GCP compute quota has been reached. This is usually temporary.',
                suggestions: [
                    'Wait a few minutes and try again',
                    'Use a smaller machine type',
                    'Contact support if this persists'
                ],
                originalError: errorMessage
            }, { status: 429 });
        }

        return NextResponse.json({
            error: errorMessage
        }, { status: 500 });
    }
}
