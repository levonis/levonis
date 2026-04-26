import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';

export default function Step1Account({ data, updateData, onNext, loading }: SignupStepProps) {
  const { t, isRtl } = useLanguage();
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const passwordChecks = [
    { key: 'length', label: t('signup_pw_check_length'), test: (p: string) => p.length >= 8 },
    { key: 'upper', label: t('signup_pw_check_upper'), test: (p: string) => /[A-Z]/.test(p) },
    { key: 'lower', label: t('signup_pw_check_lower'), test: (p: string) => /[a-z]/.test(p) },
    { key: 'number', label: t('signup_pw_check_number'), test: (p: string) => /[0-9]/.test(p) },
  ];

  const getPasswordStrength = (password: string) => {
    const passed = passwordChecks.filter(c => c.test(password)).length;
    if (passed <= 1) return { label: t('signup_pw_strength_weak'), color: 'bg-destructive', width: '25%' };
    if (passed === 2) return { label: t('signup_pw_strength_ok'), color: 'bg-orange-500', width: '50%' };
    if (passed === 3) return { label: t('signup_pw_strength_mid'), color: 'bg-yellow-500', width: '75%' };
    return { label: t('signup_pw_strength_strong'), color: 'bg-green-500', width: '100%' };
  };

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isPasswordStrong = (password: string) => passwordChecks.every(c => c.test(password));

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!data.email) newErrors.email = t('signup_email_required');
    else if (!validateEmail(data.email)) newErrors.email = t('signup_email_invalid');

    if (!data.password) newErrors.password = t('signup_password_required');
    else if (!isPasswordStrong(data.password)) newErrors.password = t('signup_password_weak');

    if (!data.confirmPassword) newErrors.confirmPassword = t('signup_confirm_password_required');
    else if (data.password !== data.confirmPassword) newErrors.confirmPassword = t('signup_password_mismatch');

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => { if (validateForm()) onNext(); };

  const isEmailValid = data.email && validateEmail(data.email);
  const isPasswordValid = data.password && isPasswordStrong(data.password);
  const isConfirmValid = data.confirmPassword && data.password === data.confirmPassword;
  const strength = data.password ? getPasswordStrength(data.password) : null;

  // RTL/LTR-aware icon positioning
  const startSide = isRtl ? 'right-3' : 'left-3';
  const endSide = isRtl ? 'left-3' : 'right-3';
  const padStart = isRtl ? 'pr-10' : 'pl-10';
  const padEnd = isRtl ? 'pl-10' : 'pr-10';

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{t('signup_s1_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('signup_s1_subtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">{t('signup_email_label')}</Label>
          <div className="relative">
            <Input
              id="email" type="email" placeholder="example@email.com"
              value={data.email} onChange={(e) => updateData({ email: e.target.value })}
              dir="ltr" disabled={loading}
              className={cn(padStart, errors.email && "border-destructive", isEmailValid && "border-green-500")}
            />
            <div className={cn("absolute top-1/2 -translate-y-1/2", startSide)}>
              {isEmailValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : data.email ? <XCircle className="w-4 h-4 text-destructive" /> : <Mail className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">{t('signup_password_label')}</Label>
          <div className="relative">
            <Input
              id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
              value={data.password} onChange={(e) => updateData({ password: e.target.value })}
              disabled={loading}
              className={cn(padStart, padEnd, errors.password && "border-destructive", isPasswordValid && "border-green-500")}
            />
            <div className={cn("absolute top-1/2 -translate-y-1/2", startSide)}>
              {isPasswordValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
            </div>
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors", endSide)} tabIndex={-1}>
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}

          {/* Strength indicator */}
          {data.password && strength && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                  <div className={cn("h-full rounded-full transition-all", strength.color)} style={{ width: strength.width }} />
                </div>
                <span className="text-xs font-medium text-muted-foreground">{strength.label}</span>
              </div>
              <ul className="space-y-1">
                {passwordChecks.map(c => (
                  <li key={c.key} className={cn("text-xs flex items-center gap-1.5", c.test(data.password) ? "text-green-500" : "text-muted-foreground")}>
                    {c.test(data.password) ? <CheckCircle2 className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                    {c.label}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">{t('signup_confirm_password_label')}</Label>
          <div className="relative">
            <Input
              id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••"
              value={data.confirmPassword} onChange={(e) => updateData({ confirmPassword: e.target.value })}
              disabled={loading}
              className={cn(padStart, padEnd, errors.confirmPassword && "border-destructive", isConfirmValid && "border-green-500")}
            />
            <div className={cn("absolute top-1/2 -translate-y-1/2", startSide)}>
              {isConfirmValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
            </div>
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className={cn("absolute top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors", endSide)} tabIndex={-1}>
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button onClick={handleNext} disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold">
        {t('signup_next')}
        <ArrowLeft className={cn("w-4 h-4", isRtl ? "mr-2" : "ml-2 rotate-180")} />
      </Button>
    </div>
  );
}
