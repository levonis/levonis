import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Eye, EyeOff, Mail, Lock, ArrowLeft, CheckCircle2, XCircle } from 'lucide-react';
import { SignupStepProps } from './types';
import { cn } from '@/lib/utils';

export default function Step1Account({ data, updateData, onNext, loading }: SignupStepProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateEmail = (email: string) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
  };

  const validatePassword = (password: string) => {
    return password.length >= 6;
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.email) {
      newErrors.email = 'البريد الإلكتروني مطلوب';
    } else if (!validateEmail(data.email)) {
      newErrors.email = 'بريد إلكتروني غير صحيح';
    }

    if (!data.password) {
      newErrors.password = 'كلمة المرور مطلوبة';
    } else if (!validatePassword(data.password)) {
      newErrors.password = 'كلمة المرور يجب أن تكون 6 أحرف على الأقل';
    }

    if (!data.confirmPassword) {
      newErrors.confirmPassword = 'تأكيد كلمة المرور مطلوب';
    } else if (data.password !== data.confirmPassword) {
      newErrors.confirmPassword = 'كلمة المرور غير متطابقة';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleNext = () => {
    if (validateForm()) {
      onNext();
    }
  };

  const isEmailValid = data.email && validateEmail(data.email);
  const isPasswordValid = data.password && validatePassword(data.password);
  const isConfirmValid = data.confirmPassword && data.password === data.confirmPassword;

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
              id="email"
              type="email"
              placeholder="example@email.com"
              value={data.email}
              onChange={(e) => updateData({ email: e.target.value })}
              dir="ltr"
              disabled={loading}
              className={cn(
                "pr-10",
                errors.email && "border-destructive",
                isEmailValid && "border-green-500"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isEmailValid ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : data.email ? (
                <XCircle className="w-4 h-4 text-destructive" />
              ) : (
                <Mail className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
          </div>
          {errors.email && <p className="text-xs text-destructive">{errors.email}</p>}
        </div>

        {/* Password */}
        <div className="space-y-2">
          <Label htmlFor="password">كلمة المرور</Label>
          <div className="relative">
            <Input
              id="password"
              type={showPassword ? "text" : "password"}
              placeholder="••••••••"
              value={data.password}
              onChange={(e) => updateData({ password: e.target.value })}
              disabled={loading}
              className={cn(
                "pr-10 pl-10",
                errors.password && "border-destructive",
                isPasswordValid && "border-green-500"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isPasswordValid ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.password && <p className="text-xs text-destructive">{errors.password}</p>}
          <p className="text-xs text-muted-foreground">يجب أن تكون 6 أحرف على الأقل</p>
        </div>

        {/* Confirm Password */}
        <div className="space-y-2">
          <Label htmlFor="confirmPassword">تأكيد كلمة المرور</Label>
          <div className="relative">
            <Input
              id="confirmPassword"
              type={showConfirmPassword ? "text" : "password"}
              placeholder="••••••••"
              value={data.confirmPassword}
              onChange={(e) => updateData({ confirmPassword: e.target.value })}
              disabled={loading}
              className={cn(
                "pr-10 pl-10",
                errors.confirmPassword && "border-destructive",
                isConfirmValid && "border-green-500"
              )}
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {isConfirmValid ? (
                <CheckCircle2 className="w-4 h-4 text-green-500" />
              ) : (
                <Lock className="w-4 h-4 text-muted-foreground" />
              )}
            </div>
            <button
              type="button"
              onClick={() => setShowConfirmPassword(!showConfirmPassword)}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
              tabIndex={-1}
            >
              {showConfirmPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
          {errors.confirmPassword && <p className="text-xs text-destructive">{errors.confirmPassword}</p>}
        </div>
      </div>

      <Button
        onClick={handleNext}
        disabled={loading}
        className="w-full h-12 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
      >
        التالي
        <ArrowLeft className="w-4 h-4 mr-2" />
      </Button>
    </div>
  );
}
