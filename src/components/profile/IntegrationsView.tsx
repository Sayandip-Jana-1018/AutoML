'use client';

import { motion } from 'framer-motion';
import { Link2, Github, Code, FileCode } from 'lucide-react';

interface IntegrationsViewProps {
    themeColor: string;
}

export function IntegrationsView({ themeColor }: IntegrationsViewProps) {
    const integrations = [
        {
            name: 'GitHub',
            description: 'Push train.py to repositories',
            icon: Github,
            color: '#24292e',
            status: 'Connected',
            statusColor: 'green'
        },
        {
            name: 'VS Code Extension',
            description: 'Real-time collaboration in your IDE',
            icon: Code,
            color: '#007ACC',
            status: 'Available',
            statusColor: 'gray'
        },
        {
            name: 'Jupyter Notebooks',
            description: 'Export & import .ipynb files',
            icon: FileCode,
            color: '#F37626',
            status: 'Ready',
            statusColor: 'green'
        }
    ];

    return (
        <motion.div
            key="integrations"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full"
        >
            <div className="bg-transparent border border-black dark:border-white rounded-[2rem] p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-2xl" style={{ background: `${themeColor}20` }}>
                        <Link2 className="w-8 h-8" style={{ color: themeColor }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-black dark:text-white">Connected Services</h2>
                        <p className="text-black dark:text-white/50 text-base">Manage your external integrations</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {integrations.map((integration, i) => (
                        <div key={i} className="flex items-center justify-between p-5 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5">
                            <div className="flex items-center gap-4">
                                <div className="w-12 h-12 rounded-xl flex items-center justify-center" style={{ background: integration.color }}>
                                    <integration.icon className="w-6 h-6 text-white" />
                                </div>
                                <div>
                                    <p className="font-bold text-black dark:text-white">{integration.name}</p>
                                    <p className="text-xs text-black/60 dark:text-white/50">{integration.description}</p>
                                </div>
                            </div>
                            <span className={`px-3 py-1.5 rounded-full text-xs font-bold border ${integration.statusColor === 'green'
                                    ? 'bg-green-500/20 text-green-400 border-green-500/30'
                                    : 'bg-white/10 text-white/50 border-white/10'
                                }`}>
                                {integration.status}
                            </span>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
