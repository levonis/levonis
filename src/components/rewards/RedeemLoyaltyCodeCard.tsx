import { useState, useRef, useEffect } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ticket, Loader2, AlertTriangle } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';

const COOLDOWN_MS = 1500;

const ERROR_MESSAGES: Record<string, string> = {
  code_not_found: 'الكود غير صالح',
  code_already_used: 'تم استخدام هذا الكود مسبقاً',
  code_expired: 'انتهت صلاحية هذا الكود',
  no_active_warranty: 'تحتاج إلى طابعة فعّالة في الضمان لتفعيل هذا الكود',
  already_has_active_card: 'لديك بطاقة فعّالة بالفعل',
  auth_required: 'يرجى تسجيل الدخول',
};

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
  const inFlightRef = useRef(false);
  const lastAttemptRef = useRef<{ code: string; at: number } | null>(null);
  const qc = useQueryClient();
  const navigate = useNavigate();

  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => Math.max(0, c - 100)), 100);
    return () => clearInterval(t);
  }, [cooldown]);

  const submit = async () => {
    if (inFlightRef.current || submitting) return;
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast.error('أدخل الكود'); return; }
    const last = lastAttemptRef.current;
    if (last && last.code === trimmed && Date.now() - last.at < COOLDOWN_MS) {
      toast.error('يرجى الانتظار قبل إعادة المحاولة');
      return;
    }
    inFlightRef.current = true;
    setSubmitting(true);
    setWarrantyReason(null);
    try {
      const { error } = await (supabase as any).rpc('redeem_loyalty_card_code', { p_code: trimmed });
      lastAttemptRef.current = { code: trimmed, at: Date.now() };
      if (error) {
        const key = (error.message || '').match(/[a-z_]+/)?.[0] || '';
        setCooldown(COOLDOWN_MS);
        if (key === 'no_printer_registered' || key === 'warranty_expired' || key === 'no_active_warranty') {
          setWarrantyReason(key as WarrantyReason);
          return;
        }
        toast.error(ERROR_MESSAGES[key] || error.message || 'فشل التفعيل');
        return;
      }
      toast.success('تم تفعيل البطاقة بنجاح');
      setOpen(false);
      setCode('');
      setWarrantyReason(null);
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
      qc.invalidateQueries({ queryKey: ['user-cards'] });
      qc.invalidateQueries({ queryKey: ['user-loyalty-code-history'] });
      qc.invalidateQueries({ queryKey: ['user-active-card-cart'] });
      qc.invalidateQueries({ queryKey: ['card-discount-limits'] });
      qc.invalidateQueries({ queryKey: ['card-discount-usage'] });
      qc.invalidateQueries({ queryKey: ['card-percentage-discount-used'] });
      qc.invalidateQueries({ queryKey: ['card-free-shipping-used'] });
    } catch (e: any) {
      setCooldown(COOLDOWN_MS);
      toast.error(e?.message || 'فشل التفعيل');
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
            onChange={e => { setCode(e.target.value.toUpperCase()); if (warrantyReason) setWarrantyReason(null); }}
            placeholder="مثال: A1B2C3D4E5F6"
            className="font-mono tracking-wider text-center"
            autoFocus
            disabled={submitting}
            onKeyDown={e => { if (e.key === 'Enter' && !submitting && cooldown === 0) submit(); }}
          />
          {warrantyReason && (
            <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 space-y-2">
              <div className="flex items-start gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 mt-0.5 shrink-0" />
                <div className="space-y-1 text-right">
                  <p className="text-sm font-semibold text-amber-700 dark:text-amber-300">
                    {WARRANTY_DETAILS[warrantyReason].title}
                  </p>
                  <p className="text-xs text-amber-700/90 dark:text-amber-300/90 leading-relaxed">
                    {WARRANTY_DETAILS[warrantyReason].desc}
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
                {WARRANTY_DETAILS[warrantyReason].cta}
              </Button>
            </div>
          )}
          <Button className="w-full" onClick={submit} disabled={submitting || cooldown > 0 || !code.trim()}>
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin mr-2" /> جاري التفعيل...</>
            ) : cooldown > 0 ? (
              `إعادة المحاولة خلال ${(cooldown / 1000).toFixed(1)}s`
            ) : 'تفعيل'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
