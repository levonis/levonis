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
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import AvatarCropper from "./AvatarCropper";
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
  Upload,
  ImagePlus,
  Crop
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
      // Path format: avatars/{user_id}/{filename} to match storage policy
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

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    console.log("[AvatarUpload] File selected:", file?.name, file?.type, file?.size);
    
    if (!file) {
      console.log("[AvatarUpload] No file selected");
      return;
    }

    // Reset input so same file can be selected again
    e.target.value = "";

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "الملف كبير جداً",
        description: "الحد الأقصى لحجم الصورة هو 5 ميغابايت",
        variant: "destructive",
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        title: "نوع الملف غير مدعوم",
        description: "الرجاء اختيار صورة",
        variant: "destructive",
      });
      return;
    }

    // Create object URL for cropper
    const objectUrl = URL.createObjectURL(file);
    console.log("[AvatarUpload] Opening cropper with:", objectUrl.substring(0, 50));
    setRawImageSrc(objectUrl);
    setCropperOpen(true);
  };

  // Handle cropped image upload
  const handleCroppedImage = async (blob: Blob) => {
    console.log("[AvatarUpload] Cropped blob size:", blob.size);
    setUploadingAvatar(true);
    try {
      // Convert blob to File
      const file = new File([blob], `avatar-${Date.now()}.jpg`, { type: "image/jpeg" });
      console.log("[AvatarUpload] Uploading file:", file.name);
      await uploadAvatarMutation.mutateAsync(file);
      console.log("[AvatarUpload] Upload complete");
    } catch (error) {
      console.error("[AvatarUpload] Upload failed:", error);
    } finally {
      setUploadingAvatar(false);
      // Clean up object URL
      if (rawImageSrc) {
        URL.revokeObjectURL(rawImageSrc);
        setRawImageSrc("");
      }
    }
  };

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user?.id) throw new Error("Not authenticated");

      // Validate avatar is uploaded (required for community access)
      const isValidAvatar = avatarUrl && 
        avatarUrl !== DEFAULT_AVATAR_URL && 
        !avatarUrl.includes("dicebear.com") && 
        !avatarUrl.includes("api.dicebear");
      
      if (!isValidAvatar) {
        throw new Error("يجب رفع صورة شخصية للوصول لمجتمع ليفو");
      }

      // Content filtering
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

      // Update profiles table
      const { error } = await supabase.from("profiles").update(profilePayload).eq("id", user.id);
      if (error) throw error;

      // Upsert community_customer_profiles for admin visibility
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
        // Don't throw - main profile saved successfully
      }

      return true;
    },
    onSuccess: async () => {
      // Invalidate and refetch ALL profile-related queries first
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["community-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-full", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-status", user?.id] }),
        qc.invalidateQueries({ queryKey: ["admin-community-customers"] }),
      ]);
      
      // Wait for refetch to complete
      await qc.refetchQueries({ queryKey: ["community-profile-status", user?.id] });
      
      toast({ title: "تم حفظ الملف الشخصي بنجاح ✓" });
      
      // Small delay to ensure state propagates before navigation
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

  // Calculate completion progress (now includes avatar)
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

  const totalRequiredFields = 6; // Added avatar
  const progressPercent = (completedFields / totalRequiredFields) * 100;

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

  return (
    <form
      onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Premium Header with Avatar Upload */}
      <header className="relative overflow-hidden border-b border-primary/20 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-5 py-5">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
        
        <div className="relative flex items-center gap-4">
          {/* Avatar Upload Section */}
          <div className="relative group">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
              <div className="h-full w-full rounded-2xl bg-card overflow-hidden">
                {avatarUrl ? (
                  <img 
                    src={avatarUrl} 
                    alt="الصورة الشخصية" 
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center bg-muted/50">
                    <UserCircle2 className="h-8 w-8 text-muted-foreground" />
                  </div>
                )}
              </div>
            </div>
            
            {/* Upload button - always visible */}
            <button
              type="button"
              onClick={() => {
                console.log("[AvatarUpload] Click - opening file picker");
                fileInputRef.current?.click();
              }}
              disabled={uploadingAvatar}
              className="absolute inset-0 flex items-center justify-center bg-black/40 hover:bg-black/60 rounded-2xl transition-colors cursor-pointer"
            >
              {uploadingAvatar ? (
                <Loader2 className="h-5 w-5 text-white animate-spin" />
              ) : (
                <Camera className="h-5 w-5 text-white" />
              )}
            </button>
            
            {/* Badge indicator */}
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-accent flex items-center justify-center shadow-md">
              {avatarUrl && avatarUrl !== DEFAULT_AVATAR_URL ? (
                <CheckCircle2 className="h-3 w-3 text-accent-foreground" />
              ) : (
                <ImagePlus className="h-3 w-3 text-accent-foreground" />
              )}
            </div>
            
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileSelect}
            />
          </div>
          
          <div className="flex-1 min-w-0">
            <h2 className="text-lg font-bold text-foreground mb-1">أكمل ملفك الشخصي</h2>
            <p className="text-xs text-muted-foreground">للوصول الكامل لمجتمع ليفو</p>
            
            {/* Progress bar */}
            <div className="mt-2 h-1.5 w-full bg-muted/50 rounded-full overflow-hidden">
              <div 
                className="h-full bg-gradient-to-r from-primary to-accent rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
            <p className="text-[10px] text-muted-foreground mt-1">
              {completedFields} من {totalRequiredFields} حقول مكتملة
            </p>
          </div>
        </div>

        {/* Avatar upload hint */}
        {(!avatarUrl || avatarUrl === DEFAULT_AVATAR_URL) && (
          <p className="text-[10px] text-primary/80 mt-3 flex items-center gap-1">
            <Upload className="h-3 w-3" />
            اضغط على الصورة لرفع صورتك الشخصية
          </p>
        )}
      </header>

      {/* Scrollable body */}
      <div className="scrollbar-stable flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-5">
        {isLoading || loadingUi ? (
          <div className="space-y-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-16 rounded-xl" />
            ))}
          </div>
        ) : (
          <div className="space-y-4">
            {/* Text Fields */}
            {fields.map((field) => {
              const hasValue = !!form.watch(field.id)?.toString().trim();
              const hasError = !!form.formState.errors[field.id];
              
              return (
                <div 
                  key={field.id} 
                  className={`relative rounded-xl border-2 transition-all duration-200 ${
                    hasError 
                      ? 'border-destructive/50 bg-destructive/5' 
                      : hasValue 
                        ? 'border-primary/30 bg-primary/5' 
                        : 'border-border/50 bg-muted/30'
                  }`}
                >
                  <div className="flex items-center gap-3 px-4 py-3">
                    <div className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 ${
                      hasValue ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {hasValue ? <CheckCircle2 className="h-4 w-4" /> : field.icon}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <Label 
                        htmlFor={field.id} 
                        className={`text-[11px] font-medium mb-0.5 block ${
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
                        className="h-8 border-0 bg-transparent p-0 text-sm font-medium placeholder:text-muted-foreground/50 focus-visible:ring-0 focus-visible:ring-offset-0"
                      />
                    </div>
                  </div>
                  
                  {field.hint && !hasError && (
                    <p className="text-[10px] text-muted-foreground px-4 pb-2 -mt-1">{field.hint}</p>
                  )}
                  {hasError && (
                    <p className="text-[10px] text-destructive px-4 pb-2 -mt-1">
                      {form.formState.errors[field.id]?.message}
                    </p>
                  )}
                </div>
              );
            })}

            {/* Date and Gender Row */}
            <div className="grid grid-cols-2 gap-3">
              {/* Birth Date */}
              <div 
                className={`relative rounded-xl border-2 transition-all duration-200 ${
                  form.watch("birthDate") 
                    ? 'border-primary/30 bg-primary/5' 
                    : 'border-border/50 bg-muted/30'
                }`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                      form.watch("birthDate") ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {form.watch("birthDate") ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Calendar className="h-3.5 w-3.5" />}
                    </div>
                    <Label htmlFor="birthDate" className="text-[11px] font-medium text-muted-foreground">
                      تاريخ الميلاد
                    </Label>
                  </div>
                  <Input 
                    id="birthDate" 
                    type="date" 
                    {...form.register("birthDate")}
                    className="h-8 border-0 bg-transparent px-0 text-sm font-medium focus-visible:ring-0"
                  />
                </div>
                {form.formState.errors.birthDate && (
                  <p className="text-[10px] text-destructive px-4 pb-2 -mt-1">
                    {form.formState.errors.birthDate.message}
                  </p>
                )}
              </div>

              {/* Gender */}
              <div 
                className={`relative rounded-xl border-2 transition-all duration-200 ${
                  form.watch("gender") 
                    ? 'border-primary/30 bg-primary/5' 
                    : 'border-border/50 bg-muted/30'
                }`}
              >
                <div className="px-4 py-3">
                  <div className="flex items-center gap-2 mb-2">
                    <div className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                      form.watch("gender") ? 'bg-primary/20 text-primary' : 'bg-muted text-muted-foreground'
                    }`}>
                      {form.watch("gender") ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Users className="h-3.5 w-3.5" />}
                    </div>
                    <Label className="text-[11px] font-medium text-muted-foreground">الجنس</Label>
                  </div>
                  <RadioGroup
                    value={form.watch("gender")}
                    onValueChange={(v) => form.setValue("gender", v as "male" | "female", { shouldValidate: true })}
                    className="flex items-center gap-4"
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
            <div className="rounded-xl border-2 border-border/50 bg-muted/30">
              <div className="px-4 py-3">
                <div className="flex items-center gap-2 mb-2">
                  <div className="h-7 w-7 rounded-lg bg-muted text-muted-foreground flex items-center justify-center">
                    <FileText className="h-3.5 w-3.5" />
                  </div>
                  <Label htmlFor="bio" className="text-[11px] font-medium text-muted-foreground">
                    نبذة عنك <span className="opacity-60">(اختياري)</span>
                  </Label>
                </div>
                <Textarea
                  id="bio"
                  placeholder="اكتب نبذة قصيرة عنك..."
                  {...form.register("bio")}
                  maxLength={500}
                  className="min-h-[60px] border-0 bg-transparent px-0 text-sm resize-none focus-visible:ring-0"
                />
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
                className="w-full rounded-xl border-2 border-dashed border-accent/40 bg-accent/5 p-4 text-center transition-all hover:border-accent/60 hover:bg-accent/10"
              >
                <div className="flex items-center justify-center gap-2 mb-1">
                  <Store className="h-4 w-4 text-accent" />
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
      <footer className="sticky bottom-0 z-10 border-t border-primary/20 bg-gradient-to-t from-card via-card to-card/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur">
        {/* Avatar warning */}
        {(!avatarUrl || avatarUrl === DEFAULT_AVATAR_URL || avatarUrl.includes("dicebear")) && (
          <p className="text-[11px] text-amber-600 dark:text-amber-400 mb-2 text-center flex items-center justify-center gap-1">
            <Camera className="h-3 w-3" />
            يجب رفع صورة شخصية لإكمال الملف
          </p>
        )}
        
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="ghost"
            className="flex-1 h-11 text-muted-foreground hover:text-foreground"
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
              !avatarUrl ||
              avatarUrl === DEFAULT_AVATAR_URL ||
              avatarUrl.includes("dicebear")
            }
            className="flex-[2] h-11 bg-gradient-to-b from-primary to-accent text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:opacity-90 disabled:opacity-50"
          >
            {saveMutation.isPending ? (
              <>
                <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                جارٍ الحفظ...
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
    </form>
  );
}
