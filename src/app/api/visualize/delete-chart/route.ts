
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb, getStorageBucket } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

export async function DELETE(request: NextRequest) {
    try {
        // Auth check
        const authHeader = request.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }
        const token = authHeader.split('Bearer ')[1];
        await adminAuth.verifyIdToken(token);

        const { searchParams } = new URL(request.url);
        const chartId = searchParams.get('chartId');
        const projectId = searchParams.get('projectId');

        if (!chartId) {
            return NextResponse.json({ error: 'Missing chartId' }, { status: 400 });
        }

        console.log(`Deleting chart ${chartId} for project ${projectId}`);

        // 1. Delete Firestore Document
        await adminDb.collection('charts').doc(chartId).delete();

        // 2. Delete GCS Files
        if (projectId) {
            const bucket = getStorageBucket();
            // Path prefix: projects/${projectId}/visualizations/${chartId}/
            // This will delete output.png, output.json, etc.
            const prefix = `projects/${projectId}/visualizations/${chartId}/`;
            try {
                await bucket.deleteFiles({ prefix });
                console.log(`Deleted GCS files with prefix ${prefix}`);
            } catch (e) {
                console.warn('Failed to delete GCS files (might not exist or permission error):', e);
                // Don't fail the request if GCS delete fails, as Firestore is primary
            }
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[DeleteChart] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
