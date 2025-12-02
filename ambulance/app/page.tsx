'use client';

import React, { useState, useRef, useEffect } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { useEmergencyStore } from '@/lib/store';
import { VitalSimulator } from '@/lib/vitalSimulator';
import { HospitalMatcher } from '@/lib/hospitalMatcher';
import { PatientData, VitalSigns, EmergencyStatus } from '@/types';
import { Header } from '@/components/Header';
import { EmergencyControls } from '@/components/EmergencyControls';
import { MapComponent } from '@/components/MapComponent';
import { HospitalMatchPanel } from '@/components/HospitalMatchPanel';
import { SimpleThemeToggle } from '@/components/simple-theme-toggle';
import { useTheme } from 'next-themes';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

export default function IntegratedEmergencyDashboard() {
  const [currentStatus, setCurrentStatus] = useState<EmergencyStatus>('idle');
  const [patientData, setPatientData] = useState<PatientData | null>(null);
  const [vitals, setVitals] = useState<VitalSigns | null>(null);
  const [selectedHospitalId, setSelectedHospitalId] = useState<string | undefined>(undefined);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);
  const [ambulancePosition, setAmbulancePosition] = useState<[number, number] | null>(null);
  const { resolvedTheme } = useTheme();

  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const ambulanceMarker = useRef<mapboxgl.Marker | null>(null);
  const hospitalMarkers = useRef<mapboxgl.Marker[]>([]);

  const {
    hospitals,
    setHospitals,
    userLocation,
    setUserLocation,
    matchedHospitals,
    setMatchedHospitals
  } = useEmergencyStore();

  // Route state
  const routeCoordinates = useRef<[number, number][]>([]);
  const traveledCoordinates = useRef<[number, number][]>([]);
  const animationRef = useRef<number>();

  // Helper to fetch route from Mapbox
  const getRoute = async (start: [number, number], end: [number, number]) => {
    try {
      const response = await fetch(
        `https://api.mapbox.com/directions/v5/mapbox/driving/${start[0]},${start[1]};${end[0]},${end[1]}?steps=true&geometries=geojson&access_token=${mapboxgl.accessToken}`
      );
      const data = await response.json();
      if (!data.routes || data.routes.length === 0) return null;
      const route = data.routes[0].geometry.coordinates;
      return route;
    } catch (error) {
      console.error('Error fetching route:', error);
      return null;
    }
  };

  const animateRoute = (route: [number, number][], onComplete?: () => void) => {
    traveledCoordinates.current = [route[0]]; // Initialize with start point
    let step = 0;
    const speed = 0.02; // Very slow speed for smooth movement

    const animate = () => {
      if (step < route.length - 1) {
        const index = Math.floor(step);
        const nextIndex = index + 1;
        const t = step - index; // Interpolation factor (0 to 1)

        const start = route[index];
        const end = route[nextIndex];

        // Linear interpolation
        const currentPos: [number, number] = [
          start[0] + (end[0] - start[0]) * t,
          start[1] + (end[1] - start[1]) * t
        ];

        setAmbulancePosition(currentPos);

        // Update marker
        if (ambulanceMarker.current) {
          ambulanceMarker.current.setLngLat(currentPos);
        } else if (map.current) {
          // ... (marker creation code omitted for brevity as it's unchanged) ...
          const el = document.createElement('div');
          el.className = 'ambulance-marker-container group';
          el.innerHTML = `
              <div class="flex flex-col items-center gap-2 transition-all duration-300 group-hover:-translate-y-2">
                <div class="relative flex items-center justify-center w-12 h-12">
                    <div class="absolute inset-0 bg-blue-500 rounded-full opacity-20 animate-ping"></div>
                    <div class="relative flex items-center justify-center w-10 h-10 bg-blue-600 rounded-full shadow-lg border-2 border-white transform transition-transform group-hover:scale-110">
                    <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="text-white"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><circle cx="17" cy="17" r="2"/><path d="M14 17h-3"/></svg>
                    </div>
                </div>
                <div class="px-2 py-0.5 bg-blue-600/90 backdrop-blur-md rounded-full shadow-lg">
                  <span class="text-[10px] font-bold text-white whitespace-nowrap tracking-wider">Unit 01</span>
                </div>
              </div>
            `;
          ambulanceMarker.current = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
            .setLngLat(currentPos)
            .addTo(map.current);
        }

        // Update traveled path
        // Ensure we add points as we pass them
        if (Math.floor(step) >= traveledCoordinates.current.length) {
          traveledCoordinates.current.push(route[Math.floor(step)]);
        }

        // Update the visual line with current position for smooth tail
        const currentPath = [...traveledCoordinates.current, currentPos];

        if (map.current?.getSource('traveled-route')) {
          (map.current.getSource('traveled-route') as mapboxgl.GeoJSONSource).setData({
            type: 'Feature',
            properties: {},
            geometry: {
              type: 'LineString',
              coordinates: currentPath
            }
          });
        }

        // Pan map to follow ambulance smoothly
        map.current?.easeTo({ center: currentPos, duration: 0 });

        step += speed;
        animationRef.current = requestAnimationFrame(animate);
      } else {
        if (onComplete) onComplete();
      }
    };

    animationRef.current = requestAnimationFrame(animate);
  };

  const handleSymptomAnalysis = async (analysis: any) => {
    console.log('Page received symptom analysis:', analysis);
    const patient: PatientData = {
      symptoms: analysis.symptoms || [],
      rawTranscript: useEmergencyStore.getState().voiceTranscript,
      severity: analysis.severity || 'Moderate',
      urgency: analysis.urgency || 5,
      requiredSpecialization: analysis.requiredSpecializations || ['General'],
      bloodTypeNeeded: analysis.needsBlood ? analysis.bloodType : undefined
    };

    setPatientData(patient);
    const generatedVitals = VitalSimulator.generateBySeverity(patient.severity);
    setVitals(generatedVitals);

    if (userLocation && hospitals.length > 0) {
      const matches = await HospitalMatcher.matchHospitals(
        hospitals,
        userLocation,
        patient,
        process.env.NEXT_PUBLIC_MAPBOX_TOKEN || ''
      );
      setMatchedHospitals(matches);

      // Highlight matched hospitals on map
      if (map.current && matches.length > 0) {
        const bounds = new mapboxgl.LngLatBounds();
        bounds.extend(userLocation);
        matches.slice(0, 3).forEach(match => {
          if (match.hospital.location) {
            bounds.extend(match.hospital.location);
          }
        });
        map.current.fitBounds(bounds, { padding: 200 });
      }
    }

    setCurrentStatus('processing');
  };

  const handleSelectHospital = async (match: any) => {
    console.log('Selecting hospital:', match);
    setSelectedHospitalId(match.hospital.id);
    setCurrentStatus('dispatching');

    // Reset previous routes
    traveledCoordinates.current = [];
    if (map.current?.getSource('traveled-route')) {
      (map.current.getSource('traveled-route') as mapboxgl.GeoJSONSource).setData({
        type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] }
      });
    }

    // 1. Ambulance -> Patient
    const startPos = ambulancePosition || [userLocation![0] + 0.01, userLocation![1] + 0.01];
    const routeToPatient = await getRoute(startPos, userLocation!);

    if (routeToPatient && map.current) {
      // Draw planned route
      if (map.current.getSource('route')) {
        (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
          type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeToPatient }
        });
      }

      setCurrentStatus('ambulance_en_route_to_patient');

      animateRoute(routeToPatient, async () => {
        setCurrentStatus('patient_picked_up');

        // Wait a bit
        setTimeout(async () => {
          // 2. Patient -> Hospital
          const hospitalLoc = match.hospital.location;
          const routeToHospital = await getRoute(userLocation!, hospitalLoc);

          if (routeToHospital) {
            if (map.current?.getSource('route')) {
              (map.current.getSource('route') as mapboxgl.GeoJSONSource).setData({
                type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: routeToHospital }
              });
            }

            // Clear traveled for new leg
            traveledCoordinates.current = [];

            setCurrentStatus('en_route_to_hospital');
            animateRoute(routeToHospital, () => {
              setCurrentStatus('arrived_at_hospital');
            });
          }
        }, 2000);
      });
    }
  };

  const handleQuickDispatch = async () => {
    console.log('Quick Dispatch Triggered');
    console.log('Patient Data:', patientData);
    console.log('Selected Hospital ID:', selectedHospitalId);
    console.log('Matched Hospitals:', matchedHospitals);

    if (!patientData) {
      alert('Please record your symptoms first!');
      return;
    }

    if (selectedHospitalId) {
      const hospital = hospitals.find(h => h.id === selectedHospitalId);
      if (hospital) {
        console.log('Dispatching to selected hospital:', hospital.name);
        handleSelectHospital({ hospital });
        return;
      }
    }

    if (matchedHospitals.length > 0) {
      const topMatch = matchedHospitals[0];
      console.log('Dispatching to top match:', topMatch.hospital.name);
      handleSelectHospital(topMatch);
      return;
    }

    console.warn('No hospital selected and no matches found.');
    alert('Please select a hospital on the map.');
  };

  return (
    <div className={`h-screen w-screen overflow-hidden relative transition-colors duration-500 ${resolvedTheme === 'dark' ? 'bg-slate-950' : 'bg-slate-50'}`}>

      {/* Theme Toggle - Fixed Top Right */}
      <SimpleThemeToggle />

      {/* Full Screen Map */}
      <div className="absolute inset-0 z-0">
        <MapComponent
          userLocation={userLocation}
          setUserLocation={setUserLocation}
          setAmbulancePosition={setAmbulancePosition}
          setHospitals={setHospitals}
          hospitalMarkers={hospitalMarkers}
          ambulanceMarker={ambulanceMarker}
          map={map}
          mapContainer={mapContainer}
          matchedHospitals={matchedHospitals}
          onSelectHospital={(id) => {
            const hospital = hospitals.find(h => h.id === id);
            if (hospital) {
              handleSelectHospital({ hospital });
            }
          }}
        />
      </div>

      {/* Floating UI Layer */}
      <div className="absolute inset-0 z-10 pointer-events-none">
        <Header isSidebarOpen={isSidebarOpen} setIsSidebarOpen={setIsSidebarOpen} />

        <EmergencyControls
          onSymptomAnalysis={handleSymptomAnalysis}
          patientData={patientData}
          matchedHospitals={matchedHospitals}
          currentStatus={currentStatus}
          handleQuickDispatch={handleQuickDispatch}
          vitals={vitals}
          selectedHospitalId={selectedHospitalId}
          onVitalsUpdate={setVitals}
        />

        <HospitalMatchPanel
          matches={matchedHospitals}
          onSelectHospital={handleSelectHospital}
          selectedHospitalId={selectedHospitalId}
        />
      </div>

    </div>
  );
}
