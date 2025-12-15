"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X, Rocket, Code2, GitCompare, History, Check, AlertTriangle, Loader2, ShieldAlert, ShieldCheck, AlertCircle } from "lucide-react";
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
        sanitization?: {
            safe: boolean;
            warnings: SecurityWarning[];
            blockers: Array<{ pattern: string; message: string }>;
        };
    } | null;
    currentScript: string;
    currentScriptVersion?: number; // Current version being edited
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
    const [activeTab, setActiveTab] = useState<'suggestion' | 'diff' | 'history'>('suggestion');

    // Check for version mismatch
    const hasVersionMismatch = suggestion?.targetScriptVersion &&
        currentScriptVersion &&
        suggestion.targetScriptVersion !== currentScriptVersion;
    const [showConfirm, setShowConfirm] = useState(false);
    const [editedCode, setEditedCode] = useState('');
    // Helper to determine if code should be replaced or appended

    // Helper to determine if code should be replaced or appended
    const getMergedCode = () => {
        if (!suggestion?.extractedCode) return currentScript;

        // Clean artifacts
        const cleanCode = editedCode || suggestion.extractedCode
            .replace(/^# Full Python script here\.\.\.\s*/i, '')
            .replace(/^# based on this suggestion.*\s*/i, '')
            .trim();

        // Simple heuristic: If it starts with imports or is very long, treat as replacement
        const isReplacement = cleanCode.startsWith('import ') ||
            cleanCode.startsWith('from ') ||
            cleanCode.length > (currentScript.length * 0.8);

        return isReplacement
            ? cleanCode
            : currentScript + '\n\n# === AI Improvement Suggestion ===\n' + cleanCode;
    };

    const handleApplyClick = () => {
        setShowConfirm(true);
    };

    const handleConfirmApply = () => {
        onApply(getMergedCode());
        setShowConfirm(false);
    };

    // Modified code for diff view
    const modifiedCodePreview = getMergedCode();

    const tabs = [
        { id: 'suggestion', label: 'Suggestion', icon: Code2 },
        { id: 'diff', label: 'Diff Preview', icon: GitCompare },
        { id: 'history', label: 'History', icon: History }
    ] as const;

    if (!isOpen || !suggestion) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-50 flex items-center justify-end p-2 sm:p-4 md:p-6"
                onClick={(e) => e.target === e.currentTarget && onClose()}
            >
                {/* Backdrop */}
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="absolute inset-0 bg-black/60 backdrop-blur-sm"
                    onClick={onClose}
                />

                {/* Panel */}
                <motion.div
                    initial={{ opacity: 0, x: 100, scale: 0.95 }}
                    animate={{ opacity: 1, x: 0, scale: 1 }}
                    exit={{ opacity: 0, x: 100, scale: 0.95 }}
                    transition={{ type: "spring", damping: 25, stiffness: 300 }}
                    className="relative w-full max-w-[95vw] sm:max-w-xl md:max-w-2xl h-[85vh] sm:h-[80vh] rounded-2xl sm:rounded-3xl overflow-hidden"
                    style={{
                        background: 'linear-gradient(135deg, rgba(255,255,255,0.08), rgba(255,255,255,0.02))',
                        border: '1px solid rgba(255,255,255,0.1)',
                        backdropFilter: 'blur(20px)',
                        boxShadow: `0 25px 50px -12px rgba(0,0,0,0.5), 0 0 40px ${themeColor}20`
                    }}
                >
                    {/* Header - Centered */}
                    <div
                        className="relative px-6 py-4 border-b flex items-center justify-center"
                        style={{ borderColor: 'rgba(255,255,255,0.1)' }}
                    >
                        <div className="text-center">
                            <div className="flex items-center justify-center gap-2 mb-1">
                                <Rocket className="w-5 h-5" style={{ color: themeColor }} />
                                <h3 className="text-lg font-bold text-white">AI Suggestion</h3>
                            </div>
                            <p className="text-xs text-white/40">
                                Review parameters and retrain your model
                            </p>
                        </div>

                        <button
                            onClick={onClose}
                            className="absolute right-6 top-1/2 -translate-y-1/2 p-2 rounded-xl hover:bg-white/10 transition-colors"
                        >
                            <X className="w-5 h-5 text-white/60" />
                        </button>
                    </div>

                    {/* Tabs - Centered */}
                    <div
                        className="flex items-center justify-center gap-2 px-6 py-3 border-b"
                        style={{ borderColor: 'rgba(255,255,255,0.05)' }}
                    >
                        {tabs.map(tab => (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                    ? 'text-white'
                                    : 'text-white/40 hover:text-white/70'
                                    }`}
                                style={activeTab === tab.id ? {
                                    background: `${themeColor}20`,
                                    color: themeColor
                                } : {}}
                            >
                                <tab.icon className="w-4 h-4" />
                                {tab.label}
                            </button>
                        ))}
                    </div>

                    {/* Content - Full Height with Bottom Padding for Footer */}
                    <div className="flex-1 overflow-y-auto p-6 pb-40 h-full">
                        {activeTab === 'suggestion' && (
                            <div className="space-y-4">
                                {/* Version Mismatch Warning */}
                                {hasVersionMismatch && (
                                    <div className="rounded-xl p-4 bg-orange-500/10 border border-orange-500/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertCircle className="w-5 h-5 text-orange-400" />
                                            <span className="text-sm font-bold text-orange-400">Version Mismatch</span>
                                        </div>
                                        <p className="text-sm text-orange-300/80">
                                            This suggestion was generated for <strong>Version {suggestion.targetScriptVersion}</strong>.
                                            You are editing <strong>Version {currentScriptVersion}</strong>.
                                        </p>
                                        <p className="text-xs text-orange-400/60 mt-2">
                                            The code may not apply correctly if versions differ significantly.
                                        </p>
                                    </div>
                                )}

                                {/* Security Warnings */}
                                {suggestion.sanitization && !suggestion.sanitization.safe && (
                                    <div className="rounded-xl p-4 bg-red-500/10 border border-red-500/30">
                                        <div className="flex items-center gap-2 mb-3">
                                            <ShieldAlert className="w-5 h-5 text-red-400" />
                                            <span className="text-sm font-bold text-red-400">Security Notice</span>
                                        </div>
                                        {suggestion.sanitization.blockers.map((blocker, i) => (
                                            <div key={i} className="flex items-start gap-2 text-sm text-red-300/80 mb-2">
                                                <span className="text-red-400">⚠</span>
                                                <span>{blocker.message}</span>
                                            </div>
                                        ))}
                                        <p className="text-xs text-red-400/60 mt-2">
                                            Review carefully before applying. These patterns may have unintended side effects.
                                        </p>
                                    </div>
                                )}

                                {suggestion.sanitization?.warnings && suggestion.sanitization.warnings.length > 0 && (
                                    <div className="rounded-xl p-4 bg-yellow-500/10 border border-yellow-500/30">
                                        <div className="flex items-center gap-2 mb-2">
                                            <AlertTriangle className="w-4 h-4 text-yellow-400" />
                                            <span className="text-sm font-medium text-yellow-400">Warnings</span>
                                        </div>
                                        {suggestion.sanitization.warnings.map((warning, i) => (
                                            <div key={i} className="text-xs text-yellow-300/70 mb-1">
                                                • {warning.message}
                                            </div>
                                        ))}
                                    </div>
                                )}

                                {suggestion.sanitization?.safe && (
                                    <div className="rounded-xl p-3 bg-green-500/10 border border-green-500/30 flex items-center gap-2">
                                        <ShieldCheck className="w-4 h-4 text-green-400" />
                                        <span className="text-sm text-green-400">Code looks safe to apply</span>
                                    </div>
                                )}

                                {/* Suggestion text - Full Display */}
                                <div className="text-sm text-white/60 leading-relaxed whitespace-pre-wrap">
                                    {suggestion.text}
                                </div>

                                {suggestion.extractedCode && (
                                    <div className="mt-4">
                                        <h4 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-2">
                                            Extracted Code
                                        </h4>
                                        <div
                                            className="rounded-xl p-4 font-mono text-sm overflow-x-auto max-h-[300px] overflow-y-auto"
                                            style={{
                                                background: 'rgba(0,0,0,0.3)',
                                                border: `1px solid ${themeColor}30`
                                            }}
                                        >
                                            <pre className="text-green-400 whitespace-pre-wrap">
                                                {suggestion.extractedCode}
                                            </pre>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                        {activeTab === 'diff' && (
                            <DiffViewer
                                originalCode={currentScript}
                                modifiedCode={modifiedCodePreview}
                                diffs={[]}
                                title="Changes Preview"
                                collapsible={false}
                            />
                        )}

                        {activeTab === 'history' && (
                            <div className="text-center text-white/40 py-8">
                                <History className="w-12 h-12 mx-auto mb-3 opacity-50" />
                                <p>Suggestion history will appear here</p>
                            </div>
                        )}
                    </div>

                    {/* Footer Actions - With Blur Overlay */}
                    <div
                        className="absolute bottom-0 left-0 right-0 px-6 py-6 border-t flex flex-col items-center gap-3"
                        style={{
                            borderColor: 'rgba(255,255,255,0.1)',
                            background: 'linear-gradient(to bottom, rgba(0,0,0,0.4), rgba(0,0,0,0.8))',
                            backdropFilter: 'blur(20px)',
                            paddingBottom: '2rem'
                        }}
                    >
                        <div className="flex items-center gap-3 w-full justify-center">
                            <button
                                onClick={onClose}
                                className="px-6 py-2.5 rounded-xl text-sm font-medium text-white/50 hover:text-white hover:bg-white/10 transition-all border border-transparent hover:border-white/10"
                            >
                                Cancel
                            </button>

                            <button
                                onClick={handleApplyClick}
                                disabled={loading || !suggestion.extractedCode}
                                className="px-6 py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-105 disabled:opacity-50 disabled:cursor-not-allowed"
                                style={{
                                    background: 'rgba(255,255,255,0.05)',
                                    border: `1px solid ${themeColor}50`,
                                    color: themeColor
                                }}
                            >
                                <Check className="w-4 h-4 inline mr-2" />
                                Apply Only
                            </button>

                            <div className="relative group">
                                <button
                                    onClick={() => onRetrain(modifiedCodePreview)}
                                    disabled={loading}
                                    className="px-6 py-2.5 rounded-xl text-sm font-bold text-white transition-all hover:scale-105 hover:brightness-110 disabled:opacity-50 shadow-lg"
                                    style={{
                                        background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`,
                                        boxShadow: `0 4px 20px ${themeColor}40`
                                    }}
                                >
                                    {loading ? (
                                        <Loader2 className="w-4 h-4 inline mr-2 animate-spin" />
                                    ) : (
                                        <Rocket className="w-4 h-4 inline mr-2" />
                                    )}
                                    Apply to Editor
                                </button>
                                {/* Tooltip for Retrain */}
                                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-48 p-3 rounded-xl bg-black/90 border border-white/10 text-xs text-white/70 text-center opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none backdrop-blur-xl">
                                    Updates the code in the editor so you can review it before manually starting training.
                                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-2 h-2 bg-black/90 rotate-45 border-r border-b border-white/10"></div>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Confirmation Modal */}
                    <AnimatePresence>
                        {showConfirm && (
                            <motion.div
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                className="absolute inset-0 flex items-center justify-center bg-black/80 backdrop-blur-sm z-10"
                            >
                                <motion.div
                                    initial={{ scale: 0.9, opacity: 0 }}
                                    animate={{ scale: 1, opacity: 1 }}
                                    exit={{ scale: 0.9, opacity: 0 }}
                                    className="p-6 rounded-2xl max-w-md text-center"
                                    style={{
                                        background: 'linear-gradient(135deg, rgba(255,255,255,0.1), rgba(255,255,255,0.05))',
                                        border: '1px solid rgba(255,255,255,0.1)'
                                    }}
                                >
                                    <AlertTriangle className="w-12 h-12 mx-auto mb-4 text-yellow-400" />
                                    <h3 className="text-lg font-bold text-white mb-2">Confirm Apply</h3>
                                    <p className="text-sm text-white/60 mb-6">
                                        This will append the AI suggestion to your current script.
                                        You can review changes in the Diff tab before applying.
                                    </p>
                                    <div className="flex items-center justify-center gap-3">
                                        <button
                                            onClick={() => setShowConfirm(false)}
                                            className="px-4 py-2 rounded-xl text-sm font-medium text-white/60 hover:bg-white/10"
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            onClick={handleConfirmApply}
                                            className="px-5 py-2 rounded-xl text-sm font-bold text-white"
                                            style={{
                                                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`
                                            }}
                                        >
                                            Confirm Apply
                                        </button>
                                    </div>
                                </motion.div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

export default SuggestionPanel;
