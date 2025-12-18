import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { uploadScriptToGCS } from '@/lib/gcp';
import { validateTrainingConfig, type SubscriptionTier } from '@/lib/resource-policy';
import { createCleaningMetadata, type CleaningConfig, DEFAULT_CLEANING_CONFIG } from '@/lib/data-cleaning';
import { submitComputeEngineJob, COMPUTE_ENGINE_CONFIGS, estimateTrainingCost } from '@/lib/compute-training';
import { routeTraining, detectDatasetType, validateDatasetSize, validateDatasetModelCompatibility, type DatasetType } from '@/lib/training-router';

export const runtime = 'nodejs'; // Required for Google Cloud SDK

/**
 * Detect algorithm from script content
 * Looks for common ML algorithm imports and instantiations
 */
function detectAlgorithmFromScript(script: string): string {
    const scriptLower = script.toLowerCase();

    // Common algorithm patterns (order matters - check specific patterns first)
    const algorithmPatterns: [RegExp | string, string][] = [
        // Clustering
        [/agglomerativeclustering|hierarchical.*cluster/i, 'HierarchicalClustering'],
        [/kmeans|k-means/i, 'KMeans'],
        [/dbscan/i, 'DBSCAN'],

        // Deep Learning
        [/torch|pytorch|nn\.module/i, 'PyTorch'],
        [/tensorflow|keras|sequential\(/i, 'TensorFlow/Keras'],

        // Gradient Boosting
        [/xgboost|xgbclassifier|xgbregressor/i, 'XGBoost'],
        [/lightgbm|lgbm/i, 'LightGBM'],
        [/catboost/i, 'CatBoost'],
        [/gradientboosting/i, 'GradientBoosting'],

        // Ensemble
        [/randomforest/i, 'RandomForest'],
        [/extratrees/i, 'ExtraTrees'],
        [/adaboost/i, 'AdaBoost'],
        [/bagging/i, 'Bagging'],

        // Linear Models
        [/logisticregression/i, 'LogisticRegression'],
        [/linearregression/i, 'LinearRegression'],
        [/ridge/i, 'Ridge'],
        [/lasso/i, 'Lasso'],
        [/elasticnet/i, 'ElasticNet'],

        // SVM
        [/svc\(|svm\.svc/i, 'SVC'],
        [/svr\(|svm\.svr/i, 'SVR'],

        // Tree-based
        [/decisiontree/i, 'DecisionTree'],

        // Neighbors
        [/kneighbors|knn/i, 'KNN'],

        // Naive Bayes
        [/naivebayes|gaussiannb|multinomialnb/i, 'NaiveBayes'],
    ];

    for (const [pattern, algorithm] of algorithmPatterns) {
        if (pattern instanceof RegExp) {
            if (pattern.test(script)) return algorithm;
        } else {
            if (scriptLower.includes(pattern.toLowerCase())) return algorithm;
        }
    }

    return 'Unknown';
}

/**
 * Pre-flight validation to catch common script errors BEFORE training
 * This saves compute costs by rejecting broken scripts early
 */
function validateScriptPreFlight(script: string): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    // 1. Check for placeholder file paths (common AI mistake)
    const placeholderPaths = [
        /['"]path_to/i,
        /['"]your_file/i,
        /['"]your_dataset/i,
        /['"]placeholder/i,
    ];
    for (const pattern of placeholderPaths) {
        if (pattern.test(script)) {
            errors.push(`Script contains placeholder path like 'path_to', 'your_file', etc. Please use actual file paths.`);
            break;
        }
    }

    // 2. Check for required functions
    if (!script.includes('def load_data')) {
        errors.push("Missing 'load_data' function");
    }
    if (!script.includes('if __name__') && !script.includes('main()') && !script.includes('main(')) {
        errors.push("Missing main execution block (if __name__ == '__main__' or main())");
    }

    // 3. Check for basic imports
    if (!script.includes('import pandas') && !script.includes('from pandas')) {
        errors.push("Missing pandas import");
    }

    // 4. Check for obvious syntax issues (basic patterns)
    const openParens = (script.match(/\(/g) || []).length;
    const closeParens = (script.match(/\)/g) || []).length;
    if (Math.abs(openParens - closeParens) > 5) {
        errors.push("Possible unbalanced parentheses");
    }

    // 5. Check script uses a valid dataset path (startup script will fix common paths)
    // Accept: ./dataset.csv, /tmp/dataset.csv, /tmp/training/dataset.csv, DATASET_GCS_PATH
    if (!script.includes('./dataset.csv') &&
        !script.includes('/tmp/dataset.csv') &&
        !script.includes('DATASET_GCS_PATH') &&
        !script.includes('/tmp/training/dataset')) {
        errors.push("Script should use './dataset.csv' as the data path (startup script will place dataset here)");
    }

    return { valid: errors.length === 0, errors };
}

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

        // PRE-FLIGHT VALIDATION - catch common errors before wasting compute
        const preFlightResult = validateScriptPreFlight(script);
        if (!preFlightResult.valid) {
            console.log(`[Train API] Pre-flight validation failed:`, preFlightResult.errors);
            return NextResponse.json({
                error: `Script validation failed: ${preFlightResult.errors.join('; ')}`,
                validationErrors: preFlightResult.errors,
                suggestion: "Please fix the script and try again. The AI chat should generate scripts using '/tmp/dataset.csv' as the data path."
            }, { status: 400 });
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

        // 3b. Validate dataset-model compatibility (e.g., block LinearRegression on images)
        const detectedAlgorithm = detectAlgorithmFromScript(script);
        const compatValidation = validateDatasetModelCompatibility(datasetType, taskType, detectedAlgorithm);
        if (!compatValidation.valid) {
            return NextResponse.json({
                error: "Dataset-Model Incompatibility",
                message: compatValidation.error,
                suggestions: compatValidation.suggestions,
                datasetType,
                algorithm: detectedAlgorithm
            }, { status: 400 });
        }
        // Log warning if present
        if (compatValidation.warning) {
            console.warn(`[Train API] Compatibility warning: ${compatValidation.warning}`);
        }

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

        // 5. Create versioned script snapshot (with duplicate check)
        const scriptsRef = adminDb.collection('projects').doc(projectId).collection('scripts');

        // Check if a recent version with same content exists (within last 10 seconds)
        const recentScriptsQuery = await scriptsRef
            .orderBy('createdAt', 'desc')
            .limit(1)
            .get();

        let scriptVersionId: string = '';
        let versionNumber: number = 0;
        let isDuplicate = false;

        if (!recentScriptsQuery.empty) {
            const lastVersion = recentScriptsQuery.docs[0];
            const lastVersionData = lastVersion.data();
            const timeDiff = Date.now() - (lastVersionData.createdAt?.toMillis() || 0);

            // If last version has same content and was created within 10 seconds, reuse it
            if (lastVersionData.content === script && timeDiff < 10000) {
                scriptVersionId = lastVersion.id;
                versionNumber = lastVersionData.version;
                isDuplicate = true;
                console.log(`[Train API] Reusing recent script version: ${scriptVersionId} (v${versionNumber}) - duplicate detected`);
            }
        }

        if (!isDuplicate) {
            // Create new version
            const scriptsSnapshot = await scriptsRef.count().get();
            versionNumber = scriptsSnapshot.data().count + 1;

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

            scriptVersionId = scriptVersionRef.id;
            console.log(`[Train API] Created script version: ${scriptVersionId} (v${versionNumber})`);
        }


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

            // Algorithm detected from script content
            algorithm: config.algorithm || detectAlgorithmFromScript(script),

            // Logs - Use originalFilename and show cost in INR
            logs: [
                `Training job created (Backend: ${routeDecision.backend})`,
                `VM: ${trainingResult.vmName} (${trainingResult.machineType})`,
                `Script version: ${scriptVersionId} (v${versionNumber})`,
                `Dataset: ${originalFilename} (${datasetSizeMB} MB, ${datasetType})`,
                `Task Type: ${taskType}`,
                `Algorithm: ${config.algorithm || detectAlgorithmFromScript(script)}`,
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
