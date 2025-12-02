import React, { useEffect, useState } from 'react';
import { AlertCircle, Mic, Activity, Cpu, Loader2, ShieldAlert, Menu, ChevronLeft, ChevronRight, CheckCircle2, Circle } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { AnimatedButton } from '@/components/ui/animated-button';
import { PatientData, VitalSigns, EmergencyStatus } from '@/types';
import { useHardware } from '@/hooks/useHardware';
import { savePatientData } from '@/app/actions/saveData';
import { VitalSimulator } from '@/lib/vitalSimulator';
import { useEmergencyStore } from '@/lib/store';
import { useTheme } from 'next-themes';

interface EmergencyControlsProps {
    onSymptomAnalysis: (analysis: any) => void;
    patientData: PatientData | null;
    matchedHospitals: any[];
    currentStatus: EmergencyStatus;
    handleQuickDispatch: () => void;
    vitals: VitalSigns | null;
    selectedHospitalId: string | undefined;
    onVitalsUpdate?: (vitals: VitalSigns) => void;
}

export function EmergencyControls({
    onSymptomAnalysis,
    patientData,
    matchedHospitals,
    currentStatus,
    handleQuickDispatch,
    vitals,
    selectedHospitalId,
    onVitalsUpdate
}: EmergencyControlsProps) {
    const isDispatched = currentStatus !== 'idle' && currentStatus !== 'processing' && currentStatus !== 'analyzing';
    const { isConnected, connect, disconnect, hardwareVitals } = useHardware();
    const { resolvedTheme } = useTheme();
    const isDark = resolvedTheme === 'dark';

    // Collapsed state
    const [isCollapsed, setIsCollapsed] = useState(false);

    // Auto-collapse on hospital selection, but expand on dispatch for mission mode
    useEffect(() => {
        if (selectedHospitalId && !isDispatched) {
            setIsCollapsed(true);
        } else if (isDispatched) {
            setIsCollapsed(false); // Expand to show mission details
        }
    }, [isDispatched, selectedHospitalId]);

    // Update vitals when hardware data comes in
    useEffect(() => {
        console.log('EmergencyControls patientData updated:', patientData);
    }, [patientData]);

    useEffect(() => {
        if (isConnected && hardwareVitals && onVitalsUpdate) {
            // Generate random background vitals (BP, Temp, RR)
            // We use 'Moderate' severity as a baseline for random generation
            const simulated = VitalSimulator.generateBySeverity('Moderate');

            onVitalsUpdate({
                ...simulated, // Use simulated values for BP, Temp, RR, Glucose
                heartRate: hardwareVitals.bpm, // Overwrite with REAL Hardware Data
                oxygenSaturation: hardwareVitals.spo2, // Overwrite with REAL Hardware Data
                timestamp: new Date()
            });
        }
    }, [hardwareVitals, isConnected, onVitalsUpdate]);

    const handleDispatchWithSave = async () => {
        // Save data before dispatching
        if (vitals && patientData) {
            await savePatientData({
                ...vitals,
                ecgRaw: hardwareVitals?.ecg || 0,
                condition: patientData.condition,
                isSimulated: !isConnected
            });
        }
        handleQuickDispatch();
    };

    // Mission Timeline Steps
    const steps = [
        { id: 'init', label: 'Initializing', status: ['idle', 'processing'] },
        { id: 'pickup', label: 'Patient Pickup', status: ['analyzing', 'ambulance_en_route_to_patient'] },
        { id: 'vitals', label: 'Matching Vitals', status: ['locating', 'patient_picked_up'] },
        { id: 'hospital', label: 'Selecting Hospital', status: ['dispatching'] },
        { id: 'routing', label: 'Routing', status: ['en_route_to_hospital', 'arrived_at_hospital'] }
    ];

    const getCurrentStepIndex = () => {
        if (currentStatus === 'idle' || currentStatus === 'processing') return 0;
        if (currentStatus === 'ambulance_en_route_to_patient') return 1;
        if (currentStatus === 'patient_picked_up') return 2;
        if (selectedHospitalId && !isDispatched) return 3;
        if (currentStatus === 'en_route_to_hospital' || currentStatus === 'arrived_at_hospital') return 4;
        return 0;
    };

    const currentStepIndex = getCurrentStepIndex();

    return (
        <>
            {/* Collapsed Toggle Button (Visible when collapsed) */}
            <div className={`absolute left-4 top-4 z-[100] pointer-events-auto transition-all duration-300 ${isCollapsed ? 'opacity-100 translate-x-0' : 'opacity-0 -translate-x-full pointer-events-none'}`}>
                <button
                    onClick={() => setIsCollapsed(false)}
                    className={`p-3 rounded-xl shadow-lg backdrop-blur-md border transition-colors
                        ${isDark ? 'bg-slate-900/80 border-slate-700 text-white hover:bg-slate-800' : 'bg-white/80 border-slate-200 text-slate-900 hover:bg-slate-50'}
                    `}
                >
                    <Menu size={24} />
                </button>
            </div>

            {/* Main Sidebar */}
            <div className={`absolute left-4 md:left-6 top-4 md:top-6 bottom-4 md:bottom-6 w-[calc(100%-2rem)] md:w-[380px] flex flex-col z-50 transition-all duration-500 
                ${isCollapsed ? '-translate-x-[120%] opacity-0' : 'translate-x-0 opacity-100'}
            `}>

                {/* Main Mission Control Panel */}
                <div className={`flex-1 backdrop-blur-3xl border rounded-[2rem] shadow-2xl overflow-hidden flex flex-col relative group pointer-events-auto transition-colors duration-300
                    ${isDark ? 'bg-slate-950/90 border-slate-800' : 'bg-white/90 border-slate-200'}
                `}>

                    {/* Collapse Button */}
                    <button
                        onClick={() => setIsCollapsed(true)}
                        className={`absolute top-4 right-4 z-20 p-2 rounded-full transition-colors
                            ${isDark ? 'hover:bg-slate-800 text-slate-400' : 'hover:bg-slate-100 text-slate-500'}
                        `}
                    >
                        <ChevronLeft size={20} />
                    </button>

                    {/* Ambient Background Effects */}
                    <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-blue-500/5 to-transparent pointer-events-none" />
                    <div className="absolute bottom-0 right-0 w-64 h-64 bg-blue-500/5 rounded-full blur-3xl pointer-events-none" />

                    {/* Header */}
                    <div className={`p-6 border-b flex items-center justify-between relative z-10 transition-colors duration-300
                        ${isDark ? 'border-slate-800/50' : 'border-slate-200'}
                    `}>
                        <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-xl shadow-[0_0_15px_rgba(37,99,235,0.2)] ${isDispatched ? 'bg-red-600' : 'bg-blue-600'}`}>
                                {isDispatched ? <ShieldAlert className="w-5 h-5 text-white" /> : <Activity className="w-5 h-5 text-white" />}
                            </div>
                            <div>
                                <h2 className={`text-lg font-black tracking-tight transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>
                                    {isDispatched ? 'EMERGENCY RESPONSE' : 'MISSION CONTROL'}
                                </h2>
                                <div className="flex items-center gap-2">
                                    <span className="relative flex h-2 w-2">
                                        <span className={`animate-ping absolute inline-flex h-full w-full rounded-full opacity-75 ${isDispatched ? 'bg-red-400' : 'bg-emerald-400'}`}></span>
                                        <span className={`relative inline-flex rounded-full h-2 w-2 ${isDispatched ? 'bg-red-500' : 'bg-emerald-500'}`}></span>
                                    </span>
                                    <span className={`text-[10px] font-bold uppercase tracking-widest ${isDispatched ? 'text-red-500' : 'text-emerald-500'}`}>
                                        {isDispatched ? 'Dispatch Active' : 'System Active'}
                                    </span>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Scrollable Content Area */}
                    <div className="flex-1 overflow-y-auto no-scrollbar p-6 space-y-6 relative z-10">

                        {/* CONDITIONAL CONTENT: Triage vs Mission */}
                        {!isDispatched ? (
                            /* TRIAGE MODE (Voice + Pre-Dispatch Vitals) */
                            <>
                                {/* Mission Timeline (Horizontal for Triage) */}
                                <div className="mb-6">
                                    <div className="flex justify-between items-center relative">
                                        {/* Connecting Line */}
                                        <div className={`absolute left-0 right-0 top-1/2 h-0.5 -z-10 ${isDark ? 'bg-slate-800' : 'bg-slate-200'}`} />

                                        {steps.map((step, index) => {
                                            const isActive = index === currentStepIndex;
                                            const isCompleted = index < currentStepIndex;

                                            return (
                                                <div key={step.id} className="flex flex-col items-center gap-2">
                                                    <div className={`w-3 h-3 rounded-full border-2 transition-all duration-300
                                                        ${isActive
                                                            ? 'bg-blue-500 border-blue-500 scale-125 shadow-[0_0_10px_rgba(59,130,246,0.5)]'
                                                            : isCompleted
                                                                ? 'bg-emerald-500 border-emerald-500'
                                                                : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300')
                                                        }
                                                    `} />
                                                </div>
                                            );
                                        })}
                                    </div>
                                    <div className="mt-2 text-center">
                                        <p className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-blue-400' : 'text-blue-600'}`}>
                                            {steps[currentStepIndex].label}
                                        </p>
                                    </div>
                                </div>

                                {/* 1. Voice Triage Section */}
                                <div className="space-y-3">
                                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <Mic size={12} />
                                        <span>Triage Input</span>
                                    </div>
                                    <VoiceRecorder onSymptomAnalysis={onSymptomAnalysis} />
                                </div>
                            </>
                        ) : (
                            /* MISSION MODE (Journey Tracker + Live Vitals) */
                            <>
                                {/* Vertical Journey Tracker */}
                                <div className="space-y-4">
                                    <div className={`flex items-center gap-2 text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                        <ShieldAlert size={12} />
                                        <span>Journey Tracker</span>
                                    </div>
                                    <div className={`p-4 rounded-2xl border ${isDark ? 'bg-slate-900/50 border-slate-800' : 'bg-slate-50 border-slate-200'}`}>
                                        <div className="space-y-6 relative">
                                            {/* Vertical Line */}
                                            <div className={`absolute left-[15px] top-2 bottom-2 w-0.5 ${isDark ? 'bg-slate-800' : 'bg-slate-300'}`} />

                                            {steps.slice(1).map((step, index) => {
                                                // Adjust index because we sliced the first step
                                                const realIndex = index + 1;
                                                const isActive = realIndex === currentStepIndex;
                                                const isCompleted = realIndex < currentStepIndex;

                                                return (
                                                    <div key={step.id} className="relative flex items-center gap-4">
                                                        <div className={`relative z-10 w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all duration-500
                                                            ${isActive
                                                                ? 'bg-blue-600 border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)] scale-110'
                                                                : isCompleted
                                                                    ? 'bg-emerald-500 border-emerald-500'
                                                                    : (isDark ? 'bg-slate-900 border-slate-700' : 'bg-white border-slate-300')
                                                            }
                                                        `}>
                                                            {isCompleted ? (
                                                                <CheckCircle2 size={14} className="text-white" />
                                                            ) : isActive ? (
                                                                <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                                            ) : (
                                                                <Circle size={14} className={isDark ? 'text-slate-700' : 'text-slate-300'} />
                                                            )}
                                                        </div>
                                                        <div>
                                                            <p className={`text-sm font-bold transition-colors ${isActive ? (isDark ? 'text-white' : 'text-slate-900') : (isDark ? 'text-slate-500' : 'text-slate-400')}`}>
                                                                {step.label}
                                                            </p>
                                                            {isActive && (
                                                                <p className="text-[10px] text-blue-500 font-medium animate-pulse">In Progress...</p>
                                                            )}
                                                        </div>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    </div>
                                </div>
                            </>
                        )}

                        {/* Vitals Monitor Section (Always Visible, but styled differently in Mission Mode) */}
                        <div className="space-y-3">
                            <div className={`flex items-center justify-between text-xs font-bold uppercase tracking-wider transition-colors duration-300 ${isDark ? 'text-slate-400' : 'text-slate-500'}`}>
                                <div className="flex items-center gap-2">
                                    <Activity size={12} />
                                    <span className={`transition-colors duration-300 ${isDark ? 'text-white' : 'text-slate-900'}`}>Live Telemetry</span>
                                </div>
                                {isConnected ? (
                                    <span className="text-emerald-500">Connected</span>
                                ) : (
                                    <span className="text-slate-500">Standby</span>
                                )}
                            </div>

                            {/* Vitals Container */}
                            <div className={`
                                rounded-2xl border transition-all duration-300 overflow-hidden
                                ${isConnected
                                    ? (isDark ? 'bg-slate-900/50 border-slate-700/50' : 'bg-slate-50 border-slate-200')
                                    : (isDark ? 'bg-slate-900/30 border-slate-800 border-dashed' : 'bg-slate-50 border-slate-200 border-dashed')
                                }
                            `}>
                                {isConnected && vitals ? (
                                    <div className="p-4">
                                        <VitalSignsPanel vitals={vitals} realtime={true} compact={true} />
                                    </div>
                                ) : (
                                    <div className="p-8 flex flex-col items-center text-center space-y-4">
                                        <div className={`p-4 rounded-full shadow-sm border transition-colors duration-300
                                            ${isDark ? 'bg-slate-800/50 text-slate-500 border-slate-700' : 'bg-white text-slate-400 border-slate-100'}
                                        `}>
                                            <Cpu size={24} />
                                        </div>
                                        <div>
                                            <p className={`font-medium text-sm transition-colors duration-300 ${isDark ? 'text-slate-300' : 'text-slate-900'}`}>No Hardware Signal</p>
                                            <p className="text-slate-500 text-xs mt-1">Connect ESP32 to stream vitals</p>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Footer Actions - Only show Dispatch Button in Triage Mode */}
                    {!isDispatched && (
                        <div className={`p-6 border-t backdrop-blur-xl space-y-3 relative z-10 transition-colors duration-300
                            ${isDark ? 'border-slate-800/50 bg-slate-950/50' : 'border-slate-200 bg-white/50'}
                        `}>
                            {/* Hardware Toggle */}
                            <button
                                onClick={isConnected ? disconnect : connect}
                                className={`w-full py-3 px-4 rounded-xl flex items-center justify-center gap-2 text-sm font-bold transition-all border ${isConnected
                                    ? 'bg-emerald-500/10 text-emerald-500 border-emerald-500/20 hover:bg-emerald-500/20'
                                    : (isDark
                                        ? 'bg-slate-800/50 text-slate-400 border-slate-700 hover:bg-slate-800 hover:text-white'
                                        : 'bg-slate-100 text-slate-600 border-slate-200 hover:bg-slate-200 hover:text-slate-900')
                                    }`}
                            >
                                <Cpu size={16} />
                                {isConnected ? 'Hardware Connected' : 'Connect Hardware'}
                            </button>

                            {/* Dispatch Button */}
                            {patientData && (
                                <div className="mt-auto pt-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
                                    <button
                                        onClick={handleQuickDispatch}
                                        className={`
                                            group relative w-full py-4 rounded-xl font-bold text-lg tracking-wide shadow-lg transition-all duration-300 overflow-hidden
                                            bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white shadow-red-900/20 hover:shadow-red-500/40 active:scale-95
                                        `}
                                    >
                                        <div className="relative z-10 flex items-center justify-center gap-2">
                                            {currentStatus === 'processing' ? (
                                                <>
                                                    <Loader2 className="w-5 h-5 animate-spin" />
                                                    <span>PROCESSING...</span>
                                                </>
                                            ) : (
                                                <>
                                                    <ShieldAlert className="w-5 h-5 animate-pulse" />
                                                    <span>INITIATE DISPATCH</span>
                                                </>
                                            )}
                                        </div>
                                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/20 to-transparent -translate-x-full group-hover:animate-shimmer" />
                                    </button>
                                </div>
                            )}

                            {!patientData && (
                                <p className="text-[10px] text-center mt-2 text-slate-500 uppercase tracking-wider font-medium">
                                    Record symptoms to enable dispatch
                                </p>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
