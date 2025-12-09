'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowLeft, Edit3, Check, X, Loader2, Play, Zap, Rocket, User } from 'lucide-react';
import { GlassCard } from './GlassCard';

interface StudioHeaderProps {
    projectId: string;
    projectName: string;
    themeColor: string;
    userEmail?: string;
    userAvatar?: string | null;
    datasetUploaded?: boolean;
    isRunning: boolean;
    isDeploying: boolean;
    isAutoMLRunning: boolean;
    hasActiveJob: boolean;
    onSaveName: (name: string) => Promise<void>;
    onRunTraining: () => void;
    onAutoML: () => void;
    onDeploy: () => void;
    onResetDataset: () => void;
}

export const StudioHeader = ({
    projectId,
    projectName,
    themeColor,
    userEmail,
    userAvatar,
    datasetUploaded,
    isRunning,
    isDeploying,
    isAutoMLRunning,
    hasActiveJob,
    onSaveName,
    onRunTraining,
    onAutoML,
    onDeploy,
    onResetDataset
}: StudioHeaderProps) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(projectName);
    const [savingName, setSavingName] = useState(false);

    const handleUpdateProjectName = async () => {
        if (!editedName.trim() || editedName === projectName) {
            setIsEditingName(false);
            return;
        }
        setSavingName(true);
        try {
            await onSaveName(editedName.trim());
            setIsEditingName(false);
        } catch (err) {
            console.error("Failed to update project name", err);
        } finally {
            setSavingName(false);
        }
    };

    return (
        <GlassCard className="mx-auto max-w-7xl mb-6 px-6 py-4" hover={false}>
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-4">
                    <Link href="/profile" className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
                        {/* Editable Project Name */}
                        {isEditingName ? (
                            <div className="flex items-center gap-2">
                                <input
                                    type="text"
                                    value={editedName}
                                    onChange={(e) => setEditedName(e.target.value)}
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter') handleUpdateProjectName();
                                        if (e.key === 'Escape') setIsEditingName(false);
                                    }}
                                    autoFocus
                                    className="font-bold text-xl bg-transparent border-b-2 focus:outline-none text-black dark:text-white"
                                    style={{ borderColor: themeColor }}
                                />
                                <button
                                    onClick={handleUpdateProjectName}
                                    disabled={savingName}
                                    className="p-1 rounded hover:bg-white/10 transition-colors"
                                    style={{ color: themeColor }}
                                >
                                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button
                                    onClick={() => setIsEditingName(false)}
                                    className="p-1 rounded hover:bg-white/10 text-red-400 transition-colors"
                                >
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h1
                                    className="font-bold text-xl cursor-pointer transition-colors"
                                    style={{ color: themeColor }}
                                    onClick={() => {
                                        setEditedName(projectName);
                                        setIsEditingName(true);
                                    }}
                                >
                                    {projectName}
                                </h1>
                                <Edit3
                                    className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer"
                                    style={{ color: themeColor }}
                                    onClick={() => {
                                        setEditedName(projectName);
                                        setIsEditingName(true);
                                    }}
                                />
                            </div>
                        )}
                        <span className="text-[10px] font-mono text-black/40 dark:text-white/40">
                            {projectId}
                        </span>
                    </div>
                </div>

                <div className="flex items-center gap-3">
                    {/* Vertex AI Status - Small dot indicator */}
                    <div className="flex items-center gap-2 text-xs text-green-400">
                        <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                        <span className="text-white/40">Ready</span>
                    </div>

                    {/* Separator */}
                    <div className="w-px h-6 bg-white/10" />

                    {/* Run Training */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onRunTraining}
                        disabled={isRunning || isDeploying}
                        className="relative group w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-yellow-500/60 hover:ring-yellow-500 transition-all disabled:opacity-40"
                        title="Run Training"
                    >
                        {isRunning ? (
                            <Loader2 className="w-4 h-4 text-yellow-400 animate-spin" />
                        ) : (
                            <Play className="w-4 h-4 text-yellow-400 group-hover:text-yellow-500 transition-colors" />
                        )}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            {isRunning ? 'Training...' : 'Train'}
                        </span>
                    </motion.button>

                    {/* AutoML */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onAutoML}
                        disabled={isAutoMLRunning || !datasetUploaded}
                        className="relative group w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-emerald-500/60 hover:ring-emerald-400 transition-all disabled:opacity-40"
                        title="AutoML"
                    >
                        {isAutoMLRunning ? (
                            <Loader2 className="w-4 h-4 text-emerald-400 animate-spin" />
                        ) : (
                            <Zap className="w-4 h-4 text-emerald-400" />
                        )}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            AutoML
                        </span>
                    </motion.button>

                    {/* Deploy */}
                    <motion.button
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={onDeploy}
                        disabled={!hasActiveJob || isRunning || isDeploying}
                        className="relative group w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-red-500/60 hover:ring-red-400 transition-all"
                        title="Deploy"
                    >
                        {isDeploying ? (
                            <Loader2 className="w-4 h-4 text-red-400 animate-spin" />
                        ) : (
                            <Rocket className="w-4 h-4 text-red-400" />
                        )}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                            Deploy
                        </span>
                    </motion.button>

                    {/* Reset Dataset */}
                    {datasetUploaded && (
                        <motion.button
                            whileHover={{ scale: 1.05 }}
                            whileTap={{ scale: 0.95 }}
                            onClick={onResetDataset}
                            className="relative group w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-blue-500/60 hover:ring-blue-400 transition-all"
                            title="Reset Dataset"
                        >
                            <svg className="w-4 h-4 text-blue-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                                <path d="M21 3v5h-5" />
                            </svg>
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/90 text-white text-[9px] rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">
                                Reset
                            </span>
                        </motion.button>
                    )}

                    {/* Separator */}
                    <div className="w-px h-6 bg-white/10" />

                    {/* Profile Avatar */}
                    <Link href="/profile" className="group relative ring-2 rounded-full  ring-white/60 hover:ring-white/80 transition-all">
                        {userAvatar ? (
                            <img
                                src={userAvatar}
                                alt="Profile"
                                className="w-9 h-9 rounded-full object-cover ring-2 ring-white/20 group-hover:ring-white/40 transition-all"
                                style={{ boxShadow: `0 0 15px ${themeColor}40` }}
                            />
                        ) : (
                            <div
                                className="w-9 h-9 rounded-full flex items-center justify-center ring-2 ring-white/20 group-hover:ring-white/40 transition-all"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, #8B5CF6)`,
                                    boxShadow: `0 0 15px ${themeColor}40`
                                }}
                            >
                                {userEmail ? (
                                    <span className="text-white font-bold text-sm">{userEmail[0].toUpperCase()}</span>
                                ) : (
                                    <User className="w-5 h-5 text-white" />
                                )}
                            </div>
                        )}
                    </Link>
                </div>
            </div>
        </GlassCard>
    );
};

export default StudioHeader;
