import { ArrowRight, Gift, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useUserGachaCoupons } from "./useGachaData";
import { formatDistanceToNow } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";
import { pickI18n } from "@/lib/i18nField";

interface Props {
  onBack: () => void;
}

export default function GachaCoupons({ onBack }: Props) {
  const { data: coupons = [], isLoading } = useUserGachaCoupons();

  const active = coupons.filter((c: any) => !c.is_used && (!c.expires_at || new Date(c.expires_at) > new Date()));
  const used = coupons.filter((c: any) => c.is_used || (c.expires_at && new Date(c.expires_at) <= new Date()));

  return (
    <div className="min-h-screen pb-20" dir="rtl">
      <div className="sticky top-0 z-20 bg-background/80 backdrop-blur-xl border-b border-primary/20">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={onBack} className="gap-1 text-muted-foreground">
            <ArrowRight className="h-4 w-4" /> رجوع
          </Button>
          <span className="text-sm font-bold text-foreground flex items-center gap-2">
            <Gift className="h-4 w-4 text-primary" /> كوبوناتي
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-3">
        {isLoading ? (
          <div className="space-y-2">
            {[1,2,3].map(i => <div key={i} className="h-20 rounded-xl bg-card animate-pulse" />)}
          </div>
        ) : active.length === 0 && used.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground">
            <span className="text-4xl mb-3 block">🎟️</span>
            <p className="text-sm">لا تملك كوبونات</p>
          </div>
        ) : (
          <>
            {active.length > 0 && (
              <>
                <h3 className="text-xs font-bold text-foreground mb-2">نشطة ({active.length})</h3>
                <div className="space-y-2 mb-4">
                  {active.map((c: any) => (
                    <CouponCard key={c.id} coupon={c} />
                  ))}
                </div>
              </>
            )}
            {used.length > 0 && (
              <>
                <h3 className="text-xs font-bold text-muted-foreground mb-2">مستخدمة / منتهية ({used.length})</h3>
                <div className="space-y-2 opacity-50">
                  {used.map((c: any) => (
                    <CouponCard key={c.id} coupon={c} />
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function CouponCard({ coupon }: { coupon: any }) {
  const { language } = useLanguage();
  const def = coupon.gacha_coupons;
  const isExpired = coupon.expires_at && new Date(coupon.expires_at) <= new Date();
  const title = pickI18n(def, "title", language) || (language === 'en' ? 'Coupon' : language === 'ku' ? 'کوپۆن' : 'كوبون');
  const description = pickI18n(def, "description", language);

  return (
    <div className={`flex items-center gap-3 p-3 rounded-xl bg-card border ${coupon.is_used || isExpired ? "border-border/10" : "border-green-500/20"}`}>
      <div className="w-12 h-12 rounded-lg bg-green-500/10 flex items-center justify-center text-xl">
        🎟️
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-foreground">{title}</p>
        {description && (
          <p className="text-[10px] text-muted-foreground line-clamp-1">{description}</p>
        )}
        {coupon.expires_at && !coupon.is_used && !isExpired && (
          <p className="text-[10px] text-amber-500 flex items-center gap-1 mt-0.5">
            <Clock className="h-2.5 w-2.5" />
            ينتهي {formatDistanceToNow(new Date(coupon.expires_at), { addSuffix: true, locale: ar })}
          </p>
        )}
      </div>
      {def?.discount_value && (
        <span className="text-sm font-bold text-green-500">
          {def.discount_type === "percentage" ? `${def.discount_value}%` : `${def.discount_value}`}
        </span>
      )}
    </div>
  );
}
