import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, User, AtSign, ArrowLeft, Loader2, Check } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { useLanguage } from '@/lib/i18n';

export default function Step1Combined({ data, updateData, onNext, loading }: SignupStepProps) {
  const { t, isRtl } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
  const validateUsername = (u: string) => /^[a-zA-Z0-9_]{3,20}$/.test(u);
  const isPasswordStrong = (p: string) =>
    p.length >= 8 && /[A-Z]/.test(p) && /[a-z]/.test(p) && /[0-9]/.test(p);

  const checkUsername = async (username: string): Promise<boolean | null> => {
    if (!validateUsername(username)) { setUsernameAvailable(null); return null; }
    setCheckingUsername(true);
    try {
      const { data: existing } = await supabase
        .from('profiles').select('username').ilike('username', username).maybeSingle();
      const available = !existing;
      setUsernameAvailable(available);
      return available;
    } finally { setCheckingUsername(false); }
  };

  const checkEmailRegistered = async (email: string): Promise<boolean> => {
    const { data: existing } = await supabase
      .from('profiles').select('id').eq('email', email.trim().toLowerCase()).maybeSingle();
    return !!existing;
  };

  const handleUsernameChange = (value: string) => {
    updateData({ username: value });
    setUsernameAvailable(null);
    if (usernameTimeoutRef.current) clearTimeout(usernameTimeoutRef.current);
    if (value.length >= 3) {
      usernameTimeoutRef.current = setTimeout(() => checkUsername(value), 500);
    }
  };

  const validateForm = (overrideUsernameAvailable?: boolean | null) => {
    const e: Record<string, string> = {};
    if (!data.email) e.email = t('signup_email_required');
    else if (!validateEmail(data.email)) e.email = t('signup_email_invalid');

    if (!data.password) e.password = t('signup_password_required');
    else if (!isPasswordStrong(data.password)) e.password = t('signup_password_weak');

    if (!data.fullName) e.fullName = t('signup_full_name_required');
    else if (data.fullName.length > 15) e.fullName = t('signup_full_name_too_long');

    const uAvail = overrideUsernameAvailable !== undefined ? overrideUsernameAvailable : usernameAvailable;
    if (!data.username) e.username = t('signup_username_required');
    else if (!validateUsername(data.username)) e.username = t('signup_username_invalid');
    else if (uAvail === false) e.username = t('signup_username_taken');

    setErrors(e);
    return Object.keys(e).length === 0 && uAvail !== false;
  };

  const [verifyingEmail, setVerifyingEmail] = useState(false);

  const handleNext = async () => {
    // Cancel any pending debounce + run username check synchronously
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
      usernameTimeoutRef.current = null;
    }
    let uAvail = usernameAvailable;
    if (validateUsername(data.username)) {
      uAvail = await checkUsername(data.username);
    }
    if (!validateForm(uAvail)) return;

    // Verify email isn't already registered BEFORE proceeding (parent will send OTP)
    setVerifyingEmail(true);
    try {
      const taken = await checkEmailRegistered(data.email);
      if (taken) {
        setErrors((prev) => ({ ...prev, email: t('signup_email_already') }));
        return;
      }
    } finally {
      setVerifyingEmail(false);
    }

    updateData({ confirmPassword: data.password });
    onNext();
  };

  const startSide = isRtl ? 'right-3' : 'left-3';
  const endSide = isRtl ? 'left-3' : 'right-3';
  const padStart = isRtl ? 'pr-10' : 'pl-10';
  const padEnd = isRtl ? 'pl-10' : 'pr-10';

  return (
    <div className="space-y-5">
      <div className="text-center mb-2">
        <h2 className="text-2xl font-bold">{t('signup_s1_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('signup_s1_subtitle')}</p>
      </div>

      {/* Email */}
      <div className="space-y-1.5">
        <Label htmlFor="email">{t('signup_email_label')}</Label>
        <div className="relative">
          <Input
            id="email" type="email" placeholder="example@email.com"
            value={data.email} onChange={(e) => updateData({ email: e.target.value })}
            dir="ltr" disabled={loading}
            className={cn("h-12", padStart, errors.email && "border-destructive")}
          />
          <Mail className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
        </div>
        {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
      </div>

      {/* Password */}
      <div className="space-y-1.5">
        <Label htmlFor="password">{t('signup_password_label')}</Label>
        <div className="relative">
          <Input
            id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
            value={data.password} onChange={(e) => updateData({ password: e.target.value })}
            disabled={loading}
            className={cn("h-12", padStart, padEnd, errors.password && "border-destructive")}
          />
          <Lock className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
          <button type="button" onClick={() => setShowPassword(!showPassword)}
            className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground", endSide)} tabIndex={-1}>
            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
        </div>
        {errors.password ? (
          <p className="text-xs text-destructive">{errors.password}</p>
        ) : (
          <p className="text-xs text-muted-foreground">{t('signup_pw_check_length')} · A-Z · a-z · 0-9</p>
        )}
      </div>

      {/* Full Name */}
      <div className="space-y-1.5">
        <Label htmlFor="fullName">{t('signup_full_name_label')}</Label>
        <div className="relative">
          <Input
            id="fullName" type="text" placeholder={t('signup_full_name_placeholder')}
            value={data.fullName}
            onChange={(e) => updateData({ fullName: e.target.value.slice(0, 15) })}
            disabled={loading} maxLength={15}
            className={cn("h-12", padStart, errors.fullName && "border-destructive")}
          />
          <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
        </div>
        {errors.fullName && <p className="text-xs text-destructive">{errors.fullName}</p>}
      </div>

      {/* Username */}
      <div className="space-y-1.5">
        <Label htmlFor="username">{t('signup_username_label')}</Label>
        <div className="relative">
          <Input
            id="username" type="text" placeholder="user123"
            value={data.username}
            onChange={(e) => handleUsernameChange(e.target.value)}
            disabled={loading} maxLength={20} dir="ltr"
            className={cn(
              "h-12", padStart, padEnd,
              errors.username && "border-destructive",
              usernameAvailable === true && "border-green-500",
            )}
          />
          <AtSign className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
          <div className={cn("absolute top-1/2 -translate-y-1/2", endSide)}>
            {checkingUsername ? <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              : usernameAvailable === true ? <Check className="w-4 h-4 text-green-500" /> : null}
          </div>
        </div>
        {errors.username && <p className="text-xs text-destructive">{errors.username}</p>}
      </div>

      <Button onClick={handleNext} disabled={loading || checkingUsername || verifyingEmail}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold text-base">
        {(loading || verifyingEmail) ? <Loader2 className="w-5 h-5 animate-spin" /> : (
          <>
            {t('signup_next')}
            <ArrowLeft className={cn("w-4 h-4", isRtl ? "mr-2" : "ml-2 rotate-180")} />
          </>
        )}
      </Button>
    </div>
  );
}
