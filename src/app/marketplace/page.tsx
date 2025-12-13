"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    Search,
    Star,
    GitBranch,
    TrendingUp,
    Zap,
    Loader2,
    Box,
    Cpu,
    Sparkles,
    X,
    Play,
    GitFork,
    BadgeCheck,
    AlertCircle
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
    taskType: string; // Can be 'classification', 'regression', 'unknown', or other values
    bestMetricValue: number;
    totalVersions: number;
    ownerId: string;
    ownerName?: string;
    ownerPhotoURL?: string;
    updatedAt: Date;
    usageCount?: number;
    feature_columns?: string[];
    target_column?: string;
    verified?: boolean;
    isPublic?: boolean;
    algorithm?: string;
    forkCount?: number;
}

export default function MarketplacePage() {
    const { user } = useAuth();
    const { themeColor, setThemeColor } = useThemeColor();
    const [models, setModels] = useState<PublicModel[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [sortBy, setSortBy] = useState<'popular' | 'recent' | 'accuracy'>('popular');
    const [filterType, setFilterType] = useState<'all' | 'classification' | 'regression'>('all');

    // Try Model Modal State
    const [selectedModel, setSelectedModel] = useState<PublicModel | null>(null);
    const [isTryModalOpen, setIsTryModalOpen] = useState(false);

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

    const handleTryModel = (model: PublicModel) => {
        setSelectedModel(model);
        setIsTryModalOpen(true);
    };

    const [forking, setForking] = useState<string | null>(null);

    const handleForkModel = async (model: PublicModel) => {
        if (!user) {
            window.location.href = `/login?redirect=/marketplace`;
            return;
        }

        setForking(model.id);
        try {
            const token = await user.getIdToken();
            const res = await fetch(`/api/marketplace/${model.id}/fork`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                }
            });

            const data = await res.json();

            if (data.success && data.redirectUrl) {
                window.location.href = data.redirectUrl;
            } else {
                alert(data.error || 'Failed to fork model');
            }
        } catch (error) {
            console.error('Fork error:', error);
            alert('Failed to fork model');
        } finally {
            setForking(null);
        }
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
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 max-w-7xl mx-auto">
                            {filteredModels.map((model, index) => (
                                <motion.div
                                    key={model.id}
                                    initial={{ opacity: 0, y: 20, rotateX: -10 }}
                                    animate={{ opacity: 1, y: 0, rotateX: 0 }}
                                    transition={{ delay: index * 0.05, type: "spring", stiffness: 100 }}
                                    whileHover={{
                                        y: -8,
                                        scale: 1.02,
                                        transition: { duration: 0.2 }
                                    }}
                                    className="group relative h-auto"
                                    style={{ perspective: '1000px' }}
                                >
                                    {/* Border Glow on Hover */}
                                    <div
                                        className="absolute -inset-[1px] rounded-3xl opacity-0 group-hover:opacity-60 transition-opacity duration-500"
                                        style={{
                                            background: `linear-gradient(135deg, ${themeColor}60, transparent, ${themeColor}40)`,
                                            filter: 'blur(3px)'
                                        }}
                                    />

                                    {/* Card Content - Transparent Glassmorphic */}
                                    <div
                                        className="relative h-full backdrop-blur-xl rounded-3xl p-5 flex flex-col transition-all duration-300 overflow-hidden bg-white/5 border border-white/10 group-hover:border-white/20 group-hover:bg-white/[0.08]"
                                    >
                                        {/* Subtle Shimmer Overlay on Hover */}
                                        <div
                                            className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 pointer-events-none rounded-3xl"
                                            style={{
                                                background: `linear-gradient(45deg, transparent 40%, ${themeColor}30 50%, transparent 60%)`,
                                                backgroundSize: '200% 100%',
                                                animation: 'shimmer 3s infinite'
                                            }}
                                        />

                                        {/* Header with Icon */}
                                        <div className="flex items-start justify-between mb-4 relative z-10">
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-14 h-14 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-3 mx-auto"
                                                    style={{
                                                        background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`,
                                                        boxShadow: `0 4px 20px ${themeColor}20`
                                                    }}
                                                >
                                                    <GitBranch className="w-6 h-6" style={{ color: themeColor }} />
                                                </div>
                                            </div>
                                            {model.bestMetricValue && (
                                                <div
                                                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-full"
                                                    style={{
                                                        background: 'linear-gradient(135deg, rgba(234,179,8,0.2), rgba(234,179,8,0.05))',
                                                        border: '1px solid rgba(234,179,8,0.3)'
                                                    }}
                                                >
                                                    <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                                    <span className="text-xs font-bold text-yellow-400">
                                                        {(model.bestMetricValue * 100).toFixed(0)}%
                                                    </span>
                                                </div>
                                            )}
                                        </div>

                                        {/* Model Info - Center Aligned */}
                                        <div className="flex-1 relative z-10 text-center">
                                            <h3 className="font-bold text-lg text-white mb-2 line-clamp-1">
                                                {model.name}
                                            </h3>
                                            {/* Only show taskType badge if it's a valid value */}
                                            {model.taskType && model.taskType !== 'unknown' && (
                                                <span className={`inline-block text-[10px] px-3 py-1 rounded-full mb-3 ${model.taskType === 'classification'
                                                    ? 'bg-blue-500/20 text-blue-400 border border-blue-500/30'
                                                    : 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30'
                                                    }`}>
                                                    {model.taskType === 'classification' ? 'Classification' : 'Regression'}
                                                </span>
                                            )}
                                            {/* Show ML badge if taskType is unknown */}
                                            {(!model.taskType || model.taskType === 'unknown') && (
                                                <span className="inline-block text-[10px] px-3 py-1 rounded-full mb-3 bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                    ML Model
                                                </span>
                                            )}
                                            <p className="text-xs text-white/40 line-clamp-2 mb-3 mx-auto max-w-[180px]">
                                                {model.description || 'Trained machine learning model'}
                                            </p>
                                        </div>

                                        {/* Stats Row - Center */}
                                        <div className="flex items-center justify-center gap-4 text-[11px] text-white/30 mb-4 relative z-10">
                                            <span className="flex items-center gap-1.5">
                                                <TrendingUp className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                <span className="text-white/50">{model.usageCount || 0} uses</span>
                                            </span>
                                            <span className="flex items-center gap-1.5">
                                                <GitBranch className="w-3.5 h-3.5 text-purple-400" />
                                                <span className="text-white/50">v{model.totalVersions || 1}</span>
                                            </span>
                                        </div>

                                        {/* Footer - Center aligned with stacked layout */}
                                        <div className="pt-3 border-t border-white/5 relative z-10 space-y-3">
                                            <div className="flex items-center justify-center gap-2">
                                                {model.ownerPhotoURL ? (
                                                    <img
                                                        src={model.ownerPhotoURL}
                                                        alt=""
                                                        className="w-6 h-6 rounded-full object-cover border border-white/20"
                                                    />
                                                ) : (
                                                    <div
                                                        className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold bg-white/10 border border-white/20"
                                                    >
                                                        {(model.ownerName || 'M')[0]?.toUpperCase()}
                                                    </div>
                                                )}
                                                <span className="text-xs text-white/50 flex items-center gap-1">
                                                    {model.ownerName || 'MLForge User'}
                                                    {model.verified && (
                                                        <span title="Verified">
                                                            <BadgeCheck className="w-3.5 h-3.5 text-blue-400" />
                                                        </span>
                                                    )}
                                                </span>
                                            </div>
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => handleForkModel(model)}
                                                    disabled={forking === model.id}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 bg-white/5 border border-white/10 hover:bg-white/10 text-white/70"
                                                >
                                                    {forking === model.id ? (
                                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                                    ) : (
                                                        <GitFork className="w-3.5 h-3.5" />
                                                    )}
                                                    Fork
                                                </button>
                                                <button
                                                    onClick={() => handleTryModel(model)}
                                                    className="flex-1 flex items-center justify-center gap-1.5 px-4 py-2.5 rounded-xl text-xs font-bold transition-all hover:scale-105 bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30"
                                                    style={{ color: themeColor }}
                                                >
                                                    <Zap className="w-3.5 h-3.5" />
                                                    Try
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                </motion.div>
                            ))}
                        </div>
                    )}
                </div>
            </main>

            {/* Try Model Modal */}
            {selectedModel && (
                <TryModelModal
                    isOpen={isTryModalOpen}
                    onClose={() => setIsTryModalOpen(false)}
                    model={selectedModel}
                    themeColor={themeColor}
                />
            )}
        </>
    );
}

// Try Model Modal Component
function TryModelModal({ isOpen, onClose, model, themeColor }: {
    isOpen: boolean;
    onClose: () => void;
    model: PublicModel;
    themeColor: string;
}) {
    const [formData, setFormData] = useState<Record<string, string>>({});
    const [result, setResult] = useState<any>(null);
    const [loading, setLoading] = useState(false);
    const [featureColumns, setFeatureColumns] = useState<string[]>([]);

    useEffect(() => {
        if (isOpen && model) {
            // Use feature_columns if available, otherwise generate sample columns
            if (model.feature_columns && model.feature_columns.length > 0) {
                setFeatureColumns(model.feature_columns);
                initializeFormData(model.feature_columns);
            } else {
                // Generate sample columns based on model type
                const sampleCols = model.taskType === 'classification'
                    ? ['feature_1', 'feature_2', 'feature_3']
                    : ['input_1', 'input_2', 'input_3'];
                setFeatureColumns(sampleCols);
                initializeFormData(sampleCols);
            }
        }
    }, [isOpen, model]);

    const initializeFormData = (columns: string[]) => {
        const initial: Record<string, string> = {};
        columns.forEach(col => { initial[col] = ''; });
        setFormData(initial);
    };

    const fillSampleData = () => {
        const sample: Record<string, string> = {};
        featureColumns.forEach(col => {
            // Generate random numeric values
            sample[col] = String((Math.random() * 100).toFixed(2));
        });
        setFormData(sample);
    };

    const handlePredict = async () => {
        setLoading(true);
        setResult(null);

        try {
            // Convert form data to numbers
            const data: Record<string, any> = {};
            Object.entries(formData).forEach(([key, value]) => {
                const numValue = parseFloat(value);
                data[key] = isNaN(numValue) ? value : numValue;
            });

            // Call prediction API (marketplace models may have different endpoint)
            const res = await fetch('/api/registry/predict', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    model_id: model.id,
                    data
                })
            });

            const json = await res.json();

            if (!res.ok) {
                setResult({ error: json.error || 'Prediction failed' });
            } else {
                setResult(json);
            }
        } catch (e: any) {
            setResult({ error: e.message || 'Request failed' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg"
                    >
                        {/* Subtle Border Glow */}
                        <div
                            className="absolute -inset-[1px] rounded-3xl opacity-40"
                            style={{
                                background: `linear-gradient(135deg, ${themeColor}50, transparent, ${themeColor}30)`,
                                filter: 'blur(2px)'
                            }}
                        />

                        {/* Modal Content - Transparent Glassmorphic - No Scrollbar */}
                        <div className="relative rounded-3xl p-6 backdrop-blur-xl bg-black/40 border border-white/10 overflow-hidden">
                            {/* Close Button */}
                            <button
                                onClick={onClose}
                                className="absolute top-4 right-4 w-7 h-7 rounded-full flex items-center justify-center transition-all hover:bg-white/10 bg-white/5 border border-white/10"
                            >
                                <X className="w-3.5 h-3.5 text-white/60" />
                            </button>

                            {/* Centered Header - Compact */}
                            <div className="text-center mb-5">
                                <div
                                    className="w-12 h-12 rounded-xl mx-auto mb-3 flex items-center justify-center bg-white/5 border border-white/10"
                                >
                                    <Play className="w-5 h-5" style={{ color: themeColor }} />
                                </div>
                                <h2 className="text-lg font-bold text-white mb-0.5">{model.name}</h2>
                                <p className="text-xs text-white/40">
                                    {model.taskType && model.taskType !== 'unknown' ? model.taskType : 'ML Model'} {model.ownerName ? `• ${model.ownerName}` : ''}
                                </p>
                            </div>

                            {/* Accuracy Badge - Compact */}
                            {model.bestMetricValue && (
                                <div className="flex justify-center mb-4">
                                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                        <Star className="w-3.5 h-3.5 fill-yellow-400 text-yellow-400" />
                                        <span className="text-xs font-bold text-yellow-400">
                                            {(model.bestMetricValue * 100).toFixed(0)}%
                                        </span>
                                    </div>
                                </div>
                            )}

                            {/* Input Form - Compact */}
                            <div className="mb-4">
                                <div className="flex items-center justify-between mb-3">
                                    <label className="text-xs font-medium text-white/60">
                                        Features ({featureColumns.length})
                                    </label>
                                    <button
                                        onClick={fillSampleData}
                                        className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold transition-all hover:scale-105 bg-white/5 border border-white/10 hover:bg-white/10"
                                        style={{ color: themeColor }}
                                    >
                                        <Sparkles className="w-3 h-3" />
                                        Fill
                                    </button>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    {featureColumns.map((col, idx) => (
                                        <div key={col}>
                                            <label className="text-xs text-white/40 mb-1.5 block font-medium">{col}</label>
                                            <input
                                                type="text"
                                                value={formData[col] || ''}
                                                onChange={e => setFormData({ ...formData, [col]: e.target.value })}
                                                className={`w-full rounded-xl px-4 py-3 text-sm text-white outline-none transition-all bg-white/5 border ${formData[col] ? 'border-white/30' : 'border-white/10'} focus:border-white/30`}
                                                placeholder={`Enter ${col}`}
                                            />
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Result - Compact */}
                            {result && (
                                <div className="mb-4">
                                    <div className={`rounded-xl p-4 text-center bg-white/5 border ${result.error ? 'border-red-500/30' : 'border-white/10'}`}>
                                        {result.error ? (
                                            <p className="text-red-400 text-xs">{result.error}</p>
                                        ) : (
                                            <div className="space-y-2">
                                                <div>
                                                    <span className="text-white/50 text-[10px] block mb-0.5">Prediction</span>
                                                    <span className="text-xl font-bold" style={{ color: themeColor }}>
                                                        {result.prediction ?? 'N/A'}
                                                    </span>
                                                </div>
                                                {result.probability && (
                                                    <div className="flex items-center justify-center gap-2">
                                                        <div className="h-1 w-16 rounded-full overflow-hidden bg-white/10">
                                                            <div
                                                                className="h-full rounded-full"
                                                                style={{ width: `${result.probability * 100}%`, background: themeColor }}
                                                            />
                                                        </div>
                                                        <span className="text-[10px] font-bold text-white/50">
                                                            {(result.probability * 100).toFixed(0)}%
                                                        </span>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}

                            {/* Predict Button - Compact */}
                            <button
                                onClick={handlePredict}
                                disabled={loading || Object.values(formData).some(v => !v)}
                                className="w-full py-3 rounded-xl font-bold text-sm disabled:opacity-50 transition-all hover:scale-[1.02] flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/15 hover:border-white/30"
                                style={{ color: themeColor }}
                            >
                                {loading ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Play className="w-4 h-4" />
                                        Run Prediction
                                    </>
                                )}
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
