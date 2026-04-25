import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { lovable } from '@/integrations/lovable';
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
import { Check, X } from 'lucide-react';

const PasswordRequirements = ({ password }: { password: string }) => {
  const { t } = useLanguage();
  const requirements = [
    { label: t('auth_pwd_min_chars'), met: password.length >= 8 },
    { label: t('auth_pwd_uppercase'), met: /[A-Z]/.test(password) },
    { label: t('auth_pwd_lowercase'), met: /[a-z]/.test(password) },
    { label: t('auth_pwd_digit'), met: /\d/.test(password) },
  ];

  if (!password) return null;

  return (
    <div className="space-y-1.5 pt-1">
      {requirements.map((req) => (
        <div key={req.label} className="flex items-center gap-2 text-xs">
          {req.met ? (
            <Check className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
          ) : (
            <X className="h-3.5 w-3.5 text-muted-foreground/50 shrink-0" />
          )}
          <span className={req.met ? 'text-emerald-500' : 'text-muted-foreground'}>{req.label}</span>
        </div>
      ))}
    </div>
  );
};

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
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      const result = await lovable.auth.signInWithOAuth('google', {
        redirect_uri: window.location.origin,
      });
      if (result.error) {
        toast.error('فشل تسجيل الدخول عبر Google');
        setGoogleLoading(false);
        return;
      }
      if (result.redirected) return;
      toast.success(t('auth_login_success'));
      navigate('/');
    } catch (err) {
      toast.error('فشل تسجيل الدخول عبر Google');
      setGoogleLoading(false);
    }
  };
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
      toast.error(t('auth_pwd_requirements'));
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

  // Shared glass styles
  const glassInput = "h-12 bg-white/5 dark:bg-white/5 border border-white/20 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all";
  const glassPrimaryBtn = "w-full h-12 rounded-2xl font-bold backdrop-blur-xl bg-gradient-to-br from-primary/90 to-primary/70 hover:from-primary hover:to-primary/80 text-primary-foreground border border-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.5),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]";
  const glassGhostBtn = "w-full h-11 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10 text-foreground/80 hover:text-foreground transition-all";
  const glassOutlineBtn = "w-full h-12 rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all hover:scale-[1.02] active:scale-[0.98]";
  const glassIconBox = "inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-primary/5 backdrop-blur-xl border border-white/20 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.15)] mb-4";

  return (
    <div className="min-h-screen bg-background relative overflow-hidden flex items-center justify-center p-4">
      {/* Glassmorphism background orbs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/30 blur-[120px] animate-pulse" />
        <div className="absolute top-1/3 -left-40 w-[26rem] h-[26rem] rounded-full bg-purple-500/20 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-[30rem] h-[30rem] rounded-full bg-cyan-400/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,hsl(var(--background)/0.4)_100%)]" />
      </div>

      <div className="w-full max-w-md relative z-10">
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center mb-4 px-6 py-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/10 shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.1)]">
            <Sparkles className="w-8 h-8 text-primary mr-2 drop-shadow-[0_0_12px_hsl(var(--primary)/0.6)]" />
            <h1 className="text-4xl font-black tracking-tight">
              <span className="text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]">LEV</span>
              <span className="text-foreground">ONIS</span>
            </h1>
          </div>
          <p className="text-muted-foreground text-sm">{t('auth_platform_desc')}</p>
        </div>

        {/* Main Glass Card */}
        <div className="relative rounded-3xl p-8 bg-white/10 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3),inset_0_1px_0_0_hsl(0_0%_100%/0.15)] overflow-hidden">
          {/* Subtle inner glow */}
          <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-transparent" />
          <div className="relative z-10">
          {showNewPasswordForm ? (
            <div className="space-y-6">
              <div className="text-center">
                <div className={glassIconBox}>
                  <Lock className="w-7 h-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
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
                      className={`${glassInput} pl-12`}
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

                <PasswordRequirements password={newPassword} />

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
                      className={`${glassInput} pl-12`}
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
                  className={glassPrimaryBtn}
                  disabled={loading || !isStrongPassword(newPassword) || newPassword !== confirmNewPassword}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {t('auth_confirm_change')}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost"
                  className={glassGhostBtn}
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
                <div className={glassIconBox}>
                  <Mail className="w-7 h-7 text-primary drop-shadow-[0_0_8px_hsl(var(--primary)/0.5)]" />
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
                    className={`${glassInput} text-left`}
                  />
                </div>

                <Button 
                  type="button"
                  onClick={handleSendResetEmail}
                  className={glassPrimaryBtn}
                  disabled={loading || resendTimer > 0}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {resendTimer > 0 ? t('auth_resend_after', { seconds: resendTimer }) : t('auth_send_code')}
                </Button>
                
                <Button 
                  type="button"
                  variant="ghost"
                  className={glassGhostBtn}
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
                      className={`${glassInput} pr-12 text-left`}
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
                      className={`${glassInput} px-12`}
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
                  className={glassPrimaryBtn}
                  disabled={loading}
                >
                  {loading && <Loader2 className="ml-2 h-5 w-5 animate-spin" />}
                  {t('auth_login')}
                </Button>
              </form>

              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-white/15"></div>
                </div>
                <div className="relative flex justify-center text-xs">
                  <span className="px-4 text-muted-foreground bg-white/5 backdrop-blur-xl rounded-full py-1 border border-white/10">{t('common_or')}</span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className={`${glassOutlineBtn} flex items-center justify-center gap-3`}
                onClick={handleGoogleSignIn}
                disabled={loading || googleLoading}
              >
                {googleLoading ? (
                  <Loader2 className="h-5 w-5 animate-spin" />
                ) : (
                  <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                )}
                <span>متابعة باستخدام Google</span>
              </Button>

              <Button
                type="button"
                variant="outline"
                className={glassOutlineBtn}
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
