import { NextResponse } from 'next/server';
import { getSampleDatasets, getSampleDataset, createPlaygroundProject } from '@/lib/sample-datasets';

export const runtime = 'nodejs';

/**
 * Playground API
 * GET: List sample datasets
 * POST: Create playground project
 */
export async function GET() {
    try {
        const samples = getSampleDatasets();
        return NextResponse.json({ samples });
    } catch (error: unknown) {
        console.error('[Playground API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to get samples';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const { userId, sampleId } = await req.json();

        if (!userId || !sampleId) {
            return NextResponse.json({
                error: 'Missing userId or sampleId'
            }, { status: 400 });
        }

        const sample = getSampleDataset(sampleId);
        if (!sample) {
            return NextResponse.json({
                error: `Sample dataset '${sampleId}' not found`
            }, { status: 404 });
        }

        const result = await createPlaygroundProject(userId, sampleId);

        return NextResponse.json({
            success: true,
            ...result,
            message: `Playground created with ${sample.name}`
        });

    } catch (error: unknown) {
        console.error('[Playground API] Error:', error);
        const errorMessage = error instanceof Error ? error.message : 'Failed to create playground';
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
