import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ArrowRight, Camera, Loader2, ShieldCheck, ShieldAlert } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import ImageCropper from "@/components/marketplace/ImageCropper";

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
  // Allow +9647xxxxxxxxx or 07xxxxxxxxx
  const digits = s.replace(/[^\d+]/g, "");
  return digits;
}

function isValidPhone(raw: string) {
  const v = normalizePhone(raw);
  return /^\+9647\d{8,9}$/.test(v) || /^07\d{8,9}$/.test(v);
}

export default function ProfileSettings() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement | null>(null);

  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [selectedDefaultAddressId, setSelectedDefaultAddressId] = useState<string>("");
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [cropOpen, setCropOpen] = useState(false);
  const [cropImageSrc, setCropImageSrc] = useState<string | null>(null);
  const cropObjectUrlRef = useRef<string | null>(null);

  const { data: profile, isLoading: loadingProfile } = useQuery({
    queryKey: ["profile-settings-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, username, avatar_url, phone_number, phone_verified, phone_verification_status, last_username_change_at"
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

  // Initialize local state once profile loads
  useMemo(() => {
    if (!profile) return;
    setFullName((prev) => (prev ? prev : (profile.full_name as string | null) ?? ""));
    setUsername((prev) => (prev ? prev : (profile.username as string | null) ?? ""));
  }, [profile]);

  useMemo(() => {
    if (!addresses || addresses.length === 0) return;
    const current = addresses.find((a: any) => a.is_default)?.id || "";
    setSelectedDefaultAddressId((prev) => prev || current);
  }, [addresses]);

  const cooldownDaysLeft = daysUntilAllowed((profile as any)?.last_username_change_at ?? null);
  const canEditUsername = cooldownDaysLeft === 0;

  const phoneVerified = Boolean((profile as any)?.phone_verified) || (profile as any)?.phone_verification_status === "verified";
  const phoneNumber = ((profile as any)?.phone_number as string | null) ?? "";

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!fullName.trim()) throw new Error("الاسم مطلوب");

      // Phone validation requirement (read-only here, but we still validate existing value for UX clarity)
      if (phoneNumber && !isValidPhone(phoneNumber)) {
        throw new Error("رقم الهاتف غير صحيح. الرجاء تحديثه عبر مسار التحقق.");
      }

      let nextAvatarUrl: string | null = (profile as any)?.avatar_url ?? null;

      if (avatarFile) {
        const fileExt = avatarFile.name.split(".").pop();
        const fileName = `${user.id}-${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from("product-images")
          .upload(`avatars/${fileName}`, avatarFile);
        if (uploadError) throw uploadError;

        const {
          data: { publicUrl },
        } = supabase.storage.from("product-images").getPublicUrl(`avatars/${fileName}`);
        nextAvatarUrl = publicUrl;
      }

      // Update profile basics
      const updatePayload: any = {
        full_name: fullName.trim(),
        avatar_url: nextAvatarUrl,
      };

      // Username rule: only attempt to change when allowed
      if (canEditUsername && username.trim() && username.trim() !== (profile as any)?.username) {
        updatePayload.username = username.trim();
      }

      const { error: profileError } = await supabase.from("profiles").update(updatePayload).eq("id", user.id);
      if (profileError) throw profileError;

      // Default address selection
      if (selectedDefaultAddressId) {
        const { error: clearErr } = await supabase
          .from("user_addresses")
          .update({ is_default: false })
          .eq("user_id", user.id);
        if (clearErr) throw clearErr;

        const { error: setErr } = await supabase
          .from("user_addresses")
          .update({ is_default: true })
          .eq("user_id", user.id)
          .eq("id", selectedDefaultAddressId);
        if (setErr) throw setErr;
      }

      return true;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["my-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["profile-settings-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["my-addresses", user?.id] }),
      ]);
      toast({ title: "تم حفظ الإعدادات" });
      setAvatarFile(null);
    },
    onError: (err: any) => {
      // Unique constraint
      if (err?.code === "23505") {
        toast({
          title: "تعذر الحفظ",
          description: "اسم المستخدم مستخدم بالفعل — الرجاء اختيار يوزرنيم مختلف.",
          variant: "destructive",
        });
        return;
      }

      // Username cooldown trigger
      if (err?.code === "P0001" && String(err?.message || "").includes("USERNAME_CHANGE_COOLDOWN")) {
        toast({
          title: "تعذر الحفظ",
          description: "لا يمكن تغيير اسم المستخدم حالياً. حاول لاحقاً.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "تعذر الحفظ",
        description: err?.message ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  useEffect(() => {
    return () => {
      if (cropObjectUrlRef.current) URL.revokeObjectURL(cropObjectUrlRef.current);
    };
  }, []);

  const previewAvatar = useMemo(() => {
    if (avatarFile) return URL.createObjectURL(avatarFile);
    return (profile as any)?.avatar_url || undefined;
  }, [avatarFile, profile]);

  useEffect(() => {
    if (!avatarFile || !previewAvatar) return;
    // previewAvatar is the object URL created above
    return () => URL.revokeObjectURL(previewAvatar);
  }, [avatarFile, previewAvatar]);

  const handlePickAvatar = (file: File | null) => {
    if (!file) return;
    if (cropObjectUrlRef.current) {
      URL.revokeObjectURL(cropObjectUrlRef.current);
      cropObjectUrlRef.current = null;
    }
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
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-24 pb-24 max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </div>

        <div className="space-y-4">
          <Card className="glass-effect border-border/50">
            <CardContent className="pt-6">
              <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
                <div className="relative">
                  <Avatar className="h-20 w-20 ring-4 ring-primary/20">
                    <AvatarImage src={previewAvatar} />
                    <AvatarFallback className="bg-primary/10 text-primary text-xl">
                      {((profile as any)?.username?.[0] || (profile as any)?.full_name?.[0] || "م").toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="absolute -bottom-2 -left-2 h-9 w-9 rounded-full"
                    onClick={() => fileRef.current?.click()}
                    aria-label="تغيير الصورة"
                  >
                    <Camera className="h-4 w-4" />
                  </Button>
                  <input
                    ref={fileRef}
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={(e) => handlePickAvatar(e.target.files?.[0] ?? null)}
                  />
                </div>

                <div className="flex-1 w-full">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">الاسم</Label>
                      <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="اسمك" />
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">رقم الهاتف</Label>
                      <Input value={phoneNumber || ""} disabled placeholder="—" inputMode="tel" />
                      <div className="flex flex-wrap items-center gap-2">
                        <Badge variant={phoneVerified ? "secondary" : "outline"} className="gap-2">
                          {phoneVerified ? (
                            <ShieldCheck className="h-3.5 w-3.5" />
                          ) : (
                            <ShieldAlert className="h-3.5 w-3.5" />
                          )}
                          <span>{phoneVerified ? "تم تأكيد الرقم" : "غير مؤكد"}</span>
                        </Badge>
                        {!phoneVerified && (
                          <span className="text-xs text-muted-foreground">(لا يوجد تحقق فعلي الآن — فقط حالة عرض)</span>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div className="space-y-2">
                      <Label className="text-xs">اليوزرنيم</Label>
                      <Input
                        value={username}
                        onChange={(e) => setUsername(e.target.value)}
                        disabled={!canEditUsername}
                        placeholder="مثال: levo_user"
                        maxLength={30}
                      />
                      <p className="text-xs text-muted-foreground">{usernameHint}</p>
                    </div>

                    <div className="space-y-2">
                      <Label className="text-xs">العنوان الافتراضي</Label>
                      {loadingAddresses ? (
                        <div className="rounded-xl border border-border bg-card/60 p-3 text-sm text-muted-foreground">
                          جارٍ تحميل العناوين…
                        </div>
                      ) : !addresses || addresses.length === 0 ? (
                        <div className="rounded-xl border border-border bg-card/60 p-3 text-sm text-muted-foreground">
                          لا توجد عناوين بعد. يمكنك إضافتها من صفحة العناوين.
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
                                  className="flex items-start gap-3 rounded-2xl border border-border bg-card/60 p-3 cursor-pointer hover:bg-card"
                                >
                                  <RadioGroupItem value={a.id} className="mt-1" />
                                  <div className="min-w-0">
                                    <div className="text-sm font-semibold text-foreground truncate">{title}</div>
                                    {sub && <div className="text-xs text-muted-foreground mt-1">{sub}</div>}
                                  </div>
                                </label>
                              );
                            })}
                          </div>
                        </RadioGroup>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Sticky save bar */}
        <div className="fixed bottom-0 left-0 right-0 z-40 border-t bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/70">
          <div className="container mx-auto px-4 py-3 max-w-4xl">
            <Button
              className="w-full"
              disabled={loadingProfile || saveMutation.isPending}
              onClick={() => saveMutation.mutate()}
            >
              <span className="inline-flex items-center justify-center gap-2">
                {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
                {saveMutation.isPending ? "جارٍ الحفظ…" : "حفظ"}
              </span>
            </Button>
          </div>
        </div>
      </main>

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
    </div>
  );
}
