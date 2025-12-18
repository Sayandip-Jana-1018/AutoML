'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    BarChart3, TrendingUp, Loader2, ChevronRight, Sparkles, Send, CheckCircle, Wand2
} from 'lucide-react';
import { Navbar } from '@/components/navbar';
import { ThemeToggle } from '@/components/theme-toggle';
import { useThemeColor } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';
import Plasma from '@/components/react-bits/Plasma';
import Link from 'next/link';
import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { ChartCard, ChartGrid, Chart, POPULAR_CHARTS } from '@/components/visualize';
import { ProjectModal } from '@/components/visualize/ProjectModal';
import { doc, getDoc, updateDoc } from 'firebase/firestore';
import { runClientSidePython } from '@/lib/pyodide-manager';

type TabType = 'comparison' | 'charts';

interface Model {
    id: string;
    name: string;
    projectId: string;
    accuracy?: number;
    precision?: number;
    recall?: number;
    f1?: number;
    silhouette?: number;  // Clustering metric
    createdAt: any;
    status: string;
    scriptVersion?: number;
    metrics?: {
        accuracy?: number;
        precision?: number;
        recall?: number;
        f1?: number;
        silhouette?: number;
    };
    bestMetricValue?: number;
}

export default function VisualizePage() {
    const { themeColor } = useThemeColor();
    const { user, userTier } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('comparison');
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);
    const [selectedModels, setSelectedModels] = useState<string[]>([]);

    // Chart state
    const [chartPrompt, setChartPrompt] = useState('');
    const [generatingChart, setGeneratingChart] = useState<string | null>(null);
    const [selectedAiModel, setSelectedAiModel] = useState<'gemini' | 'openai' | 'claude'>('gemini');
    const [executionLogs, setExecutionLogs] = useState<string[]>([]);
    const [charts, setCharts] = useState<Chart[]>([]);
    const [selectedProject, setSelectedProject] = useState<string | null>(null);
    const [selectedProjectName, setSelectedProjectName] = useState<string>('');
    const [projectDatasetPath, setProjectDatasetPath] = useState<string | null>(null);
    const [isProjectModalOpen, setIsProjectModalOpen] = useState(false);

    // Custom alert modal state (replacing browser alert)
    const [alertModal, setAlertModal] = useState({ open: false, title: '', message: '' });
    const showAlertModal = (title: string, message: string) => setAlertModal({ open: true, title, message });

    // Derived state for generated chart types (auto-updates when charts change)
    const generatedChartTypes = React.useMemo(() => charts.map(c => c.chartType), [charts]);

    // Fetch project name and dataset path when selected
    useEffect(() => {
        if (!selectedProject) return;
        const fetchProjectDetails = async () => {
            try {
                const docRef = doc(db, 'projects', selectedProject);
                const snap = await getDoc(docRef);
                if (snap.exists()) {
                    const data = snap.data();
                    setSelectedProjectName(data.name || 'Untitled Project');
                    // Try to find GCS path in various potential fields
                    const path = data.datasetGcsPath || data.datasetPath || (data.dataset ? data.dataset.path : null) || (data.dataset ? data.dataset.gcsPath : null);
                    setProjectDatasetPath(path);
                    console.log('Project Dataset Path:', path);
                }
            } catch (err) {
                console.error('Error fetching project:', err);
            }
        };
        fetchProjectDetails();
    }, [selectedProject]);

    // Fetch models
    useEffect(() => {
        if (!user?.uid) return;

        const fetchData = async () => {
            try {
                // Fetch models - get all then filter client-side by ownerId
                const modelsRef = collection(db, 'models');
                const modelsSnapshot = await getDocs(modelsRef);
                const fetchedModels = modelsSnapshot.docs
                    .map(doc => {
                        const data = doc.data();
                        // Flatten metrics if nested
                        return {
                            id: doc.id,
                            name: data.name || 'Untitled Model',
                            projectId: data.projectId,
                            status: data.status || 'ready',
                            scriptVersion: data.scriptVersion || 1,
                            createdAt: data.createdAt,
                            ownerId: data.ownerId,
                            // Flatten metrics from nested object or use flat fields
                            accuracy: data.metrics?.accuracy ?? data.accuracy,
                            precision: data.metrics?.precision ?? data.precision,
                            recall: data.metrics?.recall ?? data.recall,
                            f1: data.metrics?.f1 ?? data.f1,
                            // Clustering metrics
                            silhouette: data.metrics?.silhouette,
                            // Use best available metric for display
                            bestMetricValue: data.bestMetricValue ?? data.metrics?.accuracy ?? data.metrics?.silhouette ?? data.metrics?.r2
                        } as Model & { ownerId?: string };
                    })
                    .filter(m => m.ownerId === user.uid || m.projectId); // Filter by owner
                setModels(fetchedModels);

                setModels(fetchedModels);

                /* Project fetching removed - handled by ProjectModal */
                /*
                const projectsRef = collection(db, 'projects');
                ...
                setProjects(fetchedProjects);
                */

            } catch (error) {
                console.error('Failed to fetch data:', error);
            } finally {
                setLoading(false);
            }
        };

        fetchData();
    }, [user?.uid, selectedProject]);

    // Fetch charts for selected project
    useEffect(() => {
        if (!selectedProject || !user?.uid) {
            setCharts([]);
            return;
        }

        const fetchCharts = async () => {
            try {
                const q = query(
                    collection(db, 'charts'),
                    where('projectId', '==', selectedProject),
                    where('userId', '==', user.uid),
                    limit(50)
                );
                const snapshot = await getDocs(q);
                let fetchedCharts = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Chart[];

                // Sort client-side
                fetchedCharts.sort((a: any, b: any) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0));
                fetchedCharts = fetchedCharts.slice(0, 20);

                setCharts(fetchedCharts);
            } catch (error) {
                console.error('Failed to fetch charts:', error);
                setCharts([]);
            }
        };
        fetchCharts();
    }, [selectedProject, user?.uid]);


    const handleGenerateChart = useCallback(async (chartTypeOrPrompt: string) => {
        if (!selectedProject) {
            showAlertModal('No Project Selected', 'Please select a project first to generate charts. Click the "Project: Select a Project" button above to choose one.');
            return;
        }
        if (!user) return;

        const isCustom = !POPULAR_CHARTS.some(c => c.id === chartTypeOrPrompt);
        const chartType = isCustom ? 'custom' : chartTypeOrPrompt;

        setGeneratingChart(chartType);

        try {
            const token = await user.getIdToken();
            const response = await fetch('/api/studio/charts', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify({
                    projectId: selectedProject,
                    chartType: isCustom ? undefined : chartType,
                    customPrompt: isCustom ? chartTypeOrPrompt : undefined,
                    aiModel: selectedAiModel
                })
            });

            const data = await response.json();

            if (data.alreadyExists) {
                showAlertModal('Chart Already Exists', 'This chart type has already been generated for this project. You can find it in the Generated Charts section below.');
            } else if (data.success && data.chart) {
                setCharts(prev => [data.chart, ...prev]);

                // Auto-Run the new chart
                // valid chart object: data.chart
                handleRunChart(data.chart.id, data.chart.code);
            }
        } catch (error) {
            console.error('Chart generation failed:', error);
        } finally {
            setGeneratingChart(null);
            setChartPrompt('');
        }
    }, [selectedProject, user, selectedAiModel]);

    // Handle running chart code (Client-Side Pyodide with REAL Proxy Data)
    const handleDeleteChart = async (chartId: string) => {
        // Confirmation handled by UI Modal now
        try {
            // Optimistic update
            setCharts(prev => prev.filter(c => c.id !== chartId));

            const token = await user?.getIdToken();
            await fetch(`/api/visualize/delete-chart?chartId=${chartId}&projectId=${selectedProject}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${token}`
                }
            });
        } catch (err) {
            console.error('Failed to delete chart:', err);
        }
    };

    const handleRunChart = async (chartId: string, code?: string) => {
        const chartToRun = charts.find(c => c.id === chartId);
        if (!chartToRun) return;

        setCharts(prev => prev.map(c => c.id === chartId ? { ...c, status: 'generating', error: undefined } : c));
        setExecutionLogs([]); // Clear logs

        try {
            // 1. Fetch Dataset (Client-Side Proxy)
            let csvData = '';
            if (projectDatasetPath && user) {
                const token = await user?.getIdToken();
                const proxyUrl = `/api/visualize/dataset-proxy?projectId=${selectedProject}&gcsPath=${encodeURIComponent(projectDatasetPath)}`;
                const res = await fetch(proxyUrl, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (!res.ok) throw new Error('Failed to fetch dataset');
                csvData = await res.text();
            }

            // 2. Execute Pyodide (Plotly JSON)
            let currentCode = code || chartToRun.code || '';
            let execResult = await runClientSidePython(currentCode, csvData);
            setExecutionLogs(execResult.logs);

            // AUTO-REPAIR PIPELINE
            if (execResult.error) {
                console.log('Execution failed. Attempting Auto-Repair...', execResult.error);
                // Update status to show repairing
                setCharts(prev => prev.map(c => c.id === chartId ? { ...c, status: 'generating', error: 'Auto-repairing...' } : c));

                try {
                    const token = await user?.getIdToken();
                    const repairRes = await fetch('/api/studio/charts/repair', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            code: currentCode,
                            error: execResult.error,
                            datasetPath: projectDatasetPath
                        })
                    });
                    const repairData = await repairRes.json();

                    if (repairData.code) {
                        console.log('Code repaired. Retrying execution...');
                        currentCode = repairData.code; // Update code
                        execResult = await runClientSidePython(currentCode, csvData);
                        setExecutionLogs(prev => [...prev, '--- Auto-Repair ---', ...execResult.logs]);

                        // If still error, throw it
                        if (execResult.error) throw new Error("Repair failed: " + execResult.error);
                    } else {
                        throw new Error(execResult.error);
                    }
                } catch (repairErr: any) {
                    throw new Error(repairErr.message || execResult.error);
                }
            }

            const { plotData, error } = execResult;

            if (plotData) {
                // 3. Save to GCS (Real Backend Persistence)
                let finalImageUrl = ''; // It will be a gs:// URI ending in .json
                try {
                    const token = await user?.getIdToken();
                    console.log('Saving plot to GCS...');
                    const saveRes = await fetch('/api/visualize/save-plot', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                            'Authorization': `Bearer ${token}`
                        },
                        body: JSON.stringify({
                            projectId: selectedProject,
                            chartId,
                            plotData: plotData // Send JSON string
                        })
                    });
                    const saveData = await saveRes.json();
                    if (saveData.success && saveData.imageUrl) {
                        finalImageUrl = saveData.imageUrl; // gs://.../output.json
                        console.log('Saved to GCS:', finalImageUrl);
                    }

                    // ALSO update the code in Firestore if we repaired it!
                    if (currentCode !== (code || chartToRun.code)) {
                        // We need to update the chart document with new code
                        await updateDoc(doc(db, 'charts', chartId), {
                            code: currentCode
                        });
                    }

                } catch (saveErr) {
                    console.error('Failed to save plot to GCS', saveErr);
                }

                // 4. Update local state
                setCharts(prev => prev.map(c => c.id === chartId ? {
                    ...c,
                    status: 'executed',
                    imageUrl: finalImageUrl,
                    error: undefined,
                    code: currentCode // Update code locally to repaired version
                } : c));

                // 5. Persist to Firestore
                const chartRef = doc(db, 'charts', chartId);
                const updateData: any = {
                    status: 'executed',
                    imageUrl: finalImageUrl,
                    updatedAt: new Date(),
                    datasetPath: projectDatasetPath
                };
                if (code) {
                    updateData.code = code;
                }
                await updateDoc(chartRef, updateData);
            } else {
                throw new Error(error || 'No plot generated');
            }
        } catch (err: any) {
            console.error('Execution failed:', err);
            setCharts(prev => prev.map(c => c.id === chartId ? {
                ...c,
                status: 'failed',
                error: err.message
            } : c));

            const chartRef = doc(db, 'charts', chartId);
            await updateDoc(chartRef, {
                status: 'failed',
                error: err.message
            });
        }
    };

    const toggleModelSelection = (modelId: string) => {
        setSelectedModels(prev =>
            prev.includes(modelId)
                ? prev.filter(id => id !== modelId)
                : [...prev, modelId]
        );
    };

    const renderTabContent = () => {
        if (loading) {
            return (
                <div className="flex items-center justify-center h-64">
                    <Loader2 className="w-8 h-8 animate-spin" style={{ color: themeColor }} />
                </div>
            );
        }

        if (activeTab === 'comparison') {
            return (
                <div className="space-y-6">

                    {models.length === 0 ? (
                        <div className="text-center py-16">
                            <BarChart3 className="w-16 h-16 mx-auto text-white/20 mb-4" />
                            <h3 className="text-xl font-semibold text-white/60 mb-2">No Models Yet</h3>
                            <p className="text-white/40 mb-6">Train your first model in the Studio</p>
                            <Link
                                href="/studio"
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"
                                style={{ background: themeColor, color: 'black' }}
                            >
                                Go to Studio <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : (
                        <div
                            className="rounded-2xl overflow-hidden backdrop-blur-xl mx-auto max-w-5xl"
                            style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-white/10">
                                            <th className="p-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Select</th>
                                            <th className="p-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Model</th>
                                            <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Accuracy</th>
                                            <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Precision</th>
                                            <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Recall</th>
                                            <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">F1</th>
                                            <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Status</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {models.map((model, i) => (
                                            <motion.tr
                                                key={model.id}
                                                initial={{ opacity: 0, y: 10 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ delay: i * 0.05 }}
                                                className="border-b border-white/5 hover:bg-white/5 transition-colors cursor-pointer"
                                                onClick={() => toggleModelSelection(model.id)}
                                            >
                                                <td className="p-4">
                                                    <div
                                                        className="w-5 h-5 rounded border-2 flex items-center justify-center transition-colors"
                                                        style={{
                                                            borderColor: selectedModels.includes(model.id) ? themeColor : 'rgba(255,255,255,0.3)',
                                                            background: selectedModels.includes(model.id) ? themeColor : 'transparent'
                                                        }}
                                                    >
                                                        {selectedModels.includes(model.id) && <CheckCircle className="w-3 h-3 text-black" />}
                                                    </div>
                                                </td>
                                                <td className="p-4">
                                                    <div className="font-semibold text-white">{model.name}</div>
                                                    <div className="text-xs text-white/40">v{model.scriptVersion || 1}</div>
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className="font-bold" style={{ color: (model.accuracy || model.silhouette) ? themeColor : 'rgba(255,255,255,0.3)' }}>
                                                        {model.accuracy ? `${(model.accuracy * 100).toFixed(1)}%` :
                                                            model.silhouette ? `${(Math.abs(model.silhouette) * 100).toFixed(1)}%` : '-'}
                                                    </span>
                                                </td>
                                                <td className="p-4 text-center text-white/60">
                                                    {model.precision ? `${(model.precision * 100).toFixed(1)}%` : '-'}
                                                </td>
                                                <td className="p-4 text-center text-white/60">
                                                    {model.recall ? `${(model.recall * 100).toFixed(1)}%` : '-'}
                                                </td>
                                                <td className="p-4 text-center text-white/60">
                                                    {model.f1 ? `${(model.f1 * 100).toFixed(1)}%` : '-'}
                                                </td>
                                                <td className="p-4 text-center">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${model.status === 'ready' ? 'bg-green-500/20 text-green-400' :
                                                        model.status === 'training' ? 'bg-yellow-500/20 text-yellow-400' :
                                                            'bg-gray-500/20 text-gray-400'
                                                        }`}>
                                                        {model.status}
                                                    </span>
                                                </td>
                                            </motion.tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    )}

                    {/* Model Comparison - Vertical Bar Graphs */}
                    {selectedModels.length >= 2 && (
                        <motion.div
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            className="mt-6 p-6 rounded-2xl backdrop-blur-xl"
                            style={{ background: 'rgba(0,0,0,0.4)', border: `1px solid ${themeColor}30` }}
                        >
                            <div className="flex flex-col items-center mb-6">
                                <h3 className="text-lg font-bold text-white flex items-center gap-2">
                                    <BarChart3 className="w-5 h-5" style={{ color: themeColor }} />
                                    Model Comparison
                                </h3>
                                <span className="text-xs text-white/40">{selectedModels.length} models selected</span>
                                <button
                                    onClick={() => setSelectedModels([])}
                                    className="mt-2 text-xs px-3 py-1 rounded-lg bg-white/10 text-white/60 hover:bg-white/20"
                                >
                                    Clear Selection
                                </button>
                            </div>

                            {/* Vertical Bar Chart Grid */}
                            <div className="grid grid-cols-4 gap-6">
                                {['Accuracy', 'Precision', 'Recall', 'F1'].map(metric => (
                                    <div key={metric} className="flex flex-col items-center">
                                        <div className="text-xs text-white/40 uppercase tracking-wider mb-3">{metric}</div>
                                        <div className="flex items-end justify-center gap-2 h-32">
                                            {selectedModels.map((modelId, idx) => {
                                                const model = models.find(m => m.id === modelId);
                                                if (!model) return null;
                                                // For Accuracy, also check silhouette for clustering models
                                                const value = metric === 'Accuracy' ? (model.accuracy ?? model.silhouette) :
                                                    metric === 'Precision' ? model.precision :
                                                        metric === 'Recall' ? model.recall : model.f1;
                                                const percent = (value ?? 0) * 100;
                                                const colors = ['#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'];
                                                const barColor = colors[idx % colors.length];
                                                return (
                                                    <div key={modelId} className="flex flex-col items-center" title={model.name}>
                                                        <span className="text-xs font-bold text-white mb-1">{percent.toFixed(0)}%</span>
                                                        <motion.div
                                                            initial={{ height: 0 }}
                                                            animate={{ height: `${percent * 1.2}px` }}
                                                            className="w-8 rounded-t-lg"
                                                            style={{ background: barColor, minHeight: 4 }}
                                                        />
                                                        <span className="text-[8px] text-white/40 mt-1 w-10 text-center truncate">{model.name}</span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                ))}
                            </div>

                            {/* Legend */}
                            <div className="flex justify-center gap-4 mt-4 flex-wrap">
                                {selectedModels.map((modelId, idx) => {
                                    const model = models.find(m => m.id === modelId);
                                    if (!model) return null;
                                    const colors = ['#22c55e', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6'];
                                    return (
                                        <div key={modelId} className="flex items-center gap-2">
                                            <div className="w-3 h-3 rounded" style={{ background: colors[idx % colors.length] }} />
                                            <span className="text-xs text-white/60">{model.name}</span>
                                        </div>
                                    );
                                })}
                            </div>
                        </motion.div>
                    )}
                </div>
            );
        }

        // Charts Tab
        return (
            <div className="space-y-6">
                {/* Project Selector Header */}
                <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                    <button
                        onClick={() => setIsProjectModalOpen(true)}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 transition-all group"
                    >
                        <span className="text-white/60">Project:</span>
                        <span className="font-bold text-white group-hover:scale-105 transition-transform inline-block">
                            {selectedProjectName || 'Select a Project'}
                        </span>
                        <ChevronRight className="w-4 h-4 text-white/40 group-hover:translate-x-1 transition-transform" />
                    </button>

                    <button
                        onClick={() => handleGenerateChart('Analyze the dataset columns and create the most significant and insightful interactive Plotly visualization for this data. Use the most relevant columns.')}
                        disabled={!!generatingChart || !selectedProject}
                        className="flex items-center gap-2 px-6 py-3 rounded-xl bg-purple-500/10 border border-purple-500/20 hover:bg-purple-500/20 transition-all group"
                        title="Analyze dataset and plot the best graph automatically"
                    >
                        {generatingChart && generatingChart.includes('Analyze') ? <Loader2 className="w-5 h-5 text-purple-400 animate-spin" /> : <Wand2 className="w-5 h-5 text-purple-400" />}
                        <span className="font-bold text-white">Auto Plot</span>
                    </button>
                </div>

                <ProjectModal
                    isOpen={isProjectModalOpen}
                    onClose={() => setIsProjectModalOpen(false)}
                    onSelectProject={(id) => setSelectedProject(id)}
                />

                {/* Chart Type Grid */}
                <ChartGrid
                    onChartSelect={handleGenerateChart}
                    generatingChart={generatingChart}
                    generatedCharts={generatedChartTypes}
                />

                {/* Custom Prompt + AI Model Selection - Flexed side by side */}
                <div className="flex gap-4 max-w-4xl mx-auto items-stretch">
                    {/* Custom Chart Request */}
                    <div
                        className="flex-1 p-4 rounded-2xl backdrop-blur-xl"
                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                    >
                        <div className="flex items-center gap-2 mb-3">
                            <Sparkles className="w-4 h-4" style={{ color: themeColor }} />
                            <span className="text-sm font-semibold text-white">Custom Chart</span>
                        </div>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={chartPrompt}
                                onChange={(e) => setChartPrompt(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && chartPrompt.trim() && handleGenerateChart(chartPrompt)}
                                placeholder="Describe the chart you want..."
                                className="flex-1 px-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white text-sm placeholder-white/30 focus:outline-none focus:border-white/30"
                            />
                            <button
                                onClick={() => handleGenerateChart(chartPrompt)}
                                disabled={!!generatingChart || !chartPrompt.trim()}
                                className="px-4 py-2.5 rounded-xl font-semibold flex items-center gap-2 disabled:opacity-50 transition-all text-sm"
                                style={{ background: themeColor, color: 'black' }}
                            >
                                {generatingChart ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
                                Generate
                            </button>
                        </div>
                    </div>

                    {/* AI Model Selector - Separate Box */}
                    <div
                        className="p-4 rounded-2xl backdrop-blur-xl flex flex-col justify-center"
                    >
                        <div className="text-[10px] text-white/40 uppercase tracking-wider mb-2 text-center">AI Model</div>
                        <select
                            value={selectedAiModel}
                            onChange={(e) => setSelectedAiModel(e.target.value as 'gemini' | 'openai' | 'claude')}
                            className="px-4 py-2.5 bg-black rounded-xl text-sm text-white font-medium focus:outline-none border border-white/20"
                        >
                            <option value="gemini" className="bg-black">🤖 Gemini</option>
                            <option value="openai" className="bg-black" disabled={userTier === 'free'}>
                                {userTier === 'free' ? '🔒 GPT-4' : '⚡ GPT-4'}
                            </option>
                            <option value="claude" className="bg-black" disabled={userTier !== 'gold'}>
                                {userTier === 'gold' ? '🏆 Claude' : '🔒 Claude'}
                            </option>
                        </select>
                    </div>
                </div>

                {/* Generated Charts */}
                {charts.length > 0 && (
                    <div className="space-y-4">
                        <h3 className="text-lg font-semibold text-white/60 text-center">Generated Charts</h3>
                        <div className="space-y-4">
                            {charts.map((chart) => (
                                <ChartCard
                                    key={chart.id}
                                    chart={chart}
                                    isGenerating={generatingChart === chart.chartType || chart.status === 'generating'}
                                    onRun={(id, code) => handleRunChart(id, code)}
                                    onDelete={handleDeleteChart}
                                />
                            ))}
                        </div>
                    </div>
                )}

                {charts.length === 0 && !generatingChart && (
                    <div className="text-center py-8">
                        <BarChart3 className="w-12 h-12 mx-auto text-white/20 mb-4" />
                        <p className="text-white/40 text-sm">Select a chart type or describe what you want to visualize</p>
                    </div>
                )}
            </div>
        );
    };

    return (
        <div className="min-h-screen bg-black text-white relative overflow-hidden">
            <div className="fixed inset-0 z-0">
                <Plasma color={themeColor} speed={0.5} opacity={0.3} />
            </div>

            <Navbar />

            <div className="fixed top-4 right-4 z-50">
                <ThemeToggle />
            </div>

            <main className="relative z-10 pt-28 pb-12 px-6 md:px-12 lg:px-16 max-w-7xl mx-auto">
                <motion.div
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mb-10 text-center"
                >
                    <h1 className="text-5xl font-bold mb-2">
                        <span style={{ color: themeColor }}>Visualization</span> Dashboard
                    </h1>
                    <p className="text-white/50">Explore your data and compare models</p>
                </motion.div>

                <div className="flex justify-center gap-2 mb-10">
                    {[
                        { id: 'comparison' as TabType, label: 'Models', icon: BarChart3 },
                        { id: 'charts' as TabType, label: 'Charts', icon: TrendingUp }
                    ].map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-6 py-3 rounded-xl font-semibold transition-all ${activeTab === tab.id ? 'text-black' : 'text-white/60 hover:text-white bg-white/5 hover:bg-white/10'
                                }`}
                            style={activeTab === tab.id ? { background: themeColor } : {}}
                        >
                            <tab.icon className="w-4 h-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>

                <AnimatePresence mode="wait">
                    <motion.div
                        key={activeTab}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                    >
                        {renderTabContent()}
                    </motion.div>
                </AnimatePresence>

                {/* Custom Alert Modal */}
                <AnimatePresence>
                    {alertModal.open && (
                        <motion.div
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            className="fixed inset-0 z-50 flex items-center justify-center p-4"
                            style={{ background: 'rgba(0,0,0,0.7)' }}
                            onClick={() => setAlertModal({ ...alertModal, open: false })}
                        >
                            <motion.div
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.9, opacity: 0 }}
                                className="max-w-md w-full rounded-2xl p-6 backdrop-blur-xl"
                                style={{
                                    background: 'linear-gradient(135deg, rgba(0,0,0,0.8), rgba(0,0,0,0.6))',
                                    border: `1px solid ${themeColor}40`,
                                    boxShadow: `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${themeColor}20`
                                }}
                                onClick={e => e.stopPropagation()}
                            >
                                <div className="text-center">
                                    <div
                                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center"
                                        style={{ background: `${themeColor}20` }}
                                    >
                                        <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                                    </div>
                                    <h3 className="text-xl font-bold text-white mb-2">{alertModal.title}</h3>
                                    <p className="text-white/60 text-sm mb-6">{alertModal.message}</p>
                                    <button
                                        onClick={() => setAlertModal({ ...alertModal, open: false })}
                                        className="px-6 py-3 rounded-xl font-bold text-black transition-all hover:scale-105"
                                        style={{ background: themeColor }}
                                    >
                                        Got it
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>
            </main>
        </div>
    );
}
