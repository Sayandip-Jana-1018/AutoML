'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import * as Y from 'yjs';
import { WebsocketProvider } from 'y-websocket';

interface Collaborator {
    id: string;
    name: string;
    color: string;
    cursor?: { line: number; ch: number };
}

interface UseCollaborationOptions {
    documentId: string;
    serverUrl?: string;
    userName?: string;
    userColor?: string;
    onContentChange?: (content: string) => void;
}

interface UseCollaborationReturn {
    content: string;
    setContent: (text: string) => void;
    collaborators: Collaborator[];
    connected: boolean;
    synced: boolean;
    updateCursor: (line: number, ch: number) => void;
}

// Generate random color for user
const getRandomColor = () => {
    const colors = [
        '#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4',
        '#FFEAA7', '#DDA0DD', '#98D8C8', '#F7DC6F'
    ];
    return colors[Math.floor(Math.random() * colors.length)];
};

/**
 * Hook for real-time collaborative editing using Yjs
 * 
 * Usage:
 * const { content, setContent, collaborators, connected } = useCollaboration({
 *   documentId: 'project-123',
 *   userName: 'John',
 *   onContentChange: (text) => saveToFirestore(text)
 * });
 */
export function useCollaboration({
    documentId,
    serverUrl = 'ws://localhost:3100',
    userName = 'Anonymous',
    userColor = getRandomColor(),
    onContentChange
}: UseCollaborationOptions): UseCollaborationReturn {
    const [content, setContentState] = useState('');
    const [collaborators, setCollaborators] = useState<Collaborator[]>([]);
    const [connected, setConnected] = useState(false);
    const [synced, setSynced] = useState(false);

    const ydocRef = useRef<Y.Doc | null>(null);
    const providerRef = useRef<WebsocketProvider | null>(null);
    const ytextRef = useRef<Y.Text | null>(null);
    const isLocalChange = useRef(false);

    useEffect(() => {
        if (!documentId) return;

        // Create Yjs document
        const ydoc = new Y.Doc();
        ydocRef.current = ydoc;

        // Create shared text type
        const ytext = ydoc.getText('content');
        ytextRef.current = ytext;

        // Connect to WebSocket server
        console.log(`[Collab] Connecting to ${serverUrl} for document ${documentId}`);
        const provider = new WebsocketProvider(serverUrl, documentId, ydoc);
        providerRef.current = provider;

        // Set user awareness
        provider.awareness.setLocalStateField('user', {
            name: userName,
            color: userColor,
            id: ydoc.clientID.toString()
        });

        // Connection status
        provider.on('status', ({ status }: { status: string }) => {
            console.log(`[Collab] Connection status: ${status}`);
            setConnected(status === 'connected');
        });

        // Sync status
        provider.on('sync', (synced: boolean) => {
            console.log(`[Collab] Sync status: ${synced}`);
            setSynced(synced);
            if (synced) {
                // Initial content sync
                setContentState(ytext.toString());
            }
        });

        // Listen for text changes
        ytext.observe((event) => {
            if (!isLocalChange.current) {
                const newContent = ytext.toString();
                setContentState(newContent);
                onContentChange?.(newContent);
            }
            isLocalChange.current = false;
        });

        // Track collaborators
        provider.awareness.on('change', () => {
            const states = provider.awareness.getStates();
            const users: Collaborator[] = [];

            states.forEach((state, clientId) => {
                if (state.user && clientId !== ydoc.clientID) {
                    users.push({
                        id: clientId.toString(),
                        name: state.user.name || 'Unknown',
                        color: state.user.color || '#888',
                        cursor: state.cursor
                    });
                }
            });

            setCollaborators(users);
        });

        return () => {
            console.log('[Collab] Disconnecting...');
            provider.disconnect();
            ydoc.destroy();
        };
    }, [documentId, serverUrl, userName, userColor, onContentChange]);

    // Set content - updates Yjs document
    const setContent = useCallback((newContent: string) => {
        const ytext = ytextRef.current;
        if (!ytext) return;

        const ydoc = ydocRef.current;
        if (!ydoc) return;

        isLocalChange.current = true;

        ydoc.transact(() => {
            ytext.delete(0, ytext.length);
            ytext.insert(0, newContent);
        });

        setContentState(newContent);
    }, []);

    // Update cursor position
    const updateCursor = useCallback((line: number, ch: number) => {
        const provider = providerRef.current;
        if (!provider) return;

        provider.awareness.setLocalStateField('cursor', { line, ch });
    }, []);

    return {
        content,
        setContent,
        collaborators,
        connected,
        synced,
        updateCursor
    };
}

export default useCollaboration;
