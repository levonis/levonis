import { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowRight, Loader2, Mail, RefreshCw } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Props extends SignupStepProps {
  onVerified: () => void;
  submitting: boolean;
}

export default function Step2EmailVerification({
  data,
  updateData,
  onBack,
  onVerified,
  submitting,
}: Props) {
  const { isRtl } = useLanguage();
  const [digits, setDigits] = useState<string[]>(['', '', '', '', '', '']);
  const [verifying, setVerifying] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(60);
  const inputsRef = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    inputsRef.current[0]?.focus();
  }, []);

  useEffect(() => {
    if (cooldown <= 0) return;
    const id = setInterval(() => setCooldown((c) => (c > 0 ? c - 1 : 0)), 1000);
    return () => clearInterval(id);
  }, [cooldown]);

  const handleChange = (i: number, val: string) => {
    const v = val.replace(/\D/g, '').slice(-1);
    const next = [...digits];
    next[i] = v;
    setDigits(next);
    updateData({ verificationCode: next.join('') });
    if (v && i < 5) inputsRef.current[i + 1]?.focus();
    if (next.every((d) => d) && next.join('').length === 6) {
      void verify(next.join(''));
    }
  };

  const handleKeyDown = (i: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !digits[i] && i > 0) {
      inputsRef.current[i - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (!text) return;
    e.preventDefault();
    const next = text.split('').concat(Array(6).fill('')).slice(0, 6);
    setDigits(next);
    updateData({ verificationCode: next.join('') });
    inputsRef.current[Math.min(text.length, 5)]?.focus();
    if (text.length === 6) void verify(text);
  };

  const verify = async (code: string) => {
    setVerifying(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('verify-code', {
        body: { email: data.email, code, type: 'signup' },
      });
      if (error || !res?.success) {
        toast.error(res?.error || 'رمز غير صحيح');
        setDigits(['', '', '', '', '', '']);
        updateData({ verificationCode: '' });
        inputsRef.current[0]?.focus();
        return;
      }
      onVerified();
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ');
    } finally {
      setVerifying(false);
    }
  };

  const resend = async () => {
    if (cooldown > 0) return;
    setResending(true);
    try {
      const { data: res, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email: data.email, type: 'signup' },
      });
      if (error || !res?.success) {
        toast.error(res?.error || 'فشل إرسال الرمز');
        return;
      }
      toast.success('تم إرسال رمز جديد');
      setCooldown(60);
    } catch (e: any) {
      toast.error(e?.message || 'حدث خطأ');
    } finally {
      setResending(false);
    }
  };

  const busy = verifying || submitting;

  return (
    <div className="space-y-5">
      <div className="text-center">
        <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-primary/10 mb-3">
          <Mail className="w-7 h-7 text-primary" />
        </div>
        <h2 className="text-2xl font-bold">تحقق من بريدك</h2>
        <p className="text-sm text-muted-foreground mt-1">
          أرسلنا رمزاً مكوناً من 6 أرقام إلى
        </p>
        <p className="text-sm font-medium mt-1" dir="ltr">{data.email}</p>
      </div>

      <div className="flex justify-center gap-2" dir="ltr" onPaste={handlePaste}>
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            type="text"
            inputMode="numeric"
            maxLength={1}
            value={d}
            onChange={(e) => handleChange(i, e.target.value)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            disabled={busy}
            className="w-11 h-14 text-center text-2xl font-bold rounded-xl border-2 border-border bg-background focus:border-primary focus:outline-none transition-colors"
          />
        ))}
      </div>

      <Button
        onClick={() => verify(digits.join(''))}
        disabled={busy || digits.join('').length !== 6}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base"
      >
        {busy ? <Loader2 className="w-5 h-5 animate-spin" /> : 'تحقق وإنشاء الحساب'}
      </Button>

      <div className="text-center">
        <button
          type="button"
          onClick={resend}
          disabled={cooldown > 0 || resending || busy}
          className="text-sm text-primary hover:underline disabled:text-muted-foreground disabled:no-underline inline-flex items-center gap-1.5"
        >
          {resending ? (
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
          ) : (
            <RefreshCw className="w-3.5 h-3.5" />
          )}
          {cooldown > 0 ? `إعادة الإرسال خلال ${cooldown}s` : 'إعادة إرسال الرمز'}
        </button>
      </div>

      <Button
        type="button"
        variant="ghost"
        onClick={onBack}
        disabled={busy}
        className="w-full"
      >
        <ArrowRight className={cn('w-4 h-4', isRtl ? 'ml-2' : 'mr-2 rotate-180')} />
        تعديل البيانات
      </Button>
    </div>
  );
}
