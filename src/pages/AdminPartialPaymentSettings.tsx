import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Percent, Plus, Trash2, Calculator } from 'lucide-react';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from "@/components/admin/AdminLayout";

interface FeeTier {
  min_amount: number;
  max_amount: number;
  fee_percentage: number;
  // COD fields per tier
  cod_fee_type?: 'percentage' | 'fixed';
  cod_fee_value?: number;
}

interface PartialPaymentSettings {
  fee_label_ar: string;
  fee_label_en: string;
  fee_tiers: FeeTier[];
  cod_label_ar?: string;
  // Kept for backward compatibility (fallback when a tier has no COD value)
  cod_default_fee_type?: 'percentage' | 'fixed';
  cod_default_fee_value?: number;
}

const defaultSettings: PartialPaymentSettings = {
  fee_label_ar: 'رسوم الدفع الجزئي',
  fee_label_en: 'Partial Payment Fee',
  fee_tiers: [
    { min_amount: 1, max_amount: 250000, fee_percentage: 10, cod_fee_type: 'percentage', cod_fee_value: 5 },
    { min_amount: 250001, max_amount: 500000, fee_percentage: 7, cod_fee_type: 'percentage', cod_fee_value: 4 },
    { min_amount: 500001, max_amount: 1000000, fee_percentage: 5, cod_fee_type: 'percentage', cod_fee_value: 3 },
    { min_amount: 1000001, max_amount: 999999999, fee_percentage: 3, cod_fee_type: 'percentage', cod_fee_value: 2 },
  ],
  cod_label_ar: 'رسوم الدفع عند الاستلام',
  cod_default_fee_type: 'percentage',
  cod_default_fee_value: 5,
};

export default function AdminPartialPaymentSettings() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<PartialPaymentSettings | null>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['partial-payment-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('*')
        .eq('setting_key', 'partial_payment_settings')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  useEffect(() => {
    if (settings?.setting_value && !formData) {
      const value = settings.setting_value as unknown as PartialPaymentSettings;
      // Hydrate per-tier COD using legacy defaults if missing
      const legacyType = value.cod_default_fee_type || 'percentage';
      const legacyVal = Number(value.cod_default_fee_value ?? 0);
      const hydratedTiers = (value.fee_tiers || defaultSettings.fee_tiers).map((t) => ({
        ...t,
        cod_fee_type: t.cod_fee_type ?? legacyType,
        cod_fee_value: t.cod_fee_value ?? legacyVal,
      }));
      setFormData({
        ...defaultSettings,
        ...value,
        fee_tiers: hydratedTiers,
      });
    }
  }, [settings, formData]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: PartialPaymentSettings) => {
      const { error } = await supabase
        .from('default_settings')
        .update({ 
          setting_value: JSON.parse(JSON.stringify(newSettings)), 
          updated_at: new Date().toISOString() 
        })
        .eq('setting_key', 'partial_payment_settings');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['partial-payment-settings'] });
      toast.success('تم حفظ إعدادات الدفع بنجاح');
    },
    onError: (error: any) => {
      toast.error('فشل حفظ الإعدادات: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      // Mirror first tier's COD into legacy defaults for backward compatibility
      const firstTier = formData.fee_tiers[0];
      const payload: PartialPaymentSettings = {
        ...formData,
        cod_default_fee_type: firstTier?.cod_fee_type ?? formData.cod_default_fee_type ?? 'percentage',
        cod_default_fee_value: firstTier?.cod_fee_value ?? formData.cod_default_fee_value ?? 0,
      };
      updateMutation.mutate(payload);
    }
  };

  const addTier = () => {
    if (!formData) return;
    const lastTier = formData.fee_tiers[formData.fee_tiers.length - 1];
    const newTier: FeeTier = {
      min_amount: lastTier ? lastTier.max_amount + 1 : 0,
      max_amount: lastTier ? lastTier.max_amount + 500000 : 500000,
      fee_percentage: 5,
      cod_fee_type: lastTier?.cod_fee_type ?? 'percentage',
      cod_fee_value: lastTier?.cod_fee_value ?? 5,
    };
    setFormData({
      ...formData,
      fee_tiers: [...formData.fee_tiers, newTier]
    });
  };

  const removeTier = (index: number) => {
    if (!formData) return;
    setFormData({
      ...formData,
      fee_tiers: formData.fee_tiers.filter((_, i) => i !== index)
    });
  };

  const updateTier = (index: number, field: keyof FeeTier, value: number | string) => {
    if (!formData) return;
    const newTiers = [...formData.fee_tiers];
    newTiers[index] = { ...newTiers[index], [field]: value as never };
    setFormData({ ...formData, fee_tiers: newTiers });
  };

  const formatAmount = (amount: number) => {
    return amount.toLocaleString('ar-IQ');
  };

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="إعدادات الدفع الجزئي" icon={<Percent className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  if (!user || !isAdmin || !formData) {
    return null;
  }

  const exampleAmount = 400000;
  const applicableTier = formData.fee_tiers.find(
    tier => exampleAmount >= tier.min_amount && exampleAmount <= tier.max_amount
  );
  const exampleHalfFee = applicableTier 
    ? Math.ceil(exampleAmount * (applicableTier.fee_percentage / 100))
    : 0;
  const exampleCodFee = applicableTier
    ? ((applicableTier.cod_fee_type ?? 'percentage') === 'percentage'
        ? Math.ceil(exampleAmount * ((applicableTier.cod_fee_value ?? 0) / 100))
        : Math.ceil(applicableTier.cod_fee_value ?? 0))
    : 0;

  return (
    <AdminLayout
      title="إعدادات الدفع الجزئي والدفع عند الاستلام"
      description="تحديد شرائح الرسوم حسب قيمة الطلب لكلٍّ من دفع نصف المبلغ والدفع عند الاستلام"
      icon={<Percent className="h-5 w-5" />}
      maxWidth="4xl"
      actions={
        <Button
          size="sm"
          onClick={handleSubmit}
          disabled={updateMutation.isPending}
        >
          {updateMutation.isPending ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          حفظ الإعدادات
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* شرائح الرسوم */}
        <AdminCard>
          <AdminCardHeader 
            title="شرائح الرسوم حسب قيمة الطلب"
            description="حدد لكل شريحة من قيمة الطلب: نسبة دفع نصف المبلغ ورسوم الدفع عند الاستلام (نسبة أو مبلغ ثابت)"
            icon={<Percent className="h-5 w-5" />}
            actions={
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addTier}
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة شريحة
              </Button>
            }
          />
          <AdminCardContent>
            <div className="space-y-3">
              {formData.fee_tiers.map((tier, index) => (
                <div key={index} className="p-4 border border-border/40 rounded-lg bg-muted/30 space-y-3">
                  {/* Range */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">من (د.ع)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={tier.min_amount}
                        onChange={(e) => updateTier(index, 'min_amount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">إلى (د.ع)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={tier.max_amount}
                        onChange={(e) => updateTier(index, 'max_amount', parseInt(e.target.value) || 0)}
                      />
                    </div>
                  </div>

                  {/* Fees: half payment + COD side by side */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {/* Half payment fee */}
                    <div className="rounded-md border border-border/40 p-3 bg-background/40 space-y-1">
                      <Label className="text-xs font-semibold">رسوم دفع نصف المبلغ %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={tier.fee_percentage}
                        onChange={(e) => updateTier(index, 'fee_percentage', parseFloat(e.target.value) || 0)}
                      />
                    </div>

                    {/* COD fee */}
                    <div className="rounded-md border border-border/40 p-3 bg-background/40 space-y-2">
                      <Label className="text-xs font-semibold">رسوم الدفع عند الاستلام</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <select
                          className="h-9 px-2 rounded-md border border-input bg-background text-sm"
                          value={tier.cod_fee_type ?? 'percentage'}
                          onChange={(e) => updateTier(index, 'cod_fee_type', e.target.value)}
                        >
                          <option value="percentage">نسبة %</option>
                          <option value="fixed">مبلغ ثابت (د.ع)</option>
                        </select>
                        <Input
                          type="number"
                          min="0"
                          step={(tier.cod_fee_type ?? 'percentage') === 'percentage' ? '0.5' : '500'}
                          value={tier.cod_fee_value ?? 0}
                          onChange={(e) => updateTier(index, 'cod_fee_value', parseFloat(e.target.value) || 0)}
                          placeholder={(tier.cod_fee_type ?? 'percentage') === 'percentage' ? 'النسبة %' : 'القيمة د.ع'}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="flex justify-end">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      onClick={() => removeTier(index)}
                      className="text-destructive hover:text-destructive/80"
                      disabled={formData.fee_tiers.length <= 1}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* تسميات الرسوم */}
        <AdminCard>
          <AdminCardHeader title="تسميات الرسوم" description="النصوص التي تظهر للعميل عند عرض الرسوم" />
          <AdminCardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee_label_ar">رسوم الدفع الجزئي (عربي)</Label>
                <Input
                  id="fee_label_ar"
                  value={formData.fee_label_ar}
                  onChange={(e) => setFormData({ ...formData, fee_label_ar: e.target.value })}
                  placeholder="رسوم الدفع الجزئي"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee_label_en">رسوم الدفع الجزئي (إنجليزي)</Label>
                <Input
                  id="fee_label_en"
                  value={formData.fee_label_en}
                  onChange={(e) => setFormData({ ...formData, fee_label_en: e.target.value })}
                  placeholder="Partial Payment Fee"
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label>تسمية رسوم الدفع عند الاستلام (تظهر للعميل)</Label>
                <Input
                  value={formData.cod_label_ar || ''}
                  onChange={(e) => setFormData({ ...formData, cod_label_ar: e.target.value })}
                  placeholder="رسوم الدفع عند الاستلام"
                />
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* مثال حسابي */}
        <AdminCard>
          <AdminCardHeader title="مثال حسابي" icon={<Calculator className="h-5 w-5" />} />
          <AdminCardContent>
            <div className="bg-muted/50 p-4 rounded-lg">
              <div className="text-sm text-muted-foreground space-y-1">
                <p>• قيمة الطلب: {formatAmount(exampleAmount)} د.ع</p>
                <p>• الشريحة المطبقة: {applicableTier ? `${formatAmount(applicableTier.min_amount)} - ${formatAmount(applicableTier.max_amount)} د.ع` : 'لا توجد شريحة'}</p>
                <p>• رسوم دفع نصف المبلغ: {formatAmount(exampleHalfFee)} د.ع ({applicableTier?.fee_percentage ?? 0}%)</p>
                <p>• رسوم الدفع عند الاستلام: {formatAmount(exampleCodFee)} د.ع {applicableTier ? `(${(applicableTier.cod_fee_type ?? 'percentage') === 'percentage' ? `${applicableTier.cod_fee_value ?? 0}%` : `${formatAmount(applicableTier.cod_fee_value ?? 0)} د.ع`})` : ''}</p>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </form>
    </AdminLayout>
  );
}
