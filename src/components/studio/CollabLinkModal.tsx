'use client';

import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
    X, Link2, Copy, Trash2, Check, Plus,
    Eye, Edit3, Users, Lock, Clock, Hash, Loader2
} from 'lucide-react';
import { useThemeColor } from '@/context/theme-context';
import { useAuth } from '@/context/auth-context';

interface CollabLink {
    id: string;
    url: string;
    mode: 'private' | 'public';
    role: 'view' | 'edit';
    expiresAt: string | null;
    maxUses: number | null;
    uses: number;
    createdAt: string;
}

interface CollabLinkModalProps {
    isOpen: boolean;
    onClose: () => void;
    projectId: string;
}

export default function CollabLinkModal({ isOpen, onClose, projectId }: CollabLinkModalProps) {
    const { themeColor } = useThemeColor();
    const { user } = useAuth();

    const [links, setLinks] = useState<CollabLink[]>([]);
    const [loading, setLoading] = useState(false);
    const [creating, setCreating] = useState(false);
    const [copied, setCopied] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // New link form
    const [newMode, setNewMode] = useState<'private' | 'public'>('private');
    const [newRole, setNewRole] = useState<'view' | 'edit'>('view');
    const [expiresInHours, setExpiresInHours] = useState<string>('');
    const [maxUses, setMaxUses] = useState<string>('');

    // Fetch existing links
    useEffect(() => {
        if (isOpen && projectId && user) {
            fetchLinks();
            setError(null);
        }
    }, [isOpen, projectId, user]);

    const fetchLinks = async () => {
        setLoading(true);
        try {
            const res = await fetch(`/api/collab/create?projectId=${projectId}&userId=${user?.uid}`);
            const data = await res.json();
            setLinks(data.links || []);
        } catch (err) {
            console.error('Failed to fetch links:', err);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = async () => {
        if (!projectId || !user) return;

        setCreating(true);
        setError(null);
        try {
            const res = await fetch('/api/collab/create', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    projectId,
                    userId: user.uid,
                    userEmail: user.email,
                    mode: newMode,
                    role: newRole,
                    expiresInHours: expiresInHours ? parseInt(expiresInHours) : undefined,
                    maxUses: maxUses ? parseInt(maxUses) : undefined
                })
            });

            const data = await res.json();
            if (data.linkId) {
                await fetchLinks();
                setExpiresInHours('');
                setMaxUses('');
            } else if (data.error) {
                setError(data.error);
            }
        } catch (err: any) {
            setError(err.message || 'Failed to create link');
        } finally {
            setCreating(false);
        }
    };

    const handleCopy = async (url: string, linkId: string) => {
        await navigator.clipboard.writeText(url);
        setCopied(linkId);
        setTimeout(() => setCopied(null), 2000);
    };

    const handleRevoke = async (linkId: string) => {
        try {
            await fetch(`/api/collab/${linkId}?userId=${user?.uid}`, {
                method: 'DELETE'
            });
            setLinks(links.filter(l => l.id !== linkId));
        } catch (err) {
            console.error('Failed to revoke link:', err);
        }
    };

    const formatDate = (dateStr: string) => {
        const date = new Date(dateStr);
        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="absolute inset-0 bg-black/70 backdrop-blur-md"
                        onClick={onClose}
                    />
                    <motion.div
                        initial={{ scale: 0.9, opacity: 0, y: 20 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.9, opacity: 0, y: 20 }}
                        className="relative w-full max-w-md backdrop-blur-2xl bg-black/50 border border-white/15 rounded-3xl p-6 overflow-hidden shadow-2xl"
                        style={{ boxShadow: `0 0 60px ${themeColor}20, 0 0 120px ${themeColor}10` }}
                    >
                        {/* Gradient glow */}
                        <div
                            className="absolute -top-20 -right-20 w-40 h-40 rounded-full blur-3xl opacity-30"
                            style={{ background: `radial-gradient(circle, ${themeColor}, transparent)` }}
                        />

                        {/* Header - Center aligned */}
                        <div className="flex flex-col items-center text-center mb-6 relative z-10">
                            <div
                                className="w-14 h-14 rounded-2xl flex items-center justify-center mb-3 border border-white/20"
                                style={{ background: `linear-gradient(135deg, ${themeColor}30, ${themeColor}10)` }}
                            >
                                <Link2 className="w-7 h-7" style={{ color: themeColor }} />
                            </div>
                            <h2 className="text-xl font-bold text-white mb-1">Share Project</h2>
                            <p className="text-xs text-white/50">Create collaboration links to invite others</p>
                            <button
                                onClick={onClose}
                                className="absolute -top-1 -right-1 w-8 h-8 rounded-full flex items-center justify-center bg-white/5 border border-white/10 hover:bg-white/10 transition-all"
                            >
                                <X className="w-4 h-4 text-white/60" />
                            </button>
                        </div>

                        {/* Error Message */}
                        {error && (
                            <div className="bg-red-500/10 border border-red-500/30 rounded-xl p-3 mb-4 text-center">
                                <p className="text-red-400 text-xs">{error}</p>
                            </div>
                        )}

                        {/* Create New Link Form */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-4 relative z-10">
                            <div className="flex items-center justify-center gap-2 mb-4">
                                <Plus className="w-4 h-4" style={{ color: themeColor }} />
                                <span className="text-sm font-medium text-white">New Link</span>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-3">
                                {/* Mode Toggle */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 uppercase tracking-wider text-center block">Access</label>
                                    <div className="flex rounded-xl overflow-hidden border border-white/10">
                                        <button
                                            onClick={() => setNewMode('private')}
                                            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${newMode === 'private' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                                            style={{ backgroundColor: newMode === 'private' ? `${themeColor}30` : 'transparent' }}
                                        >
                                            <Lock className="w-3.5 h-3.5" /> Private
                                        </button>
                                        <button
                                            onClick={() => setNewMode('public')}
                                            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${newMode === 'public' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                                            style={{ backgroundColor: newMode === 'public' ? `${themeColor}30` : 'transparent' }}
                                        >
                                            <Users className="w-3.5 h-3.5" /> Public
                                        </button>
                                    </div>
                                </div>

                                {/* Role Toggle */}
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 uppercase tracking-wider text-center block">Permission</label>
                                    <div className="flex rounded-xl overflow-hidden border border-white/10">
                                        <button
                                            onClick={() => setNewRole('view')}
                                            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${newRole === 'view' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                                            style={{ backgroundColor: newRole === 'view' ? `${themeColor}30` : 'transparent' }}
                                        >
                                            <Eye className="w-3.5 h-3.5" /> View
                                        </button>
                                        <button
                                            onClick={() => setNewRole('edit')}
                                            className={`flex-1 py-2.5 text-xs font-medium flex items-center justify-center gap-1.5 transition-all ${newRole === 'edit' ? 'text-white' : 'text-white/40 hover:text-white/60'}`}
                                            style={{ backgroundColor: newRole === 'edit' ? `${themeColor}30` : 'transparent' }}
                                        >
                                            <Edit3 className="w-3.5 h-3.5" /> Edit
                                        </button>
                                    </div>
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3 mb-4">
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center justify-center gap-1">
                                        <Clock className="w-3 h-3" /> Expires
                                    </label>
                                    <select
                                        value={expiresInHours}
                                        onChange={(e) => setExpiresInHours(e.target.value)}
                                        className="w-full bg-black/60 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-white/40 transition-all appearance-none cursor-pointer text-center"
                                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                                    >
                                        <option value="" className="bg-[#1a1a1a]">Never</option>
                                        <option value="1" className="bg-[#1a1a1a]">1 hour</option>
                                        <option value="24" className="bg-[#1a1a1a]">24 hours</option>
                                        <option value="168" className="bg-[#1a1a1a]">7 days</option>
                                        <option value="720" className="bg-[#1a1a1a]">30 days</option>
                                    </select>
                                </div>
                                <div className="space-y-1.5">
                                    <label className="text-[10px] text-white/40 uppercase tracking-wider flex items-center justify-center gap-1">
                                        <Hash className="w-3 h-3" /> Max Uses
                                    </label>
                                    <select
                                        value={maxUses}
                                        onChange={(e) => setMaxUses(e.target.value)}
                                        className="w-full bg-black/60 backdrop-blur-xl border border-white/20 rounded-xl px-3 py-2.5 text-xs text-white outline-none focus:border-white/40 transition-all appearance-none cursor-pointer text-center"
                                        style={{ backgroundImage: 'url("data:image/svg+xml,%3Csvg xmlns=\'http://www.w3.org/2000/svg\' fill=\'none\' viewBox=\'0 0 24 24\' stroke=\'white\' stroke-width=\'2\'%3E%3Cpath stroke-linecap=\'round\' stroke-linejoin=\'round\' d=\'M19 9l-7 7-7-7\'/%3E%3C/svg%3E")', backgroundRepeat: 'no-repeat', backgroundPosition: 'right 8px center', backgroundSize: '12px' }}
                                    >
                                        <option value="" className="bg-[#1a1a1a]">Unlimited</option>
                                        <option value="1" className="bg-[#1a1a1a]">1 use</option>
                                        <option value="5" className="bg-[#1a1a1a]">5 uses</option>
                                        <option value="10" className="bg-[#1a1a1a]">10 uses</option>
                                        <option value="50" className="bg-[#1a1a1a]">50 uses</option>
                                    </select>
                                </div>
                            </div>

                            <button
                                onClick={handleCreate}
                                disabled={creating}
                                className="w-full py-3 rounded-xl font-bold text-sm transition-all hover:scale-[1.02] flex items-center justify-center gap-2 disabled:opacity-50 text-white border"
                                style={{
                                    background: `linear-gradient(135deg, ${themeColor}40, ${themeColor}20)`,
                                    borderColor: `${themeColor}50`
                                }}
                            >
                                {creating ? (
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                    <>
                                        <Plus className="w-4 h-4" />
                                        Create Link
                                    </>
                                )}
                            </button>
                        </div>

                        {/* Existing Links */}
                        <div className="space-y-2 max-h-[180px] overflow-y-auto relative z-10">
                            <label className="text-[10px] text-white/40 uppercase tracking-wider block mb-2 text-center">
                                Active Links ({links.length})
                            </label>

                            {loading ? (
                                <div className="flex justify-center py-4">
                                    <Loader2 className="w-5 h-5 animate-spin" style={{ color: themeColor }} />
                                </div>
                            ) : links.length === 0 ? (
                                <p className="text-center text-white/30 text-xs py-4">No active links yet</p>
                            ) : (
                                links.map((link) => (
                                    <div
                                        key={link.id}
                                        className="bg-white/5 border border-white/10 rounded-xl p-3 flex items-center justify-between hover:border-white/20 transition-all"
                                    >
                                        <div className="flex items-center gap-2 min-w-0 flex-1">
                                            <div className="flex items-center gap-1.5">
                                                {link.mode === 'private' ? (
                                                    <Lock className="w-3.5 h-3.5 text-yellow-400" />
                                                ) : (
                                                    <Users className="w-3.5 h-3.5 text-green-400" />
                                                )}
                                                {link.role === 'edit' ? (
                                                    <Edit3 className="w-3.5 h-3.5" style={{ color: themeColor }} />
                                                ) : (
                                                    <Eye className="w-3.5 h-3.5 text-blue-400" />
                                                )}
                                            </div>
                                            <div className="min-w-0">
                                                <p className="text-white/60 text-[10px] truncate">{link.url}</p>
                                                <p className="text-white/30 text-[9px]">
                                                    {link.uses} use{link.uses !== 1 ? 's' : ''} • {formatDate(link.createdAt)}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-1.5 shrink-0">
                                            <button
                                                onClick={() => handleCopy(link.url, link.id)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-white/10 transition-all border border-white/10"
                                            >
                                                {copied === link.id ? (
                                                    <Check className="w-3.5 h-3.5 text-green-400" />
                                                ) : (
                                                    <Copy className="w-3.5 h-3.5 text-white/60" />
                                                )}
                                            </button>
                                            <button
                                                onClick={() => handleRevoke(link.id)}
                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-white/5 hover:bg-red-500/20 transition-all border border-white/10"
                                            >
                                                <Trash2 className="w-3.5 h-3.5 text-white/60 hover:text-red-400" />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>

                        {/* Hint */}
                        <p className="text-[10px] text-white/30 text-center mt-4 relative z-10">
                            Private links require login • Public links allow anonymous access
                        </p>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
