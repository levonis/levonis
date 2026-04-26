import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Loader2, ShieldCheck, ShieldAlert, Lock, Bell, Globe, User, MapPin, Save, LogOut, Users, FileText, Palette, KeyRound, CreditCard } from "lucide-react";
import { useLanguage, LANGUAGE_LABELS } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { toast as sonnerToast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageCropper from "@/components/marketplace/ImageCropper";
import WalletPinDialog from "@/components/wallet/WalletPinDialog";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { useTheme, ThemeMode } from "@/hooks/useTheme";
import { supabase as supabaseClient } from "@/integrations/supabase/client";

// Inline theme switcher for settings
function ThemeSwitcherInline() {
  const { theme, setTheme } = useTheme();
  const { t } = useLanguage();
  const themes: { key: ThemeMode; label: string; colors: string[] }[] = [
    { key: "default", label: t('settings_theme_default'), colors: ["hsl(160,46%,15%)", "hsl(44,39%,60%)"] },
    { key: "light", label: t('settings_theme_light'), colors: ["hsl(45,30%,92%)", "hsl(44,50%,55%)"] },
    { key: "dark", label: t('settings_theme_dark'), colors: ["hsl(220,20%,8%)", "hsl(44,50%,55%)"] },
  ];
  return (
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm font-bold text-foreground">{t('settings_theme_label')}</p>
        <p className="text-xs text-muted-foreground">{t('settings_theme_desc')}</p>
      </div>
      <div className="flex gap-1.5">
        {themes.map((th) => (
          <button
            key={th.key}
            onClick={() => setTheme(th.key)}
            className={`relative w-8 h-8 rounded-full border-2 transition-all overflow-hidden ${
              theme === th.key
                ? "border-primary ring-2 ring-primary/30 scale-110"
                : "border-border/50 hover:border-primary/40"
            }`}
            title={th.label}
          >
            <div className="absolute inset-0 rounded-full" style={{ background: `linear-gradient(135deg, ${th.colors[0]} 50%, ${th.colors[1]} 50%)` }} />
          </button>
        ))}
      </div>
    </div>
  );
}

// Password change button
function ChangePasswordButton() {
  const { t } = useLanguage();
  const [loading, setLoading] = useState(false);
  const [newPass, setNewPass] = useState("");
  const [showInput, setShowInput] = useState(false);

  const handleChange = async () => {
    if (newPass.length < 6) {
      sonnerToast.error(t('settings_password_min'));
      return;
    }
    setLoading(true);
    try {
      const { error } = await supabaseClient.auth.updateUser({ password: newPass });
      if (error) throw error;
      sonnerToast.success(t('settings_password_changed'));
      setShowInput(false);
      setNewPass("");
    } catch (err: any) {
      sonnerToast.error(t('settings_password_change_failed') + ": " + (err?.message || ""));
    } finally {
      setLoading(false);
    }
  };

  if (!showInput) {
    return (
      <Button variant="outline" size="sm" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all  gap-1" onClick={() => setShowInput(true)}>
        <KeyRound className="h-3.5 w-3.5" />
        {t('settings_change')}
      </Button>
    );
  }

  return (
    <div className="flex gap-2 items-center">
      <Input
        type="password"
        value={newPass}
        onChange={e => setNewPass(e.target.value)}
        placeholder={t('settings_password_new_placeholder')}
        className="h-8 w-36 bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all text-sm"
      />
      <Button size="sm" className="rounded-2xl backdrop-blur-xl bg-gradient-to-br from-primary/90 to-primary/70 hover:from-primary hover:to-primary/80 text-primary-foreground border border-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.4),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] h-8 px-4" onClick={handleChange} disabled={loading}>
        {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : t('settings_password_save')}
      </Button>
      <Button size="sm" variant="ghost" className="rounded-2xl h-8 bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/10" onClick={() => { setShowInput(false); setNewPass(""); }}>
        ×
      </Button>
    </div>
  );
}

function daysUntilAllowed(last: string | null) {
  if (!last) return 0;
  const lastDate = new Date(last);
  if (Number.isNaN(lastDate.getTime())) return 0;
  const diffMs = Date.now() - lastDate.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  return Math.max(0, 14 - diffDays);
}

function normalizePhone(raw: string) {
  const s = (raw || "").trim();
  const digits = s.replace(/[^\d+]/g, "");
  return digits;
}

function isValidPhone(raw: string) {
  const v = normalizePhone(raw);
  return /^\+9647\d{8,9}$/.test(v) || /^07\d{8,9}$/.test(v);
}

// Glass shared classes
const glassInput = "bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all";
const glassPrimaryBtn = "rounded-2xl backdrop-blur-xl bg-gradient-to-br from-primary/90 to-primary/70 hover:from-primary hover:to-primary/80 text-primary-foreground border border-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.4),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] transition-all hover:scale-[1.02] active:scale-[0.98]";
const glassOutlineBtn = "rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all";

// Section wrapper component - glassmorphism
const SettingsSection = ({ icon: Icon, title, children, className }: { icon: any; title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("relative rounded-3xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-2xl border border-white/20 dark:border-white/10 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.2),inset_0_1px_0_0_hsl(0_0%_100%/0.1)] overflow-hidden", className)}>
    <div className="pointer-events-none absolute inset-0 rounded-3xl bg-gradient-to-br from-white/10 via-transparent to-transparent" />
    <div className="relative flex items-center gap-2.5 px-4 py-3 border-b border-white/10">
      <div className="w-9 h-9 rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 backdrop-blur-xl border border-white/20 flex items-center justify-center shadow-[inset_0_1px_0_0_hsl(0_0%_100%/0.15)]">
        <Icon className="h-4 w-4 text-primary drop-shadow-[0_0_6px_hsl(var(--primary)/0.5)]" />
      </div>
      <h2 className="text-sm font-black text-foreground">{title}</h2>
    </div>
    <div className="relative p-4">{children}</div>
  </div>
);


export default function ProfileSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage, dir } = useLanguage();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedDefaultAddressId, setSelectedDefaultAddressId] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);
  const [showPinDialog, setShowPinDialog] = useState(false);
  const [communityDisplayName, setCommunityDisplayName] = useState("");
  const [communityBio, setCommunityBio] = useState("");
  const [newPhoneNumber, setNewPhoneNumber] = useState("");
  const [editingPhone, setEditingPhone] = useState(false);
  const [savingPhone, setSavingPhone] = useState(false);
  const [telegramNotifs, setTelegramNotifs] = useState({
    orders: true,
    wallet: true,
    support: true,
    promotions: true,
    community_messages: true,
    print_offers: true,
    merchant_updates: true,
  });

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile-settings-profile", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, phone_number, phone_verified, phone_verification_status, last_username_change_at, last_phone_change_at, telegram_chat_id, telegram_notifications"
        )
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: addresses, isLoading: loadingAddresses } = useQuery({
    queryKey: ["my-addresses", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses")
        .select("id, full_name, phone_number, governorate, area, neighborhood, nearest_landmark, is_default")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: communityProfile } = useQuery({
    queryKey: ["community-profile-settings", user?.id],
    enabled: !!user?.id,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_customer_profiles")
        .select("id, display_name, bio, avatar_url, is_verified, reputation_score")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  useMemo(() => {
    if (!profile) return;
    setFullName((prev) => (prev ? prev : (profile.full_name as string | null) ?? ""));
    setUsername((prev) => (prev ? prev : (profile.username as string | null) ?? ""));
  }, [profile]);

  useMemo(() => {
    if (!communityProfile) return;
    setCommunityDisplayName((prev) => prev || ((communityProfile.display_name as string | null) ?? ""));
    setCommunityBio((prev) => prev || ((communityProfile.bio as string | null) ?? ""));
  }, [communityProfile]);

  useMemo(() => {
    if (!profile) return;
    const saved = (profile as any)?.telegram_notifications;
    if (saved && typeof saved === 'object') {
      setTelegramNotifs(prev => ({ ...prev, ...saved }));
    }
  }, [profile]);

  useMemo(() => {
    if (!addresses || addresses.length === 0) return;
    const current = addresses.find((a: any) => a.is_default)?.id || "";
    setSelectedDefaultAddressId((prev) => prev || current);
  }, [addresses]);

  const cooldownDaysLeft = daysUntilAllowed((profile as any)?.last_username_change_at ?? null);
  const canEditUsername = cooldownDaysLeft === 0;
  const phoneCooldownDaysLeft = daysUntilAllowed((profile as any)?.last_phone_change_at ?? null);
  const canEditPhone = phoneCooldownDaysLeft === 0;
  const phoneVerified = Boolean((profile as any)?.phone_verified) || (profile as any)?.phone_verification_status === "verified";
  const phoneNumber = ((profile as any)?.phone_number as string | null) ?? "";

  const handleSavePhone = async () => {
    if (!user?.id) return;
    const normalized = normalizePhone(newPhoneNumber);
    if (!isValidPhone(normalized)) {
      toast({ title: t('settings_phone_invalid_title'), description: t('settings_phone_invalid_desc'), variant: "destructive" });
      return;
    }
    setSavingPhone(true);
    try {
      const { error } = await supabase.from("profiles").update({
        phone_number: normalized,
        phone_verified: false,
        phone_verification_status: "unverified",
        last_phone_change_at: new Date().toISOString(),
      }).eq("id", user.id);
      if (error) throw error;
      toast({ title: t('settings_phone_changed') });
      setEditingPhone(false);
      setNewPhoneNumber("");
      qc.invalidateQueries({ queryKey: ["profile-settings-profile", user.id] });
    } catch (err: any) {
      toast({ title: t('settings_phone_change_failed'), description: err?.message, variant: "destructive" });
    } finally {
      setSavingPhone(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!fullName.trim()) throw new Error(t('settings_name_required'));

      if (phoneNumber && !isValidPhone(phoneNumber)) {
        throw new Error(t('settings_phone_invalid_save'));
      }

      let nextAvatarUrl: string | null = (profile as any)?.avatar_url ?? null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(`avatars/${fileName}`, avatarFile);
        if (uploadError) throw uploadError;

        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(`avatars/${fileName}`);
        nextAvatarUrl = publicUrl;
      }

      const updatePayload: any = {
        full_name: fullName.trim(),
        avatar_url: nextAvatarUrl,
        telegram_notifications: telegramNotifs,
      };

      if (canEditUsername && username.trim() && username.trim() !== (profile as any)?.username) {
        updatePayload.username = username.trim();
      }

      const { error: profileError } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);
      if (profileError) throw profileError;

      if (selectedDefaultAddressId) {
        const { error: clearErr } = await supabase.from("user_addresses").update({ is_default: false }).eq("user_id", user.id);
        if (clearErr) throw clearErr;
        const { error: setErr } = await supabase.from("user_addresses").update({ is_default: true }).eq("user_id", user.id).eq("id", selectedDefaultAddressId);
        if (setErr) throw setErr;
      }

      // Update community profile if exists
      if (communityProfile) {
        const { error: communityErr } = await supabase
          .from("community_customer_profiles")
          .update({
            display_name: communityDisplayName.trim() || null,
            bio: communityBio.trim() || null,
          })
          .eq("user_id", user.id);
        if (communityErr) console.error("Community profile update error:", communityErr);
      }

      return true;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["profile-settings-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["my-addresses", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-settings", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-status", user?.id] }),
      ]);
      toast({ title: t('settings_saved') });
      setAvatarFile(null);
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: t('settings_save_error'), description: t('settings_username_taken'), variant: "destructive" });
        return;
      }
      if (err?.code === "P0001" && String(err?.message || "").includes("USERNAME_CHANGE_COOLDOWN")) {
        toast({ title: t('settings_save_error'), description: t('settings_username_cooldown_error'), variant: "destructive" });
        return;
      }
      toast({ title: t('settings_save_error'), description: err?.message ?? t('settings_unexpected_error'), variant: "destructive" });
    },
  });

  useEffect(() => {
    return () => { if (cropObjectUrlRef.current) URL.revokeObjectURL(cropObjectUrlRef.current); };
  }, []);

  const previewAvatar = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return (profile as any)?.avatar_url || undefined;
  }, [avatarFile, profile]);

  useEffect(() => {
    if (!avatarFile || !previewAvatar) return;
    return () => URL.revokeObjectURL(previewAvatar);
  }, [avatarFile, previewAvatar]);

  const handlePickAvatar = (file: File | null) => {
    if (!file) return;
    if (cropObjectUrlRef.current) { URL.revokeObjectURL(cropObjectUrlRef.current); cropObjectUrlRef.current = null; }
    const objectUrl = URL.createObjectURL(file);
    cropObjectUrlRef.current = objectUrl;
    setCropImageSrc(objectUrl);
    setCropOpen(true);
  };

  const handleCropComplete = (blob: Blob) => {
    const next = new File([blob], `avatar-${Date.now()}.jpg`, { type: blob.type || "image/jpeg" });
    setAvatarFile(next);
    setCropOpen(false);
  };

  const usernameHint = canEditUsername
    ? t('settings_username_hint')
    : t('settings_username_cooldown', { days: cooldownDaysLeft });

  return (
    <div className="min-h-screen bg-background relative overflow-hidden" dir={dir}>
      {/* Glassmorphism background orbs */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-32 w-[28rem] h-[28rem] rounded-full bg-primary/25 blur-[120px] animate-pulse" />
        <div className="absolute top-1/2 -left-40 w-[26rem] h-[26rem] rounded-full bg-primary/15 blur-[120px] animate-pulse" style={{ animationDelay: '1s' }} />
        <div className="absolute -bottom-40 right-1/4 w-[30rem] h-[30rem] rounded-full bg-accent/20 blur-[120px] animate-pulse" style={{ animationDelay: '2s' }} />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,transparent_0%,hsl(var(--background)/0.4)_100%)]" />
      </div>

      {/* Header - glass */}
      <div className="sticky top-0 z-50 bg-white/10 dark:bg-white/[0.04] backdrop-blur-2xl border-b border-white/15 dark:border-white/10 shadow-[0_4px_20px_-8px_rgba(0,0,0,0.2)]">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-10 w-10 rounded-2xl bg-white/5 hover:bg-white/15 backdrop-blur-xl border border-white/10">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-black text-foreground">{t('settings_title')}</h1>
        </div>
      </div>

      <main className="relative container mx-auto max-w-2xl px-4 pt-4 pb-28 space-y-3">
        {/* Avatar Section - Centered */}
        <div className="flex flex-col items-center py-4">
          <div className="relative mb-3">
            <Avatar className="h-28 w-28 ring-4 ring-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.4)]">
              <AvatarImage src={previewAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">
                {((profile as any)?.username?.[0] || (profile as any)?.full_name?.[0] || "م").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              size="icon"
              className="absolute -bottom-1 -left-1 h-10 w-10 rounded-full bg-gradient-to-br from-primary to-primary/70 text-primary-foreground border border-white/20 shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.5),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] hover:scale-110 transition-transform"
              onClick={() => fileRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
            </Button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={(e) => handlePickAvatar(e.target.files?.[0] ?? null)} />
          </div>
          {(profile as any)?.username && (
            <p className="text-sm font-bold text-muted-foreground">@{(profile as any).username}</p>
          )}
        </div>

        {/* Personal Info Section */}
        <SettingsSection icon={User} title={t('settings_personal_info')}>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('settings_name')}</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder={t('settings_name_placeholder')} className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('settings_username')}</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!canEditUsername}
                placeholder={t('settings_username_placeholder')}
                maxLength={30}
                className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all"
              />
              <p className="text-[11px] text-muted-foreground">{usernameHint}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">{t('settings_phone')}</Label>
              {editingPhone ? (
                <div className="space-y-2">
                  <Input
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    inputMode="tel"
                    dir="ltr"
                    className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-2xl backdrop-blur-xl bg-gradient-to-br from-primary/90 to-primary/70 hover:from-primary hover:to-primary/80 text-primary-foreground border border-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.4),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] flex-1" onClick={handleSavePhone} disabled={savingPhone}>
                      {savingPhone && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                      {t('settings_save_phone')}
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all" onClick={() => { setEditingPhone(false); setNewPhoneNumber(""); }}>
                      {t('settings_cancel')}
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={phoneNumber || "—"} disabled placeholder="—" inputMode="tel" className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all flex-1" />
                  {canEditPhone ? (
                    <Button size="sm" variant="outline" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all  text-xs" onClick={() => { setEditingPhone(true); setNewPhoneNumber(phoneNumber); }}>
                      {t('settings_change')}
                    </Button>
                  ) : (
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">{t('settings_after_days', { days: phoneCooldownDaysLeft })}</p>
                  )}
                </div>
              )}
              <Badge variant={phoneVerified ? "secondary" : "outline"} className="gap-1.5 text-[11px]">
                {phoneVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {phoneVerified ? t('settings_phone_verified') : t('settings_phone_unverified')}
              </Badge>
            </div>
          </div>
        </SettingsSection>

        {/* Default Address Section */}
        <SettingsSection icon={MapPin} title={t('settings_default_address')}>
          {loadingAddresses ? (
            <p className="text-sm text-muted-foreground">{t('settings_loading_addresses')}</p>
          ) : !addresses || addresses.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">{t('settings_no_addresses_short')}</p>
              <Button variant="outline" size="sm" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all" onClick={() => navigate('/addresses')}>
                {t('settings_add_address')}
              </Button>
            </div>
          ) : (
            <RadioGroup value={selectedDefaultAddressId} onValueChange={setSelectedDefaultAddressId}>
              <div className="space-y-2">
                {addresses.map((a: any) => {
                  const title = `${a.governorate} • ${a.area}${a.neighborhood ? ` • ${a.neighborhood}` : ""}`;
                  const sub = a.nearest_landmark ? `${a.nearest_landmark}` : "";
                  return (
                    <label
                      key={a.id}
                      className="flex items-start gap-3 rounded-2xl border border-white/15 bg-white/5 backdrop-blur-xl p-3 cursor-pointer hover:bg-white/10 hover:border-primary/40 transition-all"
                    >
                      <RadioGroupItem value={a.id} className="mt-0.5" />
                      <div className="min-w-0">
                        <div className="text-sm font-bold text-foreground truncate">{title}</div>
                        {sub && <div className="text-xs text-muted-foreground mt-0.5">{sub}</div>}
                      </div>
                    </label>
                  );
                })}
              </div>
            </RadioGroup>
          )}
        </SettingsSection>

        {/* Community Profile Section */}
        {communityProfile && (
          <SettingsSection icon={Users} title={t('settings_community_profile')}>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('settings_community_display_name')}</Label>
                <Input
                  value={communityDisplayName}
                  onChange={(e) => setCommunityDisplayName(e.target.value)}
                  placeholder={t('settings_community_display_name_placeholder')}
                  maxLength={120}
                  className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">{t('settings_community_bio')}</Label>
                <Textarea
                  value={communityBio}
                  onChange={(e) => setCommunityBio(e.target.value)}
                  placeholder={t('settings_community_bio_placeholder')}
                  maxLength={500}
                  rows={3}
                  className="bg-white/5 dark:bg-white/5 border border-white/15 dark:border-white/10 backdrop-blur-xl rounded-2xl shadow-[inset_0_1px_0_0_hsl(var(--foreground)/0.05)] focus:ring-2 focus:ring-primary/40 focus:border-primary/40 focus:bg-white/10 transition-all resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-left">{communityBio.length}/500</p>
              </div>

              {communityProfile.is_verified && (
                <div className="flex items-center gap-2 p-3 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/30 shadow-[inset_0_1px_0_0_hsl(var(--primary)/0.2)]">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">{t('settings_verified_account')}</span>
                </div>
              )}

              {(communityProfile.reputation_score != null && communityProfile.reputation_score > 0) && (
                <div className="flex items-center justify-between p-3 rounded-2xl bg-white/5 backdrop-blur-xl border border-white/15">
                  <span className="text-xs text-muted-foreground">{t('settings_reputation_score')}</span>
                  <span className="text-sm font-black text-foreground">{communityProfile.reputation_score}</span>
                </div>
              )}
            </div>
          </SettingsSection>
        )}

        {/* Appearance Section */}
        <SettingsSection icon={Palette} title="المظهر">
          <div className="space-y-3">
            <ThemeSwitcherInline />
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">بطاقة الملف الشخصي</p>
                <p className="text-xs text-muted-foreground">تغيير إطار وتصميم بطاقتك</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all  gap-1" onClick={() => navigate("/rewards?tab=cards")}>
                <CreditCard className="h-3.5 w-3.5" />
                تغيير
              </Button>
            </div>
          </div>
        </SettingsSection>

        {/* Security Section */}
        <SettingsSection icon={Lock} title="الأمان">
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">رمز PIN للمحفظة</p>
                <p className="text-xs text-muted-foreground">حماية المحفظة برمز PIN مكون من 4 أرقام</p>
              </div>
              <Button variant="outline" size="sm" className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all" onClick={() => setShowPinDialog(true)}>
                تعيين / تغيير
              </Button>
            </div>
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-foreground">تغيير كلمة المرور</p>
                <p className="text-xs text-muted-foreground">تحديث كلمة مرور حسابك</p>
              </div>
              <ChangePasswordButton />
            </div>
          </div>
        </SettingsSection>

        {/* Language Section */}
        <SettingsSection icon={Globe} title={t('settings_language')}>
          <div className="flex gap-2">
            {(['ar', 'en', 'ku'] as Language[]).map(lang => (
              <Button
                key={lang}
                variant={language === lang ? 'default' : 'outline'}
                size="sm"
                className={`flex-1 rounded-2xl backdrop-blur-xl border transition-all ${language === lang ? "bg-gradient-to-br from-primary/90 to-primary/70 text-primary-foreground border-white/20 shadow-[0_4px_16px_-2px_hsl(var(--primary)/0.4)]" : "bg-white/5 hover:bg-white/10 border-white/15 text-foreground"}`}
                onClick={() => setLanguage(lang)}
              >
                {LANGUAGE_LABELS[lang]}
              </Button>
            ))}
          </div>
        </SettingsSection>

        {/* Telegram Notifications */}
        <SettingsSection icon={Bell} title="إشعارات التليجرام">
          {!(profile as any)?.telegram_chat_id ? (
            <div className="text-center py-3 space-y-3">
              <p className="text-sm text-muted-foreground">لم يتم ربط حسابك بتليجرام بعد</p>
              <p className="text-xs text-muted-foreground">أرسل <span className="font-mono font-bold">/start</span> للبوت على تليجرام ثم أضف الـ Chat ID من صفحة الإشعارات</p>
              <Button
                variant="outline"
                size="sm"
                className="rounded-2xl bg-white/5 hover:bg-white/10 backdrop-blur-xl border border-white/20 hover:border-primary/40 text-foreground transition-all  gap-2"
                onClick={() => navigate('/notifications')}
              >
                <Bell className="h-4 w-4" />
                ربط حساب تليجرام
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {[
                { key: 'orders' as const, label: 'الطلبات', desc: 'إشعارات حالة الطلبات والشحن' },
                { key: 'wallet' as const, label: 'المحفظة', desc: 'إشعارات الإيداع والسحب' },
                { key: 'support' as const, label: 'الدعم', desc: 'رسائل خدمة العملاء' },
                { key: 'promotions' as const, label: 'العروض', desc: 'العروض والخصومات الجديدة' },
                { key: 'community_messages' as const, label: 'رسائل المجتمع', desc: 'رسائل محادثات السوق والتجار' },
                { key: 'print_offers' as const, label: 'عروض الطباعة', desc: 'عروض أسعار جديدة على طلباتك' },
                { key: 'merchant_updates' as const, label: 'تحديثات التاجر', desc: 'شارات التوثيق وتحديثات الحساب' },
              ].map(item => (
                <div key={item.key} className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-bold">{item.label}</p>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                  <Switch
                    checked={telegramNotifs[item.key] ?? true}
                    onCheckedChange={(checked) => setTelegramNotifs(prev => ({ ...prev, [item.key]: checked }))}
                  />
                </div>
              ))}
            </div>
          )}
        </SettingsSection>

        {/* Logout */}
        <Button
          variant="outline"
          className="w-full rounded-2xl h-12 text-destructive bg-destructive/10 hover:bg-destructive/20 backdrop-blur-xl border border-destructive/30 font-bold gap-2 transition-all"
          onClick={async () => {
            await signOut();
            navigate('/');
          }}
        >
          <LogOut className="h-4 w-4" />
          تسجيل الخروج
        </Button>
      </main>

      {/* Sticky Save Button */}
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2 pt-3 bg-gradient-to-t from-background via-background/80 to-transparent">
        <div className="container mx-auto max-w-2xl">
          <Button
            className="w-full rounded-2xl backdrop-blur-xl bg-gradient-to-br from-primary/90 to-primary/70 hover:from-primary hover:to-primary/80 text-primary-foreground border border-white/20 shadow-[0_8px_32px_-4px_hsl(var(--primary)/0.4),inset_0_1px_0_0_hsl(0_0%_100%/0.2)] transition-all hover:scale-[1.02] active:scale-[0.98] h-14 text-base font-black"
            disabled={loadingProfile || saveMutation.isPending}
            onClick={() => saveMutation.mutate()}
          >
            {saveMutation.isPending ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ الحفظ…
              </span>
            ) : (
              <span className="flex items-center gap-2">
                <Save className="h-4 w-4" />
                حفظ الإعدادات
              </span>
            )}
          </Button>
        </div>
      </div>

      {cropImageSrc && (
        <ImageCropper
          open={cropOpen}
          onOpenChange={setCropOpen}
          imageSrc={cropImageSrc}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          isUploading={false}
        />
      )}

      <WalletPinDialog
        open={showPinDialog}
        onOpenChange={setShowPinDialog}
        onVerified={() => toast({ title: "تم تعيين رمز PIN بنجاح ✓" })}
        mode="set"
      />
    </div>
  );
}
