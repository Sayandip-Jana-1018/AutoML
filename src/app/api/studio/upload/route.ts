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

// Extracted size limits (to prevent zip bombs or disk exhaustion)
const TIER_EXTRACTED_LIMITS = {
    free: 200 * 1024 * 1024,    // 200MB extracted
    silver: 1024 * 1024 * 1024, // 1GB extracted
    gold: 5 * 1024 * 1024 * 1024 // 5GB extracted (for HAM10000 etc)
};

// Helper to infer dataset type (extended to support more formats)
function inferDatasetType(mimeType: string, fileName: string, overrideType?: string): 'tabular' | 'image' | 'text' | 'json' | 'unknown' {
    // Use override if provided
    if (overrideType && ['tabular', 'image', 'text', 'json'].includes(overrideType)) {
        return overrideType as 'tabular' | 'image' | 'text' | 'json';
    }

    const lowerName = fileName.toLowerCase();

    // Tabular formats
    if (mimeType.includes('csv') || lowerName.endsWith('.csv') || lowerName.endsWith('.tsv')) return 'tabular';
    if (lowerName.endsWith('.xlsx') || lowerName.endsWith('.xls') || lowerName.endsWith('.parquet')) return 'tabular';
    if (lowerName.endsWith('.jsonl')) return 'tabular'; // JSONL is line-delimited JSON for tabular data

    // JSON format
    if (lowerName.endsWith('.json')) return 'json';
    if (mimeType.includes('json')) return 'json';

    // Image formats
    if (mimeType.includes('image') || lowerName.endsWith('.jpg') || lowerName.endsWith('.jpeg') || lowerName.endsWith('.png') || lowerName.endsWith('.gif') || lowerName.endsWith('.webp')) return 'image';
    if (mimeType.includes('zip') || lowerName.endsWith('.zip')) {
        // Check filename for image-related keywords
        if (lowerName.includes('image') || lowerName.includes('photo') || lowerName.includes('pic')) {
            return 'image';
        }
        return 'image'; // Default ZIP to image dataset
    }

    // Text formats
    if (mimeType.includes('text') || lowerName.endsWith('.txt')) return 'text';

    return 'unknown';
}

export async function POST(req: Request) {
    try {
        const {
            projectId,
            fileName,
            contentType,
            fileSize,
            extractedSize, // NEW: Extracted size from client pre-check
            userTier = 'free',
            fileHash,
            userId,
            // NEW: Options from preview UI
            overrideType,
            targetColumn,
            sheetName,
            zipAsClassFolders
        } = await req.json();

        if (!projectId || !fileName || !contentType) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        const tier = userTier as keyof typeof TIER_UPLOAD_LIMITS || 'free';

        // 1. Check Compressed Size Quota
        const maxSize = TIER_UPLOAD_LIMITS[tier];
        if (fileSize && fileSize > maxSize) {
            const maxMB = Math.round(maxSize / 1024 / 1024);
            return NextResponse.json({
                error: `File too large. ${tier === 'free' ? 'Free' : tier.charAt(0).toUpperCase() + tier.slice(1)} tier limit is ${maxMB}MB. Upgrade to upload larger files.`,
                code: 'QUOTA_EXCEEDED'
            }, { status: 413 });
        }

        // 2. Check Extracted Size Quota (Anti-Zip Bomb / Disk Safety)
        const maxExtracted = TIER_EXTRACTED_LIMITS[tier];
        if (extractedSize && extractedSize > maxExtracted) {
            const maxGB = (maxExtracted / 1024 / 1024 / 1024).toFixed(1);
            return NextResponse.json({
                error: `Extracted content too large. Your plan allows up to ${maxGB}GB of extracted data. Please compress or split your dataset.`,
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
                const gcsPath = existingData.gcsPath || existingData.canonicalDatasetRef;

                // CRITICAL FIX: Verify the file actually exists in GCS (project may have been deleted)
                // gcsPath format: gs://bucket-name/path/to/file
                const bucketName = process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'mlforge-fluent-cable-480715-c8';
                const filePath = gcsPath.replace(`gs://${bucketName}/`, '');

                // Import storage only when needed to avoid performance hit
                const { Storage } = await import('@google-cloud/storage');
                const adminStorage = new Storage(); // Use default creds from environment
                const file = adminStorage.bucket(bucketName).file(filePath);

                const [exists] = await file.exists();

                if (exists) {
                    console.log(`[Upload] Found valid user dataset, reusing: ${existingData.canonicalDatasetRef}`);

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
                        'dataset.fileSize': existingData.fileSize || fileSize,
                        'dataset.url': existingData.gcsPath, // Ensure path is available for training
                        'datasetGcsPath': existingData.gcsPath // Redundant backup for legacy checks
                    });

                    return NextResponse.json({
                        reused: true,
                        datasetId: existingData.datasetId,
                        gcsPath: existingData.gcsPath,
                        message: 'Dataset already exists in your account, reusing'
                    });
                } else {
                    console.warn(`[Upload] Stale user dataset record found (file missing): ${gcsPath}. Deleting record.`);
                    // Delete stale record so next upload works cleanly
                    await adminDb.collection('user_datasets').doc(userDatasetKey).delete();
                    // Proceed to normal upload...
                }
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
                    'dataset.fileSize': existingDataset.fileSize || fileSize,
                    'dataset.url': existingDataset.gcsPath, // Ensure path is available for training
                    'datasetGcsPath': existingDataset.gcsPath // Redundant backup for legacy checks
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

        const datasetType = inferDatasetType(contentType, fileName, overrideType);

        // 2. Create pending dataset record (include hash for future deduplication)
        const datasetRef = await adminDb.collection('projects').doc(projectId).collection('datasets').add({
            name: fileName,
            gcsPath: gcsPath,
            status: 'uploading',
            type: datasetType,
            contentType,
            fileSize: fileSize || 0,
            fileHash: fileHash || null, // Store hash for deduplication
            // NEW: Options from preview UI
            targetColumn: targetColumn || null,
            sheetName: sheetName || null,
            zipAsClassFolders: zipAsClassFolders || false,
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
