/**
 * Telemetry Service
 * Event tracking for analytics and monitoring
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export type TelemetryEventType =
    | 'dataset_uploaded'
    | 'script_generated'
    | 'job_started'
    | 'job_completed'
    | 'job_failed'
    | 'model_deployed'
    | 'model_undeployed'
    | 'user_signup'
    | 'user_upgrade'
    | 'prediction_made';

export interface TelemetryEvent {
    eventType: TelemetryEventType;
    userId: string;
    projectId?: string;
    metadata: Record<string, unknown>;
    timestamp: Date;
}

export interface TelemetryEventData {
    userId: string;
    projectId?: string;
    tier?: string;
    datasetId?: string;
    jobId?: string;
    modelId?: string;
    algorithm?: string;
    taskType?: string;
    duration?: number;
    cost?: number;
    errorMessage?: string;
    [key: string]: unknown;
}

/**
 * Track a telemetry event (fire-and-forget)
 */
export async function trackEvent(
    eventType: TelemetryEventType,
    data: TelemetryEventData
): Promise<string | null> {
    try {
        const eventRef = await adminDb
            .collection('telemetry')
            .doc(eventType)
            .collection('events')
            .add({
                ...data,
                eventType,
                timestamp: FieldValue.serverTimestamp(),
                date: new Date().toISOString().split('T')[0], // For daily aggregation
                hour: new Date().getHours() // For hourly aggregation
            });

        // Update daily summary (async, don't wait)
        updateDailySummary(eventType, data).catch(console.error);

        console.log(`[Telemetry] Tracked: ${eventType}`, data.projectId || data.userId);
        return eventRef.id;
    } catch (error) {
        console.error('[Telemetry] Failed to track event:', error);
        return null;
    }
}

/**
 * Update daily summary for analytics dashboard
 */
async function updateDailySummary(
    eventType: TelemetryEventType,
    data: TelemetryEventData
): Promise<void> {
    const today = new Date().toISOString().split('T')[0];
    const summaryRef = adminDb
        .collection('telemetry')
        .doc('summaries')
        .collection('daily')
        .doc(today);

    const updateData: Record<string, unknown> = {
        lastUpdated: FieldValue.serverTimestamp()
    };

    // Increment event count
    updateData[`counts.${eventType}`] = FieldValue.increment(1);

    // Track by tier
    if (data.tier) {
        updateData[`byTier.${data.tier}.${eventType}`] = FieldValue.increment(1);
    }

    // Track costs
    if (data.cost && typeof data.cost === 'number') {
        updateData['totalCost'] = FieldValue.increment(data.cost);
        if (data.tier) {
            updateData[`costByTier.${data.tier}`] = FieldValue.increment(data.cost);
        }
    }

    // Track duration (GPU hours)
    if (data.duration && typeof data.duration === 'number') {
        updateData['totalGpuHours'] = FieldValue.increment(data.duration);
    }

    await summaryRef.set(updateData, { merge: true });
}

/**
 * Get analytics summary for date range
 */
export async function getAnalyticsSummary(
    startDate: string,
    endDate: string
): Promise<AnalyticsSummary> {
    const summariesRef = adminDb
        .collection('telemetry')
        .doc('summaries')
        .collection('daily')
        .where('__name__', '>=', startDate)
        .where('__name__', '<=', endDate);

    const snapshot = await summariesRef.get();

    const summary: AnalyticsSummary = {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        totalDatasets: 0,
        totalModels: 0,
        totalCost: 0,
        totalGpuHours: 0,
        byTier: {
            free: { jobs: 0, cost: 0 },
            silver: { jobs: 0, cost: 0 },
            gold: { jobs: 0, cost: 0 }
        },
        dailyData: []
    };

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const counts = data.counts || {};

        summary.totalJobs += (counts.job_started || 0);
        summary.completedJobs += (counts.job_completed || 0);
        summary.failedJobs += (counts.job_failed || 0);
        summary.totalDatasets += (counts.dataset_uploaded || 0);
        summary.totalModels += (counts.model_deployed || 0);
        summary.totalCost += (data.totalCost || 0);
        summary.totalGpuHours += (data.totalGpuHours || 0);

        // Tier breakdown
        const byTier = data.byTier || {};
        ['free', 'silver', 'gold'].forEach(tier => {
            const tierData = byTier[tier] || {};
            summary.byTier[tier as 'free' | 'silver' | 'gold'].jobs += (tierData.job_started || 0);
        });
        const costByTier = data.costByTier || {};
        ['free', 'silver', 'gold'].forEach(tier => {
            summary.byTier[tier as 'free' | 'silver' | 'gold'].cost += (costByTier[tier] || 0);
        });

        // Daily data point
        summary.dailyData.push({
            date: doc.id,
            jobs: counts.job_started || 0,
            completed: counts.job_completed || 0,
            failed: counts.job_failed || 0,
            cost: data.totalCost || 0
        });
    });

    // Sort daily data
    summary.dailyData.sort((a, b) => a.date.localeCompare(b.date));

    return summary;
}

export interface AnalyticsSummary {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalDatasets: number;
    totalModels: number;
    totalCost: number;
    totalGpuHours: number;
    byTier: {
        free: { jobs: number; cost: number };
        silver: { jobs: number; cost: number };
        gold: { jobs: number; cost: number };
    };
    dailyData: Array<{
        date: string;
        jobs: number;
        completed: number;
        failed: number;
        cost: number;
    }>;
}

/**
 * Get user-specific analytics
 */
export async function getUserAnalytics(userId: string): Promise<UserAnalytics> {
    const eventsRef = adminDb.collectionGroup('events').where('userId', '==', userId);
    const snapshot = await eventsRef.limit(1000).get();

    const analytics: UserAnalytics = {
        totalJobs: 0,
        completedJobs: 0,
        failedJobs: 0,
        totalDatasets: 0,
        totalModels: 0,
        totalCost: 0,
        recentActivity: []
    };

    snapshot.docs.forEach(doc => {
        const data = doc.data();
        const eventType = data.eventType as TelemetryEventType;

        switch (eventType) {
            case 'job_started':
                analytics.totalJobs++;
                break;
            case 'job_completed':
                analytics.completedJobs++;
                break;
            case 'job_failed':
                analytics.failedJobs++;
                break;
            case 'dataset_uploaded':
                analytics.totalDatasets++;
                break;
            case 'model_deployed':
                analytics.totalModels++;
                break;
        }

        if (data.cost) {
            analytics.totalCost += data.cost;
        }

        // Recent activity (last 10)
        if (analytics.recentActivity.length < 10) {
            analytics.recentActivity.push({
                type: eventType,
                timestamp: data.timestamp?.toDate?.() || new Date(),
                projectId: data.projectId
            });
        }
    });

    return analytics;
}

export interface UserAnalytics {
    totalJobs: number;
    completedJobs: number;
    failedJobs: number;
    totalDatasets: number;
    totalModels: number;
    totalCost: number;
    recentActivity: Array<{
        type: TelemetryEventType;
        timestamp: Date;
        projectId?: string;
    }>;
}
