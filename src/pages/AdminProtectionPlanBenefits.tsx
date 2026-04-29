import { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { Badge } from '@/components/ui/badge';
import { Loader2, Shield, Save, ArrowRight } from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';

interface CategoryRow { id: string; name: string; name_ar: string | null }

interface PlanRow {
  id: string;
  plan_type: string;
  name_ar: string;
  badge_text: string | null;
  monthly_price: number;
  display_order: number | null;
  benefit_discount_percentage: number;
  benefit_discount_max_amount_monthly: number;
  benefit_discount_category_ids: string[] | null;
  benefit_free_shipping_max_monthly: number;
  benefit_free_shipping_min_order: number;
  benefit_free_shipping_methods: string[] | null;
  benefit_free_shipping_category_ids: string[] | null;
}

const DEFAULT_METHODS = ['standard', 'personal', 'pickup'];

const CategoryMultiSelect = ({
  label, hint, categories, selected, onChange,
}: { label: string; hint: string; categories: CategoryRow[]; selected: string[]; onChange: (n: string[]) => void }) => {
  const toggle = (id: string) => onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);
  return (
    <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3 space-y-2">
      <div>
        <Label className="text-xs font-semibold">{label}</Label>
        <p className="text-[10px] text-muted-foreground mt-0.5">{hint}</p>
      </div>
      <div className="flex flex-wrap gap-2">
        {categories.map((c) => {
          const checked = selected.includes(c.id);
          return (
            <label key={c.id} className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-xs select-none border ${checked ? 'bg-primary/10 border-primary/40' : 'bg-background border-border'}`}>
              <Checkbox checked={checked} onCheckedChange={() => toggle(c.id)} />
              <span>{c.name_ar || c.name}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
};

const PlanCard = ({ plan, categories }: { plan: PlanRow; categories: CategoryRow[] }) => {
  const { t } = useLanguage();
  const qc = useQueryClient();
  const initial = () => ({
    benefit_discount_percentage: plan.benefit_discount_percentage || 0,
    benefit_discount_max_amount_monthly: plan.benefit_discount_max_amount_monthly || 0,
    benefit_free_shipping_max_monthly: plan.benefit_free_shipping_max_monthly || 0,
    benefit_free_shipping_min_order: plan.benefit_free_shipping_min_order || 0,
    benefit_free_shipping_methods: plan.benefit_free_shipping_methods || ['standard'],
    benefit_discount_category_ids: plan.benefit_discount_category_ids || [],
    benefit_free_shipping_category_ids: plan.benefit_free_shipping_category_ids || [],
  });
  const [form, setForm] = useState(initial);

  useEffect(() => { setForm(initial()); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [plan.id]);

  const save = useMutation({
    mutationFn: async () => {
      const payload: any = {
        benefit_discount_percentage: Number(form.benefit_discount_percentage) || 0,
        benefit_discount_max_amount_monthly: Number(form.benefit_discount_max_amount_monthly) || 0,
        benefit_free_shipping_max_monthly: Number(form.benefit_free_shipping_max_monthly) || 0,
        benefit_free_shipping_min_order: Number(form.benefit_free_shipping_min_order) || 0,
        benefit_free_shipping_methods: form.benefit_free_shipping_methods,
        benefit_discount_category_ids: form.benefit_discount_category_ids.length > 0 ? form.benefit_discount_category_ids : null,
        benefit_free_shipping_category_ids: form.benefit_free_shipping_category_ids.length > 0 ? form.benefit_free_shipping_category_ids : null,
      };
      const { error } = await (supabase as any).from('protection_plans').update(payload).eq('id', plan.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(t('admin_warranty_benefits_saved') || 'تم الحفظ');
      qc.invalidateQueries({ queryKey: ['admin-protection-plan-benefits'] });
      qc.invalidateQueries({ queryKey: ['admin-protection-plans'] });
      qc.invalidateQueries({ queryKey: ['protection-plans'] });
    },
    onError: (e: any) => toast.error(e?.message || 'Error'),
  });

  const toggleMethod = (m: string) => setForm((f) => ({
    ...f,
    benefit_free_shipping_methods: f.benefit_free_shipping_methods.includes(m)
      ? f.benefit_free_shipping_methods.filter((x) => x !== m)
      : [...f.benefit_free_shipping_methods, m],
  }));

  const isActive = (form.benefit_discount_percentage > 0 && form.benefit_discount_max_amount_monthly > 0) || form.benefit_free_shipping_max_monthly > 0;

  return (
    <Card className="p-4 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-12 h-12 rounded-lg bg-emerald-500/10 flex items-center justify-center shrink-0">
            <Shield className="w-5 h-5 text-emerald-600" />
          </div>
          <div className="min-w-0">
            <div className="font-bold text-sm truncate">{plan.name_ar}</div>
            <div className="flex items-center gap-1.5 mt-0.5 flex-wrap">
              <Badge variant="outline" className="text-[10px]">{plan.plan_type}</Badge>
              {plan.badge_text && <Badge variant="secondary" className="text-[10px]">{plan.badge_text}</Badge>}
              {isActive && <Badge className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">✓ مُفعّل</Badge>}
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <Label className="text-xs">نسبة الخصم %</Label>
          <Input type="number" min={0} max={100} step="0.5"
            value={form.benefit_discount_percentage}
            onChange={(e) => setForm({ ...form, benefit_discount_percentage: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">الحد الأقصى الشهري للخصم (د.ع)</Label>
          <Input type="number" min={0}
            value={form.benefit_discount_max_amount_monthly}
            onChange={(e) => setForm({ ...form, benefit_discount_max_amount_monthly: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">مرات الشحن المجاني الشهرية</Label>
          <Input type="number" min={0}
            value={form.benefit_free_shipping_max_monthly}
            onChange={(e) => setForm({ ...form, benefit_free_shipping_max_monthly: Number(e.target.value) })} />
        </div>
        <div>
          <Label className="text-xs">الحد الأدنى للطلب (د.ع)</Label>
          <Input type="number" min={0}
            value={form.benefit_free_shipping_min_order}
            onChange={(e) => setForm({ ...form, benefit_free_shipping_min_order: Number(e.target.value) })} />
        </div>
      </div>

      <div>
        <Label className="text-xs mb-2 block">طرق التوصيل المسموح بها للشحن المجاني</Label>
        <div className="flex flex-wrap gap-3">
          {DEFAULT_METHODS.map((m) => (
            <label key={m} className="flex items-center gap-2 cursor-pointer">
              <Checkbox
                checked={form.benefit_free_shipping_methods.includes(m)}
                onCheckedChange={() => toggleMethod(m)} />
              <span className="text-xs capitalize">{m}</span>
            </label>
          ))}
        </div>
      </div>

      <CategoryMultiSelect
        label="الأقسام المؤهلة للخصم"
        hint="اتركه فارغاً ليُطبَّق على كل الأقسام"
        categories={categories}
        selected={form.benefit_discount_category_ids}
        onChange={(next) => setForm({ ...form, benefit_discount_category_ids: next })} />

      <CategoryMultiSelect
        label="الأقسام المؤهلة للشحن المجاني"
        hint="اتركه فارغاً ليُطبَّق على كل الأقسام"
        categories={categories}
        selected={form.benefit_free_shipping_category_ids}
        onChange={(next) => setForm({ ...form, benefit_free_shipping_category_ids: next })} />

      <Button onClick={() => save.mutate()} disabled={save.isPending} className="w-full" size="sm">
        {save.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4 ml-1" />}
        حفظ
      </Button>
    </Card>
  );
};

const AdminProtectionPlanBenefits = () => {
  const navigate = useNavigate();

  const { data: plans, isLoading } = useQuery({
    queryKey: ['admin-protection-plan-benefits'],
    queryFn: async (): Promise<PlanRow[]> => {
      const { data, error } = await (supabase as any)
        .from('protection_plans')
        .select('id, plan_type, name_ar, badge_text, monthly_price, display_order, benefit_discount_percentage, benefit_discount_max_amount_monthly, benefit_discount_category_ids, benefit_free_shipping_max_monthly, benefit_free_shipping_min_order, benefit_free_shipping_methods, benefit_free_shipping_category_ids')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return (data || []) as PlanRow[];
    },
  });

  const { data: allCategories } = useQuery({
    queryKey: ['all-categories-for-benefits'],
    queryFn: async (): Promise<CategoryRow[]> => {
      const { data, error } = await supabase.from('categories').select('id, name, name_ar').order('name');
      if (error) throw error;
      return (data || []) as CategoryRow[];
    },
  });

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-6 max-w-4xl space-y-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-emerald-500/10 rounded-xl">
              <Shield className="w-5 h-5 text-emerald-600" />
            </div>
            <div>
              <h1 className="text-lg font-bold">فوائد باقات الحماية</h1>
              <p className="text-xs text-muted-foreground">إعداد الخصم الشهري والشحن المجاني لكل باقة اشتراك</p>
            </div>
          </div>
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}/printer-protection`)}>
            <ArrowRight className="w-4 h-4 ml-1" /> رجوع
          </Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>
        ) : (
          <div className="space-y-3">
            {(plans || []).map((p) => (
              <PlanCard key={p.id} plan={p} categories={allCategories || []} />
            ))}
            {(plans || []).length === 0 && (
              <p className="text-center text-sm text-muted-foreground py-12">لا توجد باقات</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default AdminProtectionPlanBenefits;
