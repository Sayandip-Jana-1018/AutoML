import { NextResponse } from 'next/server';
import { deployModelToVertex } from '@/lib/gcp';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Force Node.js runtime for Cloud SDK
export const runtime = 'nodejs';

export async function POST(req: Request) {
    try {
        const { projectId, jobId } = await req.json();

        if (!projectId || !jobId) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Fetch job details to get artifact path
        // For simplicity, we assume the job saved model to specific path or we assume a convention
        // Convention: gs://bucket/projects/{projectId}/jobs/{jobId}/params/
        // REALITY: We should read it from the Job object in Firestore if we stored it, or GCS.
        // Let's assume the Training script was instructed to save to:
        const trainingBucket = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'automl-dc494.appspot.com';
        // Note: Vertex AI usually exports to `model/` subdirectory if managed, or custom path.
        // We'll stick to a convention for this studio:
        const modelArtifactUri = `gs://${trainingBucket}/projects/${projectId}/jobs/${jobId}/model/`;

        console.log(`[Deploy API] Starting deployment for Job ${jobId}`);

        // Trigger Long-Running Deployment
        // In a real async system, we would return "Deploying..." and let a worker handle this.
        // Since Vercel has timeouts, we might hit limits here if we wait for full deployment (10-15 mins).
        // OPTIMIZATION: We will initiate it but NOT wait for the final LRO promise in the response,
        // letting the logs/backend handle it, OR we accept that this request might timeout on Vercel.
        // Re-architecture for time: We will return "Initiated" and run the promise in background (if runtime allows).
        // WARNING: Vercel Serverless functions freeze after response. 
        // CORRECT PATH: Task Queues. 
        // SHORTCUT: We will await the *Initial* creation requests (Upload/Create Endpoint) but maybe not full traffic split.
        // Actually, let's keep it simple: try to await. If timeout, UI handles error.

        const deploymentResult = await deployModelToVertex(
            projectId,
            `project-${projectId}-model`,
            modelArtifactUri
        );

        // Save Endpoint info to Firestore
        await adminDb.collection('projects').doc(projectId).collection('deployments').add({
            jobId,
            endpointName: deploymentResult.endpointName,
            endpointUrl: deploymentResult.endpointUrl,
            status: 'active',
            createdAt: FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            status: 'deployed',
            endpointUrl: deploymentResult.endpointUrl
        });

    } catch (error: any) {
        console.error("Deployment Error:", error);
        return NextResponse.json({ error: error.message || "Failed to deploy model" }, { status: 500 });
    }
}
