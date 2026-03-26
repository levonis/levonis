import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Loader2, Eye, EyeOff, Mail, Lock, ArrowLeft, Sparkles } from 'lucide-react';
import { z } from 'zod';
import EmailVerificationDialog from '@/components/auth/EmailVerificationDialog';
import MultiStepSignup from '@/components/auth/signup/MultiStepSignup';
import { useLanguage } from '@/lib/i18n';

const extractFunctionErrorMessage = async (error: unknown): Promise<string | null> => {
  if (!error || typeof error !== 'object') return null;

  const functionError = error as {
    message?: string;
    context?: {
      clone?: () => { json?: () => Promise<any>; text?: () => Promise<string> };
    };
  };

  const responseClone = functionError.context?.clone?.();

  if (responseClone?.json) {
    try {
      const body = await responseClone.json();
      if (typeof body?.error === 'string' && body.error.trim()) return body.error;
      if (typeof body?.message === 'string' && body.message.trim()) return body.message;
    } catch {
      // Ignore JSON parsing errors and fall back to text/message parsing
    }
  }

  if (responseClone?.text) {
    try {
      const text = await responseClone.text();
      if (!text) return null;

      try {
        const parsed = JSON.parse(text);
        if (typeof parsed?.error === 'string' && parsed.error.trim()) return parsed.error;
        if (typeof parsed?.message === 'string' && parsed.message.trim()) return parsed.message;
      } catch {
        if (text.trim()) return text.trim();
      }
    } catch {
      // Ignore text parsing errors and fall back to generic message
    }
  }

  if (functionError.message && !functionError.message.includes('non-2xx')) {
    return functionError.message;
  }

  return null;
};

const isStrongPassword = (password: string) => {
  return password.length >= 8 && /[a-z]/.test(password) && /[A-Z]/.test(password) && /\d/.test(password);
};

const Auth = () => {
  const { t } = useLanguage();
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

  const signInSchema = z.object({
    email: z.string().email({ message: t('auth_invalid_email') }),
    password: z.string().min(6, { message: t('auth_password_min') }),
  });

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
          toast.error(t('auth_wrong_credentials'));
        } else {
          toast.error(error.message);
        }
        return;
      }

      toast.success(t('auth_login_success'));
      navigate('/');
    } catch (error) {
      toast.error(t('auth_unexpected_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleSendResetEmail = async () => {
    if (!resetEmail) {
      toast.error(t('auth_enter_email'));
      return;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(resetEmail)) {
      toast.error(t('auth_invalid_email'));
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
        toast.info(t('auth_code_sent'));
      } else {
        toast.error(data.error || t('auth_code_failed'));
      }
    } catch (error) {
      toast.error(t('auth_unexpected_error'));
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
    
    if (!isStrongPassword(newPassword)) {
      toast.error('كلمة المرور يجب أن تكون 8 أحرف على الأقل وتحتوي على حرف كبير وحرف صغير ورقم');
      return;
    }

    if (newPassword !== confirmNewPassword) {
      toast.error(t('auth_password_mismatch'));
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

      // Handle edge function errors - extract message from data or error
      if (error) {
        const errorMessage = (await extractFunctionErrorMessage(error)) || data?.error || t('auth_unexpected_error');
        toast.error(errorMessage);
        return;
      }

      if (data?.success) {
        toast.success(t('auth_password_changed'));
        setShowNewPasswordForm(false);
        setShowResetPassword(false);
        setResetEmail('');
        setNewPassword('');
        setConfirmNewPassword('');
      } else {
        toast.error(data?.error || t('auth_code_failed'));
      }
    } catch (error) {
      const errorMessage = await extractFunctionErrorMessage(error);
      toast.error(errorMessage || t('auth_unexpected_error'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 relative overflow-hidden flex items-center justify-center p-4">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-primary/10 rounded-full blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-accent/10 rounded-full blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-gradient-radial from-primary/5 to-transparent rounded-full" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4">
            <Sparkles className="w-8 h-8 text-primary mr-2" />
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-primary">LEV</span>
              <span className="text-foreground">ONIS</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">{t('auth_platform_desc')}</p>
        </div>

        {/* Main Card */}
        <div className="bg-card/80 backdrop-blur-xl rounded-3xl p-8 border border-border/50 shadow-2xl shadow-primary/5">
          {showNewPasswordForm ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                  <Lock className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{t('auth_new_password')}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('auth_new_password_desc')}
                </p>
              </div>
              
              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="new-password" className="text-sm font-medium">{t('auth_new_password')}</Label>
                  <div className="relative">
                    <Input
                      id="new-password"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 pl-12 bg-background/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showNewPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm-new-password" className="text-sm font-medium">{t('auth_confirm_password')}</Label>
                  <div className="relative">
                    <Input
                      id="confirm-new-password"
                      type={showConfirmPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={confirmNewPassword}
                      onChange={(e) => setConfirmNewPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 pl-12 bg-background/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <Button 
                  type="submit"
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/25"
                  disabled={loading}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {t('auth_confirm_change')}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full h-11"
                  onClick={() => {
                    setShowNewPasswordForm(false);
                    setShowResetPassword(false);
                    setNewPassword('');
                    setConfirmNewPassword('');
                  }}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  {t('common_cancel')}
                </Button>
              </form>
            </div>
          ) : showResetPassword ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-primary/10 mb-4">
                  <Mail className="w-7 h-7 text-primary" />
                </div>
                <h2 className="text-2xl font-bold">{t('auth_account_recovery')}</h2>
                <p className="text-sm text-muted-foreground mt-2">
                  {t('auth_recovery_desc')}
                </p>
              </div>
              
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="reset-email" className="text-sm font-medium">{t('auth_email')}</Label>
                  <Input
                    id="reset-email"
                    type="email"
                    placeholder="name@example.com"
                    value={resetEmail}
                    onChange={(e) => setResetEmail(e.target.value)}
                    dir="ltr"
                    disabled={loading}
                    className="h-12 bg-background/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 text-left"
                  />
                </div>

                <Button 
                  type="button"
                  onClick={handleSendResetEmail}
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/25"
                  disabled={loading || resendTimer > 0}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {resendTimer > 0 ? t('auth_resend_after', { seconds: resendTimer }) : t('auth_send_code')}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost"
                  className="w-full h-11"
                  onClick={() => {
                    setShowResetPassword(false);
                    setResetEmail('');
                  }}
                  disabled={loading}
                >
                  <ArrowLeft className="w-4 h-4 ml-2 rotate-180" />
                  {t('auth_back_to_login')}
                </Button>
              </div>
            </div>
          ) : showSignup ? (
            <MultiStepSignup onSwitchToLogin={() => setShowSignup(false)} />
          ) : (
            <div className="space-y-6">
              <div className="text-center">
                <h2 className="text-2xl font-bold">{t('auth_welcome_back')}</h2>
                <p className="text-sm text-muted-foreground mt-2">{t('auth_signin_desc')}</p>
              </div>
              
              <form onSubmit={handleSignIn} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="signin-email" className="text-sm font-medium">{t('auth_email')}</Label>
                  <div className="relative">
                    <Input
                      id="signin-email"
                      type="email"
                      placeholder="name@example.com"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      dir="ltr"
                      required
                      disabled={loading}
                      className="h-12 pr-12 bg-background/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20 text-left"
                    />
                    <Mail className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="signin-password" className="text-sm font-medium">{t('auth_password')}</Label>
                  <div className="relative">
                    <Input
                      id="signin-password"
                      type={showPassword ? "text" : "password"}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      disabled={loading}
                      className="h-12 px-12 bg-background/50 border-border/50 rounded-xl focus:ring-2 focus:ring-primary/20"
                    />
                    <Lock className="absolute right-4 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      tabIndex={-1}
                    >
                      {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                    </button>
                  </div>
                </div>

                <div className="flex justify-end">
                  <Button 
                    type="button"
                    variant="link"
                    className="text-xs text-muted-foreground hover:text-primary p-0 h-auto"
                    onClick={() => setShowResetPassword(true)}
                    disabled={loading}
                  >
                    {t('auth_forgot_password')}
                  </Button>
                </div>

                <Button 
                  type="submit" 
                  className="w-full h-12 bg-primary hover:bg-primary/90 text-primary-foreground font-bold rounded-xl transition-all shadow-lg shadow-primary/25"
                  disabled={loading}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {t('auth_login')}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="bg-card px-4 text-muted-foreground">{t('common_or')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full h-12 rounded-xl border-border/50 hover:bg-primary/5 hover:border-primary/50 transition-all"
                onClick={() => setShowSignup(true)}
              >
                {t('auth_create_account')}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                {t('auth_terms_agree')}{' '}
                <span className="text-primary underline cursor-pointer">{t('auth_terms')}</span>
                {' '}{t('common_or')}{' '}
                <span className="text-primary underline cursor-pointer">{t('auth_privacy')}</span>
              </p>
            </div>
          )}
        </div>
      </div>

      <EmailVerificationDialog
        open={showVerificationDialog}
        onOpenChange={setShowVerificationDialog}
        email={verificationEmail}
        type="password_reset"
        onVerified={handleVerificationComplete}
        autoSendOnOpen={false}
      />
    </div>
  );
};

export default Auth;
