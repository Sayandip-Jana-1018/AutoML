'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle2, Sparkles, Rocket, Star, Zap } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface TrainingSuccessOverlayProps {
    isOpen: boolean;
    onClose: () => void;
    modelName?: string;
    version?: string;
    metrics?: {
        accuracy?: number;
        loss?: number;
    };
}

// Confetti particle component - Enhanced with varied shapes and sizes
const ConfettiParticle = ({ delay, x, color, shape }: { delay: number; x: number; color: string; shape: 'square' | 'circle' }) => {
    const sizeClass = 'w-3 h-3';
    const roundedClass = shape === 'circle' ? 'rounded-full' : 'rounded-sm';

    return (
        <motion.div
            className={`absolute ${sizeClass} ${roundedClass}`}
            style={{
                left: `${x}%`,
                top: -20,
                backgroundColor: color,
                rotate: Math.random() * 360,
                boxShadow: `0 0 6px ${color}60`,
            }}
            initial={{ y: -20, opacity: 1, scale: 1 }}
            animate={{
                y: typeof window !== 'undefined' ? window.innerHeight + 100 : 1000,
                opacity: [1, 1, 0.8, 0],
                rotate: [0, 360 * (2 + Math.random() * 3)],
                scale: [1, 1.2, 0.5],
                x: [(Math.random() - 0.5) * 100, (Math.random() - 0.5) * 200],
            }}
            transition={{
                duration: 4 + Math.random() * 3,
                delay: delay,
                ease: 'easeIn',
            }}
        />
    );
};

// Explosion particles
const ExplosionParticle = ({ angle, distance, color, delay }: { angle: number; distance: number; color: string; delay: number }) => (
    <motion.div
        className="absolute w-2 h-2 rounded-full"
        style={{
            backgroundColor: color,
            boxShadow: `0 0 10px ${color}`,
            left: '50%',
            top: '50%',
        }}
        initial={{ x: 0, y: 0, scale: 1, opacity: 1 }}
        animate={{
            x: Math.cos(angle) * distance,
            y: Math.sin(angle) * distance,
            scale: [1, 1.5, 0],
            opacity: [1, 1, 0],
        }}
        transition={{
            duration: 1.5,
            delay: delay,
            ease: 'easeOut',
        }}
    />
);

// Star burst animation
const StarBurst = ({ delay }: { delay: number }) => {
    const { themeColor } = useThemeColor();

    return (
        <motion.div
            className="absolute"
            style={{
                left: `${20 + Math.random() * 60}%`,
                top: `${20 + Math.random() * 60}%`,
            }}
            initial={{ scale: 0, opacity: 0, rotate: 0 }}
            animate={{
                scale: [0, 1.5, 0],
                opacity: [0, 1, 0],
                rotate: [0, 180],
            }}
            transition={{
                duration: 1,
                delay: delay,
                ease: 'easeOut',
            }}
        >
            <Star className="w-8 h-8" style={{ color: themeColor, fill: themeColor }} />
        </motion.div>
    );
};

export const TrainingSuccessOverlay = ({
    isOpen,
    onClose,
    modelName = 'Model',
    version = 'v1',
    metrics
}: TrainingSuccessOverlayProps) => {
    const { themeColor } = useThemeColor();
    const [showContent, setShowContent] = useState(false);

    // Generate confetti particles - More particles for richer celebration
    const confetti = useMemo(() =>
        Array.from({ length: 100 }).map((_, i) => ({
            id: i,
            x: Math.random() * 100,
            delay: Math.random() * 1.5, // Staggered over longer time
            color: ['#FF6B6B', '#4ECDC4', '#45B7D1', '#96CEB4', '#FFEAA7', '#DDA0DD', '#98D8C8', '#FFD700', '#FF69B4', '#00CED1', themeColor][Math.floor(Math.random() * 11)],
            shape: (['square', 'circle'] as const)[Math.floor(Math.random() * 2)],
        })), [themeColor]
    );

    // Generate explosion particles - Double for more impact
    const explosionParticles = useMemo(() =>
        Array.from({ length: 48 }).map((_, i) => ({
            id: i,
            angle: (i / 48) * Math.PI * 2,
            distance: 100 + Math.random() * 200,
            color: ['#FF6B6B', '#4ECDC4', '#FFD700', '#FF69B4', themeColor][i % 5],
            delay: 0.05 + (i % 4) * 0.03,
        })), [themeColor]
    );

    // Show content after initial explosion
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => setShowContent(true), 800);
            return () => clearTimeout(timer);
        } else {
            setShowContent(false);
        }
    }, [isOpen]);

    // Auto-close after 8 seconds for longer celebration
    useEffect(() => {
        if (isOpen) {
            const timer = setTimeout(() => onClose(), 8000);
            return () => clearTimeout(timer);
        }
    }, [isOpen, onClose]);

    return (
        <AnimatePresence>
            {isOpen && (
                <motion.div
                    className="fixed inset-0 z-[100] flex items-center justify-center overflow-hidden"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                >
                    {/* Background blur */}
                    <motion.div
                        className="absolute inset-0 bg-black/80 backdrop-blur-md"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                    />

                    {/* Confetti rain */}
                    <div className="absolute inset-0 pointer-events-none overflow-hidden">
                        {confetti.map((c) => (
                            <ConfettiParticle key={c.id} delay={c.delay} x={c.x} color={c.color} shape={c.shape} />
                        ))}
                    </div>

                    {/* Star bursts - More stars for extra magic */}
                    <div className="absolute inset-0 pointer-events-none">
                        {[0.2, 0.4, 0.6, 0.8, 1.0, 1.2, 1.4, 1.6, 2.0, 2.5, 3.0, 3.5].map((delay, i) => (
                            <StarBurst key={i} delay={delay} />
                        ))}
                    </div>

                    {/* Explosion particles from center */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center">
                        {explosionParticles.map((p) => (
                            <ExplosionParticle key={p.id} {...p} />
                        ))}
                    </div>

                    {/* Main content */}
                    <AnimatePresence>
                        {showContent && (
                            <motion.div
                                className="relative z-10 text-center"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                            >
                                {/* Checkmark with glow */}
                                <motion.div
                                    className="relative mx-auto mb-6"
                                    initial={{ scale: 0, rotate: -180 }}
                                    animate={{ scale: 1, rotate: 0 }}
                                    transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.2 }}
                                >
                                    <div
                                        className="w-24 h-24 rounded-full flex items-center justify-center mx-auto"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}, #10B981)`,
                                            boxShadow: `0 0 60px ${themeColor}80, 0 0 100px ${themeColor}40`,
                                        }}
                                    >
                                        <motion.div
                                            initial={{ pathLength: 0 }}
                                            animate={{ pathLength: 1 }}
                                            transition={{ duration: 0.5, delay: 0.5 }}
                                        >
                                            <CheckCircle2 className="w-12 h-12 text-white" />
                                        </motion.div>
                                    </div>

                                    {/* Pulsing rings */}
                                    {[1, 2, 3].map((ring) => (
                                        <motion.div
                                            key={ring}
                                            className="absolute inset-0 rounded-full border-2"
                                            style={{ borderColor: themeColor }}
                                            initial={{ scale: 1, opacity: 0.5 }}
                                            animate={{ scale: 2 + ring * 0.5, opacity: 0 }}
                                            transition={{ duration: 1.5, delay: ring * 0.2, repeat: Infinity }}
                                        />
                                    ))}
                                </motion.div>

                                {/* Title */}
                                <motion.h1
                                    className="text-4xl font-black text-white mb-2"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.3 }}
                                >
                                    🎉 Training Complete!
                                </motion.h1>

                                {/* Model name and version */}
                                <motion.div
                                    className="flex items-center justify-center gap-3 mb-4"
                                    initial={{ y: 20, opacity: 0 }}
                                    animate={{ y: 0, opacity: 1 }}
                                    transition={{ delay: 0.4 }}
                                >
                                    <span className="text-xl text-white/80">{modelName}</span>
                                    <span
                                        className="px-3 py-1 rounded-full text-sm font-bold"
                                        style={{
                                            background: `${themeColor}30`,
                                            color: themeColor,
                                        }}
                                    >
                                        {version}
                                    </span>
                                </motion.div>

                                {/* Metrics preview */}
                                {metrics && (
                                    <motion.div
                                        className="flex items-center justify-center gap-6"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.5 }}
                                    >
                                        {metrics.accuracy !== undefined && (
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-green-400">
                                                    {(metrics.accuracy * 100).toFixed(1)}%
                                                </div>
                                                <div className="text-xs text-white/50">Accuracy</div>
                                            </div>
                                        )}
                                        {metrics.loss !== undefined && (
                                            <div className="text-center">
                                                <div className="text-2xl font-bold text-blue-400">
                                                    {metrics.loss.toFixed(4)}
                                                </div>
                                                <div className="text-xs text-white/50">Loss</div>
                                            </div>
                                        )}
                                    </motion.div>
                                )}

                                {/* Sparkle decorations */}
                                <motion.div
                                    className="absolute -top-10 -left-10"
                                    animate={{ rotate: 360 }}
                                    transition={{ duration: 10, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                                </motion.div>
                                <motion.div
                                    className="absolute -top-10 -right-10"
                                    animate={{ rotate: -360 }}
                                    transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                >
                                    <Zap className="w-8 h-8 text-yellow-400" />
                                </motion.div>
                                <motion.div
                                    className="absolute -bottom-10 left-1/2 -translate-x-1/2"
                                    animate={{ y: [0, -10, 0] }}
                                    transition={{ duration: 2, repeat: Infinity }}
                                >
                                    <Rocket className="w-8 h-8 text-orange-400" />
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrainingSuccessOverlay;
