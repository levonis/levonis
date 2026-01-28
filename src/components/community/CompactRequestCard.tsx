import { useQuery } from "@tanstack/react-query";
import { Package, Layers, MapPin, DollarSign, Clock, Eye, Plus, Hash, Ruler, Palette } from "lucide-react";

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

const MATERIAL_CONFIG: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت", color: "bg-blue-600/40 text-blue-200" },
  resin: { label: "رزن", color: "bg-purple-600/40 text-purple-200" },
  both: { label: "كلاهما", color: "bg-emerald-600/40 text-emerald-200" },
  any: { label: "أي نوع", color: "bg-slate-600/40 text-slate-200" },
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
  const material = request.material_type ? MATERIAL_CONFIG[request.material_type] : null;
  
  const timeDiff = Date.now() - new Date(request.created_at).getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);
  const timeLabel = daysAgo > 0 ? `${daysAgo} يوم` : hoursAgo > 0 ? `${hoursAgo} ساعة` : "الآن";

  return (
    <div 
      onClick={() => onViewDetails(request)}
      className="group relative rounded-xl border border-border/50 bg-gradient-to-b from-card to-background overflow-hidden hover:border-primary/40 hover:shadow-xl transition-all duration-300 cursor-pointer"
    >
      {/* Image Section */}
      <div className="relative aspect-[4/3] overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={request.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/20" />
          </div>
        )}

        {/* Gradient overlay */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />

        {/* Status overlay */}
        {isAccepted && (
          <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
            <Badge className="bg-green-500 text-white border-0">تم القبول</Badge>
          </div>
        )}

        {/* Top badges row */}
        <div className="absolute top-1.5 left-1.5 right-1.5 flex justify-between items-start">
          {/* Material Badge */}
          {material && (
            <Badge className={`text-[8px] px-1.5 h-4 ${material.color} border-0`}>
              {material.label}
            </Badge>
          )}
          
          {/* Quantity Badge */}
          {request.quantity && request.quantity > 1 && (
            <Badge className="text-[8px] px-1.5 h-4 bg-cyan-600/60 text-white border-0">
              <Hash className="h-2 w-2 ml-0.5" />
              {request.quantity}
            </Badge>
          )}
        </div>

        {/* Bottom info overlay */}
        <div className="absolute bottom-0 left-0 right-0 p-2">
          <div className="flex items-center justify-between text-white">
            {request.customer_governorate && (
              <span className="flex items-center gap-0.5 text-[9px] bg-black/40 px-1.5 py-0.5 rounded">
                <MapPin className="h-2.5 w-2.5" />
                {request.customer_governorate}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[9px] bg-black/40 px-1.5 py-0.5 rounded">
              <Clock className="h-2.5 w-2.5" />
              {timeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Content Section */}
      <div className="p-2.5 space-y-2">
        {/* Title */}
        <h3 className="font-bold text-xs line-clamp-1 text-foreground">{request.title}</h3>

        {/* Quick Info Tags */}
        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            <Ruler className="h-2 w-2" />
            {request.size}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            <Palette className="h-2 w-2" />
            {request.colors}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 rounded font-medium">
            <DollarSign className="h-2 w-2" />
            {offersCount} عرض
          </span>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5 pt-0.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[10px] h-7 px-2 border-border/50"
            onClick={(e) => { e.stopPropagation(); onViewDetails(request); }}
          >
            <Eye className="h-3 w-3 ml-0.5" />
            التفاصيل
          </Button>

          {isMerchant && !isOwner && !isAccepted && onAddOffer && (
            <Button
              size="sm"
              className="flex-1 text-[10px] h-7 px-2 bg-gradient-to-b from-primary to-accent"
              onClick={(e) => { e.stopPropagation(); onAddOffer(request); }}
            >
              <Plus className="h-3 w-3 ml-0.5" />
              تسعير
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
