import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Plus, X, Settings } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from '@/components/admin/AdminLayout';

export default function AdminDefaultSettings() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState<any>(null);

  const { data: settings, isLoading } = useQuery({
    queryKey: ['default-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('*')
        .eq('setting_key', 'product_defaults')
        .single();
      
      if (error) throw error;
      return data;
    },
  });

  // جلب إعدادات الضريبة
  const { data: taxSettings, isLoading: taxLoading } = useQuery({
    queryKey: ['tax-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('*')
        .eq('setting_key', 'tax_settings')
        .maybeSingle();
      
      if (error) throw error;
      return data;
    },
  });

  const [taxPercentage, setTaxPercentage] = useState<number>(30);

  useEffect(() => {
    if (settings?.setting_value) {
      setFormData(settings.setting_value);
    }
  }, [settings]);

  useEffect(() => {
    if (taxSettings?.setting_value) {
      const taxValue = (taxSettings.setting_value as any)?.tax_percentage;
      if (typeof taxValue === 'number') {
        setTaxPercentage(taxValue);
      }
    }
  }, [taxSettings]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { error } = await supabase
        .from('default_settings')
        .update({ setting_value: newSettings })
        .eq('setting_key', 'product_defaults');
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['default-settings'] });
      toast.success('تم حفظ الإعدادات الافتراضية بنجاح');
    },
    onError: (error: any) => {
      toast.error('فشل حفظ الإعدادات: ' + error.message);
    },
  });

  const updateTaxMutation = useMutation({
    mutationFn: async (percentage: number) => {
      // التحقق من وجود الإعداد
      const { data: existing } = await supabase
        .from('default_settings')
        .select('id')
        .eq('setting_key', 'tax_settings')
        .maybeSingle();

      if (existing) {
        const { error } = await supabase
          .from('default_settings')
          .update({ setting_value: { tax_percentage: percentage } })
          .eq('setting_key', 'tax_settings');
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('default_settings')
          .insert({ setting_key: 'tax_settings', setting_value: { tax_percentage: percentage } });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] });
      toast.success('تم حفظ إعدادات الضريبة بنجاح');
    },
    onError: (error: any) => {
      toast.error('فشل حفظ إعدادات الضريبة: ' + error.message);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) {
      updateMutation.mutate(formData);
    }
    updateTaxMutation.mutate(taxPercentage);
  };

  const handleShippingOptionChange = (index: number, field: string, value: any) => {
    if (!formData) return;
    const newOptions = [...(formData.pre_order_shipping_options || [])];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  const addShippingOption = () => {
    if (!formData) return;
    const newOptions = [...(formData.pre_order_shipping_options || []), {
      name: '',
      name_ar: '',
      price_adjustment: 0,
    }];
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  const removeShippingOption = (index: number) => {
    if (!formData) return;
    const newOptions = formData.pre_order_shipping_options.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  if (authLoading || isLoading || taxLoading) {
    return (
      <AdminLayout title="الإعدادات الافتراضية" icon={<Settings className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  if (!formData) {
    return (
      <AdminLayout title="الإعدادات الافتراضية" icon={<Settings className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="الإعدادات الافتراضية"
      icon={<Settings className="h-5 w-5" />}
      description="تخصيص الإعدادات الافتراضية للمنتجات الجديدة"
      actions={
        <Button onClick={handleSubmit} disabled={updateMutation.isPending || updateTaxMutation.isPending} className="admin-btn-primary gap-2">
          <Save className="h-4 w-4" />
          {updateMutation.isPending || updateTaxMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        <AdminCard>
          <AdminCardHeader title="إعدادات المنتج الافتراضية" description="هذه الإعدادات سيتم تطبيقها تلقائياً عند إضافة منتج جديد" />
          <AdminCardContent>
            <div className="space-y-6">
              {/* Currency */}
              <div className="admin-form-group">
                <Label htmlFor="currency">العملة الافتراضية</Label>
                <Input
                  id="currency"
                  value={formData.currency || ''}
                  onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                  placeholder="ريال"
                />
              </div>

              {/* Availability Settings */}
              <div className="space-y-4">
                <Label className="text-base font-semibold">حالة التوفر الافتراضية</Label>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="has_in_stock"
                    checked={formData.has_in_stock || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, has_in_stock: checked })
                    }
                  />
                  <Label htmlFor="has_in_stock" className="cursor-pointer">
                    متوفر في المخزون
                  </Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="has_pre_order"
                    checked={formData.has_pre_order || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, has_pre_order: checked })
                    }
                  />
                  <Label htmlFor="has_pre_order" className="cursor-pointer">
                    طلب مسبق
                  </Label>
                </div>

                <div className="admin-form-group">
                  <Label htmlFor="availability_type">نوع التوفر الافتراضي</Label>
                  <Select
                    value={formData.availability_type || 'pre_order'}
                    onValueChange={(value) => 
                      setFormData({ ...formData, availability_type: value })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock">متوفر في المخزون</SelectItem>
                      <SelectItem value="pre_order">طلب مسبق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="featured"
                    checked={formData.featured || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, featured: checked })
                    }
                  />
                  <Label htmlFor="featured" className="cursor-pointer">
                    منتج مميز
                  </Label>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Options & Colors Defaults */}
        <AdminCard>
          <AdminCardHeader title="إعدادات توفر الخيارات والألوان" description="سيتم تطبيقها على جميع الخيارات والألوان الجديدة" />
          <AdminCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-semibold">إعدادات الخيارات</Label>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_option_in_stock"
                    checked={formData.default_option_in_stock !== false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_option_in_stock: checked })
                    }
                  />
                  <Label htmlFor="default_option_in_stock" className="cursor-pointer text-sm">
                    متوفر في المخزون
                  </Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_option_available_for_direct_sale"
                    checked={formData.default_option_available_for_direct_sale !== false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_option_available_for_direct_sale: checked })
                    }
                  />
                  <Label htmlFor="default_option_available_for_direct_sale" className="cursor-pointer text-sm">
                    متوفر للبيع المباشر
                  </Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_option_available_for_pre_order"
                    checked={formData.default_option_available_for_pre_order || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_option_available_for_pre_order: checked })
                    }
                  />
                  <Label htmlFor="default_option_available_for_pre_order" className="cursor-pointer text-sm">
                    متوفر للطلب المسبق
                  </Label>
                </div>
              </div>

              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-semibold">إعدادات الألوان</Label>
                
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_color_in_stock"
                    checked={formData.default_color_in_stock !== false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_color_in_stock: checked })
                    }
                  />
                  <Label htmlFor="default_color_in_stock" className="cursor-pointer text-sm">
                    متوفر في المخزون
                  </Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_color_available_for_direct_sale"
                    checked={formData.default_color_available_for_direct_sale !== false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_color_available_for_direct_sale: checked })
                    }
                  />
                  <Label htmlFor="default_color_available_for_direct_sale" className="cursor-pointer text-sm">
                    متوفر للبيع المباشر
                  </Label>
                </div>

                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox
                    id="default_color_available_for_pre_order"
                    checked={formData.default_color_available_for_pre_order || false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, default_color_available_for_pre_order: checked })
                    }
                  />
                  <Label htmlFor="default_color_available_for_pre_order" className="cursor-pointer text-sm">
                    متوفر للطلب المسبق
                  </Label>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Shipping Options */}
        <AdminCard>
          <AdminCardHeader 
            title="خيارات الشحن للطلب المسبق" 
            actions={
              <Button type="button" variant="outline" size="sm" onClick={addShippingOption}>
                <Plus className="h-4 w-4 ml-1" />
                إضافة خيار
              </Button>
            }
          />
          <AdminCardContent>
            <div className="space-y-4">
              {formData.pre_order_shipping_options?.map((option: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-semibold">خيار الشحن {index + 1}</Label>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeShippingOption(index)}
                    >
                      <X className="h-4 w-4" />
                    </Button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="admin-form-group">
                      <Label>الاسم بالعربي</Label>
                      <Input
                        value={option.name_ar}
                        onChange={(e) => handleShippingOptionChange(index, 'name_ar', e.target.value)}
                        placeholder="شحن مجاني (45 يومًا)"
                      />
                    </div>

                    <div className="admin-form-group">
                      <Label>الاسم بالإنجليزي</Label>
                      <Input
                        value={option.name}
                        onChange={(e) => handleShippingOptionChange(index, 'name', e.target.value)}
                        placeholder="Free Shipping (45 days)"
                      />
                    </div>

                    <div className="admin-form-group">
                      <Label>تعديل السعر</Label>
                      <Input
                        type="number"
                        value={option.price_adjustment}
                        onChange={(e) => handleShippingOptionChange(index, 'price_adjustment', parseFloat(e.target.value) || 0)}
                        placeholder="0"
                      />
                    </div>
                  </div>
                </div>
              ))}

              {(!formData.pre_order_shipping_options || formData.pre_order_shipping_options.length === 0) && (
                <p className="text-center text-muted-foreground py-8">
                  لا توجد خيارات شحن. اضغط على "إضافة خيار" لإضافة خيار جديد.
                </p>
              )}
            </div>
          </AdminCardContent>
        </AdminCard>
        {/* Tax Settings */}
        <AdminCard>
          <AdminCardHeader title="إعدادات الضرائب" description="تحديد نسبة الضريبة المفروضة على الطلبات" />
          <AdminCardContent>
            <div className="admin-form-group max-w-xs">
              <Label htmlFor="tax_percentage">نسبة الضريبة (%)</Label>
              <Input
                id="tax_percentage"
                type="number"
                min="0"
                max="100"
                step="0.1"
                value={taxPercentage}
                onChange={(e) => setTaxPercentage(parseFloat(e.target.value) || 0)}
                placeholder="30"
              />
              <p className="text-xs text-muted-foreground mt-1">
                النسبة الافتراضية هي 30%. سيتم تطبيقها على جميع الطلبات.
              </p>
            </div>
          </AdminCardContent>
        </AdminCard>
      </form>
    </AdminLayout>
  );
}
