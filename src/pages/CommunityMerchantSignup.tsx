import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
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
import { ArrowRight, Store, CheckCircle2, Clock, XCircle } from "lucide-react";

const formSchema = z.object({
  display_name: z.string().trim().min(2, "الاسم مطلوب").max(120),
  phone_number: z.string().trim().min(7, "رقم الهاتف مطلوب").max(30),
  city: z.string().trim().min(2, "المدينة مطلوبة").max(80),
  bio: z.string().trim().max(500).optional().or(z.literal("")),
});

type FormValues = z.infer<typeof formSchema>;

function statusBadge(status?: string | null) {
  if (status === "approved") return { label: "مقبول", Icon: CheckCircle2 };
  if (status === "rejected") return { label: "مرفوض", Icon: XCircle };
  return { label: "قيد المراجعة", Icon: Clock };
}

export default function CommunityMerchantSignup() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();

  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["community-profile-mini", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: existingApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-application", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, admin_notes, display_name, phone_number, city, bio, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const initial = useMemo<FormValues>(
    () => ({
      display_name: (existingApp?.display_name as string | null) ?? (profile?.full_name as string | null) ?? "",
      phone_number: (existingApp?.phone_number as string | null) ?? (profile?.phone_number as string | null) ?? "",
      city: (existingApp?.city as string | null) ?? "",
      bio: (existingApp?.bio as string | null) ?? "",
    }),
    [existingApp, profile]
  );

  const [values, setValues] = useState<FormValues>(initial);
  useEffect(() => setValues(initial), [initial]);

  const submitMutation = useMutation({
    mutationFn: async (v: FormValues) => {
      if (!user?.id) throw new Error("Not authenticated");
      const parsed = formSchema.parse(v);

      if (existingApp?.id) {
        const { error } = await supabase
          .from("merchant_applications")
          .update({
            display_name: parsed.display_name,
            phone_number: parsed.phone_number,
            city: parsed.city,
            bio: parsed.bio?.trim() ? parsed.bio.trim() : null,
          })
          .eq("id", existingApp.id);
        if (error) throw error;
        return true;
      }

      const { error } = await supabase.from("merchant_applications").insert({
        user_id: user.id,
        display_name: parsed.display_name,
        phone_number: parsed.phone_number,
        city: parsed.city,
        bio: parsed.bio?.trim() ? parsed.bio.trim() : null,
        status: "pending",
      });
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["merchant-application", user?.id] });
      toast({ title: "تم إرسال طلب التسجيل كتاجر", description: "سيتم مراجعة طلبك من قبل الإدارة" });
    },
    onError: (err: any) => {
      toast({ title: "تعذر إرسال الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  const busy = profileLoading || appLoading;
  const s = statusBadge(existingApp?.status);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
        <header className="mb-6 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
              <Store className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h1 className="text-2xl sm:text-3xl font-black text-primary">التسجيل كتاجر</h1>
              <p className="text-sm text-muted-foreground">ارسال طلب إلى الإدارة لتفعيل حساب التاجر</p>
            </div>
          </div>

          <Button variant="outline" onClick={() => navigate("/community/customer/profile")} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </header>

        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <s.Icon className="h-5 w-5 text-primary" />
              حالة الطلب: {s.label}
            </CardTitle>
            <CardDescription>
              {existingApp?.admin_notes ? `ملاحظة الإدارة: ${existingApp.admin_notes}` : "املأ البيانات ثم أرسل الطلب"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {busy ? (
              <div className="space-y-3">
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-10 rounded-xl" />
                <Skeleton className="h-24 rounded-xl" />
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>الاسم</Label>
                    <Input value={values.display_name} onChange={(e) => setValues((p) => ({ ...p, display_name: e.target.value }))} />
                  </div>
                  <div className="space-y-2">
                    <Label>رقم الهاتف</Label>
                    <Input value={values.phone_number} inputMode="tel" onChange={(e) => setValues((p) => ({ ...p, phone_number: e.target.value }))} />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label>المدينة</Label>
                  <Input value={values.city} onChange={(e) => setValues((p) => ({ ...p, city: e.target.value }))} />
                </div>

                <div className="space-y-2">
                  <Label>الوصف (اختياري)</Label>
                  <Textarea value={values.bio} onChange={(e) => setValues((p) => ({ ...p, bio: e.target.value }))} maxLength={500} className="min-h-24" />
                </div>

                <Button
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  onClick={() => submitMutation.mutate(values)}
                  disabled={submitMutation.isPending}
                >
                  {submitMutation.isPending ? "جارٍ الإرسال..." : "إرسال الطلب"}
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
