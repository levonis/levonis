import { Ship, Plane } from 'lucide-react';
import { useState, useEffect } from 'react';
import { differenceInMilliseconds, addDays } from 'date-fns';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
  shippedAt?: string | null;
  shippingDurationDays?: number | null;
}

// Real coordinates (latitude, longitude)
const LOCATIONS = {
  // Guangzhou Nansha Port: 22.6692°N, 113.6605°E
  guangzhou_port: { lat: 22.6692, lon: 113.6605, nameAr: 'ميناء قوانغتشو نانشا', nameEn: 'Guangzhou Nansha Port' },
  // Umm Qasr Port: 30.0534°N, 47.9392°E
  umm_qasr: { lat: 30.0534, lon: 47.9392, nameAr: 'ميناء أم قصر', nameEn: 'Umm Qasr Port' },
  // Guangzhou Baiyun International Airport: 23.3925°N, 113.2989°E
  guangzhou_airport: { lat: 23.3925, lon: 113.2989, nameAr: 'مطار قوانغتشو باييون الدولي', nameEn: 'Guangzhou Baiyun Airport' },
  // Erbil International Airport: 36.2358°N, 43.9578°E
  erbil_airport: { lat: 36.2358, lon: 43.9578, nameAr: 'مطار أربيل الدولي', nameEn: 'Erbil International Airport' },
};

// Convert lat/lon to SVG coordinates
// Map bounds: Lon 35°E to 120°E, Lat 5°N to 45°N
const toSvgCoords = (lat: number, lon: number) => {
  const minLon = 35, maxLon = 120;
  const minLat = 5, maxLat = 45;
  const x = ((lon - minLon) / (maxLon - minLon)) * 100;
  const y = ((maxLat - lat) / (maxLat - minLat)) * 100;
  return { x, y };
};

export const ShippingRouteMap = ({ 
  routeType, 
  isShipped = false,
  shippedAt,
  shippingDurationDays
}: ShippingRouteMapProps) => {
  const [progress, setProgress] = useState(0);

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
        setProgress(prev => prev >= 100 ? 0 : prev + 0.3);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isShipped, shippedAt, shippingDurationDays]);

  if (!routeType) return null;

  const isSea = routeType === 'sea_guangzhou_umm_qasr';
  
  // Get locations based on route type
  const fromLoc = isSea ? LOCATIONS.guangzhou_port : LOCATIONS.guangzhou_airport;
  const toLoc = isSea ? LOCATIONS.umm_qasr : LOCATIONS.erbil_airport;
  
  const from = toSvgCoords(fromLoc.lat, fromLoc.lon);
  const to = toSvgCoords(toLoc.lat, toLoc.lon);

  // Sea route waypoints (through South China Sea, Malacca Strait, Indian Ocean, Arabian Sea, Persian Gulf)
  const seaWaypoints = [
    toSvgCoords(22.67, 113.66),  // Guangzhou Nansha Port
    toSvgCoords(18, 110),        // South China Sea
    toSvgCoords(8, 105),         // Near Vietnam
    toSvgCoords(4, 100),         // Malacca Strait
    toSvgCoords(6, 80),          // Indian Ocean
    toSvgCoords(12, 65),         // Arabian Sea
    toSvgCoords(22, 60),         // Near Oman
    toSvgCoords(26, 56),         // Persian Gulf entrance
    toSvgCoords(29, 50),         // Persian Gulf
    toSvgCoords(30.05, 47.94),   // Umm Qasr
  ];

  // Air route (more direct, slight curve)
  const airWaypoints = [
    toSvgCoords(23.39, 113.30),  // Guangzhou Airport
    toSvgCoords(28, 95),         // Over Myanmar
    toSvgCoords(32, 75),         // Over Pakistan/India
    toSvgCoords(35, 55),         // Over Iran
    toSvgCoords(36.24, 43.96),   // Erbil Airport
  ];

  const waypoints = isSea ? seaWaypoints : airWaypoints;

  // Create smooth path through waypoints
  const createPath = (points: { x: number; y: number }[]) => {
    if (points.length < 2) return '';
    let path = `M ${points[0].x} ${points[0].y}`;
    
    for (let i = 1; i < points.length - 1; i++) {
      const prev = points[i - 1];
      const curr = points[i];
      const next = points[i + 1];
      
      const cp1x = curr.x - (next.x - prev.x) * 0.15;
      const cp1y = curr.y - (next.y - prev.y) * 0.15;
      const cp2x = curr.x + (next.x - prev.x) * 0.15;
      const cp2y = curr.y + (next.y - prev.y) * 0.15;
      
      path += ` Q ${cp1x} ${cp1y} ${curr.x} ${curr.y}`;
    }
    
    const last = points[points.length - 1];
    path += ` L ${last.x} ${last.y}`;
    
    return path;
  };

  const routePath = createPath(waypoints);

  // Calculate position along path
  const getPositionOnPath = (t: number) => {
    const index = t * (waypoints.length - 1);
    const i = Math.floor(index);
    const frac = index - i;
    
    if (i >= waypoints.length - 1) return waypoints[waypoints.length - 1];
    
    const p1 = waypoints[i];
    const p2 = waypoints[i + 1];
    
    return {
      x: p1.x + (p2.x - p1.x) * frac,
      y: p1.y + (p2.y - p1.y) * frac,
    };
  };

  const iconPosition = getPositionOnPath(progress / 100);

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

  return (
    <div className="w-full bg-gradient-to-br from-blue-950/20 to-blue-900/10 rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
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

      {/* Realistic Map SVG */}
      <div className="relative p-2">
        <svg viewBox="0 0 100 50" className="w-full h-auto" style={{ minHeight: '220px' }}>
          <defs>
            {/* Ocean gradient */}
            <linearGradient id="oceanBg" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0c1929" />
              <stop offset="50%" stopColor="#0f2744" />
              <stop offset="100%" stopColor="#0a1628" />
            </linearGradient>
            
            {/* Land gradient */}
            <linearGradient id="landFill" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#2d4a3e" />
              <stop offset="100%" stopColor="#1e3329" />
            </linearGradient>
            
            {/* Route glow */}
            <filter id="routeGlow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.5" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
            
            {/* Marker glow */}
            <filter id="markerGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="0.3" result="blur" />
              <feMerge>
                <feMergeNode in="blur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>

            {/* Sea route gradient */}
            <linearGradient id="seaRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#3b82f6" />
              <stop offset="100%" stopColor="#06b6d4" />
            </linearGradient>

            {/* Air route gradient */}
            <linearGradient id="airRouteGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="#0ea5e9" />
              <stop offset="100%" stopColor="#8b5cf6" />
            </linearGradient>
          </defs>

          {/* Ocean background */}
          <rect x="0" y="0" width="100" height="50" fill="url(#oceanBg)" />
          
          {/* Grid lines (subtle) */}
          {[20, 40, 60, 80].map(x => (
            <line key={`vline-${x}`} x1={x} y1="0" x2={x} y2="50" stroke="#1e3a5f" strokeWidth="0.1" opacity="0.3" />
          ))}
          {[10, 20, 30, 40].map(y => (
            <line key={`hline-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="#1e3a5f" strokeWidth="0.1" opacity="0.3" />
          ))}

          {/* Simplified realistic country outlines */}
          {/* China */}
          <path 
            d="M 75 5 L 95 8 L 98 15 L 95 25 L 90 30 L 85 35 L 78 38 L 72 35 L 68 30 L 65 22 L 68 15 L 72 10 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />
          
          {/* Southeast Asia */}
          <path 
            d="M 72 35 L 78 38 L 80 42 L 78 48 L 72 50 L 68 48 L 65 42 L 68 38 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />
          
          {/* India */}
          <path 
            d="M 48 20 L 58 18 L 62 22 L 60 32 L 55 42 L 50 45 L 45 40 L 44 30 L 46 24 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />
          
          {/* Middle East / Arabian Peninsula */}
          <path 
            d="M 15 25 L 32 22 L 38 28 L 35 38 L 28 45 L 18 42 L 12 35 L 14 28 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />
          
          {/* Iran/Iraq region */}
          <path 
            d="M 15 12 L 30 10 L 38 15 L 38 22 L 32 22 L 28 20 L 22 18 L 15 18 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />
          
          {/* Turkey/Central Asia */}
          <path 
            d="M 8 8 L 25 5 L 35 8 L 35 12 L 30 10 L 15 12 L 8 10 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />

          {/* Africa (partial) */}
          <path 
            d="M 0 30 L 12 28 L 14 35 L 12 45 L 5 50 L 0 48 Z" 
            fill="url(#landFill)" 
            stroke="#3d5a4a" 
            strokeWidth="0.2"
            opacity="0.9"
          />

          {/* Route path - dashed background */}
          <path 
            d={routePath} 
            fill="none" 
            stroke="#4a6a8a" 
            strokeWidth="0.3" 
            strokeDasharray="1,1"
            opacity="0.4"
          />

          {/* Route path - animated progress */}
          {isShipped && (
            <path 
              d={routePath} 
              fill="none" 
              stroke={isSea ? "url(#seaRouteGradient)" : "url(#airRouteGradient)"}
              strokeWidth="0.8" 
              strokeLinecap="round"
              strokeDasharray="150"
              strokeDashoffset={150 - (progress * 1.5)}
              filter="url(#routeGlow)"
            />
          )}

          {/* Origin marker */}
          <g filter="url(#markerGlow)">
            <circle cx={from.x} cy={from.y} r="1.5" fill="#22c55e" stroke="#fff" strokeWidth="0.3" />
            <circle cx={from.x} cy={from.y} r="2.5" fill="none" stroke="#22c55e" strokeWidth="0.2" opacity="0.6">
              <animate attributeName="r" values="1.5;3;1.5" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Destination marker */}
          <g filter="url(#markerGlow)">
            <circle cx={to.x} cy={to.y} r="1.5" fill="#ef4444" stroke="#fff" strokeWidth="0.3" />
            {progress < 100 && (
              <circle cx={to.x} cy={to.y} r="2.5" fill="none" stroke="#ef4444" strokeWidth="0.2" opacity="0.6">
                <animate attributeName="r" values="1.5;3;1.5" dur="2s" repeatCount="indefinite" begin="1s" />
                <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" begin="1s" />
              </circle>
            )}
          </g>

          {/* Location labels */}
          <text x={from.x} y={from.y - 3} textAnchor="middle" className="fill-green-400 text-[1.8px] font-bold">
            {fromLoc.nameAr}
          </text>
          <text x={to.x} y={to.y - 3} textAnchor="middle" className="fill-red-400 text-[1.8px] font-bold">
            {toLoc.nameAr}
          </text>
        </svg>

        {/* Floating ship/plane icon */}
        {isShipped && (
          <div 
            className="absolute transition-all duration-1000 ease-linear pointer-events-none"
            style={{
              left: `${iconPosition.x}%`,
              top: `${iconPosition.y * 0.88 + 8}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className={`p-2 rounded-full shadow-lg ${
              isSea 
                ? 'bg-blue-500 shadow-blue-500/50' 
                : 'bg-sky-500 shadow-sky-500/50'
            }`}>
              <Icon className="h-4 w-4 text-white" />
            </div>
          </div>
        )}

        {/* Completed badge */}
        {progress >= 100 && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-scale-in shadow-lg">
            ✓ تم الوصول
          </div>
        )}
      </div>

      {/* Route info footer */}
      <div className="px-4 pb-4 pt-2">
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
