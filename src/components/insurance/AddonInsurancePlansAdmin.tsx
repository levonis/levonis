import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Switch } from '@/components/ui/switch';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from '@/components/ui/use-toast';
import { Trash2, Plus, ShieldCheck, Loader2 } from 'lucide-react';

interface Plan {
  id?: string;
  name_ar: string;
  name_en?: string | null;
  name_ku?: string | null;
  coverage_months: number;
  price_percentage: number;
  min_price_iqd?: number | null;
  max_price_iqd?: number | null;
  eligible_category_ids?: string[];
  info_description_ar?: string | null;
  requires_active_card: boolean;
  is_active: boolean;
}

const empty: Plan = {
  name_ar: 'تأمين إضافي 12 شهر',
  name_en: 'Extra Insurance 12 months',
  name_ku: '',
  coverage_months: 12,
  price_percentage: 8,
  min_price_iqd: 0,
  max_price_iqd: 0,
  eligible_category_ids: [],
  info_description_ar: '',
  requires_active_card: true,
  is_active: true,
};

const AddonInsurancePlansAdmin = () => {
  const qc = useQueryClient();
  const [editing, setEditing] = useState<Plan | null>(null);

  const { data: plans = [], isLoading } = useQuery({
    queryKey: ['admin-addon-insurance-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans' as any)
        .select('*')
        .eq('is_addon_insurance', true)
        .order('coverage_months', { ascending: true });
      if (error) throw error;
      return (data as any[]) || [];
    },
  });

  const { data: categories = [] } = useQuery({
    queryKey: ['admin-categories-for-insurance'],
    queryFn: async () => {
      const { data, error } = await supabase.from('categories').select('id, name_ar').order('name_ar');
      if (error) throw error;
      return data || [];
    },
  });

  const save = useMutation({
    mutationFn: async (p: Plan) => {
      const payload: any = {
        is_addon_insurance: true,
        plan_type: 'basic',
        monthly_price: 0,
        name_ar: p.name_ar,
        name_en: p.name_en || null,
        name_ku: p.name_ku || null,
        coverage_months: p.coverage_months,
        price_percentage: p.price_percentage,
        min_price_iqd: p.min_price_iqd || null,
        max_price_iqd: p.max_price_iqd || null,
        eligible_category_ids: p.eligible_category_ids || [],
        info_description_ar: p.info_description_ar || null,
        requires_active_card: p.requires_active_card,
        is_active: p.is_active,
        warranty_duration_months: p.coverage_months,
      };
      if (p.id) {
        const { error } = await supabase.from('protection_plans' as any).update(payload).eq('id', p.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('protection_plans' as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-addon-insurance-plans'] });
      qc.invalidateQueries({ queryKey: ['insurance-plans-addon'] });
      toast({ title: 'تم الحفظ' });
      setEditing(null);
    },
    onError: (e: any) => toast({ title: 'خطأ', description: e?.message, variant: 'destructive' as any }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('protection_plans' as any).delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['admin-addon-insurance-plans'] });
      qc.invalidateQueries({ queryKey: ['insurance-plans-addon'] });
      toast({ title: 'تم الحذف' });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="font-bold flex items-center gap-2"><ShieldCheck className="h-4 w-4 text-primary"/> باقات التأمين الإضافي</h3>
        <Button size="sm" onClick={() => setEditing({ ...empty })}><Plus className="h-3 w-3 ml-1"/> باقة جديدة</Button>
      </div>

      {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : (
        <div className="grid gap-3 sm:grid-cols-2">
          {plans.map((p: any) => (
            <Card key={p.id}>
              <CardHeader className="pb-2 flex flex-row items-center justify-between">
                <CardTitle className="text-sm">{p.name_ar}</CardTitle>
                <div className="flex gap-1">
                  <Button size="sm" variant="ghost" onClick={() => setEditing(p)}>تعديل</Button>
                  <Button size="sm" variant="ghost" className="text-destructive" onClick={() => remove.mutate(p.id)}><Trash2 className="h-3 w-3"/></Button>
                </div>
              </CardHeader>
              <CardContent className="text-xs space-y-1 text-muted-foreground">
                <div>المدة: {p.coverage_months} شهر</div>
                <div>النسبة: {p.price_percentage}%</div>
                <div>الفئات المؤهلة: {(p.eligible_category_ids || []).length || 'كل فئات الطابعات'}</div>
                <div>الحالة: {p.is_active ? 'نشط' : 'معطل'}</div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {editing && (
        <Card className="border-primary/40">
          <CardHeader><CardTitle className="text-sm">{editing.id ? 'تعديل باقة' : 'باقة جديدة'}</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div><Label>اسم البطاقة (عربي)</Label><Input value={editing.name_ar} onChange={(e) => setEditing({...editing!, name_ar: e.target.value})} /></div>
              <div><Label>الاسم (إنجليزي)</Label><Input value={editing.name_en || ''} onChange={(e) => setEditing({...editing!, name_en: e.target.value})} /></div>
              <div><Label>الاسم (كردي)</Label><Input value={editing.name_ku || ''} onChange={(e) => setEditing({...editing!, name_ku: e.target.value})} /></div>
              <div><Label>المدة (شهور)</Label>
                <Select value={String(editing.coverage_months)} onValueChange={(v) => setEditing({...editing!, coverage_months: Number(v)})}>
                  <SelectTrigger><SelectValue/></SelectTrigger>
                  <SelectContent><SelectItem value="12">12 شهر</SelectItem><SelectItem value="24">24 شهر</SelectItem></SelectContent>
                </Select>
              </div>
              <div><Label>النسبة من سعر الطابعة (%)</Label><Input type="number" step="0.01" value={editing.price_percentage} onChange={(e) => setEditing({...editing!, price_percentage: Number(e.target.value)})} /></div>
              <div><Label>أدنى سعر للتأمين (د.ع)</Label><Input type="number" value={editing.min_price_iqd || 0} onChange={(e) => setEditing({...editing!, min_price_iqd: Number(e.target.value)})} /></div>
              <div><Label>أعلى سعر للتأمين (د.ع، 0 = بلا حد)</Label><Input type="number" value={editing.max_price_iqd || 0} onChange={(e) => setEditing({...editing!, max_price_iqd: Number(e.target.value) || null})} /></div>
            </div>
            <div>
              <Label>الفئات المؤهلة (اتركها فارغة = كل المنتجات)</Label>
              <div className="grid grid-cols-2 gap-2 mt-2 max-h-40 overflow-auto border rounded p-2">
                {categories.map((c: any) => {
                  const checked = (editing.eligible_category_ids || []).includes(c.id);
                  return (
                    <label key={c.id} className="flex items-center gap-2 text-xs">
                      <input type="checkbox" checked={checked} onChange={(e) => {
                        const cur = editing.eligible_category_ids || [];
                        setEditing({...editing!, eligible_category_ids: e.target.checked ? [...cur, c.id] : cur.filter(x => x !== c.id)});
                      }} />
                      {c.name_ar}
                    </label>
                  );
                })}
              </div>
            </div>
            <div><Label>نص الشرح (نافذة التأمين)</Label><Textarea rows={3} value={editing.info_description_ar || ''} onChange={(e) => setEditing({...editing!, info_description_ar: e.target.value})} /></div>
            <div className="flex items-center gap-6">
              <div className="flex items-center gap-2"><Switch checked={editing.requires_active_card} onCheckedChange={(v) => setEditing({...editing!, requires_active_card: v})} /><Label>يتطلب بطاقة ليفو نشطة</Label></div>
              <div className="flex items-center gap-2"><Switch checked={editing.is_active} onCheckedChange={(v) => setEditing({...editing!, is_active: v})} /><Label>نشط</Label></div>
            </div>
            <div className="flex gap-2">
              <Button onClick={() => save.mutate(editing!)} disabled={save.isPending}>حفظ</Button>
              <Button variant="ghost" onClick={() => setEditing(null)}>إلغاء</Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default AddonInsurancePlansAdmin;
