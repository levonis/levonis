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
import EmailVerificationDialog from '@/components/auth/EmailVerificationDialog';
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
  const [showEmailVerification, setShowEmailVerification] = useState(false);
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
      // Check if username is already taken
      const { data: existingUsername } = await supabase
        .from('profiles')
        .select('id')
        .ilike('username', formData.username.trim())
        .maybeSingle();

      if (existingUsername) {
        toast.error('اسم المستخدم مأخوذ بالفعل. اختر اسماً آخر.');
        setLoading(false);
        return;
      }

      // Go to verification step
      setCurrentStep(3);
    } catch (error) {
      console.error('Username check error:', error);
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const uploadAvatarIfNeeded = async (userId: string, avatarUrl: string): Promise<string | null> => {
    if (!avatarUrl || !avatarUrl.startsWith('data:')) {
      return avatarUrl || null;
    }
    try {
      const response = await fetch(avatarUrl);
      const blob = await response.blob();
      const ext = blob.type === 'image/png' ? 'png' : 'jpg';
      const filePath = `${userId}/avatar.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, blob, { upsert: true, contentType: blob.type });

      if (uploadError) {
        console.error('Avatar upload error:', uploadError);
        return null;
      }

      const { data: publicData } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      return publicData.publicUrl;
    } catch (err) {
      console.error('Avatar upload failed:', err);
      return null;
    }
  };

  // Create account ONLY at final step
  const handleFinalSubmit = async () => {
    setSubmitting(true);
    try {
      // Prepare avatar: don't send base64 in metadata
      const isBase64Avatar = formData.avatarUrl?.startsWith('data:');
      const metadataAvatar = isBase64Avatar ? '' : formData.avatarUrl;

      const { data, error } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            full_name: formData.fullName,
            username: formData.username,
            avatar_url: metadataAvatar,
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

      // Ensure we have a session for RLS-protected operations
      if (!data.session) {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: formData.email,
          password: formData.password,
        });
        if (signInError) {
          console.error('Auto sign-in failed:', signInError);
          toast.error('تم إنشاء الحساب لكن فشل تسجيل الدخول التلقائي. يرجى تسجيل الدخول يدوياً.');
          navigate('/');
          return;
        }
      }

      // Upload avatar if base64
      if (isBase64Avatar && formData.avatarUrl) {
        const publicUrl = await uploadAvatarIfNeeded(userId, formData.avatarUrl);
        if (publicUrl) {
          await supabase.from('profiles').update({ avatar_url: publicUrl }).eq('id', userId);
        }
      }

      // Update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .update({ email_verified: true })
        .eq('id', userId);
      if (profileError) console.error('Profile update error:', profileError);

      // Update optional info
      const updateData: any = {
        phone: formData.phone || null,
        instagram_handle: formData.socialLinks.instagram || null,
        whatsapp_number: formData.socialLinks.whatsapp || null,
        facebook_handle: formData.socialLinks.facebook || null,
      };

      const hasData = Object.values(updateData).some(v => v !== null);
      if (hasData) {
        const { error: optionalError } = await supabase
          .from('profiles')
          .update(updateData)
          .eq('id', userId);
        if (optionalError) console.error('Optional info update error:', optionalError);
      }

      // Create address if provided
      if (formData.address.governorate) {
        const { error: addressError } = await supabase
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
        if (addressError) console.error('Address insert error:', addressError);
      }

      // Process referral code
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
        } catch (err) {
          console.error('Error processing referral:', err);
        }
      }

      toast.success('تم إنشاء حسابك بنجاح! مرحباً بك في عائلة ليفو 🎉');
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
          <div className="space-y-6 text-center py-8">
            <div className="space-y-2">
              <h3 className="text-lg font-bold">التحقق من البريد الإلكتروني</h3>
              <p className="text-sm text-muted-foreground">
                يرجى التحقق من بريدك الإلكتروني لتأكيد حسابك
              </p>
              <p className="text-sm font-medium" dir="ltr">{formData.email}</p>
            </div>
            {emailVerified ? (
              <div className="flex flex-col items-center gap-3">
                <div className="h-16 w-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                  <span className="text-emerald-500 text-2xl">✓</span>
                </div>
                <p className="text-emerald-500 font-bold">تم التحقق بنجاح!</p>
                <button
                  onClick={() => setCurrentStep(4)}
                  className="mt-4 px-6 py-2 rounded-xl bg-primary text-primary-foreground font-bold"
                >
                  التالي
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-4">
                <button
                  onClick={() => setShowEmailVerification(true)}
                  className="px-6 py-3 rounded-xl bg-primary text-primary-foreground font-bold"
                >
                  إرسال رمز التحقق
                </button>
                <button
                  onClick={() => setCurrentStep(2)}
                  className="text-sm text-muted-foreground hover:text-foreground"
                >
                  رجوع
                </button>
              </div>
            )}
          </div>
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

      <EmailVerificationDialog
        open={showEmailVerification}
        onOpenChange={setShowEmailVerification}
        email={formData.email}
        type="signup"
        onVerified={() => {
          setEmailVerified(true);
          setShowEmailVerification(false);
          setCurrentStep(4);
        }}
      />
    </div>
  );
}
