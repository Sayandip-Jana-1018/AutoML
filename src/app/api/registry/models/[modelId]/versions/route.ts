import { NextResponse } from 'next/server';
import { listModelVersions, createModelVersion } from '@/lib/model-registry';

export const runtime = 'nodejs';

/**
 * GET: List versions for a model
 * POST: Create a new version
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ modelId: string }> }
) {
    try {
        const { modelId } = await params;
        const versions = await listModelVersions(modelId);
        return NextResponse.json({ versions });

    } catch (error: unknown) {
        console.error('[Versions API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to list versions';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(
    req: Request,
    { params }: { params: Promise<{ modelId: string }> }
) {
    try {
        const { modelId } = await params;
        const data = await req.json();

        if (!data.datasetVersionId || !data.scriptVersionId || !data.jobId) {
            return NextResponse.json({
                error: 'Missing required fields'
            }, { status: 400 });
        }

        const versionId = await createModelVersion(modelId, data);

        return NextResponse.json({
            versionId,
            message: 'Version created successfully'
        });

    } catch (error: unknown) {
        console.error('[Versions API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create version';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
