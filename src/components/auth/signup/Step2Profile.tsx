import { useState, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { User, AtSign, ArrowLeft, ArrowRight, Camera, Check, Loader2 } from 'lucide-react';
import { SignupStepProps, DEFAULT_AVATARS } from './types';
import { cn } from '@/lib/utils';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useLanguage } from '@/lib/i18n';

export default function Step2Profile({ data, updateData, onNext, onBack, loading }: SignupStepProps) {
  const { t, isRtl } = useLanguage();
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

    if (!file.type.startsWith('image/')) {
      toast.error(t('signup_avatar_invalid_file'));
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      toast.error(t('signup_avatar_too_large'));
      return;
    }

    setUploading(true);
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();

      const loadPromise = new Promise<string>((resolve, reject) => {
        img.onload = () => {
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
        img.onerror = () => reject(new Error('image load failed'));
      });

      img.src = URL.createObjectURL(file);
      const base64 = await loadPromise;
      URL.revokeObjectURL(img.src);

      updateData({ avatarUrl: base64 });
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error(t('signup_avatar_process_fail'));
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!data.fullName) {
      newErrors.fullName = t('signup_full_name_required');
    } else if (data.fullName.length > 15) {
      newErrors.fullName = t('signup_full_name_too_long');
    }

    if (!data.username) {
      newErrors.username = t('signup_username_required');
    } else if (!validateUsername(data.username)) {
      newErrors.username = t('signup_username_invalid');
    } else if (usernameAvailable === false) {
      newErrors.username = t('signup_username_taken');
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0 && usernameAvailable !== false;
  };

  const handleNext = async () => {
    if (usernameAvailable === null && validateUsername(data.username)) {
      await checkUsernameAvailability(data.username);
    }
    if (validateForm()) {
      onNext();
    }
  };

  const startSide = isRtl ? 'right-3' : 'left-3';
  const endSide = isRtl ? 'left-3' : 'right-3';
  const padStart = isRtl ? 'pr-10' : 'pl-10';
  const padEnd = isRtl ? 'pl-10' : 'pr-10';

  return (
    <div className="space-y-5">
      <div className="text-center mb-6">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 mb-4">
          <User className="w-8 h-8 text-primary" />
        </div>
        <h2 className="text-xl font-bold">{t('signup_s2_title')}</h2>
        <p className="text-sm text-muted-foreground mt-1">{t('signup_s2_subtitle')}</p>
      </div>

      <div className="space-y-4">
        {/* Avatar */}
        <div className="space-y-3">
          <Label>{t('signup_avatar_label')}</Label>
          <div className="flex flex-col items-center gap-4">
            <div className="relative">
              <div className="w-24 h-24 rounded-full overflow-hidden border-4 border-primary/20 bg-muted">
                <img src={data.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-0 right-0 w-8 h-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-lg hover:opacity-90"
                disabled={uploading}
              >
                {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
              </button>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleImageUpload} className="hidden" />
            </div>

            <div className="w-full">
              <p className="text-xs text-muted-foreground text-center mb-2">{t('signup_avatar_pick_default')}</p>
              <div className="grid grid-cols-4 gap-2">
                {DEFAULT_AVATARS.map((avatar, index) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => updateData({ avatarUrl: avatar })}
                    className={cn(
                      "w-12 h-12 rounded-full overflow-hidden border-2 transition-all",
                      data.avatarUrl === avatar ? "border-primary ring-2 ring-primary/20" : "border-muted hover:border-primary/50"
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
          <Label htmlFor="fullName">{t('signup_full_name_label')}</Label>
          <div className="relative">
            <Input
              id="fullName" type="text" placeholder={t('signup_full_name_placeholder')}
              value={data.fullName}
              onChange={(e) => updateData({ fullName: e.target.value.slice(0, 15) })}
              disabled={loading} maxLength={15}
              className={cn(padStart, errors.fullName && "border-destructive")}
            />
            <User className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
          </div>
          <div className="flex justify-between">
            {errors.fullName ? (
              <p className="text-xs text-destructive">{errors.fullName}</p>
            ) : (
              <p className="text-xs text-muted-foreground">{t('signup_full_name_hint')}</p>
            )}
            <span className="text-xs text-muted-foreground">{data.fullName.length}/15</span>
          </div>
        </div>

        {/* Username */}
        <div className="space-y-2">
          <Label htmlFor="username">{t('signup_username_label')}</Label>
          <div className="relative">
            <Input
              id="username" type="text" placeholder="user123"
              value={data.username}
              onChange={(e) => handleUsernameChange(e.target.value)}
              disabled={loading} maxLength={20} dir="ltr"
              className={cn(
                padStart, padEnd,
                errors.username && "border-destructive",
                usernameAvailable === true && "border-green-500",
                usernameAvailable === false && "border-destructive"
              )}
            />
            <AtSign className={cn("absolute top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground", startSide)} />
            <div className={cn("absolute top-1/2 -translate-y-1/2", endSide)}>
              {checkingUsername ? (
                <Loader2 className="w-4 h-4 animate-spin text-muted-foreground" />
              ) : usernameAvailable === true ? (
                <Check className="w-4 h-4 text-green-500" />
              ) : usernameAvailable === false ? (
                <span className="text-xs text-destructive">{t('signup_username_taken_short')}</span>
              ) : null}
            </div>
          </div>
          {errors.username ? (
            <p className="text-xs text-destructive">{errors.username}</p>
          ) : usernameAvailable === true ? (
            <p className="text-xs text-green-500">{t('signup_username_available')}</p>
          ) : (
            <p className="text-xs text-muted-foreground">{t('signup_username_hint')}</p>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="button" variant="outline" onClick={onBack} disabled={loading} className="flex-1">
          <ArrowRight className={cn("w-4 h-4", isRtl ? "ml-2" : "mr-2 rotate-180")} />
          {t('signup_prev')}
        </Button>
        <Button onClick={handleNext} disabled={loading || checkingUsername || usernameAvailable === false}
          className="flex-1 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold">
          {t('signup_next')}
          <ArrowLeft className={cn("w-4 h-4", isRtl ? "mr-2" : "ml-2 rotate-180")} />
        </Button>
      </div>
    </div>
  );
}
