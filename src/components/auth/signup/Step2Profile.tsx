import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, AtSign, ArrowLeft, ArrowRight, Camera, ImagePlus, Check, Loader2 } from 'lucide-react';
import { SignupStepProps, DEFAULT_AVATARS } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

export default function Step2Profile({ data, updateData, onNext, onBack, loading }: SignupStepProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const usernameTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const validateUsername = (username: string) => {
    const usernameRegex = /^[a-zA-Z0-9_]+$/;
    return username.length >= 3 && username.length <= 20 && usernameRegex.test(username);
  };

  const checkUsernameAvailability = async (username: string) => {
    if (!validateUsername(username)) {
      setUsernameAvailable(null);
      return;
    }

    setCheckingUsername(true);
    try {
      const { data: existingProfile } = await supabase
        .from('profiles')
        .select('username')
        .ilike('username', username)
        .maybeSingle();

      setUsernameAvailable(!existingProfile);
    } catch (error) {
      console.error('Error checking username:', error);
    } finally {
      setCheckingUsername(false);
    }
  };

  const handleUsernameChange = (value: string) => {
    updateData({ username: value });
    setUsernameAvailable(null);
    
    if (usernameTimeoutRef.current) {
      clearTimeout(usernameTimeoutRef.current);
    }
    
    if (value.length >= 3) {
      usernameTimeoutRef.current = setTimeout(() => {
        checkUsernameAvailability(value);
      }, 500);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('يرجى اختيار صورة صالحة');
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن يكون أقل من 5MB');
      return;
    }

    setUploading(true);
    try {
      // Compress image before converting to base64
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      const loadPromise = new Promise<string>((resolve, reject) => {
        img.onload = () => {
          // Resize to max 256x256 for avatar
          const maxSize = 256;
          let w = img.width, h = img.height;
          if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          ctx?.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => reject(new Error('فشل في تحميل الصورة'));
      });
      
      img.src = URL.createObjectURL(file);
      const base64 = await loadPromise;
      URL.revokeObjectURL(img.src);
      
      updateData({ avatarUrl: base64 });
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('فشل في معالجة الصورة. حاول صورة أخرى.');
    } finally {
      setUploading(false);
      // Reset input so same file can be re-selected
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.fullName) {
      newErrors.fullName = 'الاسم الكامل مطلوب';
    } else if (data.fullName.length > 15) {
      newErrors.fullName = 'الاسم يجب أن لا يتجاوز 15 حرفاً';
    }

    if (!data.username) {
      newErrors.username = 'المعرف الفريد مطلوب';
    } else if (!validateUsername(data.username)) {
      newErrors.username = 'المعرف يجب أن يكون 3-20 حرف (أحرف وأرقام و _ فقط)';
    } else if (usernameAvailable === false) {
      newErrors.username = 'هذا المعرف مستخدم بالفعل';
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && usernameAvailable !== false;
  };

  const handleNext = async () => {
    // Force re-check username if not yet verified
    if (usernameAvailable === null && validateUsername(data.username)) {
      await checkUsernameAvailability(data.username);
    }
    if (validateForm()) {
      onNext();
    }
  };

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">بيانات الملف الشخصي</h2>
        <p className="text-sm text-muted-foreground mt-1">أكمل معلوماتك الشخصية</p>
      </div>

      <div className="space-y-4">
        {/* Avatar Selection */}
        <div className="space-y-3">
          <Label>الصورة الشخصية</Label>
          <div className="flex flex-col items-center gap-4">
            {/* Current Avatar */}
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-muted">
                <img
                  src={data.avatarUrl}
                  alt="Avatar"
                  className="w-full h-full object-cover"
                />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90"
                disabled={uploading}
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Camera className="w-4 h-4" />
                )}
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="hidden"
              />
            </div>

            {/* Default Avatars */}
            <div className="w-full">
              <p className="text-xs text-muted-foreground text-center mb-2">أو اختر صورة جاهزة</p>
              <div className="grid grid-cols-4 gap-2">
                {DEFAULT_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => updateData({ avatarUrl: avatar })}
                    className={cn(
                      "w-12 h-12 rounded-full overflow-hidden border-2 transition-all",
                      data.avatarUrl === avatar
                        ? "border-primary ring-2 ring-primary/20"
                        : "border-muted hover:border-primary/50"
                    )}
                  >
                    <img src={avatar} alt={`Avatar ${index + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Full Name */}
        <div className="space-y-2">
          <Label htmlFor="fullName">الاسم الكامل</Label>
          <div className="relative">
            <Input
              id="fullName"
              type="text"
              placeholder="محمد أحمد"
              value={data.fullName}
              onChange={(e) => updateData({ fullName: e.target.value.slice(0, 15) })}
              disabled={loading}
              maxLength={15}
              className={cn(
                "pr-10",
                errors.fullName && "border-destructive"
              )}
            />
            <User className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          </div>
          <div className="flex justify-between">
            {errors.fullName ? (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">الاسم الذي سيظهر للآخرين</p>
            )}
            <span className="text-xs text-muted-foreground">{data.fullName.length}/15</span>
          </div>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">المعرف الفريد</Label>
          <div className="relative">
            <Input
              id="username"
              type="text"
              placeholder="user123"
              value={data.username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              disabled={loading}
              maxLength={20}
              dir="ltr"
              className={cn(
                "pr-10 pl-10",
                errors.username && "border-destructive",
                usernameAvailable === true && "border-green-500",
                usernameAvailable === false && "border-destructive"
              )}
            />
            <AtSign className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <div className="absolute left-3 top-1/2 -translate-y-1/2">
              {checkingUsername ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : usernameAvailable === true ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : usernameAvailable === false ? (
                <span className="text-xs text-destructive">مستخدم</span>
              ) : null}
            </div>
          </div>
          {errors.username ? (
            <p className="text-xs text-destructive">{errors.username}</p>
          ) : usernameAvailable === true ? (
            <p className="text-xs text-green-500">المعرف متاح ✓</p>
          ) : (
            <p className="text-xs text-muted-foreground">أحرف إنجليزية وأرقام و _ فقط</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={onBack}
          disabled={loading}
          className="flex-1"
        >
          <ArrowRight className="w-4 h-4 ml-2" />
          السابق
        </Button>
        <Button
          onClick={handleNext}
          disabled={loading || checkingUsername || usernameAvailable === false}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold"
        >
          التالي
          <ArrowLeft className="w-4 h-4 mr-2" />
        </Button>
      </div>
    </div>
  );
}
