"use client";

import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    GitBranch,
    Search,
    Filter,
    Plus,
    ChevronRight,
    Star,
    CheckCircle2,
    Clock,
    BarChart3,
    ExternalLink,
    ArrowUpRight,
    Trash2,
    MoreVertical
} from "lucide-react";
import { Navbar } from "@/components/navbar";
import { LineageGraph } from "@/components/registry";
import { useAuth } from "@/context/auth-context";

interface Model {
    id: string;
    name: string;
    description: string;
    taskType: 'classification' | 'regression';
    bestVersionId?: string;
    bestMetricValue?: number;
    totalVersions: number;
    visibility: 'private' | 'team' | 'public';
    updatedAt: Date;
}

interface ModelVersion {
    id: string;
    versionNumber: number;
    primaryMetric: string;
    primaryMetricValue: number;
    status: string;
    isProduction: boolean;
    metrics: Record<string, number>;
    createdAt: Date;
}

export default function RegistryPage() {
    const { user } = useAuth();
    const [models, setModels] = useState<Model[]>([]);
    const [selectedModel, setSelectedModel] = useState<Model | null>(null);
    const [versions, setVersions] = useState<ModelVersion[]>([]);
    const [lineageData, setLineageData] = useState<{ nodes: any[]; edges: any[] } | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [filterType, setFilterType] = useState<'all' | 'classification' | 'regression'>('all');

    useEffect(() => {
        if (user) {
            fetchModels();
        }
    }, [user]);

    const fetchModels = async () => {
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

    const fetchVersions = async (modelId: string) => {
        try {
            const res = await fetch(`/api/registry/models/${modelId}/versions`);
            if (res.ok) {
                const data = await res.json();
                setVersions(data.versions || []);
            }
        } catch (error) {
            console.error('Failed to fetch versions:', error);
        }
    };

    const fetchLineage = async (modelId: string, versionId: string) => {
        try {
            const res = await fetch(`/api/registry/models/${modelId}/versions/${versionId}/lineage`);
            if (res.ok) {
                const data = await res.json();
                setLineageData(data);
            }
        } catch (error) {
            console.error('Failed to fetch lineage:', error);
        }
    };

    const handleModelSelect = async (model: Model) => {
        setSelectedModel(model);
        await fetchVersions(model.id);
        if (model.bestVersionId) {
            await fetchLineage(model.id, model.bestVersionId);
        }
    };

    const handlePromote = async (versionId: string) => {
        if (!selectedModel) return;

        try {
            const res = await fetch(`/api/registry/models/${selectedModel.id}/versions/${versionId}/promote`, {
                method: 'POST'
            });
            if (res.ok) {
                await fetchVersions(selectedModel.id);
            }
        } catch (error) {
            console.error('Failed to promote version:', error);
        }
    };

    const filteredModels = models.filter(model => {
        const matchesSearch = model.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            model.description.toLowerCase().includes(searchQuery.toLowerCase());
        const matchesType = filterType === 'all' || model.taskType === filterType;
        return matchesSearch && matchesType;
    });

    return (
        <div className="min-h-screen bg-gradient-to-br from-gray-900 via-black to-gray-900">
            <Navbar />

            <main className="container mx-auto px-4 py-8 pt-24">
                {/* Header */}
                <div className="flex items-center justify-between mb-8">
                    <div>
                        <h1 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                            <GitBranch className="w-8 h-8 text-blue-400" />
                            Model Registry
                        </h1>
                        <p className="text-gray-400">Manage your ML models, versions, and deployments</p>
                    </div>

                    <button className="flex items-center gap-2 px-4 py-2 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors">
                        <Plus className="w-4 h-4" />
                        Register Model
                    </button>
                </div>

                {/* Search & Filters */}
                <div className="flex items-center gap-4 mb-6">
                    <div className="relative flex-1 max-w-md">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                        <input
                            type="text"
                            placeholder="Search models..."
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                        />
                    </div>

                    <div className="flex rounded-xl bg-white/5 border border-white/10 p-1">
                        {(['all', 'classification', 'regression'] as const).map(type => (
                            <button
                                key={type}
                                onClick={() => setFilterType(type)}
                                className={`px-4 py-2 rounded-lg text-sm font-medium transition-all capitalize ${filterType === type
                                        ? 'bg-blue-500/20 text-blue-300'
                                        : 'text-gray-400 hover:text-white'
                                    }`}
                            >
                                {type}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Main Content */}
                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                    {/* Models List */}
                    <div className="lg:col-span-1 space-y-3">
                        <h2 className="text-sm font-medium text-gray-400 mb-3">
                            Models ({filteredModels.length})
                        </h2>

                        {loading ? (
                            <div className="flex items-center justify-center h-48">
                                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500" />
                            </div>
                        ) : filteredModels.length === 0 ? (
                            <div className="p-8 rounded-2xl bg-white/5 border border-white/10 text-center">
                                <GitBranch className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                <p className="text-gray-400">No models found</p>
                                <p className="text-sm text-gray-500 mt-1">
                                    Train a model to see it here
                                </p>
                            </div>
                        ) : (
                            filteredModels.map(model => (
                                <motion.button
                                    key={model.id}
                                    onClick={() => handleModelSelect(model)}
                                    className={`w-full p-4 rounded-xl text-left transition-all ${selectedModel?.id === model.id
                                            ? 'bg-blue-500/20 border-blue-500/50'
                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                        } border`}
                                    whileHover={{ scale: 1.02 }}
                                    whileTap={{ scale: 0.98 }}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <h3 className="font-medium text-white">{model.name}</h3>
                                        <span className={`text-xs px-2 py-0.5 rounded-full ${model.taskType === 'classification'
                                                ? 'bg-purple-500/20 text-purple-300'
                                                : 'bg-green-500/20 text-green-300'
                                            }`}>
                                            {model.taskType}
                                        </span>
                                    </div>
                                    <p className="text-sm text-gray-400 line-clamp-2 mb-3">
                                        {model.description || 'No description'}
                                    </p>
                                    <div className="flex items-center justify-between text-xs text-gray-500">
                                        <span>{model.totalVersions} versions</span>
                                        {model.bestMetricValue !== undefined && (
                                            <span className="flex items-center gap-1 text-yellow-400">
                                                <Star className="w-3 h-3" />
                                                {model.bestMetricValue.toFixed(3)}
                                            </span>
                                        )}
                                    </div>
                                </motion.button>
                            ))
                        )}
                    </div>

                    {/* Version Details & Lineage */}
                    <div className="lg:col-span-2 space-y-6">
                        {selectedModel ? (
                            <>
                                {/* Selected Model Header */}
                                <div className="p-6 rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10">
                                    <div className="flex items-start justify-between mb-4">
                                        <div>
                                            <h2 className="text-xl font-bold text-white">{selectedModel.name}</h2>
                                            <p className="text-gray-400">{selectedModel.description}</p>
                                        </div>
                                        <span className={`px-3 py-1 rounded-full text-sm ${selectedModel.visibility === 'public'
                                                ? 'bg-green-500/20 text-green-300'
                                                : selectedModel.visibility === 'team'
                                                    ? 'bg-blue-500/20 text-blue-300'
                                                    : 'bg-gray-500/20 text-gray-300'
                                            }`}>
                                            {selectedModel.visibility}
                                        </span>
                                    </div>

                                    {/* Versions Table */}
                                    <div className="mt-6">
                                        <h3 className="text-sm font-medium text-gray-400 mb-3">Versions</h3>
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-sm">
                                                <thead>
                                                    <tr className="text-gray-500 border-b border-white/10">
                                                        <th className="text-left py-2 px-3">Version</th>
                                                        <th className="text-left py-2 px-3">Metric</th>
                                                        <th className="text-left py-2 px-3">Status</th>
                                                        <th className="text-left py-2 px-3">Created</th>
                                                        <th className="text-right py-2 px-3">Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {versions.map(version => (
                                                        <tr
                                                            key={version.id}
                                                            className="border-b border-white/5 hover:bg-white/5"
                                                        >
                                                            <td className="py-3 px-3">
                                                                <div className="flex items-center gap-2">
                                                                    <span className="text-white font-medium">
                                                                        v{version.versionNumber}
                                                                    </span>
                                                                    {version.isProduction && (
                                                                        <span className="px-1.5 py-0.5 rounded text-[10px] bg-green-500/20 text-green-300">
                                                                            PROD
                                                                        </span>
                                                                    )}
                                                                </div>
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <span className="text-gray-300">
                                                                    {version.primaryMetric}: {version.primaryMetricValue.toFixed(4)}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3">
                                                                <span className={`px-2 py-0.5 rounded text-xs ${version.status === 'deployed'
                                                                        ? 'bg-green-500/20 text-green-300'
                                                                        : version.status === 'ready'
                                                                            ? 'bg-blue-500/20 text-blue-300'
                                                                            : 'bg-gray-500/20 text-gray-300'
                                                                    }`}>
                                                                    {version.status}
                                                                </span>
                                                            </td>
                                                            <td className="py-3 px-3 text-gray-400">
                                                                {new Date(version.createdAt).toLocaleDateString()}
                                                            </td>
                                                            <td className="py-3 px-3 text-right">
                                                                <div className="flex items-center justify-end gap-2">
                                                                    {!version.isProduction && (
                                                                        <button
                                                                            onClick={() => handlePromote(version.id)}
                                                                            className="px-2 py-1 rounded-lg bg-green-500/20 text-green-300 hover:bg-green-500/30 text-xs"
                                                                        >
                                                                            Promote
                                                                        </button>
                                                                    )}
                                                                    <button
                                                                        onClick={() => fetchLineage(selectedModel.id, version.id)}
                                                                        className="p-1.5 rounded-lg bg-white/5 text-gray-400 hover:text-white"
                                                                    >
                                                                        <BarChart3 className="w-4 h-4" />
                                                                    </button>
                                                                </div>
                                                            </td>
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                </div>

                                {/* Lineage Graph */}
                                {lineageData && (
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="rounded-2xl bg-black/30 backdrop-blur-xl border border-white/10"
                                    >
                                        <LineageGraph
                                            nodes={lineageData.nodes}
                                            edges={lineageData.edges}
                                        />
                                    </motion.div>
                                )}
                            </>
                        ) : (
                            <div className="flex items-center justify-center h-96 rounded-2xl bg-white/5 border border-white/10">
                                <div className="text-center">
                                    <ChevronRight className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                                    <p className="text-gray-400">Select a model to view details</p>
                                </div>
                            </div>
                        )}
                    </div>
                </div>
            </main>
        </div>
    );
}
