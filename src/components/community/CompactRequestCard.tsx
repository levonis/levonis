import { useQuery } from "@tanstack/react-query";
import { Package, Layers, MapPin, DollarSign, Clock, Eye, Plus } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";

interface PrintRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  size: string;
  colors: string;
  material_type: string | null;
  images: string[] | null;
  image_url: string | null;
  status: string;
  created_at: string;
  accepted_offer_id: string | null;
  quantity?: number;
  customer_governorate?: string;
}

interface CompactRequestCardProps {
  request: PrintRequest;
  onViewDetails: (request: PrintRequest) => void;
  onAddOffer?: (request: PrintRequest) => void;
  isMerchant?: boolean;
  isOwner?: boolean;
}

const MATERIAL_LABELS: Record<string, string> = {
  filament: "فلمنت",
  resin: "رزن",
  both: "كلاهما",
  any: "أي نوع",
};

const MATERIAL_COLORS: Record<string, string> = {
  filament: "bg-blue-500/20 text-blue-600 dark:text-blue-400",
  resin: "bg-purple-500/20 text-purple-600 dark:text-purple-400",
  both: "bg-emerald-500/20 text-emerald-600 dark:text-emerald-400",
  any: "bg-muted text-muted-foreground",
};

export default function CompactRequestCard({
  request,
  onViewDetails,
  onAddOffer,
  isMerchant = false,
  isOwner = false,
}: CompactRequestCardProps) {
  // Get offers count
  const { data: offersCount = 0 } = useQuery({
    queryKey: ["offers-count", request.id],
    queryFn: async () => {
      const { count } = await supabase
        .from("print_offers")
        .select("id", { count: "exact", head: true })
        .eq("request_id", request.id);
      return count ?? 0;
    },
  });

  // Check if merchant already has an offer
  const { data: hasMyOffer } = useQuery({
    queryKey: ["has-my-offer", request.id, request.user_id],
    enabled: isMerchant,
    queryFn: async () => {
      const { count } = await supabase
        .from("print_offers")
        .select("id", { count: "exact", head: true })
        .eq("request_id", request.id);
      return (count ?? 0) > 0;
    },
  });

  const mainImage = request.images?.[0] || request.image_url;
  const isAccepted = !!request.accepted_offer_id;
  const materialColor = request.material_type ? MATERIAL_COLORS[request.material_type] : MATERIAL_COLORS.any;
  
  const timeDiff = Date.now() - new Date(request.created_at).getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);
  const timeLabel = daysAgo > 0 ? `${daysAgo} يوم` : hoursAgo > 0 ? `${hoursAgo} ساعة` : "الآن";

  return (
    <div 
      onClick={() => onViewDetails(request)}
      className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-200 cursor-pointer"
    >
      {/* Compact Image */}
      <div className="relative aspect-[3/2] overflow-hidden bg-gradient-to-br from-muted/50 to-muted">
        {mainImage ? (
          <img
            src={mainImage}
            alt={request.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/30" />
          </div>
        )}

        {/* Status overlay */}
        {isAccepted && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
            <Badge className="bg-green-500 text-white">تم القبول</Badge>
          </div>
        )}

        {/* Material Badge - top left */}
        {request.material_type && (
          <Badge 
            className={`absolute top-1.5 left-1.5 text-[9px] px-1.5 h-5 ${materialColor}`}
          >
            {MATERIAL_LABELS[request.material_type]}
          </Badge>
        )}

        {/* Quantity Badge - top right */}
        {request.quantity && request.quantity > 1 && (
          <Badge className="absolute top-1.5 right-1.5 text-[9px] px-1.5 h-5 bg-primary/90">
            {request.quantity}×
          </Badge>
        )}

        {/* Time Badge - bottom right */}
        <div className="absolute bottom-1.5 right-1.5 text-[9px] px-1.5 py-0.5 rounded bg-black/60 text-white flex items-center gap-1">
          <Clock className="h-2.5 w-2.5" />
          {timeLabel}
        </div>
      </div>

      {/* Compact Content */}
      <div className="p-2 space-y-1.5">
        {/* Title */}
        <h3 className="font-bold text-[11px] line-clamp-1 leading-tight">{request.title}</h3>

        {/* Quick Info Row */}
        <div className="flex items-center gap-2 text-[9px] text-muted-foreground">
          {request.customer_governorate && (
            <span className="flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5 text-primary" />
              {request.customer_governorate}
            </span>
          )}
          <span className="flex items-center gap-0.5">
            <DollarSign className="h-2.5 w-2.5" />
            {offersCount} عرض
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1 pt-1">
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-[10px] h-6 px-2"
            onClick={(e) => { e.stopPropagation(); onViewDetails(request); }}
          >
            <Eye className="h-3 w-3 ml-0.5" />
            عرض
          </Button>

          {isMerchant && !isOwner && !isAccepted && onAddOffer && (
            <Button
              size="sm"
              className="flex-1 text-[10px] h-6 px-2 bg-gradient-to-b from-primary to-accent"
              onClick={(e) => { e.stopPropagation(); onAddOffer(request); }}
            >
              <Plus className="h-3 w-3 ml-0.5" />
              سعّر
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
