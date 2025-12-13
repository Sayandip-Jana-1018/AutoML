"use strict";
/**
 * Authentication utilities for MCP server
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.verifyFirebaseToken = verifyFirebaseToken;
exports.generateSessionToken = generateSessionToken;
exports.verifySessionToken = verifySessionToken;
exports.extractTokenFromRequest = extractTokenFromRequest;
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const firebase_admin_1 = __importDefault(require("firebase-admin"));
const JWT_SECRET = process.env.JWT_SECRET || 'mlforge-mcp-secret-dev-only';
/**
 * Verify Firebase ID token
 */
async function verifyFirebaseToken(idToken) {
    try {
        const decodedToken = await firebase_admin_1.default.auth().verifyIdToken(idToken);
        return {
            uid: decodedToken.uid,
            email: decodedToken.email
        };
    }
    catch (error) {
        console.error('[Auth] Firebase token verification failed:', error);
        return null;
    }
}
/**
 * Generate MCP session token
 */
function generateSessionToken(payload) {
    return jsonwebtoken_1.default.sign(payload, JWT_SECRET, {
        expiresIn: '24h'
    });
}
/**
 * Verify MCP session token
 */
function verifySessionToken(token) {
    try {
        const decoded = jsonwebtoken_1.default.verify(token, JWT_SECRET);
        return decoded;
    }
    catch (error) {
        console.error('[Auth] Session token verification failed:', error);
        return null;
    }
}
/**
 * Extract token from WebSocket request
 */
function extractTokenFromRequest(request) {
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
//# sourceMappingURL=auth.js.map