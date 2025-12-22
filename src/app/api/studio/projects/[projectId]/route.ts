import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { storage, TRAINING_BUCKET } from '@/lib/gcp';
import type { File } from '@google-cloud/storage';

export const runtime = 'nodejs';

/**
 * DELETE /api/studio/projects/[projectId]
 * Deletes a project and all associated data:
 * - Firestore: project doc + subcollections (jobs, datasets, scripts)
 * - GCS: all files under projects/{projectId}/
 */
export async function DELETE(
    req: Request,
    { params }: { params: Promise<{ projectId: string }> }
) {
    try {
        const { projectId } = await params;

        // Get user email from request headers or body
        const { userEmail } = await req.json().catch(() => ({}));

        if (!projectId) {
            return NextResponse.json({ error: 'Project ID required' }, { status: 400 });
        }

        // 1. Verify project exists and user owns it
        const projectRef = adminDb.collection('projects').doc(projectId);
        const projectDoc = await projectRef.get();

        if (!projectDoc.exists) {
            return NextResponse.json({ error: 'Project not found' }, { status: 404 });
        }

        const projectData = projectDoc.data();
        if (userEmail && projectData?.owner_email !== userEmail) {
            return NextResponse.json({ error: 'Not authorized to delete this project' }, { status: 403 });
        }

        console.log(`[Project Delete] Starting deletion of project: ${projectId}`);

        // 2. Delete all subcollections (including messages)
        const subcollections = ['jobs', 'datasets', 'scripts', 'messages', 'versions'];
        for (const collectionName of subcollections) {
            const subcollectionRef = projectRef.collection(collectionName);
            const docs = await subcollectionRef.listDocuments();

            if (docs.length > 0) {
                console.log(`[Project Delete] Deleting ${docs.length} documents from ${collectionName}`);

                // Delete in batches of 500 (Firestore limit)
                const batchSize = 500;
                for (let i = 0; i < docs.length; i += batchSize) {
                    const batch = adminDb.batch();
                    const chunk = docs.slice(i, i + batchSize);
                    chunk.forEach(docRef => batch.delete(docRef));
                    await batch.commit();
                }
            }
        }

        // 2.5. Delete suggestions (top-level collection with projectId field)
        try {
            const suggestionsQuery = adminDb.collection('suggestions')
                .where('projectId', '==', projectId);
            const suggestionsSnapshot = await suggestionsQuery.get();

            if (!suggestionsSnapshot.empty) {
                console.log(`[Project Delete] Deleting ${suggestionsSnapshot.size} suggestions`);
                const batch = adminDb.batch();
                suggestionsSnapshot.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        } catch (suggestionError) {
            console.warn(`[Project Delete] Suggestion cleanup error (non-fatal):`, suggestionError);
        }

        // 2.5a. Delete user_datasets (Global collection, but linked to project via canonicalDatasetRef)
        try {
            // canonicalDatasetRef format: projects/{projectId}/datasets/{datasetId}
            // Use range query to find all starting with projects/{projectId}/
            const prefix = `projects/${projectId}/`;
            const endPrefix = prefix + '\uf8ff'; // Unicode last character for prefix matching

            const userDatasetsQuery = adminDb.collection('user_datasets')
                .where('canonicalDatasetRef', '>=', prefix)
                .where('canonicalDatasetRef', '<=', endPrefix);

            const userDatasetsSnap = await userDatasetsQuery.get();

            if (!userDatasetsSnap.empty) {
                console.log(`[Project Delete] Deleting ${userDatasetsSnap.size} user_datasets entries`);
                const batch = adminDb.batch();
                userDatasetsSnap.docs.forEach(doc => batch.delete(doc.ref));
                await batch.commit();
            }
        } catch (udError) {
            console.warn(`[Project Delete] user_datasets cleanup error (non-fatal):`, udError);
        }

        // 2.6. Cascading Delete: Models, Deployments, Charts (Top-level collections)
        try {
            const collectionsToClean = ['models', 'deployments', 'charts', 'jobs'];

            for (const colName of collectionsToClean) {
                const querySnapshot = await adminDb.collection(colName)
                    .where('projectId', '==', projectId)
                    .get();

                if (!querySnapshot.empty) {
                    console.log(`[Project Delete] Deleting ${querySnapshot.size} docs from top-level ${colName}`);
                    const batch = adminDb.batch();
                    querySnapshot.docs.forEach(doc => batch.delete(doc.ref));
                    await batch.commit();
                }
            }
        } catch (cascadeError) {
            console.warn(`[Project Delete] Cascading cleanup error (non-fatal):`, cascadeError);
        }

        // 3. Delete all GCS files under projects/{projectId}/
        try {
            const bucket = storage.bucket(TRAINING_BUCKET);

            const [files] = await bucket.getFiles({ prefix: `projects/${projectId}/` });
            console.log(`[Project Delete] Deleting ${files.length} files from GCS`);

            // Delete files in parallel batches
            const deletePromises = files.map((file: File) => file.delete().catch((err: Error) => {
                console.warn(`[Project Delete] Failed to delete file ${file.name}:`, err.message);
            }));
            await Promise.all(deletePromises);
        } catch (gcsError) {
            console.warn(`[Project Delete] GCS cleanup error (non-fatal):`, gcsError);
            // Continue with Firestore deletion even if GCS fails
        }

        // 4. Delete the project document itself
        await projectRef.delete();
        console.log(`[Project Delete] Successfully deleted project: ${projectId}`);

        return NextResponse.json({
            success: true,
            message: 'Project deleted successfully',
            projectId
        });

    } catch (error: any) {
        console.error('[Project Delete] Error:', error);
        return NextResponse.json({
            error: error.message || 'Failed to delete project'
        }, { status: 500 });
    }
}
