import { useEffect, useMemo, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Check, Sparkles, Crown, Printer } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useNumberFormat } from '@/lib/i18n/numberFormat';
import { useSubscriptionTiers, SubTargetType, SubscriptionDurationTier } from '@/hooks/useSubscriptionTiers';
import { computeDurationQuote } from '@/lib/subscriptionPricing';
import { useAuth } from '@/hooks/useAuth';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  targetType: SubTargetType;
  title?: string;
  /** Monthly price (IQD) of the card or plan */
  monthlyPrice: number;
  /** Show printer selector (protection plans) */
  requirePrinter?: boolean;
  /** Confirm callback receives the selected tier + computed quote (+ user_printer_id when required) */
  onConfirm: (payload: {
    tier: SubscriptionDurationTier;
    quote: ReturnType<typeof computeDurationQuote>;
    user_printer_id?: string;
  }) => Promise<void> | void;
  confirming?: boolean;
}

function localizedLabel(tier: SubscriptionDurationTier, lang: string, fallback: string) {
  if (lang === 'ar' && tier.label_ar) return tier.label_ar;
  if (lang === 'ku' && tier.label_ku) return tier.label_ku;
  if (lang === 'en' && tier.label_en) return tier.label_en;
  return fallback;
}

export default function SubscriptionDurationDialog({
  open,
  onOpenChange,
  targetType,
  title,
  monthlyPrice,
  requirePrinter = false,
  onConfirm,
  confirming = false,
}: Props) {
  const { t, language } = useLanguage();
  const { fmt } = useNumberFormat();
  const { user } = useAuth();
  const { data: tiers, isLoading } = useSubscriptionTiers(targetType);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<string | null>(null);

  const { data: printers } = useQuery({
    queryKey: ['user-printers-for-sub', user?.id],
    enabled: !!user && requirePrinter && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_printers')
        .select('id, store_printer_id, verification_status, store_printers:store_printer_id(model_name_ar, brand_ar)')
        .eq('user_id', user!.id);
      if (error) throw error;
      return (data || []) as any[];
    },
    staleTime: 60_000,
  });

  useEffect(() => {
    if (!open) { setSelectedId(null); setSelectedPrinter(null); return; }
    if (tiers && tiers.length && !selectedId) {
      // Default to the highest-discount tier — the "best value"
      const best = [...tiers].sort((a, b) => b.discount_percentage - a.discount_percentage)[0];
      setSelectedId(best.id);
    }
  }, [open, tiers, selectedId]);

  const selectedTier = useMemo(
    () => tiers?.find(x => x.id === selectedId) || null,
    [tiers, selectedId]
  );
  const selectedQuote = useMemo(
    () => (selectedTier ? computeDurationQuote(monthlyPrice, selectedTier) : null),
    [selectedTier, monthlyPrice]
  );

  const durationDefault = (m: number) => {
    if (m === 1) return t('sub_duration_1m');
    if (m === 3) return t('sub_duration_3m');
    if (m === 6) return t('sub_duration_6m');
    if (m === 12) return t('sub_duration_12m');
    return `${m} ${t('sub_months_short')}`;
  };

  const badgeFor = (m: number) => {
    if (m === 3) return { text: t('sub_most_popular'), icon: Sparkles, cls: 'bg-purple-500/15 text-purple-600 border-purple-500/40' };
    if (m === 12) return { text: t('sub_best_value'), icon: Crown, cls: 'bg-amber-500/15 text-amber-600 border-amber-500/40' };
    return null;
  };

  const canConfirm =
    !!selectedTier && !!selectedQuote &&
    (!requirePrinter || !!selectedPrinter) &&
    !confirming;

  const handleConfirm = async () => {
    if (!selectedTier || !selectedQuote) return;
    await onConfirm({
      tier: selectedTier,
      quote: selectedQuote,
      user_printer_id: requirePrinter ? selectedPrinter || undefined : undefined,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-md">
        <DialogHeader>
          <DialogTitle>{title || t('sub_choose_duration')}</DialogTitle>
        </DialogHeader>

        <div className="space-y-2 overflow-y-auto max-h-[65vh] px-1 py-2">
          {isLoading && (
            <div className="flex items-center justify-center py-6">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          )}

          {!isLoading && (!tiers || tiers.length === 0) && (
            <div className="text-center py-6 text-sm text-muted-foreground">{t('sub_no_tiers')}</div>
          )}

          {!isLoading && tiers && tiers.map((tier) => {
            const quote = computeDurationQuote(monthlyPrice, tier);
            const selected = tier.id === selectedId;
            const b = badgeFor(tier.duration_months);
            return (
              <button
                key={tier.id}
                type="button"
                onClick={() => setSelectedId(tier.id)}
                className={`w-full text-right p-3 rounded-lg border-2 transition-all relative ${
                  selected
                    ? 'border-primary bg-primary/5 shadow-sm'
                    : 'border-border hover:border-primary/40 hover:bg-muted/30'
                }`}
              >
                {b && (
                  <div className={`absolute -top-2 start-3 px-2 py-0.5 rounded-full text-[10px] font-bold border ${b.cls} flex items-center gap-1`}>
                    <b.icon className="h-2.5 w-2.5" />
                    {b.text}
                  </div>
                )}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center shrink-0 ${
                      selected ? 'border-primary bg-primary' : 'border-muted-foreground/40'
                    }`}>
                      {selected && <Check className="h-3 w-3 text-primary-foreground" />}
                    </div>
                    <div className="min-w-0">
                      <div className="font-bold text-sm">{localizedLabel(tier, language, durationDefault(tier.duration_months))}</div>
                      {tier.discount_percentage > 0 && (
                        <div className="text-[11px] text-emerald-600 font-semibold">
                          {t('sub_save_percent').replace('{percent}', String(tier.discount_percentage))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-left shrink-0">
                    <div className="font-black text-primary">{fmt(quote.final)}</div>
                    {tier.discount_percentage > 0 && (
                      <div className="text-[10px] text-muted-foreground line-through">
                        {fmt(quote.gross)}
                      </div>
                    )}
                    <div className="text-[10px] text-muted-foreground">
                      {t('sub_per_month_effective').replace('{amount}', fmt(quote.per_month_effective))}
                    </div>
                  </div>
                </div>
              </button>
            );
          })}

          {requirePrinter && (
            <div className="mt-3 pt-3 border-t space-y-2">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Printer className="h-4 w-4 text-primary" />
                {t('sub_select_printer')}
              </div>
              {(!printers || printers.length === 0) ? (
                <div className="text-xs text-muted-foreground py-2">{t('sub_no_printers')}</div>
              ) : (
                <div className="space-y-1.5">
                  {printers.map((p: any) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setSelectedPrinter(p.id)}
                      className={`w-full text-right p-2 rounded-md border transition-colors flex items-center justify-between text-sm ${
                        selectedPrinter === p.id ? 'border-primary bg-primary/5' : 'border-border hover:bg-muted/30'
                      }`}
                    >
                      <span className="truncate">
                        {p.store_printers?.brand_ar || ''} {p.store_printers?.model_name_ar || '—'}
                      </span>
                      {p.verification_status === 'verified' && (
                        <Badge variant="secondary" className="text-[9px] shrink-0">✓</Badge>
                      )}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {selectedQuote && (
            <div className="mt-3 pt-3 border-t space-y-1.5">
              {selectedQuote.discount > 0 && (
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>{t('sub_original')}</span>
                  <span className="line-through">{fmt(selectedQuote.gross)}</span>
                </div>
              )}
              <div className="flex justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/30 font-bold">
                <span>{t('sub_total')}</span>
                <span className="text-primary">{fmt(selectedQuote.final)} د.ع</span>
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={confirming}>
            {t('common_cancel') || 'إلغاء'}
          </Button>
          <Button onClick={handleConfirm} disabled={!canConfirm}>
            {confirming ? (
              <><Loader2 className="h-4 w-4 animate-spin me-1" /> {t('sub_confirming')}</>
            ) : (
              t('sub_confirm')
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
