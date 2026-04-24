import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ShieldCheck, TrendingDown, Clock, CheckCircle2, XCircle, MessageCircle, Loader2 } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import { toast } from "sonner";

interface PriceProtectionSectionProps {
  userId: string;
}

type ClaimStatus = "pending" | "awaiting_admin" | "processed" | "rejected";

interface Claim {
  id: string;
  order_id: string;
  product_id: string;
  product_name_ar: string | null;
  product_image: string | null;
  order_number: string | null;
  purchase_date: string;
  old_price: number;
  new_price: number;
  price_difference: number;
  quantity: number;
  total_refund: number;
  status: ClaimStatus;
  refunded_amount: number | null;
  conversation_id: string | null;
  rejection_reason: string | null;
}

const STATUS_META: Record<ClaimStatus, { tKey: string; cls: string; icon: typeof Clock }> = {
  pending: { tKey: "pp_status_pending", cls: "bg-amber-500/15 text-amber-600 border-amber-500/30", icon: Clock },
  awaiting_admin: { tKey: "pp_status_awaiting", cls: "bg-blue-500/15 text-blue-600 border-blue-500/30", icon: Clock },
  processed: { tKey: "pp_status_processed", cls: "bg-emerald-500/15 text-emerald-600 border-emerald-500/30", icon: CheckCircle2 },
  rejected: { tKey: "pp_status_rejected", cls: "bg-rose-500/15 text-rose-600 border-rose-500/30", icon: XCircle },
};

export default function PriceProtectionSection({ userId }: PriceProtectionSectionProps) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { t, language } = useLanguage();
  const [submittingId, setSubmittingId] = useState<string | null>(null);

  const { data: claims, isLoading } = useQuery({
    queryKey: ["price-protection-claims", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("price_protection_claims")
        .select("id, order_id, product_id, product_name_ar, product_image, order_number, purchase_date, old_price, new_price, price_difference, quantity, total_refund, status, refunded_amount, conversation_id, rejection_reason")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(10);
      if (error) throw error;
      return (data ?? []) as Claim[];
    },
  });

  const submitClaim = useMutation({
    mutationFn: async (claim: Claim) => {
      setSubmittingId(claim.id);
      // Find or create conversation between user and admin (order-based)
      let conversationId = claim.conversation_id;
      if (!conversationId) {
        const { data: existing } = await supabase
          .from("conversations")
          .select("id")
          .eq("user_id", userId)
          .eq("order_id", claim.order_id)
          .maybeSingle();

        if (existing?.id) {
          conversationId = existing.id;
        } else {
          const { data: created, error: convErr } = await supabase
            .from("conversations")
            .insert({ user_id: userId, order_id: claim.order_id, status: "open" })
            .select("id")
            .single();
          if (convErr) throw convErr;
          conversationId = created.id;
        }
      }

      // Insert price-protection card message
      const cardPayload = {
        type: "price_protection",
        claim_id: claim.id,
        order_id: claim.order_id,
        order_number: claim.order_number,
        product_name_ar: claim.product_name_ar,
        product_image: claim.product_image,
        purchase_date: claim.purchase_date,
        old_price: claim.old_price,
        new_price: claim.new_price,
        price_difference: claim.price_difference,
        quantity: claim.quantity,
        total_refund: claim.total_refund,
        status: "awaiting_admin",
      };

      const { error: msgErr } = await supabase.from("messages").insert({
        conversation_id: conversationId,
        sender_id: userId,
        content: `🔔 ${JSON.stringify(cardPayload)}`,
        is_read: false,
      });
      if (msgErr) throw msgErr;

      const { error: updErr } = await supabase
        .from("price_protection_claims")
        .update({ status: "awaiting_admin", user_requested_at: new Date().toISOString(), conversation_id: conversationId })
        .eq("id", claim.id);
      if (updErr) throw updErr;

      return conversationId;
    },
    onSuccess: (conversationId) => {
      toast.success(t("pp_request_sent"));
      qc.invalidateQueries({ queryKey: ["price-protection-claims", userId] });
      if (conversationId) navigate(`/messages?conversation=${conversationId}`);
    },
    onError: (e: any) => toast.error(e?.message ?? t("pp_request_failed")),
    onSettled: () => setSubmittingId(null),
  });

  const dateLocale = language === "en" ? "en-US" : language === "ku" ? "ckb-IQ" : "ar-IQ";

  return (
    <div className="glass-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-xl bg-emerald-500/15 flex items-center justify-center">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-foreground">{t("pp_title")}</h2>
            <p className="text-[10px] text-muted-foreground">{t("pp_subtitle")}</p>
          </div>
        </div>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <Skeleton key={i} className="h-32 w-full rounded-2xl" />
          ))}
        </div>
      ) : claims && claims.length > 0 ? (
        <div className="space-y-3">
          {claims.map((c) => {
            const meta = STATUS_META[c.status];
            const StatusIcon = meta.icon;
            const isPending = c.status === "pending";
            const isProcessed = c.status === "processed";
            const isAwaiting = c.status === "awaiting_admin";
            return (
              <div
                key={c.id}
                className="relative overflow-hidden rounded-2xl border border-border/30 bg-gradient-to-br from-background/60 via-background/40 to-emerald-500/5 backdrop-blur-xl p-3 shadow-sm"
              >
                {/* Eligible badge */}
                {isPending && (
                  <div className="absolute top-2 left-2 inline-flex items-center gap-1 rounded-lg bg-emerald-500/15 px-2 py-1 text-[10px] font-bold text-emerald-700 border border-emerald-500/30">
                    <ShieldCheck className="h-3 w-3" />
                    {t("pp_eligible_badge")}
                  </div>
                )}

                <div className="flex gap-3">
                  {c.product_image ? (
                    <img
                      src={c.product_image}
                      alt={c.product_name_ar ?? ""}
                      className="h-16 w-16 rounded-xl object-cover border border-border/40 shrink-0"
                      loading="lazy"
                    />
                  ) : (
                    <div className="h-16 w-16 rounded-xl bg-muted shrink-0" />
                  )}

                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-bold text-foreground line-clamp-1">
                      {c.product_name_ar ?? t("pp_product_default")}
                    </h3>
                    <p className="text-[10px] text-muted-foreground font-mono">
                      #{c.order_number ?? c.order_id.slice(0, 8)}
                    </p>
                    <p className="text-[10px] text-muted-foreground mt-0.5">
                      {new Date(c.purchase_date).toLocaleDateString(dateLocale, {
                        year: "numeric", month: "short", day: "numeric",
                      })}
                    </p>
                  </div>

                  <Badge variant="outline" className={`${meta.cls} text-[10px] gap-1 self-start`}>
                    <StatusIcon className="h-3 w-3" />
                    {t(meta.tKey as any)}
                  </Badge>
                </div>

                {/* Price diff */}
                <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-muted/30 p-2.5">
                  <div className="text-center">
                    <p className="text-[9px] text-muted-foreground">{t("pp_old_price")}</p>
                    <p className="text-xs font-bold text-foreground line-through opacity-70 tabular-nums">
                      {Number(c.old_price).toLocaleString(dateLocale)}
                    </p>
                  </div>
                  <div className="text-center border-x border-border/30">
                    <p className="text-[9px] text-muted-foreground">{t("pp_new_price")}</p>
                    <p className="text-xs font-bold text-foreground tabular-nums">
                      {Number(c.new_price).toLocaleString(dateLocale)}
                    </p>
                  </div>
                  <div className="text-center">
                    <p className="text-[9px] text-emerald-700">{t("pp_difference")}</p>
                    <p className="text-xs font-bold text-emerald-600 tabular-nums flex items-center justify-center gap-0.5">
                      <TrendingDown className="h-3 w-3" />
                      {Number(c.total_refund).toLocaleString(dateLocale)}
                    </p>
                  </div>
                </div>

                {/* Action / Status */}
                {isPending && (
                  <button
                    onClick={() => submitClaim.mutate(c)}
                    disabled={submittingId === c.id}
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 text-white py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97] disabled:opacity-60"
                  >
                    {submittingId === c.id ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <MessageCircle className="h-3.5 w-3.5" />
                    )}
                    <span>{t("pp_btn_request_refund")}</span>
                  </button>
                )}

                {isAwaiting && c.conversation_id && (
                  <button
                    onClick={() => navigate(`/messages?conversation=${c.conversation_id}`)}
                    className="mt-3 w-full flex items-center justify-center gap-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 text-blue-700 py-2 text-xs font-semibold transition-all duration-200 active:scale-[0.97]"
                  >
                    <MessageCircle className="h-3.5 w-3.5" />
                    <span>{t("pp_btn_track_request")}</span>
                  </button>
                )}

                {isProcessed && (
                  <div className="mt-3 flex items-center justify-center gap-2 rounded-xl bg-emerald-500/10 text-emerald-700 py-2 text-xs font-semibold">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    <span>
                      {t("pp_refunded_to_wallet")} {Number(c.refunded_amount ?? c.total_refund).toLocaleString(dateLocale)} {t("ph_currency_iqd")}
                    </span>
                  </div>
                )}

                {c.status === "rejected" && c.rejection_reason && (
                  <div className="mt-3 rounded-xl bg-rose-500/5 border border-rose-500/20 px-3 py-2 text-[11px] text-rose-700">
                    {c.rejection_reason}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-8 text-center">
          <div className="h-14 w-14 rounded-2xl bg-emerald-500/10 flex items-center justify-center mb-2">
            <ShieldCheck className="h-7 w-7 text-emerald-500/70" />
          </div>
          <p className="text-sm font-semibold text-foreground">{t("pp_empty_title")}</p>
          <p className="text-xs text-muted-foreground mt-1 max-w-[260px]">{t("pp_empty_desc")}</p>
        </div>
      )}
    </div>
  );
}
