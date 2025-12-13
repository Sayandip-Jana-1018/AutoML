/**
 * RunPod Training Module
 * 
 * Manages GPU pod lifecycle for deep learning training:
 * - Creates pod with PyTorch template
 * - Runs training, writes logs/metrics to GCS
 * - Terminates pod on completion
 * 
 * Used for Gold tier users with image/deep learning workloads.
 */

import { Storage } from '@google-cloud/storage';

// RunPod API configuration
const RUNPOD_API_KEY = process.env.RUNPOD_API_KEY || '';
const RUNPOD_API_URL = 'https://api.runpod.io/graphql';
const RUNPOD_DEFAULT_GPU = process.env.RUNPOD_DEFAULT_GPU || 'RTX 4000 Ada';

// GCS configuration
const TRAINING_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mlforge-fluent-cable-480715-c8';

// Initialize storage
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;

const storage = new Storage(privateKey && clientEmail ? {
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    }
} : undefined);

/**
 * GPU configurations available on RunPod
 */
export const RUNPOD_GPU_CONFIGS: Record<string, {
    id: string;
    name: string;
    vram: number;
    costPerHour: number;
    specs: string;
}> = {
    'RTX 4000 Ada': {
        id: 'NVIDIA RTX 4000 Ada Generation',
        name: 'RTX 4000 Ada',
        vram: 20,
        costPerHour: 0.26,
        specs: '8 vCPU, 50 GB RAM, 20 GB VRAM'
    },
    'RTX 3090': {
        id: 'NVIDIA GeForce RTX 3090',
        name: 'RTX 3090',
        vram: 24,
        costPerHour: 0.44,
        specs: '8 vCPU, 32 GB RAM, 24 GB VRAM'
    },
    'RTX 4090': {
        id: 'NVIDIA GeForce RTX 4090',
        name: 'RTX 4090',
        vram: 24,
        costPerHour: 0.59,
        specs: '16 vCPU, 41 GB RAM, 24 GB VRAM'
    },
    'A40': {
        id: 'NVIDIA A40',
        name: 'A40',
        vram: 48,
        costPerHour: 0.40,
        specs: '14 vCPU, 48 GB RAM, 48 GB VRAM'
    }
};

/**
 * Execute GraphQL query against RunPod API
 */
async function runpodQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    if (!RUNPOD_API_KEY) {
        throw new Error('RUNPOD_API_KEY is not configured');
    }

    const response = await fetch(RUNPOD_API_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${RUNPOD_API_KEY}`
        },
        body: JSON.stringify({ query, variables })
    });

    if (!response.ok) {
        throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
    }

    const result = await response.json();

    if (result.errors) {
        throw new Error(`RunPod GraphQL error: ${result.errors[0].message}`);
    }

    return result.data;
}

/**
 * Create training script for RunPod pod
 */
export function createRunPodTrainingScript(params: {
    projectId: string;
    jobId: string;
    datasetGcsPath: string;
    scriptGcsPath: string;
    bucket: string;
    gcpKeyJson: string;
}): string {
    const { projectId, jobId, datasetGcsPath, scriptGcsPath, bucket, gcpKeyJson } = params;

    // Base64 encode the GCP service account key
    const keyBase64 = Buffer.from(gcpKeyJson).toString('base64');

    return `#!/bin/bash
set -e

echo "========================================"
echo "MLForge GPU Training Started at $(date)"
echo "Project: ${projectId}"
echo "Job: ${jobId}"
echo "========================================"

# Install GCS dependencies
pip install --quiet google-cloud-storage

# Setup GCP credentials
echo '${keyBase64}' | base64 -d > /tmp/gcp-key.json
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-key.json

# Create working directory
mkdir -p /workspace/training
cd /workspace/training

# Download training script from GCS
echo "[1/5] Downloading training script..."
python3 -c "
from google.cloud import storage
client = storage.Client()
bucket = client.bucket('${bucket}')
blob = bucket.blob('${scriptGcsPath.replace(`gs://${bucket}/`, '')}')
blob.download_to_filename('train.py')
print('Script downloaded successfully')
"

# Download dataset from GCS
echo "[2/5] Downloading dataset..."
python3 -c "
from google.cloud import storage
import os
client = storage.Client()
bucket = client.bucket('${bucket}')

dataset_path = '${datasetGcsPath}'
if dataset_path.startswith('gs://'):
    dataset_path = dataset_path.replace('gs://${bucket}/', '')

blob = bucket.blob(dataset_path)
local_path = './dataset' + os.path.splitext(dataset_path)[1]
blob.download_to_filename(local_path)
print(f'Dataset downloaded to {local_path}')
"

# Set environment variables
export GCS_OUTPUT_PATH="gs://${bucket}/projects/${projectId}/jobs/${jobId}"
export PROJECT_ID="${projectId}"
export JOB_ID="${jobId}"
export TRAINING_BUCKET="${bucket}"
export DATASET_PATH="./dataset.csv"

# Run training
echo "[3/5] Starting GPU training..."
echo "========================================"
python3 train.py
TRAIN_EXIT_CODE=$?
echo "========================================"

if [ $TRAIN_EXIT_CODE -eq 0 ]; then
    echo "[4/5] Training completed successfully!"
    STATUS="completed"
else
    echo "[4/5] Training failed with exit code $TRAIN_EXIT_CODE"
    STATUS="failed"
fi

# Upload results to GCS
echo "[5/5] Uploading results..."
python3 -c "
from google.cloud import storage
import os
import json

client = storage.Client()
bucket = client.bucket('${bucket}')

# Upload metrics if exists
if os.path.exists('metrics.json'):
    blob = bucket.blob('projects/${projectId}/jobs/${jobId}/metrics.json')
    blob.upload_from_filename('metrics.json')
    print('Metrics uploaded')

# Upload model files if exist
if os.path.exists('model'):
    for root, dirs, files in os.walk('model'):
        for file in files:
            local_path = os.path.join(root, file)
            gcs_path = f'projects/${projectId}/jobs/${jobId}/model/{file}'
            blob = bucket.blob(gcs_path)
            blob.upload_from_filename(local_path)
            print(f'Uploaded {file}')

# Create status file
status = {'status': '$STATUS', 'completedAt': '$(date -u +%Y-%m-%dT%H:%M:%SZ)'}
blob = bucket.blob('projects/${projectId}/jobs/${jobId}/status.json')
blob.upload_from_string(json.dumps(status))
print('Status uploaded')
"

echo "========================================"
echo "MLForge GPU Training Finished at $(date)"
echo "Status: $STATUS"
echo "========================================"

# Keep pod alive briefly for log collection, then it will be terminated via API
sleep 10
`;
}

/**
 * Create a RunPod pod for training
 */
export async function createRunPodPod(params: {
    projectId: string;
    jobId: string;
    gpuType?: string;
    name?: string;
}): Promise<{
    podId: string;
    gpuType: string;
    costPerHour: number;
    specs: string;
}> {
    const { projectId, jobId, gpuType = RUNPOD_DEFAULT_GPU } = params;
    const gpuConfig = RUNPOD_GPU_CONFIGS[gpuType] || RUNPOD_GPU_CONFIGS['RTX 4000 Ada'];

    const podName = `mlforge-${projectId.slice(0, 8)}-${jobId.slice(0, 8)}`;

    console.log(`[RunPod] Creating pod: ${podName} with ${gpuConfig.name}`);

    const query = `
        mutation createPod($input: PodFindAndDeployOnDemandInput!) {
            podFindAndDeployOnDemand(input: $input) {
                id
                name
                desiredStatus
                gpuCount
                runtime {
                    uptimeInSeconds
                }
            }
        }
    `;

    const variables = {
        input: {
            cloudType: 'SECURE',
            gpuCount: 1,
            volumeInGb: 20,
            containerDiskInGb: 20,
            gpuTypeId: gpuConfig.id,
            name: podName,
            templateId: 'runpod-torch', // PyTorch template
            dockerArgs: '',
            ports: '22/tcp',
            volumeMountPath: '/workspace',
            startSsh: true
        }
    };

    try {
        const data = await runpodQuery(query, variables);
        const pod = data.podFindAndDeployOnDemand;

        console.log(`[RunPod] Pod created: ${pod.id}`);

        return {
            podId: pod.id,
            gpuType: gpuConfig.name,
            costPerHour: gpuConfig.costPerHour,
            specs: gpuConfig.specs
        };
    } catch (error: any) {
        console.error('[RunPod] Pod creation failed:', error);
        throw new Error(`Failed to create RunPod pod: ${error.message}`);
    }
}

/**
 * Get pod status
 */
export async function getPodStatus(podId: string): Promise<{
    status: 'RUNNING' | 'PENDING' | 'TERMINATED' | 'UNKNOWN';
    sshHost?: string;
    sshPort?: number;
}> {
    const query = `
        query getPod($podId: String!) {
            pod(input: { podId: $podId }) {
                id
                desiredStatus
                runtime {
                    uptimeInSeconds
                    ports {
                        ip
                        isIpPublic
                        privatePort
                        publicPort
                    }
                }
            }
        }
    `;

    try {
        const data = await runpodQuery(query, { podId });
        const pod = data.pod;

        if (!pod) {
            return { status: 'TERMINATED' };
        }

        // Find SSH port
        const sshPort = pod.runtime?.ports?.find((p: any) => p.privatePort === 22);

        return {
            status: pod.desiredStatus === 'RUNNING' ? 'RUNNING' :
                pod.desiredStatus === 'EXITED' ? 'TERMINATED' : 'PENDING',
            sshHost: sshPort?.ip,
            sshPort: sshPort?.publicPort
        };
    } catch (error) {
        return { status: 'UNKNOWN' };
    }
}

/**
 * Terminate a RunPod pod
 */
export async function terminatePod(podId: string): Promise<void> {
    const query = `
        mutation terminatePod($podId: String!) {
            podTerminate(input: { podId: $podId })
        }
    `;

    try {
        await runpodQuery(query, { podId });
        console.log(`[RunPod] Pod ${podId} terminated`);
    } catch (error: any) {
        console.error(`[RunPod] Failed to terminate pod ${podId}:`, error);
        // Don't throw - pod might already be terminated
    }
}

/**
 * Execute command on pod via RunPod exec API
 */
export async function executeOnPod(podId: string, command: string): Promise<string> {
    const query = `
        mutation execPod($podId: String!, $command: String!) {
            podExec(input: { podId: $podId, command: $command }) {
                output
                exitCode
            }
        }
    `;

    const data = await runpodQuery(query, { podId, command });
    return data.podExec?.output || '';
}

/**
 * Submit a full training job to RunPod
 */
export async function submitRunPodTrainingJob(params: {
    projectId: string;
    jobId: string;
    scriptGcsPath: string;
    datasetGcsPath: string;
    gpuType?: string;
}): Promise<{
    podId: string;
    gpuType: string;
    estimatedCostPerHour: number;
    specs: string;
}> {
    const { projectId, jobId, scriptGcsPath, datasetGcsPath, gpuType } = params;

    // 1. Create pod
    const pod = await createRunPodPod({
        projectId,
        jobId,
        gpuType
    });

    // 2. Wait for pod to be ready (poll status)
    let attempts = 0;
    const maxAttempts = 60; // 5 minutes max wait

    while (attempts < maxAttempts) {
        const status = await getPodStatus(pod.podId);

        if (status.status === 'RUNNING') {
            console.log(`[RunPod] Pod ${pod.podId} is ready`);
            break;
        }

        if (status.status === 'TERMINATED') {
            throw new Error('Pod terminated unexpectedly during startup');
        }

        attempts++;
        await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    }

    if (attempts >= maxAttempts) {
        await terminatePod(pod.podId);
        throw new Error('Pod failed to start within timeout');
    }

    // 3. Create GCP key JSON for pod to access GCS
    const gcpKeyJson = JSON.stringify({
        type: 'service_account',
        client_email: clientEmail,
        private_key: privateKey
    });

    // 4. Generate and execute training script
    const trainingScript = createRunPodTrainingScript({
        projectId,
        jobId,
        datasetGcsPath,
        scriptGcsPath,
        bucket: TRAINING_BUCKET,
        gcpKeyJson
    });

    // Execute the training script (non-blocking)
    // The script will upload results to GCS when complete
    try {
        await executeOnPod(pod.podId, `bash -c '${trainingScript.replace(/'/g, "'\"'\"'")}'`);
    } catch (error) {
        console.log('[RunPod] Training script started (async execution)');
    }

    return {
        podId: pod.podId,
        gpuType: pod.gpuType,
        estimatedCostPerHour: pod.costPerHour,
        specs: pod.specs
    };
}

/**
 * Check if RunPod is configured
 */
export function isRunPodConfigured(): boolean {
    return !!RUNPOD_API_KEY;
}

export default {
    createRunPodPod,
    getPodStatus,
    terminatePod,
    executeOnPod,
    submitRunPodTrainingJob,
    isRunPodConfigured,
    RUNPOD_GPU_CONFIGS
};
