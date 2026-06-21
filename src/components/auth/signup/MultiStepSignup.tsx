import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { trackMetaEvent } from '@/lib/metaPixel';
import Step1Combined from './Step1Combined';
import Step2EmailVerification from './Step2EmailVerification';
import { SignupFormData, initialFormData } from './types';
import { useLanguage } from '@/lib/i18n';

interface MultiStepSignupProps {
  onSwitchToLogin: () => void;
}

export default function MultiStepSignup({ onSwitchToLogin }: MultiStepSignupProps) {
  const { t } = useLanguage();
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // Pick up referral code from URL (?ref=CODE) if present
  useEffect(() => {
    const ref = searchParams.get('ref') || searchParams.get('referral');
    if (ref) setFormData(prev => ({ ...prev, referralCode: ref }));
  }, [searchParams]);

  const updateFormData = (updates: Partial<SignupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleStep1Next = async () => {
    setLoading(true);
    try {
      const email = formData.email.trim().toLowerCase();

      const { data: res, error } = await supabase.functions.invoke('send-verification-code', {
        body: { email, type: 'signup' },
      });

      // Extract server error body when invoke returns non-2xx
      let serverMsg: string | undefined;
      if (error && (error as any).context?.json) {
        try {
          const body = await (error as any).context.json();
          serverMsg = body?.error;
        } catch {}
      }

      if (error || !res?.success) {
        const msg = res?.error || serverMsg || 'تعذر إرسال رمز التحقق';
        toast.error(msg);
        return;
      }
      setCurrentStep(2);
    } catch (e: any) {
      console.error('Step1 next failed:', e);
      toast.error(e?.message || 'حدث خطأ');
    } finally {
      setLoading(false);
    }
  };

  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username,
            avatar_url: formData.avatarUrl,
            email_verified: true,
          },
          emailRedirectTo: `${window.location.origin}/`,
        },
      });

      if (error) {
        const raw = (error.message || '').toLowerCase();
        if (raw.includes('already registered') || raw.includes('already been registered') || raw.includes('user already')) {
          toast.error(t('signup_email_already'));
          setCurrentStep(1);
        } else if (
          raw.includes('weak') ||
          raw.includes('pwned') ||
          raw.includes('compromised') ||
          raw.includes('leaked') ||
          raw.includes('password should') ||
          raw.includes('password is too') ||
          raw.includes('password must') ||
          raw.includes('at least')
        ) {
          toast.error('كلمة المرور ضعيفة أو مسرّبة سابقاً. الرجاء اختيار كلمة مرور أقوى (8 أحرف على الأقل، تتضمن أحرفاً وأرقاماً ورموزاً).');
          setCurrentStep(1);
        } else {
          toast.error(`خطأ في إنشاء الحساب: ${error.message}`);
          setCurrentStep(1);
        }
        return;
      }


      if (!data.user) {
        toast.error(t('signup_account_create_fail'));
        return;
      }

      const userId = data.user.id;

      try {
        void trackMetaEvent({
          eventName: 'CompleteRegistration',
          customData: { status: true },
          user: { email: formData.email, externalId: userId },
        });
      } catch {}

      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) {
          console.error('Auto sign-in failed:', signInError);
          toast.error(t('signup_account_create_error'));
          navigate('/');
          return;
        }
      }

      // Mark email verified on profile (best effort)
      try {
        await supabase.from('profiles').update({ email_verified: true }).eq('id', userId);
      } catch (err) { console.error('Profile update error:', err); }

      // Process referral code (if from URL)
      if (formData.referralCode) {
        try {
          const { data: referralData } = await supabase
            .from('user_referrals')
            .select('referrer_user_id, id')
            .eq('referral_code', formData.referralCode)
            .eq('status', 'pending')
            .maybeSingle();
          if (referralData) {
            await supabase.from('user_referrals').update({
              referred_user_id: userId,
              status: 'completed',
              completed_at: new Date().toISOString(),
            }).eq('id', referralData.id);
          }
        } catch (err) {
          console.error('Error processing referral:', err);
        }
      }

      toast.success(t('signup_account_created'));
      navigate('/');
    } catch (error) {
      console.error('Error completing signup:', error);
      toast.error(t('signup_account_create_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-5">
      {/* Simple progress */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>{t('signup_step_account')}</span>
          <span>{currentStep} / 2</span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-300"
            style={{ width: `${(currentStep / 2) * 100}%` }}
          />
        </div>
      </div>

      {currentStep === 1 ? (
        <Step1Combined
          data={formData}
          updateData={updateFormData}
          onNext={handleStep1Next}
          loading={loading}
        />
      ) : (
        <Step2EmailVerification
          data={formData}
          updateData={updateFormData}
          onNext={() => {}}
          onBack={() => setCurrentStep(1)}
          onVerified={handleFinalSubmit}
          loading={loading}
          submitting={submitting}
        />
      )}

      {currentStep === 1 && (
        <p className="text-center text-sm text-muted-foreground">
          {t('signup_have_account')}{' '}
          <button
            type="button"
            onClick={onSwitchToLogin}
            className="text-primary hover:underline font-medium"
          >
            تسجيل الدخول
          </button>
        </p>
      )}
    </div>
  );
}
