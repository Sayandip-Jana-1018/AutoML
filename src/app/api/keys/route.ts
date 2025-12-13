/**
 * API Keys Management Endpoints
 * POST /api/keys - Create new API key
 * GET /api/keys - List user's keys
 * DELETE /api/keys - Revoke a key
 */

import { NextRequest, NextResponse } from 'next/server';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';
import { adminAuth } from '@/lib/firebase-admin';

export const runtime = 'nodejs';

/**
 * POST /api/keys - Create a new API key
 */
export async function POST(req: NextRequest) {
    try {
        // Verify Firebase auth
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { name, expiresInDays } = await req.json();

        if (!name) {
            return NextResponse.json({ error: 'Name is required' }, { status: 400 });
        }

        const result = await createApiKey(userId, name, expiresInDays);

        return NextResponse.json({
            keyId: result.keyId,
            apiKey: result.apiKey, // Only returned once!
            message: 'API key created. Save this key securely - it will not be shown again.'
        });

    } catch (error: any) {
        console.error('[API Keys] Create error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * GET /api/keys - List user's API keys
 */
export async function GET(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const keys = await listApiKeys(userId);

        // Return keys without the hash (for security)
        const safeKeys = keys.map(k => ({
            id: k.id,
            name: k.name,
            keyPrefix: k.keyPrefix,
            lastUsed: k.lastUsed,
            createdAt: k.createdAt,
            expiresAt: k.expiresAt,
            isActive: k.isActive
        }));

        return NextResponse.json({ keys: safeKeys });

    } catch (error: any) {
        console.error('[API Keys] List error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/keys - Revoke an API key
 */
export async function DELETE(req: NextRequest) {
    try {
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const { keyId } = await req.json();

        if (!keyId) {
            return NextResponse.json({ error: 'keyId is required' }, { status: 400 });
        }

        const success = await revokeApiKey(keyId, userId);

        if (!success) {
            return NextResponse.json({ error: 'Key not found or not owned by you' }, { status: 404 });
        }

        return NextResponse.json({ success: true, message: 'API key revoked' });

    } catch (error: any) {
        console.error('[API Keys] Revoke error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
