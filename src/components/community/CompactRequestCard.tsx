import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  Package, Layers, MapPin, DollarSign, Clock, Hash, 
  Ruler, MessageSquare, CheckCircle2, Tag
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import SocialActions from "@/components/community/SocialActions";

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

const MATERIAL_CONFIG: Record<string, { label: string; color: string; bg: string }> = {
  filament: { label: "FDM", color: "text-blue-300", bg: "bg-blue-500/20" },
  resin: { label: "SLA", color: "text-purple-300", bg: "bg-purple-500/20" },
  both: { label: "الكل", color: "text-emerald-300", bg: "bg-emerald-500/20" },
  any: { label: "أي", color: "text-slate-300", bg: "bg-slate-500/20" },
};

export default function CompactRequestCard({
  request,
  onViewDetails,
  onAddOffer,
  isMerchant = false,
  isOwner = false,
}: CompactRequestCardProps) {
  const navigate = useNavigate();

  // Get offers count and lowest offer price
  const { data: offersData } = useQuery({
    queryKey: ["offers-summary", request.id],
    queryFn: async () => {
      const { data, count } = await supabase
        .from("print_offers")
        .select("price_iqd, trader_id", { count: "exact" })
        .eq("request_id", request.id)
        .order("price_iqd", { ascending: true })
        .limit(1);
      
      return {
        count: count ?? 0,
        lowestPrice: data?.[0]?.price_iqd || null,
      };
    },
  });

  // Check if merchant already has an offer - need to pass merchantId through hub
  const { data: myOffer } = useQuery({
    queryKey: ["my-offer-check", request.id, isMerchant],
    enabled: isMerchant && !isOwner,
    queryFn: async () => {
      // Get current user's merchant ID from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return null;
      
      const { data } = await supabase
        .from("print_offers")
        .select("id, price_iqd")
        .eq("request_id", request.id)
        .eq("trader_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const mainImage = request.images?.[0] || request.image_url;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_CONFIG[request.material_type] : null;
  const offersCount = offersData?.count ?? 0;
  const lowestPrice = offersData?.lowestPrice;
  
  const timeDiff = Date.now() - new Date(request.created_at).getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);
  const timeLabel = daysAgo > 0 ? `${daysAgo}ي` : hoursAgo > 0 ? `${hoursAgo}س` : "جديد";

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    navigate(`/community/messages?request=${request.id}`);
  };

  const handlePrice = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddOffer?.(request);
  };

  return (
    <div 
      onClick={() => onViewDetails(request)}
      className="group relative rounded-2xl border border-border/40 bg-gradient-to-br from-[hsl(160_52%_16%)] to-[hsl(160_48%_12%)] overflow-hidden hover:border-primary/50 hover:shadow-[0_8px_30px_hsl(160_50%_10%/0.4)] transition-all duration-300 cursor-pointer"
    >
      {/* Diagonal Ribbon for Accepted Requests */}
      {isAccepted && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          <div className="absolute -right-12 top-5 w-40 h-6 bg-gradient-to-r from-green-600 to-emerald-500 transform rotate-45 flex items-center justify-center shadow-lg">
            <span className="text-[9px] font-bold text-white tracking-wide">تم الطلب</span>
          </div>
        </div>
      )}

      {/* Image Section */}
      <div className="relative aspect-[5/4] overflow-hidden">
        {mainImage ? (
          <img
            src={mainImage}
            alt={request.title}
            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700"
            loading="lazy"
          />
        ) : (
          <div className="w-full h-full bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
            <Package className="h-12 w-12 text-primary/30" />
          </div>
        )}

        {/* Overlay gradient */}
        <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

        {/* Accepted overlay */}
        {isAccepted && (
          <div className="absolute inset-0 bg-green-900/50 backdrop-blur-[2px]" />
        )}

        {/* Top row - Material & Time */}
        <div className="absolute top-2 left-2 right-2 flex justify-between items-start">
          {material && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${material.bg} ${material.color} backdrop-blur-sm`}>
              {material.label}
            </span>
          )}
          <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-black/50 text-white/90 backdrop-blur-sm flex items-center gap-0.5">
            <Clock className="h-2.5 w-2.5" />
            {timeLabel}
          </span>
        </div>

        {/* Bottom row - Governorate & Quantity */}
        <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
          {request.customer_governorate && (
            <span className="text-[9px] font-medium px-2 py-0.5 rounded-full bg-primary/80 text-white backdrop-blur-sm flex items-center gap-0.5">
              <MapPin className="h-2.5 w-2.5" />
              {request.customer_governorate}
            </span>
          )}
          {request.quantity && request.quantity > 1 && (
            <span className="text-[9px] font-bold px-2 py-0.5 rounded-full bg-cyan-500/80 text-white backdrop-blur-sm">
              ×{request.quantity}
            </span>
          )}
        </div>
      </div>

      {/* Content Section */}
      <div className="p-2.5 space-y-2">
        {/* Title */}
        <h3 className="font-bold text-[11px] line-clamp-1 text-foreground group-hover:text-primary transition-colors">
          {request.title}
        </h3>

        {/* Specs Row - Governorate & Size */}
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="inline-flex items-center gap-0.5 text-[8px] text-muted-foreground bg-white/5 px-1.5 py-0.5 rounded-md">
            <Ruler className="h-2 w-2" />
            {request.size}
          </span>
          {request.customer_governorate && (
            <span className="inline-flex items-center gap-0.5 text-[8px] text-primary bg-primary/10 px-1.5 py-0.5 rounded-md font-medium">
              <MapPin className="h-2 w-2" />
              {request.customer_governorate}
            </span>
          )}
        </div>

        {/* Lowest Price Display */}
        <div className="flex items-center justify-between py-1.5 border-t border-white/5">
          <div className="flex items-center gap-1.5">
            <Tag className="h-3 w-3 text-emerald-400" />
            {lowestPrice ? (
              <span className="text-[10px] font-bold text-emerald-400">
                {lowestPrice.toLocaleString()} د.ع
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground">لا توجد عروض</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {offersCount > 0 && (
              <span className="text-[9px] text-muted-foreground">
                {offersCount} عرض
              </span>
            )}
            <SocialActions 
              targetType="request" 
              targetId={request.id} 
              showComments={false}
              compact 
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          {/* Chat Button */}
          <Button
            size="sm"
            variant="ghost"
            className="flex-1 text-[9px] h-7 px-2 bg-white/5 hover:bg-white/10 text-muted-foreground"
            onClick={handleChat}
          >
            <MessageSquare className="h-3 w-3 ml-0.5" />
            تواصل
          </Button>

          {/* Price Button - Only for merchants who don't own the request */}
          {isMerchant && !isOwner && !isAccepted && onAddOffer && (
            myOffer ? (
              <div
                className="flex-1 flex items-center justify-center gap-1 text-[9px] h-7 px-2 rounded-md bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
                onClick={(e) => e.stopPropagation()}
              >
                <CheckCircle2 className="h-3 w-3" />
                <span className="font-bold">{(myOffer.price_iqd / 1000).toFixed(0)}k</span>
              </div>
            ) : (
              <Button
                size="sm"
                className="flex-1 text-[9px] h-7 px-3 font-bold bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-600 hover:to-orange-600 text-white shadow-md shadow-amber-500/25"
                onClick={handlePrice}
              >
                <DollarSign className="h-3 w-3 ml-0.5" />
                تسعير
              </Button>
            )
          )}
        </div>
      </div>
    </div>
  );
}
