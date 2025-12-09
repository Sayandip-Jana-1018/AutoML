import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { uploadScriptToGCS, submitVertexTrainingJob } from '@/lib/gcp';
import { validateTrainingConfig, type SubscriptionTier } from '@/lib/resource-policy';
import { createCleaningMetadata, type CleaningConfig, DEFAULT_CLEANING_CONFIG } from '@/lib/data-cleaning';

export const runtime = 'nodejs'; // Required for Google Cloud SDK

export async function POST(req: Request) {
    try {
        const {
            projectId,
            script,
            config = {},
            tier = 'free' as SubscriptionTier,
            cleaningConfig = DEFAULT_CLEANING_CONFIG as CleaningConfig,
            datasetVersionId = null, // Optional: link to specific dataset version
            taskType = 'classification' // 'classification' | 'regression'
        } = await req.json();

        if (!projectId || !script) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Train API] Starting training dispatch for Project: ${projectId} (Tier: ${tier}, TaskType: ${taskType})`);

        // 1. Validate training configuration against resource limits
        const validation = validateTrainingConfig(tier, config);
        if (!validation.valid) {
            console.warn(`[Train API] Config validation failed:`, validation.errors);
            return NextResponse.json({
                error: "Training configuration exceeds plan limits",
                violations: validation.errors
            }, { status: 403 });
        }

        // 2. Create cleaning metadata for job tracking
        const cleaningMetadata = createCleaningMetadata(cleaningConfig);

        // 3. Create versioned script snapshot with options
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
            generatedBy: 'user' // 'user' | 'ai'
        });

        const scriptVersionId = scriptVersionRef.id;
        console.log(`[Train API] Created script version: ${scriptVersionId} (v${versionNumber})`);

        // 4. Upload Script to GCS
        const gcsPath = await uploadScriptToGCS(projectId, script);

        // 5. Submit Real Job to Vertex AI with tier-based limits
        const vertexJob = await submitVertexTrainingJob(projectId, gcsPath, {
            tier,
            machineType: config.machineType
        });

        // 6. Create enriched Job Record in Firestore with full metadata
        const jobRef = await adminDb.collection('projects').doc(projectId).collection('jobs').add({
            // Vertex AI Info
            vertexJobId: vertexJob.jobId,
            status: 'PROVISIONING',

            // Script Versioning (locked to this job)
            scriptVersionId,
            scriptGcsPath: gcsPath,
            scriptSnapshot: script, // Keep for quick access

            // Dataset Versioning (optional)
            datasetVersionId,

            // Task Type
            taskType,

            // Configuration Snapshot (for reproducibility)
            config: {
                machineType: vertexJob.machineType,
                maxDurationHours: vertexJob.maxDurationHours,
                tier,
                ...config
            },

            // Cleaning Config Snapshot (for reproducibility)
            cleaningConfig,
            cleaningMetadata: {
                ...cleaningMetadata,
                // These will be updated after job completion with actual values
                outlierRemovalApplied: cleaningConfig.removeOutliers,
                outlierMethod: cleaningConfig.removeOutliers
                    ? `IQR (threshold: ${cleaningConfig.outlierThreshold})`
                    : null,
                rowsDroppedEstimate: 0 // Will be updated by Vertex callback
            },

            // Metrics (to be filled after completion)
            metrics: null,

            // Cost tracking
            estimatedMaxCost: vertexJob.estimatedMaxCost,
            actualCost: null,

            // Timestamps
            createdAt: FieldValue.serverTimestamp(),
            startedAt: null,
            completedAt: null,

            // Logs
            logs: [
                `Job submitted to Vertex AI API (ID: ${vertexJob.jobId})`,
                `Script version: ${scriptVersionId} (v${versionNumber})`,
                `Script uploaded to ${gcsPath}`,
                `Machine: ${vertexJob.machineType}, Max Duration: ${vertexJob.maxDurationHours}h`,
                `Task Type: ${taskType}`,
                `Outlier Removal: ${cleaningConfig.removeOutliers ? 'Enabled' : 'Disabled'}`
            ],
            progress: 0,
            dashboardUrl: vertexJob.dashboardUrl
        });

        // 7. Update project with latest job reference
        await adminDb.collection('projects').doc(projectId).update({
            latestJobId: jobRef.id,
            latestScriptVersionId: scriptVersionId,
            lastTrainingAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            jobId: jobRef.id,
            vertexJobId: vertexJob.jobId,
            scriptVersionId,
            versionNumber,
            status: 'PROVISIONING',
            machineType: vertexJob.machineType,
            maxDurationHours: vertexJob.maxDurationHours,
            estimatedMaxCost: vertexJob.estimatedMaxCost,
            taskType,
            cleaningMetadata,
            message: "Training job successfully dispatched to Vertex AI"
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Failed to dispatch job to Vertex AI';
        console.error("Training Dispatch Error:", error);
        return NextResponse.json({
            error: errorMessage
        }, { status: 500 });
    }
}
