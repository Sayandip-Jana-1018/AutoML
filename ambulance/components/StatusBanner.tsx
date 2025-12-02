import React from 'react';
import { Activity } from 'lucide-react';
import { EmergencyStatus } from '@/types';

interface StatusBannerProps {
    currentStatus: EmergencyStatus;
}

export function StatusBanner({ currentStatus }: StatusBannerProps) {
    if (currentStatus === 'idle') return null;

    return (
        <div className="px-6 py-3 z-40">
            <div className="rounded-2xl p-4 backdrop-blur-xl border bg-black/40 border-white/10 shadow-lg text-white">
                <div className="flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${currentStatus === 'arrived_at_hospital'
                            ? 'bg-green-500/20'
                            : 'bg-primary/20'
                            }`}>
                            <Activity className={`w-6 h-6 ${currentStatus === 'arrived_at_hospital'
                                ? 'text-green-500'
                                : 'text-primary animate-pulse'
                                }`} />
                        </div>
                        <div>
                            <p className="font-bold text-foreground">
                                Emergency Active
                            </p>
                            <p className="text-sm text-muted-foreground capitalize">
                                {currentStatus.replace(/_/g, ' ')}
                            </p>
                        </div>
                    </div>
                    {currentStatus !== 'arrived_at_hospital' && (
                        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-primary/10">
                            <span className="w-2 h-2 rounded-full animate-pulse bg-primary" />
                            <span className="text-sm font-medium text-primary">
                                In Progress
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
