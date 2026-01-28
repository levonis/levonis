import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Star,
  Clock,
  MessageSquare,
  Send,
  CheckCircle,
  Loader2,
  Edit3,
  ExternalLink,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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

const BADGE_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/80",
  silver: "bg-slate-400/80",
  gold: "bg-yellow-500/80",
  platinum: "bg-violet-500/80",
  diamond: "bg-cyan-400/80",
  emerald: "bg-emerald-500/80",
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
  const qc = useQueryClient();

  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  const isMerchantOwner = user?.id === offer.trader_id;
  const isCustomer = user?.id === customerId;
  const canEdit = isMerchantOwner && (offer.edit_count ?? 0) < 1 && !isAccepted;

  // Navigate to chat with merchant and auto-share request
  const handleMessage = () => {
    const merchantAppId = offer.merchant?.id;
    if (!merchantAppId) {
      toast({ title: "لا يمكن بدء المحادثة", variant: "destructive" });
      return;
    }
    const params = new URLSearchParams();
    params.set("merchant_id", merchantAppId);
    params.set("request_id", requestId);
    navigate(`/community/messages?${params.toString()}`);
  };

  // Navigate to merchant store using merchant.id (merchant_applications.id)
  const handleVisitStore = () => {
    const storeId = offer.merchant?.id;
    if (storeId) {
      navigate(`/store/${storeId}`);
    } else {
      toast({ title: "لا يمكن العثور على المتجر", variant: "destructive" });
    }
  };

  const merchantName = offer.merchant?.display_name || "تاجر";
  const merchantAvatar = offer.merchant?.store_image_url;
  const badgeTier = offer.merchant?.badge_tier;
  const isVerified = offer.merchant?.is_verified;

  return (
    <>
      <div
        className={`flex items-center gap-2 px-3 py-2 rounded-xl transition-all ${
          isAccepted
            ? "bg-gradient-to-r from-green-500/15 to-green-500/5 border border-green-500/40"
            : isBestPrice
            ? "bg-gradient-to-r from-primary/15 to-primary/5 border border-primary/40"
            : "bg-card border border-border hover:border-primary/30"
        }`}
      >
        {/* Avatar */}
        <Avatar 
          className="h-9 w-9 shrink-0 border-2 border-primary/20 cursor-pointer hover:border-primary/40 transition-colors"
          onClick={handleVisitStore}
        >
          <AvatarImage src={merchantAvatar || undefined} />
          <AvatarFallback className="bg-primary/10 text-primary">
            <Store className="h-4 w-4" />
          </AvatarFallback>
        </Avatar>

        {/* Merchant Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5">
            <span 
              className="font-semibold text-xs truncate max-w-[100px] cursor-pointer hover:text-primary transition-colors"
              onClick={handleVisitStore}
            >
              {merchantName}
            </span>
            
            {isVerified && (
              <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
            )}
            
            {badgeTier && BADGE_COLORS[badgeTier] && (
              <Badge className={`text-[8px] px-1 py-0 h-4 ${BADGE_COLORS[badgeTier]} text-white border-0`}>
                {badgeTier}
              </Badge>
            )}
            
            {isBestPrice && !isAccepted && (
              <Badge className="text-[8px] px-1.5 py-0 h-4 bg-primary/20 text-primary border-0">
                الأفضل
              </Badge>
            )}
            
            {isAccepted && (
              <Badge className="text-[8px] px-1.5 py-0 h-4 bg-green-500 text-white border-0 gap-0.5">
                <CheckCircle className="h-2.5 w-2.5" />
                مقبول
              </Badge>
            )}
          </div>
          
          {/* Rating */}
          {offer.rating && offer.rating.total_ratings > 0 && (
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground mt-0.5">
              <Star className="h-2.5 w-2.5 fill-yellow-500 text-yellow-500" />
              <span>{offer.rating.average_rating.toFixed(1)}</span>
              <span className="opacity-60">({offer.rating.total_ratings})</span>
            </div>
          )}
        </div>

        {/* Duration */}
        <div className="flex items-center gap-1 text-[10px] text-muted-foreground shrink-0">
          <Clock className="h-3 w-3" />
          <span>{offer.duration_days} يوم</span>
        </div>

        {/* Price - Full format */}
        <div className="shrink-0 px-2.5 py-1.5 rounded-lg bg-primary/15 border border-primary/30">
          <span className="font-bold text-sm text-primary">
            {offer.price_iqd.toLocaleString("ar-IQ")}
          </span>
          <span className="text-[10px] text-primary/70 mr-1">د.ع</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 shrink-0">
          {/* Chat Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10"
            onClick={handleMessage}
            title="مراسلة التاجر"
          >
            <Send className="h-3.5 w-3.5" />
          </Button>

          {/* Store Button */}
          <Button
            size="icon"
            variant="ghost"
            className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/5"
            onClick={handleVisitStore}
            title="زيارة المتجر"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Button>

          {/* Edit Button - Merchant Owner Only (once) */}
          {canEdit && (
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-amber-500/70 hover:text-amber-500 hover:bg-amber-500/10"
              onClick={() => setShowEditDialog(true)}
              title="تعديل العرض (مرة واحدة)"
            >
              <Edit3 className="h-3.5 w-3.5" />
            </Button>
          )}

          {/* Accept Button - Customer Only */}
          {isCustomer && !isAccepted && (
            <Button
              size="sm"
              className="h-7 px-3 text-[10px] font-bold bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setShowAcceptDialog(true)}
            >
              قبول
            </Button>
          )}
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
            qc.invalidateQueries({ queryKey: ["request-offers", requestId] });
          }}
        />
      )}
    </>
  );
}
