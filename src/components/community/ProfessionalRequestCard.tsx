import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package,
  Palette,
  Ruler,
  DollarSign,
  Layers,
  Eye,
  MapPin,
  Hash,
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
  customer_governorate?: string;
}

interface ProfessionalRequestCardProps {
  request: PrintRequest;
  onViewDetails: (request: PrintRequest) => void;
  onAddOffer?: (request: PrintRequest) => void;
  isMerchant?: boolean;
  merchantId?: string;
}

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت", color: "bg-blue-500/20 text-blue-600" },
  resin: { label: "رزن", color: "bg-purple-500/20 text-purple-600" },
  both: { label: "كلاهما", color: "bg-emerald-500/20 text-emerald-600" },
  any: { label: "أي نوع", color: "bg-muted text-muted-foreground" },
};

export default function ProfessionalRequestCard({
  request,
  onViewDetails,
  onAddOffer,
  isMerchant = false,
  merchantId,
}: ProfessionalRequestCardProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  // Check if merchant already has an offer
  const { data: existingOffer } = useQuery({
    queryKey: ["my-offer-on-request", request.id, merchantId],
    enabled: isMerchant && !!merchantId,
    queryFn: async () => {
      const { data } = await supabase
        .from("print_offers")
        .select("id, price_iqd, status")
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
  const material = request.material_type ? MATERIAL_LABELS[request.material_type] : null;

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 hover:shadow-md transition-all duration-200">
      {/* Image */}
      <div className="relative aspect-[4/3] overflow-hidden bg-muted">
        {mainImage ? (
          <img
            src={mainImage}
            alt={request.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="h-10 w-10 text-muted-foreground/30" />
          </div>
        )}
        
        {/* Badges - Top */}
        <div className="absolute top-2 right-2 left-2 flex items-start justify-between">
          {material && (
            <Badge className={`text-[10px] gap-1 ${material.color}`}>
              <Layers className="h-3 w-3" />
              {material.label}
            </Badge>
          )}
          {isAccepted && (
            <Badge className="bg-emerald-500 text-white text-[10px]">تم القبول</Badge>
          )}
        </div>

        {/* Offers Count - Bottom Left */}
        <div className="absolute bottom-2 left-2">
          <Badge variant="secondary" className="bg-background/80 backdrop-blur-sm text-[10px] gap-1">
            <DollarSign className="h-3 w-3" />
            {offersCount} عرض
          </Badge>
        </div>
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-bold text-sm line-clamp-1">{request.title}</h3>
        
        {/* Quick Info */}
        <div className="flex flex-wrap gap-1.5">
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            <Ruler className="h-3 w-3" />
            {request.size}
          </span>
          <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
            <Palette className="h-3 w-3" />
            {request.colors}
          </span>
          {request.quantity && request.quantity > 1 && (
            <span className="inline-flex items-center gap-1 text-[10px] text-muted-foreground bg-muted/50 px-1.5 py-0.5 rounded">
              <Hash className="h-3 w-3" />
              {request.quantity}×
            </span>
          )}
        </div>

        {/* Location & Date */}
        <div className="flex items-center justify-between text-[10px] text-muted-foreground">
          {request.customer_governorate && (
            <span className="flex items-center gap-1 text-primary font-medium">
              <MapPin className="h-3 w-3" />
              {request.customer_governorate}
            </span>
          )}
          <span>{new Date(request.created_at).toLocaleDateString("ar-IQ")}</span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-xs"
            onClick={() => onViewDetails(request)}
          >
            <Eye className="h-3.5 w-3.5 ml-1" />
            التفاصيل
          </Button>

          {isMerchant && !isOwner && !isAccepted && (
            existingOffer ? (
              <Button size="sm" variant="secondary" className="flex-1 h-8 text-xs" disabled>
                {existingOffer.price_iqd?.toLocaleString()} د.ع
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs"
                onClick={() => onAddOffer?.(request)}
              >
                <DollarSign className="h-3.5 w-3.5 ml-1" />
                تسعير
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
