import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Save, Plus, X, Settings, Percent, ChevronDown, ChevronUp } from 'lucide-react';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from '@/components/admin/AdminLayout';

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
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

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

  const { data: mainSections } = useQuery({
    queryKey: ['main-sections-tax'],
    queryFn: async () => {
      const { data, error } = await supabase.from('main_sections').select('id, name_ar').order('display_order');
      if (error) throw error;
      return data || [];
    },
  });

  const { data: categories } = useQuery({
    queryKey: ['categories-tax'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name_ar, main_section_id, tax_rate').order('name_ar');
      if (error) throw error;
      return data || [];
    },
  });

  const [globalTaxPercentage, setGlobalTaxPercentage] = useState<number>(0);
  const [sectionTaxRates, setSectionTaxRates] = useState<Record<string, number>>({});
  const [categoryTaxRates, setCategoryTaxRates] = useState<Record<string, number>>({});
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (settings?.setting_value) setFormData(settings.setting_value);
    else if (settings === null && !isLoading) {
      setFormData({ currency: 'دينار عراقي', has_in_stock: false, has_pre_order: true, availability_type: 'pre_order', featured: false, pre_order_shipping_options: [] });
    }
  }, [settings, isLoading]);

  useEffect(() => {
    if (taxSettings?.setting_value) {
      const val = taxSettings.setting_value as any;
      setGlobalTaxPercentage(val?.tax_percentage ?? 0);
      setSectionTaxRates(val?.section_tax_rates ?? {});
    }
  }, [taxSettings]);

  useEffect(() => {
    if (categories) {
      const rates: Record<string, number> = {};
      categories.forEach(c => { rates[c.id] = c.tax_rate ?? 0; });
      setCategoryTaxRates(rates);
    }
  }, [categories]);

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) navigate('/');
  }, [authLoading, user, isAdmin, navigate]);

  const updateMutation = useMutation({
    mutationFn: async (newSettings: any) => {
      const { data: existing } = await supabase.from('default_settings').select('id').eq('setting_key', 'product_defaults').maybeSingle();
      if (existing) {
        const { error } = await supabase.from('default_settings').update({ setting_value: newSettings }).eq('setting_key', 'product_defaults');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('default_settings').insert({ setting_key: 'product_defaults', setting_value: newSettings });
        if (error) throw error;
      }
    },
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['default-settings'] }); toast.success('تم حفظ الإعدادات الافتراضية'); },
    onError: (error: any) => { toast.error('فشل: ' + error.message); },
  });

  const updateTaxMutation = useMutation({
    mutationFn: async () => {
      const taxValue = { tax_percentage: globalTaxPercentage, section_tax_rates: sectionTaxRates };
      const { data: existing } = await supabase.from('default_settings').select('id').eq('setting_key', 'tax_settings').maybeSingle();
      if (existing) {
        const { error } = await supabase.from('default_settings').update({ setting_value: taxValue }).eq('setting_key', 'tax_settings');
        if (error) throw error;
      } else {
        const { error } = await supabase.from('default_settings').insert({ setting_key: 'tax_settings', setting_value: taxValue });
        if (error) throw error;
      }
      for (const [catId, rate] of Object.entries(categoryTaxRates)) {
        const { error } = await supabase.from('categories').update({ tax_rate: rate }).eq('id', catId);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['tax-settings'] });
      queryClient.invalidateQueries({ queryKey: ['categories-tax'] });
      toast.success('تم حفظ إعدادات الضرائب');
    },
    onError: (error: any) => { toast.error('فشل: ' + error.message); },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (formData) updateMutation.mutate(formData);
    updateTaxMutation.mutate();
  };

  const handleShippingOptionChange = (index: number, field: string, value: any) => {
    if (!formData) return;
    const newOptions = [...(formData.pre_order_shipping_options || [])];
    newOptions[index] = { ...newOptions[index], [field]: value };
    setFormData({ ...formData, pre_order_shipping_options: newOptions });
  };

  const addShippingOption = () => {
    if (!formData) return;
    setFormData({ ...formData, pre_order_shipping_options: [...(formData.pre_order_shipping_options || []), { name: '', name_ar: '', price_adjustment: 0 }] });
  };

  const removeShippingOption = (index: number) => {
    if (!formData) return;
    setFormData({ ...formData, pre_order_shipping_options: formData.pre_order_shipping_options.filter((_: any, i: number) => i !== index) });
  };

  const toggleSection = (id: string) => {
    const newSet = new Set(expandedSections);
    if (newSet.has(id)) newSet.delete(id); else newSet.add(id);
    setExpandedSections(newSet);
  };

  const getEffectiveTaxRate = (categoryId: string, sectionId: string | null) => {
    const catRate = categoryTaxRates[categoryId];
    if (catRate != null && catRate > 0) return catRate;
    if (sectionId && sectionTaxRates[sectionId] != null && sectionTaxRates[sectionId] > 0) return sectionTaxRates[sectionId];
    return globalTaxPercentage;
  };

  if (authLoading || isLoading || taxLoading) {
    return <AdminLayout title="الإعدادات الافتراضية" icon={<Settings className="h-5 w-5" />}><AdminLoading /></AdminLayout>;
  }
  if (!user || !isAdmin) return null;
  if (!formData) return <AdminLayout title="الإعدادات الافتراضية" icon={<Settings className="h-5 w-5" />}><AdminLoading /></AdminLayout>;

  return (
    <AdminLayout
      title="الإعدادات الافتراضية"
      icon={<Settings className="h-5 w-5" />}
      description="تخصيص الإعدادات الافتراضية للمنتجات والضرائب"
      actions={
        <Button onClick={handleSubmit} disabled={updateMutation.isPending || updateTaxMutation.isPending} className="admin-btn-primary gap-2">
          <Save className="h-4 w-4" />
          {updateMutation.isPending || updateTaxMutation.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      }
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* TAX SETTINGS */}
        <AdminCard>
          <AdminCardHeader 
            title="⚡ إعدادات الضرائب" 
            description="الضريبة مدمجة مع سعر المنتج. الأولوية: ضريبة الفئة > ضريبة القسم > الضريبة العامة"
          />
          <AdminCardContent>
            <div className="space-y-6">
              {/* Global Tax */}
              <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
                    <Percent className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <Label className="text-base font-bold">الضريبة العامة للموقع</Label>
                    <p className="text-xs text-muted-foreground">تُطبق على جميع المنتجات كقيمة افتراضية (مدمجة مع السعر)</p>
                  </div>
                </div>
                <div className="max-w-xs">
                  <div className="relative">
                    <Input type="number" min="0" max="100" step="0.1" value={globalTaxPercentage} onChange={(e) => setGlobalTaxPercentage(parseFloat(e.target.value) || 0)} className="pl-8" />
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground mt-1">مثال: منتج بسعر 1,000 مع ضريبة 30% = يُعرض بسعر 1,300</p>
                </div>
              </div>

              {/* Per-Section Tax */}
              <div className="space-y-3">
                <Label className="text-base font-bold flex items-center gap-2">
                  ضريبة الأقسام الرئيسية
                  <Badge variant="secondary" className="text-[10px]">تتجاوز الضريبة العامة</Badge>
                </Label>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {mainSections?.map((section) => (
                    <div key={section.id} className="p-3 rounded-lg border bg-card">
                      <div className="flex items-center justify-between gap-3">
                        <span className="font-medium text-sm truncate">{section.name_ar}</span>
                        <div className="flex items-center gap-1 shrink-0">
                          <Input
                            type="number" min="0" max="100" step="0.1"
                            value={sectionTaxRates[section.id] ?? ''}
                            onChange={(e) => { const val = parseFloat(e.target.value); setSectionTaxRates(prev => ({ ...prev, [section.id]: isNaN(val) ? 0 : val })); }}
                            placeholder={`${globalTaxPercentage}%`}
                            className="w-20 h-8 text-sm"
                          />
                          <span className="text-xs text-muted-foreground">%</span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Per-Category Tax */}
              <div className="space-y-3">
                <Label className="text-base font-bold flex items-center gap-2">
                  ضريبة الفئات الفرعية
                  <Badge variant="secondary" className="text-[10px]">الأولوية القصوى</Badge>
                </Label>
                <p className="text-xs text-muted-foreground">اضغط على القسم لعرض فئاته. ضريبة الفئة تتجاوز ضريبة القسم والضريبة العامة.</p>
                
                {mainSections?.map((section) => {
                  const sectionCategories = categories?.filter(c => c.main_section_id === section.id) || [];
                  if (sectionCategories.length === 0) return null;
                  const isExpanded = expandedSections.has(section.id);
                  
                  return (
                    <Collapsible key={section.id} open={isExpanded} onOpenChange={() => toggleSection(section.id)}>
                      <CollapsibleTrigger asChild>
                        <button type="button" className="w-full flex items-center justify-between p-3 rounded-lg border hover:bg-muted/50 transition-colors">
                          <div className="flex items-center gap-2">
                            <span className="font-medium text-sm">{section.name_ar}</span>
                            <Badge variant="outline" className="text-[10px]">{sectionCategories.length} فئة</Badge>
                          </div>
                          {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                        </button>
                      </CollapsibleTrigger>
                      <CollapsibleContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2 mr-4">
                          {sectionCategories.map((cat) => {
                            const effectiveRate = getEffectiveTaxRate(cat.id, section.id);
                            return (
                              <div key={cat.id} className="p-2.5 rounded-lg border bg-muted/20">
                                <div className="flex items-center justify-between gap-2">
                                  <div className="min-w-0">
                                    <span className="text-sm truncate block">{cat.name_ar}</span>
                                    <span className="text-[10px] text-muted-foreground">الفعلية: {effectiveRate}%</span>
                                  </div>
                                  <div className="flex items-center gap-1 shrink-0">
                                    <Input
                                      type="number" min="0" max="100" step="0.1"
                                      value={categoryTaxRates[cat.id] ?? ''}
                                      onChange={(e) => { const val = parseFloat(e.target.value); setCategoryTaxRates(prev => ({ ...prev, [cat.id]: isNaN(val) ? 0 : val })); }}
                                      placeholder="0"
                                      className="w-16 h-7 text-xs"
                                    />
                                    <span className="text-xs text-muted-foreground">%</span>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </CollapsibleContent>
                    </Collapsible>
                  );
                })}
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* PRODUCT DEFAULTS */}
        <AdminCard>
          <AdminCardHeader title="إعدادات المنتج الافتراضية" description="سيتم تطبيقها تلقائياً عند إضافة منتج جديد" />
          <AdminCardContent>
            <div className="space-y-6">
              <div className="admin-form-group">
                <Label htmlFor="currency">العملة الافتراضية</Label>
                <Input id="currency" value={formData.currency || ''} onChange={(e) => setFormData({ ...formData, currency: e.target.value })} placeholder="ريال" />
              </div>
              <div className="space-y-4">
                <Label className="text-base font-semibold">حالة التوفر الافتراضية</Label>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="has_in_stock" checked={formData.has_in_stock || false} onCheckedChange={(checked) => setFormData({ ...formData, has_in_stock: checked })} />
                  <Label htmlFor="has_in_stock" className="cursor-pointer">متوفر في المخزون</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="has_pre_order" checked={formData.has_pre_order || false} onCheckedChange={(checked) => setFormData({ ...formData, has_pre_order: checked })} />
                  <Label htmlFor="has_pre_order" className="cursor-pointer">طلب مسبق</Label>
                </div>
                <div className="admin-form-group">
                  <Label htmlFor="availability_type">نوع التوفر الافتراضي</Label>
                  <Select value={formData.availability_type || 'pre_order'} onValueChange={(value) => setFormData({ ...formData, availability_type: value })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="in_stock">متوفر في المخزون</SelectItem>
                      <SelectItem value="pre_order">طلب مسبق</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="featured" checked={formData.featured || false} onCheckedChange={(checked) => setFormData({ ...formData, featured: checked })} />
                  <Label htmlFor="featured" className="cursor-pointer">منتج مميز</Label>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Options & Colors Defaults */}
        <AdminCard>
          <AdminCardHeader title="إعدادات توفر الخيارات والألوان" />
          <AdminCardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-semibold">إعدادات الخيارات</Label>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="doi" checked={formData.default_option_in_stock !== false} onCheckedChange={(checked) => setFormData({ ...formData, default_option_in_stock: checked })} />
                  <Label htmlFor="doi" className="cursor-pointer text-sm">متوفر في المخزون</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="dod" checked={formData.default_option_available_for_direct_sale !== false} onCheckedChange={(checked) => setFormData({ ...formData, default_option_available_for_direct_sale: checked })} />
                  <Label htmlFor="dod" className="cursor-pointer text-sm">متوفر للبيع المباشر</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="dop" checked={formData.default_option_available_for_pre_order || false} onCheckedChange={(checked) => setFormData({ ...formData, default_option_available_for_pre_order: checked })} />
                  <Label htmlFor="dop" className="cursor-pointer text-sm">متوفر للطلب المسبق</Label>
                </div>
              </div>
              <div className="space-y-3 p-4 bg-muted/30 rounded-lg">
                <Label className="text-sm font-semibold">إعدادات الألوان</Label>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="dci" checked={formData.default_color_in_stock !== false} onCheckedChange={(checked) => setFormData({ ...formData, default_color_in_stock: checked })} />
                  <Label htmlFor="dci" className="cursor-pointer text-sm">متوفر في المخزون</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="dcd" checked={formData.default_color_available_for_direct_sale !== false} onCheckedChange={(checked) => setFormData({ ...formData, default_color_available_for_direct_sale: checked })} />
                  <Label htmlFor="dcd" className="cursor-pointer text-sm">متوفر للبيع المباشر</Label>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Checkbox id="dcp" checked={formData.default_color_available_for_pre_order || false} onCheckedChange={(checked) => setFormData({ ...formData, default_color_available_for_pre_order: checked })} />
                  <Label htmlFor="dcp" className="cursor-pointer text-sm">متوفر للطلب المسبق</Label>
                </div>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>

        {/* Shipping Options */}
        <AdminCard>
          <AdminCardHeader title="خيارات الشحن للطلب المسبق" actions={
            <Button type="button" variant="outline" size="sm" onClick={addShippingOption}><Plus className="h-4 w-4 ml-1" />إضافة خيار</Button>
          } />
          <AdminCardContent>
            <div className="space-y-4">
              {formData.pre_order_shipping_options?.map((option: any, index: number) => (
                <div key={index} className="p-4 border rounded-lg bg-muted/20">
                  <div className="flex items-center justify-between mb-3">
                    <Label className="font-semibold">خيار الشحن {index + 1}</Label>
                    <Button type="button" variant="ghost" size="sm" onClick={() => removeShippingOption(index)}><X className="h-4 w-4" /></Button>
                  </div>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                    <div className="admin-form-group"><Label>الاسم بالعربي</Label><Input value={option.name_ar} onChange={(e) => handleShippingOptionChange(index, 'name_ar', e.target.value)} /></div>
                    <div className="admin-form-group"><Label>الاسم بالإنجليزي</Label><Input value={option.name} onChange={(e) => handleShippingOptionChange(index, 'name', e.target.value)} /></div>
                    <div className="admin-form-group"><Label>تعديل السعر</Label><Input type="number" value={option.price_adjustment} onChange={(e) => handleShippingOptionChange(index, 'price_adjustment', parseFloat(e.target.value) || 0)} /></div>
                  </div>
                </div>
              ))}
              {(!formData.pre_order_shipping_options || formData.pre_order_shipping_options.length === 0) && (
                <p className="text-center text-muted-foreground py-8">لا توجد خيارات شحن.</p>
              )}
            </div>
          </AdminCardContent>
        </AdminCard>
      </form>
    </AdminLayout>
  );
}
