import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';
import { useInsurancePlans, useCartInsuranceAddons, computeInsurancePrice, InsurancePlan } from '@/hooks/useCartInsurance';
import { useActiveLevoCard } from '@/hooks/useActiveLevoCard';
import { ShieldCheck, Sparkles, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItemId: string;
  printerProductId: string;
  printerCategoryId?: string | null;
  printerPriceIqd: number;
  printerNameAr: string;
}

const formatPrice = (n: number) => n.toLocaleString('en-US');

const AddInsuranceDialog = ({ open, onOpenChange, cartItemId, printerProductId, printerCategoryId, printerPriceIqd, printerNameAr }: Props) => {
  const { t, language } = useLanguage();
  const { data: plans = [], isLoading } = useInsurancePlans(printerCategoryId);
  const { data: card } = useActiveLevoCard();
  const { addInsurance, isAdding } = useCartInsuranceAddons();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  const hasCard = !!card;
  const planName = (p: InsurancePlan) => language === 'ar' ? p.name_ar : language === 'ku' ? (p.name_ku || p.name_ar) : (p.name_en || p.name_ar);

  const handleAdd = (plan: InsurancePlan) => {
    if (!hasCard && plan.requires_active_card) return;
    const price = computeInsurancePrice(plan, printerPriceIqd);
    addInsurance({
      cartItemId,
      planId: plan.id,
      printerProductId,
      coverageMonths: plan.coverage_months,
      priceIqd: price,
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="h-5 w-5 text-primary" />
            {t('insurance_choose_plan_addon')}
          </DialogTitle>
          <DialogDescription className="text-xs text-muted-foreground line-clamp-1">
            {printerNameAr}
          </DialogDescription>
        </DialogHeader>

        {!hasCard && (
          <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 text-xs flex items-center justify-between gap-2">
            <span className="text-amber-700 dark:text-amber-300">{t('insurance_requires_card')}</span>
            <Link to="/membership-cards" onClick={() => onOpenChange(false)}>
              <Button size="sm" variant="outline" className="h-7 text-[11px]">
                <Sparkles className="h-3 w-3 ml-1" />
                {t('insurance_get_card_cta')}
              </Button>
            </Link>
          </div>
        )}

        {isLoading ? (
          <div className="py-6 flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-primary" /></div>
        ) : plans.length === 0 ? (
          <div className="py-6 text-center text-sm text-muted-foreground">{t('insurance_no_eligible_plans')}</div>
        ) : (
          <div className="space-y-2">
            {plans.map((plan) => {
              const price = computeInsurancePrice(plan, printerPriceIqd);
              const isSelected = selectedId === plan.id;
              const disabled = !hasCard && plan.requires_active_card;
              return (
                <button
                  key={plan.id}
                  type="button"
                  disabled={disabled || isAdding}
                  onClick={() => { setSelectedId(plan.id); handleAdd(plan); }}
                  className={`w-full text-right rounded-xl border p-3 transition-all ${isSelected ? 'border-primary bg-primary/10' : 'border-border/50 hover:border-primary/40 hover:bg-primary/5'} ${disabled ? 'opacity-50 cursor-not-allowed' : ''}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <ShieldCheck className="h-4 w-4 text-primary" />
                      <span className="font-bold text-sm">{planName(plan)}</span>
                    </div>
                    <span className="text-sm font-black text-primary">
                      {formatPrice(price)} {t('cart_iqd_short')}
                    </span>
                  </div>
                  <div className="text-[11px] text-muted-foreground mt-1">
                    {plan.coverage_months} {t('insurance_month' as any)} · {t('insurance_per_printer')}
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};

export default AddInsuranceDialog;
