'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { useTheme } from 'next-themes';
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
    const { resolvedTheme } = useTheme();
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
        <div className={`min-h-screen ${resolvedTheme === 'light' ? 'bg-gray-50' : 'bg-[#020202]'} text-black dark:text-white relative overflow-hidden`}>
            {/* Navbar */}
            <Navbar />

            {/* Theme Toggle - Hidden on mobile, shown in corner on desktop */}
            <div className="hidden lg:block">
                <ThemeToggle />
            </div>

            {/* Mobile Theme Toggle Bar - Centered under navbar */}
            <div className="lg:hidden flex items-center justify-center pt-20 pb-3">
                <ThemeToggle inline />
            </div>

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
            <div className="flex items-center justify-center min-h-[calc(100vh-180px)] lg:min-h-screen lg:pt-16 py-4">
                {/* Project Picker Card */}
                <motion.div
                    initial={{ opacity: 0, scale: 0.9, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    transition={{ duration: 0.5, ease: "easeOut" }}
                    className={`relative z-10 backdrop-blur-2xl ${resolvedTheme === 'light' ? 'bg-white/40 border-black/5' : 'bg-white/5 border-white/10'} border rounded-3xl p-4 md:p-6 w-full max-w-lg shadow-2xl mx-4`}
                    style={{ boxShadow: `0 0 80px ${themeColor}15` }}
                >
                    {/* Header */}
                    <div className="text-center mb-6 md:mb-8">
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
                            className="w-14 h-14 md:w-16 md:h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                            style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                        >
                            <Sparkles className="w-7 h-7 md:w-8 md:h-8" style={{ color: themeColor }} />
                        </motion.div>
                        <h1 className="text-xl md:text-2xl font-bold text-black dark:text-white mb-2">Welcome to Studio</h1>
                        <p className="text-black/50 dark:text-white/50 text-sm">Create a new project or continue working</p>
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

                    {/* Recent Projects - Grid Layout */}
                    {recentProjects.length > 0 && (
                        <div className="mt-4">
                            <div className="flex items-center justify-center gap-2 mb-3 text-black/40 dark:text-white/40 text-xs uppercase tracking-wider">
                                <FolderOpen className="w-4 h-4" />
                                <span>Recent Projects</span>
                            </div>
                            <div className="grid grid-cols-2 gap-2 max-h-[200px] overflow-y-auto pr-1 scrollbar-thin scrollbar-thumb-black/10 dark:scrollbar-thumb-white/10">
                                <AnimatePresence>
                                    {recentProjects.map((project, index) => (
                                        <motion.button
                                            key={project.id}
                                            initial={{ opacity: 0, scale: 0.9 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            whileHover={{ scale: 1.02, y: -2 }}
                                            whileTap={{ scale: 0.98 }}
                                            transition={{ delay: index * 0.05 }}
                                            onClick={() => selectProject(project.id)}
                                            className="p-3 rounded-xl bg-black/5 dark:bg-white/5 hover:bg-black/10 dark:hover:bg-white/10 border border-black/5 dark:border-white/5 hover:border-black/15 dark:hover:border-white/15 flex flex-col items-center gap-2 group transition-all duration-200"
                                            style={{
                                                boxShadow: project.datasetUploaded ? `0 0 15px ${themeColor}20` : 'none'
                                            }}
                                        >
                                            <div
                                                className="w-10 h-10 rounded-xl flex items-center justify-center bg-black/5 dark:bg-white/5 group-hover:bg-black/10 dark:group-hover:bg-white/10 transition-all"
                                                style={{
                                                    background: project.datasetUploaded ? `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` : undefined
                                                }}
                                            >
                                                <FolderOpen className="w-5 h-5 text-black/50 dark:text-white/50" style={{ color: project.datasetUploaded ? themeColor : undefined }} />
                                            </div>
                                            <div className="text-center w-full">
                                                <div className="text-black dark:text-white font-medium text-xs truncate">
                                                    {project.name}
                                                </div>
                                                <div className="text-black/40 dark:text-white/40 text-[10px] capitalize">
                                                    {project.datasetUploaded ? (
                                                        <span style={{ color: themeColor }}>Ready</span>
                                                    ) : (
                                                        project.status
                                                    )}
                                                </div>
                                            </div>
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

