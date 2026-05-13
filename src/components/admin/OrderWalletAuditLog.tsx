import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Wallet, Loader2 } from "lucide-react";
import { format } from "date-fns";

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
}

const SOURCE_LABELS: Record<string, string> = {
  cart_direct_sale: "بيع مباشر (السلة)",
  chat_order: "طلب محادثة",
  preorder: "طلب مسبق",
  community_offer: "قبول عرض مجتمع",
  merchant_ad: "حجز إعلان تاجر",
};

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

  return (
    <div className="p-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 space-y-2">
      <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5">
        <Wallet className="h-3.5 w-3.5 text-emerald-600" />
        سجل تدقيق خصم المحفظة ({data.length})
      </h4>
      <div className="space-y-2">
        {data.map((row) => {
          const b = row.breakdown || {};
          const sourceLabel = SOURCE_LABELS[b.source] || b.source || "خصم";
          return (
            <div key={row.id} className="rounded-lg bg-background/60 border border-border/40 p-2 text-xs space-y-1">
              <div className="flex justify-between items-center">
                <span className="font-bold text-emerald-700">- {formatPrice(Number(row.amount))}</span>
                <span className="text-[10px] text-muted-foreground">
                  {format(new Date(row.created_at), "yyyy-MM-dd HH:mm")}
                </span>
              </div>
              <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-[11px] text-muted-foreground">
                <span className="font-medium text-foreground">{sourceLabel}</span>
                {Number(b.subtotal) > 0 && (
                  <span>منتجات: <b className="text-foreground">{formatPrice(Number(b.subtotal))}</b></span>
                )}
                {Number(b.delivery_fee) > 0 && (
                  <span>توصيل: <b className="text-foreground">{formatPrice(Number(b.delivery_fee))}</b></span>
                )}
                {Number(b.discount) > 0 && (
                  <span className="text-red-500">خصم{b.coupon_code ? ` (${b.coupon_code})` : ""}: -{formatPrice(Number(b.discount))}</span>
                )}
              </div>
              {(row.balance_before != null || row.balance_after != null) && (
                <div className="text-[10px] text-muted-foreground">
                  الرصيد: {row.balance_before != null ? formatPrice(Number(row.balance_before)) : "—"}
                  {" → "}
                  {row.balance_after != null ? formatPrice(Number(row.balance_after)) : "—"}
                </div>
              )}
              {b.notes && (
                <div className="text-[10px] text-muted-foreground italic">{b.notes}</div>
              )}
              <div className="text-[10px] text-muted-foreground/60">#{row.id.slice(0, 8)} • {row.status}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
