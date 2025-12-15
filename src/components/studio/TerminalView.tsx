'use client';

import React, { useEffect, useState, useRef, useCallback } from 'react';
import { GlassCard } from './GlassCard';
import { RefreshCw, ExternalLink, Database, Cpu, Clock, DollarSign, Target, Layers, Activity } from 'lucide-react';

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

interface TerminalViewProps {
    logs?: string[];
    status?: string;
    projectId?: string;
    jobId?: string;
    jobMetadata?: JobMetadata;
    themeColor?: string;
}

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
        return `<span class="text-red-400">${html}</span>`;
    }

    // Warning lines
    if (/warning|warn/i.test(line)) {
        return `<span class="text-yellow-400">${html}</span>`;
    }

    // Success lines
    if (/success|completed|✓|done|ready/i.test(line)) {
        return `<span class="text-green-400">${html}</span>`;
    }

    // Colorize specific patterns
    html = html.replace(/^([A-Za-z][A-Za-z\s]+):/gm, '<span class="text-cyan-400">$1:</span>');
    html = html.replace(/\(([^)]+)\)/g, '<span class="text-purple-400">($1)</span>');
    html = html.replace(/\b(v\d+)\b/g, '<span class="text-yellow-400 font-semibold">$1</span>');
    html = html.replace(/(\$[\d.]+)/g, '<span class="text-green-400 font-semibold">$1</span>');
    html = html.replace(/(₹[\d,.]+)/g, '<span class="text-green-400 font-semibold">$1</span>');
    html = html.replace(/(gs:\/\/[^\s]+)/g, '<span class="text-blue-400">$1</span>');
    html = html.replace(/\b(\d+(?:\.\d+)?)\s*(MB|GB|KB|hours?|mins?|minutes?|seconds?|%)/g,
        '<span class="text-orange-400 font-semibold">$1</span> <span class="text-white/50">$2</span>');
    html = html.replace(/(gcp-compute-engine|runpod)/g, '<span class="text-emerald-400 font-medium">$1</span>');
    html = html.replace(/(e2-\w+|n1-\w+|RTX\s*\d+\s*\w*)/g, '<span class="text-amber-400">$1</span>');
    html = html.replace(/\b(PROVISIONING|RUNNING|STAGING)\\b/g, '<span class="text-yellow-400 bg-yellow-500/20 px-1 rounded">$1</span>');
    html = html.replace(/\b(COMPLETED|SUCCEEDED)\\b/g, '<span class="text-green-400 bg-green-500/20 px-1 rounded">$1</span>');
    html = html.replace(/\b(FAILED)\\b/g, '<span class="text-red-400 bg-red-500/20 px-1 rounded">$1</span>');

    if (!html.includes('class="')) {
        html = `<span class="text-white/80">${html}</span>`;
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
export const TerminalView = ({
    logs: initialLogs,
    status,
    projectId,
    jobId,
    jobMetadata,
    themeColor = '#a855f7'
}: TerminalViewProps) => {
    const [logs, setLogs] = useState<string[]>(initialLogs || []);
    const [gcsLogs, setGcsLogs] = useState<string>('');
    const [isPolling, setIsPolling] = useState(false);
    const [lastOffset, setLastOffset] = useState(0);
    const terminalRef = useRef<HTMLDivElement>(null);

    const allLogs = [...logs, ...gcsLogs.split('\n').filter(Boolean)];

    useEffect(() => {
        if (terminalRef.current) {
            terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
        }
    }, [allLogs]);

    useEffect(() => {
        if (initialLogs) setLogs(initialLogs);
    }, [initialLogs]);

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
        const shouldPoll = status === 'running' || status === 'RUNNING' || status === 'training' || status === 'PROVISIONING';
        if (shouldPoll && projectId && jobId) {
            setIsPolling(true);
            const interval = setInterval(fetchLogs, 5000);
            return () => clearInterval(interval);
        } else {
            setIsPolling(false);
        }
    }, [status, projectId, jobId, fetchLogs]);

    const handleRefresh = () => fetchLogs();

    // Get current phase index
    const currentPhaseIndex = PHASES.indexOf(jobMetadata?.currentPhase || 'installing');

    return (
        <GlassCard className="h-full overflow-hidden" hover={false}>
            <div className="h-full flex flex-col min-h-0">
                {/* Two-Line Header - Row 1: Logs + Status + Time + Cost | Row 2: Metadata */}
                <div className="flex-shrink-0 border-b border-white/10 bg-black/20">
                    {/* Row 1: Logs, Status, Time/Cost */}
                    <div className="flex items-center justify-between px-3 py-2">
                        <div className="flex items-center gap-3">
                            <span className="font-mono text-xs text-white font-bold">Logs</span>
                            {status && (
                                <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${status === 'running' || status === 'RUNNING' || status === 'PROVISIONING'
                                    ? 'bg-yellow-500/20 text-yellow-400'
                                    : status === 'succeeded' || status === 'completed' || status === 'deployed'
                                        ? 'bg-green-500/20 text-green-400'
                                        : status === 'failed'
                                            ? 'bg-red-500/20 text-red-400'
                                            : 'bg-white/10 text-white/50'
                                    }`}>
                                    {status.toUpperCase()}
                                </span>
                            )}
                            {isPolling && (
                                <span className="flex items-center gap-1 text-white/30">
                                    <RefreshCw className="w-3 h-3 animate-spin" />
                                </span>
                            )}
                        </div>

                        {/* Right side: Time, Cost, Console, Refresh */}
                        <div className="flex items-center gap-3 text-[10px]">
                            {jobMetadata && (
                                <>
                                    {jobMetadata.actualRuntimeSeconds ? (
                                        <span className="flex items-center gap-1 text-green-400 font-bold">
                                            <Clock className="w-3 h-3" />
                                            {formatRuntime(jobMetadata.actualRuntimeSeconds)}
                                        </span>
                                    ) : jobMetadata.estimatedMinutes ? (
                                        <span className="flex items-center gap-1 text-yellow-400">
                                            <Clock className="w-3 h-3" />
                                            ~{jobMetadata.estimatedMinutes}m
                                        </span>
                                    ) : null}
                                    {jobMetadata.actualCostInr !== undefined && jobMetadata.actualCostInr !== null ? (
                                        <span className="flex items-center gap-1 text-green-400 font-bold">
                                            <DollarSign className="w-3 h-3" />
                                            ₹{jobMetadata.actualCostInr.toFixed(4)}
                                        </span>
                                    ) : jobMetadata.estimatedTotalCost ? (
                                        <span className="flex items-center gap-1 text-white/50">
                                            <DollarSign className="w-3 h-3" />
                                            ~₹{(jobMetadata.estimatedTotalCost * 83).toFixed(4)}
                                        </span>
                                    ) : null}
                                    {jobMetadata.consoleUrl && (
                                        <a
                                            href={jobMetadata.consoleUrl}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex items-center gap-1 text-blue-400 hover:text-blue-300"
                                        >
                                            <ExternalLink className="w-3 h-3" />
                                        </a>
                                    )}
                                </>
                            )}
                            {projectId && jobId && (
                                <button
                                    onClick={handleRefresh}
                                    className="p-1 rounded hover:bg-white/10 transition-colors"
                                    title="Refresh logs"
                                >
                                    <RefreshCw className="w-3 h-3 text-white/50 hover:text-white" />
                                </button>
                            )}
                        </div>
                    </div>

                    {/* Row 2: Dataset Metadata */}
                    {jobMetadata && (
                        <div className="flex items-center gap-2 px-3 py-1.5 border-t border-white/5 text-[10px] bg-black/10">
                            <span className="text-white/70 font-medium">{jobMetadata.originalFilename || 'dataset.csv'}</span>
                            <span className="text-white/30">•</span>
                            <span className="capitalize" style={{ color: themeColor }}>{jobMetadata.taskType || 'classification'}</span>
                            <span className="text-white/30">•</span>
                            <span className="text-purple-400">{jobMetadata.algorithm || 'RandomForest'}</span>
                            {jobMetadata.vmName && (
                                <>
                                    <span className="text-white/30">•</span>
                                    <span className="text-amber-400">{jobMetadata.config?.machineType || 'e2-medium'}</span>
                                </>
                            )}
                        </div>
                    )}
                </div>

                {/* Logs - Scrollable, takes remaining space */}
                <div
                    ref={terminalRef}
                    className="flex-1 min-h-0 overflow-y-auto p-3 font-mono text-xs space-y-0.5 bg-black/20"
                >
                    {allLogs.length === 0 && (
                        <div className="text-white/30">Waiting for logs...</div>
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
        </GlassCard>
    );
};

export default TerminalView;


