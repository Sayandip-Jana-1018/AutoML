"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { History, Code2, Download, GitCompare, RotateCcw, Loader2, Clock, User, Sparkles, CheckCircle2, Trash2 } from "lucide-react";
import { collection, query, orderBy, limit, onSnapshot, doc, deleteDoc, updateDoc } from "firebase/firestore";
import { db } from "@/lib/firebase";
import { GlassCard } from "./GlassCard";

interface ScriptVersion {
    id: string;
    version: number;
    createdAt: any;
    createdBy?: string;
    gcsPath?: string;
    notes?: string;
    source?: 'manual' | 'ai-suggestion';
    config?: any;
    content?: string;
    // Audit fields
    appliedBy?: string;
    appliedAt?: any;
    suggestionId?: string;
    metricsSummary?: {
        accuracy?: number;
        loss?: number;
        rmse?: number;
    };
}

interface ScriptVersionsViewProps {
    projectId: string;
    onVersionSelect: (scriptContent: string, version: number) => void;
    themeColor: string;
}

// Extract model name from script content
const getModelFromScript = (content?: string): string | null => {
    if (!content) return null;
    // Common ML model patterns - classification, regression, and clustering
    const patterns = [
        /(\w+Classifier)\s*\(/,
        /(\w+Regressor)\s*\(/,
        /Sequential\s*\(/,
        /LogisticRegression\s*\(/,
        /LinearRegression\s*\(/,
        /XGBClassifier\s*\(/,
        /XGBRegressor\s*\(/,
        /LGBMClassifier\s*\(/,
        /CatBoostClassifier\s*\(/,
        /RandomForest\w+\s*\(/,
        /GradientBoosting\w+\s*\(/,
        /SVC\s*\(/,
        /SVR\s*\(/,
        /KNeighbors\w+\s*\(/,
        /DecisionTree\w+\s*\(/,
        /NeuralNetwork\s*\(/,
        // Clustering models
        /KMeans\s*\(/,
        /DBSCAN\s*\(/,
        /AgglomerativeClustering\s*\(/,
        /MiniBatchKMeans\s*\(/,
        /SpectralClustering\s*\(/,
        /GaussianMixture\s*\(/,
    ];

    for (const pattern of patterns) {
        const match = content.match(pattern);
        if (match) return match[1] || match[0].replace(/\s*\($/, '');
    }
    return null;
};

export function ScriptVersionsView({ projectId, onVersionSelect, themeColor }: ScriptVersionsViewProps) {
    const [versions, setVersions] = useState<ScriptVersion[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
    const [loadingVersion, setLoadingVersion] = useState<string | null>(null);
    const [deletingVersion, setDeletingVersion] = useState<string | null>(null);
    const [showDiffModal, setShowDiffModal] = useState(false);
    const [diffOldVersion, setDiffOldVersion] = useState<ScriptVersion | null>(null);
    const [diffNewVersion, setDiffNewVersion] = useState<ScriptVersion | null>(null);
    const [diffContent, setDiffContent] = useState<{ old: string; new: string } | null>(null);
    const [loadingDiff, setLoadingDiff] = useState(false);
    // Delete confirmation modal
    const [deleteConfirmVersion, setDeleteConfirmVersion] = useState<ScriptVersion | null>(null);

    useEffect(() => {
        if (!projectId) return;

        const scriptsRef = collection(db, 'projects', projectId, 'scripts');
        const q = query(scriptsRef, orderBy('version', 'desc'), limit(20));

        const unsubscribe = onSnapshot(q, (snapshot) => {
            const scripts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as ScriptVersion[];
            setVersions(scripts);
            setLoading(false);
        }, (error) => {
            console.error('Error fetching script versions:', error);
            setLoading(false);
        });

        return () => unsubscribe();
    }, [projectId]);

    const formatDate = (timestamp: any) => {
        if (!timestamp) return 'Unknown';
        const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            hour: '2-digit',
            minute: '2-digit'
        });
    };

    const handleLoadVersion = async (version: ScriptVersion) => {
        setLoadingVersion(version.id);
        try {
            // If content is stored directly, use it
            if (version.content) {
                onVersionSelect(version.content, version.version);
                setSelectedVersion(version.id);
            } else if (version.gcsPath) {
                // Fetch content from GCS via API
                const res = await fetch(`/api/studio/scripts/content?path=${encodeURIComponent(version.gcsPath)}`);
                if (res.ok) {
                    const { content } = await res.json();
                    onVersionSelect(content, version.version);
                    setSelectedVersion(version.id);
                }
            }
        } catch (error) {
            console.error('Failed to load version:', error);
        } finally {
            setLoadingVersion(null);
        }
    };

    const handleDownload = (version: ScriptVersion) => {
        const content = version.content || `# Version ${version.version}\n# Download not available`;
        const blob = new Blob([content], { type: 'text/x-python' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `train_v${version.version}.py`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDownloadNotebook = (version: ScriptVersion) => {
        const content = version.content || `# Version ${version.version}\n# Download not available`;
        const notebook = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: {
                    display_name: 'Python 3',
                    language: 'python',
                    name: 'python3',
                },
                language_info: {
                    name: 'python',
                    version: '3.10.0',
                },
                mlforge: {
                    projectId,
                    version: version.version,
                    exportedAt: new Date().toISOString(),
                },
            },
            cells: [
                {
                    cell_type: 'markdown',
                    metadata: {},
                    source: [`# MLForge Training Script v${version.version}\n\nExported from MLForge Studio`],
                },
                {
                    cell_type: 'code',
                    metadata: {},
                    source: content.split('\n').map((line: string, i: number, arr: string[]) =>
                        i === arr.length - 1 ? line : line + '\n'
                    ),
                    execution_count: null,
                    outputs: [],
                },
            ],
        };

        const blob = new Blob([JSON.stringify(notebook, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `train_v${version.version}.ipynb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    };

    const handleDeleteVersion = async (version: ScriptVersion, e: React.MouseEvent) => {
        e.stopPropagation();
        setDeleteConfirmVersion(version);
    };

    const confirmDelete = async () => {
        if (!deleteConfirmVersion) return;

        setDeletingVersion(deleteConfirmVersion.id);
        setDeleteConfirmVersion(null);

        try {
            await deleteDoc(doc(db, 'projects', projectId, 'scripts', deleteConfirmVersion.id));
        } catch (err) {
            console.error('Failed to delete version:', err);
        } finally {
            setDeletingVersion(null);
        }
    };



    // Activate version globally (Load in all pages)
    const handleActivateVersion = async (version: ScriptVersion, e: React.MouseEvent) => {
        e.stopPropagation();

        // 1. Load into editor locally
        handleLoadVersion(version);

        try {
            // 2. Propagate to Project (Profile, Dashboard, etc.)
            const projectRef = doc(db, 'projects', projectId);
            await updateDoc(projectRef, {
                activeVersion: version.version,
                metrics: version.metricsSummary || {},
                lastDeployedAt: new Date(),
                currentScriptId: version.id,
                algorithm: version.config?.algorithm || 'Custom Model'
            });

            // 3. UI Feedback
            alert(`Version v${version.version} Loaded! Metrics propagated to Profile, Marketplace & Deploy pages.`);
        } catch (error) {
            console.error('Failed to activate version:', error);
            alert('Failed to propagate version. Please try again.');
        }
    };

    // View diff between this version and previous version
    const handleViewDiff = async (version: ScriptVersion, index: number, e: React.MouseEvent) => {
        e.stopPropagation();
        if (index >= versions.length - 1) {
            alert('No previous version to compare with.');
            return;
        }

        const prevVersion = versions[index + 1];
        setDiffNewVersion(version);
        setDiffOldVersion(prevVersion);
        setShowDiffModal(true);
        setLoadingDiff(true);

        try {
            // Get content for both versions
            let newContent = version.content || '';
            let oldContent = prevVersion.content || '';

            // Fetch from GCS if needed
            if (!newContent && version.gcsPath) {
                const res = await fetch(`/api/studio/scripts/content?path=${encodeURIComponent(version.gcsPath)}`);
                if (res.ok) {
                    const data = await res.json();
                    newContent = data.content || '';
                }
            }
            if (!oldContent && prevVersion.gcsPath) {
                const res = await fetch(`/api/studio/scripts/content?path=${encodeURIComponent(prevVersion.gcsPath)}`);
                if (res.ok) {
                    const data = await res.json();
                    oldContent = data.content || '';
                }
            }

            setDiffContent({ old: oldContent, new: newContent });
        } catch (error) {
            console.error('Failed to load diff:', error);
        } finally {
            setLoadingDiff(false);
        }
    };

    if (loading) {
        return (
            <GlassCard className="h-full flex items-center justify-center" hover={false}>
                <div className="text-center">
                    <Loader2 className="w-8 h-8 animate-spin text-white/40 mx-auto mb-2" />
                    <p className="text-white/40 text-sm">Loading versions...</p>
                </div>
            </GlassCard>
        );
    }

    if (versions.length === 0) {
        return (
            <GlassCard className="h-full flex items-center justify-center" hover={false}>
                <div className="text-center">
                    <History className="w-12 h-12 text-white/20 mx-auto mb-3" />
                    <p className="text-white/40 text-sm">No script versions yet</p>
                    <p className="text-white/30 text-xs mt-1">Run training to create your first version</p>
                </div>
            </GlassCard>
        );
    }

    return (
        <>
            <GlassCard className="h-full flex flex-col" hover={false}>
                {/* Header */}
                <div
                    className="px-4 py-3 border-b flex items-center gap-2"
                    style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                >
                    <History className="w-4 h-4" style={{ color: themeColor }} />
                    <span className="text-sm font-bold text-white/80">Script Versions</span>
                    {versions.length > 0 && versions[0].config?.algorithm && (
                        <span
                            className="text-xs px-2 py-0.5 rounded-full font-medium"
                            style={{ backgroundColor: `${themeColor}20`, color: themeColor }}
                        >
                            🤖 {versions[0].config.algorithm}
                        </span>
                    )}
                    <span className="text-xs text-white/40 ml-auto">{versions.length} versions</span>
                </div>

                {/* Version List with themed scrollbar */}
                <style dangerouslySetInnerHTML={{
                    __html: `
                #versions-scroll::-webkit-scrollbar {
                    width: 8px;
                }
                #versions-scroll::-webkit-scrollbar-track {
                    background: rgba(0, 0, 0, 0.2);
                    border-radius: 4px;
                }
                #versions-scroll::-webkit-scrollbar-thumb {
                    background: ${themeColor}40;
                    border-radius: 4px;
                }
                #versions-scroll::-webkit-scrollbar-thumb:hover {
                    background: ${themeColor}80;
                }
            `}} />
                <div
                    id="versions-scroll"
                    className="flex-1 p-3 space-y-2"
                    style={{
                        overflow: 'auto',
                        scrollbarWidth: 'thin',
                        scrollbarColor: `${themeColor}40 rgba(0,0,0,0.2)`,
                    }}
                >
                    {versions.map((version, index) => (
                        <motion.div
                            key={version.id}
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className={`rounded-xl p-3 cursor-pointer transition-all ${selectedVersion === version.id
                                ? ''
                                : 'hover:bg-white/5'
                                }`}
                            style={{
                                background: selectedVersion === version.id
                                    ? `${themeColor}10`
                                    : 'rgba(255,255,255,0.03)',
                                border: selectedVersion === version.id ? `2px solid ${themeColor}` : '2px solid transparent'
                            }}
                            onClick={() => handleLoadVersion(version)}
                        >
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                        className="text-xs font-bold px-2 py-0.5 rounded-full"
                                        style={{
                                            background: `${themeColor}20`,
                                            color: themeColor
                                        }}
                                    >
                                        v{version.version}
                                    </span>
                                    {/* Show model name from config or extract from content */}
                                    {(version.config?.algorithm || getModelFromScript(version.content)) && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400 font-medium">
                                            🤖 {version.config?.algorithm || getModelFromScript(version.content)}
                                        </span>
                                    )}
                                    {version.source === 'ai-suggestion' && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
                                            AI
                                        </span>
                                    )}
                                    {index === 0 && (
                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/20 text-green-400">
                                            Latest
                                        </span>
                                    )}
                                </div>

                                {loadingVersion === version.id && (
                                    <Loader2 className="w-4 h-4 animate-spin text-white/40" />
                                )}
                            </div>

                            <div className="flex items-center gap-3 text-xs text-white/40">
                                <span className="flex items-center gap-1">
                                    <Clock className="w-3 h-3" />
                                    {formatDate(version.createdAt)}
                                </span>
                                {version.createdBy && (
                                    <span className="flex items-center gap-1">
                                        <User className="w-3 h-3" />
                                        {version.createdBy.split('@')[0]}
                                    </span>
                                )}
                            </div>

                            {version.notes && (
                                <p className="text-xs text-white/50 mt-2 line-clamp-2">
                                    {version.notes}
                                </p>
                            )}

                            {/* Config summary */}
                            {version.config && (
                                <div className="flex flex-wrap gap-1 mt-2">
                                    {version.config.algorithm && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                                            {version.config.algorithm}
                                        </span>
                                    )}
                                    {version.config.epochs && (
                                        <span className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-white/40">
                                            {version.config.epochs} epochs
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Metrics summary */}
                            {version.metricsSummary && (version.metricsSummary.accuracy || version.metricsSummary.rmse) && (
                                <div className="flex items-center gap-2 mt-2 text-xs">
                                    <CheckCircle2 className="w-3 h-3 text-green-400" />
                                    {version.metricsSummary.accuracy && (
                                        <span className="text-green-400">
                                            {(version.metricsSummary.accuracy * 100).toFixed(1)}% accuracy
                                        </span>
                                    )}
                                    {version.metricsSummary.rmse && (
                                        <span className="text-blue-400">
                                            RMSE: {version.metricsSummary.rmse.toFixed(3)}
                                        </span>
                                    )}
                                </div>
                            )}

                            {/* Audit info for AI suggestions */}
                            {version.source === 'ai-suggestion' && version.appliedBy && (
                                <div className="flex items-center gap-1 mt-2 text-[10px] text-purple-400/70">
                                    <Sparkles className="w-3 h-3" />
                                    Applied by {version.appliedBy.split('@')[0]}
                                    {version.appliedAt && ` • ${formatDate(version.appliedAt)}`}
                                </div>
                            )}

                            {/* Actions */}
                            <div className="flex items-center gap-2 mt-3 pt-2 border-t border-white/5">
                                {/* Load to Editor Only */}
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleLoadVersion(version);
                                    }}
                                    disabled={loadingVersion === version.id}
                                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-white/10 text-white/70 hover:bg-white/15 transition-colors disabled:opacity-50"
                                    title="Load this version in code editor only"
                                >
                                    {loadingVersion === version.id ? (
                                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                    ) : (
                                        <Code2 className="w-3.5 h-3.5" />
                                    )}
                                    Load
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownload(version);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-white/50 hover:bg-white/10 transition-colors"
                                >
                                    <Download className="w-3 h-3" />
                                    .py
                                </button>
                                <button
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        handleDownloadNotebook(version);
                                    }}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-orange-400/70 hover:bg-orange-500/10 hover:text-orange-400 transition-colors"
                                    title="Download as Jupyter Notebook"
                                >
                                    <Download className="w-3 h-3" />
                                    .ipynb
                                </button>
                                {index < versions.length - 1 && (
                                    <button
                                        onClick={(e) => handleViewDiff(version, index, e)}
                                        className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-cyan-400/70 hover:bg-cyan-500/10 hover:text-cyan-400 transition-colors"
                                    >
                                        <GitCompare className="w-3 h-3" />
                                        Diff
                                    </button>
                                )}
                                <button
                                    onClick={(e) => handleDeleteVersion(version, e)}
                                    disabled={deletingVersion === version.id}
                                    className="flex items-center gap-1 px-2 py-1 rounded-lg text-xs text-red-400/70 hover:bg-red-500/10 hover:text-red-400 transition-colors disabled:opacity-50"
                                >
                                    {deletingVersion === version.id ? (
                                        <Loader2 className="w-3 h-3 animate-spin" />
                                    ) : (
                                        <Trash2 className="w-3 h-3" />
                                    )}
                                    Delete
                                </button>
                            </div>
                        </motion.div>
                    ))}
                </div>
            </GlassCard>

            {/* Diff Modal */}
            {showDiffModal && (
                <div className="fixed inset-0 z-50 flex items-start justify-center pt-32 px-4 pb-4" onClick={() => setShowDiffModal(false)}>
                    <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                    <motion.div
                        initial={{ opacity: 0, y: -20 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="relative w-full max-w-6xl max-h-[75vh] rounded-2xl overflow-hidden flex flex-col backdrop-blur-xl"
                        style={{
                            border: `1px solid ${themeColor}30`,
                            boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.05), inset 0 1px 0 rgba(255,255,255,0.1)`
                        }}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Modal Header */}
                        <div
                            className="flex items-center justify-between px-5 py-3 border-b"
                            style={{ borderColor: `${themeColor}20`, background: 'rgba(0,0,0,0.3)' }}
                        >
                            <div className="flex items-center gap-3">
                                <GitCompare className="w-4 h-4" style={{ color: themeColor }} />
                                <h3 className="text-sm font-bold text-white">
                                    v{diffOldVersion?.version} → v{diffNewVersion?.version}
                                </h3>
                            </div>
                            <button
                                onClick={() => setShowDiffModal(false)}
                                className="text-white/40 hover:text-white transition-colors w-6 h-6 flex items-center justify-center rounded-full hover:bg-white/10"
                            >
                                ×
                            </button>
                        </div>

                        {/* Modal Body - Line-by-line diff */}
                        <div className="flex-1 overflow-auto p-3" style={{ maxHeight: '75vh' }}>
                            {loadingDiff ? (
                                <div className="flex items-center justify-center h-40">
                                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
                                </div>
                            ) : diffContent ? (
                                <div className="grid grid-cols-2 gap-2 text-[11px] font-mono">
                                    {/* Old Version */}
                                    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(239,68,68,0.2)' }}>
                                        <div className="px-3 py-1.5 text-red-400 text-xs font-semibold" style={{ background: 'rgba(239,68,68,0.1)' }}>
                                            ◀ v{diffOldVersion?.version} (Previous)
                                        </div>
                                        <div className="p-2 space-y-0.5">
                                            {(diffContent.old || '(empty)').split('\n').map((line, i) => {
                                                const newLines = diffContent.new?.split('\n') || [];
                                                const isRemoved = !newLines.includes(line) && line.trim() !== '';
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`px-2 py-0.5 rounded ${isRemoved ? 'bg-red-500/20 text-red-300' : 'text-white/60'}`}
                                                    >
                                                        <span className="text-white/30 mr-2 select-none">{i + 1}</span>
                                                        {line || ' '}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                    {/* New Version */}
                                    <div className="rounded-lg overflow-hidden" style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(34,197,94,0.2)' }}>
                                        <div className="px-3 py-1.5 text-green-400 text-xs font-semibold" style={{ background: 'rgba(34,197,94,0.1)' }}>
                                            ▶ v{diffNewVersion?.version} (Current)
                                        </div>
                                        <div className="p-2 space-y-0.5">
                                            {(diffContent.new || '(empty)').split('\n').map((line, i) => {
                                                const oldLines = diffContent.old?.split('\n') || [];
                                                const isAdded = !oldLines.includes(line) && line.trim() !== '';
                                                return (
                                                    <div
                                                        key={i}
                                                        className={`px-2 py-0.5 rounded ${isAdded ? 'bg-green-500/20 text-green-300' : 'text-white/60'}`}
                                                    >
                                                        <span className="text-white/30 mr-2 select-none">{i + 1}</span>
                                                        {line || ' '}
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            ) : (
                                <div className="text-center text-white/40 py-10">Failed to load diff content</div>
                            )}
                        </div>

                        {/* Modal Footer */}
                        <div
                            className="px-5 py-3 border-t flex justify-end gap-2"
                            style={{ borderColor: `${themeColor}20`, background: 'rgba(0,0,0,0.3)' }}
                        >
                            <button
                                onClick={() => {
                                    if (diffOldVersion) handleLoadVersion(diffOldVersion);
                                    setShowDiffModal(false);
                                }}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-red-400 bg-red-500/10 hover:bg-red-500/20 transition-colors border border-red-500/20"
                            >
                                Restore v{diffOldVersion?.version}
                            </button>
                            <button
                                onClick={() => setShowDiffModal(false)}
                                className="px-3 py-1.5 rounded-lg text-xs font-medium text-white bg-white/10 hover:bg-white/20 transition-colors"
                            >
                                Close
                            </button>
                        </div>
                    </motion.div>
                </div>
            )
            }

            {/* Delete Confirmation Modal */}
            {deleteConfirmVersion && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4" onClick={() => setDeleteConfirmVersion(null)}>
                    <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" />
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        onClick={(e) => e.stopPropagation()}
                        className="relative w-full max-w-md rounded-2xl overflow-hidden"
                        style={{
                            background: 'linear-gradient(135deg, rgba(30,30,30,0.98), rgba(20,20,20,0.98))',
                            border: '1px solid rgba(239,68,68,0.3)',
                            boxShadow: '0 25px 50px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.05)'
                        }}
                    >
                        {/* Header with warning */}
                        <div className="p-6 pb-4 text-center">
                            <div className="w-16 h-16 mx-auto mb-4 rounded-full bg-red-500/20 flex items-center justify-center">
                                <Trash2 className="w-8 h-8 text-red-400" />
                            </div>
                            <h3 className="text-xl font-bold text-white mb-2">Delete Version {deleteConfirmVersion.version}?</h3>
                            <p className="text-white/60 text-sm">
                                This action cannot be undone. The script version will be permanently removed.
                            </p>
                        </div>

                        {/* Version info card */}
                        <div className="mx-6 mb-4 p-4 rounded-xl bg-white/5 border border-white/10">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg" style={{ background: `${themeColor}20` }}>
                                    <Code2 className="w-4 h-4" style={{ color: themeColor }} />
                                </div>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2">
                                        <span className="text-sm font-bold text-white">v{deleteConfirmVersion.version}</span>
                                        {deleteConfirmVersion.source === 'ai-suggestion' && (
                                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">AI</span>
                                        )}
                                    </div>
                                    <p className="text-xs text-white/40 truncate">
                                        {formatDate(deleteConfirmVersion.createdAt)}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="p-4 flex gap-3 border-t border-white/10">
                            <button
                                onClick={() => setDeleteConfirmVersion(null)}
                                className="flex-1 py-3 rounded-xl font-bold text-white/70 bg-white/10 hover:bg-white/20 transition-all hover:scale-[1.02] active:scale-[0.98]"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 py-3 rounded-xl font-bold text-white bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 transition-all hover:scale-[1.02] active:scale-[0.98] flex items-center justify-center gap-2"
                            >
                                <Trash2 className="w-4 h-4" />
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </>
    );
}

export default ScriptVersionsView;
