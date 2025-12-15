'use client';
/**
 * Preview Header Component
 * Shows file info and quality badges
 */
import React from 'react';
import { Table, FileJson, FileText, Image as ImageIcon, FileArchive, AlertCircle, Columns, Rows, X } from 'lucide-react';
import { type LocalPreview } from '@/lib/file-parsers';
import { detectSchema, getSchemaMatchInfo } from '@/lib/schema-validation';

interface PreviewHeaderProps {
    localPreview: LocalPreview;
    selectedFile: File | null;
    themeColor: string;
    onClear: () => void;
    uploading: boolean;
    workflowStep: number;
}

export function PreviewHeader({
    localPreview,
    selectedFile,
    themeColor,
    onClear,
    uploading,
    workflowStep
}: PreviewHeaderProps) {
    return (
        <div
            className="mb-3 px-3 py-2 rounded-lg border border-white/10 flex items-center justify-between gap-2"
            style={{ background: 'rgba(255,255,255,0.02)' }}
        >
            {/* LEFT: File info */}
            <div className="flex items-center gap-2 min-w-0">
                <div className="w-8 h-8 rounded-md flex items-center justify-center shrink-0" style={{ background: `${themeColor}15`, border: `1px solid ${themeColor}25` }}>
                    {localPreview.type === 'tabular' && <Table className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'json' && <FileJson className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'text' && <FileText className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'image' && <ImageIcon className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'zip' && <FileArchive className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'html' && <Table className="w-4 h-4" style={{ color: themeColor }} />}
                    {localPreview.type === 'unknown' && <AlertCircle className="w-4 h-4" style={{ color: '#ef4444' }} />}
                </div>
                <div className="min-w-0">
                    <div className="text-xs font-semibold text-white truncate">{selectedFile?.name || 'Dataset'}</div>
                    <div className="text-[10px] text-white/40">
                        {selectedFile && (selectedFile.size < 1048576 ? `${(selectedFile.size / 1024).toFixed(1)} KB` : `${(selectedFile.size / 1024 / 1024).toFixed(2)} MB`)}
                    </div>
                </div>
            </div>

            {/* MIDDLE: Type & Quality badges */}
            <div className="flex items-center gap-1.5 flex-wrap justify-center">
                <span className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${localPreview.type === 'unknown' ? 'bg-red-500/15 text-red-400' :
                    localPreview.confidence === 'high' ? 'bg-green-500/15 text-green-400' : 'bg-yellow-500/15 text-yellow-400'
                    }`}>
                    {localPreview.type === 'unknown' ? '✕ unsupported' : localPreview.type}
                </span>
                {(localPreview.type === 'tabular' || localPreview.type === 'json' || localPreview.type === 'html') && (
                    <>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${(localPreview.nullCount || 0) > 0 ? 'bg-yellow-500/15 text-yellow-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {(localPreview.nullCount || 0) > 0 ? '⚠' : '✓'} {localPreview.nullCount || 0} nulls
                        </span>
                        <span className={`text-[10px] px-2 py-0.5 rounded-full ${(localPreview.duplicateRows || 0) > 0 ? 'bg-orange-500/15 text-orange-400' : 'bg-emerald-500/15 text-emerald-400'}`}>
                            {(localPreview.duplicateRows || 0) > 0 ? '⚠' : '✓'} {localPreview.duplicateRows || 0} dupes
                        </span>
                        {localPreview.columns && (() => {
                            const detected = detectSchema(localPreview.columns);
                            const info = getSchemaMatchInfo(detected);
                            return detected.matchedTemplate ? (
                                <span className="text-[10px] px-2 py-0.5 rounded-full" style={{ background: `${info.color}15`, color: info.color }}>
                                    {info.icon === 'check' ? '✓' : info.icon === 'warning' ? '~' : 'ℹ'} {detected.matchedTemplate.name}
                                </span>
                            ) : null;
                        })()}
                    </>
                )}
            </div>

            {/* RIGHT: Cols, Rows & Close */}
            <div className="flex items-center gap-2 shrink-0">
                <span className="text-[10px] text-white/50 flex items-center gap-0.5"><Columns className="w-3 h-3" /> {localPreview.columns?.length || 0}</span>
                <span className="text-[10px] text-white/50 flex items-center gap-0.5"><Rows className="w-3 h-3" /> {localPreview.totalRows?.toLocaleString() || 0}</span>
                {!uploading && workflowStep === 0 && (
                    <button onClick={onClear} className="p-1.5 rounded-md hover:bg-red-500/20 transition-colors group" title="Remove dataset">
                        <X className="w-3.5 h-3.5 text-white/30 group-hover:text-red-400" />
                    </button>
                )}
            </div>
        </div>
    );
}

export default PreviewHeader;
