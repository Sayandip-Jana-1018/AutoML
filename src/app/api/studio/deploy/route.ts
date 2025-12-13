import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Force Node.js runtime
export const runtime = 'nodejs';

/**
 * POST /api/studio/deploy
 * Deploy a trained model - marks it as deployed in the registry
 */
export async function POST(req: Request) {
    try {
        const { projectId, jobId, userId } = await req.json();

        if (!projectId || !jobId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Ensure database is initialized
        if (!adminDb) {
            console.error('[Deploy API] adminDb is not initialized');
            return NextResponse.json({ error: "Database not initialized" }, { status: 500 });
        }

        // Fetch job details
        const jobDoc = await adminDb
            .collection('projects').doc(projectId)
            .collection('jobs').doc(jobId)
            .get();

        if (!jobDoc.exists) {
            return NextResponse.json({ error: "Job not found" }, { status: 404 });
        }

        const jobData = jobDoc.data();
        console.log(`[Deploy API] Deploying Job ${jobId} for Project ${projectId}`);

        // Get project info for owner data
        const projectDoc = await adminDb.collection('projects').doc(projectId).get();
        const projectData = projectDoc.data();

        // Get user info for owner name/photo
        let ownerName = null;
        let ownerPhotoURL = null;
        const ownerId = userId || jobData?.userId || projectData?.owner_email;

        if (ownerId) {
            try {
                const userDoc = await adminDb.collection('users').doc(ownerId).get();
                if (userDoc.exists) {
                    const userData = userDoc.data();
                    ownerName = userData?.displayName || userData?.name || userData?.email?.split('@')[0];
                    ownerPhotoURL = userData?.photoURL || userData?.avatar;
                }
            } catch (e) {
                console.log('[Deploy API] Could not fetch owner data:', e);
            }
        }

        // Check if model already exists for this project
        const existingModels = await adminDb
            .collection('models')
            .where('projectId', '==', projectId)
            .limit(1)
            .get();

        let modelId: string;

        if (!existingModels.empty) {
            // Update existing model
            modelId = existingModels.docs[0].id;
            await adminDb.collection('models').doc(modelId).update({
                status: 'deployed',
                visibility: 'public',
                ownerName: ownerName || existingModels.docs[0].data().ownerName,
                ownerPhotoURL: ownerPhotoURL || existingModels.docs[0].data().ownerPhotoURL,
                deployedAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp()
            });
            console.log(`[Deploy API] Updated existing model ${modelId}`);
        } else {
            // Create new model entry
            const modelRef = await adminDb.collection('models').add({
                name: projectData?.name || `Project ${projectId} Model`,
                description: `Trained model for ${projectData?.name || projectId}`,
                taskType: jobData?.taskType || 'classification',
                projectId,
                ownerId: userId || ownerId,
                ownerEmail: projectData?.owner_email,
                ownerName,
                ownerPhotoURL,
                version: 1,
                metrics: jobData?.metrics || { accuracy: jobData?.bestMetricValue },
                gcsPath: jobData?.modelOutputPath,
                jobId,
                status: 'deployed',
                visibility: 'public',
                uses: 0,
                collaborators: [],
                createdAt: FieldValue.serverTimestamp(),
                updatedAt: FieldValue.serverTimestamp(),
                deployedAt: FieldValue.serverTimestamp()
            });
            modelId = modelRef.id;
            console.log(`[Deploy API] Created new model ${modelId}`);
        }

        // Update job status
        await adminDb
            .collection('projects').doc(projectId)
            .collection('jobs').doc(jobId)
            .update({
                status: 'deployed',
                deployedAt: FieldValue.serverTimestamp(),
                modelId
            });

        // Add deployment record
        await adminDb.collection('projects').doc(projectId).collection('deployments').add({
            jobId,
            modelId,
            status: 'active',
            createdAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            status: 'deployed',
            modelId,
            message: 'Model deployed successfully and published to marketplace'
        });

    } catch (error: any) {
        console.error("[Deploy API] Error:", error);
        return NextResponse.json({ error: error.message || "Failed to deploy model" }, { status: 500 });
    }
}
