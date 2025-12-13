"use strict";
/**
 * MLForge MCP Server
 * Real-time collaboration server using Yjs and WebSockets
 */
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
require("dotenv/config");
const express_1 = __importDefault(require("express"));
const cors_1 = __importDefault(require("cors"));
const http_1 = __importDefault(require("http"));
const ws_1 = require("ws");
const ws_server_1 = require("./ws-server");
const persistence_1 = require("./persistence");
const PORT = parseInt(process.env.PORT || '4000', 10);
const CORS_ORIGIN = process.env.CORS_ORIGIN || 'http://localhost:3000';
// Initialize Express
const app = (0, express_1.default)();
app.use((0, cors_1.default)({ origin: CORS_ORIGIN, credentials: true }));
app.use(express_1.default.json());
// Health check
app.get('/health', (_req, res) => {
    res.json({
        status: 'healthy',
        timestamp: new Date().toISOString(),
        version: '1.0.0'
    });
});
// Session management endpoints
app.post('/session/create', async (req, res) => {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to create session';
        console.error('[Session Create] Error:', error);
        res.status(500).json({ error: message });
    }
});
app.post('/session/join', async (req, res) => {
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
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to join session';
        console.error('[Session Join] Error:', error);
        res.status(500).json({ error: message });
    }
});
app.get('/session/:id/status', async (req, res) => {
    try {
        const { id } = req.params;
        res.json({
            sessionId: id,
            status: 'active',
            participants: [],
            createdAt: new Date().toISOString()
        });
    }
    catch (error) {
        const message = error instanceof Error ? error.message : 'Failed to get status';
        console.error('[Session Status] Error:', error);
        res.status(500).json({ error: message });
    }
});
// Create HTTP server
const server = http_1.default.createServer(app);
// Create WebSocket server (no path restriction - handled manually in ws-server.ts)
const wss = new ws_1.WebSocketServer({ noServer: true });
// Handle WebSocket upgrade manually to support /ws/{docName} paths
server.on('upgrade', (request, socket, head) => {
    const url = new URL(request.url || '', `http://${request.headers.host}`);
    // Only accept connections to /ws or /ws/*
    if (url.pathname.startsWith('/ws')) {
        wss.handleUpgrade(request, socket, head, (ws) => {
            wss.emit('connection', ws, request);
        });
    }
    else {
        socket.destroy();
    }
});
// Initialize Firebase for persistence
(0, persistence_1.initFirebase)().then(() => {
    console.log('[MCP] Firebase initialized');
}).catch((err) => {
    console.warn('[MCP] Firebase init failed (persistence disabled):', err.message);
});
// Setup Yjs WebSocket handling
(0, ws_server_1.setupYjsServer)(wss);
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
//# sourceMappingURL=index.js.map