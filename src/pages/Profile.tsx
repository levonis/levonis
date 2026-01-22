import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ArrowRight,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ReputationBar from "@/components/reputation/ReputationBar";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import ProfileQuickActions from "@/components/profile/ProfileQuickActions";
import ProfileMyRequestsPreview from "@/components/profile/ProfileMyRequestsPreview";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function calcPercent(numer: number, denom: number) {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return (numer / denom) * 100;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const { toast } = useToast();
  const [merchantOpen, setMerchantOpen] = useState(false);

  const { data: profile } = useQuery({
    queryKey: ["my-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, full_name, username, avatar_url, phone_verified, phone_verification_status")
        .eq("id", user!.id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: rep } = useUserPrintReputation(user?.id);

  const { data: requestCounts } = useQuery({
    queryKey: ["profile-request-counts", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Use head:true count queries for efficiency
      const [{ count: total, error: totalErr }, { count: done, error: doneErr }] = await Promise.all([
        supabase.from("print_requests").select("id", { count: "exact", head: true }).eq("user_id", user!.id),
        supabase
          .from("print_requests")
          .select("id", { count: "exact", head: true })
          .eq("user_id", user!.id)
          .in("status", ["completed", "delivered"]),
      ]);
      if (totalErr) throw totalErr;
      if (doneErr) throw doneErr;
      return { total: total ?? 0, done: done ?? 0 };
    },
    staleTime: 30_000,
  });

  const metrics = useMemo(() => {
    const submitted = requestCounts?.total ?? rep?.customer_requests_made ?? 0;
    const completed = requestCounts?.done ?? rep?.customer_requests_received ?? 0;
    const completion = submitted > 0 ? calcPercent(completed, submitted) : null;
    const receiveRate = rep?.customer_receive_rate_percent ?? completion;

    return [
      {
        key: "submitted",
        label: "طلبات مُنشأة",
        percent: submitted > 0 ? 100 : null,
        hint: "إجمالي الطلبات التي أنشأتها في مجتمع الطباعة.",
        rightText: submitted ? `${submitted}` : "—",
      },
      {
        key: "completed",
        label: "طلبات مكتملة",
        percent: completion,
        hint: "نسبة الطلبات التي وصلت إلى (مكتمل/تم التوصيل).",
        rightText: submitted ? `${completed} من ${submitted}` : completed ? `${completed}` : "—",
      },
      {
        key: "receive_rate",
        label: "نسبة النجاح",
        percent: receiveRate == null ? null : Number(receiveRate),
        hint: "مؤشر عام مبني على بيانات الاستلام/الإكمال المتاحة.",
      },
    ];
  }, [rep, requestCounts]);

  const phoneVerified = Boolean(profile?.phone_verified) || profile?.phone_verification_status === "verified";
  const phoneStatus = (profile?.phone_verification_status as any) || (phoneVerified ? "verified" : "unverified");

  const requestPhoneVerification = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");
      const { error } = await supabase
        .from("profiles")
        .update({ phone_verification_status: "pending" })
        .eq("id", user.id);
      if (error) throw error;
      return true;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["my-profile", user?.id] });
      toast({ title: "تم إرسال طلب التحقق", description: "سيتم التواصل معك لتأكيد الرقم (يدويًا)." });
    },
    onError: (err: any) => {
      toast({ title: "تعذر إرسال الطلب", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    },
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-24 pb-10 max-w-6xl">
        <header className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2 h-9">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <Button variant="outline" onClick={() => navigate("/profile/settings")} className="gap-2 h-9">
            <Settings className="h-4 w-4" />
            الإعدادات
          </Button>
        </header>

        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="w-full justify-start rounded-2xl">
            <TabsTrigger value="overview" className="rounded-xl">نظرة عامة</TabsTrigger>
            <TabsTrigger value="privacy" className="rounded-xl">الخصوصية والتحقق</TabsTrigger>
          </TabsList>

          <TabsContent value="overview" className="mt-4">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left: identity + quick actions */}
              <section className="lg:col-span-5">
                <Card className="glass-effect border-border/50 overflow-hidden">
                  <div className="relative">
                    <div className="h-32 bg-gradient-to-l from-primary/25 via-accent/10 to-transparent" />
                    <CardContent className="pt-0">
                      <div className="-mt-10 flex items-start gap-4">
                        <Avatar className="h-24 w-24 ring-4 ring-background shadow-sm">
                          <AvatarImage src={profile?.avatar_url || undefined} />
                          <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                            {(profile?.username?.[0] || profile?.full_name?.[0] || "م").toUpperCase()}
                          </AvatarFallback>
                        </Avatar>

                        <div className="flex-1 min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h1 className="text-2xl sm:text-3xl font-black text-foreground truncate">
                              {profile?.full_name || profile?.username || "مستخدم"}
                            </h1>
                            <Badge variant="secondary" className="font-semibold">
                              @{profile?.username || "—"}
                            </Badge>
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2">
                            <Badge variant={phoneVerified ? "secondary" : "outline"} className="gap-2">
                              {phoneVerified ? (
                                <ShieldCheck className="h-3.5 w-3.5" />
                              ) : (
                                <ShieldAlert className="h-3.5 w-3.5" />
                              )}
                              <span>{phoneVerified ? "تم تأكيد الرقم" : "غير مؤكد"}</span>
                            </Badge>

                            <Button size="sm" className="h-9 rounded-xl" onClick={() => navigate("/profile/settings")}>
                              تعديل سريع
                            </Button>
                          </div>

                          <div className="mt-4">
                            <Button
                              variant="outline"
                              size="sm"
                              className="h-9 rounded-xl"
                              onClick={() => setMerchantOpen(true)}
                            >
                              تحويل الملف الشخصي إلى تاجر
                            </Button>
                          </div>
                        </div>
                      </div>
                    </CardContent>
                  </div>
                </Card>

                <ProfileQuickActions />
              </section>

              {/* Right: reputation + my requests preview */}
              <section className="lg:col-span-7">
                <section>
                  <ReputationBar
                    title="تقييماتك"
                    overallStars={rep?.avg_stars ?? null}
                    basisCount={rep?.ratings_count ?? null}
                    basisLabel="تقييم"
                    metrics={metrics}
                  />
                </section>

                <ProfileMyRequestsPreview />
              </section>
            </div>
          </TabsContent>

          <TabsContent value="privacy" className="mt-4">
            <Card className="glass-effect border-border/50">
              <CardContent className="pt-6">
                <h2 className="text-sm font-black text-foreground">الخصوصية والتحقق</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  هذه صفحة عرض + طلب تحقق يدوي (بدون SMS حالياً).
                </p>

                <div className="mt-4 rounded-2xl border border-border bg-card/60 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="text-sm font-bold text-foreground">حالة رقم الهاتف</div>
                      <div className="mt-1 text-xs text-muted-foreground">
                        {phoneVerified
                          ? "تم تأكيد الرقم"
                          : phoneStatus === "pending"
                            ? "طلب التحقق قيد المراجعة"
                            : "غير مؤكد"}
                      </div>
                    </div>

                    <Badge
                      variant={phoneVerified ? "secondary" : phoneStatus === "pending" ? "outline" : "outline"}
                      className="gap-2"
                    >
                      {phoneVerified ? <ShieldCheck className="h-3.5 w-3.5" /> : <ShieldAlert className="h-3.5 w-3.5" />}
                      <span>
                        {phoneVerified ? "Verified" : phoneStatus === "pending" ? "Pending" : "Unverified"}
                      </span>
                    </Badge>
                  </div>

                  <div className="mt-4 flex flex-col sm:flex-row gap-2">
                    <Button
                      variant="outline"
                      className="h-9 rounded-xl"
                      disabled={phoneVerified || phoneStatus === "pending" || requestPhoneVerification.isPending}
                      onClick={() => requestPhoneVerification.mutate()}
                    >
                      {requestPhoneVerification.isPending
                        ? "جارٍ الإرسال…"
                        : phoneStatus === "pending"
                          ? "تم إرسال الطلب"
                          : "طلب تحقق يدوي"}
                    </Button>

                    <Button variant="outline" className="h-9 rounded-xl" onClick={() => navigate("/profile/settings")}>
                      تعديل بيانات الحساب
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>

        <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
      </main>
    </div>
  );
}

