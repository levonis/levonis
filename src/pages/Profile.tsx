import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  ArrowRight,
  Bell,
  FileText,
  Heart,
  MapPin,
  Package,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Trophy,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import ReputationBar from "@/components/reputation/ReputationBar";

function calcPercent(numer: number, denom: number) {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return (numer / denom) * 100;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();

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

  const quickActions = useMemo(
    () => [
      {
        key: "orders",
        label: "طلباتي",
        hint: "تتبّع كل الطلبات والفواتير",
        icon: Package,
        to: "/my-orders",
      },
      {
        key: "requests",
        label: "طلباتي المخصصة",
        hint: "طلبات خاصة من المتجر",
        icon: FileText,
        to: "/my-requests",
      },
      {
        key: "addresses",
        label: "العناوين",
        hint: "إدارة العنوان الافتراضي",
        icon: MapPin,
        to: "/addresses",
      },
      {
        key: "notifications",
        label: "الإشعارات",
        hint: "آخر التحديثات والتنبيهات",
        icon: Bell,
        to: "/notifications",
      },
      {
        key: "favorites",
        label: "المفضلة",
        hint: "منتجاتك المحفوظة",
        icon: Heart,
        to: "/favorites",
      },
      {
        key: "rewards",
        label: "المكافآت",
        hint: "النقاط والجوائز",
        icon: Trophy,
        to: "/rewards",
      },
    ],
    []
  );

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-24 pb-10 max-w-4xl">
        <div className="mb-6 flex items-center justify-between gap-3">
          <Button variant="ghost" onClick={() => navigate(-1)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
          <Button variant="outline" onClick={() => navigate("/profile/settings")} className="gap-2">
            <Settings className="h-4 w-4" />
            إعدادات الحساب
          </Button>
        </div>

        {/* Hero profile card */}
        <Card className="glass-effect border-border/50 overflow-hidden">
          <div className="relative">
            <div className="h-28 bg-gradient-to-l from-primary/20 via-accent/10 to-transparent" />
            <CardContent className="pt-0">
              <div className="-mt-10 flex flex-col sm:flex-row items-center sm:items-end gap-4">
                <Avatar className="h-24 w-24 ring-4 ring-background shadow-sm">
                  <AvatarImage src={profile?.avatar_url || undefined} />
                  <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                    {(profile?.username?.[0] || profile?.full_name?.[0] || "م").toUpperCase()}
                  </AvatarFallback>
                </Avatar>

                <div className="flex-1 w-full text-center sm:text-right">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                      {profile?.full_name || profile?.username || "مستخدم"}
                    </h1>
                    <Badge variant="secondary" className="font-semibold">
                      @{profile?.username || "—"}
                    </Badge>
                  </div>

                  <div className="mt-3 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <Badge variant={phoneVerified ? "secondary" : "outline"} className="gap-2">
                      {phoneVerified ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      <span>{phoneVerified ? "تم تأكيد الرقم" : "غير مؤكد"}</span>
                    </Badge>
                    <Button
                      size="sm"
                      className="h-9 rounded-full"
                      onClick={() => navigate("/profile/settings")}
                    >
                      تعديل سريع
                    </Button>
                  </div>
                </div>
              </div>
            </CardContent>
          </div>
        </Card>

        {/* Quick actions */}
        <section className="mt-6">
          <div className="mb-3 flex items-center justify-between">
            <h2 className="text-sm font-bold text-foreground">وصول سريع</h2>
            <span className="text-xs text-muted-foreground">كل شيء في مكان واحد</span>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {quickActions.map((a) => {
              const Icon = a.icon;
              return (
                <button
                  key={a.key}
                  type="button"
                  onClick={() => navigate(a.to)}
                  className="group rounded-2xl border border-border bg-card/60 p-4 text-right hover:bg-card transition-colors"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="h-10 w-10 rounded-2xl bg-primary/10 flex items-center justify-center">
                      <Icon className="h-5 w-5 text-primary" />
                    </div>
                    <ArrowRight className="h-4 w-4 text-muted-foreground group-hover:text-foreground transition-colors" />
                  </div>
                  <div className="mt-3 text-sm font-bold text-foreground">{a.label}</div>
                  <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{a.hint}</div>
                </button>
              );
            })}
          </div>
        </section>

        {/* Reputation */}
        <section className="mt-6">
          <ReputationBar
            title="تقييماتك"
            overallStars={rep?.avg_stars ?? null}
            basisCount={rep?.ratings_count ?? null}
            basisLabel="تقييم"
            metrics={metrics}
          />
        </section>
      </main>
    </div>
  );
}
