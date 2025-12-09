'use client';

import React, { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { doc, getDoc, onSnapshot, updateDoc, collection, orderBy, query, serverTimestamp } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, BarChart3, Terminal, History, Code } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Navbar } from '@/components/navbar';
import { ThemeToggle } from '@/components/theme-toggle';
import LightPillar from '@/components/react-bits/LightPillar';
import Link from 'next/link';
import UploadStageOverlay from '@/components/UploadStageOverlay';
import { useToast } from '@/components/ToastProvider';

// Import modular studio components
import {
    GlassCard,
    TerminalView,
    VisualizationView,
    CodeEditor,
    ChatInterface,
    DatasetPreviewOverlay,
    DatasetTriggerButton,
    WorkflowTimeline,
    StudioHeader,
    type Project,
    type Job
} from '@/components/studio';
import { TrainingConfigOverlay, TrainingConfigTrigger, type TrainingConfig } from '@/components/studio/TrainingConfigOverlay';
import { TrainingProgressOverlay, type TrainingStep } from '@/components/studio/TrainingProgressOverlay';
import { RESOURCE_POLICIES } from '@/lib/resource-policy';

// --- Main Page ---
export default function StudioPage() {
    const params = useParams();
    const { user, userTier } = useAuth();
    const { themeColor } = useThemeColor();
    const { showToast } = useToast();
    const projectId = params?.projectId as string;

    // Core state
    const [project, setProject] = useState<Project | null>(null);
    const [localCode, setLocalCode] = useState("");
    const [isSaving, setIsSaving] = useState(false);
    const [loading, setLoading] = useState(true);
    const [isRunning, setIsRunning] = useState(false);
    const [isDeploying, setIsDeploying] = useState(false);
    const [activeJob, setActiveJob] = useState<any>(null);
    const [allJobs, setAllJobs] = useState<Job[]>([]);
    const [activeDataset, setActiveDataset] = useState<any>(null);
    const [activeTab, setActiveTab] = useState<'terminal' | 'versions' | 'journey' | 'metrics'>('terminal');
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [isAutoMLRunning, setIsAutoMLRunning] = useState(false);

    // Dataset overlay state
    const [showDatasetOverlay, setShowDatasetOverlay] = useState(false);

    // Training config overlay state
    const [showTrainingConfig, setShowTrainingConfig] = useState(false);
    const [trainingConfig, setTrainingConfig] = useState<TrainingConfig>(() => {
        const limits = RESOURCE_POLICIES[userTier || 'free'];
        return {
            machineType: limits.allowedMachineTypes[0],
            epochs: Math.min(10, limits.maxEpochs),
            batchSize: 32,
            learningRate: 0.01,
            trees: Math.min(100, limits.maxTrees)
        };
    });

    // Training progress overlay state
    const [showTrainingProgress, setShowTrainingProgress] = useState(false);
    const [trainingStep, setTrainingStep] = useState<TrainingStep>('preparing');
    const [trainingError, setTrainingError] = useState<string | null>(null);

    // Fetch user avatar
    useEffect(() => {
        if (user?.photoURL) {
            setUserAvatar(user.photoURL);
        } else if (user?.uid) {
            getDoc(doc(db, 'users', user.uid)).then(docSnap => {
                if (docSnap.exists()) {
                    const data = docSnap.data();
                    if (data.photoURL || data.avatar) {
                        setUserAvatar(data.photoURL || data.avatar);
                    }
                }
            }).catch(console.error);
        }
    }, [user]);

    // Sync Project Data - always update localCode when server script changes
    const lastServerScriptRef = React.useRef<string | null>(null);

    useEffect(() => {
        if (!projectId) return;

        const unsubscribe = onSnapshot(doc(db, 'projects', projectId), (docSnap) => {
            if (docSnap.exists()) {
                const data = docSnap.data() as Project;
                setProject(data);

                // Always sync if server script changed (e.g., from AI chat)
                if (data.currentScript && data.currentScript !== lastServerScriptRef.current) {
                    lastServerScriptRef.current = data.currentScript;
                    setLocalCode(data.currentScript);
                }

                if (loading) {
                    setLocalCode(data.currentScript || "");
                    setLoading(false);
                }
            } else {
                setLoading(false);
            }
        });
        return () => unsubscribe();
    }, [projectId, loading]);

    // Sync datasets
    useEffect(() => {
        if (!projectId) return;
        const q = query(
            collection(db, 'projects', projectId, 'datasets'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                setActiveDataset(snapshot.docs[0].data());
            }
        });
        return () => unsubscribe();
    }, [projectId]);

    // Sync jobs
    useEffect(() => {
        if (!projectId) return;
        const q = query(
            collection(db, 'projects', projectId, 'jobs'),
            orderBy('createdAt', 'desc')
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const jobs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Job));
            setAllJobs(jobs);

            if (jobs.length > 0) {
                const latest = jobs[0];
                setActiveJob(latest);
                if (['provisioning', 'running'].includes(latest.status)) {
                    setIsRunning(true);
                } else {
                    setIsRunning(false);
                }
            }
        });
        return () => unsubscribe();
    }, [projectId]);

    // --- Handlers ---
    const handleSave = async () => {
        if (!projectId) return;
        setIsSaving(true);
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                currentScript: localCode,
                lastUpdated: serverTimestamp()
            });
        } catch (err) {
            console.error("Failed to save", err);
        } finally {
            setIsSaving(false);
        }
    };

    const handleSaveName = async (name: string) => {
        await updateDoc(doc(db, 'projects', projectId), {
            name,
            lastUpdated: serverTimestamp()
        });
    };

    const handleRunTraining = async () => {
        if (!projectId || isRunning) return;
        setIsRunning(true);
        setShowTrainingProgress(true);
        setTrainingError(null);
        setTrainingStep('preparing');

        try {
            await handleSave();

            // Step 2: Uploading
            setTrainingStep('uploading');
            await new Promise(resolve => setTimeout(resolve, 500)); // Small delay for UX

            // Step 3: Submitting
            setTrainingStep('submitting');
            const res = await fetch('/api/studio/train', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    script: localCode,
                    config: trainingConfig
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to start training');
            }

            // Step 4: Training started
            setTrainingStep('training');
            setActiveTab('terminal');

            // Close overlay after a short delay to show training started
            setTimeout(() => {
                setShowTrainingProgress(false);
            }, 2000);

        } catch (err: any) {
            console.error(err);
            setTrainingStep('failed');
            setTrainingError(err.message || 'Training failed');
            setIsRunning(false);
        }
    };

    const handleDeploy = async () => {
        if (!projectId || !activeJob || isDeploying) return;
        setIsDeploying(true);
        try {
            const res = await fetch('/api/studio/deploy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId, jobId: activeJob.id })
            });
            if (!res.ok) throw new Error("Failed to deploy");
            showToast({
                type: 'success',
                title: 'Deployment Initiated!',
                message: 'Check Google Cloud Console for endpoint status.',
                duration: 6000
            });
        } catch (err) {
            console.error("Deploy failed", err);
            showToast({
                type: 'error',
                title: 'Deployment Failed',
                message: 'See console for details.',
                duration: 5000
            });
        } finally {
            setIsDeploying(false);
        }
    };

    const handleAutoML = async () => {
        if (!project?.datasetUploaded) {
            showToast({
                type: 'info',
                title: 'No Dataset',
                message: 'Please upload a dataset first.',
                duration: 4000
            });
            return;
        }
        setIsAutoMLRunning(true);
        try {
            const response = await fetch('/api/studio/automl', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });

            const data = await response.json();
            if (!response.ok) throw new Error(data.error || 'AutoML failed');

            if (data.script) {
                setLocalCode(data.script);
            }
            showToast({
                type: 'automl',
                title: 'AutoML Complete!',
                message: `Algorithm: ${data.algorithm}\nReason: ${data.algorithmReason}\n\nScript generated and ready to train!`,
                duration: 7000
            });
        } catch (error) {
            console.error('AutoML failed:', error);
            showToast({
                type: 'error',
                title: 'AutoML Failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
            });
        } finally {
            setIsAutoMLRunning(false);
        }
    };

    const handleUploadStart = async (file: File) => {
        try {
            let fileHash: string | undefined;
            try {
                const arrayBuffer = await file.arrayBuffer();
                const hashBuffer = await crypto.subtle.digest('SHA-256', arrayBuffer);
                const hashArray = Array.from(new Uint8Array(hashBuffer));
                fileHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
            } catch (hashError) {
                console.warn('[Upload] Hash calculation failed:', hashError);
            }

            const response = await fetch('/api/studio/upload', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    fileName: file.name,
                    contentType: file.type || 'application/octet-stream',
                    fileSize: file.size,
                    userTier: userTier || 'free',
                    fileHash,
                    userId: user?.uid
                })
            });

            if (!response.ok) {
                const error = await response.json();
                if (error.code === 'QUOTA_EXCEEDED') {
                    await updateDoc(doc(db, 'projects', projectId), {
                        'workflow.status': 'error',
                        'workflow.errorMessage': error.error,
                        'workflow.updatedAt': serverTimestamp()
                    });
                    return;
                }
                throw new Error(error.error || 'Failed to get upload URL');
            }

            const uploadData = await response.json();

            if (uploadData.reused) {
                console.log('[Upload] Dataset reused:', uploadData.datasetId);
                return;
            }

            const { uploadUrl, datasetId, gcsPath } = uploadData;

            await updateDoc(doc(db, 'projects', projectId), {
                'workflow.stage': 'processing',
                'workflow.step': 1,
                'workflow.status': 'pending',
                'workflow.updatedAt': serverTimestamp()
            });

            const uploadRes = await fetch(uploadUrl, {
                method: 'PUT',
                headers: { 'Content-Type': file.type || 'application/octet-stream' },
                body: file
            });

            if (!uploadRes.ok) throw new Error('Failed to upload file to storage');

            const confirmRes = await fetch('/api/studio/upload/confirm', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    datasetId,
                    gcsPath,
                    triggeredBy: 'frontend',
                    userId: user?.uid
                })
            });

            if (!confirmRes.ok) {
                const confirmError = await confirmRes.json();
                throw new Error(confirmError.error || 'Failed to process dataset');
            }
        } catch (error) {
            console.error('Upload failed:', error);
            await updateDoc(doc(db, 'projects', projectId), {
                'workflow.status': 'error',
                'workflow.errorMessage': error instanceof Error ? error.message : 'Upload failed',
                'workflow.updatedAt': serverTimestamp()
            });
        }
    };

    const handleProceedToStudio = async () => {
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                datasetUploaded: true,
                'workflow.stage': 'ready',
                'workflow.step': 7,
                'workflow.status': 'success',
                'workflow.updatedAt': serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to proceed:', error);
        }
    };

    const handleResetDataset = async () => {
        if (!confirm('This will remove the dataset from this project. Models & jobs trained on it will remain in registry. Continue?')) {
            return;
        }
        try {
            await updateDoc(doc(db, 'projects', projectId), {
                datasetUploaded: false,
                dataset: null,
                datasetVersionId: null,
                inferredTaskType: null,
                targetColumnSuggestion: null,
                'workflow.stage': 'upload',
                'workflow.step': 0,
                'workflow.status': 'pending',
                'workflow.datasetReused': false,
                'workflow.updatedAt': serverTimestamp()
            });
        } catch (error) {
            console.error('Failed to reset dataset:', error);
        }
    };

    // --- Loading State ---
    if (loading) {
        return (
            <div className="h-screen w-full flex items-center justify-center bg-[#020202] relative overflow-hidden">
                <div className="fixed inset-0 z-0 opacity-80">
                    <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.5} pillarWidth={25} glowAmount={0.002} />
                </div>
                <div className="absolute inset-0 z-[1]" style={{ background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${themeColor}15 0%, transparent 70%)` }} />
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative z-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-10 text-center shadow-2xl"
                    style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                >
                    <motion.div
                        animate={{ rotate: 360, scale: [1, 1.1, 1] }}
                        transition={{ rotate: { duration: 3, repeat: Infinity, ease: "linear" }, scale: { duration: 2, repeat: Infinity, ease: "easeInOut" } }}
                        className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                        style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`, boxShadow: `0 0 40px ${themeColor}30` }}
                    >
                        <Loader2 className="w-10 h-10 animate-spin" style={{ color: themeColor }} />
                    </motion.div>
                    <h2 className="text-2xl font-black text-white mb-2">Setting up Studio</h2>
                    <div className="flex items-center justify-center gap-1 text-white/50">
                        <span>Preparing your environment</span>
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity }}>.</motion.span>
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.2 }}>.</motion.span>
                        <motion.span animate={{ opacity: [0, 1, 0] }} transition={{ duration: 1.5, repeat: Infinity, delay: 0.4 }}>.</motion.span>
                    </div>
                    <motion.div initial={{ opacity: 0, width: 0 }} animate={{ opacity: 1, width: "100%" }} className="mt-6 h-1 bg-white/10 rounded-full overflow-hidden">
                        <motion.div animate={{ x: ["-100%", "100%"] }} transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }} className="h-full w-1/3 rounded-full" style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }} />
                    </motion.div>
                </motion.div>
            </div>
        );
    }

    // --- Not Found State ---
    if (!project) {
        return (
            <div className="h-screen w-full flex items-center justify-center">
                <div className="fixed inset-0 z-0">
                    <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.2} pillarWidth={20} glowAmount={0.0015} />
                </div>
                <GlassCard className="p-8 text-center relative z-10">
                    <h2 className="text-xl font-bold text-white mb-2">Project Not Found</h2>
                    <p className="text-white/50 mb-4">The project you're looking for doesn't exist.</p>
                    <Link href="/studio" className="text-blue-400 hover:underline">← Create New Project</Link>
                </GlassCard>
            </div>
        );
    }

    const showUploadStage = project && !project.datasetUploaded;

    // --- Main Render ---
    return (
        <div className="min-h-screen bg-[#020202] text-black dark:text-white relative overflow-hidden">
            {/* Upload Overlay */}
            <AnimatePresence>
                {showUploadStage && (
                    <UploadStageOverlay
                        projectId={projectId}
                        themeColor={themeColor}
                        userTier={userTier || 'free'}
                        workflowStep={project.workflow?.step ?? 0}
                        workflowStatus={project.workflow?.status || 'pending'}
                        errorMessage={project.workflow?.errorMessage || project.workflow?.error}
                        dataPreview={project.dataset ? {
                            columns: project.dataset.columns || [],
                            columnTypes: project.dataset.columnTypes || {},
                            rows: [],
                            totalRows: project.dataset.rowCount || 0,
                            fileSize: project.dataset.fileSize || 0
                        } : undefined}
                        onUploadStart={handleUploadStart}
                        onProceedToStudio={handleProceedToStudio}
                        datasetReused={project.workflow?.datasetReused}
                        inferredTaskType={project.inferredTaskType}
                        targetColumnSuggestion={project.targetColumnSuggestion}
                    />
                )}
            </AnimatePresence>

            {/* Background */}
            <div className="fixed inset-0 z-0 opacity-60">
                <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.2} pillarWidth={20} glowAmount={0.0015} />
            </div>

            {/* Theme Toggle */}
            <div className="fixed top-0 right-0 z-50">
                <ThemeToggle />
            </div>

            {/* Navbar */}
            <div className="relative z-40">
                <Navbar />
            </div>

            {/* Floating Dataset Trigger Button */}
            <DatasetTriggerButton
                onClick={() => setShowDatasetOverlay(true)}
                hasDataset={!!project.datasetUploaded && !!project.dataset}
                themeColor={themeColor}
            />

            {/* Dataset Preview Overlay */}
            <DatasetPreviewOverlay
                dataset={project.dataset ? {
                    filename: project.dataset.filename || 'Dataset',
                    columns: project.dataset.columns || [],
                    columnTypes: project.dataset.columnTypes,
                    rowCount: project.dataset.rowCount || 0,
                    fileSize: project.dataset.fileSize
                } : null}
                isOpen={showDatasetOverlay}
                onClose={() => setShowDatasetOverlay(false)}
            />

            {/* Floating Training Config Trigger Button (Right Side) */}
            {project.datasetUploaded && (
                <TrainingConfigTrigger
                    onClick={() => setShowTrainingConfig(true)}
                    themeColor={themeColor}
                />
            )}

            {/* Training Config Overlay */}
            <TrainingConfigOverlay
                isOpen={showTrainingConfig}
                onClose={() => setShowTrainingConfig(false)}
                userTier={userTier || 'free'}
                config={trainingConfig}
                onConfigChange={setTrainingConfig}
                onStartTraining={handleRunTraining}
            />

            {/* Training Progress Overlay */}
            <TrainingProgressOverlay
                isOpen={showTrainingProgress}
                onClose={() => {
                    setShowTrainingProgress(false);
                    if (trainingStep === 'failed') {
                        setIsRunning(false);
                    }
                }}
                currentStep={trainingStep}
                error={trainingError}
            />

            {/* Workflow Timeline */}
            {project.datasetUploaded && (
                <WorkflowTimeline
                    currentStep={project.workflow?.step ?? 5}
                    status={project.workflow?.status || 'success'}
                    errorMessage={project.workflow?.errorMessage || project.workflow?.error}
                />
            )}

            {/* Main Content */}
            <main className="relative z-10 pt-20 px-4 pb-8 min-h-screen">
                {/* Header */}
                <StudioHeader
                    projectId={projectId}
                    projectName={project.name}
                    themeColor={themeColor}
                    userEmail={user?.email || undefined}
                    userAvatar={userAvatar}
                    datasetUploaded={project.datasetUploaded}
                    isRunning={isRunning}
                    isDeploying={isDeploying}
                    isAutoMLRunning={isAutoMLRunning}
                    hasActiveJob={!!activeJob}
                    onSaveName={handleSaveName}
                    onRunTraining={handleRunTraining}
                    onAutoML={handleAutoML}
                    onDeploy={handleDeploy}
                    onResetDataset={handleResetDataset}
                />

                {/* Main Grid */}
                <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
                    {/* Left: Code Editor */}
                    <CodeEditor
                        code={localCode}
                        onChange={(val) => setLocalCode(val)}
                        onSave={handleSave}
                        saving={isSaving}
                    />

                    {/* Right: Split View */}
                    <div className="flex flex-col gap-6 h-full">
                        {/* Terminal / History Tabs - All top level */}
                        <div className="flex-1 min-h-0">
                            <div className="h-full flex flex-col">
                                {/* Single Row of 4 Tabs - Center Aligned */}
                                <GlassCard className="px-4 py-2 mb-4 flex items-center justify-center gap-2" hover={false}>
                                    <button
                                        onClick={() => setActiveTab('terminal')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'terminal' ? `text-white` : 'text-white/40 hover:text-white/70'}`}
                                        style={activeTab === 'terminal' ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                    >
                                        <Terminal className="w-3.5 h-3.5" /> Terminal
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('versions')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'versions' ? `text-white` : 'text-white/40 hover:text-white/70'}`}
                                        style={activeTab === 'versions' ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                    >
                                        <Code className="w-3.5 h-3.5" /> Versions
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('journey')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'journey' ? `text-white` : 'text-white/40 hover:text-white/70'}`}
                                        style={activeTab === 'journey' ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                    >
                                        <History className="w-3.5 h-3.5" /> Journey
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('metrics')}
                                        className={`flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${activeTab === 'metrics' ? `text-white` : 'text-white/40 hover:text-white/70'}`}
                                        style={activeTab === 'metrics' ? { backgroundColor: `${themeColor}30`, color: themeColor } : {}}
                                    >
                                        <BarChart3 className="w-3.5 h-3.5" /> Metrics
                                    </button>
                                </GlassCard>

                                {/* Content - Center Aligned */}
                                <div className="flex-1 min-h-0 flex justify-center">
                                    <div className="w-full">
                                        {activeTab === 'terminal' && (
                                            <TerminalView logs={activeJob?.logs} status={activeJob?.status} />
                                        )}
                                        {activeTab === 'versions' && (
                                            <GlassCard className="h-full p-4" hover={false}>
                                                <div className="text-center text-white/40 text-sm">
                                                    Script version history coming soon...
                                                </div>
                                            </GlassCard>
                                        )}
                                        {activeTab === 'journey' && (
                                            <VisualizationView jobs={allJobs} />
                                        )}
                                        {activeTab === 'metrics' && (
                                            <GlassCard className="h-full p-4" hover={false}>
                                                <div className="text-center text-white/40 text-sm">
                                                    {allJobs.length > 0 ? (
                                                        <div className="space-y-4">
                                                            <h3 className="text-white/60 font-medium">Latest Training Metrics</h3>
                                                            {allJobs[0]?.metrics ? (
                                                                <div className="grid grid-cols-2 gap-4">
                                                                    <div className="bg-white/5 rounded-xl p-4">
                                                                        <div className="text-xs text-white/40">Accuracy</div>
                                                                        <div className="text-2xl font-bold" style={{ color: themeColor }}>
                                                                            {(allJobs[0].metrics.accuracy * 100).toFixed(1)}%
                                                                        </div>
                                                                    </div>
                                                                    <div className="bg-white/5 rounded-xl p-4">
                                                                        <div className="text-xs text-white/40">Loss</div>
                                                                        <div className="text-2xl font-bold text-red-400">
                                                                            {allJobs[0].metrics.loss?.toFixed(4) || 'N/A'}
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            ) : (
                                                                <p>No metrics available yet.</p>
                                                            )}
                                                        </div>
                                                    ) : (
                                                        'No training runs yet. Run training to see metrics.'
                                                    )}
                                                </div>
                                            </GlassCard>
                                        )}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Chat Interface */}
                        <div className="flex-1 min-h-0">
                            <ChatInterface
                                projectId={projectId}
                                currentScript={localCode}
                                datasetType={activeDataset?.type}
                                schema={activeDataset?.schema}
                                themeColor={themeColor}
                            />
                        </div>
                    </div>
                </div>
            </main>
        </div>
    );
}
