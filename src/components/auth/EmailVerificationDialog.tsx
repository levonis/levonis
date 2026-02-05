import { useState, useEffect, useRef, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
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

// Store resend timers globally to persist across dialog open/close
const resendTimers: Record<string, number> = {};
// Track which email+type combinations have already sent codes in this session
const sentCodes: Record<string, boolean> = {};

export default function EmailVerificationDialog({
  open,
  onOpenChange,
  email,
  type,
  userId,
  onVerified,
  onResendCode,
}: EmailVerificationDialogProps) {
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const sendingRef = useRef(false);
  
  // Use email + type + userId for unique key
  const timerKey = `${email}-${type}-${userId || 'no-user'}`;
  
  // Get remaining time from global store
  const getStoredTimer = useCallback(() => {
    const storedTime = resendTimers[timerKey];
    if (storedTime) {
      const remaining = Math.max(0, Math.ceil((storedTime - Date.now()) / 1000));
      return remaining > 0 ? remaining : 0;
    }
    return 0;
  }, [timerKey]);
  
  const [resendTimer, setResendTimer] = useState(() => getStoredTimer());

  // Reset code inputs when dialog opens
  useEffect(() => {
    if (open) {
      setCode('');
      setVerified(false);
      setResendTimer(getStoredTimer());
    }
  }, [open, getStoredTimer]);

  // Send verification code when dialog opens (only once per session)
  useEffect(() => {
    if (!open || !email || sendingRef.current) return;
    
    // Check if we already sent a code for this combination in this session
    if (sentCodes[timerKey]) {
      return;
    }
    
    // Check if there's an active timer (code was recently sent)
    const existingTimer = getStoredTimer();
    if (existingTimer > 0) {
      sentCodes[timerKey] = true;
      return;
    }
    
    sendingRef.current = true;
    sentCodes[timerKey] = true;
    
    const sendCode = async () => {
      try {
        console.log('[EmailVerification] Sending code to:', email);
        const { data, error } = await supabase.functions.invoke('send-verification-code', {
          body: { email, type, user_id: userId }
        });

        console.log('[EmailVerification] Response:', { data, error });

        if (error) {
          console.error('[EmailVerification] Edge function error:', error);
          sentCodes[timerKey] = false;
        } else if (data?.success) {
          if (!data?.alreadySent) {
            toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
          }
          resendTimers[timerKey] = Date.now() + 60000;
          setResendTimer(60);
        } else if (data?.error) {
          toast.error(data.error);
          sentCodes[timerKey] = false;
        }
      } catch (error) {
        console.error('[EmailVerification] Catch error:', error);
        sentCodes[timerKey] = false;
      } finally {
        sendingRef.current = false;
      }
    };

    sendCode();
  }, [open, email, type, userId, timerKey, getStoredTimer]);

  // Timer countdown
  useEffect(() => {
    if (resendTimer > 0 && open) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer, open]);

  // Auto-submit when code is complete
  useEffect(() => {
    if (code.length === 6 && !loading && !verified) {
      handleVerify(code);
    }
  }, [code]);

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
        delete sentCodes[timerKey];
        setTimeout(() => {
          onVerified();
          onOpenChange(false);
        }, 1500);
      } else {
        toast.error(data.error || 'رمز غير صحيح');
        setCode('');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error(error.message || 'حدث خطأ أثناء التحقق');
      setCode('');
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || loading || sendingRef.current) return;

    sendingRef.current = true;
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email, type, user_id: userId }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('تم إرسال رمز جديد');
        resendTimers[timerKey] = Date.now() + 60000;
        setResendTimer(60);
        setCode('');
        onResendCode?.();
      } else {
        toast.error(data.error || 'فشل في إرسال الرمز');
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setLoading(false);
      sendingRef.current = false;
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
      <DialogContent className="sm:max-w-md z-[9999]" dir="rtl">
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
            {/* Code Input using InputOTP */}
            <div className="flex justify-center" dir="ltr">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={setCode}
                disabled={loading}
              >
                <InputOTPGroup>
                  <InputOTPSlot index={0} className="w-12 h-14 text-2xl font-bold" />
                  <InputOTPSlot index={1} className="w-12 h-14 text-2xl font-bold" />
                  <InputOTPSlot index={2} className="w-12 h-14 text-2xl font-bold" />
                  <InputOTPSlot index={3} className="w-12 h-14 text-2xl font-bold" />
                  <InputOTPSlot index={4} className="w-12 h-14 text-2xl font-bold" />
                  <InputOTPSlot index={5} className="w-12 h-14 text-2xl font-bold" />
                </InputOTPGroup>
              </InputOTP>
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => handleVerify(code)}
              disabled={loading || code.length !== 6}
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
