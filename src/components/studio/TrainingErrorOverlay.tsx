'use client';

import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { XCircle, AlertTriangle, RefreshCw, ArrowLeft, Bug, Copy, Check } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

export interface TrainingError {
    step: 'upload' | 'automl' | 'train' | 'polling' | 'metrics' | 'unknown';
    message: string;
    details?: string;
    code?: string;
    suggestions?: string[];
}

interface TrainingErrorOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    onRetry?: () => void;
    error: TrainingError | null;
}

const STEP_LABELS: Record<string, string> = {
    upload: 'Dataset Upload',
    automl: 'Script Generation',
    train: 'Training Submission',
    polling: 'Training Execution',
    metrics: 'Metrics Retrieval',
    unknown: 'Training Pipeline'
};

const STEP_ICONS: Record<string, string> = {
    upload: '📤',
    automl: '🤖',
    train: '🚀',
    polling: '⏳',
    metrics: '📊',
    unknown: '❌'
};

// Floating error particle
const ErrorParticle = ({ delay, x }: { delay: number; x: number }) => (
    <motion.div
        className="absolute w-2 h-2 rounded-full bg-red-500/60"
        style={{ left: `${x}%`, top: -10 }}
        initial={{ y: -10, opacity: 0 }}
        animate={{
            y: typeof window !== 'undefined' ? window.innerHeight + 50 : 800,
            opacity: [0, 0.8, 0.8, 0],
            x: [(Math.random() - 0.5) * 50],
        }}
        transition={{
            duration: 3 + Math.random() * 2,
            delay: delay,
            ease: 'linear',
        }}
    />
);

export const TrainingErrorOverlay = ({
    isOpen,
    onClose,
    onRetry,
    error
}: TrainingErrorOverlayProps) => {
    const { themeColor } = useThemeColor();
    const [showContent, setShowContent] = useState(false);
    const [copied, setCopied] = useState(false);

    // Generate error particles
    const particles = Array.from({ length: 30 }).map((_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 2,
    }));

    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setShowContent(true), 300);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
        }
    }, [isOpen]);

    const copyError = () => {
        if (!error) return;
        const errorText = `Step: ${error.step}\nMessage: ${error.message}${error.details ? `\nDetails: ${error.details}` : ''}${error.code ? `\nCode: ${error.code}` : ''}`;
        navigator.clipboard.writeText(errorText);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!error) return null;

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Background blur with red tint */}
                    <motion.div
                        className="absolute inset-0 bg-black/85 backdrop-blur-md"
                        style={{ background: 'linear-gradient(180deg, rgba(0,0,0,0.9) 0%, rgba(127,29,29,0.3) 100%)' }}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Error particles */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {particles.map((p) => (
                            <ErrorParticle key={p.id} delay={p.delay} x={p.x} />
                        ))}
                    </div>

                    {/* Main content */}
                    <AnimatePresence>
                        {showContent && (
                            <motion.div
                                className="relative z-10 w-full max-w-lg mx-4"
                                initial={{ scale: 0.8, opacity: 0, y: 30 }}
                                animate={{ scale: 1, opacity: 1, y: 0 }}
                                exit={{ scale: 0.8, opacity: 0, y: 30 }}
                                transition={{ type: 'spring', damping: 20, stiffness: 300 }}
                            >
                                {/* Glass Card Container */}
                                <div
                                    className="relative px-8 py-8 rounded-3xl text-center backdrop-blur-2xl border overflow-hidden"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(239,68,68,0.12) 0%, rgba(0,0,0,0.4) 100%)',
                                        borderColor: 'rgba(239,68,68,0.3)',
                                        boxShadow: '0 25px 80px rgba(0,0,0,0.5), 0 0 60px rgba(239,68,68,0.15), inset 0 0 60px rgba(239,68,68,0.03)'
                                    }}
                                >
                                    {/* Pulsing red glow effect */}
                                    <motion.div
                                        className="absolute inset-0 rounded-3xl"
                                        style={{ background: 'radial-gradient(circle at center, rgba(239,68,68,0.1) 0%, transparent 70%)' }}
                                        animate={{ opacity: [0.3, 0.6, 0.3] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />

                                    {/* Step indicator */}
                                    <motion.div
                                        className="inline-flex items-center gap-2 px-4 py-2 rounded-full mb-6"
                                        style={{
                                            background: 'rgba(239,68,68,0.15)',
                                            border: '1px solid rgba(239,68,68,0.3)'
                                        }}
                                        initial={{ y: -10, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.1 }}
                                    >
                                        <span className="text-lg">{STEP_ICONS[error.step] || '❌'}</span>
                                        <span className="text-red-400 font-medium text-sm">
                                            Error in {STEP_LABELS[error.step] || 'Training'}
                                        </span>
                                    </motion.div>

                                    {/* Error Icon */}
                                    <motion.div
                                        className="relative mx-auto mb-6"
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', damping: 12, stiffness: 200, delay: 0.15 }}
                                    >
                                        {/* Pulsing rings */}
                                        <motion.div
                                            className="absolute inset-0 rounded-full bg-red-500/30"
                                            animate={{ scale: [1, 1.4, 1.4], opacity: [0.5, 0, 0] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                        <div
                                            className="relative w-20 h-20 rounded-full flex items-center justify-center mx-auto"
                                            style={{
                                                background: 'linear-gradient(135deg, #EF4444, #B91C1C)',
                                                boxShadow: '0 0 60px rgba(239,68,68,0.5)',
                                            }}
                                        >
                                            <XCircle className="w-10 h-10 text-white" />
                                        </div>
                                    </motion.div>

                                    {/* Title */}
                                    <motion.h1
                                        className="text-2xl font-bold text-white mb-2"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.2 }}
                                    >
                                        Training Failed
                                    </motion.h1>

                                    {/* Error message */}
                                    <motion.p
                                        className="text-white/70 mb-4 leading-relaxed"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.25 }}
                                    >
                                        {error.message}
                                    </motion.p>

                                    {/* Details box */}
                                    {error.details && (
                                        <motion.div
                                            className="relative bg-black/40 rounded-xl p-4 mb-4 text-left border border-red-500/20"
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.3 }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <Bug className="w-4 h-4 text-red-400 mt-0.5 flex-shrink-0" />
                                                <pre className="text-xs text-red-300/80 font-mono whitespace-pre-wrap break-all overflow-hidden max-h-32 overflow-y-auto flex-1">
                                                    {error.details}
                                                </pre>
                                            </div>
                                            <button
                                                onClick={copyError}
                                                className="absolute top-2 right-2 p-1.5 rounded-lg bg-white/5 hover:bg-white/10 transition-colors"
                                            >
                                                {copied ? (
                                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-white/40" />
                                                )}
                                            </button>
                                        </motion.div>
                                    )}

                                    {/* Suggestions */}
                                    {error.suggestions && error.suggestions.length > 0 && (
                                        <motion.div
                                            className="bg-amber-500/10 rounded-xl p-4 mb-6 text-left border border-amber-500/20"
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.35 }}
                                        >
                                            <div className="flex items-start gap-2">
                                                <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                                                <div>
                                                    <p className="text-amber-400 font-medium text-sm mb-1">Suggestions:</p>
                                                    <ul className="text-xs text-amber-300/70 space-y-1">
                                                        {error.suggestions.map((s, i) => (
                                                            <li key={i}>• {s}</li>
                                                        ))}
                                                    </ul>
                                                </div>
                                            </div>
                                        </motion.div>
                                    )}

                                    {/* Action buttons */}
                                    <motion.div
                                        className="flex gap-3"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        <button
                                            onClick={onClose}
                                            className="flex-1 py-3 rounded-xl font-medium text-white/80 transition-all bg-white/10 hover:bg-white/15 border border-white/10"
                                        >
                                            <span className="flex items-center justify-center gap-2">
                                                <ArrowLeft className="w-4 h-4" />
                                                Go Back
                                            </span>
                                        </button>
                                        {onRetry && (
                                            <button
                                                onClick={onRetry}
                                                className="flex-1 py-3 rounded-xl font-bold text-white transition-all relative overflow-hidden"
                                                style={{
                                                    background: `linear-gradient(135deg, ${themeColor}, #8B5CF6)`,
                                                    boxShadow: `0 10px 30px ${themeColor}30`
                                                }}
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    <RefreshCw className="w-4 h-4" />
                                                    Try Again
                                                </span>
                                            </button>
                                        )}
                                    </motion.div>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrainingErrorOverlay;
