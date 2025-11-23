import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { InputOTP, InputOTPGroup, InputOTPSlot } from '@/components/ui/input-otp';
import { toast } from 'sonner';
import { Loader2 } from 'lucide-react';
import { z } from 'zod';

const IRAQI_GOVERNORATES = [
  'بغداد',
  'البصرة',
  'نينوى',
  'أربيل',
  'النجف',
  'كربلاء',
  'بابل',
  'الأنبار',
  'ديالى',
  'ذي قار',
  'المثنى',
  'القادسية',
  'ميسان',
  'واسط',
  'صلاح الدين',
  'كركوك',
  'السليمانية',
  'دهوك',
];

const signInSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});

const signUpSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
  fullName: z.string().min(1, { message: 'الاسم الكامل مطلوب' }),
  username: z.string()
    .min(3, { message: 'اسم المستخدم يجب أن يكون 3 أحرف على الأقل' })
    .max(20, { message: 'اسم المستخدم يجب أن لا يتجاوز 20 حرف' })
    .regex(/^[a-zA-Z0-9_]+$/, { message: 'اسم المستخدم يجب أن يحتوي على أحرف وأرقام فقط' }),
  phoneNumber: z.string().regex(/^07[3-9]\d{8}$/, { message: 'رقم الهاتف يجب أن يبدأ بـ 07 ويتكون من 11 رقماً' }),
  governorate: z.string().min(1, { message: 'المحافظة مطلوبة' }),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetStep, setResetStep] = useState<'email' | 'otp'>('email');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [signupStep, setSignupStep] = useState<'verification' | 'details'>('verification');
  const [resendTimer, setResendTimer] = useState(0);
  const [showMagicLink, setShowMagicLink] = useState(false);
  const [magicLinkEmail, setMagicLinkEmail] = useState('');
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
    
    // التحقق من كود الدعوة في URL
    const urlParams = new URLSearchParams(window.location.search);
    const refCode = urlParams.get('ref');
    if (refCode) {
      setReferralCode(refCode);
    }
  }, [user, navigate]);

  useEffect(() => {
    if (resendTimer > 0) {
      const timer = setTimeout(() => setResendTimer(resendTimer - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [resendTimer]);

  const handleSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }
    
    if (!password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email: email,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid')) {
          toast.error('البريد الإلكتروني أو كلمة المرور غير صحيحة');
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success('تم تسجيل الدخول بنجاح');
      navigate('/');
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOtp = async () => {
    if (!email) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: false,
        }
      });

      if (error) {
        console.error('خطأ في إرسال OTP:', error);
        toast.error('حدث خطأ في إرسال كود التحقق');
        return;
      }

      toast.success('تم إرسال كود التحقق إلى بريدك الإلكتروني');
      setIsOtpSent(true);
      setResendTimer(120);
    } catch (error) {
      console.error('خطأ في إرسال OTP:', error);
      toast.error('حدث خطأ في إرسال كود التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length !== 6) {
      toast.error('يرجى إدخال كود التحقق المكون من 6 أرقام');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: 'email'
      });

      if (error) {
        toast.error('كود التحقق غير صحيح');
        return;
      }

      setIsVerified(true);
      toast.success('تم التحقق من البريد الإلكتروني بنجاح');
    } catch (error) {
      toast.error('حدث خطأ في التحقق');
    } finally {
      setLoading(false);
    }
  };

  const handleFirstStep = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isVerified) {
      toast.error('يرجى التحقق من البريد الإلكتروني أولاً');
      return;
    }

    setSignupStep('details');
  };

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      const validatedData = signUpSchema.parse({ 
        email, 
        fullName, 
        username,
        phoneNumber,
        governorate
      });
      
      // Check if username is available
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .eq('username', validatedData.username)
        .maybeSingle();

      if (existingProfile) {
        toast.error('اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر');
        return;
      }
      
      const redirectUrl = `${window.location.origin}/`;
      
      // Update the user metadata since they're already signed in via OTP
      const { data: { user: currentUser }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !currentUser) {
        toast.error('حدث خطأ في التحقق من الحساب');
        return;
      }

      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: validatedData.fullName,
          username: validatedData.username,
          phone_number: validatedData.phoneNumber,
          governorate: validatedData.governorate,
        }
      });

      if (updateError) {
        toast.error('حدث خطأ في حفظ البيانات');
        return;
      }

      // معالجة كود الدعوة إذا كان موجوداً
      if (referralCode) {
        try {
          // التحقق من صحة كود الدعوة
          const { data: referralData } = await supabase
            .from('user_referrals')
            .select('referrer_user_id, id')
            .eq('referral_code', referralCode)
            .eq('status', 'pending')
            .maybeSingle();

          if (referralData) {
            // تحديث حالة الدعوة
            await supabase
              .from('user_referrals')
              .update({
                referred_user_id: currentUser.id,
                status: 'completed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', referralData.id);
          }
        } catch (error) {
          console.error('Error processing referral:', error);
        }
      }

      toast.success('تم إنشاء الحساب بنجاح!');
      navigate('/');
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
      } else {
        toast.error('حدث خطأ غير متوقع');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetOtp = async () => {
    if (!resetEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
        redirectTo: `${window.location.origin}/auth`,
      });

      if (error) {
        toast.error('حدث خطأ في إرسال رابط إعادة تعيين كلمة المرور');
        return;
      }

      toast.success('تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني');
      setResetStep('otp');
      setResendTimer(120);
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleMagicLinkSignIn = async () => {
    if (!magicLinkEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOtp({
        email: magicLinkEmail,
        options: {
          emailRedirectTo: `${window.location.origin}/`,
        }
      });

      if (error) {
        console.error('خطأ في إرسال Magic Link:', error);
        toast.error('حدث خطأ في إرسال رابط تسجيل الدخول');
        return;
      }

      toast.success('تم إرسال رابط تسجيل الدخول إلى بريدك الإلكتروني');
      setMagicLinkSent(true);
      setResendTimer(120);
    } catch (error) {
      console.error('خطأ في إرسال Magic Link:', error);
      toast.error('حدث خطأ في إرسال رابط تسجيل الدخول');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/`,
          queryParams: {
            access_type: 'offline',
            prompt: 'consent',
          }
        }
      });

      if (error) {
        console.error('خطأ في تسجيل الدخول عبر Google:', error);
        toast.error('حدث خطأ في تسجيل الدخول عبر Google');
        return;
      }
    } catch (error) {
      console.error('خطأ في تسجيل الدخول عبر Google:', error);
      toast.error('حدث خطأ في تسجيل الدخول عبر Google');
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-background/90 backdrop-blur-md relative overflow-hidden flex items-center justify-center p-4">
      {/* Decorative frame - Full screen */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: 'url(/images/decorative-frame-new.webp)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      
      {/* Elegant decorative frame */}
      <div className="fixed inset-0 pointer-events-none">
        <svg className="absolute top-0 right-0 w-96 h-96 opacity-10" viewBox="0 0 200 200">
          <path d="M10,10 Q50,10 50,50 L50,150 Q50,190 90,190" 
                stroke="hsl(var(--ring) / 0.5)" strokeWidth="1" fill="none" />
        </svg>
        <svg className="absolute bottom-0 left-0 w-80 h-80 opacity-10" viewBox="0 0 200 200">
          <circle cx="100" cy="100" r="70" stroke="hsl(var(--primary) / 0.4)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-gradient-gold mb-2">LEVONIS</h1>
          <p className="text-muted-foreground">مرحباً بك في متجرنا</p>
        </div>

        <div className="glass-effect rounded-2xl p-6 border border-border/50 shadow-2xl">
          {showMagicLink ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">تسجيل دخول سريع</h2>
                <p className="text-sm text-muted-foreground">
                  {!magicLinkSent 
                    ? 'سنرسل لك رابط تسجيل دخول مباشر بدون كلمة مرور' 
                    : 'تحقق من بريدك الإلكتروني واضغط على الرابط لتسجيل الدخول'}
                </p>
              </div>
              
              {!magicLinkSent ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="magic-link-email">البريد الإلكتروني</Label>
                    <Input
                      id="magic-link-email"
                      type="email"
                      placeholder="example@email.com"
                      value={magicLinkEmail}
                      onChange={(e) => setMagicLinkEmail(e.target.value)}
                      dir="ltr"
                      disabled={loading}
                    />
                  </div>

                  <Button 
                    type="button"
                    onClick={handleMagicLinkSignIn}
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading || resendTimer > 0}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إرسال رابط تسجيل الدخول'}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowMagicLink(false);
                      setMagicLinkEmail('');
                      setMagicLinkSent(false);
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg border border-primary/20">
                    <div className="flex flex-col items-center gap-3 text-center">
                      <div className="p-3 bg-primary/10 rounded-full">
                        <svg className="w-8 h-8 text-primary" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </div>
                      <p className="text-sm font-medium">
                        تم إرسال رابط تسجيل الدخول!
                      </p>
                      <p className="text-xs text-muted-foreground">
                        تحقق من صندوق الوارد في <span className="font-semibold text-foreground">{magicLinkEmail}</span> واضغط على الرابط لتسجيل الدخول تلقائياً
                      </p>
                    </div>
                  </div>

                  <Button 
                    type="button"
                    onClick={handleMagicLinkSignIn}
                    variant="outline"
                    className="w-full"
                    disabled={loading || resendTimer > 0}
                  >
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الرابط'}
                  </Button>

                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowMagicLink(false);
                      setMagicLinkEmail('');
                      setMagicLinkSent(false);
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              )}
            </div>
          ) : showResetPassword ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">إعادة تعيين كلمة المرور</h2>
                <p className="text-sm text-muted-foreground">
                  {resetStep === 'email' && 'أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين'}
                  {resetStep === 'otp' && 'تحقق من بريدك الإلكتروني واتبع الرابط المرسل'}
                </p>
              </div>
              
              {resetStep === 'email' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-email">البريد الإلكتروني</Label>
                    <Input
                      id="reset-email"
                      type="email"
                      placeholder="example@email.com"
                      value={resetEmail}
                      onChange={(e) => setResetEmail(e.target.value)}
                      dir="ltr"
                      disabled={loading}
                    />
                  </div>

                  <Button 
                    type="button"
                    onClick={handleSendResetOtp}
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading || resendTimer > 0}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إرسال رابط إعادة التعيين'}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetEmail('');
                      setResetStep('email');
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              )}

              {resetStep === 'otp' && (
                <div className="space-y-4">
                  <div className="p-4 bg-muted rounded-lg">
                    <p className="text-sm text-center">
                      تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني. يرجى التحقق من صندوق الوارد الخاص بك واتباع التعليمات.
                    </p>
                  </div>

                  <Button 
                    type="button"
                    onClick={handleSendResetOtp}
                    variant="outline"
                    className="w-full"
                    disabled={loading || resendTimer > 0}
                  >
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الرابط'}
                  </Button>

                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetEmail('');
                      setResetStep('email');
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <Tabs defaultValue="signin" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="signin">تسجيل الدخول</TabsTrigger>
                <TabsTrigger value="signup">إنشاء حساب</TabsTrigger>
              </TabsList>

              <TabsContent value="signin">
                <form onSubmit={handleSignIn} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signin-email">البريد الإلكتروني</Label>
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="example@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signin-password">كلمة المرور</Label>
                    <Input
                      id="signin-password"
                      type="password"
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تسجيل الدخول
                  </Button>

                  <div className="relative my-4">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t border-border" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">أو</span>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full border-2 hover:bg-accent/10"
                      onClick={handleGoogleSignIn}
                      disabled={loading}
                    >
                      <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24">
                        <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                        <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                        <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                        <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                      </svg>
                      تسجيل الدخول عبر Google
                    </Button>

                    <Button 
                      type="button"
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowMagicLink(true)}
                      disabled={loading}
                    >
                      <svg className="ml-2 h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                      </svg>
                      تسجيل دخول سريع (بدون كلمة مرور)
                    </Button>
                  </div>

                  <Button 
                    type="button"
                    variant="link"
                    className="w-full text-sm text-muted-foreground hover:text-primary mt-2"
                    onClick={() => setShowResetPassword(true)}
                    disabled={loading}
                  >
                    هل نسيت كلمة المرور؟
                  </Button>
                </form>
              </TabsContent>

            <TabsContent value="signup">
              <div className="space-y-4 mb-6">
                <Button 
                  type="button"
                  variant="outline"
                  className="w-full border-2 hover:bg-accent/10"
                  onClick={handleGoogleSignIn}
                  disabled={loading}
                >
                  <svg className="ml-2 h-5 w-5" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  إنشاء حساب عبر Google
                </Button>

                <div className="relative">
                  <div className="absolute inset-0 flex items-center">
                    <span className="w-full border-t border-border" />
                  </div>
                  <div className="relative flex justify-center text-xs uppercase">
                    <span className="bg-background px-2 text-muted-foreground">أو</span>
                  </div>
                </div>
              </div>

              {signupStep === 'verification' ? (
                <form onSubmit={handleFirstStep} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="signup-email-step1">البريد الإلكتروني *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="signup-email-step1"
                        type="email"
                        placeholder="example@email.com"
                        value={email}
                        onChange={(e) => {
                          setEmail(e.target.value);
                          setIsOtpSent(false);
                          setIsVerified(false);
                          setOtpCode('');
                        }}
                        dir="ltr"
                        required
                        disabled={loading || isVerified}
                        className={isVerified ? 'bg-muted' : ''}
                      />
                      {!isVerified && (
                        <Button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || !email || resendTimer > 0}
                          variant="outline"
                          className="whitespace-nowrap"
                        >
                          {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                          {resendTimer > 0 ? `${resendTimer}ث` : isOtpSent ? 'إعادة إرسال' : 'إرسال كود'}
                        </Button>
                      )}
                    </div>
                  </div>

                  {isOtpSent && !isVerified && (
                    <div className="space-y-2">
                      <Label htmlFor="otp-input">كود التحقق</Label>
                      <div className="flex flex-col items-center gap-3">
                        <InputOTP
                          maxLength={6}
                          value={otpCode}
                          onChange={setOtpCode}
                        >
                          <InputOTPGroup>
                            <InputOTPSlot index={0} />
                            <InputOTPSlot index={1} />
                            <InputOTPSlot index={2} />
                            <InputOTPSlot index={3} />
                            <InputOTPSlot index={4} />
                            <InputOTPSlot index={5} />
                          </InputOTPGroup>
                        </InputOTP>
                        <Button
                          type="button"
                          onClick={handleVerifyOtp}
                          disabled={loading || otpCode.length !== 6}
                          className="w-full"
                        >
                          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تحقق من الكود'}
                        </Button>
                        <Button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || resendTimer > 0}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        >
                          {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الكود'}
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        تم إرسال كود التحقق إلى بريدك الإلكتروني
                      </p>
                    </div>
                  )}

                  {isVerified && (
                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                        disabled={loading}
                      >
                        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        التالي - أكمل التفاصيل
                      </Button>
                  )}
                </form>
              ) : (
                <form onSubmit={handleSignUp} className="space-y-4">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setSignupStep('verification')}
                    className="mb-2"
                    disabled={loading}
                  >
                    ← العودة
                  </Button>

                  <div className="space-y-2">
                    <Label htmlFor="signup-name">الاسم الكامل *</Label>
                    <Input
                      id="signup-name"
                      type="text"
                      placeholder="محمد أحمد"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-username">اسم المستخدم *</Label>
                    <Input
                      id="signup-username"
                      type="text"
                      placeholder="user123"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      required
                      disabled={loading}
                      maxLength={20}
                    />
                    <p className="text-xs text-muted-foreground">اسم فريد يظهر في التقييمات والتعليقات</p>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-email-step2">البريد الإلكتروني *</Label>
                    <Input
                      id="signup-email-step2"
                      type="email"
                      placeholder="your@email.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      disabled={loading}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-governorate">المحافظة *</Label>
                    <Select 
                      value={governorate} 
                      onValueChange={setGovernorate}
                      disabled={loading}
                      required
                    >
                      <SelectTrigger id="signup-governorate">
                        <SelectValue placeholder="اختر المحافظة" />
                      </SelectTrigger>
                      <SelectContent>
                        {IRAQI_GOVERNORATES.map((gov) => (
                          <SelectItem key={gov} value={gov}>
                            {gov}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="signup-referral">كود الدعوة (اختياري)</Label>
                    <Input
                      id="signup-referral"
                      type="text"
                      placeholder="REF-XXXXXXXX"
                      value={referralCode}
                      onChange={(e) => setReferralCode(e.target.value.toUpperCase())}
                      disabled={loading}
                    />
                    <p className="text-xs text-muted-foreground">
                      إذا كان لديك كود دعوة من صديق، أدخله هنا للحصول على مكافآت إضافية
                    </p>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    إنشاء حساب
                  </Button>
                </form>
              )}
            </TabsContent>
            </Tabs>
          )}
        </div>
      </div>
    </div>
  );
};

export default Auth;