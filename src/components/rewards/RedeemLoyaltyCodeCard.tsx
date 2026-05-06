import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ticket, Loader2, AlertTriangle, XCircle, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const COOLDOWN_MS = 1500;

type ErrorKey =
  | 'code_not_found'
  | 'code_invalid_format'
  | 'code_already_used'
  | 'code_expired'
  | 'already_has_active_card'
  | 'auth_required'
  | 'card_not_found'
  | 'rate_limited'
  | 'unknown';

const ERROR_DETAILS: Record<ErrorKey, { title: string; desc: string }> = {
  code_not_found: {
    title: 'الكود غير صالح',
    desc: 'تأكد من إدخال الكود بشكل صحيح بدون مسافات أو أحرف زائدة.',
  },
  code_invalid_format: {
    title: 'صيغة الكود غير صحيحة',
    desc: 'الكود يجب أن يتكوّن من أحرف وأرقام إنجليزية فقط (8-20 خانة).',
  },
  code_already_used: {
    title: 'تم استخدام هذا الكود مسبقاً',
    desc: 'هذا الكود مفعّل من قبل ولا يمكن استخدامه مرة أخرى. تواصل مع الدعم إذا كنت تعتقد أن هذا خطأ.',
  },
  code_expired: {
    title: 'انتهت صلاحية الكود',
    desc: 'الكود الذي أدخلته منتهي الصلاحية ولم يعد قابلاً للتفعيل. يمكنك طلب كود جديد من الدعم.',
  },
  already_has_active_card: {
    title: 'لديك بطاقة فعّالة بالفعل',
    desc: 'لا يمكن تفعيل بطاقة جديدة قبل انتهاء البطاقة الحالية.',
  },
  auth_required: {
    title: 'يرجى تسجيل الدخول',
    desc: 'تحتاج إلى تسجيل الدخول إلى حسابك لاستخدام كود تفعيل البطاقة.',
  },
  card_not_found: {
    title: 'البطاقة المرتبطة بالكود غير موجودة',
    desc: 'حدث خلل في إعدادات هذا الكود. يرجى التواصل مع الدعم.',
  },
  rate_limited: {
    title: 'محاولات متكررة',
    desc: 'يرجى الانتظار قليلاً قبل إعادة المحاولة.',
  },
  unknown: {
    title: 'فشل التفعيل',
    desc: 'حدث خطأ غير متوقع. حاول مرة أخرى أو تواصل مع الدعم.',
  },
};

const CODE_REGEX = /^[A-Z0-9]{8,20}$/;

type WarrantyReason = 'no_printer_registered' | 'warranty_expired' | 'no_active_warranty';

const WARRANTY_DETAILS: Record<WarrantyReason, { title: string; desc: string; cta: string }> = {
  no_printer_registered: {
    title: 'لا توجد طابعة مسجّلة في حسابك',
    desc: 'لتفعيل هذا الكود يجب أولاً تسجيل طابعتك وتفعيل ضمانها عبر مسح رمز QR الخاص بها.',
    cta: 'تسجيل وتفعيل الطابعة',
  },
  warranty_expired: {
    title: 'انتهى ضمان طابعتك',
    desc: 'صلاحية ضمان طابعتك انتهت. يرجى تجديد الضمان أو تفعيل طابعة أخرى لاستخدام هذا الكود.',
    cta: 'تجديد / تفعيل ضمان الطابعة',
  },
  no_active_warranty: {
    title: 'لا توجد طابعة فعّالة في الضمان',
    desc: 'يجب أن تكون لديك طابعة واحدة على الأقل ضمانها فعّال لتفعيل هذا الكود.',
    cta: 'الذهاب لتفعيل الطابعة',
  },
};

export default function RedeemLoyaltyCodeCard() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [warrantyReason, setWarrantyReason] = useState<WarrantyReason | null>(null);
  const [errorKey, setErrorKey] = useState<ErrorKey | null>(null);
  const [errorRaw, setErrorRaw] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef<{ code: string; at: number } | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  const { data: warrantyCheck, isFetching: checking } = useQuery({
    queryKey: ['user-warranty-precheck'],
    enabled: open,
    staleTime: 30_000,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('check_user_printer_warranty');
      if (error) throw error;
      return data as { status: 'active' | 'no_printer_registered' | 'warranty_expired' | 'no_active_warranty' | 'auth_required'; expiry_date?: string };
    },
  });

  const precheckBlocked: WarrantyReason | null =
    warrantyCheck && warrantyCheck.status !== 'active' && warrantyCheck.status !== 'auth_required'
      ? (warrantyCheck.status as WarrantyReason)
      : null;
  const activeReason = warrantyReason || precheckBlocked;

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 100)), 100);
    return () => clearInterval(t);
  }, [cooldown]);

  // Reset states on dialog close
  useEffect(() => {
    if (!open) {
      setErrorKey(null);
      setErrorRaw(null);
      setSuccess(false);
    }
  }, [open]);

  const clearFeedback = () => {
    setErrorKey(null);
    setErrorRaw(null);
    setSuccess(false);
  };

  const submit = async () => {
    if (inFlightRef.current || submitting) return;
    clearFeedback();
    if (precheckBlocked) {
      setWarrantyReason(precheckBlocked);
      return;
    }
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) {
      setErrorKey('code_invalid_format');
      return;
    }
    if (!CODE_REGEX.test(trimmed)) {
      setErrorKey('code_invalid_format');
      return;
    }
    const last = lastAttemptRef.current;
    if (last && last.code === trimmed && Date.now() - last.at < COOLDOWN_MS) {
      setErrorKey('rate_limited');
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    setWarrantyReason(null);
    try {
      const { error } = await (supabase as any).rpc('redeem_loyalty_card_code', { p_code: trimmed });
      lastAttemptRef.current = { code: trimmed, at: Date.now() };
      if (error) {
        const raw = (error.message || '').toString();
        const key = (raw.match(/[a-z_]+/g) || []).find(Boolean) || '';
        setCooldown(COOLDOWN_MS);
        if (key === 'no_printer_registered' || key === 'warranty_expired' || key === 'no_active_warranty') {
          setWarrantyReason(key as WarrantyReason);
          return;
        }
        const knownKeys: ErrorKey[] = [
          'code_not_found','code_already_used','code_expired',
          'already_has_active_card','auth_required','card_not_found',
        ];
        if (knownKeys.includes(key as ErrorKey)) {
          setErrorKey(key as ErrorKey);
        } else {
          setErrorKey('unknown');
          setErrorRaw(raw);
        }
        return;
      }
      setSuccess(true);
      toast.success('تم تفعيل البطاقة بنجاح');
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
      qc.invalidateQueries({ queryKey: ['user-cards'] });
      qc.invalidateQueries({ queryKey: ['user-loyalty-code-history'] });
      qc.invalidateQueries({ queryKey: ['user-active-card-cart'] });
      qc.invalidateQueries({ queryKey: ['card-discount-limits'] });
      qc.invalidateQueries({ queryKey: ['card-discount-usage'] });
      qc.invalidateQueries({ queryKey: ['card-percentage-discount-used'] });
      qc.invalidateQueries({ queryKey: ['card-free-shipping-used'] });
      setTimeout(() => { setOpen(false); setCode(''); }, 1200);
    } catch (e: any) {
      setCooldown(COOLDOWN_MS);
      setErrorKey('unknown');
      setErrorRaw(e?.message || null);
    } finally {
      inFlightRef.current = false;
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="font-medium">تفعيل بطاقة بكود</p>
                <p className="text-xs text-muted-foreground">يتطلب طابعة فعّالة في الضمان</p>
              </div>
            </div>
            <Button size="sm" variant="outline">إدخال كود</Button>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
        <DialogHeader><DialogTitle>تفعيل بطاقة الولاء بكود</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[70vh] px-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            أدخل الكود الذي حصلت عليه. يجب أن تكون لديك طابعة فعّالة في الضمان لتفعيل البطاقة،
            وستبدأ صلاحية البطاقة من لحظة التفعيل.
          </p>
          <Input
            value={code}
            onChange={e => {
              setCode(e.target.value.toUpperCase());
              if (warrantyReason) setWarrantyReason(null);
              if (errorKey || success) clearFeedback();
            }}
            placeholder="مثال: A1B2C3D4E5F6"
            className={`font-mono tracking-wider text-center ${errorKey ? 'border-destructive focus-visible:ring-destructive' : ''}`}
            autoFocus
            disabled={submitting || success}
            onKeyDown={e => { if (e.key === 'Enter' && !submitting && cooldown === 0) submit(); }}
          />
          {checking && !warrantyCheck && (
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3 w-3 animate-spin" />
              جاري التحقق من حالة الضمان...
            </div>
          )}
          {success && (
            <div className="rounded-lg border border-emerald-500/40 bg-emerald-500/10 p-3 flex items-start gap-2">
              <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5 shrink-0" />
              <div className="space-y-1 text-right">
                <p className="text-sm font-semibold text-emerald-700 dark:text-emerald-300">
                  تم تفعيل البطاقة بنجاح
                </p>
                <p className="text-xs text-emerald-700/90 dark:text-emerald-300/90">
                  أصبحت مزايا البطاقة فعّالة في حسابك الآن.
                </p>
              </div>
            </div>
          )}
          {errorKey && !success && (
            <div className="rounded-lg border border-destructive/40 bg-destructive/10 p-3 flex items-start gap-2">
              <XCircle className="h-4 w-4 text-destructive mt-0.5 shrink-0" />
              <div className="space-y-1 text-right flex-1">
                <p className="text-sm font-semibold text-destructive">
                  {ERROR_DETAILS[errorKey].title}
                </p>
                <p className="text-xs text-destructive/90 leading-relaxed">
                  {ERROR_DETAILS[errorKey].desc}
                </p>
                {errorKey === 'unknown' && errorRaw && (
                  <p className="text-[10px] text-muted-foreground font-mono break-all mt-1">
                    {errorRaw}
                  </p>
                )}
              </div>
            </div>
          )}
          {activeReason && !success && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {WARRANTY_DETAILS[activeReason].title}
                  </p>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    {WARRANTY_DETAILS[activeReason].desc}
                  </p>
                </div>
              </div>
              <Button
                size="sm"
                variant="outline"
                className="w-full border-amber-500/50 hover:bg-amber-500/20"
                disabled={submitting}
                onClick={() => { setOpen(false); navigate('/activate-printer'); }}
              >
                {WARRANTY_DETAILS[activeReason].cta}
              </Button>
            </div>
          )}
          <Button
            className="w-full"
            onClick={submit}
            disabled={submitting || cooldown > 0 || !code.trim() || !!precheckBlocked || checking || success}
          >
            {success ? (
              <><CheckCircle2 className="h-4 w-4 mr-2" /> تم التفعيل</>
            ) : submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> جاري التفعيل...</>
            ) : cooldown > 0 ? (
              `إعادة المحاولة خلال ${(cooldown / 1000).toFixed(1)}s`
            ) : precheckBlocked ? 'لا يمكن التفعيل' : 'تفعيل'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
