/**
 * Alerting Service
 * Monitors thresholds and triggers notifications
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

export interface AlertConfig {
    id: string;
    name: string;
    condition: 'job_failure_rate' | 'monthly_cost' | 'daily_jobs' | 'storage_usage';
    threshold: number;
    operator: 'gt' | 'lt' | 'gte' | 'lte';
    enabled: boolean;
    channels: ('email' | 'slack' | 'webhook')[];
    webhookUrl?: string;
}

export interface Alert {
    id: string;
    configId: string;
    condition: string;
    message: string;
    severity: 'info' | 'warning' | 'critical';
    value: number;
    threshold: number;
    createdAt: Date;
    acknowledged: boolean;
}

// Default alert configurations
export const DEFAULT_ALERTS: AlertConfig[] = [
    {
        id: 'job-failure-rate',
        name: 'High Job Failure Rate',
        condition: 'job_failure_rate',
        threshold: 10, // 10% failure rate
        operator: 'gt',
        enabled: true,
        channels: ['email']
    },
    {
        id: 'monthly-cost',
        name: 'Monthly Cost Threshold',
        condition: 'monthly_cost',
        threshold: 50000, // ₹50,000
        operator: 'gt',
        enabled: true,
        channels: ['email']
    },
    {
        id: 'daily-jobs',
        name: 'High Daily Job Volume',
        condition: 'daily_jobs',
        threshold: 100,
        operator: 'gt',
        enabled: false,
        channels: ['slack']
    }
];

/**
 * Check all alert conditions
 */
export async function checkAlertConditions(): Promise<Alert[]> {
    const alerts: Alert[] = [];
    const today = new Date().toISOString().split('T')[0];
    const monthStart = today.slice(0, 7) + '-01';

    // Get daily summary
    const dailySummary = await adminDb
        .collection('telemetry')
        .doc('daily_summaries')
        .collection('summaries')
        .doc(today)
        .get();

    const dailyData = dailySummary.data() || { totalJobs: 0, failedJobs: 0, totalCost: 0 };

    // Get monthly cost
    const monthlySummaries = await adminDb
        .collection('telemetry')
        .doc('daily_summaries')
        .collection('summaries')
        .where('date', '>=', monthStart)
        .get();

    let monthlyCost = 0;
    monthlySummaries.docs.forEach(doc => {
        monthlyCost += doc.data().totalCost || 0;
    });

    // Check each alert config
    for (const config of DEFAULT_ALERTS) {
        if (!config.enabled) continue;

        let value = 0;
        let triggered = false;

        switch (config.condition) {
            case 'job_failure_rate':
                if (dailyData.totalJobs > 0) {
                    value = (dailyData.failedJobs / dailyData.totalJobs) * 100;
                }
                break;
            case 'monthly_cost':
                value = monthlyCost;
                break;
            case 'daily_jobs':
                value = dailyData.totalJobs;
                break;
        }

        // Evaluate operator
        switch (config.operator) {
            case 'gt': triggered = value > config.threshold; break;
            case 'gte': triggered = value >= config.threshold; break;
            case 'lt': triggered = value < config.threshold; break;
            case 'lte': triggered = value <= config.threshold; break;
        }

        if (triggered) {
            alerts.push({
                id: `${config.id}-${today}`,
                configId: config.id,
                condition: config.condition,
                message: `${config.name}: ${value.toFixed(2)} ${config.operator} ${config.threshold}`,
                severity: value > config.threshold * 1.5 ? 'critical' : 'warning',
                value,
                threshold: config.threshold,
                createdAt: new Date(),
                acknowledged: false
            });
        }
    }

    // Save triggered alerts
    for (const alert of alerts) {
        await adminDb.collection('alerts').doc(alert.id).set({
            ...alert,
            createdAt: FieldValue.serverTimestamp()
        }, { merge: true });
    }

    return alerts;
}

/**
 * Get active (unacknowledged) alerts
 */
export async function getActiveAlerts(): Promise<Alert[]> {
    const snapshot = await adminDb
        .collection('alerts')
        .where('acknowledged', '==', false)
        .orderBy('createdAt', 'desc')
        .limit(50)
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate()
    })) as Alert[];
}

/**
 * Acknowledge an alert
 */
export async function acknowledgeAlert(alertId: string, userId: string): Promise<void> {
    await adminDb.collection('alerts').doc(alertId).update({
        acknowledged: true,
        acknowledgedAt: FieldValue.serverTimestamp(),
        acknowledgedBy: userId
    });
}

/**
 * Send alert notification (placeholder for actual implementation)
 */
export async function sendAlertNotification(alert: Alert, channels: ('email' | 'slack' | 'webhook')[]): Promise<void> {
    for (const channel of channels) {
        console.log(`[Alert] Would send to ${channel}: ${alert.message}`);

        // In production, implement actual notification sending:
        // - Email: SendGrid, SES, etc.
        // - Slack: Webhook integration
        // - Webhook: HTTP POST to configured URL
    }
}
