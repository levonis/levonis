import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles } from "lucide-react";
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
        "inline-flex items-center justify-center shrink-0",
        className
      )}
      title="تاجر موثوق من المنصة"
    >
      <BadgeCheck
        className={cn(
          sizeClasses[size],
          "text-amber-500 fill-amber-100 drop-shadow-sm"
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
 * شارة حجم الطلبات - تُحسب تلقائيًا أو يدويًا من الأدمن
 */
export function OrderBadge({ tier, size = "sm", className, showLabel = false }: OrderBadgeProps) {
  if (tier === "none") return null;

  const sizeClasses = {
    sm: "h-4 w-4",
    md: "h-5 w-5",
    lg: "h-6 w-6",
  };

  const config: Record<Exclude<BadgeTier, "none">, {
    icon: React.ReactNode;
    colors: string;
    bgColor: string;
    animate?: boolean;
  }> = {
    silver: {
      icon: <Medal className={sizeClasses[size]} />,
      colors: "text-slate-400",
      bgColor: "bg-slate-100 border-slate-200",
    },
    gold: {
      icon: <Crown className={sizeClasses[size]} />,
      colors: "text-amber-500",
      bgColor: "bg-amber-50 border-amber-200",
    },
    diamond_1: {
      icon: <Diamond className={sizeClasses[size]} />,
      colors: "text-sky-500",
      bgColor: "bg-sky-50 border-sky-200",
    },
    diamond_2: {
      icon: <Diamond className={sizeClasses[size]} />,
      colors: "text-sky-600",
      bgColor: "bg-sky-100 border-sky-300",
    },
    diamond_3: {
      icon: <Diamond className={sizeClasses[size]} />,
      colors: "text-indigo-500",
      bgColor: "bg-indigo-50 border-indigo-200",
    },
    diamond_4: {
      icon: <Diamond className={sizeClasses[size]} />,
      colors: "text-indigo-600",
      bgColor: "bg-indigo-100 border-indigo-300",
    },
    emerald: {
      icon: <Gem className={sizeClasses[size]} />,
      colors: "text-emerald-500",
      bgColor: "bg-emerald-50 border-emerald-200",
      animate: true,
    },
  };

  const { icon, colors, bgColor, animate } = config[tier as Exclude<BadgeTier, "none">];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 shrink-0 rounded-full border px-1.5 py-0.5",
        bgColor,
        colors,
        animate && "animate-pulse",
        className
      )}
      title={BADGE_TIER_LABELS[tier]}
    >
      {animate && <Sparkles className="h-3 w-3 text-emerald-400" />}
      {icon}
      {showLabel && (
        <span className="text-[10px] font-bold">{BADGE_TIER_LABELS[tier]}</span>
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
    <div className={cn("inline-flex items-center gap-1", className)}>
      {isVerified && <VerificationBadge size={size} />}
      <OrderBadge tier={badgeTier} size={size} />
    </div>
  );
}
