import { Ship, Plane } from 'lucide-react';
import { useState, useEffect } from 'react';
import { differenceInMilliseconds, addDays } from 'date-fns';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
  shippedAt?: string | null;
  shippingDurationDays?: number | null;
}

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

    // Calculate real progress based on shipped date and duration
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

      // Update immediately
      updateProgress();
      
      // Update interval based on duration
      const intervalMs = shippingDurationDays <= 1 ? 1000 : shippingDurationDays <= 7 ? 30000 : 60000;
      
      const interval = setInterval(updateProgress, intervalMs);
      return () => clearInterval(interval);
    } else {
      // Fallback animation if duration not provided
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 0.5;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isShipped, shippedAt, shippingDurationDays]);

  if (!routeType) return null;

  const isSea = routeType === 'sea_guangzhou_umm_qasr';
  
  // Route configurations
  const routes = {
    sea_guangzhou_umm_qasr: {
      name: 'الشحن البحري',
      nameEn: 'Sea Freight',
      from: {
        name: 'ميناء قوانغتشو نانشا',
        nameEn: 'Guangzhou Nansha Port',
        x: 85,
        y: 45,
      },
      to: {
        name: 'ميناء أم قصر',
        nameEn: 'Umm Qasr Port',
        x: 50,
        y: 48,
      },
      path: 'M 85 45 Q 75 55 65 52 Q 55 48 50 48',
      color: 'hsl(var(--primary))',
      icon: Ship,
    },
    air_guangzhou_erbil: {
      name: 'الشحن الجوي',
      nameEn: 'Air Freight',
      from: {
        name: 'مطار قوانغتشو باييون الدولي',
        nameEn: 'Guangzhou Baiyun International Airport',
        x: 85,
        y: 40,
      },
      to: {
        name: 'مطار أربيل الدولي',
        nameEn: 'Erbil International Airport',
        x: 45,
        y: 38,
      },
      path: 'M 85 40 Q 65 32 45 38',
      color: 'hsl(var(--accent))',
      icon: Plane,
    },
  };

  const route = routes[routeType];
  const Icon = route.icon;

  // Calculate position along path
  const getPositionOnPath = (t: number) => {
    const from = { x: route.from.x, y: route.from.y };
    const to = { x: route.to.x, y: route.to.y };
    const control = isSea 
      ? { x: (from.x + to.x) / 2, y: from.y + 8 }
      : { x: (from.x + to.x) / 2, y: from.y - 8 };
    
    const x = Math.pow(1 - t, 2) * from.x + 2 * (1 - t) * t * control.x + Math.pow(t, 2) * to.x;
    const y = Math.pow(1 - t, 2) * from.y + 2 * (1 - t) * t * control.y + Math.pow(t, 2) * to.y;
    
    return { x, y };
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
    return { text: `متبقي ${remainingDays} أيام`, color: 'text-muted-foreground' };
  };

  const remainingInfo = getRemainingInfo();

  return (
    <div className="w-full bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="h-5 w-5 text-primary" />
            <div>
              <h3 className="font-bold text-foreground text-sm">{route.name}</h3>
              <p className="text-xs text-muted-foreground">{route.nameEn}</p>
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
              className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-1000 ease-linear rounded-full"
              style={{ width: `${progress}%` }}
            />
          </div>
          {remainingInfo && (
            <p className={`text-xs mt-1 text-center ${remainingInfo.color}`}>
              {remainingInfo.text}
            </p>
          )}
          {shippingDurationDays && (
            <p className="text-[10px] text-muted-foreground text-center mt-0.5">
              مدة الشحن: {shippingDurationDays} يوم
            </p>
          )}
        </div>
      )}

      {/* Map SVG */}
      <div className="relative p-4">
        <svg viewBox="0 0 100 70" className="w-full h-auto" style={{ minHeight: '200px' }}>
          <defs>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.25" />
            </linearGradient>
            <linearGradient id="routeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
              <stop offset="0%" stopColor="hsl(var(--primary))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
            <filter id="glow">
              <feGaussianBlur stdDeviation="1" result="coloredBlur"/>
              <feMerge>
                <feMergeNode in="coloredBlur"/>
                <feMergeNode in="SourceGraphic"/>
              </feMerge>
            </filter>
          </defs>

          {/* Ocean background */}
          <rect x="0" y="0" width="100" height="70" fill="url(#oceanGradient)" />

          {/* Simplified land masses */}
          <path 
            d="M 70 25 Q 85 20 95 25 L 95 50 Q 90 55 80 52 Q 75 48 70 45 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />
          
          <path 
            d="M 35 30 Q 50 28 55 35 Q 55 50 50 55 Q 40 52 35 48 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />

          <path 
            d="M 58 40 Q 68 38 72 45 Q 70 58 62 60 Q 56 55 58 40 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />

          {/* Route path - full dashed background */}
          <path 
            d={route.path} 
            fill="none" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth="0.8" 
            strokeDasharray="2,2"
            opacity="0.3"
          />

          {/* Route path - completed portion */}
          {isShipped && (
            <path 
              d={route.path} 
              fill="none" 
              stroke="url(#routeGradient)"
              strokeWidth="1.5" 
              strokeLinecap="round"
              strokeDasharray="200"
              strokeDashoffset={200 - (progress * 2)}
              filter="url(#glow)"
              opacity="0.9"
            />
          )}

          {/* Origin marker */}
          <g>
            <circle 
              cx={route.from.x} 
              cy={route.from.y} 
              r="3" 
              fill="hsl(var(--primary))" 
              stroke="white" 
              strokeWidth="1"
              filter="url(#glow)"
            />
            <circle 
              cx={route.from.x} 
              cy={route.from.y} 
              r="5" 
              fill="none" 
              stroke="hsl(var(--primary))" 
              strokeWidth="0.5"
              opacity="0.5"
            >
              <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" />
              <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" />
            </circle>
          </g>

          {/* Destination marker */}
          <g>
            <circle 
              cx={route.to.x} 
              cy={route.to.y} 
              r="3" 
              fill="hsl(var(--accent))" 
              stroke="white" 
              strokeWidth="1"
              filter="url(#glow)"
            />
            {progress < 100 && (
              <circle 
                cx={route.to.x} 
                cy={route.to.y} 
                r="5" 
                fill="none" 
                stroke="hsl(var(--accent))" 
                strokeWidth="0.5"
                opacity="0.5"
              >
                <animate attributeName="r" values="3;6;3" dur="2s" repeatCount="indefinite" begin="1s" />
                <animate attributeName="opacity" values="0.5;0;0.5" dur="2s" repeatCount="indefinite" begin="1s" />
              </circle>
            )}
          </g>

          {/* Labels */}
          <text x={route.from.x} y={route.from.y - 6} textAnchor="middle" className="fill-foreground text-[2.5px] font-bold">
            الصين
          </text>
          <text x={route.to.x} y={route.to.y - 6} textAnchor="middle" className="fill-foreground text-[2.5px] font-bold">
            العراق
          </text>
        </svg>

        {/* Floating icon */}
        {isShipped && (
          <div 
            className="absolute transition-all duration-1000 ease-linear"
            style={{
              left: `${iconPosition.x}%`,
              top: `${iconPosition.y + 15}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="p-2 bg-primary rounded-full shadow-lg shadow-primary/30">
              <Icon className="h-5 w-5 text-primary-foreground" />
            </div>
          </div>
        )}

        {/* Completed badge */}
        {progress >= 100 && (
          <div className="absolute top-4 left-4 bg-green-500 text-white px-3 py-1 rounded-full text-xs font-bold animate-scale-in">
            ✓ تم الوصول
          </div>
        )}
      </div>

      {/* Route details */}
      <div className="px-4 pb-4">
        <div className="flex items-center justify-between text-xs">
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-primary mx-auto mb-1"></div>
            <p className="font-bold text-foreground">{route.from.name}</p>
            <p className="text-muted-foreground text-[10px]">{route.from.nameEn}</p>
          </div>
          
          <div className="flex-1 mx-4 flex items-center">
            <div className="flex-1 h-0.5 bg-gradient-to-r from-primary to-accent opacity-50"></div>
            <Icon className="h-4 w-4 mx-2 text-primary" />
            <div className="flex-1 h-0.5 bg-gradient-to-r from-accent to-primary opacity-50"></div>
          </div>
          
          <div className="text-center">
            <div className="w-3 h-3 rounded-full bg-accent mx-auto mb-1"></div>
            <p className="font-bold text-foreground">{route.to.name}</p>
            <p className="text-muted-foreground text-[10px]">{route.to.nameEn}</p>
          </div>
        </div>
      </div>
    </div>
  );
};
