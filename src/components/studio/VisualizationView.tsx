'use client';

import React, { useState } from 'react';
import { TrendingUp, Target, BarChart3, AlertCircle, CheckCircle, Loader2, Globe, Lock } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Job } from './types';
import { motion } from 'framer-motion';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface VisualizationViewProps {
    jobs: Job[];
    themeColor?: string;
    modelId?: string;
    currentVisibility?: 'public' | 'private';
    onVisibilityChange?: (newVisibility: 'public' | 'private') => void;
}

export const VisualizationView = ({
    jobs,
    themeColor = '#22c55e',
    modelId,
    currentVisibility = 'private',
    onVisibilityChange
}: VisualizationViewProps) => {
    const latestJob = jobs[0];
    const [visibility, setVisibility] = useState<'public' | 'private'>(currentVisibility);
    const [updatingVisibility, setUpdatingVisibility] = useState(false);

    const handleVisibilityToggle = async () => {
        if (!modelId) return;
        const newVisibility = visibility === 'public' ? 'private' : 'public';
        setUpdatingVisibility(true);
        try {
            await updateDoc(doc(db, 'models', modelId), { visibility: newVisibility });
            setVisibility(newVisibility);
            onVisibilityChange?.(newVisibility);
        } catch (error) {
            console.error('Failed to update visibility:', error);
        } finally {
            setUpdatingVisibility(false);
        }
    };

    // Use latest job metrics
    const displayMetrics = latestJob?.metrics;

    // Metric display component with smaller text
    const MetricCard = ({
        label,
        value,
        color = themeColor,
        icon: Icon = TrendingUp,
        format = 'percent'
    }: {
        label: string;
        value?: number;
        color?: string;
        icon?: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
        format?: 'percent' | 'decimal' | 'none';
    }) => (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="relative p-3 rounded-xl overflow-hidden group"
            style={{
                background: `linear-gradient(135deg, ${color}15 0%, rgba(0,0,0,0.3) 100%)`,
                border: `1px solid ${color}30`
            }}
        >
            {/* Glow effect */}
            <motion.div
                className="absolute inset-0 opacity-0 group-hover:opacity-100 transition-opacity"
                style={{ background: `radial-gradient(circle at center, ${color}20 0%, transparent 70%)` }}
            />

            <div className="relative flex items-center gap-2">
                <div
                    className="p-1.5 rounded-lg"
                    style={{ background: `${color}20` }}
                >
                    <Icon className="w-3 h-3" style={{ color }} />
                </div>
                <div>
                    <div className="text-[9px] uppercase tracking-wider text-white/40 font-medium">{label}</div>
                    <div className="text-xs font-bold text-white">
                        {value !== undefined && value !== null
                            ? format === 'percent'
                                ? `${(value * 100).toFixed(1)}%`
                                : format === 'decimal'
                                    ? value.toFixed(4)
                                    : value
                            : 'N/A'
                        }
                    </div>
                </div>
            </div>
        </motion.div>
    );

    return (
        <GlassCard className="h-full flex flex-col" hover={false}>
            {/* Custom scrollbar styles */}
            <style dangerouslySetInnerHTML={{
                __html: `
                #journey-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                #journey-scroll::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }
                #journey-scroll::-webkit-scrollbar-thumb {
                    background: ${themeColor}40;
                    border-radius: 4px;
                }
                #journey-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${themeColor}80;
                }
            `}} />

            <div
                id="journey-scroll"
                className="flex-1 p-4"
                style={{
                    overflow: 'auto',
                    scrollbarWidth: 'thin',
                    scrollbarColor: `${themeColor}40 rgba(0,0,0,0.2)`,
                }}
            >
                {/* Latest Job Metrics Dashboard */}
                {displayMetrics ? (
                    <div className="space-y-3">
                        {/* Header - Simplified, no dropdown */}
                        <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <div
                                    className="p-2 rounded-xl"
                                    style={{ background: `${themeColor}20` }}
                                >
                                    <BarChart3 className="w-4 h-4" style={{ color: themeColor }} />
                                </div>
                                <div>
                                    <h3 className="text-xs font-bold text-white">Model Metrics</h3>
                                    <p className="text-[9px] text-white/40 mt-0.5">Currently Loaded Version</p>
                                </div>
                            </div>

                            {/* Visibility Toggle */}
                            {modelId && (
                                <div className="flex items-center gap-2 group relative">
                                    <button
                                        onClick={handleVisibilityToggle}
                                        disabled={updatingVisibility}
                                        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[9px] font-bold transition-all ${visibility === 'public'
                                            ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                                            : 'bg-white/10 text-white/60 border border-white/20'
                                            }`}
                                    >
                                        {updatingVisibility ? (
                                            <Loader2 className="w-2.5 h-2.5 animate-spin" />
                                        ) : visibility === 'public' ? (
                                            <Globe className="w-2.5 h-2.5" />
                                        ) : (
                                            <Lock className="w-2.5 h-2.5" />
                                        )}
                                        {visibility === 'public' ? 'Public' : 'Private'}
                                    </button>

                                    {/* Tooltip */}
                                    <div className="absolute right-0 top-full mt-2 w-40 p-2 rounded-lg bg-black/90 border border-white/10 text-[9px] text-white/70 opacity-0 group-hover:opacity-100 transition-opacity z-50 pointer-events-none">
                                        <div className="font-bold text-white text-[10px] mb-0.5">
                                            {visibility === 'public' ? '🌐 Public' : '🔒 Private'}
                                        </div>
                                        {visibility === 'public' ? (
                                            <p>Visible on Marketplace</p>
                                        ) : (
                                            <p>Only you can view</p>
                                        )}
                                    </div>
                                </div>
                            )}
                        </div>
                        <div className="w-full h-px bg-white/10 my-1.5" />

                        {/* Metrics Grid - Dynamic based on model type */}
                        <div className="grid grid-cols-2 gap-2">
                            {/* Classification Metrics */}
                            {(displayMetrics.accuracy !== undefined || displayMetrics.precision !== undefined) && (
                                <>
                                    <MetricCard
                                        label="Accuracy"
                                        value={displayMetrics.accuracy}
                                        color="#22c55e"
                                        icon={Target}
                                    />
                                    <MetricCard
                                        label="Precision"
                                        value={displayMetrics.precision}
                                        color="#3b82f6"
                                        icon={CheckCircle}
                                    />
                                    <MetricCard
                                        label="Recall"
                                        value={displayMetrics.recall}
                                        color="#8b5cf6"
                                        icon={TrendingUp}
                                    />
                                    <MetricCard
                                        label="F1 Score"
                                        value={displayMetrics.f1}
                                        color="#f59e0b"
                                        icon={BarChart3}
                                    />
                                </>
                            )}

                            {/* Clustering Metrics - Show for clustering models */}
                            {displayMetrics.silhouette !== undefined && (
                                <>
                                    <MetricCard
                                        label="Silhouette Score"
                                        value={displayMetrics.silhouette}
                                        color="#22c55e"
                                        icon={Target}
                                    />
                                    {displayMetrics.inertia !== undefined && (
                                        <MetricCard
                                            label="Inertia"
                                            value={displayMetrics.inertia}
                                            color="#3b82f6"
                                            icon={BarChart3}
                                            format="decimal"
                                        />
                                    )}
                                    {displayMetrics.davies_bouldin !== undefined && (
                                        <MetricCard
                                            label="Davies-Bouldin"
                                            value={displayMetrics.davies_bouldin}
                                            color="#8b5cf6"
                                            icon={TrendingUp}
                                            format="decimal"
                                        />
                                    )}
                                    {displayMetrics.calinski_harabasz !== undefined && (
                                        <MetricCard
                                            label="Calinski-Harabasz"
                                            value={displayMetrics.calinski_harabasz}
                                            color="#f59e0b"
                                            icon={CheckCircle}
                                            format="decimal"
                                        />
                                    )}
                                </>
                            )}

                            {/* Regression Metrics */}
                            {(displayMetrics.rmse !== undefined || displayMetrics.r2 !== undefined || displayMetrics.mae !== undefined) && (
                                <>
                                    {displayMetrics.r2 !== undefined && (
                                        <MetricCard
                                            label="R² Score"
                                            value={displayMetrics.r2}
                                            color="#22c55e"
                                            icon={Target}
                                        />
                                    )}
                                    {displayMetrics.rmse !== undefined && (
                                        <MetricCard
                                            label="RMSE"
                                            value={displayMetrics.rmse}
                                            color="#ef4444"
                                            icon={AlertCircle}
                                            format="decimal"
                                        />
                                    )}
                                    {displayMetrics.mae !== undefined && (
                                        <MetricCard
                                            label="MAE"
                                            value={displayMetrics.mae}
                                            color="#3b82f6"
                                            icon={BarChart3}
                                            format="decimal"
                                        />
                                    )}
                                    {displayMetrics.mse !== undefined && (
                                        <MetricCard
                                            label="MSE"
                                            value={displayMetrics.mse}
                                            color="#8b5cf6"
                                            icon={TrendingUp}
                                            format="decimal"
                                        />
                                    )}
                                </>
                            )}

                            {displayMetrics.log_loss !== undefined && (
                                <div className="col-span-2">
                                    <MetricCard
                                        label="Log Loss"
                                        value={displayMetrics.log_loss}
                                        color="#ef4444"
                                        icon={AlertCircle}
                                        format="decimal"
                                    />
                                </div>
                            )}
                        </div>

                        {/* Confusion Matrix (if available) - Smaller */}
                        {displayMetrics.confusion_matrix && (
                            <div className="space-y-2">
                                <h4 className="text-[10px] font-semibold text-white/60">Confusion Matrix</h4>
                                <div className="p-3 rounded-xl" style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)' }}>
                                    <div className="grid gap-1" style={{
                                        gridTemplateColumns: `repeat(${displayMetrics.confusion_matrix.length}, 1fr)`
                                    }}>
                                        {displayMetrics.confusion_matrix.map((row: number[], i: number) => (
                                            row.map((cell: number, j: number) => (
                                                <motion.div
                                                    key={`${i}-${j}`}
                                                    initial={{ opacity: 0, scale: 0.8 }}
                                                    animate={{ opacity: 1, scale: 1 }}
                                                    transition={{ delay: (i * row.length + j) * 0.05 }}
                                                    className="p-2 rounded-lg text-center font-bold text-xs"
                                                    style={{
                                                        background: i === j
                                                            ? `${themeColor}40`
                                                            : 'rgba(255,255,255,0.05)',
                                                        color: i === j ? themeColor : 'rgba(255,255,255,0.6)'
                                                    }}
                                                >
                                                    {cell}
                                                </motion.div>
                                            ))
                                        ))}
                                    </div>
                                    <div className="mt-2 flex justify-between text-[8px] text-white/30">
                                        <span>Predicted →</span>
                                        <span>Actual ↓</span>
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                ) : latestJob && ['running', 'provisioning'].includes(latestJob.status) ? (
                    /* Training in Progress */
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                        <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                        >
                            <Loader2 className="w-12 h-12 text-yellow-500" />
                        </motion.div>
                        <p className="mt-4 text-white/60 text-xs">Training in progress...</p>
                        <p className="text-white/40 text-[10px] mt-1">Metrics will appear when training completes</p>
                    </div>
                ) : latestJob && latestJob.status === 'failed' ? (
                    /* Training Failed */
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                        <AlertCircle className="w-12 h-12 text-red-400" />
                        <p className="mt-4 text-white/60 text-xs">Training Failed</p>
                        <p className="text-white/40 text-[10px] mt-1">Check terminal for error details</p>
                    </div>
                ) : (
                    /* No Jobs */
                    <div className="flex flex-col items-center justify-center h-full py-12 text-center">
                        <BarChart3 className="w-12 h-12 text-white/20" />
                        <p className="mt-4 text-white/40 text-xs">No training results yet</p>
                        <p className="text-white/30 text-[10px] mt-1">Run training to see metrics and visualizations</p>
                    </div>
                )}
            </div>
        </GlassCard>
    );
};

export default VisualizationView;
