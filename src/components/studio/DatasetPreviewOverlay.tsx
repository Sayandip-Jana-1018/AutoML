'use client';

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, Rows, Columns, Database, Sparkles, AlertTriangle, CheckCircle, Trash2, ArrowDown, Target } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface DatasetInfo {
    filename: string;
    columns: string[];
    columnTypes?: Record<string, string>;
    rowCount: number;
    fileSize?: number;
    previewRows?: Record<string, any>[];
    // NEW: Preprocessing & Quality info
    targetColumn?: string;
    nullCount?: number;
    nullPercentage?: number;
    duplicateRows?: number;
    droppedColumns?: string[];
    missingValueStrategy?: string;
    qualityScore?: number;
}

interface DatasetPreviewOverlayProps {
    dataset: DatasetInfo | null | undefined;
    isOpen: boolean;
    onClose: () => void;
}

export const DatasetPreviewOverlay = ({ dataset, isOpen, onClose }: DatasetPreviewOverlayProps) => {
    const { themeColor } = useThemeColor();
    const [activeTab, setActiveTab] = useState<'overview' | 'data'>('overview');

    if (!dataset?.columns?.length) return null;

    const columnTypes = dataset.columnTypes || {};
    const numericCols = dataset.columns.filter(c => columnTypes[c] === 'numeric' || columnTypes[c] === 'int64' || columnTypes[c] === 'float64');
    const categoricalCols = dataset.columns.filter(c => columnTypes[c] === 'categorical' || columnTypes[c] === 'object' || columnTypes[c] === 'category');
    const textCols = dataset.columns.filter(c => columnTypes[c] === 'text');

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop with blur */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 z-50 bg-black/70 backdrop-blur-sm"
                    />

                    {/* Centered Overlay Panel - Glassmorphic - Full screen on mobile */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed inset-4 md:left-24 md:top-16 md:inset-auto md:-translate-x-1/2 md:-translate-y-1/2 z-50 md:w-[850px] md:max-w-[90vw] md:max-h-[80vh] bg-white/60 dark:bg-black/60 backdrop-blur-2xl border border-black/10 dark:border-white/10 rounded-2xl md:rounded-3xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ boxShadow: `0 0 80px ${themeColor}30, 0 25px 50px rgba(0,0,0,0.5)` }}
                    >
                        {/* Header - Centered */}
                        <div className="flex flex-col items-center justify-center px-6 py-5 border-b border-black/10 dark:border-white/10 bg-gradient-to-r from-black/5 dark:from-white/5 to-transparent relative">
                            <button
                                onClick={onClose}
                                className="absolute right-4 top-4 p-2.5 rounded-xl hover:bg-black/10 dark:hover:bg-white/10 text-black/50 dark:text-white/50 hover:text-black dark:hover:text-white transition-all"
                            >
                                <X className="w-5 h-5" />
                            </button>
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3"
                                style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`, boxShadow: `0 0 20px ${themeColor}20` }}
                            >
                                <Database className="w-7 h-7" style={{ color: themeColor }} />
                            </div>
                            <h2 className="font-bold text-black dark:text-white text-xl text-center">{dataset.filename || 'Dataset'}</h2>
                            <div className="flex items-center justify-center gap-4 text-black/50 dark:text-white/50 text-sm mt-2">
                                <span className="flex items-center gap-1.5">
                                    <Rows className="w-4 h-4" /> {dataset.rowCount?.toLocaleString() || 0} rows
                                </span>
                                <span className="flex items-center gap-1.5">
                                    <Columns className="w-4 h-4" /> {dataset.columns?.length || 0} columns
                                </span>
                                {dataset.targetColumn && (
                                    <span className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg" style={{ background: `${themeColor}20`, color: themeColor }}>
                                        <Target className="w-3.5 h-3.5" /> {dataset.targetColumn}
                                    </span>
                                )}
                            </div>
                        </div>

                        {/* Tab Navigation - Centered */}
                        <div className="flex items-center justify-center gap-2 px-6 py-3 border-b border-black/5 dark:border-white/5 bg-black/5 dark:bg-black/20">
                            {[
                                { id: 'overview', label: 'Overview & Quality' },
                                { id: 'data', label: 'Data Preview' }
                            ].map(tab => (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id as any)}
                                    className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === tab.id
                                        ? 'bg-white/10 text-white'
                                        : 'text-white/50 hover:text-white/70 hover:bg-white/5'
                                        }`}
                                    style={activeTab === tab.id ? { background: `${themeColor}20`, color: themeColor } : {}}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        {/* Content - Centered */}
                        <div className="flex-1 overflow-auto p-6">
                            <div className="max-w-4xl mx-auto">
                                {activeTab === 'overview' ? (
                                    <div className="space-y-6">
                                        {/* Data Quality Summary */}
                                        <div className="grid grid-cols-3 gap-4">
                                            {/* Quality Score */}
                                            <div className="p-3 md:p-4 rounded-2xl bg-white/5 border border-white/10 overflow-hidden">
                                                <div className="flex items-center gap-2 mb-2 md:mb-3">
                                                    <Sparkles className="w-3 h-3 md:w-4 md:h-4" style={{ color: themeColor }} />
                                                    <span className="text-[10px] md:text-xs font-medium text-white/50">Quality Score</span>
                                                </div>
                                                <div className="text-xl md:text-3xl font-bold" style={{
                                                    color: (dataset.qualityScore || 80) >= 80 ? '#22c55e' : (dataset.qualityScore || 80) >= 60 ? '#f59e0b' : '#ef4444'
                                                }}>
                                                    {dataset.qualityScore || 80}<span className="text-sm md:text-lg text-white/40">/100</span>
                                                </div>
                                            </div>

                                            {/* Null Values */}
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <AlertTriangle className="w-4 h-4 text-amber-400" />
                                                    <span className="text-xs font-medium text-white/50">Missing Values</span>
                                                </div>
                                                <div className="text-3xl font-bold text-amber-400">
                                                    {dataset.nullPercentage?.toFixed(1) || '0.0'}%
                                                </div>
                                                <p className="text-xs text-white/40 mt-1">
                                                    {dataset.nullCount?.toLocaleString() || 0} null cells
                                                </p>
                                            </div>

                                            {/* Duplicates */}
                                            <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                                <div className="flex items-center gap-2 mb-3">
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                    <span className="text-xs font-medium text-white/50">Duplicate Rows</span>
                                                </div>
                                                <div className="text-3xl font-bold text-red-400">
                                                    {dataset.duplicateRows || 0}
                                                </div>
                                                <p className="text-xs text-white/40 mt-1">
                                                    {((dataset.duplicateRows || 0) / (dataset.rowCount || 1) * 100).toFixed(1)}% of data
                                                </p>
                                            </div>
                                        </div>

                                        {/* Preprocessing Actions */}
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                <CheckCircle className="w-4 h-4" style={{ color: themeColor }} />
                                                <span className="text-sm font-medium text-white">Preprocessing Applied</span>
                                            </div>
                                            <div className="grid grid-cols-2 gap-4 text-sm">
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30">
                                                    <ArrowDown className="w-4 h-4 text-blue-400" />
                                                    <div>
                                                        <p className="text-white/70">Numeric Imputation</p>
                                                        <p className="text-xs text-white/40">Median fill for {numericCols.length} columns</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30">
                                                    <ArrowDown className="w-4 h-4 text-purple-400" />
                                                    <div>
                                                        <p className="text-white/70">Categorical Encoding</p>
                                                        <p className="text-xs text-white/40">OneHot for {categoricalCols.length} columns</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30">
                                                    <ArrowDown className="w-4 h-4 text-green-400" />
                                                    <div>
                                                        <p className="text-white/70">Scaling Applied</p>
                                                        <p className="text-xs text-white/40">StandardScaler on numeric features</p>
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-3 p-3 rounded-xl bg-black/30">
                                                    <Trash2 className="w-4 h-4 text-red-400" />
                                                    <div>
                                                        <p className="text-white/70">Dropped Columns</p>
                                                        <p className="text-xs text-white/40">
                                                            {dataset.droppedColumns?.length ? dataset.droppedColumns.join(', ') : 'None'}
                                                        </p>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Column Types Summary */}
                                        <div className="p-4 rounded-2xl bg-white/5 border border-white/10">
                                            <div className="flex items-center justify-center gap-2 mb-4">
                                                <Columns className="w-4 h-4" style={{ color: themeColor }} />
                                                <span className="text-sm font-medium text-white">Column Summary</span>
                                            </div>
                                            <div className="flex flex-wrap justify-center gap-2">
                                                {numericCols.length > 0 && (
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-blue-500/20 text-blue-400 border border-blue-500/30">
                                                        {numericCols.length} Numeric
                                                    </span>
                                                )}
                                                {categoricalCols.length > 0 && (
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-purple-500/20 text-purple-400 border border-purple-500/30">
                                                        {categoricalCols.length} Categorical
                                                    </span>
                                                )}
                                                {textCols.length > 0 && (
                                                    <span className="px-3 py-1.5 rounded-lg text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                                                        {textCols.length} Text
                                                    </span>
                                                )}
                                            </div>

                                            {/* All columns grid */}
                                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-2 mt-4">
                                                {dataset.columns.map((col, i) => (
                                                    <motion.div
                                                        key={i}
                                                        initial={{ opacity: 0, y: 5 }}
                                                        animate={{ opacity: 1, y: 0 }}
                                                        transition={{ delay: i * 0.01 }}
                                                        className={`flex flex-col items-center text-center p-2 rounded-lg border transition-all ${col === dataset.targetColumn
                                                            ? 'bg-gradient-to-b border-2'
                                                            : 'bg-white/5 border-white/10 hover:bg-white/10'
                                                            }`}
                                                        style={col === dataset.targetColumn ? {
                                                            borderColor: themeColor,
                                                            background: `linear-gradient(180deg, ${themeColor}20, transparent)`
                                                        } : {}}
                                                    >
                                                        <span className="text-[10px] font-medium text-white/80 truncate w-full" title={col}>
                                                            {col}
                                                        </span>
                                                        <span
                                                            className="text-[9px] font-medium px-1.5 py-0.5 rounded mt-1"
                                                            style={{
                                                                background: col === dataset.targetColumn ? `${themeColor}40` : `${themeColor}20`,
                                                                color: themeColor
                                                            }}
                                                        >
                                                            {col === dataset.targetColumn ? 'TARGET' : columnTypes[col] || 'unknown'}
                                                        </span>
                                                    </motion.div>
                                                ))}
                                            </div>
                                        </div>
                                    </div>
                                ) : (
                                    /* Data Preview Tab */
                                    <div className="space-y-4">
                                        {dataset.previewRows && dataset.previewRows.length > 0 ? (
                                            <div className="border border-white/10 rounded-2xl overflow-hidden">
                                                <div className="px-4 py-3 bg-white/5 border-b border-white/10 flex items-center justify-center">
                                                    <span className="text-sm font-medium text-white/60 flex items-center gap-2">
                                                        <Rows className="w-4 h-4" style={{ color: themeColor }} />
                                                        Sample Data (First 5 Rows)
                                                    </span>
                                                </div>
                                                <div className="overflow-x-auto">
                                                    <table className="w-full text-xs">
                                                        <thead className="bg-black/40">
                                                            <tr>
                                                                {dataset.columns.slice(0, 8).map((col, i) => (
                                                                    <th
                                                                        key={i}
                                                                        className="px-4 py-3 text-left font-medium text-white/50 whitespace-nowrap border-b border-white/5"
                                                                        style={col === dataset.targetColumn ? { color: themeColor, fontWeight: 'bold' } : {}}
                                                                    >
                                                                        {col}
                                                                        {col === dataset.targetColumn && <Target className="w-3 h-3 inline ml-1" />}
                                                                    </th>
                                                                ))}
                                                                {dataset.columns.length > 8 && (
                                                                    <th className="px-4 py-3 text-left font-medium text-white/30 whitespace-nowrap border-b border-white/5">
                                                                        +{dataset.columns.length - 8} more
                                                                    </th>
                                                                )}
                                                            </tr>
                                                        </thead>
                                                        <tbody>
                                                            {dataset.previewRows.slice(0, 5).map((row, rowIdx) => (
                                                                <tr key={rowIdx} className="border-b border-white/5 hover:bg-white/5 transition-colors">
                                                                    {dataset.columns.slice(0, 8).map((col, colIdx) => (
                                                                        <td
                                                                            key={colIdx}
                                                                            className="px-4 py-3 text-white/70 whitespace-nowrap max-w-[150px] truncate"
                                                                            style={col === dataset.targetColumn ? { color: themeColor, fontWeight: '500' } : {}}
                                                                        >
                                                                            {row[col] === null || row[col] === undefined || row[col] === '' ? (
                                                                                <span className="text-red-400/60 italic">null</span>
                                                                            ) : String(row[col])}
                                                                        </td>
                                                                    ))}
                                                                    {dataset.columns.length > 8 && (
                                                                        <td className="px-4 py-3 text-white/30">...</td>
                                                                    )}
                                                                </tr>
                                                            ))}
                                                        </tbody>
                                                    </table>
                                                </div>
                                            </div>
                                        ) : (
                                            <div className="flex flex-col items-center justify-center py-16 text-white/40">
                                                <FileSpreadsheet className="w-12 h-12 mb-4 opacity-30" />
                                                <p className="text-sm">No preview data available</p>
                                                <p className="text-xs mt-1">Data preview will be shown after preprocessing</p>
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="px-6 py-4 border-t border-white/10 bg-gradient-to-r from-black/40 to-transparent">
                            <div className="flex items-center justify-center gap-4 text-white/50 text-sm">
                                <Database className="w-4 h-4" style={{ color: themeColor }} />
                                <span className="font-medium">
                                    {dataset.rowCount?.toLocaleString() || 0} rows × {dataset.columns?.length || 0} columns
                                </span>
                                {dataset.fileSize && (
                                    <span className="text-white/30">
                                        ({(dataset.fileSize / 1024).toFixed(1)} KB)
                                    </span>
                                )}
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
};

// Floating trigger button
interface DatasetTriggerButtonProps {
    onClick: () => void;
    hasDataset: boolean;
    themeColor: string;
}

export const DatasetTriggerButton = ({ onClick, hasDataset, themeColor }: DatasetTriggerButtonProps) => {
    if (!hasDataset) return null;

    return (
        <motion.button
            initial={{ x: -10, opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            whileHover={{ scale: 1.1 }}
            onClick={onClick}
            className="fixed left-8 top-48 z-40 p-3 rounded-full backdrop-blur-xl bg-white/5 border border-white/10 shadow-lg transition-all hover:bg-white/10"
            style={{
                background: `linear-gradient(135deg, ${themeColor}, ${themeColor}cc)`,
                boxShadow: `0 8px 32px ${themeColor}60, 0 0 60px ${themeColor}30`
            }}
            title="View Dataset Preview"
        >
            <FileSpreadsheet
                className="w-5 h-5"
            />
        </motion.button>
    );
};

export default DatasetPreviewOverlay;
