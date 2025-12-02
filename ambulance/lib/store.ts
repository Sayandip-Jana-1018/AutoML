import { create } from 'zustand';
import { Hospital, Ambulance, EmergencyRequest, VitalSigns, PatientData, HospitalMatch, MedicalReport, EmergencyStatus } from '@/types';

interface EmergencyStore {
    // State
    hospitals: Hospital[];
    ambulances: Ambulance[];
    userLocation: [number, number] | null;
    emergencyRequest: EmergencyRequest | null;
    vitalSigns: VitalSigns | null;
    matchedHospitals: HospitalMatch[];
    isRecording: boolean;
    voiceTranscript: string;
    theme: 'light' | 'dark';

    // Actions
    setTheme: (theme: 'light' | 'dark') => void;
    setHospitals: (hospitals: Hospital[]) => void;
    setAmbulances: (ambulances: Ambulance[]) => void;
    setUserLocation: (location: [number, number]) => void;

    // Emergency Request Actions
    createEmergencyRequest: (location: [number, number]) => void;
    updateEmergencyStatus: (status: EmergencyStatus, message?: string) => void;
    setPatientData: (data: PatientData) => void;
    setVitalSigns: (vitals: VitalSigns) => void;
    setMatchedHospitals: (matches: HospitalMatch[]) => void;
    selectHospital: (hospital: Hospital) => void;
    assignAmbulance: (ambulanceId: string) => void;
    setMedicalReport: (report: MedicalReport) => void;
    completeEmergency: () => void;

    // Voice Recording Actions
    setIsRecording: (recording: boolean) => void;
    setVoiceTranscript: (transcript: string) => void;

    // Utility Actions
    updateVitalsRealtime: (vitals: VitalSigns) => void;
    updateHospitalAvailability: (hospitalId: string, updates: Partial<Hospital>) => void;
    reset: () => void;
}

export const useEmergencyStore = create<EmergencyStore>((set, get) => ({
    // Initial State
    hospitals: [],
    ambulances: [],
    userLocation: null,
    emergencyRequest: null,
    vitalSigns: null,
    matchedHospitals: [],
    isRecording: false,
    voiceTranscript: '',
    theme: 'light', // Default to light mode

    // Actions
    setTheme: (theme) => set({ theme }),
    setHospitals: (hospitals) => set({ hospitals }),

    setAmbulances: (ambulances) => set({ ambulances }),

    setUserLocation: (location) => set({ userLocation: location }),

    createEmergencyRequest: (location) => {
        const request: EmergencyRequest = {
            id: `EMR-${Date.now()}`,
            patientLocation: location,
            patientData: null,
            vitalSigns: null,
            assignedAmbulance: null,
            selectedHospital: null,
            matchedHospitals: [],
            status: 'idle',
            medicalReport: null,
            createdAt: new Date(),
            updatedAt: new Date(),
            timeline: [{
                status: 'idle',
                timestamp: new Date(),
                message: 'Emergency request created'
            }]
        };
        set({ emergencyRequest: request });
    },

    updateEmergencyStatus: (status, message) => {
        const { emergencyRequest } = get();
        if (!emergencyRequest) return;

        const updatedRequest: EmergencyRequest = {
            ...emergencyRequest,
            status,
            updatedAt: new Date(),
            timeline: [
                ...emergencyRequest.timeline,
                {
                    status,
                    timestamp: new Date(),
                    message: message || `Status updated to ${status}`
                }
            ]
        };
        set({ emergencyRequest: updatedRequest });
    },

    setPatientData: (data) => {
        const { emergencyRequest } = get();
        if (!emergencyRequest) return;

        set({
            emergencyRequest: {
                ...emergencyRequest,
                patientData: data,
                updatedAt: new Date()
            }
        });
    },

    setVitalSigns: (vitals) => {
        const { emergencyRequest } = get();
        set({ vitalSigns: vitals });

        if (emergencyRequest) {
            set({
                emergencyRequest: {
                    ...emergencyRequest,
                    vitalSigns: vitals,
                    updatedAt: new Date()
                }
            });
        }
    },

    setMatchedHospitals: (matches) => {
        const { emergencyRequest } = get();
        set({ matchedHospitals: matches });

        if (emergencyRequest) {
            set({
                emergencyRequest: {
                    ...emergencyRequest,
                    matchedHospitals: matches,
                    updatedAt: new Date()
                }
            });
        }
    },

    selectHospital: (hospital) => {
        const { emergencyRequest } = get();
        if (!emergencyRequest) return;

        set({
            emergencyRequest: {
                ...emergencyRequest,
                selectedHospital: hospital,
                updatedAt: new Date()
            }
        });
    },

    assignAmbulance: (ambulanceId) => {
        const { emergencyRequest, ambulances } = get();
        if (!emergencyRequest) return;

        // Update ambulance availability
        const updatedAmbulances = ambulances.map(amb =>
            amb.id === ambulanceId ? { ...amb, available: false } : amb
        );

        set({
            ambulances: updatedAmbulances,
            emergencyRequest: {
                ...emergencyRequest,
                assignedAmbulance: ambulanceId,
                updatedAt: new Date()
            }
        });
    },

    setMedicalReport: (report) => {
        const { emergencyRequest } = get();
        if (!emergencyRequest) return;

        set({
            emergencyRequest: {
                ...emergencyRequest,
                medicalReport: report,
                updatedAt: new Date()
            }
        });
    },

    completeEmergency: () => {
        const { emergencyRequest, ambulances } = get();
        if (!emergencyRequest) return;

        // Release ambulance
        if (emergencyRequest.assignedAmbulance) {
            const updatedAmbulances = ambulances.map(amb =>
                amb.id === emergencyRequest.assignedAmbulance ? { ...amb, available: true } : amb
            );
            set({ ambulances: updatedAmbulances });
        }

        // Update status
        const updatedRequest: EmergencyRequest = {
            ...emergencyRequest,
            status: 'completed',
            updatedAt: new Date(),
            timeline: [
                ...emergencyRequest.timeline,
                {
                    status: 'completed',
                    timestamp: new Date(),
                    message: 'Emergency completed successfully'
                }
            ]
        };
        set({ emergencyRequest: updatedRequest });
    },

    setIsRecording: (recording) => set({ isRecording: recording }),

    setVoiceTranscript: (transcript) => set({ voiceTranscript: transcript }),

    updateVitalsRealtime: (vitals) => {
        set({ vitalSigns: vitals });
    },

    updateHospitalAvailability: (hospitalId, updates) => {
        const { hospitals } = get();
        const updatedHospitals = hospitals.map(h =>
            h.id === hospitalId ? { ...h, ...updates } : h
        );
        set({ hospitals: updatedHospitals });
    },

    reset: () => set({
        emergencyRequest: null,
        vitalSigns: null,
        matchedHospitals: [],
        isRecording: false,
        voiceTranscript: ''
    })
}));
