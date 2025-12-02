'use client';

import React, { useState } from 'react';
import { Building2, MapPin, Star, Users, Bed, Check, ChevronDown, ChevronUp, Navigation } from 'lucide-react';
import { HospitalMatch } from '@/types';
import { useEmergencyStore } from '@/lib/store';
import { useTheme } from 'next-themes';

interface HospitalMatchPanelProps {
    matches: HospitalMatch[];
    onSelectHospital: (hospital: HospitalMatch) => void;
    selectedHospitalId?: string;
}

export function HospitalMatchPanel({ matches, onSelectHospital, selectedHospitalId }: HospitalMatchPanelProps) {
    const [expandedId, setExpandedId] = useState<string | null>(null);
    const [isPanelExpanded, setIsPanelExpanded] = useState(true);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    if (matches.length === 0) return null;

    return (
        <div className="absolute right-4 md:right-6 top-4 md:top-6 bottom-4 md:bottom-6 w-[calc(100%-2rem)] md:w-[380px] flex flex-col z-20 pointer-events-none">

            {/* Main Panel Container */}
            <div className={`flex flex-col transition-all duration-500 ease-in-out ${isPanelExpanded ? 'h-full' : 'h-auto'}`}>

                {/* Header / Toggle */}
                <div className={`pointer-events-auto backdrop-blur-3xl border rounded-[2rem] p-6 shadow-2xl flex items-center justify-between cursor-pointer group transition-all relative overflow-hidden mb-4
                    ${isDark
                        ? 'bg-slate-950/90 border-slate-800 hover:bg-slate-900/90'
                        : 'bg-white/90 border-slate-200 hover:bg-white'}
                `}
                    onClick={() => setIsPanelExpanded(!isPanelExpanded)}>

                    {/* Ambient Glow */}
                    <div className="absolute inset-0 bg-gradient-to-r from-blue-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-500" />

                    <div className="flex items-center gap-4 relative z-10">
                        <div className="p-3 bg-blue-600 rounded-xl shadow-[0_0_20px_rgba(37,99,235,0.2)] group-hover:scale-110 transition-transform duration-300">
                            <Building2 size={20} className="text-white" />
                        </div>
                        <div>
                            <h3 className={`text-lg font-black tracking-tight transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>HOSPITAL MATCHES</h3>
                            <div className="flex items-center gap-2 mt-0.5">
                                <span className={`flex h-1.5 w-1.5 rounded-full animate-pulse ${isDark ? 'bg-blue-400' : 'bg-blue-500'}`} />
                                <p className={`text-xs font-bold uppercase tracking-wider ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>{matches.length} FACILITIES FOUND</p>
                            </div>
                        </div>
                    </div>
                    <div className={`p-2 rounded-full transition-transform duration-500 border
                        ${isDark
                            ? 'bg-slate-800/50 text-slate-400 border-slate-700/50'
                            : 'bg-slate-100 text-slate-500 border-slate-200'}
                        ${isPanelExpanded ? (isDark ? 'rotate-180 bg-slate-800' : 'rotate-180 bg-slate-200') : 'rotate-0'}
                    `}>
                        <ChevronDown size={20} />
                    </div>
                </div>

                {/* List Container */}
                <div className={`pointer-events-auto flex-1 min-h-0 backdrop-blur-3xl border rounded-[2rem] shadow-2xl overflow-hidden transition-all duration-500 
                    ${isDark ? 'bg-slate-950/80 border-slate-800' : 'bg-white/80 border-slate-200'}
                    ${isPanelExpanded ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4 pointer-events-none hidden'}
                `}>
                    <div className="h-full overflow-y-auto no-scrollbar p-4 space-y-3">
                        {matches.slice(0, 10).map((match, idx) => {
                            const isExpanded = expandedId === match.hospital.id;
                            const isSelected = selectedHospitalId === match.hospital.id;

                            return (
                                <div
                                    key={match.hospital.id}
                                    onClick={() => onSelectHospital(match)}
                                    className={`
                                        relative overflow-hidden rounded-2xl border transition-all duration-300 cursor-pointer group
                                        ${isSelected
                                            ? (isDark
                                                ? 'bg-emerald-950/40 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]'
                                                : 'bg-emerald-50 border-emerald-500/50 shadow-[0_0_30px_rgba(16,185,129,0.1)]')
                                            : (isDark
                                                ? 'bg-slate-900/40 border-slate-800 hover:border-slate-600 hover:bg-slate-800/60'
                                                : 'bg-slate-50 border-slate-200 hover:border-slate-300 hover:bg-slate-100')
                                        }
                                    `}
                                >
                                    {/* Selection Indicator Line */}
                                    {isSelected && <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.5)]" />}

                                    <div className="p-4 relative z-10">
                                        {/* Card Header */}
                                        <div className="flex items-start justify-between gap-3 mb-3">
                                            <div className="flex-1">
                                                <div className="flex items-center gap-2 mb-1.5">
                                                    <span className={`
                                                        px-2 py-0.5 rounded-md text-[10px] font-black uppercase tracking-wider border
                                                        ${idx === 0
                                                            ? (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200')
                                                            : (isDark ? 'bg-slate-800 text-slate-400 border-slate-700' : 'bg-slate-200 text-slate-500 border-slate-300')}
                                                    `}>
                                                        #{idx + 1} Match
                                                    </span>
                                                    <span className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">{match.hospital.primarySpecialization}</span>
                                                </div>
                                                <h4 className={`text-base font-bold leading-tight transition-colors ${isDark ? 'text-white group-hover:text-blue-200' : 'text-slate-900 group-hover:text-blue-600'}`}>{match.hospital.name}</h4>
                                            </div>
                                            <div className={`
                                                w-12 h-12 rounded-xl flex flex-col items-center justify-center font-black text-lg shadow-lg border
                                                ${match.score >= 80
                                                    ? (isDark ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-emerald-50 text-emerald-600 border-emerald-200')
                                                    : (isDark ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-amber-50 text-amber-600 border-amber-200')}
                                            `}>
                                                <span>{match.score}</span>
                                                <span className="text-[8px] font-bold opacity-60">%</span>
                                            </div>
                                        </div>

                                        {/* Stats Grid */}
                                        <div className="grid grid-cols-3 gap-2 mb-3">
                                            <div className={`rounded-xl p-2 text-center border transition-colors
                                                ${isDark ? 'bg-slate-950/50 border-slate-800 group-hover:border-slate-700' : 'bg-white border-slate-200 group-hover:border-slate-300'}
                                            `}>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">ETA</div>
                                                <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{match.eta} m</div>
                                            </div>
                                            <div className={`rounded-xl p-2 text-center border transition-colors
                                                ${isDark ? 'bg-slate-950/50 border-slate-800 group-hover:border-slate-700' : 'bg-white border-slate-200 group-hover:border-slate-300'}
                                            `}>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Dist</div>
                                                <div className={`text-sm font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>{match.distance.toFixed(1)}km</div>
                                            </div>
                                            <div className={`rounded-xl p-2 text-center border transition-colors
                                                ${isDark ? 'bg-slate-950/50 border-slate-800 group-hover:border-slate-700' : 'bg-white border-slate-200 group-hover:border-slate-300'}
                                            `}>
                                                <div className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mb-0.5">Rating</div>
                                                <div className={`text-sm font-bold flex items-center justify-center gap-1 ${isDark ? 'text-amber-400' : 'text-amber-500'}`}>
                                                    <Star size={10} fill="currentColor" /> {match.hospital.rating}
                                                </div>
                                            </div>
                                        </div>

                                        {/* Action Button */}
                                        <button
                                            className={`
                                                w-full py-2.5 rounded-xl text-xs font-bold uppercase tracking-widest transition-all flex items-center justify-center gap-2
                                                ${isSelected
                                                    ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/20'
                                                    : (isDark
                                                        ? 'bg-blue-600/10 text-blue-400 hover:bg-blue-600 hover:text-white border border-blue-500/20 hover:border-blue-500/50'
                                                        : 'bg-blue-50 text-blue-600 hover:bg-blue-600 hover:text-white border border-blue-200 hover:border-blue-500/50')
                                                }
                                            `}
                                        >
                                            {isSelected ? (
                                                <>
                                                    <Check size={14} strokeWidth={3} />
                                                    Selected Destination
                                                </>
                                            ) : (
                                                <>
                                                    <Navigation size={14} strokeWidth={3} />
                                                    Select Route
                                                </>
                                            )}
                                        </button>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                </div>
            </div>
        </div>
    );
}
