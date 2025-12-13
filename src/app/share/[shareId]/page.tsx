'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, TrendingUp, Clock, Share2, ExternalLink, Copy, CheckCircle2 } from 'lucide-react';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface PublicModelCardProps {
    params: Promise<{ shareId: string }>;
}

interface SharedModelData {
    projectId: string;
    projectName: string;
    taskType: string;
    targetColumn?: string;
    metrics?: {
        accuracy?: number;
        loss?: number;
        rmse?: number;
        r2?: number;
    };
    latestVersion?: number;
    createdAt?: any;
    sharedBy?: string;
}

export default function PublicModelCardPage({ params }: PublicModelCardProps) {
    const [shareId, setShareId] = useState<string>('');
    const [modelData, setModelData] = useState<SharedModelData | null>(null);
    const [loading, setLoading] = useState(true);
    const [notFound, setNotFound] = useState(false);
    const [copied, setCopied] = useState(false);

    // Resolve params
    useEffect(() => {
        params.then(p => setShareId(p.shareId));
    }, [params]);

    // Fetch shared model data
    useEffect(() => {
        if (!shareId) return;

        const fetchData = async () => {
            try {
                // Fetch from shared_models collection
                const shareDoc = await getDoc(doc(db, 'shared_models', shareId));

                if (!shareDoc.exists()) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                const shareData = shareDoc.data();

                // Fetch project data
                const projectDoc = await getDoc(doc(db, 'projects', shareData.projectId));
                if (!projectDoc.exists()) {
                    setNotFound(true);
                    setLoading(false);
                    return;
                }

                const projectData = projectDoc.data();

                // Fetch latest version with metrics
                const versionsQuery = query(
                    collection(db, 'projects', shareData.projectId, 'scripts'),
                    orderBy('version', 'desc'),
                    limit(1)
                );
                const versionsSnap = await getDocs(versionsQuery);
                const latestVersion = versionsSnap.docs[0]?.data();

                setModelData({
                    projectId: shareData.projectId,
                    projectName: projectData.name || 'Untitled Model',
                    taskType: projectData.taskType || 'classification',
                    targetColumn: projectData.targetColumn,
                    metrics: latestVersion?.metricsSummary || {},
                    latestVersion: latestVersion?.version || 1,
                    createdAt: projectData.createdAt,
                    sharedBy: shareData.sharedBy
                });
            } catch (error) {
                console.error('Error fetching shared model:', error);
                setNotFound(true);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [shareId]);

    const handleCopyLink = () => {
        navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="animate-pulse text-white/30">Loading shared model...</div>
            </div>
        );
    }

    if (notFound) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="text-center">
                    <div className="text-6xl mb-4">🔒</div>
                    <h1 className="text-2xl font-bold text-white mb-2">Model Not Found</h1>
                    <p className="text-white/40">This model doesn't exist or is no longer shared.</p>
                </div>
            </div>
        );
    }

    const metrics = modelData?.metrics || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl">
                <div className="max-w-4xl mx-auto px-6 py-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <div className="p-3 rounded-xl bg-gradient-to-br from-purple-500/20 to-blue-500/20 border border-white/10">
                                <FileText className="w-8 h-8 text-purple-400" />
                            </div>
                            <div>
                                <h1 className="text-2xl font-bold text-white">{modelData?.projectName}</h1>
                                <p className="text-sm text-white/40 flex items-center gap-2">
                                    <Share2 className="w-3 h-3" />
                                    Shared Model Card
                                </p>
                            </div>
                        </div>
                        <button
                            onClick={handleCopyLink}
                            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/10 hover:bg-white/15 text-white text-sm transition-all"
                        >
                            {copied ? (
                                <>
                                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                                    Copied!
                                </>
                            ) : (
                                <>
                                    <Copy className="w-4 h-4" />
                                    Copy Link
                                </>
                            )}
                        </button>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-4xl mx-auto px-6 py-8 space-y-6">
                {/* Overview */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10"
                >
                    <h2 className="text-lg font-bold text-white mb-4">Model Information</h2>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoCard label="Task Type" value={modelData?.taskType || 'Classification'} />
                        <InfoCard label="Target" value={modelData?.targetColumn || 'Not specified'} />
                        <InfoCard label="Version" value={`v${modelData?.latestVersion}`} />
                        <InfoCard label="Status" value="Trained" />
                    </div>
                </motion.div>

                {/* Metrics */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <TrendingUp className="w-5 h-5 text-green-400" />
                        <h2 className="text-lg font-bold text-white">Performance Metrics</h2>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <MetricCard
                            label="Accuracy"
                            value={metrics.accuracy}
                            format={(v) => `${(v * 100).toFixed(1)}%`}
                            color="#22c55e"
                        />
                        <MetricCard
                            label="Loss"
                            value={metrics.loss}
                            format={(v) => v.toFixed(4)}
                            color="#ef4444"
                        />
                        <MetricCard
                            label="RMSE"
                            value={metrics.rmse}
                            format={(v) => v.toFixed(4)}
                            color="#f97316"
                        />
                        <MetricCard
                            label="R²"
                            value={metrics.r2}
                            format={(v) => v.toFixed(3)}
                            color="#3b82f6"
                        />
                    </div>
                </motion.div>

                {/* Footer */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="text-center py-8 text-white/30 text-sm"
                >
                    <p>Powered by <span className="font-bold text-white/50">MLForge</span></p>
                    <p className="text-xs mt-1">Build ML models with AI assistance</p>
                </motion.div>
            </div>
        </div>
    );
}

function InfoCard({ label, value }: { label: string; value: string }) {
    return (
        <div className="p-4 rounded-xl bg-white/5">
            <div className="text-xs text-white/40 mb-1">{label}</div>
            <div className="text-sm font-medium text-white capitalize">{value}</div>
        </div>
    );
}

function MetricCard({ label, value, format, color }: { label: string; value?: number; format: (v: number) => string; color: string }) {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/5">
            <div className="text-xs text-white/40 mb-2">{label}</div>
            {value !== undefined && value !== null ? (
                <div className="text-2xl font-bold" style={{ color }}>{format(value)}</div>
            ) : (
                <div className="text-lg text-white/20">—</div>
            )}
        </div>
    );
}
