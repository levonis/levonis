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
  
  // Cropper state
  const [cropperOpen, setCropperOpen] = useState(false);
  const [rawImageSrc, setRawImageSrc] = useState<string>("");
  
  // Terms state
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);

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
        .select("full_name, phone_number, username, birth_date, gender, bio, avatar_url")
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
  }, [profile?.avatar_url]);

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
  const progressPercent = (completedFields / totalRequiredFields) * 100;
  const isComplete = completedFields === totalRequiredFields;

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

  return (
    <form
      onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
      className="flex min-h-0 flex-1 flex-col bg-gradient-to-b from-background to-muted/20"
    >
      {/* Premium Hero Header */}
      <header className="relative overflow-hidden px-5 py-6">
        {/* Background Effects */}
        <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/10" />
        <div className="absolute top-0 right-0 w-40 h-40 bg-primary/15 rounded-full blur-3xl -translate-y-1/2 translate-x-1/4" />
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/15 rounded-full blur-3xl translate-y-1/2 -translate-x-1/4" />
        
        <div className="relative">
          {/* Avatar Section - Centered */}
          <div className="flex flex-col items-center mb-5">
            <div className="relative group">
              {/* Glowing Ring */}
              <div className={`absolute -inset-1 rounded-full blur-md transition-all duration-500 ${
                hasValidAvatar 
                  ? 'bg-gradient-to-r from-primary via-accent to-primary opacity-75' 
                  : 'bg-muted/50 opacity-50'
              }`} />
              
              {/* Avatar Container */}
              <div className="relative h-24 w-24 rounded-full bg-gradient-to-br from-primary to-accent p-[3px] shadow-2xl">
                <div className="h-full w-full rounded-full bg-card overflow-hidden">
                  {avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL ? (
                    <img 
                      src={avatarUrl} 
                      alt="الصورة الشخصية" 
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center bg-gradient-to-br from-muted to-muted/50">
                      <UserCircle2 className="h-10 w-10 text-muted-foreground/50" />
                    </div>
                  )}
                </div>
              </div>
              
              {/* Upload Button Overlay */}
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploadingAvatar}
                className="absolute inset-0 flex items-center justify-center rounded-full bg-black/0 hover:bg-black/40 transition-all duration-300 cursor-pointer group"
              >
                <div className="opacity-0 group-hover:opacity-100 transition-opacity bg-white/90 dark:bg-black/80 rounded-full p-2 shadow-lg">
                  {uploadingAvatar ? (
                    <Loader2 className="h-5 w-5 animate-spin text-primary" />
                  ) : (
                    <Camera className="h-5 w-5 text-primary" />
                  )}
                </div>
              </button>
              
              {/* Status Badge */}
              <div className={`absolute -bottom-1 -right-1 h-7 w-7 rounded-full flex items-center justify-center shadow-lg transition-all ${
                hasValidAvatar 
                  ? 'bg-gradient-to-br from-emerald-500 to-green-600' 
                  : 'bg-gradient-to-br from-amber-500 to-orange-600'
              }`}>
                {hasValidAvatar ? (
                  <CheckCircle2 className="h-4 w-4 text-white" />
                ) : (
                  <Camera className="h-4 w-4 text-white" />
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
            
            {/* Upload Hint */}
            {!hasValidAvatar && (
              <p className="text-xs text-amber-600 dark:text-amber-400 mt-3 flex items-center gap-1.5 animate-pulse">
                <Camera className="h-3.5 w-3.5" />
                اضغط لرفع صورتك الشخصية
              </p>
            )}
          </div>
          
          {/* Title & Progress */}
          <div className="text-center">
            <h2 className="text-xl font-bold bg-gradient-to-r from-primary via-foreground to-accent bg-clip-text text-transparent mb-1">
              أكمل ملفك الشخصي
            </h2>
            <p className="text-xs text-muted-foreground mb-4">للوصول الكامل لمجتمع ليفو</p>
            
            {/* Elegant Progress Bar */}
            <div className="relative h-2 bg-muted/50 rounded-full overflow-hidden shadow-inner">
              <div 
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-primary via-accent to-primary rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
              <div 
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-white/30 to-transparent rounded-full transition-all duration-700 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            
            <div className="flex items-center justify-between mt-2 px-1">
              <span className="text-[10px] text-muted-foreground">
                {completedFields} من {totalRequiredFields}
              </span>
              {isComplete && (
                <span className="text-[10px] text-emerald-500 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  جاهز للحفظ
                </span>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Scrollable Form Body */}
      <div className="scrollbar-stable flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
        {isLoading || loadingUi ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-2xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-3">
            {/* Text Fields */}
            {fields.map((field) => {
              const hasValue = !!form.watch(field.id)?.toString().trim();
              const hasError = !!form.formState.errors[field.id];
              
              return (
                <div 
                  key={field.id} 
                  className={`group relative rounded-2xl transition-all duration-300 ${
                    hasError 
                      ? 'bg-destructive/5 ring-2 ring-destructive/30' 
                      : hasValue 
                        ? 'bg-primary/5 ring-2 ring-primary/20 shadow-sm shadow-primary/10' 
                        : 'bg-muted/40 ring-1 ring-border/50 hover:ring-border'
                  }`}
                >
                  <div className="flex items-center gap-3 p-3">
                    {/* Icon */}
                    <div className={`h-10 w-10 rounded-xl flex items-center justify-center shrink-0 transition-all duration-300 ${
                      hasValue 
                        ? 'bg-gradient-to-br from-primary to-accent text-white shadow-md shadow-primary/25' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {hasValue ? <CheckCircle2 className="h-5 w-5" /> : field.icon}
                    </div>
                    
                    {/* Input Area */}
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={field.id} 
                        className={`text-[11px] font-semibold mb-0.5 block transition-colors ${
                          hasValue ? 'text-primary' : 'text-muted-foreground'
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
                        className="h-7 border-0 bg-transparent p-0 text-sm font-medium placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  
                  {field.hint && !hasError && (
                    <p className="text-[10px] text-muted-foreground/70 px-3 pb-2 -mt-0.5 pr-16">{field.hint}</p>
                  )}
                  {hasError && (
                    <p className="text-[10px] text-destructive px-3 pb-2 -mt-0.5 pr-16">
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
                className={`rounded-2xl transition-all duration-300 ${
                  form.watch("birthDate") 
                    ? 'bg-primary/5 ring-2 ring-primary/20 shadow-sm' 
                    : 'bg-muted/40 ring-1 ring-border/50'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                      form.watch("birthDate") 
                        ? 'bg-gradient-to-br from-primary to-accent text-white shadow-sm' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {form.watch("birthDate") ? <CheckCircle2 className="h-4 w-4" /> : <Calendar className="h-4 w-4" />}
                    </div>
                    <Label htmlFor="birthDate" className="text-[11px] font-semibold text-muted-foreground">
                      تاريخ الميلاد
                    </Label>
                  </div>
                  <Input 
                    id="birthDate" 
                    type="date" 
                    {...form.register("birthDate")}
                    className="h-7 border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0"
                  />
                </div>
                {form.formState.errors.birthDate && (
                  <p className="text-[10px] text-destructive px-3 pb-2 -mt-1">
                    {form.formState.errors.birthDate.message}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div 
                className={`rounded-2xl transition-all duration-300 ${
                  form.watch("gender") 
                    ? 'bg-primary/5 ring-2 ring-primary/20 shadow-sm' 
                    : 'bg-muted/40 ring-1 ring-border/50'
                }`}
              >
                <div className="p-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-8 w-8 rounded-lg flex items-center justify-center transition-all ${
                      form.watch("gender") 
                        ? 'bg-gradient-to-br from-primary to-accent text-white shadow-sm' 
                        : 'bg-muted text-muted-foreground'
                    }`}>
                      {form.watch("gender") ? <CheckCircle2 className="h-4 w-4" /> : <Users className="h-4 w-4" />}
                    </div>
                    <Label className="text-[11px] font-semibold text-muted-foreground">الجنس</Label>
                  </div>
                  <RadioGroup
                    value={form.watch("gender")}
                    onValueChange={(v) => form.setValue("gender", v as "male" | "female", { shouldValidate: true })}
                    className="flex items-center gap-3"
                  >
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="male" id="gender-male" className="h-4 w-4" />
                      <Label htmlFor="gender-male" className="text-xs font-medium cursor-pointer">ذكر</Label>
                    </div>
                    <div className="flex items-center gap-1.5">
                      <RadioGroupItem value="female" id="gender-female" className="h-4 w-4" />
                      <Label htmlFor="gender-female" className="text-xs font-medium cursor-pointer">أنثى</Label>
                    </div>
                  </RadioGroup>
                </div>
              </div>
            </div>

            {/* Bio - Optional */}
            <div className="rounded-2xl bg-muted/40 ring-1 ring-border/50">
              <div className="p-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-8 w-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                    <FileText className="h-4 w-4" />
                  </div>
                  <Label htmlFor="bio" className="text-[11px] font-semibold text-muted-foreground">
                    نبذة عنك <span className="opacity-50 font-normal">(اختياري)</span>
                  </Label>
                </div>
                <Textarea
                  id="bio"
                  placeholder="اكتب نبذة قصيرة عنك..."
                  {...form.register("bio")}
                  maxLength={500}
                  className="min-h-[50px] border-0 bg-transparent px-0 text-sm resize-none focus-visible:ring-0"
                />
              </div>
            </div>

            {/* Benefits Preview */}
            <div className="rounded-2xl bg-gradient-to-br from-accent/10 via-primary/5 to-transparent ring-1 ring-accent/20 p-4">
              <p className="text-[11px] font-bold text-accent mb-3 flex items-center gap-1.5">
                <Crown className="h-3.5 w-3.5" />
                مميزات إكمال الملف الشخصي
              </p>
              <div className="grid grid-cols-2 gap-2">
                {[
                  { icon: Shield, text: "حماية حسابك" },
                  { icon: Zap, text: "تفاعل أسرع" },
                  { icon: BadgeCheck, text: "شارة موثق" },
                  { icon: Store, text: "انضمام كتاجر" },
                ].map((item, idx) => (
                  <div key={idx} className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                    <item.icon className="h-3 w-3 text-accent" />
                    {item.text}
                  </div>
                ))}
              </div>
            </div>

            {/* Merchant CTA */}
            {showMerchantCta && (
              <button
                type="button"
                onClick={() => {
                  if (onOpenMerchantSignup) return onOpenMerchantSignup();
                  navigate("/community/merchant/signup");
                }}
                className="w-full rounded-2xl bg-gradient-to-br from-accent/5 to-accent/10 ring-1 ring-accent/30 p-4 text-center transition-all hover:ring-accent/50 hover:from-accent/10 hover:to-accent/15 group"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Store className="h-4 w-4 text-accent group-hover:scale-110 transition-transform" />
                  <span className="text-sm font-bold text-accent">هل أنت تاجر؟</span>
                </div>
                <p className="text-[11px] text-muted-foreground">
                  انضم كتاجر واعرض منتجاتك في مجتمع ليفو
                </p>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Premium Footer */}
      <footer className="sticky bottom-0 z-10 border-t border-border/50 bg-gradient-to-t from-background via-background to-background/90 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur-sm">
        {/* Avatar warning */}
        {!hasValidAvatar && (
          <div className="flex items-center justify-center gap-1.5 text-xs text-amber-600 dark:text-amber-400 mb-3 py-2 px-3 rounded-xl bg-amber-500/10 ring-1 ring-amber-500/20">
            <Camera className="h-3.5 w-3.5" />
            يجب رفع صورة شخصية لإكمال الملف
          </div>
        )}

        {/* Terms Checkbox */}
        <div className="flex items-center gap-2.5 mb-4 p-2.5 rounded-xl bg-muted/30">
          <Checkbox
            id="community-terms-checkbox"
            checked={termsAccepted}
            onCheckedChange={(checked) => setTermsAccepted(checked === true)}
            className="h-4 w-4"
          />
          <label htmlFor="community-terms-checkbox" className="text-xs text-muted-foreground cursor-pointer">
            أوافق على{' '}
            <button
              type="button"
              onClick={(e) => {
                e.preventDefault();
                setShowTermsSheet(true);
              }}
              className="text-primary hover:underline font-medium"
            >
              شروط وأحكام مجتمع ليفو
            </button>
          </label>
        </div>
        
        {/* Action Buttons */}
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 h-12 text-muted-foreground hover:text-foreground rounded-xl"
            disabled={saveMutation.isPending}
            onClick={() => (onLater ? onLater() : onDone?.())}
          >
            لاحقًا
          </Button>

          <Button
            type="submit"
            disabled={
              saveMutation.isPending || 
              !form.formState.isValid || 
              uploadingAvatar ||
              !hasValidAvatar ||
              !termsAccepted
            }
            className="flex-[2] h-12 rounded-xl bg-gradient-to-r from-primary via-accent to-primary bg-[length:200%_100%] hover:bg-[position:100%_0] text-primary-foreground font-bold shadow-lg shadow-primary/30 transition-all duration-500 disabled:opacity-50 disabled:shadow-none"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الحفظ...
              </>
            ) : !termsAccepted ? (
              <>
                <ScrollText className="ml-2 h-4 w-4" />
                وافق على الشروط
              </>
            ) : (
              <>
                <Sparkles className="ml-2 h-4 w-4" />
                حفظ الملف الشخصي
              </>
            )}
          </Button>
        </div>
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
    </form>
  );
}
