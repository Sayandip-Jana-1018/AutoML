"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Minus, Code2, Copy, Check } from "lucide-react";

interface CodeDiff {
    type: 'add' | 'remove' | 'replace' | 'context';
    lineNumber?: number;
    content: string;
}

interface DiffViewerProps {
    diffs: CodeDiff[];
    originalCode?: string;
    modifiedCode?: string;
    title?: string;
    collapsible?: boolean;
    defaultExpanded?: boolean;
    onApprove?: () => void;
    onReject?: () => void;
    className?: string;
}

export function DiffViewer({
    diffs,
    originalCode,
    modifiedCode,
    title = "Code Changes",
    collapsible = true,
    defaultExpanded = true,
    onApprove,
    onReject,
    className = ""
}: DiffViewerProps) {
    const [isExpanded, setIsExpanded] = useState(defaultExpanded);
    const [copied, setCopied] = useState(false);

    const copyCode = async () => {
        if (modifiedCode) {
            await navigator.clipboard.writeText(modifiedCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    // Generate diffs from original/modified if not provided
    const displayDiffs = diffs.length > 0 ? diffs : generateDiffFromCode(originalCode, modifiedCode);

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl bg-black/30 dark:bg-gray-900/50 backdrop-blur-xl border border-white/10 overflow-hidden ${className}`}
        >
            {/* Header */}
            <div
                className={`flex items-center justify-between px-4 py-3 border-b border-white/10 ${collapsible ? 'cursor-pointer hover:bg-white/5' : ''}`}
                onClick={() => collapsible && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-1.5 rounded-lg bg-purple-500/20">
                        <Code2 className="w-4 h-4 text-purple-400" />
                    </div>
                    <span className="font-medium text-white">{title}</span>
                    <span className="text-xs text-gray-400 px-2 py-0.5 rounded-full bg-white/5">
                        {displayDiffs.filter(d => d.type === 'add').length} additions, {displayDiffs.filter(d => d.type === 'remove').length} removals
                    </span>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); copyCode(); }}
                        className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                        title="Copy modified code"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                    {collapsible && (
                        isExpanded ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />
                    )}
                </div>
            </div>

            {/* Diff Content */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <div className="max-h-96 overflow-auto">
                            <pre className="p-4 text-sm font-mono">
                                {displayDiffs.map((diff, index) => (
                                    <DiffLine key={index} diff={diff} />
                                ))}
                            </pre>
                        </div>

                        {/* Action Buttons */}
                        {(onApprove || onReject) && (
                            <div className="flex items-center justify-end gap-3 p-4 border-t border-white/10 bg-white/5">
                                {onReject && (
                                    <button
                                        onClick={onReject}
                                        className="px-4 py-2 rounded-lg bg-red-500/20 text-red-400 hover:bg-red-500/30 transition-colors text-sm font-medium"
                                    >
                                        Reject Changes
                                    </button>
                                )}
                                {onApprove && (
                                    <button
                                        onClick={onApprove}
                                        className="px-4 py-2 rounded-lg bg-green-500/20 text-green-400 hover:bg-green-500/30 transition-colors text-sm font-medium"
                                    >
                                        Apply & Run Training
                                    </button>
                                )}
                            </div>
                        )}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function DiffLine({ diff }: { diff: CodeDiff }) {
    const lineStyles = {
        add: 'bg-green-500/10 text-green-300 border-l-2 border-green-500',
        remove: 'bg-red-500/10 text-red-300 border-l-2 border-red-500 line-through opacity-70',
        replace: 'bg-yellow-500/10 text-yellow-300 border-l-2 border-yellow-500',
        context: 'text-gray-400'
    };

    const icons = {
        add: <Plus className="w-3 h-3 text-green-400" />,
        remove: <Minus className="w-3 h-3 text-red-400" />,
        replace: <span className="text-yellow-400 text-xs">~</span>,
        context: <span className="text-gray-500 text-xs">·</span>
    };

    return (
        <div className={`flex items-start gap-2 px-2 py-0.5 -mx-2 ${lineStyles[diff.type]}`}>
            <span className="w-4 flex-shrink-0 flex justify-center items-center">
                {icons[diff.type]}
            </span>
            {diff.lineNumber && (
                <span className="w-8 text-right text-gray-500 text-xs flex-shrink-0">
                    {diff.lineNumber}
                </span>
            )}
            <code className="flex-1 break-all">{diff.content}</code>
        </div>
    );
}

function generateDiffFromCode(original?: string, modified?: string): CodeDiff[] {
    if (!original && !modified) return [];
    if (!original) {
        return (modified || '').split('\n').map((line, i) => ({
            type: 'add' as const,
            lineNumber: i + 1,
            content: line
        }));
    }
    if (!modified) {
        return (original || '').split('\n').map((line, i) => ({
            type: 'remove' as const,
            lineNumber: i + 1,
            content: line
        }));
    }

    // Simple line-by-line diff
    const originalLines = original.split('\n');
    const modifiedLines = modified.split('\n');
    const diffs: CodeDiff[] = [];

    const maxLines = Math.max(originalLines.length, modifiedLines.length);

    for (let i = 0; i < maxLines; i++) {
        const orig = originalLines[i];
        const mod = modifiedLines[i];

        if (orig === mod) {
            diffs.push({ type: 'context', lineNumber: i + 1, content: orig || '' });
        } else if (orig && mod) {
            diffs.push({ type: 'remove', lineNumber: i + 1, content: orig });
            diffs.push({ type: 'add', lineNumber: i + 1, content: mod });
        } else if (!orig && mod) {
            diffs.push({ type: 'add', lineNumber: i + 1, content: mod });
        } else if (orig && !mod) {
            diffs.push({ type: 'remove', lineNumber: i + 1, content: orig });
        }
    }

    return diffs;
}

export default DiffViewer;
