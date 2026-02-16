import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles, Zap } from "lucide-react";
import { cn } from "@/lib/utils";

export type BadgeTier = "none" | "silver" | "gold" | "diamond_1" | "diamond_2" | "diamond_3" | "diamond_4" | "emerald";

export const BADGE_TIER_LABELS: Record<BadgeTier, string> = {
  none: "بدون شارة",
  silver: "فضية",
  gold: "ذهبية",
  diamond_1: "ماسية",
  diamond_2: "ماسية II",
  diamond_3: "ماسية III",
  diamond_4: "ماسية IV",
  emerald: "زمردة",
};

type VerificationBadgeProps = {
  size?: "sm" | "md" | "lg";
  className?: string;
};

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
      <BadgeCheck
        className={cn(
          sizeClasses[size],
          "text-primary fill-primary/20 drop-shadow-sm relative z-10"
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

export function OrderBadge({ tier, size = "sm", className, showLabel = false }: OrderBadgeProps) {
  if (tier === "none" || !tier) return null;

  const sizeClasses = {
    sm: "h-3 w-3",
    md: "h-3.5 w-3.5",
    lg: "h-4 w-4",
  };

  const config: Record<Exclude<BadgeTier, "none">, {
    icon: React.ReactNode;
    bg: string;
    text: string;
    border: string;
  }> = {
    silver: {
      icon: <Medal className={sizeClasses[size]} />,
      bg: "bg-muted/80",
      text: "text-muted-foreground",
      border: "border-border",
    },
    gold: {
      icon: <Crown className={sizeClasses[size]} />,
      bg: "bg-amber-500/10",
      text: "text-amber-500",
      border: "border-amber-500/30",
    },
    diamond_1: {
      icon: <Diamond className={sizeClasses[size]} />,
      bg: "bg-sky-500/10",
      text: "text-sky-400",
      border: "border-sky-500/30",
    },
    diamond_2: {
      icon: <Diamond className={sizeClasses[size]} />,
      bg: "bg-blue-500/10",
      text: "text-blue-400",
      border: "border-blue-500/30",
    },
    diamond_3: {
      icon: <Diamond className={sizeClasses[size]} />,
      bg: "bg-indigo-500/10",
      text: "text-indigo-400",
      border: "border-indigo-500/30",
    },
    diamond_4: {
      icon: <Diamond className={sizeClasses[size]} />,
      bg: "bg-violet-500/10",
      text: "text-violet-400",
      border: "border-violet-500/30",
    },
    emerald: {
      icon: <Gem className={sizeClasses[size]} />,
      bg: "bg-primary/10",
      text: "text-primary",
      border: "border-primary/30",
    },
  };

  const tierConfig = config[tier as Exclude<BadgeTier, "none">];
  if (!tierConfig) return null;
  const { icon, bg, text, border } = tierConfig;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-0.5 shrink-0 rounded-md px-1.5 py-0.5 text-[9px] font-bold border",
        bg, text, border,
        className
      )}
      title={BADGE_TIER_LABELS[tier]}
    >
      {icon}
      {showLabel && (
        <span>{BADGE_TIER_LABELS[tier]}</span>
      )}
      {tier === "emerald" && (
        <Sparkles className="h-2 w-2 animate-pulse" />
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
      <OrderBadge tier={badgeTier} size={size} showLabel />
    </div>
  );
}
