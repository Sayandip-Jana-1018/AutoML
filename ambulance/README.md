# Ambulance Tracker

A comprehensive real-time ambulance tracking and dispatch application built with Next.js and Mapbox. This project simulates an emergency response system with interactive maps, real-time tracking, and route optimization.

![Ambulance Tracker Screenshot](https://example.com/screenshot.png)

## 📋 Table of Contents

- [Features](#features)
- [Tech Stack](#tech-stack)
- [Project Structure](#project-structure)
- [Implementation Details](#implementation-details)
- [Getting Started](#getting-started)
- [Development Process](#development-process)
- [Component Architecture](#component-architecture)
- [State Management](#state-management)
- [Map Integration](#map-integration)
- [3D Visualization](#3d-visualization)
- [Performance Optimizations](#performance-optimizations)
- [Future Enhancements](#future-enhancements)

## ✨ Features

- **Real-time ambulance tracking** with dynamic position updates
- **Intelligent dispatch system** that finds the nearest available ambulance
- **Route optimization** using Mapbox Directions API
- **ETA calculation and status updates** with visual indicators
- **Interactive 3D ambulance models** using Three.js
- **Responsive design** that works on mobile and desktop
- **Simulated emergency response workflow**
- **Ambulance availability toggling**
- **Visual route display** with turn-by-turn directions
- **Animated ambulance movement** along calculated routes
- **Status indicators** showing ambulance availability
- **Progress tracking** for ambulance journeys

## 🛠️ Tech Stack

### Core Technologies
- **Next.js 14**: React framework with server-side rendering capabilities
- **TypeScript**: For type-safe code and better developer experience
- **React 18**: For building the user interface with hooks and functional components

### Mapping & Geospatial
- **Mapbox GL JS**: For interactive maps and location services
- **Turf.js**: For geospatial calculations and route analysis
- **Mapbox Directions API**: For route calculation between points

### 3D Visualization
- **Three.js**: For 3D rendering capabilities
- **React Three Fiber**: React renderer for Three.js
- **React Three Drei**: Useful helpers for React Three Fiber

### Styling & UI
- **Tailwind CSS**: For utility-first styling
- **Shadcn UI**: For consistent, accessible UI components
- **Radix UI**: For primitive, accessible UI components
- **CSS Animations**: For smooth transitions and visual feedback

### State Management
- **React Hooks**: useState, useEffect, useRef, useCallback
- **Custom Hooks**: For reusable logic and state management

### Build Tools
- **Next.js App Router**: For file-based routing
- **PostCSS**: For processing CSS with plugins
- **Autoprefixer**: For adding vendor prefixes to CSS

## 📁 Project Structure

```
ambulance-tracker/
├── app/                      # Next.js app directory
│   ├── api/                  # API routes
│   ├── globals.css           # Global styles
│   ├── layout.tsx            # Root layout component
│   └── page.tsx              # Home page component
├── components/               # React components
│   ├── MapComponent.tsx      # Main map component
│   ├── AmbulanceMarker.tsx   # Ambulance marker component
│   ├── DriverInfoPanel.tsx   # Driver information panel
│   └── ...                   # Other UI components
├── hooks/                    # Custom React hooks
│   └── useGeolocation.ts     # Geolocation hook
├── lib/                      # Utility functions
│   └── mapUtils.ts           # Map-related utilities
├── public/                   # Static assets
│   └── models/               # 3D models
├── styles/                   # CSS modules and styles
│   └── globals.css           # Global styles
├── utils/                    # Helper functions
│   └── geoUtils.ts           # Geospatial utilities
├── .env                      # Environment variables
├── .env.example              # Example environment variables
├── next.config.js            # Next.js configuration
├── package.json              # Project dependencies
├── tailwind.config.ts        # Tailwind CSS configuration
└── tsconfig.json             # TypeScript configuration
```

## 🔍 Implementation Details

### Map Integration

The core of the application is the `MapComponent.tsx` which integrates Mapbox GL JS. Here's how it was implemented:

1. **Map Initialization**:
   ```typescript
   mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
   const mapInstance = new mapboxgl.Map({
     container,
     style: "mapbox://styles/mapbox/streets-v12",
     center: userPos,
     zoom: 14,
     pitch: 45,
     bearing: 0,
   });
   ```

2. **User Location**:
   The application uses the browser's Geolocation API to get the user's current position:
   ```typescript
   navigator.geolocation.getCurrentPosition(
     (position) => {
       const { longitude, latitude } = position.coords;
       const userPos: [number, number] = [longitude, latitude];
       setUserLocation(userPos);
     },
     // Error handling...
   );
   ```

3. **Ambulance Simulation**:
   Nearby ambulances are simulated using Turf.js to generate random points around the user:
   ```typescript
   const nearbyAmbulances = Array.from({ length: 5 }, (_, i) => {
     const point = turf.destination(
       turf.point(userPos),
       Math.random() * 2,
       Math.random() * 360,
       { units: "kilometers" }
     );
     return {
       id: `AMB-${i + 1}`,
       coordinates: point.geometry.coordinates as [number, number],
       driverName: `Dr. ${["Sarah", "John", "Emma", "Michael", "Lisa"][i]}`,
       vehicleNumber: `AMB-202${i}`,
       available: true,
       marker: undefined,
     } as Ambulance;
   });
   ```

4. **Route Calculation**:
   When dispatching an ambulance, the application uses Mapbox Directions API to calculate the optimal route:
   ```typescript
   const query = await fetch(
     `https://api.mapbox.com/directions/v5/mapbox/driving/${ambulance.coordinates[0]},${ambulance.coordinates[1]};${userLocation[0]},${userLocation[1]}?steps=true&geometries=geojson&access_token=${process.env.NEXT_PUBLIC_MAPBOX_TOKEN}`
   );
   const json = await query.json();
   const data = json.routes[0];
   ```

5. **Ambulance Animation**:
   The ambulance movement is animated along the route using requestAnimationFrame:
   ```typescript
   const animate = (timestamp: number) => {
     // Animation logic to move the ambulance along the route
     // Interpolation between points, bearing calculation, etc.
     animationFrameId = requestAnimationFrame(animate);
   };
   ```

### Component Architecture

The application follows a component-based architecture:

1. **Page Component**: The main entry point that loads the MapComponent
2. **MapComponent**: Handles map initialization, ambulance simulation, and user interaction
3. **Custom Markers**: Created using DOM elements for ambulances and user location
4. **Status Panels**: Show driver information, ETA, and journey progress

### State Management

State is managed using React hooks:

1. **User Location**: `useState<[number, number] | null>(null)`
2. **Ambulances**: `useState<Ambulance[]>([])`
3. **Selected Ambulance**: `useState<Ambulance | null>(null)`
4. **Navigation State**: `useState<boolean>(false)`
5. **Driver Info**: `useState<DriverInfoState>({ ... })`

### Performance Optimizations

Several optimizations were implemented:

1. **Dynamic Imports**: The MapComponent is loaded dynamically to reduce initial bundle size:
   ```typescript
   const MapComponent = dynamic(() => import("@/components/MapComponent"), {
     ssr: false,
     loading: () => <p>Loading Map...</p>
   });
   ```

2. **useCallback for Functions**: Performance-critical functions use useCallback to prevent unnecessary re-renders:
   ```typescript
   const findNearestAmbulance = useCallback(
     async (): Promise<NearestAmbulanceResult | null> => {
       // Implementation...
     },
     [ambulances, userLocation]
   );
   ```

3. **Cleanup on Unmount**: All resources are properly cleaned up when components unmount:
   ```typescript
   return () => {
     if (animationFrameId.current) {
       cancelAnimationFrame(animationFrameId.current);
     }
     map.current?.remove();
   };
   ```

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v16.0.0 or later
- **npm**: v7.0.0 or later
- **Mapbox Account**: For API access token

### Installation

1. **Clone the repository**:
   ```bash
   git clone https://github.com/yourusername/ambulance-tracker.git
   cd ambulance-tracker
   ```

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Set up environment variables**:
   Create a `.env` file in the root directory with your Mapbox token:
   ```
   NEXT_PUBLIC_MAPBOX_TOKEN=your_mapbox_token_here
   ```

4. **Run the development server**:
   ```bash
   npm run dev
   ```

5. **Open the application**:
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser.

## 👨‍💻 Development Process

The development process followed these steps:

1. **Project Setup**:
   - Initialized Next.js project with TypeScript
   - Set up Tailwind CSS and Shadcn UI
   - Configured environment variables

2. **Core Map Implementation**:
   - Integrated Mapbox GL JS
   - Implemented user location tracking
   - Created custom markers for ambulances

3. **Ambulance Simulation**:
   - Generated random ambulance positions
   - Implemented availability toggling
   - Created visual indicators for status

4. **Routing and Navigation**:
   - Integrated Mapbox Directions API
   - Implemented route visualization
   - Created animation system for ambulance movement

5. **UI Development**:
   - Designed responsive interface
   - Created status panels and information displays
   - Implemented progress indicators

6. **Testing and Optimization**:
   - Tested on various devices and browsers
   - Optimized performance
   - Improved user experience

## 🧩 Component Architecture

### MapComponent

The main component that handles:
- Map initialization and rendering
- User location tracking
- Ambulance simulation and management
- Route calculation and visualization
- Animation and movement

### Driver Information Panel

Displays:
- Driver name and vehicle number
- ETA to destination
- Journey progress
- Status indicators (en-route, arriving, arrived)

### Quick Dispatch Button

Allows users to:
- Find and dispatch the nearest available ambulance
- Initiate the emergency response workflow

## 📊 State Management

The application uses React's built-in state management with hooks:

```typescript
// User location state
const [userLocation, setUserLocation] = useState<[number, number] | null>(null);

// Ambulances state
const [ambulances, setAmbulances] = useState<Ambulance[]>([]);

// Navigation state
const [isNavigating, setIsNavigating] = useState(false);

// Driver information state
const [driverInfo, setDriverInfo] = useState<DriverInfoState>({
  driverName: "",
  vehicleNumber: "",
  eta: "",
  status: "waiting",
});
```

## 🗺️ Map Integration

The application integrates Mapbox GL JS for interactive maps:

1. **Map Initialization**:
   ```typescript
   mapboxgl.accessToken = process.env.NEXT_PUBLIC_MAPBOX_TOKEN || "";
   const mapInstance = new mapboxgl.Map({
     container,
     style: "mapbox://styles/mapbox/streets-v12",
     center: userPos,
     zoom: 14,
     pitch: 45,
     bearing: 0,
   });
   ```

2. **Custom Markers**:
   ```typescript
   const el = document.createElement("div");
   el.className = "ambulance-marker relative group";
   
   // Add emoji and status indicators
   
   const marker = new mapboxgl.Marker({
     element: el,
     anchor: "center",
     rotationAlignment: "map",
   }).setLngLat(coordinates).addTo(map);
   ```

3. **Route Visualization**:
   ```typescript
   map.current.addSource("route", {
     type: "geojson",
     data: routeGeoJSON,
   });

   map.current.addLayer({
     id: "routeLayer",
     type: "line",
     source: "route",
     layout: {
       "line-join": "round",
       "line-cap": "round",
     },
     paint: {
       "line-color": "#EF4444",
       "line-width": 4,
       "line-opacity": 0.8,
     },
   });
   ```

## 🎮 User Interaction

The application provides several user interactions:

1. **Quick Dispatch**: One-click emergency response
2. **Ambulance Status Toggle**: Change availability status
3. **Real-time Updates**: View ETA and status changes
4. **Map Navigation**: Pan, zoom, and rotate the map view

## ⚡ Performance Optimizations

1. **Dynamic Imports**: Reduce initial load time
2. **Memoized Functions**: Prevent unnecessary re-renders
3. **Cleanup Resources**: Prevent memory leaks
4. **Efficient Animation**: Using requestAnimationFrame

## 🔮 Future Enhancements

Potential improvements for future versions:

1. **Real-time Backend Integration**: Connect to a real-time database like Firebase
2. **User Authentication**: Add login and user profiles
3. **Multiple Emergency Types**: Support different emergency scenarios
4. **Voice Commands**: Add voice control for hands-free operation
5. **Offline Support**: Implement service workers for offline functionality
6. **Push Notifications**: Add alerts for status changes
7. **Analytics Dashboard**: Track response times and performance metrics
8. **Multi-language Support**: Add internationalization

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgements

- Mapbox for their excellent mapping platform
- Three.js community for 3D visualization tools
- Next.js team for the React framework
- Tailwind CSS for the utility-first CSS framework
