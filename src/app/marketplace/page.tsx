"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import {
    Search,
    Star,
    GitBranch,
    TrendingUp,
    Zap,
    Loader2,
    Box,
    Cpu,
    Sparkles
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { ThemeToggle } from "@/components/theme-toggle";
import { useAuth } from "@/context/auth-context";
import { useThemeColor } from "@/context/theme-context";
import Link from "next/link";
import ColorBends from "@/components/react-bits/ColorBends";

interface PublicModel {
    id: string;
    name: string;
    description: string;
    taskType: 'classification' | 'regression';
    bestMetricValue: number;
    totalVersions: number;
    ownerId: string;
    ownerName?: string;
    updatedAt: Date;
    usageCount?: number;
}

export default function MarketplacePage() {
    const { user } = useAuth();
    const { themeColor, setThemeColor } = useThemeColor();
    const [models, setModels] = useState<PublicModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'accuracy'>('popular');
    const [filterType, setFilterType] = useState<'all' | 'classification' | 'regression'>('all');

    // Set default theme color to Orange on mount
    useEffect(() => {
        setThemeColor("#06B6D4")
    }, [setThemeColor])

    useEffect(() => {
        fetchPublicModels();
    }, []);

    const fetchPublicModels = async () => {
        setLoading(true);
        try {
            const res = await fetch('/api/registry/models');
            if (res.ok) {
                const data = await res.json();
                setModels(data.models || []);
            }
        } catch (error) {
            console.error('Failed to fetch models:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleTryModel = async (modelId: string) => {
        alert(`Demo endpoint for model ${modelId} would be created here.`);
    };

    const filteredModels = models
        .filter(model => {
            const matchesSearch = model.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
                model.description?.toLowerCase().includes(searchQuery.toLowerCase());
            const matchesType = filterType === 'all' || model.taskType === filterType;
            return matchesSearch && matchesType;
        })
        .sort((a, b) => {
            if (sortBy === 'popular') return (b.usageCount || 0) - (a.usageCount || 0);
            if (sortBy === 'recent') return new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime();
            if (sortBy === 'accuracy') return (b.bestMetricValue || 0) - (a.bestMetricValue || 0);
            return 0;
        });

    return (
        <>
            {/* Fixed Full Page Background with ColorBends */}
            <div className="fixed inset-0 bg-black" style={{ zIndex: 0 }}>
                <ColorBends
                    colors={[themeColor, themeColor, themeColor]}
                    speed={0.3}
                    scale={0.7}
                    warpStrength={1}
                    frequency={1}
                    autoRotate={0.05}
                />
            </div>

            <div className="fixed top-0 right-0 z-50"><ThemeToggle /></div>
            <div className="relative z-40"><Navbar /></div>

            <main className="relative z-10 min-h-screen p-6 pt-24 pb-12">
                {/* Header - Larger and pushed down */}
                <div className="text-center mb-10">
                    <h1 className="text-4xl md:text-5xl font-black text-white mb-3">
                        Model Marketplace
                    </h1>
                    <p className="text-white/50 text-base">
                        Discover and deploy pre-trained ML models from the community
                    </p>
                </div>

                {/* Compact Search & Filters */}
                <div className="max-w-3xl mx-auto backdrop-blur-xl bg-white/5 border border-white/10 rounded-2xl p-4 mb-8">
                    <div className="flex flex-col md:flex-row items-center gap-4">
                        {/* Search - Smaller */}
                        <div className="relative flex-1 w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                            <input
                                type="text"
                                placeholder="Search models..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-black/50 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
                            />
                        </div>

                        {/* Filters */}
                        <div className="flex items-center gap-3">
                            <div className="flex rounded-xl bg-black/50 border border-white/10 p-1">
                                {(['all', 'classification', 'regression'] as const).map(type => (
                                    <button
                                        key={type}
                                        onClick={() => setFilterType(type)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all capitalize"
                                        style={filterType === type ? {
                                            backgroundColor: `${themeColor}40`,
                                            color: themeColor
                                        } : { color: 'rgba(255,255,255,0.4)' }}
                                    >
                                        {type}
                                    </button>
                                ))}
                            </div>

                            <select
                                value={sortBy}
                                onChange={(e) => setSortBy(e.target.value as any)}
                                className="px-3 py-2 rounded-xl bg-black/50 border border-white/10 text-white text-xs focus:outline-none cursor-pointer"
                            >
                                <option value="popular" className="bg-black">🔥 Popular</option>
                                <option value="recent" className="bg-black">🕐 Recent</option>
                                <option value="accuracy" className="bg-black">🎯 Accuracy</option>
                            </select>
                        </div>
                    </div>
                </div>

                {/* Content - Full height */}
                <div className="flex-1">
                    {loading ? (
                        <div className="flex justify-center py-20">
                            <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
                        </div>
                    ) : filteredModels.length === 0 ? (
                        <div className="text-center py-20">
                            <div
                                className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <Box className="w-8 h-8" style={{ color: themeColor }} />
                            </div>
                            <h3 className="text-lg font-bold text-white mb-2">No models found</h3>
                            <p className="text-white/40 text-base mb-8">
                                {searchQuery
                                    ? 'Try adjusting your search or filters'
                                    : 'Be the first to publish a model!'}
                            </p>
                            <Link
                                href="/studio"
                                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all hover:brightness-110"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                                    color: 'white'
                                }}
                            >
                                <Cpu className="w-4 h-4" />
                                Train Your First Model
                            </Link>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                            {filteredModels.map((model, index) => (
                                <motion.div
                                    key={model.id}
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: index * 0.05 }}
                                    className="backdrop-blur-xl bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 hover:border-white/20 transition-all group"
                                >
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3">
                                            <div
                                                className="p-2 rounded-xl transition-transform group-hover:scale-110"
                                                style={{ backgroundColor: `${themeColor}20` }}
                                            >
                                                <GitBranch className="w-4 h-4" style={{ color: themeColor }} />
                                            </div>
                                            <div>
                                                <h3 className="font-semibold text-sm text-white">
                                                    {model.name}
                                                </h3>
                                                <span className={`text-[10px] px-2 py-0.5 rounded-full ${model.taskType === 'classification'
                                                    ? 'bg-blue-500/20 text-blue-400'
                                                    : 'bg-green-500/20 text-green-400'
                                                    }`}>
                                                    {model.taskType}
                                                </span>
                                            </div>
                                        </div>
                                        {model.bestMetricValue && (
                                            <div className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-yellow-500/10">
                                                <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                                                <span className="text-xs font-bold text-yellow-400">
                                                    {(model.bestMetricValue * 100).toFixed(0)}%
                                                </span>
                                            </div>
                                        )}
                                    </div>

                                    <p className="text-xs text-white/40 line-clamp-2 mb-3">
                                        {model.description || 'No description'}
                                    </p>

                                    <div className="flex items-center gap-3 text-[10px] text-white/30 mb-3">
                                        <span className="flex items-center gap-1">
                                            <TrendingUp className="w-3 h-3" />
                                            {model.usageCount || 0}
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <GitBranch className="w-3 h-3" />
                                            v{model.totalVersions || 1}
                                        </span>
                                    </div>

                                    <div className="flex items-center justify-between pt-3 border-t border-white/5">
                                        <div className="flex items-center gap-2">
                                            <div
                                                className="w-5 h-5 rounded-full flex items-center justify-center text-white text-[10px] font-bold"
                                                style={{ background: `linear-gradient(135deg, ${themeColor}, #8B5CF6)` }}
                                            >
                                                {model.ownerName?.[0]?.toUpperCase() || 'U'}
                                            </div>
                                            <span className="text-xs text-white/30">
                                                {model.ownerName || 'Anon'}
                                            </span>
                                        </div>
                                        <button
                                            onClick={() => handleTryModel(model.id)}
                                            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold transition-all hover:scale-105"
                                            style={{
                                                backgroundColor: `${themeColor}20`,
                                                color: themeColor
                                            }}
                                        >
                                            <Zap className="w-3 h-3" />
                                            Try
                                        </button>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>
        </>
    );
}
