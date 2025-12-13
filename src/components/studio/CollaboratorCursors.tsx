'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface Collaborator {
    id: string;
    name: string;
    color: string;
    cursor?: { line: number; ch: number };
}

interface CollaboratorCursorsProps {
    collaborators: Collaborator[];
    lineHeight: number;
    fontSize: number;
}

/**
 * Renders floating cursors and name labels for collaborators
 * Position this component absolutely over the code editor
 */
export function CollaboratorCursors({ collaborators, lineHeight, fontSize }: CollaboratorCursorsProps) {
    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden z-20">
            <AnimatePresence>
                {collaborators.map((collab) => {
                    if (!collab.cursor) return null;

                    const top = collab.cursor.line * lineHeight;
                    // Estimate character width (assuming monospace)
                    const charWidth = fontSize * 0.6;
                    const left = collab.cursor.ch * charWidth + 48; // 48px for line numbers

                    return (
                        <motion.div
                            key={collab.id}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ duration: 0.2 }}
                            className="absolute flex flex-col items-start"
                            style={{ top, left }}
                        >
                            {/* Cursor line */}
                            <motion.div
                                className="w-0.5"
                                style={{
                                    height: lineHeight,
                                    backgroundColor: collab.color,
                                    boxShadow: `0 0 4px ${collab.color}`
                                }}
                                animate={{ opacity: [1, 0.5, 1] }}
                                transition={{ duration: 0.8, repeat: Infinity }}
                            />

                            {/* Name label */}
                            <div
                                className="px-1.5 py-0.5 rounded text-[9px] font-medium -mt-0.5 whitespace-nowrap"
                                style={{
                                    backgroundColor: collab.color,
                                    color: '#000'
                                }}
                            >
                                {collab.name}
                            </div>
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

export default CollaboratorCursors;
