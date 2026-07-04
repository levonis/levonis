import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Shield, Check } from "lucide-react";
import { toast } from "sonner";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";
import SubscriptionDurationDialog from "@/components/subscriptions/SubscriptionDurationDialog";

export default function AllPlansPanel() {
  const { t } = useLanguage();
  const { fmt } = useNumberFormat();
  const qc = useQueryClient();
  const [selectedPlan, setSelectedPlan] = useState<any | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const { data: plans, isLoading } = useQuery({
    queryKey: ['all-protection-plans-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-48 w-full" />
        ))}
      </div>
    );
  }

  if (!plans || plans.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          {t('ap_no_plans')}
        </CardContent>
      </Card>
    );
  }

  const openSubscribe = (plan: any) => {
    setSelectedPlan(plan);
    setDialogOpen(true);
  };

  const handleConfirm = async ({ tier, quote, user_printer_id }: any) => {
    if (!selectedPlan || !user_printer_id) {
      toast.error(t('sub_no_printers'));
      return;
    }
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('subscribe_protection_plan', {
        p_plan_id: selectedPlan.id,
        p_user_printer_id: user_printer_id,
        p_duration_months: tier.duration_months,
        p_expected_total: quote.final,
        p_discount_percentage: tier.discount_percentage,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      toast.success(t('sub_success'));
      setDialogOpen(false);
      setSelectedPlan(null);
      qc.invalidateQueries({ queryKey: ['active-subscription-benefits'] });
    } catch (e: any) {
      toast.error(e?.message || t('sub_error'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-4">
      {plans.map((plan) => (
        <Card 
          key={plan.id}
          className="overflow-hidden"
        >
          <CardContent className="p-4">
            <div className="flex items-start gap-3 mb-3">
              <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                <Shield className="h-6 w-6 text-green-500" />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-bold text-lg">{plan.name_ar}</p>
                  {plan.badge_text && (
                    <Badge variant="secondary" className="text-[10px]">
                      {plan.badge_text}
                    </Badge>
                  )}
                </div>
                <p className="text-xl font-bold text-primary mt-1">
                  {fmt(plan.monthly_price ?? 0)} {t('common_iqd')}
                  <span className="text-sm font-normal text-muted-foreground">{t('ap_per_month_short')}</span>
                </p>
              </div>
            </div>

            {plan.description_ar && (
              <p className="text-sm text-muted-foreground mb-3">
                {plan.description_ar}
              </p>
            )}

            {plan.features && Array.isArray(plan.features) && (
              <div className="space-y-1.5 mb-4">
                {(plan.features as string[]).slice(0, 4).map((feature, idx) => (
                  <div key={idx} className="flex items-center gap-2 text-sm">
                    <Check className="h-4 w-4 text-green-500 shrink-0" />
                    <span>{feature}</span>
                  </div>
                ))}
              </div>
            )}

            <Button
              className="w-full"
              onClick={() => openSubscribe(plan)}
            >
              {t('ap_subscribe_now')}
            </Button>
          </CardContent>
        </Card>
      ))}

      {selectedPlan && (
        <SubscriptionDurationDialog
          open={dialogOpen}
          onOpenChange={(v) => { setDialogOpen(v); if (!v) setSelectedPlan(null); }}
          targetType="protection_plan"
          title={selectedPlan.name_ar}
          monthlyPrice={Number(selectedPlan.monthly_price) || 0}
          requirePrinter
          confirming={busy}
          onConfirm={handleConfirm}
        />
      )}
    </div>
  );
}
