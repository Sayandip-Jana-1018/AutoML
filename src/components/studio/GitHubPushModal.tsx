'use client';

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Github, Check, ExternalLink, Loader2, GitBranch, GitCommit } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface GitHubPushModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
    code: string;
    onPushed?: (repoUrl: string) => void;
}

export default function GitHubPushModal({ isOpen, onClose, projectId, code, onPushed }: GitHubPushModalProps) {
    const { themeColor } = useThemeColor();
    const [pushing, setPushing] = useState(false);
    const [commitMessage, setCommitMessage] = useState('');
    const [result, setResult] = useState<{ success: boolean; repoUrl?: string; commitUrl?: string; error?: string } | null>(null);

    const handlePush = async () => {
        if (!code) return;

        setPushing(true);
        setResult(null);

        try {
            const res = await fetch('/api/github/push', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    code,
                    commitMessage: commitMessage || 'Update train.py from MLForge Studio'
                })
            });

            const data = await res.json();

            if (data.success) {
                setResult({ success: true, repoUrl: data.repoUrl, commitUrl: data.commitUrl });
                onPushed?.(data.repoUrl);
            } else {
                setResult({ success: false, error: data.error || 'Push failed' });
            }
        } catch (err: any) {
            setResult({ success: false, error: err.message || 'Network error' });
        } finally {
            setPushing(false);
        }
    };

    const handleClose = () => {
        setResult(null);
        setCommitMessage('');
        onClose();
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={handleClose}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md backdrop-blur-2xl bg-black/50 border border-white/15 rounded-3xl p-6 overflow-hidden shadow-2xl"
                        style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                    >
                        {/* Glow Effect */}
                        <div
                            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30"
                            style={{ background: `radial-gradient(circle, ${themeColor}, transparent)` }}
                        />

                        {/* Header */}
                        <div className="flex flex-col items-center text-center mb-6 relative z-10">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border border-white/20"
                                style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                            >
                                <Github className="w-7 h-7" style={{ color: themeColor }} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">Push to GitHub</h2>
                            <p className="text-xs text-white/50">Sync your train.py to a GitHub repository</p>
                            <button
                                onClick={handleClose}
                                className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                <X className="w-4 h-4 text-white/60" />
                            </button>
                        </div>

                        {/* Result State */}
                        {result && (
                            <div className={`mb-4 p-4 rounded-xl border ${result.success ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
                                <div className="flex items-center gap-2 mb-2">
                                    {result.success ? (
                                        <Check className="w-5 h-5 text-green-400" />
                                    ) : (
                                        <X className="w-5 h-5 text-red-400" />
                                    )}
                                    <span className={`font-bold ${result.success ? 'text-green-400' : 'text-red-400'}`}>
                                        {result.success ? 'Pushed Successfully!' : 'Push Failed'}
                                    </span>
                                </div>
                                {result.success && result.repoUrl && (
                                    <a
                                        href={result.repoUrl}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex items-center gap-2 text-xs text-white/60 hover:text-white transition-colors"
                                    >
                                        <ExternalLink className="w-3 h-3" />
                                        View Repository
                                    </a>
                                )}
                                {result.error && (
                                    <p className="text-xs text-red-400">{result.error}</p>
                                )}
                            </div>
                        )}

                        {/* Commit Form */}
                        {!result?.success && (
                            <div className="space-y-4 relative z-10">
                                <div>
                                    <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center gap-1 mb-2">
                                        <GitCommit className="w-3 h-3" /> Commit Message
                                    </label>
                                    <input
                                        type="text"
                                        value={commitMessage}
                                        onChange={(e) => setCommitMessage(e.target.value)}
                                        placeholder="Update train.py from MLForge"
                                        className="w-full bg-black/60 backdrop-blur-xl border border-white/20 rounded-xl px-4 py-3 text-white text-sm outline-none focus:border-white/40 transition-all placeholder:text-white/30"
                                    />
                                </div>

                                <div className="flex items-center gap-2 p-3 bg-white/5 border border-white/10 rounded-xl">
                                    <GitBranch className="w-4 h-4 text-white/40" />
                                    <div className="text-xs">
                                        <p className="text-white/60">Will push to:</p>
                                        <p className="text-white font-mono">train.py → main branch</p>
                                    </div>
                                </div>

                                <button
                                    onClick={handlePush}
                                    disabled={pushing}
                                    className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 text-white border"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                        borderColor: `${themeColor}50`
                                    }}
                                >
                                    {pushing ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <>
                                            <Github className="w-4 h-4" />
                                            Push to GitHub
                                        </>
                                    )}
                                </button>
                            </div>
                        )}

                        {/* Info */}
                        <p className="text-[10px] text-white/30 text-center mt-4 relative z-10">
                            Creates a private repo if one doesn't exist • Uses GITHUB_PAT from .env
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
