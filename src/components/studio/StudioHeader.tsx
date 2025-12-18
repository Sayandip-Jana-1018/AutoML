'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, Edit3, Check, X, Loader2, Play, Zap, Rocket, User, RefreshCw, Share2, Github, FileDown, FileUp, Code2, MoreHorizontal, ChevronDown, Pencil } from 'lucide-react';
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
    trainingStatus?: string; // Current training step status
    trainingStep?: string;   // Current step name
    onSaveName: (name: string) => Promise<void>;
    onRunTraining: () => void;
    onAutoML: () => void;
    onDeploy: () => void;
    onResetDataset: () => void;
    onSyncStatus?: () => void;
    isSyncing?: boolean;
    onShare?: () => void;
    onGitHubPush?: () => void;
    onExportNotebook?: () => void;
    onImportNotebook?: () => void;
    onOpenVSCode?: () => void;
    isConnectingVSCode?: boolean;
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
    trainingStatus,
    trainingStep,
    onSaveName,
    onRunTraining,
    onAutoML,
    onDeploy,
    onResetDataset,
    onSyncStatus,
    isSyncing = false,
    onShare,
    onGitHubPush,
    onExportNotebook,
    onImportNotebook,
    onOpenVSCode,
    isConnectingVSCode = false
}: StudioHeaderProps) => {
    const [isEditingName, setIsEditingName] = useState(false);
    const [editedName, setEditedName] = useState(projectName);
    const [savingName, setSavingName] = useState(false);
    const [showMoreMenu, setShowMoreMenu] = useState(false);

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
        <GlassCard className="mx-auto max-w-7xl mb-6 md:mb-4 px-2 md:px-6 py-2 md:py-4 relative z-[60]" hover={false}>
            {/* Desktop Layout */}
            <div className="hidden lg:grid grid-cols-[auto_1fr_auto] items-center gap-6">
                {/* LEFT: Back + Project Name */}
                <div className="flex items-center gap-4">
                    <Link href="/profile" className="text-black/40 dark:text-white/40 hover:text-black dark:hover:text-white transition-colors">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    <div>
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
                                <button onClick={handleUpdateProjectName} disabled={savingName} className="p-1 rounded hover:bg-white/10 transition-colors" style={{ color: themeColor }}>
                                    {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                                </button>
                                <button onClick={() => setIsEditingName(false)} className="p-1 rounded hover:bg-white/10 text-red-400 transition-colors">
                                    <X className="w-4 h-4" />
                                </button>
                            </div>
                        ) : (
                            <div className="flex items-center gap-2 group">
                                <h1 className="font-bold text-xl cursor-pointer transition-colors" style={{ color: themeColor }} onClick={() => { setEditedName(projectName); setIsEditingName(true); }}>
                                    {projectName}
                                </h1>
                                <Edit3 className="w-4 h-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer" style={{ color: themeColor }} onClick={() => { setEditedName(projectName); setIsEditingName(true); }} />
                            </div>
                        )}
                        <span className="text-[10px] font-mono text-black/40 dark:text-white/40">{projectId}</span>
                    </div>
                </div>

                {/* CENTER: Glassmorphic Action Buttons */}
                <div className="flex items-center justify-center gap-2">
                    {/* Train Button - Gold icon */}
                    <motion.button
                        whileHover={{ scale: 1.08, y: -3 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        onClick={onRunTraining}
                        disabled={isRunning || isDeploying}
                        className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 disabled:opacity-40"
                        style={{
                            background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                            boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                        }}
                        title="Run Training"
                    >
                        {isRunning ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#fbbf24', filter: 'drop-shadow(0 2px 4px rgba(251,191,36,0.5))' }} /> : <Play className="w-5 h-5" style={{ color: '#fbbf24', filter: 'drop-shadow(0 2px 4px rgba(251,191,36,0.5))' }} />}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Train</span>
                    </motion.button>

                    {/* AutoML Button - Purple icon */}
                    <motion.button
                        whileHover={{ scale: 1.08, y: -3 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        onClick={onAutoML}
                        disabled={isAutoMLRunning || !datasetUploaded}
                        className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 disabled:opacity-40"
                        style={{
                            background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                            boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                        }}
                        title="AutoML"
                    >
                        {isAutoMLRunning ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#a855f7', filter: 'drop-shadow(0 2px 4px rgba(168,85,247,0.5))' }} /> : <Zap className="w-5 h-5" style={{ color: '#a855f7', filter: 'drop-shadow(0 2px 4px rgba(168,85,247,0.5))' }} />}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">AutoML</span>
                    </motion.button>

                    {/* Deploy Button - Rose/Red icon */}
                    <motion.button
                        whileHover={{ scale: 1.08, y: -3 }}
                        whileTap={{ scale: 0.95 }}
                        transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                        onClick={onDeploy}
                        disabled={!hasActiveJob || isRunning || isDeploying}
                        className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 disabled:opacity-40"
                        style={{
                            background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                            boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                        }}
                        title="Deploy"
                    >
                        {isDeploying ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#f43f5e', filter: 'drop-shadow(0 2px 4px rgba(244,63,94,0.5))' }} /> : <Rocket className="w-5 h-5" style={{ color: '#f43f5e', filter: 'drop-shadow(0 2px 4px rgba(244,63,94,0.5))' }} />}
                        <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Deploy</span>
                    </motion.button>

                    {/* Share Button - Emerald/Green icon */}
                    {onShare && (
                        <motion.button
                            whileHover={{ scale: 1.08, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            onClick={onShare}
                            className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                                boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            }}
                            title="Share Project"
                        >
                            <Share2 className="w-5 h-5" style={{ color: '#10b981', filter: 'drop-shadow(0 2px 4px rgba(16,185,129,0.5))' }} />
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Share</span>
                        </motion.button>
                    )}

                    {/* Separator */}
                    <div className="w-px h-6 bg-white/10 mx-1" />

                    {/* GitHub Button - Slate/White icon */}
                    {onGitHubPush && (
                        <motion.button
                            whileHover={{ scale: 1.08, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            onClick={onGitHubPush}
                            className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                                boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            }}
                            title="Push to GitHub"
                        >
                            <Github className="w-5 h-5" style={{ color: '#e879f9', filter: 'drop-shadow(0 2px 4px rgba(232,121,249,0.5))' }} />
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">GitHub</span>
                        </motion.button>
                    )}

                    {/* VS Code Button - Blue icon */}
                    {onOpenVSCode && (
                        <motion.button
                            whileHover={{ scale: 1.08, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            onClick={onOpenVSCode}
                            disabled={isConnectingVSCode}
                            className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20 disabled:opacity-50"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                                boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            }}
                            title="Open in VS Code"
                        >
                            {isConnectingVSCode ? <Loader2 className="w-5 h-5 animate-spin" style={{ color: '#3b82f6', filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.5))' }} /> : <Code2 className="w-5 h-5" style={{ color: '#3b82f6', filter: 'drop-shadow(0 2px 4px rgba(59,130,246,0.5))' }} />}
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">VS Code</span>
                        </motion.button>
                    )}

                    {/* Import Button - Orange icon */}
                    {onImportNotebook && (
                        <motion.button
                            whileHover={{ scale: 1.08, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            onClick={onImportNotebook}
                            className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                                boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            }}
                            title="Import Notebook"
                        >
                            <FileDown className="w-5 h-5" style={{ color: '#f97316', filter: 'drop-shadow(0 2px 4px rgba(249,115,22,0.5))' }} />
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Import</span>
                        </motion.button>
                    )}

                    {/* Reset Button - Cyan icon */}
                    {datasetUploaded && (
                        <motion.button
                            whileHover={{ scale: 1.08, y: -3 }}
                            whileTap={{ scale: 0.95 }}
                            transition={{ type: 'spring', stiffness: 300, damping: 20 }}
                            onClick={onResetDataset}
                            className="relative group w-11 h-11 rounded-full flex items-center justify-center backdrop-blur-md border border-white/20"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                                boxShadow: `0 4px 20px ${themeColor}25, inset 0 1px 0 rgba(255,255,255,0.1)`
                            }}
                            title="Reset Dataset"
                        >
                            <RefreshCw className="w-5 h-5" style={{ color: '#06b6d4', filter: 'drop-shadow(0 2px 4px rgba(6,182,212,0.5))' }} />
                            <span className="absolute -bottom-7 left-1/2 -translate-x-1/2 px-2 py-0.5 bg-black/80 text-white text-[9px] font-medium rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-50">Reset</span>
                        </motion.button>
                    )}
                </div>

                {/* RIGHT: Ready Status + Profile */}
                <div className="flex items-center gap-4">
                    {/* Ready Status Pill */}
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
                        <span className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        <span className="text-xs font-medium text-emerald-400">Ready</span>
                    </div>

                    {/* Profile Avatar */}
                    <Link href="/profile" className="group relative">
                        {userAvatar ? (
                            <img
                                src={userAvatar}
                                alt="Profile"
                                className="w-10 h-10 rounded-full object-cover ring-2 ring-white/30 group-hover:ring-white/50 transition-all"
                                style={{ boxShadow: `0 4px 15px ${themeColor}40` }}
                            />
                        ) : (
                            <div
                                className="w-10 h-10 rounded-full flex items-center justify-center ring-2 ring-white/30 group-hover:ring-white/50 transition-all"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, #8B5CF6)`,
                                    boxShadow: `0 4px 15px ${themeColor}40`
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

            {/* Mobile/Tablet Layout */}
            <div className="lg:hidden flex items-center justify-between gap-3">
                {/* Left: Back + Name (inline editable) */}
                <div className="flex items-center gap-2 min-w-0 flex-1">
                    <Link href="/profile" className="text-white/40 hover:text-white transition-colors flex-shrink-0">
                        <ArrowLeft className="w-5 h-5" />
                    </Link>
                    {isEditingName ? (
                        <div className="flex items-center gap-1 flex-1 min-w-0">
                            <input
                                type="text"
                                value={editedName}
                                onChange={(e) => setEditedName(e.target.value)}
                                onKeyDown={(e) => {
                                    if (e.key === 'Enter') handleUpdateProjectName();
                                    if (e.key === 'Escape') setIsEditingName(false);
                                }}
                                autoFocus
                                className="flex-1 min-w-0 font-bold text-sm bg-transparent border-b-2 focus:outline-none text-white py-1"
                                style={{ borderColor: themeColor }}
                            />
                            <button onClick={handleUpdateProjectName} disabled={savingName} className="p-1.5 rounded-lg hover:bg-white/10 transition-colors" style={{ color: themeColor }}>
                                {savingName ? <Loader2 className="w-4 h-4 animate-spin" /> : <Check className="w-4 h-4" />}
                            </button>
                            <button onClick={() => setIsEditingName(false)} className="p-1.5 rounded-lg hover:bg-white/10 text-red-400 transition-colors">
                                <X className="w-4 h-4" />
                            </button>
                        </div>
                    ) : (
                        <>
                            <h1
                                className="font-bold text-base truncate"
                                style={{ color: themeColor }}
                                title={projectName}
                            >
                                {projectName}
                            </h1>
                            <button
                                onClick={() => { setEditedName(projectName); setIsEditingName(true); }}
                                className="flex-shrink-0 p-1 rounded-lg hover:bg-white/10 transition-colors"
                                title="Edit project name"
                            >
                                <Pencil className="w-3.5 h-3.5 text-white/40 hover:text-white/70" />
                            </button>
                        </>
                    )}
                </div>

                {/* Right: Key Actions */}
                <div className="flex items-center gap-2 flex-shrink-0">
                    {/* Run/Train Button - Primary */}
                    <motion.button
                        whileTap={{ scale: 0.95 }}
                        onClick={onRunTraining}
                        disabled={isRunning || isDeploying}
                        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold disabled:opacity-40"
                        style={{
                            background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                            color: themeColor,
                            border: `1px solid ${themeColor}40`
                        }}
                    >
                        {isRunning ? <Loader2 className="w-4 h-4 animate-spin" /> : <Play className="w-4 h-4" />}
                        <span className="hidden sm:inline">{isRunning ? 'Running...' : 'Run'}</span>
                    </motion.button>

                    {/* More Menu Button */}
                    <div className="relative z-[100]">
                        <motion.button
                            whileTap={{ scale: 0.95 }}
                            onClick={() => setShowMoreMenu(!showMoreMenu)}
                            className="w-10 h-10 rounded-xl flex items-center justify-center backdrop-blur-md border border-white/20"
                            style={{
                                background: `linear-gradient(145deg, ${themeColor}30, ${themeColor}15)`,
                            }}
                        >
                            <MoreHorizontal className="w-5 h-5 text-white/70" />
                        </motion.button>

                        {/* More Menu Dropdown */}
                        <AnimatePresence>
                            {showMoreMenu && (
                                <>
                                    {/* Backdrop */}
                                    <motion.div
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="fixed inset-0 z-40"
                                        onClick={() => setShowMoreMenu(false)}
                                    />
                                    {/* Menu */}
                                    <motion.div
                                        initial={{ opacity: 0, y: -10, scale: 0.95 }}
                                        animate={{ opacity: 1, y: 0, scale: 1 }}
                                        exit={{ opacity: 0, y: -10, scale: 0.95 }}
                                        className="absolute right-0 top-12 z-[100] w-56 bg-[#1a1a1a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
                                    >
                                        <div className="p-2 space-y-1">
                                            {/* AutoML */}
                                            <button
                                                onClick={() => { onAutoML(); setShowMoreMenu(false); }}
                                                disabled={isAutoMLRunning || !datasetUploaded}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
                                            >
                                                <Zap className="w-4 h-4 text-purple-400" />
                                                AutoML
                                            </button>
                                            {/* Deploy */}
                                            <button
                                                onClick={() => { onDeploy(); setShowMoreMenu(false); }}
                                                disabled={!hasActiveJob || isRunning || isDeploying}
                                                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
                                            >
                                                <Rocket className="w-4 h-4 text-rose-400" />
                                                Deploy
                                            </button>
                                            {/* Divider */}
                                            <div className="h-px bg-white/10 my-1" />
                                            {/* Share */}
                                            {onShare && (
                                                <button
                                                    onClick={() => { onShare(); setShowMoreMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 transition-colors"
                                                >
                                                    <Share2 className="w-4 h-4 text-emerald-400" />
                                                    Share Project
                                                </button>
                                            )}
                                            {/* GitHub */}
                                            {onGitHubPush && (
                                                <button
                                                    onClick={() => { onGitHubPush(); setShowMoreMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 transition-colors"
                                                >
                                                    <Github className="w-4 h-4 text-fuchsia-400" />
                                                    Push to GitHub
                                                </button>
                                            )}
                                            {/* VS Code */}
                                            {onOpenVSCode && (
                                                <button
                                                    onClick={() => { onOpenVSCode(); setShowMoreMenu(false); }}
                                                    disabled={isConnectingVSCode}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 disabled:opacity-40 transition-colors"
                                                >
                                                    <Code2 className="w-4 h-4 text-blue-400" />
                                                    Open in VS Code
                                                </button>
                                            )}
                                            {/* Import */}
                                            {onImportNotebook && (
                                                <button
                                                    onClick={() => { onImportNotebook(); setShowMoreMenu(false); }}
                                                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-white/80 hover:bg-white/10 transition-colors"
                                                >
                                                    <FileDown className="w-4 h-4 text-orange-400" />
                                                    Import Notebook
                                                </button>
                                            )}
                                            {/* Reset */}
                                            {datasetUploaded && (
                                                <>
                                                    <div className="h-px bg-white/10 my-1" />
                                                    <button
                                                        onClick={() => { onResetDataset(); setShowMoreMenu(false); }}
                                                        className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-red-400 hover:bg-red-500/10 transition-colors"
                                                    >
                                                        <RefreshCw className="w-4 h-4" />
                                                        Reset Dataset
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </motion.div>
                                </>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </GlassCard>
    );
};

export default StudioHeader;
