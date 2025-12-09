/**
 * Quota Management Service
 * Tracks and enforces per-user resource limits
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import { USER_QUOTAS, SubscriptionTier } from './resource-policy';

export interface UserUsage {
    datasetsCount: number;
    jobsToday: number;
    activeJobs: number;
    storageUsedGB: number;
    lastJobDate: string;
}

export interface QuotaCheckResult {
    allowed: boolean;
    reason?: string;
    current?: number;
    limit?: number;
}

/**
 * Get current usage for a user
 */
export async function getUserUsage(userId: string): Promise<UserUsage> {
    const today = new Date().toISOString().split('T')[0];

    // Get usage doc
    const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc('current');
    const usageDoc = await usageRef.get();

    if (!usageDoc.exists) {
        return {
            datasetsCount: 0,
            jobsToday: 0,
            activeJobs: 0,
            storageUsedGB: 0,
            lastJobDate: today
        };
    }

    const data = usageDoc.data()!;

    // Reset daily count if new day
    if (data.lastJobDate !== today) {
        return {
            ...data,
            jobsToday: 0,
            lastJobDate: today
        } as UserUsage;
    }

    return data as UserUsage;
}

/**
 * Check if user can upload a new dataset
 */
export async function checkDatasetQuota(
    userId: string,
    tier: SubscriptionTier
): Promise<QuotaCheckResult> {
    const usage = await getUserUsage(userId);
    const limits = USER_QUOTAS[tier];

    if (usage.datasetsCount >= limits.maxDatasets) {
        return {
            allowed: false,
            reason: `Dataset limit reached (${limits.maxDatasets} for ${tier} tier)`,
            current: usage.datasetsCount,
            limit: limits.maxDatasets
        };
    }

    return { allowed: true };
}

/**
 * Check if user can start a new job
 */
export async function checkJobQuota(
    userId: string,
    tier: SubscriptionTier
): Promise<QuotaCheckResult> {
    const usage = await getUserUsage(userId);
    const limits = USER_QUOTAS[tier];

    // Check daily limit
    if (usage.jobsToday >= limits.maxJobsPerDay) {
        return {
            allowed: false,
            reason: `Daily job limit reached (${limits.maxJobsPerDay} for ${tier} tier)`,
            current: usage.jobsToday,
            limit: limits.maxJobsPerDay
        };
    }

    // Check parallel jobs
    if (usage.activeJobs >= limits.maxParallelJobs) {
        return {
            allowed: false,
            reason: `Maximum parallel jobs reached (${limits.maxParallelJobs} for ${tier} tier)`,
            current: usage.activeJobs,
            limit: limits.maxParallelJobs
        };
    }

    return { allowed: true };
}

/**
 * Check if user can use more storage
 */
export async function checkStorageQuota(
    userId: string,
    tier: SubscriptionTier,
    additionalGB: number = 0
): Promise<QuotaCheckResult> {
    const usage = await getUserUsage(userId);
    const limits = USER_QUOTAS[tier];

    if (usage.storageUsedGB + additionalGB > limits.maxStorageGB) {
        return {
            allowed: false,
            reason: `Storage limit would be exceeded (${limits.maxStorageGB} GB for ${tier} tier)`,
            current: usage.storageUsedGB,
            limit: limits.maxStorageGB
        };
    }

    return { allowed: true };
}

/**
 * Increment dataset count
 */
export async function incrementDatasetCount(userId: string): Promise<void> {
    const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc('current');
    await usageRef.set({
        datasetsCount: FieldValue.increment(1),
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Increment job count (daily + active)
 */
export async function incrementJobCount(userId: string): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc('current');

    await usageRef.set({
        jobsToday: FieldValue.increment(1),
        activeJobs: FieldValue.increment(1),
        lastJobDate: today,
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Decrement active job count (when job completes)
 */
export async function decrementActiveJobs(userId: string): Promise<void> {
    const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc('current');
    await usageRef.set({
        activeJobs: FieldValue.increment(-1),
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Update storage usage
 */
export async function updateStorageUsage(userId: string, deltaGB: number): Promise<void> {
    const usageRef = adminDb.collection('users').doc(userId).collection('usage').doc('current');
    await usageRef.set({
        storageUsedGB: FieldValue.increment(deltaGB),
        updatedAt: FieldValue.serverTimestamp()
    }, { merge: true });
}

/**
 * Get quota summary for display
 */
export async function getQuotaSummary(userId: string, tier: SubscriptionTier) {
    const usage = await getUserUsage(userId);
    const limits = USER_QUOTAS[tier];

    return {
        datasets: { used: usage.datasetsCount, limit: limits.maxDatasets },
        jobsToday: { used: usage.jobsToday, limit: limits.maxJobsPerDay },
        parallelJobs: { used: usage.activeJobs, limit: limits.maxParallelJobs },
        storage: { used: usage.storageUsedGB, limit: limits.maxStorageGB, unit: 'GB' }
    };
}
