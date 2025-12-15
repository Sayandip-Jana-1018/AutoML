
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileText, Clock, AlertCircle, CheckCircle, Activity, Loader2, ArrowRight } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface LogEntry {
    id: string;
    timestamp: string;
    latency_ms: number;
    prediction: any;
    confidence?: number;
    error?: string;
    estimated_cost_usd?: number;
    inputs: any;
}

interface LogsModalProps {
    isOpen: boolean;
    onClose: () => void;
    modelId: string;
    themeColor: string;
}

export const LogsModal = ({ isOpen, onClose, modelId, themeColor }: LogsModalProps) => {
    const { user } = useAuth();
    const [logs, setLogs] = useState<LogEntry[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedLog, setSelectedLog] = useState<LogEntry | null>(null);

    useEffect(() => {
        if (isOpen && modelId) {
            fetchLogs();
        }
    }, [isOpen, modelId]);

    const fetchLogs = async () => {
        setLoading(true);
        try {
            const token = await user?.getIdToken();
            // Use the existing deploy API which has a GET handler for logs
            const res = await fetch(`/api/deploy/${modelId}/predict`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setLogs(data.logs || []);
                // Select first log by default if available
                if (data.logs && data.logs.length > 0) {
                    setSelectedLog(data.logs[0]);
                }
            }
        } catch (err) {
            console.error('Failed to fetch logs', err);
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-4xl h-[600px] bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl flex flex-col md:flex-row"
                        style={{ boxShadow: `0 0 40px ${themeColor}15` }}
                    >
                        {/* Close button (mobile) */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 z-10 md:hidden p-2 bg-black/50 rounded-full"
                        >
                            <X className="w-5 h-5 text-white/70" />
                        </button>

                        {/* Sidebar: Log List */}
                        <div className="w-full md:w-1/3 border-r border-white/10 flex flex-col bg-white/[0.01]">
                            <div className="p-4 border-b border-white/5 flex items-center gap-2">
                                <Activity className="w-4 h-4" style={{ color: themeColor }} />
                                <h3 className="font-bold text-white text-sm">Prediction History</h3>
                            </div>

                            <div className="flex-1 overflow-y-auto">
                                {loading ? (
                                    <div className="flex justify-center p-8">
                                        <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                    </div>
                                ) : logs.length === 0 ? (
                                    <div className="p-8 text-center text-white/40 text-sm">
                                        <FileText className="w-8 h-8 opacity-20 mx-auto mb-2" />
                                        No requests yet
                                    </div>
                                ) : (
                                    <div className="divide-y divide-white/5">
                                        {logs.map((log) => (
                                            <button
                                                key={log.id}
                                                onClick={() => setSelectedLog(log)}
                                                className={`w-full text-left p-3 hover:bg-white/5 transition-colors ${selectedLog?.id === log.id ? 'bg-white/5 border-l-2' : ''
                                                    }`}
                                                style={selectedLog?.id === log.id ? { borderLeftColor: themeColor } : {}}
                                            >
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className={`text-xs font-bold ${log.error ? 'text-red-400' : 'text-green-400'}`}>
                                                        {log.error ? 'Error' : 'Success'}
                                                    </span>
                                                    <span className="text-[10px] text-white/30 font-mono">
                                                        {new Date(log.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                                <div className="flex items-center justify-between text-[10px] text-white/50">
                                                    <span>{log.latency_ms}ms</span>
                                                    <span>{(log.estimated_cost_usd || 0).toFixed(6)}$</span>
                                                </div>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Main Content: Log Detail */}
                        <div className="flex-1 flex flex-col bg-[#0c0c0c]">
                            <div className="p-4 border-b border-white/5 flex items-center justify-between">
                                <h3 className="font-bold text-white text-sm">Log Details</h3>
                                <button onClick={onClose} className="hidden md:block p-2 hover:bg-white/5 rounded-full transition-colors">
                                    <X className="w-4 h-4 text-white/50" />
                                </button>
                            </div>

                            <div className="flex-1 p-6 overflow-y-auto">
                                {selectedLog ? (
                                    <div className="space-y-6">
                                        {/* Status Header */}
                                        <div className="flex items-center gap-3">
                                            <div className={`p-3 rounded-full ${selectedLog.error ? 'bg-red-500/10' : 'bg-green-500/10'}`}>
                                                {selectedLog.error ? (
                                                    <AlertCircle className="w-6 h-6 text-red-500" />
                                                ) : (
                                                    <CheckCircle className="w-6 h-6 text-green-500" />
                                                )}
                                            </div>
                                            <div>
                                                <h4 className="text-lg font-bold text-white">
                                                    {selectedLog.error ? 'Prediction Failed' : 'Prediction Successful'}
                                                </h4>
                                                <div className="flex items-center gap-3 text-xs text-white/40 mt-1">
                                                    <span className="flex items-center gap-1">
                                                        <Clock className="w-3 h-3" />
                                                        {new Date(selectedLog.timestamp).toLocaleString()}
                                                    </span>
                                                    <span>•</span>
                                                    <span>{selectedLog.id}</span>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Result Card */}
                                        {!selectedLog.error && (
                                            <div className="p-4 rounded-xl border border-white/10 bg-white/5">
                                                <h5 className="text-xs uppercase tracking-wider text-white/40 mb-2">Prediction</h5>
                                                <div className="flex items-center gap-2">
                                                    <ArrowRight className="w-4 h-4" style={{ color: themeColor }} />
                                                    <span className="text-xl font-bold text-white">{selectedLog.prediction}</span>
                                                </div>
                                                {selectedLog.confidence && (
                                                    <div className="mt-2 text-xs text-white/50">
                                                        Confidence: {(selectedLog.confidence * 100).toFixed(1)}%
                                                    </div>
                                                )}
                                            </div>
                                        )}

                                        {/* JSON Details */}
                                        <div className="grid grid-cols-1 gap-4">
                                            {/* Inputs */}
                                            <div>
                                                <h5 className="text-xs uppercase tracking-wider text-white/40 mb-2 font-bold">Input Features</h5>
                                                <pre className="p-3 rounded-xl bg-black/50 border border-white/5 text-[10px] text-white/70 font-mono overflow-x-auto">
                                                    {JSON.stringify(selectedLog.inputs, null, 2)}
                                                </pre>
                                            </div>

                                            {/* Full Payload */}
                                            {selectedLog.error && (
                                                <div>
                                                    <h5 className="text-xs uppercase tracking-wider text-red-500/70 mb-2 font-bold">Error Message</h5>
                                                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 text-xs text-red-400 font-mono">
                                                        {selectedLog.error}
                                                    </div>
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                ) : (
                                    <div className="h-full flex flex-col items-center justify-center text-white/30">
                                        <FileText className="w-12 h-12 mb-4 opacity-20" />
                                        <p>Select a log to view details</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
