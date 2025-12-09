'use client';

import React from 'react';
import { motion } from 'framer-motion';
import { Check, X, Loader2, Upload, Database, FileCode, Eye, Play, Trophy, AlertCircle } from 'lucide-react';

// Timeline step configuration
export interface TimelineStep {
    id: number;
    label: string;
    description?: string;
    icon: React.ReactNode;
}

// Default ML workflow steps with colorful icons
export const ML_WORKFLOW_STEPS: TimelineStep[] = [
    { id: 0, label: 'Upload File', description: 'Select dataset', icon: <Upload className="w-4 h-4 text-cyan-400" /> },
    { id: 1, label: 'GCS Upload', description: 'Uploading to cloud', icon: <Database className="w-4 h-4 text-blue-400" /> },
    { id: 2, label: 'Schema Profiling', description: 'Analyzing columns', icon: <Database className="w-4 h-4 text-purple-400" /> },
    { id: 3, label: 'Config Generated', description: 'Cleaning config ready', icon: <FileCode className="w-4 h-4 text-orange-400" /> },
    { id: 4, label: 'Script Generated', description: 'train.py created', icon: <FileCode className="w-4 h-4 text-yellow-400" /> },
    { id: 5, label: 'Review Pipeline', description: 'User review', icon: <Eye className="w-4 h-4 text-pink-400" /> },
    { id: 6, label: 'Training Started', description: 'Model training', icon: <Play className="w-4 h-4 text-green-400" /> },
    { id: 7, label: 'Model Saved', description: 'Versioned & ready', icon: <Trophy className="w-4 h-4 text-amber-400" /> },
];

export interface WorkflowTimelineProps {
    currentStep: number;
    status: 'pending' | 'success' | 'error';
    errorMessage?: string;
    themeColor: string;
    steps?: TimelineStep[];
    className?: string;
}

export function WorkflowTimeline({
    currentStep,
    status,
    errorMessage,
    themeColor,
    steps = ML_WORKFLOW_STEPS,
    className = ''
}: WorkflowTimelineProps) {
    return (
        <div className={`relative ${className}`}>
            {/* Vertical line */}
            <div className="absolute left-4 top-4 bottom-4 w-0.5 bg-white/10" />

            <div className="space-y-4">
                {steps.map((step, index) => {
                    const isCompleted = index < currentStep;
                    const isCurrent = index === currentStep;
                    const isPending = index > currentStep;
                    const isError = isCurrent && status === 'error';

                    return (
                        <motion.div
                            key={step.id}
                            initial={{ opacity: 0, x: -10 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="relative flex items-start gap-4 pl-1"
                        >
                            {/* Step indicator */}
                            <div
                                className={`
                                    relative z-10 w-7 h-7 rounded-full flex items-center justify-center
                                    transition-all duration-300
                                    ${isCompleted ? 'bg-green-500' : ''}
                                    ${isCurrent && !isError ? 'ring-2 ring-offset-2 ring-offset-black' : ''}
                                    ${isError ? 'bg-red-500' : ''}
                                    ${isPending ? 'bg-white/10' : ''}
                                `}
                                style={{
                                    backgroundColor: isCurrent && !isError ? themeColor : undefined,
                                    boxShadow: isCurrent && !isError ? `0 0 10px ${themeColor}50` : undefined,
                                }}
                            >
                                {isCompleted && <Check className="w-3.5 h-3.5 text-white" />}
                                {isCurrent && !isError && (
                                    <motion.div
                                        animate={{ scale: [1, 1.2, 1] }}
                                        transition={{ duration: 1.5, repeat: Infinity }}
                                    >
                                        <Loader2 className="w-3.5 h-3.5 text-white animate-spin" />
                                    </motion.div>
                                )}
                                {isError && <X className="w-3.5 h-3.5 text-white" />}
                                {isPending && (
                                    <span className="text-white/40">{step.icon}</span>
                                )}
                            </div>

                            {/* Step content */}
                            <div className="flex-1 min-w-0 pt-0.5">
                                <div className={`
                                    text-sm font-medium transition-colors
                                    ${isCompleted ? 'text-green-400' : ''}
                                    ${isCurrent && !isError ? 'text-white' : ''}
                                    ${isError ? 'text-red-400' : ''}
                                    ${isPending ? 'text-white/40' : ''}
                                `}>
                                    {step.label}
                                </div>
                                {step.description && (
                                    <div className="text-xs text-white/40 mt-0.5">
                                        {step.description}
                                    </div>
                                )}
                                {isError && errorMessage && (
                                    <div className="flex items-center gap-1 text-xs text-red-400 mt-1">
                                        <AlertCircle className="w-3 h-3" />
                                        {errorMessage}
                                    </div>
                                )}
                            </div>
                        </motion.div>
                    );
                })}
            </div>
        </div>
    );
}

export default WorkflowTimeline;
