import { Ship, Plane } from 'lucide-react';
import { useState, useEffect } from 'react';

interface ShippingRouteMapProps {
  routeType: 'sea_guangzhou_umm_qasr' | 'air_guangzhou_erbil' | null;
  isShipped?: boolean;
}

export const ShippingRouteMap = ({ routeType, isShipped = false }: ShippingRouteMapProps) => {
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    if (isShipped) {
      const interval = setInterval(() => {
        setProgress(prev => {
          if (prev >= 100) return 0;
          return prev + 0.5;
        });
      }, 50);
      return () => clearInterval(interval);
    }
  }, [isShipped]);

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
      // Sea route waypoints (curved path through South China Sea, Indian Ocean, Persian Gulf)
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
      // Air route (more direct line)
      path: 'M 85 40 Q 65 32 45 38',
      color: 'hsl(var(--accent))',
      icon: Plane,
    },
  };

  const route = routes[routeType];
  const Icon = route.icon;

  // Calculate position along path for animation
  const getPositionOnPath = (t: number) => {
    // Simple quadratic bezier interpolation
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

  return (
    <div className="w-full bg-gradient-to-br from-primary/5 to-accent/5 rounded-xl border border-primary/20 overflow-hidden">
      {/* Header */}
      <div className="bg-primary/10 px-4 py-3 border-b border-primary/20">
        <div className="flex items-center gap-2">
          <Icon className="h-5 w-5 text-primary" />
          <div>
            <h3 className="font-bold text-foreground text-sm">{route.name}</h3>
            <p className="text-xs text-muted-foreground">{route.nameEn}</p>
          </div>
        </div>
      </div>

      {/* Map SVG */}
      <div className="relative p-4">
        <svg viewBox="0 0 100 70" className="w-full h-auto" style={{ minHeight: '200px' }}>
          {/* Simple world map background - Asia/Middle East region */}
          <defs>
            <linearGradient id="oceanGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.05" />
              <stop offset="100%" stopColor="hsl(var(--accent))" stopOpacity="0.1" />
            </linearGradient>
            <linearGradient id="landGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.15" />
              <stop offset="100%" stopColor="hsl(var(--muted-foreground))" stopOpacity="0.25" />
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
          {/* China */}
          <path 
            d="M 70 25 Q 85 20 95 25 L 95 50 Q 90 55 80 52 Q 75 48 70 45 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />
          
          {/* Middle East / Iraq */}
          <path 
            d="M 35 30 Q 50 28 55 35 Q 55 50 50 55 Q 40 52 35 48 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />

          {/* India */}
          <path 
            d="M 58 40 Q 68 38 72 45 Q 70 58 62 60 Q 56 55 58 40 Z" 
            fill="url(#landGradient)" 
            stroke="hsl(var(--border))" 
            strokeWidth="0.3"
          />

          {/* Route path - dashed background */}
          <path 
            d={route.path} 
            fill="none" 
            stroke="hsl(var(--muted-foreground))" 
            strokeWidth="0.5" 
            strokeDasharray="2,2"
            opacity="0.3"
          />

          {/* Route path - animated */}
          <path 
            d={route.path} 
            fill="none" 
            stroke={route.color}
            strokeWidth="1.5" 
            strokeLinecap="round"
            strokeDasharray={isShipped ? "200" : "3,3"}
            strokeDashoffset={isShipped ? 200 - (progress * 2) : 0}
            filter="url(#glow)"
            opacity="0.8"
          />

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
              <animate 
                attributeName="r" 
                values="3;6;3" 
                dur="2s" 
                repeatCount="indefinite"
              />
              <animate 
                attributeName="opacity" 
                values="0.5;0;0.5" 
                dur="2s" 
                repeatCount="indefinite"
              />
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
            <circle 
              cx={route.to.x} 
              cy={route.to.y} 
              r="5" 
              fill="none" 
              stroke="hsl(var(--accent))" 
              strokeWidth="0.5"
              opacity="0.5"
            >
              <animate 
                attributeName="r" 
                values="3;6;3" 
                dur="2s" 
                repeatCount="indefinite"
                begin="1s"
              />
              <animate 
                attributeName="opacity" 
                values="0.5;0;0.5" 
                dur="2s" 
                repeatCount="indefinite"
                begin="1s"
              />
            </circle>
          </g>

          {/* Moving icon */}
          {isShipped && (
            <g transform={`translate(${iconPosition.x - 2}, ${iconPosition.y - 2})`}>
              <circle r="3" cx="2" cy="2" fill="white" filter="url(#glow)" />
            </g>
          )}

          {/* Labels */}
          <text 
            x={route.from.x} 
            y={route.from.y - 6} 
            textAnchor="middle" 
            className="fill-foreground text-[2.5px] font-bold"
          >
            الصين
          </text>
          <text 
            x={route.to.x} 
            y={route.to.y - 6} 
            textAnchor="middle" 
            className="fill-foreground text-[2.5px] font-bold"
          >
            العراق
          </text>
        </svg>

        {/* Floating icon animation */}
        {isShipped && (
          <div 
            className="absolute transition-all duration-100 ease-linear"
            style={{
              left: `${iconPosition.x}%`,
              top: `${iconPosition.y + 15}%`,
              transform: 'translate(-50%, -50%)',
            }}
          >
            <div className="p-1.5 bg-primary rounded-full shadow-lg animate-bounce">
              <Icon className="h-4 w-4 text-primary-foreground" />
            </div>
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
