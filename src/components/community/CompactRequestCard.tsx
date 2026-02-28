import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { 
  Package, Layers, MapPin, DollarSign, Clock, Hash, 
  Ruler, MessageSquare, CheckCircle2, Tag, Edit3, Lock, User
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SocialActions from "@/components/community/SocialActions";
import { useLanguage } from "@/lib/i18n";

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

const MATERIAL_CONFIG_STATIC: Record<string, { labelKey: string; fallback: string; color: string; bg: string }> = {
  filament: { labelKey: "", fallback: "FDM", color: "text-blue-300", bg: "bg-blue-500/20" },
  resin: { labelKey: "", fallback: "SLA", color: "text-purple-300", bg: "bg-purple-500/20" },
  both: { labelKey: "community_material_all", fallback: "الكل", color: "text-emerald-300", bg: "bg-emerald-500/20" },
  any: { labelKey: "community_material_any", fallback: "أي", color: "text-slate-300", bg: "bg-slate-500/20" },
};

export default function CompactRequestCard({
  request,
  onViewDetails,
  onAddOffer,
  isMerchant = false,
  isOwner = false,
}: CompactRequestCardProps) {
  const navigate = useNavigate();
  const { t } = useLanguage();

  // Fetch customer profile info
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile-compact", request.user_id],
    queryFn: async () => {
      // Try profiles table first
      const { data: profile } = await supabase
        .from("profiles_public")
        .select("full_name, avatar_url, username")
        .eq("id", request.user_id)
        .maybeSingle();
      if (profile?.full_name || profile?.username) return profile;
      
      // Fallback to community_customer_profiles_public (protects personal info)
      const { data: communityProfile } = await supabase
        .from("community_customer_profiles_public")
        .select("display_name, avatar_url")
        .eq("user_id", request.user_id)
        .maybeSingle();
      if (communityProfile) {
        return {
          full_name: communityProfile.display_name,
          avatar_url: communityProfile.avatar_url,
          username: null,
        };
      }
      return profile;
    },
  });

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

  // Check if merchant already has an offer - includes edit_count for state tracking
  const { data: myOffer } = useQuery({
    queryKey: ["my-offer-check", request.id, isMerchant],
    enabled: isMerchant && !isOwner,
    queryFn: async () => {
      // Get current user's merchant ID from auth
      const { data: { user } } = await supabase.auth.getUser();
      if (!user?.id) return null;
      
      const { data } = await supabase
        .from("print_offers")
        .select("id, price_iqd, edit_count")
        .eq("request_id", request.id)
        .eq("trader_id", user.id)
        .maybeSingle();
      return data;
    },
  });

  const mainImage = request.images?.[0] || request.image_url;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_CONFIG_STATIC[request.material_type] : null;
  const materialLabel = material ? (material.labelKey ? t(material.labelKey as any) : material.fallback) : null;
  const offersCount = offersData?.count ?? 0;
  const lowestPrice = offersData?.lowestPrice;
  
  const timeDiff = Date.now() - new Date(request.created_at).getTime();
  const hoursAgo = Math.floor(timeDiff / (1000 * 60 * 60));
  const daysAgo = Math.floor(hoursAgo / 24);
  const timeLabel = daysAgo > 0 ? `${daysAgo}${t('community_time_day')}` : hoursAgo > 0 ? `${hoursAgo}${t('community_time_hour')}` : t('community_new_label');

  const handleChat = (e: React.MouseEvent) => {
    e.stopPropagation();
    // Use request_id context so the conversation shows request details
    navigate(`/chats?user_id=${request.user_id}&request_id=${request.id}`);
  };

  const handlePrice = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddOffer?.(request);
  };

  return (
    <div 
      onClick={() => onViewDetails(request)}
      className="group relative rounded-2xl border border-border/40 bg-gradient-to-br from-card to-card/80 overflow-hidden hover:border-primary/50 hover:shadow-lg transition-all duration-300 cursor-pointer"
    >
      {/* Professional Diagonal Banner for Accepted Requests */}
      {isAccepted && (
        <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
          {/* Top-right to bottom-left diagonal stripe */}
          <div className="absolute w-[200%] h-7 bg-gradient-to-r from-emerald-600 via-green-500 to-emerald-600 transform -rotate-[35deg] origin-top-right -top-2 -right-4 flex items-center justify-center shadow-[0_2px_8px_rgba(0,0,0,0.3)]">
            <span className="text-[9px] font-black text-white tracking-widest uppercase drop-shadow-sm">{t('community_accepted')}</span>
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
          {material && materialLabel && (
            <span className={`text-[9px] font-bold px-2 py-0.5 rounded-full ${material.bg} ${material.color} backdrop-blur-sm`}>
              {materialLabel}
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
        {/* Customer Info */}
        <div className="flex items-center gap-2 mb-1">
          <Avatar className="h-5 w-5 border border-primary/30">
            <AvatarImage src={customerProfile?.avatar_url || undefined} />
            <AvatarFallback className="bg-primary/20 text-primary text-[8px]">
              <User className="h-3 w-3" />
            </AvatarFallback>
          </Avatar>
          <span className="text-[9px] text-muted-foreground truncate max-w-[80px]">
            {customerProfile?.full_name || customerProfile?.username || t('community_customer')}
          </span>
        </div>

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
                {lowestPrice.toLocaleString()} {t('community_iqd_currency')}
              </span>
            ) : (
              <span className="text-[9px] text-muted-foreground">{t('community_no_offers')}</span>
            )}
          </div>
          <div className="flex items-center gap-2">
            {offersCount > 0 && (
              <span className="text-[9px] text-muted-foreground">
                {t('community_offer_count').replace('{count}', String(offersCount))}
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

        {/* Action Buttons - Compact row */}
        <div className="flex items-center gap-1.5">
          {/* Chat Button - Only show if NOT the owner */}
          {!isOwner && (
            <button
              className="h-7 px-2.5 flex items-center gap-1 rounded-md text-[9px] bg-muted/50 hover:bg-muted text-muted-foreground border border-border/30 transition-colors"
              onClick={handleChat}
            >
              <MessageSquare className="h-3 w-3" />
              {t('community_chat')}
            </button>
          )}

          {/* Owner badge */}
          {isOwner && (
            <span className="h-7 px-2.5 flex items-center gap-1 rounded-md text-[9px] bg-primary/10 text-primary border border-primary/20 font-medium">
              <User className="h-3 w-3" />
              {t('community_your_request')}
            </span>
          )}

          {/* Price Button - ONLY visible for merchants who don't own the request */}
          {isMerchant && !isOwner && !isAccepted && onAddOffer && !myOffer && (
            <button
              className="flex-1 h-7 px-3 flex items-center justify-center gap-1 rounded-md text-[9px] font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 text-primary-foreground shadow-sm transition-all"
              onClick={handlePrice}
            >
              <DollarSign className="h-3 w-3" />
              {t('community_price_it')}
            </button>
          )}
          {isMerchant && !isOwner && !isAccepted && myOffer && (
            (myOffer.edit_count ?? 0) < 1 ? (
              <button
                className="flex-1 h-7 px-2.5 flex items-center justify-center gap-1 rounded-md text-[9px] font-bold bg-amber-500/20 border border-amber-500/40 text-amber-400 hover:bg-amber-500/30 transition-colors"
                onClick={handlePrice}
              >
                <Edit3 className="h-3 w-3" />
                {t('community_edit_price')} ({myOffer.price_iqd.toLocaleString()})
              </button>
            ) : (
              <div
                className="flex-1 flex items-center justify-center gap-1 h-7 px-2 rounded-md bg-muted/30 border border-border text-muted-foreground"
                onClick={(e) => e.stopPropagation()}
              >
                <Lock className="h-2.5 w-2.5" />
                <span className="text-[8px]">{myOffer.price_iqd.toLocaleString()} {t('community_iqd_currency')}</span>
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
