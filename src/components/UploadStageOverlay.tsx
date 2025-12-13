'use client';

import React, { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileSpreadsheet, X, Loader2, ArrowRight, AlertCircle, HardDrive } from 'lucide-react';
import WorkflowTimeline, { ML_WORKFLOW_STEPS } from './WorkflowTimeline';
import { Navbar } from './navbar';

interface DataPreview {
    columns: string[];
    columnTypes: Record<string, 'numeric' | 'categorical' | 'datetime'>;
    rows: any[];
    totalRows: number;
    fileSize: number;
}

interface UploadStageOverlayProps {
    projectId: string;
    themeColor: string;
    userTier: 'free' | 'silver' | 'gold';
    workflowStep: number;
    workflowStatus: 'pending' | 'success' | 'error';
    errorMessage?: string;
    dataPreview?: DataPreview;
    onUploadStart: (file: File) => Promise<void>;
    onProceedToStudio: () => void;
    // New props for finishing touches
    datasetReused?: boolean;
    inferredTaskType?: string;
    targetColumnSuggestion?: string;
}

// Tier-based preview row limits
const TIER_PREVIEW_LIMITS = {
    free: 250,
    silver: 1000,
    gold: 5000
};

export function UploadStageOverlay({
    projectId,
    themeColor,
    userTier,
    workflowStep,
    workflowStatus,
    errorMessage,
    dataPreview,
    onUploadStart,
    onProceedToStudio,
    datasetReused,
    inferredTaskType,
    targetColumnSuggestion
}: UploadStageOverlayProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);

    const previewLimit = TIER_PREVIEW_LIMITS[userTier];

    const handleDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(true);
    }, []);

    const handleDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const handleDrop = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        const files = e.dataTransfer.files;
        if (files.length > 0) {
            handleFileSelect(files[0]);
        }
    }, []);

    const handleFileSelect = async (file: File) => {
        // Validate file type
        const validTypes = ['.csv', '.xlsx', '.xls'];
        const ext = '.' + file.name.split('.').pop()?.toLowerCase();
        if (!validTypes.includes(ext)) {
            alert('Please upload a CSV or Excel file');
            return;
        }
        setSelectedFile(file);
        setUploading(true);
        try {
            await onUploadStart(file);
        } catch (error) {
            console.error('Upload failed:', error);
        } finally {
            setUploading(false);
        }
    };

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    const isUploadComplete = workflowStep >= 5 && workflowStatus === 'pending';
    const isProcessing = workflowStep > 0 && workflowStep < 5;

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col bg-black/80 backdrop-blur-xl"
        >
            {/* Navbar - so users can navigate away */}
            <div className="relative z-50">
                <Navbar />
            </div>

            {/* Main Content - added pt-6 for more top spacing */}
            <div className="flex-1 flex items-center justify-center p-6 pt-12 overflow-hidden">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95, y: 20 }}
                    animate={{ opacity: 1, scale: 1, y: 0 }}
                    className="w-full max-w-5xl max-h-[90vh] overflow-hidden bg-white/5 backdrop-blur-2xl border border-white/10 rounded-3xl"
                    style={{ boxShadow: `0 0 80px ${themeColor}15` }}
                >
                    {/* Header */}
                    <div className="flex items-center justify-between p-6 border-b border-white/10">
                        <div className="flex items-center gap-3">
                            <div
                                className="w-10 h-10 rounded-xl flex items-center justify-center"
                                style={{ backgroundColor: `${themeColor}20` }}
                            >
                                <Upload className="w-5 h-5" style={{ color: themeColor }} />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Upload Dataset</h2>
                                <p className="text-white/50 text-sm">Start your ML journey</p>
                            </div>
                        </div>
                        {selectedFile && (
                            <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-lg">
                                <FileSpreadsheet className="w-4 h-4 text-white/60" />
                                <span className="text-sm text-white/80">{selectedFile.name}</span>
                                <span className="text-xs text-white/40">
                                    ({selectedFile.size < 1048576
                                        ? `${selectedFile.size} Bytes`
                                        : `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`})
                                </span>
                            </div>
                        )}
                    </div>

                    {/* Body */}
                    <div className="flex h-[60vh]">
                        {/* Left: Timeline */}
                        <div className="w-64 p-6 border-r border-white/10 overflow-y-auto">
                            <h3 className="text-xs font-bold text-white/40 uppercase tracking-wider mb-4">
                                Workflow Progress
                            </h3>
                            <WorkflowTimeline
                                currentStep={workflowStep}
                                status={workflowStatus}
                                errorMessage={errorMessage}
                                themeColor={themeColor}
                            />
                        </div>

                        {/* Right: Upload Zone / Preview */}
                        <div className="flex-1 p-6 overflow-y-auto">
                            <AnimatePresence mode="wait">
                                {/* Uploading State - while file is being uploaded to GCS */}
                                {uploading && workflowStep === 0 && (
                                    <motion.div
                                        key="uploading"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col items-center justify-center"
                                    >
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                                            style={{ backgroundColor: `${themeColor}20` }}
                                        >
                                            <Loader2 className="w-10 h-10" style={{ color: themeColor }} />
                                        </motion.div>
                                        <h3 className="text-xl font-bold text-white mb-2">
                                            Uploading Dataset
                                        </h3>
                                        <p className="text-white/50 text-sm mb-4">
                                            {selectedFile?.name}
                                        </p>
                                        {/* Progress bar animation */}
                                        <div className="w-48 h-1.5 bg-white/10 rounded-full overflow-hidden">
                                            <motion.div
                                                animate={{ x: ["-100%", "100%"] }}
                                                transition={{ duration: 1.5, repeat: Infinity, ease: "easeInOut" }}
                                                className="h-full w-1/3 rounded-full"
                                                style={{ background: `linear-gradient(90deg, transparent, ${themeColor}, transparent)` }}
                                            />
                                        </div>
                                        <p className="text-white/30 text-xs mt-4">
                                            Please wait while we upload your file...
                                        </p>
                                    </motion.div>
                                )}

                                {/* Upload Zone - when no file selected */}
                                {!selectedFile && !uploading && workflowStep === 0 && (
                                    <motion.div
                                        key="upload-zone"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        className={`
                                        h-full flex flex-col items-center justify-center
                                        border-2 border-dashed rounded-2xl cursor-pointer
                                        transition-all duration-300
                                        ${isDragging ? 'scale-[1.02]' : ''}
                                    `}
                                        style={{
                                            borderColor: isDragging ? themeColor : 'rgba(255,255,255,0.2)',
                                            backgroundColor: isDragging ? `${themeColor}10` : 'transparent'
                                        }}
                                    >
                                        <input
                                            ref={fileInputRef}
                                            type="file"
                                            accept=".csv,.xlsx,.xls"
                                            onChange={(e) => e.target.files?.[0] && handleFileSelect(e.target.files[0])}
                                            className="hidden"
                                        />
                                        <div
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                            style={{ backgroundColor: `${themeColor}20` }}
                                        >
                                            <Upload className="w-8 h-8" style={{ color: themeColor }} />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            Drop your dataset here
                                        </h3>
                                        <p className="text-white/50 text-sm mb-4">
                                            or click to browse files
                                        </p>
                                        <div className="flex gap-2 text-xs text-white/30">
                                            <span className="px-2 py-1 bg-white/5 rounded">.CSV</span>
                                            <span className="px-2 py-1 bg-white/5 rounded">.XLSX</span>
                                            <span className="px-2 py-1 bg-white/5 rounded">.XLS</span>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Processing State */}
                                {isProcessing && (
                                    <motion.div
                                        key="processing"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col items-center justify-center"
                                    >
                                        <motion.div
                                            animate={{ rotate: 360 }}
                                            transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                            className="w-16 h-16 rounded-2xl flex items-center justify-center mb-4"
                                            style={{ backgroundColor: `${themeColor}20` }}
                                        >
                                            <Loader2 className="w-8 h-8" style={{ color: themeColor }} />
                                        </motion.div>
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            Processing Dataset
                                        </h3>
                                        <p className="text-white/50 text-sm">
                                            {ML_WORKFLOW_STEPS[workflowStep]?.description || 'Please wait...'}
                                        </p>
                                    </motion.div>
                                )}

                                {/* Preview Table - after processing */}
                                {dataPreview && workflowStep >= 5 && (
                                    <motion.div
                                        key="preview"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col"
                                    >
                                        {/* Info Bar */}
                                        <div className="flex items-center justify-between mb-4">
                                            <div className="flex items-center gap-4">
                                                <div className="flex items-center gap-2 text-sm">
                                                    <HardDrive className="w-4 h-4 text-white/40" />
                                                    <span className="text-white/60">
                                                        Showing {Math.min(dataPreview.rows.length, previewLimit)} of {dataPreview.totalRows.toLocaleString()} rows
                                                    </span>
                                                    <span className="text-xs px-2 py-0.5 bg-white/10 rounded-full text-white/40">
                                                        {userTier.charAt(0).toUpperCase() + userTier.slice(1)} tier limit
                                                    </span>
                                                </div>
                                            </div>
                                            <span className="text-xs text-white/40">
                                                {dataPreview.columns.length} columns
                                            </span>
                                        </div>

                                        {/* Table */}
                                        <div className="flex-1 overflow-auto border border-white/10 rounded-xl">
                                            <table className="w-full text-sm">
                                                <thead className="sticky top-0 bg-black/80 backdrop-blur-sm">
                                                    <tr>
                                                        {dataPreview.columns.map((col, i) => (
                                                            <th
                                                                key={i}
                                                                className="px-4 py-3 text-left font-medium text-white/60 border-b border-white/10"
                                                            >
                                                                <div>{col}</div>
                                                                <div className="text-[10px] font-normal text-white/30">
                                                                    {dataPreview.columnTypes[col] || 'unknown'}
                                                                </div>
                                                            </th>
                                                        ))}
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {dataPreview.rows.slice(0, 10).map((row, i) => (
                                                        <tr key={i} className="border-b border-white/5 hover:bg-white/5">
                                                            {dataPreview.columns.map((col, j) => (
                                                                <td key={j} className="px-4 py-2 text-white/80 whitespace-nowrap">
                                                                    {String(row[col] ?? '—')}
                                                                </td>
                                                            ))}
                                                        </tr>
                                                    ))}
                                                </tbody>
                                            </table>
                                        </div>
                                    </motion.div>
                                )}

                                {/* Error State */}
                                {workflowStatus === 'error' && (
                                    <motion.div
                                        key="error"
                                        initial={{ opacity: 0 }}
                                        animate={{ opacity: 1 }}
                                        exit={{ opacity: 0 }}
                                        className="h-full flex flex-col items-center justify-center"
                                    >
                                        <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-4">
                                            <AlertCircle className="w-8 h-8 text-red-400" />
                                        </div>
                                        <h3 className="text-lg font-bold text-white mb-2">
                                            Upload Failed
                                        </h3>
                                        <p className="text-red-400/80 text-sm mb-4">
                                            {errorMessage || 'Something went wrong. Please try again.'}
                                        </p>
                                        <button
                                            onClick={() => setSelectedFile(null)}
                                            className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-xl text-white text-sm font-medium transition-colors"
                                        >
                                            Try Again
                                        </button>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Footer */}
                    <div className="flex items-center justify-between p-6 border-t border-white/10">
                        <div className="flex flex-col gap-1">
                            {/* Dedupe reuse message */}
                            {datasetReused && (
                                <div className="flex items-center gap-2 text-xs text-green-400">
                                    <span className="w-2 h-2 rounded-full bg-green-400" />
                                    File already exists – reusing previous dataset
                                </div>
                            )}
                            {/* Target detection display */}
                            {isUploadComplete && inferredTaskType && (
                                <div className="flex items-center gap-3 text-xs">
                                    <span className="text-white/40">Task detected:</span>
                                    <span className="px-2 py-0.5 bg-white/10 rounded-full text-white/70">
                                        {inferredTaskType.replace(/_/g, ' ')}
                                    </span>
                                    {targetColumnSuggestion && (
                                        <>
                                            <span className="text-white/40">Target:</span>
                                            <span className="px-2 py-0.5 rounded-full font-medium" style={{ backgroundColor: `${themeColor}20`, color: themeColor }}>
                                                {targetColumnSuggestion}
                                            </span>
                                        </>
                                    )}
                                </div>
                            )}
                            {!datasetReused && !inferredTaskType && (
                                <div className="text-xs text-white/30">
                                    Dataset will be stored securely in Google Cloud Storage
                                </div>
                            )}
                        </div>
                        {isUploadComplete && (
                            <motion.button
                                initial={{ opacity: 0, x: 20 }}
                                animate={{ opacity: 1, x: 0 }}
                                onClick={onProceedToStudio}
                                className="flex items-center gap-2 px-6 py-3 rounded-xl font-bold text-white transition-all hover:scale-105"
                                style={{ backgroundColor: themeColor }}
                            >
                                Proceed to Studio
                                <ArrowRight className="w-4 h-4" />
                            </motion.button>
                        )}
                    </div>
                </motion.div>
            </div >
        </motion.div >
    );
}

export default UploadStageOverlay;
