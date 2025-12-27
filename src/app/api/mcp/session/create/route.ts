import { NextRequest, NextResponse } from 'next/server';
import { adminAuth, adminDb } from '@/lib/firebase-admin';
import jwt from 'jsonwebtoken';
import { FieldValue } from 'firebase-admin/firestore';

const MCP_SERVER_URL = process.env.MCP_SERVER_URL || 'http://localhost:4000';
const MCP_JWT_SECRET = process.env.MCP_JWT_SECRET || 'mlforge-mcp-secret-dev';

export async function POST(req: NextRequest) {
    try {
        // Verify Firebase auth
        const authHeader = req.headers.get('Authorization');
        if (!authHeader?.startsWith('Bearer ')) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const token = authHeader.split('Bearer ')[1];
        const decodedToken = await adminAuth.verifyIdToken(token);
        const userId = decodedToken.uid;
        const userEmail = decodedToken.email;

        const { projectId, initialScript } = await req.json();

        if (!projectId) {
            return NextResponse.json({ error: 'Missing projectId' }, { status: 400 });
        }

        // Generate short-lived MCP token (30 minutes for better usability)
        const mcpToken = jwt.sign(
            {
                userId,
                userEmail,
                projectId,
                exp: Math.floor(Date.now() / 1000) + 1800, // 30 minutes
            },
            MCP_JWT_SECRET
        );

        // Store session in Firestore (HTTP-only mode, no WebSocket needed)
        await adminDb.collection('mcp_sessions').doc(projectId).set({
            projectId,
            userId,
            userEmail,
            token: mcpToken,
            createdAt: FieldValue.serverTimestamp(),
            expiresAt: new Date(Date.now() + 1800 * 1000), // 30 minutes
            mode: 'http-only',
        });

        console.log(`[MCP Session] Created HTTP-only session for project ${projectId}`);

        // Try to connect to WebSocket MCP server (optional, for real-time sync)
        let wsUrl = null;
        let sessionId = `session-${projectId}-${Date.now()}`;

        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 2000);

            const sessionRes = await fetch(`${MCP_SERVER_URL}/session/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    userId,
                    userEmail,
                    initialScript,
                }),
                signal: controller.signal,
            });

            clearTimeout(timeout);

            if (sessionRes.ok) {
                const sessionData = await sessionRes.json();
                wsUrl = sessionData.wsUrl || `ws://localhost:4000/ws/${projectId}`;
                sessionId = sessionData.sessionId || sessionId;
                console.log(`[MCP Session] WebSocket server connected: ${wsUrl}`);
            }
        } catch (wsError) {
            // WebSocket server not available - that's fine, HTTP sync still works
            console.log('[MCP Session] WebSocket server not available, using HTTP-only sync');
        }

        return NextResponse.json({
            sessionId,
            wsUrl: wsUrl || `ws://localhost:4000/ws/${projectId}`, // VS Code expects this, but HTTP sync works without it
            token: mcpToken,
            projectId,
            expiresIn: 1800,
            mode: wsUrl ? 'websocket' : 'http-only',
        });
    } catch (error: any) {
        console.error('[MCP Session Create] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create session' },
            { status: 500 }
        );
    }
}
