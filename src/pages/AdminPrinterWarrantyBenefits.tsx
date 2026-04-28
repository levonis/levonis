import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Save, Search } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

interface PrinterProduct {
  id: string;
  name_ar: string;
  name: string;
  image_url: string | null;
}

interface BenefitSettings {
  id?: string;
  product_id: string;
  is_active: boolean;
  discount_percentage: number;
  discount_max_amount_monthly: number;
  free_shipping_max_uses_monthly: number;
  free_shipping_min_order: number;
  free_shipping_methods: string[];
}

const DEFAULT_METHODS = ['standard', 'personal', 'pickup'];

const SettingsRow = ({ product, existing }: { product: PrinterProduct; existing: BenefitSettings | null }) => {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [form, setForm] = useState<BenefitSettings>(() => existing ?? {
    product_id: product.id,
    is_active: false,
    discount_percentage: 0,
    discount_max_amount_monthly: 0,
    free_shipping_max_uses_monthly: 0,
    free_shipping_min_order: 0,
    free_shipping_methods: ['standard'],
  });

  useEffect(() => {
    if (existing) setForm(existing);
  }, [existing]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        product_id: product.id,
        is_active: form.is_active,
        discount_percentage: Number(form.discount_percentage) || 0,
        discount_max_amount_monthly: Number(form.discount_max_amount_monthly) || 0,
        free_shipping_max_uses_monthly: Number(form.free_shipping_max_uses_monthly) || 0,
        free_shipping_min_order: Number(form.free_shipping_min_order) || 0,
        free_shipping_methods: form.free_shipping_methods,
      };
      const { error } = await (supabase as any)
        .from('printer_warranty_benefits')
        .upsert(payload, { onConflict: 'product_id' });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('admin_warranty_benefits_saved'));
      qc.invalidateQueries({ queryKey: ['admin-warranty-benefits'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Error'),
  });

  const toggleMethod = (m: string) => {
    setForm((f) => ({
      ...f,
      free_shipping_methods: f.free_shipping_methods.includes(m)
        ? f.free_shipping_methods.filter((x) => x !== m)
        : [...f.free_shipping_methods, m],
    }));
  };

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          {product.image_url ? (
            <img src={product.image_url} className="w-12 h-12 rounded-lg object-cover bg-muted shrink-0" alt="" />
          ) : (
            <div className="w-12 h-12 rounded-lg bg-muted flex items-center justify-center shrink-0">
              <Shield className="w-5 h-5 text-muted-foreground" />
            </div>
          )}
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{product.name_ar || product.name}</div>
            {existing?.is_active && (
              <Badge variant="secondary" className="text-[10px] mt-0.5">
                {t('admin_warranty_benefits_enable')} ✓
              </Badge>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <Label className="text-xs">{t('admin_warranty_benefits_enable')}</Label>
          <Switch
            checked={form.is_active}
            onCheckedChange={(v) => setForm({ ...form, is_active: v })}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">{t('admin_warranty_benefits_discount_pct')}</Label>
          <Input
            type="number"
            min={0}
            max={100}
            step="0.5"
            value={form.discount_percentage}
            onChange={(e) => setForm({ ...form, discount_percentage: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">{t('admin_warranty_benefits_discount_cap')}</Label>
          <Input
            type="number"
            min={0}
            value={form.discount_max_amount_monthly}
            onChange={(e) => setForm({ ...form, discount_max_amount_monthly: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">{t('admin_warranty_benefits_ship_uses')}</Label>
          <Input
            type="number"
            min={0}
            value={form.free_shipping_max_uses_monthly}
            onChange={(e) => setForm({ ...form, free_shipping_max_uses_monthly: Number(e.target.value) })}
          />
        </div>
        <div>
          <Label className="text-xs">{t('admin_warranty_benefits_ship_min')}</Label>
          <Input
            type="number"
            min={0}
            value={form.free_shipping_min_order}
            onChange={(e) => setForm({ ...form, free_shipping_min_order: Number(e.target.value) })}
          />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">{t('admin_warranty_benefits_ship_methods')}</Label>
        <div className="flex flex-wrap gap-3">
          {DEFAULT_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.free_shipping_methods.includes(m)}
                onCheckedChange={() => toggleMethod(m)}
              />
              <span className="text-xs capitalize">{m}</span>
            </label>
          ))}
        </div>
      </div>

      <Button
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full"
        size="sm"
      >
        {saveMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
        {t('admin_warranty_benefits_save')}
      </Button>
    </Card>
  );
};

const AdminPrinterWarrantyBenefits = () => {
  const { t } = useLanguage();
  const [search, setSearch] = useState('');

  const { data: printers, isLoading } = useQuery({
    queryKey: ['admin-printer-products-for-warranty'],
    queryFn: async (): Promise<PrinterProduct[]> => {
      // Find printer category
      const { data: categories } = await supabase
        .from('categories')
        .select('id, name_ar, name')
        .or('name.ilike.%printer%,name_ar.ilike.%طابع%');
      const catIds = (categories || []).map((c: any) => c.id);
      if (catIds.length === 0) return [];

      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, name, image_url')
        .in('category_id', catIds)
        .order('name_ar');
      if (error) throw error;
      return (data || []) as PrinterProduct[];
    },
  });

  const { data: benefits } = useQuery({
    queryKey: ['admin-warranty-benefits'],
    queryFn: async (): Promise<BenefitSettings[]> => {
      const { data, error } = await (supabase as any)
        .from('printer_warranty_benefits')
        .select('*');
      if (error) throw error;
      return (data || []) as BenefitSettings[];
    },
  });

  const filtered = (printers || []).filter((p) =>
    !search ||
    p.name_ar?.toLowerCase().includes(search.toLowerCase()) ||
    p.name?.toLowerCase().includes(search.toLowerCase())
  );

  const benefitsMap = new Map((benefits || []).map((b) => [b.product_id, b]));

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        <div className="flex items-center gap-3 mb-2">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div>
            <h1 className="text-lg font-bold">{t('admin_warranty_benefits_title')}</h1>
          </div>
        </div>

        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="..."
            className="pr-9"
          />
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((p) => (
              <SettingsRow key={p.id} product={p} existing={benefitsMap.get(p.id) || null} />
            ))}
            {filtered.length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">No printer products found.</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminPrinterWarrantyBenefits;
