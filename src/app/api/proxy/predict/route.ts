import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { Storage } from '@google-cloud/storage';

export const runtime = 'nodejs';

// Initialize GCS
const storage = new Storage({
    projectId: process.env.GCP_PROJECT_ID,
    credentials: {
        client_email: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
        private_key: process.env.FIREBASE_ADMIN_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    }
});

/**
 * POST /api/proxy/predict
 * Run inference on a deployed model using its GCS-stored pickle/joblib file
 */
export async function POST(request: NextRequest) {
    try {
        const { model_id, data } = await request.json();

        if (!model_id || !data) {
            return NextResponse.json(
                { error: 'Missing model_id or data' },
                { status: 400 }
            );
        }

        // 1. Fetch model details from Firestore
        const modelDoc = await adminDb.collection('models').doc(model_id).get();

        if (!modelDoc.exists) {
            return NextResponse.json(
                { error: 'Model not found' },
                { status: 404 }
            );
        }

        const modelData = modelDoc.data();
        // Support both old and new schema
        const gcsPath = modelData?.gcsPath || modelData?.model_path;

        if (!gcsPath) {
            return NextResponse.json(
                { error: 'Model file path not found in registry' },
                { status: 404 }
            );
        }

        console.log(`[Predict] Preparing inference for ${model_id} from ${gcsPath}`);

        // 2. Download model from GCS to local temp
        // Parse bucket and path from gs://bucket/path
        const match = gcsPath.match(/^gs:\/\/([^/]+)\/(.+)$/);
        if (!match) {
            throw new Error(`Invalid GCS path: ${gcsPath}`);
        }
        const [, bucketName, filePath] = match;

        // Use a persistent temp dir for caching models (simple cache)
        const fs = require('fs');
        const path = require('path');
        const tempDir = path.join(process.cwd(), '.tmp', 'models');
        if (!fs.existsSync(tempDir)) {
            fs.mkdirSync(tempDir, { recursive: true });
        }

        // OPTIMIZATION: Check local cache FIRST before any GCS calls
        // This prevents the slow GCS file existence checks on every request
        let localModelPath: string | null = null;
        try {
            const cachedFiles = fs.readdirSync(tempDir);
            const cachedFile = cachedFiles.find((f: string) => f.startsWith(`${model_id}_`));
            if (cachedFile) {
                localModelPath = path.join(tempDir, cachedFile);
                console.log(`[Predict] Cache Hit! Using local model: ${localModelPath}`);
            }
        } catch (err) {
            console.error('[Predict] Cache check failed:', err);
        }

        // Only reach out to GCS if we don't have it locally
        if (!localModelPath) {
            console.log(`[Predict] Cache Miss. Searching GCS for ${model_id}...`);

            // First, determine the actual model file path and extension
            let actualFilePath = filePath;

            // Check if we need to find the actual model file
            const bucket = storage.bucket(bucketName);

            // Try multiple possible paths for the model file
            const possiblePaths = [
                filePath,
                // Joblib (sklearn)
                filePath.replace(/\/$/, '') + '.joblib',
                filePath.replace(/\/model\/?$/, '/model.joblib'),
                filePath + 'model.joblib',
                // H5 (Keras/TensorFlow)
                filePath.replace(/\/$/, '') + '.h5',
                filePath.replace(/\/model\/?$/, '/model.h5'),
                filePath + 'model.h5',
                // Keras (New format)
                filePath.replace(/\/$/, '') + '.keras',
                filePath.replace(/\/model\/?$/, '/model.keras'),
                filePath + 'model.keras',
            ];

            // Find which path actually exists
            for (const tryPath of possiblePaths) {
                try {
                    const file = bucket.file(tryPath);
                    const [exists] = await file.exists();
                    if (exists) {
                        actualFilePath = tryPath;
                        // Use the actual filename with extension for local cache
                        const actualFileName = path.basename(tryPath);
                        localModelPath = path.join(tempDir, `${model_id}_${actualFileName}`);
                        console.log(`[Predict] Found model at: ${tryPath}, downloading to: ${localModelPath}`);
                        break;
                    }
                } catch (e) {
                    console.log(`[Predict] Path not found: ${tryPath}`);
                }
            }

            if (!localModelPath) {
                throw new Error(`Model file not found at any expected path. Tried: ${possiblePaths.join(', ')}`);
            }

            // Download
            const file = bucket.file(actualFilePath);
            await file.download({ destination: localModelPath });
            console.log(`[Predict] Download complete.`);
        }

        // 3. Run Inference
        const { runPythonInference } = await import('@/lib/inference-utils');

        // Pass data directly (can be { feature1: val } or { image: base64 })
        console.log('[Predict] Executing inference script...');
        const result = await runPythonInference(localModelPath, data);

        console.log('[Predict] Result:', result);

        if (result.error) {
            return NextResponse.json(
                { error: result.error, details: result.details },
                { status: 500 }
            );
        }

        return NextResponse.json({
            ...result,
            model_id,
            timestamp: Date.now()
        });

    } catch (error: any) {
        console.error('[Proxy Predict] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Prediction failed' },
            { status: 500 }
        );
    }
}
