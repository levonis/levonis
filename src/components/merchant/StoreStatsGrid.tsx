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
    <div className={`grid gap-3 ${variant === "merchant" ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
      {displayStats.map((stat, index) => (
        <div
          key={index}
          className="group relative overflow-hidden rounded-2xl border border-border/50 bg-gradient-to-br from-card to-card/50 p-4 transition-all duration-300 hover:border-primary/30 hover:shadow-lg hover:shadow-primary/5"
        >
          {/* Hover Glow */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
          
          <div className="relative z-10 flex flex-col items-center lg:items-start gap-2">
            <div className={`h-10 w-10 rounded-xl ${stat.bgColor} flex items-center justify-center transition-transform group-hover:scale-110`}>
              <stat.icon 
                className={`h-5 w-5 ${stat.color} ${stat.fillIcon ? "fill-current" : ""}`} 
              />
            </div>
            <div className="text-center lg:text-right">
              <p className="text-2xl font-bold text-foreground tracking-tight">
                {stat.value}
              </p>
              <p className="text-[11px] text-muted-foreground font-medium">
                {stat.label}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
