import { NextResponse } from 'next/server';
import { getModelLineage } from '@/lib/model-registry';

export const runtime = 'nodejs';

/**
 * GET: Get lineage graph for a version
 */
export async function GET(
    req: Request,
    { params }: { params: Promise<{ modelId: string; versionId: string }> }
) {
    try {
        const { modelId, versionId } = await params;
        const lineage = await getModelLineage(modelId, versionId);
        return NextResponse.json(lineage);

    } catch (error: unknown) {
        console.error('[Lineage API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get lineage';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
