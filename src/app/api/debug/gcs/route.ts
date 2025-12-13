import { NextResponse } from 'next/server';
import { storage, TRAINING_BUCKET } from '@/lib/gcp';

export const runtime = 'nodejs';

/**
 * GET: View training job files from GCS (for debugging)
 * Query params: projectId, jobId, file (status.json or output.log)
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const projectId = searchParams.get('projectId');
        const jobId = searchParams.get('jobId');
        const file = searchParams.get('file') || 'status.json';

        if (!projectId || !jobId) {
            return NextResponse.json({ error: 'Missing projectId or jobId' }, { status: 400 });
        }

        console.log(`[Debug GCS] Checking ${TRAINING_BUCKET}/projects/${projectId}/jobs/${jobId}/${file}`);
        const bucket = storage.bucket(TRAINING_BUCKET);
        const filePath = `projects/${projectId}/jobs/${jobId}/${file}`;
        const gcsFile = bucket.file(filePath);

        const [exists] = await gcsFile.exists();
        if (!exists) {
            return NextResponse.json({
                error: 'File not found',
                bucket: TRAINING_BUCKET,
                path: filePath,
                fullPath: `gs://${TRAINING_BUCKET}/${filePath}`,
                availableFiles: ['status.json', 'output.log', 'metrics.json']
            }, { status: 404 });
        }

        const [content] = await gcsFile.download();
        const text = content.toString('utf-8');

        // If JSON, parse and return
        if (file.endsWith('.json')) {
            try {
                return NextResponse.json({
                    file,
                    path: filePath,
                    content: JSON.parse(text)
                });
            } catch {
                return NextResponse.json({ file, path: filePath, content: text });
            }
        }

        // Return raw text for logs
        return NextResponse.json({
            file,
            path: filePath,
            content: text,
            lines: text.split('\n').length
        });

    } catch (error: any) {
        console.error('[Debug] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
