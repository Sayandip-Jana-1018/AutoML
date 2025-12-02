// Core type definitions for the Enhanced Emergency Response System

export type HospitalSpecialization =
    | 'General'
    | 'Cardiac'
    | 'Trauma'
    | 'Pediatric'
    | 'Neurology'
    | 'Orthopedic'
    | 'Eye'
    | 'Dental'
    | 'Maternity'
    | 'Oncology'
    | 'Emergency';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'AB+' | 'AB-' | 'O+' | 'O-';

export type Severity = 'Critical' | 'High' | 'Moderate' | 'Low';

export type EmergencyStatus =
    | 'idle'
    | 'recording'
    | 'processing'
    | 'analyzing'
    | 'dispatching'
    | 'ambulance_en_route_to_patient'
    | 'patient_picked_up'
    | 'en_route_to_hospital'
    | 'arriving_at_hospital'
    | 'arrived_at_hospital'
    | 'completed';

export interface BedAvailability {
    general: {
        total: number;
        available: number;
    };
    icu: {
        total: number;
        available: number;
    };
    emergency: {
        total: number;
        available: number;
    };
}

export interface DoctorAvailability {
    specialization: HospitalSpecialization;
    total: number;
    available: number;
    onCall: number;
}

export interface BloodBank {
    bloodType: BloodType;
    units: number;
}

export interface Hospital {
    id: string;
    name: string;
    location: [number, number]; // [longitude, latitude]
    coordinates: [number, number]; // [longitude, latitude] - alias for compatibility
    address: string;
    contactNumber: string;
    primarySpecialization: HospitalSpecialization;
    specializations: HospitalSpecialization[];
    rating: number;
    beds: BedAvailability;
    doctors: DoctorAvailability[];
    facilities: string[];
    bloodBank: BloodBank[];
    averageResponseTime: number; // in minutes
    responseTime: number; // in minutes - alias for compatibility
    hasAmbulance: boolean;
    hasEmergencyRoom: boolean;
    has24x7Service: boolean;
}


export interface VitalSigns {
    heartRate: number; // bpm
    bloodPressure: {
        systolic: number;
        diastolic: number;
    };
    oxygenSaturation: number; // percentage
    temperature: number; // celsius
    respiratoryRate: number; // breaths per minute
    glucoseLevel?: number; // mg/dL
    timestamp: Date;
}

export interface PatientData {
    symptoms: string[]; // extracted from voice
    rawTranscript: string; // original voice transcript
    severity: Severity;
    urgency: number; // 1-10
    requiredSpecialization: HospitalSpecialization[];
    bloodTypeNeeded?: BloodType;
    additionalNotes?: string;
    age?: number;
    gender?: 'Male' | 'Female' | 'Other';
    allergies?: string[];
    currentMedications?: string[];
    condition?: string; // Added for compatibility with EmergencyControls
}

export interface MedicalReport {
    id: string;
    patientData: PatientData;
    vitalSigns: VitalSigns;
    generatedAt: Date;
    summary: string;
    recommendedActions: string[];
    estimatedDiagnosis?: string;
    urgencyLevel: Severity;
    specialistRequired: HospitalSpecialization[];
}

export interface HospitalMatch {
    hospital: Hospital;
    score: number; // 0-100
    distance: number; // km
    eta: number; // minutes
    matchReasons: string[];
    availabilityStatus: {
        beds: boolean;
        doctors: boolean;
        blood: boolean;
        facilities: boolean;
    };
}

export interface EmergencyRequest {
    id: string;
    patientLocation: [number, number];
    patientData: PatientData | null;
    vitalSigns: VitalSigns | null;
    assignedAmbulance: string | null; // ambulance ID
    selectedHospital: Hospital | null;
    matchedHospitals: HospitalMatch[];
    status: EmergencyStatus;
    medicalReport: MedicalReport | null;
    createdAt: Date;
    updatedAt: Date;
    timeline: {
        status: EmergencyStatus;
        timestamp: Date;
        message: string;
    }[];
}

export interface Ambulance {
    id: string;
    coordinates: [number, number];
    driverName: string;
    vehicleNumber: string;
    marker?: any; // mapboxgl.Marker
    available: boolean;
    equipment: string[];
    paramedics: number;
}

// Gemini AI Response Types
export interface SymptomAnalysis {
    symptoms: string[];
    severity: Severity;
    urgency: number;
    requiredSpecializations: HospitalSpecialization[];
    needsBlood: boolean;
    bloodType?: BloodType;
    estimatedCondition?: string;
    isMedicalEmergency?: boolean; // New field for validation
    validationError?: string; // Reason if not a medical emergency
}

export interface GeneratedReport {
    summary: string;
    detailedAnalysis: string;
    recommendedActions: string[];
    urgencyLevel: Severity;
    specialistRequired: HospitalSpecialization[];
}
