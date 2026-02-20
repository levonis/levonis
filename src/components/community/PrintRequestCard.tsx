import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Palette,
  Ruler,
  Clock,
  MessageSquare,
  DollarSign,
  Layers,
  Eye,
  MapPin,
  Hash,
  Plus,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
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
  payment_method?: string;
  customer_governorate?: string;
}

interface PrintRequestCardProps {
  request: PrintRequest;
  onViewDetails: (request: PrintRequest) => void;
  onAddOffer?: (request: PrintRequest) => void;
  isMerchant?: boolean;
  merchantId?: string;
}

const MATERIAL_CONFIG: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت", color: "bg-blue-600/40 text-blue-200" },
  resin: { label: "رزن", color: "bg-purple-600/40 text-purple-200" },
  both: { label: "كلاهما", color: "bg-emerald-600/40 text-emerald-200" },
  any: { label: "أي نوع", color: "bg-slate-600/40 text-slate-200" },
};

export default function PrintRequestCard({
  request,
  onViewDetails,
  onAddOffer,
  isMerchant = false,
  merchantId,
}: PrintRequestCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if merchant already has an offer on this request
  const { data: existingOffer } = useQuery({
    queryKey: ["my-offer-on-request", request.id, merchantId],
    enabled: isMerchant && !!merchantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("print_offers")
        .select("id, price_iqd, duration_days, status")
        .eq("request_id", request.id)
        .eq("trader_id", merchantId!)
        .maybeSingle();
      return data;
    },
  });

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

  const mainImage = request.images?.[0] || request.image_url;
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_CONFIG[request.material_type] : null;
  
  const timeDiff = Date.now() - new Date(request.created_at).getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);
  const timeLabel = daysAgo > 0 ? `${daysAgo} يوم` : hoursAgo > 0 ? `${hoursAgo} ساعة` : "الآن";

  return (
    <div className="group relative rounded-xl border border-border/50 bg-gradient-to-b from-card to-background overflow-hidden hover:border-primary/40 hover:shadow-lg transition-all duration-300">
      {/* Image Section - compact */}
      <div className="relative aspect-[3/2] overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={request.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-muted/50 to-muted flex items-center justify-center">
            <Package className="h-8 w-8 text-muted-foreground/20" />
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
        
        {isAccepted && (
          <Badge className="absolute top-1.5 right-1.5 bg-green-500 text-white border-0 text-[8px] h-5">
            تم القبول
          </Badge>
        )}
        
        {material && (
          <Badge className={`absolute top-1.5 left-1.5 text-[8px] h-5 ${material.color} border-0`}>
            {material.label}
          </Badge>
        )}

        <div className="absolute bottom-0 left-0 right-0 p-1.5">
          <div className="flex items-center justify-between text-white">
            {request.customer_governorate && (
              <span className="flex items-center gap-0.5 text-[8px] bg-black/40 px-1 py-0.5 rounded">
                <MapPin className="h-2 w-2" />
                {request.customer_governorate}
              </span>
            )}
            <span className="flex items-center gap-0.5 text-[8px] bg-black/40 px-1 py-0.5 rounded">
              <Clock className="h-2 w-2" />
              {timeLabel}
            </span>
          </div>
        </div>
      </div>

      {/* Content - compact */}
      <div className="p-2 space-y-1.5">
        <h3 className="font-bold text-xs line-clamp-1">{request.title}</h3>
        
        <p className="text-[10px] text-muted-foreground line-clamp-1 leading-relaxed">
          {request.description}
        </p>

        <div className="flex flex-wrap gap-1">
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
            <Ruler className="h-2 w-2" />
            {request.size}
          </span>
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-muted/50 px-1 py-0.5 rounded">
            <Palette className="h-2 w-2" />
            {request.colors}
          </span>
          {request.quantity && request.quantity > 1 && (
            <span className="inline-flex items-center gap-0.5 text-[8px] text-cyan-300 bg-cyan-600/30 px-1 py-0.5 rounded">
              <Hash className="h-2 w-2" />
              {request.quantity}×
            </span>
          )}
        </div>

        <div className="flex items-center justify-between pt-1 border-t border-border/30">
          <span className="text-[9px] text-primary flex items-center gap-0.5 font-medium">
            <DollarSign className="h-2.5 w-2.5" />
            {offersCount} عرض
          </span>
        </div>

        <div className="flex gap-1.5">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-[9px] h-6 border-border/50"
            onClick={() => onViewDetails(request)}
          >
            <Eye className="h-2.5 w-2.5 ml-0.5" />
            التفاصيل
          </Button>

          {isMerchant && !isOwner && !isAccepted && (
            existingOffer ? (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-[9px] h-6 bg-primary/20 text-primary"
                onClick={() => onViewDetails(request)}
              >
                <DollarSign className="h-2.5 w-2.5 ml-0.5" />
                {existingOffer.price_iqd.toLocaleString()}
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 text-[9px] h-6 bg-gradient-to-b from-primary to-accent"
                onClick={() => onAddOffer?.(request)}
              >
                <Plus className="h-2.5 w-2.5 ml-0.5" />
                تسعير
              </Button>
            )
          )}

          {(isOwner || !isMerchant) && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-[9px] h-6 bg-muted/50"
              onClick={() => navigate(`/community/messages?request=${request.id}`)}
            >
              <MessageSquare className="h-2.5 w-2.5 ml-0.5" />
              المحادثات
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
