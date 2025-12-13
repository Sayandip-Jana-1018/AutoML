import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Plus, Loader2, FolderOpen, ArrowRight, X } from 'lucide-react';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { collection, addDoc, serverTimestamp, query, where, orderBy, limit, getDocs, setDoc, doc } from 'firebase/firestore';
import { db } from '@/lib/firebase';

interface Project {
    id: string;
    name: string;
    status: string;
    datasetUploaded?: boolean;
    created_at?: any;
}

interface ProjectModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSelectProject: (projectId: string) => void;
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

export function ProjectModal({ isOpen, onClose, onSelectProject }: ProjectModalProps) {
    const { user } = useAuth();
    const { themeColor } = useThemeColor();
    const [recentProjects, setRecentProjects] = useState<Project[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [showNameInput, setShowNameInput] = useState(false);
    const [projectName, setProjectName] = useState('');

    useEffect(() => {
        if (isOpen && user?.email) {
            fetchRecentProjects();
        }
    }, [isOpen, user]);

    const fetchRecentProjects = async () => {
        if (!user?.email) return;
        setLoading(true);
        try {
            // Check multiple fields/collaborators
            const projectsRef = collection(db, 'projects');
            // Simplified query for responsiveness - basic owner check + sort
            // Note: complex queries might fail if index missing, so let's stick to simple owner check 
            // and client-side sort if needed, or rely on the fact user fixed indexes
            const q = query(
                projectsRef,
                where('owner_email', '==', user.email),
                orderBy('created_at', 'desc'),
                limit(5)
            );

            const snapshot = await getDocs(q);
            const projects = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data()
            })) as Project[];
            setRecentProjects(projects);
        } catch (error) {
            console.error('Error fetching recent projects:', error);
            // Fallback fetch all? Maybe not needed inside modal for now
        } finally {
            setLoading(false);
        }
    };

    const createNewProject = async () => {
        if (!user?.email || !projectName.trim()) return;
        setCreating(true);

        try {
            const docRef = await addDoc(collection(db, 'projects'), {
                name: projectName,
                owner_email: user.email,
                created_at: serverTimestamp(),
                collaborators: [user.email],
                currentScript: DEFAULT_SCRIPT,
                status: 'draft',
                logs: []
            });

            // Set default project
            await setDoc(doc(db, 'users', user.uid), {
                defaultProjectId: docRef.id
            }, { merge: true });

            onSelectProject(docRef.id);
            onClose();
        } catch (error) {
            console.error('Error creating project:', error);
        } finally {
            setCreating(false);
            setShowNameInput(false);
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
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm"
                    />

                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md bg-[#0A0A0A] border border-white/10 rounded-3xl p-8 shadow-2xl overflow-hidden"
                        style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                    >
                        {/* Background Glow */}
                        <div
                            className="absolute top-0 left-1/2 -translate-x-1/2 w-full h-32 opacity-20 blur-3xl pointer-events-none"
                            style={{ background: `radial-gradient(circle, ${themeColor}, transparent)` }}
                        />

                        {/* Close Button */}
                        <button
                            onClick={onClose}
                            className="absolute top-4 right-4 p-2 text-white/30 hover:text-white transition-colors"
                        >
                            <X className="w-5 h-5" />
                        </button>

                        {/* Header */}
                        <div className="relative text-center mb-8">
                            <div
                                className="w-16 h-16 mx-auto mb-4 rounded-2xl flex items-center justify-center"
                                style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                            >
                                <Sparkles className="w-8 h-8" style={{ color: themeColor }} />
                            </div>
                            <h2 className="text-2xl font-bold text-white mb-2">Select Project</h2>
                            <p className="text-white/50 text-sm">Choose a project to maximize visibility</p>
                        </div>

                        {/* Create New Section */}
                        {showNameInput ? (
                            <div className="mb-6">
                                <input
                                    autoFocus
                                    type="text"
                                    placeholder="Project Name"
                                    value={projectName}
                                    onChange={(e) => setProjectName(e.target.value)}
                                    onKeyDown={(e) => e.key === 'Enter' && createNewProject()}
                                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder-white/40 focus:outline-none focus:border-white/30 mb-3"
                                />
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => setShowNameInput(false)}
                                        className="flex-1 py-3 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium"
                                    >
                                        Cancel
                                    </button>
                                    <button
                                        onClick={createNewProject}
                                        disabled={creating || !projectName.trim()}
                                        className="flex-1 py-3 rounded-xl font-medium text-white transition-all flex items-center justify-center gap-2"
                                        style={{ background: themeColor }}
                                    >
                                        {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Create'}
                                    </button>
                                </div>
                            </div>
                        ) : (
                            <motion.button
                                whileHover={{ scale: 1.02 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => setShowNameInput(true)}
                                className="w-full py-4 px-6 rounded-xl mb-6 flex items-center justify-center gap-3 font-medium transition-all group"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}90)`,
                                    boxShadow: `0 4px 20px ${themeColor}40`
                                }}
                            >
                                <Plus className="w-5 h-5 group-hover:rotate-90 transition-transform" />
                                <span>Create New Project</span>
                            </motion.button>
                        )}

                        {/* Recent Projects List */}
                        <div className="space-y-3">
                            <div className="flex items-center gap-2 text-white/40 text-xs uppercase tracking-wider mb-2">
                                <FolderOpen className="w-3 h-3" />
                                <span>Recent Projects</span>
                            </div>

                            {loading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin text-white/30" />
                                </div>
                            ) : recentProjects.length === 0 ? (
                                <div className="text-center text-white/30 text-sm py-2">No recent projects found</div>
                            ) : (
                                <div className="max-h-[240px] overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                                    {recentProjects.map((proj, idx) => (
                                        <motion.button
                                            key={proj.id}
                                            initial={{ opacity: 0, x: -10 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            transition={{ delay: idx * 0.05 }}
                                            onClick={() => {
                                                onSelectProject(proj.id);
                                                onClose();
                                            }}
                                            className="w-full p-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/5 hover:border-white/20 flex items-center justify-between group transition-all text-left"
                                        >
                                            <div className="flex items-center gap-3">
                                                <div
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center bg-white/5 group-hover:bg-white/10 transition-all"
                                                    style={{ color: proj.datasetUploaded ? themeColor : 'rgba(255,255,255,0.3)' }}
                                                >
                                                    <FolderOpen className="w-5 h-5" />
                                                </div>
                                                <div>
                                                    <div className="font-medium text-white group-hover:text-white transition-colors">
                                                        {proj.name}
                                                    </div>
                                                    <div className="text-xs text-white/40 flex items-center gap-2">
                                                        <span className="capitalize">{proj.status}</span>
                                                        {proj.datasetUploaded && (
                                                            <span style={{ color: themeColor }}>• Data Ready</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <ArrowRight
                                                className="w-4 h-4 text-white/30 group-hover:translate-x-1 transition-transform"
                                                style={{ color: proj.datasetUploaded ? themeColor : undefined }}
                                            />
                                        </motion.button>
                                    ))}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
