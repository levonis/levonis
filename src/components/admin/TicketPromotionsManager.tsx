import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Trash2, Edit, PartyPopper, Ticket, Clock } from "lucide-react";
import { toast } from "sonner";
import { format } from "date-fns";

interface TicketPromotion {
  id: string;
  title_ar: string;
  description_ar: string | null;
  bonus_tickets: number;
  is_active: boolean;
  starts_at: string;
  ends_at: string;
  created_at: string;
}

export default function TicketPromotionsManager() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({
    title_ar: '',
    description_ar: '',
    bonus_tickets: 20,
    is_active: true,
    starts_at: '',
    ends_at: '',
  });

  const { data: promotions, isLoading } = useQuery({
    queryKey: ['admin-ticket-promotions'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('ticket_promotions')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as TicketPromotion[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title_ar: form.title_ar,
        description_ar: form.description_ar || null,
        bonus_tickets: form.bonus_tickets,
        is_active: form.is_active,
        starts_at: form.starts_at,
        ends_at: form.ends_at,
        updated_at: new Date().toISOString(),
      };
      if (editingId) {
        const { error } = await supabase.from('ticket_promotions').update(payload).eq('id', editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('ticket_promotions').insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-promotions'] });
      toast.success(editingId ? 'تم تحديث العرض' : 'تم إنشاء العرض');
      setDialogOpen(false);
      resetForm();
    },
    onError: (e) => toast.error('خطأ: ' + e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('ticket_promotions').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-ticket-promotions'] });
      toast.success('تم حذف العرض');
    },
  });

  const resetForm = () => {
    setEditingId(null);
    setForm({ title_ar: '', description_ar: '', bonus_tickets: 20, is_active: true, starts_at: '', ends_at: '' });
  };

  const openEdit = (promo: TicketPromotion) => {
    setEditingId(promo.id);
    setForm({
      title_ar: promo.title_ar,
      description_ar: promo.description_ar || '',
      bonus_tickets: promo.bonus_tickets,
      is_active: promo.is_active,
      starts_at: promo.starts_at.slice(0, 16),
      ends_at: promo.ends_at.slice(0, 16),
    });
    setDialogOpen(true);
  };

  const isActive = (p: TicketPromotion) => p.is_active && new Date(p.starts_at) <= new Date() && new Date(p.ends_at) > new Date();

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <PartyPopper className="h-5 w-5 text-amber-500" />
          عروض التذاكر بالمناسبات
        </CardTitle>
        <Button size="sm" onClick={() => { resetForm(); setDialogOpen(true); }} className="gap-1">
          <Plus className="h-4 w-4" /> إضافة عرض
        </Button>
      </CardHeader>
      <CardContent className="space-y-3">
        {isLoading ? (
          <p className="text-sm text-muted-foreground text-center py-4">جارٍ التحميل...</p>
        ) : !promotions?.length ? (
          <p className="text-sm text-muted-foreground text-center py-4">لا توجد عروض مناسبات حالياً</p>
        ) : (
          promotions.map((promo) => (
            <div key={promo.id} className={`flex items-center justify-between p-3 rounded-lg border ${isActive(promo) ? 'border-amber-500/30 bg-amber-500/5' : 'border-border bg-muted/30'}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-bold text-sm truncate">{promo.title_ar}</span>
                  {isActive(promo) ? (
                    <Badge className="bg-green-600 text-white text-[10px]">نشط</Badge>
                  ) : promo.is_active ? (
                    <Badge variant="secondary" className="text-[10px]">مجدول</Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px]">متوقف</Badge>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1"><Ticket className="h-3 w-3" />+{promo.bonus_tickets} تذكرة</span>
                  <span className="flex items-center gap-1"><Clock className="h-3 w-3" />{format(new Date(promo.ends_at), 'yyyy/MM/dd HH:mm')}</span>
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => openEdit(promo)}><Edit className="h-3.5 w-3.5" /></Button>
                <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => { if (confirm('حذف هذا العرض؟')) deleteMutation.mutate(promo.id); }}><Trash2 className="h-3.5 w-3.5" /></Button>
              </div>
            </div>
          ))
        )}
      </CardContent>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingId ? 'تعديل عرض المناسبة' : 'إضافة عرض مناسبة جديد'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عنوان المناسبة *</Label>
              <Input value={form.title_ar} onChange={e => setForm(f => ({ ...f, title_ar: e.target.value }))} placeholder="مثال: عيد الأضحى المبارك" />
            </div>
            <div>
              <Label>الوصف (اختياري)</Label>
              <Textarea value={form.description_ar} onChange={e => setForm(f => ({ ...f, description_ar: e.target.value }))} placeholder="وصف مختصر يظهر للمستخدمين" rows={2} />
            </div>
            <div>
              <Label>عدد التذاكر الإضافية *</Label>
              <Input type="number" min={1} value={form.bonus_tickets} onChange={e => setForm(f => ({ ...f, bonus_tickets: parseInt(e.target.value) || 0 }))} />
              <p className="text-xs text-muted-foreground mt-1">ستضاف هذه التذاكر لكل عملية شراء بالإضافة للتذاكر الأصلية</p>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>تاريخ البدء</Label>
                <Input type="datetime-local" value={form.starts_at} onChange={e => setForm(f => ({ ...f, starts_at: e.target.value }))} />
              </div>
              <div>
                <Label>تاريخ الانتهاء</Label>
                <Input type="datetime-local" value={form.ends_at} onChange={e => setForm(f => ({ ...f, ends_at: e.target.value }))} />
              </div>
            </div>
            <div className="flex items-center justify-between">
              <Label>مفعّل</Label>
              <Switch checked={form.is_active} onCheckedChange={v => setForm(f => ({ ...f, is_active: v }))} />
            </div>
          </div>
          <DialogFooter>
            <Button onClick={() => saveMutation.mutate()} disabled={!form.title_ar || !form.starts_at || !form.ends_at || saveMutation.isPending}>
              {saveMutation.isPending ? 'جارٍ الحفظ...' : editingId ? 'تحديث' : 'إنشاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
