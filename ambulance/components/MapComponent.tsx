import React, { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Hospital } from '@/types';
import { generateHospitals } from '@/lib/hospitalData';
import { useTheme } from 'next-themes';

mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || '';

interface MapComponentProps {
  userLocation: [number, number] | null;
  setUserLocation: (location: [number, number]) => void;
  setAmbulancePosition: (location: [number, number]) => void;
  setHospitals: (hospitals: Hospital[]) => void;
  hospitalMarkers: React.MutableRefObject<mapboxgl.Marker[]>;
  ambulanceMarker: React.MutableRefObject<mapboxgl.Marker | null>;
  map: React.MutableRefObject<mapboxgl.Map | null>;
  mapContainer: React.RefObject<HTMLDivElement>;
  matchedHospitals: any[];
  onSelectHospital: (hospitalId: string) => void;
}

export function MapComponent({
  userLocation,
  setUserLocation,
  setAmbulancePosition,
  setHospitals,
  hospitalMarkers,
  ambulanceMarker,
  map,
  mapContainer,
  matchedHospitals,
  onSelectHospital
}: MapComponentProps) {
  const { resolvedTheme } = useTheme();
  const currentTheme = resolvedTheme === 'dark' ? 'dark' : 'light';

  const addLayers = (mapInstance: mapboxgl.Map, theme: 'light' | 'dark') => {
    if (!mapInstance.isStyleLoaded()) return;

    // Add Fog
    try {
      mapInstance.setFog({
        'range': [0.5, 10],
        'color': theme === 'dark' ? '#0f172a' : '#ffffff',
        'horizon-blend': 0.1,
        'high-color': theme === 'dark' ? '#1e293b' : '#f1f5f9',
        'space-color': theme === 'dark' ? '#020617' : '#f8fafc',
        'star-intensity': theme === 'dark' ? 0.6 : 0
      });
    } catch (e) {
      console.warn('Failed to set fog:', e);
    }

    // Add 3D buildings
    if (!mapInstance.getLayer('add-3d-buildings')) {
      mapInstance.addLayer({
        'id': 'add-3d-buildings',
        'source': 'composite',
        'source-layer': 'building',
        'filter': ['==', 'extrude', 'true'],
        'type': 'fill-extrusion',
        'minzoom': 15,
        'paint': {
          'fill-extrusion-color': theme === 'dark' ? '#1e293b' : '#cbd5e1',
          'fill-extrusion-height': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'height']
          ],
          'fill-extrusion-base': [
            'interpolate', ['linear'], ['zoom'],
            15, 0,
            15.05, ['get', 'min_height']
          ],
          'fill-extrusion-opacity': 0.6
        }
      });
    }

    // Route Layer
    if (!mapInstance.getSource('route')) {
      mapInstance.addSource('route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      });
    }

    if (!mapInstance.getLayer('route')) {
      mapInstance.addLayer({
        id: 'route',
        type: 'line',
        source: 'route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': theme === 'dark' ? '#94a3b8' : '#64748b',
          'line-width': 6,
          'line-opacity': 0.5
        }
      });
    }

    // Traveled Route Layer
    if (!mapInstance.getSource('traveled-route')) {
      mapInstance.addSource('traveled-route', {
        type: 'geojson',
        data: { type: 'Feature', properties: {}, geometry: { type: 'LineString', coordinates: [] } }
      });
    }

    // Glow effect (Neon)
    if (!mapInstance.getLayer('traveled-route-glow')) {
      mapInstance.addLayer({
        id: 'traveled-route-glow',
        type: 'line',
        source: 'traveled-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#ef4444', // Red-500
          'line-width': 20,
          'line-opacity': 0.4,
          'line-blur': 10
        }
      });
    }

    // Core line (Bright White/Red)
    if (!mapInstance.getLayer('traveled-route')) {
      mapInstance.addLayer({
        id: 'traveled-route',
        type: 'line',
        source: 'traveled-route',
        layout: { 'line-join': 'round', 'line-cap': 'round' },
        paint: {
          'line-color': '#fee2e2', // Red-100 (White-ish red)
          'line-width': 4,
          'line-opacity': 1
        }
      });
    }
  };

  // Initialize map and location
  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    if (typeof window !== 'undefined' && navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location: [number, number] = [position.coords.longitude, position.coords.latitude];
          setUserLocation(location);
          setAmbulancePosition(location);

          // Initialize map
          map.current = new mapboxgl.Map({
            container: mapContainer.current!,
            style: currentTheme === 'dark' ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12',
            center: location,
            zoom: 13,
            pitch: 45,
            bearing: -17.6,
            antialias: true
          });

          // Add navigation controls
          map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');

          // Add user location marker
          const userEl = document.createElement('div');
          userEl.className = 'user-marker';
          userEl.innerHTML = '<div class="w-4 h-4 bg-blue-600 rounded-full animate-ping absolute"></div><div class="w-4 h-4 bg-blue-600 rounded-full relative border-2 border-white shadow-lg"></div>';

          new mapboxgl.Marker(userEl)
            .setLngLat(location)
            .setPopup(new mapboxgl.Popup().setHTML(`<div class="text-slate-900 font-bold p-1">Your Location</div>`))
            .addTo(map.current);

          // Generate and add hospitals
          const generatedHospitals = generateHospitals(location);
          setHospitals(generatedHospitals);

          // Add hospital markers
          generatedHospitals.forEach((hospital: Hospital) => {
            if (!hospital.location || hospital.location.length !== 2) return;

            const el = document.createElement('div');
            el.className = 'hospital-marker-container group';
            el.innerHTML = `
              <div class="flex flex-col items-center gap-2 transition-all duration-300 group-hover:-translate-y-4">
                <div class="relative w-10 h-10 filter drop-shadow-2xl transform transition-transform group-hover:scale-110">
                   <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
                      <path d="M50 90L10 70V30L50 10L90 30V70L50 90Z" fill="#1e293b" stroke="#475569" stroke-width="2"/>
                      <path d="M50 90V50L10 30V70L50 90Z" fill="#334155"/>
                      <path d="M50 90V50L90 30V70L50 90Z" fill="#475569"/>
                      <path d="M50 50L90 30L50 10L10 30L50 50Z" fill="#ef4444"/>
                      <path d="M40 30H60M50 20V40" stroke="white" stroke-width="4" stroke-linecap="round"/>
                      <rect x="20" y="45" width="8" height="12" fill="#94a3b8" transform="skewY(26)"/>
                      <rect x="35" y="52" width="8" height="12" fill="#94a3b8" transform="skewY(26)"/>
                      <rect x="57" y="52" width="8" height="12" fill="#cbd5e1" transform="skewY(-26)"/>
                      <rect x="72" y="45" width="8" height="12" fill="#cbd5e1" transform="skewY(-26)"/>
                   </svg>
                   <div class="absolute -bottom-2 left-1/2 -translate-x-1/2 w-8 h-3 bg-red-500/30 blur-md rounded-full animate-pulse"></div>
                </div>
                <div class="px-2 py-1 bg-white/90 backdrop-blur-xl border border-slate-200 rounded-lg shadow-xl transform -translate-y-1">
                  <span class="text-[10px] font-bold text-slate-900 whitespace-nowrap tracking-wide">${hospital.name}</span>
                </div>
              </div>
            `;
            el.style.cursor = 'pointer';

            el.addEventListener('click', (e) => {
              e.stopPropagation();
              onSelectHospital(hospital.id);
            });

            const marker = new mapboxgl.Marker({ element: el, anchor: 'bottom' })
              .setLngLat(hospital.location)
              .setPopup(
                new mapboxgl.Popup({ offset: 25, className: 'custom-popup' }).setHTML(`
                  <div class="p-3 bg-white/95 backdrop-blur-xl rounded-2xl shadow-2xl min-w-[200px] border border-slate-200">
                    <div class="flex items-center justify-between mb-2">
                        <span class="px-1.5 py-0.5 rounded-md bg-blue-100 text-blue-600 text-[10px] font-bold uppercase tracking-wider">${hospital.primarySpecialization}</span>
                        <span class="flex items-center gap-1 text-amber-500 text-xs font-bold">
                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="currentColor" stroke="none"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>
                            ${hospital.rating}
                        </span>
                    </div>
                    <h3 class="font-bold text-sm text-slate-900 mb-0.5 leading-tight">${hospital.name}</h3>
                    <p class="text-slate-500 text-[10px] mb-2">2.4 km away • 12 mins</p>
                    
                    <div class="grid grid-cols-2 gap-1.5">
                        <div class="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                            <div class="text-emerald-600 font-bold text-sm">${hospital.beds.general.available}</div>
                            <div class="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Beds</div>
                        </div>
                        <div class="p-1.5 rounded-lg bg-slate-50 border border-slate-200 text-center">
                            <div class="text-blue-600 font-bold text-sm">4</div>
                            <div class="text-[8px] text-slate-500 uppercase font-bold tracking-wider">Doctors</div>
                        </div>
                    </div>
                    <div class="mt-2 text-center">
                        <span class="text-[10px] text-blue-600 font-bold uppercase tracking-wider animate-pulse">Click marker to select</span>
                    </div>
                  </div>
                `)
              )
              .addTo(map.current!);

            hospitalMarkers.current.push(marker);
          });

          // Add dummy ambulances
          const ambulances = [
            { id: 'AMB-001', offset: [0.01, 0.01], name: 'Unit 01' },
            { id: 'AMB-002', offset: [-0.01, 0.01], name: 'Unit 02' },
            { id: 'AMB-003', offset: [0.01, -0.01], name: 'Unit 03' },
            { id: 'AMB-004', offset: [-0.01, -0.01], name: 'Unit 04' },
            { id: 'AMB-005', offset: [0.02, 0], name: 'Unit 05' },
          ];

          ambulances.forEach(amb => {
            const ambEl = document.createElement('div');
            ambEl.className = 'ambulance-marker-container group';
            ambEl.innerHTML = `
              <div class="flex flex-col items-center gap-2 transition-all duration-300 group-hover:-translate-y-4">
                <div class="relative w-10 h-10 filter drop-shadow-2xl transform transition-transform group-hover:scale-110">
                    <svg viewBox="0 0 100 100" fill="none" xmlns="http://www.w3.org/2000/svg" class="w-full h-full">
                        <ellipse cx="50" cy="85" rx="30" ry="10" fill="black" fill-opacity="0.3"/>
                        <path d="M20 60 L60 80 V50 L20 30 Z" fill="#2563eb"/>
                        <path d="M60 80 L90 65 V35 L60 50 Z" fill="#3b82f6"/>
                        <path d="M20 30 L60 50 L90 35 L50 15 Z" fill="#60a5fa"/>
                        <path d="M30 35 L55 48 L80 35 L55 22 Z" fill="#bfdbfe"/>
                        <circle cx="55" cy="35" r="8" fill="white"/>
                        <path d="M55 29 V41 M49 35 H61" stroke="#ef4444" stroke-width="3" stroke-linecap="round"/>
                        <circle cx="35" cy="75" r="8" fill="#1e293b"/>
                        <circle cx="75" cy="70" r="8" fill="#1e293b"/>
                    </svg>
                </div>
                <div class="px-2 py-0.5 bg-blue-600/90 backdrop-blur-md rounded-lg shadow-lg border border-blue-400/30 transform -translate-y-1">
                  <span class="text-[8px] font-bold text-white whitespace-nowrap tracking-wider uppercase">${amb.name}</span>
                </div>
              </div>
            `;
            ambEl.style.cursor = 'pointer';

            new mapboxgl.Marker({ element: ambEl, anchor: 'bottom' })
              .setLngLat([location[0] + amb.offset[0], location[1] + amb.offset[1]])
              .setPopup(
                new mapboxgl.Popup({ offset: 25, className: 'custom-popup' }).setHTML(`
                  <div class="p-3 bg-white/95 border border-slate-200 rounded-xl shadow-xl">
                    <h3 class="font-bold text-sm text-slate-900">${amb.name}</h3>
                    <p class="text-xs text-emerald-600 font-bold mt-1">● Available for Dispatch</p>
                  </div>
                `)
              )
              .addTo(map.current!);
          });

          // Setup Map Layers on Load
          map.current.on('load', () => {
            addLayers(map.current!, currentTheme);
          });

          // Re-add layers when style changes
          map.current.on('style.load', () => {
            addLayers(map.current!, currentTheme);
          });

        },
        (error) => {
          console.error('Error getting location:', error);
        }
      );
    }

    return () => {
      map.current?.remove();
    };
  }, []);

  // Effect to handle theme changes
  useEffect(() => {
    if (map.current) {
      const styleUrl = currentTheme === 'dark' ? 'mapbox://styles/mapbox/navigation-night-v1' : 'mapbox://styles/mapbox/streets-v12';
      // Only update if style is different to avoid reload loops
      // But Mapbox doesn't expose current style URL easily. 
      // setStyle triggers style.load which triggers addLayers.
      map.current.setStyle(styleUrl);
    }
  }, [currentTheme]);

  // Effect to highlight matched hospitals
  useEffect(() => {
    if (map.current && matchedHospitals.length > 0 && userLocation) {
      const bounds = new mapboxgl.LngLatBounds();
      bounds.extend(userLocation);
      matchedHospitals.slice(0, 3).forEach(match => {
        if (match.hospital.location) {
          bounds.extend(match.hospital.location);
        }
      });
      map.current.fitBounds(bounds, { padding: 100 });
    }
  }, [matchedHospitals, userLocation]);

  return (
    <div ref={mapContainer} className="w-full h-full" />
  );
}
