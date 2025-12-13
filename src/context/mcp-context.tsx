/**
 * MCP Context - Global real-time collaboration state
 */

'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import { useMCP } from '@/hooks/useMCP';

interface MCPUser {
    id: number;
    name: string;
    color: string;
    email?: string;
}

interface MCPContextValue {
    projectId: string | null;
    connected: boolean;
    synced: boolean;
    participants: MCPUser[];
    error: string | null;

    // Actions
    joinSession: (projectId: string, userName: string, userEmail?: string) => void;
    leaveSession: () => void;
    updateCursor: (line: number, column: number) => void;
}

const MCPContext = createContext<MCPContextValue | null>(null);

const COLLABORATION_COLORS = [
    '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
    '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
];

function getRandomColor(): string {
    return COLLABORATION_COLORS[Math.floor(Math.random() * COLLABORATION_COLORS.length)];
}

export function MCPProvider({ children }: { children: React.ReactNode }) {
    const [activeProjectId, setActiveProjectId] = useState<string | null>(null);
    const [userName, setUserName] = useState<string>('Anonymous');
    const [userColor] = useState(() => getRandomColor());

    const { doc, state, setLocalState, connect, disconnect } = useMCP({
        projectId: activeProjectId || '',
        enabled: !!activeProjectId
    });

    // Set initial user state when connected
    useEffect(() => {
        if (state.connected && activeProjectId) {
            setLocalState({ name: userName, color: userColor });
        }
    }, [state.connected, activeProjectId, userName, userColor, setLocalState]);

    const joinSession = useCallback((projectId: string, name: string, email?: string) => {
        setActiveProjectId(projectId);
        setUserName(name || 'Anonymous');
        if (email) {
            setLocalState({ name, color: userColor });
        }
    }, [userColor, setLocalState]);

    const leaveSession = useCallback(() => {
        disconnect();
        setActiveProjectId(null);
    }, [disconnect]);

    const updateCursor = useCallback((line: number, column: number) => {
        setLocalState({ cursor: { line, column } } as any);
    }, [setLocalState]);

    const value: MCPContextValue = {
        projectId: activeProjectId,
        connected: state.connected,
        synced: state.synced,
        participants: state.participants.map(p => ({
            id: p.id,
            name: p.name,
            color: p.color
        })),
        error: state.error,
        joinSession,
        leaveSession,
        updateCursor
    };

    return (
        <MCPContext.Provider value={value}>
            {children}
        </MCPContext.Provider>
    );
}

export function useMCPContext(): MCPContextValue {
    const context = useContext(MCPContext);
    if (!context) {
        throw new Error('useMCPContext must be used within MCPProvider');
    }
    return context;
}

export default MCPContext;
