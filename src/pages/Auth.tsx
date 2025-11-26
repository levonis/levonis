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
      // إرسال OTP كرمز مكون من 6 أرقام
      const { error } = await supabase.auth.signInWithOtp({
        email: email,
        options: {
          shouldCreateUser: true,
          emailRedirectTo: `${window.location.origin}/`
        }
      });

      if (error) {
        console.error('خطأ في إرسال OTP:', error);
        toast.error('حدث خطأ في إرسال كود التحقق');
        return;
      }

      toast.success('تم إرسال كود التحقق المكون من 6 أرقام إلى بريدك الإلكتروني');
      setIsOtpSent(true);
      setResendTimer(60);
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
      // التحقق من كود OTP
      const { data, error } = await supabase.auth.verifyOtp({
        email: email,
        token: otpCode,
        type: 'email'
      });

      if (error) {
        toast.error('كود التحقق غير صحيح أو منتهي الصلاحية');
        return;
      }

      if (data.user) {
        setIsVerified(true);
        toast.success('تم التحقق من البريد الإلكتروني بنجاح');
      }
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



  return (
    <div className="min-h-screen bg-background/90 backdrop-blur-md relative overflow-hidden flex items-center justify-center p-4">
      
      <div className="w-full max-w-md relative z-10">
        <div className="text-center mb-8">
          <h1 className="text-4xl font-black text-gradient-gold mb-2">LEVONIS</h1>
          <p className="text-muted-foreground">مرحباً بك في متجرنا</p>
        </div>

        <div className="glass-effect rounded-2xl p-6 border border-border/50 shadow-2xl">
          {showResetPassword ? (
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