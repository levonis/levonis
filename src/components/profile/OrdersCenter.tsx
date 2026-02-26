import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Clock, Package, Truck, MapPin, CheckCircle, ChevronLeft } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";

interface OrdersCenterProps {
  userId: string;
}

const ORDER_STATUSES = [
  { key: "pending", label: "بانتظار الدفع", icon: Clock },
  { key: "confirmed", label: "قيد التجهيز", icon: Package },
  { key: "shipped", label: "تم الشحن", icon: Truck },
  { key: "arrived_iraq", label: "في الطريق", icon: MapPin },
  { key: "delivered", label: "تم التسليم", icon: CheckCircle },
] as const;

export default function OrdersCenter({ userId }: OrdersCenterProps) {
  const navigate = useNavigate();

  const { data: statusCounts, isLoading } = useQuery({
    queryKey: ["profile-order-counts", userId],
    enabled: !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("status")
        .eq("user_id", userId);
      if (error) throw error;

      const counts: Record<string, number> = {};
      (data ?? []).forEach((o) => {
        counts[o.status] = (counts[o.status] || 0) + 1;
      });
      return counts;
    },
  });

  return (
    <div className="rounded-3xl bg-card border border-border/40 shadow-sm p-4">
      {/* Title */}
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-base font-bold text-foreground">طلباتي</h2>
        <button
          onClick={() => navigate("/my-orders")}
          className="flex items-center gap-1 text-xs text-primary font-semibold transition-colors hover:text-primary/80"
        >
          <span>عرض الكل</span>
          <ChevronLeft className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* 5-col grid */}
      <div className="grid grid-cols-5 gap-1">
        {ORDER_STATUSES.map((s) => {
          const count = statusCounts?.[s.key] ?? 0;
          return (
            <button
              key={s.key}
              onClick={() => navigate(`/my-orders?status=${s.key}`)}
              className="flex flex-col items-center gap-1.5 rounded-2xl py-3 px-1 transition-all duration-200 active:scale-[0.93] hover:bg-muted/50"
            >
              <div className="relative">
                {isLoading ? (
                  <Skeleton className="h-7 w-7 rounded-full" />
                ) : (
                  <>
                    <s.icon className="h-6 w-6 text-muted-foreground" strokeWidth={1.5} />
                    {count > 0 && (
                      <span className="absolute -top-1.5 -right-1.5 flex items-center justify-center h-4 min-w-4 px-1 rounded-full bg-destructive text-[10px] font-bold text-destructive-foreground animate-in zoom-in-50">
                        {count}
                      </span>
                    )}
                  </>
                )}
              </div>
              <span className="text-[10px] text-muted-foreground text-center leading-tight line-clamp-2">
                {s.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
