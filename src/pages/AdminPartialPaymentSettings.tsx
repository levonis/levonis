import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { toast } from 'sonner';
import { Loader2, Save, ArrowRight, Percent, Plus, Trash2 } from 'lucide-react';

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

  // Fetch settings
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

  // Initialize form data
  useEffect(() => {
    if (settings?.setting_value && !formData) {
      const value = settings.setting_value as unknown as PartialPaymentSettings;
      // Ensure fee_tiers exists for backward compatibility
      setFormData({
        ...defaultSettings,
        ...value,
        fee_tiers: value.fee_tiers || defaultSettings.fee_tiers
      });
    }
  }, [settings, formData]);

  // Check auth
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  // Update mutation
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin || !formData) {
    return null;
  }

  // Example calculation for display
  const exampleAmount = 400000;
  const applicableTier = formData.fee_tiers.find(
    tier => exampleAmount >= tier.min_amount && exampleAmount <= tier.max_amount
  );
  const exampleFee = applicableTier 
    ? Math.ceil(exampleAmount * (applicableTier.fee_percentage / 100))
    : 0;

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4 max-w-3xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowRight className="h-4 w-4 ml-2 rotate-180" />
            العودة إلى لوحة التحكم
          </Button>
          <h1 className="text-3xl font-bold text-foreground">إعدادات الدفع الجزئي</h1>
          <p className="text-muted-foreground mt-2">
            تحديد شرائح رسوم الدفع الجزئي حسب قيمة الطلب (تُضاف عند اختيار دفع ربع المبلغ للطلبات المسبقة)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* شرائح الرسوم */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                شرائح الرسوم حسب قيمة الطلب
              </CardTitle>
              <CardDescription>
                حدد نسبة الرسوم لكل شريحة من قيمة الطلب - الرسوم تُضاف للمبلغ المتبقي وتظهر كمبلغ فقط للعميل
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.fee_tiers.map((tier, index) => (
                <div key={index} className="flex items-center gap-3 p-4 border border-border/40 rounded-lg bg-accent/5">
                  <div className="flex-1 grid grid-cols-3 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">من (د.ع)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={tier.min_amount}
                        onChange={(e) => updateTier(index, 'min_amount', parseInt(e.target.value) || 0)}
                        className="text-sm"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs text-muted-foreground">إلى (د.ع)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={tier.max_amount}
                        onChange={(e) => updateTier(index, 'max_amount', parseInt(e.target.value) || 0)}
                        className="text-sm"
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
                        className="text-sm"
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
              
              <Button
                type="button"
                variant="outline"
                onClick={addTier}
                className="w-full"
              >
                <Plus className="h-4 w-4 ml-2" />
                إضافة شريحة جديدة
              </Button>
            </CardContent>
          </Card>

          {/* تسميات الرسوم */}
          <Card>
            <CardHeader>
              <CardTitle>تسمية الرسوم</CardTitle>
              <CardDescription>
                النص الذي يظهر للعميل عند عرض الرسوم الإضافية
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* مثال حسابي */}
          <Card>
            <CardHeader>
              <CardTitle>مثال حسابي</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="bg-accent/10 p-4 rounded-lg">
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• قيمة الطلب: {formatAmount(exampleAmount)} د.ع</p>
                  <p>• الشريحة المطبقة: {applicableTier ? `${formatAmount(applicableTier.min_amount)} - ${formatAmount(applicableTier.max_amount)} د.ع (${applicableTier.fee_percentage}%)` : 'لا توجد شريحة'}</p>
                  <p>• ربع المبلغ (25%): {formatAmount(Math.ceil(exampleAmount * 0.25))} د.ع</p>
                  <p>• رسوم الدفع الجزئي: {formatAmount(exampleFee)} د.ع</p>
                  <p className="font-semibold text-foreground pt-2 border-t border-border/40 mt-2">
                    ما يراه العميل في صفحة الطلب:
                  </p>
                  <p>• المبلغ المتبقي: {formatAmount(exampleAmount - Math.ceil(exampleAmount * 0.25) + exampleFee)} د.ع</p>
                  <p className="text-xs text-muted-foreground italic">
                    (النسبة مخفية - يظهر المبلغ الإضافي فقط)
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="flex justify-end gap-3">
            <Button
              type="button"
              variant="outline"
              onClick={() => navigate('/admin')}
            >
              إلغاء
            </Button>
            <Button
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 ml-2 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 ml-2" />
                  حفظ الإعدادات
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}