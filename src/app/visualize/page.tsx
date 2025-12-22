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
import {
    BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Cell,
    LineChart, Line, ComposedChart, ErrorBar, Scatter
} from 'recharts';

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
        algorithm_comparison?: any; // Comparison data from AutoML
    };
    bestMetricValue?: number;
    algorithm?: string;
}

export default function VisualizePage() {
    const { themeColor } = useThemeColor();
    const { user, userTier } = useAuth();
    const [activeTab, setActiveTab] = useState<TabType>('comparison');
    const [models, setModels] = useState<Model[]>([]);
    const [loading, setLoading] = useState(true);


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
    const [datasetType, setDatasetType] = useState<'tabular' | 'image' | 'unknown'>('unknown');

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

                    // Detect dataset type from filename or explicit type field
                    const filename = data.dataset?.filename || path?.split('/').pop() || '';
                    const explicitType = data.dataset?.type || data.datasetType;
                    if (explicitType === 'image' || filename.endsWith('.zip') || filename.match(/\.(jpg|jpeg|png|gif|webp)$/i)) {
                        setDatasetType('image');
                    } else if (filename.match(/\.(csv|json|jsonl|tsv|xlsx?)$/i) || explicitType === 'tabular') {
                        setDatasetType('tabular');
                    } else {
                        setDatasetType('unknown');
                    }
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
                            // Preserve full metrics object for extra data (like algorithm_comparison)
                            metrics: data.metrics,
                            // Use best available metric for display
                            bestMetricValue: data.bestMetricValue ?? data.metrics?.accuracy ?? data.metrics?.silhouette ?? data.metrics?.r2,
                            algorithm: data.algorithm || data.config?.algorithm || data.metrics?.best_algorithm
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
                            datasetPath: projectDatasetPath,
                            projectId: selectedProject // Add projectId for context
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
                    {/* Project Selector Header for Models Tab */}
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 mb-8">
                        <button
                            onClick={() => setIsProjectModalOpen(true)}
                            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-white/5 border border-white/20 hover:bg-white/10 transition-all group"
                        >
                            <span className="text-white/60">Project:</span>
                            <span className="font-bold text-white group-hover:scale-105 transition-transform inline-block">
                                {selectedProjectName || 'Select Project'}
                            </span>
                            <ChevronRight className="w-4 h-4 text-white/40 group-hover:translate-x-1 transition-transform" />
                        </button>
                    </div>

                    <ProjectModal
                        isOpen={isProjectModalOpen}
                        onClose={() => setIsProjectModalOpen(false)}
                        onSelectProject={(id) => setSelectedProject(id)}
                    />

                    {!selectedProject ? (
                        <div className="text-center py-16">
                            <BarChart3 className="w-16 h-16 mx-auto text-white/20 mb-4" />
                            <h3 className="text-xl font-semibold text-white/60 mb-2">Select a Project</h3>
                            <p className="text-white/40 mb-6">Choose a project to see its trained models and comparisons</p>
                        </div>
                    ) : models.filter(m => m.projectId === selectedProject).length === 0 ? (
                        <div className="text-center py-16">
                            <BarChart3 className="w-16 h-16 mx-auto text-white/20 mb-4" />
                            <h3 className="text-xl font-semibold text-white/60 mb-2">No Models Found</h3>
                            <p className="text-white/40 mb-6">This project hasn't trained any models yet.</p>
                            <Link
                                href={`/studio/${selectedProject}`}
                                className="inline-flex items-center gap-2 px-6 py-3 rounded-xl font-semibold"
                                style={{ background: themeColor, color: 'black' }}
                            >
                                Go to Training Studio <ChevronRight className="w-4 h-4" />
                            </Link>
                        </div>
                    ) : (
                        <div className="space-y-8">
                            {/* Detailed Algorithm Comparison from AutoML (use LATEST model version) */}
                            {(() => {
                                // Sort by script version descending to get latest first, then find one with algorithm_comparison
                                const latestModelWithBenchmark = models
                                    .filter(m => m.projectId === selectedProject && m.metrics?.algorithm_comparison)
                                    .sort((a, b) => (b.scriptVersion || 0) - (a.scriptVersion || 0))[0];

                                if (!latestModelWithBenchmark) return null;
                                const comparison = latestModelWithBenchmark.metrics?.algorithm_comparison as any;
                                if (!comparison) return null;

                                return (
                                    <div
                                        className="rounded-2xl overflow-hidden backdrop-blur-xl mx-auto max-w-5xl"
                                        style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                                    >
                                        <div className="p-4 border-b border-white/10 bg-white/5 flex flex-col items-center text-center">
                                            <h3 className="font-semibold text-white flex items-center gap-2 justify-center">
                                                <Sparkles className="w-4 h-4 text-yellow-400" />
                                                AutoML Algorithm Benchmark
                                                <span className="text-xs text-white/40 ml-2">(v{latestModelWithBenchmark.scriptVersion || 1})</span>
                                            </h3>
                                            <p className="text-xs text-white/40 mt-1">Performance comparison of all algorithms tested during training</p>
                                        </div>
                                        <div className="overflow-x-auto">
                                            <table className="w-full">
                                                <thead>
                                                    <tr className="border-b border-white/10">
                                                        <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Algorithm</th>
                                                        <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">CV Score (Mean)</th>
                                                        <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Std Dev</th>
                                                        <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Rating</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {(() => {
                                                        // Handle array or object format
                                                        let items: { algorithm: string; mean: number; std: number }[] = [];
                                                        if (Array.isArray(comparison)) {
                                                            items = comparison.map((c: any) => ({
                                                                algorithm: c.algorithm,
                                                                mean: c.mean ?? c.cv_score,
                                                                std: c.std ?? c.cv_std
                                                            }));
                                                        } else if (typeof comparison === 'object') {
                                                            items = Object.entries(comparison).map(([algo, metrics]: any) => ({
                                                                algorithm: algo,
                                                                mean: metrics.cv_score || metrics.mean,
                                                                std: metrics.cv_std || metrics.std
                                                            }));
                                                        }

                                                        return items.sort((a: any, b: any) => b.mean - a.mean).map((item: any, i: number) => (
                                                            <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                                <td className="p-4 font-medium text-white text-center">{item.algorithm}</td>
                                                                <td className="p-4 text-center font-bold" style={{ color: i === 0 ? themeColor : 'white' }}>
                                                                    {(item.mean * 100).toFixed(2)}%
                                                                </td>
                                                                <td className="p-4 text-center text-white/40">
                                                                    ±{(item.std * 100).toFixed(2)}%
                                                                </td>
                                                                <td className="p-4 text-center text-yellow-400 text-xs">
                                                                    {"★".repeat(Math.max(1, Math.round(item.mean * 5)))}
                                                                </td>
                                                            </tr>
                                                        ));
                                                    })()}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                );
                            })()}

                            {/* Standard Model List */}
                            <div
                                className="rounded-2xl overflow-hidden backdrop-blur-xl mx-auto max-w-5xl"
                                style={{ background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)' }}
                            >
                                <div className="p-4 border-b border-white/10 bg-white/5 text-center">
                                    <h3 className="font-semibold text-white">Registered Models</h3>
                                </div>
                                <div className="overflow-x-auto">
                                    <table className="w-full">
                                        <thead>
                                            <tr className="border-b border-white/10">
                                                <th className="p-4 text-left text-xs font-semibold text-white/40 uppercase tracking-wider">Model Name</th>
                                                <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Accuracy</th>
                                                <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Precision</th>
                                                <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Recall</th>
                                                <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">F1</th>
                                                <th className="p-4 text-center text-xs font-semibold text-white/40 uppercase tracking-wider">Status</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {models
                                                .filter(m => m.projectId === selectedProject)
                                                .map((model, i) => (
                                                    <motion.tr
                                                        key={model.id}
                                                        initial={{ opacity: 0, y: 10 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.05 }}
                                                        className="border-b border-white/5 hover:bg-white/5 transition-colors"
                                                    >
                                                        <td className="p-4">
                                                            <div className="font-semibold text-white">{model.algorithm || model.name}</div>
                                                            {model.algorithm && model.name !== model.algorithm && (
                                                                <div className="text-xs text-white/40">{model.name}</div>
                                                            )}
                                                            <div className="text-xs text-white/40">v{model.scriptVersion || 1} • {new Date(model.createdAt?.seconds * 1000).toLocaleDateString()}</div>
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
                        </div>
                    )}

                    {/* Comparison Charts Logic - Prioritize Benchmark Data from LATEST version */}
                    {(() => {
                        const projectModels = models.filter(m => m.projectId === selectedProject);
                        // Sort by version descending and get latest model with benchmark data
                        const latestBenchmarkModel = projectModels
                            .filter(m => m.metrics?.algorithm_comparison)
                            .sort((a, b) => (b.scriptVersion || 0) - (a.scriptVersion || 0))[0];
                        const benchmarkData = latestBenchmarkModel?.metrics?.algorithm_comparison;

                        // Parse Benchmark Data
                        let chartData: any[] = [];
                        let isBenchmark = false;
                        let comparisonTitle = 'Model Comparison';
                        let comparisonCount = 0;

                        if (benchmarkData) {
                            isBenchmark = true;
                            comparisonTitle = 'AutoML Candidate Comparison';
                            if (Array.isArray(benchmarkData)) {
                                chartData = benchmarkData.map((c: any) => ({
                                    name: c.algorithm,
                                    accuracy: (c.mean ?? c.cv_score) * 100,
                                    std: (c.std ?? c.cv_std) * 100
                                }));
                            } else if (typeof benchmarkData === 'object') {
                                chartData = Object.entries(benchmarkData).map(([algo, metrics]: any) => ({
                                    name: algo,
                                    accuracy: (metrics.mean || metrics.cv_score) * 100,
                                    std: (metrics.std || metrics.cv_std) * 100
                                }));
                            }
                        } else if (projectModels.length >= 2) {
                            chartData = projectModels.map(m => ({
                                name: m.algorithm || m.name,
                                accuracy: (m.accuracy || 0) * 100,
                                std: 0,
                                f1: (m.f1 || 0) * 100
                            }));
                        }

                        comparisonCount = chartData.length;
                        if (comparisonCount < 2 && !benchmarkData) return null;

                        // Sort by accuracy descending
                        chartData.sort((a, b) => b.accuracy - a.accuracy);

                        // Vibrant Colors
                        const vibrantColors = ['#FF0080', '#7928CA', '#0070F3', '#00DFD8', '#FF4D4D', '#F5A623', '#50E3C2'];

                        const CustomTooltip = ({ active, payload, label }: any) => {
                            if (active && payload && payload.length) {
                                return (
                                    <div className="bg-black/80 border border-white/10 p-3 rounded-lg backdrop-blur-md shadow-xl">
                                        <p className="text-white font-bold mb-1">{label}</p>
                                        {payload.map((p: any, idx: number) => (
                                            <div key={idx} className="flex items-center gap-2 text-xs">
                                                <div className="w-2 h-2 rounded-full" style={{ background: p.color }} />
                                                <span className="text-white/70">{p.name}:</span>
                                                <span className="text-white font-mono">{typeof p.value === 'number' ? p.value.toFixed(2) : p.value}%</span>
                                            </div>
                                        ))}
                                    </div>
                                );
                            }
                            return null;
                        };

                        return (
                            <div className="mt-8 space-y-8">
                                <div className="flex flex-col items-center justify-center text-center px-4">
                                    <div className="flex items-center gap-2 mb-2">
                                        <BarChart3 className="w-6 h-6 text-purple-400" />
                                        <h3 className="text-xl font-bold text-white">
                                            {comparisonTitle}
                                        </h3>
                                    </div>
                                    <span className="text-xs text-white/40 uppercase tracking-widest">
                                        Comparing {comparisonCount} Algorithms
                                    </span>
                                </div>

                                <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                                    {/* 1. Bar Chart - Accuracy Ranking */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        className="p-5 rounded-2xl bg-gradient-to-br from-purple-500/10 to-pink-500/10 border border-purple-500/20 backdrop-blur-xl shadow-lg shadow-purple-500/5"
                                    >
                                        <div className="text-sm font-semibold text-white/60 mb-6 text-center">Accuracy Ranking</div>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <BarChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 50 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                    <RechartsTooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(255,255,255,0.05)' }} />
                                                    <Bar dataKey="accuracy" name="Accuracy" radius={[4, 4, 0, 0]}>
                                                        {chartData.map((entry, index) => (
                                                            <Cell key={`cell-${index}`} fill={vibrantColors[index % vibrantColors.length]} />
                                                        ))}
                                                    </Bar>
                                                </BarChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>

                                    {/* 2. Stability Chart (Bar with Error Logic represented) */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.1 }}
                                        className="p-5 rounded-2xl bg-gradient-to-br from-cyan-500/10 to-blue-500/10 border border-cyan-500/20 backdrop-blur-xl shadow-lg shadow-cyan-500/5"
                                    >
                                        <div className="text-sm font-semibold text-white/60 mb-6 text-center">{isBenchmark ? 'Stability (Accuracy ± Std)' : 'F1 Score'}</div>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                {isBenchmark ? (
                                                    <ComposedChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 50 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                                                        <YAxis domain={['auto', 'auto']} tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="accuracy" name="Mean Accuracy" fill="#2e2e2e" radius={[4, 4, 0, 0]} fillOpacity={0.3}>
                                                            <ErrorBar dataKey="std" width={4} strokeWidth={2} stroke="#00DFD8" />
                                                        </Bar>
                                                        <Scatter dataKey="accuracy" name="Mean" fill="#00DFD8" shape="circle" />
                                                    </ComposedChart>
                                                ) : (
                                                    <BarChart data={chartData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                                                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                        <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                                                        <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} />
                                                        <RechartsTooltip content={<CustomTooltip />} />
                                                        <Bar dataKey="f1" name="F1 Score" radius={[4, 4, 0, 0]}>
                                                            {chartData.map((entry, index) => (
                                                                <Cell key={`cell-${index}`} fill={vibrantColors[(index + 2) % vibrantColors.length]} />
                                                            ))}
                                                        </Bar>
                                                    </BarChart>
                                                )}
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>

                                    {/* 3. Line Chart - Performance Curve */}
                                    <motion.div
                                        initial={{ opacity: 0, y: 20 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: 0.2 }}
                                        className="p-5 rounded-2xl bg-gradient-to-br from-blue-500/10 to-indigo-500/10 border border-blue-500/20 backdrop-blur-xl shadow-lg shadow-blue-500/5"
                                    >
                                        <div className="text-sm font-semibold text-white/60 mb-6 text-center">Performance Curve</div>
                                        <div className="h-[300px] w-full">
                                            <ResponsiveContainer width="100%" height="100%">
                                                <LineChart data={chartData} margin={{ top: 10, right: 10, left: -10, bottom: 50 }}>
                                                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                                                    <XAxis dataKey="name" tick={{ fill: '#9ca3af', fontSize: 10 }} interval={0} angle={-45} textAnchor="end" height={60} axisLine={false} tickLine={false} />
                                                    <YAxis tick={{ fill: '#9ca3af', fontSize: 10 }} axisLine={false} tickLine={false} domain={[0, 100]} />
                                                    <RechartsTooltip content={<CustomTooltip />} />
                                                    <Line type="monotone" dataKey="accuracy" stroke="#0070F3" strokeWidth={3} dot={{ fill: '#0070F3', r: 4 }} activeDot={{ r: 6, fill: '#fff' }} />
                                                </LineChart>
                                            </ResponsiveContainer>
                                        </div>
                                    </motion.div>
                                </div>
                            </div>
                        );
                    })()}
                </div>
            );
        }

        // Charts Tab
        return (
            <div className="space-y-6">
                {/* Best Model Info Header (Derived from Selected Project) */}
                <div className="flex flex-col items-center justify-center gap-6 mb-8">
                    {selectedProject ? (
                        <div className="flex flex-col sm:flex-row items-center gap-4 sm:gap-8 px-8 py-4 rounded-2xl bg-white/5 border border-white/10 backdrop-blur-md shadow-2xl">
                            <div className="flex flex-col items-center sm:items-start">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Active Project</span>
                                <span className="font-bold text-white text-xl tracking-tight">{selectedProjectName}</span>
                            </div>

                            <div className="hidden sm:block w-px h-10 bg-white/10"></div>

                            <div className="flex flex-col items-center sm:items-start">
                                <span className="text-[10px] text-white/40 uppercase tracking-widest font-bold mb-1">Best Model</span>
                                {loading ? (
                                    <div className="h-6 w-32 bg-white/10 rounded animate-pulse" />
                                ) : (
                                    (() => {
                                        const projectModels = models.filter(m => m.projectId === selectedProject);
                                        // Find true best model (including benchmark candidates)
                                        const modelWithBenchmark = projectModels.find(m => m.metrics?.algorithm_comparison);
                                        const benchmarkData = modelWithBenchmark?.metrics?.algorithm_comparison;

                                        let bestName = 'No Models Found';
                                        let bestScore = 0;

                                        if (benchmarkData && (Array.isArray(benchmarkData) || typeof benchmarkData === 'object')) {
                                            const benchmarks = Array.isArray(benchmarkData)
                                                ? benchmarkData.map((c: any) => ({ name: c.algorithm, score: (c.mean ?? c.cv_score) }))
                                                : Object.entries(benchmarkData).map(([k, v]: any) => ({ name: k, score: (v.mean || v.cv_score) }));

                                            if (benchmarks.length > 0) {
                                                const sorted = benchmarks.sort((a, b) => b.score - a.score);
                                                bestName = sorted[0].name;
                                                bestScore = sorted[0].score;
                                            }
                                        } else if (projectModels.length > 0) {
                                            const best = projectModels.sort((a, b) => (b.bestMetricValue || 0) - (a.bestMetricValue || 0))[0];
                                            bestName = best.algorithm || best.name;
                                            bestScore = best.bestMetricValue || 0;
                                        }

                                        return (
                                            <div className="flex items-center gap-3">
                                                <div className="flex items-center gap-2">
                                                    <Sparkles className="w-4 h-4 text-yellow-400" />
                                                    <span className="font-bold text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-400 text-xl">
                                                        {bestName}
                                                    </span>
                                                </div>
                                                {bestScore > 0 && (
                                                    <span className="text-xs px-2.5 py-1 rounded-lg bg-green-500/20 text-green-400 font-bold font-mono border border-green-500/20">
                                                        {(bestScore * 100).toFixed(1)}%
                                                    </span>
                                                )}
                                            </div>
                                        );
                                    })()
                                )}
                            </div>
                        </div>
                    ) : (
                        <div className="text-center py-8">
                            <p className="text-white/40 mb-2">No project selected.</p>
                            <button
                                onClick={() => setActiveTab('comparison')} // Switch to models tab
                                className="text-sm font-semibold text-blue-400 hover:text-blue-300 transition-colors"
                            >
                                Go to Models tab to select a project &rarr;
                            </button>
                        </div>
                    )}

                    <button
                        onClick={() => handleGenerateChart('Analyze the dataset columns and create the most significant and insightful interactive Plotly visualization for this data. Use the most relevant columns.')}
                        disabled={!!generatingChart || !selectedProject}
                        className="flex items-center gap-2 px-8 py-3 rounded-xl bg-gradient-to-r from-purple-500/10 to-blue-500/10 border border-purple-500/20 hover:border-purple-500/40 hover:from-purple-500/20 hover:to-blue-500/20 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                        title="Analyze dataset and plot the best graph automatically"
                    >
                        {generatingChart && generatingChart.includes('Analyze') ? <Loader2 className="w-5 h-5 text-purple-400 animate-spin" /> : <Wand2 className="w-5 h-5 text-purple-400" />}
                        <span className="font-bold text-white tracking-wide">AI Auto-Plot Best Chart</span>
                    </button>
                </div>



                {/* Image Dataset Warning */}
                {datasetType === 'image' && selectedProject && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="max-w-2xl mx-auto p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-center"
                    >
                        <div className="flex items-center justify-center gap-2 mb-2">
                            <svg className="w-5 h-5 text-amber-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                                <path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span className="font-bold text-amber-400">Image Dataset Detected</span>
                        </div>
                        <p className="text-sm text-white/60">
                            Traditional charts require tabular data with numeric columns. For image datasets,
                            try the <strong>Auto Plot</strong> button to generate a class distribution chart if your images are organized in folders.
                        </p>
                    </motion.div>
                )}

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
                <Plasma color={themeColor} speed={1.5} opacity={0.5} scale={0.6} />
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
                    <h1
                        className="text-5xl font-bold mb-2 animate-gradient-text"
                        style={{
                            backgroundImage: `linear-gradient(135deg, ${themeColor}, #ffffff 40%, ${themeColor})`,
                            WebkitBackgroundClip: 'text',
                            WebkitTextFillColor: 'transparent',
                            backgroundClip: 'text',
                            backgroundSize: '200% 200%'
                        }}
                    >
                        Visualization Dashboard
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
