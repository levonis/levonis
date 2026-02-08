import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { Mail, ArrowLeft, ArrowRight, Shield, Loader2, CheckCircle2, Gift } from 'lucide-react';
import { SignupStepProps } from './types';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

interface Step3VerificationProps extends SignupStepProps {
  userEmail: string;
  userId?: string;
  onVerified: () => Promise<void> | void;
}

export default function Step3Verification({ 
  data, 
  updateData, 
  onNext, 
  onBack, 
  loading,
  userEmail,
  onVerified
}: Step3VerificationProps) {
  const [code, setCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verified, setVerified] = useState(false);
  const [resendTimer, setResendTimer] = useState(60);
  const [sending, setSending] = useState(false);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  useEffect(() => {
    // Auto-verify when code is complete
    if (code.length === 6 && !verifying && !verified) {
      handleVerify(code);
    }
  }, [code]);

  const handleVerify = async (codeStr: string) => {
    if (codeStr.length !== 6) {
      toast.error('أدخل الرمز كاملاً');
      return;
    }

    setVerifying(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('verify-code', {
        body: { email: userEmail, code: codeStr, type: 'signup' }
      });

      if (error) throw error;

      if (result.success) {
        setVerified(true);
        // Just mark as verified, don't create account here
        await onVerified();
      } else {
        toast.error(result.error || 'رمز غير صحيح');
        setCode('');
      }
    } catch (error: any) {
      console.error('Verification error:', error);
      toast.error('حدث خطأ أثناء التحقق');
      setCode('');
    } finally {
      setVerifying(false);
    }
  };

  const handleResend = async () => {
    if (resendTimer > 0 || sending) return;

    setSending(true);
    try {
      const { data: result, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email: userEmail, type: 'signup' }
      });

      if (error) throw error;

      if (result.success) {
        toast.success('تم إرسال رمز جديد');
        setResendTimer(60);
        setCode('');
      } else {
        toast.error(result.error || 'فشل في إرسال الرمز');
      }
    } catch (error: any) {
      console.error('Resend error:', error);
      toast.error('حدث خطأ');
    } finally {
      setSending(false);
    }
  };

  const handleNext = () => {
    if (verified) {
      onNext();
    } else {
      toast.error('يجب تأكيد البريد الإلكتروني أولاً');
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          {verified ? (
            <CheckCircle2 className="w-8 h-8 text-green-500" />
          ) : (
            <Mail className="w-8 h-8 text-primary" />
          )}
        </div>
        <h2 className="text-xl font-bold">تأكيد البريد الإلكتروني</h2>
        <p className="text-sm text-muted-foreground mt-1">
          أرسلنا رمز تحقق إلى
          <br />
          <span className="font-semibold text-foreground" dir="ltr">{userEmail}</span>
        </p>
      </div>

      {verified ? (
        <div className="py-6 flex flex-col items-center">
          <div className="h-20 w-20 rounded-full bg-green-500/10 flex items-center justify-center mb-4 border border-green-500/30">
            <CheckCircle2 className="h-10 w-10 text-green-500" />
          </div>
          <p className="text-lg font-bold text-green-500">تم التحقق بنجاح!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Code Input */}
          <div className="flex flex-col items-center gap-4">
            <div className="flex justify-center">
              <InputOTP
                maxLength={6}
                value={code}
                onChange={(val) => setCode(val.replace(/[^0-9]/g, ''))}
                disabled={verifying}
                inputMode="numeric"
                pattern="[0-9]*"
                autoComplete="one-time-code"
                dir="ltr"
              >
                <InputOTPGroup className="gap-2 flex-row-reverse">
                  {[0, 1, 2, 3, 4, 5].map((index) => (
                    <InputOTPSlot
                      key={index}
                      index={index}
                      className="w-11 h-12 text-xl font-bold rounded-xl border-2 border-border/60 bg-background/50 focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
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
            disabled={verifying || code.length !== 6}
            className="w-full h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
          >
            {verifying ? (
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
          <div className="text-center">
            <p className="text-sm text-muted-foreground mb-2">لم تستلم الرمز؟</p>
            <Button
              variant="ghost"
              onClick={handleResend}
              disabled={resendTimer > 0 || sending}
              className="text-primary hover:text-primary/80"
            >
              {sending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-1" />
              ) : null}
              {resendTimer > 0
                ? `إعادة الإرسال بعد ${resendTimer} ثانية`
                : 'إعادة إرسال الرمز'}
            </Button>
          </div>
        </div>
      )}

      {/* Referral Code (Optional) */}
      <div className="space-y-2 border-t border-border/50 pt-4">
        <Label htmlFor="referralCode" className="flex items-center gap-2">
          <Gift className="w-4 h-4 text-primary" />
          كود الدعوة (اختياري)
        </Label>
        <Input
          id="referralCode"
          type="text"
          placeholder="REF-XXXXXXXX"
          value={data.referralCode}
          onChange={(e) => updateData({ referralCode: e.target.value.toUpperCase() })}
          disabled={loading}
        />
        <p className="text-xs text-muted-foreground">
          إذا كان لديك كود دعوة من صديق، أدخله للحصول على مكافآت
        </p>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading || verifying}
          className="flex-1"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          السابق
        </Button>
        <Button
          onClick={handleNext}
          disabled={!verified || loading}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
        >
          التالي
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </div>
  );
}
