'use client';

import { motion } from 'framer-motion';
import { Bell } from 'lucide-react';
import { useState } from 'react';

interface NotificationsViewProps {
    themeColor: string;
}

export function NotificationsView({ themeColor }: NotificationsViewProps) {
    const [settings, setSettings] = useState({
        email: true,
        push: true,
        product: false,
        security: true
    });

    const notificationItems = [
        { key: 'email', label: 'Email Notifications' },
        { key: 'push', label: 'Push Notifications' },
        { key: 'product', label: 'Product Updates' },
        { key: 'security', label: 'Security Alerts' },
    ];

    const toggleSetting = (key: string) => {
        setSettings(prev => ({ ...prev, [key]: !prev[key as keyof typeof prev] }));
    };

    return (
        <motion.div
            key="notifications"
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="max-w-lg mx-auto w-full"
        >
            <div className="bg-transparent border border-black dark:border-white rounded-[2rem] p-8">
                <div className="flex items-center gap-4 mb-8">
                    <div className="p-3 rounded-2xl" style={{ background: `${themeColor}20` }}>
                        <Bell className="w-8 h-8" style={{ color: themeColor }} />
                    </div>
                    <div>
                        <h2 className="text-2xl font-bold text-black dark:text-white">Notification Preferences</h2>
                        <p className="text-black dark:text-white/50 text-base">Choose what updates you want to receive</p>
                    </div>
                </div>

                <div className="space-y-4">
                    {notificationItems.map((item) => (
                        <div key={item.key} className="flex items-center justify-between p-4 bg-black/5 dark:bg-white/5 rounded-2xl border border-white/5">
                            <span className="font-medium text-black dark:text-white/80 text-base">{item.label}</span>
                            <button
                                onClick={() => toggleSetting(item.key)}
                                className={`w-12 h-6 rounded-full relative transition-colors flex items-center`}
                                style={{
                                    background: settings[item.key as keyof typeof settings]
                                        ? themeColor
                                        : 'rgba(255,255,255,0.1)'
                                }}
                            >
                                <div className={`absolute w-4 h-4 bg-white rounded-full transition-all ${settings[item.key as keyof typeof settings] ? 'left-7' : 'left-1'
                                    }`} />
                            </button>
                        </div>
                    ))}
                </div>
            </div>
        </motion.div>
    );
}
