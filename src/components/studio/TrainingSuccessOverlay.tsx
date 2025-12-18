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

                    {/* Main content */}
                    <AnimatePresence>
                        {showContent && (
                            <motion.div
                                className="relative z-10"
                                initial={{ scale: 0, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0, opacity: 0 }}
                                transition={{ type: 'spring', damping: 15, stiffness: 300 }}
                            >
                                {/* Glass Card Container */}
                                <div
                                    className="relative px-12 py-10 rounded-3xl text-center backdrop-blur-2xl border"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 100%)',
                                        borderColor: `${themeColor}30`,
                                        boxShadow: `0 25px 80px rgba(0,0,0,0.5), 0 0 60px ${themeColor}20, inset 0 0 60px rgba(255,255,255,0.03)`
                                    }}
                                >
                                    {/* Floating decorative elements - corners */}
                                    <motion.div
                                        className="absolute -top-6 -left-6"
                                        animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                                        transition={{ duration: 6, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <div className="p-2 rounded-full" style={{ background: `${themeColor}20` }}>
                                            <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        className="absolute -top-6 -right-6"
                                        animate={{ rotate: -360 }}
                                        transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
                                    >
                                        <div className="p-2 rounded-full bg-yellow-500/20">
                                            <Zap className="w-6 h-6 text-yellow-400" />
                                        </div>
                                    </motion.div>
                                    <motion.div
                                        className="absolute -bottom-6 -left-6"
                                        animate={{ y: [0, -8, 0] }}
                                        transition={{ duration: 2, repeat: Infinity }}
                                    >
                                        <div className="p-2 rounded-full bg-green-500/20">
                                            <Star className="w-6 h-6 text-green-400" />
                                        </div>
                                    </motion.div>

                                    {/* Success Checkmark with enhanced glow */}
                                    <motion.div
                                        className="relative mx-auto mb-8"
                                        initial={{ scale: 0, rotate: -180 }}
                                        animate={{ scale: 1, rotate: 0 }}
                                        transition={{ type: 'spring', damping: 10, stiffness: 200, delay: 0.2 }}
                                    >
                                        {/* Pulsing rings */}
                                        <motion.div
                                            className="absolute inset-0 rounded-full"
                                            style={{ background: `${themeColor}30` }}
                                            animate={{ scale: [1, 1.4, 1.4], opacity: [0.6, 0, 0] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                        <motion.div
                                            className="absolute inset-0 rounded-full"
                                            style={{ background: `${themeColor}20` }}
                                            animate={{ scale: [1, 1.8, 1.8], opacity: [0.4, 0, 0] }}
                                            transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
                                        />
                                        <div
                                            className="relative w-28 h-28 rounded-full flex items-center justify-center mx-auto"
                                            style={{
                                                background: `linear-gradient(135deg, #10B981, ${themeColor})`,
                                                boxShadow: `0 0 80px #10B98180, 0 0 120px ${themeColor}40`,
                                            }}
                                        >
                                            <motion.div
                                                initial={{ scale: 0 }}
                                                animate={{ scale: 1 }}
                                                transition={{ delay: 0.5, type: 'spring' }}
                                            >
                                                <CheckCircle2 className="w-14 h-14 text-white" />
                                            </motion.div>
                                        </div>
                                    </motion.div>

                                    {/* Title */}
                                    <motion.h1
                                        className="text-4xl font-black text-white mb-3"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.3 }}
                                    >
                                        🎉 Training Complete!
                                    </motion.h1>

                                    {/* Model name and version */}
                                    <motion.div
                                        className="flex items-center justify-center gap-3 mb-6"
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.4 }}
                                    >
                                        <span className="text-lg text-white/70">{modelName}</span>
                                        <span
                                            className="px-3 py-1.5 rounded-full text-sm font-bold"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                                color: themeColor,
                                                border: `1px solid ${themeColor}50`
                                            }}
                                        >
                                            {version}
                                        </span>
                                    </motion.div>

                                    {/* Metrics Cards */}
                                    {metrics && (
                                        <motion.div
                                            className="flex items-stretch justify-center gap-4 mb-8"
                                            initial={{ y: 20, opacity: 0 }}
                                            animate={{ y: 0, opacity: 1 }}
                                            transition={{ delay: 0.5 }}
                                        >
                                            {metrics.accuracy !== undefined && (
                                                <div
                                                    className="flex-1 min-w-[140px] p-5 rounded-2xl border text-center"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(34,197,94,0.15) 0%, rgba(34,197,94,0.05) 100%)',
                                                        borderColor: 'rgba(34,197,94,0.3)'
                                                    }}
                                                >
                                                    <div className="text-4xl font-black text-green-400 mb-1">
                                                        {(metrics.accuracy * 100).toFixed(1)}%
                                                    </div>
                                                    <div className="text-sm text-green-400/60 font-medium">Accuracy</div>
                                                </div>
                                            )}
                                            {metrics.loss !== undefined && (
                                                <div
                                                    className="flex-1 min-w-[140px] p-5 rounded-2xl border text-center"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(59,130,246,0.15) 0%, rgba(59,130,246,0.05) 100%)',
                                                        borderColor: 'rgba(59,130,246,0.3)'
                                                    }}
                                                >
                                                    <div className="text-4xl font-black text-blue-400 mb-1">
                                                        {metrics.loss.toFixed(4)}
                                                    </div>
                                                    <div className="text-sm text-blue-400/60 font-medium">Loss</div>
                                                </div>
                                            )}
                                        </motion.div>
                                    )}

                                    {/* CTA Button */}
                                    <motion.button
                                        onClick={onClose}
                                        className="w-full py-4 rounded-2xl font-bold text-white text-lg transition-all relative overflow-hidden"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}, #8B5CF6, ${themeColor})`,
                                            backgroundSize: '200% 200%',
                                            boxShadow: `0 10px 40px ${themeColor}40`
                                        }}
                                        initial={{ y: 20, opacity: 0 }}
                                        animate={{ y: 0, opacity: 1 }}
                                        transition={{ delay: 0.6 }}
                                        whileHover={{ scale: 1.02, boxShadow: `0 15px 50px ${themeColor}60` }}
                                        whileTap={{ scale: 0.98 }}
                                    >
                                        <motion.div
                                            className="absolute inset-0"
                                            style={{
                                                background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.3), transparent)',
                                            }}
                                            animate={{ x: ['-100%', '100%'] }}
                                            transition={{ duration: 2, repeat: Infinity }}
                                        />
                                        <span className="relative flex items-center justify-center gap-3">
                                            <Rocket className="w-5 h-5" />
                                            View Your Model
                                        </span>
                                    </motion.button>
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            )}
        </AnimatePresence>
    );
};

export default TrainingSuccessOverlay;
