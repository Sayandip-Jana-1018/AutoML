'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { db } from '@/lib/firebase';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, doc, getDoc, setDoc } from 'firebase/firestore';
import { Loader2, Plus, FolderOpen, ArrowRight, Sparkles, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import LightPillar from '@/components/react-bits/LightPillar';
import { Navbar } from '@/components/navbar';
import { ThemeToggle } from '@/components/theme-toggle';

interface Project {
    id: string;
    name: string;
    created_at: any;
    status: string;
    datasetUploaded?: boolean;
}

export default function StudioEntryPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user } = useAuth();
    const { themeColor } = useThemeColor();
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [showNameModal, setShowNameModal] = useState(false);
    const [projectName, setProjectName] = useState('');

    useEffect(() => {
        const checkDefaultProject = async () => {
            if (!user?.email) return;

            try {
                // If config param exists, always create new project (from Marketplace)
                const configParam = searchParams?.get('config');
                if (configParam) {
                    await createNewProject('', configParam);
                    return;
                }

                // Always load recent projects for picker (never auto-redirect)
                const projectsQuery = query(
                    collection(db, 'projects'),
                    where('owner_email', '==', user.email),
                    orderBy('created_at', 'desc'),
                    limit(5)
                );
                const snapshot = await getDocs(projectsQuery);
                const projects = snapshot.docs.map(doc => ({
                    id: doc.id,
                    ...doc.data()
                })) as Project[];

                setRecentProjects(projects);
                setLoading(false);
            } catch (error) {
                console.error('Error loading projects:', error);
                setLoading(false);
            }
        };

        if (user) {
            checkDefaultProject();
        }
    }, [user, router, searchParams]);

    const createNewProject = async (name?: string, configParam?: string | null) => {
        if (!user?.email) return;
        setCreating(true);
        setShowNameModal(false);

        try {
            let initialConfig: any = {};
            if (configParam) {
                try {
                    initialConfig = JSON.parse(configParam);
                } catch (e) {
                    console.error("Invalid config param");
                }
            }

            const docRef = await addDoc(collection(db, 'projects'), {
                name: name || `Untitled Project ${new Date().toLocaleDateString()}`,
                owner_email: user.email,
                created_at: serverTimestamp(),
                collaborators: [user.email],
                currentScript: initialConfig ? generateInitialScript(initialConfig) : DEFAULT_SCRIPT,
                status: 'draft',
                logs: []
            });

            // Set as default project - use setDoc with merge to create user doc if needed
            await setDoc(doc(db, 'users', user.uid), {
                defaultProjectId: docRef.id
            }, { merge: true });

            router.push(`/studio/${docRef.id}`);
        } catch (error) {
            console.error("Error creating project:", error);
            setCreating(false);
        }
    };

    const selectProject = async (projectId: string) => {
        if (!user?.uid) return;

        // Set as default project - use setDoc with merge to create user doc if needed
        await setDoc(doc(db, 'users', user.uid), {
            defaultProjectId: projectId
        }, { merge: true });

        router.push(`/studio/${projectId}`);
    };

    // Loading state
    if (loading || !user) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center text-white relative overflow-hidden">
                <div className="fixed inset-0 z-0 opacity-80">
                    <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.5} pillarWidth={25} glowAmount={0.002} />
                </div>
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    className="relative z-10 flex items-center gap-3"
                >
                    <Loader2 className="w-6 h-6 animate-spin" style={{ color: themeColor }} />
                    <span className="text-white/70">Loading Studio...</span>
                </motion.div>
            </div>
        );
    }

    // Project Picker UI
    return (
        <div className="min-h-screen bg-[#020202] text-white relative overflow-hidden">
            {/* Navbar */}
            <Navbar />

            {/* Theme Toggle */}
            <ThemeToggle />

            {/* Project Name Modal */}
            <AnimatePresence>
                {showNameModal && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm"
                        onClick={() => setShowNameModal(false)}
                    >
                        <motion.div
                            initial={{ scale: 0.9, opacity: 0 }}
                            animate={{ scale: 1, opacity: 1 }}
                            exit={{ scale: 0.9, opacity: 0 }}
                            onClick={(e) => e.stopPropagation()}
                            className="bg-white/10 backdrop-blur-xl border border-white/20 rounded-2xl p-6 w-full max-w-md mx-4"
                            style={{ boxShadow: `0 0 40px ${themeColor}20` }}
                        >
                            <div className="flex items-center justify-between mb-4">
                                <h2 className="text-xl font-bold text-white">New Project</h2>
                                <button onClick={() => setShowNameModal(false)} className="text-white/50 hover:text-white">
                                    <X className="w-5 h-5" />
                                </button>
                            </div>
                            <input
                                type="text"
                                placeholder="Project name (optional)"
                                value={projectName}
                                onChange={(e) => setProjectName(e.target.value)}
                                onKeyDown={(e) => e.key === 'Enter' && createNewProject(projectName)}
                                autoFocus
                                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30 mb-4"
                            />
                            <div className="flex gap-3">
                                <button
                                    onClick={() => setShowNameModal(false)}
                                    className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white font-medium transition-all"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={() => createNewProject(projectName)}
                                    className="flex-1 py-3 rounded-xl font-medium text-white transition-all"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}90)`,
                                        boxShadow: `0 4px 15px ${themeColor}40`
                                    }}
                                >
                                    Create
                                </button>
                            </div>
                        </motion.div>
                    </motion.div>
                )}
            </AnimatePresence>

            {/* LightPillar Background */}
            <div className="fixed inset-0 z-0 opacity-80">
                <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.5} pillarWidth={25} glowAmount={0.002} />
            </div>

            {/* Ambient Glow */}
            <div
                className="absolute inset-0 z-[1]"
                style={{ background: `radial-gradient(ellipse 60% 40% at 50% 50%, ${themeColor}15 0%, transparent 70%)` }}
            />

            {/* Centered Content Container */}
            <div className="flex items-center justify-center min-h-screen pt-16">
                {/* Project Picker Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className="relative z-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8 w-full max-w-md shadow-2xl mx-4"
                    style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                >
                    {/* Header */}
                    <div className="text-center mb-8">
                        <motion.div
                            animate={{
                                scale: [1, 1.05, 1],
                                boxShadow: [
                                    `0 0 20px ${themeColor}20`,
                                    `0 0 30px ${themeColor}40`,
                                    `0 0 20px ${themeColor}20`
                                ]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                        >
                            <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                        </motion.div>
                        <h1 className="text-2xl font-bold text-white mb-2">Welcome to Studio</h1>
                        <p className="text-white/50 text-sm">Create a new project or continue working</p>
                    </div>

                    {/* Create New Project Button */}
                    <motion.button
                        whileHover={{ scale: 1.02 }}
                        whileTap={{ scale: 0.98 }}
                        onClick={() => { setProjectName(''); setShowNameModal(true); }}
                        disabled={creating}
                        className="w-full py-4 px-6 rounded-xl mb-4 flex items-center justify-center gap-3 font-medium transition-all"
                        style={{
                            background: `linear-gradient(135deg, ${themeColor}, ${themeColor}90)`,
                            boxShadow: `0 4px 20px ${themeColor}40`
                        }}
                    >
                        {creating ? (
                            <Loader2 className="w-5 h-5 animate-spin" />
                        ) : (
                            <Plus className="w-5 h-5" />
                        )}
                        <span>{creating ? 'Creating...' : 'Create New Project'}</span>
                    </motion.button>

                    {/* Recent Projects */}
                    {recentProjects.length > 0 && (
                        <div className="mt-6">
                            <div className="flex items-center gap-2 mb-3 text-white/40 text-xs uppercase tracking-wider">
                                <FolderOpen className="w-4 h-4" />
                                <span>Recent Projects</span>
                            </div>
                            <div className="space-y-2">
                                <AnimatePresence>
                                    {recentProjects.map((project, index) => (
                                        <motion.button
                                            key={project.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            whileHover={{ scale: 1.01, x: 4 }}
                                            whileTap={{ scale: 0.99 }}
                                            transition={{ delay: index * 0.1 }}
                                            onClick={() => selectProject(project.id)}
                                            className="w-full py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 flex items-center justify-between group transition-all duration-300"
                                            style={{
                                                boxShadow: 'none',
                                            }}
                                            onMouseEnter={(e) => {
                                                e.currentTarget.style.boxShadow = `0 0 20px ${themeColor}20, inset 0 0 20px ${themeColor}05`;
                                            }}
                                            onMouseLeave={(e) => {
                                                e.currentTarget.style.boxShadow = 'none';
                                            }}
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-8 h-8 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-all"
                                                    style={{
                                                        boxShadow: project.datasetUploaded ? `0 0 10px ${themeColor}30` : 'none'
                                                    }}
                                                >
                                                    <FolderOpen className="w-4 h-4 text-white/50 group-hover:text-white/70" style={{ color: project.datasetUploaded ? themeColor : undefined }} />
                                                </div>
                                                <div className="text-left">
                                                    <div className="text-white font-medium truncate max-w-[180px]">
                                                        {project.name}
                                                    </div>
                                                    <div className="text-white/40 text-xs flex items-center gap-2">
                                                        <span className="capitalize">{project.status}</span>
                                                        {project.datasetUploaded && (
                                                            <span style={{ color: `${themeColor}90` }}>• Dataset ready</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight
                                                className="w-4 h-4 text-white/30 group-hover:translate-x-1 transition-all duration-300"
                                                style={{ color: project.datasetUploaded ? themeColor : undefined }}
                                            />
                                        </motion.button>
                                    ))}
                                </AnimatePresence>
                            </div>
                        </div>
                    )}
                </motion.div>
            </div>
        </div>
    );
}

const DEFAULT_SCRIPT = `# Welcome to AutoForgeML Studio
# This script runs on Vertex AI. You can edit it live.

import pandas as pd
import sklearn
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import accuracy_score

def train():
    print("Loading dataset...")
    # df = pd.read_csv("gs://your-bucket/dataset.csv")
    
    print("Preprocessing...")
    # X_train, X_test, y_train, y_test = train_test_split(X, y)
    
    print("Training model...")
    model = RandomForestClassifier(n_estimators=100)
    # model.fit(X_train, y_train)
    
    print("Evaluating...")
    # acc = accuracy_score(y_test, model.predict(X_test))
    # print(f"Accuracy: {acc}")

if __name__ == "__main__":
    train()
`;

const generateInitialScript = (config: any) => {
    return `# Generated Script based on Config
# Algorithm: ${config.algorithm || 'Auto'}
# Target: ${config.target || 'Unknown'}

import pandas as pd
import sklearn

def train():
    print("Initializing training for target: ${config.target}")
    # TODO: Implement training logic
    pass

if __name__ == "__main__":
    train()
`;
}

