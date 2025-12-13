/**
 * GCP Utilities
 * 
 * Core Google Cloud Platform utilities:
 * - Storage operations (upload, download, signed URLs)
 * - File metadata
 * 
 * Note: Training is now handled by compute-training.ts (Compute Engine)
 * and runpod-training.ts (RunPod GPU) instead of Vertex AI.
 */

import { Storage } from '@google-cloud/storage';

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

// Configuration exports
export const GCP_PROJECT_ID = projectId;
export const GCP_LOCATION = process.env.GCP_LOCATION || 'us-central1';
// IMPORTANT: Use GCP_TRAINING_BUCKET for training outputs, NOT Firebase Storage bucket
// Firebase Storage (automl-dc494.firebasestorage.app) is for user uploads
// GCS bucket (mlforge-fluent-cable-480715-c8) is for training outputs
export const TRAINING_BUCKET = process.env.GCP_TRAINING_BUCKET || 'mlforge-fluent-cable-480715-c8';

/**
 * Retrieves metadata for a file in GCS.
 */
export async function getFileMetadata(gcsPath: string) {
    const bucketName = gcsPath.split('/')[2];
    const fileName = gcsPath.split('/').slice(3).join('/');
    const [metadata] = await storage.bucket(bucketName).file(fileName).getMetadata();
    return metadata;
}

/**
 * Uploads the generated Python training script to Google Cloud Storage.
 * Uses content hash for deduplication - same script content won't be uploaded twice.
 */
export async function uploadScriptToGCS(projectId: string, scriptContent: string): Promise<string> {
    try {
        const crypto = await import('crypto');
        const bucket = storage.bucket(TRAINING_BUCKET);

        // Compute SHA256 hash of script content for deduplication
        const contentHash = crypto.createHash('sha256').update(scriptContent).digest('hex').slice(0, 16);
        const fileName = `projects/${projectId}/jobs/train_${contentHash}.py`;
        const file = bucket.file(fileName);

        // Check if file already exists (deduplication)
        const [exists] = await file.exists();
        if (exists) {
            console.log(`[GCP] Script already exists, reusing: gs://${TRAINING_BUCKET}/${fileName}`);
            return `gs://${TRAINING_BUCKET}/${fileName}`;
        }

        // Upload new script
        await file.save(scriptContent, {
            contentType: 'text/x-python',
            metadata: {
                cacheControl: 'private',
                contentHash: contentHash
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
 * Stub for retrieving logs - now handled by compute-training.ts via GCS polling
 */
export async function getTrainingLogs(jobId: string) {
    console.log(`[GCP] Logs for job ${jobId} - use /api/studio/jobs/[id]/logs instead`);
    return {
        logs: [],
        message: 'Logs are streamed from GCS via the logs API endpoint'
    };
}

/**
 * Generates a V4 Signed URL for uploading a file directly to GCS.
 */
export async function generateUploadSignedUrl(projectId: string, fileName: string, contentType: string) {
    try {
        const bucket = storage.bucket(TRAINING_BUCKET);
        const filePath = `projects/${projectId}/uploads/${fileName}`;
        const file = bucket.file(filePath);

        const [url] = await file.getSignedUrl({
            version: 'v4',
            action: 'write',
            expires: Date.now() + 15 * 60 * 1000, // 15 minutes
            contentType,
        });

        return {
            url,
            gcsPath: `gs://${TRAINING_BUCKET}/${filePath}`
        };
    } catch (error) {
        console.error("[GCP] Signed URL Error:", error);
        throw new Error("Failed to generate upload URL.");
    }
}

/**
 * Download a file from GCS
 */
export async function downloadFromGCS(gcsPath: string): Promise<Buffer> {
    const bucketName = gcsPath.replace('gs://', '').split('/')[0];
    const fileName = gcsPath.replace(`gs://${bucketName}/`, '');

    const [content] = await storage.bucket(bucketName).file(fileName).download();
    return content;
}

/**
 * Check if a file exists in GCS
 */
export async function fileExistsInGCS(gcsPath: string): Promise<boolean> {
    try {
        const bucketName = gcsPath.replace('gs://', '').split('/')[0];
        const fileName = gcsPath.replace(`gs://${bucketName}/`, '');

        const [exists] = await storage.bucket(bucketName).file(fileName).exists();
        return exists;
    } catch {
        return false;
    }
}

/**
 * List files in a GCS directory
 */
export async function listFilesInGCS(gcsPrefix: string): Promise<string[]> {
    const bucketName = gcsPrefix.replace('gs://', '').split('/')[0];
    const prefix = gcsPrefix.replace(`gs://${bucketName}/`, '');

    const [files] = await storage.bucket(bucketName).getFiles({ prefix });
    return files.map(f => `gs://${bucketName}/${f.name}`);
}

export default {
    storage,
    getFileMetadata,
    uploadScriptToGCS,
    getTrainingLogs,
    generateUploadSignedUrl,
    downloadFromGCS,
    fileExistsInGCS,
    listFilesInGCS,
    GCP_PROJECT_ID,
    GCP_LOCATION,
    TRAINING_BUCKET
};
