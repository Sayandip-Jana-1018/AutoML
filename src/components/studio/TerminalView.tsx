'use client';

import React from 'react';
import { GlassCard } from './GlassCard';

interface TerminalViewProps {
    logs?: string[];
    status?: string;
}

export const TerminalView = ({ logs, status }: TerminalViewProps) => (
    <GlassCard className="h-full overflow-hidden" hover={false}>
        <div className="h-full overflow-y-auto p-4 font-mono text-xs">
            <div className="dark:text-white text-black mb-2 border-b border-white/10 dark:border-white/10 pb-2">
                Vertex AI Cloud Shell (us-central1) {status && `[${status.toUpperCase()}]`}
            </div>
            <div className="space-y-1 dark:text-white text-black">
                {(!logs || logs.length === 0) && (
                    <div className="opacity-30">Waiting for jobs...</div>
                )}
                {logs?.map((log, i) => (
                    <div key={i} className="break-all">{log}</div>
                ))}
                {status === 'running' && <div className="animate-pulse">_</div>}
            </div>
        </div>
    </GlassCard>
);

export default TerminalView;
