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
import { ArrowRight, Plus, CreditCard, Search, Download, Loader2, Trash2, Unlink, User, History, Copy, Printer, X, Eye, Settings } from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
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
  const [productOpen, setProductOpen] = useState(false);
  const [revealCards, setRevealCards] = useState<any[] | null>(null);
  const [revealLoading, setRevealLoading] = useState(false);

  const revealBatch = async (label: string) => {
    setRevealLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_reveal_levo_batch', {
        p_batch_label: label === '—' ? null : label,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      setRevealCards(data.cards || []);
    } catch (e: any) { toast.error(e?.message || 'فشل جلب الأسرار'); }
    finally { setRevealLoading(false); }
  };

  const revealSingle = async (id: string) => {
    setRevealLoading(true);
    try {
      const { data, error } = await (supabase as any).rpc('admin_reveal_levo_card', { p_card_id: id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error);
      setRevealCards([data.card]);
    } catch (e: any) { toast.error(e?.message || 'فشل جلب البيانات'); }
    finally { setRevealLoading(false); }
  };

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
            <Button size="sm" variant="outline" onClick={() => setProductOpen(true)}>
              <Settings className="h-3 w-3 ml-1" /> منتج البطاقة
            </Button>
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
              <div className="p-3 border-b bg-muted/30 flex items-center justify-between gap-2">
                <div className="text-sm font-semibold truncate">{label}</div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-[10px]">{arr.length} بطاقة</Badge>
                  <Button size="sm" variant="outline" onClick={() => revealBatch(label)} disabled={revealLoading}>
                    <Printer className="h-3 w-3 ml-1" /> عرض/طباعة الأسرار
                  </Button>
                </div>
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
                      <Button size="sm" variant="ghost" title="عرض PIN و QR" onClick={() => revealSingle(c.id)} disabled={revealLoading}>
                        <Eye className="h-3 w-3" />
                      </Button>
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
        {lastBatch && (
          <BatchRevealDialog cards={lastBatch} onClose={() => setLastBatch(null)} />
        )}
        {revealCards && (
          <BatchRevealDialog cards={revealCards} onClose={() => setRevealCards(null)} />
        )}
        {productOpen && (
          <ProductSettingsDialog onClose={() => setProductOpen(false)} />
        )}
      </div>
    </div>
  );
}

function BatchRevealDialog({ cards, onClose }: { cards: any[]; onClose: () => void }) {
  const exportCsv = () => {
    const rows = ['card_number,pin,qr_token,nfc_token'].concat(
      cards.map(c => `${c.card_number},${c.pin},${c.qr_token},${c.nfc_token}`)
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `levo-batch-${Date.now()}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const doPrint = async () => {
    // Serialize each QR SVG for the print window
    const items = cards.map((c) => {
      const svgEl = document.getElementById(`qr-${c.id}`);
      const qrSvg = svgEl ? svgEl.outerHTML : '';
      const num = String(c.card_number || '').replace(/(.{4})/g, '$1 ').trim();
      return `
        <div class="card">
          <div class="qr">${qrSvg}</div>
          <div class="info">
            <div class="brand">LEVO</div>
            <div class="num">${num}</div>
            <div class="row"><span class="k">PIN</span><span class="v">${c.pin || '—'}</span></div>
            <div class="nfc">NFC: ${c.nfc_token || ''}</div>
          </div>
        </div>`;
    }).join('');

    const html = `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"/>
      <title>بطاقات ليفو</title>
      <style>
        @page { size: A4; margin: 10mm; }
        * { box-sizing: border-box; }
        body { font-family: -apple-system, "Segoe UI", Tahoma, Arial, sans-serif; margin: 0; padding: 8px; color: #111; }
        .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8mm; }
        .card {
          border: 1.5px solid #111; border-radius: 10px; padding: 8px;
          display: flex; align-items: center; gap: 10px;
          height: 55mm; break-inside: avoid; page-break-inside: avoid;
          background: linear-gradient(135deg, #f8fafc, #eef2ff);
        }
        .qr { background:#fff; padding:4px; border-radius:6px; flex: 0 0 auto; }
        .qr svg { display:block; width: 40mm; height: 40mm; }
        .info { flex: 1; min-width: 0; }
        .brand { font-weight: 800; font-size: 14px; letter-spacing: 2px; color:#4338ca; }
        .num { font-family: ui-monospace, "SFMono-Regular", Menlo, monospace;
               font-size: 14px; letter-spacing: 3px; margin-top: 4px; word-break: keep-all; }
        .row { margin-top: 6px; display:flex; justify-content: space-between; align-items:center;
               background:#111; color:#fff; padding: 4px 8px; border-radius: 6px; }
        .k { font-size: 10px; opacity: .75; }
        .v { font-family: ui-monospace, Menlo, monospace; font-weight: 800; letter-spacing: 4px; font-size: 14px; }
        .nfc { margin-top: 4px; font-size: 8px; color:#555; word-break: break-all; }
      </style></head><body>
      <div class="grid">${items}</div>
      <script>window.onload = () => { setTimeout(() => { window.print(); }, 300); };<\/script>
      </body></html>`;

    const w = window.open('', '_blank', 'width=900,height=1100');
    if (!w) { toast.error('امنع المتصفح النوافذ المنبثقة أولاً'); return; }
    w.document.open(); w.document.write(html); w.document.close();
  };

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center justify-between">
            <span>بيانات البطاقات ({cards.length})</span>
            <Button size="icon" variant="ghost" onClick={onClose}><X className="h-4 w-4" /></Button>
          </DialogTitle>
        </DialogHeader>
        <div className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-700 dark:text-amber-300">
          ⚠️ هذه بيانات حساسة — الرمز السري (PIN) ورموز QR/NFC مخصصة للأدمن فقط.
        </div>
        <div className="flex gap-2 py-2">
          <Button size="sm" onClick={exportCsv}><Download className="h-3 w-3 ml-1" /> CSV كامل</Button>
          <Button size="sm" variant="outline" onClick={doPrint}><Printer className="h-3 w-3 ml-1" /> طباعة</Button>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto max-h-[70vh]">
          {cards.map((c) => (
            <div key={c.id} className="border rounded-lg p-3 bg-background">
              <div className="flex items-center gap-3">
                <div className="bg-white p-1 rounded">
                  <QRCodeSVG id={`qr-${c.id}`} value={c.qr_token || ''} size={80} />
                </div>
                <div className="flex-1 min-w-0 text-right">
                  <code className="font-mono text-xs tracking-widest">
                    {String(c.card_number || '').replace(/(.{4})/g, '$1 ').trim()}
                  </code>
                  <div className="mt-1 text-xs">
                    <span className="text-muted-foreground">PIN: </span>
                    <span className="font-mono font-bold tracking-widest">{c.pin || '—'}</span>
                  </div>
                  <div className="text-[10px] text-muted-foreground truncate mt-0.5">NFC: {c.nfc_token}</div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ProductSettingsDialog({ onClose }: { onClose: () => void }) {
  const qc = useQueryClient();
  const { data, isLoading } = useQuery({
    queryKey: ['levo-card-product-admin'],
    queryFn: async () => {
      const { data: idRes } = await (supabase as any).rpc('get_levo_card_product_id');
      const productId = idRes as string;
      if (!productId) return null;
      const { data } = await supabase
        .from('products')
        .select('id, name_ar, name_en, name_ku, description_ar, price, image_url')
        .eq('id', productId)
        .maybeSingle();
      return data as any;
    },
  });

  const [price, setPrice] = useState<string>('');
  const [nameAr, setNameAr] = useState('');
  const [nameEn, setNameEn] = useState('');
  const [nameKu, setNameKu] = useState('');
  const [descAr, setDescAr] = useState('');
  const [initialized, setInitialized] = useState(false);

  if (data && !initialized) {
    setPrice(String(data.price ?? ''));
    setNameAr(data.name_ar || '');
    setNameEn(data.name_en || '');
    setNameKu(data.name_ku || '');
    setDescAr(data.description_ar || '');
    setInitialized(true);
  }

  const save = useMutation({
    mutationFn: async () => {
      const p = Number(price);
      if (!Number.isFinite(p) || p < 0) throw new Error('سعر غير صالح');
      const { data: res, error } = await (supabase as any).rpc('admin_update_levo_card_product', {
        p_price: p,
        p_name_ar: nameAr || null,
        p_name_en: nameEn || null,
        p_name_ku: nameKu || null,
        p_description_ar: descAr || null,
      });
      if (error) throw error;
      if (!res?.success) throw new Error(res?.error);
    },
    onSuccess: () => {
      toast.success('تم حفظ إعدادات منتج البطاقة');
      qc.invalidateQueries({ queryKey: ['levo-card-product'] });
      qc.invalidateQueries({ queryKey: ['levo-card-product-admin'] });
      onClose();
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الحفظ'),
  });

  return (
    <Dialog open onOpenChange={onClose}>
      <DialogContent className="!overflow-hidden !max-h-none max-w-md">
        <DialogHeader>
          <DialogTitle>إعدادات منتج البطاقة الفيزيائية</DialogTitle>
        </DialogHeader>
        {isLoading || !data ? (
          <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : (
          <div className="space-y-3 overflow-y-auto max-h-[70vh]">
            <div>
              <Label className="text-xs">السعر (د.ع)</Label>
              <Input type="number" min={0} value={price} onChange={e => setPrice(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">الاسم (عربي)</Label>
              <Input value={nameAr} onChange={e => setNameAr(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">الاسم (English)</Label>
              <Input value={nameEn} onChange={e => setNameEn(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">الاسم (کوردی)</Label>
              <Input value={nameKu} onChange={e => setNameKu(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">الوصف (عربي)</Label>
              <Input value={descAr} onChange={e => setDescAr(e.target.value)} />
            </div>
            <p className="text-[11px] text-muted-foreground">
              هذا منتج نظام محجوز ولا يمكن حذفه. يظهر للمستخدمين بسعر ثابت وتُشحن البطاقة كأي منتج آخر.
            </p>
          </div>
        )}
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>إلغاء</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending || isLoading}>
            {save.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
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
