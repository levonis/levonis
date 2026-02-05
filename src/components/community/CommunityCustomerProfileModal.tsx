import { useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { filterContent, validateUsername } from "@/lib/contentFilter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Checkbox } from "@/components/ui/checkbox";
import AvatarCropper from "./AvatarCropper";
import CommunityTermsSheet from "./CommunityTermsSheet";
import EmailVerificationDialog from "@/components/auth/EmailVerificationDialog";
import { 
  Loader2, 
  UserCircle2, 
  Phone, 
  AtSign, 
  Calendar, 
  Users, 
  FileText,
  Sparkles,
  CheckCircle2,
  Store,
  Camera,
  ScrollText,
  Shield,
  Zap,
  Crown,
  BadgeCheck,
  ArrowLeft,
  ArrowRight,
  Mail,
} from "lucide-react";

const DEFAULT_AVATAR_URL = "/placeholder.svg";

const formSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب").max(120),
  phoneNumber: z
    .string()
    .trim()
    .min(10, "رقم الهاتف مطلوب")
    .max(20)
    .refine(
      (v) => /^\+9647\d{8,9}$/.test(v.replace(/[^\d+]/g, "")) || /^07\d{8,9}$/.test(v.replace(/[^\d+]/g, "")),
      "صيغة رقم الهاتف غير صحيحة"
    ),
  username: z.string().trim().min(3, "اليوزرنيم مطلوب").max(30),
  birthDate: z.string().min(1, "تاريخ الميلاد مطلوب"),
  gender: z.enum(["male", "female"], { required_error: "الجنس مطلوب" }),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

interface FieldConfig {
  id: keyof FormValues;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  type?: string;
  hint?: string;
  maxLength?: number;
}

export default function CommunityCustomerProfileModal({
  onDone,
  onLater,
  showMerchantCta = true,
  onOpenMerchantSignup,
}: {
  onDone?: () => void;
  onLater?: () => void;
  showMerchantCta?: boolean;
  onOpenMerchantSignup?: () => void;
}) {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const [loadingUi, setLoadingUi] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string>("");
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // Step state
  const [step, setStep] = useState<1 | 2>(1);
  
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string>("");
  
  // Terms state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  
  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false);
  const [showEmailVerification, setShowEmailVerification] = useState(false);

  useEffect(() => {
    const t = window.setTimeout(() => setLoadingUi(false), 200);
    return () => window.clearTimeout(t);
  }, []);

  const { data: profile, isLoading } = useQuery({
    queryKey: ["community-profile-full", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, birth_date, gender, bio, avatar_url, email_verified")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  useEffect(() => {
    if (profile?.avatar_url) {
      setAvatarUrl(profile.avatar_url as string);
    }
    if (profile?.email_verified) {
      setEmailVerified(true);
    }
  }, [profile?.avatar_url, profile?.email_verified]);

  const defaults = useMemo<FormValues>(
    () => ({
      fullName: (profile?.full_name as string | null) ?? "",
      phoneNumber: (profile?.phone_number as string | null) ?? "",
      username: (profile?.username as string | null) ?? "",
      birthDate: profile?.birth_date ? String(profile.birth_date) : "",
      gender: (profile?.gender === "female" ? "female" : "male") as "male" | "female",
      bio: (profile?.bio as string | null) ?? "",
    }),
    [profile]
  );

  const form = useForm<FormValues>({
    resolver: zodResolver(formSchema),
    values: defaults,
    mode: "onChange",
  });

  // Avatar upload mutation
  const uploadAvatarMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      const fileExt = file.name.split('.').pop();
      const fileName = `${Date.now()}.${fileExt}`;
      const filePath = `avatars/${user.id}/${fileName}`;
      
      const { error: uploadError } = await supabase.storage
        .from('product-images')
        .upload(filePath, file, { upsert: true });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('product-images')
        .getPublicUrl(filePath);
      
      return publicUrl;
    },
    onSuccess: (url) => {
      setAvatarUrl(url);
      toast({ title: "تم رفع الصورة بنجاح" });
    },
    onError: (err: any) => {
      toast({ 
        title: "تعذر رفع الصورة", 
        description: err?.message ?? "حدث خطأ", 
        variant: "destructive" 
      });
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    
    const file = files[0];
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "الملف كبير جداً",
        description: "الحد الأقصى لحجم الصورة هو 5 ميغابايت",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    const validTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/heif'];
    const isValidType = file.type.startsWith('image/') || validTypes.some(t => file.type.includes(t.split('/')[1]));
    
    if (!isValidType) {
      toast({
        title: "نوع الملف غير مدعوم",
        description: "الرجاء اختيار صورة (JPEG, PNG, WebP)",
        variant: "destructive",
      });
      e.target.value = "";
      return;
    }

    try {
      const objectUrl = URL.createObjectURL(file);
      setRawImageSrc(objectUrl);
      setCropperOpen(true);
    } catch (err) {
      toast({
        title: "تعذر قراءة الصورة",
        description: "الرجاء المحاولة مرة أخرى",
        variant: "destructive",
      });
    }
    
    e.target.value = "";
  };

  const handleCroppedImage = async (blob: Blob) => {
    if (!blob || blob.size === 0) {
      toast({
        title: "فشل قص الصورة",
        description: "الرجاء المحاولة مرة أخرى",
        variant: "destructive",
      });
      return;
    }
    
    setUploadingAvatar(true);
    try {
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      await uploadAvatarMutation.mutateAsync(file);
    } catch (error) {
      console.error("[AvatarUpload] Upload failed:", error);
    } finally {
      setUploadingAvatar(false);
      if (rawImageSrc) {
        URL.revokeObjectURL(rawImageSrc);
        setRawImageSrc("");
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user?.id) throw new Error("Not authenticated");

      const isValidAvatar = avatarUrl && 
        avatarUrl !== DEFAULT_AVATAR_URL && 
        !avatarUrl.includes("dicebear.com") && 
        !avatarUrl.includes("api.dicebear");
      
      if (!isValidAvatar) {
        throw new Error("يجب رفع صورة شخصية للوصول لمجتمع ليفو");
      }

      const usernameCheck = validateUsername(values.username);
      if (!usernameCheck.isClean) {
        throw new Error("اسم المستخدم يحتوي على كلمات غير مناسبة");
      }

      const nameCheck = filterContent(values.fullName);
      if (!nameCheck.isClean) {
        throw new Error("الاسم يحتوي على كلمات غير مناسبة");
      }

      if (values.bio) {
        const bioCheck = filterContent(values.bio);
        if (!bioCheck.isClean) {
          throw new Error("النبذة تحتوي على كلمات غير مناسبة");
        }
      }

      const profilePayload = {
        full_name: values.fullName,
        phone_number: values.phoneNumber,
        username: values.username,
        birth_date: values.birthDate,
        gender: values.gender,
        bio: values.bio?.trim() ? values.bio.trim() : null,
        avatar_url: avatarUrl,
        email_verified: emailVerified,
      };

      const { error } = await supabase.from("profiles").update(profilePayload).eq("id", user.id);
      if (error) throw error;

      const { error: communityError } = await supabase
        .from("community_customer_profiles")
        .upsert({
          user_id: user.id,
          display_name: values.fullName,
          avatar_url: avatarUrl,
          bio: values.bio?.trim() || null,
        }, { onConflict: "user_id" });

      if (communityError) {
        console.error("Community profile upsert error:", communityError);
      }

      return true;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["community-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-full", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-status", user?.id] }),
        qc.invalidateQueries({ queryKey: ["admin-community-customers"] }),
      ]);
      
      await qc.refetchQueries({ queryKey: ["community-profile-status", user?.id] });
      
      toast({ title: "تم حفظ الملف الشخصي بنجاح ✓" });
      
      await new Promise(resolve => setTimeout(resolve, 100));
      
      onDone?.();
    },
    onError: (err: any) => {
      if (err?.code === "23505") {
        toast({
          title: "تعذر حفظ الملف",
          description: "اسم المستخدم مستخدم بالفعل — الرجاء اختيار يوزرنيم مختلف.",
          variant: "destructive",
        });
        return;
      }
      toast({
        title: "تعذر حفظ الملف",
        description: err?.message ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  const completedFields = useMemo(() => {
    const values = form.watch();
    let count = 0;
    if (avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL) count++;
    if (values.fullName?.trim()) count++;
    if (values.phoneNumber?.trim()) count++;
    if (values.username?.trim()) count++;
    if (values.birthDate) count++;
    if (values.gender) count++;
    return count;
  }, [form.watch(), avatarUrl]);

  const totalRequiredFields = 6;
  const progressPercent = step === 1 ? (completedFields / totalRequiredFields) * 50 : 50 + (emailVerified ? 25 : 0) + (termsAccepted ? 25 : 0);
  const isStep1Complete = completedFields === totalRequiredFields;

  const fields: FieldConfig[] = [
    {
      id: "fullName",
      label: "الاسم الكامل",
      placeholder: "أدخل اسمك الكامل",
      icon: <UserCircle2 className="h-4 w-4" />,
      maxLength: 120,
    },
    {
      id: "phoneNumber",
      label: "رقم الهاتف",
      placeholder: "07xxxxxxxxx",
      icon: <Phone className="h-4 w-4" />,
      type: "tel",
      hint: "للتواصل عند الحاجة",
      maxLength: 30,
    },
    {
      id: "username",
      label: "اسم المستخدم",
      placeholder: "levo_user",
      icon: <AtSign className="h-4 w-4" />,
      maxLength: 30,
    },
  ];

  const hasValidAvatar = avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL && !avatarUrl.includes("dicebear");

  const handleNextStep = () => {
    if (!isStep1Complete || !hasValidAvatar) {
      toast({
        title: "أكمل البيانات المطلوبة",
        description: "يرجى ملء جميع الحقول المطلوبة ورفع صورة شخصية",
        variant: "destructive",
      });
      return;
    }
    setStep(2);
  };

  return (
    <form
      onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
      className="flex min-h-0 flex-1 flex-col bg-card"
    >
      {/* Compact Header */}
      <header className="relative overflow-hidden px-4 py-4 bg-gradient-to-b from-background via-card to-card border-b border-border/30">
        <div className="absolute inset-0 opacity-20">
          <div className="absolute top-0 right-0 w-24 h-24 bg-primary/20 rounded-full blur-3xl" />
        </div>
        
        <div className="relative">
          {/* Step Indicator */}
          <div className="flex items-center justify-center gap-3 mb-3">
            <button
              type="button"
              onClick={() => setStep(1)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all ${
                step === 1 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <UserCircle2 className="h-3.5 w-3.5" />
              البيانات
            </button>
            <div className="h-px w-6 bg-border" />
            <button
              type="button"
              onClick={() => isStep1Complete && hasValidAvatar && setStep(2)}
              disabled={!isStep1Complete || !hasValidAvatar}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition-all disabled:opacity-50 ${
                step === 2 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted/50 text-muted-foreground'
              }`}
            >
              <Mail className="h-3.5 w-3.5" />
              التحقق
            </button>
          </div>

          {/* Avatar Section - Compact */}
          {step === 1 && (
            <div className="flex items-center gap-3">
              <div className="relative group shrink-0">
                <div className={`absolute -inset-1 rounded-full transition-all duration-500 ${
                  hasValidAvatar 
                    ? 'bg-gradient-to-r from-primary via-accent to-primary opacity-50 blur-sm' 
                    : 'bg-border/40 opacity-30 blur-sm'
                }`} />
                
                <div className="relative h-16 w-16 rounded-full bg-gradient-to-br from-primary/80 to-accent p-[2px] shadow-lg">
                  <div className="h-full w-full rounded-full bg-card overflow-hidden border-2 border-card">
                    {avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL ? (
                      <img 
                        src={avatarUrl} 
                        alt="الصورة الشخصية" 
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-background">
                        <UserCircle2 className="h-7 w-7 text-muted-foreground/40" />
                      </div>
                    )}
                  </div>
                </div>
                
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={uploadingAvatar}
                  className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 hover:bg-black/50 transition-all duration-300 cursor-pointer group"
                >
                  <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-card/95 rounded-full p-1.5 shadow-lg border border-border">
                    {uploadingAvatar ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <Camera className="h-4 w-4 text-primary" />
                    )}
                  </div>
                </button>
                
                <div className={`absolute -bottom-0.5 -right-0.5 h-5 w-5 rounded-full flex items-center justify-center shadow-md border-2 border-card transition-all ${
                  hasValidAvatar ? 'bg-emerald-600' : 'bg-amber-600'
                }`}>
                  {hasValidAvatar ? (
                    <CheckCircle2 className="h-3 w-3 text-white" />
                  ) : (
                    <Camera className="h-3 w-3 text-white" />
                  )}
                </div>
                
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={handleFileSelect}
                />
              </div>
              
              <div className="flex-1 min-w-0">
                <h2 className="text-base font-bold text-foreground">
                  أكمل ملفك الشخصي
                </h2>
                <p className="text-[11px] text-muted-foreground/70">
                  {completedFields} من {totalRequiredFields} حقول مكتملة
                </p>
                
                <div className="relative h-1.5 bg-background rounded-full overflow-hidden border border-border/50 mt-1.5">
                  <div 
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-primary to-accent rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${(completedFields / totalRequiredFields) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center">
              <div className="flex items-center justify-center gap-2 mb-1">
                <Mail className="h-5 w-5 text-primary" />
                <h2 className="text-base font-bold text-foreground">
                  التحقق والموافقة
                </h2>
              </div>
              <p className="text-[11px] text-muted-foreground/70">
                أكد بريدك الإلكتروني ووافق على الشروط
              </p>
            </div>
          )}
        </div>
      </header>

      {/* Scrollable Form Body */}
      <div className="scrollbar-stable flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-4 py-3 bg-card">
        {isLoading || loadingUi ? (
          <div className="space-y-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-14 rounded-xl bg-background/50" />
            ))}
          </div>
        ) : step === 1 ? (
          <div className="space-y-2.5">
            {/* Text Fields */}
            {fields.map((field) => {
              const hasValue = !!form.watch(field.id)?.toString().trim();
              const hasError = !!form.formState.errors[field.id];
              
              return (
                <div 
                  key={field.id} 
                  className={`group relative rounded-xl transition-all duration-300 ${
                    hasError 
                      ? 'bg-destructive/10 ring-1 ring-destructive/40' 
                      : hasValue 
                        ? 'bg-background ring-1 ring-primary/40' 
                        : 'bg-background ring-1 ring-border/60 hover:ring-border'
                  }`}
                >
                  <div className="flex items-center gap-2.5 p-2.5">
                    <div className={`h-9 w-9 rounded-lg flex items-center justify-center shrink-0 transition-all duration-300 ${
                      hasValue 
                        ? 'bg-gradient-to-br from-primary/90 to-accent text-primary-foreground' 
                        : 'bg-card border border-border/50 text-muted-foreground/60'
                    }`}>
                      {hasValue ? <CheckCircle2 className="h-4 w-4" /> : field.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={field.id} 
                        className={`text-[10px] font-semibold mb-0 block transition-colors ${
                          hasValue ? 'text-primary' : 'text-muted-foreground/70'
                        }`}
                      >
                        {field.label}
                      </Label>
                      <Input 
                        id={field.id}
                        type={field.type || "text"}
                        placeholder={field.placeholder}
                        {...form.register(field.id)}
                        maxLength={field.maxLength}
                        inputMode={field.type === "tel" ? "tel" : undefined}
                        className="h-6 border-0 bg-transparent p-0 text-sm font-medium text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  
                  {hasError && (
                    <p className="text-[10px] text-destructive px-2.5 pb-2 -mt-0.5 pr-14">
                      {form.formState.errors[field.id]?.message}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Date and Gender Row */}
            <div className="grid grid-cols-2 gap-2">
              {/* Birth Date */}
              <div 
                className={`rounded-xl transition-all duration-300 ${
                  form.watch("birthDate") 
                    ? 'bg-background ring-1 ring-primary/40' 
                    : 'bg-background ring-1 ring-border/60'
                }`}
              >
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                      form.watch("birthDate") 
                        ? 'bg-gradient-to-br from-primary/90 to-accent text-primary-foreground' 
                        : 'bg-card border border-border/50 text-muted-foreground/60'
                    }`}>
                      {form.watch("birthDate") ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                    </div>
                    <Label htmlFor="birthDate" className="text-[10px] font-semibold text-muted-foreground/70">
                      تاريخ الميلاد
                    </Label>
                  </div>
                  <Input 
                    id="birthDate" 
                    type="date" 
                    {...form.register("birthDate")}
                    className="h-6 border-0 bg-transparent px-0 text-sm font-medium text-foreground focus-visible:ring-0"
                  />
                </div>
              </div>

              {/* Gender */}
              <div 
                className={`rounded-xl transition-all duration-300 ${
                  form.watch("gender") 
                    ? 'bg-background ring-1 ring-primary/40' 
                    : 'bg-background ring-1 ring-border/60'
                }`}
              >
                <div className="p-2.5">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center transition-all ${
                      form.watch("gender") 
                        ? 'bg-gradient-to-br from-primary/90 to-accent text-primary-foreground' 
                        : 'bg-card border border-border/50 text-muted-foreground/60'
                    }`}>
                      {form.watch("gender") ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </div>
                    <Label className="text-[10px] font-semibold text-muted-foreground/70">الجنس</Label>
                  </div>
                  <RadioGroup
                    value={form.watch("gender")}
                    onValueChange={(v) => form.setValue("gender", v as "male" | "female", { shouldValidate: true })}
                    className="flex items-center gap-2.5"
                  >
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="male" id="gender-male" className="h-3.5 w-3.5" />
                      <Label htmlFor="gender-male" className="text-xs font-medium text-foreground/80 cursor-pointer">ذكر</Label>
                    </div>
                    <div className="flex items-center gap-1">
                      <RadioGroupItem value="female" id="gender-female" className="h-3.5 w-3.5" />
                      <Label htmlFor="gender-female" className="text-xs font-medium text-foreground/80 cursor-pointer">أنثى</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            {/* Bio - Optional */}
            <div className="rounded-xl bg-background ring-1 ring-border/60">
              <div className="p-2.5">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <div className="h-7 w-7 rounded-lg bg-card border border-border/50 text-muted-foreground/60 flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <Label htmlFor="bio" className="text-[10px] font-semibold text-muted-foreground/70">
                    نبذة عنك <span className="opacity-60 font-normal">(اختياري)</span>
                  </Label>
                </div>
                <Textarea
                  id="bio"
                  placeholder="اكتب نبذة قصيرة عنك..."
                  {...form.register("bio")}
                  maxLength={500}
                  className="min-h-[40px] border-0 bg-transparent px-0 text-sm text-foreground resize-none focus-visible:ring-0 placeholder:text-muted-foreground/40"
                />
              </div>
            </div>

            {/* Benefits Preview - Compact */}
            <div className="rounded-xl bg-background/80 ring-1 ring-primary/20 p-3">
              <p className="text-[10px] font-bold text-primary mb-2 flex items-center gap-1">
                <Crown className="h-3 w-3" />
                مميزات إكمال الملف
              </p>
              <div className="grid grid-cols-4 gap-1.5">
                {[
                  { icon: Shield, text: "حماية" },
                  { icon: Zap, text: "سرعة" },
                  { icon: BadgeCheck, text: "توثيق" },
                  { icon: Store, text: "تجارة" },
                ].map((item, idx) => (
                  <div key={idx} className="flex flex-col items-center gap-0.5 text-[9px] text-muted-foreground/70">
                    <item.icon className="h-3 w-3 text-primary/70" />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Merchant CTA - Compact */}
            {showMerchantCta && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenMerchantSignup) return onOpenMerchantSignup();
                  navigate("/community/merchant/signup");
                }}
                className="w-full rounded-xl bg-background ring-1 ring-accent/40 p-3 text-center transition-all hover:ring-accent hover:bg-background/80 group"
              >
                <div className="flex items-center justify-center gap-1.5 mb-0.5">
                  <Store className="h-3.5 w-3.5 text-accent group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-accent">هل أنت تاجر؟</span>
                </div>
                <p className="text-[10px] text-muted-foreground/60">
                  انضم لمجتمع تجار ليفو
                </p>
              </button>
            )}
          </div>
        ) : (
          // Step 2: Verification
          <div className="space-y-3">
            {/* Email Verification Card */}
            <div className={`rounded-xl p-4 transition-all ${
              emailVerified 
                ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' 
                : 'bg-background ring-1 ring-border/60'
            }`}>
              <div className="flex items-center gap-3">
                <div className={`h-12 w-12 rounded-xl flex items-center justify-center shrink-0 ${
                  emailVerified 
                    ? 'bg-emerald-500/20' 
                    : 'bg-primary/10'
                }`}>
                  {emailVerified ? (
                    <CheckCircle2 className="h-6 w-6 text-emerald-500" />
                  ) : (
                    <Mail className="h-6 w-6 text-primary" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-foreground">
                    {emailVerified ? 'تم التحقق من البريد الإلكتروني' : 'التحقق من البريد الإلكتروني'}
                  </p>
                  <p className="text-xs text-muted-foreground truncate">
                    {user?.email}
                  </p>
                </div>
                {!emailVerified && (
                  <Button
                    type="button"
                    size="sm"
                    onClick={() => setShowEmailVerification(true)}
                    className="shrink-0"
                  >
                    تحقق
                  </Button>
                )}
              </div>
            </div>

            {/* Terms Checkbox Card */}
            <div className={`rounded-xl p-4 transition-all ${
              termsAccepted 
                ? 'bg-emerald-500/10 ring-1 ring-emerald-500/30' 
                : 'bg-background ring-1 ring-border/60'
            }`}>
              <div className="flex items-start gap-3">
                <Checkbox
                  id="community-terms-checkbox"
                  checked={termsAccepted}
                  onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                  className="h-5 w-5 mt-0.5"
                />
                <div className="flex-1">
                  <label htmlFor="community-terms-checkbox" className="text-sm font-medium text-foreground cursor-pointer">
                    أوافق على شروط وأحكام مجتمع ليفو
                  </label>
                  <button
                    type="button"
                    onClick={() => setShowTermsSheet(true)}
                    className="text-xs text-primary hover:underline block mt-1"
                  >
                    قراءة الشروط والأحكام
                  </button>
                </div>
              </div>
            </div>

            {/* Summary */}
            <div className="rounded-xl bg-background/80 ring-1 ring-border/50 p-4">
              <p className="text-xs font-bold text-foreground mb-2">ملخص البيانات</p>
              <div className="grid grid-cols-2 gap-2 text-xs">
                <div>
                  <span className="text-muted-foreground">الاسم:</span>
                  <p className="font-medium truncate">{form.watch("fullName") || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">اليوزرنيم:</span>
                  <p className="font-medium">@{form.watch("username") || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">الهاتف:</span>
                  <p className="font-medium">{form.watch("phoneNumber") || "—"}</p>
                </div>
                <div>
                  <span className="text-muted-foreground">الجنس:</span>
                  <p className="font-medium">{form.watch("gender") === "male" ? "ذكر" : "أنثى"}</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Compact Footer */}
      <footer className="sticky bottom-0 z-10 border-t border-border/40 bg-card px-4 py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
        {step === 1 ? (
          <>
            {!hasValidAvatar && (
              <div className="flex items-center justify-center gap-1.5 text-xs text-amber-500 mb-2 py-2 px-3 rounded-lg bg-amber-500/10 ring-1 ring-amber-500/30">
                <Camera className="h-3 w-3" />
                يجب رفع صورة شخصية
              </div>
            )}
            
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="ghost"
                className="flex-1 h-10 text-muted-foreground hover:text-foreground hover:bg-background rounded-xl text-sm"
                disabled={saveMutation.isPending}
                onClick={() => (onLater ? onLater() : onDone?.())}
              >
                لاحقًا
              </Button>

              <Button
                type="button"
                disabled={!isStep1Complete || !hasValidAvatar || uploadingAvatar}
                onClick={handleNextStep}
                className="flex-[2] h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow-md transition-all duration-300 disabled:opacity-50 disabled:shadow-none hover:opacity-90 text-sm gap-1.5"
              >
                التالي
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </div>
          </>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              onClick={() => setStep(1)}
              className="h-10 rounded-xl text-sm gap-1.5"
            >
              <ArrowRight className="h-4 w-4" />
              رجوع
            </Button>

            <Button
              type="submit"
              disabled={
                saveMutation.isPending || 
                !form.formState.isValid || 
                uploadingAvatar ||
                !hasValidAvatar ||
                !emailVerified ||
                !termsAccepted
              }
              className="flex-1 h-10 rounded-xl bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow-md transition-all duration-300 disabled:opacity-50 disabled:shadow-none hover:opacity-90 text-sm"
            >
              {saveMutation.isPending ? (
                <>
                  <Loader2 className="ml-1.5 h-4 w-4 animate-spin" />
                  جارٍ الحفظ...
                </>
              ) : !emailVerified ? (
                <>
                  <Mail className="ml-1.5 h-4 w-4" />
                  تحقق من البريد أولاً
                </>
              ) : !termsAccepted ? (
                <>
                  <ScrollText className="ml-1.5 h-4 w-4" />
                  وافق على الشروط
                </>
              ) : (
                <>
                  <Sparkles className="ml-1.5 h-4 w-4" />
                  حفظ الملف الشخصي
                </>
              )}
            </Button>
          </div>
        )}
      </footer>

      {/* Avatar Cropper Dialog */}
      <AvatarCropper
        open={cropperOpen}
        onOpenChange={(open) => {
          setCropperOpen(open);
          if (!open && rawImageSrc) {
            URL.revokeObjectURL(rawImageSrc);
            setRawImageSrc("");
          }
        }}
        imageSrc={rawImageSrc}
        onCropComplete={handleCroppedImage}
      />

      {/* Community Terms Sheet */}
      <CommunityTermsSheet
        open={showTermsSheet}
        onOpenChange={setShowTermsSheet}
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
    </form>
  );
}
