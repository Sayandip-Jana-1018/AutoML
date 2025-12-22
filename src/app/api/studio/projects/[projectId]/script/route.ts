/**
 * GET /api/studio/projects/[projectId]/script
 * Returns the current script for a project (used by VS Code extension)
 */
import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export async function GET(
    request: NextRequest,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // Fetch project from Firestore
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();

        if (!projectDoc.exists) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectData = projectDoc.data();
        const script = projectData?.currentScript || '';

        console.log(`[Script API] Fetched script for ${projectId}, length: ${script.length}`);

        return NextResponse.json({
            script,
            projectId,
            projectName: projectData?.name || 'Untitled',
            lastUpdated: projectData?.lastUpdated?.toDate?.()?.toISOString() || null
        });

    } catch (error: any) {
        console.error('[Script API] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch script' },
            { status: 500 }
        );
    }
}
