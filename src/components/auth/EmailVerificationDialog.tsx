import { useState, useEffect, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Mail, CheckCircle2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface EmailVerificationDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  email: string;
  type: 'signup' | 'password_reset' | 'password_change' | 'email_change';
  userId?: string;
  onVerified: () => void;
  onResendCode?: () => void;
}

export default function EmailVerificationDialog({
  open,
  onOpenChange,
  email,
  type,
  userId,
  onVerified,
  onResendCode,
}: EmailVerificationDialogProps) {
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  useEffect(() => {
    if (open) {
      setCode(['', '', '', '', '', '']);
      setVerified(false);
      setResendTimer(60);
      // Focus first input
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
    }
  }, [open]);

  useEffect(() => {
    if (resendTimer > 0 && open) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer, open]);

  const handleInputChange = (index: number, value: string) => {
    // Only allow numbers
    if (!/^\d*$/.test(value)) return;

    const newCode = [...code];
    newCode[index] = value.slice(-1); // Only take last character
    setCode(newCode);

    // Auto-focus next input
    if (value && index < 5) {
      inputRefs.current[index + 1]?.focus();
    }

    // Auto-submit when all filled
    if (newCode.every(c => c) && newCode.join('').length === 6) {
      handleVerify(newCode.join(''));
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent) => {
    if (e.key === 'Backspace' && !code[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (pastedData.length === 6) {
      const newCode = pastedData.split('');
      setCode(newCode);
      handleVerify(pastedData);
    }
  };

  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6) {
      toast.error('أدخل الرمز كاملاً');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('verify-code', {
        body: { email, code: codeStr, type }
      });

      if (error) throw error;

      if (data.success) {
        setVerified(true);
        toast.success('تم التحقق بنجاح! ✓');
        setTimeout(() => {
          onVerified();
          onOpenChange(false);
        }, 1500);
      } else {
        toast.error(data.error || 'رمز غير صحيح');
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.message || 'حدث خطأ أثناء التحقق');
      setCode(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email, type, user_id: userId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('تم إرسال رمز جديد');
        setResendTimer(60);
        setCode(['', '', '', '', '', '']);
        inputRefs.current[0]?.focus();
        onResendCode?.();
      } else {
        toast.error(data.error || 'فشل في إرسال الرمز');
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const typeLabels: Record<string, string> = {
    signup: 'تأكيد البريد الإلكتروني',
    password_reset: 'إعادة تعيين كلمة المرور',
    password_change: 'تأكيد تغيير كلمة المرور',
    email_change: 'تأكيد البريد الجديد',
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader className="text-center">
          <div className="mx-auto w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mb-4">
            {verified ? (
              <CheckCircle2 className="h-8 w-8 text-green-500" />
            ) : (
              <Mail className="h-8 w-8 text-primary" />
            )}
          </div>
          <DialogTitle className="text-xl">{typeLabels[type]}</DialogTitle>
          <DialogDescription className="text-center">
            أرسلنا رمز تحقق مكون من 6 أرقام إلى
            <br />
            <span className="font-medium text-foreground" dir="ltr">{email}</span>
          </DialogDescription>
        </DialogHeader>

        {verified ? (
          <div className="text-center py-8">
            <CheckCircle2 className="h-16 w-16 text-green-500 mx-auto mb-4" />
            <p className="text-lg font-medium text-green-600">تم التحقق بنجاح!</p>
          </div>
        ) : (
          <div className="space-y-6 py-4">
            {/* Code Input */}
            <div className="flex justify-center gap-2" dir="ltr">
              {code.map((digit, index) => (
                <Input
                  key={index}
                  ref={(el) => (inputRefs.current[index] = el)}
                  type="text"
                  inputMode="numeric"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  className="w-12 h-14 text-center text-2xl font-bold"
                />
              ))}
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => handleVerify(code.join(''))}
              disabled={loading || code.some(c => !c)}
              className="w-full"
            >
              {loading ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                'تأكيد الرمز'
              )}
            </Button>

            {/* Resend */}
            <div className="text-center">
              <p className="text-sm text-muted-foreground mb-2">
                لم تستلم الرمز؟
              </p>
              <Button
                variant="link"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
                className="text-primary"
              >
                {resendTimer > 0
                  ? `إعادة الإرسال بعد ${resendTimer} ثانية`
                  : 'إعادة إرسال الرمز'}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
