import React from 'react';
import { AlertCircle } from 'lucide-react';
import { VoiceRecorder } from '@/components/VoiceRecorder';
import { VitalSignsPanel } from '@/components/VitalSignsPanel';
import { JourneyTracker } from '@/components/JourneyTracker';
import { AnimatedButton } from '@/components/ui/animated-button';
import { PatientData, VitalSigns, EmergencyStatus } from '@/types';

interface SidebarProps {
    isSidebarOpen: boolean;
    onSymptomAnalysis: (analysis: any) => void;
    patientData: PatientData | null;
    matchedHospitals: any[];
    currentStatus: EmergencyStatus;
    handleQuickDispatch: () => void;
    vitals: VitalSigns | null;
    selectedHospitalId: string | undefined;
}

export function Sidebar({
    isSidebarOpen,
    onSymptomAnalysis,
    patientData,
    matchedHospitals,
    currentStatus,
    handleQuickDispatch,
    vitals,
    selectedHospitalId
}: SidebarProps) {
    return (
        <div className={`${isSidebarOpen ? 'w-96' : 'w-0'
            } transition-all duration-300 overflow-hidden flex-shrink-0 border-r border-white/10 bg-black/40 backdrop-blur-xl text-white`}>
            <div className="h-full overflow-y-auto p-6 space-y-6">
                {/* Voice Recorder */}
                <VoiceRecorder onSymptomAnalysis={onSymptomAnalysis} />

                {/* Quick Dispatch */}
                {patientData && matchedHospitals.length > 0 && currentStatus === 'processing' && (
                    <AnimatedButton
                        variant="danger"
                        size="lg"
                        className="w-full text-lg py-4 bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-lg"
                        onClick={handleQuickDispatch}
                        icon={<AlertCircle className="w-6 h-6" />}
                    >
                        Emergency Dispatch Now
                    </AnimatedButton>
                )}

                {/* Vital Signs */}
                {vitals && (
                    <VitalSignsPanel vitals={vitals} realtime={currentStatus !== 'idle'} />
                )}

                {/* Journey Tracker */}
                {currentStatus !== 'idle' && currentStatus !== 'processing' && selectedHospitalId && (
                    <JourneyTracker
                        currentStatus={currentStatus}
                        driverName="Dr. Sarah Johnson"
                        vehicleNumber="AMB-2024"
                        hospitalName={matchedHospitals.find(m => m.hospital.id === selectedHospitalId)?.hospital.name}
                        eta={currentStatus === 'arrived_at_hospital' ? 'Arrived' : '8 mins'}
                    />
                )}
            </div>
        </div>
    );
}
