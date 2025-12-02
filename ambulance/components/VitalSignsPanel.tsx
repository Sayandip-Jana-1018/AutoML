'use client';

import React, { useEffect, useState } from 'react';
import { Heart, Activity, Droplet, Thermometer, Wind, Zap } from 'lucide-react';
import { GlassmorphicCard } from './ui/glassmorphic-card';
import { VitalSigns } from '@/types';
import { VitalSimulator } from '@/lib/vitalSimulator';
import { useEmergencyStore } from '@/lib/store';
import { useTheme } from 'next-themes';

interface VitalSignsPanelProps {
    vitals: VitalSigns;
    realtime?: boolean;
    compact?: boolean;
}

export function VitalSignsPanel({ vitals: initialVitals, realtime = false, compact = false }: VitalSignsPanelProps) {
    const [vitals, setVitals] = useState(initialVitals);
    const [abnormalities, setAbnormalities] = useState<string[]>([]);
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    useEffect(() => {
        setVitals(initialVitals);
        const { abnormalities: detected } = VitalSimulator.isAbnormal(initialVitals);
        setAbnormalities(detected);
    }, [initialVitals]);

    // Real-time updates simulation
    useEffect(() => {
        if (!realtime) return;

        const interval = setInterval(() => {
            setVitals(prev => {
                const newVitals = VitalSimulator.simulateChange(prev, 'Moderate');
                const { abnormalities: detected } = VitalSimulator.isAbnormal(newVitals);
                setAbnormalities(detected);
                return newVitals;
            });
        }, 3000);

        return () => clearInterval(interval);
    }, [realtime]);

    const getVitalStatus = (value: number, normal: [number, number]): { label: string; color: string } => {
        if (value < normal[0]) return { label: 'Low', color: 'text-blue-600 bg-blue-50 border-blue-200' };
        if (value > normal[1]) return { label: 'High', color: 'text-red-600 bg-red-50 border-red-200' };
        return { label: 'Normal', color: 'text-emerald-600 bg-emerald-50 border-emerald-200' };
    };

    const vitalCards = [
        {
            icon: Heart,
            label: 'Heart Rate',
            value: vitals.heartRate,
            unit: 'bpm',
            normal: [60, 100] as [number, number],
            color: 'from-red-500 to-pink-500'
        },
        {
            icon: Activity,
            label: 'Blood Pressure',
            value: `${vitals.bloodPressure.systolic}/${vitals.bloodPressure.diastolic}`,
            unit: 'mmHg',
            normal: [90, 140] as [number, number],
            color: 'from-purple-500 to-indigo-500',
            checkValue: vitals.bloodPressure.systolic
        },
        {
            icon: Droplet,
            label: 'Oxygen Saturation',
            value: vitals.oxygenSaturation,
            unit: '%',
            normal: [95, 100] as [number, number],
            color: 'from-blue-500 to-cyan-500'
        },
        {
            icon: Thermometer,
            label: 'Temperature',
            value: vitals.temperature.toFixed(1),
            unit: '°C',
            normal: [36, 37.5] as [number, number],
            color: 'from-orange-500 to-red-500'
        },
        {
            icon: Wind,
            label: 'Respiratory Rate',
            value: vitals.respiratoryRate,
            unit: '/min',
            normal: [12, 20] as [number, number],
            color: 'from-teal-500 to-green-500'
        },
        ...(vitals.glucoseLevel ? [{
            icon: Zap,
            label: 'Glucose Level',
            value: vitals.glucoseLevel,
            unit: 'mg/dL',
            normal: [70, 140] as [number, number],
            color: 'from-yellow-500 to-amber-500'
        }] : [])
    ];

    return (
        <div className="space-y-4">
            {/* Header */}
            {!compact && (
                <div className="flex items-center justify-between">
                    <h3 className={`text-lg font-bold flex items-center gap-2 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                        <Activity className="w-5 h-5 text-blue-600" />
                        Live Vitals
                    </h3>
                    {realtime && (
                        <span className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider animate-pulse ${isDark ? 'text-emerald-400' : 'text-emerald-600'}`}>
                            <span className={`w-2 h-2 rounded-full ${isDark ? 'bg-emerald-400' : 'bg-emerald-500'}`} />
                            Live Stream
                        </span>
                    )}
                </div>
            )}

            {/* Abnormalities Alert */}
            {abnormalities.length > 0 && (
                <div className={`rounded-2xl p-4 border backdrop-blur-md animate-in slide-in-from-top duration-500 ${compact ? 'text-xs' : ''}
                    ${isDark ? 'border-red-500/30 bg-red-500/10' : 'border-red-200 bg-red-50'}
                `}>
                    <div className="flex items-start gap-3">
                        <div className={`p-1.5 rounded-full mt-0.5 ${isDark ? 'bg-red-500/20 text-red-400' : 'bg-red-100 text-red-500'}`}>
                            <Activity size={compact ? 14 : 16} />
                        </div>
                        <div>
                            <h4 className={`${compact ? 'text-sm' : 'text-base'} font-bold mb-1 ${isDark ? 'text-red-400' : 'text-red-700'}`}>Abnormal Readings Detected</h4>
                            <ul className="space-y-1">
                                {abnormalities.map((issue, idx) => (
                                    <li key={idx} className={`${compact ? 'text-[10px]' : 'text-sm'} flex items-center gap-2 ${isDark ? 'text-red-300/80' : 'text-red-600'}`}>
                                        <span className={`w-1 h-1 rounded-full ${isDark ? 'bg-red-400' : 'bg-red-500'}`} />
                                        {issue}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                </div>
            )}

            {/* Grid */}
            <div className={`grid ${compact ? 'grid-cols-1 gap-2' : 'grid-cols-2 gap-4'}`}>
                {vitalCards.map((vital, idx) => {
                    const checkVal = vital.checkValue ?? (typeof vital.value === 'number' ? vital.value : parseFloat(vital.value as string));
                    const status = getVitalStatus(checkVal, vital.normal);
                    const isAbnormal = status.label !== 'Normal';

                    return (
                        <div
                            key={idx}
                            className={`
                                relative overflow-hidden rounded-2xl border backdrop-blur-md transition-all duration-300 group
                                ${isAbnormal
                                    ? (isDark ? 'bg-red-950/30 border-red-500/30 hover:border-red-500/50' : 'bg-red-50 border-red-200 hover:border-red-300')
                                    : (isDark ? 'bg-slate-900/40 border-slate-700/30 hover:border-slate-600' : 'bg-white border-slate-200 hover:border-slate-300')
                                }
                                ${compact ? 'p-3' : 'p-4'}
                            `}
                        >
                            <div className="flex items-start justify-between mb-2">
                                <div className={`p-2 rounded-xl bg-gradient-to-br ${vital.color} bg-opacity-10`}>
                                    <vital.icon size={compact ? 16 : 20} className="text-white" />
                                </div>
                                <span className={`
                                    px-2 py-0.5 rounded-lg border text-[10px] font-bold uppercase tracking-wider
                                    ${status.color}
                                `}>
                                    {status.label}
                                </span>
                            </div>

                            <div>
                                <div className="flex items-baseline gap-1">
                                    <span className={`${compact ? 'text-xl' : 'text-2xl'} font-bold tracking-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                        {vital.value}
                                    </span>
                                    <span className="text-xs text-slate-500 font-medium">{vital.unit}</span>
                                </div>
                                <p className="text-[10px] text-slate-500 font-medium mt-1 uppercase tracking-wide">{vital.label}</p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
