/**
 * Authentication utilities for MCP server
 */
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
export declare function verifyFirebaseToken(idToken: string): Promise<{
    uid: string;
    email?: string;
} | null>;
/**
 * Generate MCP session token
 */
export declare function generateSessionToken(payload: Omit<TokenPayload, 'iat' | 'exp'>): string;
/**
 * Verify MCP session token
 */
export declare function verifySessionToken(token: string): TokenPayload | null;
/**
 * Extract token from WebSocket request
 */
export declare function extractTokenFromRequest(request: {
    url?: string;
    headers: {
        [key: string]: string | string[] | undefined;
    };
}): string | null;
export {};
//# sourceMappingURL=auth.d.ts.map