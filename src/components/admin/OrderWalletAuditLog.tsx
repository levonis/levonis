import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Loader2, Copy, ExternalLink, Check, Hash, ShoppingCart, MessageSquare, Clock, Megaphone, Users, CreditCard } from "lucide-react";
import { format } from "date-fns";
import { useState } from "react";
import { Link } from "react-router-dom";
import { toast } from "sonner";
import { ADMIN_BASE_PATH } from "@/lib/adminPath";

interface Props {
  orderId: string;
  formatPrice: (n: number) => string;
}

interface LogRow {
  id: string;
  user_id: string;
  amount: number;
  balance_before: number | null;
  balance_after: number | null;
  breakdown: any;
  description: string | null;
  status: string;
  created_at: string;
  type: string | null;
  payment_method: string | null;
  idempotency_key: string | null;
}

const SOURCE_META: Record<string, { label: string; icon: any; color: string }> = {
  cart_direct_sale: { label: "بيع مباشر (السلة)", icon: ShoppingCart, color: "text-blue-600 bg-blue-500/10 border-blue-500/30" },
  chat_order:       { label: "طلب من المحادثة",   icon: MessageSquare, color: "text-purple-600 bg-purple-500/10 border-purple-500/30" },
  preorder:         { label: "طلب مسبق (Preorder)", icon: Clock, color: "text-amber-600 bg-amber-500/10 border-amber-500/30" },
  community_offer:  { label: "قبول عرض مجتمع",     icon: Users, color: "text-emerald-600 bg-emerald-500/10 border-emerald-500/30" },
  merchant_ad:      { label: "حجز إعلان تاجر",      icon: Megaphone, color: "text-pink-600 bg-pink-500/10 border-pink-500/30" },
};

function CopyButton({ value, label }: { value: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(value);
        setCopied(true);
        toast.success(label ? `تم نسخ ${label}` : "تم النسخ");
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors"
      title={label ? `نسخ ${label}` : "نسخ"}
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

export default function OrderWalletAuditLog({ orderId, formatPrice }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ["order-wallet-log", orderId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_order_wallet_log" as any, {
        p_order_id: orderId,
      });
      if (error) throw error;
      return (data || []) as LogRow[];
    },
    enabled: !!orderId,
  });

  if (isLoading) {
    return (
      <div className="p-3 rounded-xl border border-border/60 bg-muted/20 flex items-center justify-center">
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!data || data.length === 0) return null;

  const totalDeducted = data.reduce((s, r) => s + Number(r.amount || 0), 0);

  return (
    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2.5">
      <div className="flex items-center justify-between">
        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
          <Wallet className="h-3.5 w-3.5 text-emerald-600" />
          سجل تدقيق خصم المحفظة ({data.length})
        </h4>
        <span className="text-[11px] font-bold text-emerald-700">
          إجمالي: {formatPrice(totalDeducted)}
        </span>
      </div>

      <div className="space-y-2">
        {data.map((row) => {
          const b = row.breakdown || {};
          const sourceKey = b.source as string | undefined;
          const meta = (sourceKey && SOURCE_META[sourceKey]) || {
            label: sourceKey || "خصم",
            icon: Wallet,
            color: "text-muted-foreground bg-muted/40 border-border/40",
          };
          const Icon = meta.icon;

          // Determine optional operation link
          let opLink: { to: string; label: string } | null = null;
          if (b.conversation_id) opLink = { to: `${ADMIN_BASE_PATH}/chats?conversation=${b.conversation_id}`, label: "فتح المحادثة" };
          else if (b.offer_id) opLink = { to: `${ADMIN_BASE_PATH}/community/offers?id=${b.offer_id}`, label: "فتح العرض" };
          else if (b.ad_id) opLink = { to: `${ADMIN_BASE_PATH}/merchant-ads?id=${b.ad_id}`, label: "فتح الإعلان" };
          else if (b.preorder_id) opLink = { to: `${ADMIN_BASE_PATH}/preorders?id=${b.preorder_id}`, label: "فتح الطلب المسبق" };

          return (
            <div key={row.id} className="rounded-lg bg-background/70 border border-border/50 p-2.5 text-xs space-y-2">
              {/* Header: source + amount */}
              <div className="flex items-center justify-between gap-2">
                <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold border ${meta.color}`}>
                  <Icon className="h-3 w-3" />
                  {meta.label}
                </span>
                <span className="font-bold text-emerald-700 tabular-nums">- {formatPrice(Number(row.amount))}</span>
              </div>

              {/* Breakdown amounts */}
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                {Number(b.subtotal) > 0 && (
                  <span>منتجات: <b className="text-foreground tabular-nums">{formatPrice(Number(b.subtotal))}</b></span>
                )}
                {Number(b.delivery_fee) > 0 && (
                  <span>توصيل: <b className="text-foreground tabular-nums">{formatPrice(Number(b.delivery_fee))}</b></span>
                )}
                {Number(b.discount) > 0 && (
                  <span className="text-red-500">خصم{b.coupon_code ? ` (${b.coupon_code})` : ""}: -{formatPrice(Number(b.discount))}</span>
                )}
                {row.payment_method && (
                  <span className="inline-flex items-center gap-1">
                    <CreditCard className="h-3 w-3" />
                    {row.payment_method}
                  </span>
                )}
              </div>

              {/* Balance before/after */}
              {(row.balance_before != null || row.balance_after != null) && (
                <div className="text-[10px] text-muted-foreground bg-muted/40 rounded px-1.5 py-0.5">
                  الرصيد: {row.balance_before != null ? formatPrice(Number(row.balance_before)) : "—"}
                  {" → "}
                  <b className="text-foreground">{row.balance_after != null ? formatPrice(Number(row.balance_after)) : "—"}</b>
                </div>
              )}

              {/* Notes */}
              {b.notes && (
                <div className="text-[10px] text-muted-foreground italic border-r-2 border-emerald-500/40 pr-1.5">{b.notes}</div>
              )}

              {/* IDs row */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground pt-1 border-t border-border/40">
                <span className="inline-flex items-center gap-1" title="رقم المعاملة">
                  <Hash className="h-3 w-3" />
                  <code className="font-mono">{row.id}</code>
                  <CopyButton value={row.id} label="رقم المعاملة" />
                </span>
                {row.idempotency_key && (
                  <span className="inline-flex items-center gap-1" title="مفتاح الحماية من التكرار">
                    <span className="text-muted-foreground/70">idem:</span>
                    <code className="font-mono">{row.idempotency_key.slice(0, 12)}…</code>
                    <CopyButton value={row.idempotency_key} label="المفتاح" />
                  </span>
                )}
                <span className="ml-auto">
                  {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}
                  {" · "}
                  <span className="font-medium">{row.status}</span>
                  {row.type && <> · {row.type}</>}
                </span>
              </div>

              {/* Operation link */}
              {opLink && (
                <Link
                  to={opLink.to}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-primary hover:underline pt-0.5"
                >
                  <ExternalLink className="h-3 w-3" />
                  {opLink.label}
                </Link>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
