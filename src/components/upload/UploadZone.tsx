'use client';
/**
 * Upload Zone Component - Clean Centered Design with Collapsible Import
 */
import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Cloud, ChevronDown, ChevronUp } from 'lucide-react';
import { SUPPORTED_EXTENSIONS } from '@/lib/file-parsers';

interface FormatBadgeProps {
    format: string;
    themeColor: string;
}

function FormatBadge({ format, themeColor }: FormatBadgeProps) {
    return (
        <motion.span
            whileHover={{ scale: 1.05 }}
            className="px-3 py-1.5 rounded-lg text-xs font-semibold"
            style={{ background: `${themeColor}12`, border: `1px solid ${themeColor}25`, color: themeColor }}
        >
            {format}
        </motion.span>
    );
}

interface UploadZoneProps {
    themeColor: string;
    isDragging: boolean;
    onDragOver: (e: React.DragEvent) => void;
    onDragLeave: (e: React.DragEvent) => void;
    onDrop: (e: React.DragEvent) => void;
    onClick: () => void;
    fileInputRef: React.RefObject<HTMLInputElement | null>;
    onFileSelect: (file: File) => void;
    children?: React.ReactNode;
}

export function UploadZone({
    themeColor,
    isDragging,
    onDragOver,
    onDragLeave,
    onDrop,
    onClick,
    fileInputRef,
    onFileSelect,
    children
}: UploadZoneProps) {
    const [isImportExpanded, setIsImportExpanded] = useState(false);

    return (
        <motion.div key="upload" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-6">
            {/* Drop Zone */}
            <div
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                onDrop={onDrop}
                onClick={onClick}
                className="flex flex-col items-center justify-center rounded-2xl cursor-pointer transition-all py-12 px-8"
                style={{
                    background: isDragging ? `${themeColor}08` : 'rgba(255,255,255,0.02)',
                    border: `2px dashed ${isDragging ? themeColor : 'rgba(255,255,255,0.15)'}`,
                    boxShadow: isDragging ? `0 0 30px ${themeColor}15` : 'none'
                }}
            >
                <input
                    ref={fileInputRef}
                    type="file"
                    accept={SUPPORTED_EXTENSIONS.join(',')}
                    onChange={(e) => e.target.files?.[0] && onFileSelect(e.target.files[0])}
                    className="hidden"
                />
                <motion.div
                    animate={{ y: [0, -8, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
                    className="w-20 h-20 rounded-2xl flex items-center justify-center mb-6"
                    style={{ background: `linear-gradient(135deg, ${themeColor}25, ${themeColor}10)`, boxShadow: `0 0 40px ${themeColor}25` }}
                >
                    <Cloud className="w-10 h-10" style={{ color: themeColor }} />
                </motion.div>
                <h3 className="text-xl font-bold text-white mb-2">Drop your dataset here</h3>
                <p className="text-white/50 mb-6">or click to browse files</p>
                <div className="flex flex-wrap justify-center gap-2">
                    {['CSV', 'XLSX', 'JSON', 'JSONL', 'ZIP', 'HTML'].map(f => (
                        <FormatBadge key={f} format={f} themeColor={themeColor} />
                    ))}
                </div>
            </div>

            {/* Collapsible Divider */}
            <button
                onClick={() => setIsImportExpanded(!isImportExpanded)}
                className="w-full flex items-center gap-4 group cursor-pointer"
            >
                <div className="flex-1 h-px bg-white/10 group-hover:bg-white/20 transition-colors"></div>
                <span className="flex items-center gap-2 text-xs text-white/40 group-hover:text-white/60 uppercase tracking-wider transition-colors">
                    or import from
                    <motion.span
                        animate={{ rotate: isImportExpanded ? 180 : 0 }}
                        transition={{ duration: 0.2 }}
                    >
                        <ChevronDown className="w-4 h-4" />
                    </motion.span>
                </span>
                <div className="flex-1 h-px bg-white/10 group-hover:bg-white/20 transition-colors"></div>
            </button>

            {/* Collapsible Import Section */}
            <AnimatePresence>
                {isImportExpanded && (
                    <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: 'auto' }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.25, ease: 'easeInOut' }}
                        className="overflow-hidden"
                    >
                        {children}
                    </motion.div>
                )}
            </AnimatePresence>
        </motion.div>
    );
}

export default UploadZone;
