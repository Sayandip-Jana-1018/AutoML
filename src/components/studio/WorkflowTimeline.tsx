'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Loader2, XCircle, Upload, Database, Settings, Code2, Play, Award, Rocket } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface WorkflowStep {
    id: number;
    label: string;
    description: string;
    icon: React.ReactNode;
}

interface WorkflowTimelineProps {
    currentStep: number;
    status: 'pending' | 'success' | 'error';
    errorMessage?: string;
}

const WORKFLOW_STEPS: WorkflowStep[] = [
    { id: 1, label: 'Upload', description: 'Dataset uploaded', icon: <Upload className="w-4 h-4" /> },
    { id: 2, label: 'Schema', description: 'Columns analyzed', icon: <Database className="w-4 h-4" /> },
    { id: 3, label: 'Config', description: 'Cleaning config ready', icon: <Settings className="w-4 h-4" /> },
    { id: 4, label: 'Script', description: 'train.py generated', icon: <Code2 className="w-4 h-4" /> },
    { id: 5, label: 'Training', description: 'Model training', icon: <Play className="w-4 h-4" /> },
    { id: 6, label: 'Complete', description: 'Metrics ready', icon: <Award className="w-4 h-4" /> },
    { id: 7, label: 'Deployed', description: 'API endpoint live', icon: <Rocket className="w-4 h-4" /> },
];

export const WorkflowTimeline = ({ currentStep, status, errorMessage }: WorkflowTimelineProps) => {
    const { themeColor } = useThemeColor();
    const [hoveredStep, setHoveredStep] = useState<number | null>(null);

    const getStepStatus = (stepId: number) => {
        if (status === 'error' && stepId === currentStep) return 'error';
        if (stepId < currentStep) return 'complete';
        if (stepId === currentStep) return status === 'pending' ? 'active' : 'complete';
        return 'pending';
    };

    if (currentStep < 1) return null;

    return (
        <motion.div
            initial={{ x: -20, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            className="fixed left-6 top-64 -translate-y-1/2 z-30"
        >
            <div className="backdrop-blur-xl bg-black/40 border border-white/10 rounded-2xl p-3 shadow-xl">
                <div className="flex flex-col items-center gap-1">
                    {WORKFLOW_STEPS.map((step, index) => {
                        const stepStatus = getStepStatus(step.id);
                        const isLast = index === WORKFLOW_STEPS.length - 1;
                        const isActive = stepStatus === 'active';
                        const isComplete = stepStatus === 'complete';
                        const isError = stepStatus === 'error';
                        const isHovered = hoveredStep === step.id;

                        return (
                            <div key={step.id} className="flex items-center relative">
                                {/* Tooltip on hover */}
                                <AnimatePresence>
                                    {isHovered && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            exit={{ opacity: 0, x: -10 }}
                                            className="absolute left-14 top-1/2 -translate-y-1/2 z-50 whitespace-nowrap"
                                        >
                                            <div
                                                className="px-4 py-2.5 rounded-xl backdrop-blur-xl bg-black/90 border border-white/10 shadow-lg"
                                                style={{ boxShadow: `0 0 20px ${themeColor}30` }}
                                            >
                                                <div className="text-sm font-bold text-white">{step.label}</div>
                                                <div className="text-xs text-white/50">{step.description}</div>
                                            </div>
                                            {/* Arrow */}
                                            <div
                                                className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-1 w-2 h-2 rotate-45 bg-black/90 border-l border-b border-white/10"
                                            />
                                        </motion.div>
                                    )}
                                </AnimatePresence>

                                <div className="flex flex-col items-center">
                                    {/* Step circle - BIGGER */}
                                    <motion.div
                                        onMouseEnter={() => setHoveredStep(step.id)}
                                        onMouseLeave={() => setHoveredStep(null)}
                                        className={`relative w-10 h-10 rounded-full flex items-center justify-center cursor-pointer transition-all duration-300 ${isComplete ? 'bg-opacity-100' : isActive ? 'bg-opacity-30' : 'bg-white/5'
                                            }`}
                                        style={{
                                            backgroundColor: isComplete ? themeColor : isActive ? themeColor : isError ? '#EF4444' : undefined,
                                            boxShadow: isActive ? `0 0 25px ${themeColor}60` : isError ? '0 0 25px #EF444460' : 'none'
                                        }}
                                        animate={isActive ? {
                                            scale: [1, 1.15, 1],
                                            boxShadow: [
                                                `0 0 15px ${themeColor}40`,
                                                `0 0 30px ${themeColor}80`,
                                                `0 0 15px ${themeColor}40`
                                            ]
                                        } : {}}
                                        transition={isActive ? {
                                            duration: 1.5,
                                            repeat: Infinity,
                                            ease: "easeInOut"
                                        } : {}}
                                    >
                                        {isComplete ? (
                                            <CheckCircle2 className="w-5 h-5 text-white" />
                                        ) : isActive ? (
                                            <Loader2 className="w-5 h-5 text-white animate-spin" />
                                        ) : isError ? (
                                            <XCircle className="w-5 h-5 text-white" />
                                        ) : (
                                            <div className="text-white/50">{step.icon}</div>
                                        )}
                                    </motion.div>

                                    {/* Connecting line - LONGER */}
                                    {!isLast && (
                                        <div
                                            className="w-0.5 h-4 rounded-full transition-all duration-500"
                                            style={{
                                                backgroundColor: isComplete ? themeColor : 'rgba(255,255,255,0.1)'
                                            }}
                                        />
                                    )}
                                </div>
                            </div>
                        );
                    })}
                </div>
            </div>
        </motion.div>
    );
};

export default WorkflowTimeline;
