'use client';

import React from 'react';
import { History, BarChart3 } from 'lucide-react';
import { GlassCard } from './GlassCard';
import { Job } from './types';

interface VisualizationViewProps {
    jobs: Job[];
}

export const VisualizationView = ({ jobs }: VisualizationViewProps) => {
    return (
        <GlassCard className="h-full flex flex-col" hover={false}>
            {/* Content - Model Journey */}
            <div className="flex-1 overflow-y-auto p-6">
                <div className="relative pl-4 border-l border-white/10 dark:border-white/10 space-y-6">
                    {(!jobs || jobs.length === 0) && (
                        <div className="text-center text-white/30 text-sm py-8">
                            No experiments found. Run training to start your journey.
                        </div>
                    )}

                    {jobs?.map((job, i) => (
                        <div key={job.id} className="relative pl-6">
                            <div className={`absolute -left-[21px] top-0 w-3 h-3 rounded-full border-2 border-black dark:border-black ${job.status === 'succeeded' ? 'bg-green-500' :
                                job.status === 'failed' ? 'bg-red-500' :
                                    job.status === 'running' || job.status === 'provisioning' ? 'bg-yellow-500 animate-pulse' : 'bg-gray-500'
                                }`} />

                            <GlassCard className="p-4">
                                <div className="flex items-center justify-between mb-2">
                                    <span className="text-xs font-mono text-white/50">v{jobs.length - i}</span>
                                    <span className={`text-[10px] uppercase font-bold px-2 py-0.5 rounded-full ${job.status === 'succeeded' ? 'bg-green-500/20 text-green-400' :
                                        job.status === 'failed' ? 'bg-red-500/20 text-red-400' :
                                            'bg-yellow-500/20 text-yellow-400'
                                        }`}>{job.status}</span>
                                </div>

                                {job.metrics ? (
                                    <div className="grid grid-cols-2 gap-4 mt-3">
                                        <div>
                                            <div className="text-[10px] text-white/40">Accuracy</div>
                                            <div className="text-lg font-bold text-blue-400">{(job.metrics.accuracy * 100).toFixed(1)}%</div>
                                        </div>
                                        <div>
                                            <div className="text-[10px] text-white/40">Loss</div>
                                            <div className="text-lg font-bold text-red-400">{job.metrics.loss?.toFixed(4)}</div>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-xs text-white/30 mt-2 italic">
                                        {job.status === 'succeeded' ? 'No metrics logged.' : 'Calculating...'}
                                    </div>
                                )}
                            </GlassCard>
                        </div>
                    ))}
                </div>
            </div>
        </GlassCard>
    );
};

export default VisualizationView;
