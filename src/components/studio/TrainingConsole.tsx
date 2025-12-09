"use client";

import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Play,
    Square,
    ExternalLink,
    DollarSign,
    Clock,
    Cpu,
    AlertTriangle,
    CheckCircle2,
    XCircle,
    ChevronDown,
    ChevronUp,
    Terminal,
    Loader2,
    Activity
} from "lucide-react";
import { DiffViewer } from "./DiffViewer";
import { RESOURCE_POLICIES, MACHINE_COSTS, type SubscriptionTier } from "@/lib/resource-policy";

interface TrainingConsoleProps {
    jobId?: string;
    status: 'idle' | 'pending' | 'running' | 'completed' | 'failed';
    logs: string[];
    progress?: number;
    machineType: string;
    tier: SubscriptionTier;
    maxDurationHours: number;
    estimatedCost: number;
    dashboardUrl?: string;
    vertexJobId?: string;
    pendingDiff?: {
        original: string;
        modified: string;
    };
    onApproveAndRun?: () => void;
    onCancel?: () => void;
    onStopJob?: () => void;
    className?: string;
}

export function TrainingConsole({
    jobId,
    status,
    logs,
    progress = 0,
    machineType,
    tier,
    maxDurationHours,
    estimatedCost,
    dashboardUrl,
    vertexJobId,
    pendingDiff,
    onApproveAndRun,
    onCancel,
    onStopJob,
    className = ""
}: TrainingConsoleProps) {
    const logsEndRef = useRef<HTMLDivElement>(null);
    const [showLogs, setShowLogs] = useState(true);
    const [showCostWarning, setShowCostWarning] = useState(status === 'pending');

    // Auto-scroll logs
    useEffect(() => {
        if (logsEndRef.current) {
            logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
        }
    }, [logs]);

    const limits = RESOURCE_POLICIES[tier];
    const hourlyCost = MACHINE_COSTS[machineType] || 0.20;

    const statusColors = {
        idle: 'text-gray-400',
        pending: 'text-yellow-400',
        running: 'text-blue-400',
        completed: 'text-green-400',
        failed: 'text-red-400'
    };

    const statusIcons = {
        idle: <Terminal className="w-4 h-4" />,
        pending: <Clock className="w-4 h-4" />,
        running: <Loader2 className="w-4 h-4 animate-spin" />,
        completed: <CheckCircle2 className="w-4 h-4" />,
        failed: <XCircle className="w-4 h-4" />
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl bg-black/30 dark:bg-gray-900/50 backdrop-blur-xl border border-white/10 overflow-hidden ${className}`}
        >
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 bg-gradient-to-r from-purple-500/10 to-blue-500/10">
                <div className="flex items-center gap-4">
                    <div className={`p-2 rounded-xl bg-white/10 ${statusColors[status]}`}>
                        {statusIcons[status]}
                    </div>
                    <div>
                        <h3 className="font-semibold text-white">Training Console</h3>
                        <p className="text-xs text-gray-400">
                            {vertexJobId ? `Job: ${vertexJobId}` : 'No active job'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Status Badge */}
                    <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[status]} bg-white/5`}>
                        {status.toUpperCase()}
                    </span>

                    {/* Vertex Dashboard Link */}
                    {dashboardUrl && (
                        <a
                            href={dashboardUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors text-sm"
                        >
                            <ExternalLink className="w-3.5 h-3.5" />
                            Vertex Dashboard
                        </a>
                    )}
                </div>
            </div>

            {/* Cost Warning Banner (shown before running) */}
            <AnimatePresence>
                {showCostWarning && status === 'pending' && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: 'auto', opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        className="bg-gradient-to-r from-amber-500/20 to-orange-500/20 border-b border-amber-500/20"
                    >
                        <div className="px-5 py-4">
                            <div className="flex items-start gap-3 mb-4">
                                <AlertTriangle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                                <div>
                                    <h4 className="font-medium text-amber-200">Cost Estimation</h4>
                                    <p className="text-sm text-amber-200/70">
                                        Review the estimated costs before starting training.
                                    </p>
                                </div>
                            </div>

                            {/* Cost Grid */}
                            <div className="grid grid-cols-3 gap-4 mb-4">
                                <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                        <DollarSign className="w-3.5 h-3.5" />
                                        Estimated Max Cost
                                    </div>
                                    <p className="text-lg font-semibold text-white">
                                        ${estimatedCost.toFixed(2)}
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                        <Clock className="w-3.5 h-3.5" />
                                        Max Duration
                                    </div>
                                    <p className="text-lg font-semibold text-white">
                                        {maxDurationHours}h
                                    </p>
                                </div>

                                <div className="p-3 rounded-xl bg-black/20 border border-white/5">
                                    <div className="flex items-center gap-2 text-gray-400 text-xs mb-1">
                                        <Cpu className="w-3.5 h-3.5" />
                                        Machine Type
                                    </div>
                                    <p className="text-sm font-mono font-medium text-white">
                                        {machineType}
                                    </p>
                                    <p className="text-xs text-gray-500">${hourlyCost}/hr</p>
                                </div>
                            </div>

                            {/* Tier Info */}
                            <div className="flex items-center justify-between text-xs text-gray-400 mb-4">
                                <span>
                                    Tier: <span className="text-purple-400 capitalize">{tier}</span> •
                                    Max {limits.maxTrainingHours}h allowed
                                </span>
                                <button
                                    onClick={() => setShowCostWarning(false)}
                                    className="text-gray-500 hover:text-gray-300"
                                >
                                    Dismiss
                                </button>
                            </div>

                            {/* Action Buttons */}
                            <div className="flex items-center gap-3">
                                {onCancel && (
                                    <button
                                        onClick={onCancel}
                                        className="px-4 py-2 rounded-lg bg-white/5 text-gray-300 hover:bg-white/10 transition-colors text-sm"
                                    >
                                        Cancel
                                    </button>
                                )}
                                {onApproveAndRun && (
                                    <button
                                        onClick={onApproveAndRun}
                                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 transition-colors text-sm font-medium"
                                    >
                                        <Play className="w-4 h-4" />
                                        Confirm & Start Training
                                    </button>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* Pending Diff Viewer */}
            {pendingDiff && status === 'pending' && (
                <div className="p-4 border-b border-white/10">
                    <DiffViewer
                        diffs={[]}
                        originalCode={pendingDiff.original}
                        modifiedCode={pendingDiff.modified}
                        title="Pending Code Changes"
                        defaultExpanded={true}
                    />
                </div>
            )}

            {/* Progress Bar */}
            {(status === 'running' || status === 'completed') && (
                <div className="px-5 py-3 border-b border-white/10">
                    <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                        <span>Training Progress</span>
                        <span>{Math.round(progress)}%</span>
                    </div>
                    <div className="h-2 bg-white/5 rounded-full overflow-hidden">
                        <motion.div
                            className="h-full bg-gradient-to-r from-blue-500 to-purple-500"
                            initial={{ width: 0 }}
                            animate={{ width: `${progress}%` }}
                            transition={{ duration: 0.5 }}
                        />
                    </div>
                </div>
            )}

            {/* Logs Section */}
            <div>
                <button
                    onClick={() => setShowLogs(!showLogs)}
                    className="w-full flex items-center justify-between px-5 py-3 text-left hover:bg-white/5 transition-colors"
                >
                    <div className="flex items-center gap-2 text-gray-300">
                        <Terminal className="w-4 h-4" />
                        <span className="text-sm font-medium">Logs</span>
                        <span className="text-xs text-gray-500">({logs.length} entries)</span>
                    </div>
                    {showLogs ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
                </button>

                <AnimatePresence>
                    {showLogs && (
                        <motion.div
                            initial={{ height: 0 }}
                            animate={{ height: 'auto' }}
                            exit={{ height: 0 }}
                            className="overflow-hidden"
                        >
                            <div className="max-h-64 overflow-auto p-4 bg-black/40 font-mono text-xs">
                                {logs.length === 0 ? (
                                    <p className="text-gray-500">No logs yet...</p>
                                ) : (
                                    logs.map((log, i) => (
                                        <div
                                            key={i}
                                            className={`py-0.5 ${log.includes('Error') || log.includes('error')
                                                    ? 'text-red-400'
                                                    : log.includes('Warning') || log.includes('warning')
                                                        ? 'text-yellow-400'
                                                        : log.includes('Complete') || log.includes('Success')
                                                            ? 'text-green-400'
                                                            : 'text-gray-400'
                                                }`}
                                        >
                                            <span className="text-gray-600 mr-2">[{String(i + 1).padStart(3, '0')}]</span>
                                            {log}
                                        </div>
                                    ))
                                )}
                                <div ref={logsEndRef} />
                            </div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>

            {/* Footer Actions (for running jobs) */}
            {status === 'running' && onStopJob && (
                <div className="flex items-center justify-end gap-3 px-5 py-3 border-t border-white/10 bg-white/5">
                    <button
                        onClick={onStopJob}
                        className="flex items-center gap-2 px-4 py-2 rounded-lg bg-red-500/20 text-red-300 hover:bg-red-500/30 transition-colors text-sm"
                    >
                        <Square className="w-4 h-4" />
                        Stop Training
                    </button>
                </div>
            )}
        </motion.div>
    );
}

export default TrainingConsole;
