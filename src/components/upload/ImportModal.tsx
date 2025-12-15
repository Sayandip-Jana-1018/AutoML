'use client';
/**
 * Import Modal Component - Clean Centered Design
 */
import React from 'react';
import { motion } from 'framer-motion';
import { Link, Zap, Database, Loader2, ExternalLink } from 'lucide-react';

interface ImportModalProps {
    themeColor: string;
    showUrlImport: boolean;
    setShowUrlImport: (show: boolean) => void;
    importMode: 'url' | 'api' | 'kaggle';
    setImportMode: (mode: 'url' | 'api' | 'kaggle') => void;
    importUrl: string;
    setImportUrl: (url: string) => void;
    apiHeaders: string;
    setApiHeaders: (headers: string) => void;
    kaggleDataset: string;
    setKaggleDataset: (dataset: string) => void;
    kaggleUsername: string;
    setKaggleUsername: (username: string) => void;
    kaggleApiKey: string;
    setKaggleApiKey: (key: string) => void;
    fetchingUrl: boolean;
    onImport: () => void;
}

const MODE_TABS = [
    { key: 'url', label: 'URL / Sheets', icon: Link },
    { key: 'api', label: 'REST API', icon: Zap },
    { key: 'kaggle', label: 'Kaggle', icon: Database },
] as const;

export function ImportModal({
    themeColor,
    showUrlImport,
    setShowUrlImport,
    importMode,
    setImportMode,
    importUrl,
    setImportUrl,
    apiHeaders,
    setApiHeaders,
    kaggleDataset,
    setKaggleDataset,
    kaggleUsername,
    setKaggleUsername,
    kaggleApiKey,
    setKaggleApiKey,
    fetchingUrl,
    onImport
}: ImportModalProps) {

    if (!showUrlImport) {
        return (
            <div className="flex justify-center">
                <motion.button
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => setShowUrlImport(true)}
                    className="flex items-center gap-2 px-6 py-3 rounded-xl font-medium text-white/80 hover:text-white transition-colors"
                    style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)' }}
                >
                    <Link className="w-4 h-4" />
                    Import from URL, API, or Kaggle
                </motion.button>
            </div>
        );
    }

    return (
        <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="rounded-2xl p-6 space-y-5"
            style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.1)' }}
        >
            {/* Mode Tabs */}
            <div className="flex justify-center gap-2 p-1 rounded-xl" style={{ background: 'rgba(255,255,255,0.03)' }}>
                {MODE_TABS.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setImportMode(tab.key)}
                        className={`flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-medium transition-all ${importMode === tab.key ? 'text-white' : 'text-white/50 hover:text-white/80'}`}
                        style={importMode === tab.key ? { background: themeColor, boxShadow: `0 0 15px ${themeColor}40` } : {}}
                    >
                        <tab.icon className="w-4 h-4" />
                        {tab.label}
                    </button>
                ))}
            </div>

            {/* URL / Sheets */}
            {importMode === 'url' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center">Enter URL or Google Sheets link</label>
                        <input
                            type="text"
                            placeholder="https://example.com/data.csv"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex justify-center">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onImport}
                            disabled={fetchingUrl || !importUrl.trim()}
                            className="px-8 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                        >
                            {fetchingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Fetch'}
                        </motion.button>
                    </div>
                    <p className="text-xs text-white/40 text-center">Supports CSV, JSON, JSONL files and public Google Sheets</p>
                </div>
            )}

            {/* REST API */}
            {importMode === 'api' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center">API Endpoint</label>
                        <input
                            type="text"
                            placeholder="https://api.example.com/data"
                            value={importUrl}
                            onChange={(e) => setImportUrl(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center">Headers (JSON format, optional)</label>
                        <input
                            type="text"
                            placeholder='{"Authorization": "Bearer token"}'
                            value={apiHeaders}
                            onChange={(e) => setApiHeaders(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors font-mono text-sm"
                        />
                    </div>
                    <div className="flex justify-center">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onImport}
                            disabled={fetchingUrl || !importUrl.trim()}
                            className="px-8 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                        >
                            {fetchingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Fetch from API'}
                        </motion.button>
                    </div>
                </div>
            )}

            {/* Kaggle */}
            {importMode === 'kaggle' && (
                <div className="space-y-4">
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center flex items-center justify-center gap-2">
                            <Database className="w-4 h-4" />
                            Kaggle Dataset
                        </label>
                        <input
                            type="text"
                            placeholder="username/dataset-name"
                            value={kaggleDataset}
                            onChange={(e) => setKaggleDataset(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4" />
                            Kaggle Username (optional if using Token)
                        </label>
                        <input
                            type="text"
                            placeholder="Your Kaggle username"
                            value={kaggleUsername}
                            onChange={(e) => setKaggleUsername(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="space-y-2">
                        <label className="block text-sm font-medium text-white/60 text-center flex items-center justify-center gap-2">
                            <Zap className="w-4 h-4" />
                            Kaggle API Key / Token
                        </label>
                        <input
                            type="password"
                            placeholder="Your Kaggle API key or Token"
                            value={kaggleApiKey}
                            onChange={(e) => setKaggleApiKey(e.target.value)}
                            className="w-full px-4 py-3 rounded-xl text-white text-center bg-black/30 border border-white/10 focus:border-white/30 focus:outline-none transition-colors"
                        />
                    </div>
                    <div className="flex justify-center">
                        <motion.button
                            whileHover={{ scale: 1.02 }}
                            whileTap={{ scale: 0.98 }}
                            onClick={onImport}
                            disabled={fetchingUrl || !kaggleDataset.trim() || !kaggleApiKey.trim()}
                            className="px-8 py-2.5 rounded-xl font-semibold text-white disabled:opacity-50"
                            style={{ background: `linear-gradient(135deg, ${themeColor}, ${themeColor}80)` }}
                        >
                            {fetchingUrl ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Download from Kaggle'}
                        </motion.button>
                    </div>
                    <p className="text-xs text-white/40 text-center flex items-center justify-center gap-1">
                        Get your API key from <a href="https://kaggle.com/settings" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/60 inline-flex items-center gap-1" style={{ color: themeColor }}>kaggle.com/settings <ExternalLink className="w-3 h-3" /></a>
                    </p>
                </div>
            )}

            {/* Cancel */}
            <button onClick={() => setShowUrlImport(false)} className="w-full text-center py-2 text-sm text-white/50 hover:text-white/80 transition-colors">
                Cancel
            </button>
        </motion.div>
    );
}

export default ImportModal;
