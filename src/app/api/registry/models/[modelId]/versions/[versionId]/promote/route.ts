import { NextResponse } from 'next/server';
import { promoteToProduction } from '@/lib/model-registry';

export const runtime = 'nodejs';

/**
 * POST: Promote a version to production
 */
export async function POST(
    req: Request,
    { params }: { params: Promise<{ modelId: string; versionId: string }> }
) {
    try {
        const { modelId, versionId } = await params;
        const { userId } = await req.json().catch(() => ({ userId: 'anonymous' }));

        await promoteToProduction(modelId, versionId, userId);

        return NextResponse.json({
            message: 'Version promoted to production successfully'
        });

    } catch (error: unknown) {
        console.error('[Promote API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to promote version';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
