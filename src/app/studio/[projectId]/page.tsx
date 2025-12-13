'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { useTraining } from '@/context/training-context';
import { doc, getDoc, onSnapshot, updateDoc, collection, orderBy, query, serverTimestamp, addDoc, getDocs, limit, where } from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Loader2, BarChart3, Terminal, History, Code, Clock, Globe, Lock } from 'lucide-react';
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
    SuggestionPanel,
    ScriptVersionsView,
    CollabLinkModal,
    GitHubPushModal,
    type Project,
    type Job
} from '@/components/studio';
import { TrainingConfigOverlay, TrainingConfigTrigger, type TrainingConfig } from '@/components/studio/TrainingConfigOverlay';
import { TrainingProgressOverlay, type TrainingStep } from '@/components/studio/TrainingProgressOverlay';
import { TrainingSuccessOverlay } from '@/components/studio/TrainingSuccessOverlay';

import { RESOURCE_POLICIES } from '@/lib/resource-policy';

// --- Main Page ---
export default function StudioPage() {
    const params = useParams();
    const searchParams = useSearchParams();
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
    const [projectModel, setProjectModel] = useState<{ id: string; visibility: 'public' | 'private' } | null>(null);
    const [userAvatar, setUserAvatar] = useState<string | null>(null);
    const [isAutoMLRunning, setIsAutoMLRunning] = useState(false);

    // Share modal state
    const [showShareModal, setShowShareModal] = useState(false);
    const [showGitHubModal, setShowGitHubModal] = useState(false);

    // VS Code connection state
    const [isConnectingVSCode, setIsConnectingVSCode] = useState(false);
    const [vsCodeConnected, setVsCodeConnected] = useState(false);
    const [isSyncingVSCode, setIsSyncingVSCode] = useState(false);
    const [showMCPModal, setShowMCPModal] = useState(false);
    const [mcpError, setMcpError] = useState<string | null>(null);

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

    // Training progress overlay state - synced with global context
    const training = useTraining();
    const [showTrainingProgress, setShowTrainingProgress] = useState(false);
    const [trainingStep, setTrainingStep] = useState<TrainingStep>('preparing');
    const [trainingError, setTrainingError] = useState<string | null>(null);

    // Sync overlay visibility with global context on mount
    useEffect(() => {
        if (training.activeJob && ['running', 'provisioning', 'installing', 'downloading', 'training', 'RUNNING', 'PROVISIONING'].includes(training.activeJob.status)) {
            setShowTrainingProgress(true);
        }
    }, [training.activeJob]);

    // Training success celebration state
    const [showSuccessCelebration, setShowSuccessCelebration] = useState(false);
    const [completedJobInfo, setCompletedJobInfo] = useState<{ modelName: string; version: string; metrics?: { accuracy?: number; loss?: number } } | null>(null);
    const prevJobStatusRef = React.useRef<string | null>(null);

    // Sync status state
    const [isSyncing, setIsSyncing] = useState(false);

    // Suggestion panel state (from Chat page)
    const [showSuggestionPanel, setShowSuggestionPanel] = useState(false);
    const [suggestionData, setSuggestionData] = useState<{
        id: string;
        text: string;
        extractedCode: string;
        createdAt?: string;
    } | null>(null);
    const [suggestionLoading, setSuggestionLoading] = useState(false);

    // Load suggestion from URL if present
    useEffect(() => {
        const suggestionId = searchParams?.get('suggestionId');
        if (suggestionId && !suggestionData) {
            setSuggestionLoading(true);
            fetch(`/api/studio/suggestions/${suggestionId}`)
                .then(res => res.json())
                .then(data => {
                    if (data.suggestion) {
                        setSuggestionData(data.suggestion);
                        setShowSuggestionPanel(true);
                    }
                })
                .catch(err => {
                    console.error('Failed to load suggestion:', err);
                    showToast({ type: 'error', title: 'Error', message: 'Failed to load suggestion' });
                })
                .finally(() => setSuggestionLoading(false));
        }
    }, [searchParams, suggestionData, showToast]);

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

    // Fetch latest model for this project (for visibility toggle)
    useEffect(() => {
        if (!projectId) return;
        const q = query(
            collection(db, 'models'),
            where('projectId', '==', projectId),
            orderBy('createdAt', 'desc'),
            limit(1)
        );
        const unsubscribe = onSnapshot(q, (snapshot) => {
            if (!snapshot.empty) {
                const doc = snapshot.docs[0];
                setProjectModel({
                    id: doc.id,
                    visibility: (doc.data().visibility as 'public' | 'private') || 'private'
                });
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

                // Check if job just completed - trigger celebration!
                const prevStatus = prevJobStatusRef.current;
                const isNowComplete = ['succeeded', 'completed'].includes(latest.status);
                const wasRunning = prevStatus && ['provisioning', 'running', 'PROVISIONING', 'RUNNING', 'installing', 'downloading', 'training'].includes(prevStatus);

                console.log('[Studio] Job status check:', { prevStatus, currentStatus: latest.status, isNowComplete, wasRunning });

                // Trigger celebration ONLY if status just changed from running -> completed
                // DO NOT show on fresh page load even if job is complete (prevents showing every time page opens)
                if (wasRunning && isNowComplete) {
                    console.log('[Studio] 🎉 Triggering celebration!');
                    setCompletedJobInfo({
                        modelName: project?.name || 'Model',
                        version: `v${latest.scriptVersion || '1'}`,
                        metrics: latest.metrics
                    });
                    setShowSuccessCelebration(true);

                    // Auto-clear activeJob from global context
                    training.completeTraining();
                }
                prevJobStatusRef.current = latest.status;

                if (['provisioning', 'running', 'PROVISIONING', 'RUNNING', 'installing', 'downloading', 'training'].includes(latest.status)) {
                    setIsRunning(true);
                } else {
                    setIsRunning(false);
                }
            }
        });
        return () => unsubscribe();
    }, [projectId]);

    // Poll for job completion from GCS (every 10 seconds when running)
    useEffect(() => {
        if (!projectId || !activeJob) return;

        const shouldPoll = ['provisioning', 'running', 'PROVISIONING', 'RUNNING', 'installing', 'downloading', 'training'].includes(activeJob.status);
        if (!shouldPoll) return;

        console.log(`[Studio] Starting auto-poll for job ${activeJob.id} (status: ${activeJob.status})`);

        const pollCompletion = async () => {
            try {
                console.log(`[Studio] Polling job ${activeJob.id}...`);
                const res = await fetch(`/api/studio/jobs/${activeJob.id}/complete`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ projectId })
                });
                const data = await res.json();
                console.log(`[Studio] Poll result:`, data);

                // Update training step based on current status from GCS
                if (data.status === 'installing') {
                    setTrainingStep('installing');
                } else if (data.status === 'downloading') {
                    setTrainingStep('installing'); // Same step for downloading
                } else if (data.status === 'running' || data.status === 'training') {
                    setTrainingStep('training');
                }

                if (data.status === 'succeeded' || data.status === 'completed') {
                    console.log('[Studio] Job completed! Status:', data.status, 'Metrics:', data.metrics);
                    setTrainingStep('completed');
                    // Keep overlay open - it will close when celebration shows
                    // Firestore listener will pick up the change and trigger celebration
                } else if (data.status === 'failed') {
                    console.log('[Studio] Job failed!');
                    setTrainingStep('failed');
                    setTrainingError(data.error || 'Training failed');
                }
            } catch (error) {
                console.error('[Studio] Poll completion failed:', error);
            }
        };

        // Poll every 10 seconds for faster detection
        const interval = setInterval(pollCompletion, 10000);
        // Initial poll after 10 seconds (give VM time to start)
        const initialTimeout = setTimeout(pollCompletion, 10000);

        return () => {
            clearInterval(interval);
            clearTimeout(initialTimeout);
        };
    }, [projectId, activeJob?.id, activeJob?.status]);

    // --- Handlers ---
    const handleSave = async (forTraining = false) => {
        if (!projectId || !localCode) return;
        setIsSaving(true);
        try {
            // Update current script
            await updateDoc(doc(db, 'projects', projectId), {
                currentScript: localCode,
                lastUpdated: serverTimestamp()
            });

            // Check for duplicate - compare with last saved version
            const scriptsRef = collection(db, 'projects', projectId, 'scripts');
            const scriptsSnapshot = await getDocs(query(scriptsRef, orderBy('version', 'desc'), limit(1)));

            const lastVersion = scriptsSnapshot.docs.length > 0
                ? scriptsSnapshot.docs[0].data().version || 0
                : 0;
            const lastContent = scriptsSnapshot.docs.length > 0
                ? scriptsSnapshot.docs[0].data().content || ''
                : '';

            // Check if content is same as last version (normalize whitespace)
            const normalizedLocal = localCode.trim();
            const normalizedLast = lastContent.trim();

            // If saving for training, always save (skip duplicate check message)
            // If manual save, check for duplicates and show message
            if (normalizedLocal === normalizedLast && lastVersion > 0) {
                if (!forTraining) {
                    showToast({
                        type: 'info',
                        title: "Version Already Exists",
                        message: `This code is identical to v${lastVersion}`,
                    });
                }
                // For training, silently use existing version
            } else {
                // Add new script version
                await addDoc(scriptsRef, {
                    version: lastVersion + 1,
                    content: localCode,
                    createdAt: serverTimestamp(),
                    createdBy: user?.email || 'unknown',
                    source: forTraining ? 'training' : 'manual',
                    notes: forTraining ? `Training v${lastVersion + 1}` : `Script v${lastVersion + 1}`
                });

                if (!forTraining) {
                    showToast({
                        type: 'success',
                        title: "Script Saved!",
                        message: `Version ${lastVersion + 1} saved to history`,
                    });
                }
            }
        } catch (err) {
            console.error("Failed to save", err);
            showToast({
                type: 'error',
                title: "Save Failed",
                message: "Could not save script",
            });
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
            await handleSave(true); // Save silently when training

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
                    config: trainingConfig,
                    // Dataset info from project
                    originalFilename: project?.dataset?.filename || 'dataset.csv',
                    datasetFilename: project?.dataset?.filename || 'dataset.csv',
                    datasetSizeMB: project?.dataset?.fileSize ? Math.round(project.dataset.fileSize / (1024 * 1024) * 100) / 100 : 5,
                    datasetRows: project?.dataset?.rowCount || 0,
                    taskType: project?.inferredTaskType || 'classification',
                    tier: userTier || 'free'
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || 'Failed to start training');
            }

            // Parse response to get job ID
            const data = await res.json();

            // Persist to global context for navigation persistence
            if (data.jobId) {
                training.setActiveJob({
                    id: data.jobId,
                    projectId,
                    status: 'training',
                    phase: 'training'
                });
            }

            // Step 4: Training started
            setTrainingStep('training');
            setActiveTab('terminal');

            // Keep overlay visible - it shows progress throughout training

        } catch (err: any) {
            console.error(err);
            setTrainingStep('failed');
            setTrainingError(err.message || 'Training failed');
            training.failTraining(err.message || 'Training failed');
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
                title: '🤖 AutoML Model Selected!',
                message: `📊 Algorithm: ${data.algorithm}\n💡 ${data.algorithmReason || 'Best model for your data'}\n\n✅ Script generated and ready to train!`,
                duration: 10000
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

    // Sync all job statuses from GCS
    const handleSyncStatus = async () => {
        setIsSyncing(true);
        try {
            const res = await fetch('/api/studio/sync-all', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ projectId })
            });
            const data = await res.json();
            console.log('[Studio] Sync result:', data);

            if (data.modelsRegistered > 0) {
                showToast({
                    type: 'success',
                    title: '🎉 Models Found!',
                    message: `${data.modelsRegistered} model(s) registered. Check Profile page!`,
                    duration: 5000
                });
            } else if (data.jobsUpdated > 0) {
                showToast({
                    type: 'success',
                    title: '✅ Jobs Synced',
                    message: `Updated ${data.jobsUpdated} job status(es) from GCS`,
                    duration: 3000
                });
            } else {
                showToast({
                    type: 'info',
                    title: 'ℹ️ No Updates',
                    message: 'All jobs already in sync',
                    duration: 3000
                });
            }
        } catch (error) {
            console.error('[Studio] Sync failed:', error);
            showToast({
                type: 'error',
                title: 'Sync Failed',
                message: error instanceof Error ? error.message : 'Unknown error',
                duration: 5000
            });
        } finally {
            setIsSyncing(false);
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

    // Export script as Jupyter Notebook
    const handleExportNotebook = () => {
        const notebookContent = {
            nbformat: 4,
            nbformat_minor: 5,
            metadata: {
                kernelspec: {
                    display_name: "Python 3",
                    language: "python",
                    name: "python3"
                },
                language_info: {
                    name: "python",
                    version: "3.10.0"
                },
                mlforge_project: projectId,
                mlforge_name: project?.name
            },
            cells: [
                {
                    cell_type: "markdown",
                    metadata: {},
                    source: [`# ${project?.name || 'MLForge Project'}\n\nExported from MLForge Studio`]
                },
                {
                    cell_type: "code",
                    metadata: {},
                    source: localCode.split('\n').map((line: string, i: number, arr: string[]) =>
                        i === arr.length - 1 ? line : line + '\n'
                    ),
                    execution_count: null,
                    outputs: []
                }
            ]
        };

        const blob = new Blob([JSON.stringify(notebookContent, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'train'}.ipynb`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        showToast({
            type: 'success',
            title: 'Notebook Exported',
            message: 'Your script has been exported as a Jupyter notebook',
            duration: 4000
        });
    };

    // Import Jupyter Notebook
    const handleImportNotebook = () => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = '.ipynb';
        input.onchange = async (e) => {
            const file = (e.target as HTMLInputElement).files?.[0];
            if (!file) return;

            try {
                const text = await file.text();
                const notebook = JSON.parse(text);

                // Extract Python code from cells
                const codeCells = notebook.cells?.filter((cell: any) => cell.cell_type === 'code') || [];
                const code = codeCells
                    .map((cell: any) => {
                        const source = Array.isArray(cell.source) ? cell.source.join('') : cell.source;
                        return source;
                    })
                    .join('\n\n');

                if (code.trim()) {
                    setLocalCode(code);
                    showToast({
                        type: 'success',
                        title: 'Notebook Imported',
                        message: `Imported ${codeCells.length} code cell(s) from ${file.name}`,
                        duration: 5000
                    });
                } else {
                    showToast({
                        type: 'error',
                        title: 'No Code Found',
                        message: 'The notebook contains no Python code cells',
                        duration: 5000
                    });
                }
            } catch (err) {
                console.error('Failed to import notebook:', err);
                showToast({
                    type: 'error',
                    title: 'Import Failed',
                    message: 'Could not parse the notebook file',
                    duration: 5000
                });
            }
        };
        input.click();
    };

    // Open project in VS Code with one-click connection
    const handleOpenVSCode = async () => {
        setIsConnectingVSCode(true);
        setMcpError(null);

        try {
            // Step 1: Check MCP server health
            let healthRes = await fetch('/api/mcp/health');

            // If MCP not running, try to auto-start it
            if (!healthRes.ok) {
                showToast({
                    type: 'info',
                    title: 'Starting MCP Server...',
                    message: 'Please wait while we start the collaboration server',
                    duration: 3000
                });

                // Try to start MCP server
                const startRes = await fetch('/api/mcp/start', { method: 'POST' });
                if (startRes.ok) {
                    // Wait and retry health check
                    await new Promise(resolve => setTimeout(resolve, 3000));
                    healthRes = await fetch('/api/mcp/health');
                }

                // If still not healthy, show modal  
                if (!healthRes.ok) {
                    const healthData = await healthRes.json();
                    setMcpError(healthData.instructions || 'Could not start MCP server automatically. Please start manually.');
                    setShowMCPModal(true);
                    setIsConnectingVSCode(false);
                    return;
                }

                showToast({ type: 'success', title: 'MCP Server Started!', message: 'Connecting to VS Code...' });
            }

            // Step 2: Get auth token
            const idToken = await user?.getIdToken();
            if (!idToken) {
                showToast({ type: 'error', title: 'Auth Error', message: 'Please log in again' });
                setIsConnectingVSCode(false);
                return;
            }

            // Step 3: Create MCP session with JWT
            const sessionRes = await fetch('/api/mcp/session/create', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${idToken}`
                },
                body: JSON.stringify({
                    projectId,
                    initialScript: localCode
                })
            });

            if (!sessionRes.ok) {
                const error = await sessionRes.json();
                throw new Error(error.error || 'Failed to create session');
            }

            const { wsUrl, token } = await sessionRes.json();

            // Step 4: Build VS Code URI
            const vscodeUri = `vscode://mlforge.mlforge-studio/connect?projectId=${encodeURIComponent(projectId)}&wsUrl=${encodeURIComponent(wsUrl)}&token=${encodeURIComponent(token)}`;

            showToast({
                type: 'success',
                title: 'Opening VS Code...',
                message: 'Launching your project in VS Code',
                duration: 3000
            });

            // Step 5: Try to open VS Code
            window.location.href = vscodeUri;

            // Mark VS Code as connected
            setVsCodeConnected(true);

            // Just reset the loading state after a moment
            setTimeout(() => {
                setIsConnectingVSCode(false);
            }, 1500);

        } catch (error: any) {
            console.error('[VS Code Connect] Error:', error);
            setMcpError(error.message || 'Connection failed');
            setShowMCPModal(true);
            setIsConnectingVSCode(false);
        }
    };

    // Sync code from VS Code - fetches latest script from project
    const handleSyncFromVSCode = async () => {
        setIsSyncingVSCode(true);
        try {
            // Fetch the latest script from Firestore
            const projectDoc = await getDoc(doc(db, 'projects', projectId));
            if (projectDoc.exists()) {
                const data = projectDoc.data();
                if (data.script && data.script !== localCode) {
                    setLocalCode(data.script);
                    showToast({
                        type: 'success',
                        title: 'Synced!',
                        message: 'Code synced from VS Code',
                        duration: 2000
                    });
                } else {
                    showToast({
                        type: 'info',
                        title: 'Already in sync',
                        message: 'Your code is already up to date',
                        duration: 2000
                    });
                }
            }
        } catch (error) {
            console.error('[VS Code Sync] Error:', error);
            showToast({
                type: 'error',
                title: 'Sync Failed',
                message: 'Could not sync from VS Code'
            });
        } finally {
            setIsSyncingVSCode(false);
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

            {/* Training Success Celebration with Confetti */}
            <TrainingSuccessOverlay
                isOpen={showSuccessCelebration}
                onClose={() => setShowSuccessCelebration(false)}
                modelName={completedJobInfo?.modelName}
                version={completedJobInfo?.version}
                metrics={completedJobInfo?.metrics}
            />

            {/* Collaboration Share Modal */}
            <CollabLinkModal
                isOpen={showShareModal}
                onClose={() => setShowShareModal(false)}
                projectId={projectId}
            />

            {/* GitHub Push Modal */}
            <GitHubPushModal
                isOpen={showGitHubModal}
                onClose={() => setShowGitHubModal(false)}
                projectId={projectId}
                code={localCode}
            />


            {/* Workflow Timeline */}
            {project.datasetUploaded && (
                <WorkflowTimeline
                    currentStep={
                        // Calculate step based on actual job status
                        allJobs.some(j => j.status === 'deployed') ? 7 :
                            allJobs.some(j => j.status === 'succeeded') ? 6 :
                                allJobs.some(j => j.status === 'running' || j.status === 'provisioning') ? 5 :
                                    project.workflow?.step ?? 4
                    }
                    status={
                        allJobs.some(j => j.status === 'failed') ? 'error' :
                            allJobs.some(j => j.status === 'succeeded' || j.status === 'deployed') ? 'success' :
                                'pending'
                    }
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
                    trainingStatus={activeJob?.status && ['installing', 'downloading', 'running', 'training', 'PROVISIONING', 'RUNNING'].includes(activeJob.status) ? activeJob.status : undefined}
                    trainingStep={activeJob?.status ? (
                        activeJob.status === 'installing' ? 'Installing Dependencies' :
                            activeJob.status === 'downloading' ? 'Downloading Data' :
                                activeJob.status === 'running' || activeJob.status === 'training' ? 'Training Model' :
                                    activeJob.status === 'PROVISIONING' ? 'Provisioning VM' :
                                        activeJob.status === 'RUNNING' ? 'Training...' :
                                            'Processing...'
                    ) : undefined}
                    onSaveName={handleSaveName}
                    onRunTraining={handleRunTraining}
                    onAutoML={handleAutoML}
                    onDeploy={handleDeploy}
                    onResetDataset={handleResetDataset}
                    onSyncStatus={handleSyncStatus}
                    isSyncing={isSyncing}
                    onShare={() => setShowShareModal(true)}
                    onGitHubPush={() => setShowGitHubModal(true)}
                    onExportNotebook={handleExportNotebook}
                    onImportNotebook={handleImportNotebook}
                    onOpenVSCode={handleOpenVSCode}
                    isConnectingVSCode={isConnectingVSCode}
                />

                {/* Main Grid */}
                <div className="mx-auto max-w-7xl grid grid-cols-1 lg:grid-cols-2 gap-6" style={{ height: 'calc(100vh - 200px)' }}>
                    {/* Left: Code Editor */}
                    <CodeEditor
                        code={localCode}
                        onChange={(val) => setLocalCode(val)}
                        onSave={handleSave}
                        onSyncVSCode={vsCodeConnected ? handleSyncFromVSCode : undefined}
                        saving={isSaving}
                        syncing={isSyncingVSCode}
                    />

                    {/* Right: Split View */}
                    <div className="flex flex-col gap-4 h-full">
                        {/* Terminal / History Tabs - All top level */}
                        <div className="h-[280px]">
                            <div className="h-full flex flex-col">
                                {/* Single Row of 4 Tabs - Center Aligned */}
                                <GlassCard className="px-4 py-2 mb-4 flex items-center justify-center gap-2" hover={false}>
                                    <button
                                        onClick={() => setActiveTab('terminal')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'terminal' ? 'bg-emerald-500/20 ring-1 ring-emerald-500/40' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                                    >
                                        <Terminal className={`w-4 h-4 ${activeTab === 'terminal' ? 'text-emerald-400' : 'text-emerald-500/60'}`} />
                                        <span className={activeTab === 'terminal' ? 'text-emerald-300' : ''}>Terminal</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('versions')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'versions' ? 'bg-violet-500/20 ring-1 ring-violet-500/40' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                                    >
                                        <Code className={`w-4 h-4 ${activeTab === 'versions' ? 'text-violet-400' : 'text-violet-500/60'}`} />
                                        <span className={activeTab === 'versions' ? 'text-violet-300' : ''}>Versions</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('journey')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'journey' ? 'bg-amber-500/20 ring-1 ring-amber-500/40' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                                    >
                                        <History className={`w-4 h-4 ${activeTab === 'journey' ? 'text-amber-400' : 'text-amber-500/60'}`} />
                                        <span className={activeTab === 'journey' ? 'text-amber-300' : ''}>Journey</span>
                                    </button>
                                    <button
                                        onClick={() => setActiveTab('metrics')}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${activeTab === 'metrics' ? 'bg-cyan-500/20 ring-1 ring-cyan-500/40' : 'text-white/40 hover:text-white/70 hover:bg-white/5'}`}
                                    >
                                        <BarChart3 className={`w-4 h-4 ${activeTab === 'metrics' ? 'text-cyan-400' : 'text-cyan-500/60'}`} />
                                        <span className={activeTab === 'metrics' ? 'text-cyan-300' : ''}>Metrics</span>
                                    </button>
                                </GlassCard>

                                {/* Content - Fixed Height with Scroll */}
                                <div className="flex-1 min-h-0 overflow-hidden flex justify-center">
                                    <div className="w-full h-full overflow-y-auto">
                                        {activeTab === 'terminal' && (
                                            <TerminalView
                                                logs={activeJob?.logs}
                                                status={activeJob?.status}
                                                projectId={projectId}
                                                jobId={activeJob?.id}
                                                themeColor={themeColor}
                                                jobMetadata={activeJob ? {
                                                    originalFilename: activeJob.originalFilename || activeJob.datasetFilename || project?.dataset?.filename,
                                                    datasetRows: activeJob.datasetRows || project?.dataset?.rowCount,
                                                    datasetSizeMB: activeJob.datasetSizeMB,
                                                    taskType: activeJob.taskType || project?.inferredTaskType,
                                                    algorithm: activeJob.algorithm || activeJob.config?.algorithm,
                                                    vmName: activeJob.vmName,
                                                    consoleUrl: activeJob.consoleUrl,
                                                    config: activeJob.config,
                                                    actualRuntimeSeconds: activeJob.actualRuntimeSeconds,
                                                    actualCostUsd: activeJob.actualCostUsd,
                                                    actualCostInr: activeJob.actualCostInr,
                                                    estimatedMinutes: activeJob.estimatedMinutes,
                                                    estimatedTotalCost: activeJob.estimatedTotalCost,
                                                    currentPhase: activeJob.currentPhase || activeJob.status,
                                                    phaseProgress: activeJob.phaseProgress
                                                } : undefined}
                                            />
                                        )}
                                        {activeTab === 'versions' && (
                                            <ScriptVersionsView
                                                projectId={projectId}
                                                onVersionSelect={(content, version) => {
                                                    setLocalCode(content);
                                                    showToast({
                                                        type: 'info',
                                                        title: 'Version Loaded',
                                                        message: `Loaded script version ${version}`
                                                    });
                                                }}
                                                themeColor={themeColor}
                                            />
                                        )}
                                        {/* Journey tab - Training History with Visibility Toggle */}
                                        {activeTab === 'journey' && (
                                            <GlassCard className="h-full p-4" hover={false}>
                                                <div className="flex items-center justify-between mb-4">
                                                    <h4 className="text-sm font-semibold text-white/60 flex items-center gap-2">
                                                        <Clock className="w-4 h-4" />
                                                        Training History
                                                    </h4>
                                                    {projectModel?.id && (
                                                        <button
                                                            onClick={async () => {
                                                                const newVis = projectModel.visibility === 'public' ? 'private' : 'public';
                                                                try {
                                                                    await updateDoc(doc(db, 'models', projectModel.id), { visibility: newVis });
                                                                    setProjectModel(prev => prev ? { ...prev, visibility: newVis } : null);
                                                                } catch (err) { console.error(err); }
                                                            }}
                                                            title={projectModel.visibility === 'public' ? 'Public model' : 'Private model'}
                                                            className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-semibold"
                                                            style={{
                                                                background: projectModel.visibility === 'public' ? 'rgba(34,197,94,0.2)' : 'rgba(239,68,68,0.2)',
                                                                color: projectModel.visibility === 'public' ? '#22c55e' : '#ef4444'
                                                            }}
                                                        >
                                                            {projectModel.visibility === 'public' ? <Globe className="w-3 h-3" /> : <Lock className="w-3 h-3" />}
                                                            {projectModel.visibility === 'public' ? 'Public' : 'Private'}
                                                        </button>
                                                    )}
                                                </div>
                                                {allJobs.length > 0 ? (
                                                    <div className="relative pl-4 border-l border-white/10 space-y-4">
                                                        {allJobs.slice(0, 5).map((job, i) => (
                                                            <motion.div key={job.id} initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: i * 0.1 }} className="relative pl-5">
                                                                <div className={`absolute -left-[9px] top-1 w-2.5 h-2.5 rounded-full ${job.status === 'succeeded' ? 'bg-green-500' : job.status === 'failed' ? 'bg-red-500' : 'bg-yellow-500 animate-pulse'}`} />
                                                                <div className="flex items-center justify-between">
                                                                    <span className="text-xs text-white/50">v{allJobs.length - i}</span>
                                                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${job.status === 'succeeded' ? 'bg-green-500/20 text-green-400' : job.status === 'failed' ? 'bg-red-500/20 text-red-400' : 'bg-yellow-500/20 text-yellow-400'}`}>{job.status}</span>
                                                                </div>
                                                                {job.metrics?.accuracy !== undefined && <div className="text-xs text-white/40 mt-1">Accuracy: {(job.metrics.accuracy * 100).toFixed(1)}%</div>}
                                                            </motion.div>
                                                        ))}
                                                    </div>
                                                ) : (
                                                    <div className="text-center py-8 text-white/40"><Clock className="w-8 h-8 mx-auto mb-2 opacity-50" /><p className="text-sm">No training jobs yet</p></div>
                                                )}
                                            </GlassCard>
                                        )}

                                        {/* Metrics tab - VisualizationView */}
                                        {activeTab === 'metrics' && (
                                            <VisualizationView
                                                jobs={allJobs}
                                                themeColor={themeColor}
                                                modelId={projectModel?.id}
                                                currentVisibility={projectModel?.visibility}
                                                onVisibilityChange={(v) => setProjectModel(prev => prev ? { ...prev, visibility: v } : null)}
                                            />
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

            {/* Suggestion Panel from Chat */}
            <SuggestionPanel
                isOpen={showSuggestionPanel}
                onClose={() => {
                    setShowSuggestionPanel(false);
                    // Clear URL param without reload
                    window.history.replaceState({}, '', `/studio/${projectId}`);
                }}
                suggestion={suggestionData}
                currentScript={localCode}
                onApply={(mergedCode) => {
                    setLocalCode(mergedCode);
                    setShowSuggestionPanel(false);
                    showToast({ type: 'success', title: 'Applied', message: 'Suggestion applied to your script' });
                    // Mark suggestion as applied
                    if (suggestionData?.id && user?.uid) {
                        fetch(`/api/studio/suggestions/${suggestionData.id}`, {
                            method: 'PATCH',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                appliedBy: user.uid,
                                appliedByEmail: user.email,
                                extractedCode: suggestionData.extractedCode
                            })
                        }).catch(console.error);
                    }
                    window.history.replaceState({}, '', `/studio/${projectId}`);
                }}
                onRetrain={() => {
                    // Apply suggestion first, then trigger training
                    if (suggestionData?.extractedCode) {
                        const mergedCode = localCode + '\n\n# === AI Improvement Suggestion ===\n' + suggestionData.extractedCode;
                        setLocalCode(mergedCode);
                    }
                    setShowSuggestionPanel(false);
                    // Open training config to let user start training
                    setShowTrainingConfig(true);
                    window.history.replaceState({}, '', `/studio/${projectId}`);
                }}
                loading={suggestionLoading}
            />

            {/* MCP/VS Code Fallback Modal */}
            <AnimatePresence>
                {showMCPModal && (
                    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={() => setShowMCPModal(false)}>
                        <div className="absolute inset-0 bg-black/60 backdrop-blur-md" />
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.95 }}
                            className="relative w-full max-w-md rounded-2xl p-6 backdrop-blur-xl"
                            style={{
                                background: 'rgba(0,0,0,0.8)',
                                border: `1px solid ${themeColor}30`,
                                boxShadow: `0 8px 32px rgba(0,0,0,0.4), 0 0 60px ${themeColor}10`
                            }}
                            onClick={(e) => e.stopPropagation()}
                        >
                            <h3 className="text-lg font-bold text-white mb-4 flex items-center gap-2">
                                <Code className="w-5 h-5" style={{ color: themeColor }} />
                                Open in VS Code
                            </h3>

                            {mcpError && (
                                <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                    {mcpError}
                                </div>
                            )}

                            <div className="space-y-4 text-sm text-white/70">
                                <div>
                                    <p className="font-semibold text-white mb-2">1. Start MCP Server</p>
                                    <div
                                        className="bg-black/50 rounded-lg p-3 font-mono text-xs cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            navigator.clipboard.writeText('cd mcp-server && npm start');
                                            showToast({ type: 'success', title: 'Copied!', message: 'Command copied to clipboard' });
                                        }}
                                    >
                                        <span>cd mcp-server && npm start</span>
                                        <span className="text-white/40 text-[10px]">Click to copy</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="font-semibold text-white mb-2">2. Open VS Code Extension</p>
                                    <div
                                        className="bg-black/50 rounded-lg p-3 font-mono text-xs cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            navigator.clipboard.writeText('cd vscode-extension && code . && npm run compile');
                                            showToast({ type: 'success', title: 'Copied!', message: 'Command copied to clipboard' });
                                        }}
                                    >
                                        <span>cd vscode-extension && code .</span>
                                        <span className="text-white/40 text-[10px]">Click to copy</span>
                                    </div>
                                </div>

                                <div>
                                    <p className="font-semibold text-white mb-2">3. Connect to Project</p>
                                    <p className="text-white/50 text-xs mb-2">Press F5 in VS Code, then Ctrl+Shift+P → "MLForge: Connect"</p>
                                    <div
                                        className="bg-black/50 rounded-lg p-3 font-mono text-xs cursor-pointer hover:bg-white/5 transition-colors flex items-center justify-between"
                                        onClick={() => {
                                            navigator.clipboard.writeText(projectId);
                                            showToast({ type: 'success', title: 'Copied!', message: 'Project ID copied' });
                                        }}
                                    >
                                        <span>Project ID: {projectId}</span>
                                        <span className="text-white/40 text-[10px]">Click to copy</span>
                                    </div>
                                </div>
                            </div>

                            <div className="mt-6 flex gap-3">
                                <button
                                    onClick={() => setShowMCPModal(false)}
                                    className="flex-1 px-4 py-2 rounded-lg bg-white/10 text-white text-sm hover:bg-white/20 transition-colors"
                                >
                                    Close
                                </button>
                                <button
                                    onClick={() => {
                                        const blob = new Blob([localCode], { type: 'text/x-python' });
                                        const url = URL.createObjectURL(blob);
                                        const a = document.createElement('a');
                                        a.href = url;
                                        a.download = `${project?.name?.replace(/[^a-zA-Z0-9]/g, '_') || 'train'}.py`;
                                        a.click();
                                        URL.revokeObjectURL(url);
                                    }}
                                    className="flex-1 px-4 py-2 rounded-lg text-white text-sm transition-colors"
                                    style={{ background: themeColor }}
                                >
                                    Download Script
                                </button>
                            </div>
                        </motion.div>
                    </div>
                )}
            </AnimatePresence>
        </div>
    );
}
