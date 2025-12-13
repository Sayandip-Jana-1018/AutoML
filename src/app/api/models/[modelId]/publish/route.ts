/**
 * Publish Gate Endpoint
 * POST /api/models/{modelId}/publish
 * 
 * Publishes a model to the marketplace:
 * - Verifies model artifacts exist in GCS
 * - Sets isPublic=true, verified=true
 * - Prevents publishing without artifacts
 */

import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { adminAuth } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { Storage } from '@google-cloud/storage';

export const runtime = 'nodejs';

const storage = new Storage();
const bucketName = process.env.GCS_BUCKET || 'mlforge-datasets';

interface RouteContext {
    params: { modelId: string };
}

export async function POST(req: NextRequest, context: RouteContext) {
    try {
        const { modelId } = context.params;

        // Authenticate
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Fetch model
        const modelDoc = await adminDb.collection('models').doc(modelId).get();

        if (!modelDoc.exists) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const model = modelDoc.data();

        // Check ownership
        if (model?.ownerId !== userId) {
            return NextResponse.json({ error: 'Only the owner can publish this model' }, { status: 403 });
        }

        // Already published?
        if (model?.isPublic && model?.verified) {
            return NextResponse.json({
                success: true,
                message: 'Model is already published',
                isPublic: true,
                verified: true
            });
        }

        // Verify artifacts exist in GCS
        const gcsPath = model?.gcsPath;
        if (!gcsPath) {
            return NextResponse.json({
                error: 'Model has no associated artifacts. Train the model first.',
                code: 'NO_ARTIFACTS'
            }, { status: 400 });
        }

        // Parse GCS path
        let artifactPath = gcsPath;
        if (gcsPath.startsWith('gs://')) {
            const parts = gcsPath.replace('gs://', '').split('/');
            parts.shift(); // Remove bucket name
            artifactPath = parts.join('/');
        }

        // Check if model file exists
        try {
            const bucket = storage.bucket(bucketName);
            const modelFiles = await bucket.getFiles({
                prefix: artifactPath,
                maxResults: 5
            });

            if (!modelFiles[0] || modelFiles[0].length === 0) {
                return NextResponse.json({
                    error: 'Model artifacts not found in storage. Training may not have completed.',
                    code: 'ARTIFACTS_NOT_FOUND',
                    path: artifactPath
                }, { status: 400 });
            }

            console.log(`[Publish] Found ${modelFiles[0].length} artifact files for model ${modelId}`);

        } catch (gcsError: any) {
            console.error('[Publish] GCS error:', gcsError);
            return NextResponse.json({
                error: 'Could not verify artifacts in storage',
                code: 'GCS_ERROR'
            }, { status: 500 });
        }

        // Publish the model
        await modelDoc.ref.update({
            isPublic: true,
            verified: true,
            visibility: 'public',
            publishedAt: FieldValue.serverTimestamp(),
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            message: 'Model published to marketplace',
            modelId,
            isPublic: true,
            verified: true
        });

    } catch (error: any) {
        console.error('[Publish] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/models/{modelId}/publish - Unpublish a model
 */
export async function DELETE(req: NextRequest, context: RouteContext) {
    try {
        const { modelId } = context.params;

        // Authenticate
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        // Fetch model
        const modelDoc = await adminDb.collection('models').doc(modelId).get();

        if (!modelDoc.exists) {
            return NextResponse.json({ error: 'Model not found' }, { status: 404 });
        }

        const model = modelDoc.data();

        // Check ownership
        if (model?.ownerId !== userId) {
            return NextResponse.json({ error: 'Only the owner can unpublish this model' }, { status: 403 });
        }

        // Unpublish
        await modelDoc.ref.update({
            isPublic: false,
            visibility: 'private',
            updatedAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            success: true,
            message: 'Model unpublished from marketplace',
            isPublic: false
        });

    } catch (error: any) {
        console.error('[Unpublish] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
