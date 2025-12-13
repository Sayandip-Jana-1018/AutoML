/**
 * useMCP Hook - Real-time collaboration using Yjs
 * Note: Requires `npm install yjs y-websocket` in main project
 */

'use client';

import { useEffect, useRef, useState, useCallback } from 'react';

interface MCPConfig {
    projectId: string;
    enabled?: boolean;
    serverUrl?: string;
}

interface MCPState {
    connected: boolean;
    synced: boolean;
    participants: MCPParticipant[];
    error: string | null;
}

interface MCPParticipant {
    id: number;
    name: string;
    color: string;
    cursor?: { line: number; column: number };
}

interface UseMCPReturn {
    state: MCPState;
    connect: () => void;
    disconnect: () => void;
    isReady: boolean;
}

const MCP_SERVER_URL = process.env.NEXT_PUBLIC_MCP_SERVER_URL || 'ws://localhost:4000';

/**
 * Hook for real-time collaboration using Yjs + WebSocket
 * This is a simplified version - full Yjs integration requires y-websocket package
 */
export function useMCP({ projectId, enabled = true, serverUrl = MCP_SERVER_URL }: MCPConfig): UseMCPReturn {
    const wsRef = useRef<WebSocket | null>(null);

    const [state, setState] = useState<MCPState>({
        connected: false,
        synced: false,
        participants: [],
        error: null
    });

    // Connect to MCP server
    const connect = useCallback(() => {
        if (!enabled || !projectId || wsRef.current) return;

        try {
            const wsUrl = `${serverUrl}/ws/${projectId}`;
            const ws = new WebSocket(wsUrl);
            wsRef.current = ws;

            ws.onopen = () => {
                console.log('[MCP] Connected to', wsUrl);
                setState(prev => ({ ...prev, connected: true, error: null }));
            };

            ws.onclose = () => {
                console.log('[MCP] Disconnected');
                setState(prev => ({ ...prev, connected: false, synced: false }));
                wsRef.current = null;
            };

            ws.onerror = (error) => {
                console.error('[MCP] WebSocket error:', error);
                setState(prev => ({
                    ...prev,
                    error: 'Failed to connect to collaboration server',
                    connected: false
                }));
            };

            ws.onmessage = (event) => {
                // Handle Yjs sync messages
                console.log('[MCP] Message received:', event.data);
                setState(prev => ({ ...prev, synced: true }));
            };
        } catch (error) {
            console.error('[MCP] Connection failed:', error);
            setState(prev => ({
                ...prev,
                error: 'Failed to connect to collaboration server'
            }));
        }
    }, [projectId, enabled, serverUrl]);

    // Disconnect
    const disconnect = useCallback(() => {
        if (wsRef.current) {
            wsRef.current.close();
            wsRef.current = null;
        }
    }, []);

    // Auto-connect when enabled
    useEffect(() => {
        if (enabled && projectId) {
            connect();
        }

        return () => {
            disconnect();
        };
    }, [projectId, enabled, connect, disconnect]);

    return {
        state,
        connect,
        disconnect,
        isReady: state.connected && state.synced
    };
}

export default useMCP;
