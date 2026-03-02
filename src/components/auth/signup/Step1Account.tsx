import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';

const passwordChecks = [
  { key: 'length', label: '8 أحرف على الأقل', test: (p: string) => p.length >= 8 },
  { key: 'upper', label: 'حرف كبير (A-Z)', test: (p: string) => /[A-Z]/.test(p) },
  { key: 'lower', label: 'حرف صغير (a-z)', test: (p: string) => /[a-z]/.test(p) },
  { key: 'number', label: 'رقم (0-9)', test: (p: string) => /[0-9]/.test(p) },
];

function getPasswordStrength(password: string) {
  const passed = passwordChecks.filter(c => c.test(password)).length;
  if (passed <= 1) return { label: 'ضعيفة', color: 'bg-destructive', width: '25%' };
  if (passed === 2) return { label: 'مقبولة', color: 'bg-orange-500', width: '50%' };
  if (passed === 3) return { label: 'متوسطة', color: 'bg-yellow-500', width: '75%' };
  return { label: 'قوية', color: 'bg-green-500', width: '100%' };
}

export default function Step1Account({ data, updateData, onNext, loading }: SignupStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  const isPasswordStrong = (password: string) => passwordChecks.every(c => c.test(password));

  const validateForm = () => {
    const newErrors: Record<string, string> = {};
    if (!data.email) newErrors.email = 'البريد الإلكتروني مطلوب';
    else if (!validateEmail(data.email)) newErrors.email = 'بريد إلكتروني غير صحيح';

    if (!data.password) newErrors.password = 'كلمة المرور مطلوبة';
    else if (!isPasswordStrong(data.password)) newErrors.password = 'كلمة المرور لا تستوفي جميع الشروط';

    if (!data.confirmPassword) newErrors.confirmPassword = 'تأكيد كلمة المرور مطلوب';
    else if (data.password !== data.confirmPassword) newErrors.confirmPassword = 'كلمة المرور غير متطابقة';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => { if (validateForm()) onNext(); };

  const isEmailValid = data.email && validateEmail(data.email);
  const isPasswordValid = data.password && isPasswordStrong(data.password);
  const isConfirmValid = data.confirmPassword && data.password === data.confirmPassword;
  const strength = data.password ? getPasswordStrength(data.password) : null;

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <Mail className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">إنشاء حساب جديد</h2>
        <p className="text-sm text-muted-foreground mt-1">أدخل بيانات تسجيل الدخول</p>
      </div>

      <div className="space-y-4">
        {/* Email */}
        <div className="space-y-2">
          <Label htmlFor="email">البريد الإلكتروني</Label>
          <div className="relative">
            <Input
              id="email" type="email" placeholder="example@email.com"
              value={data.email} onChange={(e) => updateData({ email: e.target.value })}
              dir="ltr" disabled={loading}
              className={cn("pr-10", errors.email && "border-destructive", isEmailValid && "border-green-500")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isEmailValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : data.email ? <XCircle className="w-4 h-4 text-destructive" /> : <Mail className="w-4 h-4 text-muted-foreground" />}
            </div>
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <div className="relative">
            <Input
              id="password" type={showPassword ? "text" : "password"} placeholder="••••••••"
              value={data.password} onChange={(e) => updateData({ password: e.target.value })}
              disabled={loading}
              className={cn("pr-10 pl-10", errors.password && "border-destructive", isPasswordValid && "border-green-500")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isPasswordValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
            </div>
            <button type="button" onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
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
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <div className="relative">
            <Input
              id="confirmPassword" type={showConfirmPassword ? "text" : "password"} placeholder="••••••••"
              value={data.confirmPassword} onChange={(e) => updateData({ confirmPassword: e.target.value })}
              disabled={loading}
              className={cn("pr-10 pl-10", errors.confirmPassword && "border-destructive", isConfirmValid && "border-green-500")}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isConfirmValid ? <CheckCircle2 className="w-4 h-4 text-green-500" /> : <Lock className="w-4 h-4 text-muted-foreground" />}
            </div>
            <button type="button" onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button onClick={handleNext} disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold">
        التالي
        <ArrowLeft className="w-4 h-4 mr-2" />
      </Button>
    </div>
  );
}
