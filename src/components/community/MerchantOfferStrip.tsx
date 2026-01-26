import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Star,
  Clock,
  MessageSquare,
  DollarSign,
  ChevronDown,
  ChevronUp,
  Send,
  CheckCircle,
  Loader2,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import AcceptOfferDialog from "./AcceptOfferDialog";

interface MerchantOffer {
  id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  grams: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  offer_sent_at: string | null;
  merchant?: {
    id: string;
    display_name: string | null;
    store_image_url: string | null;
    badge_tier: string;
  };
  rating?: {
    average_rating: number;
    total_ratings: number;
  };
}

interface MerchantOfferStripProps {
  offer: MerchantOffer;
  isOwner: boolean;
  isAccepted: boolean;
  requestId: string;
  customerId: string;
}

const BADGE_COLORS: Record<string, string> = {
  bronze: "bg-amber-700",
  silver: "bg-gray-400",
  gold: "bg-yellow-500",
  platinum: "bg-violet-500",
  diamond: "bg-cyan-400",
};

export default function MerchantOfferStrip({
  offer,
  isOwner,
  isAccepted,
  requestId,
  customerId,
}: MerchantOfferStripProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const qc = useQueryClient();

  const [showNotes, setShowNotes] = useState(false);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);

  const isMerchantOwner = user?.id === offer.trader_id;
  const isCustomer = user?.id === customerId;

  // Send offer mutation (for merchant to finalize and send to customer)
  const sendOfferMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("print_offers")
        .update({ offer_sent_at: new Date().toISOString() })
        .eq("id", offer.id);

      if (error) throw error;

      // Create notification for customer
      await supabase.from("notifications").insert({
        user_id: customerId,
        title: "عرض جديد على طلبك",
        message: `${offer.merchant?.display_name || "تاجر"} أرسل لك عرض بسعر ${offer.price_iqd.toLocaleString()} د.ع`,
        type: "offer",
      });
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-offers", requestId] });
      toast({ title: "تم إرسال العرض للزبون" });
    },
    onError: (err: any) => {
      toast({
        title: "تعذر إرسال العرض",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  const handleMessage = async () => {
    // Create or get conversation with auto-send request
    navigate(`/community/messages?merchant=${offer.trader_id}&request=${requestId}`);
  };

  return (
    <>
      <div
        className={`rounded-xl border transition-all ${
          isAccepted
            ? "border-green-500 bg-green-500/10"
            : "border-border bg-card hover:border-primary/40"
        }`}
      >
        <div className="p-3 space-y-3">
          {/* Header: Store Info */}
          <div className="flex items-center gap-3">
            <Avatar className="h-10 w-10 border-2 border-primary/20">
              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
              <AvatarFallback className="bg-primary/10">
                <Store className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <p className="font-semibold text-sm truncate">
                  {offer.merchant?.display_name || "متجر"}
                </p>
                {offer.merchant?.badge_tier && (
                  <Badge
                    className={`text-[10px] px-1.5 py-0 h-4 ${
                      BADGE_COLORS[offer.merchant.badge_tier] || "bg-primary"
                    } text-white`}
                  >
                    {offer.merchant.badge_tier}
                  </Badge>
                )}
              </div>
              
              {/* Rating */}
              {offer.rating && offer.rating.total_ratings > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span>{offer.rating.average_rating.toFixed(1)}</span>
                  <span className="text-muted-foreground/60">
                    ({offer.rating.total_ratings})
                  </span>
                </div>
              )}
            </div>

            {isAccepted && (
              <Badge className="bg-green-500 text-white shrink-0">
                <CheckCircle className="h-3 w-3 mr-1" />
                مقبول
              </Badge>
            )}
          </div>

          {/* Price & Duration */}
          <div className="grid grid-cols-2 gap-2">
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <div className="flex items-center justify-center gap-1 text-primary font-bold">
                <DollarSign className="h-4 w-4" />
                <span>{offer.price_iqd.toLocaleString()}</span>
                <span className="text-xs font-normal">د.ع</span>
              </div>
            </div>
            <div className="p-2 rounded-lg bg-muted/50 text-center">
              <div className="flex items-center justify-center gap-1 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span className="font-semibold">{offer.duration_days}</span>
                <span className="text-xs">يوم</span>
              </div>
            </div>
          </div>

          {/* Notes Collapsible */}
          {offer.notes && (
            <Collapsible open={showNotes} onOpenChange={setShowNotes}>
              <CollapsibleTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full h-7 text-xs justify-between"
                >
                  <span>ملاحظات التاجر</span>
                  {showNotes ? (
                    <ChevronUp className="h-3 w-3" />
                  ) : (
                    <ChevronDown className="h-3 w-3" />
                  )}
                </Button>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <div className="p-2 rounded-lg bg-muted/30 text-xs text-muted-foreground mt-1">
                  {offer.notes}
                </div>
              </CollapsibleContent>
            </Collapsible>
          )}

          {/* Actions */}
          <div className="flex gap-2">
            {/* Message Button - Always visible */}
            <Button
              size="sm"
              variant="outline"
              className="flex-1 h-8 text-xs"
              onClick={handleMessage}
            >
              <MessageSquare className="h-3 w-3 ml-1" />
              مراسلة
            </Button>

            {/* Merchant: Send Offer Button */}
            {isMerchantOwner && !offer.offer_sent_at && !isAccepted && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-gradient-to-b from-primary to-accent"
                onClick={() => sendOfferMutation.mutate()}
                disabled={sendOfferMutation.isPending}
              >
                {sendOfferMutation.isPending ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <>
                    <Send className="h-3 w-3 ml-1" />
                    إرسال العرض
                  </>
                )}
              </Button>
            )}

            {/* Customer: Accept Offer Button */}
            {isCustomer && offer.offer_sent_at && !isAccepted && (
              <Button
                size="sm"
                className="flex-1 h-8 text-xs bg-green-600 hover:bg-green-700"
                onClick={() => setShowAcceptDialog(true)}
              >
                <CheckCircle className="h-3 w-3 ml-1" />
                قبول العرض
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Accept Offer Dialog */}
      <AcceptOfferDialog
        open={showAcceptDialog}
        onOpenChange={setShowAcceptDialog}
        offer={offer}
        requestId={requestId}
      />
    </>
  );
}
