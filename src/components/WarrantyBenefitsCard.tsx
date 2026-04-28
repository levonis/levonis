import { useActiveWarrantyBenefits } from "@/hooks/useCartWarrantyBenefits";
import { Card } from "@/components/ui/card";
import { useLanguage } from "@/lib/i18n";
import { Shield, Sparkles, Truck, Calendar } from "lucide-react";
import { formatPrice } from "@/lib/utils";

export default function WarrantyBenefitsCard() {
  const { t } = useLanguage();
  const { data: warranties, isLoading } = useActiveWarrantyBenefits();

  if (isLoading) return null;
  if (!warranties || warranties.length === 0) return null;

  // Show only the warranties that have benefits enabled
  const active = warranties.filter((w) => w.is_benefits_active);
  if (active.length === 0) return null;

  return (
    <div className="space-y-3">
      <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
        <Shield className="h-4 w-4 text-emerald-600" />
        {t('warranty_benefits_title')}
      </h3>
      {active.map((w) => {
        const day = w.activation_date ? new Date(w.activation_date).getDate() : 1;
        const discountRemaining = Math.max(
          0,
          (w.discount_max_amount_monthly || 0) - (w.discount_used || 0)
        );
        const shippingRemaining = Math.max(
          0,
          (w.free_shipping_max_uses_monthly || 0) - (w.free_shipping_used || 0)
        );
        return (
          <Card
            key={w.user_printer_id}
            className="p-4 border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-emerald-500/5 to-transparent"
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold text-foreground text-sm">
                {w.model_name_ar || w.serial_number}
              </div>
              <div className="text-[10px] text-muted-foreground flex items-center gap-1">
                <Calendar className="h-3 w-3" />
                {t('warranty_benefits_renews_on_day', { day })}
              </div>
            </div>

            {(w.discount_percentage || 0) > 0 && (
              <div className="rounded-lg bg-background/60 p-3 mb-2 border border-emerald-500/20">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4 text-emerald-600" />
                    <div>
                      <div className="text-xs font-bold text-foreground">
                        {t('warranty_benefits_discount_label')} — {w.discount_percentage}%
                      </div>
                      <div className="text-[10px] text-muted-foreground">
                        {t('warranty_benefits_remaining')}: {formatPrice(discountRemaining)} / {formatPrice(w.discount_max_amount_monthly || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {(w.free_shipping_max_uses_monthly || 0) > 0 && (
              <div className="rounded-lg bg-background/60 p-3 border border-emerald-500/20">
                <div className="flex items-center gap-2">
                  <Truck className="h-4 w-4 text-emerald-600" />
                  <div>
                    <div className="text-xs font-bold text-foreground">
                      {t('warranty_benefits_free_shipping_label')}
                    </div>
                    <div className="text-[10px] text-muted-foreground">
                      {t('warranty_benefits_remaining')}: {shippingRemaining} / {w.free_shipping_max_uses_monthly}
                      {(w.free_shipping_min_order || 0) > 0 && (
                        <> · {t('warranty_benefits_min_order', { amount: formatPrice(w.free_shipping_min_order) })}</>
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
