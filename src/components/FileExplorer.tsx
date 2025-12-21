'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronRight, Folder, File as FileIcon } from 'lucide-react';
import { FileTreeNode } from '@/lib/file-parsers';

interface FileExplorerProps {
    node: FileTreeNode;
    depth?: number;
    themeColor: string;
}

export function FileExplorer({ node, depth = 0, themeColor }: FileExplorerProps) {
    const [expanded, setExpanded] = useState(depth < 2); // Auto-expand first 2 levels
    const isFolder = node.type === 'folder';
    const hasChildren = node.children && node.children.length > 0;

    if (node.name === 'root' && depth === 0) {
        // Skip root folder rendering, just render children
        return (
            <div className="flex flex-col gap-0.5">
                {node.children?.map((child, idx) => (
                    <FileExplorer key={idx} node={child} depth={0} themeColor={themeColor} />
                ))}
            </div>
        );
    }

    return (
        <div className="select-none">
            <div
                className={`flex items-center gap-2 py-1 px-2 rounded-lg hover:bg-white/5 transition-colors ${isFolder ? 'cursor-pointer' : ''}`}
                style={{ marginLeft: depth > 0 ? `${depth * 12}px` : 0 }}
                onClick={() => isFolder && hasChildren && setExpanded(!expanded)}
            >
                <span className="text-white/40 w-3.5 flex items-center justify-center">
                    {isFolder && hasChildren ? (
                        <ChevronRight className={`w-3 h-3 transition-transform duration-200 ${expanded ? 'rotate-90' : ''}`} />
                    ) : null}
                </span>

                {isFolder ? (
                    <Folder className="w-4 h-4" style={{ color: themeColor }} />
                ) : (
                    <FileIcon className="w-3.5 h-3.5 text-white/30" />
                )}

                <span className="text-xs text-white/70 truncate flex-1">{node.name}</span>

                {isFolder && node.count !== undefined && node.count > 0 && (
                    <span className="text-[9px] text-white/30 bg-white/5 px-1.5 py-0.5 rounded">
                        {node.count.toLocaleString()}
                    </span>
                )}

                {!isFolder && node.size && (
                    <span className="text-[9px] text-white/20">
                        {node.size < 1024 ? `${node.size} B` : `${(node.size / 1024).toFixed(0)} KB`}
                    </span>
                )}
            </div>

            <AnimatePresence>
                {isFolder && expanded && hasChildren && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden"
                    >
                        {node.children!
                            .sort((a, b) => (b.type === 'folder' ? 1 : 0) - (a.type === 'folder' ? 1 : 0))
                            .map((child, idx) => (
                                <FileExplorer key={idx} node={child} depth={depth + 1} themeColor={themeColor} />
                            ))}
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}

export default FileExplorer;
