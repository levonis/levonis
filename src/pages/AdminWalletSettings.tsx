import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { Settings, Plus, Trash2, Save, CreditCard, Loader2 } from 'lucide-react';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";

interface PaymentMethod {
  id: string;
  name: string;
  name_en: string;
  account_number: string;
  is_active: boolean;
}

interface WalletSettings {
  min_withdrawal_amount: number;
  max_withdrawal_amount: number;
  payment_methods: PaymentMethod[];
}

export default function AdminWalletSettings() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [settings, setSettings] = useState<WalletSettings>({
    min_withdrawal_amount: 5000,
    max_withdrawal_amount: 1000000,
    payment_methods: [],
  });

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const { data: currentSettings, isLoading } = useQuery({
    queryKey: ['wallet-settings-admin'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'wallet_settings')
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value as unknown as WalletSettings | null;
    },
    enabled: isAdmin,
  });

  useEffect(() => {
    if (currentSettings) {
      setSettings(currentSettings);
    }
  }, [currentSettings]);

  const saveSettings = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from('default_settings')
        .update({
          setting_value: settings as any,
          updated_at: new Date().toISOString(),
        })
        .eq('setting_key', 'wallet_settings');

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wallet-settings'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-settings-admin'] });
      toast.success('تم حفظ الإعدادات بنجاح');
    },
    onError: (error) => {
      console.error('Error saving settings:', error);
      toast.error('حدث خطأ في حفظ الإعدادات');
    },
  });

  const addPaymentMethod = () => {
    const newMethod: PaymentMethod = {
      id: `method_${Date.now()}`,
      name: '',
      name_en: '',
      account_number: '',
      is_active: true,
    };
    setSettings(prev => ({
      ...prev,
      payment_methods: [...prev.payment_methods, newMethod],
    }));
  };

  const removePaymentMethod = (id: string) => {
    setSettings(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.filter(m => m.id !== id),
    }));
  };

  const updatePaymentMethod = (id: string, field: keyof PaymentMethod, value: any) => {
    setSettings(prev => ({
      ...prev,
      payment_methods: prev.payment_methods.map(m =>
        m.id === id ? { ...m, [field]: value } : m
      ),
    }));
  };

  if (authLoading || !isAdmin) {
    return null;
  }

  if (isLoading) {
    return (
      <AdminLayout title="إعدادات المحفظة" icon={<Settings className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إعدادات المحفظة"
      description="إدارة إعدادات المحفظة وطرق الدفع"
      icon={<Settings className="h-5 w-5" />}
      maxWidth="4xl"
      actions={
        <Button size="sm" onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
          {saveSettings.isPending ? (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          ) : (
            <Save className="ml-2 h-4 w-4" />
          )}
          حفظ الإعدادات
        </Button>
      }
    >
      <div className="space-y-6">
        {/* إعدادات السحب */}
        <AdminCard>
          <AdminCardHeader 
            title="إعدادات السحب" 
            description="تحديد حدود السحب من المحفظة"
          />
          <AdminCardContent>
            <div className="grid sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="minWithdrawal">الحد الأدنى للسحب (دينار عراقي)</Label>
                <Input
                  id="minWithdrawal"
                  type="number"
                  value={settings.min_withdrawal_amount}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    min_withdrawal_amount: Number(e.target.value),
                  }))}
                  min="0"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="maxWithdrawal">الحد الأقصى للسحب (دينار عراقي)</Label>
                <Input
                  id="maxWithdrawal"
                  type="number"
                  value={settings.max_withdrawal_amount}
                  onChange={(e) => setSettings(prev => ({
                    ...prev,
                    max_withdrawal_amount: Number(e.target.value),
                  }))}
                  min="0"
                />
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* طرق الدفع */}
        <AdminCard>
          <AdminCardHeader 
            title="طرق الدفع" 
            description="إدارة طرق الدفع المتاحة للمستخدمين"
            icon={<CreditCard className="h-5 w-5" />}
            actions={
              <Button onClick={addPaymentMethod} size="sm" variant="outline">
                <Plus className="ml-2 h-4 w-4" />
                إضافة طريقة
              </Button>
            }
          />
          <AdminCardContent>
            {settings.payment_methods.length === 0 ? (
              <AdminEmptyState
                icon={<CreditCard className="h-10 w-10" />}
                title="لا توجد طرق دفع"
                description="اضغط على 'إضافة طريقة' لإضافة طريقة جديدة"
              />
            ) : (
              <div className="space-y-4">
                {settings.payment_methods.map((method, index) => (
                  <div key={method.id} className="p-4 border border-border/40 rounded-lg space-y-4 bg-muted/30">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">طريقة الدفع #{index + 1}</h4>
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={method.is_active}
                            onCheckedChange={(checked) => updatePaymentMethod(method.id, 'is_active', checked)}
                          />
                          <Label className="text-sm">
                            {method.is_active ? 'مفعّل' : 'معطّل'}
                          </Label>
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => removePaymentMethod(method.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="grid sm:grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label>الاسم بالعربية</Label>
                        <Input
                          value={method.name}
                          onChange={(e) => updatePaymentMethod(method.id, 'name', e.target.value)}
                          placeholder="مثال: ماستر كارد الرافدين"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الاسم بالإنجليزية</Label>
                        <Input
                          value={method.name_en}
                          onChange={(e) => updatePaymentMethod(method.id, 'name_en', e.target.value)}
                          placeholder="Example: MasterCard Al-Rafidain"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <Label>رقم الحساب / الهاتف</Label>
                      <Input
                        value={method.account_number}
                        onChange={(e) => updatePaymentMethod(method.id, 'account_number', e.target.value)}
                        placeholder="أدخل رقم الحساب أو رقم الهاتف"
                      />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </AdminCardContent>
        </AdminCard>
      </div>
    </AdminLayout>
  );
}