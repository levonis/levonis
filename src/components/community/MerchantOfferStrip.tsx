import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Star,
  Clock,
  Send,
  CheckCircle,
  Edit3,
  ExternalLink,
  ShieldCheck,
  Lock,
  Eye,
  Scale,
  Users,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import AcceptOfferDialog from "./AcceptOfferDialog";
import EditOfferDialog from "./EditOfferDialog";

interface MerchantOffer {
  id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  grams: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  edit_count?: number;
  offer_sent_at?: string | null;
  merchant?: {
    id?: string;
    display_name: string | null;
    store_image_url: string | null;
    badge_tier?: string | null;
    is_verified?: boolean;
    followers_count?: number;
  } | null;
  rating?: {
    average_rating: number;
    total_ratings: number;
  } | null;
}

interface MerchantOfferStripProps {
  offer: MerchantOffer;
  isOwner: boolean;
  isAccepted: boolean;
  isBestPrice?: boolean;
  requestId: string;
  customerId: string;
  onRefetch?: () => void;
}

const BADGE_CONFIG: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "bg-amber-700/30", text: "text-amber-400" },
  silver: { bg: "bg-slate-400/30", text: "text-slate-300" },
  gold: { bg: "bg-yellow-500/30", text: "text-yellow-400" },
  platinum: { bg: "bg-violet-500/30", text: "text-violet-300" },
  diamond: { bg: "bg-cyan-400/30", text: "text-cyan-300" },
  emerald: { bg: "bg-emerald-500/30", text: "text-emerald-300" },
};

export default function MerchantOfferStrip({
  offer,
  isOwner,
  isAccepted,
  isBestPrice = false,
  requestId,
  customerId,
  onRefetch,
}: MerchantOfferStripProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const isMerchantOwner = user?.id === offer.trader_id;
  const isCustomer = user?.id === customerId;
  const canEdit = isMerchantOwner && (offer.edit_count ?? 0) < 1 && !isAccepted;
  const hasEdited = (offer.edit_count ?? 0) >= 1;

  const handleMessage = () => {
    const merchantAppId = offer.merchant?.id;
    if (!merchantAppId) {
      toast({ title: "لا يمكن بدء المحادثة", variant: "destructive" });
      return;
    }
    navigate(`/community/messages?merchant_id=${merchantAppId}&request_id=${requestId}`);
  };

  const handleVisitStore = () => {
    const storeId = offer.merchant?.id;
    if (storeId) {
      navigate(`/store/${storeId}`);
    } else {
      toast({ title: "لا يمكن العثور على المتجر", variant: "destructive" });
    }
  };

  const merchantName = offer.merchant?.display_name || "تاجر";
  const badgeTier = offer.merchant?.badge_tier;
  const badgeConfig = badgeTier ? BADGE_CONFIG[badgeTier] : null;
  const followersCount = offer.merchant?.followers_count || 0;

  return (
    <>
      <div
        className={`relative rounded-xl border overflow-hidden transition-all ${
          isAccepted
            ? "bg-gradient-to-l from-green-500/15 via-green-500/8 to-transparent border-green-500/40"
            : isMerchantOwner
            ? "bg-gradient-to-l from-primary/15 via-primary/8 to-transparent border-primary/50"
            : isBestPrice
            ? "bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30"
            : "bg-[hsl(160_45%_11%)] border-white/5 hover:border-primary/20"
        }`}
      >
        {/* My Offer Label */}
        {isMerchantOwner && (
          <div className="absolute -top-px right-4 px-2.5 py-0.5 rounded-b-md bg-primary text-[9px] font-bold text-white z-10">
            عرضك الخاص
          </div>
        )}

        <div className="flex items-stretch">
          {/* Left: Avatar Section */}
          <div 
            className="shrink-0 w-14 flex items-center justify-center bg-black/20 cursor-pointer hover:bg-black/30 transition-colors"
            onClick={handleVisitStore}
          >
            <Avatar className="h-10 w-10 border-2 border-primary/30">
              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                <Store className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Middle: Info Sections */}
          <div className="flex-1 min-w-0 py-2 px-2.5">
            {/* Top Row: Store Info */}
            <div className="flex items-center gap-1 mb-1 flex-wrap">
              <span 
                className="font-semibold text-[10px] truncate max-w-[80px] cursor-pointer hover:text-primary transition-colors"
                onClick={handleVisitStore}
              >
                {merchantName}
              </span>
              
              {offer.merchant?.is_verified && (
                <ShieldCheck className="h-2.5 w-2.5 text-primary shrink-0" />
              )}
              
              {badgeConfig && (
                <span className={`text-[7px] font-bold px-1 py-0.5 rounded ${badgeConfig.bg} ${badgeConfig.text}`}>
                  {badgeTier}
                </span>
              )}

              {/* Rating - Small */}
              {offer.rating && offer.rating.total_ratings > 0 && (
                <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                  <Star className="h-2 w-2 fill-yellow-500 text-yellow-500" />
                  {offer.rating.average_rating.toFixed(1)}
                </span>
              )}

              {/* Followers - Small */}
              {followersCount > 0 && (
                <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground">
                  <Users className="h-2 w-2" />
                  {followersCount}
                </span>
              )}

              {/* Status Badges */}
              {isBestPrice && !isAccepted && (
                <Badge className="text-[7px] px-1 py-0 h-3 bg-amber-500/20 text-amber-400 border-0 mr-auto">
                  الأفضل
                </Badge>
              )}
              {isAccepted && (
                <Badge className="text-[7px] px-1 py-0 h-3 bg-green-500 text-white border-0 gap-0.5 mr-auto">
                  <CheckCircle className="h-2 w-2" />
                  مقبول
                </Badge>
              )}
            </div>

            {/* Bottom Row: Main Stats */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Price - Primary */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30">
                <span className="font-bold text-xs text-primary">
                  {offer.price_iqd.toLocaleString("ar-IQ")}
                </span>
                <span className="text-[8px] text-primary/70">د.ع</span>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span>{offer.duration_days}ي</span>
              </div>

              {/* Grams if available */}
              {offer.grams && (
                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Scale className="h-2.5 w-2.5" />
                  <span>{offer.grams}g</span>
                </div>
              )}
            </div>
          </div>

          {/* Right: Actions Section */}
          <div className="shrink-0 flex items-center gap-1 px-2 border-r border-white/5">
            {/* Notes Tooltip */}
            {offer.notes && (
              <TooltipProvider delayDuration={200}>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-amber-400 hover:bg-amber-500/10 transition-colors">
                      <Eye className="h-3 w-3" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent 
                    side="top" 
                    className="max-w-[180px] text-[10px] bg-card border-border p-2"
                  >
                    <p className="text-muted-foreground">{offer.notes}</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}

            {/* Message Button */}
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-primary/70 hover:text-primary hover:bg-primary/10 transition-colors"
              onClick={handleMessage}
              title="مراسلة"
            >
              <Send className="h-3 w-3" />
            </button>

            {/* Visit Store Button */}
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-white/5 transition-colors"
              onClick={handleVisitStore}
              title="زيارة المتجر"
            >
              <ExternalLink className="h-3 w-3" />
            </button>

            {/* Customer: Accept Button */}
            {isCustomer && !isAccepted && (
              <Button
                size="sm"
                className="h-6 px-2 text-[9px] font-bold bg-green-600 hover:bg-green-700 text-white"
                onClick={() => setShowAcceptDialog(true)}
              >
                قبول
              </Button>
            )}

            {/* Merchant: Edit/Lock Button - 3 States */}
            {isMerchantOwner && !isAccepted && (
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-1.5 text-[9px] gap-0.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => setShowEditDialog(true)}
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  تعديل
                </Button>
              ) : hasEdited ? (
                <div className="flex items-center gap-0.5 px-1.5 py-1 rounded bg-muted/30 text-[8px] text-muted-foreground">
                  <Lock className="h-2 w-2" />
                  تم التسعير
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>

      {/* Accept Offer Dialog */}
      <AcceptOfferDialog
        open={showAcceptDialog}
        onOpenChange={setShowAcceptDialog}
        offer={{
          ...offer,
          merchant: offer.merchant ? {
            display_name: offer.merchant.display_name,
            store_image_url: offer.merchant.store_image_url,
          } : undefined,
        }}
        requestId={requestId}
      />

      {/* Edit Offer Dialog */}
      {showEditDialog && (
        <EditOfferDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          offerId={offer.id}
          requestId={requestId}
          currentPrice={offer.price_iqd}
          currentDuration={offer.duration_days}
          currentGrams={offer.grams}
          currentNotes={offer.notes}
          editCount={offer.edit_count ?? 0}
          onSuccess={() => {
            setShowEditDialog(false);
            onRefetch?.();
          }}
        />
      )}
    </>
  );
}
