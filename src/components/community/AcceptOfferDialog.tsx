import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  CheckCircle,
  Wallet,
  AlertTriangle,
  Loader2,
  DollarSign,
  Store,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface MerchantOffer {
  id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  merchant?: {
    display_name: string | null;
    store_image_url: string | null;
  };
}

interface AcceptOfferDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  offer: MerchantOffer;
  requestId: string;
}

export default function AcceptOfferDialog({
  open,
  onOpenChange,
  offer,
  requestId,
}: AcceptOfferDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  // Fetch wallet balance
  const { data: wallet, isLoading: walletLoading } = useQuery({
    queryKey: ["user-wallet", user?.id],
    enabled: !!user?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user!.id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch platform commission rate
  const { data: commissionSetting } = useQuery({
    queryKey: ["platform-commission"],
    queryFn: async () => {
      const { data } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "platform_commission_rate")
        .maybeSingle();
      return data?.setting_value as { rate: number } | null;
    },
  });

  const commissionRate = commissionSetting?.rate || 0.007;
  const hasSufficientBalance = (wallet?.balance || 0) >= offer.price_iqd;

  // Accept offer mutation
  const acceptMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("غير مسجل الدخول");

      // Check balance again
      const { data: currentWallet } = await supabase
        .from("user_wallets")
        .select("balance")
        .eq("user_id", user.id)
        .single();

      if (!currentWallet || currentWallet.balance < offer.price_iqd) {
        throw new Error("رصيد غير كافٍ في المحفظة");
      }

      // Calculate platform fee
      const platformFee = Math.floor(offer.price_iqd * commissionRate);
      const merchantPayout = offer.price_iqd - platformFee;

      // 1. Deduct from customer wallet
      const { error: deductError } = await supabase
        .from("user_wallets")
        .update({ balance: currentWallet.balance - offer.price_iqd })
        .eq("user_id", user.id);

      if (deductError) throw deductError;

      // 2. Record wallet transaction
      await supabase.from("wallet_transactions").insert({
        user_id: user.id,
        amount: -offer.price_iqd,
        type: "escrow_hold",
        status: "completed",
        description: `حجز مبلغ لطلب الطباعة - ${offer.merchant?.display_name || "تاجر"}`,
      });

      // 3. Create escrow transaction
      const { error: escrowError } = await supabase.from("escrow_transactions").insert({
        request_id: requestId,
        offer_id: offer.id,
        customer_id: user.id,
        merchant_id: offer.trader_id,
        amount: offer.price_iqd,
        platform_fee: platformFee,
        merchant_payout: merchantPayout,
        status: "held",
      });

      if (escrowError) throw escrowError;

      // 4. Update offer status
      const { error: offerError } = await supabase
        .from("print_offers")
        .update({
          status: "accepted",
          accepted_at: new Date().toISOString(),
        })
        .eq("id", offer.id);

      if (offerError) throw offerError;

      // 5. Update request with accepted offer
      const { error: requestError } = await supabase
        .from("community_print_requests")
        .update({
          accepted_offer_id: offer.id,
          accepted_at: new Date().toISOString(),
          escrow_amount: offer.price_iqd,
          escrow_held_at: new Date().toISOString(),
          status: "in_progress",
        })
        .eq("id", requestId);

      if (requestError) throw requestError;

      // 6. Notify merchant
      await supabase.from("notifications").insert({
        user_id: offer.trader_id,
        title: "تم قبول عرضك! ✓",
        message: `تم قبول عرضك وحجز المبلغ (${offer.price_iqd.toLocaleString()} د.ع). يرجى المباشرة في تنفيذ الطلب.`,
        type: "offer_accepted",
      });

      return { success: true };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["request-offers", requestId] });
      qc.invalidateQueries({ queryKey: ["user-wallet", user?.id] });
      qc.invalidateQueries({ queryKey: ["community-print-requests"] });
      
      toast({
        title: "تم قبول العرض بنجاح ✓",
        description: "تم حجز المبلغ وإبلاغ التاجر للمباشرة بالتنفيذ",
      });
      
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "تعذر قبول العرض",
        description: err?.message,
        variant: "destructive",
      });
    },
  });

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent className="sm:max-w-md">
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <CheckCircle className="h-5 w-5 text-green-500" />
            تأكيد قبول العرض
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-4 pt-2">
            {/* Offer Summary */}
            <div className="p-3 rounded-xl bg-muted/50 border border-border space-y-2">
              <div className="flex items-center gap-2">
                <Store className="h-4 w-4 text-primary" />
                <span className="font-semibold">
                  {offer.merchant?.display_name || "متجر"}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>السعر:</span>
                <span className="font-bold text-primary">
                  {offer.price_iqd.toLocaleString()} د.ع
                </span>
              </div>
              <div className="flex items-center justify-between text-sm text-muted-foreground">
                <span>مدة التنفيذ:</span>
                <span>{offer.duration_days} يوم</span>
              </div>
            </div>

            {/* Wallet Balance */}
            <div className="p-3 rounded-xl border border-border">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Wallet className="h-4 w-4" />
                  <span>رصيد المحفظة:</span>
                </div>
                {walletLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <span
                    className={`font-bold ${
                      hasSufficientBalance ? "text-green-600" : "text-destructive"
                    }`}
                  >
                    {(wallet?.balance || 0).toLocaleString()} د.ع
                  </span>
                )}
              </div>
            </div>

            {/* Warning if insufficient */}
            {!walletLoading && !hasSufficientBalance && (
              <div className="p-3 rounded-xl bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-destructive shrink-0 mt-0.5" />
                <div className="text-sm text-destructive">
                  رصيد غير كافٍ. يرجى شحن المحفظة أولاً بمبلغ{" "}
                  <strong>
                    {(offer.price_iqd - (wallet?.balance || 0)).toLocaleString()}
                  </strong>{" "}
                  د.ع على الأقل.
                </div>
              </div>
            )}

            {/* Escrow Info */}
            <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 flex items-start gap-2">
              <ShieldCheck className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div className="text-xs text-muted-foreground">
                سيتم حجز المبلغ لدى الإدارة لحين اكتمال الطلب وتأكيد الاستلام.
                يُحوَّل المبلغ للتاجر بعد تأكيدك أو تلقائياً بعد 3 أيام من التوصيل.
              </div>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <AlertDialogFooter>
          <AlertDialogCancel>إلغاء</AlertDialogCancel>
          <Button
            onClick={() => acceptMutation.mutate()}
            disabled={!hasSufficientBalance || acceptMutation.isPending || walletLoading}
            className="bg-green-600 hover:bg-green-700"
          >
            {acceptMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <CheckCircle className="h-4 w-4 ml-1" />
                تأكيد وحجز المبلغ
              </>
            )}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
