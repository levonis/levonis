import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff } from 'lucide-react';
import { z } from 'zod';
import EmailVerificationDialog from '@/components/auth/EmailVerificationDialog';
import MultiStepSignup from '@/components/auth/signup/MultiStepSignup';

const signInSchema = z.object({
  email: z.string().email({ message: 'بريد إلكتروني غير صحيح' }),
  password: z.string().min(6, { message: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل' }),
});

const Auth = () => {
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resendTimer, setResendTimer] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const [showVerificationDialog, setShowVerificationDialog] = useState(false);
  const [verificationEmail, setVerificationEmail] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmNewPassword, setConfirmNewPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [showNewPasswordForm, setShowNewPasswordForm] = useState(false);
  const [showSignup, setShowSignup] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/');
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

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error('يرجى إدخال البريد الإلكتروني');
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      toast.error('بريد إلكتروني غير صحيح');
      return;
    }

    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('send-verification-code', {
        body: { 
          email: resetEmail, 
          type: 'password_reset'
        }
      });

      if (error) throw error;

      if (data.success) {
        setVerificationEmail(resetEmail);
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
    setShowNewPasswordForm(true);
    setShowVerificationDialog(false);
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
          {showNewPasswordForm ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">تعيين كلمة مرور جديدة</h2>
                <p className="text-sm text-muted-foreground">
                  تم التحقق من بريدك. أدخل كلمة المرور الجديدة
                </p>
              </div>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password">كلمة المرور الجديدة</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                  <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password">تأكيد كلمة المرور</Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="pl-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  disabled={loading}
                >
                  {loading && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                  تغيير كلمة المرور
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full"
                  onClick={() => {
                    setShowNewPasswordForm(false);
                    setShowResetPassword(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  disabled={loading}
                >
                  إلغاء
                </Button>
              </form>
            </div>
          ) : showResetPassword ? (
            <div>
              <div className="mb-6">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">إعادة تعيين كلمة المرور</h2>
                <p className="text-sm text-muted-foreground">
                  أدخل بريدك الإلكتروني لإرسال رمز التحقق
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
                  {resendTimer > 0 ? `إعادة الإرسال بعد ${resendTimer}ث` : 'إرسال رمز التحقق'}
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
          ) : showSignup ? (
            <MultiStepSignup onSwitchToLogin={() => setShowSignup(false)} />
          ) : (
            <div>
              <div className="mb-6 text-center">
                <h2 className="text-2xl font-black text-gradient-gold mb-2">تسجيل الدخول</h2>
                <p className="text-sm text-muted-foreground">أدخل بيانات حسابك</p>
              </div>
              
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
                  className="w-full text-sm text-muted-foreground hover:text-primary"
                  onClick={() => setShowResetPassword(true)}
                  disabled={loading}
                >
                  هل نسيت كلمة المرور؟
                </Button>
              </form>

              <div className="mt-6 pt-4 border-t border-border/50 text-center">
                <p className="text-sm text-muted-foreground mb-3">ليس لديك حساب؟</p>
                <Button
                  type="button"
                  variant="outline"
                  className="w-full"
                  onClick={() => setShowSignup(true)}
                >
                  إنشاء حساب جديد
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Email Verification Dialog for Password Reset */}
      <EmailVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        email={verificationEmail}
        type="password_reset"
        onVerified={handleVerificationComplete}
      />
    </div>
  );
};

export default Auth;
