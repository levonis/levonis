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
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
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
  const [resetPhoneNumber, setResetPhoneNumber] = useState('');
  const [resetOtpCode, setResetOtpCode] = useState('');
  const [resetNewPassword, setResetNewPassword] = useState('');
  const [resetStep, setResetStep] = useState<'phone' | 'otp' | 'password'>('phone');
  const [otpCode, setOtpCode] = useState('');
  const [isOtpSent, setIsOtpSent] = useState(false);
  const [isVerified, setIsVerified] = useState(false);
  const [generatedOtp, setGeneratedOtp] = useState('');
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
    
    if (!phoneNumber.match(/^07[3-9]\d{8}$/)) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }
    
    if (!password) {
      toast.error('يرجى إدخال كلمة المرور');
      return;
    }

    setLoading(true);

    try {
      // البحث عن البريد الإلكتروني المرتبط برقم الهاتف
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone_number', phoneNumber)
        .maybeSingle();

      if (profileError || !profile?.email) {
        toast.error('رقم الهاتف غير مسجل');
        return;
      }
      
      const { error } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: password,
      });

      if (error) {
        if (error.message.includes('Invalid')) {
          toast.error('رقم الهاتف أو كلمة المرور غير صحيحة');
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
    if (!phoneNumber.match(/^07[3-9]\d{8}$/)) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setLoading(true);
    try {
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      
      const { data, error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { phoneNumber, otp }
      });

      if (error) {
        console.error('خطأ في إرسال OTP:', error);
        toast.error('حدث خطأ في إرسال كود التحقق');
        return;
      }

      toast.success('تم إرسال كود التحقق عبر الواتساب');
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
    if (otpCode !== generatedOtp) {
      toast.error('كود التحقق غير صحيح');
      return;
    }

    setIsVerified(true);
    toast.success('تم التحقق من رقم الهاتف بنجاح');
  };

  const handleFirstStep = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!isVerified) {
      toast.error('يرجى التحقق من رقم الهاتف أولاً');
      return;
    }

    if (!password || password.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
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
        password, 
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
      
      const { error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          emailRedirectTo: redirectUrl,
          data: {
            full_name: validatedData.fullName,
            username: validatedData.username,
            phone_number: validatedData.phoneNumber,
            governorate: validatedData.governorate,
          }
        }
      });

      if (error) {
        if (error.message.includes('already registered')) {
          toast.error('هذا البريد الإلكتروني مسجل بالفعل');
        } else {
          toast.error(error.message);
        }
        return;
      }

      // معالجة كود الدعوة إذا كان موجوداً
      if (referralCode) {
        try {
          const { data: { user: newUser } } = await supabase.auth.getUser();
          
          if (newUser) {
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
                  referred_user_id: newUser.id,
                  status: 'completed',
                  completed_at: new Date().toISOString(),
                })
                .eq('id', referralData.id);
            }
          }
        } catch (error) {
          console.error('Error processing referral:', error);
        }
      }

      toast.success('تم إنشاء الحساب بنجاح! يمكنك تسجيل الدخول الآن');
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
    if (!resetPhoneNumber.match(/^07[3-9]\d{8}$/)) {
      toast.error('يرجى إدخال رقم هاتف صحيح');
      return;
    }

    setLoading(true);
    try {
      // التحقق من وجود رقم الهاتف
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('phone_number')
        .eq('phone_number', resetPhoneNumber)
        .maybeSingle();

      if (profileError || !profile) {
        toast.error('رقم الهاتف غير مسجل');
        return;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      setGeneratedOtp(otp);
      
      const { error } = await supabase.functions.invoke('send-whatsapp-otp', {
        body: { phoneNumber: resetPhoneNumber, otp }
      });

      if (error) {
        toast.error('حدث خطأ في إرسال كود التحقق');
        return;
      }

      toast.success('تم إرسال كود التحقق عبر الواتساب');
      setResetStep('otp');
      setResendTimer(60);
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyResetOtp = async () => {
    if (resetOtpCode !== generatedOtp) {
      toast.error('كود التحقق غير صحيح');
      return;
    }

    setResetStep('password');
    toast.success('تم التحقق بنجاح');
  };

  const handleResetPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!resetNewPassword || resetNewPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    setLoading(true);
    try {
      // البحث عن البريد الإلكتروني المرتبط برقم الهاتف
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('email')
        .eq('phone_number', resetPhoneNumber)
        .maybeSingle();

      if (profileError || !profile?.email) {
        toast.error('حدث خطأ، يرجى المحاولة مرة أخرى');
        return;
      }

      // تحديث كلمة المرور عبر Edge Function
      const { error } = await supabase.functions.invoke('reset-password', {
        body: { 
          email: profile.email, 
          newPassword: resetNewPassword 
        }
      });

      if (error) {
        toast.error('حدث خطأ في تحديث كلمة المرور');
        return;
      }

      toast.success('تم تحديث كلمة المرور بنجاح');
      setShowResetPassword(false);
      setResetPhoneNumber('');
      setResetOtpCode('');
      setResetNewPassword('');
      setResetStep('phone');
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
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
          {showResetPassword ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">إعادة تعيين كلمة المرور</h2>
                <p className="text-sm text-muted-foreground">
                  {resetStep === 'phone' && 'أدخل رقم هاتفك لإرسال كود التحقق'}
                  {resetStep === 'otp' && 'أدخل كود التحقق المرسل'}
                  {resetStep === 'password' && 'أدخل كلمة المرور الجديدة'}
                </p>
              </div>
              
              {resetStep === 'phone' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-phone">رقم الهاتف</Label>
                    <Input
                      id="reset-phone"
                      type="tel"
                      placeholder="07XXXXXXXXX"
                      value={resetPhoneNumber}
                      onChange={(e) => setResetPhoneNumber(e.target.value)}
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
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إرسال كود التحقق'}
                  </Button>
                  
                  <Button 
                    type="button"
                    variant="ghost"
                    className="w-full"
                    onClick={() => {
                      setShowResetPassword(false);
                      setResetPhoneNumber('');
                      setResetStep('phone');
                    }}
                    disabled={loading}
                  >
                    العودة لتسجيل الدخول
                  </Button>
                </div>
              )}

              {resetStep === 'otp' && (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>كود التحقق</Label>
                    <div className="flex justify-center">
                      <InputOTP
                        maxLength={6}
                        value={resetOtpCode}
                        onChange={(value) => setResetOtpCode(value)}
                        disabled={loading}
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
                    </div>
                  </div>

                  <Button 
                    type="button"
                    onClick={handleVerifyResetOtp}
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading || resetOtpCode.length !== 6}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    التحقق من الكود
                  </Button>

                  <Button 
                    type="button"
                    onClick={handleSendResetOtp}
                    variant="ghost"
                    className="w-full"
                    disabled={loading || resendTimer > 0}
                  >
                    {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إعادة إرسال الكود'}
                  </Button>
                </div>
              )}

              {resetStep === 'password' && (
                <form onSubmit={handleResetPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="reset-new-password">كلمة المرور الجديدة</Label>
                    <Input
                      id="reset-new-password"
                      type="password"
                      placeholder="********"
                      value={resetNewPassword}
                      onChange={(e) => setResetNewPassword(e.target.value)}
                      disabled={loading}
                    />
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    disabled={loading}
                  >
                    {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                    تحديث كلمة المرور
                  </Button>
                </form>
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
                    <Label htmlFor="signin-phone">رقم الهاتف</Label>
                    <Input
                      id="signin-phone"
                      type="tel"
                      placeholder="07XXXXXXXXX"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
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
                    className="w-full text-sm text-muted-foreground hover:text-primary"
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
                    <Label htmlFor="signup-phone-step1">رقم الهاتف *</Label>
                    <div className="flex gap-2">
                      <Input
                        id="signup-phone-step1"
                        type="tel"
                        placeholder="07XXXXXXXXX"
                        value={phoneNumber}
                        onChange={(e) => {
                          setPhoneNumber(e.target.value);
                          setIsOtpSent(false);
                          setIsVerified(false);
                          setOtpCode('');
                        }}
                        dir="ltr"
                        required
                        disabled={loading || isVerified}
                        className={isVerified ? 'bg-muted' : ''}
                        maxLength={11}
                      />
                      {!isVerified && (
                        <Button
                          type="button"
                          onClick={handleSendOtp}
                          disabled={loading || !phoneNumber || resendTimer > 0}
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
                          disabled={loading}
                          variant="ghost"
                          size="sm"
                          className="text-xs"
                        >
                          إعادة إرسال الكود
                        </Button>
                      </div>
                      <p className="text-xs text-muted-foreground text-center">
                        تم إرسال كود التحقق المكون من 6 أرقام
                      </p>
                    </div>
                  )}

                  {isVerified && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="signup-password-step1">كلمة المرور *</Label>
                        <Input
                          id="signup-password-step1"
                          type="password"
                          placeholder="••••••••"
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          required
                          disabled={loading}
                          minLength={6}
                        />
                        <p className="text-xs text-muted-foreground">6 أحرف على الأقل</p>
                      </div>

                      <Button 
                        type="submit" 
                        className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                        disabled={loading || !password}
                      >
                        {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                        التالي - أكمل التفاصيل
                      </Button>
                    </>
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