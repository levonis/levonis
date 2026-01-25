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
  color: string;
  bgColor: string;
  description: string;
}> = {
  silver: {
    icon: <Medal className="h-3 w-3" />,
    color: "text-slate-600",
    bgColor: "bg-slate-500/20",
    description: "11-50 طلب مكتمل",
  },
  gold: {
    icon: <Crown className="h-3 w-3" />,
    color: "text-amber-600",
    bgColor: "bg-amber-500/20",
    description: "51-100 طلب مكتمل",
  },
  diamond_1: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-sky-600",
    bgColor: "bg-sky-500/20",
    description: "100+ طلب مكتمل",
  },
  diamond_2: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-sky-700",
    bgColor: "bg-sky-600/20",
    description: "500+ طلب شهرياً",
  },
  diamond_3: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-500/20",
    description: "1000+ طلب شهرياً",
  },
  diamond_4: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-indigo-700",
    bgColor: "bg-indigo-600/20",
    description: "2000+ طلب شهرياً",
  },
  emerald: {
    icon: <Gem className="h-3 w-3" />,
    color: "text-emerald-600",
    bgColor: "bg-emerald-500/20",
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
      <div className={`flex items-center gap-1.5 ${className}`}>
        {/* Verification Badge - Compact */}
        {isVerified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 px-2 py-1 rounded-md bg-amber-500/20 text-amber-700 text-[10px] font-semibold">
                <BadgeCheck className="h-3 w-3" />
                موثوق
              </div>
            </TooltipTrigger>
            <TooltipContent side="top" className="text-xs">
              تم التحقق من هذا التاجر واعتماده من قبل ليفو
            </TooltipContent>
          </Tooltip>
        )}

        {/* Performance Badge - Compact */}
        {tierInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center gap-1 px-2 py-1 rounded-md ${tierInfo.bgColor} ${tierInfo.color} text-[10px] font-semibold`}>
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
            <TooltipContent side="top" className="text-xs">
              {tierInfo.description}
            </TooltipContent>
          </Tooltip>
        )}
      </div>
    </TooltipProvider>
  );
}

const CompactBadgesDisplay = memo(CompactBadgesDisplayBase);
export default CompactBadgesDisplay;
