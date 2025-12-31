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
}

interface PartialPaymentSettings {
  fee_label_ar: string;
  fee_label_en: string;
  fee_tiers: FeeTier[];
}

const defaultSettings: PartialPaymentSettings = {
  fee_label_ar: 'رسوم الدفع الجزئي',
  fee_label_en: 'Partial Payment Fee',
  fee_tiers: [
    { min_amount: 0, max_amount: 250000, fee_percentage: 10 },
    { min_amount: 250001, max_amount: 500000, fee_percentage: 7 },
    { min_amount: 500001, max_amount: 1000000, fee_percentage: 5 },
    { min_amount: 1000001, max_amount: 2000000, fee_percentage: 3 },
  ]
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
      setFormData({
        ...defaultSettings,
        ...value,
        fee_tiers: value.fee_tiers || defaultSettings.fee_tiers
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
      toast.success('تم حفظ إعدادات الدفع الجزئي بنجاح');
    },
    onError: (error: any) => {
      toast.error('فشل حفظ الإعدادات: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      updateMutation.mutate(formData);
    }
  };

  const addTier = () => {
    if (!formData) return;
    const lastTier = formData.fee_tiers[formData.fee_tiers.length - 1];
    const newTier: FeeTier = {
      min_amount: lastTier ? lastTier.max_amount + 1 : 0,
      max_amount: lastTier ? lastTier.max_amount + 500000 : 500000,
      fee_percentage: 5
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

  const updateTier = (index: number, field: keyof FeeTier, value: number) => {
    if (!formData) return;
    const newTiers = [...formData.fee_tiers];
    newTiers[index] = { ...newTiers[index], [field]: value };
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
  const exampleFee = applicableTier 
    ? Math.ceil(exampleAmount * (applicableTier.fee_percentage / 100))
    : 0;

  return (
    <AdminLayout
      title="إعدادات الدفع الجزئي"
      description="تحديد شرائح رسوم الدفع الجزئي حسب قيمة الطلب"
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
            description="حدد نسبة الرسوم لكل شريحة من قيمة الطلب"
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
                <div key={index} className="flex items-center gap-3 p-4 border border-border/40 rounded-lg bg-muted/30">
                  <div className="flex-1 grid grid-cols-3 gap-3">
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
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">النسبة %</Label>
                      <Input
                        type="number"
                        min="0"
                        max="100"
                        step="0.5"
                        value={tier.fee_percentage}
                        onChange={(e) => updateTier(index, 'fee_percentage', parseFloat(e.target.value) || 0)}
                      />
                    </div>
                  </div>
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
              ))}
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* تسميات الرسوم */}
        <AdminCard>
          <AdminCardHeader title="تسمية الرسوم" description="النص الذي يظهر للعميل عند عرض الرسوم الإضافية" />
          <AdminCardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fee_label_ar">اسم الرسوم (عربي)</Label>
                <Input
                  id="fee_label_ar"
                  value={formData.fee_label_ar}
                  onChange={(e) => setFormData({ ...formData, fee_label_ar: e.target.value })}
                  placeholder="رسوم الدفع الجزئي"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="fee_label_en">اسم الرسوم (إنجليزي)</Label>
                <Input
                  id="fee_label_en"
                  value={formData.fee_label_en}
                  onChange={(e) => setFormData({ ...formData, fee_label_en: e.target.value })}
                  placeholder="Partial Payment Fee"
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
                <p>• الشريحة المطبقة: {applicableTier ? `${formatAmount(applicableTier.min_amount)} - ${formatAmount(applicableTier.max_amount)} د.ع (${applicableTier.fee_percentage}%)` : 'لا توجد شريحة'}</p>
                <p>• ربع المبلغ (25%): {formatAmount(Math.ceil(exampleAmount * 0.25))} د.ع</p>
                <p>• رسوم الدفع الجزئي: {formatAmount(exampleFee)} د.ع</p>
                <div className="pt-2 mt-2 border-t border-border/40">
                  <p className="font-semibold text-foreground">ما يراه العميل في صفحة الطلب:</p>
                  <p>• المبلغ المتبقي: {formatAmount(exampleAmount - Math.ceil(exampleAmount * 0.25) + exampleFee)} د.ع</p>
                  <p className="text-xs text-muted-foreground italic">(النسبة مخفية - يظهر المبلغ الإضافي فقط)</p>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </form>
    </AdminLayout>
  );
}