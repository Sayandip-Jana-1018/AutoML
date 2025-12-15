'use client';
/**
 * Pipeline Steps Component
 * Horizontal colorful pipeline step indicator
 */
import React from 'react';
import { motion } from 'framer-motion';
import {
    Upload, CloudUpload, Search, Settings, Code,
    Eye, Zap, Trophy, CheckCircle2, Loader2
} from 'lucide-react';

export const PIPELINE_ICONS = [
    { icon: Upload, color: '#22d3ee', label: 'Upload' },
    { icon: CloudUpload, color: '#3b82f6', label: 'Process' },
    { icon: Search, color: '#8b5cf6', label: 'Analyze' },
    { icon: Settings, color: '#ec4899', label: 'Config' },
    { icon: Code, color: '#f97316', label: 'Script' },
    { icon: Eye, color: '#f59e0b', label: 'Review' },
    { icon: Zap, color: '#22c55e', label: 'Train' },
    { icon: Trophy, color: '#eab308', label: 'Done' },
];

interface PipelineStepProps {
    index: number;
    currentStep: number;
}

function PipelineStep({ index, currentStep }: PipelineStepProps) {
    const isComplete = index < currentStep;
    const isActive = index === currentStep;
    const step = PIPELINE_ICONS[index];
    const IconComponent = step.icon;
    const stepColor = step.color;

    return (
        <div className="flex flex-col items-center">
            <div className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${isActive ? 'animate-pulse' : ''}`}
                style={{
                    background: isComplete ? stepColor : isActive ? `${stepColor}30` : 'rgba(255,255,255,0.08)',
                    boxShadow: isComplete || isActive ? `0 0 15px ${stepColor}50` : 'none',
                    border: `2px solid ${isComplete || isActive ? stepColor : 'rgba(255,255,255,0.15)'}`
                }}>
                {isComplete ? (
                    <CheckCircle2 className="w-4 h-4 text-white" />
                ) : isActive ? (
                    <Loader2 className="w-4 h-4 animate-spin" style={{ color: stepColor }} />
                ) : (
                    <IconComponent className="w-4 h-4" style={{ color: stepColor }} />
                )}
            </div>
            <span className={`mt-1.5 text-[10px] font-semibold text-center ${isComplete || isActive ? 'text-white' : 'text-white/50'}`}>
                {step.label}
            </span>
        </div>
    );
}

interface PipelineStepsProps {
    currentStep: number;
}

export function PipelineSteps({ currentStep }: PipelineStepsProps) {
    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="p-4 rounded-xl backdrop-blur-xl border border-white/10"
            style={{ background: 'rgba(255,255,255,0.02)' }}
        >
            <div className="flex items-center justify-between">
                {PIPELINE_ICONS.map((step, i) => (
                    <React.Fragment key={i}>
                        <PipelineStep index={i} currentStep={currentStep} />
                        {i < PIPELINE_ICONS.length - 1 && (
                            <div
                                className="flex-1 h-0.5 mx-1.5 transition-all"
                                style={{ background: i < currentStep ? PIPELINE_ICONS[i].color : 'rgba(255,255,255,0.1)' }}
                            />
                        )}
                    </React.Fragment>
                ))}
            </div>
        </motion.div>
    );
}

export default PipelineSteps;
