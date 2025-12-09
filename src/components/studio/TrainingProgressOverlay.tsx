'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence, useMotionValue, useTransform, animate } from 'framer-motion';
import { X, CheckCircle2, AlertCircle, FileCode, Cloud, Cpu, Sparkles, Zap, Brain, Rocket } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

export type TrainingStep = 'preparing' | 'uploading' | 'submitting' | 'training' | 'completed' | 'failed';

interface TrainingProgressOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    currentStep: TrainingStep;
    error?: string | null;
    logs?: string[];
}

const TRAINING_STEPS = [
    { id: 'preparing', label: 'Preparing Script', description: 'Generating optimized training code...', icon: FileCode },
    { id: 'uploading', label: 'Uploading to Cloud', description: 'Uploading script to Google Cloud Storage...', icon: Cloud },
    { id: 'submitting', label: 'Submitting Job', description: 'Submitting training job to Vertex AI...', icon: Cpu },
    { id: 'training', label: 'Training Model', description: 'Model is training on cloud infrastructure...', icon: Sparkles },
    { id: 'completed', label: 'Training Complete', description: 'Your model has been trained successfully!', icon: CheckCircle2 },
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
    logs = []
}: TrainingProgressOverlayProps) => {
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
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.5 }}
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
                >
                    {/* Animated gradient background */}
                    <motion.div
                        className="absolute inset-0"
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

                    {/* Hex Grid */}
                    <HexGrid themeColor={themeColor} />

                    {/* Pulsing Rings */}
                    <PulsingRings themeColor={themeColor} />

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

                    {/* Main Content Container */}
                    <motion.div
                        initial={{ scale: 0.8, y: 50, opacity: 0 }}
                        animate={{ scale: 1, y: 0, opacity: 1 }}
                        exit={{ scale: 0.8, y: 50, opacity: 0 }}
                        transition={{ type: "spring", damping: 25, stiffness: 300 }}
                        className="relative z-10 w-[600px] max-w-[95vw]"
                    >
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

                        {/* Step Timeline Card */}
                        <motion.div
                            className="backdrop-blur-2xl rounded-3xl border p-6 overflow-hidden"
                            style={{
                                background: `linear-gradient(135deg, rgba(255,255,255,0.05) 0%, rgba(255,255,255,0.02) 100%)`,
                                borderColor: `${themeColor}20`,
                                boxShadow: `0 25px 50px -12px ${themeColor}10, inset 0 1px 0 rgba(255,255,255,0.1)`,
                            }}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: 0.2 }}
                        >

                            <div className="relative space-y-2">
                                {TRAINING_STEPS.slice(0, 4).map((step, index) => {
                                    const isComplete = index < currentStepIndex;
                                    const isCurrent = index === currentStepIndex && currentStep !== 'failed';
                                    const isPending = index > currentStepIndex;
                                    const isFailed = currentStep === 'failed' && index === currentStepIndex;
                                    const StepIcon = step.icon;

                                    return (
                                        <motion.div
                                            key={step.id}
                                            initial={{ opacity: 0, x: -30 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: index * 0.1 + 0.3, type: "spring" }}
                                            className={`flex items-center gap-4 p-4 rounded-2xl transition-all relative overflow-hidden ${isCurrent ? 'bg-white/10' : ''
                                                }`}
                                            whileHover={{ x: 5, transition: { duration: 0.2 } }}
                                        >
                                            {/* Active step glow */}
                                            {isCurrent && (
                                                <motion.div
                                                    className="absolute inset-0 opacity-20"
                                                    style={{
                                                        background: `linear-gradient(90deg, ${themeColor}40, transparent)`,
                                                    }}
                                                    animate={{ x: ['-100%', '200%'] }}
                                                    transition={{ duration: 2, repeat: Infinity }}
                                                />
                                            )}

                                            {/* Step Icon */}
                                            <motion.div
                                                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center ${isComplete ? 'bg-green-500/20' :
                                                    isFailed ? 'bg-red-500/20' :
                                                        isCurrent ? '' : 'bg-white/5'
                                                    }`}
                                                style={isCurrent && !isFailed ? {
                                                    backgroundColor: `${themeColor}20`,
                                                    boxShadow: `0 0 20px ${themeColor}30`
                                                } : {}}
                                                whileHover={{ scale: 1.05 }}
                                            >
                                                {isComplete ? (
                                                    <motion.div
                                                        initial={{ scale: 0, rotate: -180 }}
                                                        animate={{ scale: 1, rotate: 0 }}
                                                        transition={{ type: "spring", stiffness: 300 }}
                                                    >
                                                        <CheckCircle2 className="w-6 h-6 text-green-400" />
                                                    </motion.div>
                                                ) : isFailed ? (
                                                    <motion.div
                                                        animate={{ rotate: [0, 5, -5, 0] }}
                                                        transition={{ duration: 0.5, repeat: Infinity }}
                                                    >
                                                        <AlertCircle className="w-6 h-6 text-red-400" />
                                                    </motion.div>
                                                ) : isCurrent ? (
                                                    <motion.div
                                                        animate={{ rotate: 360 }}
                                                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                                    >
                                                        <StepIcon className="w-6 h-6" style={{ color: themeColor }} />
                                                    </motion.div>
                                                ) : (
                                                    <StepIcon className="w-6 h-6 text-white/20" />
                                                )}
                                            </motion.div>

                                            {/* Step Info */}
                                            <div className="flex-1 min-w-0">
                                                <div className={`text-sm font-semibold ${isComplete ? 'text-green-400' :
                                                    isFailed ? 'text-red-400' :
                                                        isCurrent ? 'text-white' : 'text-white/25'
                                                    }`}>
                                                    {step.label}
                                                </div>
                                                <AnimatePresence mode="wait">
                                                    {isCurrent && (
                                                        <motion.div
                                                            initial={{ opacity: 0, height: 0 }}
                                                            animate={{ opacity: 1, height: 'auto' }}
                                                            exit={{ opacity: 0, height: 0 }}
                                                            className="text-xs text-white/40 mt-1"
                                                        >
                                                            {step.description}
                                                        </motion.div>
                                                    )}
                                                </AnimatePresence>
                                            </div>

                                            {/* Status Badge */}
                                            <AnimatePresence mode="wait">
                                                {isComplete && (
                                                    <motion.span
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        exit={{ opacity: 0, scale: 0.5 }}
                                                        className="text-[10px] font-bold text-green-400 bg-green-500/20 px-3 py-1.5 rounded-full border border-green-500/30"
                                                    >
                                                        ✓ Done
                                                    </motion.span>
                                                )}
                                                {isCurrent && !isFailed && (
                                                    <motion.span
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-[10px] font-bold px-3 py-1.5 rounded-full border"
                                                        style={{
                                                            backgroundColor: `${themeColor}20`,
                                                            color: themeColor,
                                                            borderColor: `${themeColor}40`
                                                        }}
                                                    >
                                                        <motion.span
                                                            animate={{ opacity: [1, 0.5, 1] }}
                                                            transition={{ duration: 1.5, repeat: Infinity }}
                                                        >
                                                            In Progress
                                                        </motion.span>
                                                    </motion.span>
                                                )}
                                                {isFailed && (
                                                    <motion.span
                                                        initial={{ opacity: 0, scale: 0.5 }}
                                                        animate={{ opacity: 1, scale: 1 }}
                                                        className="text-[10px] font-bold text-red-400 bg-red-500/20 px-3 py-1.5 rounded-full border border-red-500/30"
                                                    >
                                                        ✕ Failed
                                                    </motion.span>
                                                )}
                                            </AnimatePresence>
                                        </motion.div>
                                    );
                                })}
                            </div>
                        </motion.div>

                        {/* Error Details */}
                        <AnimatePresence>
                            {currentStep === 'failed' && error && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20, height: 0 }}
                                    animate={{ opacity: 1, y: 0, height: 'auto' }}
                                    exit={{ opacity: 0, y: -20, height: 0 }}
                                    className="mt-4 p-5 bg-red-500/10 border border-red-500/30 rounded-2xl backdrop-blur-xl"
                                >
                                    <p className="text-xs text-red-400 font-mono leading-relaxed">{error}</p>
                                </motion.div>
                            )}
                        </AnimatePresence>

                        {/* Action Buttons */}
                        <div className="mt-6">
                            {currentStep === 'failed' && (
                                <motion.button
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    onClick={onClose}
                                    className="w-full py-4 rounded-2xl bg-white/10 hover:bg-white/15 text-white font-semibold transition-all border border-white/10 backdrop-blur-xl"
                                    whileHover={{ scale: 1.02, boxShadow: '0 10px 40px rgba(255,255,255,0.1)' }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <span className="flex items-center justify-center gap-2">
                                        <Zap className="w-4 h-4" /> Close & Retry
                                    </span>
                                </motion.button>
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
        </AnimatePresence>
    );
};

export default TrainingProgressOverlay;
