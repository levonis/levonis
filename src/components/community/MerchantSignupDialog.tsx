import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { filterContent, validateDisplayName, validateBio } from "@/lib/contentFilter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Progress } from "@/components/ui/progress";

import { 
  CheckCircle2, 
  Clock, 
  Image as ImageIcon, 
  Store, 
  XCircle,
  Upload,
  User,
  MapPin,
  Phone,
  Calendar,
  Sparkles,
  ArrowRight,
  ArrowLeft,
  Send,
  FileText,
  Instagram,
  Facebook,
  BadgeCheck,
  Shield,
  Wallet,
  Loader2,
  Users
} from "lucide-react";

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

function StatusBadge({ status }: { status?: string | null }) {
  const config = {
    approved: { label: "مقبول", Icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10" },
    rejected: { label: "مرفوض", Icon: XCircle, color: "text-destructive bg-destructive/10" },
    pending: { label: "قيد المراجعة", Icon: Clock, color: "text-amber-500 bg-amber-500/10" },
    draft: { label: "مسودة", Icon: FileText, color: "text-muted-foreground bg-muted" },
  };
  const s = config[status as keyof typeof config] || config.draft;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium ${s.color}`}>
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </div>
  );
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

      // Content filtering for step1
      if (payload.step1) {
        const nameCheck = validateDisplayName(payload.step1.display_name);
        if (!nameCheck.isClean) {
          throw new Error("اسم المتجر يحتوي على كلمات غير مناسبة");
        }
        if (payload.step1.bio) {
          const bioCheck = validateBio(payload.step1.bio);
          if (!bioCheck.isClean) {
            throw new Error("وصف المتجر يحتوي على محتوى غير مناسب");
          }
        }
      }

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
  const fee = Number((app?.registration_fee as any) ?? 25000);
  const canEdit = app?.status !== "approved";

  const step1Ok = useMemo(() => {
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

  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;

  const stepInfo = [
    { num: 1, label: "معلومات المتجر", icon: Store },
    { num: 2, label: "بيانات التحقق", icon: Shield },
    { num: 3, label: "المراجعة والإرسال", icon: Send },
  ];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 border-primary/20 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-transparent border-b border-primary/20 p-6">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
          
          <div className="relative flex items-start justify-between gap-4">
            <div className="flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
                <div className="h-full w-full rounded-2xl bg-card flex items-center justify-center">
                  <Store className="h-6 w-6 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">التسجيل كتاجر</h2>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {profileMini?.username ? `@${profileMini.username}` : "انضم لمجتمع تجار ليفو"}
                </p>
              </div>
            </div>
            <StatusBadge status={app?.status} />
          </div>

          {/* Progress Steps */}
          <div className="relative mt-6">
            <Progress value={progressPercent} className="h-1.5 bg-muted/30" />
            <div className="flex justify-between mt-4">
              {stepInfo.map((s) => {
                const isActive = step === s.num;
                const isCompleted = step > s.num;
                const Icon = s.icon;
                
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => guardGoToStep(s.num as 1 | 2 | 3)}
                    disabled={s.num === 2 && !canNavigateTo2 || s.num === 3 && !canNavigateTo3}
                    className={`flex flex-col items-center gap-2 transition-all ${
                      isActive ? 'scale-105' : ''
                    } disabled:opacity-50`}
                  >
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center transition-all ${
                      isCompleted 
                        ? 'bg-primary text-primary-foreground shadow-lg shadow-primary/30' 
                        : isActive 
                          ? 'bg-primary/20 text-primary border-2 border-primary' 
                          : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-5 w-5" /> : <Icon className="h-5 w-5" />}
                    </div>
                    <span className={`text-[11px] font-medium ${
                      isActive ? 'text-primary' : 'text-muted-foreground'
                    }`}>
                      {s.label}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Content Area */}
        <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain" style={{ WebkitOverflowScrolling: 'touch' }}>
          <div className="p-6">
            {busy ? (
              <div className="space-y-4">
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-20 rounded-xl" />
                <Skeleton className="h-32 rounded-xl" />
              </div>
            ) : (
              <>
                {/* Admin Notes Alert */}
                {app?.admin_notes && (
                  <div className="mb-6 p-4 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <p className="text-sm font-medium text-amber-600 dark:text-amber-400">
                      ملاحظة الإدارة: {app.admin_notes}
                    </p>
                  </div>
                )}

                {/* Step 1: Store Info */}
                {step === 1 && (
                  <div className="space-y-5">
                    {/* Store Image Upload */}
                    <div className="space-y-3">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <ImageIcon className="h-4 w-4 text-primary" />
                        صورة/شعار المتجر
                      </Label>
                      <div className="flex items-center gap-4">
                        <div 
                          onClick={() => canEdit && fileInputRef.current?.click()}
                          className={`relative h-24 w-24 rounded-2xl border-2 border-dashed transition-all overflow-hidden group ${
                            canEdit ? 'cursor-pointer hover:border-primary' : ''
                          } ${storeImageUrl ? 'border-primary/50 bg-primary/5' : 'border-border bg-muted/30'}`}
                        >
                          {storeImageUrl ? (
                            <>
                              <img 
                                src={storeImageUrl} 
                                alt="صورة المتجر" 
                                className="h-full w-full object-cover"
                              />
                              {canEdit && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                  <Upload className="h-6 w-6 text-white" />
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                              <Upload className="h-6 w-6" />
                              <span className="text-[10px]">رفع صورة</span>
                            </div>
                          )}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-muted-foreground">
                            {storeImageUrl ? "تم رفع الصورة بنجاح" : "ارفع شعار أو صورة واضحة لمتجرك"}
                          </p>
                          <p className="text-xs text-muted-foreground/70 mt-1">
                            الحد الأقصى: 5 ميغابايت
                          </p>
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
                    </div>

                    {/* Store Name */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <Store className="h-4 w-4 text-primary" />
                        اسم المتجر
                      </Label>
                      <Input
                        value={step1.display_name}
                        disabled={!canEdit}
                        maxLength={15}
                        placeholder="مثال: متجر الطباعة"
                        onChange={(e) => setStep1((p) => ({ ...p, display_name: e.target.value }))}
                        className="h-12"
                      />
                      <p className={`text-xs ${step1.display_name.length > 15 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        {step1.display_name.length}/15 حرف
                      </p>
                    </div>

                    {/* Store Description */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <FileText className="h-4 w-4 text-primary" />
                        وصف المتجر
                      </Label>
                      <Textarea
                        value={step1.bio}
                        disabled={!canEdit}
                        onChange={(e) => setStep1((p) => ({ ...p, bio: e.target.value }))}
                        maxLength={500}
                        placeholder="اكتب وصفاً مختصراً عن متجرك وخدماتك..."
                        className="min-h-24 resize-none"
                      />
                    </div>

                    {/* Social Links */}
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Instagram className="h-4 w-4" />
                          إنستغرام (اختياري)
                        </Label>
                        <Input
                          value={step1.instagram}
                          disabled={!canEdit}
                          placeholder="رابط الحساب"
                          onChange={(e) => setStep1((p) => ({ ...p, instagram: e.target.value }))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <Facebook className="h-4 w-4" />
                          فيسبوك (اختياري)
                        </Label>
                        <Input
                          value={step1.facebook}
                          disabled={!canEdit}
                          placeholder="رابط الصفحة"
                          onChange={(e) => setStep1((p) => ({ ...p, facebook: e.target.value }))}
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 2: Verification Info */}
                {step === 2 && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 mb-6">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">معلومات خاصة للتحقق</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            هذه المعلومات تظهر للإدارة فقط ولن تكون مرئية للزبائن
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <User className="h-4 w-4 text-primary" />
                          الاسم الثلاثي الحقيقي
                        </Label>
                        <Input
                          value={step2.legal_full_name}
                          disabled={!canEdit}
                          placeholder="الاسم الكامل"
                          onChange={(e) => setStep2((p) => ({ ...p, legal_full_name: e.target.value }))}
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-medium flex items-center gap-2 text-muted-foreground">
                          <User className="h-4 w-4" />
                          اللقب (اختياري)
                        </Label>
                        <Input
                          value={step2.nickname}
                          disabled={!canEdit}
                          placeholder="اللقب"
                          onChange={(e) => setStep2((p) => ({ ...p, nickname: e.target.value }))}
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Phone className="h-4 w-4 text-primary" />
                          رقم الهاتف
                        </Label>
                        <Input
                          value={step2.phone_number}
                          disabled={!canEdit}
                          inputMode="tel"
                          placeholder="07xxxxxxxxx"
                          onChange={(e) => setStep2((p) => ({ ...p, phone_number: e.target.value }))}
                          className="h-12"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Calendar className="h-4 w-4 text-primary" />
                          تاريخ الميلاد
                        </Label>
                        <Input
                          type="date"
                          value={step2.birth_date}
                          disabled={!canEdit}
                          onChange={(e) => setStep2((p) => ({ ...p, birth_date: e.target.value }))}
                          className="h-12"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <Users className="h-4 w-4 text-primary" />
                          الجنس
                        </Label>
                        <div className="grid grid-cols-2 gap-2">
                          <Button
                            type="button"
                            variant={step2.gender === "male" ? "default" : "outline"}
                            disabled={!canEdit}
                            onClick={() => setStep2((p) => ({ ...p, gender: "male" }))}
                            className={`h-12 ${step2.gender === "male" ? "bg-primary text-primary-foreground" : "bg-card text-foreground border-border"}`}
                          >
                            ذكر
                          </Button>
                          <Button
                            type="button"
                            variant={step2.gender === "female" ? "default" : "outline"}
                            disabled={!canEdit}
                            onClick={() => setStep2((p) => ({ ...p, gender: "female" }))}
                            className={`h-12 ${step2.gender === "female" ? "bg-primary text-primary-foreground" : "bg-card text-foreground border-border"}`}
                          >
                            أنثى
                          </Button>
                        </div>
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm font-semibold flex items-center gap-2">
                          <MapPin className="h-4 w-4 text-primary" />
                          عنوان السكن
                        </Label>
                        <Input
                          value={step2.address}
                          disabled={!canEdit}
                          placeholder="المحافظة، المنطقة"
                          onChange={(e) => setStep2((p) => ({ ...p, address: e.target.value }))}
                          className="h-12"
                        />
                      </div>
                    </div>
                  </div>
                )}

                {/* Step 3: Summary & Submit */}
                {step === 3 && (
                  <div className="space-y-6">
                    {/* Summary Card */}
                    <div className="rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-5">
                      <div className="flex items-center gap-3 mb-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/20 flex items-center justify-center">
                          <BadgeCheck className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold text-lg">ملخص الطلب</h3>
                          <p className="text-sm text-muted-foreground">تحقق من المعلومات قبل الإرسال</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div className="space-y-1">
                          <span className="text-muted-foreground">اسم المتجر:</span>
                          <p className="font-medium">{step1.display_name || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground">يوزرنيم:</span>
                          <p className="font-medium">{profileMini?.username ? `@${profileMini.username}` : "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground">إنستغرام:</span>
                          <p className="font-medium truncate">{step1.instagram?.trim() || "—"}</p>
                        </div>
                        <div className="space-y-1">
                          <span className="text-muted-foreground">فيسبوك:</span>
                          <p className="font-medium truncate">{step1.facebook?.trim() || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Fee Card */}
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/5 p-5">
                      <div className="flex items-center gap-3">
                        <div className="h-12 w-12 rounded-xl bg-amber-500/20 flex items-center justify-center">
                          <Wallet className="h-6 w-6 text-amber-600 dark:text-amber-400" />
                        </div>
                        <div className="flex-1">
                          <h3 className="font-bold">رسوم التسجيل</h3>
                          <p className="text-2xl font-bold text-amber-600 dark:text-amber-400">
                            {fee.toLocaleString()} د.ع
                          </p>
                        </div>
                      </div>
                      <p className="text-xs text-muted-foreground mt-3">
                        سيتم خصم الرسوم تلقائياً من المحفظة عند موافقة الإدارة
                      </p>
                    </div>

                    {app?.status === "pending" && (
                      <p className="text-sm text-muted-foreground text-center p-4 bg-muted/30 rounded-xl">
                        ✓ طلبك قيد المراجعة - سنتواصل معك قريباً
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer Navigation */}
        <div className="border-t border-border/50 bg-muted/30 p-4 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep((step - 1) as 1 | 2)}
              className="gap-2"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Button>
          ) : (
            <div />
          )}

          {step < 3 ? (
            <Button
              type="button"
              disabled={!canEdit || (step === 1 && !step1Ok) || saveDraftMutation.isPending}
              onClick={async () => {
                if (step === 1) {
                  await saveDraftMutation.mutateAsync({ step1, store_image_url: storeImageUrl || null });
                  guardGoToStep(2);
                } else {
                  await saveDraftMutation.mutateAsync({ step2 });
                  guardGoToStep(3);
                }
              }}
              className="gap-2 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {saveDraftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  التالي
                  <ArrowLeft className="h-4 w-4" />
                </>
              )}
            </Button>
          ) : (
            <Button
              type="button"
              disabled={!canEdit || submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
              className="gap-2 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : (
                <>
                  <Send className="h-4 w-4" />
                  إرسال الطلب
                </>
              )}
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
