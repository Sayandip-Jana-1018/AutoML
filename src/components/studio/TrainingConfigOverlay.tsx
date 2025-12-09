'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Cpu, Layers, Hash, Gauge, Sparkles, Settings2, Zap } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';
import { RESOURCE_POLICIES, MACHINE_TYPE_INFO, type SubscriptionTier } from '@/lib/resource-policy';

export interface TrainingConfig {
    machineType: string;
    epochs: number;
    batchSize: number;
    learningRate: number;
    trees: number;
}

interface TrainingConfigOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    userTier: SubscriptionTier;
    config: TrainingConfig;
    onConfigChange: (config: TrainingConfig) => void;
    onStartTraining: () => void;
}

export const TrainingConfigOverlay = ({
    isOpen,
    onClose,
    userTier,
    config,
    onConfigChange,
    onStartTraining
}: TrainingConfigOverlayProps) => {
    const { themeColor } = useThemeColor();
    const limits = RESOURCE_POLICIES[userTier];

    const handleChange = (key: keyof TrainingConfig, value: number | string) => {
        onConfigChange({ ...config, [key]: value });
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

                    {/* Panel */}
                    <motion.div
                        initial={{ opacity: 0, x: 50, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 50, scale: 0.95 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed left-8 top-24 -translate-y-1/2 z-50 w-[380px] max-h-[80vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-5 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${themeColor}20` }}
                                >
                                    <Settings2 className="w-5 h-5" style={{ color: themeColor }} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white">Training Config</h2>
                                    <span className="text-[10px] text-white/40 uppercase tracking-wider">
                                        {userTier} tier
                                    </span>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Config Options */}
                        <div className="flex-1 overflow-y-auto p-5 space-y-5">
                            {/* Machine Type */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-white/60">
                                    <Cpu className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                    Machine Type
                                </label>
                                <div className="grid grid-cols-1 gap-2">
                                    {limits.allowedMachineTypes.map((machine) => {
                                        const info = MACHINE_TYPE_INFO[machine];
                                        const isSelected = config.machineType === machine;
                                        return (
                                            <button
                                                key={machine}
                                                onClick={() => handleChange('machineType', machine)}
                                                className={`p-3 rounded-xl border text-left transition-all ${isSelected
                                                    ? 'border-white/30 bg-white/10'
                                                    : 'border-white/10 bg-white/5 hover:bg-white/10'
                                                    }`}
                                                style={isSelected ? { borderColor: `${themeColor}50` } : {}}
                                            >
                                                <div className="flex items-center justify-between">
                                                    <span className="text-xs font-medium text-white">{info?.name || machine}</span>
                                                    {isSelected && (
                                                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: themeColor }} />
                                                    )}
                                                </div>
                                                <span className="text-[10px] text-white/40">{info?.specs || machine}</span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </div>

                            {/* Epochs */}
                            <div className="space-y-2">
                                <label className="flex items-center justify-between text-xs font-medium text-white/60">
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
                                    style={{
                                        accentColor: themeColor
                                    }}
                                />
                                <div className="flex justify-between text-[10px] text-white/30">
                                    <span>1</span>
                                    <span>Max: {limits.maxEpochs}</span>
                                </div>
                            </div>

                            {/* Batch Size */}
                            <div className="space-y-2">
                                <label className="flex items-center gap-2 text-xs font-medium text-white/60">
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
                                <label className="flex items-center gap-2 text-xs font-medium text-white/60">
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

                            {/* Trees (for tree-based models) */}
                            <div className="space-y-2">
                                <label className="flex items-center justify-between text-xs font-medium text-white/60">
                                    <span className="flex items-center gap-2">
                                        <Sparkles className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                        Max Trees (Random Forest/XGBoost)
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
                                <div className="flex justify-between text-[10px] text-white/30">
                                    <span>10</span>
                                    <span>Max: {limits.maxTrees}</span>
                                </div>
                            </div>
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
                                className="w-full py-3 rounded-xl text-white font-bold text-sm flex items-center justify-center gap-2 transition-all"
                                style={{ background: `linear-gradient(135deg, ${themeColor}60, ${themeColor}, ${themeColor}60)` }}
                            >
                                <Zap className="w-4 h-4" />
                                Start Training
                            </motion.button>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Floating trigger button (right side)
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
            className="fixed left-8 bottom-32 -translate-y-1/2 z-40 p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-lg transition-all hover:bg-white/10"
            style={{ boxShadow: `0 0 15px ${themeColor}20` }}
            title="Training Configuration"
        >
            <Settings2 className="w-5 h-5" style={{ color: themeColor }} />
        </motion.button>
    );
};

export default TrainingConfigOverlay;
