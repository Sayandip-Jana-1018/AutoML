import { Hospital, HospitalSpecialization, BloodType } from '@/types';
import * as turf from '@turf/turf';

/**
 * Generate comprehensive dummy hospital data distributed across the map
 */
export function generateHospitals(centerLocation: [number, number]): Hospital[] {
    const hospitals: Hospital[] = [

        // Cardiac Hospitals
        {
            id: 'HOSP-001',
            name: 'Heart Care Center',
            coordinates: turf.destination(turf.point(centerLocation), 1.2, 45).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.2, 45).geometry.coordinates as [number, number],
            specializations: ['Cardiac', 'Emergency'],
            primarySpecialization: 'Cardiac',
            beds: {
                general: { total: 80, available: 12 },
                icu: { total: 20, available: 3 },
                emergency: { total: 15, available: 5 }
            },
            doctors: [
                { specialization: 'Cardiac', total: 15, available: 8, onCall: 3 },
                { specialization: 'Emergency', total: 10, available: 6, onCall: 2 }
            ],
            bloodBank: generateFullBloodBank(),
            rating: 4.8,
            responseTime: 8,
            averageResponseTime: 8,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['ECG', 'Cath Lab', 'CT Scan', 'MRI', 'ICU', 'CCU'],
            contactNumber: '+91-9876543210',
            address: '123 Cardiac Lane, Medical District'
        },
        {
            id: 'HOSP-002',
            name: 'Apollo Cardiac Institute',
            coordinates: turf.destination(turf.point(centerLocation), 2.5, 135).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 2.5, 135).geometry.coordinates as [number, number],
            specializations: ['Cardiac', 'General', 'Emergency'],
            primarySpecialization: 'Cardiac',
            beds: {
                general: { total: 120, available: 25 },
                icu: { total: 30, available: 8 },
                emergency: { total: 20, available: 10 }
            },
            doctors: [
                { specialization: 'Cardiac', total: 25, available: 15, onCall: 5 },
                { specialization: 'General', total: 20, available: 12, onCall: 4 },
                { specialization: 'Emergency', total: 15, available: 10, onCall: 3 }
            ],
            bloodBank: generateFullBloodBank(),
            rating: 4.9,
            responseTime: 6,
            averageResponseTime: 6,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['ECG', 'Cath Lab', 'CT Scan', 'MRI', 'ICU', 'CCU', 'Cardiac Surgery'],
            contactNumber: '+91-9876543211',
            address: '456 Heart Avenue, Apollo Complex'
        },

        // Trauma Centers
        {
            id: 'HOSP-003',
            name: 'City Trauma Center',
            coordinates: turf.destination(turf.point(centerLocation), 1.8, 225).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.8, 225).geometry.coordinates as [number, number],
            specializations: ['Trauma', 'Orthopedic', 'Emergency'],
            primarySpecialization: 'Trauma',
            beds: {
                general: { total: 100, available: 18 },
                icu: { total: 25, available: 6 },
                emergency: { total: 30, available: 15 }
            },
            doctors: [
                { specialization: 'Trauma', total: 20, available: 12, onCall: 4 },
                { specialization: 'Orthopedic', total: 15, available: 9, onCall: 3 },
                { specialization: 'Emergency', total: 18, available: 12, onCall: 4 }
            ],
            bloodBank: generateFullBloodBank(true), // High blood availability
            rating: 4.7,
            responseTime: 5,
            averageResponseTime: 5,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['X-Ray', 'CT Scan', 'MRI', 'Operation Theater', 'ICU', 'Blood Bank'],
            contactNumber: '+91-9876543212',
            address: '789 Emergency Road, Trauma Wing'
        },

        // Neurology Hospitals
        {
            id: 'HOSP-004',
            name: 'Brain & Spine Institute',
            coordinates: turf.destination(turf.point(centerLocation), 2.2, 315).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 2.2, 315).geometry.coordinates as [number, number],
            specializations: ['Neurology', 'Emergency'],
            primarySpecialization: 'Neurology',
            beds: {
                general: { total: 70, available: 15 },
                icu: { total: 18, available: 4 },
                emergency: { total: 12, available: 6 }
            },
            doctors: [
                { specialization: 'Neurology', total: 18, available: 10, onCall: 4 },
                { specialization: 'Emergency', total: 8, available: 5, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'O-', 'A+', 'AB+']),
            rating: 4.9,
            responseTime: 10,
            averageResponseTime: 10,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['MRI', 'CT Scan', 'EEG', 'Neurosurgery', 'ICU'],
            contactNumber: '+91-9876543213',
            address: '321 Neuro Street, Brain Complex'
        },

        // Pediatric Hospitals
        {
            id: 'HOSP-005',
            name: 'Children\'s Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 1.5, 90).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.5, 90).geometry.coordinates as [number, number],
            specializations: ['Pediatric', 'General', 'Emergency'],
            primarySpecialization: 'Pediatric',
            beds: {
                general: { total: 90, available: 20 },
                icu: { total: 15, available: 5 },
                emergency: { total: 18, available: 8 }
            },
            doctors: [
                { specialization: 'Pediatric', total: 22, available: 14, onCall: 5 },
                { specialization: 'General', total: 12, available: 8, onCall: 3 },
                { specialization: 'Emergency', total: 10, available: 6, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'A+', 'B+', 'AB+']),
            rating: 4.8,
            responseTime: 7,
            averageResponseTime: 7,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Pediatric ICU', 'NICU', 'X-Ray', 'Ultrasound', 'Vaccination Center'],
            contactNumber: '+91-9876543214',
            address: '555 Kids Avenue, Children\'s Wing'
        },

        // Eye Hospitals
        {
            id: 'HOSP-006',
            name: 'Vision Eye Care',
            coordinates: turf.destination(turf.point(centerLocation), 1.0, 180).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.0, 180).geometry.coordinates as [number, number],
            specializations: ['Eye'],
            primarySpecialization: 'Eye',
            beds: {
                general: { total: 40, available: 10 },
                icu: { total: 5, available: 2 },
                emergency: { total: 8, available: 4 }
            },
            doctors: [
                { specialization: 'Eye', total: 12, available: 7, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'A+']),
            rating: 4.6,
            responseTime: 12,
            averageResponseTime: 12,
            hasAmbulance: false,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Eye Surgery', 'Laser Treatment', 'OCT Scan', 'Visual Field Test'],
            contactNumber: '+91-9876543215',
            address: '777 Vision Road, Eye Care Center'
        },

        // Dental Hospitals
        {
            id: 'HOSP-007',
            name: 'Smile Dental Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 0.8, 270).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 0.8, 270).geometry.coordinates as [number, number],
            specializations: ['Dental'],
            primarySpecialization: 'Dental',
            beds: {
                general: { total: 25, available: 8 },
                icu: { total: 3, available: 1 },
                emergency: { total: 6, available: 3 }
            },
            doctors: [
                { specialization: 'Dental', total: 10, available: 6, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'A+', 'B+']),
            rating: 4.5,
            responseTime: 15,
            averageResponseTime: 15,
            hasAmbulance: false,
            hasEmergencyRoom: true,
            has24x7Service: false,
            facilities: ['Dental Surgery', 'X-Ray', 'Root Canal', 'Orthodontics'],
            contactNumber: '+91-9876543216',
            address: '888 Dental Street, Smile Complex'
        },

        // Maternity Hospitals
        {
            id: 'HOSP-008',
            name: 'Mother & Child Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 1.9, 60).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.9, 60).geometry.coordinates as [number, number],
            specializations: ['Maternity', 'Pediatric', 'General'],
            primarySpecialization: 'Maternity',
            beds: {
                general: { total: 85, available: 16 },
                icu: { total: 12, available: 4 },
                emergency: { total: 15, available: 7 }
            },
            doctors: [
                { specialization: 'Maternity', total: 18, available: 11, onCall: 4 },
                { specialization: 'Pediatric', total: 12, available: 7, onCall: 3 },
                { specialization: 'General', total: 10, available: 6, onCall: 2 }
            ],
            bloodBank: generateFullBloodBank(),
            rating: 4.8,
            responseTime: 6,
            averageResponseTime: 6,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Labor Room', 'NICU', 'Ultrasound', 'Fetal Monitor', 'Operation Theater'],
            contactNumber: '+91-9876543217',
            address: '999 Maternity Lane, Mother Care'
        },

        // General Hospitals
        {
            id: 'HOSP-009',
            name: 'City General Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 0.5, 0).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 0.5, 0).geometry.coordinates as [number, number],
            specializations: ['General', 'Emergency'],
            primarySpecialization: 'General',
            beds: {
                general: { total: 150, available: 35 },
                icu: { total: 25, available: 10 },
                emergency: { total: 25, available: 12 }
            },
            doctors: [
                { specialization: 'General', total: 30, available: 18, onCall: 6 },
                { specialization: 'Emergency', total: 20, available: 12, onCall: 4 }
            ],
            bloodBank: generateFullBloodBank(),
            rating: 4.6,
            responseTime: 8,
            averageResponseTime: 8,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['X-Ray', 'CT Scan', 'Ultrasound', 'Laboratory', 'Pharmacy', 'ICU'],
            contactNumber: '+91-9876543218',
            address: '111 General Road, City Center'
        },
        {
            id: 'HOSP-010',
            name: 'Metro Multispecialty Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 2.8, 150).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 2.8, 150).geometry.coordinates as [number, number],
            specializations: ['General', 'Cardiac', 'Orthopedic', 'Emergency'],
            primarySpecialization: 'General',
            beds: {
                general: { total: 200, available: 45 },
                icu: { total: 35, available: 12 },
                emergency: { total: 30, available: 15 }
            },
            doctors: [
                { specialization: 'General', total: 35, available: 20, onCall: 7 },
                { specialization: 'Cardiac', total: 12, available: 7, onCall: 3 },
                { specialization: 'Orthopedic', total: 10, available: 6, onCall: 2 },
                { specialization: 'Emergency', total: 18, available: 11, onCall: 4 }
            ],
            bloodBank: generateFullBloodBank(true),
            rating: 4.7,
            responseTime: 7,
            averageResponseTime: 7,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['CT Scan', 'MRI', 'X-Ray', 'Ultrasound', 'Laboratory', 'Pharmacy', 'ICU', 'Operation Theater'],
            contactNumber: '+91-9876543219',
            address: '222 Metro Avenue, Multispecialty Complex'
        },

        // Orthopedic Hospital
        {
            id: 'HOSP-011',
            name: 'Bone & Joint Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 1.6, 200).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.6, 200).geometry.coordinates as [number, number],
            specializations: ['Orthopedic', 'Trauma'],
            primarySpecialization: 'Orthopedic',
            beds: {
                general: { total: 65, available: 14 },
                icu: { total: 10, available: 3 },
                emergency: { total: 12, available: 6 }
            },
            doctors: [
                { specialization: 'Orthopedic', total: 16, available: 10, onCall: 3 },
                { specialization: 'Trauma', total: 8, available: 5, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'O-', 'A+', 'B+']),
            rating: 4.7,
            responseTime: 9,
            averageResponseTime: 9,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['X-Ray', 'CT Scan', 'MRI', 'Physiotherapy', 'Operation Theater'],
            contactNumber: '+91-9876543220',
            address: '333 Orthopedic Street, Bone Care'
        },

        // Oncology Hospital
        {
            id: 'HOSP-012',
            name: 'Cancer Care Institute',
            coordinates: turf.destination(turf.point(centerLocation), 3.0, 280).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 3.0, 280).geometry.coordinates as [number, number],
            specializations: ['Oncology', 'General'],
            primarySpecialization: 'Oncology',
            beds: {
                general: { total: 75, available: 12 },
                icu: { total: 15, available: 4 },
                emergency: { total: 10, available: 5 }
            },
            doctors: [
                { specialization: 'Oncology', total: 20, available: 12, onCall: 4 },
                { specialization: 'General', total: 10, available: 6, onCall: 2 }
            ],
            bloodBank: generateFullBloodBank(),
            rating: 4.9,
            responseTime: 11,
            averageResponseTime: 11,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Chemotherapy', 'Radiation Therapy', 'CT Scan', 'MRI', 'PET Scan', 'Laboratory'],
            contactNumber: '+91-9876543221',
            address: '444 Oncology Road, Cancer Center'
        },

        // Emergency Hospitals
        {
            id: 'HOSP-013',
            name: '24/7 Emergency Hospital',
            coordinates: turf.destination(turf.point(centerLocation), 0.7, 120).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 0.7, 120).geometry.coordinates as [number, number],
            specializations: ['Emergency', 'Trauma', 'General'],
            primarySpecialization: 'Emergency',
            beds: {
                general: { total: 60, available: 18 },
                icu: { total: 20, available: 8 },
                emergency: { total: 35, available: 20 }
            },
            doctors: [
                { specialization: 'Emergency', total: 25, available: 18, onCall: 6 },
                { specialization: 'Trauma', total: 12, available: 8, onCall: 3 },
                { specialization: 'General', total: 15, available: 10, onCall: 4 }
            ],
            bloodBank: generateFullBloodBank(true),
            rating: 4.8,
            responseTime: 4,
            averageResponseTime: 4,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Emergency Room', 'Trauma Center', 'ICU', 'CT Scan', 'X-Ray', 'Laboratory', 'Blood Bank'],
            contactNumber: '+91-9876543222',
            address: '555 Emergency Boulevard, 24x7 Care'
        },

        // Additional Specialized Hospitals
        {
            id: 'HOSP-014',
            name: 'Advanced Neurosurgery Center',
            coordinates: turf.destination(turf.point(centerLocation), 2.4, 330).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 2.4, 330).geometry.coordinates as [number, number],
            specializations: ['Neurology', 'General'],
            primarySpecialization: 'Neurology',
            beds: {
                general: { total: 55, available: 11 },
                icu: { total: 12, available: 3 },
                emergency: { total: 10, available: 5 }
            },
            doctors: [
                { specialization: 'Neurology', total: 14, available: 8, onCall: 3 },
                { specialization: 'General', total: 8, available: 5, onCall: 2 }
            ],
            bloodBank: generateBloodBank(['O+', 'O-', 'A+', 'AB+']),
            rating: 4.9,
            responseTime: 9,
            averageResponseTime: 9,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['MRI', 'CT Scan', 'Neurosurgery', 'ICU', 'EEG'],
            contactNumber: '+91-9876543223',
            address: '666 Neuro Avenue, Advanced Care'
        },
        {
            id: 'HOSP-015',
            name: 'Pediatric Emergency Center',
            coordinates: turf.destination(turf.point(centerLocation), 1.3, 240).geometry.coordinates as [number, number],
            location: turf.destination(turf.point(centerLocation), 1.3, 240).geometry.coordinates as [number, number],
            specializations: ['Pediatric', 'Emergency'],
            primarySpecialization: 'Pediatric',
            beds: {
                general: { total: 70, available: 16 },
                icu: { total: 12, available: 4 },
                emergency: { total: 20, available: 10 }
            },
            doctors: [
                { specialization: 'Pediatric', total: 18, available: 12, onCall: 4 },
                { specialization: 'Emergency', total: 12, available: 8, onCall: 3 }
            ],
            bloodBank: generateBloodBank(['O+', 'A+', 'B+', 'AB+']),
            rating: 4.7,
            responseTime: 6,
            averageResponseTime: 6,
            hasAmbulance: true,
            hasEmergencyRoom: true,
            has24x7Service: true,
            facilities: ['Pediatric ICU', 'NICU', 'Emergency Room', 'X-Ray', 'Ultrasound'],
            contactNumber: '+91-9876543224',
            address: '777 Pediatric Lane, Kids Emergency'
        }
    ];

    return hospitals;
}

/**
 * Generate full blood bank with all blood types
 */
function generateFullBloodBank(highAvailability: boolean = false): { bloodType: BloodType; units: number }[] {
    const multiplier = highAvailability ? 1.5 : 1;
    return [
        { bloodType: 'O+', units: Math.floor(50 * multiplier) },
        { bloodType: 'O-', units: Math.floor(30 * multiplier) },
        { bloodType: 'A+', units: Math.floor(45 * multiplier) },
        { bloodType: 'A-', units: Math.floor(25 * multiplier) },
        { bloodType: 'B+', units: Math.floor(40 * multiplier) },
        { bloodType: 'B-', units: Math.floor(20 * multiplier) },
        { bloodType: 'AB+', units: Math.floor(35 * multiplier) },
        { bloodType: 'AB-', units: Math.floor(15 * multiplier) }
    ];
}

/**
 * Generate blood bank with specific blood types
 */
function generateBloodBank(types: BloodType[]): { bloodType: BloodType; units: number }[] {
    return types.map(type => ({
        bloodType: type,
        units: Math.floor(Math.random() * 40) + 20
    }));
}

/**
 * Simulate real-time hospital availability updates
 */
export function updateHospitalAvailability(hospital: Hospital): Hospital {
    const variance = Math.random() > 0.5 ? 1 : -1;

    return {
        ...hospital,
        beds: {
            general: {
                ...hospital.beds.general,
                available: Math.max(0, Math.min(hospital.beds.general.total, hospital.beds.general.available + variance))
            },
            icu: {
                ...hospital.beds.icu,
                available: Math.max(0, Math.min(hospital.beds.icu.total, hospital.beds.icu.available + (Math.random() > 0.7 ? variance : 0)))
            },
            emergency: {
                ...hospital.beds.emergency,
                available: Math.max(0, Math.min(hospital.beds.emergency.total, hospital.beds.emergency.available + variance))
            }
        }
    };
}
