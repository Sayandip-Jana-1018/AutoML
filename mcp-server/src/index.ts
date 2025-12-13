/**
 * MLForge MCP Server
 * Real-time collaboration server using Yjs and WebSockets
 */

import 'dotenv/config';
import express, { Request, Response } from 'express';
import cors from 'cors';
import http from 'http';
import { WebSocketServer } from 'ws';
import { setupYjsServer } from './ws-server';
import { initFirebase } from './persistence';

const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';

// Initialize Express
const app = express();
app.use(cors({ origin: CORS_ORIGIN, credentials: true }));
app.use(express.json());

// Health check
app.get('/health', (_req: Request, res: Response) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});

// Session management endpoints
app.post('/session/create', async (req: Request, res: Response) => {
    try {
        const { projectId, userId } = req.body;

        if (!projectId || !userId) {
            return res.status(400).json({ error: 'Missing projectId or userId' });
        }

        // Generate session ID
        const sessionId = `session_${projectId}_${Date.now()}`;

        res.json({
            sessionId,
            wsUrl: `ws://localhost:${PORT}/ws/${sessionId}`,
            projectId,
            createdAt: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to create session';
        console.error('[Session Create] Error:', error);
        res.status(500).json({ error: message });
    }
});

app.post('/session/join', async (req: Request, res: Response) => {
    try {
        const { sessionId, userId, role } = req.body;

        if (!sessionId || !userId) {
            return res.status(400).json({ error: 'Missing sessionId or userId' });
        }

        res.json({
            sessionId,
            wsUrl: `ws://localhost:${PORT}/ws/${sessionId}`,
            role: role || 'view',
            joinedAt: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to join session';
        console.error('[Session Join] Error:', error);
        res.status(500).json({ error: message });
    }
});

app.get('/session/:id/status', async (req: Request, res: Response) => {
    try {
        const { id } = req.params;

        res.json({
            sessionId: id,
            status: 'active',
            participants: [],
            createdAt: new Date().toISOString()
        });
    } catch (error: unknown) {
        const message = error instanceof Error ? error.message : 'Failed to get status';
        console.error('[Session Status] Error:', error);
        res.status(500).json({ error: message });
    }
});

// Create HTTP server
const server = http.createServer(app);

// Create WebSocket server (no path restriction - handled manually in ws-server.ts)
const wss = new WebSocketServer({ noServer: true });

// Handle WebSocket upgrade manually to support /ws/{docName} paths
server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);

    // Only accept connections to /ws or /ws/*
    if (url.pathname.startsWith('/ws')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    } else {
        socket.destroy();
    }
});

// Initialize Firebase for persistence
initFirebase().then(() => {
    console.log('[MCP] Firebase initialized');
}).catch((err: Error) => {
    console.warn('[MCP] Firebase init failed (persistence disabled):', err.message);
});

// Setup Yjs WebSocket handling
setupYjsServer(wss);

// Start server
server.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════════════════════╗
║              MLForge MCP Server v1.0.0                    ║
╠═══════════════════════════════════════════════════════════╣
║  HTTP:  http://localhost:${PORT}                            ║
║  WS:    ws://localhost:${PORT}/ws                           ║
╚═══════════════════════════════════════════════════════════╝
    `);
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n[MCP] Shutting down...');
    wss.close();
    server.close();
    process.exit(0);
});
