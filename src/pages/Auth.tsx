import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import EmailVerificationDialog from '@/components/auth/EmailVerificationDialog';

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
  governorate: z.string().min(1, { message: 'المحافظة مطلوبة' }),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [governorate, setGovernorate] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showSignUpPassword, setShowSignUpPassword] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [verificationType, setVerificationType] = useState<'signup' | 'password_reset'>('signup');
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/');
    }
    
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
    
    try {
      signInSchema.parse({ email, password });
    } catch (error) {
      if (error instanceof z.ZodError) {
        toast.error(error.errors[0].message);
        return;
      }
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
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

  const handleSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setLoading(true);

    try {
      const validatedData = signUpSchema.parse({ 
        email, 
        password,
        fullName, 
        username,
        governorate
      });
      
      // Check if username is available (case-insensitive)
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', validatedData.username)
        .maybeSingle();

      if (existingProfile) {
        toast.error('اسم المستخدم مستخدم بالفعل، يرجى اختيار اسم آخر');
        setLoading(false);
        return;
      }
      
      const { data, error } = await supabase.auth.signUp({
        email: validatedData.email,
        password: validatedData.password,
        options: {
          data: {
            full_name: validatedData.fullName,
            username: validatedData.username,
            governorate: validatedData.governorate,
          },
          emailRedirectTo: `${window.location.origin}/`
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
      if (referralCode && data.user) {
        try {
          const { data: referralData } = await supabase
            .from('user_referrals')
            .select('referrer_user_id, id')
            .eq('referral_code', referralCode)
            .eq('status', 'pending')
            .maybeSingle();

          if (referralData) {
            await supabase
              .from('user_referrals')
              .update({
                referred_user_id: data.user.id,
                status: 'completed',
                completed_at: new Date().toISOString(),
              })
              .eq('id', referralData.id);
          }
        } catch (error) {
          console.error('Error processing referral:', error);
        }
      }

      // Send verification code
      if (data.user) {
        setPendingUserId(data.user.id);
        setVerificationEmail(validatedData.email);
        setVerificationType('signup');
        
        // Send verification code via our edge function
        const { data: codeData, error: codeError } = await supabase.functions.invoke('send-verification-code', {
          body: { 
            email: validatedData.email, 
            type: 'signup',
            user_id: data.user.id 
          }
        });

        if (codeError) {
          console.error('Error sending verification code:', codeError);
          toast.success('تم إنشاء الحساب! يرجى تأكيد بريدك الإلكتروني.');
          navigate('/');
        } else {
          setShowVerificationDialog(true);
          toast.info('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
        }
      } else {
        toast.success('تم إنشاء الحساب بنجاح!');
        navigate('/');
      }
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

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      toast.error('بريد إلكتروني غير صحيح');
      return;
    }

    setLoading(true);
    try {
      // Send verification code via our edge function
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { 
          email: resetEmail, 
          type: 'password_reset'
        }
      });

      if (error) throw error;

      if (data.success) {
        setVerificationEmail(resetEmail);
        setVerificationType('password_reset');
        setShowVerificationDialog(true);
        setResendTimer(60);
        toast.info('تم إرسال رمز التحقق إلى بريدك الإلكتروني');
      } else {
        toast.error(data.error || 'فشل في إرسال رمز التحقق');
      }
    } catch (error) {
      toast.error('حدث خطأ غير متوقع');
    } finally {
      setLoading(false);
    }
  };

  const handleVerificationComplete = async () => {
    if (verificationType === 'signup') {
      toast.success('تم تأكيد بريدك الإلكتروني! مرحباً بك في ليفونيس 🎉');
      navigate('/');
    } else if (verificationType === 'password_reset') {
      // After verification, show new password form
      setShowNewPasswordForm(true);
      setShowVerificationDialog(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (newPassword.length < 6) {
      toast.error('كلمة المرور يجب أن تكون 6 أحرف على الأقل');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error('كلمة المرور غير متطابقة');
      return;
    }

    setLoading(true);
    try {
      // Use Supabase admin to update password (requires edge function)
      const { data, error } = await supabase.functions.invoke('reset-password-with-code', {
        body: { 
          email: verificationEmail, 
          new_password: newPassword
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success('تم تغيير كلمة المرور بنجاح! يمكنك تسجيل الدخول الآن.');
        setShowNewPasswordForm(false);
        setShowResetPassword(false);
        setResetEmail('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(data.error || 'فشل في تغيير كلمة المرور');
      }
    } catch (error) {
      toast.error('حدث خطأ أثناء تغيير كلمة المرور');
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
                  أدخل بريدك الإلكتروني لإرسال رابط إعادة التعيين
                </p>
              </div>
              
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
                  onClick={handleSendResetEmail}
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
                  }}
                  disabled={loading}
                >
                  العودة لتسجيل الدخول
                </Button>
              </div>
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
                    <div className="relative">
                      <Input
                        id="signin-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
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
                <form onSubmit={handleSignUp} className="space-y-4">
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
                    <Label htmlFor="signup-email">البريد الإلكتروني *</Label>
                    <Input
                      id="signup-email"
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
                    <Label htmlFor="signup-password">كلمة المرور *</Label>
                    <div className="relative">
                      <Input
                        id="signup-password"
                        type={showSignUpPassword ? "text" : "password"}
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        disabled={loading}
                        className="pl-10"
                      />
                      <button
                        type="button"
                        onClick={() => setShowSignUpPassword(!showSignUpPassword)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                      >
                        {showSignUpPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
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
              </TabsContent>
            </Tabs>
          )}
        </div>
      </div>

      {/* Email Verification Dialog */}
      <EmailVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        email={verificationEmail}
        type={verificationType}
        userId={pendingUserId || undefined}
        onVerified={handleVerificationComplete}
      />

      {/* New Password Form Modal for password reset */}
      {showNewPasswordForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-background rounded-2xl p-6 w-full max-w-md border border-border shadow-2xl">
            <h2 className="text-xl font-bold text-center mb-4">تعيين كلمة مرور جديدة</h2>
            <p className="text-sm text-muted-foreground text-center mb-6">
              تم التحقق من بريدك الإلكتروني. الآن أدخل كلمة المرور الجديدة.
            </p>
            <form onSubmit={handleUpdatePassword} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                <Input
                  id="new-password"
                  type="password"
                  placeholder="••••••••"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
                <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirm-new-password">تأكيد كلمة المرور</Label>
                <Input
                  id="confirm-new-password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmNewPassword}
                  onChange={(e) => setConfirmNewPassword(e.target.value)}
                  required
                  disabled={loading}
                  minLength={6}
                />
              </div>
              <Button 
                type="submit" 
                className="w-full"
                disabled={loading}
              >
                {loading ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري التحديث...
                  </>
                ) : (
                  'تحديث كلمة المرور'
                )}
              </Button>
              <Button 
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => {
                  setShowNewPasswordForm(false);
                  setShowResetPassword(false);
                  setResetEmail('');
                  setNewPassword('');
                  setConfirmNewPassword('');
                }}
                disabled={loading}
              >
                إلغاء
              </Button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default Auth;
