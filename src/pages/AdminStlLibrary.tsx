import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Loader2, Check, X, Trash2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';

export default function AdminStlLibrary() {
  return (
    <main className="container mx-auto px-4 py-6 max-w-5xl">
      <h1 className="text-xl font-black mb-4">إدارة مكتبة ملفات STL</h1>
      <Tabs defaultValue="files">
        <TabsList>
          <TabsTrigger value="files">الملفات</TabsTrigger>
          <TabsTrigger value="categories">الفئات</TabsTrigger>
          <TabsTrigger value="limits">حدود البطاقات</TabsTrigger>
        </TabsList>
        <TabsContent value="files"><FilesTab /></TabsContent>
        <TabsContent value="categories"><CategoriesTab /></TabsContent>
        <TabsContent value="limits"><LimitsTab /></TabsContent>
      </Tabs>
    </main>
  );
}

function FilesTab() {
  const qc = useQueryClient();
  const [statusFilter, setStatusFilter] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const { data, isLoading } = useQuery({
    queryKey: ['admin-stl-files', statusFilter],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stl_files')
        .select('*')
        .eq('status', statusFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  async function approve(id: string) {
    const { error } = await supabase.from('stl_files').update({
      status: 'approved', approved_at: new Date().toISOString(),
    }).eq('id', id);
    if (error) toast.error(error.message); else toast.success('تمت الموافقة');
    qc.invalidateQueries({ queryKey: ['admin-stl-files'] });
  }
  async function reject(id: string) {
    const reason = window.prompt('سبب الرفض؟') || 'مرفوض';
    const { error } = await supabase.from('stl_files').update({
      status: 'rejected', rejection_reason: reason,
    }).eq('id', id);
    if (error) toast.error(error.message); else toast.success('تم الرفض');
    qc.invalidateQueries({ queryKey: ['admin-stl-files'] });
  }
  async function remove(id: string) {
    if (!confirm('حذف نهائي للملف؟')) return;
    const { error } = await supabase.from('stl_files').delete().eq('id', id);
    if (error) toast.error(error.message); else toast.success('تم الحذف');
    qc.invalidateQueries({ queryKey: ['admin-stl-files'] });
  }

  return (
    <div className="space-y-3 mt-4">
      <div className="flex gap-2">
        {(['pending', 'approved', 'rejected'] as const).map((s) => (
          <Button key={s} size="sm" variant={statusFilter === s ? 'default' : 'outline'}
            onClick={() => setStatusFilter(s)}>{s}</Button>
        ))}
      </div>
      {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> :
        !data?.length ? <p className="text-sm text-muted-foreground">لا توجد ملفات</p> :
        <div className="space-y-2">
          {data.map((f: any) => (
            <div key={f.id} className="p-3 rounded-xl border border-border flex items-center gap-3">
              {f.cover_image_url && <img src={f.cover_image_url} alt="" className="w-14 h-14 object-cover rounded-lg" />}
              <div className="flex-1 min-w-0">
                <p className="font-bold text-sm truncate">{f.title_ar}</p>
                <p className="text-[11px] text-muted-foreground">{f.file_format} · {f.downloads_count} تحميل</p>
              </div>
              {statusFilter === 'pending' && (
                <>
                  <Button size="sm" variant="outline" onClick={() => approve(f.id)}><Check className="h-4 w-4" /></Button>
                  <Button size="sm" variant="outline" onClick={() => reject(f.id)}><X className="h-4 w-4" /></Button>
                </>
              )}
              <Button size="sm" variant="ghost" onClick={() => remove(f.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          ))}
        </div>}
    </div>
  );
}

function CategoriesTab() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: ['admin-stl-cats'],
    queryFn: async () => (await supabase.from('stl_categories').select('*').order('display_order')).data ?? [],
  });
  const [nameAr, setNameAr] = useState('');
  const [slug, setSlug] = useState('');
  async function add() {
    if (!nameAr || !slug) return;
    const { error } = await supabase.from('stl_categories').insert({ name_ar: nameAr, slug });
    if (error) toast.error(error.message); else { setNameAr(''); setSlug(''); toast.success('تمت الإضافة'); }
    qc.invalidateQueries({ queryKey: ['admin-stl-cats'] });
  }
  async function del(id: string) {
    await supabase.from('stl_categories').delete().eq('id', id);
    qc.invalidateQueries({ queryKey: ['admin-stl-cats'] });
  }
  return (
    <div className="space-y-3 mt-4">
      <div className="flex gap-2 items-end">
        <div className="flex-1"><Label>الاسم</Label><Input value={nameAr} onChange={(e) => setNameAr(e.target.value)} /></div>
        <div className="flex-1"><Label>Slug</Label><Input value={slug} onChange={(e) => setSlug(e.target.value)} /></div>
        <Button onClick={add}><Plus className="h-4 w-4" /></Button>
      </div>
      <div className="space-y-1">
        {data?.map((c: any) => (
          <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
            <span className="flex-1 text-sm">{c.name_ar} <span className="text-muted-foreground text-xs">({c.slug})</span></span>
            <Button size="sm" variant="ghost" onClick={() => del(c.id)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
          </div>
        ))}
      </div>
    </div>
  );
}

function LimitsTab() {
  const qc = useQueryClient();
  const { data: cards } = useQuery({
    queryKey: ['admin-stl-cards'],
    queryFn: async () => (await supabase.from('membership_cards').select('id, name_ar')).data ?? [],
  });
  const { data: limits } = useQuery({
    queryKey: ['admin-stl-limits'],
    queryFn: async () => (await supabase.from('stl_card_download_limits').select('*')).data ?? [],
  });
  const map = new Map((limits ?? []).map((l: any) => [l.card_id, l.daily_download_limit]));

  async function save(cardId: string, value: string) {
    const v = value === '' ? null : Number(value);
    const { error } = await supabase.from('stl_card_download_limits')
      .upsert({ card_id: cardId, daily_download_limit: v }, { onConflict: 'card_id' });
    if (error) toast.error(error.message); else toast.success('تم الحفظ');
    qc.invalidateQueries({ queryKey: ['admin-stl-limits'] });
  }
  return (
    <div className="space-y-2 mt-4">
      <p className="text-xs text-muted-foreground">اترك الحقل فارغاً لإلغاء الحد اليومي (تحميلات غير محدودة)</p>
      {cards?.map((c: any) => (
        <div key={c.id} className="flex items-center gap-2 p-2 rounded-lg border border-border">
          <span className="flex-1 text-sm font-bold">{c.name_ar}</span>
          <Input
            type="number" min={0} placeholder="بدون حد" className="w-28"
            defaultValue={map.get(c.id) ?? ''}
            onBlur={(e) => save(c.id, e.target.value)}
          />
          <span className="text-xs text-muted-foreground">/ يوم</span>
        </div>
      ))}
    </div>
  );
}
