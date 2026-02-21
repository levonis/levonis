import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Save, Percent, DollarSign, Truck, Wallet, AlertTriangle, ShieldAlert, Clock } from 'lucide-react';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from '@/config/adminConfig';

interface CommissionSettings {
  platform_rate: number;
  half_payment_customer_fee: number;
  quarter_payment_customer_fee: number;
  cod_merchant_fee: number;
  fixed_amount_fee: number;
  debt_limit: number;
  debt_suspension_days: number;
}

const defaultSettings: CommissionSettings = {
  platform_rate: 0.017,
  half_payment_customer_fee: 5,
  quarter_payment_customer_fee: 10,
  cod_merchant_fee: 10,
  fixed_amount_fee: 0,
  debt_limit: 10000,
  debt_suspension_days: 3,
};

export default function AdminCommissionSettings() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<CommissionSettings | null>(null);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['commission-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'commission_settings')
        .maybeSingle();
      if (error) throw error;
      return data?.setting_value as unknown as CommissionSettings | null;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (settings && !formData) {
      setFormData({ ...defaultSettings, ...settings });
    }
  }, [settings, formData]);

  const saveMutation = useMutation({
    mutationFn: async (data: CommissionSettings) => {
      const { data: existing } = await supabase
        .from('default_settings')
        .select('id')
        .eq('setting_key', 'commission_settings')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('default_settings')
          .update({ setting_value: JSON.parse(JSON.stringify(data)), updated_at: new Date().toISOString() })
          .eq('setting_key', 'commission_settings');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('default_settings')
          .insert({ setting_key: 'commission_settings', setting_value: JSON.parse(JSON.stringify(data)) });
        if (error) throw error;
      }

      // Also sync platform_commission_rate for backward compatibility
      const { data: existingRate } = await supabase
        .from('default_settings')
        .select('id')
        .eq('setting_key', 'platform_commission_rate')
        .maybeSingle();

      if (existingRate) {
        await supabase
          .from('default_settings')
          .update({ setting_value: { rate: data.platform_rate }, updated_at: new Date().toISOString() })
          .eq('setting_key', 'platform_commission_rate');
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['commission-settings'] });
      queryClient.invalidateQueries({ queryKey: ['platform-commission'] });
      toast.success('تم حفظ إعدادات العمولة بنجاح');
    },
    onError: () => {
      toast.error('فشل حفظ الإعدادات');
    },
  });

  if (authLoading || isLoading) {
    return (
      <AdminLayout title="إعدادات العمولة" icon={<Percent className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  if (!user || !isAdmin || !formData) return null;

  const update = (key: keyof CommissionSettings, value: number) => {
    setFormData(prev => prev ? { ...prev, [key]: value } : prev);
  };

  // Example calculations
  const exampleOrder = 100000;
  const platformFee = Math.ceil(exampleOrder * formData.platform_rate);
  const halfFee = Math.ceil(exampleOrder * (formData.half_payment_customer_fee / 100));
  const quarterFee = Math.ceil(exampleOrder * (formData.quarter_payment_customer_fee / 100));
  const codFee = Math.ceil(exampleOrder * (formData.cod_merchant_fee / 100));

  return (
    <AdminLayout
      title="إعدادات العمولة"
      description="التحكم بنسب العمولة لجميع خيارات الدفع"
      icon={<Percent className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="4xl"
      actions={
        <Button
          size="sm"
          onClick={() => saveMutation.mutate(formData)}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending ? (
            <Loader2 className="h-4 w-4 ml-2 animate-spin" />
          ) : (
            <Save className="h-4 w-4 ml-2" />
          )}
          حفظ الإعدادات
        </Button>
      }
    >
      <div className="space-y-6">
        {/* 1. عمولة المنصة الأساسية */}
        <AdminCard>
          <AdminCardHeader
            title="عمولة المنصة الأساسية"
            description="النسبة المأخوذة من التاجر على كل عملية بيع (منتجات، طلبات عملاء، محادثات)"
            icon={<DollarSign className="h-5 w-5" />}
          />
          <AdminCardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-emerald-500/15 flex items-center justify-center shrink-0">
                  <Percent className="h-5 w-5 text-emerald-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">نسبة العمولة من التاجر</Label>
                  <p className="text-xs text-muted-foreground">تُخصم تلقائياً من كل عملية بيع ناجحة</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    value={Number((formData.platform_rate * 100).toFixed(2))}
                    onChange={(e) => update('platform_rate', Number(e.target.value) / 100)}
                    min={0}
                    max={100}
                    step={0.1}
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* 2. عمولة الدفع الجزئي (من العميل) */}
        <AdminCard>
          <AdminCardHeader
            title="رسوم الدفع الجزئي (من العميل)"
            description="نسبة إضافية تُحسب على العميل عند اختيار الدفع الجزئي"
            icon={<Wallet className="h-5 w-5" />}
          />
          <AdminCardContent>
            <div className="space-y-3">
              {/* دفع مقدماً */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-blue-500/15 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-blue-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">دفع مقدماً (كامل المبلغ)</Label>
                  <p className="text-xs text-muted-foreground">لا توجد رسوم إضافية على العميل</p>
                </div>
                <div className="px-4 py-2 rounded-md bg-emerald-500/10 text-emerald-600 text-sm font-medium">
                  0%
                </div>
              </div>

              {/* نصف المبلغ */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">نصف المبلغ (50%)</Label>
                  <p className="text-xs text-muted-foreground">رسوم إضافية على العميل عند دفع نصف المبلغ مقدماً</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    value={formData.half_payment_customer_fee}
                    onChange={(e) => update('half_payment_customer_fee', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              {/* ربع المبلغ */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-orange-500/15 flex items-center justify-center shrink-0">
                  <Wallet className="h-5 w-5 text-orange-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">ربع المبلغ (25%)</Label>
                  <p className="text-xs text-muted-foreground">رسوم إضافية على العميل عند دفع ربع المبلغ مقدماً</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    value={formData.quarter_payment_customer_fee}
                    onChange={(e) => update('quarter_payment_customer_fee', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>

              {/* مبلغ محدد */}
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-purple-500/15 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-purple-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">مبلغ محدد (ثابت)</Label>
                  <p className="text-xs text-muted-foreground">رسوم ثابتة تُضاف لأي عملية دفع جزئي</p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    value={formData.fixed_amount_fee}
                    onChange={(e) => update('fixed_amount_fee', Number(e.target.value))}
                    min={0}
                    step={500}
                    className="text-center"
                  />
                  <span className="text-xs text-muted-foreground">د.ع</span>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* 3. عمولة الدفع عند الاستلام (من التاجر) */}
        <AdminCard>
          <AdminCardHeader
            title="عمولة الدفع عند الاستلام (من التاجر)"
            description="نسبة إضافية تُخصم من التاجر عند اختيار العميل للدفع عند الاستلام"
            icon={<Truck className="h-5 w-5" />}
          />
          <AdminCardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-red-500/15 flex items-center justify-center shrink-0">
                  <Truck className="h-5 w-5 text-red-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">نسبة العمولة الإضافية (COD)</Label>
                  <p className="text-xs text-muted-foreground">
                    تُخصم من رصيد التاجر. في حال عدم الكفاية تُسجّل كدين
                  </p>
                </div>
                <div className="flex items-center gap-2 w-32">
                  <Input
                    type="number"
                    value={formData.cod_merchant_fee}
                    onChange={(e) => update('cod_merchant_fee', Number(e.target.value))}
                    min={0}
                    max={100}
                    step={0.5}
                    className="text-center"
                  />
                  <span className="text-sm text-muted-foreground">%</span>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* 4. إعدادات نظام الدين */}
        <AdminCard>
          <AdminCardHeader
            title="نظام دين التاجر"
            description="إعدادات التحكم بحد الدين وتعليق الحساب التلقائي"
            icon={<ShieldAlert className="h-5 w-5" />}
          />
          <AdminCardContent>
            <div className="space-y-3">
              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-destructive/15 flex items-center justify-center shrink-0">
                  <AlertTriangle className="h-5 w-5 text-destructive" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">حد الدين الأقصى</Label>
                  <p className="text-xs text-muted-foreground">
                    عند تجاوز هذا المبلغ يبدأ العد التنازلي لتعليق الحساب
                  </p>
                </div>
                <div className="flex items-center gap-2 w-36">
                  <Input
                    type="number"
                    value={formData.debt_limit}
                    onChange={(e) => update('debt_limit', Number(e.target.value))}
                    min={0}
                    step={1000}
                    className="text-center"
                  />
                  <span className="text-xs text-muted-foreground">د.ع</span>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 rounded-lg border border-border/40 bg-muted/30">
                <div className="h-10 w-10 rounded-lg bg-amber-500/15 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-amber-500" />
                </div>
                <div className="flex-1 space-y-1">
                  <Label className="text-sm font-medium">مهلة السداد</Label>
                  <p className="text-xs text-muted-foreground">
                    عدد الأيام المسموحة قبل تعليق حساب التاجر تلقائياً
                  </p>
                </div>
                <div className="flex items-center gap-2 w-36">
                  <Input
                    type="number"
                    value={formData.debt_suspension_days}
                    onChange={(e) => update('debt_suspension_days', Number(e.target.value))}
                    min={1}
                    max={30}
                    className="text-center"
                  />
                  <span className="text-xs text-muted-foreground">يوم</span>
                </div>
              </div>

              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                  <div className="text-xs text-amber-800 dark:text-amber-300 space-y-1">
                    <p className="font-medium">آلية عمل نظام الدين:</p>
                    <ul className="list-disc list-inside space-y-0.5 text-amber-700 dark:text-amber-400">
                      <li>عند عدم كفاية رصيد التاجر لدفع عمولة COD، يُسجّل المبلغ كدين</li>
                      <li>يُسدّد الدين تلقائياً عند تعبئة المحفظة أو استلام تحويل</li>
                      <li>عند تجاوز الدين <strong>{formData.debt_limit.toLocaleString('ar-IQ')}</strong> د.ع لمدة <strong>{formData.debt_suspension_days}</strong> أيام، يُعلّق الحساب</li>
                      <li>يعود الحساب تلقائياً عند سداد الدين بالكامل</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* مثال حسابي */}
        <AdminCard>
          <AdminCardHeader
            title="مثال حسابي"
            description={`على طلب بقيمة ${exampleOrder.toLocaleString('ar-IQ')} د.ع`}
          />
          <AdminCardContent>
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-foreground">دفع كامل (مقدماً):</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• عمولة المنصة من التاجر: <span className="font-medium text-foreground">{platformFee.toLocaleString('ar-IQ')}</span> د.ع</p>
                  <p>• رسوم على العميل: <span className="font-medium text-emerald-600">0</span> د.ع</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-foreground">نصف المبلغ:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• عمولة المنصة من التاجر: <span className="font-medium text-foreground">{platformFee.toLocaleString('ar-IQ')}</span> د.ع</p>
                  <p>• رسوم إضافية على العميل: <span className="font-medium text-amber-600">{halfFee.toLocaleString('ar-IQ')}</span> د.ع ({formData.half_payment_customer_fee}%)</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-foreground">ربع المبلغ:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• عمولة المنصة من التاجر: <span className="font-medium text-foreground">{platformFee.toLocaleString('ar-IQ')}</span> د.ع</p>
                  <p>• رسوم إضافية على العميل: <span className="font-medium text-orange-600">{quarterFee.toLocaleString('ar-IQ')}</span> د.ع ({formData.quarter_payment_customer_fee}%)</p>
                </div>
              </div>
              <div className="p-3 rounded-lg bg-muted/50 space-y-2">
                <p className="text-xs font-medium text-foreground">دفع عند الاستلام:</p>
                <div className="text-xs text-muted-foreground space-y-1">
                  <p>• عمولة المنصة من التاجر: <span className="font-medium text-foreground">{platformFee.toLocaleString('ar-IQ')}</span> د.ع</p>
                  <p>• عمولة COD من التاجر: <span className="font-medium text-red-600">{codFee.toLocaleString('ar-IQ')}</span> د.ع ({formData.cod_merchant_fee}%)</p>
                  <p>• رسوم على العميل: <span className="font-medium text-emerald-600">0</span> د.ع</p>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </div>
    </AdminLayout>
  );
}
