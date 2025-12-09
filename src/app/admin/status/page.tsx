"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Activity,
    Database,
    Cloud,
    HardDrive,
    CheckCircle2,
    XCircle,
    AlertTriangle,
    RefreshCw,
    Clock,
    Server
} from "lucide-react";
import { Navbar } from "@/components/navbar";

interface HealthCheck {
    status: 'healthy' | 'degraded' | 'unhealthy';
    timestamp: string;
    checks: {
        firestore: { status: string; latencyMs?: number; error?: string };
        storage: { status: string; error?: string };
        vertexAi: { status: string; error?: string };
    };
    version: string;
    environment: string;
}

export default function StatusPage() {
    const [health, setHealth] = useState<HealthCheck | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [lastChecked, setLastChecked] = useState<Date | null>(null);

    useEffect(() => {
        checkHealth();
        // Auto-refresh every 30 seconds
        const interval = setInterval(checkHealth, 30000);
        return () => clearInterval(interval);
    }, []);

    const checkHealth = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/health');
            const data = await res.json();
            setHealth(data);
            setLastChecked(new Date());
            setError(null);
        } catch (err) {
            setError('Failed to check system health');
        } finally {
            setLoading(false);
        }
    };

    const statusColors = {
        healthy: 'text-green-400',
        degraded: 'text-yellow-400',
        unhealthy: 'text-red-400',
        ok: 'text-green-400',
        error: 'text-red-400',
        unknown: 'text-gray-400'
    };

    const statusBg = {
        healthy: 'from-green-500/20 to-emerald-500/20 border-green-500/30',
        degraded: 'from-yellow-500/20 to-orange-500/20 border-yellow-500/30',
        unhealthy: 'from-red-500/20 to-rose-500/20 border-red-500/30'
    };

    const StatusIcon = ({ status }: { status: string }) => {
        if (status === 'ok' || status === 'healthy') return <CheckCircle2 className="w-5 h-5 text-green-400" />;
        if (status === 'error' || status === 'unhealthy') return <XCircle className="w-5 h-5 text-red-400" />;
        if (status === 'degraded') return <AlertTriangle className="w-5 h-5 text-yellow-400" />;
        return <Clock className="w-5 h-5 text-gray-400" />;
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <Navbar />

            <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <Activity className="w-8 h-8 text-blue-400" />
                            System Status
                        </h1>
                        <p className="text-gray-400">Real-time health monitoring</p>
                    </div>

                    <button
                        onClick={checkHealth}
                        disabled={loading}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl bg-white/5 border border-white/10 text-gray-300 hover:text-white transition-colors"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>

                {error && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300"
                    >
                        <XCircle className="w-4 h-4 inline mr-2" />
                        {error}
                    </motion.div>
                )}

                {health && (
                    <>
                        {/* Overall Status */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className={`p-6 rounded-2xl bg-gradient-to-br ${statusBg[health.status]} border backdrop-blur-xl mb-6`}
                        >
                            <div className="flex items-center justify-between">
                                <div className="flex items-center gap-4">
                                    <StatusIcon status={health.status} />
                                    <div>
                                        <h2 className={`text-2xl font-bold capitalize ${statusColors[health.status]}`}>
                                            {health.status === 'healthy' ? 'All Systems Operational' :
                                                health.status === 'degraded' ? 'Partial Outage' :
                                                    'System Issues Detected'}
                                        </h2>
                                        <p className="text-gray-400 text-sm">
                                            Last checked: {lastChecked?.toLocaleTimeString()}
                                        </p>
                                    </div>
                                </div>
                                <div className="text-right">
                                    <p className="text-sm text-gray-400">Version</p>
                                    <p className="text-white font-mono">{health.version}</p>
                                </div>
                            </div>
                        </motion.div>

                        {/* Service Checks */}
                        <div className="space-y-4">
                            <h3 className="text-lg font-semibold text-white mb-4">Service Status</h3>

                            {/* Firestore */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.1 }}
                                className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <Database className="w-6 h-6 text-blue-400" />
                                    <div>
                                        <h4 className="font-medium text-white">Firestore Database</h4>
                                        <p className="text-sm text-gray-400">Primary data storage</p>
                                    </div>
                                </div>
                                <div className="flex items-center gap-4">
                                    {health.checks.firestore.latencyMs && (
                                        <span className="text-sm text-gray-400">
                                            {health.checks.firestore.latencyMs}ms
                                        </span>
                                    )}
                                    <StatusIcon status={health.checks.firestore.status} />
                                </div>
                            </motion.div>

                            {/* Cloud Storage */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.2 }}
                                className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <HardDrive className="w-6 h-6 text-green-400" />
                                    <div>
                                        <h4 className="font-medium text-white">Cloud Storage</h4>
                                        <p className="text-sm text-gray-400">File storage (GCS)</p>
                                    </div>
                                </div>
                                <StatusIcon status={health.checks.storage.status} />
                            </motion.div>

                            {/* Vertex AI */}
                            <motion.div
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: 0.3 }}
                                className="p-4 rounded-xl bg-black/30 border border-white/10 flex items-center justify-between"
                            >
                                <div className="flex items-center gap-4">
                                    <Cloud className="w-6 h-6 text-purple-400" />
                                    <div>
                                        <h4 className="font-medium text-white">Vertex AI</h4>
                                        <p className="text-sm text-gray-400">ML training platform</p>
                                    </div>
                                </div>
                                <StatusIcon status={health.checks.vertexAi.status} />
                            </motion.div>
                        </div>

                        {/* Environment Info */}
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.4 }}
                            className="mt-8 p-4 rounded-xl bg-white/5 border border-white/10"
                        >
                            <div className="flex items-center gap-4">
                                <Server className="w-5 h-5 text-gray-400" />
                                <div className="flex-1 flex items-center justify-between">
                                    <div>
                                        <span className="text-sm text-gray-400">Environment: </span>
                                        <span className="text-white font-mono">{health.environment}</span>
                                    </div>
                                    <div>
                                        <span className="text-sm text-gray-400">Response time: </span>
                                        <span className="text-white">
                                            {new Date(health.timestamp).toISOString()}
                                        </span>
                                    </div>
                                </div>
                            </div>
                        </motion.div>
                    </>
                )}
            </main>
        </div>
    );
}
