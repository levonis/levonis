import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Settings,
  ShieldAlert,
  ShieldCheck,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ReputationBar from "@/components/reputation/ReputationBar";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import ProfileQuickActions from "@/components/profile/ProfileQuickActions";
import ProfileMyRequestsPreview from "@/components/profile/ProfileMyRequestsPreview";

function calcPercent(numer: number, denom: number) {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return (numer / denom) * 100;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
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

  const metrics = useMemo(() => {
    const submitted = rep?.customer_requests_made ?? 0;
    const received = rep?.customer_requests_received ?? 0;
    const completion = rep?.customer_receive_rate_percent ?? calcPercent(received, submitted) ?? null;

    return [
      {
        key: "submitted",
        label: "طلبات مقدّمة",
        percent: submitted > 0 ? 100 : null,
        hint: "إجمالي الطلبات التي قمتَ بإنشائها داخل مجتمع الطباعة.",
        rightText: submitted ? `${submitted} طلب` : "—",
      },
      {
        key: "received",
        label: "طلبات مستلمة",
        percent: submitted > 0 ? calcPercent(received, submitted) : null,
        hint: "عدد الطلبات التي تم تسليمها لك بنجاح.",
        rightText: submitted ? `${received} من ${submitted}` : received ? `${received} طلب` : "—",
      },
      {
        key: "completion",
        label: "نسبة نجاح الطلبات",
        percent: completion == null ? null : Number(completion),
        hint: "نسبة الاستلام = (الطلبات المستلمة ÷ الطلبات المقدّمة) × 100.",
      },
    ];
  }, [rep]);

  const phoneVerified = Boolean(profile?.phone_verified) || profile?.phone_verification_status === "verified";

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

        <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
      </main>
    </div>
  );
}
