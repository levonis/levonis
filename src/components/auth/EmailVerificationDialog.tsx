import { useState, useEffect, useRef, useCallback } from 'react';
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
  const [code, setCode] = useState(['', '', '', '', '', '']);
  const [loading, setLoading] = useState(false);
  const [verified, setVerified] = useState(false);
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);
  const sendingRef = useRef(false); // Prevent concurrent sends
  
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
      setCode(['', '', '', '', '', '']);
      setVerified(false);
      setResendTimer(getStoredTimer());
      setTimeout(() => {
        inputRefs.current[0]?.focus();
      }, 100);
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
          // Don't show error for network issues, just log
          sentCodes[timerKey] = false;
        } else if (data?.success) {
          if (!data?.alreadySent) {
            toast.success('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
          }
          // Set timer in global store
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
        // Clear the sent code tracker so re-verification works if needed
        delete sentCodes[timerKey];
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
        // Set timer in global store
        resendTimers[timerKey] = Date.now() + 60000;
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
            {/* Code Input */}
            <div className="flex justify-center gap-3" dir="ltr">
              {code.map((digit, index) => (
                <input
                  key={index}
                  ref={(el) => {
                    inputRefs.current[index] = el;
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="[0-9]*"
                  maxLength={1}
                  value={digit}
                  onChange={(e) => handleInputChange(index, e.target.value)}
                  onKeyDown={(e) => handleKeyDown(index, e)}
                  onPaste={handlePaste}
                  disabled={loading}
                  autoComplete="one-time-code"
                  autoFocus={index === 0}
                  style={{
                    width: '48px',
                    height: '56px',
                    textAlign: 'center',
                    fontSize: '24px',
                    fontWeight: 'bold',
                    border: '2px solid hsl(var(--input))',
                    borderRadius: '8px',
                    backgroundColor: 'hsl(var(--background))',
                    color: 'hsl(var(--foreground))',
                    outline: 'none',
                  }}
                  onFocus={(e) => {
                    e.target.style.borderColor = 'hsl(var(--primary))';
                    e.target.style.boxShadow = '0 0 0 2px hsl(var(--primary) / 0.2)';
                  }}
                  onBlur={(e) => {
                    e.target.style.borderColor = 'hsl(var(--input))';
                    e.target.style.boxShadow = 'none';
                  }}
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
