import { useState } from 'react';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useInsurancePlans } from '@/hooks/useCartInsurance';
import { useActiveLevoCard } from '@/hooks/useActiveLevoCard';
import { ShieldCheck, Info, Sparkles } from 'lucide-react';
import { Link } from 'react-router-dom';
import InsuranceInfoDialog from '@/components/insurance/InsuranceInfoDialog';
import { useLanguage } from '@/lib/i18n';

const AddonInsuranceShowcase = () => {
  const { t, language } = useLanguage();
  const { data: plans = [] } = useInsurancePlans();
  const { data: card } = useActiveLevoCard();
  const [infoOpen, setInfoOpen] = useState(false);

  if (!plans || plans.length === 0) return null;
  const planName = (p: any) => language === 'ar' ? p.name_ar : language === 'ku' ? (p.name_ku || p.name_ar) : (p.name_en || p.name_ar);

  return (
    <Card className="p-4 border-primary/40 bg-primary/5">
      <div className="flex items-start justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-primary" />
          <h3 className="font-bold text-base">{t('insurance_addon_tab')}</h3>
        </div>
        <button onClick={() => setInfoOpen(true)} className="h-6 w-6 rounded-full bg-primary/20 flex items-center justify-center hover:bg-primary/30">
          <Info className="h-3.5 w-3.5 text-primary" />
        </button>
      </div>

      {!card && (
        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-2 text-xs flex items-center justify-between gap-2 mb-3">
          <span className="text-amber-700 dark:text-amber-300">{t('insurance_requires_card')}</span>
          <Link to="/membership-cards">
            <Button size="sm" variant="outline" className="h-7 text-[11px]"><Sparkles className="h-3 w-3 ml-1"/>{t('insurance_get_card_cta')}</Button>
          </Link>
        </div>
      )}

      <div className="grid gap-2 sm:grid-cols-2">
        {plans.map((p: any) => (
          <div key={p.id} className="rounded-lg border border-border/40 bg-card p-3">
            <div className="flex items-center gap-2 mb-1">
              <ShieldCheck className="h-4 w-4 text-primary" />
              <span className="font-bold text-sm">{planName(p)}</span>
            </div>
            <div className="text-xs text-muted-foreground">
              {p.coverage_months} شهر · {p.price_percentage}% من سعر الطابعة
            </div>
          </div>
        ))}
      </div>

      <p className="text-[11px] text-muted-foreground mt-3">
        لإضافة التأمين، توجه إلى السلة بعد إضافة الطابعة واضغط "أضف تأمين إضافي" على الطابعة.
      </p>

      <InsuranceInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </Card>
  );
};

export default AddonInsuranceShowcase;
