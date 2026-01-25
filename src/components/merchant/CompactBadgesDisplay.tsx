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
  borderColor: string;
  description: string;
}> = {
  silver: {
    icon: <Medal className="h-3 w-3" />,
    color: "text-slate-300",
    bgColor: "bg-slate-700/50",
    borderColor: "border-slate-500/50",
    description: "11-50 طلب مكتمل",
  },
  gold: {
    icon: <Crown className="h-3 w-3" />,
    color: "text-amber-400",
    bgColor: "bg-amber-900/40",
    borderColor: "border-amber-500/50",
    description: "51-100 طلب مكتمل",
  },
  diamond_1: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-sky-400",
    bgColor: "bg-sky-900/40",
    borderColor: "border-sky-500/50",
    description: "100+ طلب مكتمل",
  },
  diamond_2: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-sky-300",
    bgColor: "bg-sky-800/50",
    borderColor: "border-sky-400/50",
    description: "500+ طلب شهرياً",
  },
  diamond_3: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-indigo-400",
    bgColor: "bg-indigo-900/40",
    borderColor: "border-indigo-500/50",
    description: "1000+ طلب شهرياً",
  },
  diamond_4: {
    icon: <Diamond className="h-3 w-3" />,
    color: "text-indigo-300",
    bgColor: "bg-indigo-800/50",
    borderColor: "border-indigo-400/50",
    description: "2000+ طلب شهرياً",
  },
  emerald: {
    icon: <Gem className="h-3 w-3" />,
    color: "text-emerald-400",
    bgColor: "bg-emerald-900/40",
    borderColor: "border-emerald-500/50",
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
      <div className={`flex items-center gap-1.5 flex-wrap ${className}`}>
        {/* Verification Badge - Golden with border */}
        {isVerified && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-900/40 border border-amber-500/50 text-amber-400 text-[10px] font-bold shadow-sm">
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

        {/* Performance Badge - With enhanced styling */}
        {tierInfo && (
          <Tooltip>
            <TooltipTrigger asChild>
              <div className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${tierInfo.bgColor} ${tierInfo.borderColor} ${tierInfo.color} text-[10px] font-bold shadow-sm`}>
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
