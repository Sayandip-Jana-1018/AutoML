'use client';

import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Cpu, Layers, Hash, Gauge, Sparkles, Settings2, Zap,
    ChevronDown, ChevronUp, DollarSign, Clock, Server, Gpu,
    FileText, HardDrive, Info
} from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';
import { RESOURCE_POLICIES, MACHINE_TYPE_INFO, type SubscriptionTier } from '@/lib/resource-policy';
// Use client-safe configs (no Node.js dependencies like fs)
import { COMPUTE_ENGINE_CONFIGS, routeTraining, detectDatasetType, estimateTrainingTime as estimateTabularTime, type DatasetType } from '@/lib/training-configs';
import { estimateImageTrainingTime } from '@/lib/image-dataset-processor';

export interface TrainingConfig {
    machineType: string;
    epochs: number;
    batchSize: number;
    learningRate: number;
    trees: number;
    preferGPU?: boolean;
}

interface TrainingConfigOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userTier: SubscriptionTier;
    config: TrainingConfig;
    onConfigChange: (config: TrainingConfig) => void;
    onStartTraining: () => void;
    datasetFilename?: string;
    datasetSizeMB?: number;
    datasetImageCount?: number;
    taskType?: string;
    // Content-based detection: if any column is 'image', treat as image dataset
    columnTypes?: Record<string, string>;
}

export const TrainingConfigOverlay = ({
    isOpen,
    onClose,
    userTier,
    config,
    onConfigChange,
    onStartTraining,
    datasetFilename = 'dataset.csv',
    datasetSizeMB = 5,
    datasetImageCount,
    taskType = 'classification',
    columnTypes
}: TrainingConfigOverlayProps) => {
    const { themeColor } = useThemeColor();
    const limits = RESOURCE_POLICIES[userTier];
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Detect dataset type and compute routing
    const datasetType: DatasetType = useMemo(() => {
        // Priority 1: Backend's taskType (most reliable)
        if (taskType && taskType.toLowerCase().includes('image')) return 'image';
        // Priority 2: Content-based detection via columnTypes (from schema profiler)
        if (columnTypes && Object.values(columnTypes).some(t => t === 'image')) return 'image';
        // Priority 3: Filename-based detection (fallback)
        return detectDatasetType(datasetFilename);
    }, [datasetFilename, taskType, columnTypes]);

    const routeDecision = useMemo(() => routeTraining({
        tier: userTier,
        datasetType,
        taskType,
        datasetSizeMB,
        userPreference: config.preferGPU ? 'gpu' : 'cpu'
    }), [userTier, datasetType, taskType, datasetSizeMB, config.preferGPU]);

    const timeEstimate = useMemo(() => {
        if (datasetType === 'image') {
            // Estimate image count if not provided (approx 100KB per image)
            const count = datasetImageCount || Math.ceil((datasetSizeMB * 1024 * 1024) / 102400);

            const estimate = estimateImageTrainingTime(
                datasetSizeMB,
                count,
                routeDecision.backend,
                config.epochs
            );

            // Parse "X-Y" string to min/max numbers for cost calc
            const [min, max] = estimate.estimatedMinutes.split('–').map(s => parseInt(s));
            return {
                minMinutes: min || 15,
                maxMinutes: max || 60,
                phases: estimate.phases
            };
        } else {
            return estimateTabularTime({
                datasetSizeMB,
                datasetType,
                backend: routeDecision.backend,
                epochs: config.epochs
            });
        }
    }, [datasetSizeMB, datasetType, routeDecision.backend, config.epochs, datasetImageCount]);

    // Calculate estimated cost
    const estimatedCost = useMemo(() => {
        const hours = timeEstimate.maxMinutes / 60;
        return (hours * routeDecision.estimatedCostPerHour).toFixed(2);
    }, [timeEstimate, routeDecision]);

    const handleChange = (key: keyof TrainingConfig, value: number | string | boolean) => {
        onConfigChange({ ...config, [key]: value });
    };

    // Tier badge colors
    const tierColors: Record<SubscriptionTier, string> = {
        free: '#6b7280',
        silver: '#94a3b8',
        gold: '#fbbf24'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Panel - Full screen on mobile, centered on desktop */}
                    <motion.div
                        initial={{ opacity: 0, x: "-50%", y: "-45%", scale: 0.95 }}
                        animate={{ opacity: 1, x: "-50%", y: "-50%", scale: 1 }}
                        exit={{ opacity: 0, x: "-50%", y: "-45%", scale: 0.95 }}
                        transition={{ type: 'spring', damping: 30, stiffness: 350 }}
                        className="fixed inset-4 md:inset-auto md:top-1/2 md:left-[20%] md:w-[420px] md:max-h-[90vh] z-50 bg-white/60 dark:bg-black/60 
                        backdrop-blur-xl border border-black/10 dark:border-white/10 
                        rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{
                            boxShadow: `0 0 60px ${themeColor}20`,
                        }}
                    >

                        {/* Header */}
                        <div className="relative flex flex-col items-center justify-center px-5 py-4 border-b border-black/10 dark:border-white/10">
                            <div className="flex flex-col items-center gap-1">
                                <h2 className="font-bold text-lg text-black dark:text-white tracking-tight">Start Training</h2>
                                <span
                                    className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full font-medium"
                                    style={{
                                        backgroundColor: `${tierColors[userTier]}20`,
                                        color: tierColors[userTier]
                                    }}
                                >
                                    {userTier} tier
                                </span>
                            </div>
                            <button
                                onClick={onClose}
                                className="absolute right-4 top-4 p-2 rounded-lg hover:bg-black/10 dark:hover:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Dataset & Backend Info */}
                            <div className="px-5 py-4 bg-black/5 dark:bg-white/[0.02] border-b border-black/5 dark:border-white/5">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Dataset Info */}
                                    <div className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                                            <span className="text-[10px] text-black/40 dark:text-white/40 uppercase">Dataset</span>
                                        </div>
                                        <p className="text-sm text-black dark:text-white font-medium truncate">{datasetFilename}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-black/50 dark:text-white/50">{datasetSizeMB.toFixed(1)} MB</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-black/10 dark:bg-white/10 text-black/60 dark:text-white/60">
                                                {datasetType}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Backend Info */}
                                    <div className="p-3 rounded-xl bg-white/50 dark:bg-white/5 border border-black/10 dark:border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Server className="w-3.5 h-3.5 text-black/40 dark:text-white/40" />
                                            <span className="text-[10px] text-black/40 dark:text-white/40 uppercase">Backend</span>
                                        </div>
                                        <p className="text-sm text-black dark:text-white font-medium">
                                            {routeDecision.backend === 'gcp-compute-engine' ? 'Google Cloud' : 'RunPod GPU'}
                                        </p>
                                        <p className="text-xs text-black/50 dark:text-white/50 mt-1">{routeDecision.specs}</p>
                                    </div>
                                </div>

                                {/* GPU Toggle (Gold tier only) */}
                                {userTier === 'gold' && (datasetType === 'image' || taskType === 'image_classification') && (
                                    <div className="mt-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/10">
                                        <label className="flex items-center justify-between cursor-pointer">
                                            <div className="flex items-center gap-2">
                                                <Gpu className="w-4 h-4 text-amber-400" />
                                                <span className="text-sm text-white">Enable GPU Training</span>
                                                <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-400">
                                                    Recommended
                                                </span>
                                            </div>
                                            <button
                                                onClick={() => handleChange('preferGPU', !config.preferGPU)}
                                                className={`relative w-11 h-6 rounded-full transition-colors ${config.preferGPU ? 'bg-amber-500' : 'bg-white/20'
                                                    }`}
                                            >
                                                <span className={`absolute top-1 w-4 h-4 bg-white rounded-full transition-transform ${config.preferGPU ? 'left-6' : 'left-1'
                                                    }`} />
                                            </button>
                                        </label>
                                    </div>
                                )}
                            </div>

                            {/* GPU Upgrade Nudge (Free/Silver on Image Dataset) */}
                            {userTier !== 'gold' && datasetType === 'image' && (
                                <div className="mx-5 mb-4 p-4 rounded-xl bg-gradient-to-r from-amber-500/10 to-amber-600/5 border border-amber-500/20">
                                    <div className="flex items-start gap-3">
                                        <div className="p-2 rounded-lg bg-amber-500/20">
                                            <Gpu className="w-5 h-5 text-amber-400" />
                                        </div>
                                        <div>
                                            <h4 className="text-sm font-bold text-amber-400 mb-1">Slow Training Warning</h4>
                                            <p className="text-xs text-white/70 mb-2">
                                                Image training on CPU (Free/Silver) is very slow (~10-20 hours).
                                                Upgrade to Gold for GPU training (~45 mins).
                                            </p>
                                            {/* Link or button to pricing could go here */}
                                        </div>
                                    </div>
                                </div>
                            )}

                            {/* Pricing Summary */}
                            <div className="px-5 py-3 bg-gradient-to-r from-green-500/10 to-transparent border-b border-black/5 dark:border-white/5">
                                <div className="flex items-center justify-center gap-6">
                                    <div className="flex items-center gap-1.5">
                                        <DollarSign className="w-4 h-4 text-green-400" />
                                        <span className="text-sm text-white/70">Est. Cost:</span>
                                        <span className="text-lg font-bold text-green-400">${estimatedCost}</span>
                                    </div>
                                    <div className="flex items-center gap-1.5">
                                        <Clock className="w-4 h-4 text-blue-400" />
                                        <span className="text-sm text-white/70">Time:</span>
                                        <span className="text-sm font-medium text-blue-400">
                                            {timeEstimate.minMinutes}-{timeEstimate.maxMinutes} min
                                        </span>
                                    </div>
                                </div>
                            </div>

                            {/* Advanced Toggle */}
                            <button
                                onClick={() => setShowAdvanced(!showAdvanced)}
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-black/5 dark:bg-white/[0.02] hover:bg-black/10 dark:hover:bg-white/[0.04] transition-colors border-b border-black/5 dark:border-white/5"
                            >
                                <span className="text-xs text-black/60 dark:text-white/60 font-medium">
                                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                                </span>
                                {showAdvanced ? (
                                    <ChevronUp className="w-4 h-4 text-black/40 dark:text-white/40" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-black/40 dark:text-white/40" />
                                )}
                            </button>

                            {/* Advanced Config Options */}
                            <AnimatePresence>
                                {showAdvanced && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        transition={{ duration: 0.2 }}
                                        className="overflow-hidden"
                                    >
                                        <div className="p-5 space-y-5 border-b border-white/5">
                                            {/* Machine Type - Only show for CPU (GCP) backend */}
                                            {routeDecision.backend === 'gcp-compute-engine' && (
                                                <div className="space-y-4 pt-2 pl-2">
                                                    <label className="flex items-center justify-center gap-2 text-sm font-bold text-white/80 uppercase tracking-wide">
                                                        <Cpu className="w-4 h-4" style={{ color: themeColor }} />
                                                        Machine Type
                                                    </label>
                                                    <div className="grid grid-cols-1 gap-3 max-w-[90%] mx-auto">
                                                        {limits.allowedMachineTypes.slice(0, 3).map((machine) => {
                                                            const info = MACHINE_TYPE_INFO[machine];
                                                            const isSelected = config.machineType === machine;
                                                            const ceConfig = COMPUTE_ENGINE_CONFIGS[userTier];
                                                            return (
                                                                <button
                                                                    key={machine}
                                                                    onClick={() => handleChange('machineType', machine)}
                                                                    className={`p-4 rounded-2xl border text-center transition-all ${isSelected
                                                                        ? 'border-white/30 bg-white/10 shadow-lg scale-[1.02]'
                                                                        : 'border-white/10 bg-white/5 hover:bg-white/10 hover:scale-[1.01]'
                                                                        }`}
                                                                    style={isSelected ? { borderColor: `${themeColor}60`, boxShadow: `0 0 15px ${themeColor}20` } : {}}
                                                                >
                                                                    <div className="flex flex-col items-center justify-center gap-1">
                                                                        <div className="flex items-center gap-2">
                                                                            <span className="text-sm font-bold text-white tracking-wide">{info?.name || machine}</span>
                                                                        </div>
                                                                        <div className="flex items-center gap-2 text-[10px] text-white/50 uppercase tracking-widest">
                                                                            <span>{info?.specs || machine}</span>
                                                                            <span className="w-1 h-1 rounded-full bg-white/20" />
                                                                            <span>${ceConfig.costPerHour.toFixed(2)}/hr</span>
                                                                        </div>
                                                                    </div>
                                                                </button>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* GPU Instance Info - Only show for RunPod backend */}
                                            {routeDecision.backend === 'runpod' && (
                                                <div className="space-y-3 pt-2">
                                                    <label className="flex items-center justify-center gap-2 text-sm font-bold text-amber-400 uppercase tracking-wide">
                                                        <Gpu className="w-4 h-4" />
                                                        GPU Instance
                                                    </label>
                                                    <div className="p-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 text-center">
                                                        <p className="text-sm font-bold text-white">{routeDecision.gpuType || 'RTX 4000 Ada'}</p>
                                                        <p className="text-[10px] text-white/50 uppercase tracking-widest mt-1">
                                                            {routeDecision.specs}
                                                        </p>
                                                        <p className="text-xs text-amber-400/80 mt-2">
                                                            ${routeDecision.estimatedCostPerHour.toFixed(2)}/hr • Auto-provisioned
                                                        </p>
                                                    </div>
                                                </div>
                                            )}

                                            {/* Epochs */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                                                    <span className="flex items-center gap-2">
                                                        <Layers className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                        Epochs
                                                    </span>
                                                    <span className="text-white font-mono">{config.epochs}</span>
                                                </label>
                                                <input
                                                    type="range"
                                                    min={5}
                                                    max={Math.min(limits.maxEpochs, 200)}
                                                    value={config.epochs}
                                                    onChange={(e) => handleChange('epochs', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                                    style={{ accentColor: themeColor }}
                                                />
                                                <div className="flex justify-between text-[10px] text-white/30">
                                                    <span>5</span>
                                                    <span>Max: {Math.min(limits.maxEpochs, 200)}</span>
                                                </div>
                                            </div>

                                            {/* Batch Size */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                                                    <Hash className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                    Batch Size
                                                </label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[16, 32, 64, 128].filter(b => b <= limits.maxBatchSize).map((size) => (
                                                        <button
                                                            key={size}
                                                            onClick={() => handleChange('batchSize', size)}
                                                            className={`py-2 rounded-lg text-xs font-mono transition-all ${config.batchSize === size
                                                                ? 'bg-white/20 text-white'
                                                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                                                                }`}
                                                            style={config.batchSize === size ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                                        >
                                                            {size}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Learning Rate */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                                                    <Gauge className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                    Learning Rate
                                                </label>
                                                <div className="grid grid-cols-4 gap-2">
                                                    {[0.001, 0.01, 0.1, 0.5].map((rate) => (
                                                        <button
                                                            key={rate}
                                                            onClick={() => handleChange('learningRate', rate)}
                                                            className={`py-2 rounded-lg text-xs font-mono transition-all ${config.learningRate === rate
                                                                ? 'bg-white/20 text-white'
                                                                : 'bg-white/5 text-white/50 hover:bg-white/10'
                                                                }`}
                                                            style={config.learningRate === rate ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                                        >
                                                            {rate}
                                                        </button>
                                                    ))}
                                                </div>
                                            </div>

                                            {/* Trees */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                                                    <span className="flex items-center gap-2">
                                                        <Sparkles className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                        Max Trees
                                                    </span>
                                                    <span className="text-white font-mono">{config.trees}</span>
                                                </label>
                                                <input
                                                    type="range"
                                                    min={10}
                                                    max={limits.maxTrees}
                                                    step={10}
                                                    value={config.trees}
                                                    onChange={(e) => handleChange('trees', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                                    style={{ accentColor: themeColor }}
                                                />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        {/* Footer */}
                        <div className="p-4 border-t border-white/10 bg-black/40 flex flex-col gap-3">
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => {
                                    onClose();
                                    onStartTraining();
                                }}
                                className="w-full py-3.5 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all shadow-lg"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}80, ${themeColor}, ${themeColor}80)`,
                                    boxShadow: `0 4px 20px ${themeColor}40`
                                }}
                            >
                                <Zap className="w-4 h-4" />
                                Start Training
                            </motion.button>

                            <div className="flex items-center justify-between mt-2">
                                <p className="text-[10px] text-white/30 text-left leading-tight">
                                    {routeDecision.backend === 'gcp-compute-engine'
                                        ? 'Powered by Google Cloud Compute Engine'
                                        : 'Powered by RunPod GPU Cloud'
                                    }
                                </p>
                                <div className="flex flex-col items-end">
                                    <span className="text-sm font-bold text-green-400 bg-green-400/10 px-3 py-1 rounded-lg border border-green-400/20 shadow-sm">
                                        Total: ${estimatedCost}
                                    </span>
                                </div>
                            </div>
                        </div>

                    </motion.div >
                </>
            )
            }
        </AnimatePresence >
    );
};

// Floating trigger button
interface TrainingConfigTriggerProps {
    onClick: () => void;
    themeColor: string;
}

export const TrainingConfigTrigger = ({ onClick, themeColor }: TrainingConfigTriggerProps) => {
    return (
        <motion.button
            initial={{ x: 10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={onClick}
            className="fixed left-8 bottom-32 z-40 p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-lg transition-all hover:bg-white/10"
            style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                boxShadow: `0 8px 32px ${themeColor}60, 0 0 60px ${themeColor}30`,
            }}
            title="Training Configuration"
        >
            <Settings2 className="w-5 h-5" />
        </motion.button>
    );
};

export default TrainingConfigOverlay;
