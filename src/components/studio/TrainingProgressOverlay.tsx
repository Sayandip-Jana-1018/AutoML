'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, FileCode, Cloud, Cpu, Sparkles, Zap, Brain, Rocket, RefreshCw, Loader2 } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

export type TrainingStep = 'preparing' | 'uploading' | 'submitting' | 'installing' | 'training' | 'validating' | 'deploying' | 'completed' | 'failed';

interface TrainingProgressOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    currentStep: TrainingStep;
    error?: string | null;
    errorCode?: string | null; // 'RESOURCE_EXHAUSTED' | 'QUOTA_EXCEEDED' etc.
    logs?: string[];
    jobId?: string | null;
    onRetry?: () => Promise<void> | void;
}

const TRAINING_STEPS = [
    { id: 'preparing', label: 'Prepare', description: 'Generating optimized training code...', icon: FileCode },
    { id: 'uploading', label: 'Upload', description: 'Uploading script to Cloud Storage...', icon: Cloud },
    { id: 'submitting', label: 'Submit', description: 'Submitting job to Compute Engine...', icon: Cpu },
    { id: 'installing', label: 'Install', description: 'Installing dependencies on VM...', icon: Zap },
    { id: 'training', label: 'Train', description: 'Model is training...', icon: Sparkles },
    { id: 'validating', label: 'Validate', description: 'Validating model metrics...', icon: CheckCircle2 },
    { id: 'deploying', label: 'Deploy', description: 'Deploying to marketplace...', icon: Rocket },
    { id: 'completed', label: 'Done', description: 'Your model is ready!', icon: CheckCircle2 },
];

const getStepIndex = (step: TrainingStep): number => {
    const index = TRAINING_STEPS.findIndex(s => s.id === step);
    return index >= 0 ? index : 0;
};

// Floating Orb with 3D Effect
const FloatingOrb = ({ themeColor, size, delay, position }: { themeColor: string; size: number; delay: number; position: { x: number; y: number } }) => (
    <motion.div
        className="absolute rounded-full"
        style={{
            width: size,
            height: size,
            left: `${position.x}%`,
            top: `${position.y}%`,
            background: `radial-gradient(circle at 30% 30%, ${themeColor}60, ${themeColor}20, transparent 70%)`,
            boxShadow: `0 0 ${size / 2}px ${themeColor}40, inset 0 0 ${size / 3}px ${themeColor}30`,
        }}
        animate={{
            y: [0, -30, 0],
            x: [0, 15, 0],
            scale: [1, 1.1, 1],
            rotate: [0, 180, 360],
        }}
        transition={{
            duration: 6 + delay,
            repeat: Infinity,
            delay: delay,
            ease: "easeInOut"
        }}
    />
);



// Hexagon Grid Animation
const HexGrid = ({ themeColor }: { themeColor: string }) => {
    const hexagons = useMemo(() =>
        Array.from({ length: 24 }).map((_, i) => ({
            id: i,
            x: (i % 8) * 90 + (Math.floor(i / 8) % 2) * 45,
            y: Math.floor(i / 8) * 78,
            delay: Math.random() * 2
        })), []
    );

    return (
        <svg className="absolute inset-0 w-full h-full opacity-10" viewBox="0 0 800 300">
            {hexagons.map(hex => (
                <motion.polygon
                    key={hex.id}
                    points="30,0 60,17 60,52 30,69 0,52 0,17"
                    transform={`translate(${hex.x}, ${hex.y})`}
                    fill="none"
                    stroke={themeColor}
                    strokeWidth="1"
                    initial={{ opacity: 0, scale: 0.5 }}
                    animate={{
                        opacity: [0.1, 0.5, 0.1],
                        scale: [0.9, 1, 0.9]
                    }}
                    transition={{ duration: 3, delay: hex.delay, repeat: Infinity }}
                />
            ))}
        </svg>
    );
};

// Pulsing Ring Animation
const PulsingRings = ({ themeColor }: { themeColor: string }) => (
    <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        {[1, 2, 3, 4].map((ring) => (
            <motion.div
                key={ring}
                className="absolute rounded-full border"
                style={{
                    borderColor: themeColor,
                    width: 150 + ring * 60,
                    height: 150 + ring * 60,
                }}
                initial={{ opacity: 0.3, scale: 0.8 }}
                animate={{
                    opacity: [0.1, 0.3, 0.1],
                    scale: [0.9, 1.1, 0.9],
                }}
                transition={{
                    duration: 3,
                    delay: ring * 0.4,
                    repeat: Infinity,
                    ease: "easeInOut"
                }}
            />
        ))}
    </div>
);

// Animated Counter
const AnimatedCounter = ({ value, themeColor }: { value: number; themeColor: string }) => {
    const count = useMotionValue(0);
    const rounded = useTransform(count, Math.round);

    useEffect(() => {
        const animation = animate(count, value, { duration: 1.5 });
        return animation.stop;
    }, [value, count]);

    return (
        <motion.span className="font-mono text-3xl font-bold" style={{ color: themeColor }}>
            {rounded}
        </motion.span>
    );
};

// Main Loader - Morphing Sphere
const MorphingSphere = ({ themeColor, currentStep }: { themeColor: string; currentStep: TrainingStep }) => {
    const isFailed = currentStep === 'failed';
    const isCompleted = currentStep === 'completed';

    return (
        <div className="relative w-40 h-40">
            {/* Outer morphing shape */}
            <motion.div
                className="absolute inset-0"
                animate={{
                    borderRadius: ["30% 70% 70% 30% / 30% 30% 70% 70%", "70% 30% 30% 70% / 70% 70% 30% 30%", "30% 70% 70% 30% / 30% 30% 70% 70%"],
                    rotate: [0, 180, 360],
                }}
                transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
                style={{
                    background: `linear-gradient(135deg, ${isFailed ? '#ef444480' : isCompleted ? '#22c55e80' : themeColor + '80'}, transparent)`,
                    boxShadow: `0 0 60px ${isFailed ? '#ef444440' : isCompleted ? '#22c55e40' : themeColor + '40'}`,
                }}
            />

            {/* Middle ring */}
            <motion.div
                className="absolute inset-4 rounded-full border-4"
                style={{ borderColor: `${isFailed ? '#ef4444' : isCompleted ? '#22c55e' : themeColor}40` }}
                animate={{ rotate: -360 }}
                transition={{ duration: 6, repeat: Infinity, ease: "linear" }}
            />

            {/* Inner spinning ring with glow */}
            <motion.div
                className="absolute inset-8 rounded-full"
                style={{
                    border: `3px solid ${isFailed ? '#ef4444' : isCompleted ? '#22c55e' : themeColor}`,
                    borderTopColor: 'transparent',
                    borderRightColor: 'transparent',
                    boxShadow: `0 0 20px ${isFailed ? '#ef444460' : isCompleted ? '#22c55e60' : themeColor + '60'}, inset 0 0 20px ${isFailed ? '#ef444420' : isCompleted ? '#22c55e20' : themeColor + '20'}`,
                }}
                animate={{ rotate: 360 }}
                transition={{ duration: 1.5, repeat: Infinity, ease: "linear" }}
            />

            {/* Core with pulse */}
            <motion.div
                className="absolute inset-12 rounded-full"
                style={{
                    background: `radial-gradient(circle, ${isFailed ? '#ef4444' : isCompleted ? '#22c55e' : themeColor} 0%, ${isFailed ? '#ef444480' : isCompleted ? '#22c55e80' : themeColor + '80'} 50%, transparent 100%)`,
                }}
                animate={{
                    scale: [0.8, 1.2, 0.8],
                    opacity: [0.6, 1, 0.6],
                }}
                transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            />

            {/* Center icon */}
            <div className="absolute inset-0 flex items-center justify-center">
                {isFailed ? (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1, rotate: [0, 10, -10, 0] }}
                        transition={{ duration: 0.5 }}
                    >
                        <AlertCircle className="w-10 h-10 text-red-400" />
                    </motion.div>
                ) : isCompleted ? (
                    <motion.div
                        initial={{ scale: 0, rotate: -180 }}
                        animate={{ scale: 1, rotate: 0 }}
                        transition={{ type: "spring", stiffness: 200 }}
                    >
                        <CheckCircle2 className="w-10 h-10 text-green-400" />
                    </motion.div>
                ) : (
                    <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                        <Brain className="w-10 h-10" style={{ color: themeColor }} />
                    </motion.div>
                )}
            </div>

            {/* Orbiting particles */}
            {[0, 120, 240].map((angle, i) => (
                <motion.div
                    key={i}
                    className="absolute w-2 h-2 rounded-full"
                    style={{
                        backgroundColor: isFailed ? '#ef4444' : isCompleted ? '#22c55e' : themeColor,
                        boxShadow: `0 0 10px ${isFailed ? '#ef4444' : isCompleted ? '#22c55e' : themeColor}`,
                        top: '50%',
                        left: '50%',
                    }}
                    animate={{
                        x: [Math.cos((angle + 0) * Math.PI / 180) * 70, Math.cos((angle + 360) * Math.PI / 180) * 70],
                        y: [Math.sin((angle + 0) * Math.PI / 180) * 70, Math.sin((angle + 360) * Math.PI / 180) * 70],
                    }}
                    transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                />
            ))}
        </div>
    );
};

// Typewriter Text Effect
const TypewriterText = ({ text, className }: { text: string; className?: string }) => {
    return (
        <motion.span className={className}>
            {text.split('').map((char, i) => (
                <motion.span
                    key={i}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.03 }}
                >
                    {char}
                </motion.span>
            ))}
        </motion.span>
    );
};

// Progress Wave
const ProgressWave = ({ progress, themeColor }: { progress: number; themeColor: string }) => (
    <div className="relative w-full h-1 bg-white/10 rounded-full overflow-hidden">
        <motion.div
            className="absolute inset-y-0 left-0 rounded-full"
            style={{
                background: `linear-gradient(90deg, ${themeColor}, ${themeColor}80, ${themeColor})`,
                boxShadow: `0 0 20px ${themeColor}`,
            }}
            initial={{ width: 0 }}
            animate={{ width: `${progress}%` }}
            transition={{ duration: 0.5 }}
        />
        <motion.div
            className="absolute inset-0"
            style={{
                background: `linear-gradient(90deg, transparent, ${themeColor}40, transparent)`,
            }}
            animate={{ x: ['-100%', '100%'] }}
            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
        />
    </div>
);

export const TrainingProgressOverlay = ({
    isOpen,
    onClose,
    currentStep,
    error,
    errorCode,
    logs = [],
    jobId,
    onRetry
}: TrainingProgressOverlayProps) => {
    const [isRetrying, setIsRetrying] = React.useState(false);
    const [isCollapsed, setIsCollapsed] = React.useState(false);
    const { themeColor } = useThemeColor();
    const [particles, setParticles] = useState<{ id: number; x: number; y: number; size: number; delay: number }[]>([]);
    const currentStepIndex = getStepIndex(currentStep);
    const progress = ((currentStepIndex + 1) / TRAINING_STEPS.length) * 100;

    // Generate floating particles
    useEffect(() => {
        const newParticles = Array.from({ length: 40 }, (_, i) => ({
            id: i,
            x: Math.random() * 100,
            y: Math.random() * 100,
            size: Math.random() * 6 + 2,
            delay: Math.random() * 4
        }));
        setParticles(newParticles);
    }, []);

    // Floating orbs data
    const orbs = useMemo(() => [
        { size: 80, delay: 0, position: { x: 10, y: 20 } },
        { size: 60, delay: 1, position: { x: 85, y: 15 } },
        { size: 100, delay: 2, position: { x: 5, y: 70 } },
        { size: 50, delay: 1.5, position: { x: 90, y: 75 } },
        { size: 40, delay: 0.5, position: { x: 50, y: 90 } },
    ], []);

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Collapsed Mini Widget - Draggable */}
                    {isCollapsed ? (
                        <motion.div
                            initial={{ opacity: 0, scale: 0.8, y: 20 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.8, y: 20 }}
                            className="fixed bottom-8 right-8 z-[60] cursor-grab active:cursor-grabbing select-none"
                            drag
                            dragConstraints={{ left: -window.innerWidth + 400, right: 0, top: -window.innerHeight + 300, bottom: 0 }}
                            dragElastic={0.15}
                            dragTransition={{ bounceStiffness: 300, bounceDamping: 20 }}
                            whileDrag={{ scale: 1.05, cursor: 'grabbing' }}
                        >
                            {/* Glow effect behind capsule */}
                            <motion.div
                                className="absolute inset-0 rounded-3xl blur-xl"
                                style={{ background: `${themeColor}40` }}
                                animate={{ opacity: [0.4, 0.7, 0.4] }}
                                transition={{ duration: 2, repeat: Infinity }}
                            />

                            <div
                                className="relative flex items-center gap-4 px-5 py-4 rounded-3xl backdrop-blur-2xl border"
                                style={{
                                    background: `linear-gradient(135deg, rgba(0,0,0,0.8) 0%, rgba(0,0,0,0.6) 100%)`,
                                    borderColor: `${themeColor}60`,
                                    boxShadow: `0 20px 60px ${themeColor}40, 0 0 0 1px ${themeColor}30 inset, 0 0 80px ${themeColor}20`
                                }}
                            >
                                {/* Animated icon container */}
                                <div className="relative">
                                    {/* Pulse ring */}
                                    <motion.div
                                        className="absolute inset-0 rounded-full"
                                        style={{ border: `2px solid ${themeColor}40` }}
                                        animate={currentStep === 'failed' ? {} : { scale: [1, 1.5, 1], opacity: [0.8, 0, 0.8] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    />

                                    {/* Spinning icon */}
                                    <motion.div
                                        animate={{ rotate: currentStep === 'failed' ? 0 : 360 }}
                                        transition={{ duration: 3, repeat: currentStep === 'failed' ? 0 : Infinity, ease: "linear" }}
                                        className="flex items-center justify-center w-10 h-10 rounded-full"
                                        style={{ background: `${themeColor}20` }}
                                    >
                                        {currentStep === 'failed' ? (
                                            <AlertCircle className="w-6 h-6 text-red-400" />
                                        ) : (
                                            React.createElement(TRAINING_STEPS[currentStepIndex]?.icon || Brain, {
                                                className: "w-6 h-6",
                                                style: { color: themeColor }
                                            })
                                        )}
                                    </motion.div>
                                </div>

                                {/* Status text */}
                                <div className="flex flex-col min-w-[120px]">
                                    <span className="text-sm font-bold text-white tracking-wide">
                                        {currentStep === 'failed' ? 'Training Failed' : TRAINING_STEPS[currentStepIndex]?.label || 'Processing...'}
                                    </span>
                                    <div className="flex items-center gap-2 mt-0.5">
                                        <span className="text-xs text-white/50">
                                            Step {currentStepIndex + 1}/{TRAINING_STEPS.length}
                                        </span>
                                        <div
                                            className="w-1.5 h-1.5 rounded-full animate-pulse"
                                            style={{ background: currentStep === 'failed' ? '#ef4444' : themeColor }}
                                        />
                                    </div>
                                </div>

                                {/* Progress ring - larger and more prominent */}
                                <div className="relative w-12 h-12 flex-shrink-0">
                                    <svg className="w-12 h-12 -rotate-90">
                                        <circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke="rgba(255,255,255,0.1)"
                                            strokeWidth="3"
                                            fill="none"
                                        />
                                        <motion.circle
                                            cx="24"
                                            cy="24"
                                            r="20"
                                            stroke={currentStep === 'failed' ? '#ef4444' : themeColor}
                                            strokeWidth="3"
                                            fill="none"
                                            strokeLinecap="round"
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: progress / 100 }}
                                            transition={{ duration: 0.5, ease: "easeOut" }}
                                        />
                                    </svg>
                                    <span
                                        className="absolute inset-0 flex items-center justify-center text-xs font-bold"
                                        style={{ color: currentStep === 'failed' ? '#ef4444' : themeColor }}
                                    >
                                        {Math.round(progress)}%
                                    </span>
                                </div>

                                {/* Expand Arrow Button - more prominent */}
                                <motion.button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsCollapsed(false);
                                    }}
                                    className="flex-shrink-0 p-2.5 rounded-xl hover:bg-white/10 transition-all cursor-pointer"
                                    style={{ border: `1px solid ${themeColor}30` }}
                                    title="Expand training details"
                                    whileHover={{ scale: 1.1, backgroundColor: 'rgba(255,255,255,0.15)' }}
                                    whileTap={{ scale: 0.95 }}
                                >
                                    <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                        <path d="M5 15l7-7 7 7" />
                                    </svg>
                                </motion.button>
                            </div>
                        </motion.div>
                    ) : (
                        /* Full Screen View */
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.5 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden bg-black/70 backdrop-blur-sm"
                        >
                            {/* Animated gradient background - pointer-events-none to allow button clicks */}
                            <motion.div
                                className="absolute inset-0 pointer-events-none"
                                style={{
                                    background: `radial-gradient(ellipse at 50% 50%, ${themeColor}10 0%, transparent 50%), 
                                         radial-gradient(ellipse at 20% 80%, ${themeColor}08 0%, transparent 40%),
                                         radial-gradient(ellipse at 80% 20%, ${themeColor}08 0%, transparent 40%),
                                         linear-gradient(180deg, #000000 0%, #0a0a0a 100%)`,
                                }}
                                animate={{
                                    background: [
                                        `radial-gradient(ellipse at 50% 50%, ${themeColor}10 0%, transparent 50%), 
                                 radial-gradient(ellipse at 20% 80%, ${themeColor}08 0%, transparent 40%),
                                 radial-gradient(ellipse at 80% 20%, ${themeColor}08 0%, transparent 40%),
                                 linear-gradient(180deg, #000000 0%, #0a0a0a 100%)`,
                                        `radial-gradient(ellipse at 60% 40%, ${themeColor}10 0%, transparent 50%), 
                                 radial-gradient(ellipse at 30% 70%, ${themeColor}08 0%, transparent 40%),
                                 radial-gradient(ellipse at 70% 30%, ${themeColor}08 0%, transparent 40%),
                                 linear-gradient(180deg, #000000 0%, #0a0a0a 100%)`,
                                    ]
                                }}
                                transition={{ duration: 10, repeat: Infinity, repeatType: "reverse" }}
                            />

                            {/* Decorative elements container - no pointer events */}
                            <div className="absolute inset-0 pointer-events-none overflow-hidden">
                                {/* Hex Grid */}
                                <HexGrid themeColor={themeColor} />

                                {/* Floating Orbs */}
                                {orbs.map((orb, i) => (
                                    <FloatingOrb key={i} themeColor={themeColor} {...orb} />
                                ))}

                                {/* Floating Particles */}
                                {particles.map((particle) => (
                                    <motion.div
                                        key={particle.id}
                                        className="absolute rounded-full"
                                        style={{
                                            left: `${particle.x}%`,
                                            top: `${particle.y}%`,
                                            width: particle.size,
                                            height: particle.size,
                                            backgroundColor: themeColor,
                                            boxShadow: `0 0 ${particle.size * 2}px ${themeColor}60`,
                                        }}
                                        animate={{
                                            y: [0, -50, 0],
                                            x: [0, Math.random() * 30 - 15, 0],
                                            opacity: [0.1, 0.6, 0.1],
                                            scale: [1, 1.5, 1]
                                        }}
                                        transition={{
                                            duration: 4 + particle.delay,
                                            repeat: Infinity,
                                            delay: particle.delay,
                                            ease: "easeInOut"
                                        }}
                                    />
                                ))}
                            </div>

                            {/* Main Content Container */}
                            <motion.div
                                initial={{ scale: 0.8, y: 50, opacity: 0 }}
                                animate={{ scale: 1, y: 0, opacity: 1 }}
                                exit={{ scale: 0.8, y: 50, opacity: 0 }}
                                transition={{ type: "spring", damping: 25, stiffness: 300 }}
                                className="relative z-10 w-[600px] max-w-[95vw]"
                            >
                                {/* Minimize button - always show (except completed) */}
                                {currentStep !== 'completed' && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        onClick={() => setIsCollapsed(true)}
                                        className="absolute -top-12 right-14 p-3 rounded-xl transition-all backdrop-blur-xl"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                            border: `1px solid ${themeColor}60`,
                                            boxShadow: `0 4px 20px ${themeColor}30`
                                        }}
                                        whileHover={{ scale: 1.1, boxShadow: `0 8px 30px ${themeColor}50` }}
                                        whileTap={{ scale: 0.9 }}
                                        title="Minimize to corner"
                                    >
                                        <svg className="w-5 h-5 text-white" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                                            <path d="M19 9l-7 7-7-7" />
                                        </svg>
                                    </motion.button>
                                )}

                                {/* Close button - only show if failed */}
                                {currentStep === 'failed' && (
                                    <motion.button
                                        initial={{ opacity: 0, scale: 0 }}
                                        animate={{ opacity: 1, scale: 1 }}
                                        onClick={onClose}
                                        className="absolute -top-14 right-0 p-3 rounded-full bg-white/5 hover:bg-white/15 text-white/60 hover:text-white transition-all border border-white/10 backdrop-blur-xl"
                                        whileHover={{ scale: 1.1, rotate: 90 }}
                                        whileTap={{ scale: 0.9 }}
                                    >
                                        <X className="w-5 h-5" />
                                    </motion.button>
                                )}

                                {/* Main Animated Loader */}
                                <div className="flex justify-center mb-10">
                                    <MorphingSphere themeColor={themeColor} currentStep={currentStep} />
                                </div>

                                {/* Current Step Title with Typewriter */}
                                <motion.div
                                    key={currentStep}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ type: "spring", stiffness: 200 }}
                                    className="text-center mb-6"
                                >
                                    <h2 className="text-3xl font-bold text-white mb-3">
                                        <TypewriterText
                                            text={currentStep === 'failed'
                                                ? 'Training Failed'
                                                : TRAINING_STEPS[currentStepIndex]?.label || 'Processing...'}
                                        />
                                    </h2>
                                    <motion.p
                                        className="text-white/50 text-sm max-w-md mx-auto"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        {currentStep === 'failed'
                                            ? error || 'An error occurred during training'
                                            : TRAINING_STEPS[currentStepIndex]?.description}
                                    </motion.p>
                                </motion.div>

                                {/* Progress Wave */}
                                <div className="mb-8 px-4">
                                    <ProgressWave progress={progress} themeColor={themeColor} />
                                    <div className="flex justify-between mt-2 text-xs text-white/30">
                                        <span>Step {currentStepIndex + 1} of {TRAINING_STEPS.length}</span>
                                        <span>{Math.round(progress)}%</span>
                                    </div>
                                </div>

                                {/* Horizontal Step Timeline */}
                                <motion.div
                                    className="backdrop-blur-2xl rounded-2xl border p-4 overflow-hidden"
                                    style={{
                                        background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
                                        borderColor: `${themeColor}20`,
                                    }}
                                    initial={{ opacity: 0, y: 30 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: 0.2 }}
                                >
                                    <div className="flex items-center justify-between">
                                        {TRAINING_STEPS.slice(0, -1).map((step, index) => {
                                            const isComplete = index < currentStepIndex;
                                            const isCurrent = index === currentStepIndex && currentStep !== 'failed';
                                            const isFailed = currentStep === 'failed' && index === currentStepIndex;
                                            const StepIcon = step.icon;

                                            return (
                                                <React.Fragment key={step.id}>
                                                    {/* Step Circle */}
                                                    <motion.div
                                                        className="flex flex-col items-center gap-1"
                                                        initial={{ opacity: 0, scale: 0.8 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        transition={{ delay: index * 0.05 }}
                                                    >
                                                        <div
                                                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all ${isComplete ? 'bg-green-500/30' :
                                                                isFailed ? 'bg-red-500/30' :
                                                                    isCurrent ? '' : 'bg-white/10'
                                                                }`}
                                                            style={isCurrent && !isFailed ? {
                                                                background: `linear-gradient(135deg, ${themeColor}50, ${themeColor}30)`,
                                                                boxShadow: `0 0 15px ${themeColor}40`
                                                            } : {}}
                                                        >
                                                            {isComplete ? (
                                                                <CheckCircle2 className="w-4 h-4 text-green-400" />
                                                            ) : isFailed ? (
                                                                <AlertCircle className="w-4 h-4 text-red-400" />
                                                            ) : isCurrent ? (
                                                                <motion.div
                                                                    animate={{ rotate: 360 }}
                                                                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                                >
                                                                    <StepIcon className="w-4 h-4" style={{ color: themeColor }} />
                                                                </motion.div>
                                                            ) : (
                                                                <StepIcon className="w-4 h-4 text-white/30" />
                                                            )}
                                                        </div>
                                                        <span className={`text-[9px] font-medium ${isComplete ? 'text-green-400' :
                                                            isCurrent ? 'text-white' :
                                                                'text-white/30'
                                                            }`}>{step.label}</span>
                                                    </motion.div>

                                                    {/* Connector Line (except after last) */}
                                                    {index < TRAINING_STEPS.length - 2 && (
                                                        <div className="flex-1 h-0.5 mx-1 rounded-full bg-white/10 overflow-hidden">
                                                            {index < currentStepIndex && (
                                                                <motion.div
                                                                    className="h-full rounded-full"
                                                                    style={{ backgroundColor: '#22c55e' }}
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: '100%' }}
                                                                    transition={{ duration: 0.5 }}
                                                                />
                                                            )}
                                                            {index === currentStepIndex - 1 && (
                                                                <motion.div
                                                                    className="h-full rounded-full"
                                                                    style={{ backgroundColor: themeColor }}
                                                                    initial={{ width: 0 }}
                                                                    animate={{ width: '100%' }}
                                                                    transition={{ duration: 0.5 }}
                                                                />
                                                            )}
                                                        </div>
                                                    )}
                                                </React.Fragment>
                                            );
                                        })}
                                    </div>
                                </motion.div>

                                {/* Error Details */}
                                <AnimatePresence>
                                    {currentStep === 'failed' && error && (() => {
                                        // Extract clean error message from raw error
                                        let cleanMessage = error;
                                        let technicalDetails = '';

                                        // Try to parse JSON error and extract message
                                        try {
                                            if (error.includes('"message"')) {
                                                const match = error.match(/"message":\s*"([^"]+)"/);
                                                if (match) {
                                                    cleanMessage = match[1].split('.')[0]; // Take first sentence
                                                    technicalDetails = error;
                                                }
                                            } else if (error.includes('Failed to create training VM')) {
                                                cleanMessage = 'Failed to create training VM. Please check your GCP settings.';
                                                technicalDetails = error;
                                            }
                                        } catch {
                                            // Keep original
                                        }

                                        // Truncate if still too long
                                        if (cleanMessage.length > 150) {
                                            cleanMessage = cleanMessage.substring(0, 147) + '...';
                                        }

                                        return (
                                            <motion.div
                                                initial={{ opacity: 0, y: 20, height: 0 }}
                                                animate={{ opacity: 1, y: 0, height: 'auto' }}
                                                exit={{ opacity: 0, y: -20, height: 0 }}
                                                className="mt-4 p-4 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-xl"
                                            >
                                                <div className="flex items-start gap-3">
                                                    <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
                                                    <div className="flex-1 min-w-0">
                                                        <p className="text-sm text-red-300 font-medium">{cleanMessage}</p>
                                                        {technicalDetails && (
                                                            <details className="mt-2">
                                                                <summary className="text-[10px] text-red-400/60 cursor-pointer hover:text-red-400 transition-colors">
                                                                    Show technical details
                                                                </summary>
                                                                <pre className="mt-2 p-2 bg-black/30 rounded-lg text-[9px] text-red-400/70 font-mono overflow-x-auto max-h-32 overflow-y-auto">
                                                                    {technicalDetails.substring(0, 500)}
                                                                    {technicalDetails.length > 500 ? '...' : ''}
                                                                </pre>
                                                            </details>
                                                        )}
                                                    </div>
                                                </div>
                                            </motion.div>
                                        );
                                    })()}
                                </AnimatePresence>

                                {/* Action Buttons */}
                                <div className="mt-6 space-y-3">
                                    {currentStep === 'failed' && (
                                        <>
                                            {/* Retry Button - only if onRetry callback provided */}
                                            {onRetry && (
                                                <motion.button
                                                    initial={{ opacity: 0, y: 20 }}
                                                    animate={{ opacity: 1, y: 0 }}
                                                    onClick={async () => {
                                                        setIsRetrying(true);
                                                        try {
                                                            await onRetry();
                                                        } finally {
                                                            setIsRetrying(false);
                                                        }
                                                    }}
                                                    disabled={isRetrying}
                                                    className="w-full py-4 rounded-2xl font-semibold text-white transition-all overflow-hidden relative disabled:opacity-50"
                                                    style={{
                                                        background: errorCode === 'RESOURCE_EXHAUSTED' || errorCode === 'QUOTA_EXCEEDED'
                                                            ? 'linear-gradient(135deg, #f59e0b, #d97706)'
                                                            : `linear-gradient(135deg, ${themeColor}, #8B5CF6)`,
                                                    }}
                                                    whileHover={{ scale: isRetrying ? 1 : 1.02 }}
                                                    whileTap={{ scale: isRetrying ? 1 : 0.98 }}
                                                >
                                                    <span className="flex items-center justify-center gap-2">
                                                        {isRetrying ? (
                                                            <>
                                                                <Loader2 className="w-4 h-4 animate-spin" />
                                                                Retrying...
                                                            </>
                                                        ) : (
                                                            <>
                                                                <RefreshCw className="w-4 h-4" />
                                                                {errorCode === 'RESOURCE_EXHAUSTED' || errorCode === 'QUOTA_EXCEEDED'
                                                                    ? 'Retry Training (Quota Issue)'
                                                                    : 'Retry Training'}
                                                            </>
                                                        )}
                                                    </span>
                                                </motion.button>
                                            )}

                                            {/* Close Button */}
                                            <motion.button
                                                initial={{ opacity: 0, y: 20 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: 0.1 }}
                                                onClick={onClose}
                                                className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all border border-white/10 backdrop-blur-xl"
                                                whileHover={{ scale: 1.02, boxShadow: '0 10px 40px rgba(255,255,255,0.1)' }}
                                                whileTap={{ scale: 0.98 }}
                                            >
                                                <span className="flex items-center justify-center gap-2">
                                                    <X className="w-4 h-4" /> Close
                                                </span>
                                            </motion.button>
                                        </>
                                    )}

                                    {currentStep === 'completed' && (
                                        <motion.button
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            onClick={onClose}
                                            className="w-full py-4 rounded-2xl font-semibold text-white transition-all overflow-hidden relative"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}, #8B5CF6, ${themeColor})`,
                                                backgroundSize: '200% 200%',
                                            }}
                                            whileHover={{
                                                scale: 1.02,
                                                boxShadow: `0 20px 40px ${themeColor}40`
                                            }}
                                            whileTap={{ scale: 0.98 }}
                                        >
                                            <motion.div
                                                className="absolute inset-0"
                                                style={{
                                                    background: `linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)`,
                                                }}
                                                animate={{ x: ['-100%', '100%'] }}
                                                transition={{ duration: 2, repeat: Infinity }}
                                            />
                                            <span className="relative flex items-center justify-center gap-2">
                                                <Rocket className="w-4 h-4" /> View Results
                                            </span>
                                        </motion.button>
                                    )}
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </>
            )}
        </AnimatePresence>
    );
};

export default TrainingProgressOverlay;

