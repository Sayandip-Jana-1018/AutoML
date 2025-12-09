/**
 * Scheduled Cleanup Function
 * Runs daily to clean up old jobs, orphaned artifacts, and stale versions
 */

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const db = getFirestore();
// Note: Storage cleanup is a placeholder for future implementation

// Configuration
const CLEANUP_CONFIG = {
    jobRetentionDays: 90,           // Delete jobs older than 90 days
    orphanedScriptDays: 30,         // Delete orphaned scripts after 30 days
    staleVersionDays: 180,          // Archive stale dataset versions after 180 days
    maxBatchSize: 500,              // Firestore batch limit
    dryRun: false                   // Set to true for testing
};

/**
 * Scheduled cleanup - runs daily at 2 AM UTC
 */
export const scheduledCleanup = onSchedule({
    schedule: '0 2 * * *',  // Cron: every day at 2:00 AM
    timeZone: 'UTC',
    memory: '512MiB',
    timeoutSeconds: 540     // 9 minutes
}, async (event) => {
    console.log('[Cleanup] Starting scheduled cleanup...');

    const results = {
        jobsDeleted: 0,
        scriptsDeleted: 0,
        versionsArchived: 0,
        artifactsDeleted: 0,
        errors: [] as string[]
    };

    try {
        // 1. Clean up old jobs
        results.jobsDeleted = await cleanupOldJobs();

        // 2. Clean up orphaned scripts
        results.scriptsDeleted = await cleanupOrphanedScripts();

        // 3. Archive stale dataset versions
        results.versionsArchived = await archiveStaleVersions();

        // 4. Clean up orphaned GCS artifacts
        results.artifactsDeleted = await cleanupOrphanedArtifacts();

        // Log results
        console.log('[Cleanup] Completed:', JSON.stringify(results));

        // Store cleanup log
        await db.collection('system').doc('cleanup_logs').collection('runs').add({
            timestamp: FieldValue.serverTimestamp(),
            results,
            success: true
        });

    } catch (error) {
        console.error('[Cleanup] Error:', error);
        results.errors.push(error instanceof Error ? error.message : 'Unknown error');

        await db.collection('system').doc('cleanup_logs').collection('runs').add({
            timestamp: FieldValue.serverTimestamp(),
            results,
            success: false,
            error: error instanceof Error ? error.message : 'Unknown error'
        });
    }
});

/**
 * Delete training jobs older than retention period
 */
async function cleanupOldJobs(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CLEANUP_CONFIG.jobRetentionDays);

    const jobsQuery = await db.collectionGroup('jobs')
        .where('createdAt', '<', cutoff)
        .where('status', 'in', ['SUCCEEDED', 'FAILED', 'CANCELLED'])
        .limit(CLEANUP_CONFIG.maxBatchSize)
        .get();

    if (jobsQuery.empty || CLEANUP_CONFIG.dryRun) {
        console.log(`[Cleanup] Would delete ${jobsQuery.size} old jobs`);
        return jobsQuery.size;
    }

    const batch = db.batch();
    jobsQuery.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    console.log(`[Cleanup] Deleted ${jobsQuery.size} old jobs`);
    return jobsQuery.size;
}

/**
 * Delete script versions not linked to any job
 */
async function cleanupOrphanedScripts(): Promise<number> {
    const cutoff = new Date();
    cutoff.setDate(cutoff.getDate() - CLEANUP_CONFIG.orphanedScriptDays);

    const scriptsQuery = await db.collectionGroup('scripts')
        .where('createdAt', '<', cutoff)
        .limit(CLEANUP_CONFIG.maxBatchSize)
        .get();

    let orphanCount = 0;
    const batch = db.batch();

    for (const scriptDoc of scriptsQuery.docs) {
        // Check if any job references this script
        const scriptId = scriptDoc.id;
        const jobsRef = await db.collectionGroup('jobs')
            .where('scriptVersionId', '==', scriptId)
            .limit(1)
            .get();

        if (jobsRef.empty) {
            if (!CLEANUP_CONFIG.dryRun) {
                batch.delete(scriptDoc.ref);
            }
            orphanCount++;
        }
    }

    if (!CLEANUP_CONFIG.dryRun && orphanCount > 0) {
        await batch.commit();
    }

    console.log(`[Cleanup] ${CLEANUP_CONFIG.dryRun ? 'Would delete' : 'Deleted'} ${orphanCount} orphaned scripts`);
    return orphanCount;
}

/**
 * Archive old dataset versions (keep only last 3 per dataset)
 */
async function archiveStaleVersions(): Promise<number> {
    const datasetsQuery = await db.collection('datasets').get();
    let archivedCount = 0;

    for (const datasetDoc of datasetsQuery.docs) {
        const versionsQuery = await datasetDoc.ref
            .collection('versions')
            .orderBy('createdAt', 'desc')
            .get();

        // Keep first 3 versions, archive the rest
        const toArchive = versionsQuery.docs.slice(3);

        for (const versionDoc of toArchive) {
            if (!CLEANUP_CONFIG.dryRun) {
                await versionDoc.ref.update({
                    archived: true,
                    archivedAt: FieldValue.serverTimestamp()
                });
            }
            archivedCount++;
        }
    }

    console.log(`[Cleanup] ${CLEANUP_CONFIG.dryRun ? 'Would archive' : 'Archived'} ${archivedCount} stale versions`);
    return archivedCount;
}

/**
 * Clean up orphaned GCS artifacts
 */
async function cleanupOrphanedArtifacts(): Promise<number> {
    // This is a placeholder - in production you'd scan GCS for unreferenced files
    // For now, we just return 0
    console.log('[Cleanup] GCS artifact cleanup skipped (manual task)');
    return 0;
}

/**
 * Manual cleanup trigger (for testing)
 * Call this directly for dry-run testing
 */
export async function runManualCleanup(dryRun: boolean = true) {
    CLEANUP_CONFIG.dryRun = dryRun;
    console.log('[Cleanup] Manual cleanup triggered, dryRun:', dryRun);

    const results = {
        jobsDeleted: await cleanupOldJobs(),
        scriptsDeleted: await cleanupOrphanedScripts(),
        versionsArchived: await archiveStaleVersions(),
        artifactsDeleted: await cleanupOrphanedArtifacts()
    };

    console.log('[Cleanup] Manual cleanup results:', results);
    return results;
}
