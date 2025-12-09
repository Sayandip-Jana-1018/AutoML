"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
    X,
    Users,
    Mail,
    Eye,
    Edit3,
    Play,
    Trash2,
    Plus,
    Globe,
    Lock,
    UserPlus,
    Check
} from "lucide-react";

interface Collaborator {
    uid: string;
    email: string;
    role: 'view' | 'edit' | 'run';
    addedAt: Date;
}

interface ShareModalProps {
    isOpen: boolean;
    onClose: () => void;
    resourceId: string;
    resourceType: 'dataset' | 'model' | 'project';
    resourceName: string;
    visibility: 'private' | 'team' | 'public';
    collaborators: Collaborator[];
    onShare: (email: string, role: 'view' | 'edit' | 'run') => Promise<boolean>;
    onRemove: (uid: string) => Promise<boolean>;
    onVisibilityChange: (visibility: 'private' | 'team' | 'public') => Promise<boolean>;
}

export function ShareModal({
    isOpen,
    onClose,
    resourceId,
    resourceType,
    resourceName,
    visibility,
    collaborators,
    onShare,
    onRemove,
    onVisibilityChange
}: ShareModalProps) {
    const [email, setEmail] = useState('');
    const [role, setRole] = useState<'view' | 'edit' | 'run'>('view');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState<string | null>(null);

    const handleShare = async () => {
        if (!email.trim()) {
            setError('Please enter an email address');
            return;
        }

        setLoading(true);
        setError(null);

        try {
            const result = await onShare(email, role);
            if (result) {
                setEmail('');
                setSuccess('Collaborator added successfully');
                setTimeout(() => setSuccess(null), 3000);
            } else {
                setError('Failed to add collaborator');
            }
        } catch (err) {
            setError('Failed to add collaborator');
        } finally {
            setLoading(false);
        }
    };

    const handleRemove = async (uid: string) => {
        setLoading(true);
        try {
            await onRemove(uid);
        } finally {
            setLoading(false);
        }
    };

    const roleIcons = {
        view: Eye,
        edit: Edit3,
        run: Play
    };

    const roleColors = {
        view: 'text-blue-400',
        edit: 'text-yellow-400',
        run: 'text-green-400'
    };

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95, y: 20 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.95, y: 20 }}
                        className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 w-full max-w-lg z-50"
                    >
                        <div className="bg-gray-900 rounded-2xl border border-white/10 shadow-2xl overflow-hidden">
                            {/* Header */}
                            <div className="flex items-center justify-between px-6 py-4 border-b border-white/10">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 rounded-lg bg-blue-500/20">
                                        <Users className="w-5 h-5 text-blue-400" />
                                    </div>
                                    <div>
                                        <h2 className="text-lg font-semibold text-white">Share {resourceType}</h2>
                                        <p className="text-sm text-gray-400">{resourceName}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={onClose}
                                    className="p-2 rounded-lg hover:bg-white/5 text-gray-400"
                                >
                                    <X className="w-5 h-5" />
                                </button>
                            </div>

                            {/* Content */}
                            <div className="p-6 space-y-6">
                                {/* Visibility */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        Visibility
                                    </label>
                                    <div className="flex gap-2">
                                        {([
                                            { value: 'private', label: 'Private', icon: Lock },
                                            { value: 'team', label: 'Team', icon: Users },
                                            { value: 'public', label: 'Public', icon: Globe }
                                        ] as const).map(option => (
                                            <button
                                                key={option.value}
                                                onClick={() => onVisibilityChange(option.value)}
                                                className={`
                                                    flex-1 flex items-center justify-center gap-2 py-2.5 rounded-xl
                                                    border transition-all
                                                    ${visibility === option.value
                                                        ? 'bg-blue-500/20 border-blue-500/50 text-blue-300'
                                                        : 'bg-white/5 border-white/10 text-gray-400 hover:text-white'
                                                    }
                                                `}
                                            >
                                                <option.icon className="w-4 h-4" />
                                                {option.label}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Add Collaborator */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        Add People
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="relative flex-1">
                                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-500" />
                                            <input
                                                type="email"
                                                placeholder="Enter email address"
                                                value={email}
                                                onChange={(e) => setEmail(e.target.value)}
                                                className="w-full pl-10 pr-4 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white placeholder-gray-500 focus:outline-none focus:border-blue-500/50"
                                            />
                                        </div>
                                        <select
                                            value={role}
                                            onChange={(e) => setRole(e.target.value as 'view' | 'edit' | 'run')}
                                            className="px-3 py-2.5 rounded-xl bg-white/5 border border-white/10 text-white focus:outline-none focus:border-blue-500/50"
                                        >
                                            <option value="view">View</option>
                                            <option value="edit">Edit</option>
                                            <option value="run">Run</option>
                                        </select>
                                        <button
                                            onClick={handleShare}
                                            disabled={loading}
                                            className="px-4 py-2.5 rounded-xl bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-colors disabled:opacity-50"
                                        >
                                            <UserPlus className="w-5 h-5" />
                                        </button>
                                    </div>

                                    {error && (
                                        <p className="mt-2 text-sm text-red-400">{error}</p>
                                    )}
                                    {success && (
                                        <p className="mt-2 text-sm text-green-400 flex items-center gap-1">
                                            <Check className="w-4 h-4" />
                                            {success}
                                        </p>
                                    )}
                                </div>

                                {/* Collaborators List */}
                                <div>
                                    <label className="block text-sm font-medium text-gray-300 mb-3">
                                        People with access ({collaborators.length})
                                    </label>
                                    <div className="space-y-2 max-h-48 overflow-y-auto">
                                        {collaborators.length === 0 ? (
                                            <p className="text-sm text-gray-500 text-center py-4">
                                                No collaborators yet
                                            </p>
                                        ) : (
                                            collaborators.map((collab) => {
                                                const RoleIcon = roleIcons[collab.role];
                                                return (
                                                    <div
                                                        key={collab.uid}
                                                        className="flex items-center justify-between p-3 rounded-xl bg-white/5"
                                                    >
                                                        <div className="flex items-center gap-3">
                                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-blue-500 to-purple-500 flex items-center justify-center text-white text-sm font-medium">
                                                                {collab.email[0].toUpperCase()}
                                                            </div>
                                                            <div>
                                                                <p className="text-sm text-white">{collab.email}</p>
                                                                <div className={`flex items-center gap-1 text-xs ${roleColors[collab.role]}`}>
                                                                    <RoleIcon className="w-3 h-3" />
                                                                    <span className="capitalize">{collab.role}</span>
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <button
                                                            onClick={() => handleRemove(collab.uid)}
                                                            className="p-2 rounded-lg hover:bg-red-500/20 text-gray-400 hover:text-red-400 transition-colors"
                                                        >
                                                            <Trash2 className="w-4 h-4" />
                                                        </button>
                                                    </div>
                                                );
                                            })
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Footer */}
                            <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-white/10 bg-white/5">
                                <button
                                    onClick={onClose}
                                    className="px-4 py-2 rounded-lg text-gray-400 hover:text-white transition-colors"
                                >
                                    Done
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}

export default ShareModal;
