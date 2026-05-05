import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger,
} from '@/components/ui/dialog';
import { Switch } from '@/components/ui/switch';
import {
  ArrowRight, Copy, Loader2, Plus, Ticket, ChevronDown, ChevronUp, Ban, Download,
} from 'lucide-react';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';

interface CardRow { id: string; name_ar: string | null; name_en: string | null; duration_days: number }
interface CodeRow {
  id: string;
  card_id: string;
  code: string;
  batch_id: string;
  batch_label: string | null;
  duration_days: number;
  code_expires_at: string;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  redeemed_by_user_id: string | null;
  redeemed_at: string | null;
  created_at: string;
  requires_active_warranty: boolean;
}

const StatusBadge = ({ status }: { status: CodeRow['status'] }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'فعّال',   cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
    redeemed: { label: 'مُستخدم', cls: 'bg-sky-500/15 text-sky-700 border-sky-500/30' },
    expired:  { label: 'منتهي',  cls: 'bg-muted text-muted-foreground border-border' },
    revoked:  { label: 'مُلغى',   cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' },
  };
  const m = map[status] || map.active;
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
};

const AdminLoyaltyCardCodes = () => {
  const navigate = useNavigate();
  const { t } = useLanguage();
  const qc = useQueryClient();
  const [openCreate, setOpenCreate] = useState(false);
  const [expandedBatches, setExpandedBatches] = useState<Record<string, boolean>>({});

  // Lazy expire on mount
  useEffect(() => {
    (supabase as any).rpc('expire_loyalty_card_codes').then(() => {
      qc.invalidateQueries({ queryKey: ['admin-loyalty-codes'] });
    });
  }, [qc]);

  const { data: cards } = useQuery<CardRow[]>({
    queryKey: ['admin-membership-cards-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('id, name_ar, name_en, duration_days')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data as any;
    },
  });

  const { data: codes, isLoading } = useQuery<CodeRow[]>({
    queryKey: ['admin-loyalty-codes'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('loyalty_card_codes')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const batches = useMemo(() => {
    const map = new Map<string, { batch_id: string; batch_label: string | null; card_id: string; created_at: string; code_expires_at: string; codes: CodeRow[] }>();
    for (const c of codes || []) {
      const cur = map.get(c.batch_id) || {
        batch_id: c.batch_id,
        batch_label: c.batch_label,
        card_id: c.card_id,
        created_at: c.created_at,
        code_expires_at: c.code_expires_at,
        codes: [] as CodeRow[],
      };
      cur.codes.push(c);
      map.set(c.batch_id, cur);
    }
    return Array.from(map.values()).sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at));
  }, [codes]);

  const cardName = (id: string) => {
    const c = (cards || []).find(x => x.id === id);
    return c?.name_ar || c?.name_en || id.slice(0, 8);
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  const exportBatchCsv = (batch: typeof batches[number]) => {
    const rows = ['code,status,redeemed_at'].concat(
      batch.codes.map(c => `${c.code},${c.status},${c.redeemed_at || ''}`)
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `loyalty-codes-${batch.batch_id}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const revokeBatchMutation = useMutation({
    mutationFn: async (batch_id: string) => {
      const { error } = await (supabase as any)
        .from('loyalty_card_codes')
        .update({ status: 'revoked' })
        .eq('batch_id', batch_id)
        .eq('status', 'active');
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إلغاء الأكواد الفعّالة');
      qc.invalidateQueries({ queryKey: ['admin-loyalty-codes'] });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الإلغاء'),
  });

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto px-3 py-4 max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}`)}>
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
          <h1 className="text-base font-bold flex items-center gap-2">
            <Ticket className="h-4 w-4" /> أكواد تفعيل بطاقات الولاء
          </h1>
          <CreateBatchButton
            cards={cards || []}
            open={openCreate}
            onOpenChange={setOpenCreate}
            onCreated={() => qc.invalidateQueries({ queryKey: ['admin-loyalty-codes'] })}
          />
        </div>

        <Card className="p-3 text-xs text-muted-foreground leading-relaxed">
          الأكواد الناتجة هنا تُمكّن المستخدم من تفعيل بطاقة ولاء (مثل البطاقة البرونزية لمدة 6 أشهر) فقط
          إذا كان لديه طابعة فعّالة في الضمان. تاريخ بدء البطاقة هو لحظة تفعيل الكود من قبل المستخدم.
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : batches.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">لا توجد دفعات أكواد بعد</Card>
        ) : (
          batches.map(b => {
            const counts = b.codes.reduce(
              (acc, c) => { acc[c.status] = (acc[c.status] || 0) + 1; return acc; },
              {} as Record<string, number>
            );
            const expanded = !!expandedBatches[b.batch_id];
            return (
              <Card key={b.batch_id} className="overflow-hidden">
                <button
                  className="w-full p-3 text-right flex items-center justify-between hover:bg-muted/30"
                  onClick={() => setExpandedBatches(s => ({ ...s, [b.batch_id]: !s[b.batch_id] }))}
                >
                  <div className="flex items-center gap-2">
                    {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    <div className="text-right">
                      <div className="text-sm font-semibold">{cardName(b.card_id)}</div>
                      <div className="text-[10px] text-muted-foreground">
                        {b.batch_label || `دفعة ${b.batch_id.slice(0, 6)}`} • {b.codes.length} كود •
                        ينتهي الاستخدام: {new Date(b.code_expires_at).toLocaleDateString('ar')}
                      </div>
                    </div>
                  </div>
                  <div className="flex gap-1">
                    {counts.active   ? <Badge variant="outline" className="text-[10px] bg-emerald-500/15 text-emerald-700 border-emerald-500/30">فعّال {counts.active}</Badge> : null}
                    {counts.redeemed ? <Badge variant="outline" className="text-[10px] bg-sky-500/15 text-sky-700 border-sky-500/30">مستخدم {counts.redeemed}</Badge> : null}
                    {counts.expired  ? <Badge variant="outline" className="text-[10px]">منتهي {counts.expired}</Badge> : null}
                    {counts.revoked  ? <Badge variant="outline" className="text-[10px] bg-rose-500/15 text-rose-700 border-rose-500/30">ملغى {counts.revoked}</Badge> : null}
                  </div>
                </button>
                {expanded && (
                  <div className="border-t border-border/60 p-3 space-y-2">
                    <div className="flex gap-2 justify-end">
                      <Button size="sm" variant="outline" onClick={() => exportBatchCsv(b)}>
                        <Download className="h-3 w-3 ml-1" /> CSV
                      </Button>
                      {(counts.active || 0) > 0 && (
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-rose-600"
                          onClick={() => {
                            if (confirm('إلغاء جميع الأكواد الفعّالة في هذه الدفعة؟')) {
                              revokeBatchMutation.mutate(b.batch_id);
                            }
                          }}
                          disabled={revokeBatchMutation.isPending}
                        >
                          <Ban className="h-3 w-3 ml-1" /> إلغاء الفعّال
                        </Button>
                      )}
                    </div>
                    <div className="space-y-1.5 max-h-80 overflow-y-auto">
                      {b.codes.map(c => (
                        <div key={c.id} className="flex items-center justify-between gap-2 p-2 rounded-md bg-muted/30 border border-border/40">
                          <div className="flex items-center gap-2 min-w-0 flex-1">
                            <code className="text-sm font-mono font-bold tracking-wider">{c.code}</code>
                            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => copyCode(c.code)}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-2">
                            <span className="text-[10px] text-muted-foreground">{c.duration_days} يوم</span>
                            <StatusBadge status={c.status} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })
        )}
      </div>
    </div>
  );
};

const CreateBatchButton = ({
  cards, open, onOpenChange, onCreated,
}: {
  cards: CardRow[]; open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void;
}) => {
  const [cardId, setCardId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(6);
  const [durationDays, setDurationDays] = useState<number>(180);
  const [codeExpiryDays, setCodeExpiryDays] = useState<number>(90);
  const [batchLabel, setBatchLabel] = useState<string>('');
  const [requiresWarranty, setRequiresWarranty] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (cardId) {
      const c = cards.find(x => x.id === cardId);
      if (c?.duration_days) setDurationDays(c.duration_days);
    }
  }, [cardId, cards]);

  const submit = async () => {
    if (!cardId) { toast.error('اختر البطاقة'); return; }
    if (quantity <= 0 || quantity > 1000) { toast.error('عدد غير صالح'); return; }
    if (durationDays <= 0) { toast.error('مدة غير صالحة'); return; }
    if (codeExpiryDays <= 0) { toast.error('تاريخ انتهاء غير صالح'); return; }
    setSubmitting(true);
    try {
      const expires = new Date(Date.now() + codeExpiryDays * 86400_000).toISOString();
      const { error } = await (supabase as any).rpc('create_loyalty_code_batch', {
        p_card_id: cardId,
        p_quantity: quantity,
        p_duration_days: durationDays,
        p_code_expires_at: expires,
        p_batch_label: batchLabel || null,
        p_requires_active_warranty: requiresWarranty,
      });
      if (error) throw error;
      toast.success(`تم إنشاء ${quantity} كود`);
      onCreated();
      onOpenChange(false);
      setBatchLabel('');
    } catch (e: any) {
      toast.error(e?.message || 'فشل الإنشاء');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 ml-1" /> دفعة جديدة</Button>
      </DialogTrigger>
      <DialogContent className="!overflow-hidden !max-h-none max-w-md">
        <DialogHeader><DialogTitle>إنشاء دفعة أكواد</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[70vh] px-1">
          <div>
            <Label className="text-xs">البطاقة</Label>
            <Select value={cardId} onValueChange={setCardId}>
              <SelectTrigger><SelectValue placeholder="اختر بطاقة الولاء" /></SelectTrigger>
              <SelectContent>
                {cards.map(c => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name_ar || c.name_en} ({c.duration_days} يوم)
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div>
              <Label className="text-xs">عدد الأكواد</Label>
              <Input type="number" value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
            </div>
            <div>
              <Label className="text-xs">مدة البطاقة (أيام)</Label>
              <Input type="number" value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} />
            </div>
          </div>
          <div>
            <Label className="text-xs">انتهاء صلاحية الكود (أيام من الآن)</Label>
            <Input type="number" value={codeExpiryDays} onChange={e => setCodeExpiryDays(Number(e.target.value))} />
            <p className="text-[10px] text-muted-foreground mt-1">
              مثال: 90 = ينتهي الكود بعد 3 أشهر إذا لم يُستخدم
            </p>
          </div>
          <div>
            <Label className="text-xs">عنوان الدفعة (اختياري)</Label>
            <Input value={batchLabel} onChange={e => setBatchLabel(e.target.value)} placeholder="بطاقة برونزية 6 أشهر — مايو" />
          </div>
          <div className="flex items-center justify-between rounded-md border border-border/60 p-2">
            <Label className="text-xs">يشترط طابعة فعّالة في الضمان</Label>
            <Switch checked={requiresWarranty} onCheckedChange={setRequiresWarranty} />
          </div>
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'إنشاء الدفعة'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AdminLoyaltyCardCodes;
