import { Home, Phone, User, MapPin, Copy, CheckCheck } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useState } from 'react';
import { toast } from 'sonner';

interface AddressData {
  id: string;
  full_name: string;
  phone_number: string;
  governorate: string;
  area: string;
  neighborhood?: string;
  nearest_landmark?: string;
  additional_notes?: string;
  is_default: boolean;
}

interface AddressMessageProps {
  address: AddressData;
  isMe: boolean;
  timestamp: string;
}

export default function AddressMessage({ address, isMe, timestamp }: AddressMessageProps) {
  const [copied, setCopied] = useState(false);
  
  const fullAddress = [
    address.governorate,
    address.area,
    address.neighborhood,
    address.nearest_landmark ? `قرب ${address.nearest_landmark}` : null,
  ].filter(Boolean).join(' - ');
  
  const handleCopy = () => {
    const text = `${address.full_name}\n${address.phone_number}\n${fullAddress}${address.additional_notes ? `\nملاحظات: ${address.additional_notes}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopied(false), 2000);
  };
  
  return (
    <div className={cn("flex my-1.5", isMe ? "justify-start" : "justify-end")}>
      <div className={cn(
        "w-[280px] rounded-xl overflow-hidden shadow-md border",
        isMe ? "bg-primary/10 border-primary/20" : "bg-card border-border"
      )}>
        {/* Header */}
        <div className="flex items-center justify-between gap-2 px-3 py-2 bg-gradient-to-l from-primary/15 via-primary/10 to-transparent border-b border-border/50">
          <div className="flex items-center gap-1.5">
            <Home className="h-4 w-4 text-primary" />
            <span className="text-xs font-semibold text-primary">عنوان التوصيل</span>
          </div>
          <button
            onClick={handleCopy}
            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors"
            title="نسخ العنوان"
          >
            {copied ? (
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Name */}
          <div className="flex items-center gap-2">
            <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="text-sm font-semibold">{address.full_name}</span>
          </div>
          
          {/* Phone */}
          <div className="flex items-center gap-2">
            <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <a 
              href={`tel:${address.phone_number}`}
              className="text-xs text-primary hover:underline"
              dir="ltr"
            >
              {address.phone_number}
            </a>
          </div>
          
          {/* Address */}
          <div className="flex items-start gap-2">
            <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0 mt-0.5" />
            <p className="text-xs text-foreground/80 leading-relaxed">
              {fullAddress}
            </p>
          </div>
          
          {/* Notes */}
          {address.additional_notes && (
            <div className="pt-1 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">
                📝 {address.additional_notes}
              </p>
            </div>
          )}
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
