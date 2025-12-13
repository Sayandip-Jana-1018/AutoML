/**
 * MCP Client for VS Code Extension with Real-Time Yjs Sync
 * Handles WebSocket connection and document synchronization
 */
import { EventEmitter } from 'events';
import * as Y from 'yjs';
import * as awarenessProtocol from 'y-protocols/awareness';
export interface Participant {
    id: number;
    name: string;
    color: string;
    cursor?: {
        line: number;
        column: number;
    };
}
export declare class MCPClient extends EventEmitter {
    private ws;
    private _isConnected;
    private _projectId;
    private _serverUrl;
    private _token?;
    private _participants;
    private reconnectAttempts;
    private maxReconnectAttempts;
    ydoc: Y.Doc;
    awareness: awarenessProtocol.Awareness;
    private synced;
    constructor(serverUrl: string, projectId: string, token?: string);
    get isConnected(): boolean;
    get projectId(): string;
    get participants(): Participant[];
    get token(): string | undefined;
    get codeText(): Y.Text;
    connect(): Promise<void>;
    disconnect(): void;
    private handleMessage;
    private updateParticipants;
    private broadcastUpdate;
    private broadcastAwareness;
    private sendRaw;
    updateCursor(line: number, column: number): void;
    insertText(index: number, text: string): void;
    deleteText(index: number, length: number): void;
    getCode(): string;
    setCode(content: string): void;
    private attemptReconnect;
}
//# sourceMappingURL=mcp-client.d.ts.map