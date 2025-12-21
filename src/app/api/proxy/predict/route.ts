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

        const fileName = path.basename(filePath);
        const localModelPath = path.join(tempDir, `${model_id}_${fileName}`);

        // Only download if not already cached (or check size/timestamp in real prod)
        if (!fs.existsSync(localModelPath)) {
            console.log(`[Predict] Downloading model to ${localModelPath}...`);
            const bucket = storage.bucket(bucketName);
            const file = bucket.file(filePath);
            await file.download({ destination: localModelPath });
        } else {
            console.log(`[Predict] Using cached model at ${localModelPath}`);
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
