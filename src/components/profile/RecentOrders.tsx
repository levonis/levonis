import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ChevronLeft, ShoppingBag } from "lucide-react";
import { useLanguage } from "@/lib/i18n";
import type { TranslationKeys } from "@/lib/i18n/types";

interface RecentOrdersProps {
  userId: string;
}

const STATUS_MAP: Record<string, { labelKey: keyof TranslationKeys; variant: "default" | "secondary" | "outline" | "destructive" }> = {
  pending: { labelKey: "order_status_pending", variant: "outline" },
  confirmed: { labelKey: "order_status_confirmed", variant: "secondary" },
  shipped: { labelKey: "order_status_shipped", variant: "default" },
  arrived_iraq: { labelKey: "order_status_arrived_iraq", variant: "default" },
  delivered: { labelKey: "order_status_delivered", variant: "secondary" },
  cancelled: { labelKey: "order_status_cancelled", variant: "destructive" },
};

export default function RecentOrders({ userId }: RecentOrdersProps) {
  const navigate = useNavigate();
  const { t, language } = useLanguage();

  const { data: orders, isLoading } = useQuery({
    queryKey: ["profile-recent-orders", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, status, total_amount, created_at")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;
      return data ?? [];
    },
  });

  const dateLocale = language === 'en' ? 'en-US' : language === 'ku' ? 'ckb-IQ' : 'ar-IQ';

  return (
    <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">{t('orders_recent_title')}</h2>
        <button
          onClick={() => navigate("/my-orders")}
          className="flex items-center gap-1 text-xs text-primary font-semibold transition-colors hover:text-primary/80"
        >
          <span>{t('orders_view_all')}</span>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-2xl" />
          ))}
        </div>
      ) : orders && orders.length > 0 ? (
        <div className="space-y-2">
          {orders.map((o) => {
            const s = STATUS_MAP[o.status];
            const label = s ? t(s.labelKey) : o.status;
            const variant = s?.variant ?? "outline";
            return (
              <button
                key={o.id}
                onClick={() => navigate(`/my-orders`)}
                className="w-full flex items-center gap-3 rounded-2xl border border-border/30 bg-muted/20 p-3 transition-all duration-200 active:scale-[0.97] hover:bg-muted/40 text-right"
              >
                <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-primary/10 shrink-0">
                  <ShoppingBag className="h-5 w-5 text-primary" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-semibold text-foreground">
                      {t('orders_order_number', { id: o.id.slice(-6) })}
                    </span>
                    <Badge variant={variant} className="text-[10px] shrink-0">
                      {label}
                    </Badge>
                  </div>
                  <div className="mt-1 flex items-center justify-between text-xs text-muted-foreground">
                    <span className="tabular-nums">
                      {o.total_amount?.toLocaleString(dateLocale)} {t('cart_currency_iqd')}
                    </span>
                    <span className="tabular-nums">
                      {new Date(o.created_at).toLocaleDateString(dateLocale, {
                        month: "short",
                        day: "numeric",
                      })}
                    </span>
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-2 py-6 text-center">
          <ShoppingBag className="h-10 w-10 text-muted-foreground/30" />
          <p className="text-sm text-muted-foreground">{t('orders_none_yet')}</p>
          <button
            onClick={() => navigate("/")}
            className="text-xs text-primary font-semibold hover:text-primary/80 transition-colors"
          >
            {t('orders_browse_products')}
          </button>
        </div>
      )}
    </div>
  );
}
