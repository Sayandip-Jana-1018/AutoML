import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * GET /api/proxy/datasets
 * Get all datasets for the current user or all public datasets
 */
export async function GET(request: NextRequest) {
    try {
        const { searchParams } = new URL(request.url);
        const userId = searchParams.get('userId');

        let datasetsQuery;

        if (userId) {
            // Get datasets for specific user
            datasetsQuery = adminDb
                .collection('datasets')
                .where('userId', '==', userId)
                .orderBy('createdAt', 'desc')
                .limit(50);
        } else {
            // Get all recent datasets
            datasetsQuery = adminDb
                .collection('datasets')
                .orderBy('createdAt', 'desc')
                .limit(50);
        }

        const snapshot = await datasetsQuery.get();

        const datasets = snapshot.docs.map(doc => {
            const data = doc.data();
            return {
                id: doc.id,
                dataset_id: doc.id,
                name: data.name || data.filename || 'Unnamed Dataset',
                filename: data.filename,
                columns: data.columns || [],
                rows: data.rows || data.rowCount || 0,
                size: data.size || 0,
                status: data.status || 'ready',
                created_at: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
                user_id: data.userId,
                gcsPath: data.gcsPath
            };
        });

        return NextResponse.json({
            success: true,
            datasets,
            count: datasets.length
        });

    } catch (error: any) {
        console.error('[Proxy Datasets] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to fetch datasets', datasets: [] },
            { status: 500 }
        );
    }
}
