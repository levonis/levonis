import { useEffect, useState } from 'react';
import { z } from 'zod';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { CreditCard, ShieldCheck, Loader2, CheckCircle2 } from 'lucide-react';

/**
 * Shown in Cart when the user has the Levo physical card product in cart.
 * Collects the applicant's 3-part name, birth date, and email. On confirm,
 * upserts a `levo_card_orders` row with status = 'pending_payment'. The
 * order.link_levo_card_order trigger promotes it to 'paid_pending_approval'
 * once the checkout order is inserted.
 *
 * Props:
 *  - onValidChange: parent uses this to gate the checkout button.
 */

const nameSchema = z
  .string()
  .trim()
  .min(2, 'الحد الأدنى حرفان')
  .max(40, 'الحد الأقصى 40 حرفاً');

interface Props {
  onConfirmedChange?: (confirmed: boolean) => void;
}

export default function LevoCardOrderForm({ onConfirmedChange }: Props) {
  const { user } = useAuth();
  const [first, setFirst] = useState('');
  const [father, setFather] = useState('');
  const [grand, setGrand] = useState('');
  const [dob, setDob] = useState('');
  const [email, setEmail] = useState(user?.email || '');
  const [ackTruth, setAckTruth] = useState(false);
  const [ackFinal, setAckFinal] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [existingId, setExistingId] = useState<string | null>(null);

  // Prefill from existing pending request
  useEffect(() => {
    if (!user) return;
    (async () => {
      const { data } = await (supabase as any)
        .from('levo_card_orders')
        .select('id, full_name_triple, birth_date, email, status')
        .eq('user_id', user.id)
        .in('status', ['pending_payment', 'paid_pending_approval'])
        .maybeSingle();
      if (data) {
        setExistingId(data.id);
        const parts = String(data.full_name_triple || '').split(/\s+/);
        setFirst(parts[0] || '');
        setFather(parts[1] || '');
        setGrand(parts.slice(2).join(' ') || '');
        setDob(String(data.birth_date || ''));
        setEmail(data.email || user.email || '');
        // If already paid_pending_approval, treat as confirmed & lock
        if (data.status === 'paid_pending_approval') {
          setConfirmed(true);
          setAckTruth(true);
          setAckFinal(true);
        }
      }
    })();
  }, [user?.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    onConfirmedChange?.(confirmed);
  }, [confirmed, onConfirmedChange]);

  const fullName = [first, father, grand].map((s) => s.trim()).filter(Boolean).join(' ');
  const namesValid = [first, father, grand].every((s) => nameSchema.safeParse(s).success);
  const dobDate = dob ? new Date(dob) : null;
  const dobValid = !!dobDate && !isNaN(dobDate.getTime()) &&
    dobDate <= new Date(new Date().setFullYear(new Date().getFullYear() - 10));
  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email || '');

  const canSubmit = namesValid && dobValid && emailValid && ackTruth && ackFinal && !saving;

  const handleConfirm = async () => {
    if (!user) return;
    setSaving(true);
    try {
      const { data, error } = await (supabase as any).rpc('submit_levo_card_request', {
        p_full_name: fullName,
        p_birth_date: dob,
        p_email: email.trim().toLowerCase(),
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      setConfirmed(true);
      toast.success('تم حفظ بيانات طلب البطاقة');
    } catch (e: any) {
      const err = e?.message || String(e);
      const map: Record<string, string> = {
        invalid_name: 'الاسم الثلاثي غير صحيح',
        invalid_birth_date: 'تاريخ الميلاد غير صحيح',
        invalid_email: 'البريد الإلكتروني غير صحيح',
        user_has_card: 'لديك بطاقة مفعّلة بالفعل',
        unauthenticated: 'يجب تسجيل الدخول',
      };
      toast.error(map[err] || 'تعذّر حفظ البيانات');
    } finally {
      setSaving(false);
    }
  };

  const handleEdit = () => {
    setConfirmed(false);
  };

  return (
    <Card className="border-primary/30 bg-gradient-to-br from-primary/5 via-transparent to-primary/5">
      <CardContent className="p-4 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
            <CreditCard className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">بيانات طلب بطاقة ليفو</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              نحتاج معلومات دقيقة لإصدار البطاقة باسمك — راجعها قبل التأكيد.
            </div>
          </div>
          {confirmed && (
            <div className="flex items-center gap-1 text-xs text-green-600 dark:text-green-400">
              <CheckCircle2 className="h-4 w-4" /> مُؤكَّد
            </div>
          )}
        </div>

        <fieldset disabled={confirmed} className="space-y-3">
          <div>
            <Label className="text-xs">الاسم الثلاثي</Label>
            <div className="grid grid-cols-3 gap-2 mt-1">
              <Input
                placeholder="الاسم"
                value={first}
                onChange={(e) => setFirst(e.target.value)}
                dir="rtl"
              />
              <Input
                placeholder="اسم الأب"
                value={father}
                onChange={(e) => setFather(e.target.value)}
                dir="rtl"
              />
              <Input
                placeholder="اسم الجد"
                value={grand}
                onChange={(e) => setGrand(e.target.value)}
                dir="rtl"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="flex flex-col">
              <Label htmlFor="levo-dob" className="text-xs mb-1">تاريخ الميلاد</Label>
              <Input
                id="levo-dob"
                type="date"
                dir="ltr"
                value={dob}
                onChange={(e) => setDob(e.target.value)}
                placeholder="YYYY-MM-DD"
                max={new Date(new Date().setFullYear(new Date().getFullYear() - 10))
                  .toISOString()
                  .slice(0, 10)}
                className="w-full min-w-0 h-10 appearance-none"
              />
            </div>
            <div className="flex flex-col">
              <Label htmlFor="levo-email" className="text-xs mb-1">البريد الإلكتروني</Label>
              <Input
                id="levo-email"
                type="email"
                dir="ltr"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                className="w-full min-w-0 h-10 appearance-none"
              />
            </div>
          </div>


          <div className="space-y-2 pt-2">
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={ackTruth}
                onCheckedChange={(v) => setAckTruth(!!v)}
                className="mt-0.5"
              />
              <span>أُقرّ بصحّة البيانات المُدخلة ومطابقتها لوثائقي الرسمية.</span>
            </label>
            <label className="flex items-start gap-2 text-xs cursor-pointer">
              <Checkbox
                checked={ackFinal}
                onCheckedChange={(v) => setAckFinal(!!v)}
                className="mt-0.5"
              />
              <span>أفهم أنّ البيانات لا يمكن تعديلها بعد الدفع.</span>
            </label>
          </div>
        </fieldset>

        {!confirmed ? (
          <Button onClick={handleConfirm} disabled={!canSubmit} className="w-full">
            {saving ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShieldCheck className="h-4 w-4 ml-1" />
                تأكيد البيانات والاستمرار للدفع
              </>
            )}
          </Button>
        ) : (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleEdit} className="flex-1">
              تعديل البيانات
            </Button>
            <div className="flex-1 text-xs text-center text-muted-foreground self-center">
              يمكنك الآن إتمام الدفع
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
