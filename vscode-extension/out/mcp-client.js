"use strict";
/**
 * MCP Client for VS Code Extension with Real-Time Yjs Sync
 * Handles WebSocket connection and document synchronization
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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.MCPClient = void 0;
const ws_1 = __importDefault(require("ws"));
const events_1 = require("events");
const Y = __importStar(require("yjs"));
const encoding = __importStar(require("lib0/encoding"));
const decoding = __importStar(require("lib0/decoding"));
const syncProtocol = __importStar(require("y-protocols/sync"));
const awarenessProtocol = __importStar(require("y-protocols/awareness"));
// Message types matching y-websocket protocol
const messageSync = 0;
const messageAwareness = 1;
class MCPClient extends events_1.EventEmitter {
    ws = null;
    _isConnected = false;
    _projectId;
    _serverUrl;
    _token;
    _participants = [];
    reconnectAttempts = 0;
    maxReconnectAttempts = 5;
    // Yjs document for collaboration
    ydoc;
    awareness;
    synced = false;
    constructor(serverUrl, projectId, token) {
        super();
        this._serverUrl = serverUrl;
        this._projectId = projectId;
        this._token = token;
        // Initialize Yjs document
        this.ydoc = new Y.Doc();
        this.awareness = new awarenessProtocol.Awareness(this.ydoc);
        // Listen for local document changes
        this.ydoc.on('update', (update, origin) => {
            if (origin !== this) {
                // Broadcast local changes to server
                this.broadcastUpdate(update);
            }
        });
        // Listen for awareness changes
        this.awareness.on('update', ({ added, updated, removed }) => {
            const changedClients = added.concat(updated, removed);
            this.broadcastAwareness(changedClients);
        });
    }
    get isConnected() {
        return this._isConnected;
    }
    get projectId() {
        return this._projectId;
    }
    get participants() {
        return this._participants;
    }
    get token() {
        return this._token;
    }
    // Get the Yjs Text for code content - MUST match Studio's path
    get codeText() {
        return this.ydoc.getText('content');
    }
    async connect() {
        return new Promise((resolve, reject) => {
            const wsUrl = `${this._serverUrl.replace('http', 'ws')}/ws/${this._projectId}`;
            try {
                this.ws = new ws_1.default(wsUrl);
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
                this.ws.on('message', (data) => {
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
            }
            catch (error) {
                reject(error);
            }
        });
    }
    disconnect() {
        // Remove awareness before disconnecting
        awarenessProtocol.removeAwarenessStates(this.awareness, [this.ydoc.clientID], this);
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
        this._isConnected = false;
        this._participants = [];
        this.synced = false;
    }
    handleMessage(data) {
        try {
            const decoder = decoding.createDecoder(data);
            const messageType = decoding.readVarUint(decoder);
            switch (messageType) {
                case messageSync:
                    // Handle sync message
                    const encoder = encoding.createEncoder();
                    encoding.writeVarUint(encoder, messageSync);
                    const syncMessageType = syncProtocol.readSyncMessage(decoder, encoder, this.ydoc, this);
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
                    awarenessProtocol.applyAwarenessUpdate(this.awareness, decoding.readVarUint8Array(decoder), this);
                    // Update participants list
                    this.updateParticipants();
                    break;
                default:
                    console.warn('[MCP Client] Unknown message type:', messageType);
            }
        }
        catch (error) {
            console.error('[MCP Client] Message parse error:', error);
        }
    }
    updateParticipants() {
        const states = this.awareness.getStates();
        this._participants = [];
        states.forEach((state, clientID) => {
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
    broadcastUpdate(update) {
        if (!this._isConnected)
            return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageSync);
        syncProtocol.writeUpdate(encoder, update);
        this.sendRaw(encoding.toUint8Array(encoder));
    }
    broadcastAwareness(changedClients) {
        if (!this._isConnected)
            return;
        const encoder = encoding.createEncoder();
        encoding.writeVarUint(encoder, messageAwareness);
        encoding.writeVarUint8Array(encoder, awarenessProtocol.encodeAwarenessUpdate(this.awareness, changedClients));
        this.sendRaw(encoding.toUint8Array(encoder));
    }
    sendRaw(data) {
        if (this.ws && this._isConnected && this.ws.readyState === ws_1.default.OPEN) {
            this.ws.send(data);
        }
    }
    // Update cursor position in awareness
    updateCursor(line, column) {
        const currentState = this.awareness.getLocalState() || {};
        this.awareness.setLocalState({
            ...currentState,
            cursor: { line, column }
        });
    }
    // Insert text at position - this will sync via Yjs
    insertText(index, text) {
        this.codeText.insert(index, text);
    }
    // Delete text at position
    deleteText(index, length) {
        this.codeText.delete(index, length);
    }
    // Get current code content
    getCode() {
        return this.codeText.toString();
    }
    // Set entire code content (replaces existing)
    setCode(content) {
        this.ydoc.transact(() => {
            this.codeText.delete(0, this.codeText.length);
            this.codeText.insert(0, content);
        });
    }
    attemptReconnect() {
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
exports.MCPClient = MCPClient;
//# sourceMappingURL=mcp-client.js.map