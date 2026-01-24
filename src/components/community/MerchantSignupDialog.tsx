import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

import { CheckCircle2, Clock, Image as ImageIcon, Store, XCircle } from "lucide-react";

const step1Schema = z.object({
  display_name: z.string().trim().min(2, "اسم المتجر مطلوب (2 حروف على الأقل)").max(15, "اسم المتجر يجب أن لا يتجاوز 15 حرف"),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
  instagram: z.string().trim().max(200).optional().or(z.literal("")),
  facebook: z.string().trim().max(200).optional().or(z.literal("")),
});

const step2Schema = z.object({
  legal_full_name: z.string().trim().min(5, "الاسم الثلاثي مطلوب").max(200),
  nickname: z.string().trim().max(120).optional().or(z.literal("")),
  address: z.string().trim().min(5, "العنوان مطلوب").max(300),
  phone_number: z.string().trim().min(7, "رقم الهاتف مطلوب").max(30),
  gender: z.enum(["male", "female"], { required_error: "الجنس مطلوب" }),
  birth_date: z.string().min(1, "تاريخ الميلاد مطلوب"),
});

type Step1 = z.infer<typeof step1Schema>;
type Step2 = z.infer<typeof step2Schema>;

function statusBadge(status?: string | null) {
  if (status === "approved") return { label: "مقبول", Icon: CheckCircle2 };
  if (status === "rejected") return { label: "مرفوض", Icon: XCircle };
  if (status === "pending") return { label: "قيد المراجعة", Icon: Clock };
  return { label: "مسودة", Icon: Clock };
}

async function uploadStoreImage(params: { userId: string; file: File }) {
  const ext = params.file.name.split(".").pop() || "jpg";
  const path = `${params.userId}/store.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from("merchant_stores")
    .upload(path, params.file, { upsert: true, contentType: params.file.type });
  if (uploadError) throw uploadError;

  const { data } = supabase.storage.from("merchant_stores").getPublicUrl(path);
  return data.publicUrl;
}

export default function MerchantSignupDialog({
  open,
  onOpenChange,
  defaultOpen = false,
}: {
  open?: boolean;
  onOpenChange?: (v: boolean) => void;
  /** When used as a standalone route wrapper */
  defaultOpen?: boolean;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const [internalOpen, setInternalOpen] = useState(defaultOpen);
  const isControlled = typeof open === "boolean" && !!onOpenChange;
  const dialogOpen = isControlled ? (open as boolean) : internalOpen;
  const setDialogOpen = (v: boolean) => (isControlled ? onOpenChange!(v) : setInternalOpen(v));

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const { data: profileMini } = useQuery({
    queryKey: ["community-profile-mini", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username, phone_number, full_name, birth_date, gender")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: app, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select(
          "id, status, admin_notes, display_name, bio, store_image_url, social_links, registration_fee, fee_status, created_at",
        )
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: privateRow } = useQuery({
    queryKey: ["merchant-application-private", app?.id],
    enabled: !!app?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_application_private")
        .select("application_id, legal_full_name, nickname, address, phone_number, gender, birth_date")
        .eq("application_id", app!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const initialStep1 = useMemo<Step1>(
    () => ({
      display_name: (app?.display_name as string | null) ?? "",
      bio: (app?.bio as string | null) ?? "",
      instagram: (app?.social_links as any)?.instagram ?? "",
      facebook: (app?.social_links as any)?.facebook ?? "",
    }),
    [app],
  );

  const initialStep2 = useMemo<Step2>(
    () => ({
      legal_full_name: (privateRow?.legal_full_name as string | null) ?? (profileMini?.full_name as string | null) ?? "",
      nickname: (privateRow?.nickname as string | null) ?? "",
      address: (privateRow?.address as string | null) ?? "",
      phone_number: (privateRow?.phone_number as string | null) ?? (profileMini?.phone_number as string | null) ?? "",
      gender: ((privateRow?.gender as any) ?? (profileMini?.gender as any) ?? "male") === "female" ? "female" : "male",
      birth_date: privateRow?.birth_date ? String(privateRow.birth_date) : profileMini?.birth_date ? String(profileMini.birth_date) : "",
    }),
    [privateRow, profileMini],
  );

  const [step1, setStep1] = useState<Step1>(initialStep1);
  const [step2, setStep2] = useState<Step2>(initialStep2);
  const [storeImageUrl, setStoreImageUrl] = useState<string>((app?.store_image_url as string | null) ?? "");
  useEffect(() => setStep1(initialStep1), [initialStep1]);
  useEffect(() => setStep2(initialStep2), [initialStep2]);
  useEffect(() => setStoreImageUrl((app?.store_image_url as string | null) ?? ""), [app?.store_image_url]);

  const saveDraftMutation = useMutation({
    mutationFn: async (payload: { step1?: Step1; step2?: Step2; store_image_url?: string | null }) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Ensure application row exists (draft)
      let appId = app?.id as string | undefined;
      if (!appId) {
        const { data, error } = await supabase
          .from("merchant_applications")
          .insert({ user_id: user.id, status: "draft" })
          .select("id")
          .single();
        if (error) throw error;
        appId = data.id;
      }

      if (payload.step1 || payload.store_image_url !== undefined) {
        const s1 = payload.step1 ? step1Schema.parse(payload.step1) : null;
        const social_links = s1
          ? {
              instagram: s1.instagram?.trim() || null,
              facebook: s1.facebook?.trim() || null,
            }
          : undefined;

        const { error } = await supabase
          .from("merchant_applications")
          .update({
            ...(s1
              ? {
                  display_name: s1.display_name,
                  bio: s1.bio?.trim() ? s1.bio.trim() : null,
                  social_links,
                }
              : {}),
            ...(payload.store_image_url !== undefined ? { store_image_url: payload.store_image_url } : {}),
            // keep pending/approved/rejected as-is
            ...(app?.status ? {} : { status: "draft" }),
          })
          .eq("id", appId);
        if (error) throw error;
      }

      if (payload.step2) {
        const s2 = step2Schema.parse(payload.step2);
        const row = {
          application_id: appId,
          legal_full_name: s2.legal_full_name,
          nickname: s2.nickname?.trim() ? s2.nickname.trim() : null,
          address: s2.address,
          phone_number: s2.phone_number,
          gender: s2.gender,
          birth_date: s2.birth_date,
        };

        const { error } = await supabase
          .from("merchant_application_private")
          .upsert(row, { onConflict: "application_id" });
        if (error) throw error;
      }

      return true;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["merchant-application", user?.id] }),
        qc.invalidateQueries({ queryKey: ["merchant-application-private"] }),
      ]);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حفظ المسودة", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      if (!app?.id) throw new Error("لا توجد مسودة");

      // Validate final required fields before submit
      step1Schema.parse(step1);
      step2Schema.parse(step2);
      if (!storeImageUrl) throw new Error("صورة المتجر مطلوبة");

      // Ensure drafts are persisted
      await saveDraftMutation.mutateAsync({ step1, step2, store_image_url: storeImageUrl });

      const { error } = await supabase
        .from("merchant_applications")
        .update({ status: "pending" })
        .eq("id", app.id);
      if (error) throw error;

      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["merchant-application", user?.id] });
      toast({
        title: "تم إرسال طلب التسجيل كتاجر",
        description: "سيتم خصم الرسوم من المحفظة عند موافقة الإدارة",
      });
      setStep(1);
    },
    onError: (err: any) => {
      toast({ title: "تعذر إرسال الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");
      const url = await uploadStoreImage({ userId: user.id, file });
      setStoreImageUrl(url);
      await saveDraftMutation.mutateAsync({ store_image_url: url });
      return url;
    },
    onError: (err: any) => {
      toast({ title: "تعذر رفع الصورة", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const busy = appLoading || saveDraftMutation.isPending;
  const s = statusBadge(app?.status);
  const fee = Number((app?.registration_fee as any) ?? 25000);

  const canEdit = app?.status !== "approved"; // allow editing draft/pending/rejected

  const step1Ok = useMemo(() => {
    // Step 1 requires the public fields + store image
    return step1Schema.safeParse(step1).success && !!storeImageUrl;
  }, [step1, storeImageUrl]);

  const step2Ok = useMemo(() => step2Schema.safeParse(step2).success, [step2]);

  const canNavigateTo2 = !canEdit || step1Ok || step > 1;
  const canNavigateTo3 = !canEdit || (step1Ok && step2Ok) || step > 2;

  const guardGoToStep = (target: 1 | 2 | 3) => {
    if (target === 1) return setStep(1);
    if (target === 2) {
      if (!canNavigateTo2) {
        toast({
          title: "أكمل المرحلة الأولى أولاً",
          description: "يرجى إدخال اسم المتجر ورفع صورة المتجر ثم اضغط التالي",
          variant: "destructive",
        });
        return;
      }
      return setStep(2);
    }

    // target === 3
    if (!canNavigateTo3) {
      toast({
        title: "أكمل البيانات قبل المتابعة",
        description: "يرجى إكمال المرحلة الأولى والثانية ثم اضغط التالي",
        variant: "destructive",
      });
      return;
    }
    return setStep(3);
  };

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-3xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Store className="h-5 w-5 text-primary" />
            التسجيل كتاجر
          </DialogTitle>
        </DialogHeader>

        <div className="scrollbar-stable max-h-[75vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-4">
            <Card className="border-border bg-card">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <s.Icon className="h-5 w-5 text-primary" />
                  حالة الطلب: {s.label}
                </CardTitle>
                <CardDescription>
                  {app?.admin_notes ? `ملاحظة الإدارة: ${app.admin_notes}` : "أكمل المراحل ثم أرسل الطلب"}
                </CardDescription>
              </CardHeader>
              <CardContent>
                {busy ? (
                  <div className="space-y-3">
                    <Skeleton className="h-10 rounded-xl" />
                    <Skeleton className="h-10 rounded-xl" />
                    <Skeleton className="h-24 rounded-xl" />
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-xs text-muted-foreground">
                      المرحلة {step} من 3
                      {profileMini?.username ? ` • يوزرنيم: @${profileMini.username}` : ""}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button variant={step === 1 ? "default" : "outline"} size="sm" onClick={() => setStep(1)}>
                        1
                      </Button>
                      <Button
                        variant={step === 2 ? "default" : "outline"}
                        size="sm"
                        disabled={!canNavigateTo2}
                        onClick={() => guardGoToStep(2)}
                      >
                        2
                      </Button>
                      <Button
                        variant={step === 3 ? "default" : "outline"}
                        size="sm"
                        disabled={!canNavigateTo3}
                        onClick={() => guardGoToStep(3)}
                      >
                        3
                      </Button>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Step 1 */}
            {step === 1 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>المرحلة الأولى: معلومات المتجر</CardTitle>
                  <CardDescription>هذه المعلومات تظهر للزبائن داخل المجتمع.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <Label>صورة المتجر</Label>
                    <div className="flex flex-col sm:flex-row gap-3 sm:items-center">
                      <div className="flex items-center gap-3">
                        <div className="h-14 w-14 rounded-2xl border border-border bg-muted/20 overflow-hidden flex items-center justify-center">
                          {storeImageUrl ? (
                            <img src={storeImageUrl} alt="صورة المتجر" className="h-full w-full object-cover" loading="lazy" />
                          ) : (
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          )}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {storeImageUrl ? "تم رفع الصورة" : "ارفع صورة واضحة لشعار/واجهة المتجر"}
                        </div>
                      </div>

                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(e) => {
                          const f = e.target.files?.[0];
                          if (f) uploadMutation.mutate(f);
                        }}
                      />

                      <div className="flex gap-2">
                        <Button
                          type="button"
                          variant="outline"
                          disabled={!canEdit || uploadMutation.isPending}
                          onClick={() => fileInputRef.current?.click()}
                        >
                          {uploadMutation.isPending ? "جارٍ الرفع…" : "رفع صورة"}
                        </Button>
                        {storeImageUrl && canEdit && (
                          <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                              setStoreImageUrl("");
                              saveDraftMutation.mutate({ store_image_url: null });
                            }}
                          >
                            إزالة
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>اسم المتجر</Label>
                      <Input
                        value={step1.display_name}
                        disabled={!canEdit}
                        maxLength={15}
                        onChange={(e) => setStep1((p) => ({ ...p, display_name: e.target.value }))}
                      />
                      <p className={`text-xs ${step1.display_name.length > 15 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {step1.display_name.length}/15 حرف كحد أقصى
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>يوزرنيم (من الملف الشخصي)</Label>
                      <Input value={profileMini?.username ? `@${profileMini.username}` : ""} disabled />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>وصف المتجر</Label>
                    <Textarea
                      value={step1.bio}
                      disabled={!canEdit}
                      onChange={(e) => setStep1((p) => ({ ...p, bio: e.target.value }))}
                      maxLength={500}
                      className="min-h-24"
                    />
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>رابط إنستغرام (اختياري)</Label>
                      <Input
                        value={step1.instagram}
                        disabled={!canEdit}
                        onChange={(e) => setStep1((p) => ({ ...p, instagram: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>رابط فيسبوك (اختياري)</Label>
                      <Input
                        value={step1.facebook}
                        disabled={!canEdit}
                        onChange={(e) => setStep1((p) => ({ ...p, facebook: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-end gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={async () => {
                        await saveDraftMutation.mutateAsync({ step1, store_image_url: storeImageUrl || null });
                        guardGoToStep(2);
                      }}
                    >
                      التالي
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 2 */}
            {step === 2 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>المرحلة الثانية: معلومات خاصة (للإدارة فقط)</CardTitle>
                  <CardDescription>هذه المعلومات تظهر للإدارة فقط لأغراض التحقق.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الاسم الثلاثي الحقيقي</Label>
                      <Input
                        value={step2.legal_full_name}
                        disabled={!canEdit}
                        onChange={(e) => setStep2((p) => ({ ...p, legal_full_name: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>اللقب (اختياري)</Label>
                      <Input
                        value={step2.nickname}
                        disabled={!canEdit}
                        onChange={(e) => setStep2((p) => ({ ...p, nickname: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>رقم الهاتف</Label>
                      <Input
                        value={step2.phone_number}
                        disabled={!canEdit}
                        inputMode="tel"
                        onChange={(e) => setStep2((p) => ({ ...p, phone_number: e.target.value }))}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>تاريخ الميلاد</Label>
                      <Input
                        type="date"
                        value={step2.birth_date}
                        disabled={!canEdit}
                        onChange={(e) => setStep2((p) => ({ ...p, birth_date: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>الجنس</Label>
                      <div className="grid grid-cols-2 gap-2">
                        <Button
                          type="button"
                          variant={step2.gender === "male" ? "default" : "outline"}
                          disabled={!canEdit}
                          onClick={() => setStep2((p) => ({ ...p, gender: "male" }))}
                        >
                          ذكر
                        </Button>
                        <Button
                          type="button"
                          variant={step2.gender === "female" ? "default" : "outline"}
                          disabled={!canEdit}
                          onClick={() => setStep2((p) => ({ ...p, gender: "female" }))}
                        >
                          أنثى
                        </Button>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label>عنوان السكن</Label>
                      <Input
                        value={step2.address}
                        disabled={!canEdit}
                        onChange={(e) => setStep2((p) => ({ ...p, address: e.target.value }))}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(1)}>
                      رجوع
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      disabled={!canEdit}
                      onClick={async () => {
                        await saveDraftMutation.mutateAsync({ step2 });
                        guardGoToStep(3);
                      }}
                    >
                      التالي
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Step 3 */}
            {step === 3 && (
              <Card className="border-border bg-card">
                <CardHeader>
                  <CardTitle>المرحلة الثالثة: الرسوم + ملخص</CardTitle>
                  <CardDescription>
                    رسوم التسجيل الحالية: {fee.toLocaleString()} د.ع — يتم خصمها من المحفظة عند موافقة الإدارة.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="rounded-2xl border border-border bg-muted/20 p-4 text-sm">
                    <p className="font-bold">ملخص الطلب</p>
                    <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 text-muted-foreground">
                      <div>اسم المتجر: {step1.display_name || "—"}</div>
                      <div>يوزرنيم: {profileMini?.username ? `@${profileMini.username}` : "—"}</div>
                      <div>إنستغرام: {step1.instagram?.trim() || "—"}</div>
                      <div>فيسبوك: {step1.facebook?.trim() || "—"}</div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between gap-2">
                    <Button type="button" variant="outline" onClick={() => setStep(2)}>
                      رجوع
                    </Button>
                    <Button
                      type="button"
                      disabled={!canEdit || submitMutation.isPending}
                      className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                      onClick={() => submitMutation.mutate()}
                    >
                      {submitMutation.isPending ? "جارٍ الإرسال…" : "إرسال الطلب"}
                    </Button>
                  </div>

                  {app?.status === "pending" && (
                    <p className="text-xs text-muted-foreground">
                      ملاحظة: عند موافقة الإدارة سيتم خصم الرسوم تلقائياً من المحفظة، وإذا كان الرصيد غير كافٍ لن تتم الموافقة.
                    </p>
                  )}
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
