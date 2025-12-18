"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Rocket, Code2, GitCompare, ShieldAlert, ShieldCheck, AlertCircle, Sparkles, Zap, Copy, Check, FileCode, Save, TrendingUp, Settings, Database } from "lucide-react";
import { useThemeColor } from "@/context/theme-context";
import DiffViewer from "./DiffViewer";

interface SecurityWarning {
    pattern: string;
    severity: 'low' | 'medium' | 'high';
    message: string;
}

interface SuggestionPanelProps {
    isOpen: boolean;
    onClose: () => void;
    suggestion: {
        id: string;
        text: string;
        extractedCode: string;
        createdAt?: string;
        targetScriptVersion?: number | null;
        summary?: {
            changes: Array<{
                type: string;
                title: string;
                description: string;
                severity: string;
            }>;
            notImplemented: string[];
        } | null;
        sanitization?: {
            safe: boolean;
            warnings: SecurityWarning[];
            blockers: Array<{ pattern: string; message: string }>;
        };
    } | null;
    currentScript: string;
    currentScriptVersion?: number;
    onApply: (mergedCode: string) => void;
    onRetrain: (mergedCode: string) => void;
    loading?: boolean;
}

export function SuggestionPanel({
    isOpen,
    onClose,
    suggestion,
    currentScript,
    currentScriptVersion,
    onApply,
    onRetrain,
    loading = false
}: SuggestionPanelProps) {
    const { themeColor } = useThemeColor();
    const [activeTab, setActiveTab] = useState<'suggestion' | 'diff' | 'summary'>('suggestion');
    const [copied, setCopied] = useState(false);

    // Check for version mismatch
    const hasVersionMismatch = suggestion?.targetScriptVersion &&
        currentScriptVersion &&
        suggestion.targetScriptVersion !== currentScriptVersion;

    // ALWAYS replace code - clean and return the extracted code
    const getCleanCode = () => {
        // Use extractedCode if available, otherwise use text field from Firebase
        const rawCode = suggestion?.extractedCode || suggestion?.text || '';

        if (!rawCode) return currentScript;

        // Clean artifacts - remove comment header lines
        const cleanCode = rawCode
            .replace(/^#\s*Full Python script here\.+\s*$/gm, '')
            .replace(/^#\s*based on this suggestion.*$/gm, '')
            .trim();

        return cleanCode;
    };

    const cleanCode = getCleanCode();

    const copyCode = async () => {
        if (cleanCode) {
            await navigator.clipboard.writeText(cleanCode);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        }
    };

    const tabs = [
        { id: 'suggestion', label: 'AI Suggestion', icon: Sparkles },
        { id: 'diff', label: 'Preview Changes', icon: GitCompare },
        { id: 'summary', label: 'Summary', icon: FileCode }
    ] as const;

    if (!isOpen || !suggestion) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-end p-4"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                {/* Lighter Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 backdrop-blur-sm"
                    style={{
                        background: `radial-gradient(circle at center, ${themeColor}08, transparent 70%), linear-gradient(135deg, rgba(0,0,0,0.3), rgba(0,0,0,0.4))`
                    }}
                    onClick={onClose}
                />

                {/* Panel - Compact Glassmorphic Design */}
                <motion.div
                    initial={{ opacity: 0, x: 100, scale: 0.96, rotateY: -10 }}
                    animate={{ opacity: 1, x: 0, scale: 1, rotateY: 0 }}
                    exit={{ opacity: 0, x: 100, scale: 0.96, rotateY: -10 }}
                    transition={{ type: "spring", damping: 25, stiffness: 250 }}
                    className="relative w-full max-w-3xl h-[85vh] rounded-3xl overflow-hidden"
                    style={{
                        background: `linear-gradient(135deg, 
                            rgba(255,255,255,0.10) 0%, 
                            rgba(255,255,255,0.06) 50%, 
                            rgba(255,255,255,0.04) 100%)`,
                        border: `1px solid ${themeColor}35`,
                        backdropFilter: 'blur(40px) saturate(150%)',
                        boxShadow: `
                            0 25px 70px -15px rgba(0,0,0,0.6), 
                            0 0 80px ${themeColor}15,
                            inset 0 1px 0 rgba(255,255,255,0.12),
                            inset 0 -1px 0 rgba(0,0,0,0.2)`
                    }}
                >
                    {/* Animated Background Pattern */}
                    <div className="absolute inset-0 opacity-5">
                        <div className="absolute inset-0" style={{
                            backgroundImage: `repeating-linear-gradient(
                                0deg,
                                ${themeColor}40 0px,
                                transparent 1px,
                                transparent 40px
                            ),
                            repeating-linear-gradient(
                                90deg,
                                ${themeColor}40 0px,
                                transparent 1px,
                                transparent 40px
                            )`
                        }} />
                    </div>

                    {/* Custom Scrollbar Styles */}
                    <style dangerouslySetInnerHTML={{
                        __html: `
                        .suggestion-panel-scroll::-webkit-scrollbar {
                            width: 5px;
                            height: 5px;
                        }
                        .suggestion-panel-scroll::-webkit-scrollbar-track {
                            background: rgba(0, 0, 0, 0.2);
                            border-radius: 10px;
                        }
                        .suggestion-panel-scroll::-webkit-scrollbar-thumb {
                            background: linear-gradient(180deg, ${themeColor}80, ${themeColor}40);
                            border-radius: 10px;
                        }
                        .suggestion-panel-scroll::-webkit-scrollbar-thumb:hover {
                            background: linear-gradient(180deg, ${themeColor}, ${themeColor}80);
                        }
                    `}} />

                    {/* Header - Compact Design */}
                    <div
                        className="relative px-6 py-4 border-b backdrop-blur-2xl"
                        style={{
                            borderColor: `${themeColor}25`,
                            background: `linear-gradient(to bottom, 
                                rgba(0,0,0,0.4) 0%, 
                                rgba(0,0,0,0.2) 100%)`
                        }}
                    >
                        {/* Macbook Traffic Lights - Compact */}
                        <div className="absolute left-6 top-5 flex items-center gap-2">
                            <motion.div
                                whileHover={{ scale: 1.2 }}
                                className="w-3 h-3 rounded-full bg-[#FF5F57] shadow-lg cursor-pointer"
                                onClick={onClose}
                                style={{ boxShadow: '0 0 6px rgba(255,95,87,0.5)' }}
                            />
                            <motion.div
                                whileHover={{ scale: 1.2 }}
                                className="w-3 h-3 rounded-full bg-[#FEBC2E] shadow-lg cursor-pointer"
                                style={{ boxShadow: '0 0 6px rgba(254,188,46,0.5)' }}
                            />
                            <motion.div
                                whileHover={{ scale: 1.2 }}
                                className="w-3 h-3 rounded-full bg-[#28C840] shadow-lg cursor-pointer"
                                style={{ boxShadow: '0 0 6px rgba(40,200,64,0.5)' }}
                            />
                        </div>

                        {/* Close Button - Glass Style */}
                        <button
                            onClick={onClose}
                            className="absolute right-6 top-5 p-2 rounded-xl backdrop-blur-xl transition-all active:scale-95 hover:rotate-90"
                            style={{
                                background: 'rgba(255,255,255,0.05)',
                                border: '1px solid rgba(255,255,255,0.1)'
                            }}
                        >
                            <X className="w-4 h-4 text-white/70 hover:text-white" />
                        </button>

                        {/* Centered Title Section - Compact */}
                        <div className="flex flex-col items-center gap-3 mb-4">
                            <div
                                className="w-12 h-12 rounded-xl flex items-center justify-center relative overflow-hidden"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}50, ${themeColor}30)`,
                                    border: `1px solid ${themeColor}70`,
                                    boxShadow: `0 6px 20px ${themeColor}30`
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent" />
                                <Sparkles className="w-6 h-6 text-white relative z-10" />
                            </div>
                            <h3 className="text-lg font-bold text-white tracking-tight">
                                AI Code Enhancement
                            </h3>
                        </div>

                        {/* Compact Tabs */}
                        <div className="flex items-center justify-center gap-2">
                            {tabs.map((tab, idx) => (
                                <motion.button
                                    key={tab.id}
                                    initial={{ opacity: 0, y: -10 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    transition={{ delay: idx * 0.1 }}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`relative flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-bold transition-all overflow-hidden ${activeTab === tab.id
                                        ? 'text-white'
                                        : 'text-white/40 hover:text-white/70'
                                        }`}
                                    style={activeTab === tab.id ? {
                                        background: `linear-gradient(135deg, ${themeColor}50, ${themeColor}30)`,
                                        boxShadow: `0 4px 20px ${themeColor}30, inset 0 1px 0 rgba(255,255,255,0.2)`,
                                        border: `1px solid ${themeColor}60`
                                    } : {
                                        background: 'rgba(255,255,255,0.03)',
                                        border: '1px solid rgba(255,255,255,0.08)'
                                    }}
                                >
                                    {activeTab === tab.id && (
                                        <motion.div
                                            layoutId="activeTab"
                                            className="absolute inset-0 bg-gradient-to-r from-white/10 via-white/5 to-white/10"
                                            transition={{ type: "spring", bounce: 0.2, duration: 0.6 }}
                                        />
                                    )}
                                    <tab.icon className="w-3.5 h-3.5 relative z-10" />
                                    <span className="relative z-10">{tab.label}</span>
                                </motion.button>
                            ))}
                        </div>
                    </div>

                    {/* Content Area - More Space */}
                    <div className="flex-1 overflow-y-auto suggestion-panel-scroll" style={{ height: 'calc(85vh - 220px)' }}>
                        <div className="p-6 space-y-4">
                            {activeTab === 'suggestion' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-4"
                                >
                                    {/* Version Mismatch Warning */}
                                    {hasVersionMismatch && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="rounded-xl p-4 border backdrop-blur-xl"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(251, 146, 60, 0.15), rgba(251, 146, 60, 0.08))',
                                                borderColor: 'rgba(251, 146, 60, 0.4)',
                                                boxShadow: '0 6px 25px rgba(251, 146, 60, 0.1)'
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-2">
                                                <div className="p-1.5 rounded-lg bg-orange-500/20">
                                                    <AlertCircle className="w-4 h-4 text-orange-400" />
                                                </div>
                                                <span className="text-xs font-bold text-orange-300">Version Mismatch</span>
                                            </div>
                                            <p className="text-xs text-orange-200/80 ml-8">
                                                Targets <strong>v{suggestion.targetScriptVersion}</strong>, editing <strong>v{currentScriptVersion}</strong>.
                                            </p>
                                        </motion.div>
                                    )}

                                    {/* Security Warnings */}
                                    {suggestion.sanitization && !suggestion.sanitization.safe && (
                                        <motion.div
                                            initial={{ opacity: 0, x: -20 }}
                                            animate={{ opacity: 1, x: 0 }}
                                            className="rounded-xl p-4 border backdrop-blur-xl"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15), rgba(239, 68, 68, 0.08))',
                                                borderColor: 'rgba(239, 68, 68, 0.4)',
                                                boxShadow: '0 6px 25px rgba(239, 68, 68, 0.1)'
                                            }}
                                        >
                                            <div className="flex items-center gap-2 mb-3">
                                                <div className="p-1.5 rounded-lg bg-red-500/20">
                                                    <ShieldAlert className="w-4 h-4 text-red-400" />
                                                </div>
                                                <span className="text-xs font-bold text-red-300">Security Notice</span>
                                            </div>
                                            {suggestion.sanitization.blockers.map((blocker, i) => (
                                                <div key={i} className="flex items-start gap-2 text-xs text-red-200/80 mb-1 ml-8">
                                                    <span className="text-red-400 font-bold">⚠</span>
                                                    <span>{blocker.message}</span>
                                                </div>
                                            ))}
                                        </motion.div>
                                    )}

                                    {/* Security Badge - Center Aligned */}
                                    {suggestion.sanitization?.safe && (
                                        <motion.div
                                            initial={{ opacity: 0, scale: 0.95 }}
                                            animate={{ opacity: 1, scale: 1 }}
                                            className="rounded-xl p-3 border backdrop-blur-xl flex items-center justify-center gap-2"
                                            style={{
                                                background: 'linear-gradient(135deg, rgba(34, 197, 94, 0.15), rgba(34, 197, 94, 0.08))',
                                                borderColor: 'rgba(34, 197, 94, 0.4)',
                                                boxShadow: '0 6px 25px rgba(34, 197, 94, 0.1)'
                                            }}
                                        >
                                            <div className="p-1.5 rounded-lg bg-green-500/20">
                                                <ShieldCheck className="w-3.5 h-3.5 text-green-400" />
                                            </div>
                                            <span className="text-xs text-green-300 font-medium">Code verified and safe to apply</span>
                                        </motion.div>
                                    )}

                                    {/* Terminal-Style Code Display */}
                                    {(suggestion.extractedCode || suggestion.text) && (
                                        <motion.div
                                            initial={{ opacity: 0, y: 20 }}
                                            animate={{ opacity: 1, y: 0 }}
                                            className="rounded-xl overflow-hidden border relative group"
                                            style={{
                                                background: 'rgba(0,0,0,0.5)',
                                                borderColor: `${themeColor}30`,
                                                boxShadow: `0 10px 35px rgba(0,0,0,0.4), 0 0 50px ${themeColor}08`
                                            }}
                                        >
                                            {/* Mac Terminal Header */}
                                            <div className="flex items-center justify-between px-4 py-2.5 bg-[#1a1a1a] border-b border-white/5">
                                                <div className="flex items-center gap-2.5">
                                                    <div className="flex items-center gap-1.5">
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#FF5F57]" style={{ boxShadow: '0 0 5px rgba(255,95,87,0.4)' }} />
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#FEBC2E]" style={{ boxShadow: '0 0 5px rgba(254,188,46,0.4)' }} />
                                                        <div className="w-2.5 h-2.5 rounded-full bg-[#28C840]" style={{ boxShadow: '0 0 5px rgba(40,200,64,0.4)' }} />
                                                    </div>
                                                    <div className="flex items-center gap-2">
                                                        <Code2 className="w-3.5 h-3.5 text-white/40" />
                                                        <span className="text-white/60 text-xs font-mono">suggestion.py</span>
                                                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-white/5">
                                                            <Zap className="w-2.5 h-2.5" style={{ color: themeColor }} />
                                                            <span className="text-[10px] font-mono font-bold" style={{ color: themeColor }}>python</span>
                                                        </div>
                                                    </div>
                                                </div>

                                                {/* Copy Button */}
                                                <button
                                                    onClick={copyCode}
                                                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                                                >
                                                    {copied ? (
                                                        <>
                                                            <Check className="w-3 h-3 text-green-400" />
                                                            <span className="text-[10px] text-green-400 font-medium">Copied</span>
                                                        </>
                                                    ) : (
                                                        <>
                                                            <Copy className="w-3 h-3 text-white/60" />
                                                            <span className="text-[10px] text-white/60 font-medium">Copy</span>
                                                        </>
                                                    )}
                                                </button>
                                            </div>

                                            {/* Code Content with Proper Syntax Highlighting */}
                                            <div className="p-5 overflow-x-auto suggestion-panel-scroll max-h-80 bg-gradient-to-br from-[#0d0d0d] to-[#1a1a1a]">
                                                <pre className="text-sm font-mono leading-relaxed">
                                                    {cleanCode.split('\n').map((line, i) => {
                                                        const keywords = ['import', 'from', 'as', 'def', 'class', 'if', 'else', 'elif', 'for', 'while', 'return', 'try', 'except', 'finally', 'with', 'lambda', 'yield', 'async', 'await', 'in', 'is', 'not', 'and', 'or'];

                                                        // Split line into tokens
                                                        const tokens = line.split(/(\s+|[()[\]{},.:;=+\-*/<>!&|])/);

                                                        return (
                                                            <div key={i}>
                                                                {tokens.map((token, j) => {
                                                                    // Keywords
                                                                    if (keywords.includes(token.trim())) {
                                                                        return <span key={j} style={{ color: '#C586C0' }}>{token}</span>;
                                                                    }
                                                                    // Strings
                                                                    if (/^['"].*['"]$/.test(token.trim())) {
                                                                        return <span key={j} style={{ color: '#CE9178' }}>{token}</span>;
                                                                    }
                                                                    // Comments
                                                                    if (token.trim().startsWith('#')) {
                                                                        // Rest of line is comment
                                                                        const restOfLine = tokens.slice(j).join('');
                                                                        return <span key={j} style={{ color: '#6A9955' }}>{restOfLine}</span>;
                                                                    }
                                                                    // Numbers
                                                                    if (/^\d+\.?\d*$/.test(token.trim())) {
                                                                        return <span key={j} style={{ color: '#B5CEA8' }}>{token}</span>;
                                                                    }
                                                                    // Default
                                                                    return <span key={j} style={{ color: '#D4D4D4' }}>{token}</span>;
                                                                })}
                                                            </div>
                                                        );
                                                    })}
                                                </pre>
                                            </div>
                                        </motion.div>
                                    )}
                                </motion.div>
                            )}

                            {activeTab === 'diff' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                >
                                    <DiffViewer
                                        originalCode={currentScript || ""}
                                        modifiedCode={cleanCode}
                                        diffs={[]} // DiffViewer generates its own diffs internally
                                        title="Code Changes"
                                        collapsible={false}
                                    />
                                </motion.div>
                            )}

                            {activeTab === 'summary' && (
                                <motion.div
                                    initial={{ opacity: 0, y: 20 }}
                                    animate={{ opacity: 1, y: 0 }}
                                    className="space-y-6"
                                >
                                    {suggestion.summary ? (
                                        <>
                                            {/* Changes Section */}
                                            {suggestion.summary.changes && suggestion.summary.changes.length > 0 && (
                                                <div className="space-y-4">
                                                    <h3 className="text-center text-xl font-bold flex items-center justify-center gap-3 mb-6"
                                                        style={{ color: themeColor }}>
                                                        <TrendingUp className="w-6 h-6" />
                                                        Changes Made
                                                    </h3>

                                                    <div className="space-y-4 max-w-2xl mx-auto">
                                                        {suggestion.summary.changes.map((change, idx) => {
                                                            const getIcon = () => {
                                                                switch (change.type) {
                                                                    case 'algorithm': return TrendingUp;
                                                                    case 'preprocessing': return Database;
                                                                    case 'hyperparameter': return Settings;
                                                                    case 'evaluation': return Sparkles;
                                                                    default: return Zap;
                                                                }
                                                            };
                                                            const Icon = getIcon();
                                                            const severityColor = change.severity === 'high' ? themeColor :
                                                                change.severity === 'medium' ? 'rgba(251, 146, 60, 0.8)' :
                                                                    'rgba(156, 163, 175, 0.8)';

                                                            return (
                                                                <motion.div
                                                                    key={idx}
                                                                    initial={{ opacity: 0, y: 20 }}
                                                                    animate={{ opacity: 1, y: 0 }}
                                                                    transition={{ delay: idx * 0.1 }}
                                                                    className="rounded-2xl p-6 border backdrop-blur-xl text-center"
                                                                    style={{
                                                                        background: `linear-gradient(135deg, ${severityColor}18, ${severityColor}08)`,
                                                                        borderColor: `${severityColor}40`,
                                                                        boxShadow: `0 8px 25px ${severityColor}15`
                                                                    }}
                                                                >
                                                                    {/* Numbered badge */}
                                                                    <div className="flex items-center justify-center gap-3 mb-4">
                                                                        <div className="w-8 h-8 rounded-full flex items-center justify-center text-white font-bold text-sm"
                                                                            style={{ background: severityColor }}>
                                                                            {idx + 1}
                                                                        </div>
                                                                        <div className="p-2.5 rounded-xl"
                                                                            style={{
                                                                                background: `${severityColor}25`,
                                                                                boxShadow: `0 0 20px ${severityColor}20`
                                                                            }}>
                                                                            <Icon className="w-5 h-5" style={{ color: severityColor }} />
                                                                        </div>
                                                                    </div>

                                                                    <h4 className="font-bold text-white mb-3 text-lg">{change.title}</h4>
                                                                    <p className="text-white/70 text-sm leading-relaxed mx-auto max-w-md">{change.description}</p>

                                                                    {/* Severity badge */}
                                                                    <div className="mt-4 flex justify-center">
                                                                        <span className="text-xs px-3 py-1 rounded-full font-medium"
                                                                            style={{
                                                                                background: `${severityColor}20`,
                                                                                color: severityColor,
                                                                                border: `1px solid ${severityColor}30`
                                                                            }}>
                                                                            {change.severity === 'high' ? '🔥 High Impact' :
                                                                                change.severity === 'medium' ? '⚡ Medium Impact' : '✨ Enhancement'}
                                                                        </span>
                                                                    </div>
                                                                </motion.div>
                                                            );
                                                        })}
                                                    </div>
                                                </div>
                                            )}

                                            {/* Not Implemented Section */}
                                            {suggestion.summary.notImplemented && suggestion.summary.notImplemented.length > 0 && (
                                                <div className="space-y-3">
                                                    <h3 className="text-center text-lg font-bold flex items-center justify-center gap-2 text-white/60">
                                                        <AlertCircle className="w-5 h-5" />
                                                        Not Yet Implemented
                                                    </h3>

                                                    {suggestion.summary.notImplemented.map((item, idx) => (
                                                        <motion.div
                                                            key={idx}
                                                            initial={{ opacity: 0 }}
                                                            animate={{ opacity: 1 }}
                                                            transition={{ delay: 0.5 + idx * 0.1 }}
                                                            className="rounded-lg p-4 text-center border border-white/10"
                                                            style={{
                                                                background: 'rgba(255, 255, 255, 0.03)'
                                                            }}
                                                        >
                                                            <p className="text-white/50 text-sm">{item}</p>
                                                        </motion.div>
                                                    ))}
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="text-center py-12 text-white/40">
                                            <FileCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                            <p className="text-sm">No summary available for this suggestion</p>
                                        </div>
                                    )}
                                </motion.div>
                            )}
                        </div>
                    </div>

                    {/* Footer - Enhanced Blur */}
                    <div
                        className="absolute bottom-0 left-0 right-0 px-6 py-5 border-t backdrop-blur-2xl"
                        style={{
                            borderColor: `${themeColor}25`,
                            background: `linear-gradient(to top, 
                                rgba(0,0,0,0.95) 0%, 
                                rgba(0,0,0,0.85) 50%,
                                rgba(0,0,0,0.6) 100%)`
                        }}
                    >
                        <div className="flex items-center justify-between gap-3">
                            <button
                                onClick={onClose}
                                className="px-5 py-2.5 rounded-xl text-sm font-semibold text-white/60 hover:text-white transition-all backdrop-blur-xl border border-white/10 hover:bg-white/5"
                            >
                                Cancel
                            </button>

                            <motion.button
                                whileHover={{ scale: 1.05 }}
                                whileTap={{ scale: 0.98 }}
                                onClick={() => onApply(cleanCode)}
                                disabled={loading || (!suggestion.extractedCode && !suggestion.text)}
                                className="px-8 py-2.5 rounded-xl text-sm font-black text-white transition-all disabled:opacity-50 shadow-xl group relative overflow-hidden flex items-center gap-2"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}, ${themeColor}dd)`,
                                    boxShadow: `0 8px 30px ${themeColor}50, inset 0 1px 0 rgba(255,255,255,0.2)`
                                }}
                            >
                                <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/30 to-white/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-700" />
                                <FileCode className="w-4 h-4 relative z-10" />
                                <span className="relative z-10">Apply to Editor</span>
                            </motion.button>
                        </div>
                    </div>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default SuggestionPanel;
