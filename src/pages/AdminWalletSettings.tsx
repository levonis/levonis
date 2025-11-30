import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';
import { ArrowLeft, Settings, Plus, Trash2, Save } from 'lucide-react';

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

  // جلب الإعدادات الحالية
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

  // حفظ الإعدادات
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

  return (
    <div className="container mx-auto px-4 py-8 max-w-4xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى لوحة التحكم
        </Button>
        
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div className="flex items-center gap-3">
            <Settings className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">إعدادات المحفظة</h1>
          </div>
          <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending}>
            <Save className="ml-2 h-4 w-4" />
            {saveSettings.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
          </Button>
        </div>
        <p className="text-muted-foreground">
          إدارة إعدادات المحفظة وطرق الدفع
        </p>
      </div>

      {isLoading ? (
        <p className="text-center py-8">جاري التحميل...</p>
      ) : (
        <div className="space-y-6">
          {/* إعدادات السحب */}
          <Card>
            <CardHeader>
              <CardTitle>إعدادات السحب</CardTitle>
              <CardDescription>تحديد حدود السحب من المحفظة</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
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
            </CardContent>
          </Card>

          {/* طرق الدفع */}
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>طرق الدفع</CardTitle>
                  <CardDescription>إدارة طرق الدفع المتاحة للمستخدمين</CardDescription>
                </div>
                <Button onClick={addPaymentMethod} size="sm">
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة طريقة
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {settings.payment_methods.length === 0 ? (
                <p className="text-center py-4 text-muted-foreground">
                  لا توجد طرق دفع. اضغط على "إضافة طريقة" لإضافة طريقة جديدة.
                </p>
              ) : (
                settings.payment_methods.map((method, index) => (
                  <div key={method.id} className="p-4 border rounded-lg space-y-4">
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
                ))
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
