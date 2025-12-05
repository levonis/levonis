import { useEffect, useState } from 'react';
import { Ship, Plane, Anchor } from 'lucide-react';
import { differenceInMilliseconds, addDays } from 'date-fns';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
  shippedAt?: string | null;
  shippingDurationDays?: number | null;
}

// SVG coordinates for the sea route points (adjusted for better accuracy)
const SEA_ROUTE_POINTS = [
  { x: 88, y: 38, name: 'ميناء نانشا', nameEn: 'Nansha Port', isPort: true },
  { x: 85, y: 45, name: 'بحر الصين الجنوبي', nameEn: 'South China Sea', isPort: false },
  { x: 78, y: 55, name: 'سنغافورة', nameEn: 'Singapore', isPort: false },
  { x: 68, y: 58, name: 'مضيق ملقا', nameEn: 'Malacca Strait', isPort: false },
  { x: 52, y: 55, name: 'المحيط الهندي', nameEn: 'Indian Ocean', isPort: false },
  { x: 38, y: 48, name: 'بحر العرب', nameEn: 'Arabian Sea', isPort: false },
  { x: 30, y: 40, name: 'ميناء جبل علي', nameEn: 'Jebel Ali Port', isPort: true },
  { x: 28, y: 34, name: 'الخليج العربي', nameEn: 'Arabian Gulf', isPort: false },
  { x: 26, y: 28, name: 'ميناء أم قصر', nameEn: 'Umm Qasr Port', isPort: true },
];

const AIR_ROUTE_POINTS = [
  { x: 88, y: 36, name: 'مطار قوانغتشو', nameEn: 'Guangzhou Airport', isPort: true },
  { x: 70, y: 32, name: 'فوق ميانمار', nameEn: 'Over Myanmar', isPort: false },
  { x: 52, y: 30, name: 'فوق الهند', nameEn: 'Over India', isPort: false },
  { x: 38, y: 26, name: 'فوق إيران', nameEn: 'Over Iran', isPort: false },
  { x: 28, y: 24, name: 'مطار أربيل', nameEn: 'Erbil Airport', isPort: true },
];

// Generate smooth curved path from points
const generatePath = (points: typeof SEA_ROUTE_POINTS): string => {
  if (points.length < 2) return '';
  
  let path = `M ${points[0].x} ${points[0].y}`;
  
  for (let i = 1; i < points.length; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const cpX = (prev.x + curr.x) / 2;
    const cpY = (prev.y + curr.y) / 2;
    path += ` Q ${prev.x} ${prev.y} ${cpX} ${cpY}`;
  }
  
  const last = points[points.length - 1];
  path += ` L ${last.x} ${last.y}`;
  
  return path;
};

// Get position along path based on progress
const getPositionOnPath = (points: typeof SEA_ROUTE_POINTS, progress: number) => {
  if (progress <= 0) return points[0];
  if (progress >= 100) return points[points.length - 1];
  
  const totalSegments = points.length - 1;
  const progressPerSegment = 100 / totalSegments;
  const currentSegment = Math.floor(progress / progressPerSegment);
  const segmentProgress = (progress % progressPerSegment) / progressPerSegment;
  
  if (currentSegment >= totalSegments) return points[points.length - 1];
  
  const start = points[currentSegment];
  const end = points[currentSegment + 1];
  
  return {
    x: start.x + (end.x - start.x) * segmentProgress,
    y: start.y + (end.y - start.y) * segmentProgress,
    name: start.name,
    nameEn: start.nameEn,
    isPort: false,
  };
};

export const ShippingRouteMap = ({ 
  routeType, 
  isShipped = false,
  shippedAt,
  shippingDurationDays
}: ShippingRouteMapProps) => {
  const [progress, setProgress] = useState(0);

  const isSea = routeType === 'sea_guangzhou_umm_qasr';
  const routePoints = isSea ? SEA_ROUTE_POINTS : AIR_ROUTE_POINTS;
  const fromLoc = routePoints[0];
  const toLoc = routePoints[routePoints.length - 1];

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
        setProgress(prev => prev >= 100 ? 0 : prev + 0.3);
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isShipped, shippedAt, shippingDurationDays]);

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
  const currentPosition = getPositionOnPath(routePoints, progress);
  const pathD = generatePath(routePoints);

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

      {/* SVG Map */}
      <div className="relative p-2">
        <svg 
          viewBox="0 0 100 70" 
          className="w-full h-[280px]"
        >
          {/* Definitions */}
          <defs>
            {/* Ocean gradient */}
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="#0a1628" />
              <stop offset="50%" stopColor="#0f2744" />
              <stop offset="100%" stopColor="#0a1628" />
            </linearGradient>
            
            {/* Land gradient */}
            <linearGradient id="landGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#3d5a45" />
              <stop offset="100%" stopColor="#2a3d30" />
            </linearGradient>
            
            {/* Desert gradient */}
            <linearGradient id="desertGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#8b7355" />
              <stop offset="100%" stopColor="#6b5344" />
            </linearGradient>
            
            {/* Route gradient */}
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isSea ? '#3b82f6' : '#0ea5e9'} />
              <stop offset="50%" stopColor={isSea ? '#60a5fa' : '#38bdf8'} />
              <stop offset="100%" stopColor={isSea ? '#93c5fd' : '#7dd3fc'} />
            </linearGradient>
            
            {/* Glow filter */}
            <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
              <feGaussianBlur stdDeviation="0.8" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Strong glow */}
            <filter id="strongGlow" x="-100%" y="-100%" width="300%" height="300%">
              <feGaussianBlur stdDeviation="1.5" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
            
            {/* Water pattern */}
            <pattern id="waterPattern" patternUnits="userSpaceOnUse" width="4" height="4">
              <circle cx="2" cy="2" r="0.3" fill="rgba(100,150,200,0.1)" />
            </pattern>
          </defs>

          {/* Ocean background */}
          <rect x="0" y="0" width="100" height="70" fill="url(#oceanGradient)" />
          <rect x="0" y="0" width="100" height="70" fill="url(#waterPattern)" />
          
          {/* Grid lines (latitude/longitude effect) */}
          {[10, 20, 30, 40, 50, 60, 70, 80, 90].map(x => (
            <line key={`v-${x}`} x1={x} y1="0" x2={x} y2="70" stroke="rgba(100,150,200,0.08)" strokeWidth="0.2" />
          ))}
          {[10, 20, 30, 40, 50, 60].map(y => (
            <line key={`h-${y}`} x1="0" y1={y} x2="100" y2={y} stroke="rgba(100,150,200,0.08)" strokeWidth="0.2" />
          ))}

          {/* LANDMASSES */}
          
          {/* China */}
          <path 
            d="M 75 5 L 98 5 L 98 35 L 95 38 L 90 36 L 85 40 L 82 38 L 78 35 L 75 30 L 72 25 L 70 20 L 68 15 L 70 10 L 75 5" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          <text x="85" y="25" fontSize="2.5" fill="rgba(255,255,255,0.6)" textAnchor="middle">الصين</text>
          
          {/* Vietnam/Indochina */}
          <path 
            d="M 78 35 L 82 38 L 80 45 L 78 50 L 75 48 L 73 45 L 75 40 L 78 35" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          
          {/* Thailand/Malaysia */}
          <path 
            d="M 70 42 L 75 45 L 73 52 L 70 58 L 68 62 L 65 60 L 67 55 L 68 50 L 70 42" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          
          {/* Indonesia (Sumatra) */}
          <path 
            d="M 60 58 L 68 62 L 70 65 L 65 68 L 58 66 L 55 62 L 58 58 L 60 58" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          
          {/* Indonesia (Java/Borneo) */}
          <path 
            d="M 72 60 L 80 58 L 85 62 L 82 66 L 75 68 L 70 65 L 72 60" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          
          {/* India */}
          <path 
            d="M 42 18 L 55 15 L 58 22 L 55 32 L 52 42 L 48 50 L 44 55 L 40 52 L 42 45 L 44 38 L 45 30 L 44 25 L 42 18" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          <text x="48" y="35" fontSize="2" fill="rgba(255,255,255,0.5)" textAnchor="middle">الهند</text>
          
          {/* Sri Lanka */}
          <circle cx="50" cy="52" r="2" fill="url(#landGradient)" stroke="#4a6b52" strokeWidth="0.2" />
          
          {/* Arabian Peninsula */}
          <path 
            d="M 22 32 L 35 28 L 38 35 L 36 45 L 32 52 L 26 55 L 20 52 L 18 45 L 20 38 L 22 32" 
            fill="url(#desertGradient)" 
            stroke="#7a6a55"
            strokeWidth="0.3"
          />
          <text x="28" y="45" fontSize="1.8" fill="rgba(255,255,255,0.5)" textAnchor="middle">السعودية</text>
          
          {/* UAE */}
          <text x="32" y="40" fontSize="1.5" fill="rgba(255,255,255,0.4)" textAnchor="middle">الإمارات</text>
          
          {/* Iran */}
          <path 
            d="M 25 20 L 42 18 L 45 25 L 42 32 L 38 35 L 35 28 L 30 25 L 25 22 L 25 20" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          <text x="35" y="25" fontSize="1.8" fill="rgba(255,255,255,0.5)" textAnchor="middle">إيران</text>
          
          {/* Iraq */}
          <path 
            d="M 22 15 L 30 15 L 32 20 L 30 25 L 25 22 L 22 18 L 22 15" 
            fill="url(#desertGradient)" 
            stroke="#7a6a55"
            strokeWidth="0.3"
          />
          <text x="26" y="20" fontSize="1.5" fill="rgba(255,255,255,0.5)" textAnchor="middle">العراق</text>
          
          {/* Turkey */}
          <path 
            d="M 15 10 L 28 8 L 30 12 L 25 15 L 18 14 L 15 10" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          
          {/* Africa (East) */}
          <path 
            d="M 5 25 L 18 30 L 22 40 L 20 52 L 15 60 L 10 65 L 5 68 L 2 60 L 3 50 L 5 40 L 5 25" 
            fill="url(#landGradient)" 
            stroke="#4a6b52"
            strokeWidth="0.3"
          />
          <text x="10" y="50" fontSize="1.8" fill="rgba(255,255,255,0.4)" textAnchor="middle">أفريقيا</text>

          {/* Sea labels */}
          <text x="82" y="48" fontSize="1.5" fill="rgba(100,180,255,0.4)" textAnchor="middle" fontStyle="italic">بحر الصين الجنوبي</text>
          <text x="55" y="60" fontSize="1.5" fill="rgba(100,180,255,0.4)" textAnchor="middle" fontStyle="italic">المحيط الهندي</text>
          <text x="35" y="55" fontSize="1.5" fill="rgba(100,180,255,0.4)" textAnchor="middle" fontStyle="italic">بحر العرب</text>
          <text x="25" y="35" fontSize="1.3" fill="rgba(100,180,255,0.4)" textAnchor="middle" fontStyle="italic">الخليج العربي</text>

          {/* Route path - dashed background */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="1"
            strokeDasharray="2,1.5"
          />
          
          {/* Route path - active glow */}
          <path
            d={pathD}
            fill="none"
            stroke={isSea ? 'rgba(59,130,246,0.3)' : 'rgba(14,165,233,0.3)'}
            strokeWidth="3"
            strokeLinecap="round"
            filter="url(#strongGlow)"
            style={{
              strokeDasharray: '1000',
              strokeDashoffset: 1000 - (progress * 10),
              transition: 'stroke-dashoffset 0.3s ease-out'
            }}
          />
          
          {/* Route path - main line */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="1.2"
            strokeLinecap="round"
            filter="url(#glow)"
            style={{
              strokeDasharray: '1000',
              strokeDashoffset: 1000 - (progress * 10),
              transition: 'stroke-dashoffset 0.3s ease-out'
            }}
          />

          {/* Route waypoints */}
          {routePoints.map((point, index) => {
            const isStart = index === 0;
            const isEnd = index === routePoints.length - 1;
            const isTransit = point.isPort && !isStart && !isEnd;
            const passedPoint = (index / (routePoints.length - 1)) * 100 <= progress;
            
            return (
              <g key={index}>
                {/* Port markers with anchor icon */}
                {point.isPort ? (
                  <>
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={2.5}
                      fill={isStart ? '#22c55e' : isEnd ? '#ef4444' : '#f59e0b'}
                      filter="url(#strongGlow)"
                      opacity={passedPoint ? 1 : 0.5}
                    />
                    <circle
                      cx={point.x}
                      cy={point.y}
                      r={1.5}
                      fill="white"
                      opacity={passedPoint ? 0.9 : 0.4}
                    />
                    {/* Port label */}
                    <rect 
                      x={point.x - 10} 
                      y={point.y - 7} 
                      width="20" 
                      height="4" 
                      rx="1" 
                      fill="rgba(0,0,0,0.7)"
                    />
                    <text
                      x={point.x}
                      y={point.y - 4.5}
                      fontSize="2"
                      fill="white"
                      textAnchor="middle"
                      fontWeight="bold"
                    >
                      {point.nameEn}
                    </text>
                  </>
                ) : (
                  /* Waypoint dots */
                  <circle
                    cx={point.x}
                    cy={point.y}
                    r={0.8}
                    fill={passedPoint ? (isSea ? '#60a5fa' : '#38bdf8') : 'rgba(255,255,255,0.3)'}
                    filter={passedPoint ? 'url(#glow)' : undefined}
                  />
                )}
              </g>
            );
          })}

          {/* Vehicle icon */}
          {isShipped && (
            <g transform={`translate(${currentPosition.x}, ${currentPosition.y})`}>
              {/* Outer glow */}
              <circle r="5" fill={isSea ? 'rgba(59,130,246,0.3)' : 'rgba(14,165,233,0.3)'} filter="url(#strongGlow)" />
              {/* Inner circle */}
              <circle r="3.5" fill={isSea ? '#1e40af' : '#0369a1'} />
              <circle r="2.8" fill={isSea ? '#3b82f6' : '#0ea5e9'} />
              {/* Icon */}
              <text
                x="0"
                y="1.2"
                fontSize="4"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {isSea ? '🚢' : '✈️'}
              </text>
            </g>
          )}

          {/* Completed badge */}
          {progress >= 100 && (
            <g transform="translate(50, 10)">
              <rect x="-14" y="-5" width="28" height="10" rx="5" fill="#22c55e" filter="url(#strongGlow)" />
              <text x="0" y="1" fontSize="3.5" fill="white" textAnchor="middle" dominantBaseline="middle" fontWeight="bold">
                ✓ تم الوصول
              </text>
            </g>
          )}
        </svg>
      </div>

      {/* Route info footer */}
      <div className="px-4 py-3 border-t border-border bg-muted/30">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 flex-1">
            <div className="w-3 h-3 rounded-full bg-green-500 shadow-sm shadow-green-500/50 flex items-center justify-center">
              <Anchor className="w-2 h-2 text-white" />
            </div>
            <div className="text-right">
              <p className="font-bold text-foreground text-xs">{fromLoc.name}</p>
              <p className="text-muted-foreground text-[10px]">{fromLoc.nameEn}</p>
            </div>
          </div>
          
          <div className="flex items-center gap-1 px-3">
            <div className={`h-0.5 w-6 rounded ${isSea ? 'bg-blue-500' : 'bg-sky-500'}`}></div>
            <Icon className={`h-4 w-4 ${isSea ? 'text-blue-500' : 'text-sky-500'}`} />
            <div className={`h-0.5 w-6 rounded ${isSea ? 'bg-blue-500' : 'bg-sky-500'}`}></div>
          </div>
          
          <div className="flex items-center gap-2 flex-1 justify-end">
            <div className="text-left">
              <p className="font-bold text-foreground text-xs">{toLoc.name}</p>
              <p className="text-muted-foreground text-[10px]">{toLoc.nameEn}</p>
            </div>
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-sm shadow-red-500/50 flex items-center justify-center">
              <Anchor className="w-2 h-2 text-white" />
            </div>
          </div>
        </div>

        {/* Route stages */}
        {isSea && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <div className="flex items-center justify-center gap-1 flex-wrap">
              {['نانشا', 'بحر الصين', 'ملقا', 'المحيط الهندي', 'جبل علي', 'الخليج', 'أم قصر'].map((stage, i, arr) => (
                <span key={i} className="flex items-center gap-1">
                  <span className={`text-[9px] px-1.5 py-0.5 rounded ${
                    i === 0 ? 'bg-green-500/20 text-green-400' : 
                    i === arr.length - 1 ? 'bg-red-500/20 text-red-400' :
                    i === 4 ? 'bg-amber-500/20 text-amber-400' :
                    'bg-muted text-muted-foreground'
                  }`}>{stage}</span>
                  {i < arr.length - 1 && <span className="text-muted-foreground text-[8px]">→</span>}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
