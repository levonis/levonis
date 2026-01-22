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
import { CardDescription, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";
import { Loader2, User, X } from "lucide-react";

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
      ]);
      toast({ title: "تم حفظ الملف الشخصي" });
      onDone?.();
    },
    onError: (err: any) => {
      // Common failure: username already exists (unique constraint)
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

  return (
    <form
      onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))}
      className="flex min-h-0 flex-1 flex-col"
    >
      {/* Sticky header */}
      <header className="sticky top-0 z-10 border-b bg-card/95 px-5 py-4 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
              <User className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <CardTitle className="text-lg sm:text-xl">الملف الشخصي</CardTitle>
              <CardDescription className="text-xs sm:text-sm">يرجى إدخال المعلومات الصحيحة</CardDescription>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {showMerchantCta && (
              <Button
                type="button"
                variant="link"
                className="h-auto p-0 text-sm"
                onClick={() => {
                  if (onOpenMerchantSignup) return onOpenMerchantSignup();
                  navigate("/community/merchant/signup");
                }}
              >
                هل انت تاجر؟ اضغط هنا
              </Button>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={() => (onLater ? onLater() : navigate("/community/customer"))}
              aria-label="إغلاق"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </header>

      {/* Scrollable body */}
      <div className="scrollbar-stable flex-1 min-h-0 overflow-y-auto overflow-x-hidden overscroll-contain px-5 py-4">
        {isLoading || loadingUi ? (
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <div className="space-y-5">
            <div className="space-y-2">
              <Label className="text-xs" htmlFor="fullName">
                الاسم الصحيح
              </Label>
              <Input id="fullName" placeholder="مثال: محمد أحمد" {...form.register("fullName")} maxLength={120} />
              {form.formState.errors.fullName && (
                <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs" htmlFor="phoneNumber">
                الرقم الصحيح
              </Label>
              <Input
                id="phoneNumber"
                placeholder="مثال: 07xxxxxxxxx"
                {...form.register("phoneNumber")}
                maxLength={30}
                inputMode="tel"
              />
              <p className="text-xs text-muted-foreground">سيُستخدم للتواصل عند الحاجة</p>
              {form.formState.errors.phoneNumber && (
                <p className="text-xs text-destructive">{form.formState.errors.phoneNumber.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label className="text-xs" htmlFor="username">
                يوزرنيم
              </Label>
              <Input id="username" placeholder="مثال: levo_user" {...form.register("username")} maxLength={30} />
              {form.formState.errors.username && (
                <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
              )}
            </div>

            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label className="text-xs" htmlFor="birthDate">
                  تاريخ الميلاد
                </Label>
                <Input id="birthDate" type="date" {...form.register("birthDate")} />
                <p className="text-xs text-muted-foreground">لن يظهر للآخرين</p>
                {form.formState.errors.birthDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.birthDate.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label className="text-xs">الجنس</Label>
                <RadioGroup
                  value={form.watch("gender")}
                  onValueChange={(v) => form.setValue("gender", v as "male" | "female", { shouldValidate: true })}
                  className="flex items-center justify-start gap-6"
                >
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="male" id="gender-male" />
                    <Label htmlFor="gender-male">ذكر</Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <RadioGroupItem value="female" id="gender-female" />
                    <Label htmlFor="gender-female">أنثى</Label>
                  </div>
                </RadioGroup>
                {form.formState.errors.gender && (
                  <p className="text-xs text-destructive">{form.formState.errors.gender.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label className="text-xs" htmlFor="bio">
                الوصف (اختياري)
              </Label>
              <Textarea
                id="bio"
                placeholder="نبذة قصيرة عنك (اختياري)"
                {...form.register("bio")}
                maxLength={500}
                className="min-h-24"
              />
            </div>
          </div>
        )}
      </div>

      {/* Sticky footer */}
      <footer className="sticky bottom-0 z-10 border-t bg-card/95 px-5 py-4 pb-[calc(1rem+env(safe-area-inset-bottom))] backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex items-center gap-3">
          <Button
            type="button"
            variant="outline"
            className="flex-1"
            disabled={saveMutation.isPending}
            onClick={() => (onLater ? onLater() : navigate("/community/customer"))}
          >
            لاحقًا
          </Button>

          <Button
            type="submit"
            className="flex-1"
            disabled={!form.formState.isValid || saveMutation.isPending}
          >
            <span className="inline-flex items-center justify-center gap-2">
              {saveMutation.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </span>
          </Button>
        </div>
      </footer>
    </form>
  );
}
