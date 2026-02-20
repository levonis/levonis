import { Package, ShoppingBag, Star, Users, TrendingUp, Eye } from "lucide-react";

interface StoreStatsGridProps {
  stats: {
    activeProducts: number;
    completedOrders: number;
    avgRating: number;
    totalRatings: number;
    conversations?: number;
    totalOrders?: number;
  };
  variant?: "client" | "merchant";
}

export default function StoreStatsGrid({ stats, variant = "client" }: StoreStatsGridProps) {
  const clientStats = [
    {
      icon: Package,
      value: stats.activeProducts,
      label: "منتج نشط",
      color: "text-primary",
      bgColor: "bg-primary/10",
    },
    {
      icon: ShoppingBag,
      value: stats.completedOrders,
      label: "طلب مكتمل",
      color: "text-emerald-500",
      bgColor: "bg-emerald-500/10",
    },
    {
      icon: Star,
      value: stats.avgRating.toFixed(1),
      label: `${stats.totalRatings} تقييم`,
      color: "text-amber-500",
      bgColor: "bg-amber-500/10",
      fillIcon: true,
    },
  ];

  const merchantStats = [
    ...clientStats,
    {
      icon: Users,
      value: stats.conversations || 0,
      label: "محادثة عميل",
      color: "text-blue-500",
      bgColor: "bg-blue-500/10",
    },
  ];

  const displayStats = variant === "merchant" ? merchantStats : clientStats;

  return (
    <div className={`grid gap-1.5 ${variant === "merchant" ? "grid-cols-4" : "grid-cols-3"}`}>
      {displayStats.map((stat, index) => (
        <div
          key={index}
          className="rounded-xl border border-border/50 bg-card/80 p-2.5 transition-all hover:border-primary/30"
        >
          <div className="flex items-center gap-2">
            <div className={`h-7 w-7 rounded-lg ${stat.bgColor} flex items-center justify-center shrink-0`}>
              <stat.icon 
                className={`h-3.5 w-3.5 ${stat.color} ${stat.fillIcon ? "fill-current" : ""}`} 
              />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-foreground tabular-nums">{stat.value}</p>
              <p className="text-[8px] text-muted-foreground">{stat.label}</p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
