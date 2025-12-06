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

// Sea route waypoints (following actual shipping lanes through water)
const SEA_ROUTE_COORDINATES: [number, number][] = [
  [113.5, 22.8],   // Nansha Port, Guangzhou
  [114.5, 20.0],   // South China Sea
  [112.0, 15.0],   // South China Sea (avoiding Vietnam)
  [108.0, 8.0],    // Approaching Malacca
  [104.0, 2.0],    // Singapore Strait
  [100.0, 3.0],    // Malacca Strait
  [95.0, 6.0],     // Exiting Malacca into Indian Ocean
  [85.0, 8.0],     // Indian Ocean
  [75.0, 10.0],    // Indian Ocean (south of India)
  [65.0, 15.0],    // Arabian Sea
  [58.0, 22.0],    // Approaching Gulf of Oman
  [56.5, 24.5],    // Gulf of Oman
  [55.0, 25.2],    // Jebel Ali Port, UAE (Transshipment)
  [52.5, 26.5],    // Arabian Gulf
  [50.0, 28.0],    // Arabian Gulf
  [48.5, 29.8],    // Umm Qasr Port, Iraq
];

// Air route waypoints
const AIR_ROUTE_COORDINATES: [number, number][] = [
  [113.3, 23.4],   // Guangzhou Baiyun Airport
  [100.0, 25.0],   // Over Southeast Asia
  [85.0, 28.0],    // Over India
  [70.0, 32.0],    // Over Pakistan
  [55.0, 35.0],    // Over Iran
  [44.0, 36.2],    // Erbil Airport, Iraq
];

const PORT_MARKERS = {
  sea: [
    { coords: [113.5, 22.8] as [number, number], name: 'ميناء نانشا', nameEn: 'Nansha Port', type: 'start' },
    { coords: [55.0, 25.2] as [number, number], name: 'ميناء جبل علي', nameEn: 'Jebel Ali (Transit)', type: 'transit' },
    { coords: [48.5, 29.8] as [number, number], name: 'ميناء أم قصر', nameEn: 'Umm Qasr Port', type: 'end' },
  ],
  air: [
    { coords: [113.3, 23.4] as [number, number], name: 'مطار قوانغتشو', nameEn: 'Guangzhou Airport', type: 'start' },
    { coords: [44.0, 36.2] as [number, number], name: 'مطار أربيل', nameEn: 'Erbil Airport', type: 'end' },
  ],
};

export const ShippingRouteMap = ({ 
  routeType, 
  isShipped = false,
  shippedAt,
  shippingDurationDays
}: ShippingRouteMapProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const vehicleMarker = useRef<mapboxgl.Marker | null>(null);
  const [progress, setProgress] = useState(0);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);

  const isSea = routeType === 'sea_guangzhou_umm_qasr';
  const routeCoordinates = isSea ? SEA_ROUTE_COORDINATES : AIR_ROUTE_COORDINATES;
  const markers = isSea ? PORT_MARKERS.sea : PORT_MARKERS.air;

  // Fetch Mapbox token
  useEffect(() => {
    const fetchToken = async () => {
      try {
        const { data, error } = await supabase.functions.invoke('get-mapbox-token');
        if (error) throw error;
        if (data?.token) {
          setMapboxToken(data.token);
        }
      } catch (err) {
        console.error('Failed to fetch Mapbox token:', err);
      }
    };
    fetchToken();
  }, []);

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
    if (!mapContainer.current || !mapboxToken || !routeType) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [75, 20],
      zoom: 2.2,
      projection: 'mercator',
      interactive: true,
      attributionControl: false,
    });

    map.current.addControl(new mapboxgl.NavigationControl({ showCompass: false }), 'top-left');

    map.current.on('load', () => {
      if (!map.current) return;
      setMapLoaded(true);

      // Add route source
      map.current.addSource('route', {
        type: 'geojson',
        data: {
          type: 'Feature',
          properties: {},
          geometry: {
            type: 'LineString',
            coordinates: routeCoordinates,
          },
        },
      });

      // Add route background line (dashed)
      map.current.addLayer({
        id: 'route-background',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': 'rgba(255, 255, 255, 0.2)',
          'line-width': 3,
          'line-dasharray': [2, 2],
        },
      });

      // Add main route line
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': isSea ? '#3b82f6' : '#0ea5e9',
          'line-width': 4,
          'line-opacity': 0.8,
        },
      });

      // Add glow effect
      map.current.addLayer({
        id: 'route-glow',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': isSea ? '#60a5fa' : '#38bdf8',
          'line-width': 8,
          'line-opacity': 0.3,
          'line-blur': 3,
        },
      });

      // Add port markers
      markers.forEach((port) => {
        const el = document.createElement('div');
        el.className = 'port-marker';
        el.style.cssText = `
          width: 24px;
          height: 24px;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 0 10px rgba(0,0,0,0.5);
          ${port.type === 'start' ? 'background: #22c55e;' : ''}
          ${port.type === 'end' ? 'background: #ef4444;' : ''}
          ${port.type === 'transit' ? 'background: #f59e0b;' : ''}
        `;
        el.innerHTML = port.type === 'start' ? '🚀' : port.type === 'end' ? '🏁' : '🔄';

        new mapboxgl.Marker(el)
          .setLngLat(port.coords)
          .setPopup(new mapboxgl.Popup({ offset: 25 }).setHTML(`
            <div style="text-align: center; padding: 8px;">
              <strong>${port.name}</strong><br/>
              <small>${port.nameEn}</small>
            </div>
          `))
          .addTo(map.current!);
      });

      // Add vehicle marker
      const vehicleEl = document.createElement('div');
      vehicleEl.style.cssText = `
        font-size: 28px;
        filter: drop-shadow(0 0 8px ${isSea ? '#3b82f6' : '#0ea5e9'});
        transition: transform 0.1s ease-out;
      `;
      vehicleEl.innerHTML = isSea ? '🚢' : '✈️';

      vehicleMarker.current = new mapboxgl.Marker(vehicleEl)
        .setLngLat(routeCoordinates[0])
        .addTo(map.current);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [mapboxToken, routeType, isSea]);

  // Update vehicle position based on progress
  useEffect(() => {
    if (!vehicleMarker.current || !mapLoaded) return;

    const totalPoints = routeCoordinates.length;
    const progressIndex = (progress / 100) * (totalPoints - 1);
    const currentIndex = Math.floor(progressIndex);
    const nextIndex = Math.min(currentIndex + 1, totalPoints - 1);
    const segmentProgress = progressIndex - currentIndex;

    const currentCoord = routeCoordinates[currentIndex];
    const nextCoord = routeCoordinates[nextIndex];

    const lng = currentCoord[0] + (nextCoord[0] - currentCoord[0]) * segmentProgress;
    const lat = currentCoord[1] + (nextCoord[1] - currentCoord[1]) * segmentProgress;

    vehicleMarker.current.setLngLat([lng, lat]);
  }, [progress, mapLoaded, routeCoordinates]);

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
                {isSea ? 'Sea Freight (Container)' : 'Air Freight'}
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
              className={`h-full transition-all duration-300 ease-linear rounded-full ${
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
        <div 
          ref={mapContainer} 
          className="w-full h-[300px]"
        />
        {!mapboxToken && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <p className="text-muted-foreground text-sm">جاري تحميل الخريطة...</p>
          </div>
        )}
      </div>

      {/* Footer with route info */}
      <div className="px-4 py-3 bg-muted/30 border-t border-border">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-green-500/20 text-green-400">
              <span className="w-2 h-2 rounded-full bg-green-500"></span>
              {markers[0].name}
            </span>
            <span className="text-muted-foreground">→</span>
            {isSea && markers.length > 2 && (
              <>
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/20 text-amber-400">
                  <span className="w-2 h-2 rounded-full bg-amber-500"></span>
                  {markers[1].name}
                </span>
                <span className="text-muted-foreground">→</span>
              </>
            )}
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-red-500/20 text-red-400">
              <span className="w-2 h-2 rounded-full bg-red-500"></span>
              {markers[markers.length - 1].name}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};
