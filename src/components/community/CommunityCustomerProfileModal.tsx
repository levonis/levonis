import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { zodResolver } from "@hookform/resolvers/zod";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
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
  Store
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

  const saveMutation = useMutation({
    mutationFn: async (values: FormValues) => {
      if (!user?.id) throw new Error("Not authenticated");

      const avatarUrl = (profile as any)?.avatar_url ?? DEFAULT_AVATAR_URL;
      const payload = {
        full_name: values.fullName,
        phone_number: values.phoneNumber,
        username: values.username,
        birth_date: values.birthDate,
        gender: values.gender,
        bio: values.bio?.trim() ? values.bio.trim() : null,
        ...(avatarUrl ? { avatar_url: avatarUrl } : {}),
      };

      const { error } = await supabase.from("profiles").update(payload).eq("id", user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["community-profile", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-full", user?.id] }),
        qc.invalidateQueries({ queryKey: ["community-profile-status", user?.id] }),
      ]);
      toast({ title: "تم حفظ الملف الشخصي بنجاح ✓" });
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

  // Calculate completion progress
  const completedFields = useMemo(() => {
    const values = form.watch();
    let count = 0;
    if (values.fullName?.trim()) count++;
    if (values.phoneNumber?.trim()) count++;
    if (values.username?.trim()) count++;
    if (values.birthDate) count++;
    if (values.gender) count++;
    return count;
  }, [form.watch()]);

  const totalRequiredFields = 5;
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
      {/* Premium Header */}
      <header className="relative overflow-hidden border-b border-primary/20 bg-gradient-to-br from-primary/15 via-accent/10 to-transparent px-5 py-5">
        {/* Decorative elements */}
        <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
        <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
        
        <div className="relative flex items-center gap-4">
          {/* Avatar placeholder with glow */}
          <div className="relative">
            <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
              <div className="h-full w-full rounded-2xl bg-card flex items-center justify-center">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
            </div>
            <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-accent flex items-center justify-center shadow-md">
              <span className="text-[10px] font-bold text-accent-foreground">{completedFields}</span>
            </div>
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
            className="flex-[2] h-11 bg-gradient-to-r from-primary to-accent text-primary-foreground font-bold shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 disabled:opacity-50"
            disabled={!form.formState.isValid || saveMutation.isPending}
          >
            {saveMutation.isPending ? (
              <span className="inline-flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                جارٍ الحفظ...
              </span>
            ) : (
              <span className="inline-flex items-center gap-2">
                <CheckCircle2 className="h-4 w-4" />
                حفظ الملف الشخصي
              </span>
            )}
          </Button>
        </div>
      </footer>
    </form>
  );
}
