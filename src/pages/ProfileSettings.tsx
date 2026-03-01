import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Loader2, ShieldCheck, ShieldAlert, Lock, Bell, Globe, User, MapPin, Save, LogOut, Users, FileText } from "lucide-react";
import { useLanguage, LANGUAGE_LABELS } from "@/lib/i18n";
import type { Language } from "@/lib/i18n";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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

// Section wrapper component
const SettingsSection = ({ icon: Icon, title, children, className }: { icon: any; title: string; children: React.ReactNode; className?: string }) => (
  <div className={cn("rounded-2xl border border-border/40 bg-card overflow-hidden", className)}>
    <div className="flex items-center gap-2.5 px-4 py-3 border-b border-border/30 bg-card">
      <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
        <Icon className="h-4 w-4 text-primary" />
      </div>
      <h2 className="text-sm font-black text-foreground">{title}</h2>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export default function ProfileSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user, signOut } = useAuth();
  const { t, language, setLanguage } = useLanguage();
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
      toast({ title: "رقم الهاتف غير صحيح", description: "أدخل رقم عراقي صحيح (07xxxxxxxxx)", variant: "destructive" });
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
      toast({ title: "تم تغيير رقم الهاتف" });
      setEditingPhone(false);
      setNewPhoneNumber("");
      qc.invalidateQueries({ queryKey: ["profile-settings-profile", user.id] });
    } catch (err: any) {
      toast({ title: "فشل في تغيير الرقم", description: err?.message, variant: "destructive" });
    } finally {
      setSavingPhone(false);
    }
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!fullName.trim()) throw new Error("الاسم مطلوب");

      if (phoneNumber && !isValidPhone(phoneNumber)) {
        throw new Error("رقم الهاتف غير صحيح.");
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
      toast({ title: "تم حفظ الإعدادات" });
      setAvatarFile(null);
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({ title: "تعذر الحفظ", description: "اسم المستخدم مستخدم بالفعل", variant: "destructive" });
        return;
      }
      if (err?.code === "P0001" && String(err?.message || "").includes("USERNAME_CHANGE_COOLDOWN")) {
        toast({ title: "تعذر الحفظ", description: "لا يمكن تغيير اسم المستخدم حالياً.", variant: "destructive" });
        return;
      }
      toast({ title: "تعذر الحفظ", description: err?.message ?? "حدث خطأ غير متوقع", variant: "destructive" });
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
    ? "يمكنك تغيير اليوزرنيم مرة كل 14 يوم."
    : `يمكن تغيير اسم المستخدم بعد ${cooldownDaysLeft} يوم`;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border/30">
        <div className="container mx-auto max-w-2xl px-4 py-3 flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate(-1)} className="h-9 w-9 rounded-xl">
            <ArrowRight className="h-4 w-4" />
          </Button>
          <h1 className="text-lg font-black text-foreground">الإعدادات</h1>
        </div>
      </div>

      <main className="container mx-auto max-w-2xl px-4 pt-4 pb-28 space-y-3">
        {/* Avatar Section - Centered */}
        <div className="flex flex-col items-center py-4">
          <div className="relative mb-3">
            <Avatar className="h-24 w-24 ring-4 ring-primary/20 shadow-lg">
              <AvatarImage src={previewAvatar} />
              <AvatarFallback className="bg-primary/10 text-primary text-2xl font-black">
                {((profile as any)?.username?.[0] || (profile as any)?.full_name?.[0] || "م").toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <Button
              type="button"
              size="icon"
              className="absolute -bottom-1 -left-1 h-9 w-9 rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90"
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
        <SettingsSection icon={User} title="المعلومات الشخصية">
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">الاسم</Label>
              <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك" className="rounded-xl" />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">اليوزرنيم</Label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                disabled={!canEditUsername}
                placeholder="مثال: levo_user"
                maxLength={30}
                className="rounded-xl"
              />
              <p className="text-[11px] text-muted-foreground">{usernameHint}</p>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs text-muted-foreground">رقم الهاتف</Label>
              {editingPhone ? (
                <div className="space-y-2">
                  <Input
                    value={newPhoneNumber}
                    onChange={(e) => setNewPhoneNumber(e.target.value)}
                    placeholder="07xxxxxxxxx"
                    inputMode="tel"
                    dir="ltr"
                    className="rounded-xl"
                  />
                  <div className="flex gap-2">
                    <Button size="sm" className="rounded-xl flex-1" onClick={handleSavePhone} disabled={savingPhone}>
                      {savingPhone && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
                      حفظ الرقم
                    </Button>
                    <Button size="sm" variant="outline" className="rounded-xl" onClick={() => { setEditingPhone(false); setNewPhoneNumber(""); }}>
                      إلغاء
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-2">
                  <Input value={phoneNumber || "—"} disabled placeholder="—" inputMode="tel" className="rounded-xl flex-1" />
                  {canEditPhone ? (
                    <Button size="sm" variant="outline" className="rounded-xl text-xs" onClick={() => { setEditingPhone(true); setNewPhoneNumber(phoneNumber); }}>
                      تغيير
                    </Button>
                  ) : (
                    <p className="text-[10px] text-muted-foreground whitespace-nowrap">بعد {phoneCooldownDaysLeft} يوم</p>
                  )}
                </div>
              )}
              <Badge variant={phoneVerified ? "secondary" : "outline"} className="gap-1.5 text-[11px]">
                {phoneVerified ? <ShieldCheck className="h-3 w-3" /> : <ShieldAlert className="h-3 w-3" />}
                {phoneVerified ? "تم تأكيد الرقم" : "غير مؤكد"}
              </Badge>
            </div>
          </div>
        </SettingsSection>

        {/* Default Address Section */}
        <SettingsSection icon={MapPin} title="العنوان الافتراضي">
          {loadingAddresses ? (
            <p className="text-sm text-muted-foreground">جارٍ تحميل العناوين…</p>
          ) : !addresses || addresses.length === 0 ? (
            <div className="text-center py-4">
              <p className="text-sm text-muted-foreground mb-3">لا توجد عناوين بعد</p>
              <Button variant="outline" size="sm" className="rounded-xl" onClick={() => navigate('/addresses')}>
                إضافة عنوان
              </Button>
            </div>
          ) : (
            <RadioGroup value={selectedDefaultAddressId} onValueChange={setSelectedDefaultAddressId}>
              <div className="space-y-2">
                {addresses.map((a: any) => {
                  const title = `${a.governorate} • ${a.area}${a.neighborhood ? ` • ${a.neighborhood}` : ""}`;
                  const sub = a.nearest_landmark ? `أقرب نقطة: ${a.nearest_landmark}` : "";
                  return (
                    <label
                      key={a.id}
                      className="flex items-start gap-3 rounded-xl border border-border/40 bg-background/50 p-3 cursor-pointer hover:border-primary/30 transition-colors"
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
          <SettingsSection icon={Users} title="ملف المجتمع">
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">الاسم المعروض في المجتمع</Label>
                <Input
                  value={communityDisplayName}
                  onChange={(e) => setCommunityDisplayName(e.target.value)}
                  placeholder="اسمك في مجتمع ليفو"
                  maxLength={120}
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-1.5">
                <Label className="text-xs text-muted-foreground">النبذة التعريفية</Label>
                <Textarea
                  value={communityBio}
                  onChange={(e) => setCommunityBio(e.target.value)}
                  placeholder="اكتب نبذة قصيرة عنك..."
                  maxLength={500}
                  rows={3}
                  className="rounded-xl resize-none"
                />
                <p className="text-[11px] text-muted-foreground text-left">{communityBio.length}/500</p>
              </div>

              {communityProfile.is_verified && (
                <div className="flex items-center gap-2 p-2.5 rounded-xl bg-primary/5 border border-primary/20">
                  <ShieldCheck className="h-4 w-4 text-primary" />
                  <span className="text-xs font-bold text-primary">حساب موثّق</span>
                </div>
              )}

              {(communityProfile.reputation_score != null && communityProfile.reputation_score > 0) && (
                <div className="flex items-center justify-between p-2.5 rounded-xl bg-muted/20 border border-border/30">
                  <span className="text-xs text-muted-foreground">نقاط السمعة</span>
                  <span className="text-sm font-black text-foreground">{communityProfile.reputation_score}</span>
                </div>
              )}
            </div>
          </SettingsSection>
        )}

        {/* Security Section */}
        <SettingsSection icon={Lock} title="الأمان">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-bold text-foreground">رمز PIN للمحفظة</p>
              <p className="text-xs text-muted-foreground">حماية المحفظة برمز PIN مكون من 4 أرقام</p>
            </div>
            <Button variant="outline" size="sm" className="rounded-xl" onClick={() => setShowPinDialog(true)}>
              تعيين / تغيير
            </Button>
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
                className="flex-1 rounded-xl"
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
            <div className="text-center py-3">
              <p className="text-sm text-muted-foreground mb-2">لم يتم ربط حسابك بتليجرام بعد</p>
              <p className="text-xs text-muted-foreground">أرسل <span className="font-mono font-bold">/start</span> للبوت على تليجرام ثم أضف الـ ID في ملفك الشخصي</p>
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
          className="w-full rounded-2xl h-12 text-destructive border-destructive/30 hover:bg-destructive/10 font-bold gap-2"
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
      <div className="fixed bottom-16 left-0 right-0 z-40 px-4 pb-2">
        <div className="container mx-auto max-w-2xl">
          <Button
            className="w-full rounded-xl h-12 text-base font-black shadow-lg"
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
