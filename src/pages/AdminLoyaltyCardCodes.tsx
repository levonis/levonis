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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';
import {
  ArrowRight, Copy, Loader2, Plus, Ticket, ChevronDown, ChevronUp, Ban, Download, Upload, FileSpreadsheet, CalendarIcon, History,
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
  valid_from: string | null;
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

export const LoyaltyCodeBatchesList = ({ showHeader = true }: { showHeader?: boolean } = {}) => {
  const navigate = useNavigate();
  const qc = useQueryClient();
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
    const map = new Map<string, { batch_id: string; batch_label: string | null; card_id: string; created_at: string; code_expires_at: string; valid_from: string | null; codes: CodeRow[] }>();
    for (const c of codes || []) {
      const cur = map.get(c.batch_id) || {
        batch_id: c.batch_id,
        batch_label: c.batch_label,
        card_id: c.card_id,
        created_at: c.created_at,
        code_expires_at: c.code_expires_at,
        valid_from: c.valid_from,
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

  const Body = (
    <div className="space-y-3">
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
                     {b.valid_from && new Date(b.valid_from) > new Date()
                       ? `يبدأ: ${new Date(b.valid_from).toLocaleDateString('ar')} • `
                       : b.valid_from
                       ? `بدأ: ${new Date(b.valid_from).toLocaleDateString('ar')} • `
                       : ''}
                     ينتهي: {new Date(b.code_expires_at).toLocaleDateString('ar')}
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
  );

  if (!showHeader) return Body;

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto px-3 py-4 max-w-4xl space-y-4">
        <div className="flex items-center justify-between">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}/loyalty-levels`)}>
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
          <h1 className="text-base font-bold flex items-center gap-2">
            <Ticket className="h-4 w-4" /> أكواد تفعيل بطاقات الولاء
          </h1>
          <div className="w-16" />
        </div>
        {Body}
      </div>
    </div>
  );
};

const AdminLoyaltyCardCodes = () => <LoyaltyCodeBatchesList showHeader={true} />;

export const CreateBatchButton = ({
  cards, open, onOpenChange, onCreated,
}: {
  cards: CardRow[]; open: boolean; onOpenChange: (b: boolean) => void; onCreated: () => void;
}) => {
  const [cardId, setCardId] = useState<string>('');
  const [quantity, setQuantity] = useState<number>(6);
  const [durationDays, setDurationDays] = useState<number>(180);
  const [validFrom, setValidFrom] = useState<Date | undefined>(undefined);
  const [validUntil, setValidUntil] = useState<Date | undefined>(() => {
    const d = new Date(); d.setDate(d.getDate() + 90); return d;
  });
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
    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const validCardIds = new Set(cards.map(c => c.id));
    if (!cardId || !UUID_RE.test(cardId) || !validCardIds.has(cardId)) {
      toast.error('اختر بطاقة صالحة');
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      toast.error('عدد الأكواد يجب أن يكون 1..1000');
      return;
    }
    if (!Number.isInteger(durationDays) || durationDays < 1 || durationDays > 1825) {
      toast.error('مدة البطاقة يجب أن تكون 1..1825 يوم');
      return;
    }
    if (!validUntil) {
      toast.error('اختر تاريخ انتهاء صلاحية الكود');
      return;
    }
    if (validFrom && validFrom >= validUntil) {
      toast.error('تاريخ البداية يجب أن يكون قبل تاريخ النهاية');
      return;
    }
    if ((batchLabel || '').length > 100) {
      toast.error('اسم الدفعة طويل جداً');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('create_loyalty_code_batch', {
        p_card_id: cardId,
        p_quantity: quantity,
        p_duration_days: durationDays,
        p_code_expires_at: validUntil.toISOString(),
        p_batch_label: batchLabel?.trim() || null,
        p_requires_active_warranty: requiresWarranty,
        p_valid_from: validFrom ? validFrom.toISOString() : null,
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

  const DateField = ({ value, onChange, placeholder }: { value: Date | undefined; onChange: (d: Date | undefined) => void; placeholder: string }) => (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            'w-full justify-start text-right font-normal h-9',
            !value && 'text-muted-foreground'
          )}
        >
          <CalendarIcon className="ml-2 h-3.5 w-3.5" />
          {value ? format(value, 'yyyy-MM-dd') : <span>{placeholder}</span>}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={value} onSelect={onChange} initialFocus className={cn('p-3 pointer-events-auto')} />
      </PopoverContent>
    </Popover>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange} modal={true}>
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
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">عدد البطاقات</Label>
              <Input type="number" min={1} max={1000} value={quantity} onChange={e => setQuantity(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground mt-1">كل كود = بطاقة لمستخدم</p>
            </div>
            <div>
              <Label className="text-xs">المدة (أشهر)</Label>
              <Input
                type="number"
                min={1}
                max={60}
                value={Math.max(1, Math.round(durationDays / 30))}
                onChange={e => setDurationDays(Math.max(1, Number(e.target.value)) * 30)}
              />
              <p className="text-[10px] text-muted-foreground mt-1">يُحوَّل إلى أيام</p>
            </div>
            <div>
              <Label className="text-xs">المدة (أيام)</Label>
              <Input type="number" min={1} max={1825} value={durationDays} onChange={e => setDurationDays(Number(e.target.value))} />
              <p className="text-[10px] text-muted-foreground mt-1">صلاحية كل بطاقة</p>
            </div>
          </div>
          <div className="rounded-lg border border-border/60 p-2.5 space-y-2 bg-muted/20">
            <Label className="text-xs font-semibold">فترة صلاحية الكود</Label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <Label className="text-[10px] text-muted-foreground">تاريخ البداية (اختياري)</Label>
                <DateField value={validFrom} onChange={setValidFrom} placeholder="فوراً" />
              </div>
              <div>
                <Label className="text-[10px] text-muted-foreground">تاريخ النهاية</Label>
                <DateField value={validUntil} onChange={setValidUntil} placeholder="اختر تاريخاً" />
              </div>
            </div>
            <p className="text-[10px] text-muted-foreground leading-relaxed">
              لن يعمل الكود قبل تاريخ البداية، ويُنتهى تلقائياً عند تاريخ النهاية.
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

// ──────────────────────────────────────────────────────────────────────────
// CSV bulk-import button
// CSV format (header required, comma-separated):
//   card_id,quantity,duration_days,code_expiry_days,batch_label,requires_active_warranty
// - card_id: UUID of an existing membership card (must match list)
// - quantity: 1..1000
// - duration_days: card validity once redeemed
// - code_expiry_days: days from now until the code itself expires
// - batch_label: optional free-text label
// - requires_active_warranty: true/false (default true)
// Lines starting with # and empty lines are ignored.
// ──────────────────────────────────────────────────────────────────────────

interface CsvRow {
  card_id: string;
  quantity: number;
  duration_days: number;
  code_expiry_days: number;
  valid_from_days: number | null;
  batch_label: string | null;
  requires_active_warranty: boolean;
  _line: number;
}

const parseCsv = (text: string): { rows: CsvRow[]; errors: string[] } => {
  const errors: string[] = [];
  const rows: CsvRow[] = [];
  const rawLines = text.replace(/\r\n?/g, '\n').split('\n');
  let headerCols: string[] | null = null;

  rawLines.forEach((rawLine, idx) => {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const cols = line.split(',').map(c => c.trim());

    if (!headerCols) {
      headerCols = cols.map(c => c.toLowerCase());
      const required = ['card_id', 'quantity', 'duration_days', 'code_expiry_days'];
      for (const r of required) {
        if (!headerCols.includes(r)) errors.push(`عمود مفقود في الترويسة: ${r}`);
      }
      return;
    }

    const get = (name: string) => {
      const i = headerCols!.indexOf(name);
      return i === -1 ? '' : (cols[i] ?? '');
    };

    const cardId = get('card_id');
    const quantity = Number(get('quantity'));
    const duration = Number(get('duration_days'));
    const expiry = Number(get('code_expiry_days'));
    const validFromRaw = get('valid_from_days');
    const validFromDays = validFromRaw === '' ? null : Number(validFromRaw);
    const label = get('batch_label') || null;
    const reqWarrantyRaw = get('requires_active_warranty').toLowerCase();
    const requires = reqWarrantyRaw === '' ? true : ['true', '1', 'yes', 'نعم'].includes(reqWarrantyRaw);

    const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!cardId || !UUID_RE.test(cardId)) {
      errors.push(`السطر ${idx + 1}: card_id غير صالح`);
      return;
    }
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 1000) {
      errors.push(`السطر ${idx + 1}: quantity يجب أن يكون 1..1000`);
      return;
    }
    if (!Number.isInteger(duration) || duration < 1 || duration > 1825) {
      errors.push(`السطر ${idx + 1}: duration_days يجب أن يكون 1..1825`);
      return;
    }
    if (!Number.isInteger(expiry) || expiry < 1 || expiry > 365) {
      errors.push(`السطر ${idx + 1}: code_expiry_days يجب أن يكون 1..365`);
      return;
    }
    if (validFromDays !== null && (!Number.isInteger(validFromDays) || validFromDays < 0 || validFromDays >= expiry)) {
      errors.push(`السطر ${idx + 1}: valid_from_days يجب أن يكون 0..${expiry - 1}`);
      return;
    }
    if (label && label.length > 100) {
      errors.push(`السطر ${idx + 1}: batch_label طويل جداً`);
      return;
    }

    rows.push({
      card_id: cardId,
      quantity,
      duration_days: duration,
      code_expiry_days: expiry,
      valid_from_days: validFromDays,
      batch_label: label,
      requires_active_warranty: requires,
      _line: idx + 1,
    });
  });

  return { rows, errors };
};

export const ImportBatchesButton = ({
  cards, onCreated,
}: { cards: CardRow[]; onCreated: () => void }) => {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<CsvRow[]>([]);
  const [parseErrors, setParseErrors] = useState<string[]>([]);
  const [fileName, setFileName] = useState<string>('');
  const [submitting, setSubmitting] = useState(false);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const validCardIds = useMemo(() => new Set(cards.map(c => c.id)), [cards]);

  const handleFile = async (file: File) => {
    setFileName(file.name);
    const text = await file.text();
    const { rows: parsed, errors } = parseCsv(text);
    // Cross-check card_id exists in current cards list (warn, do not block)
    const extraErrors: string[] = [];
    parsed.forEach(r => {
      if (!validCardIds.has(r.card_id)) {
        extraErrors.push(`السطر ${r._line}: card_id غير موجود ضمن البطاقات الحالية`);
      }
    });
    setParseErrors([...errors, ...extraErrors]);
    setRows(parsed);
  };

  const downloadTemplate = () => {
    const sampleCard = cards[0]?.id || '00000000-0000-0000-0000-000000000000';
    const csv = [
      '# قالب استيراد دفعات أكواد بطاقات الولاء',
      '# اعمدة مطلوبة: card_id,quantity,duration_days,code_expiry_days',
      '# اختياري: valid_from_days (تأجيل البداية بأيام),batch_label,requires_active_warranty',
      'card_id,quantity,duration_days,code_expiry_days,valid_from_days,batch_label,requires_active_warranty',
      `${sampleCard},6,180,90,,بطاقة برونزية ٦ أشهر — مايو,true`,
      `${sampleCard},10,365,60,7,بطاقة سنوية — يونيو,true`,
    ].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = 'loyalty-codes-template.csv'; a.click();
    URL.revokeObjectURL(url);
  };

  const submit = async () => {
    if (rows.length === 0) { toast.error('لا توجد صفوف صالحة'); return; }
    if (parseErrors.length > 0) {
      const ok = confirm(`يوجد ${parseErrors.length} تحذير/خطأ في الملف. متابعة الاستيراد للصفوف الصالحة فقط؟`);
      if (!ok) return;
    }
    setSubmitting(true);
    setProgress({ done: 0, total: rows.length });
    let success = 0;
    const failures: string[] = [];
    for (let i = 0; i < rows.length; i++) {
      const r = rows[i];
      if (!validCardIds.has(r.card_id)) {
        failures.push(`السطر ${r._line}: card_id غير موجود — تم التخطي`);
        setProgress({ done: i + 1, total: rows.length });
        continue;
      }
      try {
        const now = Date.now();
        const expires = new Date(now + r.code_expiry_days * 86400_000).toISOString();
        const validFrom = r.valid_from_days != null
          ? new Date(now + r.valid_from_days * 86400_000).toISOString()
          : null;
        const { error } = await (supabase as any).rpc('create_loyalty_code_batch', {
          p_card_id: r.card_id,
          p_quantity: r.quantity,
          p_duration_days: r.duration_days,
          p_code_expires_at: expires,
          p_batch_label: r.batch_label,
          p_requires_active_warranty: r.requires_active_warranty,
          p_valid_from: validFrom,
        });
        if (error) throw error;
        success++;
      } catch (e: any) {
        failures.push(`السطر ${r._line}: ${e?.message || 'فشل'}`);
      }
      setProgress({ done: i + 1, total: rows.length });
    }
    setSubmitting(false);
    if (success > 0) {
      toast.success(`تم إنشاء ${success} دفعة من أصل ${rows.length}`);
      onCreated();
    }
    if (failures.length > 0) {
      toast.error(`فشل ${failures.length} دفعة. راجع التفاصيل في النافذة.`);
      setParseErrors(prev => [...prev, ...failures]);
    } else {
      setOpen(false);
      setRows([]);
      setFileName('');
      setParseErrors([]);
      setProgress(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { if (!submitting) setOpen(v); }}>
      <DialogTrigger asChild>
        <Button size="sm" variant="outline">
          <Upload className="h-4 w-4 ml-1" /> استيراد CSV
        </Button>
      </DialogTrigger>
      <DialogContent className="!overflow-hidden !max-h-none max-w-lg">
        <DialogHeader><DialogTitle>استيراد دفعات أكواد من CSV</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[70vh] px-1 text-sm">
          <Card className="p-3 text-xs leading-relaxed text-muted-foreground space-y-1">
            <div className="font-bold text-foreground">صيغة الملف:</div>
            <div>صف ترويسة:</div>
            <code className="block bg-muted/50 p-1.5 rounded text-[10px]">card_id,quantity,duration_days,code_expiry_days,batch_label,requires_active_warranty</code>
            <div>كل سطر بعدها = دفعة واحدة. الأسطر التي تبدأ بـ <code>#</code> تُهمَل.</div>
            <Button variant="link" size="sm" className="px-0 h-auto text-xs" onClick={downloadTemplate}>
              <FileSpreadsheet className="h-3 w-3 ml-1" /> تنزيل قالب جاهز
            </Button>
          </Card>

          <div>
            <Label className="text-xs">ملف CSV</Label>
            <Input
              type="file"
              accept=".csv,text/csv"
              disabled={submitting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
            {fileName && <p className="text-[10px] text-muted-foreground mt-1">{fileName}</p>}
          </div>

          {rows.length > 0 && (
            <Card className="p-2">
              <div className="text-xs font-bold mb-1">معاينة ({rows.length} دفعة):</div>
              <div className="max-h-40 overflow-y-auto space-y-1">
                {rows.slice(0, 20).map((r, i) => {
                  const card = cards.find(c => c.id === r.card_id);
                  return (
                    <div key={i} className="text-[11px] flex justify-between gap-2 border-b border-border/40 pb-1">
                      <span className="truncate">
                        {card?.name_ar || card?.name_en || r.card_id.slice(0, 8)} •{' '}
                        {r.quantity} كود • {r.duration_days}ي
                      </span>
                      <span className="text-muted-foreground shrink-0">ينتهي بعد {r.code_expiry_days}ي</span>
                    </div>
                  );
                })}
                {rows.length > 20 && (
                  <div className="text-[10px] text-muted-foreground">… و {rows.length - 20} صف آخر</div>
                )}
              </div>
            </Card>
          )}

          {parseErrors.length > 0 && (
            <Card className="p-2 border-rose-500/40 bg-rose-500/5">
              <div className="text-xs font-bold text-rose-600 mb-1">تحذيرات/أخطاء ({parseErrors.length}):</div>
              <div className="max-h-32 overflow-y-auto space-y-0.5">
                {parseErrors.map((e, i) => (
                  <div key={i} className="text-[10px] text-rose-700">{e}</div>
                ))}
              </div>
            </Card>
          )}

          {progress && (
            <div className="text-xs text-muted-foreground text-center">
              جاري الإنشاء: {progress.done} / {progress.total}
            </div>
          )}

          <div className="flex gap-2">
            <Button
              className="flex-1"
              onClick={submit}
              disabled={submitting || rows.length === 0}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : `استيراد ${rows.length} دفعة`}
            </Button>
            <Button variant="outline" disabled={submitting} onClick={() => setOpen(false)}>
              إلغاء
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
