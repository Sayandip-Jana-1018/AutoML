'use client';

import { motion } from 'framer-motion';
import { Database, Users, Link2, Lock, Bell } from 'lucide-react';

type ViewType = 'overview' | 'collaborations' | 'integrations' | 'security' | 'notifications';

interface ProfileSidebarProps {
    currentView: ViewType;
    setCurrentView: (view: ViewType) => void;
    themeColor: string;
    datasetsCount: number;
    modelsCount: number;
}

export function ProfileSidebar({
    currentView,
    setCurrentView,
    themeColor,
    datasetsCount,
    modelsCount
}: ProfileSidebarProps) {
    const navItems = [
        { id: 'overview' as ViewType, label: 'Overview', icon: Database },
        { id: 'collaborations' as ViewType, label: 'Collaborations', icon: Users },
        { id: 'integrations' as ViewType, label: 'Integrations', icon: Link2 },
        { id: 'security' as ViewType, label: 'Security', icon: Lock },
        { id: 'notifications' as ViewType, label: 'Notifications', icon: Bell },
    ];

    return (
        <div className="flex flex-col gap-5">
            {/* Stats Card */}
            <div className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-3xl p-5 flex justify-between items-center">
                <div className="text-center flex-1 border-r border-black dark:border-white">
                    <div className="text-2xl font-black text-black dark:text-white">{datasetsCount}</div>
                    <div className="text-[10px] text-black/70 dark:text-white/50 uppercase tracking-wider font-bold mt-1">Datasets</div>
                </div>
                <div className="text-center flex-1">
                    <div className="text-2xl font-black text-black dark:text-white">{modelsCount}</div>
                    <div className="text-[10px] text-black/70 dark:text-white/50 uppercase tracking-wider font-bold mt-1">Models</div>
                </div>
            </div>

            {/* Navigation Menu */}
            <div className="bg-black/5 dark:bg-white/5 border border-black dark:border-white rounded-3xl overflow-hidden">
                {navItems.map((item, index) => (
                    <div key={item.id}>
                        {index > 0 && <div className="h-px bg-black/5 dark:bg-white/5" />}
                        <button
                            onClick={() => setCurrentView(item.id)}
                            className={`w-full p-3.5 flex items-center justify-between transition-colors ${currentView === item.id
                                    ? 'bg-black/10 dark:bg-white/10 text-black dark:text-white'
                                    : 'text-black dark:text-white/60 hover:bg-black/5 dark:hover:bg-white/5 hover:text-black dark:hover:text-white'
                                }`}
                        >
                            <span className="flex items-center gap-3 font-medium text-sm">
                                <item.icon className="w-4 h-4" /> {item.label}
                            </span>
                            {currentView === item.id && (
                                <motion.div
                                    layoutId="activeDot"
                                    className="w-1.5 h-1.5 rounded-full"
                                    style={{ background: themeColor }}
                                />
                            )}
                        </button>
                    </div>
                ))}
            </div>
        </div>
    );
}
