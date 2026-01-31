import { MapPin, ExternalLink, Navigation, Copy, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface LocationData {
  latitude: number;
  longitude: number;
  address_name?: string;
}

interface LocationMessageProps {
  location: LocationData;
  isMe: boolean;
  timestamp: string;
}

export default function LocationMessage({ location, isMe, timestamp }: LocationMessageProps) {
  const [copied, setCopied] = useState(false);
  const [imageError, setImageError] = useState(false);
  
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  
  // OpenStreetMap static image URL
  const osmStaticMapUrl = `https://static-maps.yandex.ru/1.x/?lang=ar_IQ&ll=${location.longitude},${location.latitude}&z=15&l=map&size=280,140&pt=${location.longitude},${location.latitude},pm2rdm`;

  const handleCopyCoords = () => {
    const text = `${location.latitude}, ${location.longitude}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم نسخ الإحداثيات');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={cn("flex my-1.5", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[280px] rounded-xl overflow-hidden shadow-md border",
        isMe ? "bg-primary/10 border-primary/20" : "bg-card border-border"
      )}>
        {/* Map Preview */}
        <a 
          href={mapUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block relative h-36 bg-muted overflow-hidden group"
        >
          {/* Real Map Image or Fallback */}
          {!imageError ? (
            <img 
              src={osmStaticMapUrl}
              alt="موقع على الخريطة"
              className="w-full h-full object-cover"
              onError={() => setImageError(true)}
            />
          ) : (
            <>
              {/* Gradient fallback with grid pattern */}
              <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/30 dark:to-teal-800/30" />
              <div 
                className="absolute inset-0 opacity-20"
                style={{
                  backgroundImage: `
                    linear-gradient(rgba(0,0,0,0.1) 1px, transparent 1px),
                    linear-gradient(90deg, rgba(0,0,0,0.1) 1px, transparent 1px)
                  `,
                  backgroundSize: '20px 20px'
                }}
              />
            </>
          )}
          
          {/* Pin Marker Overlay */}
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="relative">
              <div className="h-10 w-10 rounded-full bg-primary shadow-lg flex items-center justify-center border-2 border-white">
                <MapPin className="h-5 w-5 text-white" />
              </div>
              {/* Pin shadow */}
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-2 bg-black/20 rounded-full blur-sm" />
            </div>
          </div>
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/95 dark:bg-black/90 rounded-full px-4 py-2 flex items-center gap-2 text-sm font-medium shadow-lg">
              <ExternalLink className="h-4 w-4" />
              فتح في الخريطة
            </div>
          </div>
        </a>

        {/* Content */}
        <div className="p-3">
          <div className="flex items-start gap-2.5">
            <div className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Navigation className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-bold text-foreground">📍 موقع جغرافي</p>
                <button
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleCopyCoords();
                  }}
                  className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors"
                  title="نسخ الإحداثيات"
                >
                  {copied ? (
                    <CheckCheck className="h-3.5 w-3.5 text-green-500" />
                  ) : (
                    <Copy className="h-3.5 w-3.5 text-muted-foreground" />
                  )}
                </button>
              </div>
              {location.address_name ? (
                <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2 leading-relaxed">
                  {location.address_name}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-1 font-mono" dir="ltr">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className={cn(
          "px-3 pb-2 text-[9px] text-muted-foreground",
          isMe ? "text-right" : "text-left"
        )}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}
