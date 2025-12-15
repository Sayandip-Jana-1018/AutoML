
import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Key, Plus, Trash2, Copy, Check, Shield, AlertCircle, Loader2 } from 'lucide-react';
import { useAuth } from '@/context/auth-context';

interface ApiKey {
    id: string;
    name: string;
    keyPrefix: string;
    createdAt: string;
    lastUsed: string | null;
    isActive: boolean;
}

interface ApiKeyModalProps {
    isOpen: boolean;
    onClose: () => void;
    themeColor: string;
}

export const ApiKeyModal = ({ isOpen, onClose, themeColor }: ApiKeyModalProps) => {
    const { user } = useAuth();
    const [keys, setKeys] = useState<ApiKey[]>([]);
    const [loading, setLoading] = useState(true);
    const [creating, setCreating] = useState(false);
    const [newKeyName, setNewKeyName] = useState('');
    const [generatedKey, setGeneratedKey] = useState<string | null>(null);
    const [copied, setCopied] = useState(false);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && user) {
            fetchKeys();
        }
    }, [isOpen, user]);

    const fetchKeys = async () => {
        setLoading(true);
        setError(null);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/keys', {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await res.json();
            if (res.ok) {
                setKeys(data.keys || []);
            } else {
                setError(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateKey = async () => {
        if (!newKeyName.trim()) return;
        setCreating(true);
        setError(null);
        try {
            const token = await user?.getIdToken();
            const res = await fetch('/api/keys', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ name: newKeyName })
            });
            const data = await res.json();

            if (res.ok) {
                setGeneratedKey(data.key);
                setNewKeyName('');
                fetchKeys(); // Refresh list
            } else {
                setError(data.error);
            }
        } catch (err: any) {
            setError(err.message);
        } finally {
            setCreating(false);
        }
    };

    const handleRevokeKey = async (keyId: string) => {
        if (!confirm('Are you sure you want to revoke this API key? This action cannot be undone.')) return;

        try {
            const token = await user?.getIdToken();
            const res = await fetch(`/api/keys?id=${keyId}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                fetchKeys(); // Refresh list
            } else {
                const data = await res.json();
                alert(data.error);
            }
        } catch (err) {
            console.error('Revoke error', err);
        }
    };

    const copyToClipboard = (text: string) => {
        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-sm"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 20 }}
                        className="relative w-full max-w-lg bg-[#0a0a0a] border border-white/10 rounded-2xl overflow-hidden shadow-2xl"
                        style={{ boxShadow: `0 0 40px ${themeColor}15` }}
                    >
                        {/* Header */}
                        <div className="px-6 py-4 flex items-center justify-between border-b border-white/5 bg-white/[0.02]">
                            <div className="flex items-center gap-3">
                                <div className="p-2 rounded-lg bg-white/5 border border-white/10">
                                    <Key className="w-5 h-5 text-white" />
                                </div>
                                <div>
                                    <h3 className="font-bold text-white">API Keys</h3>
                                    <p className="text-xs text-white/40">Manage access for external applications</p>
                                </div>
                            </div>
                            <button
                                onClick={onClose}
                                className="p-2 rounded-full hover:bg-white/10 transition-colors"
                            >
                                <X className="w-4 h-4 text-white/50" />
                            </button>
                        </div>

                        <div className="p-6">
                            {/* Generation Success State */}
                            {generatedKey ? (
                                <div className="mb-6 p-4 rounded-xl bg-green-500/10 border border-green-500/20">
                                    <div className="flex items-center gap-2 mb-2 text-green-400 font-bold text-sm">
                                        <Check className="w-4 h-4" />
                                        Key Generated Successfully
                                    </div>
                                    <p className="text-xs text-white/60 mb-3">
                                        Copy this key now. It will never be shown again.
                                    </p>
                                    <div className="flex items-center gap-2 bg-black/40 p-3 rounded-lg border border-green-500/20">
                                        <code className="flex-1 text-sm font-mono text-green-100 break-all">
                                            {generatedKey}
                                        </code>
                                        <button
                                            onClick={() => copyToClipboard(generatedKey)}
                                            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                        >
                                            {copied ? <Check className="w-4 h-4 text-green-400" /> : <Copy className="w-4 h-4 text-white/50" />}
                                        </button>
                                    </div>
                                    <button
                                        onClick={() => setGeneratedKey(null)}
                                        className="mt-4 text-xs text-white/40 underline hover:text-white transition-colors"
                                    >
                                        Done, go back to list
                                    </button>
                                </div>
                            ) : (
                                <>
                                    {/* Create New Key Form */}
                                    <div className="flex gap-2 mb-6">
                                        <div className="relative flex-1">
                                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-white/30" />
                                            <input
                                                type="text"
                                                placeholder="Key Name (e.g. My Python Script)"
                                                value={newKeyName}
                                                onChange={(e) => setNewKeyName(e.target.value)}
                                                className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2.5 text-sm text-white placeholder-white/30 focus:outline-none focus:border-white/30 transition-all"
                                                onKeyDown={(e) => e.key === 'Enter' && handleCreateKey()}
                                            />
                                        </div>
                                        <button
                                            onClick={handleCreateKey}
                                            disabled={creating || !newKeyName.trim()}
                                            className="px-4 py-2.5 rounded-xl font-bold text-sm text-black flex items-center gap-2 disabled:opacity-50 transition-all hover:brightness-110"
                                            style={{ background: themeColor }}
                                        >
                                            {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                                            Create
                                        </button>
                                    </div>

                                    {/* Keys List */}
                                    <div className="space-y-3 max-h-[300px] overflow-y-auto pr-1">
                                        {loading ? (
                                            <div className="flex justify-center py-8">
                                                <Loader2 className="w-6 h-6 animate-spin text-white/20" />
                                            </div>
                                        ) : keys.length === 0 ? (
                                            <div className="text-center py-8 px-4 border border-dashed border-white/10 rounded-xl">
                                                <Key className="w-8 h-8 text-white/10 mx-auto mb-2" />
                                                <p className="text-sm text-white/40">No API keys yet</p>
                                            </div>
                                        ) : (
                                            keys.map((key) => (
                                                <div
                                                    key={key.id}
                                                    className="p-3 rounded-xl bg-white/[0.03] border border-white/5 hover:border-white/10 transition-all flex items-center justify-between group"
                                                >
                                                    <div>
                                                        <div className="flex items-center gap-2 mb-1">
                                                            <span className="font-bold text-sm text-white">{key.name}</span>
                                                            <span className="text-[10px] font-mono text-white/30 px-1.5 py-0.5 rounded bg-white/5 border border-white/5">
                                                                {key.keyPrefix}...
                                                            </span>
                                                        </div>
                                                        <div className="flex items-center gap-3 text-[10px] text-white/40">
                                                            <span>Created: {new Date(key.createdAt).toLocaleDateString()}</span>
                                                            {key.lastUsed && (
                                                                <span className="text-green-400/70">
                                                                    Last used: {new Date(key.lastUsed).toLocaleDateString()}
                                                                </span>
                                                            )}
                                                        </div>
                                                    </div>
                                                    <button
                                                        onClick={() => handleRevokeKey(key.id)}
                                                        className="p-2 rounded-lg bg-red-500/10 text-red-500 opacity-0 group-hover:opacity-100 transition-all hover:bg-red-500/20"
                                                        title="Revoke Key"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </div>
                                            ))
                                        )}
                                    </div>
                                </>
                            )}

                            {error && (
                                <div className="mt-4 p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-red-400 text-xs text-left">
                                    <AlertCircle className="w-4 h-4 shrink-0" />
                                    {error}
                                </div>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
};
