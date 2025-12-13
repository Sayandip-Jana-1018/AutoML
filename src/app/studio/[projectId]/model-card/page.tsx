'use client';

import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { FileText, Download, Share2, TrendingUp, Settings, History, AlertTriangle, Clock, Cpu, Database, ArrowLeft } from 'lucide-react';
import { doc, getDoc, collection, query, orderBy, limit, getDocs } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useThemeColor } from '@/context/theme-context';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

interface ModelCardProps {
    params: Promise<{ projectId: string }>;
}

interface ProjectData {
    name: string;
    taskType: string;
    targetColumn?: string;
    datasetGcsPath?: string;
    createdAt?: any;
}

interface VersionData {
    id?: string;
    version: number;
    createdAt?: any;
    generatedBy?: 'user' | 'ai';
    metricsSummary?: {
        accuracy?: number;
        loss?: number;
        rmse?: number;
        r2?: number;
    };
    config?: any;
}

interface JobData {
    status: string;
    completedAt?: any;
    config?: {
        machineType?: string;
        tier?: string;
    };
    metrics?: any;
}

export default function ModelCardPage({ params }: ModelCardProps) {
    const { themeColor } = useThemeColor();
    const router = useRouter();
    const [projectId, setProjectId] = useState<string>('');
    const [project, setProject] = useState<ProjectData | null>(null);
    const [latestVersion, setLatestVersion] = useState<VersionData | null>(null);
    const [versions, setVersions] = useState<VersionData[]>([]);
    const [latestJob, setLatestJob] = useState<JobData | null>(null);
    const [loading, setLoading] = useState(true);

    // Resolve params
    useEffect(() => {
        params.then(p => setProjectId(p.projectId));
    }, [params]);

    // Fetch data
    useEffect(() => {
        if (!projectId) return;

        const fetchData = async () => {
            try {
                // Get project
                const projectDoc = await getDoc(doc(db, 'projects', projectId));
                if (projectDoc.exists()) {
                    setProject(projectDoc.data() as ProjectData);
                }

                // Get versions
                const versionsQuery = query(
                    collection(db, 'projects', projectId, 'scripts'),
                    orderBy('version', 'desc'),
                    limit(10)
                );
                const versionsSnap = await getDocs(versionsQuery);
                const versionsData = versionsSnap.docs.map(d => ({ id: d.id, ...d.data() })) as VersionData[];
                setVersions(versionsData);
                if (versionsData.length > 0) {
                    setLatestVersion(versionsData[0]);
                }

                // Get latest job
                const jobsQuery = query(
                    collection(db, 'projects', projectId, 'jobs'),
                    orderBy('createdAt', 'desc'),
                    limit(1)
                );
                const jobsSnap = await getDocs(jobsQuery);
                if (!jobsSnap.empty) {
                    setLatestJob(jobsSnap.docs[0].data() as JobData);
                }
            } catch (error) {
                console.error('Error fetching model card data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [projectId]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'N/A';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900 flex items-center justify-center">
                <div className="animate-pulse text-white/30">Loading model card...</div>
            </div>
        );
    }

    const metrics = latestVersion?.metricsSummary || latestJob?.metrics || {};

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/40 backdrop-blur-xl sticky top-0 z-10">
                <div className="max-w-5xl mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <Link
                                href={`/studio/${projectId}`}
                                className="p-2 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <ArrowLeft className="w-5 h-5 text-white/60" />
                            </Link>
                            <div>
                                <h1 className="text-xl font-bold text-white">{project?.name || 'Model'}</h1>
                                <p className="text-xs text-white/40">Model Card</p>
                            </div>
                        </div>
                        <div className="flex items-center gap-2">
                            <button
                                onClick={() => window.print()}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg bg-white/5 hover:bg-white/10 text-white/70 hover:text-white text-sm transition-all"
                            >
                                <Download className="w-4 h-4" />
                                Export
                            </button>
                            <button
                                onClick={() => navigator.clipboard.writeText(window.location.href)}
                                className="flex items-center gap-2 px-4 py-2 rounded-lg text-white text-sm transition-all"
                                style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                            >
                                <Share2 className="w-4 h-4" />
                                Share
                            </button>
                        </div>
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-5xl mx-auto px-6 py-8 space-y-6">
                {/* Overview Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl" style={{ background: `${themeColor}20` }}>
                            <FileText className="w-6 h-6" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Model Overview</h2>
                            <p className="text-sm text-white/40">Key information about this model</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <InfoItem label="Task Type" value={project?.taskType || 'Classification'} />
                        <InfoItem label="Target Column" value={project?.targetColumn || 'Not set'} />
                        <InfoItem label="Latest Version" value={`v${latestVersion?.version || 1}`} />
                        <InfoItem label="Last Updated" value={formatDate(latestVersion?.createdAt)} />
                    </div>
                </motion.div>

                {/* Metrics Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-green-500/20">
                            <TrendingUp className="w-6 h-6 text-green-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Performance Metrics</h2>
                            <p className="text-sm text-white/40">Evaluation results from latest training</p>
                        </div>
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

                {/* Training Config Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-blue-500/20">
                            <Settings className="w-6 h-6 text-blue-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Training Configuration</h2>
                            <p className="text-sm text-white/40">Infrastructure and settings used</p>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <InfoItem label="Machine Type" value={latestJob?.config?.machineType || 'n1-standard-4'} icon={<Cpu className="w-4 h-4" />} />
                        <InfoItem label="Tier" value={latestJob?.config?.tier || 'free'} icon={<Database className="w-4 h-4" />} />
                        <InfoItem label="Status" value={latestJob?.status || 'N/A'} icon={<Clock className="w-4 h-4" />} />
                    </div>
                </motion.div>

                {/* Version History Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.3 }}
                    className="rounded-2xl p-6 bg-white/5 border border-white/10 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-3 mb-6">
                        <div className="p-3 rounded-xl bg-purple-500/20">
                            <History className="w-6 h-6 text-purple-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Version History</h2>
                            <p className="text-sm text-white/40">Recent script versions</p>
                        </div>
                    </div>
                    <div className="space-y-2">
                        {versions.slice(0, 5).map((v, i) => (
                            <div
                                key={i}
                                className="flex items-center justify-between p-3 rounded-xl bg-white/5 hover:bg-white/10 transition-colors"
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-sm font-medium text-white">v{v.version}</span>
                                    {v.generatedBy === 'ai' && (
                                        <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">AI</span>
                                    )}
                                </div>
                                <div className="flex items-center gap-4 text-xs text-white/40">
                                    {v.metricsSummary?.accuracy && (
                                        <span className="text-green-400">{(v.metricsSummary.accuracy * 100).toFixed(1)}%</span>
                                    )}
                                    <span>{formatDate(v.createdAt)}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </motion.div>

                {/* Limitations Card */}
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.4 }}
                    className="rounded-2xl p-6 bg-yellow-500/5 border border-yellow-500/20 backdrop-blur-xl"
                >
                    <div className="flex items-center gap-3 mb-4">
                        <div className="p-3 rounded-xl bg-yellow-500/20">
                            <AlertTriangle className="w-6 h-6 text-yellow-400" />
                        </div>
                        <div>
                            <h2 className="text-lg font-bold text-white">Limitations & Biases</h2>
                            <p className="text-sm text-white/40">Important considerations</p>
                        </div>
                    </div>
                    <ul className="space-y-2 text-sm text-white/60">
                        <li>• Model trained on provided dataset and may not generalize to different distributions</li>
                        <li>• Edge cases not represented in training data may produce unexpected results</li>
                        <li>• Not optimized for real-time inference with strict latency requirements</li>
                        <li>• Performance metrics may vary based on data preprocessing applied</li>
                    </ul>
                </motion.div>
            </div>
        </div>
    );
}

// Helper Components
function InfoItem({ label, value, icon }: { label: string; value: string; icon?: React.ReactNode }) {
    return (
        <div className="p-3 rounded-xl bg-white/5">
            <div className="flex items-center gap-2 text-xs text-white/40 mb-1">
                {icon}
                {label}
            </div>
            <div className="text-sm font-medium text-white capitalize">{value}</div>
        </div>
    );
}

function MetricCard({ label, value, format, color }: { label: string; value?: number; format: (v: number) => string; color: string }) {
    return (
        <div className="p-4 rounded-xl bg-white/5 border border-white/10">
            <div className="text-xs text-white/40 mb-2">{label}</div>
            {value !== undefined && value !== null ? (
                <div className="text-2xl font-bold" style={{ color }}>{format(value)}</div>
            ) : (
                <div className="text-lg text-white/20">—</div>
            )}
        </div>
    );
}
