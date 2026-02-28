import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";

import AvatarCropper from "./AvatarCropper";
import CommunityMerchantTermsSheet from "./CommunityMerchantTermsSheet";
import EmailVerificationDialog from "@/components/auth/EmailVerificationDialog";

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
  Users,
  ScrollText,
  Mail,
  AtSign,
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
    approved: { label: "مقبول", Icon: CheckCircle2, color: "text-emerald-500 bg-emerald-500/10 border-emerald-500/30" },
    rejected: { label: "مرفوض", Icon: XCircle, color: "text-destructive bg-destructive/10 border-destructive/30" },
    pending: { label: "قيد المراجعة", Icon: Clock, color: "text-amber-500 bg-amber-500/10 border-amber-500/30" },
    draft: { label: "مسودة", Icon: FileText, color: "text-sky-400 bg-sky-500/15 border-sky-500/30" },
  };
  const s = config[status as keyof typeof config] || config.draft;
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border ${s.color}`}>
      <s.Icon className="h-3.5 w-3.5" />
      {s.label}
    </div>
  );
}

async function uploadStoreImage(params: { userId: string; file: File }) {
  // Always use .jpg since we compress to JPEG
  const path = `${params.userId}/store_${Date.now()}.jpg`;
  
  // Force contentType to image/jpeg since compression outputs JPEG
  const contentType = "image/jpeg";

  // First try to remove old file silently
  await supabase.storage.from("merchant_stores").remove([`${params.userId}/store.jpg`]).catch(() => {});

  const { error: uploadError } = await supabase.storage
    .from("merchant_stores")
    .upload(path, params.file, { upsert: true, contentType, cacheControl: "3600" });
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

  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  
  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);

  // Username state
  const [username, setUsername] = useState("");
  const [checkingUsername, setCheckingUsername] = useState(false);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | null>(null);
  const usernameTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const checkUsernameAvailability = useCallback(async (val: string) => {
    if (!val || val.length < 3) {
      setUsernameAvailable(null);
      return;
    }
    setCheckingUsername(true);
    const { data: existing } = await supabase
      .from("profiles")
      .select("id")
      .ilike("username", val)
      .neq("id", user?.id ?? "")
      .maybeSingle();
    setUsernameAvailable(!existing);
    setCheckingUsername(false);
  }, [user?.id]);

  const handleUsernameChange = (val: string) => {
    const cleaned = val.replace(/[^a-zA-Z0-9_]/g, "").slice(0, 30);
    setUsername(cleaned);
    setUsernameAvailable(null);
    if (usernameTimerRef.current) clearTimeout(usernameTimerRef.current);
    if (cleaned.length >= 3) {
      usernameTimerRef.current = setTimeout(() => checkUsernameAvailability(cleaned), 500);
    }
  };

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

  // Fetch registration fee from community_settings
  const { data: feeSettings } = useQuery({
    queryKey: ["merchant-registration-fee"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_settings")
        .select("value")
        .eq("key", "merchant_registration_fee")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
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
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsSheetOpen, setTermsSheetOpen] = useState(false);
  const [cropperOpen, setCropperOpen] = useState(false);
  const [pendingImageSrc, setPendingImageSrc] = useState<string>("");
  
  useEffect(() => setStep1(initialStep1), [initialStep1]);
  useEffect(() => setStep2(initialStep2), [initialStep2]);
  useEffect(() => setStoreImageUrl((app?.store_image_url as string | null) ?? ""), [app?.store_image_url]);
  useEffect(() => {
    if (profileMini?.username) setUsername(profileMini.username);
  }, [profileMini?.username]);

  const savingRef = useRef(false);

  const saveDraftMutation = useMutation({
    mutationFn: async (payload: { step1?: Step1; step2?: Step2; store_image_url?: string | null }) => {
      if (!user?.id) throw new Error("Not authenticated");
      if (savingRef.current) throw new Error("جارٍ الحفظ بالفعل");
      savingRef.current = true;

      try {
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

      // IMPORTANT: Only create/update application if we have meaningful data
      // This prevents empty draft records from appearing in admin
      const hasStep1Data = payload.step1 && payload.step1.display_name?.trim();
      const hasImageData = payload.store_image_url;
      
      if (!app?.id && !hasStep1Data && !hasImageData) {
        // Don't create empty drafts - require at least display_name or image
        throw new Error("يجب إدخال اسم المتجر أو رفع صورة المتجر أولاً");
      }

      // Ensure application row exists (draft) - only if we have data
      let appId = app?.id as string | undefined;
      if (!appId) {
        // Validate minimum required fields before creating draft
        if (!payload.step1?.display_name?.trim()) {
          throw new Error("يجب إدخال اسم المتجر لحفظ المسودة");
        }

        const { data, error } = await supabase
          .from("merchant_applications")
          .insert({ 
            user_id: user.id, 
            status: "draft",
            display_name: payload.step1.display_name.trim(),
          })
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

        // Save username to profiles table if changed - with fresh uniqueness check
        if (payload.step1 && username.length >= 3) {
          // Fresh server-side check right before saving
          const { data: existingUser } = await supabase
            .from("profiles")
            .select("id")
            .ilike("username", username)
            .neq("id", user!.id)
            .maybeSingle();
          
          if (existingUser) {
            setUsernameAvailable(false);
            throw new Error("اسم المستخدم مستخدم بالفعل، اختر اسماً آخر");
          }

          const { error: usernameError } = await supabase
            .from("profiles")
            .update({ username })
            .eq("id", user!.id);
          if (usernameError) {
            if (usernameError.message?.includes("unique")) {
              setUsernameAvailable(false);
              throw new Error("اسم المستخدم مستخدم بالفعل، اختر اسماً آخر");
            }
            throw usernameError;
          }
        }
      }

      if (payload.step2) {
        // Only validate and save step2 if it has meaningful data
        const hasStep2Data = payload.step2.legal_full_name?.trim() && 
                             payload.step2.address?.trim() && 
                             payload.step2.phone_number?.trim() &&
                             payload.step2.birth_date?.trim();
        
        if (hasStep2Data) {
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
      }

      return true;
      } finally {
        savingRef.current = false;
      }
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

      // Send Telegram notification with approve/reject buttons
      try {
        const storeName = step1.display_name || 'بدون اسم';
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🏪 <b>طلب تاجر جديد</b>\n\n👤 اسم المتجر: ${storeName}\n📝 الوصف: ${step1.bio?.substring(0, 100) || '-'}\n\n⏳ بانتظار الموافقة`,
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '✅ قبول التاجر', callback_data: `approve_merchant:${app?.id}` },
                  { text: '❌ رفض', callback_data: `reject_merchant:${app?.id}` },
                ]
              ]
            }
          },
        });
      } catch (e) { console.error('Telegram notification error:', e); }
    },
    onError: (err: any) => {
      toast({ title: "تعذر إرسال الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const uploadMutation = useMutation({
    mutationFn: async (blob: Blob) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      console.log("[MerchantUpload] Starting upload, blob size:", blob.size, "type:", blob.type);
      
      // Always compress the image for reliable uploads
      let finalBlob = blob;
      try {
        const img = new Image();
        const blobUrl = URL.createObjectURL(blob);
        await new Promise<void>((resolve, reject) => {
          const timeout = setTimeout(() => {
            URL.revokeObjectURL(blobUrl);
            reject(new Error("Image load timeout"));
          }, 10000);
          img.onload = () => { clearTimeout(timeout); resolve(); };
          img.onerror = () => { clearTimeout(timeout); URL.revokeObjectURL(blobUrl); reject(new Error("فشل تحميل الصورة")); };
          img.src = blobUrl;
        });
        const canvas = document.createElement("canvas");
        const maxDim = 600;
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        canvas.width = Math.round(img.width * scale) || 200;
        canvas.height = Math.round(img.height * scale) || 200;
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("No canvas context");
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        URL.revokeObjectURL(blobUrl);
        finalBlob = await new Promise<Blob>((resolve, reject) => {
          canvas.toBlob(
            (b) => (b ? resolve(b) : reject(new Error("فشل ضغط الصورة"))),
            "image/jpeg",
            0.65,
          );
        });
        console.log("[MerchantUpload] Compressed:", finalBlob.size, "bytes");
      } catch (compErr) {
        console.warn("[MerchantUpload] Compression failed, using original blob:", compErr);
        // If blob is too large without compression, try to limit it
        if (finalBlob.size > 2 * 1024 * 1024) {
          throw new Error("الصورة كبيرة جداً، يرجى اختيار صورة أصغر");
        }
      }
      
      const file = new File([finalBlob], "store.jpg", { type: "image/jpeg" });
      console.log("[MerchantUpload] Final file size:", file.size);

      // Retry upload up to 2 times on network failures
      let lastError: any;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          console.log("[MerchantUpload] Upload attempt", attempt + 1);
          const url = await uploadStoreImage({ userId: user.id, file });
          console.log("[MerchantUpload] Upload success:", url);
          setStoreImageUrl(url);
          if (app?.id) {
            await saveDraftMutation.mutateAsync({ store_image_url: url });
          }
          return url;
        } catch (err: any) {
          lastError = err;
          console.error("[MerchantUpload] Attempt", attempt + 1, "failed:", err?.message, err?.statusCode);
          const isNetworkError = err?.message?.includes("Failed to fetch") || 
                                  err?.message?.includes("NetworkError") ||
                                  err?.message?.includes("network") ||
                                  err?.message?.includes("timeout") ||
                                  err?.message?.includes("aborted");
          if (isNetworkError && attempt < 2) {
            await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
            continue;
          }
          throw err;
        }
      }
      throw lastError;
    },
    onError: (err: any) => {
      console.error("[MerchantUpload] Final error:", err);
      const msg = err?.message ?? "حدث خطأ";
      const isNetwork = msg.includes("Failed to fetch") || msg.includes("NetworkError") || msg.includes("network");
      const description = isNetwork
        ? "تحقق من اتصالك بالإنترنت أو جرب صورة أصغر حجماً" 
        : msg;
      toast({ title: "تعذر رفع الصورة", description, variant: "destructive" });
    },
  });

  const busy = appLoading || saveDraftMutation.isPending;
  // Use fee from community_settings (not app.registration_fee which may be outdated)
  const fee = Number((feeSettings?.value as any)?.amount ?? 0);
  const canEdit = app?.status !== "approved" && app?.status !== "pending";

  const step1Ok = useMemo(() => {
    return step1Schema.safeParse(step1).success && !!storeImageUrl && username.length >= 3 && usernameAvailable !== false;
  }, [step1, storeImageUrl, username, usernameAvailable]);

  const step2Ok = useMemo(() => step2Schema.safeParse(step2).success, [step2]);

  const canNavigateTo2 = !canEdit || step1Ok || step > 1;
  const canNavigateTo3 = !canEdit || (step1Ok && step2Ok) || step > 2;
  const canNavigateTo4 = !canEdit || (step1Ok && step2Ok && emailVerified) || step > 3;

  const guardGoToStep = (target: 1 | 2 | 3 | 4) => {
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
    if (target === 3) {
      if (!canNavigateTo3) {
        toast({
          title: "أكمل البيانات قبل المتابعة",
          description: "يرجى إكمال المرحلة الأولى والثانية",
          variant: "destructive",
        });
        return;
      }
      return setStep(3);
    }

    if (!canNavigateTo4) {
      toast({
        title: "التحقق من البريد مطلوب",
        description: "يرجى التحقق من بريدك الإلكتروني أولاً",
        variant: "destructive",
      });
      return;
    }
    return setStep(4);
  };

  const progressPercent = step === 1 ? 25 : step === 2 ? 50 : step === 3 ? 75 : 100;

  const stepInfo = [
    { num: 1, label: "المتجر", icon: Store },
    { num: 2, label: "التحقق", icon: Shield },
    { num: 3, label: "البريد", icon: Mail },
    { num: 4, label: "الإرسال", icon: Send },
  ];

  return (
    <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
      <DialogContent className="sm:max-w-2xl p-0 gap-0 border-primary/20 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-transparent border-b border-primary/20 p-4">
          <div className="absolute top-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl -translate-x-1/2 -translate-y-1/2" />
          
          <div className="relative flex items-center justify-between gap-3 mb-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
                <div className="h-full w-full rounded-xl bg-card flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
              </div>
              <div>
                <h2 className="text-base font-bold text-foreground">التسجيل كتاجر</h2>
                <p className="text-xs text-muted-foreground">
                  {profileMini?.username ? `@${profileMini.username}` : "انضم لمجتمع تجار ليفو"}
                </p>
              </div>
            </div>
            <StatusBadge status={app?.status} />
          </div>

          {/* Progress Steps - Compact */}
          <div className="relative">
            <Progress value={progressPercent} className="h-1 bg-muted/30" />
            <div className="flex justify-between mt-3">
              {stepInfo.map((s) => {
                const isActive = step === s.num;
                const isCompleted = step > s.num;
                const Icon = s.icon;
                const canNavigate = s.num === 1 || 
                  (s.num === 2 && canNavigateTo2) || 
                  (s.num === 3 && canNavigateTo3) || 
                  (s.num === 4 && canNavigateTo4);
                
                return (
                  <button
                    key={s.num}
                    type="button"
                    onClick={() => guardGoToStep(s.num as 1 | 2 | 3 | 4)}
                    disabled={!canNavigate}
                    className={`flex flex-col items-center gap-1 transition-all ${
                      isActive ? 'scale-105' : ''
                    } disabled:opacity-50`}
                  >
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                      isCompleted 
                        ? 'bg-primary text-primary-foreground shadow-md shadow-primary/30' 
                        : isActive 
                          ? 'bg-primary/20 text-primary border border-primary' 
                          : 'bg-muted/50 text-muted-foreground'
                    }`}>
                      {isCompleted ? <CheckCircle2 className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                    </div>
                    <span className={`text-[10px] font-medium ${
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
            ) : app?.status === "pending" ? (
              /* Pending Review Screen - Block resubmission */
              <div className="flex flex-col items-center text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-amber-500/15 flex items-center justify-center">
                  <Clock className="h-8 w-8 text-amber-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">طلبك قيد المراجعة</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  تم إرسال طلبك بنجاح وهو الآن قيد مراجعة الإدارة. سنعلمك عند الموافقة على طلبك أو في حال وجود أي ملاحظات.
                </p>
                <div className="p-3 rounded-xl bg-muted/30 border border-border/50 w-full max-w-sm">
                  <p className="text-xs text-muted-foreground">
                    تاريخ التقديم: {app?.created_at ? new Date(app.created_at).toLocaleDateString("ar-IQ") : "-"}
                  </p>
                </div>
                {app?.admin_notes && (
                  <div className="p-3 rounded-xl border border-amber-500/30 bg-amber-500/10 w-full max-w-sm">
                    <p className="text-sm text-amber-600 dark:text-amber-400">
                      ملاحظة الإدارة: {app.admin_notes}
                    </p>
                  </div>
                )}
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  حسناً
                </Button>
              </div>
            ) : app?.status === "approved" ? (
              /* Already approved screen */
              <div className="flex flex-col items-center text-center py-8 space-y-4">
                <div className="h-16 w-16 rounded-2xl bg-emerald-500/15 flex items-center justify-center">
                  <CheckCircle2 className="h-8 w-8 text-emerald-500" />
                </div>
                <h3 className="text-lg font-bold text-foreground">أنت تاجر معتمد!</h3>
                <p className="text-sm text-muted-foreground max-w-sm">
                  تم قبول طلبك ويمكنك الآن إدارة متجرك وتقديم العروض للعملاء.
                </p>
                <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                  حسناً
                </Button>
              </div>
            ) : (
              <>
                {/* Admin Notes Alert */}
                {app?.admin_notes && app?.status === "rejected" && (
                  <div className="mb-6 p-4 rounded-xl border border-destructive/30 bg-destructive/10">
                    <p className="text-sm font-medium text-destructive">
                      سبب الرفض: {app.admin_notes}
                    </p>
                    <p className="text-xs text-muted-foreground mt-1">
                      يمكنك تعديل بياناتك وإعادة إرسال الطلب
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
                          if (f) {
                            // Read file and open cropper
                            const reader = new FileReader();
                            reader.onload = () => {
                              setPendingImageSrc(reader.result as string);
                              setCropperOpen(true);
                            };
                            reader.readAsDataURL(f);
                          }
                          // Reset input
                          e.target.value = "";
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

                    {/* Username */}
                    <div className="space-y-2">
                      <Label className="text-sm font-semibold flex items-center gap-2">
                        <AtSign className="h-4 w-4 text-primary" />
                        اسم المستخدم (Username)
                      </Label>
                      <div className="relative">
                        <Input
                          value={username}
                          disabled={!canEdit}
                          maxLength={30}
                          placeholder="مثال: my_store"
                          onChange={(e) => handleUsernameChange(e.target.value)}
                          className={`h-12 ${
                            usernameAvailable === true ? 'ring-2 ring-emerald-500/50' : 
                            usernameAvailable === false ? 'ring-2 ring-destructive/50' : ''
                          }`}
                          dir="ltr"
                        />
                        {checkingUsername && (
                          <Loader2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
                        )}
                        {!checkingUsername && usernameAvailable === true && (
                          <CheckCircle2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-emerald-500" />
                        )}
                        {!checkingUsername && usernameAvailable === false && (
                          <XCircle className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-destructive" />
                        )}
                      </div>
                      <p className={`text-xs ${
                        usernameAvailable === false ? 'text-destructive' : 'text-muted-foreground'
                      }`}>
                        {usernameAvailable === false 
                          ? 'اسم المستخدم مستخدم بالفعل' 
                          : 'حروف إنجليزية، أرقام، و _ فقط (3 أحرف على الأقل)'}
                      </p>
                    </div>

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

                {/* Step 3: Email Verification */}
                {step === 3 && (
                  <div className="space-y-5">
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50 mb-4">
                      <div className="flex items-start gap-3">
                        <Mail className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                        <div>
                          <p className="text-sm font-medium">التحقق من البريد الإلكتروني</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            للتأكد من هويتك، يرجى التحقق من بريدك الإلكتروني
                          </p>
                        </div>
                      </div>
                    </div>

                    {/* Email Verification Card */}
                    <div className={`rounded-xl p-5 transition-all ${
                      emailVerified 
                        ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' 
                        : 'bg-background ring-1 ring-border/60'
                    }`}>
                      <div className="flex items-center gap-4">
                        <div className={`h-14 w-14 rounded-xl flex items-center justify-center shrink-0 ${
                          emailVerified 
                            ? 'bg-emerald-500/20' 
                            : 'bg-primary/10'
                        }`}>
                          {emailVerified ? (
                            <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                          ) : (
                            <Mail className="h-7 w-7 text-primary" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-base font-bold text-foreground">
                            {emailVerified ? 'تم التحقق بنجاح!' : 'البريد الإلكتروني'}
                          </p>
                          <p className="text-sm text-muted-foreground truncate">
                            {user?.email}
                          </p>
                        </div>
                        {!emailVerified && (
                          <Button
                            type="button"
                            onClick={() => setShowEmailVerification(true)}
                            className="shrink-0"
                          >
                            تحقق الآن
                          </Button>
                        )}
                      </div>
                    </div>

                    {emailVerified && (
                      <div className="rounded-xl bg-emerald-500/10 p-4 text-center">
                        <CheckCircle2 className="h-10 w-10 text-emerald-500 mx-auto mb-2" />
                        <p className="text-sm font-medium text-emerald-600">
                          تم التحقق من بريدك الإلكتروني بنجاح
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          يمكنك الآن المتابعة للخطوة التالية
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Step 4: Summary & Submit */}
                {step === 4 && (
                  <div className="space-y-5">
                    {/* Summary Card */}
                    <div className="rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent p-4">
                      <div className="flex items-center gap-3 mb-3">
                        <div className="h-10 w-10 rounded-lg bg-primary/20 flex items-center justify-center">
                          <BadgeCheck className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <h3 className="font-bold">ملخص الطلب</h3>
                          <p className="text-xs text-muted-foreground">تحقق من المعلومات</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-3 text-sm">
                        <div>
                          <span className="text-muted-foreground text-xs">اسم المتجر:</span>
                          <p className="font-medium">{step1.display_name || "—"}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">يوزرنيم:</span>
                          <p className="font-medium">{username ? `@${username}` : (profileMini?.username ? `@${profileMini.username}` : "—")}</p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">البريد:</span>
                          <p className="font-medium flex items-center gap-1">
                            <CheckCircle2 className="h-3 w-3 text-emerald-500" />
                            موثق
                          </p>
                        </div>
                        <div>
                          <span className="text-muted-foreground text-xs">الهاتف:</span>
                          <p className="font-medium">{step2.phone_number || "—"}</p>
                        </div>
                      </div>
                    </div>

                    {/* Fee Card */}
                    {fee > 0 ? (
                      <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-amber-500/20 flex items-center justify-center">
                            <Wallet className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-sm">رسوم التسجيل</h3>
                            <p className="text-xl font-bold text-amber-600 dark:text-amber-400">
                              {fee.toLocaleString()} د.ع
                            </p>
                          </div>
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-2">
                          سيتم خصم الرسوم من المحفظة عند موافقة الإدارة
                        </p>
                      </div>
                    ) : (
                      <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4">
                        <div className="flex items-center gap-3">
                          <div className="h-10 w-10 rounded-lg bg-emerald-500/20 flex items-center justify-center">
                            <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
                          </div>
                          <div className="flex-1">
                            <h3 className="font-medium text-emerald-600 dark:text-emerald-400">تسجيل مجاني</h3>
                            <p className="text-xs text-muted-foreground">لا توجد رسوم</p>
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Terms Checkbox */}
                    <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30 border border-border/50">
                      <Checkbox
                        id="merchant-terms"
                        checked={termsAccepted}
                        onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                        className="mt-0.5 h-4 w-4"
                      />
                      <div className="flex-1">
                        <label htmlFor="merchant-terms" className="text-sm cursor-pointer">
                          أوافق على{" "}
                          <button
                            type="button"
                            onClick={() => setTermsSheetOpen(true)}
                            className="text-primary underline font-medium"
                          >
                            شروط التجار
                          </button>
                        </label>
                      </div>
                    </div>

                    {app?.status === "pending" && (
                      <p className="text-sm text-muted-foreground text-center p-3 bg-muted/30 rounded-lg">
                        ✓ طلبك قيد المراجعة
                      </p>
                    )}
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Compact Footer */}
        <div className="border-t border-border/50 bg-muted/30 p-3 flex items-center justify-between gap-2">
          {step > 1 ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setStep((step - 1) as 1 | 2 | 3)}
              className="gap-1.5"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Button>
          ) : (
            <div />
          )}

          {step < 4 ? (
            <Button
              type="button"
              size="sm"
              disabled={
                !canEdit || 
                (step === 1 && !step1Ok) || 
                (step === 2 && !step2Ok) || 
                (step === 3 && !emailVerified) ||
                saveDraftMutation.isPending
              }
              onClick={async () => {
                try {
                  if (step === 1) {
                    await saveDraftMutation.mutateAsync({ step1, store_image_url: storeImageUrl || null });
                    setStep(2);
                  } else if (step === 2) {
                    const validation = step2Schema.safeParse(step2);
                    if (!validation.success) {
                      toast({
                        title: "أكمل البيانات المطلوبة",
                        description: "يرجى ملء جميع الحقول",
                        variant: "destructive",
                      });
                      return;
                    }
                    await saveDraftMutation.mutateAsync({ step2 });
                    setStep(3);
                  } else if (step === 3) {
                    if (!emailVerified) {
                      toast({
                        title: "التحقق مطلوب",
                        description: "يرجى التحقق من بريدك الإلكتروني",
                        variant: "destructive",
                      });
                      return;
                    }
                    setStep(4);
                  }
                } catch (error) {
                  // Error handled by mutation
                }
              }}
              className="gap-1.5 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {saveDraftMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : step === 3 && !emailVerified ? (
                <>
                  <Mail className="h-4 w-4" />
                  تحقق أولاً
                </>
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
              size="sm"
              disabled={!canEdit || !termsAccepted || submitMutation.isPending}
              onClick={() => {
                if (!termsAccepted) {
                  toast({
                    title: "الموافقة مطلوبة",
                    description: "يرجى الموافقة على الشروط",
                    variant: "destructive",
                  });
                  return;
                }
                const confirmed = window.confirm(
                  "⚠️ تنبيه مهم:\n\nبمجرد تقديم طلب التاجر والموافقة عليه، سيتم حذف جميع طلبات الطباعة السابقة والحالية الخاصة بك من المجتمع نهائياً.\n\nهل تريد المتابعة؟"
                );
                if (!confirmed) return;
                submitMutation.mutate();
              }}
              className="gap-1.5 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25"
            >
              {submitMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جارٍ الإرسال...
                </>
              ) : !termsAccepted ? (
                <>
                  <ScrollText className="h-4 w-4" />
                  وافق على الشروط
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

        {/* Image Cropper */}
        <AvatarCropper
          open={cropperOpen}
          onOpenChange={(open) => {
            setCropperOpen(open);
            if (!open) setPendingImageSrc("");
          }}
          imageSrc={pendingImageSrc}
          onCropComplete={(blob) => {
            uploadMutation.mutate(blob);
          }}
        />

        {/* Merchant Terms Sheet */}
        <CommunityMerchantTermsSheet
          open={termsSheetOpen}
          onOpenChange={setTermsSheetOpen}
          onAccept={() => setTermsAccepted(true)}
        />

        {/* Email Verification Dialog */}
        <EmailVerificationDialog
          open={showEmailVerification}
          onOpenChange={setShowEmailVerification}
          email={user?.email || ""}
          type="signup"
          userId={user?.id}
          onVerified={() => {
            setEmailVerified(true);
            setShowEmailVerification(false);
          }}
        />
      </DialogContent>
    </Dialog>
  );
}
