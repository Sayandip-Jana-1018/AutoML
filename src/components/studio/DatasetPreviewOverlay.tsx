'use client';

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, FileSpreadsheet, Rows, Columns, Database } from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';

interface DatasetInfo {
    filename: string;
    columns: string[];
    columnTypes?: Record<string, string>;
    rowCount: number;
    fileSize?: number;
    previewRows?: Record<string, any>[];
}

interface DatasetPreviewOverlayProps {
    dataset: DatasetInfo | null | undefined;
    isOpen: boolean;
    onClose: () => void;
}

export const DatasetPreviewOverlay = ({ dataset, isOpen, onClose }: DatasetPreviewOverlayProps) => {
    const { themeColor } = useThemeColor();

    if (!dataset?.columns?.length) return null;

    const columnTypes = dataset.columnTypes || {};

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
                        className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm"
                    />

                    {/* Centered Overlay Panel */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.9, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.9, y: 20 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                        className="fixed left-32 top-32 -translate-x-1/2 -translate-y-1/2 z-50 w-[750px] max-w-[90vw] max-h-[70vh] bg-[#0a0a0a]/95 backdrop-blur-xl border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col"
                        style={{ boxShadow: `0 0 60px ${themeColor}20` }}
                    >
                        {/* Header */}
                        <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                            <div className="flex items-center gap-3">
                                <div
                                    className="w-10 h-10 rounded-xl flex items-center justify-center"
                                    style={{ background: `${themeColor}20` }}
                                >
                                    <FileSpreadsheet className="w-5 h-5" style={{ color: themeColor }} />
                                </div>
                                <div>
                                    <h2 className="font-bold text-white text-lg">{dataset.filename || 'Dataset'}</h2>
                                    <div className="flex items-center gap-4 text-white/50 text-xs">
                                        <span className="flex items-center gap-1">
                                            <Rows className="w-3 h-3" /> {dataset.rowCount?.toLocaleString() || 0} rows
                                        </span>
                                        <span className="flex items-center gap-1">
                                            <Columns className="w-3 h-3" /> {dataset.columns?.length || 0} columns
                                        </span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-lg hover:bg-white/10 text-white/50 hover:text-white transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        {/* Column Grid - showing ALL columns */}
                        <div className="p-5 overflow-auto">
                            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-3 mb-6">
                                {dataset.columns.map((col, i) => (
                                    <motion.div
                                        key={i}
                                        initial={{ opacity: 0, y: 10 }}
                                        animate={{ opacity: 1, y: 0 }}
                                        transition={{ delay: i * 0.02 }}
                                        className="flex flex-col items-center text-center p-3 rounded-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                                    >
                                        <span className="text-xs font-medium text-white/80 truncate w-full" title={col}>
                                            {col}
                                        </span>
                                        <span
                                            className="text-[10px] font-medium px-2 py-0.5 rounded mt-2"
                                            style={{
                                                background: `${themeColor}20`,
                                                color: themeColor
                                            }}
                                        >
                                            {columnTypes[col] || 'unknown'}
                                        </span>
                                    </motion.div>
                                ))}
                            </div>

                            {/* First 5 Rows Preview Table */}
                            {dataset.previewRows && dataset.previewRows.length > 0 && (
                                <div className="border border-white/10 rounded-xl overflow-hidden">
                                    <div className="px-4 py-2 bg-white/5 border-b border-white/10 flex items-center gap-2">
                                        <Rows className="w-4 h-4" style={{ color: themeColor }} />
                                        <span className="text-xs font-medium text-white/60">Sample Data (First 5 Rows)</span>
                                    </div>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs">
                                            <thead className="bg-black/40">
                                                <tr>
                                                    {dataset.columns.slice(0, 8).map((col, i) => (
                                                        <th key={i} className="px-3 py-2 text-left font-medium text-white/50 whitespace-nowrap border-b border-white/5">
                                                            {col}
                                                        </th>
                                                    ))}
                                                    {dataset.columns.length > 8 && (
                                                        <th className="px-3 py-2 text-left font-medium text-white/30 whitespace-nowrap border-b border-white/5">
                                                            +{dataset.columns.length - 8} more
                                                        </th>
                                                    )}
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {dataset.previewRows.slice(0, 5).map((row, rowIdx) => (
                                                    <tr key={rowIdx} className="border-b border-white/5 hover:bg-white/5">
                                                        {dataset.columns.slice(0, 8).map((col, colIdx) => (
                                                            <td key={colIdx} className="px-3 py-2 text-white/70 whitespace-nowrap max-w-[150px] truncate">
                                                                {String(row[col] ?? '—')}
                                                            </td>
                                                        ))}
                                                        {dataset.columns.length > 8 && (
                                                            <td className="px-3 py-2 text-white/30">...</td>
                                                        )}
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            )}
                        </div>

                        {/* Footer with summary */}
                        <div className="px-6 py-3 border-t border-white/10 bg-black/40">
                            <div className="flex items-center justify-center gap-3 text-white/50 text-sm">
                                <Database className="w-4 h-4" style={{ color: themeColor }} />
                                <span className="font-medium">
                                    {dataset.rowCount?.toLocaleString() || 0} rows × {dataset.columns?.length || 0} columns
                                </span>
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
            style={{ boxShadow: `0 0 15px ${themeColor}20` }}
            title="View Dataset Preview"
        >
            <FileSpreadsheet
                className="w-5 h-5"
                style={{ color: themeColor }}
            />
        </motion.button>
    );
};

export default DatasetPreviewOverlay;
