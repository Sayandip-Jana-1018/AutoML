import { VitalSigns } from '@/types';

export class VitalSimulator {
    /**
     * Generate realistic baseline vital signs
     */
    static generateBaseline(): VitalSigns {
        return {
            heartRate: this.randomInRange(70, 85),
            bloodPressure: {
                systolic: this.randomInRange(110, 130),
                diastolic: this.randomInRange(70, 85)
            },
            oxygenSaturation: this.randomInRange(96, 99),
            temperature: this.randomInRange(36.5, 37.2, 1),
            respiratoryRate: this.randomInRange(14, 18),
            glucoseLevel: this.randomInRange(80, 110),
            timestamp: new Date()
        };
    }

    /**
     * Generate vital signs based on severity
     */
    static generateBySeverity(severity: 'Critical' | 'High' | 'Moderate' | 'Low'): VitalSigns {
        switch (severity) {
            case 'Critical':
                return {
                    heartRate: this.randomInRange(120, 150),
                    bloodPressure: {
                        systolic: this.randomInRange(160, 180),
                        diastolic: this.randomInRange(95, 110)
                    },
                    oxygenSaturation: this.randomInRange(85, 92),
                    temperature: this.randomInRange(38.5, 40, 1),
                    respiratoryRate: this.randomInRange(25, 35),
                    glucoseLevel: this.randomInRange(150, 200),
                    timestamp: new Date()
                };

            case 'High':
                return {
                    heartRate: this.randomInRange(100, 120),
                    bloodPressure: {
                        systolic: this.randomInRange(140, 160),
                        diastolic: this.randomInRange(90, 100)
                    },
                    oxygenSaturation: this.randomInRange(92, 95),
                    temperature: this.randomInRange(37.8, 38.5, 1),
                    respiratoryRate: this.randomInRange(20, 25),
                    glucoseLevel: this.randomInRange(120, 150),
                    timestamp: new Date()
                };

            case 'Moderate':
                return {
                    heartRate: this.randomInRange(85, 100),
                    bloodPressure: {
                        systolic: this.randomInRange(130, 145),
                        diastolic: this.randomInRange(85, 95)
                    },
                    oxygenSaturation: this.randomInRange(94, 97),
                    temperature: this.randomInRange(37.3, 37.8, 1),
                    respiratoryRate: this.randomInRange(18, 22),
                    glucoseLevel: this.randomInRange(100, 120),
                    timestamp: new Date()
                };

            case 'Low':
            default:
                return this.generateBaseline();
        }
    }

    /**
     * Simulate vital sign changes over time (for real-time updates)
     */
    static simulateChange(current: VitalSigns, severity: 'Critical' | 'High' | 'Moderate' | 'Low'): VitalSigns {
        const variance = severity === 'Critical' ? 5 : severity === 'High' ? 3 : 2;

        return {
            heartRate: Math.max(40, Math.min(180, current.heartRate + this.randomInRange(-variance, variance))),
            bloodPressure: {
                systolic: Math.max(80, Math.min(200, current.bloodPressure.systolic + this.randomInRange(-variance, variance))),
                diastolic: Math.max(50, Math.min(120, current.bloodPressure.diastolic + this.randomInRange(-variance, variance)))
            },
            oxygenSaturation: Math.max(70, Math.min(100, current.oxygenSaturation + this.randomInRange(-1, 1))),
            temperature: Math.max(35, Math.min(42, current.temperature + this.randomInRange(-0.2, 0.2, 1))),
            respiratoryRate: Math.max(10, Math.min(40, current.respiratoryRate + this.randomInRange(-2, 2))),
            glucoseLevel: current.glucoseLevel ? Math.max(50, Math.min(300, current.glucoseLevel + this.randomInRange(-5, 5))) : undefined,
            timestamp: new Date()
        };
    }

    /**
     * Check if vital signs are abnormal
     */
    static isAbnormal(vitals: VitalSigns): {
        isAbnormal: boolean;
        abnormalities: string[];
    } {
        const abnormalities: string[] = [];

        if (vitals.heartRate < 60) abnormalities.push('Bradycardia (Low Heart Rate)');
        if (vitals.heartRate > 100) abnormalities.push('Tachycardia (High Heart Rate)');

        if (vitals.bloodPressure.systolic > 140) abnormalities.push('High Systolic BP');
        if (vitals.bloodPressure.systolic < 90) abnormalities.push('Low Systolic BP');
        if (vitals.bloodPressure.diastolic > 90) abnormalities.push('High Diastolic BP');
        if (vitals.bloodPressure.diastolic < 60) abnormalities.push('Low Diastolic BP');

        if (vitals.oxygenSaturation < 95) abnormalities.push('Low Oxygen Saturation');

        if (vitals.temperature > 37.5) abnormalities.push('Fever');
        if (vitals.temperature < 36) abnormalities.push('Hypothermia');

        if (vitals.respiratoryRate > 20) abnormalities.push('Tachypnea (Rapid Breathing)');
        if (vitals.respiratoryRate < 12) abnormalities.push('Bradypnea (Slow Breathing)');

        if (vitals.glucoseLevel) {
            if (vitals.glucoseLevel > 140) abnormalities.push('Hyperglycemia (High Blood Sugar)');
            if (vitals.glucoseLevel < 70) abnormalities.push('Hypoglycemia (Low Blood Sugar)');
        }

        return {
            isAbnormal: abnormalities.length > 0,
            abnormalities
        };
    }

    /**
     * Get vital sign status color
     */
    static getStatusColor(vitals: VitalSigns): 'green' | 'yellow' | 'red' {
        const { abnormalities } = this.isAbnormal(vitals);

        if (abnormalities.length === 0) return 'green';
        if (abnormalities.length <= 2) return 'yellow';
        return 'red';
    }

    /**
     * Helper: Generate random number in range
     */
    private static randomInRange(min: number, max: number, decimals: number = 0): number {
        const value = Math.random() * (max - min) + min;
        return decimals > 0 ? parseFloat(value.toFixed(decimals)) : Math.round(value);
    }
}
