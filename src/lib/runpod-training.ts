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
        costPerHour: 0.27,
        specs: '9 vCPU, 50 GB RAM, 20 GB VRAM'
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
 * Execute GraphQL query against RunPod API with retry logic
 */
async function runpodQuery(query: string, variables: Record<string, any> = {}): Promise<any> {
    if (!RUNPOD_API_KEY) {
        throw new Error('RUNPOD_API_KEY is not configured');
    }

    const maxRetries = 3;
    const retryableStatusCodes = [429, 500, 502, 503, 504];

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            const response = await fetch(RUNPOD_API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${RUNPOD_API_KEY}`
                },
                body: JSON.stringify({ query, variables })
            });

            // Check for retryable errors
            if (!response.ok) {
                if (retryableStatusCodes.includes(response.status) && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000; // 1s, 2s, 4s
                    console.log(`[RunPod] API error ${response.status}, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw new Error(`RunPod API error: ${response.status} ${response.statusText}`);
            }

            const result = await response.json();

            if (result.errors) {
                // Check if it's a retryable GraphQL error
                const errorMsg = result.errors[0]?.message || '';
                if ((errorMsg.includes('rate limit') || errorMsg.includes('overloaded')) && attempt < maxRetries) {
                    const delay = Math.pow(2, attempt - 1) * 1000;
                    console.log(`[RunPod] GraphQL error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries})`);
                    await new Promise(resolve => setTimeout(resolve, delay));
                    continue;
                }
                throw new Error(`RunPod GraphQL error: ${errorMsg}`);
            }

            return result.data;
        } catch (error: any) {
            // Retry on network errors
            if (attempt < maxRetries && (error.code === 'ECONNRESET' || error.code === 'ETIMEDOUT' || error.message?.includes('fetch failed'))) {
                const delay = Math.pow(2, attempt - 1) * 1000;
                console.log(`[RunPod] Network error, retrying in ${delay}ms (attempt ${attempt}/${maxRetries}): ${error.message}`);
                await new Promise(resolve => setTimeout(resolve, delay));
                continue;
            }
            throw error;
        }
    }

    throw new Error('RunPod API request failed after max retries');
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

# Set environment variables (Default)
export GCS_OUTPUT_PATH="gs://${bucket}/projects/${projectId}/jobs/${jobId}"
export PROJECT_ID="${projectId}"
export JOB_ID="${jobId}"
export TRAINING_BUCKET="${bucket}"
export DATASET_PATH="./dataset.csv"

# Check if dataset is ZIP
if [ -f "./dataset.zip" ]; then
    echo "Detected ZIP dataset. Installing unzip..."
    apt-get update && apt-get install -y unzip

    echo "Unzipping dataset..."
    unzip -q ./dataset.zip -d ./dataset_extracted
    
    # Update DATASET_PATH to point to the extracted folder
    export DATASET_PATH="./dataset_extracted"
    echo "Dataset extracted to ./dataset_extracted"
fi

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

# Wait briefly for final log/status uploads
sleep 10

# AUTO-TERMINATE: Stop pod to prevent ongoing charges
echo "Auto-terminating pod to stop billing..."
runpodctl stop pod $RUNPOD_POD_ID 2>/dev/null || echo "Pod will be terminated via API"
`;
}

/**
 * Upload bootstrap script to GCS for RunPod to download and execute
 */
async function uploadBootstrapScript(params: {
    projectId: string;
    jobId: string;
    keyBase64: string;
    scriptPath: string;
    datasetPath: string;
    bucket: string;
    shardsGcsPrefix?: string;  // Optional: TFRecord shards path for fast loading
    trainingConfig?: {  // User's training config from overlay
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        trees?: number;
    };
}): Promise<string> {
    const { projectId, jobId, keyBase64, scriptPath, datasetPath, bucket, shardsGcsPrefix, trainingConfig } = params;

    // Determine if we should use TFRecord shards (fast path)
    const useTFRecordShards = !!shardsGcsPrefix;
    const shardsPath = shardsGcsPrefix?.replace(`gs://${bucket}/`, '') || '';

    // Create a proper multi-line shell script that won't break
    const bootstrapScript = `#!/bin/bash
set -ex
set -o pipefail  # Ensure pipeline returns error if any command fails

echo "========================================"
echo "MLForge GPU Training - Bootstrap Started"
echo "Project: ${projectId}"
echo "Job: ${jobId}"
echo "========================================"

# Inject training config as environment variables (user's overlay settings)
${trainingConfig?.epochs ? `export MLFORGE_EPOCHS=${trainingConfig.epochs}` : '# MLFORGE_EPOCHS: using AI default'}
${trainingConfig?.batchSize ? `export MLFORGE_BATCH_SIZE=${trainingConfig.batchSize}` : '# MLFORGE_BATCH_SIZE: using AI default'}
${trainingConfig?.learningRate ? `export MLFORGE_LEARNING_RATE=${trainingConfig.learningRate}` : '# MLFORGE_LEARNING_RATE: using AI default'}
${trainingConfig?.trees ? `export MLFORGE_MAX_TREES=${trainingConfig.trees}` : '# MLFORGE_MAX_TREES: using AI default'}

echo "Training Config Overrides:"
env | grep MLFORGE || echo "  (none - using AI defaults)"

# Setup GCP credentials (hide from logs for security)
set +x
echo "${keyBase64}" | base64 -d > /tmp/gcp-key.json
set -x
export GOOGLE_APPLICATION_CREDENTIALS=/tmp/gcp-key.json

# Install required packages (gcs + ML dependencies)
# NOTE: RunPod containers have CUDA pre-installed, use tensorflow[and-cuda] for GPU support
echo "Installing dependencies (this may take 1-2 minutes)..."
pip install -q google-cloud-storage pandas numpy scikit-learn pillow matplotlib tqdm
# Install TensorFlow with CUDA support - the [and-cuda] extra handles CUDA libraries
pip install -q 'tensorflow[and-cuda]'
echo "Dependencies installed."

# Debug: Verify TensorFlow GPU availability
echo "[DEBUG] Checking TensorFlow GPU..."
python3 -c "import tensorflow as tf; print(f'TensorFlow version: {tf.__version__}'); print(f'GPU devices: {tf.config.list_physical_devices(\"GPU\")}')" || echo "TensorFlow import failed"

# Create working directory
mkdir -p /workspace/training
cd /workspace/training

# Download training script
echo "[1/5] Downloading training script..."
python3 << 'PYEOF'
from google.cloud import storage
client = storage.Client()
bucket = client.bucket("${bucket}")
blob = bucket.blob("${scriptPath}")
blob.download_to_filename("train.py")
print("Script downloaded successfully")
PYEOF

${useTFRecordShards ? `
# FAST PATH: Download TFRecord shards instead of ZIP
echo "[2/5] Downloading TFRecord shards (optimized for speed)..."
python3 << 'PYEOF'
from google.cloud import storage
import os
import json

client = storage.Client()
bucket = client.bucket("${bucket}")
shards_prefix = "${shardsPath}"

# Create shards directory
os.makedirs("shards", exist_ok=True)

# List and download all shard files
# shards_prefix comes as full gs:// URI, we need relative path for list_blobs
blob_prefix = shards_prefix.replace(f"gs://{bucket.name}/", "")
blobs = list(bucket.list_blobs(prefix=blob_prefix))
print(f"Found {len(blobs)} files in shards directory (prefix: {blob_prefix})")

for blob in blobs:
    filename = os.path.basename(blob.name)
    if filename:  # Skip directory entries
        local_path = os.path.join("shards", filename)
        blob.download_to_filename(local_path)
        print(f"  Downloaded: {filename}")

# Load metadata for verification
if os.path.exists("shards/metadata.json"):
    with open("shards/metadata.json") as f:
        metadata = json.load(f)
    print(f"\\nDataset loaded from TFRecord shards:")
    print(f"  Classes: {metadata.get('numClasses', 'Unknown')}")
    print(f"  Training samples: {metadata.get('trainSamples', 'Unknown')}")
    print(f"  Validation samples: {metadata.get('valSamples', 0)}")
    print(f"  Shards: {len(metadata.get('shardPaths', {}).get('train', []))} train, {len(metadata.get('shardPaths', {}).get('val', []))} val")
else:
    print("Warning: metadata.json not found in shards")

print("TFRecord shards ready!")
PYEOF

export DATASET_PATH="./shards"
echo "Dataset ready at: $DATASET_PATH"
` : `
# Download dataset (legacy ZIP path)
echo "[2/5] Downloading dataset..."
python3 << 'PYEOF'
from google.cloud import storage
import os
client = storage.Client()
bucket = client.bucket("${bucket}")
blob = bucket.blob("${datasetPath}")
filename = os.path.basename("${datasetPath}")
blob.download_to_filename(filename)
print(f"Dataset downloaded: {filename}")
PYEOF

# Handle ZIP files (images) vs CSV files (tabular)
DATASET_FILE=$(ls -1 | grep -E '\\.(zip|csv)$' | head -1)
echo "[DEBUG] Found dataset file: $DATASET_FILE"
if [[ "$DATASET_FILE" == *.zip ]]; then
    echo "Extracting ZIP dataset (this may take a few minutes for large datasets)..."
    apt-get update -qq && apt-get install -y -qq unzip tree 2>/dev/null || true
    echo "[DEBUG] Starting unzip..."
    unzip -o -q "$DATASET_FILE" -d dataset
    echo "[DEBUG] Unzip complete, checking results..."
    rm "$DATASET_FILE"
    export DATASET_PATH="./dataset"
    echo "[DEBUG] Dataset extracted. Directory tree:"
    # Show tree structure to debug nested folders (like dataset/cifar-10/train vs dataset/train)
    find dataset -type d -maxdepth 4 | head -30
    echo "[DEBUG] First few files:"
    find dataset -type f | head -10
    echo "[DEBUG] File count: $(find dataset -type f | wc -l) files"
elif [[ "$DATASET_FILE" == *.csv ]]; then
    # Rename CSV to dataset.csv so training scripts can find it
    if [[ "$DATASET_FILE" != "dataset.csv" ]]; then
        echo "[DEBUG] Renaming $DATASET_FILE to dataset.csv"
        mv "$DATASET_FILE" dataset.csv
    fi
    export DATASET_PATH="./dataset.csv"
else
    export DATASET_PATH="./$DATASET_FILE"
fi

echo "Dataset ready at: $DATASET_PATH"
`}

echo "[DEBUG] Disk usage: $(df -h . | tail -1)"

# Run training with real-time log streaming
echo ""
echo "========================================"
echo "[3/5] Starting GPU training..."
echo "========================================"
echo "[DEBUG] Running: python3 train.py"
echo "[DEBUG] Current directory: $(pwd)"
echo "[DEBUG] Python version: $(python3 --version)"
echo "[DEBUG] GPU info:"
nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv 2>/dev/null || echo "nvidia-smi not available"
echo "========================================"

# Start background log sync (uploads logs every 30 seconds for real-time streaming)
(
    while true; do
        sleep 30
        if [ -f "training_output.log" ]; then
            python3 -c "
from google.cloud import storage
import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/tmp/gcp-key.json'
client = storage.Client()
bucket = client.bucket('${bucket}')
blob = bucket.blob('projects/${projectId}/jobs/${jobId}/output.log')
blob.upload_from_filename('training_output.log')
print('[LOG SYNC] Uploaded output.log at', __import__('datetime').datetime.now())
" 2>/dev/null || true
        fi
    done
) &
LOG_SYNC_PID=$!
echo "[DEBUG] Started background log sync (PID: $LOG_SYNC_PID)"

python3 train.py 2>&1 | tee training_output.log
TRAIN_STATUS=$?

# Stop background log sync
kill $LOG_SYNC_PID 2>/dev/null || true

echo "========================================"
if [ $TRAIN_STATUS -eq 0 ]; then
    echo "[4/5] Training completed successfully!"
    FINAL_STATUS="COMPLETED"
else
    echo "[4/5] Training failed with exit code $TRAIN_STATUS"
    FINAL_STATUS="FAILED"
    echo "[DEBUG] Last 50 lines of log:"
    tail -50 training_output.log
fi

# Upload results
echo "[5/5] Uploading results..."
python3 << PYEOF
from google.cloud import storage
import os
import json
from datetime import datetime

client = storage.Client()
bucket = client.bucket("${bucket}")

# Upload training log to output.log (expected by logs API)
if os.path.exists("training_output.log"):
    blob = bucket.blob("projects/${projectId}/jobs/${jobId}/output.log")
    blob.upload_from_filename("training_output.log")
    print("Uploaded output.log")

# Upload metrics if exists
if os.path.exists("metrics.json"):
    blob = bucket.blob("projects/${projectId}/jobs/${jobId}/metrics.json")
    blob.upload_from_filename("metrics.json")
    print("Uploaded metrics.json")

# Upload model files
for f in os.listdir("."):
    if f.endswith((".pt", ".pth", ".pkl", ".h5", ".joblib")):
        blob = bucket.blob("projects/${projectId}/outputs/" + f)
        blob.upload_from_filename(f)
        print(f"Uploaded model: {f}")

# Create status.json (expected by complete API)
status_data = {
    "status": "completed" if "$FINAL_STATUS" == "COMPLETED" else "failed",
    "completedAt": datetime.utcnow().isoformat() + "Z",
    "phase": "completed"
}
status_blob = bucket.blob("projects/${projectId}/jobs/${jobId}/status.json")
status_blob.upload_from_string(json.dumps(status_data))
print(f"Status uploaded: {status_data['status']}")
PYEOF

echo "========================================"
echo "MLForge GPU Training - Finished"
echo "Status: $FINAL_STATUS"
echo "========================================"

# Auto-terminate pod after completion
echo "Waiting 30 seconds before terminating pod..."
sleep 30

# Terminate using RunPod API (more reliable than runpodctl)
echo "Terminating pod $RUNPOD_POD_ID..."
curl -s -X POST https://api.runpod.io/graphql \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${process.env.RUNPOD_API_KEY}" \\
  -d '{"query": "mutation { podTerminate(input: { podId: \"'$RUNPOD_POD_ID'\" }) }"}' \\
  && echo "Pod terminated successfully" \\
  || echo "Pod termination request sent (may already be stopping)"
`;

    // Upload the bootstrap script to GCS
    const bootstrapPath = `projects/${projectId}/jobs/${jobId}/bootstrap.sh`;
    const file = storage.bucket(bucket).file(bootstrapPath);
    await file.save(bootstrapScript, {
        contentType: 'text/x-shellscript',
        metadata: {
            cacheControl: 'no-cache'
        }
    });

    console.log(`[RunPod] Bootstrap script uploaded to gs://${bucket}/${bootstrapPath}`);
    return `gs://${bucket}/${bootstrapPath}`;
}

/**
 * Create a RunPod pod for training
 */
export async function createRunPodPod(params: {
    projectId: string;
    jobId: string;
    gpuType?: string;
    name?: string;
    scriptGcsPath?: string;
    datasetGcsPath?: string;
    shardsGcsPrefix?: string;  // Optional: TFRecord shards for fast loading
    trainingConfig?: {  // User's training config from overlay
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        trees?: number;
    };
}): Promise<{
    podId: string;
    gpuType: string;
    costPerHour: number;
    specs: string;
}> {
    const { projectId, jobId, gpuType = RUNPOD_DEFAULT_GPU, shardsGcsPrefix, trainingConfig } = params;
    const gpuConfig = RUNPOD_GPU_CONFIGS[gpuType] || RUNPOD_GPU_CONFIGS['RTX 4000 Ada'];

    const podName = `mlforge-${projectId.slice(0, 8)}-${jobId.slice(0, 8)}`;

    console.log(`[RunPod] Creating pod: ${podName} with ${gpuConfig.name}`);
    if (shardsGcsPrefix) {
        console.log(`[RunPod] Using TFRecord shards from: ${shardsGcsPrefix}`);
    }

    // Create GCP credentials for accessing GCS - include all required fields
    const gcpKeyJson = JSON.stringify({
        type: 'service_account',
        project_id: TRAINING_BUCKET.split('-').slice(0, -2).join('-'), // Extract project from bucket name
        client_email: clientEmail,
        private_key: privateKey,
        token_uri: 'https://oauth2.googleapis.com/token',
        auth_uri: 'https://accounts.google.com/o/oauth2/auth',
        auth_provider_x509_cert_url: 'https://www.googleapis.com/oauth2/v1/certs'
    });
    const keyBase64 = Buffer.from(gcpKeyJson).toString('base64');

    // Prepare paths
    const scriptPath = params.scriptGcsPath?.replace(`gs://${TRAINING_BUCKET}/`, '') || '';
    const datasetPath = (params.datasetGcsPath || '').replace(`gs://${TRAINING_BUCKET}/`, '');

    // Upload bootstrap script to GCS first
    const bootstrapGcsPath = await uploadBootstrapScript({
        projectId,
        jobId,
        keyBase64,
        scriptPath,
        datasetPath,
        bucket: TRAINING_BUCKET,
        shardsGcsPrefix,  // Pass TFRecord shards path if available
        trainingConfig    // Pass user's training config for env var injection
    });

    // Minimal startup command - use base64 encoded Python script to avoid ALL escaping issues
    const bootstrapBlobPath = `projects/${projectId}/jobs/${jobId}/bootstrap.sh`;

    // Create Python downloader script and base64 encode it (avoids quote/newline escaping)
    const downloaderScript = `
import os
os.environ['GOOGLE_APPLICATION_CREDENTIALS'] = '/tmp/gcp-key.json'
from google.cloud import storage
client = storage.Client()
bucket = client.bucket('${TRAINING_BUCKET}')
blob = bucket.blob('${bootstrapBlobPath}')
blob.download_to_filename('/tmp/bootstrap.sh')
print('Bootstrap downloaded successfully')
`.trim();
    const scriptBase64 = Buffer.from(downloaderScript).toString('base64');

    const startupCommand = [
        'sleep 10',
        'pip install -q google-cloud-storage',
        `echo ${keyBase64} | base64 -d > /tmp/gcp-key.json`,
        `echo ${scriptBase64} | base64 -d > /tmp/download.py`,
        'python3 /tmp/download.py',
        'chmod +x /tmp/bootstrap.sh',
        'bash /tmp/bootstrap.sh'
    ].join(' && ');

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
            containerDiskInGb: 40,
            gpuTypeId: gpuConfig.id,
            name: podName,
            imageName: 'runpod/pytorch:2.1.0-py3.10-cuda11.8.0-devel-ubuntu22.04',
            dockerArgs: `bash -c "${startupCommand}"`,
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
    shardsGcsPrefix?: string;  // Optional: TFRecord shards for fast loading
    trainingConfig?: {  // User's training config from overlay
        epochs?: number;
        batchSize?: number;
        learningRate?: number;
        trees?: number;
    };
}): Promise<{
    podId: string;
    gpuType: string;
    estimatedCostPerHour: number;
    specs: string;
}> {
    const { projectId, jobId, scriptGcsPath, datasetGcsPath, gpuType, shardsGcsPrefix, trainingConfig } = params;

    // 1. Create pod with training script embedded in startup command
    const pod = await createRunPodPod({
        projectId,
        jobId,
        gpuType,
        scriptGcsPath,
        datasetGcsPath,
        shardsGcsPrefix,  // Pass TFRecord shards path if available
        trainingConfig    // Pass user's training config for env var injection
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

    // Training script is already running via dockerArgs set in createRunPodPod
    console.log('[RunPod] Training script started (running via startup command)');





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
