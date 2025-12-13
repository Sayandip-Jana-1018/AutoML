'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { useAuth } from '@/context/auth-context';
import { useThemeColor } from '@/context/theme-context';
import { Loader2, Link2, Users, Eye, Edit3, CheckCircle, XCircle, LogIn } from 'lucide-react';
import LightPillar from '@/components/react-bits/LightPillar';
import Link from 'next/link';

interface CollabLinkInfo {
    valid: boolean;
    error?: string;
    link?: {
        id: string;
        projectId: string;
        mode: 'private' | 'public';
        role: 'view' | 'edit';
        creatorEmail?: string;
    };
    project?: {
        id: string;
        name: string;
    };
}

export default function CollabAccessPage() {
    const params = useParams();
    const router = useRouter();
    const { user } = useAuth();
    const { themeColor } = useThemeColor();
    const linkId = params?.linkId as string;

    const [loading, setLoading] = useState(true);
    const [joining, setJoining] = useState(false);
    const [linkInfo, setLinkInfo] = useState<CollabLinkInfo | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Validate link on mount
    useEffect(() => {
        if (!linkId) return;

        const validateLink = async () => {
            try {
                const res = await fetch(`/api/collab/${linkId}`);
                const data = await res.json();
                setLinkInfo(data);
            } catch (err) {
                setError('Failed to validate link');
            } finally {
                setLoading(false);
            }
        };

        validateLink();
    }, [linkId]);

    const handleJoin = async () => {
        if (!linkInfo?.valid) return;

        // For private links, require login
        if (linkInfo.link?.mode === 'private' && !user) {
            router.push(`/login?redirect=/collab/${linkId}`);
            return;
        }

        setJoining(true);
        try {
            const res = await fetch(`/api/collab/${linkId}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    userId: user?.uid || null,
                    userEmail: user?.email || null
                })
            });

            const data = await res.json();

            if (data.success && data.redirectUrl) {
                router.push(data.redirectUrl);
            } else {
                setError(data.error || 'Failed to join');
            }
        } catch (err) {
            setError('Failed to join project');
        } finally {
            setJoining(false);
        }
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-[#020202] flex items-center justify-center">
                <div className="fixed inset-0 z-0 opacity-60">
                    <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.2} pillarWidth={20} glowAmount={0.0015} />
                </div>
                <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="relative z-10 backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-10 text-center"
                >
                    <Loader2 className="w-10 h-10 animate-spin mx-auto mb-4" style={{ color: themeColor }} />
                    <p className="text-white/60">Validating link...</p>
                </motion.div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-[#020202] flex items-center justify-center p-4">
            <div className="fixed inset-0 z-0 opacity-60">
                <LightPillar topColor={themeColor} bottomColor={themeColor} intensity={1.2} pillarWidth={20} glowAmount={0.0015} />
            </div>

            <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="relative z-10 w-full max-w-md backdrop-blur-xl bg-white/5 border border-white/10 rounded-3xl p-8"
            >
                {/* Header */}
                <div className="text-center mb-8">
                    <div
                        className="w-16 h-16 rounded-2xl mx-auto mb-4 flex items-center justify-center bg-white/5 border border-white/10"
                    >
                        <Link2 className="w-8 h-8" style={{ color: themeColor }} />
                    </div>
                    <h1 className="text-2xl font-bold text-white mb-2">Collaboration Invite</h1>
                </div>

                {!linkInfo?.valid ? (
                    /* Invalid Link */
                    <div className="text-center">
                        <XCircle className="w-12 h-12 mx-auto mb-4 text-red-400" />
                        <h2 className="text-lg font-bold text-white mb-2">Link Invalid</h2>
                        <p className="text-white/50 text-sm mb-6">
                            {linkInfo?.error || error || 'This link is no longer valid'}
                        </p>
                        <Link
                            href="/"
                            className="inline-block px-6 py-3 rounded-xl font-bold bg-white/10 border border-white/20 text-white hover:bg-white/15 transition-all"
                        >
                            Go Home
                        </Link>
                    </div>
                ) : (
                    /* Valid Link */
                    <div>
                        {/* Project Info */}
                        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 mb-6">
                            <h3 className="font-bold text-white text-lg mb-1">
                                {linkInfo.project?.name || 'Untitled Project'}
                            </h3>
                            {linkInfo.link?.creatorEmail && (
                                <p className="text-white/40 text-xs">
                                    Shared by {linkInfo.link.creatorEmail}
                                </p>
                            )}
                        </div>

                        {/* Access Level */}
                        <div className="flex items-center justify-center gap-4 mb-6">
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                {linkInfo.link?.mode === 'public' ? (
                                    <Users className="w-4 h-4 text-green-400" />
                                ) : (
                                    <LogIn className="w-4 h-4 text-yellow-400" />
                                )}
                                <span className="text-xs font-medium text-white/60">
                                    {linkInfo.link?.mode === 'public' ? 'Public Access' : 'Login Required'}
                                </span>
                            </div>
                            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/5 border border-white/10">
                                {linkInfo.link?.role === 'edit' ? (
                                    <Edit3 className="w-4 h-4" style={{ color: themeColor }} />
                                ) : (
                                    <Eye className="w-4 h-4 text-blue-400" />
                                )}
                                <span className="text-xs font-medium text-white/60">
                                    {linkInfo.link?.role === 'edit' ? 'Can Edit' : 'View Only'}
                                </span>
                            </div>
                        </div>

                        {/* Login prompt for private links */}
                        {linkInfo.link?.mode === 'private' && !user && (
                            <div className="bg-yellow-500/10 border border-yellow-500/30 rounded-xl p-3 mb-6">
                                <p className="text-yellow-400 text-xs text-center">
                                    You'll need to sign in to access this project
                                </p>
                            </div>
                        )}

                        {/* Join Button */}
                        <button
                            onClick={handleJoin}
                            disabled={joining}
                            className="w-full py-4 rounded-2xl font-bold transition-all hover:scale-[1.02] flex items-center justify-center gap-2 bg-white/10 border border-white/20 hover:bg-white/15 disabled:opacity-50"
                            style={{ color: themeColor }}
                        >
                            {joining ? (
                                <Loader2 className="w-5 h-5 animate-spin" />
                            ) : (
                                <>
                                    <CheckCircle className="w-5 h-5" />
                                    {linkInfo.link?.mode === 'private' && !user ? 'Sign In to Join' : 'Join Project'}
                                </>
                            )}
                        </button>
                    </div>
                )}
            </motion.div>
        </div>
    );
}
