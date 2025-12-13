'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Wifi, WifiOff, Users } from 'lucide-react';

interface Collaborator {
    id: string;
    name: string;
    color: string;
}

interface ConnectionStatusProps {
    connected: boolean;
    synced: boolean;
    collaborators: Collaborator[];
    themeColor: string;
}

/**
 * Status indicator showing:
 * - Connection status (connected/disconnected)
 * - Sync status
 * - Number of collaborators
 */
export function ConnectionStatus({ connected, synced, collaborators, themeColor }: ConnectionStatusProps) {
    return (
        <div className="flex items-center gap-2">
            {/* Connection indicator */}
            <motion.div
                initial={{ scale: 0.8 }}
                animate={{ scale: 1 }}
                className={`flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium ${connected
                        ? 'bg-green-500/20 text-green-400'
                        : 'bg-red-500/20 text-red-400'
                    }`}
            >
                {connected ? (
                    <>
                        <Wifi className="w-3 h-3" />
                        <span>{synced ? 'Synced' : 'Syncing...'}</span>
                    </>
                ) : (
                    <>
                        <WifiOff className="w-3 h-3" />
                        <span>Offline</span>
                    </>
                )}
            </motion.div>

            {/* Collaborators count */}
            {collaborators.length > 0 && (
                <div
                    className="flex items-center gap-1.5 px-2 py-1 rounded-lg text-[10px] font-medium"
                    style={{
                        backgroundColor: `${themeColor}20`,
                        color: themeColor
                    }}
                >
                    <Users className="w-3 h-3" />
                    <span>{collaborators.length} editing</span>

                    {/* Avatar stack */}
                    <div className="flex -space-x-1 ml-1">
                        {collaborators.slice(0, 3).map((collab) => (
                            <div
                                key={collab.id}
                                className="w-4 h-4 rounded-full border border-black flex items-center justify-center text-[8px] font-bold"
                                style={{ backgroundColor: collab.color }}
                                title={collab.name}
                            >
                                {collab.name[0]?.toUpperCase()}
                            </div>
                        ))}
                        {collaborators.length > 3 && (
                            <div className="w-4 h-4 rounded-full bg-white/10 border border-black flex items-center justify-center text-[8px] text-white/60">
                                +{collaborators.length - 3}
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}

export default ConnectionStatus;
