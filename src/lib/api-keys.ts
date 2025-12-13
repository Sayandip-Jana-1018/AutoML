/**
 * API Keys Management
 * Handles creation, validation, and revocation of API keys
 * Keys are stored as HMAC-SHA256 hashes for security
 */

import { adminDb } from './firebase-admin';
import { FieldValue } from 'firebase-admin/firestore';
import crypto from 'crypto';

const API_KEY_PREFIX = 'mlf_'; // MLForge API key prefix
const HMAC_SECRET = process.env.API_KEY_HMAC_SECRET || 'mlforge-api-key-secret-change-in-production';

export interface ApiKey {
    id: string;
    userId: string;
    name: string;
    keyPrefix: string; // First 8 chars for identification
    keyHash: string;   // HMAC-SHA256 hash of full key
    lastUsed: Date | null;
    createdAt: Date;
    expiresAt: Date | null;
    isActive: boolean;
}

/**
 * Generate a new API key for a user
 */
export async function createApiKey(
    userId: string,
    name: string,
    expiresInDays?: number
): Promise<{ keyId: string; apiKey: string }> {
    // Generate random key
    const randomBytes = crypto.randomBytes(24).toString('base64url');
    const apiKey = `${API_KEY_PREFIX}${randomBytes}`;

    // Hash the key for storage
    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12); // Store prefix for identification

    // Calculate expiration
    const expiresAt = expiresInDays
        ? new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000)
        : null;

    // Store in Firestore
    const keyRef = await adminDb.collection('api_keys').add({
        userId,
        name,
        keyPrefix,
        keyHash,
        lastUsed: null,
        createdAt: FieldValue.serverTimestamp(),
        expiresAt,
        isActive: true
    });

    // Return the key (only time it's visible)
    return {
        keyId: keyRef.id,
        apiKey
    };
}

/**
 * Validate an API key and return associated user info
 */
export async function validateApiKey(apiKey: string): Promise<{
    valid: boolean;
    userId?: string;
    keyId?: string;
    error?: string;
}> {
    if (!apiKey || !apiKey.startsWith(API_KEY_PREFIX)) {
        return { valid: false, error: 'Invalid API key format' };
    }

    const keyHash = hashApiKey(apiKey);
    const keyPrefix = apiKey.substring(0, 12);

    // Find key by prefix first (optimization), then verify hash
    const snapshot = await adminDb.collection('api_keys')
        .where('keyPrefix', '==', keyPrefix)
        .where('isActive', '==', true)
        .limit(5)
        .get();

    for (const doc of snapshot.docs) {
        const data = doc.data();

        // Verify hash matches
        if (data.keyHash === keyHash) {
            // Check expiration
            if (data.expiresAt && data.expiresAt.toDate() < new Date()) {
                return { valid: false, error: 'API key has expired' };
            }

            // Update last used
            await doc.ref.update({
                lastUsed: FieldValue.serverTimestamp()
            });

            return {
                valid: true,
                userId: data.userId,
                keyId: doc.id
            };
        }
    }

    return { valid: false, error: 'Invalid API key' };
}

/**
 * Revoke an API key
 */
export async function revokeApiKey(keyId: string, userId: string): Promise<boolean> {
    const keyRef = adminDb.collection('api_keys').doc(keyId);
    const keyDoc = await keyRef.get();

    if (!keyDoc.exists) {
        return false;
    }

    const data = keyDoc.data();
    if (data?.userId !== userId) {
        return false; // Can only revoke own keys
    }

    await keyRef.update({
        isActive: false,
        revokedAt: FieldValue.serverTimestamp()
    });

    return true;
}

/**
 * List all API keys for a user (without revealing actual keys)
 */
export async function listApiKeys(userId: string): Promise<ApiKey[]> {
    const snapshot = await adminDb.collection('api_keys')
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();

    return snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data(),
        createdAt: doc.data().createdAt?.toDate(),
        expiresAt: doc.data().expiresAt?.toDate(),
        lastUsed: doc.data().lastUsed?.toDate()
    })) as ApiKey[];
}

/**
 * Hash an API key using HMAC-SHA256
 */
function hashApiKey(apiKey: string): string {
    return crypto
        .createHmac('sha256', HMAC_SECRET)
        .update(apiKey)
        .digest('hex');
}
