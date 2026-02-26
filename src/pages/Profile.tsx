import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Settings, Store } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

// New profile zone components
import ProfileHeader from "@/components/profile/ProfileHeader";
import OrdersCenter from "@/components/profile/OrdersCenter";
import QuickServicesGrid from "@/components/profile/QuickServicesGrid";
import CouponsStrip from "@/components/profile/CouponsStrip";
import RecentOrders from "@/components/profile/RecentOrders";

export default function Profile() {
  const navigate = useNavigate();
  const { user } = useAuth();
  

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

  const { data: cardFrame } = useUserCardFrame(user?.id);

  // ── Merchant View (unchanged) ──
  if (isApprovedMerchant) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm">
        <main className="container mx-auto px-4 pt-24 pb-10 max-w-3xl" dir="rtl">
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

          <Card className="mt-4 border-border/60">
            <CardContent className="p-4 sm:p-5">
              <h2 className="text-sm font-bold text-foreground">لوحة التاجر (ملخص)</h2>
              <p className="mt-1 text-xs text-muted-foreground">
                هذه الواجهة للعرض حالياً. سيتم توسيعها لاحقاً لإدارة المنتجات والطلبات والعملاء والمالية.
              </p>
              <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
                {[
                  { title: "إدارة المنتجات", desc: "إضافة / تعديل المنتجات واختيار منتجات مميزة." },
                  { title: "إدارة الطلبات", desc: "متابعة الطلبات وحالات التنفيذ والتسليم." },
                  { title: "إدارة العملاء", desc: "عرض العملاء ومحادثات الطلبات." },
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

  // ── Regular User — Taobao-Inspired Dashboard ──
  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 pt-6 pb-24 max-w-lg space-y-4" dir="rtl">
        {/* A) Premium Profile Header */}
        {user?.id && (
          <ProfileHeader
            userId={user.id}
            profile={profile ? { full_name: profile.full_name, username: profile.username, avatar_url: profile.avatar_url } : null}
            cardFrame={cardFrame ? { frame_url: cardFrame.frame_url, frame_animation: cardFrame.frame_animation, card_color: cardFrame.card_color } : null}
          />
        )}

        {/* B) Orders Control Center */}
        {user?.id && <OrdersCenter userId={user.id} />}

        {/* C) Quick Services Grid */}
        <QuickServicesGrid />

        {/* D) Coupons & Promotions */}
        {user?.id && <CouponsStrip userId={user.id} />}

        {/* E) Recent Orders */}
        {user?.id && <RecentOrders userId={user.id} />}

      </main>
    </div>
  );
}
