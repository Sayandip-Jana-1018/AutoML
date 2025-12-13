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

                // Get unique owner IDs and emails to fetch their display names
                const ownerIds = [...new Set(snapshot.docs.map(doc => doc.data().ownerId).filter(Boolean))];
                const ownerEmails = [...new Set(snapshot.docs.map(doc => doc.data().ownerEmail || doc.data().user_email).filter(Boolean))];

                // Fetch owner names and photos in batch
                const ownerData: Record<string, { name: string | null; photoURL: string | null }> = {};
                const emailToData: Record<string, { name: string | null; photoURL: string | null }> = {};

                // Lookup by ownerId
                if (ownerIds.length > 0) {
                    const userPromises = ownerIds.map(async (ownerId) => {
                        try {
                            const userDoc = await adminDb.collection('users').doc(ownerId).get();
                            if (userDoc.exists) {
                                const userData = userDoc.data();
                                console.log(`[Registry] User ${ownerId} data:`, {
                                    displayName: userData?.displayName,
                                    name: userData?.name,
                                    email: userData?.email,
                                    photoURL: userData?.photoURL,
                                    avatar: userData?.avatar
                                });
                                const name = userData?.displayName || userData?.name || userData?.email?.split('@')[0] || null;
                                const photoURL = userData?.photoURL || userData?.avatar || null;
                                ownerData[ownerId] = { name, photoURL };
                                if (userData?.email) {
                                    emailToData[userData.email] = { name, photoURL };
                                }
                            }
                        } catch (e) {
                            console.log(`[Registry] User lookup error for ${ownerId}:`, e);
                        }
                    });
                    await Promise.all(userPromises);
                }

                const models = snapshot.docs.map(doc => {
                    const data = doc.data();
                    // Try ownerId first, then email fallback
                    let owner = ownerData[data.ownerId] || { name: null, photoURL: null };
                    if (!owner.name && (data.ownerEmail || data.user_email)) {
                        const email = data.ownerEmail || data.user_email;
                        owner = emailToData[email] || owner;
                    }
                    return {
                        id: doc.id,
                        ...data,
                        // Use fetched owner name and photo, fall back to stored values
                        ownerName: owner.name || data.ownerName || null,
                        ownerPhotoURL: owner.photoURL || data.ownerPhotoURL || null,
                        createdAt: data.createdAt?.toDate?.() || null,
                        updatedAt: data.updatedAt?.toDate?.() || null
                    };
                });

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
