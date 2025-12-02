'use client';

import React from 'react';
import { MapPin, Navigation, Building2, CheckCircle2, Clock } from 'lucide-react';
import { GlassmorphicCard } from './ui/glassmorphic-card';
import { EmergencyStatus } from '@/types';

interface JourneyStage {
    status: EmergencyStatus;
    label: string;
    icon: React.ReactNode;
    description: string;
}

interface JourneyTrackerProps {
    currentStatus: EmergencyStatus;
    driverName?: string;
    vehicleNumber?: string;
    hospitalName?: string;
    eta?: string;
    stages?: JourneyStage[];
}

const defaultStages: JourneyStage[] = [
    {
        status: 'dispatching',
        label: 'Ambulance Dispatched',
        icon: <Navigation className="w-4 h-4" />,
        description: 'Finding nearest ambulance'
    },
    {
        status: 'ambulance_en_route_to_patient',
        label: 'En Route to You',
        icon: <MapPin className="w-4 h-4" />,
        description: 'Ambulance is on the way'
    },
    {
        status: 'patient_picked_up',
        label: 'Patient Picked Up',
        icon: <CheckCircle2 className="w-4 h-4" />,
        description: 'Patient secured in ambulance'
    },
    {
        status: 'en_route_to_hospital',
        label: 'En Route to Hospital',
        icon: <Building2 className="w-4 h-4" />,
        description: 'Heading to medical facility'
    },
    {
        status: 'arriving_at_hospital',
        label: 'Arriving Soon',
        icon: <Clock className="w-4 h-4" />,
        description: 'Almost at hospital'
    },
    {
        status: 'arrived_at_hospital',
        label: 'Arrived',
        icon: <CheckCircle2 className="w-4 h-4" />,
        description: 'Reached hospital'
    }
];

export function JourneyTracker({
    currentStatus,
    driverName,
    vehicleNumber,
    hospitalName,
    eta,
    stages = defaultStages
}: JourneyTrackerProps) {
    const currentStageIndex = stages.findIndex(s => s.status === currentStatus);
    const isCompleted = currentStatus === 'arrived_at_hospital' || currentStatus === 'completed';

    return (
        <GlassmorphicCard className="p-4 space-y-3">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-base font-bold text-white flex items-center gap-2">
                        <Navigation className="w-4 h-4 text-blue-400" />
                        Journey Tracker
                    </h3>
                    {eta && !isCompleted && (
                        <p className="text-xs text-slate-400 mt-0.5">ETA: {eta}</p>
                    )}
                </div>
                {isCompleted && (
                    <div className="bg-green-500/20 text-green-500 px-2 py-0.5 rounded-full text-[10px] font-bold border border-green-500/30 uppercase tracking-wider">
                        Completed
                    </div>
                )}
            </div>

            {/* Driver & Vehicle Info */}
            {(driverName || vehicleNumber) && (
                <div className="flex items-center justify-between bg-slate-800/40 rounded-lg p-2 border border-slate-700/30">
                    <div>
                        {driverName && (
                            <p className="text-white text-sm font-bold">{driverName}</p>
                        )}
                        {vehicleNumber && (
                            <p className="text-slate-400 text-xs font-medium">{vehicleNumber}</p>
                        )}
                    </div>
                    <div className="w-8 h-8 bg-gradient-to-br from-red-500 to-red-600 rounded-full flex items-center justify-center text-sm shadow-lg shadow-red-500/20">
                        🚑
                    </div>
                </div>
            )}

            {/* Destination */}
            {hospitalName && (
                <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-2">
                    <p className="text-[10px] text-blue-400 mb-0.5 font-bold uppercase tracking-wider">Destination</p>
                    <p className="text-white text-sm font-bold flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-blue-400" />
                        {hospitalName}
                    </p>
                </div>
            )}

            {/* Timeline */}
            <div className="relative pl-2 pt-1 space-y-0">
                {/* Vertical Line */}
                <div className="absolute left-[15px] top-2 bottom-2 w-0.5 bg-slate-700/50" />

                {stages.map((stage, index) => {
                    const isActive = index === currentStageIndex;
                    const isPast = index < currentStageIndex;
                    const isFuture = index > currentStageIndex;

                    return (
                        <div key={stage.status} className={`relative flex gap-3 py-2 ${isFuture ? 'opacity-40' : 'opacity-100'}`}>
                            {/* Icon/Dot */}
                            <div className={`relative z-10 w-7 h-7 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${isPast ? 'bg-emerald-500 border-emerald-500 text-white shadow-lg shadow-emerald-500/20' :
                                isActive ? 'bg-blue-500 border-blue-400 text-white shadow-lg shadow-blue-500/30 scale-110' :
                                    'bg-slate-800 border-slate-600 text-slate-500'
                                }`}>
                                {isPast ? <CheckCircle2 className="w-3.5 h-3.5" /> : React.cloneElement(stage.icon as React.ReactElement, { className: 'w-3.5 h-3.5' })}
                            </div>

                            {/* Content */}
                            <div className="flex-1 pt-0.5">
                                <p className={`text-sm font-bold leading-none ${isPast ? 'text-emerald-400' :
                                    isActive ? 'text-white' :
                                        'text-slate-500'
                                    }`}>
                                    {stage.label}
                                </p>
                                {isActive && (
                                    <p className="text-[10px] mt-1 font-medium text-blue-200 animate-pulse">
                                        {stage.description}
                                    </p>
                                )}
                            </div>
                        </div>
                    );
                })}
            </div>
        </GlassmorphicCard>
    );
}
