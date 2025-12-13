"use strict";
/**
 * Yjs WebSocket Server
 * Handles real-time document synchronization using Yjs CRDT
 */
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.setupYjsServer = setupYjsServer;
const ws_1 = require("ws");
const Y = __importStar(require("yjs"));
const syncProtocol = __importStar(require("y-protocols/sync"));
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
const encoding = __importStar(require("lib0/encoding"));
const decoding = __importStar(require("lib0/decoding"));
const persistence_1 = require("./persistence");
// Message types
const messageSync = 0;
const messageAwareness = 1;
// Document storage
const docs = new Map();
const awarenessMap = new Map();
/**
 * Get or create a Yjs document for a room
 */
async function getYDoc(docName) {
    let doc = docs.get(docName);
    if (!doc) {
        doc = new Y.Doc();
        // Try to load existing state from Firestore
        try {
            const snapshot = await (0, persistence_1.loadSnapshot)(docName);
            if (snapshot) {
                Y.applyUpdate(doc, snapshot);
                console.log(`[Yjs] Loaded snapshot for ${docName}`);
            }
        }
        catch (err) {
            console.warn(`[Yjs] Failed to load snapshot for ${docName}:`, err);
        }
        // Set up auto-save with captured doc reference
        const docToSave = doc;
        doc.on('update', debounce(async () => {
            const state = Y.encodeStateAsUpdate(docToSave);
            await (0, persistence_1.saveSnapshot)(docName, state);
        }, 5000));
        docs.set(docName, doc);
    }
    return doc;
}
/**
 * Get or create awareness for a document
 */
function getAwareness(docName, doc) {
    let awareness = awarenessMap.get(docName);
    if (!awareness) {
        awareness = new awarenessProtocol.Awareness(doc);
        awarenessMap.set(docName, awareness);
        const awarenessRef = awareness;
        // Cleanup when awareness changes
        awareness.on('update', ({ added, updated, removed }) => {
            const clients = getClientsByDoc(docName);
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageAwareness);
            encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(awarenessRef, [...added, ...updated, ...removed]));
            const message = encoding.toUint8Array(encoder);
            clients.forEach(client => {
                if (client.readyState === ws_1.WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });
    }
    return awareness;
}
// Track connected clients per document
const clientsByDoc = new Map();
function getClientsByDoc(docName) {
    let clients = clientsByDoc.get(docName);
    if (!clients) {
        clients = new Set();
        clientsByDoc.set(docName, clients);
    }
    return clients;
}
/**
 * Handle incoming WebSocket message
 */
function handleMessage(ws, doc, awareness, message) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);
    switch (messageType) {
        case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, doc, null);
            if (encoding.length(encoder) > 1) {
                ws.send(encoding.toUint8Array(encoder));
            }
            // Broadcast updates to other clients
            if (syncMessageType === syncProtocol.messageYjsUpdate) {
                const clients = getClientsByDoc(ws.docName);
                clients.forEach(client => {
                    if (client !== ws && client.readyState === ws_1.WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
            break;
        }
        case messageAwareness: {
            awarenessProtocol.applyAwarenessUpdate(awareness, decoding.readVarUint8Array(decoder), ws);
            break;
        }
    }
}
/**
 * Setup Yjs WebSocket server
 */
function setupYjsServer(wss) {
    console.log('[Yjs] WebSocket server initialized');
    wss.on('connection', async (ws, request) => {
        // Extract doc name from URL (e.g., /ws/project_123)
        const url = new URL(request.url || '', `http://${request.headers.host}`);
        const pathParts = url.pathname.split('/').filter(Boolean);
        const docName = pathParts[pathParts.length - 1] || 'default';
        ws.docName = docName;
        ws.isAlive = true;
        console.log(`[Yjs] Client connected to document: ${docName}`);
        // Get or create document
        const doc = await getYDoc(docName);
        const awareness = getAwareness(docName, doc);
        // Add to clients list
        getClientsByDoc(docName).add(ws);
        // Send initial sync
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeSyncStep1(encoder, doc);
        ws.send(encoding.toUint8Array(encoder));
        // Send current awareness
        const awarenessStates = awareness.getStates();
        if (awarenessStates.size > 0) {
            const awarenessEncoder = encoding.createEncoder();
            encoding.writeVarUint(awarenessEncoder, messageAwareness);
            encoding.writeVarUint8Array(awarenessEncoder, awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys())));
            ws.send(encoding.toUint8Array(awarenessEncoder));
        }
        // Handle messages
        ws.on('message', (data) => {
            const buffer = data instanceof Buffer ? data : Buffer.from(data);
            handleMessage(ws, doc, awareness, new Uint8Array(buffer));
        });
        // Handle pong
        ws.on('pong', () => {
            ws.isAlive = true;
        });
        // Handle disconnect
        ws.on('close', () => {
            console.log(`[Yjs] Client disconnected from: ${docName}`);
            getClientsByDoc(docName).delete(ws);
            // Clean up awareness
            awarenessProtocol.removeAwarenessStates(awareness, [doc.clientID], null);
            // Clean up empty docs after delay
            if (getClientsByDoc(docName).size === 0) {
                setTimeout(() => {
                    if (getClientsByDoc(docName).size === 0) {
                        docs.delete(docName);
                        awarenessMap.delete(docName);
                        clientsByDoc.delete(docName);
                        console.log(`[Yjs] Cleaned up document: ${docName}`);
                    }
                }, 30000);
            }
        });
    });
    // Ping clients every 30 seconds
    const interval = setInterval(() => {
        wss.clients.forEach((ws) => {
            const client = ws;
            if (client.isAlive === false) {
                return client.terminate();
            }
            client.isAlive = false;
            client.ping();
        });
    }, 30000);
    wss.on('close', () => {
        clearInterval(interval);
    });
}
// Utility: Debounce function
function debounce(fn, wait) {
    let timeout = null;
    return ((...args) => {
        if (timeout)
            clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    });
}
//# sourceMappingURL=ws-server.js.map