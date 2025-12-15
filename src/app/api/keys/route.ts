
import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/api-keys';

export const runtime = 'nodejs';

/**
 * GET /api/keys
 * List all API keys for the authenticated user
 */
export async function GET(req: NextRequest) {
    try {
        // Authenticate user via Firebase token
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized: Missing Bearer token' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1]?.trim();
        if (!token) {
            return NextResponse.json({ error: 'Unauthorized: Empty token' }, { status: 401 });
        }

        let decodedToken;
        try {
            decodedToken = await adminAuth.verifyIdToken(token);
        } catch (authError: any) {
            console.error('Auth verification failed:', authError);
            return NextResponse.json({ error: 'Unauthorized: Invalid token', details: authError.message }, { status: 401 });
        }

        const userId = decodedToken.uid;

        // List keys
        const keys = await listApiKeys(userId);

        return NextResponse.json({ keys: keys || [] });

    } catch (error: any) {
        // Safe logging to avoid crashes if error object is weird
        console.error('[API Keys List] Critical Error:', String(error));
        if (error instanceof Error) {
            console.error('[API Keys List] Stack:', error.stack);
        }

        // Safely handle non-standard error objects
        const errorMessage = (error && typeof error === 'object' && error.message) ? error.message : 'Internal Server Error';

        return NextResponse.json({
            error: errorMessage,
            details: 'An unexpected error occurred'
        }, { status: 500 });
    }
}

/**
 * POST /api/keys
 * Create a new API key
 */
export async function POST(req: NextRequest) {
    try {
        // Authenticate
        const authHeader = req.headers.get('authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;

        const body = await req.json();
        const { name } = body;

        if (!name) {
            return NextResponse.json({ error: 'Key name is required' }, { status: 400 });
        }

        // Create key (expires in 365 days by default)
        const result = await createApiKey(userId, name, 365);

        return NextResponse.json({
            success: true,
            key: result.apiKey,
            keyId: result.keyId
        });

    } catch (error: any) {
        console.error('[API Keys Create] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}

/**
 * DELETE /api/keys?id={keyId}
 * Revoke an API key
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

        const { searchParams } = new URL(req.url);
        const keyId = searchParams.get('id');

        if (!keyId) {
            return NextResponse.json({ error: 'Key ID is required' }, { status: 400 });
        }

        const success = await revokeApiKey(keyId, userId);

        if (!success) {
            return NextResponse.json({ error: 'Failed to revoke key or access denied' }, { status: 403 });
        }

        return NextResponse.json({ success: true });

    } catch (error: any) {
        console.error('[API Keys Revoke] Error:', error);
        return NextResponse.json({ error: error.message }, { status: 500 });
    }
}
