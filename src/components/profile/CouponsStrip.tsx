import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ChevronLeft, Ticket } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface CouponsStripProps {
  userId: string;
}

export default function CouponsStrip({ userId }: CouponsStripProps) {
  const navigate = useNavigate();

  const { data: coupons, isLoading } = useQuery({
    queryKey: ["profile-coupons-list", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_coupons")
        .select("id, coupon_code, discount_value, discount_type, expires_at, is_used")
        .eq("user_id", userId)
        .eq("is_used", false)
        .gte("expires_at", new Date().toISOString())
        .order("expires_at", { ascending: true })
        .limit(5);
      if (error) throw error;
      return data ?? [];
    },
  });

  if (!isLoading && (!coupons || coupons.length === 0)) return null;

  const formatExpiry = (date: string) => {
    const d = new Date(date);
    const now = new Date();
    const diffDays = Math.ceil((d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 3) return `${diffDays} يوم متبقي`;
    return d.toLocaleDateString("ar-IQ", { month: "short", day: "numeric" });
  };

  return (
    <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-base font-bold text-foreground">كوبوناتي</h2>
        <button
          onClick={() => navigate("/special-coupons")}
          className="flex items-center gap-1 text-xs text-primary font-semibold transition-colors hover:text-primary/80"
        >
          <span>عرض الكل</span>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Horizontal scroll */}
      <div className="flex gap-3 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1">
        {isLoading
          ? Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="shrink-0 w-44">
                <Skeleton className="h-28 w-full rounded-2xl" />
              </div>
            ))
          : coupons?.map((c) => {
              const isPercentage = c.discount_type === "percentage";
              const urgentExpiry = new Date(c.expires_at).getTime() - Date.now() < 3 * 86400000;

              return (
                <div
                  key={c.id}
                  className="shrink-0 w-44 rounded-2xl border overflow-hidden transition-all duration-200 active:scale-[0.97]"
                  style={{
                    background: "linear-gradient(135deg, hsl(var(--destructive) / 0.08), hsl(var(--destructive) / 0.02))",
                    borderColor: "hsl(var(--destructive) / 0.15)",
                  }}
                >
                  <div className="p-3 flex flex-col h-full">
                    {/* Discount */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-2xl font-black text-destructive tabular-nums">
                        {c.discount_value?.toLocaleString()}
                      </span>
                      <span className="text-xs font-semibold text-destructive/80">
                        {isPercentage ? "%" : "د.ع"}
                      </span>
                    </div>

                    {/* Code */}
                    <div className="mt-1 text-[10px] text-muted-foreground font-mono">
                      {c.coupon_code}
                    </div>

                    {/* Expiry */}
                    <div className={`mt-2 text-[10px] ${urgentExpiry ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                      {formatExpiry(c.expires_at)}
                    </div>

                    {/* CTA */}
                    <button
                      onClick={() => navigate("/")}
                      className="mt-2 text-[11px] font-bold text-destructive hover:text-destructive/80 self-start transition-colors"
                    >
                      استخدم الآن ←
                    </button>
                  </div>
                </div>
              );
            })}
      </div>
    </div>
  );
}
