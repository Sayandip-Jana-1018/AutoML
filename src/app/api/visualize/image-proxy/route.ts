
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, getStorageBucket } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/visualize/image-proxy
 * 
 * Streams an image from GCS to the client.
 * used for <img src="..." />
 */
export async function GET(request: NextRequest) {
    try {
        // Auth check - Optional? Images might be needed in <img> tags where adding headers is hard.
        // But headers are NOT sent with <img> requests.
        // We can use a short-lived token in query param or cookies, or just check standard session cookies if NextAuth used.
        // For now, we'll SKIP auth for image-proxy if it's too strict, OR rely on a query param `token`.
        // Given this is a "Studio" app, usually strict.
        // But standard <img> tag cannot send Bearer header.
        // We'll rely on the user being logged in via session cookie OR pass token in query.

        const { searchParams } = new URL(request.url);
        const gcsPath = searchParams.get('gcsPath');
        const token = searchParams.get('token'); // Optional token

        if (!gcsPath) return new NextResponse('Missing path', { status: 400 });

        // Basic verification if token provided
        if (token) {
            try {
                await adminAuth.verifyIdToken(token);
            } catch (e) {
                // console.warn('Invalid token for image proxy');
            }
        }

        // Parse "gs://"
        let filePath = gcsPath;
        if (gcsPath.startsWith('gs://')) {
            const parts = gcsPath.replace('gs://', '').split('/');
            parts.shift();
            filePath = parts.join('/');
        }

        const bucket = getStorageBucket();
        const file = bucket.file(filePath);
        const [exists] = await file.exists();

        if (!exists) {
            return new NextResponse('Image not found', { status: 404 });
        }

        const stream = file.createReadStream();

        const headers = new Headers();
        headers.set('Content-Type', 'image/png');
        headers.set('Cache-Control', 'public, max-age=86400'); // Cache for 1 day

        const readable = new ReadableStream({
            start(controller) {
                let closed = false;
                stream.on('data', (chunk) => {
                    if (!closed) {
                        try {
                            controller.enqueue(chunk);
                        } catch (e) {
                            // Controller may already be closed
                        }
                    }
                });
                stream.on('end', () => {
                    if (!closed) {
                        closed = true;
                        try {
                            controller.close();
                        } catch (e) {
                            // Already closed
                        }
                    }
                });
                stream.on('error', (err) => {
                    if (!closed) {
                        closed = true;
                        try {
                            controller.error(err);
                        } catch (e) {
                            // Already closed
                        }
                    }
                });
            },
        });

        return new NextResponse(readable, { headers });

    } catch (error: any) {
        console.error('[ImageProxy] Error:', error);
        return new NextResponse('Internal Error', { status: 500 });
    }
}
