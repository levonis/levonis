import { useEffect, useState } from 'react';
import { Ship, Plane } from 'lucide-react';
import { differenceInMilliseconds, addDays } from 'date-fns';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
  shippedAt?: string | null;
  shippingDurationDays?: number | null;
}

// SVG coordinates for the sea route points
const SEA_ROUTE_POINTS = [
  { x: 92, y: 52, name: 'ميناء نانشا', nameEn: 'Nansha Port' },
  { x: 88, y: 58, name: 'بحر الصين الجنوبي', nameEn: 'South China Sea' },
  { x: 80, y: 68, name: 'مضيق ملقا', nameEn: 'Malacca Strait' },
  { x: 65, y: 65, name: 'المحيط الهندي', nameEn: 'Indian Ocean' },
  { x: 50, y: 55, name: 'بحر العرب', nameEn: 'Arabian Sea' },
  { x: 42, y: 48, name: 'ميناء جبل علي', nameEn: 'Jebel Ali Port' },
  { x: 38, y: 42, name: 'الخليج العربي', nameEn: 'Arabian Gulf' },
  { x: 35, y: 40, name: 'ميناء أم قصر', nameEn: 'Umm Qasr Port' },
];

const AIR_ROUTE_POINTS = [
  { x: 92, y: 50, name: 'مطار قوانغتشو', nameEn: 'Guangzhou Airport' },
  { x: 75, y: 45, name: 'فوق الهند', nameEn: 'Over India' },
  { x: 55, y: 40, name: 'فوق إيران', nameEn: 'Over Iran' },
  { x: 40, y: 38, name: 'مطار أربيل', nameEn: 'Erbil Airport' },
];

// Generate smooth path from points
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
          viewBox="0 0 100 80" 
          className="w-full h-[260px]"
          style={{ background: 'linear-gradient(180deg, #1e3a5f 0%, #0c1929 100%)' }}
        >
          {/* Ocean background */}
          <rect x="0" y="0" width="100" height="80" fill="url(#oceanGradient)" />
          
          {/* Gradients */}
          <defs>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="0%" y2="100%">
              <stop offset="0%" stopColor="#1e3a5f" />
              <stop offset="100%" stopColor="#0c1929" />
            </linearGradient>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor={isSea ? '#3b82f6' : '#0ea5e9'} />
              <stop offset="100%" stopColor={isSea ? '#60a5fa' : '#38bdf8'} />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Simplified land masses */}
          {/* Asia */}
          <path 
            d="M 70 10 L 98 10 L 98 45 L 95 48 L 90 46 L 85 50 L 80 48 L 75 52 L 70 50 L 65 45 L 60 40 L 55 35 L 50 30 L 45 28 L 40 25 L 35 22 L 30 20 L 25 18 L 20 15 L 15 12 L 10 10 L 5 8 L 0 5 L 0 0 L 70 0 Z" 
            fill="#2d4a3e" 
            opacity="0.7"
          />
          
          {/* Southeast Asia / Indonesia */}
          <path 
            d="M 78 55 L 85 58 L 88 62 L 85 65 L 80 63 L 75 66 L 72 64 L 75 60 L 78 55" 
            fill="#2d4a3e" 
            opacity="0.6"
          />
          
          {/* India */}
          <path 
            d="M 55 35 L 60 40 L 58 50 L 55 55 L 50 60 L 48 55 L 50 48 L 52 42 L 55 35" 
            fill="#2d4a3e" 
            opacity="0.7"
          />
          
          {/* Arabian Peninsula */}
          <path 
            d="M 35 35 L 45 38 L 48 45 L 45 52 L 40 55 L 35 52 L 32 48 L 30 42 L 32 38 L 35 35" 
            fill="#2d4a3e" 
            opacity="0.7"
          />
          
          {/* Middle East / Iraq */}
          <path 
            d="M 30 28 L 40 30 L 42 35 L 38 38 L 32 36 L 28 32 L 30 28" 
            fill="#2d4a3e" 
            opacity="0.7"
          />
          
          {/* Africa (partial) */}
          <path 
            d="M 0 30 L 15 35 L 25 45 L 30 55 L 28 65 L 20 75 L 10 80 L 0 80 L 0 30" 
            fill="#2d4a3e" 
            opacity="0.6"
          />

          {/* Route path - dashed background */}
          <path
            d={pathD}
            fill="none"
            stroke="rgba(255,255,255,0.2)"
            strokeWidth="0.8"
            strokeDasharray="2,2"
          />
          
          {/* Route path - active */}
          <path
            d={pathD}
            fill="none"
            stroke="url(#routeGradient)"
            strokeWidth="1.2"
            strokeLinecap="round"
            filter="url(#glow)"
            strokeDasharray={`${progress * 2}, 1000`}
          />

          {/* Route points */}
          {routePoints.map((point, index) => {
            const isStart = index === 0;
            const isEnd = index === routePoints.length - 1;
            const isTransit = isSea && point.nameEn === 'Jebel Ali Port';
            
            return (
              <g key={index}>
                {/* Point marker */}
                <circle
                  cx={point.x}
                  cy={point.y}
                  r={isStart || isEnd || isTransit ? 2 : 1}
                  fill={isStart ? '#22c55e' : isEnd ? '#ef4444' : isTransit ? '#f59e0b' : 'rgba(255,255,255,0.5)'}
                  filter={isStart || isEnd || isTransit ? 'url(#glow)' : undefined}
                />
                {/* Labels for key points */}
                {(isStart || isEnd || isTransit) && (
                  <text
                    x={point.x}
                    y={point.y - 4}
                    fontSize="2.5"
                    fill="white"
                    textAnchor="middle"
                    fontFamily="Arial"
                  >
                    {point.nameEn}
                  </text>
                )}
              </g>
            );
          })}

          {/* Vehicle icon */}
          {isShipped && (
            <g transform={`translate(${currentPosition.x}, ${currentPosition.y})`}>
              <circle r="4" fill={isSea ? '#3b82f6' : '#0ea5e9'} filter="url(#glow)" />
              <text
                x="0"
                y="1.5"
                fontSize="5"
                textAnchor="middle"
                dominantBaseline="middle"
              >
                {isSea ? '🚢' : '✈️'}
              </text>
            </g>
          )}

          {/* Completed badge */}
          {progress >= 100 && (
            <g transform="translate(50, 15)">
              <rect x="-12" y="-4" width="24" height="8" rx="4" fill="#22c55e" />
              <text x="0" y="1" fontSize="3" fill="white" textAnchor="middle" dominantBaseline="middle" fontFamily="Arial">
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
            <div className="w-2.5 h-2.5 rounded-full bg-green-500 shadow-sm shadow-green-500/50"></div>
            <div className="text-right">
              <p className="font-bold text-foreground text-xs">{fromLoc.name}</p>
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
              <p className="font-bold text-foreground text-xs">{toLoc.name}</p>
              <p className="text-muted-foreground text-[10px]">{toLoc.nameEn}</p>
            </div>
            <div className="w-2.5 h-2.5 rounded-full bg-red-500 shadow-sm shadow-red-500/50"></div>
          </div>
        </div>

        {/* Route stages */}
        {isSea && (
          <div className="mt-3 pt-3 border-t border-border/50">
            <p className="text-[10px] text-muted-foreground text-center">
              نانشا ← بحر الصين الجنوبي ← مضيق ملقا ← المحيط الهندي ← جبل علي (ترانزيت) ← الخليج العربي ← أم قصر
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
