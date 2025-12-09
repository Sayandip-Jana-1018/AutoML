'use client';

import React, { useState } from 'react';
import { ChevronDown, ChevronUp, Table, FileSpreadsheet, Rows, Columns } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useThemeColor } from '@/context/theme-context';

interface DatasetInfo {
    filename: string;
    columns: string[];
    columnTypes?: Record<string, string>;
    rowCount: number;
    fileSize?: number;
    previewRows?: Record<string, any>[];
}

interface DatasetPreviewProps {
    dataset: DatasetInfo | null | undefined;
    themeColor?: string;
}

export default function DatasetPreview({ dataset, themeColor: propThemeColor }: DatasetPreviewProps) {
    const { themeColor: contextThemeColor } = useThemeColor();
    const themeColor = propThemeColor || contextThemeColor;
    const [isExpanded, setIsExpanded] = useState(true);

    if (!dataset?.columns?.length) return null;

    // Generate preview data if not provided (show column headers with sample placeholders)
    const previewRows = dataset.previewRows || [];
    const columnTypes = dataset.columnTypes || {};

    return (
        <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-4"
        >
            {/* Collapsed/Header State */}
            <motion.div
                onClick={() => setIsExpanded(!isExpanded)}
                className="flex items-center justify-between px-4 py-3 rounded-xl cursor-pointer backdrop-blur-xl bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                style={{ boxShadow: isExpanded ? `0 0 20px ${themeColor}15` : 'none' }}
            >
                <div className="flex items-center gap-3">
                    <div
                        className="w-8 h-8 rounded-lg flex items-center justify-center"
                        style={{ background: `${themeColor}20` }}
                    >
                        <FileSpreadsheet className="w-4 h-4" style={{ color: themeColor }} />
                    </div>
                    <div>
                        <span className="font-medium text-white text-sm">{dataset.filename || 'Dataset'}</span>
                        <div className="flex items-center gap-3 text-white/50 text-xs">
                            <span className="flex items-center gap-1">
                                <Rows className="w-3 h-3" /> {dataset.rowCount?.toLocaleString() || 0} rows
                            </span>
                            <span className="flex items-center gap-1">
                                <Columns className="w-3 h-3" /> {dataset.columns?.length || 0} columns
                            </span>
                        </div>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-white/50 text-xs">
                    <span>{isExpanded ? 'Hide' : 'Show'} Preview</span>
                    {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </motion.div>

            {/* Expanded Table View */}
            <AnimatePresence>
                {isExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                    >
                        <div className="mt-2 rounded-xl backdrop-blur-xl bg-white/5 border border-white/10 overflow-hidden">
                            <div className="overflow-x-auto max-h-[200px]">
                                <table className="w-full text-sm">
                                    <thead className="sticky top-0 bg-black/50 backdrop-blur-sm">
                                        <tr>
                                            {dataset.columns.slice(0, 8).map((col, i) => (
                                                <th
                                                    key={i}
                                                    className="px-3 py-2 text-left font-medium text-white/80 border-b border-white/10 whitespace-nowrap"
                                                >
                                                    <div className="flex flex-col">
                                                        <span>{col}</span>
                                                        <span
                                                            className="text-xs font-normal mt-0.5 px-1.5 py-0.5 rounded"
                                                            style={{
                                                                background: `${themeColor}20`,
                                                                color: `${themeColor}`
                                                            }}
                                                        >
                                                            {columnTypes[col] || 'unknown'}
                                                        </span>
                                                    </div>
                                                </th>
                                            ))}
                                            {dataset.columns.length > 8 && (
                                                <th className="px-3 py-2 text-left font-medium text-white/50 border-b border-white/10">
                                                    +{dataset.columns.length - 8} more
                                                </th>
                                            )}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {previewRows.length > 0 ? (
                                            previewRows.slice(0, 5).map((row, rowIdx) => (
                                                <tr key={rowIdx} className="hover:bg-white/5">
                                                    {dataset.columns.slice(0, 8).map((col, colIdx) => (
                                                        <td
                                                            key={colIdx}
                                                            className="px-3 py-2 text-white/70 border-b border-white/5 whitespace-nowrap max-w-[150px] truncate"
                                                        >
                                                            {row[col]?.toString() || '-'}
                                                        </td>
                                                    ))}
                                                    {dataset.columns.length > 8 && (
                                                        <td className="px-3 py-2 text-white/30 border-b border-white/5">...</td>
                                                    )}
                                                </tr>
                                            ))
                                        ) : (
                                            <tr>
                                                <td
                                                    colSpan={Math.min(dataset.columns.length, 8) + (dataset.columns.length > 8 ? 1 : 0)}
                                                    className="px-4 py-8 text-center text-white/40"
                                                >
                                                    <Table className="w-6 h-6 mx-auto mb-2 opacity-50" />
                                                    Column structure loaded. Preview rows will appear after processing.
                                                </td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}
