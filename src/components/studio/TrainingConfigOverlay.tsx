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
import { COMPUTE_ENGINE_CONFIGS, routeTraining, detectDatasetType, estimateTrainingTime, type DatasetType } from '@/lib/training-configs';

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
    taskType?: string;
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
    taskType = 'classification'
}: TrainingConfigOverlayProps) => {
    const { themeColor } = useThemeColor();
    const limits = RESOURCE_POLICIES[userTier];
    const [showAdvanced, setShowAdvanced] = useState(false);

    // Detect dataset type and compute routing
    const datasetType: DatasetType = useMemo(() => detectDatasetType(datasetFilename), [datasetFilename]);

    const routeDecision = useMemo(() => routeTraining({
        tier: userTier,
        datasetType,
        taskType,
        datasetSizeMB,
        userPreference: config.preferGPU ? 'gpu' : 'cpu'
    }), [userTier, datasetType, taskType, datasetSizeMB, config.preferGPU]);

    const timeEstimate = useMemo(() => estimateTrainingTime({
        datasetSizeMB,
        datasetType,
        backend: routeDecision.backend,
        epochs: config.epochs
    }), [datasetSizeMB, datasetType, routeDecision.backend, config.epochs]);

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

                    {/* Panel - Vertically centered */}
                    <motion.div
                        initial={{ opacity: 0, x: 50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed z-50 w-[420px] max-h-[80vh] bg-[#0a0a0a]/95 
                        backdrop-blur-xl border border-white/10 
                        rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{
                            boxShadow: `0 0 60px ${themeColor}20`,
                            top: '11%',
                            left: '8%',
                            transform: 'translate(0%, 50%)'
                        }}
                    >

                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${themeColor}20` }}
                                >
                                    <Zap className="w-5 h-5" style={{ color: themeColor }} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white">Start Training</h2>
                                    <div className="flex items-center gap-2">
                                        <span
                                            className="text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-full"
                                            style={{
                                                backgroundColor: `${tierColors[userTier]}20`,
                                                color: tierColors[userTier]
                                            }}
                                        >
                                            {userTier} tier
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Scrollable Content */}
                        <div className="flex-1 overflow-y-auto">
                            {/* Dataset & Backend Info */}
                            <div className="px-5 py-4 bg-white/[0.02] border-b border-white/5">
                                <div className="grid grid-cols-2 gap-3">
                                    {/* Dataset Info */}
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <FileText className="w-3.5 h-3.5 text-white/40" />
                                            <span className="text-[10px] text-white/40 uppercase">Dataset</span>
                                        </div>
                                        <p className="text-sm text-white font-medium truncate">{datasetFilename}</p>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs text-white/50">{datasetSizeMB} MB</span>
                                            <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/10 text-white/60">
                                                {datasetType}
                                            </span>
                                        </div>
                                    </div>

                                    {/* Backend Info */}
                                    <div className="p-3 rounded-xl bg-white/5 border border-white/10">
                                        <div className="flex items-center gap-2 mb-1">
                                            <Server className="w-3.5 h-3.5 text-white/40" />
                                            <span className="text-[10px] text-white/40 uppercase">Backend</span>
                                        </div>
                                        <p className="text-sm text-white font-medium">
                                            {routeDecision.backend === 'gcp-compute-engine' ? 'Google Cloud' : 'RunPod GPU'}
                                        </p>
                                        <p className="text-xs text-white/50 mt-1">{routeDecision.specs}</p>
                                    </div>
                                </div>

                                {/* GPU Toggle (Gold tier only) */}
                                {userTier === 'gold' && datasetType === 'image' && (
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

                            {/* Pricing Summary */}
                            <div className="px-5 py-3 bg-gradient-to-r from-green-500/10 to-transparent border-b border-white/5">
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
                                className="w-full flex items-center justify-center gap-2 px-5 py-3 bg-white/[0.02] hover:bg-white/[0.04] transition-colors border-b border-white/5"
                            >
                                <span className="text-xs text-white/60 font-medium">
                                    {showAdvanced ? 'Hide' : 'Show'} Advanced Options
                                </span>
                                {showAdvanced ? (
                                    <ChevronUp className="w-4 h-4 text-white/40" />
                                ) : (
                                    <ChevronDown className="w-4 h-4 text-white/40" />
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
                                            {/* Machine Type */}
                                            <div className="space-y-2">
                                                <label className="flex items-center justify-center gap-2 text-xs font-medium text-white/60">
                                                    <Cpu className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                    Machine Type
                                                </label>
                                                <div className="grid grid-cols-1 gap-2">
                                                    {limits.allowedMachineTypes.slice(0, 3).map((machine) => {
                                                        const info = MACHINE_TYPE_INFO[machine];
                                                        const isSelected = config.machineType === machine;
                                                        const ceConfig = COMPUTE_ENGINE_CONFIGS[userTier];
                                                        return (
                                                            <button
                                                                key={machine}
                                                                onClick={() => handleChange('machineType', machine)}
                                                                className={`p-3 rounded-xl border text-center transition-all ${isSelected
                                                                    ? 'border-white/30 bg-white/10'
                                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                                                    }`}
                                                                style={isSelected ? { borderColor: `${themeColor}50` } : {}}
                                                            >
                                                                <div className="flex items-center justify-center gap-2 mb-1">
                                                                    <span className="text-xs font-medium text-white">{info?.name || machine}</span>
                                                                    <span className="text-[10px] text-white/40">
                                                                        ${ceConfig.costPerHour.toFixed(2)}/hr
                                                                    </span>
                                                                </div>
                                                                <span className="text-[10px] text-white/40">{info?.specs || machine}</span>
                                                            </button>
                                                        );
                                                    })}
                                                </div>
                                            </div>

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
                                                    min={1}
                                                    max={limits.maxEpochs}
                                                    value={config.epochs}
                                                    onChange={(e) => handleChange('epochs', parseInt(e.target.value))}
                                                    className="w-full h-2 bg-white/10 rounded-full appearance-none cursor-pointer"
                                                    style={{ accentColor: themeColor }}
                                                />
                                                <div className="flex justify-between text-[10px] text-white/30">
                                                    <span>1</span>
                                                    <span>Max: {limits.maxEpochs}</span>
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
                        <div className="p-4 border-t border-white/10 bg-black/40">
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
                                <span className="text-xs opacity-70 ml-1">
                                    (~${estimatedCost})
                                </span>
                            </motion.button>
                            <p className="text-center text-[10px] text-white/30 mt-2">
                                {routeDecision.backend === 'gcp-compute-engine'
                                    ? 'Powered by Google Cloud Compute Engine'
                                    : 'Powered by RunPod GPU Cloud'
                                }
                            </p>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
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
            style={{ boxShadow: `0 0 15px ${themeColor}20` }}
            title="Training Configuration"
        >
            <Settings2 className="w-5 h-5" style={{ color: themeColor }} />
        </motion.button>
    );
};

export default TrainingConfigOverlay;
