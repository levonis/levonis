import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import StepIndicator from './StepIndicator';
import Step1Account from './Step1Account';
import Step2Profile from './Step2Profile';
import Step3Verification from './Step3Verification';
import Step4OptionalInfo from './Step4OptionalInfo';
import Step5Review from './Step5Review';
import { SignupFormData, initialFormData } from './types';

const STEP_LABELS = ['الحساب', 'الملف', 'التحقق', 'إضافية', 'مراجعة'];

interface MultiStepSignupProps {
  onSwitchToLogin: () => void;
}

export default function MultiStepSignup({ onSwitchToLogin }: MultiStepSignupProps) {
  const [currentStep, setCurrentStep] = useState(1);
  const [formData, setFormData] = useState<SignupFormData>(initialFormData);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [emailVerified, setEmailVerified] = useState(false);
  const navigate = useNavigate();

  const updateFormData = (updates: Partial<SignupFormData>) => {
    setFormData(prev => ({ ...prev, ...updates }));
  };

  const handleStep1Complete = async () => {
    setLoading(true);
    try {
      // Check if email is already registered using profiles table
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', formData.email.trim().toLowerCase())
        .maybeSingle();

      if (existingProfile) {
        toast.error('هذا البريد الإلكتروني مسجل بالفعل. يرجى تسجيل الدخول.');
        return;
      }
    } catch (error: any) {
      // If profiles check fails, continue anyway - will be caught at signup
      console.warn('Email check failed, continuing:', error?.message);
    }
    
    setLoading(false);
    setCurrentStep(2);
  };

  const handleStep2Complete = async () => {
    setLoading(true);
    try {
      // Send verification code WITHOUT creating account
      const { data: codeData, error: codeError } = await supabase.functions.invoke('send-verification-code', {
        body: { 
          email: formData.email, 
          type: 'signup'
        }
      });

      if (codeError) {
        console.error('Error sending verification code:', codeError);
        toast.error('فشل إرسال رمز التحقق. حاول مرة أخرى');
        return;
      }

      toast.info('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
      setCurrentStep(3);
    } catch (error) {
      console.error('Verification code error:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  // After email verification, just mark as verified and proceed
  const handleVerificationComplete = async () => {
    setEmailVerified(true);
    toast.success('تم التحقق من بريدك بنجاح!');
    setCurrentStep(4);
  };

  // Create account ONLY at final step (Step 5)
  const handleFinalSubmit = async () => {
    if (!emailVerified) {
      toast.error('يجب تأكيد البريد الإلكتروني أولاً');
      setCurrentStep(3);
      return;
    }

    setSubmitting(true);
    try {
      // NOW create the account at the final step
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
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('هذا البريد الإلكتروني مسجل بالفعل');
          setCurrentStep(1);
        } else {
          toast.error(error.message);
        }
        return;
      }

      if (!data.user) {
        toast.error('فشل إنشاء الحساب');
        return;
      }

      const userId = data.user.id;

      // Update profile with email verified status
      await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', userId);

      // Update profile with additional info
      const updateData: any = {
        phone: formData.phone || null,
        instagram_handle: formData.socialLinks.instagram || null,
        whatsapp_number: formData.socialLinks.whatsapp || null,
        facebook_handle: formData.socialLinks.facebook || null,
      };

      const hasData = Object.values(updateData).some(v => v !== null);
      if (hasData) {
        await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId);
      }

      // Create address if provided
      if (formData.address.governorate) {
        await supabase
          .from('user_addresses')
          .insert({
            user_id: userId,
            full_name: formData.fullName,
            phone_number: formData.phone || '',
            governorate: formData.address.governorate,
            area: formData.address.city || formData.address.area || '',
            nearest_landmark: formData.address.nearestLandmark || '',
            is_default: true,
          });
      }

      // Process referral code if provided
      if (formData.referralCode) {
        try {
          const { data: referralData } = await supabase
            .from('user_referrals')
            .select('referrer_user_id, id')
            .eq('referral_code', formData.referralCode)
            .eq('status', 'pending')
            .maybeSingle();

          if (referralData) {
            await supabase
              .from('user_referrals')
              .update({
                referred_user_id: userId,
                status: 'completed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', referralData.id);
          }
        } catch (error) {
          console.error('Error processing referral:', error);
        }
      }

      toast.success('تم إنشاء حسابك بنجاح! مرحباً بك في ليفونيس 🎉');
      navigate('/');
    } catch (error) {
      console.error('Error completing signup:', error);
      toast.error('حدث خطأ أثناء إكمال التسجيل');
    } finally {
      setSubmitting(false);
    }
  };

  const goToStep = (step: number) => {
    if (step < currentStep) {
      setCurrentStep(step);
    }
  };

  const renderStep = () => {
    switch (currentStep) {
      case 1:
        return (
          <Step1Account
            data={formData}
            updateData={updateFormData}
            onNext={handleStep1Complete}
            loading={loading}
          />
        );
      case 2:
        return (
          <Step2Profile
            data={formData}
            updateData={updateFormData}
            onNext={handleStep2Complete}
            onBack={() => setCurrentStep(1)}
            loading={loading}
          />
        );
      case 3:
        return (
          <Step3Verification
            data={formData}
            updateData={updateFormData}
            onNext={() => setCurrentStep(4)}
            onBack={() => setCurrentStep(2)}
            loading={loading}
            userEmail={formData.email}
            onVerified={handleVerificationComplete}
          />
        );
      case 4:
        return (
          <Step4OptionalInfo
            data={formData}
            updateData={updateFormData}
            onNext={() => setCurrentStep(5)}
            onBack={() => setCurrentStep(3)}
            loading={loading}
          />
        );
      case 5:
        return (
          <Step5Review
            data={formData}
            updateData={updateFormData}
            onNext={() => {}}
            onBack={() => setCurrentStep(4)}
            onSubmit={handleFinalSubmit}
            loading={loading}
            submitting={submitting}
          />
        );
      default:
        return null;
    }
  };

  return (
    <div className="space-y-4">
      <StepIndicator
        currentStep={currentStep}
        totalSteps={5}
        labels={STEP_LABELS}
      />
      
      {renderStep()}
      
      {currentStep === 1 && (
        <p className="text-center text-sm text-muted-foreground">
          لديك حساب بالفعل؟{' '}
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
