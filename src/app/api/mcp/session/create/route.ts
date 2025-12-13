import { NextRequest, NextResponse } from 'next/server';
import { adminAuth } from '@/lib/firebase-admin';
import jwt from 'jsonwebtoken';

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

        // Generate short-lived MCP token (5 minutes)
        const mcpToken = jwt.sign(
            {
                userId,
                userEmail,
                projectId,
                exp: Math.floor(Date.now() / 1000) + 300, // 5 minutes
            },
            MCP_JWT_SECRET
        );

        // Create session on MCP server
        const sessionRes = await fetch(`${MCP_SERVER_URL}/session/create`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                projectId,
                userId,
                userEmail,
                initialScript,
            }),
        });

        if (!sessionRes.ok) {
            const errorData = await sessionRes.json().catch(() => ({}));
            throw new Error(errorData.error || 'Failed to create MCP session');
        }

        const sessionData = await sessionRes.json();

        return NextResponse.json({
            sessionId: sessionData.sessionId,
            wsUrl: sessionData.wsUrl || `ws://localhost:4000/ws/${projectId}`,
            token: mcpToken,
            projectId,
            expiresIn: 300,
        });
    } catch (error: any) {
        console.error('[MCP Session Create] Error:', error);
        return NextResponse.json(
            { error: error.message || 'Failed to create session' },
            { status: 500 }
        );
    }
}
