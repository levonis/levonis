import { useEffect, useRef, useState, useCallback } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';
import { Button } from '@/components/ui/button';
import { Trash2, RotateCcw, Save, MapPin } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface ShippingRouteEditorProps {
  orderId: string;
  initialWaypoints?: [number, number][] | null;
  onSave: (waypoints: [number, number][]) => void;
  onCancel: () => void;
}

export const ShippingRouteEditor = ({ 
  orderId, 
  initialWaypoints, 
  onSave, 
  onCancel 
}: ShippingRouteEditorProps) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const markersRef = useRef<mapboxgl.Marker[]>([]);
  const [waypoints, setWaypoints] = useState<[number, number][]>(initialWaypoints || []);
  const [mapboxToken, setMapboxToken] = useState<string | null>(null);
  const [mapLoaded, setMapLoaded] = useState(false);
  const [isAddingPoint, setIsAddingPoint] = useState(true); // Start in adding mode
  const isAddingPointRef = useRef(true); // Ref to track adding state for event handlers

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
        toast.error('فشل تحميل الخريطة');
      }
    };
    fetchToken();
  }, []);

  // Update route line on map
  const updateRouteLine = useCallback(() => {
    if (!map.current || !mapLoaded || waypoints.length < 2) return;

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
  }, [waypoints, mapLoaded]);

  // Update markers on map
  const updateMarkers = useCallback(() => {
    if (!map.current || !mapLoaded) return;

    // Remove existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    // Add new markers
    waypoints.forEach((coord, index) => {
      const el = document.createElement('div');
      el.style.cssText = `
        width: 28px;
        height: 28px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        cursor: grab;
        border: 3px solid white;
        box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ${index === 0 ? 'background: #22c55e;' : ''}
        ${index === waypoints.length - 1 && waypoints.length > 1 ? 'background: #ef4444;' : ''}
        ${index > 0 && index < waypoints.length - 1 ? 'background: #3b82f6;' : ''}
      `;
      el.innerHTML = `${index + 1}`;
      el.title = `نقطة ${index + 1} - اسحب لتغيير الموقع`;

      const marker = new mapboxgl.Marker({ element: el, draggable: true })
        .setLngLat(coord)
        .addTo(map.current!);

      // Handle drag end
      marker.on('dragend', () => {
        const lngLat = marker.getLngLat();
        setWaypoints(prev => {
          const newWaypoints = [...prev];
          newWaypoints[index] = [lngLat.lng, lngLat.lat];
          return newWaypoints;
        });
      });

      markersRef.current.push(marker);
    });
  }, [waypoints, mapLoaded]);

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current || !mapboxToken) return;

    mapboxgl.accessToken = mapboxToken;

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/dark-v11',
      center: [75, 20],
      zoom: 2.5,
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
            coordinates: waypoints,
          },
        },
      });

      // Add route line
      map.current.addLayer({
        id: 'route-line',
        type: 'line',
        source: 'route',
        layout: {
          'line-join': 'round',
          'line-cap': 'round',
        },
        paint: {
          'line-color': '#3b82f6',
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
          'line-color': '#60a5fa',
          'line-width': 10,
          'line-opacity': 0.3,
          'line-blur': 4,
        },
      });
    });

    // Handle click to add points
    map.current.on('click', (e) => {
      if (!isAddingPointRef.current) return;
      const { lng, lat } = e.lngLat;
      setWaypoints(prev => [...prev, [lng, lat]]);
    });

    return () => {
      map.current?.remove();
      map.current = null;
      setMapLoaded(false);
    };
  }, [mapboxToken]);

  // Update route and markers when waypoints change
  useEffect(() => {
    updateRouteLine();
    updateMarkers();
  }, [waypoints, updateRouteLine, updateMarkers]);

  // Update cursor and ref when in adding mode
  useEffect(() => {
    isAddingPointRef.current = isAddingPoint;
    if (!map.current) return;
    map.current.getCanvas().style.cursor = isAddingPoint ? 'crosshair' : '';
  }, [isAddingPoint]);

  const handleClear = () => {
    setWaypoints([]);
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];
  };

  const handleReset = () => {
    setWaypoints(initialWaypoints || []);
  };

  const handleRemoveLastPoint = () => {
    if (waypoints.length === 0) return;
    setWaypoints(prev => prev.slice(0, -1));
  };

  const handleSave = () => {
    if (waypoints.length < 2) {
      toast.error('يجب إضافة نقطتين على الأقل للمسار');
      return;
    }
    onSave(waypoints);
  };

  return (
    <div className="w-full bg-card rounded-xl border border-border overflow-hidden">
      {/* Header */}
      <div className="bg-muted/50 px-4 py-3 border-b border-border">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MapPin className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-foreground text-sm">رسم مسار الشحن</h3>
              <p className="text-xs text-muted-foreground">
                انقر على الخريطة لإضافة نقاط المسار ({waypoints.length} نقطة)
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Toolbar */}
      <div className="px-4 py-2 bg-muted/30 border-b border-border flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          variant={isAddingPoint ? 'default' : 'outline'}
          onClick={() => setIsAddingPoint(!isAddingPoint)}
          className="gap-1"
        >
          <MapPin className="h-4 w-4" />
          {isAddingPoint ? 'إيقاف الإضافة' : 'إضافة نقاط'}
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleRemoveLastPoint}
          disabled={waypoints.length === 0}
          className="gap-1"
        >
          <Trash2 className="h-4 w-4" />
          حذف الأخيرة
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleClear}
          disabled={waypoints.length === 0}
          className="gap-1"
        >
          مسح الكل
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={handleReset}
          disabled={!initialWaypoints || initialWaypoints.length === 0}
          className="gap-1"
        >
          <RotateCcw className="h-4 w-4" />
          استعادة
        </Button>
      </div>

      {/* Map Container */}
      <div className="relative">
        <div 
          ref={mapContainer} 
          className="w-full h-[400px]"
        />
        {!mapboxToken && (
          <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
            <p className="text-muted-foreground text-sm">جاري تحميل الخريطة...</p>
          </div>
        )}
        {isAddingPoint && (
          <div className="absolute top-4 right-4 bg-primary/90 text-primary-foreground px-3 py-2 rounded-lg text-sm animate-pulse">
            انقر على الخريطة لإضافة نقطة جديدة
          </div>
        )}
      </div>

      {/* Instructions */}
      <div className="px-4 py-2 bg-muted/30 border-t border-border text-xs text-muted-foreground">
        <p>💡 <strong>تعليمات:</strong> اضغط "إضافة نقاط" ثم انقر على الخريطة لرسم المسار. يمكنك سحب النقاط لتعديل مواقعها.</p>
      </div>

      {/* Footer Actions */}
      <div className="px-4 py-3 bg-muted/50 border-t border-border flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={onCancel}
        >
          إلغاء
        </Button>
        <Button
          type="button"
          onClick={handleSave}
          disabled={waypoints.length < 2}
          className="gap-1"
        >
          <Save className="h-4 w-4" />
          حفظ المسار
        </Button>
      </div>
    </div>
  );
};
