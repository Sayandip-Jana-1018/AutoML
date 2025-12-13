/**
 * Yjs WebSocket Server
 * Handles real-time document synchronization using Yjs CRDT
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { IncomingMessage } from 'http';
import * as Y from 'yjs';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import { saveSnapshot, loadSnapshot } from './persistence';

// Message types
const messageSync = 0;
const messageAwareness = 1;

// Document storage
const docs = new Map<string, Y.Doc>();
const awarenessMap = new Map<string, awarenessProtocol.Awareness>();

interface WSClient extends WebSocket {
    docName?: string;
    userId?: string;
    userEmail?: string;
    isAlive?: boolean;
}

/**
 * Get or create a Yjs document for a room
 */
async function getYDoc(docName: string): Promise<Y.Doc> {
    let doc = docs.get(docName);

    if (!doc) {
        doc = new Y.Doc();

        // Try to load existing state from Firestore
        try {
            const snapshot = await loadSnapshot(docName);
            if (snapshot) {
                Y.applyUpdate(doc, snapshot);
                console.log(`[Yjs] Loaded snapshot for ${docName}`);
            }
        } catch (err) {
            console.warn(`[Yjs] Failed to load snapshot for ${docName}:`, err);
        }

        // Set up auto-save with captured doc reference
        const docToSave = doc;
        doc.on('update', debounce(async () => {
            const state = Y.encodeStateAsUpdate(docToSave);
            await saveSnapshot(docName, state);
        }, 5000));

        docs.set(docName, doc);
    }

    return doc;
}

/**
 * Get or create awareness for a document
 */
function getAwareness(docName: string, doc: Y.Doc): awarenessProtocol.Awareness {
    let awareness = awarenessMap.get(docName);

    if (!awareness) {
        awareness = new awarenessProtocol.Awareness(doc);
        awarenessMap.set(docName, awareness);

        const awarenessRef = awareness;
        // Cleanup when awareness changes
        awareness.on('update', ({ added, updated, removed }: { added: number[]; updated: number[]; removed: number[] }) => {
            const clients = getClientsByDoc(docName);
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageAwareness);
            encoding.writeVarUint8Array(
                encoder,
                awarenessProtocol.encodeAwarenessUpdate(awarenessRef, [...added, ...updated, ...removed])
            );
            const message = encoding.toUint8Array(encoder);

            clients.forEach(client => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(message);
                }
            });
        });
    }

    return awareness;
}

// Track connected clients per document
const clientsByDoc = new Map<string, Set<WSClient>>();

function getClientsByDoc(docName: string): Set<WSClient> {
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
function handleMessage(ws: WSClient, doc: Y.Doc, awareness: awarenessProtocol.Awareness, message: Uint8Array) {
    const decoder = decoding.createDecoder(message);
    const messageType = decoding.readVarUint(decoder);

    switch (messageType) {
        case messageSync: {
            const encoder = encoding.createEncoder();
            encoding.writeVarUint(encoder, messageSync);
            const syncMessageType = syncProtocol.readSyncMessage(
                decoder,
                encoder,
                doc,
                null
            );

            if (encoding.length(encoder) > 1) {
                ws.send(encoding.toUint8Array(encoder));
            }

            // Broadcast updates to other clients
            if (syncMessageType === syncProtocol.messageYjsUpdate) {
                const clients = getClientsByDoc(ws.docName!);
                clients.forEach(client => {
                    if (client !== ws && client.readyState === WebSocket.OPEN) {
                        client.send(message);
                    }
                });
            }
            break;
        }
        case messageAwareness: {
            awarenessProtocol.applyAwarenessUpdate(
                awareness,
                decoding.readVarUint8Array(decoder),
                ws
            );
            break;
        }
    }
}

/**
 * Setup Yjs WebSocket server
 */
export function setupYjsServer(wss: WebSocketServer) {
    console.log('[Yjs] WebSocket server initialized');

    wss.on('connection', async (ws: WSClient, request: IncomingMessage) => {
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
            encoding.writeVarUint8Array(
                awarenessEncoder,
                awarenessProtocol.encodeAwarenessUpdate(awareness, Array.from(awarenessStates.keys()))
            );
            ws.send(encoding.toUint8Array(awarenessEncoder));
        }

        // Handle messages
        ws.on('message', (data: RawData) => {
            const buffer = data instanceof Buffer ? data : Buffer.from(data as ArrayBuffer);
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
            const client = ws as WSClient;
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
function debounce<T extends (...args: unknown[]) => unknown>(fn: T, wait: number): T {
    let timeout: NodeJS.Timeout | null = null;
    return ((...args: unknown[]) => {
        if (timeout) clearTimeout(timeout);
        timeout = setTimeout(() => fn(...args), wait);
    }) as T;
}
