'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { BarChart3, TrendingUp, Clock, CheckCircle2, AlertCircle } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { useThemeColor } from '@/context/theme-context';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface ScriptVersion {
    id: string;
    version: number;
    createdAt: any;
    metricsSummary?: {
        accuracy?: number;
        loss?: number;
        rmse?: number;
        r2?: number;
        mae?: number;
    };
    trainingDuration?: number;
    generatedBy?: 'user' | 'ai';
}

interface ComparisonTabProps {
    projectId: string;
}

export function ComparisonTab({ projectId }: ComparisonTabProps) {
    const { themeColor } = useThemeColor();
    const [versions, setVersions] = useState<ScriptVersion[]>([]);
    const [selectedVersions, setSelectedVersions] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    // Fetch versions from Firestore
    useEffect(() => {
        if (!projectId) return;

        const q = query(
            collection(db, 'projects', projectId, 'scripts'),
            orderBy('version', 'desc')
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const versionData = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ScriptVersion[];
            setVersions(versionData);
            setLoading(false);

            // Auto-select first 3 versions with metrics
            if (selectedVersions.length === 0) {
                const withMetrics = versionData.filter(v => v.metricsSummary?.accuracy || v.metricsSummary?.rmse).slice(0, 3);
                setSelectedVersions(withMetrics.map(v => v.id));
            }
        });

        return () => unsubscribe();
    }, [projectId]);

    const toggleVersion = (versionId: string) => {
        setSelectedVersions(prev =>
            prev.includes(versionId)
                ? prev.filter(id => id !== versionId)
                : [...prev, versionId].slice(-5) // Max 5 versions
        );
    };

    // Prepare comparison data
    const comparisonData = useMemo(() => {
        return selectedVersions.map(vId => {
            const v = versions.find(ver => ver.id === vId);
            return {
                id: vId,
                version: v?.version || 0,
                label: `v${v?.version}`,
                accuracy: v?.metricsSummary?.accuracy ?? null,
                loss: v?.metricsSummary?.loss ?? null,
                rmse: v?.metricsSummary?.rmse ?? null,
                r2: v?.metricsSummary?.r2 ?? null,
                trainingDuration: v?.trainingDuration ?? null,
                generatedBy: v?.generatedBy || 'user'
            };
        }).sort((a, b) => a.version - b.version);
    }, [selectedVersions, versions]);

    // Find max values for scaling bars
    const maxAccuracy = Math.max(...comparisonData.map(d => d.accuracy || 0), 1);
    const maxLoss = Math.max(...comparisonData.map(d => d.loss || 0), 0.1);
    const maxRmse = Math.max(...comparisonData.map(d => d.rmse || 0), 0.1);
    const maxDuration = Math.max(...comparisonData.map(d => d.trainingDuration || 0), 60);

    const hasAnyMetrics = comparisonData.some(d => d.accuracy !== null || d.rmse !== null);

    if (loading) {
        return (
            <GlassCard className="p-6 h-full">
                <div className="flex items-center justify-center h-full">
                    <div className="animate-pulse text-white/30">Loading versions...</div>
                </div>
            </GlassCard>
        );
    }

    return (
        <GlassCard className="h-full overflow-hidden" hover={false}>
            <div className="h-full flex flex-col">
                {/* Header */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                    <div className="flex items-center gap-3">
                        <div className="p-2 rounded-xl" style={{ background: `${themeColor}20` }}>
                            <BarChart3 className="w-5 h-5" style={{ color: themeColor }} />
                        </div>
                        <div>
                            <h3 className="text-lg font-bold text-white">Models</h3>
                            <p className="text-xs text-white/40">Compare metrics across versions</p>
                        </div>
                    </div>
                    <span className="text-xs text-white/30">
                        {selectedVersions.length}/5 selected
                    </span>
                </div>

                {/* Version Selector */}
                <div className="px-6 py-4 border-b border-white/10">
                    <p className="text-xs text-white/40 mb-3">Select versions to compare (max 5)</p>
                    <div className="flex flex-wrap gap-2">
                        {versions.slice(0, 10).map(v => {
                            const isSelected = selectedVersions.includes(v.id);
                            const hasMetrics = v.metricsSummary?.accuracy || v.metricsSummary?.rmse;
                            return (
                                <motion.button
                                    key={v.id}
                                    onClick={() => toggleVersion(v.id)}
                                    whileHover={{ scale: 1.05 }}
                                    whileTap={{ scale: 0.95 }}
                                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${isSelected
                                        ? 'text-white'
                                        : hasMetrics
                                            ? 'bg-white/5 text-white/60 hover:bg-white/10'
                                            : 'bg-white/5 text-white/30 hover:bg-white/10'
                                        }`}
                                    style={isSelected ? {
                                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                                        boxShadow: `0 0 15px ${themeColor}40`
                                    } : {}}
                                >
                                    v{v.version}
                                    {!hasMetrics && <span className="ml-1 opacity-50">○</span>}
                                    {v.generatedBy === 'ai' && <span className="ml-1">🤖</span>}
                                </motion.button>
                            );
                        })}
                    </div>
                </div>

                {/* Charts */}
                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                    {!hasAnyMetrics && selectedVersions.length > 0 && (
                        <div className="flex items-center gap-3 p-4 rounded-xl bg-yellow-500/10 border border-yellow-500/30">
                            <AlertCircle className="w-5 h-5 text-yellow-400" />
                            <div>
                                <p className="text-sm text-yellow-400 font-medium">No metrics available</p>
                                <p className="text-xs text-yellow-400/60">Selected versions haven't been trained yet.</p>
                            </div>
                        </div>
                    )}

                    {selectedVersions.length === 0 && (
                        <div className="flex flex-col items-center justify-center h-full text-center">
                            <BarChart3 className="w-12 h-12 text-white/20 mb-4" />
                            <p className="text-white/40">Select versions above to compare</p>
                        </div>
                    )}

                    {hasAnyMetrics && (
                        <>
                            {/* Accuracy Chart */}
                            <ChartSection
                                title="Accuracy"
                                icon={<TrendingUp className="w-4 h-4" />}
                                data={comparisonData}
                                getValue={(d) => d.accuracy}
                                maxValue={maxAccuracy}
                                formatValue={(v) => `${(v * 100).toFixed(1)}%`}
                                color="#22c55e"
                                themeColor={themeColor}
                            />

                            {/* Loss Chart */}
                            <ChartSection
                                title="Loss"
                                icon={<TrendingUp className="w-4 h-4 rotate-180" />}
                                data={comparisonData}
                                getValue={(d) => d.loss}
                                maxValue={maxLoss}
                                formatValue={(v) => v.toFixed(4)}
                                color="#ef4444"
                                themeColor={themeColor}
                                invertColors
                            />

                            {/* RMSE Chart */}
                            <ChartSection
                                title="RMSE"
                                icon={<BarChart3 className="w-4 h-4" />}
                                data={comparisonData}
                                getValue={(d) => d.rmse}
                                maxValue={maxRmse}
                                formatValue={(v) => v.toFixed(4)}
                                color="#f97316"
                                themeColor={themeColor}
                                invertColors
                            />

                            {/* Training Duration Chart */}
                            <ChartSection
                                title="Training Duration"
                                icon={<Clock className="w-4 h-4" />}
                                data={comparisonData}
                                getValue={(d) => d.trainingDuration}
                                maxValue={maxDuration}
                                formatValue={(v) => `${Math.round(v)}s`}
                                color="#3b82f6"
                                themeColor={themeColor}
                            />
                        </>
                    )}
                </div>
            </div>
        </GlassCard>
    );
}

// Reusable Chart Section Component
function ChartSection({
    title,
    icon,
    data,
    getValue,
    maxValue,
    formatValue,
    color,
    themeColor,
    invertColors = false
}: {
    title: string;
    icon: React.ReactNode;
    data: any[];
    getValue: (d: any) => number | null;
    maxValue: number;
    formatValue: (v: number) => string;
    color: string;
    themeColor: string;
    invertColors?: boolean;
}) {
    const hasData = data.some(d => getValue(d) !== null);

    if (!hasData) return null;

    return (
        <div className="rounded-xl p-4 bg-white/5 border border-white/10">
            <div className="flex items-center gap-2 mb-4" style={{ color }}>
                {icon}
                <span className="text-sm font-medium text-white">{title}</span>
            </div>
            <div className="space-y-3">
                {data.map((d, i) => {
                    const value = getValue(d);
                    if (value === null) return null;

                    const percentage = (value / maxValue) * 100;

                    return (
                        <div key={d.id} className="flex items-center gap-3">
                            <span className="text-xs text-white/60 w-8">{d.label}</span>
                            <div className="flex-1 h-6 bg-white/5 rounded-lg overflow-hidden relative">
                                <motion.div
                                    initial={{ width: 0 }}
                                    animate={{ width: `${Math.min(percentage, 100)}%` }}
                                    transition={{ duration: 0.6, delay: i * 0.1 }}
                                    className="absolute inset-y-0 left-0 rounded-lg"
                                    style={{
                                        background: `linear-gradient(90deg, ${color}, ${color}80)`,
                                        boxShadow: `0 0 10px ${color}40`
                                    }}
                                />
                                <div className="absolute inset-0 flex items-center px-3">
                                    <span className="text-xs font-medium text-white drop-shadow-lg">
                                        {formatValue(value)}
                                    </span>
                                </div>
                            </div>
                            {d.generatedBy === 'ai' && (
                                <span className="text-xs">🤖</span>
                            )}
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

export default ComparisonTab;
