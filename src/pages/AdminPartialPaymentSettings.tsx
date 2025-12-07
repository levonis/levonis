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
import { Loader2, Save, ArrowRight, Percent } from 'lucide-react';

interface PartialPaymentSettings {
  quarter_payment_fee_percentage: number;
  fee_label_ar: string;
  fee_label_en: string;
}

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
      setFormData(value);
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4 max-w-2xl">
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
            تحديد رسوم الدفع الجزئي (تُضاف عند اختيار دفع ربع المبلغ للطلبات المسبقة)
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Percent className="h-5 w-5 text-primary" />
                رسوم الدفع الجزئي
              </CardTitle>
              <CardDescription>
                هذه الرسوم تُضاف كربح عند اختيار العميل دفع ربع المبلغ للطلب المسبق
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="fee_percentage">نسبة الرسوم (%)</Label>
                <div className="relative">
                  <Input
                    id="fee_percentage"
                    type="number"
                    min="0"
                    max="100"
                    step="0.5"
                    value={formData.quarter_payment_fee_percentage}
                    onChange={(e) => setFormData({ 
                      ...formData, 
                      quarter_payment_fee_percentage: parseFloat(e.target.value) || 0 
                    })}
                    className="pl-10"
                  />
                  <Percent className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                </div>
                <p className="text-xs text-muted-foreground">
                  مثال: إذا كان المبلغ الإجمالي 100,000 د.ع والنسبة 10%، ستكون الرسوم 10,000 د.ع
                </p>
              </div>

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

              <div className="bg-accent/10 p-4 rounded-lg">
                <h4 className="font-semibold mb-2">مثال حسابي:</h4>
                <div className="text-sm text-muted-foreground space-y-1">
                  <p>• قيمة الطلب: 400,000 د.ع</p>
                  <p>• ربع المبلغ (25%): 100,000 د.ع</p>
                  <p>• رسوم الدفع الجزئي ({formData.quarter_payment_fee_percentage}%): {(400000 * formData.quarter_payment_fee_percentage / 100).toLocaleString()} د.ع</p>
                  <p className="font-semibold text-foreground pt-2 border-t border-border/40 mt-2">
                    المطلوب الآن: {(100000 + (400000 * formData.quarter_payment_fee_percentage / 100)).toLocaleString()} د.ع + التوصيل
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
