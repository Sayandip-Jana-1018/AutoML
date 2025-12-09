import { Storage } from '@google-cloud/storage';
const { JobServiceClient } = require('@google-cloud/aiplatform').v1;
import { getMaxTrainingTimeout, getDefaultMachineType, MACHINE_COSTS, type SubscriptionTier } from './resource-policy';

// Initialize GCP Clients with explicit credentials
const privateKey = process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n');
const clientEmail = process.env.FIREBASE_ADMIN_CLIENT_EMAIL;
const projectId = process.env.GCP_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

// Create Storage client with explicit credentials
export const storage = privateKey && clientEmail ? new Storage({
    projectId,
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    }
}) : new Storage();

/**
 * Retrieves metadata for a file in GCS.
 */
export async function getFileMetadata(gcsPath: string) {
    const bucketName = gcsPath.split('/')[2];
    const fileName = gcsPath.split('/').slice(3).join('/');
    const [metadata] = await storage.bucket(bucketName).file(fileName).getMetadata();
    return metadata;
}

// Create AI Platform client with explicit credentials
const client = privateKey && clientEmail ? new JobServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
    credentials: {
        client_email: clientEmail,
        private_key: privateKey,
    }
}) : new JobServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
});

// Configuration
export const GCP_PROJECT_ID = projectId;
export const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';
export const TRAINING_BUCKET = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'automl-dc494.appspot.com';

/**
 * Uploads the generated Python training script to Google Cloud Storage.
 */
export async function uploadScriptToGCS(projectId: string, scriptContent: string): Promise<string> {
    try {
        const bucket = storage.bucket(TRAINING_BUCKET);
        const fileName = `projects/${projectId}/jobs/train_${Date.now()}.py`;
        const file = bucket.file(fileName);

        await file.save(scriptContent, {
            contentType: 'text/x-python',
            metadata: {
                cacheControl: 'private'
            }
        });

        console.log(`[GCP] Uploaded script to gs://${TRAINING_BUCKET}/${fileName}`);
        return `gs://${TRAINING_BUCKET}/${fileName}`;
    } catch (error) {
        console.error("[GCP] GCS Upload Error:", error);
        throw new Error("Failed to upload training script to Cloud Storage.");
    }
}

/**
 * Submits a Custom Training Job to Vertex AI.
 * Uses a pre-built Scikit-learn container for simplicity in this Studio environment.
 * Applies resource limits based on subscription tier.
 */
export async function submitVertexTrainingJob(
    projectId: string,
    scriptGcsPath: string,
    options: {
        tier?: SubscriptionTier;
        machineType?: string;
        imageUri?: string;
    } = {}
) {
    const {
        tier = 'free',
        machineType = getDefaultMachineType(tier),
        imageUri = 'gcr.io/google.com/cloudsdktool/cloud-sdk:latest'
    } = options;

    if (!GCP_PROJECT_ID) throw new Error("GCP_PROJECT_ID is not defined.");

    const parent = `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}`;
    const displayName = `studio-job-${Date.now()}`;
    const timeoutSeconds = getMaxTrainingTimeout(tier);

    // Construct the CustomJob with resource limits
    const containerJob = {
        displayName: displayName,
        jobSpec: {
            workerPoolSpecs: [{
                machineSpec: { machineType },
                replicaCount: 1,
                containerSpec: {
                    imageUri,
                    command: [
                        "sh",
                        "-c",
                        `gsutil cp ${scriptGcsPath} train.py && python3 train.py`
                    ]
                }
            }],
            // Apply timeout based on tier
            scheduling: {
                timeout: { seconds: timeoutSeconds },
                restartJobOnWorkerRestart: false
            }
        }
    };

    console.log(`[Vertex AI] Submitting Custom Job: ${displayName} (Tier: ${tier}, Machine: ${machineType}, Timeout: ${timeoutSeconds}s)`);

    try {
        const [response] = await client.createCustomJob({
            parent,
            customJob: containerJob
        });

        console.log(`[Vertex AI] Job Created: ${response.name}`);

        // Estimate cost
        const estimatedCost = (MACHINE_COSTS[machineType] || 0.20) * (timeoutSeconds / 3600);

        return {
            jobId: response.name?.split('/').pop(),
            status: response.state,
            machineType,
            maxDurationHours: timeoutSeconds / 3600,
            estimatedMaxCost: estimatedCost.toFixed(2),
            dashboardUrl: `https://console.cloud.google.com/vertex-ai/training/jobs?project=${GCP_PROJECT_ID}`
        };
    } catch (e) {
        console.error("[Vertex AI] Submission Error:", e);
        throw e;
    }
}

/**
 * Stub for retrieving logs - in a real app this would use Cloud Logging API.
 */
export async function getTrainingLogs(jobId: string) {
    // REAL IMPLEMENTATION TODO: Use @google-cloud/logging
    return [];
}

const { EndpointServiceClient, ModelServiceClient } = require('@google-cloud/aiplatform').v1;

// Initialize endpoint and model clients with explicit credentials
const endpointClient = privateKey && clientEmail ? new EndpointServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
    credentials: { client_email: clientEmail, private_key: privateKey }
}) : new EndpointServiceClient({ apiEndpoint: 'us-central1-aiplatform.googleapis.com' });

const modelClient = privateKey && clientEmail ? new ModelServiceClient({
    apiEndpoint: 'us-central1-aiplatform.googleapis.com',
    credentials: { client_email: clientEmail, private_key: privateKey }
}) : new ModelServiceClient({ apiEndpoint: 'us-central1-aiplatform.googleapis.com' });

/**
 * Generates a V4 Signed URL for uploading a file directly to GCS.
 */
export async function generateUploadSignedUrl(projectId: string, fileName: string, contentType: string) {
    const bucket = storage.bucket(TRAINING_BUCKET);
    const gcsFileName = `projects/${projectId}/datasets/${Date.now()}_${fileName}`;
    const file = bucket.file(gcsFileName);

    const [url] = await file.getSignedUrl({
        version: 'v4',
        action: 'write',
        expires: Date.now() + 15 * 60 * 1000,
        contentType,
    });

    return { url, gcsPath: `gs://${TRAINING_BUCKET}/${gcsFileName}` };
}

/**
 * Deploys a trained model to a Vertex AI Endpoint.
 * Assumes the training job exported a model to the job directory.
 */
export async function deployModelToVertex(projectId: string, modelDisplayName: string, modelArtifactUri: string) {
    const parent = `projects/${GCP_PROJECT_ID}/locations/${GCP_LOCATION}`;

    // 1. Upload Model
    console.log(`[Vertex AI] Uploading Model: ${modelDisplayName}`);
    const [uploadResponse] = await modelClient.uploadModel({
        parent,
        model: {
            displayName: modelDisplayName,
            artifactUri: modelArtifactUri, // gs://path/to/model/
            containerSpec: {
                imageUri: 'us-docker.pkg.dev/vertex-ai/prediction/sklearn-cpu.1-0:latest', // Pre-built sklearn serving
            },
        },
    });

    // As uploadModel is LRO (Long Running Operation), we might need to wait, 
    // but for "Real-time" UI non-block, we usually return the LRO name or wait if we want synchronous flow.
    // Let's await the LRO for simplicity in this "Studio" flow so user gets a final URL.
    const [uploadResult] = await uploadResponse.promise();
    const modelName = uploadResult.model;
    console.log(`[Vertex AI] Model Uploaded: ${modelName}`);

    // 2. Create Endpoint
    console.log(`[Vertex AI] Creating Endpoint...`);
    const [endpointResponse] = await endpointClient.createEndpoint({
        parent,
        endpoint: { displayName: `${modelDisplayName}-endpoint` },
    });
    const [endpointResult] = await endpointResponse.promise();
    const endpointName = endpointResult.name;
    console.log(`[Vertex AI] Endpoint Created: ${endpointName}`);

    // 3. Deploy Model to Endpoint
    console.log(`[Vertex AI] Deploying to Endpoint...`);
    const [deployResponse] = await endpointClient.deployModel({
        endpoint: endpointName,
        deployedModel: {
            model: modelName,
            displayName: 'deployed-model',
            dedicatedResources: {
                minReplicaCount: 1,
                machineSpec: {
                    machineType: 'e2-highmem-2',
                },
            },
        },
        trafficSplit: { '0': 100 },
    });

    // This is also LRO. 
    await deployResponse.promise();
    console.log(`[Vertex AI] Deployment Complete.`);

    return {
        modelName,
        endpointName,
        endpointUrl: `https://${GCP_LOCATION}-aiplatform.googleapis.com/v1/${endpointName}:predict`
    };
}


