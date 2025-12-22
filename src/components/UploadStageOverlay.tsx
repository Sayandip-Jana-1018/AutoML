'use client';
/**
 * Upload Stage Overlay - Redesigned Clean Centered Layout
 */
import React, { useState, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Upload, X, Loader2, ArrowRight, AlertCircle,
    Eye, FileArchive, Check, Cloud, CheckCircle2,
    Database, Sparkles
} from 'lucide-react';
import { ML_WORKFLOW_STEPS } from './WorkflowTimeline';
import { Navbar } from './navbar';
import { useToast } from '@/components/ToastProvider';
import { detectColumnTypes, getNextColumnType, type ColumnTypeInfo } from '@/lib/column-type-detection';
import { analyzeDataQuality, recommendationsToCleaningConfig, type DataQualityReport } from '@/lib/data-quality-analyzer';

// Modular components
import { PipelineSteps } from './upload/PipelineSteps';
import { ImportModal } from './upload/ImportModal';
import { UploadZone } from './upload/UploadZone';
import { PreviewTable } from './upload/PreviewTable';
import { PreviewHeader } from './upload/PreviewHeader';
import { FileExplorer } from './FileExplorer';

// File parsing utilities
import {
    type LocalPreview, type HTMLTableInfo, type DataPreview,
    CLIENT_PREVIEW_LIMIT,
    parseCSV, parseJSON, parseJSONL, parseHTMLTables, parseHTMLTableByIndex, parseZipFile, detectFileType, getBestHTMLTable
} from '@/lib/file-parsers';
import Link from 'next/link';
import { Crown } from 'lucide-react';

// Tier upload limits (must match server-side limits in /api/studio/upload)
const TIER_UPLOAD_LIMITS: Record<'free' | 'silver' | 'gold', number> = {
    free: 50 * 1024 * 1024,    // 50MB
    silver: 200 * 1024 * 1024, // 200MB
    gold: 1024 * 1024 * 1024   // 1GB
};

const TIER_LABELS: Record<'free' | 'silver' | 'gold', string> = {
    free: 'Free',
    silver: 'Silver',
    gold: 'Gold'
};

// ============ PROPS ============
interface UploadStageOverlayProps {
    projectId: string;
    themeColor: string;
    userTier: 'free' | 'silver' | 'gold';
    workflowStep: number;
    workflowStatus: 'pending' | 'success' | 'error';
    errorMessage?: string;
    dataPreview?: DataPreview;
    onUploadStart: (file: File, options?: any) => Promise<void>;
    onProceedToStudio: () => void;
    datasetReused?: boolean;
    inferredTaskType?: string;
    targetColumnSuggestion?: string;
}

// ============ MAIN COMPONENT ============
export function UploadStageOverlay({
    projectId, themeColor, userTier, workflowStep, workflowStatus, errorMessage,
    dataPreview, onUploadStart, onProceedToStudio, datasetReused, inferredTaskType, targetColumnSuggestion
}: UploadStageOverlayProps) {
    // Core state
    const [isDragging, setIsDragging] = useState(false);
    const [selectedFile, setSelectedFile] = useState<File | null>(null);
    const [uploading, setUploading] = useState(false);
    const [localPreview, setLocalPreview] = useState<LocalPreview | null>(null);
    const [previewRowCount, setPreviewRowCount] = useState<5 | 10 | 50>(5);
    const [parsingFile, setParsingFile] = useState(false);
    const [parseError, setParseError] = useState<string | null>(null);
    const [targetColumn, setTargetColumn] = useState<string | null>(null);
    const [zipAsClassFolders, setZipAsClassFolders] = useState(false);

    // Upload size limit state
    const [showUpgradeBanner, setShowUpgradeBanner] = useState(false);
    const [upgradeInfo, setUpgradeInfo] = useState<{
        fileSize: string;
        tierLimit: string;
        tierLabel: string;
        nextTier: 'silver' | 'gold' | null;
    } | null>(null);

    // Import modal state
    const [showUrlImport, setShowUrlImport] = useState(false);
    const [importUrl, setImportUrl] = useState('');
    const [fetchingUrl, setFetchingUrl] = useState(false);
    const [importMode, setImportMode] = useState<'url' | 'api' | 'kaggle'>('url');
    const [apiHeaders, setApiHeaders] = useState<string>('');
    const [kaggleDataset, setKaggleDataset] = useState<string>('');
    const [kaggleUsername, setKaggleUsername] = useState<string>('');
    const [kaggleApiKey, setKaggleApiKey] = useState<string>('');

    // (HTML table is now auto-selected by getBestHTMLTable)

    // Column type detection & quality
    const [detectedColumnTypes, setDetectedColumnTypes] = useState<Record<string, ColumnTypeInfo>>({});
    const [qualityReport, setQualityReport] = useState<DataQualityReport | null>(null);

    // Sampling
    const [samplePercent, setSamplePercent] = useState<number>(100);
    const [useStratified, setUseStratified] = useState<boolean>(true);

    // Image Lightbox
    // Image Lightbox
    const [lightboxImage, setLightboxImage] = useState<string | null>(null);

    const { showToast } = useToast();

    const fileInputRef = React.useRef<HTMLInputElement>(null);

    // Hide body scroll
    useEffect(() => {
        document.body.style.overflow = 'hidden';
        return () => { document.body.style.overflow = ''; };
    }, []);

    // Drag handlers
    const handleDragOver = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(true); }, []);
    const handleDragLeave = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); }, []);
    const handleDrop = useCallback((e: React.DragEvent) => { e.preventDefault(); setIsDragging(false); if (e.dataTransfer.files.length > 0) parseLocalFile(e.dataTransfer.files[0]); }, []);

    // File parsing (same logic as before)
    const parseLocalFile = async (file: File) => {
        // PRE-VALIDATION: Check upload size limit BEFORE any parsing
        const maxUploadSize = TIER_UPLOAD_LIMITS[userTier] || TIER_UPLOAD_LIMITS.free;
        if (file.size > maxUploadSize) {
            const fileSizeMB = (file.size / (1024 * 1024)).toFixed(1);
            const limitMB = (maxUploadSize / (1024 * 1024)).toFixed(0);
            const nextTier = userTier === 'free' ? 'silver' : userTier === 'silver' ? 'gold' : null;
            setUpgradeInfo({
                fileSize: `${fileSizeMB} MB`,
                tierLimit: `${limitMB} MB`,
                tierLabel: TIER_LABELS[userTier],
                nextTier
            });
            setShowUpgradeBanner(true);
            setSelectedFile(null);
            setLocalPreview(null);
            setParseError(null);
            return; // Don't proceed with parsing
        }

        // Clear any previous upgrade banner
        setShowUpgradeBanner(false);
        setUpgradeInfo(null);

        setSelectedFile(file); setParsingFile(true); setParseError(null); setLocalPreview(null); setTargetColumn(null);
        const detection = detectFileType(file);
        try {
            if (file.size > CLIENT_PREVIEW_LIMIT) {
                setLocalPreview({ type: detection.type, confidence: detection.confidence, detectionReason: detection.reason });
                setParseError(`File too large for preview (${(file.size / 1024 / 1024).toFixed(1)} MB). Proceed to upload.`);
                setParsingFile(false); return;
            }
            if (detection.type === 'tabular' || detection.type === 'json') {
                const text = await file.text();
                const ext = file.name.toLowerCase().split('.').pop() || '';
                let parsed;
                if (ext === 'jsonl') parsed = parseJSONL(text);
                else if (ext === 'json') parsed = parseJSON(text);
                else parsed = parseCSV(text, ext === 'tsv' ? '\t' : ',');

                const types = detectColumnTypes(parsed.columns, parsed.rows);
                setDetectedColumnTypes(types);
                const quality = analyzeDataQuality(parsed.columns, parsed.rows, types);
                setQualityReport(quality);

                setLocalPreview({
                    type: detection.type, columns: parsed.columns, rows: parsed.rows, totalRows: parsed.totalRows,
                    confidence: detection.confidence, detectionReason: detection.reason,
                    nullCount: 'nullCount' in parsed ? (parsed.nullCount as number) : 0,
                    duplicateRows: 'duplicateRows' in parsed ? (parsed.duplicateRows as number) : 0
                });
                if (parsed.columns.length > 0) setTargetColumn(parsed.columns[parsed.columns.length - 1]);
            } else if (detection.type === 'text') {
                const text = await file.text();
                setLocalPreview({ type: 'text', text: text.substring(0, 500), totalRows: text.length, confidence: detection.confidence, detectionReason: detection.reason });
            } else if (detection.type === 'image') {
                setLocalPreview({ type: 'image', imageUrl: URL.createObjectURL(file), confidence: detection.confidence, detectionReason: detection.reason });
            } else if (detection.type === 'zip') {
                const zipData = await parseZipFile(file);

                if (zipData.tabularData && zipData.tabularData.columns.length > 0) {
                    const parsed = zipData.tabularData;
                    const types = detectColumnTypes(parsed.columns, parsed.rows);
                    setDetectedColumnTypes(types);
                    const quality = analyzeDataQuality(parsed.columns, parsed.rows, types);
                    setQualityReport(quality);

                    setLocalPreview({
                        type: 'tabular',
                        columns: parsed.columns,
                        rows: parsed.rows,
                        totalRows: parsed.totalRows,
                        confidence: 'high',
                        detectionReason: `Extracted "${parsed.fileName}" from archive`,
                        nullCount: parsed.nullCount || 0,
                        duplicateRows: parsed.duplicateRows || 0
                    });
                    if (parsed.columns.length > 0) setTargetColumn(parsed.columns[parsed.columns.length - 1]);
                } else {
                    setLocalPreview({
                        type: 'zip', zipFiles: [{ name: `${zipData.totalFiles} files`, size: file.size }],
                        zipImagePreviews: zipData.imagePreviews, zipFolders: zipData.folders, totalRows: zipData.totalImages,
                        confidence: detection.confidence,
                        detectionReason: zipData.totalImages > 0 ? `Image dataset: ${zipData.totalImages} images in ${zipData.folders.length} folders` : `Archive with ${zipData.totalFiles} files`,
                        fileTree: zipData.fileTree,
                        extractedSize: zipData.extractedSize,
                        totalFiles: zipData.totalFiles
                    });

                    // Auto-detect class folders structure
                    if (zipData.folders.length > 1) {
                        setZipAsClassFolders(true);
                    }
                }
            } else if (detection.type === 'html') {
                const text = await file.text();
                const bestTable = getBestHTMLTable(text);

                if (bestTable && bestTable.parsed.columns.length > 0) {
                    const { parsed } = bestTable;
                    const tables = parseHTMLTables(text);
                    const tableInfo = tables.find(t => t.index === bestTable.tableIndex);
                    const tableName = tableInfo?.name || 'Table';

                    const types = detectColumnTypes(parsed.columns, parsed.rows);
                    setDetectedColumnTypes(types);
                    const quality = analyzeDataQuality(parsed.columns, parsed.rows, types);
                    setQualityReport(quality);
                    setLocalPreview({
                        type: 'html', columns: parsed.columns, rows: parsed.rows, totalRows: parsed.totalRows, confidence: 'medium',
                        detectionReason: `Found table: "${tableName}" (${parsed.totalRows} rows, ${parsed.columns.length} columns)`,
                        nullCount: parsed.nullCount, duplicateRows: parsed.duplicateRows
                    });
                    if (parsed.columns.length > 0) setTargetColumn(parsed.columns[parsed.columns.length - 1]);
                } else {
                    setLocalPreview({ type: 'unknown', confidence: 'low', detectionReason: 'No usable data tables found in HTML' });
                    setParseError('No data tables found on this page. Try a different URL with tabular data.');
                }
            } else {
                setLocalPreview({ type: 'unknown', confidence: 'low', detectionReason: 'Unable to parse.' });
            }
        } catch (error) {
            setParseError('Failed to parse file.'); setLocalPreview({ type: detection.type, confidence: detection.confidence, detectionReason: detection.reason });
        } finally { setParsingFile(false); }
    };

    const handleConfirmUpload = async () => {
        if (!selectedFile) return;
        setUploading(true);
        try {
            const cleaningConfig = qualityReport?.recommendations ? recommendationsToCleaningConfig(qualityReport.recommendations) : {};

            // Auto-calculate for upload (remove reliance on manual state for ZIPs)
            const isAutoClassFolders = localPreview?.type === 'zip' && localPreview.zipFolders && localPreview.zipFolders.length > 1;

            // Prepare metadata for fallback profiling
            const classCounts = localPreview?.zipFolders?.reduce((acc: any, f: any) => {
                acc[f.name] = f.count;
                return acc;
            }, {}) || {};

            const clientMetadata = {
                totalFiles: localPreview?.totalFiles || 0,
                totalImages: localPreview?.totalImages || localPreview?.totalRows || 0,
                classCounts,
                extractedSize: localPreview?.extractedSize
            };

            await onUploadStart(selectedFile, {
                targetColumn,
                zipAsClassFolders: isAutoClassFolders,
                cleaningConfig,
                columnTypes: detectedColumnTypes,
                extractedSize: localPreview?.extractedSize,
                clientMetadata
            });
        } catch (e) { }
        finally { setUploading(false); }
    };

    const handleClearFile = () => {
        setSelectedFile(null); setLocalPreview(null); setParseError(null); setTargetColumn(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const convertGoogleSheetsUrl = (url: string): string | null => {
        const match = url.match(/docs\.google\.com\/spreadsheets\/d\/([a-zA-Z0-9_-]+)/);
        if (match) return `https://docs.google.com/spreadsheets/d/${match[1]}/export?format=csv`;
        return null;
    };

    const handleUrlImport = async () => {
        if (!importUrl.trim()) return;
        setFetchingUrl(true);
        setParseError(null);
        try {
            let fetchUrl = importUrl.trim();
            // Smart Wikipedia/HTML detection
            const isWebPage = fetchUrl.includes('wikipedia.org') || !fetchUrl.split('/').pop()?.includes('.');

            let filename = importUrl.split('/').pop()?.split('?')[0] || 'imported';
            const gsheetCsvUrl = convertGoogleSheetsUrl(fetchUrl);
            if (gsheetCsvUrl) { fetchUrl = gsheetCsvUrl; filename = 'google_sheet.csv'; }

            let proxyUrl = `/api/datasets/proxy?url=${encodeURIComponent(fetchUrl)}`;
            if (importMode === 'api' && apiHeaders.trim()) proxyUrl += `&headers=${encodeURIComponent(apiHeaders.trim())}`;

            const res = await fetch(proxyUrl);

            // Handle HTTP errors gracefully without throwing to avoid crash overlays
            if (!res.ok) {
                let errorMsg = 'Failed to fetch';
                if (res.status === 403 || res.status === 401) {
                    errorMsg = 'Access denied. This site might block automated access.';
                } else if (res.status === 404) {
                    errorMsg = 'File or page not found (404). Check the URL.';
                } else {
                    errorMsg = `Failed to fetch: ${res.statusText} (${res.status})`;
                }
                setParseError(errorMsg);
                showToast({
                    type: 'error',
                    title: 'Import Failed',
                    message: errorMsg,
                    duration: 5000
                });
                setFetchingUrl(false);
                return;
            }

            // Get content type from response to determine proper file extension
            const contentType = res.headers.get('content-type') || '';
            const blob = await res.blob();

            // Determine proper filename based on content-type if ambiguous
            if (!filename.includes('.') || isWebPage) {
                if (contentType.includes('application/json')) {
                    if (!filename.endsWith('.json')) filename += '.json';
                } else if (contentType.includes('text/csv') || contentType.includes('text/comma-separated')) {
                    if (!filename.endsWith('.csv')) filename += '.csv';
                } else if (contentType.includes('text/html')) {
                    if (!filename.endsWith('.html')) filename += '.html';
                } else if (contentType.includes('text/plain')) {
                    if (!filename.endsWith('.txt') && !filename.endsWith('.csv')) filename += '.csv';
                } else {
                    if (!filename.includes('.')) filename += '.json';
                }
            }

            console.log(`[URL Import] Creating file: ${filename}, type: ${contentType}, size: ${blob.size}`);

            const file = new File([blob], filename, { type: blob.type || 'application/json' });
            setShowUrlImport(false); setImportUrl(''); setApiHeaders('');
            await parseLocalFile(file);
        } catch (e) {
            console.error('[URL Import] Error:', e);
            setParseError('Failed to import. usage: Copy a direct link to a CSV/JSON file, or a public webpage URL.');
        }
        finally { setFetchingUrl(false); }
    };

    const handleKaggleImport = async () => {
        const isToken = kaggleApiKey.trim().startsWith('KGAT');

        // Validation: Dataset is required. Credentials are optional (fallback to server env).
        if (!kaggleDataset.trim()) {
            setParseError('Please enter a dataset (username/dataset)');
            return;
        }

        // If Key is provided but incomplete (e.g. basic auth without username), validation still helps

        if (kaggleApiKey.trim() && !isToken && !kaggleUsername.trim()) {
            setParseError('Please enter username for Basic Auth key');
            showToast({
                type: 'error',
                title: 'Missing Username',
                message: 'Please enter a username for your Basic Auth key, or use a Bearer Token.',
                duration: 4000
            });
            return;
        }

        setFetchingUrl(true);
        setParseError(null);
        try {
            console.log(`[Kaggle Import] Downloading: ${kaggleDataset}`);

            // Send empty credentials if not provided - backend handles env fallback
            const res = await fetch('/api/datasets/kaggle', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    dataset: kaggleDataset.trim(),
                    apiKey: kaggleApiKey.trim(), // Can be empty string
                    username: kaggleUsername.trim() // Can be empty string
                })
            });

            if (!res.ok) {
                const errorData = await res.json().catch(() => ({}));
                throw new Error(errorData.error || `Failed: ${res.status}`);
            }

            const blob = await res.blob();
            const datasetName = kaggleDataset.split('/').pop() || 'kaggle_dataset';
            const filename = `${datasetName}.zip`;

            console.log(`[Kaggle Import] Downloaded ${blob.size} bytes as ${filename}`);

            const file = new File([blob], filename, { type: 'application/zip' });
            setShowUrlImport(false); setKaggleDataset(''); setKaggleApiKey(''); setKaggleUsername('');
            await parseLocalFile(file);
        } catch (e: any) {
            console.error('[Kaggle Import] Error:', e);
            const errorMessage = e instanceof Error ? e.message : 'Failed to download from Kaggle';
            setParseError(errorMessage);

            // Show beautiful toast for error
            // Check if it's a Permission/Rules issue to give a better title
            const isPermissionError = errorMessage.toLowerCase().includes('permission') || errorMessage.toLowerCase().includes('rules');

            showToast({
                type: 'error',
                title: isPermissionError ? 'Action Required on Kaggle' : 'Download Failed',
                message: errorMessage,
                duration: 8000 // Longer duration for reading instructions
            });
        }
        finally { setFetchingUrl(false); }
    };

    // Combined import handler based on mode
    const handleImport = () => {
        if (importMode === 'kaggle') {
            handleKaggleImport();
        } else {
            handleUrlImport();
        }
    };



    const handleCycleColumnType = (col: string, e: React.MouseEvent) => {
        e.stopPropagation();
        setDetectedColumnTypes(prev => {
            const current = prev[col];
            if (!current) return prev;
            return { ...prev, [col]: { ...current, type: getNextColumnType(current.type), confidence: 'high' as const } };
        });
    };

    // Derived state
    const isUploadComplete = workflowStep >= 5 && workflowStatus === 'pending';
    const isProcessing = workflowStep > 0 && workflowStep < 5;
    const hasLocalPreview = localPreview !== null && selectedFile !== null && !uploading && workflowStep === 0;
    const displayedRows = localPreview?.rows?.slice(0, previewRowCount) || [];
    const showPreviewSection = hasLocalPreview && !parsingFile && (localPreview?.type === 'tabular' || localPreview?.type === 'json' || localPreview?.type === 'html');

    return (
        <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-50 flex flex-col"
            style={{
                background: `radial-gradient(ellipse 100% 60% at 50% -10%, ${themeColor}12, transparent), linear-gradient(180deg, rgba(8,8,8,0.88) 0%, rgba(12,12,12,0.92) 100%)`
            }}
        >
            {/* Background Orbs - More subtle */}
            <div className="absolute inset-0 overflow-hidden pointer-events-none">
                <motion.div animate={{ x: [0, 80, 0], y: [0, -40, 0] }} transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
                    className="absolute -top-32 -left-32 w-64 h-64 rounded-full blur-[80px]" style={{ background: `${themeColor}12` }} />
                <motion.div animate={{ x: [0, -80, 0], y: [0, 40, 0] }} transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
                    className="absolute -bottom-32 -right-32 w-72 h-72 rounded-full blur-[100px]" style={{ background: `${themeColor}08` }} />
            </div>

            {/* Navbar */}
            <div className="relative z-50"><Navbar /></div>

            {/* Main Content - Single Centered Column */}
            <div className="flex-1 flex flex-col items-center justify-start px-6 py-8 mt-16 overflow-auto">
                <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-3xl space-y-6">

                    {/* Header Card - Fit to content */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        className="flex items-center justify-center gap-4 py-3 px-5 rounded-2xl backdrop-blur-sm border border-white/10 mx-auto w-fit"
                        style={{ background: 'rgba(255,255,255,0.04)' }}
                    >
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`, boxShadow: `0 0 20px ${themeColor}20` }}>
                            <Database className="w-6 h-6" style={{ color: themeColor }} />
                        </div>
                        <div className="text-center px-8 py-2">
                            <h1 className="text-3xl font-bold text-white flex items-center gap-2">
                                Upload Dataset
                            </h1>
                            <p className="text-white/50 text-xs">Preview your data before training</p>
                        </div>
                        <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)`, boxShadow: `0 0 20px ${themeColor}20` }}>
                            <Sparkles className="w-6 h-6" style={{ color: themeColor }} />
                        </div>
                    </motion.div>

                    {/* Pipeline Steps */}
                    <PipelineSteps currentStep={workflowStep} />

                    {/* Main Content Card */}
                    <motion.div
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 }}
                        className="rounded-2xl backdrop-blur-sm border border-white/10 overflow-hidden"
                        style={{ background: 'rgba(255,255,255,0.03)' }}
                    >
                        <AnimatePresence mode="wait">
                            {/* Upload Zone - When no file selected */}
                            {!selectedFile && !uploading && workflowStep === 0 && !parsingFile && (
                                <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-8">
                                    <UploadZone
                                        themeColor={themeColor}
                                        isDragging={isDragging}
                                        onDragOver={handleDragOver}
                                        onDragLeave={handleDragLeave}
                                        onDrop={handleDrop}
                                        onClick={() => fileInputRef.current?.click()}
                                        fileInputRef={fileInputRef}
                                        onFileSelect={parseLocalFile}
                                    >
                                        {/* Stop clicks from propagating to dropzone when import modal is shown */}
                                        <div onClick={(e) => e.stopPropagation()}>
                                            <ImportModal
                                                themeColor={themeColor}
                                                showUrlImport={showUrlImport}
                                                setShowUrlImport={setShowUrlImport}
                                                importMode={importMode}
                                                setImportMode={setImportMode}
                                                importUrl={importUrl}
                                                setImportUrl={setImportUrl}
                                                apiHeaders={apiHeaders}
                                                setApiHeaders={setApiHeaders}
                                                kaggleDataset={kaggleDataset}
                                                setKaggleDataset={setKaggleDataset}
                                                kaggleUsername={kaggleUsername}
                                                setKaggleUsername={setKaggleUsername}
                                                kaggleApiKey={kaggleApiKey}
                                                setKaggleApiKey={setKaggleApiKey}
                                                fetchingUrl={fetchingUrl}
                                                onImport={handleImport}
                                            />
                                        </div>
                                    </UploadZone>
                                </motion.div>
                            )}

                            {/* Upgrade Banner - When file exceeds tier limit */}
                            {showUpgradeBanner && upgradeInfo && (
                                <motion.div
                                    key="upgrade-banner"
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.95 }}
                                    className="p-8"
                                >
                                    <div className="text-center">
                                        {/* Icon */}
                                        <motion.div
                                            initial={{ scale: 0 }}
                                            animate={{ scale: 1 }}
                                            transition={{ type: "spring", bounce: 0.5, delay: 0.1 }}
                                            className="w-20 h-20 mx-auto mb-6 rounded-2xl flex items-center justify-center"
                                            style={{ background: 'linear-gradient(135deg, rgba(251,191,36,0.2), rgba(245,158,11,0.1))', boxShadow: '0 0 40px rgba(251,191,36,0.15)' }}
                                        >
                                            <Crown className="w-10 h-10 text-amber-400" />
                                        </motion.div>

                                        {/* Title */}
                                        <h3 className="text-2xl font-bold text-white mb-3">File Too Large for Your Plan</h3>

                                        {/* Size comparison */}
                                        <div className="flex items-center justify-center gap-4 mb-6">
                                            <div className="px-4 py-2 rounded-xl bg-red-500/10 border border-red-500/20">
                                                <p className="text-xs text-red-400/70 uppercase tracking-wider mb-1">Your File</p>
                                                <p className="text-lg font-bold text-red-400">{upgradeInfo.fileSize}</p>
                                            </div>
                                            <div className="text-white/30">→</div>
                                            <div className="px-4 py-2 rounded-xl bg-white/5 border border-white/10">
                                                <p className="text-xs text-white/50 uppercase tracking-wider mb-1">{upgradeInfo.tierLabel} Limit</p>
                                                <p className="text-lg font-bold text-white/70">{upgradeInfo.tierLimit}</p>
                                            </div>
                                        </div>

                                        {/* Tier comparison */}
                                        <div className="mb-8 p-4 rounded-xl bg-white/[0.03] border border-white/10 max-w-md mx-auto">
                                            <p className="text-sm text-white/60 mb-3">Plan upload limits:</p>
                                            <div className="grid grid-cols-3 gap-2">
                                                <div className={`p-2 rounded-lg text-center ${userTier === 'free' ? 'bg-white/10 border border-white/20' : 'bg-white/[0.02]'}`}>
                                                    <p className="text-[10px] text-white/40 uppercase">Free</p>
                                                    <p className="text-sm font-bold text-white/70">50 MB</p>
                                                </div>
                                                <div className={`p-2 rounded-lg text-center ${userTier === 'silver' ? 'bg-white/10 border border-white/20' : 'bg-white/[0.02]'}`}>
                                                    <p className="text-[10px] text-white/40 uppercase">Silver</p>
                                                    <p className="text-sm font-bold text-white/70">200 MB</p>
                                                </div>
                                                <div className={`p-2 rounded-lg text-center bg-gradient-to-br from-amber-500/20 to-amber-600/10 border border-amber-500/30`}>
                                                    <p className="text-[10px] text-amber-400/70 uppercase">Gold</p>
                                                    <p className="text-sm font-bold text-amber-400">1 GB</p>
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action buttons */}
                                        <div className="flex items-center justify-center gap-4">
                                            <button
                                                onClick={() => { setShowUpgradeBanner(false); setUpgradeInfo(null); }}
                                                className="px-5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-white/70 font-medium transition-all"
                                            >
                                                Try Smaller File
                                            </button>
                                            <Link
                                                href="/pricing"
                                                className="px-6 py-2.5 rounded-xl font-bold text-black flex items-center gap-2 transition-all hover:scale-105"
                                                style={{ background: 'linear-gradient(135deg, #fbbf24, #f59e0b)', boxShadow: '0 0 25px rgba(251,191,36,0.3)' }}
                                            >
                                                <Crown className="w-4 h-4" />
                                                Upgrade Plan
                                            </Link>
                                        </div>

                                        {/* Hint for Gold users */}
                                        {userTier === 'gold' && (
                                            <p className="text-xs text-white/40 mt-6">
                                                Gold is the highest tier. Consider compressing your dataset or splitting into smaller files.
                                            </p>
                                        )}
                                    </div>
                                </motion.div>
                            )}

                            {/* Loading State */}
                            {(parsingFile || uploading || isProcessing) && (
                                <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-12 flex flex-col items-center justify-center">
                                    <motion.div animate={{ rotate: 360 }} transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                                        className="w-16 h-16 rounded-2xl flex items-center justify-center mb-5" style={{ background: `${themeColor}20`, boxShadow: `0 0 30px ${themeColor}25` }}>
                                        {parsingFile ? <Eye className="w-8 h-8" style={{ color: themeColor }} /> : <Loader2 className="w-8 h-8" style={{ color: themeColor }} />}
                                    </motion.div>
                                    <h3 className="text-xl font-bold text-white mb-2">{parsingFile ? 'Analyzing Dataset' : uploading ? 'Uploading File' : 'Processing'}</h3>
                                    <p className="text-white/50 mb-6">{parsingFile ? 'Detecting structure & types' : selectedFile?.name}</p>
                                    {/* Detailed steps removed as per request - status is shown above */}
                                    <button
                                        onClick={() => {
                                            setParsingFile(false);
                                            setUploading(false);
                                            // If we had an AbortController for upload, we would call abort() here
                                        }}
                                        className="px-4 py-2 rounded-lg bg-white/5 text-white/40 hover:text-white hover:bg-white/10 text-sm transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </motion.div>
                            )}

                            {/* Preview Section */}
                            {showPreviewSection && (
                                <motion.div key="preview" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="p-6 space-y-4">
                                    <PreviewHeader
                                        localPreview={localPreview}
                                        selectedFile={selectedFile}
                                        themeColor={themeColor}
                                        onClear={handleClearFile}
                                        uploading={uploading}
                                        workflowStep={workflowStep}
                                    />


                                    {/* HTML table is auto-selected to best match */}

                                    {/* Row count + Quality */}
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center gap-2">
                                            <span className="text-xs text-white/40">Show:</span>
                                            {[5, 10, 50].map(c => (
                                                <button key={c} onClick={() => setPreviewRowCount(c as 5 | 10 | 50)}
                                                    className="px-2.5 py-1 text-xs rounded-md font-medium transition-colors"
                                                    style={previewRowCount === c ? { background: `${themeColor}25`, color: themeColor } : { background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.5)' }}>
                                                    {c}
                                                </button>
                                            ))}
                                        </div>
                                        {qualityReport && (
                                            <div className="flex items-center gap-3 text-xs">
                                                <span className="flex items-center gap-1" style={{ color: qualityReport.overallScore >= 80 ? '#22c55e' : qualityReport.overallScore >= 60 ? '#f59e0b' : '#ef4444' }}>
                                                    <Sparkles className="w-3.5 h-3.5" />{qualityReport.overallScore}/100
                                                </span>
                                                {qualityReport.nullPercentage > 0 && <span className="text-white/50">{qualityReport.nullPercentage.toFixed(1)}% nulls</span>}
                                            </div>
                                        )}
                                    </div>

                                    {/* Data Table */}
                                    <PreviewTable
                                        localPreview={localPreview}
                                        displayedRows={displayedRows}
                                        targetColumn={targetColumn}
                                        setTargetColumn={setTargetColumn}
                                        detectedColumnTypes={detectedColumnTypes}
                                        onCycleColumnType={handleCycleColumnType}
                                        themeColor={themeColor}
                                    />

                                    {parseError && (
                                        <div className="p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-xl flex items-start gap-2">
                                            <AlertCircle className="w-4 h-4 text-yellow-400 mt-0.5" />
                                            <p className="text-sm text-yellow-400/80">{parseError}</p>
                                        </div>
                                    )}

                                    {/* Actions */}
                                    <div className="flex items-center justify-between pt-4 border-t border-white/10">
                                        <div className="flex items-center gap-3 text-sm">
                                            {targetColumn && <span className="text-white/50">Target: <span className="px-2 py-1 ml-1 rounded-lg" style={{ background: `${themeColor}20`, color: themeColor }}>{targetColumn}</span></span>}
                                            {datasetReused && <span className="text-green-400 flex items-center gap-1"><Check className="w-4 h-4" />Reusing existing</span>}
                                        </div>
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmUpload}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white"
                                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`, boxShadow: `0 0 25px ${themeColor}40` }}>
                                            <Upload className="w-5 h-5" />Confirm & Upload
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}

                            {/* ZIP Preview */}
                            {hasLocalPreview && localPreview?.type === 'zip' && (
                                <motion.div key="zip" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-8">
                                    <div className="absolute top-4 right-4">
                                        <button
                                            onClick={handleClearFile}
                                            className="p-2 rounded-full hover:bg-white/10 text-white/30 hover:text-white transition-colors"
                                            title="Remove file"
                                        >
                                            <X className="w-5 h-5" />
                                        </button>
                                    </div>

                                    <div className="text-center mb-6 mt-2">
                                        <FileArchive className="w-16 h-16 mx-auto mb-4 opacity-60" style={{ color: themeColor }} />
                                        <p className="text-lg text-white font-medium">{localPreview.totalRows && localPreview.totalRows > 0 ? `${localPreview.totalRows} images` : localPreview.zipFiles?.[0]?.name}</p>
                                        <div className="flex flex-col gap-1 items-center">
                                            <p className="text-sm text-white/40">{localPreview.detectionReason}</p>
                                            {localPreview.extractedSize && (
                                                <p className="text-xs text-white/30">
                                                    Extracted size: {(localPreview.extractedSize / 1024 / 1024).toFixed(1)} MB
                                                </p>
                                            )}
                                            {localPreview.totalFiles && localPreview.totalFiles > 5000 && (
                                                <div className="mt-2 text-xs px-3 py-1 rounded-full bg-amber-500/10 text-amber-500 border border-amber-500/20 flex items-center gap-1.15">
                                                    <AlertCircle className="w-3 h-3" />
                                                    High file count ({localPreview.totalFiles.toLocaleString()}). Processing may take longer.
                                                </div>
                                            )}
                                        </div>
                                    </div>
                                    {localPreview.zipImagePreviews && localPreview.zipImagePreviews.length > 0 && (
                                        <div className="grid grid-cols-6 gap-2 mb-6">
                                            {localPreview.zipImagePreviews.map((img, idx) => (
                                                <motion.div
                                                    key={idx}
                                                    layoutId={`image-preview-${idx}`}
                                                    whileHover={{ scale: 1.05 }}
                                                    whileTap={{ scale: 0.95 }}
                                                    className="aspect-square rounded-lg overflow-hidden border border-white/10 bg-black/30 cursor-pointer relative group"
                                                    onClick={() => setLightboxImage(img)}
                                                >
                                                    <motion.img
                                                        src={img}
                                                        alt={`Preview ${idx + 1}`}
                                                        className="w-full h-full object-cover"
                                                        style={{ imageRendering: 'pixelated' }} // Fix blur for small images
                                                    />
                                                    <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                                                        <Eye className="w-4 h-4 text-white drop-shadow-md" />
                                                    </div>
                                                </motion.div>
                                            ))}
                                        </div>
                                    )}

                                    {/* File Explorer (Tree View) */}
                                    {localPreview.fileTree && (
                                        <div className="mb-6 rounded-xl bg-white/[0.03] border border-white/10 overflow-hidden flex flex-col">
                                            <div className="flex items-center justify-between p-3 border-b border-white/5 bg-white/[0.02]">
                                                <p className="text-xs text-white/50 uppercase tracking-wider font-medium">Folder Structure</p>
                                                <div className="flex gap-2">
                                                    {localPreview.zipFolders && localPreview.zipFolders.length > 1 ? (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 border border-green-500/20 flex items-center gap-1">
                                                            <CheckCircle2 className="w-3 h-3" /> {localPreview.zipFolders.length} Classes
                                                        </span>
                                                    ) : (
                                                        <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/5 text-white/40 border border-white/10">
                                                            Flat Structure
                                                        </span>
                                                    )}
                                                </div>
                                            </div>
                                            <div className="p-2 max-h-[300px] overflow-y-auto scrollbar-thin scrollbar-thumb-white/10 scrollbar-track-transparent">
                                                <FileExplorer node={localPreview.fileTree} themeColor={themeColor} />
                                            </div>
                                        </div>
                                    )}

                                    <div className="flex items-center justify-center gap-6">
                                        <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={handleConfirmUpload}
                                            className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold text-white"
                                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`, boxShadow: `0 0 25px ${themeColor}40` }}>
                                            <Upload className="w-5 h-5" />Confirm & Upload
                                        </motion.button>
                                    </div>
                                </motion.div>
                            )}

                            {/* Image Lightbox Modal - Portal to body to escape parent stacking context */}
                            {lightboxImage && (
                                <LightboxPortal
                                    src={lightboxImage}
                                    onClose={() => setLightboxImage(null)}
                                />
                            )}


                            {/* Error */}
                            {workflowStatus === 'error' && (
                                <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 flex flex-col items-center justify-center">
                                    <div className="w-16 h-16 rounded-2xl bg-red-500/20 flex items-center justify-center mb-5"><AlertCircle className="w-8 h-8 text-red-400" /></div>
                                    <h3 className="text-xl font-bold text-white mb-2">Upload Failed</h3>
                                    <p className="text-red-400/80 mb-5">{errorMessage || 'Something went wrong.'}</p>
                                    <button onClick={handleClearFile} className="px-6 py-2.5 bg-white/10 hover:bg-white/20 rounded-xl text-white font-medium transition-colors">Try Again</button>
                                </motion.div>
                            )}

                            {/* Complete */}
                            {isUploadComplete && (
                                <motion.div key="complete" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="p-12 flex flex-col items-center justify-center">
                                    <div className="w-20 h-20 rounded-3xl flex items-center justify-center mb-6" style={{ background: `${themeColor}20`, boxShadow: `0 0 40px ${themeColor}30` }}>
                                        <CheckCircle2 className="w-10 h-10" style={{ color: themeColor }} />
                                    </div>
                                    <h3 className="text-2xl font-bold text-white mb-2">Dataset Ready!</h3>
                                    <p className="text-white/60 mb-6">{inferredTaskType && `Detected task: ${inferredTaskType.replace(/_/g, ' ')}`}</p>
                                    <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} onClick={onProceedToStudio}
                                        className="flex items-center gap-2 px-8 py-3 rounded-xl font-bold text-white text-lg"
                                        style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)`, boxShadow: `0 0 30px ${themeColor}40` }}>
                                        Proceed to Studio<ArrowRight className="w-5 h-5" />
                                    </motion.button>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </motion.div>

                    {/* Footer */}
                    <div className="text-center pt-4">
                        <p className="text-xs text-white/40 flex items-center justify-center gap-2">
                            <Cloud className="w-4 h-4" />Stored securely in Google Cloud Storage
                        </p>
                    </div>
                </motion.div>
            </div>
        </motion.div>
    );
}


export default UploadStageOverlay;

function LightboxPortal({ src, onClose }: { src: string; onClose: () => void }) {
    // Only render on client
    const [mounted, setMounted] = useState(false);
    useEffect(() => { setMounted(true); return () => setMounted(false); }, []);

    if (!mounted) return null;

    return createPortal(
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="fixed inset-0 z-[9999] bg-black/90 backdrop-blur-md flex items-center justify-center p-8 cursor-zoom-out"
                onClick={onClose}
            >
                <button
                    onClick={onClose}
                    className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors z-[10000] pointer-events-auto"
                >
                    <X className="w-6 h-6" />
                </button>
                <motion.img
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    exit={{ scale: 0.9, opacity: 0 }}
                    src={src}
                    alt="Full preview"
                    className="max-w-[500px] max-h-[500px] w-auto h-auto object-contain rounded-lg shadow-2xl cursor-default bg-transparent"
                    style={{ imageRendering: 'pixelated' }}
                    onClick={(e) => e.stopPropagation()}
                />
            </motion.div>
        </AnimatePresence>,
        document.body
    );
}


