import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Plus, CreditCard, Search, Download, Loader2, Trash2, Unlink, User, History, Copy } from 'lucide-react';
import { toast } from 'sonner';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';

interface CardRow {
  id: string; card_number: string; card_number_last4: string;
  batch_label: string | null; status: string; created_at: string;
}

export default function AdminLevoCards() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [batchLabel, setBatchLabel] = useState('');
  const [count, setCount] = useState(10);
  const [createOpen, setCreateOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [detailNumber, setDetailNumber] = useState<string | null>(null);
  const [showNumbers, setShowNumbers] = useState<Record<string, boolean>>({});

  const { data: cards, isLoading } = useQuery<CardRow[]>({
    queryKey: ['admin-levo-cards'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('levo_physical_cards' as any)
        .select('id, card_number, card_number_last4, batch_label, status, created_at')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []) as any;
    },
  });

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return cards || [];
    const digits = q.replace(/\D/g, '');
    return (cards || []).filter(c =>
      (digits && c.card_number.includes(digits)) ||
      (c.batch_label || '').toLowerCase().includes(q.toLowerCase())
    );
  }, [cards, search]);

  const grouped = useMemo(() => {
    const g = new Map<string, CardRow[]>();
    for (const c of filtered) {
      const k = c.batch_label || '—';
      const arr = g.get(k) || [];
      arr.push(c); g.set(k, arr);
    }
    return Array.from(g.entries());
  }, [filtered]);

  const [lastBatch, setLastBatch] = useState<any[] | null>(null);

  const createBatch = useMutation({
    mutationFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_generate_levo_cards', {
        p_count: count, p_batch_label: batchLabel || null,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      return data;
    },
    onSuccess: (d: any) => {
      toast.success(`تم إنشاء ${d.count} بطاقة`);
      setLastBatch(d.cards || []);
      setCreateOpen(false);
      qc.invalidateQueries({ queryKey: ['admin-levo-cards'] });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الإنشاء'),
  });

  const deleteCard = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc('admin_delete_levo_card', { p_card_id: id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
    },
    onSuccess: () => {
      toast.success('تم حذف البطاقة');
      qc.invalidateQueries({ queryKey: ['admin-levo-cards'] });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الحذف'),
  });

  const exportCsv = () => {
    const rows = ['card_number,last4,batch,status,created_at'].concat(
      (cards || []).map(c => `${c.card_number},${c.card_number_last4},${c.batch_label || ''},${c.status},${c.created_at}`)
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `levo-cards-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const copy = (t: string) => { navigator.clipboard.writeText(t); toast.success('تم النسخ'); };
  const fmt16 = (n: string) => n.replace(/(.{4})/g, '$1 ').trim();

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto px-3 py-4 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}/loyalty-levels`)}>
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
          <h1 className="text-base font-bold flex items-center gap-2">
            <CreditCard className="h-4 w-4" /> إدارة بطاقات ليفو
          </h1>
          <div className="flex gap-1">
            <Button size="sm" variant="outline" onClick={exportCsv}>
              <Download className="h-3 w-3 ml-1" /> CSV
            </Button>
            <Dialog open={createOpen} onOpenChange={setCreateOpen}>
              <DialogTrigger asChild>
                <Button size="sm"><Plus className="h-4 w-4 ml-1" /> دفعة جديدة</Button>
              </DialogTrigger>
              <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
                <DialogHeader><DialogTitle>إنشاء دفعة بطاقات ليفو</DialogTitle></DialogHeader>
                <div className="space-y-3">
                  <div>
                    <Label className="text-xs">اسم الدفعة (اختياري)</Label>
                    <Input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="مثال: دفعة يناير 2026" />
                  </div>
                  <div>
                    <Label className="text-xs">عدد البطاقات (1..5000)</Label>
                    <Input type="number" min={1} max={5000} value={count} onChange={e => setCount(Number(e.target.value))} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    كل بطاقة تحصل على رقم فريد 16 خانة. الرقم نفسه يُشفَّر داخل QR و NFC عند طباعتها.
                  </p>
                </div>
                <DialogFooter>
                  <Button variant="outline" onClick={() => setCreateOpen(false)}>إلغاء</Button>
                  <Button onClick={() => createBatch.mutate()} disabled={createBatch.isPending}>
                    {createBatch.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <Card className="p-3">
          <div className="relative">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input value={search} onChange={e => setSearch(e.target.value)}
              placeholder="بحث برقم البطاقة أو اسم الدفعة…" className="pr-8 h-9 text-sm" />
          </div>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">لا توجد بطاقات بعد</Card>
        ) : (
          grouped.map(([label, arr]) => (
            <Card key={label} className="overflow-hidden">
              <div className="p-3 border-b bg-muted/30 flex items-center justify-between">
                <div className="text-sm font-semibold">{label}</div>
                <Badge variant="outline" className="text-[10px]">{arr.length} بطاقة</Badge>
              </div>
              <div className="divide-y">
                {arr.map(c => (
                  <div key={c.id} className="p-3 flex items-center justify-between gap-2 hover:bg-muted/20">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <code className="font-mono text-sm tracking-widest">
                        {showNumbers[c.id] ? fmt16(c.card_number) : `•••• •••• •••• ${c.card_number_last4}`}
                      </code>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowNumbers(s => ({ ...s, [c.id]: !s[c.id] }))}>
                        <Search className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copy(c.card_number)}>
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge variant="outline" className={`text-[10px] ${
                        c.status === 'assigned' ? 'bg-sky-500/15 text-sky-700 border-sky-500/30' :
                        c.status === 'revoked' ? 'bg-rose-500/15 text-rose-700 border-rose-500/30' :
                        'bg-emerald-500/15 text-emerald-700 border-emerald-500/30'
                      }`}>
                        {c.status === 'assigned' ? 'مفعّلة' : c.status === 'revoked' ? 'ملغاة' : 'متاحة'}
                      </Badge>
                      {c.status === 'assigned' && (
                        <Button size="sm" variant="outline" onClick={() => setDetailNumber(c.card_number)}>
                          <User className="h-3 w-3 ml-1" /> المالك
                        </Button>
                      )}
                      {c.status !== 'assigned' && (
                        <Button size="sm" variant="ghost" className="text-destructive"
                          onClick={() => confirm('حذف نهائي للبطاقة؟') && deleteCard.mutate(c.id)}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          ))
        )}

        {detailNumber && (
          <CardDetailDialog cardNumber={detailNumber} onClose={() => setDetailNumber(null)} />
        )}
      </div>
    </div>
  );
}

function CardDetailDialog({ cardNumber, onClose }: { cardNumber: string; onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['admin-levo-card-detail', cardNumber],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_get_levo_card_details', { p_card_number: cardNumber });
      if (error) throw error;
      return data;
    },
  });

  const releaseMut = useMutation({
    mutationFn: async (id: string) => {
      const { data, error } = await (supabase as any).rpc('admin_release_levo_card', { p_assignment_id: id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
    },
    onSuccess: () => {
      toast.success('تم فصل البطاقة عن المستخدم');
      refetch();
      qc.invalidateQueries({ queryKey: ['admin-levo-cards'] });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الفصل'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-md">
        <DialogHeader><DialogTitle>تفاصيل البطاقة</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[70vh]">
          {isLoading || !data ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : !data.success ? (
            <div className="text-sm text-destructive">{data.error}</div>
          ) : (
            <>
              <div className="p-3 rounded-lg border">
                <div className="text-xs text-muted-foreground">رقم البطاقة</div>
                <code className="font-mono text-sm tracking-widest">{data.card.card_number.replace(/(.{4})/g, '$1 ').trim()}</code>
              </div>
              {data.user ? (
                <div className="p-3 rounded-lg border bg-muted/30 space-y-1">
                  <div className="text-xs text-muted-foreground">المالك</div>
                  <div className="font-semibold">{data.user.full_name || data.user.username || data.user.id.slice(0, 8)}</div>
                  <div className="text-xs text-muted-foreground">
                    مفعّلة منذ: {new Date(data.assignment.assigned_at).toLocaleString('ar')}
                  </div>
                </div>
              ) : (
                <div className="text-sm text-muted-foreground">بطاقة متاحة (غير مربوطة بمستخدم)</div>
              )}
              {(data.subscriptions || []).length > 0 && (
                <div className="space-y-1">
                  <div className="text-xs font-semibold flex items-center gap-1">
                    <History className="h-3 w-3" /> الاشتراكات
                  </div>
                  {data.subscriptions.map((s: any) => (
                    <div key={s.id} className="p-2 rounded border text-xs flex items-center justify-between">
                      <div>
                        <div>حالة: <Badge variant="outline" className="text-[10px]">{s.status}</Badge></div>
                        <div className="text-muted-foreground">
                          من {new Date(s.started_at).toLocaleDateString('ar')} إلى {new Date(s.expires_at).toLocaleDateString('ar')}
                        </div>
                      </div>
                      <div className="text-left">
                        <div>{s.paid_amount} د.ع</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              {data.assignment && (
                <Button
                  variant="outline" size="sm" className="w-full text-destructive"
                  onClick={() => confirm('فصل البطاقة عن المستخدم؟') && releaseMut.mutate(data.assignment.id)}
                  disabled={releaseMut.isPending}
                >
                  <Unlink className="h-3.5 w-3.5 ml-1" /> فصل البطاقة عن المستخدم
                </Button>
              )}
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
