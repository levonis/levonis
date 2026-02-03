import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles, Star, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeTier = "none" | "silver" | "gold" | "diamond_1" | "diamond_2" | "diamond_3" | "diamond_4" | "emerald";

export const BADGE_TIER_LABELS: Record<BadgeTier, string> = {
  none: "بدون شارة",
  silver: "فضية",
  gold: "ذهبية",
  diamond_1: "ماسية 1",
  diamond_2: "ماسية 2",
  diamond_3: "ماسية 3",
  diamond_4: "ماسية 4",
  emerald: "زمردة",
};

type VerificationBadgeProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * شارة التوثيق الذهبية - تُعطى يدويًا من الأدمن للتجار الموثوقين
 */
export function VerificationBadge({ size = "sm", className }: VerificationBadgeProps) {
  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  return (
    <span
      className={cn(
        "inline-flex items-center justify-center shrink-0 relative",
        className
      )}
      title="تاجر موثوق من المنصة"
    >
      <div className="absolute inset-0 bg-amber-400/30 rounded-full blur-sm animate-pulse" />
      <BadgeCheck
        className={cn(
          sizeClasses[size],
          "text-amber-500 fill-amber-100 drop-shadow-md relative z-10"
        )}
      />
    </span>
  );
}

type OrderBadgeProps = {
  tier: BadgeTier;
  size?: "sm" | "md" | "lg";
  className?: string;
  showLabel?: boolean;
};

/**
 * شارة حجم الطلبات - تُحسب تلقائيًا بناءً على آخر 3 أشهر
 */
export function OrderBadge({ tier, size = "sm", className, showLabel = false }: OrderBadgeProps) {
  if (tier === "none") return null;

  const sizeClasses = {
    sm: "h-3.5 w-3.5",
    md: "h-4 w-4",
    lg: "h-5 w-5",
  };

  const containerSizes = {
    sm: "h-6 px-2",
    md: "h-7 px-2.5",
    lg: "h-8 px-3",
  };

  const config: Record<Exclude<BadgeTier, "none">, {
    icon: React.ReactNode;
    gradient: string;
    textColor: string;
    glow?: string;
  }> = {
    silver: {
      icon: <Medal className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-slate-300 via-slate-200 to-slate-300",
      textColor: "text-slate-600",
    },
    gold: {
      icon: <Crown className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-amber-400 via-yellow-300 to-amber-400",
      textColor: "text-amber-800",
      glow: "shadow-amber-300/50",
    },
    diamond_1: {
      icon: <Diamond className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-sky-400 via-cyan-300 to-sky-400",
      textColor: "text-sky-800",
      glow: "shadow-sky-300/50",
    },
    diamond_2: {
      icon: <Diamond className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-blue-500 via-sky-400 to-blue-500",
      textColor: "text-white",
      glow: "shadow-blue-400/50",
    },
    diamond_3: {
      icon: <Diamond className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-indigo-500 via-purple-400 to-indigo-500",
      textColor: "text-white",
      glow: "shadow-indigo-400/50",
    },
    diamond_4: {
      icon: <Diamond className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-violet-600 via-purple-500 to-violet-600",
      textColor: "text-white",
      glow: "shadow-violet-500/60",
    },
    emerald: {
      icon: <Gem className={sizeClasses[size]} />,
      gradient: "bg-gradient-to-r from-emerald-500 via-green-400 to-emerald-500",
      textColor: "text-white",
      glow: "shadow-emerald-400/60",
    },
  };

  const { icon, gradient, textColor, glow } = config[tier as Exclude<BadgeTier, "none">];
  const isAdvanced = ["diamond_2", "diamond_3", "diamond_4", "emerald"].includes(tier);

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 rounded-full shadow-md transition-all",
        containerSizes[size],
        gradient,
        textColor,
        glow && `shadow-lg ${glow}`,
        isAdvanced && "ring-1 ring-white/30",
        className
      )}
      title={BADGE_TIER_LABELS[tier]}
    >
      {tier === "emerald" && (
        <Sparkles className="h-2.5 w-2.5 animate-pulse" />
      )}
      {icon}
      {showLabel && (
        <span className="text-[10px] font-bold">{BADGE_TIER_LABELS[tier]}</span>
      )}
      {isAdvanced && tier !== "emerald" && (
        <Zap className="h-2.5 w-2.5" />
      )}
    </span>
  );
}

type MerchantBadgesDisplayProps = {
  isVerified?: boolean;
  badgeTier?: BadgeTier;
  size?: "sm" | "md" | "lg";
  className?: string;
};

/**
 * عرض شارات التاجر (التوثيق + حجم الطلبات)
 */
export function MerchantBadgesDisplay({
  isVerified = false,
  badgeTier = "none",
  size = "sm",
  className,
}: MerchantBadgesDisplayProps) {
  const hasAnyBadge = isVerified || badgeTier !== "none";
  
  if (!hasAnyBadge) return null;

  return (
    <div className={cn("inline-flex items-center gap-1.5", className)}>
      {isVerified && <VerificationBadge size={size} />}
      <OrderBadge tier={badgeTier} size={size} />
    </div>
  );
}
