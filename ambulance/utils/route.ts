import * as turf from '@turf/turf';

export interface RoutePoint {
  coordinates: [number, number];
  bearing: number;
  distance: number;
}

export const calculateRoute = (
  start: [number, number],
  end: [number, number]
): RoutePoint[] => {
  const line = turf.lineString([start, end]);
  const distance = turf.length(line, { units: 'kilometers' });
  const points: RoutePoint[] = [];
  
  // Create points along the route
  const steps = Math.floor(distance * 10); // One point every 100m
  for (let i = 0; i <= steps; i++) {
    const along = turf.along(line, (i / steps) * distance, { units: 'kilometers' });
    const nextAlong = turf.along(line, ((i + 1) / steps) * distance, { units: 'kilometers' });
    const bearing = turf.bearing(
      turf.point(along.geometry.coordinates),
      turf.point(nextAlong.geometry.coordinates)
    );
    
    points.push({
      coordinates: along.geometry.coordinates as [number, number],
      bearing,
      distance: distance * (1 - i / steps)
    });
  }
  
  return points;
};

export const formatETA = (distanceKm: number): string => {
  const minutes = Math.ceil(distanceKm * 2); // Assuming 30km/h average speed
  return `${minutes} mins`;
};
