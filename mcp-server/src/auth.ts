/**
 * Authentication utilities for MCP server
 */

import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

const JWT_SECRET = process.env.JWT_SECRET || 'mlforge-mcp-secret-dev-only';

interface TokenPayload {
    userId: string;
    email?: string;
    sessionId: string;
    role: 'view' | 'edit';
    iat?: number;
    exp?: number;
}

/**
 * Verify Firebase ID token
 */
export async function verifyFirebaseToken(idToken: string): Promise<{
    uid: string;
    email?: string;
} | null> {
    try {
        const decodedToken = await admin.auth().verifyIdToken(idToken);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email
        };
    } catch (error) {
        console.error('[Auth] Firebase token verification failed:', error);
        return null;
    }
}

/**
 * Generate MCP session token
 */
export function generateSessionToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string {
    return jwt.sign(payload, JWT_SECRET, {
        expiresIn: '24h'
    });
}

/**
 * Verify MCP session token
 */
export function verifySessionToken(token: string): TokenPayload | null {
    try {
        const decoded = jwt.verify(token, JWT_SECRET) as TokenPayload;
        return decoded;
    } catch (error) {
        console.error('[Auth] Session token verification failed:', error);
        return null;
    }
}

/**
 * Extract token from WebSocket request
 */
export function extractTokenFromRequest(request: { url?: string; headers: { [key: string]: string | string[] | undefined } }): string | null {
    // Check Authorization header
    const authHeader = request.headers['authorization'];
    if (typeof authHeader === 'string' && authHeader.startsWith('Bearer ')) {
        return authHeader.substring(7);
    }

    // Check query parameter
    if (request.url) {
        const url = new URL(request.url, 'http://localhost');
        const token = url.searchParams.get('token');
        if (token) {
            return token;
        }
    }

    return null;
}
