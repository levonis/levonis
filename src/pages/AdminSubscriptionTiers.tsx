import { useState, useMemo } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { Button } from '@/components/ui/button';
import { Loader2, Save } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { SubscriptionDurationTier, SubTargetType } from '@/hooks/useSubscriptionTiers';

function TierTable({ targetType }: { targetType: SubTargetType }) {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [drafts, setDrafts] = useState<Record<string, { discount_percentage: number; is_active: boolean }>>({});
  const [savingId, setSavingId] = useState<string | null>(null);

  const { data: tiers, isLoading } = useQuery({
    queryKey: ['admin-sub-tiers', targetType],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('subscription_duration_tiers')
        .select('*')
        .eq('target_type', targetType)
        .order('duration_months', { ascending: true });
      if (error) throw error;
      return (data || []) as SubscriptionDurationTier[];
    },
  });

  const rows = useMemo(() => (tiers || []).map(tier => {
    const d = drafts[tier.id];
    return {
      ...tier,
      discount_percentage: d ? d.discount_percentage : tier.discount_percentage,
      is_active: d ? d.is_active : tier.is_active,
      _dirty: !!d,
    };
  }), [tiers, drafts]);

  const setField = (id: string, patch: Partial<{ discount_percentage: number; is_active: boolean }>) => {
    const original = tiers?.find(x => x.id === id);
    if (!original) return;
    setDrafts(prev => ({
      ...prev,
      [id]: {
        discount_percentage: prev[id]?.discount_percentage ?? original.discount_percentage,
        is_active: prev[id]?.is_active ?? original.is_active,
        ...patch,
      },
    }));
  };

  const save = async (row: typeof rows[number]) => {
    setSavingId(row.id);
    const prevRow = tiers?.find(x => x.id === row.id);
    try {
      const { error } = await (supabase as any)
        .from('subscription_duration_tiers')
        .update({
          discount_percentage: row.discount_percentage,
          is_active: row.is_active,
        })
        .eq('id', row.id)
        .select()
        .single();
      if (error) throw error;
      toast.success(t('sub_admin_save'));
      setDrafts(prev => { const n = { ...prev }; delete n[row.id]; return n; });
      qc.invalidateQueries({ queryKey: ['admin-sub-tiers', targetType] });
      qc.invalidateQueries({ queryKey: ['subscription-duration-tiers', targetType] });
    } catch (e: any) {
      // Rollback drafts to previous values
      if (prevRow) {
        setDrafts(prev => ({
          ...prev,
          [row.id]: {
            discount_percentage: prevRow.discount_percentage,
            is_active: prevRow.is_active,
          },
        }));
      }
      toast.error(e?.message || 'Save failed');
    } finally {
      setSavingId(null);
    }
  };

  if (isLoading) {
    return <div className="flex justify-center py-8"><Loader2 className="h-6 w-6 animate-spin" /></div>;
  }

  return (
    <div className="space-y-3">
      {rows.map(row => (
        <Card key={row.id} className={row._dirty ? 'border-amber-500/50' : ''}>
          <CardContent className="p-4 flex flex-wrap items-center gap-3">
            <div className="min-w-[100px]">
              <div className="font-bold">{row.duration_months} {t('sub_month_short')}</div>
              <div className="text-xs text-muted-foreground">{row.label_ar || ''}</div>
            </div>
            <div className="flex-1 min-w-[140px]">
              <label className="text-[11px] text-muted-foreground">{t('sub_admin_discount')}</label>
              <Input
                type="number"
                min={0}
                max={90}
                step={0.5}
                value={row.discount_percentage}
                onChange={(e) => setField(row.id, { discount_percentage: Number(e.target.value) || 0 })}
                className="h-9"
              />
            </div>
            <div className="flex items-center gap-2">
              <label className="text-xs">{t('sub_admin_active')}</label>
              <Switch
                checked={row.is_active}
                onCheckedChange={(v) => setField(row.id, { is_active: v })}
              />
            </div>
            <Button
              size="sm"
              disabled={!row._dirty || savingId === row.id}
              onClick={() => save(row)}
            >
              {savingId === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className="h-3.5 w-3.5 me-1" />}
              {t('sub_admin_save')}
            </Button>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export default function AdminSubscriptionTiers() {
  const { t, dir } = useLanguage();
  return (
    <div className="min-h-screen p-4 md:p-6" dir={dir}>
      <Card>
        <CardHeader>
          <CardTitle>{t('sub_admin_title')}</CardTitle>
          <p className="text-sm text-muted-foreground">{t('sub_admin_desc')}</p>
        </CardHeader>
        <CardContent>
          <Tabs defaultValue="card">
            <TabsList className="grid grid-cols-2 w-full max-w-md">
              <TabsTrigger value="card">{t('sub_admin_cards_tab')}</TabsTrigger>
              <TabsTrigger value="protection_plan">{t('sub_admin_plans_tab')}</TabsTrigger>
            </TabsList>
            <TabsContent value="card" className="mt-4">
              <TierTable targetType="card" />
            </TabsContent>
            <TabsContent value="protection_plan" className="mt-4">
              <TierTable targetType="protection_plan" />
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>
    </div>
  );
}
