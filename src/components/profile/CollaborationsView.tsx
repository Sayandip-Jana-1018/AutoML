'use client';

import { motion } from 'framer-motion';
import { Users, Database } from 'lucide-react';
import { useRouter } from 'next/navigation';

interface CollaborationsViewProps {
    collaborators: any[];
    themeColor: string;
}

export function CollaborationsView({ collaborators, themeColor }: CollaborationsViewProps) {
    const router = useRouter();

    return (
        <motion.div
            key="collaborations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
        >
            <div className="bg-transparent border border-black dark:border-white rounded-[2rem] p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-2xl" style={{ background: `${themeColor}20` }}>
                        <Users className="w-8 h-8" style={{ color: themeColor }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-black dark:text-white">Shared Projects</h2>
                        <p className="text-black dark:text-white/50 text-base">Projects you're collaborating on</p>
                    </div>
                </div>

                <div className="space-y-3">
                    {collaborators.length === 0 ? (
                        <div className="text-center py-12 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5">
                            <Users className="w-12 h-12 mx-auto mb-4 text-black/30 dark:text-white/30" />
                            <p className="text-black/50 dark:text-white/50 mb-2">No collaborations yet</p>
                            <p className="text-sm text-black/30 dark:text-white/30">Join a project via a share link to start collaborating</p>
                        </div>
                    ) : (
                        collaborators.slice(0, 5).map((collab: any, i: number) => (
                            <div key={i} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5 hover:border-white/20 transition-all">
                                <div className="flex items-center gap-3">
                                    <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: `${themeColor}20` }}>
                                        <Database className="w-5 h-5" style={{ color: themeColor }} />
                                    </div>
                                    <div>
                                        <p className="font-medium text-black dark:text-white">{collab.projectName || 'Untitled Project'}</p>
                                        <p className="text-xs text-black/60 dark:text-white/50">{collab.role || 'Viewer'} • {collab.ownerEmail || 'Unknown owner'}</p>
                                    </div>
                                </div>
                                <button
                                    onClick={() => router.push(`/studio/${collab.projectId}`)}
                                    className="px-4 py-2 rounded-xl text-xs font-bold transition-all hover:brightness-110"
                                    style={{ background: `${themeColor}20`, color: themeColor }}
                                >
                                    Open
                                </button>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </motion.div>
    );
}
