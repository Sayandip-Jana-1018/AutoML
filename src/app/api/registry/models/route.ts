import { NextResponse } from 'next/server';
import { listModels, registerModel } from '@/lib/model-registry';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * GET: List all models for user
 * POST: Register a new model
 */
export async function GET(req: Request) {
    try {
        const { searchParams } = new URL(req.url);
        const userId = searchParams.get('userId');

        if (!userId) {
            // Return all public models for marketplace
            try {
                // Check if adminDb is initialized
                if (!adminDb) {
                    console.log('[Registry API] Database not initialized, returning empty');
                    return NextResponse.json({ models: [] });
                }

                const snapshot = await adminDb
                    .collection('models')
                    .where('visibility', '==', 'public')
                    .orderBy('updatedAt', 'desc')
                    .limit(50)
                    .get();

                const models = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data(),
                    createdAt: doc.data().createdAt?.toDate?.() || null,
                    updatedAt: doc.data().updatedAt?.toDate?.() || null
                }));

                return NextResponse.json({ models: models || [] });
            } catch (indexError: any) {
                // If index doesn't exist or collection is empty, return empty array
                const errorMsg = indexError?.message || 'Unknown index error';
                console.log('[Registry API] Index/query issue:', errorMsg);
                return NextResponse.json({ models: [] });
            }
        }

        const models = await listModels(userId);
        return NextResponse.json({ models: models || [] });

    } catch (error: any) {
        const errorMsg = error?.message || 'Failed to list models';
        console.log('[Registry API] Error:', errorMsg);
        return NextResponse.json({ models: [] });
    }
}

export async function POST(req: Request) {
    try {
        const data = await req.json();

        if (!data.name || !data.taskType || !data.projectId || !data.ownerId) {
            return NextResponse.json({
                error: 'Missing required fields: name, taskType, projectId, ownerId'
            }, { status: 400 });
        }

        const modelId = await registerModel(data);

        return NextResponse.json({
            modelId,
            message: 'Model registered successfully'
        });

    } catch (error: any) {
        const errorMsg = error?.message || 'Failed to register model';
        console.log('[Registry API] Error:', errorMsg);
        return NextResponse.json({ error: errorMsg }, { status: 500 });
    }
}
