"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Settings,
    Cpu,
    Layers,
    Zap,
    AlertTriangle,
    Info,
    CheckCircle2,
    XCircle
} from "lucide-react";
import { RESOURCE_POLICIES, type SubscriptionTier } from "@/lib/resource-policy";
import { type CleaningConfig, DEFAULT_CLEANING_CONFIG } from "@/lib/data-cleaning";

interface ModelConfigPanelProps {
    tier: SubscriptionTier;
    taskType: 'classification' | 'regression' | 'unknown';
    onConfigChange?: (config: ModelConfig) => void;
    className?: string;
}

export interface ModelConfig {
    algorithm: string;
    epochs: number;
    trees: number;
    learningRate: number;
    testSize: number;
    machineType: string;
    cleaningConfig: CleaningConfig;
}

const ALGORITHMS = {
    classification: [
        { value: 'RandomForest', label: 'Random Forest', icon: '🌲' },
        { value: 'XGBoost', label: 'XGBoost', icon: '⚡' },
        { value: 'LogisticRegression', label: 'Logistic Regression', icon: '📈' },
        { value: 'SVM', label: 'Support Vector Machine', icon: '🎯' },
        { value: 'KNN', label: 'K-Nearest Neighbors', icon: '📍' },
        { value: 'DecisionTree', label: 'Decision Tree', icon: '🌳' },
        { value: 'GradientBoosting', label: 'Gradient Boosting', icon: '🚀' },
        { value: 'NeuralNetwork', label: 'Neural Network', icon: '🧠' },
    ],
    regression: [
        { value: 'RandomForest', label: 'Random Forest', icon: '🌲' },
        { value: 'XGBoost', label: 'XGBoost', icon: '⚡' },
        { value: 'LinearRegression', label: 'Linear/Ridge Regression', icon: '📉' },
        { value: 'SVR', label: 'Support Vector Regression', icon: '🎯' },
        { value: 'KNN', label: 'K-Nearest Neighbors', icon: '📍' },
        { value: 'DecisionTree', label: 'Decision Tree', icon: '🌳' },
        { value: 'GradientBoosting', label: 'Gradient Boosting', icon: '🚀' },
        { value: 'NeuralNetwork', label: 'Neural Network', icon: '🧠' },
    ],
};

export function ModelConfigPanel({
    tier,
    taskType,
    onConfigChange,
    className = ""
}: ModelConfigPanelProps) {
    const limits = RESOURCE_POLICIES[tier];
    const algorithms = taskType === 'regression' ? ALGORITHMS.regression : ALGORITHMS.classification;

    const [config, setConfig] = useState<ModelConfig>({
        algorithm: 'RandomForest',
        epochs: 50,
        trees: 100,
        learningRate: 0.1,
        testSize: 0.2,
        machineType: limits.allowedMachineTypes[0],
        cleaningConfig: {
            ...DEFAULT_CLEANING_CONFIG,
            taskType: taskType === 'unknown' ? 'classification' : taskType
        }
    });

    const [validationErrors, setValidationErrors] = useState<string[]>([]);

    // Validate config against tier limits
    useEffect(() => {
        const errors: string[] = [];

        if (config.epochs > limits.maxEpochs) {
            errors.push(`Epochs (${config.epochs}) exceeds ${tier} limit (${limits.maxEpochs})`);
        }
        if (config.trees > limits.maxTrees) {
            errors.push(`Trees (${config.trees}) exceeds ${tier} limit (${limits.maxTrees})`);
        }
        if (!limits.allowedAlgorithms.includes(config.algorithm)) {
            errors.push(`${config.algorithm} not available on ${tier} plan`);
        }
        if (!limits.allowedMachineTypes.includes(config.machineType)) {
            errors.push(`Machine ${config.machineType} not allowed on ${tier} plan`);
        }

        setValidationErrors(errors);

        if (errors.length === 0 && onConfigChange) {
            onConfigChange(config);
        }
    }, [config, tier, limits, onConfigChange]);

    const updateConfig = <K extends keyof ModelConfig>(key: K, value: ModelConfig[K]) => {
        setConfig(prev => ({ ...prev, [key]: value }));
    };

    const isAlgorithmAllowed = (algo: string) => limits.allowedAlgorithms.includes(algo);

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className={`rounded-2xl bg-black/20 dark:bg-white/5 backdrop-blur-xl border border-white/10 p-6 ${className}`}
        >
            {/* Header */}
            <div className="flex items-center gap-3 mb-6">
                <div className="p-2 rounded-lg bg-blue-500/20">
                    <Settings className="w-5 h-5 text-blue-400" />
                </div>
                <div>
                    <h3 className="text-lg font-semibold text-white">Model Configuration</h3>
                    <p className="text-sm text-gray-400">
                        Task: <span className="text-blue-400 capitalize">{taskType}</span> •
                        Tier: <span className="text-purple-400 capitalize">{tier}</span>
                    </p>
                </div>
            </div>

            {/* Validation Errors */}
            {validationErrors.length > 0 && (
                <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    className="mb-4 p-4 rounded-xl bg-red-500/10 border border-red-500/20"
                >
                    <div className="flex items-center gap-2 text-red-400 mb-2">
                        <AlertTriangle className="w-4 h-4" />
                        <span className="font-medium">Configuration Issues</span>
                    </div>
                    <ul className="text-sm text-red-300 space-y-1">
                        {validationErrors.map((error, i) => (
                            <li key={i}>• {error}</li>
                        ))}
                    </ul>
                </motion.div>
            )}

            {/* Algorithm Selection */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    <Layers className="w-4 h-4 inline mr-2" />
                    Algorithm
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {algorithms.map(algo => {
                        const allowed = isAlgorithmAllowed(algo.value);
                        const selected = config.algorithm === algo.value;
                        return (
                            <button
                                key={algo.value}
                                onClick={() => allowed && updateConfig('algorithm', algo.value)}
                                disabled={!allowed}
                                className={`
                                    relative p-3 rounded-xl text-left transition-all
                                    ${selected
                                        ? 'bg-blue-500/20 border-blue-500/50'
                                        : allowed
                                            ? 'bg-white/5 border-white/10 hover:bg-white/10'
                                            : 'bg-gray-500/10 border-gray-500/20 opacity-50 cursor-not-allowed'
                                    }
                                    border
                                `}
                            >
                                <div className="flex items-center gap-2">
                                    <span className="text-lg">{algo.icon}</span>
                                    <span className={`text-sm font-medium ${selected ? 'text-blue-300' : 'text-gray-300'}`}>
                                        {algo.label}
                                    </span>
                                </div>
                                {!allowed && (
                                    <span className="absolute top-1 right-1 text-xs px-1.5 py-0.5 rounded bg-gray-500/30 text-gray-400">
                                        💎 Upgrade
                                    </span>
                                )}
                                {selected && (
                                    <CheckCircle2 className="absolute top-2 right-2 w-4 h-4 text-blue-400" />
                                )}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Hyperparameters */}
            <div className="grid grid-cols-2 gap-4 mb-6">
                {/* Epochs */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Epochs
                        <span className="text-gray-500 ml-1">(max {limits.maxEpochs})</span>
                    </label>
                    <input
                        type="number"
                        value={config.epochs}
                        onChange={(e) => updateConfig('epochs', parseInt(e.target.value) || 0)}
                        min={1}
                        max={limits.maxEpochs}
                        className={`
                            w-full px-4 py-2.5 rounded-xl bg-white/5 border
                            ${config.epochs > limits.maxEpochs
                                ? 'border-red-500/50 focus:border-red-500'
                                : 'border-white/10 focus:border-blue-500/50'
                            }
                            text-white text-sm focus:outline-none transition-colors
                        `}
                    />
                </div>

                {/* Trees */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Trees/Estimators
                        <span className="text-gray-500 ml-1">(max {limits.maxTrees})</span>
                    </label>
                    <input
                        type="number"
                        value={config.trees}
                        onChange={(e) => updateConfig('trees', parseInt(e.target.value) || 0)}
                        min={1}
                        max={limits.maxTrees}
                        className={`
                            w-full px-4 py-2.5 rounded-xl bg-white/5 border
                            ${config.trees > limits.maxTrees
                                ? 'border-red-500/50 focus:border-red-500'
                                : 'border-white/10 focus:border-blue-500/50'
                            }
                            text-white text-sm focus:outline-none transition-colors
                        `}
                    />
                </div>

                {/* Learning Rate */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Learning Rate
                    </label>
                    <input
                        type="number"
                        value={config.learningRate}
                        onChange={(e) => updateConfig('learningRate', parseFloat(e.target.value) || 0.1)}
                        step={0.01}
                        min={0.001}
                        max={1}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors"
                    />
                </div>

                {/* Test Size */}
                <div>
                    <label className="block text-sm font-medium text-gray-300 mb-2">
                        Test Split
                    </label>
                    <select
                        value={config.testSize}
                        onChange={(e) => updateConfig('testSize', parseFloat(e.target.value))}
                        className="w-full px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm focus:outline-none focus:border-blue-500/50 transition-colors appearance-none"
                    >
                        <option value={0.1}>90/10</option>
                        <option value={0.2}>80/20</option>
                        <option value={0.25}>75/25</option>
                        <option value={0.3}>70/30</option>
                    </select>
                </div>
            </div>

            {/* Machine Type */}
            <div className="mb-6">
                <label className="block text-sm font-medium text-gray-300 mb-3">
                    <Cpu className="w-4 h-4 inline mr-2" />
                    Machine Type
                </label>
                <div className="grid grid-cols-2 gap-2">
                    {['e2-standard-2', 'e2-standard-4', 'e2-standard-8', 'e2-standard-16'].map(machine => {
                        const allowed = limits.allowedMachineTypes.includes(machine);
                        const selected = config.machineType === machine;
                        return (
                            <button
                                key={machine}
                                onClick={() => allowed && updateConfig('machineType', machine)}
                                disabled={!allowed}
                                className={`
                                    p-3 rounded-xl text-sm font-mono transition-all
                                    ${selected
                                        ? 'bg-purple-500/20 border-purple-500/50 text-purple-300'
                                        : allowed
                                            ? 'bg-white/5 border-white/10 text-gray-400 hover:bg-white/10'
                                            : 'bg-gray-500/10 border-gray-500/20 text-gray-500 opacity-50 cursor-not-allowed'
                                    }
                                    border
                                `}
                            >
                                {machine}
                            </button>
                        );
                    })}
                </div>
            </div>

            {/* Cleaning Options */}
            <div className="p-4 rounded-xl bg-white/5 border border-white/10">
                <h4 className="text-sm font-medium text-gray-300 mb-3 flex items-center gap-2">
                    <Zap className="w-4 h-4 text-yellow-400" />
                    Data Cleaning Options
                </h4>
                <div className="space-y-3">
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.cleaningConfig.dropHighMissingCols}
                            onChange={(e) => updateConfig('cleaningConfig', {
                                ...config.cleaningConfig,
                                dropHighMissingCols: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-gray-300">Drop columns with &gt;50% missing</span>
                    </label>
                    <label className="flex items-center gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.cleaningConfig.removeOutliers}
                            onChange={(e) => updateConfig('cleaningConfig', {
                                ...config.cleaningConfig,
                                removeOutliers: e.target.checked
                            })}
                            className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                        />
                        <span className="text-sm text-gray-300">Remove outliers (IQR method)</span>
                    </label>
                    {taskType === 'classification' && (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.cleaningConfig.handleClassImbalance || false}
                                onChange={(e) => updateConfig('cleaningConfig', {
                                    ...config.cleaningConfig,
                                    handleClassImbalance: e.target.checked
                                })}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                            />
                            <span className="text-sm text-gray-300">Handle class imbalance</span>
                        </label>
                    )}
                    {taskType === 'regression' && (
                        <label className="flex items-center gap-3 cursor-pointer">
                            <input
                                type="checkbox"
                                checked={config.cleaningConfig.normalizeTarget || false}
                                onChange={(e) => updateConfig('cleaningConfig', {
                                    ...config.cleaningConfig,
                                    normalizeTarget: e.target.checked
                                })}
                                className="w-4 h-4 rounded border-white/20 bg-white/5 text-blue-500 focus:ring-blue-500/50"
                            />
                            <span className="text-sm text-gray-300">Normalize target variable</span>
                        </label>
                    )}
                </div>
            </div>

            {/* Tier Info */}
            <div className="mt-4 p-3 rounded-xl bg-blue-500/10 border border-blue-500/20">
                <div className="flex items-start gap-2">
                    <Info className="w-4 h-4 text-blue-400 mt-0.5" />
                    <div className="text-xs text-blue-300">
                        <strong className="capitalize">{tier}</strong> tier limits:
                        {limits.maxEpochs} epochs, {limits.maxTrees} trees, {limits.maxTrainingHours}h max
                    </div>
                </div>
            </div>
        </motion.div>
    );
}

export default ModelConfigPanel;
