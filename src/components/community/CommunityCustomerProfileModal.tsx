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
import { CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Skeleton } from "@/components/ui/skeleton";

const DEFAULT_AVATAR_URL = "/placeholder.svg";

const formSchema = z.object({
  fullName: z.string().trim().min(2, "الاسم مطلوب").max(120),
  phoneNumber: z.string().trim().min(7, "رقم الهاتف مطلوب").max(30),
  username: z.string().trim().min(3, "اليوزرنيم مطلوب").max(30),
  birthDate: z.string().min(1, "تاريخ الميلاد مطلوب"),
  gender: z.enum(["male", "female"], { required_error: "الجنس مطلوب" }),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

export default function CommunityCustomerProfileModal({
  onDone,
  showMerchantCta = true,
}: {
  onDone?: () => void;
  showMerchantCta?: boolean;
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
      toast({
        title: "تعذر حفظ الملف",
        description: err?.message ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  return (
    <>
      <CardHeader>
        <div className="flex items-center justify-between gap-3">
          <div>
            <CardTitle>بيانات الزبون</CardTitle>
            <CardDescription>يرجى إدخال المعلومات الصحيحة</CardDescription>
          </div>

          {showMerchantCta && (
            <Button
              type="button"
              variant="link"
              className="h-auto p-0 text-sm"
              onClick={() => navigate("/community/merchant/signup")}
            >
              هل انت تاجر؟ اضغط هنا
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent>
        {isLoading || loadingUi ? (
          <div className="space-y-3">
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-10 rounded-xl" />
            <Skeleton className="h-24 rounded-xl" />
          </div>
        ) : (
          <form onSubmit={form.handleSubmit((v) => saveMutation.mutate(v))} className="space-y-5">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="fullName">الاسم الصحيح</Label>
                <Input id="fullName" {...form.register("fullName")} maxLength={120} />
                {form.formState.errors.fullName && (
                  <p className="text-xs text-destructive">{form.formState.errors.fullName.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="phoneNumber">الرقم الصحيح</Label>
                <Input id="phoneNumber" {...form.register("phoneNumber")} maxLength={30} inputMode="tel" />
                {form.formState.errors.phoneNumber && (
                  <p className="text-xs text-destructive">{form.formState.errors.phoneNumber.message}</p>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="username">يوزرنيم</Label>
                <Input id="username" {...form.register("username")} maxLength={30} />
                {form.formState.errors.username && (
                  <p className="text-xs text-destructive">{form.formState.errors.username.message}</p>
                )}
              </div>
              <div className="space-y-2">
                <Label htmlFor="birthDate">تاريخ الميلاد</Label>
                <Input id="birthDate" type="date" {...form.register("birthDate")} />
                {form.formState.errors.birthDate && (
                  <p className="text-xs text-destructive">{form.formState.errors.birthDate.message}</p>
                )}
              </div>
            </div>

            <div className="space-y-2">
              <Label>الجنس</Label>
              <RadioGroup
                value={form.watch("gender")}
                onValueChange={(v) => form.setValue("gender", v as "male" | "female", { shouldValidate: true })}
                className="flex items-center gap-6"
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

            <div className="space-y-2">
              <Label htmlFor="bio">الوصف (اختياري)</Label>
              <Textarea id="bio" {...form.register("bio")} maxLength={500} className="min-h-24" />
            </div>

            <Button
              type="submit"
              disabled={!form.formState.isValid || saveMutation.isPending}
              className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
            >
              {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </form>
        )}
      </CardContent>
    </>
  );
}
