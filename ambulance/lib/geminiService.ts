import { GoogleGenerativeAI } from '@google/generative-ai';
import { SymptomAnalysis, GeneratedReport, HospitalSpecialization, Severity, BloodType, PatientData, VitalSigns } from '@/types';

const genAI = new GoogleGenerativeAI(process.env.NEXT_PUBLIC_GEMINI_API_KEY || '');

export class GeminiService {
    private model = genAI.getGenerativeModel({ model: 'gemini-pro' });

    /**
     * Analyze symptoms from voice transcript and extract medical information
     */
    async analyzeSymptoms(transcript: string): Promise<SymptomAnalysis> {
        try {
            const prompt = `You are a medical AI assistant. Analyze the following patient symptoms and determine if this is a valid medical emergency or health-related query.

Patient's description: "${transcript}"

Provide your analysis in the following JSON format:
{
  "isMedicalEmergency": true/false,
  "validationError": "Reason if not a medical emergency (e.g., 'Input is unrelated to health', 'Gibberish input')",
  "symptoms": ["list of identified symptoms"],
  "severity": "Critical|High|Moderate|Low",
  "urgency": 1-10 (number),
  "requiredSpecializations": ["list from: General, Cardiac, Trauma, Pediatric, Neurology, Orthopedic, Eye, Dental, Maternity, Oncology, Emergency"],
  "needsBlood": true/false,
  "bloodType": "A+|A-|B+|B-|AB+|AB-|O+|O-" (if known, otherwise null),
  "estimatedCondition": "brief description of possible condition"
}

Important:
1. If the input is NOT related to health, medicine, or emergencies (e.g., "I want pizza", "Hello world", random gibberish), set "isMedicalEmergency" to false and provide a "validationError".
2. If it IS related, set "isMedicalEmergency" to true and fill the rest.
3. Return ONLY the JSON object, no additional text.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid response format');
            }

            const analysis = JSON.parse(jsonMatch[0]) as SymptomAnalysis;
            return analysis;
        } catch (error) {
            console.error('Error analyzing symptoms with Gemini:', error);
            // Fallback to mock analysis
            return this.mockSymptomAnalysis(transcript);
        }
    }

    /**
     * Generate comprehensive medical report for hospital
     */
    async generateMedicalReport(
        patientData: PatientData,
        vitalSigns: VitalSigns
    ): Promise<GeneratedReport> {
        try {
            const prompt = `You are a medical AI assistant generating a comprehensive emergency medical report.

Patient Information:
- Symptoms: ${patientData.symptoms.join(', ')}
- Severity: ${patientData.severity}
- Urgency: ${patientData.urgency}/10
- Age: ${patientData.age || 'Unknown'}
- Gender: ${patientData.gender || 'Unknown'}
- Allergies: ${patientData.allergies?.join(', ') || 'None reported'}
- Current Medications: ${patientData.currentMedications?.join(', ') || 'None reported'}

Vital Signs:
- Heart Rate: ${vitalSigns.heartRate} bpm
- Blood Pressure: ${vitalSigns.bloodPressure.systolic}/${vitalSigns.bloodPressure.diastolic} mmHg
- Oxygen Saturation: ${vitalSigns.oxygenSaturation}%
- Temperature: ${vitalSigns.temperature}°C
- Respiratory Rate: ${vitalSigns.respiratoryRate} breaths/min
${vitalSigns.glucoseLevel ? `- Glucose Level: ${vitalSigns.glucoseLevel} mg/dL` : ''}

Generate a medical report in the following JSON format:
{
  "summary": "Brief 2-3 sentence summary of the patient's condition",
  "detailedAnalysis": "Detailed analysis of symptoms and vital signs (3-4 paragraphs)",
  "recommendedActions": ["list of immediate actions the hospital should take"],
  "urgencyLevel": "Critical|High|Moderate|Low",
  "specialistRequired": ["list of required specialists from: General, Cardiac, Trauma, Pediatric, Neurology, Orthopedic, Eye, Dental, Maternity, Oncology, Emergency"]
}

Important: Return ONLY the JSON object, no additional text.`;

            const result = await this.model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();

            // Extract JSON from response
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) {
                throw new Error('Invalid response format');
            }

            const report = JSON.parse(jsonMatch[0]) as GeneratedReport;
            return report;
        } catch (error) {
            console.error('Error generating medical report with Gemini:', error);
            // Fallback to mock report
            return this.mockMedicalReport(patientData, vitalSigns);
        }
    }

    /**
     * Mock symptom analysis for fallback
     */
    private mockSymptomAnalysis(transcript: string): SymptomAnalysis {
        const lowerTranscript = transcript.toLowerCase();

        // Simple keyword-based analysis
        const symptoms: string[] = [];
        let severity: Severity = 'Moderate';
        let urgency = 5;
        const requiredSpecializations: HospitalSpecialization[] = ['General'];
        let needsBlood = false;

        // Basic validation for mock service
        const medicalKeywords = [
            'pain', 'hurt', 'bleed', 'blood', 'break', 'broken', 'ache', 'fever', 'cough',
            'breath', 'choke', 'burn', 'cut', 'wound', 'sick', 'vomit', 'nausea',
            'dizzy', 'faint', 'unconscious', 'attack', 'stroke', 'seizure', 'pregnant',
            'labor', 'baby', 'child', 'accident', 'crash', 'injury', 'poison', 'bite'
        ];

        const isMedical = medicalKeywords.some(keyword => lowerTranscript.includes(keyword));

        if (!isMedical && transcript.length > 5) {
            return {
                symptoms: [],
                severity: 'Low',
                urgency: 0,
                requiredSpecializations: [],
                needsBlood: false,
                isMedicalEmergency: false,
                validationError: "Input does not appear to be a medical emergency. Please describe symptoms."
            };
        }

        // Cardiac symptoms
        if (lowerTranscript.includes('chest pain') || lowerTranscript.includes('heart')) {
            symptoms.push('Chest pain', 'Cardiac distress');
            severity = 'Critical';
            urgency = 9;
            requiredSpecializations.push('Cardiac', 'Emergency');
        }

        // Trauma
        if (lowerTranscript.includes('accident') || lowerTranscript.includes('injury') || lowerTranscript.includes('bleeding')) {
            symptoms.push('Physical trauma', 'Injury');
            severity = 'High';
            urgency = 8;
            requiredSpecializations.push('Trauma', 'Emergency');
            needsBlood = true;
        }

        // Neurological
        if (lowerTranscript.includes('headache') || lowerTranscript.includes('dizzy') || lowerTranscript.includes('stroke')) {
            symptoms.push('Neurological symptoms');
            severity = 'High';
            urgency = 8;
            requiredSpecializations.push('Neurology', 'Emergency');
        }

        // Respiratory
        if (lowerTranscript.includes('breathing') || lowerTranscript.includes('breath') || lowerTranscript.includes('asthma')) {
            symptoms.push('Respiratory distress');
            severity = 'High';
            urgency = 8;
            requiredSpecializations.push('Emergency');
        }

        // Eye problems
        if (lowerTranscript.includes('eye') || lowerTranscript.includes('vision')) {
            symptoms.push('Vision problems');
            severity = 'Moderate';
            urgency = 5;
            requiredSpecializations.push('Eye');
        }

        // Dental
        if (lowerTranscript.includes('tooth') || lowerTranscript.includes('dental')) {
            symptoms.push('Dental emergency');
            severity = 'Moderate';
            urgency = 4;
            requiredSpecializations.push('Dental');
        }

        // Pediatric
        if (lowerTranscript.includes('child') || lowerTranscript.includes('baby') || lowerTranscript.includes('infant')) {
            requiredSpecializations.push('Pediatric');
        }

        // Maternity
        if (lowerTranscript.includes('pregnant') || lowerTranscript.includes('pregnancy') || lowerTranscript.includes('labor')) {
            symptoms.push('Pregnancy-related emergency');
            severity = 'High';
            urgency = 8;
            requiredSpecializations.push('Maternity', 'Emergency');
        }

        // Default symptoms if none detected
        if (symptoms.length === 0) {
            symptoms.push('General discomfort', 'Medical attention required');
        }

        return {
            symptoms,
            severity,
            urgency,
            requiredSpecializations: Array.from(new Set(requiredSpecializations)),
            needsBlood,
            estimatedCondition: `Patient requires ${severity.toLowerCase()} priority medical attention for ${symptoms[0].toLowerCase()}.`,
            isMedicalEmergency: true
        };
    }

    /**
     * Mock medical report for fallback
     */
    private mockMedicalReport(patientData: PatientData, vitalSigns: VitalSigns): GeneratedReport {
        const vitalStatus = this.assessVitalSigns(vitalSigns);

        return {
            summary: `Patient presenting with ${patientData.symptoms.join(', ')}. Vital signs show ${vitalStatus}. Immediate medical attention required.`,
            detailedAnalysis: `The patient has reported the following symptoms: ${patientData.symptoms.join(', ')}. Based on the severity assessment (${patientData.severity}), this case requires ${patientData.urgency >= 7 ? 'immediate' : 'prompt'} medical intervention.\n\nVital Signs Analysis:\n- Heart Rate: ${vitalSigns.heartRate} bpm (${this.assessHeartRate(vitalSigns.heartRate)})\n- Blood Pressure: ${vitalSigns.bloodPressure.systolic}/${vitalSigns.bloodPressure.diastolic} mmHg (${this.assessBloodPressure(vitalSigns.bloodPressure)})\n- Oxygen Saturation: ${vitalSigns.oxygenSaturation}% (${this.assessOxygenSaturation(vitalSigns.oxygenSaturation)})\n- Temperature: ${vitalSigns.temperature}°C (${this.assessTemperature(vitalSigns.temperature)})\n\nThe patient requires specialized care in ${patientData.requiredSpecialization.join(', ')} departments.`,
            recommendedActions: [
                'Prepare emergency room for immediate patient intake',
                `Alert ${patientData.requiredSpecialization[0]} specialist on duty`,
                'Prepare necessary diagnostic equipment',
                vitalStatus.includes('abnormal') ? 'Standby for potential stabilization procedures' : 'Monitor vital signs upon arrival',
                patientData.bloodTypeNeeded ? `Prepare blood bank for potential ${patientData.bloodTypeNeeded} blood transfusion` : 'Standard emergency protocols'
            ],
            urgencyLevel: patientData.severity,
            specialistRequired: patientData.requiredSpecialization
        };
    }

    private assessVitalSigns(vitals: VitalSigns): string {
        const issues: string[] = [];

        if (vitals.heartRate < 60 || vitals.heartRate > 100) issues.push('abnormal heart rate');
        if (vitals.bloodPressure.systolic > 140 || vitals.bloodPressure.diastolic > 90) issues.push('elevated blood pressure');
        if (vitals.oxygenSaturation < 95) issues.push('low oxygen saturation');
        if (vitals.temperature > 37.5 || vitals.temperature < 36) issues.push('abnormal temperature');

        return issues.length > 0 ? issues.join(', ') : 'stable vital signs';
    }

    private assessHeartRate(hr: number): string {
        if (hr < 60) return 'Bradycardia';
        if (hr > 100) return 'Tachycardia';
        return 'Normal';
    }

    private assessBloodPressure(bp: { systolic: number; diastolic: number }): string {
        if (bp.systolic > 140 || bp.diastolic > 90) return 'Hypertensive';
        if (bp.systolic < 90 || bp.diastolic < 60) return 'Hypotensive';
        return 'Normal';
    }

    private assessOxygenSaturation(spo2: number): string {
        if (spo2 < 90) return 'Critical';
        if (spo2 < 95) return 'Low';
        return 'Normal';
    }

    private assessTemperature(temp: number): string {
        if (temp > 38) return 'Fever';
        if (temp < 36) return 'Hypothermia';
        return 'Normal';
    }
}

// Singleton instance
export const geminiService = new GeminiService();
