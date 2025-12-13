/**
 * Rate Limiting Utility
 * Provides IP-based rate limiting for API endpoints
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';

// Environment-based configuration
const DEMO_RATE_LIMIT = parseInt(process.env.MARKETPLACE_DEMO_RATE_LIMIT || '10', 10);
const RATE_WINDOW_MS = 60 * 1000; // 1 minute window

export interface RateLimitResult {
    allowed: boolean;
    remaining: number;
    resetAt: number; // Unix timestamp in seconds
    retryAfter?: number; // Seconds until reset
}

/**
 * Check and update rate limit for an IP address
 * Uses Firestore for distributed rate limiting
 */
export async function checkRateLimit(
    ip: string,
    endpoint: string,
    limit: number = DEMO_RATE_LIMIT
): Promise<RateLimitResult> {
    const key = `${endpoint}:${ip.replace(/\./g, '_')}`;
    const docRef = adminDb.collection('rate_limits').doc(key);

    const now = Date.now();
    const windowStart = now - RATE_WINDOW_MS;

    try {
        const result = await adminDb.runTransaction(async (transaction) => {
            const doc = await transaction.get(docRef);
            const data = doc.data();

            // Clean up old requests and count recent ones
            let requests: number[] = data?.requests || [];
            requests = requests.filter((t: number) => t > windowStart);

            const resetAt = Math.ceil((requests[0] || now) / 1000) + 60;

            if (requests.length >= limit) {
                // Rate limit exceeded
                const retryAfter = Math.max(1, resetAt - Math.floor(now / 1000));
                return {
                    allowed: false,
                    remaining: 0,
                    resetAt,
                    retryAfter
                };
            }

            // Add new request
            requests.push(now);
            transaction.set(docRef, {
                requests,
                ip,
                endpoint,
                updatedAt: FieldValue.serverTimestamp()
            });

            return {
                allowed: true,
                remaining: limit - requests.length,
                resetAt
            };
        });

        return result;
    } catch (error) {
        console.error('[RateLimit] Error:', error);
        // On error, allow the request but log it
        return {
            allowed: true,
            remaining: limit,
            resetAt: Math.ceil(now / 1000) + 60
        };
    }
}

/**
 * Clean up old rate limit entries (call periodically)
 */
export async function cleanupRateLimits(): Promise<number> {
    const cutoff = Date.now() - (5 * RATE_WINDOW_MS); // Keep 5 minutes of data

    const snapshot = await adminDb.collection('rate_limits')
        .where('updatedAt', '<', new Date(cutoff))
        .limit(100)
        .get();

    const batch = adminDb.batch();
    snapshot.docs.forEach(doc => batch.delete(doc.ref));
    await batch.commit();

    return snapshot.size;
}
