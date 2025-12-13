
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, getStorageBucket } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/visualize/dataset-proxy
 * 
 * Streams a dataset from GCS to the client for client-side visualization.
 * Query Params:
 * - gcsPath: gs://bucket/path/to/file.csv
 * - projectId: string (for verification/logging)
 */
export async function GET(request: NextRequest) {
    try {
        // Verify auth
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);

        // Get params
        const { searchParams } = new URL(request.url);
        const gcsPath = searchParams.get('gcsPath');
        const projectId = searchParams.get('projectId');

        if (!gcsPath) {
            return NextResponse.json({ error: 'gcsPath required' }, { status: 400 });
        }

        console.log(`[DatasetProxy] Streaming ${gcsPath} for project ${projectId}`);

        // Parse GCS URI to get relative path
        // gs://bucket-name/folder/file.csv -> folder/file.csv
        let filePath = gcsPath;
        if (gcsPath.startsWith('gs://')) {
            const parts = gcsPath.replace('gs://', '').split('/');
            parts.shift(); // remove bucket name
            filePath = parts.join('/');
        }

        const bucket = getStorageBucket();
        const file = bucket.file(filePath);
        const [exists] = await file.exists();

        if (!exists) {
            return NextResponse.json({ error: `File not found in GCS: ${filePath}` }, { status: 404 });
        }

        // Get metadata to check size
        const [metadata] = await file.getMetadata();
        const size = parseInt(String(metadata.size || '0'));
        const MAX_SIZE_MB = 20; // Limit for client-side viz

        if (size > MAX_SIZE_MB * 1024 * 1024) {
            return NextResponse.json({
                error: `Dataset too large (${(size / 1024 / 1024).toFixed(1)}MB). Max size is ${MAX_SIZE_MB}MB for instant visualization.`
            }, { status: 413 });
        }

        // Stream the file
        // Helper to convert readable stream to web stream
        const stream = file.createReadStream();

        // Return as CSV response
        // Using distinct headers for text/csv
        const headers = new Headers();
        headers.set('Content-Type', 'text/csv');
        headers.set('Cache-Control', 'private, max-age=3600');

        // Create a ReadableStream from the Node stream
        const readable = new ReadableStream({
            start(controller) {
                stream.on('data', (chunk) => controller.enqueue(chunk));
                stream.on('end', () => controller.close());
                stream.on('error', (err) => controller.error(err));
            },
        });

        return new NextResponse(readable, { headers });

    } catch (error: any) {
        console.error('[DatasetProxy] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
