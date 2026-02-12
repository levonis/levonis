import { memo } from "react";
import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles } from "lucide-react";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

export type BadgeTier = "none" | "silver" | "gold" | "diamond_1" | "diamond_2" | "diamond_3" | "diamond_4" | "emerald";

const BADGE_TIER_LABELS: Record<BadgeTier, string> = {
  none: "",
  silver: "فضي",
  gold: "ذهبي",
  diamond_1: "ماسي",
  diamond_2: "ماسي II",
  diamond_3: "ماسي III",
  diamond_4: "ماسي IV",
  emerald: "زمردي",
};

const tierConfig: Record<Exclude<BadgeTier, "none">, {
  icon: React.ReactNode;
  text: string;
  bg: string;
  border: string;
  description: string;
}> = {
  silver: {
    icon: <Medal className="h-3 w-3" />,
    text: "text-muted-foreground",
    bg: "bg-muted/80",
    border: "border-border",
    description: "11-50 طلب مكتمل",
  },
  gold: {
    icon: <Crown className="h-3 w-3" />,
    text: "text-amber-500",
    bg: "bg-amber-500/10",
    border: "border-amber-500/30",
    description: "51-100 طلب مكتمل",
  },
  diamond_1: {
    icon: <Diamond className="h-3 w-3" />,
    text: "text-sky-400",
    bg: "bg-sky-500/10",
    border: "border-sky-500/30",
    description: "100+ طلب مكتمل",
  },
  diamond_2: {
    icon: <Diamond className="h-3 w-3" />,
    text: "text-blue-400",
    bg: "bg-blue-500/10",
    border: "border-blue-500/30",
    description: "500+ طلب شهرياً",
  },
  diamond_3: {
    icon: <Diamond className="h-3 w-3" />,
    text: "text-indigo-400",
    bg: "bg-indigo-500/10",
    border: "border-indigo-500/30",
    description: "1000+ طلب شهرياً",
  },
  diamond_4: {
    icon: <Diamond className="h-3 w-3" />,
    text: "text-violet-400",
    bg: "bg-violet-500/10",
    border: "border-violet-500/30",
    description: "2000+ طلب شهرياً",
  },
  emerald: {
    icon: <Gem className="h-3 w-3" />,
    text: "text-primary",
    bg: "bg-primary/10",
    border: "border-primary/30",
    description: "3000+ طلب شهرياً",
  },
};

interface CompactBadgesDisplayProps {
  isVerified: boolean;
  badgeTier: BadgeTier;
  className?: string;
}

function CompactBadgesDisplayBase({ isVerified, badgeTier, className = "" }: CompactBadgesDisplayProps) {
  const hasBadges = isVerified || badgeTier !== "none";
  if (!hasBadges) return null;

  const tierInfo = badgeTier !== "none" ? tierConfig[badgeTier] : null;

  return (
    <TooltipProvider>
      <div className={`flex items-center gap-1 flex-wrap ${className}`}>
        {isVerified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-primary/10 border border-primary/30 text-primary text-[10px] font-bold">
                <BadgeCheck className="h-3 w-3" />
                موثوق
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              <p className="font-semibold mb-1">تاجر موثوق ✓</p>
              <p className="text-muted-foreground">تم التحقق من هذا التاجر واعتماده رسمياً من قبل ليفو</p>
            </TooltipContent>
          </Tooltip>
        )}

        {tierInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md border ${tierInfo.bg} ${tierInfo.border} ${tierInfo.text} text-[10px] font-bold`}>
                {badgeTier === "emerald" ? (
                  <span className="relative">
                    <Sparkles className="h-2 w-2 absolute -top-0.5 -right-0.5 animate-pulse" />
                    {tierInfo.icon}
                  </span>
                ) : (
                  tierInfo.icon
                )}
                {BADGE_TIER_LABELS[badgeTier]}
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs max-w-[200px]">
              <p className="font-semibold mb-1">رتبة {BADGE_TIER_LABELS[badgeTier]}</p>
              <p className="text-muted-foreground">{tierInfo.description}</p>
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

const CompactBadgesDisplay = memo(CompactBadgesDisplayBase);
export default CompactBadgesDisplay;
