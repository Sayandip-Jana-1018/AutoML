"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown, ChevronUp, Plus, Minus, Code2, Copy, Check, ArrowRight } from "lucide-react";
import { useThemeColor } from "@/context/theme-context";

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
    const { themeColor } = useThemeColor();
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

    const addCount = displayDiffs.filter(d => d.type === 'add').length;
    const removeCount = displayDiffs.filter(d => d.type === 'remove').length;

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl backdrop-blur-xl border overflow-hidden ${className}`}
            style={{
                borderColor: `${themeColor}30`,
                background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.04))'
            }}
        >
            {/* Enhanced Header */}
            <div
                className={`flex items-center justify-between px-5 py-4 border-b ${collapsible ? 'cursor-pointer hover:bg-white/5' : ''}`}
                style={{ borderColor: `${themeColor}20` }}
                onClick={() => collapsible && setIsExpanded(!isExpanded)}
            >
                <div className="flex items-center gap-3">
                    <div className="p-2 rounded-xl" style={{
                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                        boxShadow: `0 4px 15px ${themeColor}20`
                    }}>
                        <Code2 className="w-4 h-4 text-white" />
                    </div>
                    <div>
                        <span className="font-bold text-white text-sm">{title}</span>
                        <div className="flex items-center gap-3 mt-1">
                            {addCount > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1" style={{
                                    background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.2), rgba(34, 197, 94, 0.1))',
                                    color: '#4ade80',
                                    border: '1px solid rgba(34, 197, 94, 0.3)'
                                }}>
                                    <Plus className="w-3 h-3" />
                                    {addCount} additions
                                </span>
                            )}
                            {removeCount > 0 && (
                                <span className="text-xs font-semibold px-2 py-0.5 rounded-lg flex items-center gap-1" style={{
                                    background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.2), rgba(239, 68, 68, 0.1))',
                                    color: '#f87171',
                                    border: '1px solid rgba(239, 68, 68, 0.3)'
                                }}>
                                    <Minus className="w-3 h-3" />
                                    {removeCount} removals
                                </span>
                            )}
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={(e) => { e.stopPropagation(); copyCode(); }}
                        className="p-2 rounded-lg transition-all hover:scale-110"
                        style={{
                            background: 'rgba(255,255,255,0.05)',
                            border: '1px solid rgba(255,255,255,0.1)'
                        }}
                        title="Copy new code"
                    >
                        {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-gray-400" />}
                    </button>
                    {collapsible && (
                        <motion.div
                            animate={{ rotate: isExpanded ? 180 : 0 }}
                            transition={{ duration: 0.2 }}
                        >
                            <ChevronDown className="w-5 h-5 text-gray-400" />
                        </motion.div>
                    )}
                </div>
            </div>

            {/* Diff Content with Enhanced Styling */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        {/* Custom Scrollbar Styles */}
                        <style dangerouslySetInnerHTML={{
                            __html: `
                            .diff-viewer-scroll::-webkit-scrollbar {
                                width: 5px;
                                height: 5px;
                            }
                            .diff-viewer-scroll::-webkit-scrollbar-track {
                                background: rgba(0, 0, 0, 0.2);
                                border-radius: 10px;
                            }
                            .diff-viewer-scroll::-webkit-scrollbar-thumb {
                                background: linear-gradient(180deg, ${themeColor}60, ${themeColor}30);
                                border-radius: 10px;
                            }
                            .diff-viewer-scroll::-webkit-scrollbar-thumb:hover {
                                background: linear-gradient(180deg, ${themeColor}, ${themeColor}80);
                            }
                        `}} />

                        <div className="p-4 max-h-96 overflow-y-auto diff-viewer-scroll bg-black/20">
                            <div className="font-mono text-sm space-y-0.5">
                                {displayDiffs.map((diff, index) => (
                                    <DiffLine key={index} diff={diff} themeColor={themeColor} />
                                ))}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

function DiffLine({ diff, themeColor }: { diff: CodeDiff; themeColor: string }) {
    const getLineStyle = () => {
        switch (diff.type) {
            case 'add':
                return {
                    background: 'linear-gradient(90deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.05))',
                    borderLeft: '3px solid #22c55e',
                    color: '#4ade80'
                };
            case 'remove':
                return {
                    background: 'linear-gradient(90deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.05))',
                    borderLeft: '3px solid #ef4444',
                    color: '#f87171'
                };
            case 'replace':
                return {
                    background: 'linear-gradient(90deg, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.05))',
                    borderLeft: `3px solid ${themeColor}`,
                    color: '#fbbf24'
                };
            default:
                return {
                    background: 'rgba(255, 255, 255, 0.02)',
                    borderLeft: '3px solid transparent',
                    color: '#9ca3af'
                };
        }
    };

    const getIcon = () => {
        switch (diff.type) {
            case 'add':
                return <Plus className="w-3.5 h-3.5 text-green-400 flex-shrink-0" />;
            case 'remove':
                return <Minus className="w-3.5 h-3.5 text-red-400 flex-shrink-0" />;
            case 'replace':
                return <ArrowRight className="w-3.5 h-3.5 flex-shrink-0" style={{ color: themeColor }} />;
            default:
                return <span className="w-3.5 h-3.5 flex-shrink-0" />;
        }
    };

    const lineStyle = getLineStyle();

    return (
        <div
            className="flex items-start gap-3 px-3 py-2 rounded-lg transition-all hover:scale-[1.01]"
            style={lineStyle}
        >
            <span className="flex items-center justify-center">
                {getIcon()}
            </span>
            {diff.lineNumber && (
                <span className="w-10 text-right text-xs opacity-50 flex-shrink-0 font-bold">
                    {diff.lineNumber}
                </span>
            )}
            <code className="flex-1 break-all leading-relaxed" style={{ color: lineStyle.color }}>
                {diff.content || ' '}
            </code>
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
            // Skip context lines to reduce clutter - only show changes
            // diffs.push({ type: 'context', lineNumber: i + 1, content: orig || '' });
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
