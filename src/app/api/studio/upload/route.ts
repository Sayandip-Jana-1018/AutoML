import { NextResponse } from 'next/server';
import { generateUploadSignedUrl } from '@/lib/gcp';
import { adminDb } from '@/lib/firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Tier-based upload limits (file size in bytes)
const TIER_UPLOAD_LIMITS = {
    free: 50 * 1024 * 1024,    // 50MB
    silver: 200 * 1024 * 1024, // 200MB
    gold: 1024 * 1024 * 1024   // 1GB
};

// Helper to infer dataset type
function inferDatasetType(mimeType: string, fileName: string): 'tabular' | 'image' | 'text' | 'unknown' {
    const lowerName = fileName.toLowerCase();
    if (mimeType.includes('csv') || lowerName.endsWith('.csv') || lowerName.endsWith('.xlsx')) return 'tabular';
    if (mimeType.includes('image') || lowerName.endsWith('.jpg') || lowerName.endsWith('.png')) return 'image';
    if (mimeType.includes('zip') || lowerName.endsWith('.zip')) {
        return 'image';
    }
    if (mimeType.includes('text') || lowerName.endsWith('.txt') || lowerName.endsWith('.json')) return 'text';
    return 'unknown';
}

export async function POST(req: Request) {
    try {
        const { projectId, fileName, contentType, fileSize, userTier = 'free', fileHash, userId } = await req.json();

        if (!projectId || !fileName || !contentType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        // Quota check based on user tier
        const maxSize = TIER_UPLOAD_LIMITS[userTier as keyof typeof TIER_UPLOAD_LIMITS] || TIER_UPLOAD_LIMITS.free;
        if (fileSize && fileSize > maxSize) {
            const maxMB = Math.round(maxSize / 1024 / 1024);
            return NextResponse.json({
                error: `File too large. ${userTier === 'free' ? 'Free' : userTier.charAt(0).toUpperCase() + userTier.slice(1)} tier limit is ${maxMB}MB. Upgrade to upload larger files.`,
                code: 'QUOTA_EXCEEDED'
            }, { status: 413 });
        }

        // User-level deduplication: Check user_datasets/{userId}_{fileHash}
        if (fileHash && userId) {
            const userDatasetKey = `${userId}_${fileHash}`;
            console.log(`[Upload] Checking user_datasets for: ${userDatasetKey.substring(0, 32)}...`);

            const userDatasetDoc = await adminDb.collection('user_datasets').doc(userDatasetKey).get();

            if (userDatasetDoc.exists) {
                const existingData = userDatasetDoc.data()!;
                console.log(`[Upload] Found user dataset, reusing: ${existingData.canonicalDatasetRef}`);

                // Update current project to reference this dataset
                await adminDb.collection('projects').doc(projectId).update({
                    datasetUploaded: true,
                    latestDatasetId: existingData.datasetId,
                    datasetVersionId: existingData.versionId,
                    taskType: existingData.taskType,
                    inferredTaskType: existingData.inferredTaskType,
                    targetColumnSuggestion: existingData.targetColumnSuggestion,
                    'workflow.stage': 'ready',
                    'workflow.step': 5,
                    'workflow.status': 'success',
                    'workflow.datasetReused': true,
                    'workflow.updatedAt': FieldValue.serverTimestamp(),
                    'dataset.filename': existingData.filename || fileName,
                    'dataset.columns': existingData.columnNames,
                    'dataset.rowCount': existingData.rowCount,
                    'dataset.fileSize': existingData.fileSize || fileSize
                });

                return NextResponse.json({
                    reused: true,
                    datasetId: existingData.datasetId,
                    gcsPath: existingData.gcsPath,
                    message: 'Dataset already exists in your account, reusing'
                });
            }
        }

        // Fallback: Check within this project (for backwards compatibility)
        if (fileHash) {
            console.log(`[Upload] Checking project datasets for hash: ${fileHash.substring(0, 16)}...`);

            const existingQuery = await adminDb.collection('projects').doc(projectId).collection('datasets')
                .where('fileHash', '==', fileHash)
                .where('status', '==', 'ready')
                .limit(1)
                .get();

            if (!existingQuery.empty) {
                const existingDataset = existingQuery.docs[0].data();
                const existingId = existingQuery.docs[0].id;

                console.log(`[Upload] Found existing dataset in project: ${existingId}`);

                await adminDb.collection('projects').doc(projectId).update({
                    datasetUploaded: true,
                    latestDatasetId: existingId,
                    datasetVersionId: existingDataset.currentVersionId,
                    taskType: existingDataset.taskType,
                    inferredTaskType: existingDataset.inferredTaskType,
                    targetColumnSuggestion: existingDataset.targetColumnSuggestion,
                    'workflow.stage': 'ready',
                    'workflow.step': 5,
                    'workflow.status': 'success',
                    'workflow.datasetReused': true,
                    'workflow.updatedAt': FieldValue.serverTimestamp(),
                    'dataset.filename': existingDataset.name || fileName,
                    'dataset.columns': existingDataset.columnNames,
                    'dataset.rowCount': existingDataset.rowCount,
                    'dataset.fileSize': existingDataset.fileSize || fileSize
                });

                return NextResponse.json({
                    reused: true,
                    datasetId: existingId,
                    message: 'Dataset already exists in project, reusing'
                });
            }
        }

        // 1. Generate Signed URL
        const { url, gcsPath } = await generateUploadSignedUrl(projectId, fileName, contentType);

        const datasetType = inferDatasetType(contentType, fileName);

        // 2. Create pending dataset record (include hash for future deduplication)
        const datasetRef = await adminDb.collection('projects').doc(projectId).collection('datasets').add({
            name: fileName,
            gcsPath: gcsPath,
            status: 'uploading',
            type: datasetType,
            contentType,
            fileSize: fileSize || 0,
            fileHash: fileHash || null, // Store hash for deduplication
            createdAt: FieldValue.serverTimestamp(),
        });

        // 3. Initialize workflow state on project
        await adminDb.collection('projects').doc(projectId).update({
            'workflow.stage': 'upload',
            'workflow.step': 0,
            'workflow.status': 'pending',
            'workflow.updatedAt': FieldValue.serverTimestamp()
        });

        return NextResponse.json({
            uploadUrl: url,
            datasetId: datasetRef.id,
            gcsPath,
            maxSize,
            tier: userTier
        });

    } catch (error) {
        console.error("Signed URL Error:", error);
        return NextResponse.json({ error: "Failed to generate upload URL" }, { status: 500 });
    }
}
