import { NextResponse } from 'next/server';
import { adminDb } from '@/lib/firebase-admin';
import { profileDatasetFromGCS } from '@/lib/schema-profiler';
import { FieldValue } from 'firebase-admin/firestore';
import { getFileMetadata } from '@/lib/gcp';

export const runtime = 'nodejs'; // Required for GCS access

/**
 * POST /api/studio/upload/confirm
 * Called after file successfully uploaded to GCS (either by frontend or Cloud Function trigger)
 * Triggers schema profiling and updates dataset status
 * 
 * Idempotent: skips processing if dataset is already 'ready'
 */
export async function POST(req: Request) {
    try {
        const {
            projectId,
            datasetId,
            gcsPath,
            cleaningConfig = {},  // Default to empty object, never null
            triggeredBy = 'frontend',
            userId = ''  // For user-level deduplication
        } = await req.json();

        if (!projectId || !datasetId || !gcsPath) {
            return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
        }

        console.log(`[Upload Confirm] Starting for dataset ${datasetId}, triggered by: ${triggeredBy}`);

        const datasetRef = adminDb.collection('projects').doc(projectId).collection('datasets').doc(datasetId);

        // 0. Initial State & Idempotency
        const existing = await datasetRef.get();
        if (existing.exists && existing.data()?.status === 'ready') {
            console.log(`[Upload Confirm] Dataset ${datasetId} already ready, skipping`);
            return NextResponse.json({
                success: true,
                datasetId,
                alreadyProcessed: true,
                schema: existing.data()?.schema
            });
        }

        // Capture dataset info early for later use
        const existingData = existing.data();
        const datasetName = existingData?.name || '';
        const fileHash = existingData?.fileHash; // Get hash stored during upload route

        // 0.5 Deduplication Check
        let md5Hash: string | undefined;
        let fileSize: number | undefined;

        try {
            const metadata = await getFileMetadata(gcsPath);
            md5Hash = metadata.md5Hash;
            // Handle size being string or number
            const rawSize = metadata.size;
            fileSize = typeof rawSize === 'number' ? rawSize : parseInt(String(rawSize || '0'), 10);

            console.log(`[Upload Confirm] File metadata: size=${fileSize}, hash=${md5Hash}`);

            if (md5Hash) {
                // Check if any OTHER dataset in this project has the same hash
                const duplicateQuery = await adminDb.collection('projects').doc(projectId).collection('datasets')
                    .where('md5Hash', '==', md5Hash)
                    .where('status', '==', 'ready')
                    .limit(1)
                    .get();

                if (!duplicateQuery.empty) {
                    const existingDataset = duplicateQuery.docs[0].data();
                    const existingId = duplicateQuery.docs[0].id;

                    if (existingId !== datasetId) {
                        console.log(`[Upload Confirm] Found duplicate dataset ${existingId}, reusing...`);

                        // Reuse existing dataset and return immediately
                        const updateData = {
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
                            // Update dataset info for preview - Use cached name/cols
                            'dataset.filename': existingDataset.columnNames ? (existingDataset.name || 'Reused Dataset') : '',
                            'dataset.columns': existingDataset.columnNames,
                            'dataset.rowCount': existingDataset.rowCount,
                            'dataset.fileSize': existingDataset.fileSize || fileSize
                        };

                        await adminDb.collection('projects').doc(projectId).update(updateData);

                        // Delete the placeholder dataset we just created since we are reusing
                        await datasetRef.delete();

                        return NextResponse.json({
                            success: true,
                            datasetId: existingId,
                            reused: true,
                            schema: existingDataset.schema
                        });
                    }
                }
            }
        } catch (e) {
            console.warn("[Upload Confirm] Metadata fetch/dedupe check failed, proceeding with new upload:", e);
        }

        // 1. Update status to 'processing' and workflow step
        await datasetRef.update({
            status: 'processing',
            triggeredBy: triggeredBy || 'frontend',
            md5Hash: md5Hash || '',
            fileSize: fileSize || 0,
            updatedAt: FieldValue.serverTimestamp()
        });

        // Update project workflow to step 2 (schema profiling)
        await adminDb.collection('projects').doc(projectId).update({
            'workflow.step': 2,
            'workflow.status': 'pending',
            'workflow.updatedAt': FieldValue.serverTimestamp()
        });

        // 2. Profile the dataset
        let schema;
        try {
            schema = await profileDatasetFromGCS(gcsPath);
            console.log(`[Upload Confirm] Profiled: ${schema.rowCount} rows`);
        } catch (profileError: unknown) {
            const errorMessage = profileError instanceof Error ? profileError.message : 'Failed to profile dataset';
            console.error(`[Upload Confirm] Profiling failed:`, profileError);

            await datasetRef.update({ status: 'error', error: errorMessage });
            await adminDb.collection('projects').doc(projectId).update({
                'workflow.status': 'error',
                'workflow.errorMessage': errorMessage
            });

            return NextResponse.json({ error: "Schema profiling failed", details: errorMessage }, { status: 500 });
        }

        // 3. Create version document for reproducibility
        const versionsRef = datasetRef.collection('versions');
        const versionsSnapshot = await versionsRef.count().get();
        const newVersionNumber = versionsSnapshot.data().count + 1;

        const versionDoc = {
            schema: {
                columns: schema.columns.map(c => ({
                    name: c.name || '',
                    type: c.type || 'unknown',
                    nullCount: c.nullCount || 0,
                    uniqueCount: c.uniqueCount || 0
                })),
                rowCount: schema.rowCount || 0,
                columnCount: schema.columnCount || 0,
                missingValueStats: schema.missingValueStats || {},
                inferredTaskType: schema.inferredTaskType || 'unknown',
                taskTypeConfidence: schema.taskTypeConfidence || 0,
                targetColumnSuggestion: schema.targetColumnSuggestion || ''
            },
            gcsPath: gcsPath || '',
            md5Hash: md5Hash || '',
            cleaningConfig: cleaningConfig || {},
            createdAt: FieldValue.serverTimestamp(),
            versionNumber: newVersionNumber
        };

        const versionRef = await versionsRef.add(versionDoc);

        // Update workflow to step 3 (version created)
        await adminDb.collection('projects').doc(projectId).update({
            'workflow.step': 3,
            'workflow.updatedAt': FieldValue.serverTimestamp()
        });

        // 4. Update dataset with schema, taskType, and mark as ready
        await datasetRef.update({
            status: 'ready',
            currentVersionId: versionRef.id,
            versionCount: newVersionNumber,
            // Task type with confidence (used by chat and script generator)
            taskType: schema.inferredTaskType || 'unknown',
            taskTypeConfidence: schema.taskTypeConfidence || 0,
            // Full schema
            schema: {
                columns: schema.columns.map(c => ({
                    name: c.name || '',
                    type: c.type || 'unknown',
                    nullCount: c.nullCount || 0,
                    uniqueCount: c.uniqueCount || 0
                })),
                rowCount: schema.rowCount || 0,
                columnCount: schema.columnCount || 0,
                missingValueStats: schema.missingValueStats || {},
                inferredTaskType: schema.inferredTaskType || 'unknown',
                taskTypeConfidence: schema.taskTypeConfidence || 0,
                targetColumnSuggestion: schema.targetColumnSuggestion || ''
            },
            columnNames: schema.columns.map(c => c.name),
            rowCount: schema.rowCount || 0,
            fileSize: fileSize || 0,
            gcsPath: gcsPath || '',
            cleaningConfig: cleaningConfig || {},
            triggeredBy: triggeredBy || 'frontend',
            md5Hash: md5Hash || '',
            updatedAt: FieldValue.serverTimestamp()
        });

        // 5. Update project with taskType, versionId for lineage, and dataset info
        await adminDb.collection('projects').doc(projectId).update({
            // Schema detection fields
            taskType: schema.inferredTaskType || 'unknown',
            taskTypeConfidence: schema.taskTypeConfidence || 0,
            targetColumn: schema.targetColumnSuggestion || '',
            inferredTaskType: schema.inferredTaskType || 'unknown',
            targetColumnSuggestion: schema.targetColumnSuggestion || '',
            // Versioning for lineage
            latestDatasetId: datasetId,
            datasetVersionId: versionRef.id,
            lastDatasetUploadAt: FieldValue.serverTimestamp(),
            // Update workflow to step 5 (ready for review)
            'workflow.stage': 'ready',
            'workflow.step': 5,
            'workflow.status': 'success',
            'workflow.datasetReused': false,
            'workflow.updatedAt': FieldValue.serverTimestamp(),
            // Mark dataset as uploaded
            datasetUploaded: true,
            // Update dataset info for preview - Use cached name
            'dataset.filename': datasetName || 'dataset',
            'dataset.columns': schema.columns.map(c => c.name),
            'dataset.columnTypes': Object.fromEntries(
                schema.columns.map(c => [c.name, c.type || 'unknown'])
            ),
            'dataset.rowCount': schema.rowCount || 0,
            'dataset.storageUrl': gcsPath,  // Critical: This is needed for training!
            'dataset.gcsPath': gcsPath,     // Also store as gcsPath for compatibility
            'dataset.fileSize': fileSize || 0
        });

        // 6. Create user_datasets entry for cross-project deduplication
        if (userId && (fileHash || md5Hash)) {
            const hash = fileHash || md5Hash;
            const userDatasetKey = `${userId}_${hash}`;
            try {
                await adminDb.collection('user_datasets').doc(userDatasetKey).set({
                    ownerId: userId,
                    contentHash: hash,
                    gcsPath,
                    fileSize: fileSize || 0,
                    rowCount: schema.rowCount || 0,
                    filename: datasetName || 'dataset',
                    columnNames: schema.columns.map(c => c.name),
                    taskType: schema.inferredTaskType || 'unknown',
                    inferredTaskType: schema.inferredTaskType || 'unknown',
                    targetColumnSuggestion: schema.targetColumnSuggestion || '',
                    datasetId,
                    versionId: versionRef.id,
                    canonicalDatasetRef: `projects/${projectId}/datasets/${datasetId}`,
                    createdAt: FieldValue.serverTimestamp()
                });
                console.log(`[Upload Confirm] Created user_datasets entry: ${userDatasetKey}`);
            } catch (e) {
                console.warn('[Upload Confirm] Failed to create user_datasets entry:', e);
            }
        }

        console.log(`[Upload Confirm] ✅ Dataset ${datasetId} ready. TaskType: ${schema.inferredTaskType}, Version: ${newVersionNumber}`);

        return NextResponse.json({
            success: true,
            datasetId,
            versionId: versionRef.id,
            versionNumber: newVersionNumber,
            schema: {
                rowCount: schema.rowCount,
                columnCount: schema.columnCount,
                inferredTaskType: schema.inferredTaskType,
                taskTypeConfidence: schema.taskTypeConfidence,
                targetSuggestion: schema.targetColumnSuggestion,
                columns: schema.columns.map(c => c.name)
            }
        });

    } catch (error: unknown) {
        const errorMessage = error instanceof Error ? error.message : 'Upload confirmation failed';
        console.error("[Upload Confirm] Error:", error);
        return NextResponse.json({ error: errorMessage }, { status: 500 });
    }
}
