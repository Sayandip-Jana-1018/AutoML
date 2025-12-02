import { Hospital, HospitalMatch, PatientData, HospitalSpecialization, BloodType } from '@/types';
import * as turf from '@turf/turf';

export class HospitalMatcher {
    /**
     * Find and rank hospitals based on patient needs
     */
    static async matchHospitals(
        hospitals: Hospital[],
        patientLocation: [number, number],
        patientData: PatientData,
        mapboxToken: string
    ): Promise<HospitalMatch[]> {
        const matches: HospitalMatch[] = [];

        for (const hospital of hospitals) {
            try {
                // Calculate distance and ETA
                const { distance, eta } = await this.calculateRoute(
                    patientLocation,
                    hospital.coordinates,
                    mapboxToken
                );

                // Calculate match score
                const score = this.calculateMatchScore(hospital, patientData, distance, eta);

                // Check availability
                const availabilityStatus = this.checkAvailability(hospital, patientData);

                // Get match reasons
                const matchReasons = this.getMatchReasons(hospital, patientData, score);

                matches.push({
                    hospital,
                    score,
                    distance,
                    eta,
                    matchReasons,
                    availabilityStatus
                });
            } catch (error) {
                console.error(`Error matching hospital ${hospital.id}:`, error);
            }
        }

        // Sort by score (highest first)
        return matches.sort((a, b) => b.score - a.score);
    }

    /**
     * Calculate route distance and ETA using Mapbox
     */
    private static async calculateRoute(
        from: [number, number],
        to: [number, number],
        mapboxToken: string
    ): Promise<{ distance: number; eta: number }> {
        try {
            const response = await fetch(
                `https://api.mapbox.com/directions/v5/mapbox/driving/${from[0]},${from[1]};${to[0]},${to[1]}?access_token=${mapboxToken}`
            );

            if (!response.ok) {
                throw new Error('Failed to fetch route');
            }

            const data = await response.json();
            const route = data.routes[0];

            return {
                distance: route.distance / 1000, // Convert to km
                eta: Math.round(route.duration / 60) // Convert to minutes
            };
        } catch (error) {
            // Fallback to straight-line distance
            const from_point = turf.point(from);
            const to_point = turf.point(to);
            const distance = turf.distance(from_point, to_point);
            const eta = Math.round(distance * 2); // Rough estimate: 2 min per km

            return { distance, eta };
        }
    }

    /**
     * Calculate match score (0-100)
     */
    private static calculateMatchScore(
        hospital: Hospital,
        patientData: PatientData,
        distance: number,
        eta: number
    ): number {
        let score = 0;

        // 1. Specialization Match (40 points)
        const specializationScore = this.calculateSpecializationScore(
            hospital,
            patientData.requiredSpecialization
        );
        score += specializationScore * 0.4;

        // 2. Bed Availability (20 points)
        const bedScore = this.calculateBedAvailabilityScore(hospital, patientData.severity);
        score += bedScore * 0.2;

        // 3. Doctor Availability (15 points)
        const doctorScore = this.calculateDoctorAvailabilityScore(
            hospital,
            patientData.requiredSpecialization
        );
        score += doctorScore * 0.15;

        // 4. Distance/ETA (15 points)
        const distanceScore = this.calculateDistanceScore(distance, eta);
        score += distanceScore * 0.15;

        // 5. Blood Availability (10 points)
        const bloodScore = this.calculateBloodAvailabilityScore(
            hospital,
            patientData.bloodTypeNeeded
        );
        score += bloodScore * 0.1;

        // Bonus points
        if (hospital.has24x7Service) score += 2;
        if (hospital.hasEmergencyRoom) score += 3;
        if (hospital.rating >= 4.5) score += 2;

        // Urgency multiplier
        if (patientData.urgency >= 8 && hospital.primarySpecialization === 'Emergency') {
            score *= 1.1; // 10% boost for emergency hospitals in critical cases
        }

        return Math.min(100, Math.round(score));
    }

    /**
     * Calculate specialization match score (0-100)
     */
    private static calculateSpecializationScore(
        hospital: Hospital,
        requiredSpecs: HospitalSpecialization[]
    ): number {
        if (requiredSpecs.length === 0) return 50;

        let matches = 0;
        for (const spec of requiredSpecs) {
            if (hospital.specializations.includes(spec)) {
                matches++;
                // Extra points if it's the primary specialization
                if (hospital.primarySpecialization === spec) {
                    matches += 0.5;
                }
            }
        }

        const matchPercentage = (matches / requiredSpecs.length) * 100;
        return Math.min(100, matchPercentage);
    }

    /**
     * Calculate bed availability score (0-100)
     */
    private static calculateBedAvailabilityScore(
        hospital: Hospital,
        severity: 'Critical' | 'High' | 'Moderate' | 'Low'
    ): number {
        const { beds } = hospital;

        let score = 0;

        // Check appropriate bed type based on severity
        if (severity === 'Critical') {
            const icuAvailability = (beds.icu.available / beds.icu.total) * 100;
            score = icuAvailability;
        } else if (severity === 'High') {
            const emergencyAvailability = (beds.emergency.available / beds.emergency.total) * 100;
            score = emergencyAvailability;
        } else {
            const generalAvailability = (beds.general.available / beds.general.total) * 100;
            score = generalAvailability;
        }

        // Bonus if multiple bed types are available
        if (beds.general.available > 0 && beds.icu.available > 0) {
            score += 10;
        }

        return Math.min(100, score);
    }

    /**
     * Calculate doctor availability score (0-100)
     */
    private static calculateDoctorAvailabilityScore(
        hospital: Hospital,
        requiredSpecs: HospitalSpecialization[]
    ): number {
        if (requiredSpecs.length === 0) return 50;

        let totalScore = 0;
        let matchedSpecs = 0;

        for (const spec of requiredSpecs) {
            const doctor = hospital.doctors.find(d => d.specialization === spec);
            if (doctor) {
                matchedSpecs++;
                const availability = (doctor.available / doctor.total) * 100;
                totalScore += availability;
            }
        }

        if (matchedSpecs === 0) return 0;

        return totalScore / matchedSpecs;
    }

    /**
     * Calculate distance score (0-100)
     */
    private static calculateDistanceScore(distance: number, eta: number): number {
        // Prefer closer hospitals
        // 0-2 km: 100 points
        // 2-5 km: 80 points
        // 5-10 km: 50 points
        // 10+ km: 20 points

        if (distance <= 2) return 100;
        if (distance <= 5) return 80;
        if (distance <= 10) return 50;
        return Math.max(20, 100 - (distance * 5));
    }

    /**
     * Calculate blood availability score (0-100)
     */
    private static calculateBloodAvailabilityScore(
        hospital: Hospital,
        bloodTypeNeeded?: BloodType
    ): number {
        if (!bloodTypeNeeded) return 100; // No blood needed, full score

        const bloodBank = hospital.bloodBank.find(b => b.bloodType === bloodTypeNeeded);

        if (!bloodBank) return 0;
        if (bloodBank.units === 0) return 0;
        if (bloodBank.units >= 20) return 100;
        if (bloodBank.units >= 10) return 70;
        return 40;
    }

    /**
     * Check availability status
     */
    private static checkAvailability(
        hospital: Hospital,
        patientData: PatientData
    ): {
        beds: boolean;
        doctors: boolean;
        blood: boolean;
        facilities: boolean;
    } {
        // Check beds
        const hasBeds = hospital.beds.general.available > 0 ||
            hospital.beds.icu.available > 0 ||
            hospital.beds.emergency.available > 0;

        // Check doctors
        const hasDoctors = hospital.doctors.some(d =>
            patientData.requiredSpecialization.includes(d.specialization) && d.available > 0
        );

        // Check blood
        const hasBlood = !patientData.bloodTypeNeeded ||
            hospital.bloodBank.some(b =>
                b.bloodType === patientData.bloodTypeNeeded && b.units > 0
            );

        // Check facilities (basic check)
        const hasFacilities = hospital.facilities.length > 0;

        return {
            beds: hasBeds,
            doctors: hasDoctors,
            blood: hasBlood,
            facilities: hasFacilities
        };
    }

    /**
     * Get human-readable match reasons
     */
    private static getMatchReasons(
        hospital: Hospital,
        patientData: PatientData,
        score: number
    ): string[] {
        const reasons: string[] = [];

        // Specialization match
        const matchedSpecs = hospital.specializations.filter(s =>
            patientData.requiredSpecialization.includes(s)
        );
        if (matchedSpecs.length > 0) {
            reasons.push(`Specializes in ${matchedSpecs.join(', ')}`);
        }

        // Bed availability
        if (hospital.beds.icu.available > 0 && patientData.severity === 'Critical') {
            reasons.push(`${hospital.beds.icu.available} ICU beds available`);
        } else if (hospital.beds.emergency.available > 0) {
            reasons.push(`${hospital.beds.emergency.available} emergency beds available`);
        }

        // Doctor availability
        const availableDoctors = hospital.doctors.filter(d =>
            patientData.requiredSpecialization.includes(d.specialization) && d.available > 0
        );
        if (availableDoctors.length > 0) {
            reasons.push(`${availableDoctors.reduce((sum, d) => sum + d.available, 0)} specialists available`);
        }

        // Blood availability
        if (patientData.bloodTypeNeeded) {
            const blood = hospital.bloodBank.find(b => b.bloodType === patientData.bloodTypeNeeded);
            if (blood && blood.units > 0) {
                reasons.push(`${blood.units} units of ${patientData.bloodTypeNeeded} blood available`);
            }
        }

        // 24x7 service
        if (hospital.has24x7Service) {
            reasons.push('24/7 emergency service');
        }

        // High rating
        if (hospital.rating >= 4.7) {
            reasons.push(`Highly rated (${hospital.rating}★)`);
        }

        // Fast response
        if (hospital.responseTime <= 7) {
            reasons.push(`Quick response time (${hospital.responseTime} min)`);
        }

        return reasons;
    }

    /**
     * Get top N matched hospitals
     */
    static getTopMatches(matches: HospitalMatch[], count: number = 3): HospitalMatch[] {
        return matches.slice(0, count);
    }

    /**
     * Filter hospitals by minimum score
     */
    static filterByMinScore(matches: HospitalMatch[], minScore: number = 50): HospitalMatch[] {
        return matches.filter(m => m.score >= minScore);
    }
}
