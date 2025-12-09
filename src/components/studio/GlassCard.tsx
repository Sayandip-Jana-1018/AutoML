'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface GlassCardProps {
    children: React.ReactNode;
    className?: string;
    hover?: boolean;
}

export const GlassCard = ({ children, className = '', hover = true }: GlassCardProps) => (
    <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={`
            relative backdrop-blur-xl 
            bg-white/5 dark:bg-white/5 light:bg-black/5
            border border-white/10 dark:border-white/10 light:border-black/10
            rounded-2xl shadow-2xl
            ${hover ? 'hover:bg-white/10 dark:hover:bg-white/10 light:hover:bg-black/10 hover:border-white/20 dark:hover:border-white/20 light:hover:border-black/20 transition-all duration-300' : ''}
            ${className}
        `}
    >
        {children}
    </motion.div>
);

export default GlassCard;
