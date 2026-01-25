import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Settings,
  ShieldAlert,
  ShieldCheck,
  Star,
  Store,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import type { FrameAnimationType } from "@/components/merchant/AvatarWithFrame";

function calcPercent(numer: number, denom: number) {
  if (!Number.isFinite(numer) || !Number.isFinite(denom) || denom <= 0) return null;
  return (numer / denom) * 100;
}

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [merchantOpen, setMerchantOpen] = useState(false);

  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-application", user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name, store_image_url, selected_frame_id")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch selected frame for merchant
  const { data: selectedFrame } = useQuery({
    queryKey: ["merchant-frame", merchantApp?.selected_frame_id],
    enabled: !!merchantApp?.selected_frame_id,
    staleTime: 60_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("id, name_ar, image_url")
        .eq("id", merchantApp!.selected_frame_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const isApprovedMerchant = merchantApp?.status === "approved";

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
  
  // Get user's active card frame
  const { data: cardFrame } = useUserCardFrame(user?.id);

  const { data: lastRequest } = useQuery({
    queryKey: ["my-last-print-request", user?.id],
    enabled: !!user?.id,
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_requests")
        .select("status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: last4Requests } = useQuery({
    queryKey: ["my-last-4-print-requests", user?.id],
    enabled: !!user?.id && !isApprovedMerchant,
    staleTime: 20_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_requests")
        .select("id, title, status, created_at")
        .eq("user_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(4);
      if (error) throw error;
      return (data ?? []) as Array<{ id: string; title: string; status: string; created_at: string }>;
    },
  });

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

  const overall = rep?.avg_stars ?? null;
  const overallText = overall == null ? "—" : Number(overall).toFixed(1);
  const basisCount = rep?.ratings_count ?? null;

  const lastStatus = lastRequest?.status ?? null;
  const lastActivityAt = lastRequest?.created_at ?? null;
  const lastActivityText = lastActivityAt
    ? new Date(lastActivityAt).toLocaleString("ar-IQ", {
        year: "numeric",
        month: "short",
        day: "2-digit",
      })
    : "—";

  const statusLabel = (s: string | null) => {
    if (!s) return "—";
    switch (s) {
      case "pending_review":
        return "قيد المراجعة";
      case "in_progress":
        return "قيد التنفيذ";
      case "completed":
        return "مكتمل";
      case "delivered":
        return "تم التسليم";
      case "rejected":
        return "مرفوض";
      default:
        return s;
    }
  };

  const percentText = (p: number | null | undefined) => {
    if (p == null || !Number.isFinite(p)) return "—";
    return `${Math.round(p)}%`;
  };

  if (isApprovedMerchant) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm">
        <main className="container mx-auto px-4 pt-24 pb-10 max-w-3xl" dir="rtl">
          {/* Merchant Header */}
          <Card className="border-border/60">
            <CardContent className="p-4 sm:p-5">
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <AvatarWithFrame
                    imageUrl={merchantApp?.store_image_url || profile?.avatar_url}
                    frameUrl={selectedFrame?.image_url}
                    size="sm"
                    animated
                  />

                  <div className="min-w-0">
                    <h1 className="text-lg font-bold text-foreground truncate">
                      {merchantApp?.display_name || profile?.full_name || profile?.username || "التاجر"}
                    </h1>
                    <div className="mt-0.5 flex flex-wrap items-center gap-2">
                      <Badge variant="secondary" className="gap-1.5 text-xs font-semibold">
                        <Store className="h-3.5 w-3.5" />
                        <span>حساب تاجر</span>
                      </Badge>
                      <span className="text-sm text-muted-foreground truncate">@{profile?.username || "—"}</span>
                    </div>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="h-9 rounded-xl shrink-0 gap-2"
                  onClick={() => navigate("/profile/settings")}
                >
                  <Settings className="h-4 w-4" />
                  الإعدادات
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Merchant Summary (UI only) */}
          <Card className="mt-4 border-border/60">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground">لوحة التاجر (ملخص)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                هذه الواجهة للعرض حالياً. سيتم توسيعها لاحقاً لإدارة المنتجات والطلبات والزبائن والمالية.
              </p>

              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "إدارة المنتجات", desc: "إضافة / تعديل المنتجات واختيار منتجات مميزة." },
                  { title: "إدارة الطلبات", desc: "متابعة الطلبات وحالات التنفيذ والتسليم." },
                  { title: "إدارة الزبائن", desc: "عرض العملاء ومحادثات الطلبات." },
                  { title: "المالية والتقارير", desc: "ملخص الأرباح والعمولات والمدفوعات." },
                ].map((c) => (
                  <div key={c.title} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="text-sm font-semibold text-foreground">{c.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground leading-relaxed">{c.desc}</div>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-24 pb-10 max-w-3xl" dir="rtl">
        {/* A) Profile Header */}
        <Card className="border-border/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-start gap-3 min-w-0">
                <AvatarWithFrame
                  imageUrl={profile?.avatar_url}
                  frameUrl={cardFrame?.frame_url}
                  size="sm"
                  animated={!!cardFrame?.frame_url}
                  animationType={cardFrame?.frame_animation as FrameAnimationType}
                  badgeColor={cardFrame?.card_color}
                  isUser
                />

                <div className="min-w-0">
                  <h1 className="text-lg font-bold text-foreground truncate">
                    {profile?.full_name || profile?.username || "مستخدم"}
                  </h1>
                  <div className="mt-0.5 flex flex-wrap items-center gap-2">
                    <span className="text-sm text-muted-foreground truncate">@{profile?.username || "—"}</span>
                    <Badge
                      variant={phoneVerified ? "secondary" : "outline"}
                      className="gap-1.5 text-xs font-semibold"
                    >
                      {phoneVerified ? (
                        <ShieldCheck className="h-3.5 w-3.5" />
                      ) : (
                        <ShieldAlert className="h-3.5 w-3.5" />
                      )}
                      <span>{phoneVerified ? "مؤكد" : "غير مؤكد"}</span>
                    </Badge>
                  </div>
                </div>
              </div>

              <Button
                variant="outline"
                size="sm"
                className="h-9 rounded-xl shrink-0 gap-2"
                onClick={() => navigate("/profile/settings")}
              >
                <Settings className="h-4 w-4" />
                الإعدادات
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* B) Rating Card */}
        <Card className="mt-4 border-border/60">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-foreground">التقييم</h2>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="flex items-center gap-1" aria-label="التقييم العام">
                  {Array.from({ length: 5 }).map((_, i) => {
                    const filled = overall != null && overall >= i + 1;
                    const half = overall != null && overall >= i + 0.5 && overall < i + 1;
                    return (
                      <span key={i} className="relative inline-flex h-4 w-4">
                        <Star className="h-4 w-4 text-muted-foreground" />
                        {(filled || half) && (
                          <span
                            className="absolute inset-0 overflow-hidden"
                            style={{ width: filled ? "100%" : "50%" }}
                          >
                            <Star className="h-4 w-4 text-primary" />
                          </span>
                        )}
                      </span>
                    );
                  })}
                </div>
                <div className="text-sm font-bold text-foreground tabular-nums">{overallText}</div>
              </div>

              <div className="text-xs text-muted-foreground">
                بناءً على {basisCount == null ? "—" : basisCount} طلب
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 sm:grid-cols-3 gap-3">
              {metrics.map((m) => (
                <div key={m.key} className="rounded-xl border border-border/60 bg-card p-3">
                  <div className="text-xs text-muted-foreground">{m.label}</div>
                  <div className="mt-1 text-base font-bold text-foreground tabular-nums">
                    {percentText(m.percent)}
                  </div>
                  <div className="mt-1 text-[11px] text-muted-foreground">{m.rightText ?? ""}</div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* C) Activity Summary */}
        <Card className="mt-4 border-border/60">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-foreground">ملخص النشاط</h2>
            <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="text-xs text-muted-foreground">حالة آخر طلب</div>
                <div className="mt-1 text-sm font-semibold text-foreground">{statusLabel(lastStatus)}</div>
              </div>
              <div className="rounded-xl border border-border/60 bg-card p-3">
                <div className="text-xs text-muted-foreground">تاريخ آخر نشاط</div>
                <div className="mt-1 text-sm font-semibold text-foreground tabular-nums">{lastActivityText}</div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* آخر ٤ طلبات */}
        <Card className="mt-4 border-border/60">
          <CardContent className="p-4 sm:p-5">
            <h2 className="text-sm font-bold text-foreground">آخر ٤ طلبات</h2>
            <div className="mt-3 space-y-2">
              {(last4Requests ?? []).length === 0 ? (
                <div className="rounded-xl border border-border/60 bg-card p-3 text-sm text-muted-foreground">
                  لا توجد طلبات بعد.
                </div>
              ) : (
                (last4Requests ?? []).map((r) => (
                  <div key={r.id} className="rounded-xl border border-border/60 bg-card p-3">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="text-sm font-semibold text-foreground truncate">{r.title}</div>
                        <div className="mt-1 flex flex-wrap items-center gap-2">
                          <span className="text-xs text-muted-foreground">{statusLabel(r.status)}</span>
                          <span className="text-xs text-muted-foreground tabular-nums">
                            {new Date(r.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </CardContent>
        </Card>

        {/* التحويل إلى تاجر */}
        <Card className="mt-4 border-border/60">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="text-sm font-bold text-foreground">تحويل الحساب إلى تاجر</div>
                <div className="mt-0.5 text-xs text-muted-foreground">
                  قدّم طلب تسجيل كتاجر. بعد الموافقة سيتحوّل عرض الملف تلقائياً إلى واجهة التاجر.
                </div>
              </div>
              <Button className="h-9 rounded-xl shrink-0" onClick={() => setMerchantOpen(true)}>
                تحويل إلى تاجر
              </Button>
            </div>
          </CardContent>
        </Card>

        <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
      </main>
    </div>
  );
}
