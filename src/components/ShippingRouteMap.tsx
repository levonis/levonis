import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Ship, Plane } from 'lucide-react';
import { differenceInMilliseconds, addDays } from 'date-fns';
import { supabase } from '@/integrations/supabase/client';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
  shippedAt?: string | null;
  shippingDurationDays?: number | null;
}

// Real coordinates [longitude, latitude]
const LOCATIONS = {
  guangzhou_port: { 
    coords: [113.5461, 22.6235] as [number, number], 
    nameAr: 'ميناء نانشا', 
    nameEn: 'Nansha Port' 
  },
  jebel_ali: { 
    coords: [55.0272, 24.9857] as [number, number], 
    nameAr: 'ميناء جبل علي (ترانزيت)', 
    nameEn: 'Jebel Ali Port (Transshipment)' 
  },
  umm_qasr: { 
    coords: [47.9392, 30.0534] as [number, number], 
    nameAr: 'ميناء أم قصر', 
    nameEn: 'Umm Qasr Port' 
  },
  guangzhou_airport: { 
    coords: [113.2989, 23.3925] as [number, number], 
    nameAr: 'مطار قوانغتشو باييون الدولي', 
    nameEn: 'Guangzhou Baiyun Airport' 
  },
  erbil_airport: { 
    coords: [43.9578, 36.2358] as [number, number], 
    nameAr: 'مطار أربيل الدولي', 
    nameEn: 'Erbil International Airport' 
  },
};

// Realistic sea shipping route: Nansha Port → South China Sea → Malacca Strait → Indian Ocean → Jebel Ali Port (UAE) → Arabian Gulf → Umm Qasr Port
const SEA_ROUTE_WAYPOINTS: [number, number][] = [
  [113.5461, 22.6235],  // Nansha Port (origin)
  [114.3, 21.5],        // Exit Pearl River Delta
  [113.5, 18.0],        // South China Sea
  [110.0, 12.0],        // South China Sea (central)
  [107.0, 7.0],         // Approaching Vietnam coast
  [104.5, 2.0],         // Singapore Strait approach
  [103.8, 1.3],         // Singapore Strait
  [100.0, 3.5],         // Malacca Strait
  [95.5, 6.0],          // Exit Malacca Strait
  [85.0, 7.0],          // Indian Ocean (Bay of Bengal edge)
  [75.0, 10.0],         // Indian Ocean (south of India)
  [65.0, 15.0],         // Arabian Sea
  [58.0, 21.0],         // Approaching UAE
  [55.0272, 24.9857],   // Jebel Ali Port (UAE - Transshipment)
  [52.5, 26.5],         // Exit Jebel Ali, entering Arabian Gulf
  [50.5, 28.5],         // Arabian Gulf
  [48.8, 29.8],         // Approaching Shatt al-Arab
  [47.9392, 30.0534],   // Umm Qasr Port (destination)
];

// Realistic air route: Guangzhou → over Southeast Asia → India → Pakistan → Iran → Erbil
const AIR_ROUTE_WAYPOINTS: [number, number][] = [
  [113.2989, 23.3925],  // Guangzhou Baiyun Airport
  [108.0, 24.5],        // Over Guangxi
  [100.5, 26.8],        // Over Yunnan/Myanmar border
  [92.5, 28.5],         // Over Bangladesh
  [85.3, 27.7],         // Over Nepal/India
  [77.1, 28.6],         // Over Delhi
  [68.3, 31.5],         // Over Pakistan (Lahore)
  [57.0, 35.7],         // Over Iran (Mashhad)
  [48.5, 36.1],         // Over Iran/Iraq border
  [43.9578, 36.2358],   // Erbil International Airport
];

// Interpolate position along route
const getPositionOnRoute = (waypoints: [number, number][], progress: number): [number, number] => {
  if (progress <= 0) return waypoints[0];
  if (progress >= 100) return waypoints[waypoints.length - 1];

  const totalSegments = waypoints.length - 1;
  const progressPerSegment = 100 / totalSegments;
  const currentSegment = Math.floor(progress / progressPerSegment);
  const segmentProgress = (progress % progressPerSegment) / progressPerSegment;

  if (currentSegment >= totalSegments) return waypoints[waypoints.length - 1];

  const start = waypoints[currentSegment];
  const end = waypoints[currentSegment + 1];

  return [
    start[0] + (end[0] - start[0]) * segmentProgress,
    start[1] + (end[1] - start[1]) * segmentProgress,
  ];
};

export const ShippingRouteMap = ({ 
  routeType, 
  isShipped = false,
  shippedAt,
  shippingDurationDays
}: ShippingRouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);
  const [progress, setProgress] = useState(0);
  const [mapLoaded, setMapLoaded] = useState(false);

  const isSea = routeType === 'sea_guangzhou_umm_qasr';
  const waypoints = isSea ? SEA_ROUTE_WAYPOINTS : AIR_ROUTE_WAYPOINTS;
  const fromLoc = isSea ? LOCATIONS.guangzhou_port : LOCATIONS.guangzhou_airport;
  const toLoc = isSea ? LOCATIONS.umm_qasr : LOCATIONS.erbil_airport;

  // Calculate progress based on shipping dates
  useEffect(() => {
    if (!isShipped) {
      setProgress(0);
      return;
    }

    if (shippedAt && shippingDurationDays && shippingDurationDays > 0) {
      const updateProgress = () => {
        const now = new Date();
        const shipped = new Date(shippedAt);
        const estimated = addDays(shipped, shippingDurationDays);
        
        const totalDuration = differenceInMilliseconds(estimated, shipped);
        const elapsed = differenceInMilliseconds(now, shipped);
        
        if (totalDuration <= 0) {
          setProgress(100);
          return;
        }
        
        const calculatedProgress = Math.min(100, Math.max(0, (elapsed / totalDuration) * 100));
        setProgress(calculatedProgress);
      };

      updateProgress();
      const intervalMs = shippingDurationDays <= 1 ? 1000 : shippingDurationDays <= 7 ? 30000 : 60000;
      const interval = setInterval(updateProgress, intervalMs);
      return () => clearInterval(interval);
    } else {
      // Demo animation
      const interval = setInterval(() => {
        setProgress(prev => prev >= 100 ? 0 : prev + 0.5);
      }, 100);
      return () => clearInterval(interval);
    }
  }, [isShipped, shippedAt, shippingDurationDays]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !routeType) return;

    const initMap = async () => {
      try {
        // Fetch Mapbox token from edge function
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        
        if (error || !data?.token) {
          console.error('Failed to get Mapbox token:', error);
          return;
        }

        mapboxgl.accessToken = data.token;

        const bounds = new mapboxgl.LngLatBounds();
        waypoints.forEach(coord => bounds.extend(coord));

        map.current = new mapboxgl.Map({
          container: mapContainer.current!,
          style: 'mapbox://styles/mapbox/streets-v12',
          bounds: bounds,
          fitBoundsOptions: { padding: 40 },
          interactive: true,
          attributionControl: false,
          projection: 'mercator',
        });

        map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

        map.current.on('load', () => {
          if (!map.current) return;

          // Add route line
          map.current.addSource('route', {
            type: 'geojson',
            data: {
              type: 'Feature',
              properties: {},
              geometry: {
                type: 'LineString',
                coordinates: waypoints,
              },
            },
          });

          // Route background (dashed)
          map.current.addLayer({
            id: 'route-background',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isSea ? '#1e40af' : '#0369a1',
              'line-width': 3,
              'line-opacity': 0.4,
              'line-dasharray': [2, 2],
            },
          });

          // Route progress line
          map.current.addLayer({
            id: 'route-progress',
            type: 'line',
            source: 'route',
            layout: {
              'line-join': 'round',
              'line-cap': 'round',
            },
            paint: {
              'line-color': isSea ? '#3b82f6' : '#0ea5e9',
              'line-width': 4,
              'line-opacity': 0.9,
            },
          });

          // Origin marker
          new mapboxgl.Marker({ color: '#22c55e' })
            .setLngLat(fromLoc.coords)
            .setPopup(new mapboxgl.Popup().setHTML(`<strong>${fromLoc.nameAr}</strong><br/>${fromLoc.nameEn}`))
            .addTo(map.current);

          // Transshipment marker (Jebel Ali for sea route)
          if (isSea) {
            new mapboxgl.Marker({ color: '#f59e0b' })
              .setLngLat(LOCATIONS.jebel_ali.coords)
              .setPopup(new mapboxgl.Popup().setHTML(`<strong>${LOCATIONS.jebel_ali.nameAr}</strong><br/>${LOCATIONS.jebel_ali.nameEn}`))
              .addTo(map.current);
          }

          // Destination marker
          new mapboxgl.Marker({ color: '#ef4444' })
            .setLngLat(toLoc.coords)
            .setPopup(new mapboxgl.Popup().setHTML(`<strong>${toLoc.nameAr}</strong><br/>${toLoc.nameEn}`))
            .addTo(map.current);

          setMapLoaded(true);
        });
      } catch (err) {
        console.error('Error initializing map:', err);
      }
    };

    initMap();

    return () => {
      if (markerRef.current) {
        markerRef.current.remove();
        markerRef.current = null;
      }
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [routeType]);

  // Update vehicle marker position
  useEffect(() => {
    if (!map.current || !mapLoaded || !isShipped) return;

    const position = getPositionOnRoute(waypoints, progress);

    // Create custom marker element with ship/plane icon
    if (!markerRef.current) {
      const el = document.createElement('div');
      el.className = 'vehicle-marker';
      
      if (isSea) {
        // Realistic cargo ship icon
        el.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
            border-radius: 8px;
            width: 48px;
            height: 32px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(59, 130, 246, 0.5), 0 0 0 3px rgba(255,255,255,0.9);
            position: relative;
          ">
            <span style="font-size: 24px; line-height: 1;">🚢</span>
          </div>
        `;
      } else {
        // Airplane icon
        el.innerHTML = `
          <div style="
            background: linear-gradient(135deg, #0369a1 0%, #0ea5e9 100%);
            border-radius: 50%;
            width: 40px;
            height: 40px;
            display: flex;
            align-items: center;
            justify-content: center;
            box-shadow: 0 4px 20px rgba(14, 165, 233, 0.5), 0 0 0 3px rgba(255,255,255,0.9);
          ">
            <span style="font-size: 22px; line-height: 1;">✈️</span>
          </div>
        `;
      }

      markerRef.current = new mapboxgl.Marker({ element: el, anchor: 'center' })
        .setLngLat(position)
        .addTo(map.current);
    } else {
      markerRef.current.setLngLat(position);
    }

    // Update route progress visualization
    const progressIndex = Math.floor((progress / 100) * (waypoints.length - 1)) + 1;
    const progressCoords = waypoints.slice(0, Math.min(progressIndex + 1, waypoints.length));
    
    // Add current position to progress coords
    if (progress > 0 && progress < 100) {
      progressCoords[progressCoords.length - 1] = position;
    }

    const source = map.current.getSource('route') as mapboxgl.GeoJSONSource;
    if (source) {
      source.setData({
        type: 'Feature',
        properties: {},
        geometry: {
          type: 'LineString',
          coordinates: waypoints,
        },
      });
    }

  }, [progress, mapLoaded, isShipped, waypoints, isSea]);

  // Calculate remaining info
  const getRemainingInfo = () => {
    if (!shippedAt || !shippingDurationDays) return null;
    
    const now = new Date();
    const shipped = new Date(shippedAt);
    const estimated = addDays(shipped, shippingDurationDays);
    const remainingMs = estimated.getTime() - now.getTime();
    const remainingDays = Math.ceil(remainingMs / (1000 * 60 * 60 * 24));
    
    if (remainingDays < 0) return { text: 'متأخر', color: 'text-red-500' };
    if (remainingDays === 0) return { text: 'متوقع اليوم', color: 'text-green-500' };
    if (remainingDays === 1) return { text: 'متبقي يوم واحد', color: 'text-amber-500' };
    if (remainingDays === 2) return { text: 'متبقي يومان', color: 'text-amber-500' };
    return { text: `متبقي ${remainingDays} يوم`, color: 'text-muted-foreground' };
  };

  const remainingInfo = getRemainingInfo();
  const Icon = isSea ? Ship : Plane;

  if (!routeType) return null;

  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className={`p-2 rounded-lg ${isSea ? 'bg-blue-500/20' : 'bg-sky-500/20'}`}>
              <Icon className={`h-5 w-5 ${isSea ? 'text-blue-500' : 'text-sky-500'}`} />
            </div>
            <div>
              <h3 className="font-bold text-foreground text-sm">
                {isSea ? 'الشحن البحري' : 'الشحن الجوي'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {isSea ? 'Sea Freight' : 'Air Freight'}
              </p>
            </div>
          </div>
          {isShipped && (
            <div className="text-left">
              <div className="text-xs text-muted-foreground">نسبة الإنجاز</div>
              <div className="text-lg font-bold text-primary">{Math.round(progress)}%</div>
            </div>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {isShipped && (
        <div className="px-4 pt-3">
          <div className="w-full h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-1000 ease-linear rounded-full ${
                isSea ? 'bg-gradient-to-r from-blue-600 to-blue-400' : 'bg-gradient-to-r from-sky-600 to-sky-400'
              }`}
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between items-center mt-1">
            {remainingInfo && (
              <p className={`text-xs ${remainingInfo.color}`}>{remainingInfo.text}</p>
            )}
            {shippingDurationDays && (
              <p className="text-[10px] text-muted-foreground">
                مدة الشحن: {shippingDurationDays} يوم
              </p>
            )}
          </div>
        </div>
      )}

      {/* Map Container */}
      <div className="relative">
        <div ref={mapContainer} className="w-full h-[280px]" />
        
        {/* Completed badge */}
        {progress >= 100 && (
          <div className="absolute top-4 right-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold shadow-lg z-10">
            ✓ تم الوصول
          </div>
        )}
      </div>

      {/* Route info footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
            <div className="text-right">
              <p className="font-bold text-foreground text-xs">{fromLoc.nameAr}</p>
              <p className="text-muted-foreground text-[10px]">{fromLoc.nameEn}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 px-3">
            <div className={`h-0.5 w-8 rounded ${isSea ? 'bg-blue-500' : 'bg-sky-500'}`}></div>
            <Icon className={`h-4 w-4 ${isSea ? 'text-blue-500' : 'text-sky-500'}`} />
            <div className={`h-0.5 w-8 rounded ${isSea ? 'bg-blue-500' : 'bg-sky-500'}`}></div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="text-left">
              <p className="font-bold text-foreground text-xs">{toLoc.nameAr}</p>
              <p className="text-muted-foreground text-[10px]">{toLoc.nameEn}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></div>
          </div>
        </div>
      </div>
    </div>
  );
};
