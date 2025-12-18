'use client';

import React from 'react';
import { motion } from 'framer-motion';

interface SkeletonProps {
    className?: string;
    variant?: 'text' | 'circular' | 'rectangular' | 'card';
    width?: string | number;
    height?: string | number;
    count?: number;
}

/**
 * Glassmorphic Skeleton Loader Component
 * Matches the premium aesthetic of MLForge with shimmer animation
 */
export function Skeleton({
    className = '',
    variant = 'rectangular',
    width,
    height,
    count = 1
}: SkeletonProps) {
    const baseClasses = 'relative overflow-hidden bg-white/5 backdrop-blur-sm';

    const variantClasses = {
        text: 'h-4 rounded-lg',
        circular: 'rounded-full',
        rectangular: 'rounded-xl',
        card: 'rounded-2xl'
    };

    const style: React.CSSProperties = {
        width: width || '100%',
        height: height || (variant === 'text' ? 16 : variant === 'circular' ? 48 : 'auto')
    };

    const elements = Array.from({ length: count }, (_, i) => (
        <div
            key={i}
            className={`${baseClasses} ${variantClasses[variant]} ${className}`}
            style={style}
        >
            {/* Shimmer effect */}
            <motion.div
                className="absolute inset-0 -translate-x-full"
                style={{
                    background: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.08), transparent)'
                }}
                animate={{ translateX: ['−100%', '100%'] }}
                transition={{
                    duration: 1.5,
                    repeat: Infinity,
                    ease: 'easeInOut'
                }}
            />
        </div>
    ));

    return count === 1 ? elements[0] : <div className="space-y-2">{elements}</div>;
}

/**
 * Studio Page Skeleton - matches the complex layout
 */
export function StudioSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            {/* Header skeleton */}
            <div className="flex items-center justify-between mb-6 max-w-7xl mx-auto">
                <div className="flex items-center gap-4">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div className="space-y-2">
                        <Skeleton variant="text" width={200} />
                        <Skeleton variant="text" width={120} height={12} />
                    </div>
                </div>
                <div className="flex gap-2">
                    <Skeleton variant="rectangular" width={100} height={40} className="rounded-xl" />
                    <Skeleton variant="rectangular" width={100} height={40} className="rounded-xl" />
                    <Skeleton variant="rectangular" width={40} height={40} className="rounded-xl hidden md:block" />
                    <Skeleton variant="rectangular" width={40} height={40} className="rounded-xl hidden md:block" />
                </div>
            </div>

            {/* Main grid skeleton */}
            <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-6">
                {/* Code editor skeleton */}
                <div className="relative">
                    <Skeleton variant="card" height={500} className="border border-white/10" />
                    {/* Editor header */}
                    <div className="absolute top-4 left-4 right-4 flex justify-between items-center">
                        <div className="flex gap-2">
                            <Skeleton variant="circular" width={12} height={12} />
                            <Skeleton variant="circular" width={12} height={12} />
                            <Skeleton variant="circular" width={12} height={12} />
                        </div>
                        <Skeleton variant="text" width={100} height={16} />
                    </div>
                    {/* Code lines */}
                    <div className="absolute top-16 left-4 right-4 space-y-2">
                        <Skeleton variant="text" width="80%" />
                        <Skeleton variant="text" width="60%" />
                        <Skeleton variant="text" width="90%" />
                        <Skeleton variant="text" width="40%" />
                        <Skeleton variant="text" width="75%" />
                        <Skeleton variant="text" width="55%" />
                        <Skeleton variant="text" width="85%" />
                    </div>
                </div>

                {/* Right panel skeleton */}
                <div className="flex flex-col gap-4">
                    {/* Tabs */}
                    <div className="flex gap-2 p-3 bg-white/5 rounded-2xl backdrop-blur-sm border border-white/10">
                        <Skeleton variant="rectangular" width={100} height={36} className="rounded-xl" />
                        <Skeleton variant="rectangular" width={100} height={36} className="rounded-xl" />
                        <Skeleton variant="rectangular" width={100} height={36} className="rounded-xl" />
                        <Skeleton variant="rectangular" width={100} height={36} className="rounded-xl" />
                    </div>

                    {/* Terminal area */}
                    <Skeleton variant="card" height={200} className="border border-white/10" />

                    {/* AI Chat */}
                    <div className="flex-1 bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4">
                        <div className="flex items-center gap-2 mb-4">
                            <Skeleton variant="circular" width={32} height={32} />
                            <Skeleton variant="text" width={150} />
                        </div>
                        <div className="space-y-3 mb-4">
                            <Skeleton variant="text" width="90%" />
                            <Skeleton variant="text" width="70%" />
                            <Skeleton variant="text" width="80%" />
                        </div>
                        {/* Input */}
                        <Skeleton variant="rectangular" height={48} className="rounded-xl" />
                    </div>
                </div>
            </div>
        </div>
    );
}

/**
 * Dashboard/Home Page Skeleton
 */
export function DashboardSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            <div className="max-w-7xl mx-auto">
                {/* Welcome header */}
                <div className="mb-8">
                    <Skeleton variant="text" width={300} height={32} className="mb-2" />
                    <Skeleton variant="text" width={200} height={16} />
                </div>

                {/* Stats cards */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                            <Skeleton variant="text" width={80} height={12} className="mb-2" />
                            <Skeleton variant="text" width={60} height={28} />
                        </div>
                    ))}
                </div>

                {/* Projects grid */}
                <Skeleton variant="text" width={150} height={24} className="mb-4" />
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                            <div className="flex items-center gap-3 mb-4">
                                <Skeleton variant="circular" width={40} height={40} />
                                <div className="flex-1">
                                    <Skeleton variant="text" width="70%" height={16} className="mb-1" />
                                    <Skeleton variant="text" width="50%" height={12} />
                                </div>
                            </div>
                            <Skeleton variant="rectangular" height={80} className="rounded-xl mb-4" />
                            <div className="flex gap-2">
                                <Skeleton variant="text" width={60} height={24} />
                                <Skeleton variant="text" width={80} height={24} />
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Marketplace Page Skeleton
 */
export function MarketplaceSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            <div className="max-w-7xl mx-auto">
                {/* Header */}
                <div className="text-center mb-8">
                    <Skeleton variant="text" width={250} height={36} className="mx-auto mb-2" />
                    <Skeleton variant="text" width={400} height={16} className="mx-auto" />
                </div>

                {/* Search and filters */}
                <div className="flex flex-col md:flex-row gap-4 mb-8">
                    <Skeleton variant="rectangular" height={48} className="flex-1 rounded-xl" />
                    <div className="flex gap-2">
                        <Skeleton variant="rectangular" width={120} height={48} className="rounded-xl" />
                        <Skeleton variant="rectangular" width={120} height={48} className="rounded-xl" />
                    </div>
                </div>

                {/* Model cards grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {[1, 2, 3, 4, 5, 6].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 overflow-hidden">
                            <Skeleton variant="rectangular" height={160} />
                            <div className="p-6">
                                <Skeleton variant="text" width="80%" height={20} className="mb-2" />
                                <Skeleton variant="text" width="60%" height={14} className="mb-4" />
                                <div className="flex justify-between items-center">
                                    <Skeleton variant="text" width={80} height={24} />
                                    <Skeleton variant="rectangular" width={100} height={36} className="rounded-lg" />
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Chat Page Skeleton
 */
export function ChatSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] flex">
            {/* Sidebar skeleton */}
            <div className="hidden md:block w-80 bg-white/5 backdrop-blur-sm border-r border-white/10 p-4">
                <Skeleton variant="text" width={150} height={24} className="mb-6" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="p-3 rounded-xl bg-white/5">
                            <Skeleton variant="text" width="80%" height={14} className="mb-1" />
                            <Skeleton variant="text" width="60%" height={12} />
                        </div>
                    ))}
                </div>
            </div>

            {/* Chat area */}
            <div className="flex-1 flex flex-col p-6 pt-24">
                {/* Chat header */}
                <div className="flex items-center gap-3 mb-6">
                    <Skeleton variant="circular" width={48} height={48} />
                    <div>
                        <Skeleton variant="text" width={150} height={20} className="mb-1" />
                        <Skeleton variant="text" width={100} height={14} />
                    </div>
                </div>

                {/* Messages */}
                <div className="flex-1 space-y-4">
                    <div className="flex gap-3">
                        <Skeleton variant="circular" width={36} height={36} />
                        <Skeleton variant="rectangular" width="60%" height={80} className="rounded-2xl" />
                    </div>
                    <div className="flex gap-3 justify-end">
                        <Skeleton variant="rectangular" width="50%" height={60} className="rounded-2xl" />
                    </div>
                    <div className="flex gap-3">
                        <Skeleton variant="circular" width={36} height={36} />
                        <Skeleton variant="rectangular" width="70%" height={100} className="rounded-2xl" />
                    </div>
                </div>

                {/* Input */}
                <div className="mt-4">
                    <Skeleton variant="rectangular" height={56} className="rounded-2xl" />
                </div>
            </div>
        </div>
    );
}

/**
 * Deploy Page Skeleton
 */
export function DeploySkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            <div className="max-w-5xl mx-auto">
                <div className="text-center mb-8">
                    <Skeleton variant="text" width={200} height={36} className="mx-auto mb-2" />
                    <Skeleton variant="text" width={350} height={16} className="mx-auto" />
                </div>

                {/* Deployment cards */}
                <div className="space-y-6">
                    {[1, 2, 3].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                            <div className="flex items-center justify-between mb-4">
                                <div className="flex items-center gap-4">
                                    <Skeleton variant="circular" width={48} height={48} />
                                    <div>
                                        <Skeleton variant="text" width={180} height={20} className="mb-1" />
                                        <Skeleton variant="text" width={120} height={14} />
                                    </div>
                                </div>
                                <Skeleton variant="rectangular" width={100} height={36} className="rounded-lg" />
                            </div>
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                                {[1, 2, 3, 4].map(j => (
                                    <div key={j}>
                                        <Skeleton variant="text" width={60} height={12} className="mb-1" />
                                        <Skeleton variant="text" width={80} height={20} />
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Visualize Page Skeleton
 */
export function VisualizeSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            <div className="max-w-7xl mx-auto">
                <Skeleton variant="text" width={250} height={32} className="mb-6" />

                {/* Charts grid */}
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
                    {[1, 2].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-6">
                            <Skeleton variant="text" width={150} height={20} className="mb-4" />
                            <Skeleton variant="rectangular" height={250} className="rounded-xl" />
                        </div>
                    ))}
                </div>

                {/* Metrics */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 text-center">
                            <Skeleton variant="text" width={60} height={12} className="mx-auto mb-2" />
                            <Skeleton variant="text" width={80} height={28} className="mx-auto" />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

/**
 * Profile Page Skeleton
 */
export function ProfileSkeleton() {
    return (
        <div className="min-h-screen bg-gradient-to-b from-[#0a0a0a] to-[#0f0f0f] p-6 pt-24">
            <div className="max-w-4xl mx-auto">
                {/* Profile header */}
                <div className="flex items-center gap-6 mb-8">
                    <Skeleton variant="circular" width={100} height={100} />
                    <div className="flex-1">
                        <Skeleton variant="text" width={200} height={28} className="mb-2" />
                        <Skeleton variant="text" width={250} height={16} className="mb-2" />
                        <Skeleton variant="text" width={150} height={14} />
                    </div>
                    <Skeleton variant="rectangular" width={120} height={40} className="rounded-xl" />
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
                    {[1, 2, 3, 4].map(i => (
                        <div key={i} className="bg-white/5 backdrop-blur-sm rounded-2xl border border-white/10 p-4 text-center">
                            <Skeleton variant="text" width={40} height={28} className="mx-auto mb-1" />
                            <Skeleton variant="text" width={60} height={12} className="mx-auto" />
                        </div>
                    ))}
                </div>

                {/* Activity */}
                <Skeleton variant="text" width={150} height={24} className="mb-4" />
                <div className="space-y-3">
                    {[1, 2, 3, 4, 5].map(i => (
                        <div key={i} className="flex items-center gap-4 p-4 bg-white/5 rounded-xl">
                            <Skeleton variant="circular" width={36} height={36} />
                            <div className="flex-1">
                                <Skeleton variant="text" width="60%" height={14} />
                            </div>
                            <Skeleton variant="text" width={80} height={12} />
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}

export default Skeleton;
