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
import { Loader2, Save, ArrowRight, Plus, X } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const AdminDefaultSettings = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch default settings
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

  const [formData, setFormData] = useState<any>(null);

  // Initialize form data when settings are loaded
  useEffect(() => {
    if (settings?.setting_value) {
      setFormData(settings.setting_value);
    }
  }, [settings]);

  // Update mutation
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

  // Check auth and admin status
  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
    }
  }, [authLoading, user, isAdmin, navigate]);

  if (authLoading || isLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user || !isAdmin) {
    return null;
  }

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    updateMutation.mutate(formData);
  };

  const handleShippingOptionChange = (index: number, field: string, value: any) => {
    const newOptions = [...(formData.pre_order_shipping_options || [])];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  const addShippingOption = () => {
    const newOptions = [...(formData.pre_order_shipping_options || []), {
      name: '',
      name_ar: '',
      price_adjustment: 0,
    }];
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  const removeShippingOption = (index: number) => {
    const newOptions = formData.pre_order_shipping_options.filter((_: any, i: number) => i !== index);
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  if (!formData) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-accent/5 py-8">
      <div className="container mx-auto px-4 max-w-4xl">
        <div className="mb-6">
          <Button
            variant="ghost"
            onClick={() => navigate('/admin')}
            className="mb-4"
          >
            <ArrowRight className="h-4 w-4 ml-2 rotate-180" />
            العودة إلى لوحة التحكم
          </Button>
          <h1 className="text-3xl font-bold text-foreground">الإعدادات الافتراضية</h1>
          <p className="text-muted-foreground mt-2">
            قم بتخصيص الإعدادات الافتراضية التي سيتم تطبيقها على المنتجات الجديدة
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات المنتج الافتراضية</CardTitle>
              <CardDescription>
                هذه الإعدادات سيتم تطبيقها تلقائياً عند إضافة منتج جديد
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {/* Currency */}
              <div className="space-y-2">
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

                <div className="space-y-2">
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
                    id="in_stock"
                    checked={formData.in_stock !== false}
                    onCheckedChange={(checked) => 
                      setFormData({ ...formData, in_stock: checked })
                    }
                  />
                  <Label htmlFor="in_stock" className="cursor-pointer">
                    متوفر (in_stock flag)
                  </Label>
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

              {/* Pre-order Shipping Options */}
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <Label className="text-base font-semibold">خيارات الشحن للطلب المسبق</Label>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={addShippingOption}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة خيار شحن
                  </Button>
                </div>

                {formData.pre_order_shipping_options?.map((option: any, index: number) => (
                  <Card key={index} className="p-4">
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
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

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <Label>الاسم بالعربي</Label>
                          <Input
                            value={option.name_ar}
                            onChange={(e) => handleShippingOptionChange(index, 'name_ar', e.target.value)}
                            placeholder="شحن مجاني (45 يومًا)"
                          />
                        </div>

                        <div>
                          <Label>الاسم بالإنجليزي</Label>
                          <Input
                            value={option.name}
                            onChange={(e) => handleShippingOptionChange(index, 'name', e.target.value)}
                            placeholder="Free Shipping (45 days)"
                          />
                        </div>

                        <div className="md:col-span-2">
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
                  </Card>
                ))}
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
};

export default AdminDefaultSettings;
