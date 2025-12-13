/**
 * MCP Client for VS Code Extension with Real-Time Yjs Sync
 * Handles WebSocket connection and document synchronization
 */

import WebSocket from 'ws';
import { EventEmitter } from 'events';
import * as Y from 'yjs';
import * as encoding from 'lib0/encoding';
import * as decoding from 'lib0/decoding';
import * as syncProtocol from 'y-protocols/sync';
import * as awarenessProtocol from 'y-protocols/awareness';

export interface Participant {
    id: number;
    name: string;
    color: string;
    cursor?: { line: number; column: number };
}

// Message types matching y-websocket protocol
const messageSync = 0;
const messageAwareness = 1;

export class MCPClient extends EventEmitter {
    private ws: WebSocket | null = null;
    private _isConnected = false;
    private _projectId: string;
    private _serverUrl: string;
    private _token?: string;
    private _participants: Participant[] = [];
    private reconnectAttempts = 0;
    private maxReconnectAttempts = 5;

    // Yjs document for collaboration
    public ydoc: Y.Doc;
    public awareness: awarenessProtocol.Awareness;
    private synced = false;

    constructor(serverUrl: string, projectId: string, token?: string) {
        super();
        this._serverUrl = serverUrl;
        this._projectId = projectId;
        this._token = token;

        // Initialize Yjs document
        this.ydoc = new Y.Doc();
        this.awareness = new awarenessProtocol.Awareness(this.ydoc);

        // Listen for local document changes
        this.ydoc.on('update', (update: Uint8Array, origin: any) => {
            if (origin !== this) {
                // Broadcast local changes to server
                this.broadcastUpdate(update);
            }
        });

        // Listen for awareness changes
        this.awareness.on('update', ({ added, updated, removed }: any) => {
            const changedClients = added.concat(updated, removed);
            this.broadcastAwareness(changedClients);
        });
    }

    get isConnected(): boolean {
        return this._isConnected;
    }

    get projectId(): string {
        return this._projectId;
    }

    get participants(): Participant[] {
        return this._participants;
    }

    get token(): string | undefined {
        return this._token;
    }

    // Get the Yjs Text for code content - MUST match Studio's path
    get codeText(): Y.Text {
        return this.ydoc.getText('content');
    }

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this._serverUrl.replace('http', 'ws')}/ws/${this._projectId}`;

            try {
                this.ws = new WebSocket(wsUrl);

                this.ws.on('open', () => {
                    console.log('[MCP Client] Connected to:', wsUrl);
                    this._isConnected = true;
                    this.reconnectAttempts = 0;

                    // Send sync step 1 to request state from server
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageSync);
                    syncProtocol.writeSyncStep1(encoder, this.ydoc);
                    this.sendRaw(encoding.toUint8Array(encoder));

                    // Set awareness local state
                    this.awareness.setLocalState({
                        user: {
                            name: 'VS Code User',
                            color: '#3b82f6'
                        }
                    });

                    this.emit('connected');
                    resolve();
                });

                this.ws.on('message', (data: Buffer) => {
                    this.handleMessage(new Uint8Array(data));
                });

                this.ws.on('close', () => {
                    console.log('[MCP Client] Disconnected');
                    this._isConnected = false;
                    this.synced = false;
                    this.emit('disconnected');
                    this.attemptReconnect();
                });

                this.ws.on('error', (error) => {
                    console.error('[MCP Client] Error:', error);
                    if (!this._isConnected) {
                        reject(error);
                    }
                    this.emit('error', error);
                });

            } catch (error) {
                reject(error);
            }
        });
    }

    disconnect(): void {
        // Remove awareness before disconnecting
        awarenessProtocol.removeAwarenessStates(
            this.awareness,
            [this.ydoc.clientID],
            this
        );

        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._isConnected = false;
        this._participants = [];
        this.synced = false;
    }

    private handleMessage(data: Uint8Array): void {
        try {
            const decoder = decoding.createDecoder(data);
            const messageType = decoding.readVarUint(decoder);

            switch (messageType) {
                case messageSync:
                    // Handle sync message
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageSync);
                    const syncMessageType = syncProtocol.readSyncMessage(
                        decoder,
                        encoder,
                        this.ydoc,
                        this
                    );

                    // Send response if needed
                    if (encoding.length(encoder) > 1) {
                        this.sendRaw(encoding.toUint8Array(encoder));
                    }

                    // Check if initial sync is complete
                    if (syncMessageType === syncProtocol.messageYjsSyncStep2 && !this.synced) {
                        this.synced = true;
                        this.emit('synced');
                        console.log('[MCP Client] Document synced');
                    }
                    break;

                case messageAwareness:
                    // Handle awareness update
                    awarenessProtocol.applyAwarenessUpdate(
                        this.awareness,
                        decoding.readVarUint8Array(decoder),
                        this
                    );
                    // Update participants list
                    this.updateParticipants();
                    break;

                default:
                    console.warn('[MCP Client] Unknown message type:', messageType);
            }
        } catch (error) {
            console.error('[MCP Client] Message parse error:', error);
        }
    }

    private updateParticipants(): void {
        const states = this.awareness.getStates();
        this._participants = [];

        states.forEach((state: any, clientID: number) => {
            if (state.user && clientID !== this.ydoc.clientID) {
                this._participants.push({
                    id: clientID,
                    name: state.user.name || 'Anonymous',
                    color: state.user.color || '#888888',
                    cursor: state.cursor
                });
            }
        });

        this.emit('participants', this._participants);
    }

    private broadcastUpdate(update: Uint8Array): void {
        if (!this._isConnected) return;

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        this.sendRaw(encoding.toUint8Array(encoder));
    }

    private broadcastAwareness(changedClients: number[]): void {
        if (!this._isConnected) return;

        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(
            encoder,
            awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients)
        );
        this.sendRaw(encoding.toUint8Array(encoder));
    }

    private sendRaw(data: Uint8Array): void {
        if (this.ws && this._isConnected && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(data);
        }
    }

    // Update cursor position in awareness
    updateCursor(line: number, column: number): void {
        const currentState = this.awareness.getLocalState() || {};
        this.awareness.setLocalState({
            ...currentState,
            cursor: { line, column }
        });
    }

    // Insert text at position - this will sync via Yjs
    insertText(index: number, text: string): void {
        this.codeText.insert(index, text);
    }

    // Delete text at position
    deleteText(index: number, length: number): void {
        this.codeText.delete(index, length);
    }

    // Get current code content
    getCode(): string {
        return this.codeText.toString();
    }

    // Set entire code content (replaces existing)
    setCode(content: string): void {
        this.ydoc.transact(() => {
            this.codeText.delete(0, this.codeText.length);
            this.codeText.insert(0, content);
        });
    }

    private attemptReconnect(): void {
        if (this.reconnectAttempts >= this.maxReconnectAttempts) {
            console.log('[MCP Client] Max reconnect attempts reached');
            return;
        }

        this.reconnectAttempts++;
        const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

        console.log(`[MCP Client] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);

        setTimeout(() => {
            if (!this._isConnected) {
                this.connect().catch(console.error);
            }
        }, delay);
    }
}
