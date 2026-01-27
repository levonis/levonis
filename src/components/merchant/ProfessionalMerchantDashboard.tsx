import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Store, ArrowRight, Package, MessageCircle, Star, Settings,
  ChevronLeft, Eye, PlusCircle, FileText, DollarSign, Plus
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import CompactBadgesDisplay from "@/components/merchant/CompactBadgesDisplay";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import type { BadgeTier } from "@/components/merchant/CompactBadgesDisplay";

export default function ProfessionalMerchantDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // Fetch merchant application
  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-app-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id, created_at")
        .eq("user_id", user.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch public profile
  const { data: publicProfile } = useQuery({
    queryKey: ["merchant-public-dashboard", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return null;
      const { data } = await supabase
        .from("merchant_public_profiles")
        .select("is_verified, badge_tier")
        .eq("id", merchantApp.id)
        .maybeSingle();
      return data;
    },
    enabled: !!merchantApp?.id,
  });

  // Fetch selected frame
  const { data: selectedFrame } = useQuery({
    queryKey: ["merchant-frame-dashboard", merchantApp?.selected_frame_id],
    queryFn: async () => {
      if (!merchantApp?.selected_frame_id) return null;
      const { data } = await supabase
        .from("avatar_frames")
        .select("id, name_ar, image_url")
        .eq("id", merchantApp.selected_frame_id)
        .maybeSingle();
      return data;
    },
    enabled: !!merchantApp?.selected_frame_id,
  });

  // Fetch stats
  const { data: stats } = useQuery({
    queryKey: ["merchant-dashboard-stats", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return null;
      
      const [offersRes, productsRes, ratingsRes, unreadRes] = await Promise.all([
        supabase.from("print_offers").select("id, status, price_iqd").eq("trader_id", merchantApp.id),
        supabase.from("merchant_products").select("id", { count: "exact", head: true }).eq("merchant_id", merchantApp.id).eq("is_active", true),
        supabase.from("merchant_ratings").select("rating").eq("merchant_id", merchantApp.id),
        supabase.from("listing_conversations").select("id, listing_messages(is_read, sender_id)").eq("seller_id", merchantApp.id),
      ]);

      const offers = offersRes.data || [];
      const completed = offers.filter(o => o.status === "completed").length;
      const accepted = offers.filter(o => o.status === "accepted").length;
      const revenue = offers.filter(o => o.status === "completed").reduce((sum, o) => sum + (o.price_iqd || 0), 0);

      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;

      let unread = 0;
      unreadRes.data?.forEach(c => {
        const msgs = (c.listing_messages as any[]) || [];
        msgs.forEach(m => { if (!m.is_read && m.sender_id !== merchantApp.id) unread++; });
      });

      return {
        products: productsRes.count || 0,
        completed,
        accepted,
        revenue,
        avgRating,
        totalRatings: ratings.length,
        unread,
      };
    },
    enabled: !!merchantApp?.id,
    staleTime: 30_000,
  });

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (appLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
          <Skeleton className="h-40 rounded-xl mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map(i => <Skeleton key={i} className="h-24 rounded-lg" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="p-6 text-center">
            <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-1">لوحة التاجر</h2>
            <p className="text-sm text-muted-foreground mb-4">متاحة للتجار المقبولين فقط</p>
            <div className="flex gap-2 justify-center">
              <Button variant="outline" onClick={() => navigate("/community")}>المجتمع</Button>
              <Button onClick={() => navigate("/community/customer/profile")}>تقديم طلب</Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl space-y-4">
        
        {/* Hero Card - Compact */}
        <Card className="overflow-hidden border-primary/20">
          <CardContent className="p-4 sm:p-5">
            <div className="flex items-center gap-4">
              {/* Avatar */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  imageUrl={merchantApp.store_image_url}
                  frameUrl={selectedFrame?.image_url}
                  size="lg"
                />
                <button
                  onClick={() => setProfileEditorOpen(true)}
                  className="absolute -bottom-1 -right-1 h-7 w-7 rounded-full bg-primary flex items-center justify-center shadow-md"
                >
                  <Settings className="h-3.5 w-3.5 text-primary-foreground" />
                </button>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h1 className="text-lg sm:text-xl font-black truncate">{merchantApp.display_name}</h1>
                  <CompactBadgesDisplay
                    isVerified={publicProfile?.is_verified}
                    badgeTier={(publicProfile?.badge_tier || "none") as BadgeTier}
                  />
                </div>

                <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                    {stats?.avgRating?.toFixed(1) || "0"} ({stats?.totalRatings || 0})
                  </span>
                  <span>{stats?.products || 0} منتج</span>
                  <span>{stats?.completed || 0} طلب مكتمل</span>
                </div>

                {/* Quick Actions */}
                <div className="flex flex-wrap gap-2 mt-3">
                  <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => navigate(`/store/${merchantApp.id}`)}>
                    <Eye className="h-3.5 w-3.5" />
                    المتجر
                  </Button>
                  <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" onClick={() => setProfileEditorOpen(true)}>
                    <Settings className="h-3.5 w-3.5" />
                    الإعدادات
                  </Button>
                  <Button size="sm" variant="ghost" className="h-8 text-xs gap-1.5" onClick={() => navigate("/community")}>
                    <ArrowRight className="h-3.5 w-3.5" />
                    المجتمع
                  </Button>
                </div>
              </div>

              {/* Revenue - Desktop */}
              <div className="hidden sm:block shrink-0">
                <div className="text-right">
                  <p className="text-[10px] text-muted-foreground">الإيرادات</p>
                  <p className="text-2xl font-black text-primary">{((stats?.revenue || 0) / 1000).toFixed(0)}K</p>
                  <p className="text-[10px] text-muted-foreground">د.ع</p>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Grid - Compact */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
          <button
            onClick={() => navigate("/community/merchant/orders")}
            className="group relative p-3.5 rounded-xl border border-primary/20 bg-primary/5 text-right hover:border-primary/40 transition-all"
          >
            <div className="h-9 w-9 rounded-lg bg-primary/20 flex items-center justify-center mb-2">
              <Package className="h-4 w-4 text-primary" />
            </div>
            <p className="text-sm font-bold">الطلبات</p>
            <p className="text-[10px] text-muted-foreground">{stats?.accepted || 0} قيد التنفيذ</p>
            {(stats?.accepted || 0) > 0 && (
              <Badge className="absolute top-2 left-2 bg-amber-500/20 text-amber-600 border-0 text-[9px] h-5">{stats?.accepted}</Badge>
            )}
          </button>

          <button
            onClick={() => navigate("/community/requests")}
            className="group relative p-3.5 rounded-xl border border-border/50 bg-card text-right hover:border-border transition-all"
          >
            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center mb-2">
              <FileText className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">الطلبات الجديدة</p>
            <p className="text-[10px] text-muted-foreground">تصفح وقدم عروض</p>
          </button>

          <button
            onClick={() => navigate("/community/messages")}
            className="group relative p-3.5 rounded-xl border border-border/50 bg-card text-right hover:border-border transition-all"
          >
            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center mb-2">
              <MessageCircle className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">المحادثات</p>
            <p className="text-[10px] text-muted-foreground">رسائل العملاء</p>
            {(stats?.unread || 0) > 0 && (
              <Badge className="absolute top-2 left-2 bg-destructive text-destructive-foreground border-0 text-[9px] h-5">{stats?.unread}</Badge>
            )}
          </button>

          <button
            onClick={() => navigate(`/store/${merchantApp.id}`)}
            className="group relative p-3.5 rounded-xl border border-border/50 bg-card text-right hover:border-border transition-all"
          >
            <div className="h-9 w-9 rounded-lg bg-muted/50 flex items-center justify-center mb-2">
              <Plus className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="text-sm font-bold">المنتجات</p>
            <p className="text-[10px] text-muted-foreground">{stats?.products || 0} منتج</p>
          </button>
        </div>

        {/* Stats Summary - Mobile */}
        <Card className="sm:hidden">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-primary" />
                <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
              </div>
              <span className="text-lg font-bold text-primary">{((stats?.revenue || 0) / 1000).toFixed(0)}K د.ع</span>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Profile Editor */}
      {merchantApp && (
        <StoreProfileEditor
          open={profileEditorOpen}
          onOpenChange={setProfileEditorOpen}
          merchantApp={{
            id: merchantApp.id,
            display_name: merchantApp.display_name,
            bio: merchantApp.bio,
            store_image_url: merchantApp.store_image_url,
            social_links: (merchantApp.social_links as { facebook?: string; instagram?: string }) || null,
            selected_frame_id: merchantApp.selected_frame_id,
          }}
        />
      )}
    </div>
  );
}
