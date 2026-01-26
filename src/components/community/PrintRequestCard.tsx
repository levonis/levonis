import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Palette,
  Ruler,
  Clock,
  MessageSquare,
  DollarSign,
  Layers,
  Eye,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";

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
}

interface PrintRequestCardProps {
  request: PrintRequest;
  onViewDetails: (request: PrintRequest) => void;
  onAddOffer?: (request: PrintRequest) => void;
  isMerchant?: boolean;
  merchantId?: string;
}

const MATERIAL_LABELS: Record<string, string> = {
  filament: "فلمنت",
  resin: "رزن",
  both: "كلاهما",
  any: "أي نوع",
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

  return (
    <div className="group relative rounded-xl border border-border bg-card overflow-hidden hover:border-primary/40 transition-all duration-200">
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
            <Package className="h-12 w-12 text-muted-foreground/40" />
          </div>
        )}
        
        {/* Status Badge */}
        {isAccepted && (
          <Badge className="absolute top-2 right-2 bg-green-500/90 text-white">
            تم القبول
          </Badge>
        )}
        
        {/* Material Badge */}
        {request.material_type && (
          <Badge 
            variant="secondary" 
            className="absolute top-2 left-2 bg-background/80 backdrop-blur-sm text-xs"
          >
            <Layers className="h-3 w-3 mr-1" />
            {MATERIAL_LABELS[request.material_type] || request.material_type}
          </Badge>
        )}
      </div>

      {/* Content */}
      <div className="p-3 space-y-2">
        <h3 className="font-bold text-sm line-clamp-1">{request.title}</h3>
        
        <p className="text-xs text-muted-foreground line-clamp-2">
          {request.description}
        </p>

        {/* Quick Info */}
        <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
          <span className="flex items-center gap-1">
            <Ruler className="h-3 w-3" />
            {request.size}
          </span>
          <span className="flex items-center gap-1">
            <Palette className="h-3 w-3" />
            {request.colors}
          </span>
        </div>

        {/* Offers Count */}
        <div className="flex items-center justify-between pt-2 border-t border-border/50">
          <span className="text-xs text-muted-foreground flex items-center gap-1">
            <DollarSign className="h-3 w-3" />
            {offersCount} عرض
          </span>
          <span className="text-xs text-muted-foreground">
            {new Date(request.created_at).toLocaleDateString("ar-IQ")}
          </span>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            size="sm"
            variant="outline"
            className="flex-1 text-xs h-8"
            onClick={() => onViewDetails(request)}
          >
            <Eye className="h-3 w-3 ml-1" />
            التفاصيل
          </Button>

          {isMerchant && !isOwner && !isAccepted && (
            existingOffer ? (
              <Button
                size="sm"
                variant="secondary"
                className="flex-1 text-xs h-8"
                disabled
              >
                <DollarSign className="h-3 w-3 ml-1" />
                {existingOffer.price_iqd.toLocaleString()} د.ع
              </Button>
            ) : (
              <Button
                size="sm"
                className="flex-1 text-xs h-8 bg-gradient-to-b from-primary to-accent"
                onClick={() => onAddOffer?.(request)}
              >
                <DollarSign className="h-3 w-3 ml-1" />
                تسعير
              </Button>
            )
          )}

          {(isOwner || !isMerchant) && (
            <Button
              size="sm"
              variant="secondary"
              className="flex-1 text-xs h-8"
              onClick={() => navigate(`/community/messages?request=${request.id}`)}
            >
              <MessageSquare className="h-3 w-3 ml-1" />
              المحادثات
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
