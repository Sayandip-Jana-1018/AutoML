import { NextRequest, NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/registry/models/sync-owner
 * Sync owner info (name, photo) for models owned by a user
 */
export async function POST(request: NextRequest) {
    try {
        const body = await request.json();
        const { userId } = body;

        if (!userId) {
            return NextResponse.json(
                { error: 'Missing userId' },
                { status: 400 }
            );
        }

        // Get user data
        const userDoc = await adminDb.collection('users').doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json(
                { error: 'User not found' },
                { status: 404 }
            );
        }

        const userData = userDoc.data();
        const ownerName = userData?.displayName || userData?.name || userData?.email?.split('@')[0] || 'MLForge User';
        const ownerPhotoURL = userData?.photoURL || userData?.avatar || null;

        console.log('[Sync Owner] User data:', { userId, ownerName, ownerPhotoURL: ownerPhotoURL ? 'exists' : 'null' });

        // Find all models owned by this user (check multiple possible fields)
        // Get ALL models first, then filter (Firestore doesn't support OR queries easily)
        const allModelsSnapshot = await adminDb.collection('models').get();

        const userModels = allModelsSnapshot.docs.filter(doc => {
            const data = doc.data();
            return data.ownerId === userId ||
                data.userId === userId ||
                data.createdBy === userId ||
                data.user_id === userId ||
                data.ownerEmail === userData?.email ||
                data.owner_email === userData?.email;
        });

        if (userModels.length === 0) {
            return NextResponse.json({
                success: true,
                message: 'No models found for user',
                modelsUpdated: 0
            });
        }

        // Update all models with owner info
        const batch = adminDb.batch();
        userModels.forEach(doc => {
            batch.update(doc.ref, {
                ownerName,
                ownerPhotoURL,
                ownerId: userId, // Ensure ownerId is set correctly
                updatedAt: new Date()
            });
        });

        await batch.commit();

        console.log(`[Sync Owner] Updated ${userModels.length} models for user ${userId}`);

        return NextResponse.json({
            success: true,
            message: `Updated ${userModels.length} models`,
            modelsUpdated: userModels.length,
            ownerName,
            hasPhoto: !!ownerPhotoURL
        });

    } catch (error: any) {
        console.error('[Sync Owner] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to sync owner info' },
            { status: 500 }
        );
    }
}
