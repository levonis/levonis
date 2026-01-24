import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { BadgeTier, BADGE_TIER_LABELS } from "@/components/community/MerchantBadges";

type Props = {
  isVerified: boolean;
  badgeTier: BadgeTier;
  badgeOverride: boolean;
  onVerifiedChange: (val: boolean) => void;
  onBadgeTierChange: (val: BadgeTier) => void;
  onBadgeOverrideChange: (val: boolean) => void;
  disabled?: boolean;
};

const BADGE_TIERS: BadgeTier[] = [
  "none",
  "silver",
  "gold",
  "diamond_1",
  "diamond_2",
  "diamond_3",
  "diamond_4",
  "emerald",
];

const tierIcons: Record<BadgeTier, React.ReactNode> = {
  none: null,
  silver: <Medal className="h-4 w-4 text-slate-400" />,
  gold: <Crown className="h-4 w-4 text-amber-500" />,
  diamond_1: <Diamond className="h-4 w-4 text-sky-500" />,
  diamond_2: <Diamond className="h-4 w-4 text-sky-600" />,
  diamond_3: <Diamond className="h-4 w-4 text-indigo-500" />,
  diamond_4: <Diamond className="h-4 w-4 text-indigo-600" />,
  emerald: <Gem className="h-4 w-4 text-emerald-500" />,
};

export default function MerchantBadgesEditor({
  isVerified,
  badgeTier,
  badgeOverride,
  onVerifiedChange,
  onBadgeTierChange,
  onBadgeOverrideChange,
  disabled = false,
}: Props) {
  return (
    <div className="space-y-4">
      {/* Golden Verification Badge */}
      <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/20 p-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
            <BadgeCheck className="h-5 w-5 text-amber-500" />
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">شارة التوثيق الذهبية</div>
            <div className="text-xs text-muted-foreground">تاجر موثوق من المنصة</div>
          </div>
        </div>
        <Switch
          checked={isVerified}
          onCheckedChange={onVerifiedChange}
          disabled={disabled}
        />
      </div>

      {/* Order Volume Badge */}
      <div className="rounded-xl border border-border bg-muted/20 p-3 space-y-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
            {badgeTier === "emerald" ? (
              <Sparkles className="h-5 w-5 text-emerald-500" />
            ) : (
              <Diamond className="h-5 w-5 text-primary" />
            )}
          </div>
          <div>
            <div className="text-sm font-semibold text-foreground">شارة حجم الطلبات</div>
            <div className="text-xs text-muted-foreground">تُحسب تلقائيًا أو يدويًا</div>
          </div>
        </div>

        <div className="flex items-center justify-between gap-3">
          <Label className="text-xs text-muted-foreground">تعديل يدوي (تجاوز الحساب التلقائي)</Label>
          <Switch
            checked={badgeOverride}
            onCheckedChange={onBadgeOverrideChange}
            disabled={disabled}
          />
        </div>

        <div className="flex items-center gap-3">
          <Label className="text-xs text-muted-foreground shrink-0">مستوى الشارة</Label>
          <Select
            value={badgeTier}
            onValueChange={(v) => onBadgeTierChange(v as BadgeTier)}
            disabled={disabled || !badgeOverride}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="اختر المستوى" />
            </SelectTrigger>
            <SelectContent>
              {BADGE_TIERS.map((tier) => (
                <SelectItem key={tier} value={tier}>
                  <div className="flex items-center gap-2">
                    {tierIcons[tier]}
                    <span>{BADGE_TIER_LABELS[tier]}</span>
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {!badgeOverride && (
          <p className="text-xs text-muted-foreground bg-muted/30 p-2 rounded-lg">
            الشارة تُحسب تلقائيًا بناءً على عدد الطلبات المكتملة في آخر 30 يوم مع شرط الاستمرارية.
            فعّل "التعديل اليدوي" لتجاوز الحساب التلقائي.
          </p>
        )}
      </div>
    </div>
  );
}
