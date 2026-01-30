import { MapPin, ExternalLink, Navigation } from 'lucide-react';
import { cn } from '@/lib/utils';

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
  const mapUrl = `https://www.google.com/maps?q=${location.latitude},${location.longitude}`;
  const staticMapUrl = `https://staticmap.com/img?lat=${location.latitude}&lng=${location.longitude}&zoom=15&size=280x140&apikey=free`;
  
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
          className="block relative h-32 bg-muted overflow-hidden group"
        >
          {/* Simple map placeholder with gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-emerald-100 to-teal-200 dark:from-emerald-900/30 dark:to-teal-800/30" />
          
          {/* Pin icon in center */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="relative">
              <div className="h-12 w-12 rounded-full bg-primary/20 flex items-center justify-center">
                <MapPin className="h-6 w-6 text-primary" />
              </div>
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-3 h-3 bg-primary/30 rounded-full" />
            </div>
          </div>
          
          {/* Hover overlay */}
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
            <div className="bg-white/90 dark:bg-black/80 rounded-full px-3 py-1.5 flex items-center gap-1.5 text-xs font-medium">
              <ExternalLink className="h-3 w-3" />
              فتح في الخريطة
            </div>
          </div>
        </a>

        {/* Content */}
        <div className="p-2.5">
          <div className="flex items-start gap-2">
            <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
              <Navigation className="h-4 w-4 text-primary" />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-semibold text-foreground">📍 موقع جغرافي</p>
              {location.address_name ? (
                <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                  {location.address_name}
                </p>
              ) : (
                <p className="text-[10px] text-muted-foreground mt-0.5">
                  {location.latitude.toFixed(6)}, {location.longitude.toFixed(6)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Timestamp */}
        <div className={cn(
          "px-2.5 pb-1.5 text-[9px] text-muted-foreground",
          isMe ? "text-right" : "text-left"
        )}>
          {timestamp}
        </div>
      </div>
    </div>
  );
}
