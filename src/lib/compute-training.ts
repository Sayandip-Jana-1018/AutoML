/**
 * Compute Engine Training Module
 * 
 * Manages VM lifecycle for ML training:
 * - Creates VM with startup script
 * - Runs training, writes logs/metrics to GCS
 * - Auto-deletes VM on completion
 */

const compute = require('@google-cloud/compute');
import { Storage } from '@google-cloud/storage';
import { SubscriptionTier } from './resource-policy';

// Initialize clients with credentials
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

const computeClient = privateKey && clientEmail
    ? new compute.InstancesClient({
        credentials: {
            client_email: clientEmail,
            private_key: privateKey,
        }
    })
    : new compute.InstancesClient();

const storage = new Storage(privateKey && clientEmail ? {
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    }
} : undefined);

// Configuration from environment
const GCP_PROJECT_ID = process.env.GCP_PROJECT_ID || 'fluent-cable-480715-c8';
const GCP_ZONE = process.env.GCP_ZONE || 'us-central1-a';
// Use GCP_TRAINING_BUCKET for training outputs (NOT Firebase Storage)
const TRAINING_BUCKET = process.env.GCP_TRAINING_BUCKET || 'mlforge-fluent-cable-480715-c8';
const SERVICE_ACCOUNT_EMAIL = process.env.FIREBASE_ADMIN_CLIENT_EMAIL || '';

/**
 * Machine configurations per tier
 */
export const COMPUTE_ENGINE_CONFIGS: Record<SubscriptionTier, {
    machineType: string;
    specs: string;
    maxDatasetMB: number;
    costPerHour: number;
    maxHours: number;
}> = {
    free: {
        machineType: 'e2-medium',
        specs: '2 vCPU, 4 GB RAM',
        maxDatasetMB: 10,
        costPerHour: 0.07,
        maxHours: 1
    },
    silver: {
        machineType: 'e2-standard-4',
        specs: '4 vCPU, 16 GB RAM',
        maxDatasetMB: 100,
        costPerHour: 0.13,
        maxHours: 4
    },
    gold: {
        machineType: 'e2-highmem-8',
        specs: '8 vCPU, 64 GB RAM',
        maxDatasetMB: 500,
        costPerHour: 0.36,
        maxHours: 24
    }
};

/**
 * Generate startup script for training VM
 */
export function createStartupScript(params: {
    projectId: string;
    jobId: string;
    datasetGcsPath: string;
    scriptGcsPath: string;
    bucket: string;
    zone: string;
    trainingConfig?: {  // User's training config from overlay
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        trees?: number;
    };
}): string {
    const { projectId, jobId, datasetGcsPath, scriptGcsPath, bucket, zone, trainingConfig } = params;

    return `#!/bin/bash
# MLForge Training VM Startup Script
# IMPORTANT: google-cloud-sdk must be installed BEFORE any gsutil/gcloud commands

exec > >(tee -a /var/log/training.log) 2>&1

STATUS="failed"
ERROR_MSG=""
GCS_BASE="gs://${bucket}/projects/${projectId}/jobs/${jobId}"

echo "========================================"
echo "MLForge Training Started at $(date)"
echo "Project: ${projectId}"
echo "Job: ${jobId}"
echo "Dataset: ${datasetGcsPath}"
echo "Script: ${scriptGcsPath}"
echo "========================================"

# Helper function to write valid JSON status (avoids escaping issues)
write_status() {
    local status="$1"
    local phase="$2"
    local error="$3"
    local ts=$(date -u +%Y-%m-%dT%H:%M:%SZ)
    printf '{"status": "%s", "phase": "%s", "completedAt": "%s", "error": "%s"}\\n' "$status" "$phase" "$ts" "$error" > /tmp/status.json
}

# Install dependencies (Google Cloud SDK first since gsutil is needed for status updates)
echo "[1/6] Installing dependencies..."
apt-get update -qq

# CRITICAL: Install google-cloud-sdk FIRST - gsutil is not installed on Debian 11 by default!
apt-get install -y -qq google-cloud-sdk python3-pip python3-venv 2>&1 || { 
    echo "FATAL: Failed to install google-cloud-sdk"
    exit 1 
}

echo "gsutil version: $(gsutil version -l 2>&1 | head -1)"
echo "gcloud version: $(gcloud version 2>&1 | head -1)"

# NOW that gsutil is installed, set up the cleanup trap
cleanup_and_exit() {
    echo "[CLEANUP] Final status: $STATUS, Error: $ERROR_MSG"
    gsutil cp /var/log/training.log "$GCS_BASE/output.log" 2>/dev/null || true
    if [ -f /tmp/training/metrics.json ]; then
        gsutil cp /tmp/training/metrics.json "$GCS_BASE/metrics.json" || true
    fi
    if [ -d /tmp/training/model ]; then
        gsutil -m cp -r /tmp/training/model/* "$GCS_BASE/model/" 2>/dev/null || true
    fi
    write_status "$STATUS" "cleanup" "$ERROR_MSG"
    gsutil cp /tmp/status.json "$GCS_BASE/status.json"
    echo "======================================="
    echo "MLForge Training Finished at $(date)"
    echo "Status: $STATUS"
    echo "======================================="
    # Auto-delete VM after training (now that training is confirmed working)
    echo "Deleting VM in 5 seconds..."
    sleep 5
    gcloud compute instances delete $(hostname) --zone=${zone} --quiet &
}
trap cleanup_and_exit EXIT

write_status "installing" "dependencies" ""
gsutil cp /tmp/status.json "$GCS_BASE/status.json" 2>/dev/null || echo "Warning: Could not upload initial status"

# Create and activate virtual environment (Debian 12 PEP 668 compliance)
echo "[1.5/6] Setting up virtual environment..."
python3 -m venv /opt/mlforge-env
source /opt/mlforge-env/bin/activate

# Install Python packages inside venv
pip install --quiet --upgrade pip 2>/dev/null || { ERROR_MSG="Failed to upgrade pip"; exit 1; }
# CRITICAL: Pin scikit-learn>=1.5.0 to match local environment (v1.7.0) and avoid pickle errors (_RemainderColsList)
pip install --quiet "scikit-learn>=1.5.0" pandas numpy xgboost lightgbm catboost google-cloud-storage joblib 2>/dev/null || { ERROR_MSG="Failed to install Python packages"; exit 1; }

# Create working directory
mkdir -p /tmp/training
cd /tmp/training

# Download training script from GCS
echo "[2/6] Downloading training script..."
write_status "downloading" "script" ""
gsutil cp /tmp/status.json "$GCS_BASE/status.json" 2>/dev/null || true

if ! gsutil cp "${scriptGcsPath}" ./train.py 2>&1; then
    ERROR_MSG="Failed to download training script"
    exit 1
fi

# Download dataset from GCS
echo "[3/6] Downloading dataset..."
write_status "downloading" "dataset" ""
gsutil cp /tmp/status.json "$GCS_BASE/status.json" 2>/dev/null || true

if [ -z "${datasetGcsPath}" ]; then
    ERROR_MSG="Dataset path is empty"
    exit 1
fi

if [[ "${datasetGcsPath}" == *.zip ]]; then
    if ! gsutil cp "${datasetGcsPath}" ./dataset.zip 2>&1; then
        ERROR_MSG="Failed to download dataset"
        exit 1
    fi
    unzip -q dataset.zip -d ./data
    export DATASET_PATH="./data"
else
    if ! gsutil cp "${datasetGcsPath}" ./dataset.csv 2>&1; then
        ERROR_MSG="Failed to download dataset from ${datasetGcsPath}"
        exit 1
    fi
    export DATASET_PATH="./dataset.csv"
fi

# Set environment variables for training script
export GCS_OUTPUT_PATH="$GCS_BASE"
export PROJECT_ID="${projectId}"
export JOB_ID="${jobId}"
export TRAINING_BUCKET="${bucket}"

# Inject training config as environment variables (user's overlay settings)
${trainingConfig?.epochs ? `export MLFORGE_EPOCHS=${trainingConfig.epochs}` : '# MLFORGE_EPOCHS: using AI default'}
${trainingConfig?.batchSize ? `export MLFORGE_BATCH_SIZE=${trainingConfig.batchSize}` : '# MLFORGE_BATCH_SIZE: using AI default'}
${trainingConfig?.learningRate ? `export MLFORGE_LEARNING_RATE=${trainingConfig.learningRate}` : '# MLFORGE_LEARNING_RATE: using AI default'}
${trainingConfig?.trees ? `export MLFORGE_MAX_TREES=${trainingConfig.trees}` : '# MLFORGE_MAX_TREES: using AI default'}

echo "Training Config Overrides:"
env | grep MLFORGE || echo "  (none - using AI defaults)"

# Run training and capture output
echo "[4/6] Starting training..."
write_status "running" "training" ""
gsutil cp /tmp/status.json "$GCS_BASE/status.json" 2>/dev/null || true

# Fix common placeholder paths in AI-generated scripts
sed -i "s|'path_to_csv.csv'|'./dataset.csv'|g" train.py
sed -i 's|"path_to_csv.csv"|"./dataset.csv"|g' train.py
sed -i "s|'your_dataset.csv'|'./dataset.csv'|g" train.py
sed -i "s|read_csv('dataset.csv')|read_csv('./dataset.csv')|g" train.py
# CRITICAL FIX: AI chat generates /tmp/dataset.csv but we download to /tmp/training/dataset.csv
sed -i "s|'/tmp/dataset.csv'|'./dataset.csv'|g" train.py
sed -i 's|"/tmp/dataset.csv"|"./dataset.csv"|g' train.py
sed -i "s|'/tmp/training/dataset.csv'|'./dataset.csv'|g" train.py

echo "========================================"
# Run with venv python
python train.py 2>&1 | tee /tmp/training_output.txt
TRAIN_EXIT_CODE=\${PIPESTATUS[0]}
echo "========================================"

# Auto-extract metrics from training output
if [ -f /tmp/training_output.txt ]; then
    ACCURACY=$(grep -oP '(?i)accuracy[: ]+\K[0-9.]+' /tmp/training_output.txt | tail -1 || echo "")
    
    # Create metrics.json if we found accuracy
    if [ -n "$ACCURACY" ]; then
        mkdir -p /tmp/training
        echo "{\"accuracy\": $ACCURACY}" > /tmp/training/metrics.json
        echo "[Metrics] Extracted accuracy=$ACCURACY"
    fi
fi

if [ $TRAIN_EXIT_CODE -eq 0 ]; then
    echo "[5/6] Training completed successfully!"
    STATUS="completed"
else
    echo "[5/6] Training failed with exit code $TRAIN_EXIT_CODE"
    ERROR_MSG="Training script failed with exit code $TRAIN_EXIT_CODE"
fi

# Upload results to GCS
echo "[6/6] Uploading results..."
gsutil cp /var/log/training.log gs://${bucket}/projects/${projectId}/jobs/${jobId}/output.log

# Check if metrics.json exists and upload
if [ -f /tmp/training/metrics.json ]; then
    gsutil cp /tmp/training/metrics.json gs://${bucket}/projects/${projectId}/jobs/${jobId}/metrics.json
fi

# Check if model directory exists and upload
if [ -d /tmp/training/model ]; then
    gsutil -m cp -r /tmp/training/model/* gs://${bucket}/projects/${projectId}/jobs/${jobId}/model/
fi

# Create final status file using write_status function
write_status "$STATUS" "finished" "$ERROR_MSG"
gsutil cp /tmp/status.json gs://${bucket}/projects/${projectId}/jobs/${jobId}/status.json

echo "========================================"
echo "MLForge Training Finished at $(date)"
echo "Status: $STATUS"
echo "========================================"

# Self-delete VM
echo "Cleaning up VM..."
gcloud compute instances delete $(hostname) --zone=${zone} --quiet
`;
}

/**
 * Submit a training job to Compute Engine
 */
export async function submitComputeEngineJob(params: {
    projectId: string;
    jobId: string;
    scriptGcsPath: string;
    datasetGcsPath: string;
    tier: SubscriptionTier;
    trainingConfig?: {  // User's training config from overlay
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        trees?: number;
    };
}): Promise<{
    vmName: string;
    zone: string;
    machineType: string;
    estimatedCostPerHour: number;
    maxDurationHours: number;
    consoleUrl: string;
}> {
    const { projectId, jobId, scriptGcsPath, datasetGcsPath, tier, trainingConfig } = params;
    const config = COMPUTE_ENGINE_CONFIGS[tier];

    // GCP VM names must be lowercase, match regex [a-z]([-a-z0-9]{0,61}[a-z0-9])?
    const vmName = `mlforge-${jobId.slice(0, 8).toLowerCase()}-${Date.now()}`;

    // Generate startup script
    const startupScript = createStartupScript({
        projectId,
        jobId,
        datasetGcsPath,
        scriptGcsPath,
        bucket: TRAINING_BUCKET,
        zone: GCP_ZONE,
        trainingConfig  // Pass user's training config for env var injection
    });

    console.log(`[Compute Engine] Creating VM: ${vmName} (${config.machineType})`);

    try {
        // Create the VM instance
        const [operation] = await computeClient.insert({
            project: GCP_PROJECT_ID,
            zone: GCP_ZONE,
            instanceResource: {
                name: vmName,
                machineType: `zones/${GCP_ZONE}/machineTypes/${config.machineType}`,

                // Boot disk
                disks: [{
                    boot: true,
                    autoDelete: true,
                    initializeParams: {
                        sourceImage: 'projects/debian-cloud/global/images/family/debian-12',
                        diskSizeGb: '50'
                    }
                }],

                // Network
                networkInterfaces: [{
                    network: 'global/networks/default',
                    accessConfigs: [{
                        name: 'External NAT',
                        type: 'ONE_TO_ONE_NAT'
                    }]
                }],

                // Service account with required permissions
                serviceAccounts: [{
                    email: SERVICE_ACCOUNT_EMAIL,
                    scopes: [
                        'https://www.googleapis.com/auth/cloud-platform',
                        'https://www.googleapis.com/auth/devstorage.full_control',
                        'https://www.googleapis.com/auth/logging.write'
                    ]
                }],

                // Startup script
                metadata: {
                    items: [
                        { key: 'startup-script', value: startupScript },
                        { key: 'mlforge-project-id', value: projectId },
                        { key: 'mlforge-job-id', value: jobId }
                    ]
                },

                // Labels for tracking
                labels: {
                    'mlforge-project': projectId.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
                    'mlforge-job': jobId.toLowerCase(),
                    'tier': tier
                },

                // Scheduling - DISABLED PREEMPTIBLE FOR DEBUGGING (preemptible VMs can be terminated instantly)
                scheduling: {
                    preemptible: false, // Was: tier === 'free' - disabled for debugging
                    automaticRestart: false,
                    onHostMaintenance: 'MIGRATE' // E2 instances require MIGRATE when not preemptible
                }
            }
        });

        // Wait for operation to complete
        console.log(`[Compute Engine] Waiting for VM creation in project: ${GCP_PROJECT_ID}, zone: ${GCP_ZONE}...`);

        // Actually wait for the operation to complete
        const operationsClient = new compute.ZoneOperationsClient({
            credentials: privateKey && clientEmail ? {
                client_email: clientEmail,
                private_key: privateKey,
            } : undefined
        });

        // Poll until operation is complete
        let operationResult = operation;
        while (operationResult.status !== 'DONE') {
            await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
            const [result] = await operationsClient.get({
                project: GCP_PROJECT_ID,
                zone: GCP_ZONE,
                operation: operation.name,
            });
            operationResult = result;
            console.log(`[Compute Engine] Operation status: ${operationResult.status}`);
        }

        if (operationResult.error) {
            console.error('[Compute Engine] Operation error:', operationResult.error);
            throw new Error(`VM creation failed: ${JSON.stringify(operationResult.error)}`);
        }

        console.log(`[Compute Engine] VM ${vmName} created successfully in ${GCP_PROJECT_ID}`);

        return {
            vmName,
            zone: GCP_ZONE,
            machineType: config.machineType,
            estimatedCostPerHour: config.costPerHour,
            maxDurationHours: config.maxHours,
            consoleUrl: `https://console.cloud.google.com/compute/instancesDetail/zones/${GCP_ZONE}/instances/${vmName}?project=${GCP_PROJECT_ID}`
        };
    } catch (error: any) {
        console.error('[Compute Engine] VM creation failed:', error);
        throw new Error(`Failed to create training VM: ${error.message}`);
    }
}

/**
 * Delete a Compute Engine VM (for manual cleanup or cancellation)
 */
export async function deleteComputeVM(vmName: string, zone?: string): Promise<void> {
    try {
        await computeClient.delete({
            project: GCP_PROJECT_ID,
            zone: zone || GCP_ZONE,
            instance: vmName
        });
        console.log(`[Compute Engine] VM ${vmName} deleted`);
    } catch (error: any) {
        console.error(`[Compute Engine] Failed to delete VM ${vmName}:`, error);
        // Don't throw - VM might already be deleted
    }
}

/**
 * Get VM status
 */
export async function getVMStatus(vmName: string, zone?: string): Promise<'RUNNING' | 'TERMINATED' | 'STOPPING' | 'STAGING' | 'NOT_FOUND'> {
    try {
        const [instance] = await computeClient.get({
            project: GCP_PROJECT_ID,
            zone: zone || GCP_ZONE,
            instance: vmName
        });
        return (instance.status as any) || 'NOT_FOUND';
    } catch (error: any) {
        if (error.code === 404) {
            return 'NOT_FOUND';
        }
        throw error;
    }
}

/**
 * Check if training job completed by looking for status.json in GCS
 */
export async function checkJobCompletion(projectId: string, jobId: string): Promise<{
    completed: boolean;
    status?: 'completed' | 'failed';
    completedAt?: string;
}> {
    try {
        const bucket = storage.bucket(TRAINING_BUCKET);
        const file = bucket.file(`projects/${projectId}/jobs/${jobId}/status.json`);

        const [exists] = await file.exists();
        if (!exists) {
            return { completed: false };
        }

        const [content] = await file.download();
        const status = JSON.parse(content.toString());

        return {
            completed: true,
            status: status.status,
            completedAt: status.completedAt
        };
    } catch (error) {
        return { completed: false };
    }
}

/**
 * Estimate training cost based on dataset size and tier
 */
export function estimateTrainingCost(tier: SubscriptionTier, datasetSizeMB: number): {
    estimatedMinutes: number;
    estimatedCost: number;
    machineType: string;
} {
    const config = COMPUTE_ENGINE_CONFIGS[tier];

    // Rough estimate: 1 minute per 5MB for tabular, 1 minute per 2MB for complex
    const estimatedMinutes = Math.ceil(datasetSizeMB / 5) + 3; // +3 for setup/teardown
    const estimatedHours = estimatedMinutes / 60;
    const estimatedCost = estimatedHours * config.costPerHour;

    return {
        estimatedMinutes,
        estimatedCost: Math.round(estimatedCost * 100) / 100,
        machineType: config.machineType
    };
}

export default {
    submitComputeEngineJob,
    deleteComputeVM,
    getVMStatus,
    checkJobCompletion,
    estimateTrainingCost,
    createStartupScript,
    COMPUTE_ENGINE_CONFIGS
};
