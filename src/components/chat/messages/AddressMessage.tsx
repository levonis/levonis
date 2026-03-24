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
  const [copiedAll, setCopiedAll] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);
  
  const fullAddress = [
    address.governorate,
    address.area,
    address.neighborhood,
    address.nearest_landmark ? `قرب ${address.nearest_landmark}` : null,
  ].filter(Boolean).join(' - ');
  
  const handleCopyAll = () => {
    const text = `${address.full_name}\n${address.phone_number}\n${fullAddress}${address.additional_notes ? `\nملاحظات: ${address.additional_notes}` : ''}`;
    navigator.clipboard.writeText(text);
    setCopiedAll(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopiedAll(false), 2000);
  };

  const handleCopyField = (field: string, value: string) => {
    navigator.clipboard.writeText(value);
    setCopiedField(field);
    toast.success('تم النسخ');
    setTimeout(() => setCopiedField(null), 1500);
  };

  const CopyBtn = ({ field, value }: { field: string; value: string }) => (
    <button
      onClick={(e) => { e.stopPropagation(); handleCopyField(field, value); }}
      className="h-5 w-5 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors shrink-0 opacity-60 hover:opacity-100"
      title="نسخ"
    >
      {copiedField === field ? (
        <CheckCheck className="h-3 w-3 text-green-500" />
      ) : (
        <Copy className="h-3 w-3 text-muted-foreground" />
      )}
    </button>
  );
  
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
            onClick={handleCopyAll}
            className="h-6 w-6 rounded-full flex items-center justify-center hover:bg-primary/10 transition-colors"
            title="نسخ الكل"
          >
            {copiedAll ? (
              <CheckCheck className="h-3.5 w-3.5 text-green-500" />
            ) : (
              <Copy className="h-3.5 w-3.5 text-muted-foreground" />
            )}
          </button>
        </div>

        {/* Content */}
        <div className="p-3 space-y-2">
          {/* Name */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2 min-w-0">
              <User className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-sm font-semibold truncate">{address.full_name}</span>
            </div>
            <CopyBtn field="name" value={address.full_name} />
          </div>
          
          {/* Phone */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2 min-w-0">
              <Phone className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <a href={`tel:${address.phone_number}`} className="text-xs text-primary hover:underline" dir="ltr">
                {address.phone_number}
              </a>
            </div>
            <CopyBtn field="phone" value={address.phone_number} />
          </div>
          
          {/* Governorate & Area */}
          <div className="flex items-center justify-between gap-1">
            <div className="flex items-center gap-2 min-w-0">
              <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <span className="text-xs text-foreground/80">{address.governorate} - {address.area}</span>
            </div>
            <CopyBtn field="gov" value={`${address.governorate} - ${address.area}`} />
          </div>

          {/* Neighborhood */}
          {address.neighborhood && (
            <div className="flex items-center justify-between gap-1 pr-5">
              <span className="text-xs text-foreground/70">الحي: {address.neighborhood}</span>
              <CopyBtn field="neighborhood" value={address.neighborhood} />
            </div>
          )}

          {/* Nearest Landmark */}
          {address.nearest_landmark && (
            <div className="flex items-center justify-between gap-1 pr-5">
              <span className="text-xs text-foreground/70">أقرب نقطة دالة: {address.nearest_landmark}</span>
              <CopyBtn field="landmark" value={address.nearest_landmark} />
            </div>
          )}
          
          {/* Notes */}
          {address.additional_notes && (
            <div className="flex items-center justify-between gap-1 pt-1 border-t border-border/50">
              <p className="text-[11px] text-muted-foreground">📝 {address.additional_notes}</p>
              <CopyBtn field="notes" value={address.additional_notes} />
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
