'use client';

import React from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';
import { Code2, Image, Loader2, Check, AlertCircle, ArrowDown, Play, Trash2, Zap, Bot, Sparkles } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';
import CodeEditor from '../studio/CodeEditor';
import { GlassCard } from '../studio/GlassCard';

const Plot = dynamic(() => import('react-plotly.js'), { ssr: false, loading: () => <div className="text-white/40 text-sm">Loading Interactive Plot...</div> });

const CHART_DISPLAY_NAMES: Record<string, string> = {
    'scatter': 'Scatter Plot',
    'histogram': 'Histogram',
    'boxplot': 'Box Plot',
    'correlation': 'Correlation Matrix',
    'pairplot': 'Pair Plot Matrix',
    'bar': 'Bar Chart',
    '3d_scatter': '3D Scatter Plot',
    'violin': 'Violin Plot',
    'custom': 'Custom Visualization'
};

export interface Chart {
    id: string;
    chartType: string;
    prompt: string;
    code: string;
    imageUrl?: string;
    status: 'generating' | 'generated' | 'executed' | 'failed';
    error?: string;
    model: string;
    createdAt: any;
}

interface ChartCardProps {
    chart: Chart;
    isGenerating?: boolean;
    onRun?: (chartId: string, code?: string) => void;
    onDelete?: (chartId: string) => void;
}

export const ChartCard: React.FC<ChartCardProps> = ({ chart, isGenerating, onRun, onDelete }) => {
    const { themeColor } = useThemeColor();
    const [showFullCode, setShowFullCode] = React.useState(false);
    const [editableCode, setEditableCode] = React.useState(chart.code);
    const [plotData, setPlotData] = React.useState<any>(null);
    const [loadingPlot, setLoadingPlot] = React.useState(false);
    const { user } = useAuth(); // If auth needed for proxy fetch

    // Sync editable code when chart.code updates (e.g. from external generation)
    // assuming we want to overwrite local edits if AI regenerates
    React.useEffect(() => {
        setEditableCode(chart.code);
    }, [chart.code]);

    const displayTitle = CHART_DISPLAY_NAMES[chart.chartType] ||
        (chart.chartType.charAt(0).toUpperCase() + chart.chartType.slice(1) + ' Chart');

    // Fetch Plot Data if it's a JSON file (Plotly)
    React.useEffect(() => {
        if (chart.imageUrl && chart.imageUrl.endsWith('.json') && chart.imageUrl.startsWith('gs://')) {
            setLoadingPlot(true);
            const fetchPlot = async () => {
                try {
                    // Use Image Proxy (which handles GCS streaming) to get JSON
                    const token = await user?.getIdToken();
                    const headers: any = {};
                    if (token) headers['Authorization'] = `Bearer ${token}`;

                    const res = await fetch(`/api/visualize/image-proxy?gcsPath=${encodeURIComponent(chart.imageUrl!)}`, {
                        headers
                    });
                    const json = await res.json();
                    setPlotData(json);
                } catch (e) {
                    console.error("Failed to load plot data", e);
                } finally {
                    setLoadingPlot(false);
                }
            };
            fetchPlot();
        } else {
            setPlotData(null);
        }
    }, [chart.imageUrl, user]);

    const displayImageUrl = React.useMemo(() => {
        if (!chart.imageUrl) return null;
        if (chart.imageUrl.endsWith('.json')) return null; // Handled by plotData
        if (chart.imageUrl.startsWith('gs://')) {
            return `/api/visualize/image-proxy?gcsPath=${encodeURIComponent(chart.imageUrl)}`;
        }
        return chart.imageUrl;
    }, [chart.imageUrl]);

    const getStatusBadge = () => {
        const badges = {
            generating: { icon: Loader2, text: 'Generating...', color: 'text-yellow-400', animate: true },
            generated: { icon: Code2, text: '', color: 'text-blue-400', animate: false },
            executed: { icon: Check, text: 'Rendered', color: 'text-green-400', animate: false },
            failed: { icon: AlertCircle, text: 'Failed', color: 'text-red-400', animate: false }
        };
        const badge = badges[chart.status] || badges.generating;
        if (!badge.text && !badge.icon) return null; // Safety

        return (
            <span className={`flex items-center gap-1 text-xs ${badge.color}`} title={chart.status}>
                <badge.icon className={`w-3 h-3 ${badge.animate ? 'animate-spin' : ''}`} />
                {badge.text}
            </span>
        );
    };

    const [showDeleteConfirm, setShowDeleteConfirm] = React.useState(false);

    const handleDeleteClick = () => {
        setShowDeleteConfirm(true);
    };

    const confirmDelete = () => {
        if (onDelete) onDelete(chart.id);
        setShowDeleteConfirm(false);
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-xl overflow-hidden backdrop-blur-xl border border-white/10 flex flex-col h-[500px]"
            style={{ background: 'rgba(0,0,0,0.4)' }}
        >
            {/* Header */}
            <div className="flex items-center justify-between p-4 border-b border-white/10 bg-black/40">
                <div className="flex items-center gap-3">
                    <div
                        className="p-2 rounded-lg bg-white/5 border border-white/10"
                        title={`Generated by ${chart.model || 'Unknown'}`}
                    >
                        {chart.model?.includes('gpt') ? <Zap className="w-4 h-4 text-green-400" /> :
                            chart.model?.includes('claude') ? <Bot className="w-4 h-4 text-orange-400" /> :
                                <Sparkles className="w-4 h-4 text-blue-400" />}
                    </div>
                    <div>
                        <h3 className="font-bold text-xl tracking-wide flex items-center gap-2"
                            style={{ color: themeColor }}
                        >
                            {displayTitle}
                        </h3>
                        <p className="text-xs text-white/40 flex items-center gap-2">
                            {chart.createdAt?.seconds ? new Date(chart.createdAt.seconds * 1000).toLocaleString() : 'Just now'}
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {onDelete && (
                        <button
                            onClick={handleDeleteClick}
                            className="p-2 text-white/40 hover:text-red-400 hover:bg-red-400/10 rounded-lg transition-colors"
                            title="Delete Chart"
                        >
                            <Trash2 className="w-4 h-4" />
                        </button>
                    )}
                    <div className="h-4 w-px bg-white/10 mx-1" />
                    <button
                        onClick={onRun && chart.status !== 'generating' && !isGenerating ? () => onRun(chart.id, editableCode) : undefined}
                        disabled={isGenerating || chart.status === 'generating'}
                        className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all hover:scale-105 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed group border border-white/10"
                        style={{
                            background: isGenerating ? 'rgba(255,255,255,0.05)' : `${themeColor}20`,
                            color: isGenerating ? 'rgba(255,255,255,0.4)' : themeColor
                        }}
                    >
                        {isGenerating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4 fill-current" />}
                        {isGenerating ? 'Running...' : 'Run Code'}
                    </button>
                    {!isGenerating && getStatusBadge()}
                </div>
            </div >

            <div className="flex-1 min-h-0 flex flex-col md:flex-row divide-y md:divide-y-0 md:divide-x divide-white/10">
                {/* Code Editor Section */}
                <div className="flex-1 min-w-0 relative min-h-[200px] flex flex-col">
                    <div className="flex-1 overflow-hidden">
                        <CodeEditor
                            code={editableCode}
                            onChange={(val) => setEditableCode(val)}
                            onSave={() => onRun && onRun(chart.id, editableCode)}
                            saving={isGenerating || false}
                        />
                    </div>
                </div>

                {/* Visualization Section */}
                <div className="flex-1 min-w-0 bg-black/20 relative flex items-center justify-center min-h-[200px] p-4 overflow-hidden">
                    {(loadingPlot || isGenerating) && <Loader2 className="w-8 h-8 text-white/20 animate-spin" />}

                    {!loadingPlot && !isGenerating && plotData && (
                        <div className="w-full h-full">
                            <Plot
                                data={plotData.data}
                                layout={{
                                    ...plotData.layout,
                                    autosize: true,
                                    paper_bgcolor: '#ffffff', // Force white background
                                    plot_bgcolor: '#ffffff',
                                    font: { color: '#000000' }, // Dark text
                                    margin: { t: 40, r: 20, b: 40, l: 40 }, // More margin for labels
                                    height: undefined, // Let container control height
                                    width: undefined
                                }}
                                useResizeHandler={true}
                                style={{ width: '100%', height: '100%' }}
                                config={{ displayModeBar: true, responsive: true }}
                            />
                        </div>
                    )}

                    {!loadingPlot && !isGenerating && !plotData && displayImageUrl && (
                        <div className="relative w-full h-full flex items-center justify-center">
                            <img
                                src={displayImageUrl}
                                alt="Generated Chart"
                                className="max-w-full max-h-full object-contain rounded-lg shadow-lg"
                            />
                            <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent opacity-0 group-hover:opacity-100 transition-opacity flex items-end justify-center p-4">
                                <a
                                    href={displayImageUrl}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-4 py-2 bg-white/10 backdrop-blur rounded-lg text-xs font-medium hover:bg-white/20 transition-colors"
                                >
                                    Open Full Size
                                </a>
                            </div>
                        </div>
                    )}

                    {!loadingPlot && !isGenerating && !plotData && !displayImageUrl && (
                        <div className="text-white/20 flex flex-col items-center gap-2">
                            <div className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center">
                                <Image className="w-6 h-6" />
                            </div>
                            <p className="text-sm">No visualization generated yet</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Custom Delete Confirmation Modal */}
            {showDeleteConfirm && (
                <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-6">
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-[#1A1A1A] border border-white/10 p-6 rounded-2xl shadow-2xl max-w-sm w-full"
                    >
                        <h4 className="text-lg font-bold text-white mb-2">Delete Chart?</h4>
                        <p className="text-white/60 text-sm mb-6">
                            Are you sure you want to delete this chart? This action cannot be undone.
                        </p>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowDeleteConfirm(false)}
                                className="flex-1 px-4 py-2 rounded-xl bg-white/5 hover:bg-white/10 text-white text-sm font-medium transition-colors"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={confirmDelete}
                                className="flex-1 px-4 py-2 rounded-xl bg-red-500 hover:bg-red-600 text-white text-sm font-medium transition-colors"
                            >
                                Delete
                            </button>
                        </div>
                    </motion.div>
                </div>
            )}
        </motion.div>
    );
};

export default ChartCard;
