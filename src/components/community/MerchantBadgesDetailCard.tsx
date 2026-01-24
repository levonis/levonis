import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles, ShieldCheck, TrendingUp } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { BadgeTier, BADGE_TIER_LABELS } from "./MerchantBadges";

type Props = {
  isVerified: boolean;
  badgeTier: BadgeTier;
  className?: string;
};

const tierConfig: Record<Exclude<BadgeTier, "none">, {
  icon: React.ReactNode;
  color: string;
  bgColor: string;
  description: string;
}> = {
  silver: {
    icon: <Medal className="h-6 w-6" />,
    color: "text-slate-500",
    bgColor: "bg-slate-100 border-slate-200",
    description: "تاجر نشط مع 11-50 طلب مكتمل",
  },
  gold: {
    icon: <Crown className="h-6 w-6" />,
    color: "text-amber-500",
    bgColor: "bg-amber-50 border-amber-200",
    description: "تاجر متميز مع 51-100 طلب مكتمل",
  },
  diamond_1: {
    icon: <Diamond className="h-6 w-6" />,
    color: "text-sky-500",
    bgColor: "bg-sky-50 border-sky-200",
    description: "تاجر محترف مع أكثر من 100 طلب مكتمل",
  },
  diamond_2: {
    icon: <Diamond className="h-6 w-6" />,
    color: "text-sky-600",
    bgColor: "bg-sky-100 border-sky-300",
    description: "تاجر خبير مع 500+ طلب شهريًا بشكل مستمر",
  },
  diamond_3: {
    icon: <Diamond className="h-6 w-6" />,
    color: "text-indigo-500",
    bgColor: "bg-indigo-50 border-indigo-200",
    description: "تاجر متقدم مع 1000+ طلب شهريًا بشكل مستمر",
  },
  diamond_4: {
    icon: <Diamond className="h-6 w-6" />,
    color: "text-indigo-600",
    bgColor: "bg-indigo-100 border-indigo-300",
    description: "تاجر نخبة مع 2000+ طلب شهريًا بشكل مستمر",
  },
  emerald: {
    icon: <Gem className="h-6 w-6" />,
    color: "text-emerald-500",
    bgColor: "bg-emerald-50 border-emerald-200",
    description: "أعلى مستوى! 3000+ طلب شهريًا بشكل مستمر",
  },
};

/**
 * عرض تفصيلي لشارات التاجر في صفحة المتجر
 */
export default function MerchantBadgesDetailCard({ isVerified, badgeTier, className }: Props) {
  const hasBadges = isVerified || badgeTier !== "none";
  
  if (!hasBadges) return null;

  const tierInfo = badgeTier !== "none" ? tierConfig[badgeTier] : null;

  return (
    <Card className={`border-border bg-card ${className}`}>
      <CardContent className="p-4 space-y-4">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="text-sm font-bold text-foreground">شارات التاجر</h3>
        </div>

        <div className="grid gap-3">
          {/* Verification Badge */}
          {isVerified && (
            <div className="flex items-start gap-3 p-3 rounded-xl bg-amber-50 border border-amber-200">
              <div className="h-10 w-10 rounded-xl bg-amber-100 flex items-center justify-center shrink-0">
                <BadgeCheck className="h-5 w-5 text-amber-600" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold text-amber-700">تاجر موثوق</span>
                  <span className="inline-flex items-center gap-1 rounded-full bg-amber-200 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                    <BadgeCheck className="h-3 w-3" />
                    معتمد
                  </span>
                </div>
                <p className="text-xs text-amber-600/80 mt-1">
                  هذا التاجر تم التحقق منه واعتماده من قبل منصة ليفو
                </p>
              </div>
            </div>
          )}

          {/* Order Volume Badge */}
          {tierInfo && (
            <div className={`flex items-start gap-3 p-3 rounded-xl border ${tierInfo.bgColor}`}>
              <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 ${tierInfo.bgColor} ${tierInfo.color}`}>
                {badgeTier === "emerald" ? (
                  <div className="relative animate-pulse">
                    <Sparkles className="h-4 w-4 absolute -top-1 -right-1 text-emerald-400" />
                    {tierInfo.icon}
                  </div>
                ) : (
                  tierInfo.icon
                )}
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className={`text-sm font-bold ${tierInfo.color}`}>
                    شارة {BADGE_TIER_LABELS[badgeTier]}
                  </span>
                  {badgeTier === "emerald" && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-emerald-200 px-2 py-0.5 text-[10px] font-bold text-emerald-800 animate-pulse">
                      <Sparkles className="h-3 w-3" />
                      الأعلى
                    </span>
                  )}
                </div>
                <p className={`text-xs mt-1 opacity-80 ${tierInfo.color}`}>
                  {tierInfo.description}
                </p>
                <div className="flex items-center gap-1 mt-2">
                  <TrendingUp className={`h-3 w-3 ${tierInfo.color}`} />
                  <span className={`text-[10px] font-medium ${tierInfo.color}`}>
                    مستوى الأداء: {BADGE_TIER_LABELS[badgeTier]}
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
