'use server';

import fs from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.env.USERPROFILE || 'C:\\Users\\Sayan', 'Desktop\\Healthy\\ml-aws\\sample_data');
const FILE_PATH = path.join(DATA_DIR, 'integrated_patient_data.csv');

export async function savePatientData(data: any) {
    try {
        // Ensure directory exists
        if (!fs.existsSync(DATA_DIR)) {
            fs.mkdirSync(DATA_DIR, { recursive: true });
        }

        const headers = [
            'timestamp',
            'heart_rate',
            'spo2',
            'systolic_bp',
            'diastolic_bp',
            'temperature',
            'respiratory_rate',
            'ecg_raw',
            'condition',
            'is_simulated'
        ];

        const row = [
            new Date().toISOString(),
            data.heartRate,
            data.spo2,
            data.bloodPressure.systolic,
            data.bloodPressure.diastolic,
            data.temperature,
            data.respiratoryRate,
            data.ecgRaw || 0,
            data.condition,
            data.isSimulated ? 1 : 0
        ].join(',');

        // If file doesn't exist, write headers first
        if (!fs.existsSync(FILE_PATH)) {
            fs.writeFileSync(FILE_PATH, headers.join(',') + '\n');
        }

        // Append data
        fs.appendFileSync(FILE_PATH, row + '\n');
        return { success: true };
    } catch (error) {
        console.error('Error saving patient data:', error);
        return { success: false, error: 'Failed to save data' };
    }
}
