import { useActiveWarrantyBenefits } from "@/hooks/useCartWarrantyBenefits";
import { useActiveSubscriptionBenefits } from "@/hooks/useCartSubscriptionBenefits";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/lib/i18n";
import { Shield, Sparkles, Truck, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/utils";

interface UnifiedRow {
  key: string;
  source: "warranty" | "subscription";
  label: string; // model name or fallback
  badge: string | null; // plan name when subscription
  activationDay: number;
  discountPct: number;
  discountCap: number;
  discountUsed: number;
  shipMax: number;
  shipUsed: number;
  shipMin: number;
}

export default function WarrantyBenefitsCard() {
  const { t } = useLanguage();
  const { data: warranties, isLoading: lw } = useActiveWarrantyBenefits();
  const { data: subscriptions, isLoading: ls } = useActiveSubscriptionBenefits();

  if (lw || ls) return null;

  const rows: UnifiedRow[] = [];

  for (const w of (warranties || []).filter((x) => x.is_benefits_active)) {
    rows.push({
      key: `w-${w.user_printer_id}`,
      source: "warranty",
      label: w.model_name_ar || w.serial_number || "",
      badge: null,
      activationDay: w.activation_date ? new Date(w.activation_date).getDate() : 1,
      discountPct: Number(w.discount_percentage) || 0,
      discountCap: Number(w.discount_max_amount_monthly) || 0,
      discountUsed: Number(w.discount_used) || 0,
      shipMax: Number(w.free_shipping_max_uses_monthly) || 0,
      shipUsed: Number(w.free_shipping_used) || 0,
      shipMin: Number(w.free_shipping_min_order) || 0,
    });
  }

  for (const s of (subscriptions || []).filter((x) => x.is_benefits_active)) {
    rows.push({
      key: `s-${s.subscription_id}`,
      source: "subscription",
      label: s.model_name_ar || s.serial_number || "",
      badge: s.plan_name_ar || s.plan_badge_text || null,
      activationDay: s.start_date ? new Date(s.start_date).getDate() : 1,
      discountPct: Number(s.discount_percentage) || 0,
      discountCap: Number(s.discount_max_amount_monthly) || 0,
      discountUsed: Number(s.discount_used) || 0,
      shipMax: Number(s.free_shipping_max_uses_monthly) || 0,
      shipUsed: Number(s.free_shipping_used) || 0,
      shipMin: Number(s.free_shipping_min_order) || 0,
    });
  }

  if (rows.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-600" />
        {t('warranty_benefits_title')}
      </h3>
      {rows.map((r) => {
        const discountRemaining = Math.max(0, r.discountCap - r.discountUsed);
        const shippingRemaining = Math.max(0, r.shipMax - r.shipUsed);
        return (
          <Card
            key={r.key}
            className="p-4 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
          >
            <div className="flex items-center justify-between mb-3 gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <div className="font-bold text-foreground text-sm truncate">{r.label}</div>
                {r.source === "subscription" ? (
                  <Badge className="text-[10px] bg-amber-500/15 text-amber-700 border-amber-500/30 shrink-0">
                    {r.badge ? `باقة الحماية: ${r.badge}` : 'باقة الحماية (اشتراك مدفوع)'}
                  </Badge>
                ) : (
                  <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30 shrink-0">
                    الضمان الرسمي (مجاني)
                  </Badge>
                )}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1 shrink-0">
                <Calendar className="h-3 w-3" />
                {t('warranty_benefits_renews_on_day', { day: r.activationDay })}
              </div>
            </div>

            {r.discountPct > 0 && (
              <div className="rounded-lg bg-background/60 p-3 mb-2 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {t('warranty_benefits_discount_label')} — {r.discountPct}%
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t('warranty_benefits_remaining')}: {formatPrice(discountRemaining)} / {formatPrice(r.discountCap)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {r.shipMax > 0 && (
              <div className="rounded-lg bg-background/60 p-3 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {t('warranty_benefits_free_shipping_label')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t('warranty_benefits_remaining')}: {shippingRemaining} / {r.shipMax}
                      {r.shipMin > 0 && (
                        <> · {t('warranty_benefits_min_order', { amount: formatPrice(r.shipMin) })}</>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </Card>
        );
      })}
    </div>
  );
}
