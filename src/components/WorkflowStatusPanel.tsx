'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { CheckCircle2, Circle, Loader2, XCircle, Upload, Database, Settings, Code2, Play, Award, Rocket } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface WorkflowStep {
    id: number;
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface WorkflowStatusPanelProps {
    currentStep: number;
    status: 'pending' | 'success' | 'error';
    errorMessage?: string;
    isMinimized?: boolean;
    onToggle?: () => void;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    { id: 1, label: 'Upload File', description: 'Dataset uploaded', icon: <Upload className="w-4 h-4" /> },
    { id: 2, label: 'Schema Profiling', description: 'Columns analyzed', icon: <Database className="w-4 h-4" /> },
    { id: 3, label: 'Config Generated', description: 'Cleaning ready', icon: <Settings className="w-4 h-4" /> },
    { id: 4, label: 'Script Generated', description: 'train.py created', icon: <Code2 className="w-4 h-4" /> },
    { id: 5, label: 'Training Started', description: 'Model training', icon: <Play className="w-4 h-4" /> },
    { id: 6, label: 'Training Complete', description: 'Metrics ready', icon: <Award className="w-4 h-4" /> },
    { id: 7, label: 'Model Deployed', description: 'API endpoint live', icon: <Rocket className="w-4 h-4" /> },
];

export default function WorkflowStatusPanel({
    currentStep,
    status,
    errorMessage,
    isMinimized = false,
    onToggle
}: WorkflowStatusPanelProps) {
    const { themeColor } = useThemeColor();

    const getStepStatus = (stepId: number) => {
        if (status === 'error' && stepId === currentStep) return 'error';
        if (stepId < currentStep) return 'complete';
        if (stepId === currentStep) return status === 'pending' ? 'active' : 'complete';
        return 'pending';
    };

    const getStepColor = (stepStatus: string) => {
        switch (stepStatus) {
            case 'complete': return themeColor;
            case 'active': return '#FBBF24'; // amber
            case 'error': return '#EF4444'; // red
            default: return 'rgba(255,255,255,0.2)';
        }
    };

    const getStepIcon = (step: WorkflowStep, stepStatus: string) => {
        switch (stepStatus) {
            case 'complete':
                return <CheckCircle2 className="w-5 h-5" style={{ color: themeColor }} />;
            case 'active':
                return <Loader2 className="w-5 h-5 animate-spin text-amber-400" />;
            case 'error':
                return <XCircle className="w-5 h-5 text-red-400" />;
            default:
                return <Circle className="w-5 h-5 text-white/20" />;
        }
    };

    if (currentStep < 1) return null;

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4"
        >
            <div className="flex items-center justify-between mb-4">
                <h3 className="text-sm font-bold text-white flex items-center gap-2">
                    <span
                        className="w-2 h-2 rounded-full animate-pulse"
                        style={{ background: status === 'error' ? '#EF4444' : themeColor }}
                    />
                    Workflow Progress
                </h3>
                <span className="text-xs text-white/40">{currentStep}/7</span>
            </div>

            <div className="space-y-1">
                {WORKFLOW_STEPS.map((step, index) => {
                    const stepStatus = getStepStatus(step.id);
                    const isLast = index === WORKFLOW_STEPS.length - 1;

                    return (
                        <div key={step.id} className="flex items-start gap-3">
                            {/* Vertical Line + Icon */}
                            <div className="flex flex-col items-center">
                                <div className="relative">
                                    {getStepIcon(step, stepStatus)}
                                </div>
                                {!isLast && (
                                    <div
                                        className="w-0.5 h-6 mt-1 rounded-full transition-all duration-500"
                                        style={{
                                            background: stepStatus === 'complete' ? themeColor : 'rgba(255,255,255,0.1)'
                                        }}
                                    />
                                )}
                            </div>

                            {/* Step Content */}
                            <div className="flex-1 pb-2">
                                <div
                                    className={`text-sm font-medium transition-colors ${stepStatus === 'complete' ? 'text-white' :
                                            stepStatus === 'active' ? 'text-amber-400' :
                                                stepStatus === 'error' ? 'text-red-400' :
                                                    'text-white/30'
                                        }`}
                                >
                                    {step.label}
                                </div>
                                {stepStatus === 'error' && errorMessage && step.id === currentStep ? (
                                    <div className="text-xs text-red-400/80 mt-0.5 line-clamp-2">
                                        {errorMessage}
                                    </div>
                                ) : (
                                    <div className={`text-xs ${stepStatus === 'pending' ? 'text-white/20' : 'text-white/50'}`}>
                                        {step.description}
                                    </div>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </motion.div>
    );
}
