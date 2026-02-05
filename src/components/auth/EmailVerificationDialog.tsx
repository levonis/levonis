import { useState, useEffect, useCallback } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Loader2, Mail, CheckCircle2, Shield, Sparkles } from 'lucide-react';
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
  const [isSending, setIsSending] = useState(false);
  
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
    if (!open || !email || isSending) return;
    
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
    
    setIsSending(true);
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
        setIsSending(false);
      }
    };

    sendCode();
  }, [open, email, type, userId, timerKey, getStoredTimer, isSending]);

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
    if (resendTimer > 0 || loading || isSending) return;

    setIsSending(true);
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
      setIsSending(false);
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
      <DialogContent 
        className="sm:max-w-md z-[9999] p-0 gap-0 overflow-hidden rounded-2xl border border-primary/20 bg-gradient-to-b from-card to-background" 
        dir="rtl"
      >
        {/* Hero Header */}
        <div className="relative px-6 pt-8 pb-6 bg-gradient-to-b from-primary/10 via-primary/5 to-transparent">
          {/* Decorative elements */}
          <div className="absolute top-4 left-4 h-16 w-16 rounded-full bg-primary/5 blur-2xl" />
          <div className="absolute top-8 right-8 h-12 w-12 rounded-full bg-accent/10 blur-xl" />
          
          <div className="relative flex flex-col items-center">
            {/* Icon */}
            <div className="relative mb-4">
              <div className="h-20 w-20 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center border border-primary/30 shadow-lg">
                {verified ? (
                  <CheckCircle2 className="h-10 w-10 text-green-500" />
                ) : (
                  <Mail className="h-10 w-10 text-primary" />
                )}
              </div>
              {/* Sparkle decoration */}
              <Sparkles className="absolute -top-1 -right-1 h-5 w-5 text-primary/60" />
            </div>
            
            <DialogHeader className="text-center space-y-2">
              <DialogTitle className="text-xl font-bold text-foreground">
                {typeLabels[type]}
              </DialogTitle>
              <DialogDescription className="text-sm text-muted-foreground">
                أرسلنا رمز تحقق مكون من 6 أرقام إلى
                <br />
                <span className="font-semibold text-foreground" dir="ltr">{email}</span>
              </DialogDescription>
            </DialogHeader>
          </div>
        </div>

        {verified ? (
          <div className="px-6 py-12 flex flex-col items-center">
            <div className="h-24 w-24 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/30">
              <CheckCircle2 className="h-12 w-12 text-green-500" />
            </div>
            <p className="text-lg font-bold text-green-500">تم التحقق بنجاح!</p>
            <p className="text-sm text-muted-foreground mt-2">جاري الانتقال...</p>
          </div>
        ) : (
          <div className="px-6 pb-6 space-y-6">
            {/* Code Input */}
            <div className="flex flex-col items-center gap-4">
              <div className="flex justify-center" dir="ltr">
                <InputOTP
                  maxLength={6}
                  value={code}
                  onChange={(val) => setCode(val.replace(/[^0-9]/g, ''))}
                  disabled={loading}
                  inputMode="numeric"
                  pattern="[0-9]*"
                  autoComplete="one-time-code"
                >
                  <InputOTPGroup className="gap-2 rtl:flex-row-reverse">
                    {[0, 1, 2, 3, 4, 5].map((index) => (
                      <InputOTPSlot 
                        key={index}
                        index={index} 
                        className="w-12 h-14 text-2xl font-bold rounded-xl border-2 border-border/60 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all" 
                      />
                    ))}
                  </InputOTPGroup>
                </InputOTP>
              </div>
              
              {/* Security note */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Shield className="h-3.5 w-3.5" />
                <span>الرمز صالح لمدة 10 دقائق</span>
              </div>
            </div>

            {/* Verify Button */}
            <Button
              onClick={() => handleVerify(code)}
              disabled={loading || code.length !== 6}
              className="w-full h-12 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base shadow-md hover:opacity-90 transition-all disabled:opacity-50"
            >
              {loading ? (
                <>
                  <Loader2 className="h-5 w-5 animate-spin ml-2" />
                  جاري التحقق...
                </>
              ) : (
                <>
                  <CheckCircle2 className="h-5 w-5 ml-2" />
                  تأكيد الرمز
                </>
              )}
            </Button>

            {/* Resend */}
            <div className="text-center border-t border-border/30 pt-4">
              <p className="text-sm text-muted-foreground mb-2">
                لم تستلم الرمز؟
              </p>
              <Button
                variant="ghost"
                onClick={handleResend}
                disabled={resendTimer > 0 || loading}
                className="text-primary hover:text-primary/80 hover:bg-primary/10 font-semibold"
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
