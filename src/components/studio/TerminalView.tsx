'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GlassCard } from './GlassCard';
import { RefreshCw, ExternalLink, Database, Cpu, Clock, DollarSign, Target, Layers, Activity } from 'lucide-react';
import { useTheme } from 'next-themes';

interface JobMetadata {
    originalFilename?: string;
    datasetRows?: number;
    datasetSizeMB?: number;
    taskType?: string;
    algorithm?: string;
    vmName?: string;
    consoleUrl?: string;
    config?: {
        machineType?: string;
        tier?: string;
    };
    actualRuntimeSeconds?: number;
    actualCostUsd?: number;
    actualCostInr?: number;
    estimatedMinutes?: number;
    estimatedTotalCost?: number;
    currentPhase?: string;
    phaseProgress?: number;
}

// Interface moved below to be closer to component


/**
 * Colorize a single log line with syntax highlighting
 */
function colorizeLogLine(line: string): string {
    // Escape HTML first
    let html = line
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');

    // Error lines - full red
    if (/error|failed|failure|exception/i.test(line)) {
        return `<span class="text-red-600 dark:text-red-400">${html}</span>`;
    }

    // Warning lines
    if (/warning|warn/i.test(line)) {
        return `<span class="text-yellow-600 dark:text-yellow-400">${html}</span>`;
    }

    // Success lines
    if (/success|completed|✓|done|ready/i.test(line)) {
        return `<span class="text-green-600 dark:text-green-400">${html}</span>`;
    }

    // Colorize specific patterns
    html = html.replace(/^([A-Za-z][A-Za-z\s]+):/gm, '<span class="text-cyan-600 dark:text-cyan-400">$1:</span>');
    html = html.replace(/\(([^)]+)\)/g, '<span class="text-purple-600 dark:text-purple-400">($1)</span>');
    html = html.replace(/\b(v\d+)\b/g, '<span class="text-yellow-600 dark:text-yellow-400 font-semibold">$1</span>');
    html = html.replace(/(\$[\d.]+)/g, '<span class="text-green-600 dark:text-green-400 font-semibold">$1</span>');
    html = html.replace(/(₹[\d,.]+)/g, '<span class="text-green-600 dark:text-green-400 font-semibold">$1</span>');
    html = html.replace(/(gs:\/\/[^\s]+)/g, '<span class="text-blue-600 dark:text-blue-400">$1</span>');
    html = html.replace(/\b(\d+(?:\.\d+)?)\s*(MB|GB|KB|hours?|mins?|minutes?|seconds?|%)/g,
        '<span class="text-orange-600 dark:text-orange-400 font-semibold">$1</span> <span class="text-black/50 dark:text-white/50">$2</span>');
    html = html.replace(/(gcp-compute-engine|runpod)/g, '<span class="text-emerald-600 dark:text-emerald-400 font-medium">$1</span>');
    html = html.replace(/(e2-\w+|n1-\w+|RTX\s*\d+\s*\w*)/g, '<span class="text-amber-600 dark:text-amber-400">$1</span>');
    html = html.replace(/\b(PROVISIONING|RUNNING|STAGING)\\b/g, '<span class="text-yellow-600 dark:text-yellow-400 bg-yellow-500/20 px-1 rounded">$1</span>');
    html = html.replace(/\b(COMPLETED|SUCCEEDED)\\b/g, '<span class="text-green-600 dark:text-green-400 bg-green-500/20 px-1 rounded">$1</span>');
    html = html.replace(/\b(FAILED)\\b/g, '<span class="text-red-600 dark:text-red-400 bg-red-500/20 px-1 rounded">$1</span>');

    if (!html.includes('class="')) {
        html = `<span class="text-black/80 dark:text-white/80">${html}</span>`;
    }

    return html;
}

function formatRuntime(seconds: number): string {
    if (seconds < 60) return `${seconds}s`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (mins < 60) return `${mins}m ${secs}s`;
    const hours = Math.floor(mins / 60);
    const remainMins = mins % 60;
    return `${hours}h ${remainMins}m`;
}

const PHASES = ['installing', 'downloading', 'training', 'uploading', 'completed'];

/**
 * TerminalView with job metadata display and real-time GCS log streaming
 */

interface TerminalViewProps {
    logs?: string[];
    status?: string | null;
    projectId?: string;
    jobId?: string;
    jobMetadata?: JobMetadata;
    themeColor?: string;
    onClearLogs?: () => void;
}

export const TerminalView: React.FC<TerminalViewProps> = ({
    logs = [],
    status,
    projectId,
    jobId,
    jobMetadata,
    themeColor = '#a855f7',
    onClearLogs
}) => {
    const { resolvedTheme } = useTheme();
    const isRunning = status === 'RUNNING' || status === 'PROVISIONING' || status === 'STAGING' || status === 'running';
    const [gcsLogs, setGcsLogs] = useState<string>('');
    const [isPolling, setIsPolling] = useState(false);
    const [lastOffset, setLastOffset] = useState(0);
    const scrollRef = useRef<HTMLDivElement>(null);

    const allLogs = [...logs, ...gcsLogs.split('\n').filter(Boolean)];

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [allLogs]);

    const fetchLogs = useCallback(async () => {
        if (!projectId || !jobId) return;
        try {
            const res = await fetch(`/api/studio/jobs/${jobId}/logs?projectId=${projectId}&offset=${lastOffset}`);
            const data = await res.json();
            if (data.logs && data.logs.length > 0) {
                setGcsLogs(prev => prev + data.logs);
                setLastOffset(data.offset);
            }
            if (data.complete) setIsPolling(false);
        } catch (error) {
            console.error('[TerminalView] Failed to fetch logs:', error);
        }
    }, [projectId, jobId, lastOffset]);

    useEffect(() => {
        // Auto-poll logs if running
        const shouldPoll = isRunning;
        if (shouldPoll && projectId && jobId) {
            setIsPolling(true);
            const interval = setInterval(fetchLogs, 5000);
            return () => clearInterval(interval);
        } else {
            setIsPolling(false);
        }
    }, [isRunning, projectId, jobId, fetchLogs]);

    const handleRefresh = () => fetchLogs();

    return (
        <div className="flex flex-col h-full backdrop-blur-2xl border border-white/20 overflow-hidden rounded-bl-3xl rounded-br-3xl shadow-xl">
            {/* Status Bar */}
            <div className="flex-none">
                {/* Row 1: Status & Actions */}
                <div className="flex items-center justify-between px-3 md:px-4 py-2 border-b border-black/5 dark:border-white/5 backdrop-blur-xl bg-white/40 dark:bg-white/5">
                    <div className="flex items-center gap-3">
                        <h3 className="text-xs font-bold text-black dark:text-white uppercase tracking-wider flex items-center gap-2">
                            Logs
                            <span className={`px-2 py-0.5 rounded text-[10px] ${isRunning ? 'bg-yellow-500/20 text-yellow-600 dark:text-yellow-400 animate-pulse' : 'bg-green-500/20 text-green-600 dark:text-green-400'}`}>
                                {status || 'READY'}
                            </span>
                        </h3>
                    </div>
                    <div className="flex items-center gap-2">
                        {/* Time & Cost - Hidden on mobile */}
                        <div className="hidden md:flex items-center gap-3 mr-2">
                            {jobMetadata && (
                                <>
                                    {jobMetadata.actualRuntimeSeconds ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-600 dark:text-green-400">
                                            <Clock className="w-3 h-3 opacity-50" />
                                            <span>{formatRuntime(jobMetadata.actualRuntimeSeconds)}</span>
                                        </div>
                                    ) : jobMetadata.estimatedMinutes ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-yellow-600 dark:text-yellow-400">
                                            <Clock className="w-3 h-3 opacity-50" />
                                            <span>~{jobMetadata.estimatedMinutes}m</span>
                                        </div>
                                    ) : null}

                                    {jobMetadata.actualCostInr !== undefined && jobMetadata.actualCostInr !== null ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-green-600 dark:text-green-400">
                                            <DollarSign className="w-3 h-3 opacity-50" />
                                            <span>₹{jobMetadata.actualCostInr.toFixed(4)}</span>
                                        </div>
                                    ) : jobMetadata.estimatedTotalCost ? (
                                        <div className="flex items-center gap-1.5 text-[10px] font-mono text-black/50 dark:text-white/50">
                                            <DollarSign className="w-3 h-3 opacity-50" />
                                            <span>~₹{(jobMetadata.estimatedTotalCost * 83).toFixed(4)}</span>
                                        </div>
                                    ) : null}
                                </>
                            )}
                        </div>
                        {jobMetadata?.consoleUrl && (
                            <a
                                href={jobMetadata.consoleUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-blue-500 transition-colors"
                                title="View in Google Cloud Console"
                            >
                                <ExternalLink className="w-4 h-4" />
                            </a>
                        )}
                        <button
                            onClick={onClearLogs || handleRefresh}
                            className="p-1.5 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 text-black/40 dark:text-white/40 transition-colors"
                            title="Refresh Logs"
                        >
                            <RefreshCw className={`w-4 h-4 ${isPolling ? 'animate-spin' : ''}`} />
                        </button>
                    </div>
                </div>

                {/* Row 2: Dataset Metadata - Simplified for mobile */}
                {jobMetadata && (
                    <div className="flex items-center gap-2 px-3 py-1.5 border-t border-black/5 dark:border-white/5 text-[10px] dark:bg-black/10 overflow-hidden">
                        <span className="text-black/70 dark:text-white/70 font-medium truncate max-w-[120px] md:max-w-none">
                            {jobMetadata.originalFilename || 'dataset.csv'}
                        </span>
                        <span className="text-black/30 dark:text-white/30">•</span>
                        <span className={`capitalize font-medium ${resolvedTheme === 'light' ? 'text-blue-700' : ''}`} style={resolvedTheme !== 'light' ? { color: themeColor } : {}}>{jobMetadata.taskType || 'classification'}</span>
                        <span className="hidden md:inline text-black/30 dark:text-white/30">•</span>
                        <span className="hidden md:inline text-purple-700 dark:text-purple-400 font-medium">{jobMetadata.algorithm || 'RandomForest'}</span>
                        {jobMetadata.vmName && (
                            <>
                                <span className="hidden md:inline text-black/30 dark:text-white/30">•</span>
                                <span className="hidden md:inline text-amber-700 dark:text-amber-400 font-medium">{jobMetadata.config?.machineType || 'e2-medium'}</span>
                            </>
                        )}
                    </div>
                )}
            </div>

            {/* Logs - Scrollable, takes remaining space */}
            <div
                ref={scrollRef} // Fixed: Correct ref name
                className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-transparent"
            >
                {allLogs.length === 0 && (
                    <div className="text-black/30 dark:text-white/30">Waiting for logs...</div>
                )}
                {allLogs.map((log, i) => (
                    <div
                        key={i}
                        className="break-all leading-relaxed"
                        dangerouslySetInnerHTML={{ __html: colorizeLogLine(log) }}
                    />
                ))}
                {isPolling && (
                    <div className="animate-pulse text-green-400">▌</div>
                )}
            </div>
        </div>
    );
};

export default TerminalView;


