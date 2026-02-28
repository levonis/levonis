import { useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  ArrowRight,
  Package,
  MessageCircle,
  Star,
  TrendingUp,
  Settings,
  ChevronLeft,
  Users,
  Clock,
  CheckCircle,
  AlertCircle,
  BadgeCheck,
  Award,
  Eye,
  PlusCircle,
  FileText,
  Sparkles,
  DollarSign,
  Gift,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import CompactBadgesDisplay from "@/components/merchant/CompactBadgesDisplay";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import MerchantDashboardWidgets from "@/components/merchant/MerchantDashboardWidgets";
import type { BadgeTier } from "@/components/merchant/CompactBadgesDisplay";

export default function CommunityMerchantProfessionalDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // Fetch merchant application
  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-app-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id, created_at, store_layout")
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
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("is_verified, badge_tier")
        .eq("id", merchantApp.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!merchantApp?.id,
  });

  // Fetch selected frame
  const { data: selectedFrame } = useQuery({
    queryKey: ["merchant-frame-dashboard", merchantApp?.selected_frame_id],
    queryFn: async () => {
      if (!merchantApp?.selected_frame_id) return null;
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("id, name_ar, image_url")
        .eq("id", merchantApp.selected_frame_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!merchantApp?.selected_frame_id,
  });

  // Fetch orders stats
  const { data: ordersStats } = useQuery({
    queryKey: ["merchant-orders-stats", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return null;
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, status, price_iqd, created_at")
        .eq("trader_id", merchantApp.id);
      if (error) throw error;

      const total = data?.length || 0;
      const completed = data?.filter(o => o.status === "completed")?.length || 0;
      const accepted = data?.filter(o => o.status === "accepted")?.length || 0;
      const submitted = data?.filter(o => o.status === "submitted")?.length || 0;
      const totalRevenue = data?.filter(o => o.status === "completed")?.reduce((sum, o) => sum + (o.price_iqd || 0), 0) || 0;

      return { total, completed, accepted, submitted, totalRevenue };
    },
    enabled: !!merchantApp?.id,
    staleTime: 30_000,
  });

  // Fetch products count
  const { data: productsCount } = useQuery({
    queryKey: ["merchant-products-count", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return 0;
      const { count, error } = await supabase
        .from("merchant_products")
        .select("id", { count: "exact", head: true })
        .eq("merchant_id", merchantApp.id)
        .eq("is_active", true);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!merchantApp?.id,
  });

  // Fetch ratings
  const { data: ratingsData } = useQuery({
    queryKey: ["merchant-ratings-summary", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return null;
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("rating")
        .eq("merchant_id", merchantApp.id);
      if (error) throw error;

      const total = data?.length || 0;
      const avg = total > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / total : 0;
      return { total, avg };
    },
    enabled: !!merchantApp?.id,
  });

  // Fetch unread messages
  const { data: unreadMessages } = useQuery({
    queryKey: ["merchant-unread-messages", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return 0;
      const { data: convs, error } = await supabase
        .from("listing_conversations")
        .select("id, listing_messages(is_read, sender_id)")
        .eq("seller_id", merchantApp.id);
      if (error) throw error;

      let count = 0;
      convs?.forEach(c => {
        const msgs = (c.listing_messages as any[]) || [];
        msgs.forEach(m => {
          if (!m.is_read && m.sender_id !== merchantApp.id) count++;
        });
      });
      return count;
    },
    enabled: !!merchantApp?.id,
    staleTime: 15_000,
  });

  // Fetch pending requests (no offer submitted)
  const { data: pendingRequests } = useQuery({
    queryKey: ["merchant-pending-requests", merchantApp?.id],
    queryFn: async () => {
      if (!merchantApp?.id) return 0;
      
      const { data: allRequests, error: reqErr } = await supabase
        .from("community_print_requests")
        .select("id")
        .in("status", ["pending", "open"]);
      if (reqErr) throw reqErr;

      const requestIds = allRequests?.map(r => r.id) || [];
      if (requestIds.length === 0) return 0;

      const { data: myOffers, error: offerErr } = await supabase
        .from("print_offers")
        .select("request_id")
        .eq("trader_id", merchantApp.id)
        .in("request_id", requestIds);
      if (offerErr) throw offerErr;

      const offeredIds = new Set(myOffers?.map(o => o.request_id) || []);
      return requestIds.filter(id => !offeredIds.has(id)).length;
    },
    enabled: !!merchantApp?.id,
    staleTime: 30_000,
  });

  const merchantAge = useMemo(() => {
    if (!merchantApp?.created_at) return 0;
    return Math.floor((Date.now() - new Date(merchantApp.created_at).getTime()) / (1000 * 60 * 60 * 24));
  }, [merchantApp?.created_at]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (appLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-56 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="border-border bg-card">
            <CardContent className="p-8 text-center">
              <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h2 className="text-xl font-bold text-foreground mb-2">لوحة التاجر</h2>
              <p className="text-sm text-muted-foreground mb-6">
                هذه الصفحة متاحة فقط للتجار المقبولين في مجتمع ليفو
              </p>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={() => navigate("/community")}>
                  العودة للمجتمع
                </Button>
                <Button onClick={() => navigate("/community/customer/profile")}>
                  تقديم طلب تاجر
                </Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl space-y-6">
        
        {/* Hero Merchant Card */}
        <Card className="relative overflow-hidden border-border bg-gradient-to-br from-card via-card to-primary/5">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-40 h-40 bg-accent/10 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col lg:flex-row items-center lg:items-start gap-6">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  imageUrl={merchantApp.store_image_url}
                  frameUrl={selectedFrame?.image_url}
                  size="xl"
                  animated
                />
                <button
                  onClick={() => setProfileEditorOpen(true)}
                  className="absolute -bottom-1 -right-1 h-9 w-9 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background hover:bg-primary/90 transition-colors"
                >
                  <Settings className="h-4 w-4 text-primary-foreground" />
                </button>
              </div>

              {/* Info Section */}
              <div className="flex-1 text-center lg:text-right min-w-0">
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground truncate">
                    {merchantApp.display_name}
                  </h1>
                  <CompactBadgesDisplay
                    isVerified={publicProfile?.is_verified}
                    badgeTier={(publicProfile?.badge_tier || "none") as BadgeTier}
                  />
                </div>

                <p className="text-sm text-muted-foreground mb-4">تاجر في مجتمع ليفو منذ {merchantAge} يوم</p>

                {merchantApp.bio && (
                  <p className="text-sm text-foreground/80 mb-4 line-clamp-2 max-w-2xl">
                    {merchantApp.bio}
                  </p>
                )}

                {/* Quick Stats */}
                <div className="flex flex-wrap items-center justify-center lg:justify-start gap-4 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                    <span>{ratingsData?.avg.toFixed(1) || "0.0"}</span>
                    <span className="text-muted-foreground/60">({ratingsData?.total || 0})</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Package className="h-3.5 w-3.5" />
                    <span>{ordersStats?.completed || 0} طلب مكتمل</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Store className="h-3.5 w-3.5" />
                    <span>{productsCount || 0} منتج</span>
                  </div>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-center lg:justify-start">
                  <Button
                    size="sm"
                    onClick={() => navigate(`/store/${merchantApp.id}`)}
                    className="gap-2"
                  >
                    <Eye className="h-4 w-4" />
                    عرض المتجر
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setProfileEditorOpen(true)}
                    className="gap-2"
                  >
                    <Settings className="h-4 w-4" />
                    تعديل الإعدادات
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/community")}
                    className="gap-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    المجتمع
                  </Button>
                </div>
              </div>

              {/* Revenue Card - Desktop */}
              <div className="hidden lg:block shrink-0 w-48">
                <div className="rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    <span className="text-xs text-muted-foreground">إجمالي الإيرادات</span>
                  </div>
                  <div className="text-2xl font-black text-primary">
                    {((ordersStats?.totalRevenue || 0) / 1000).toFixed(0)}K
                  </div>
                  <div className="text-[10px] text-muted-foreground">دينار عراقي</div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => navigate("/community/merchant/orders")}
            className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-right hover:border-primary/50 transition-all"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm font-bold text-foreground">الطلبات</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {ordersStats?.accepted || 0} قيد التنفيذ
              </div>
            </div>
            {(ordersStats?.accepted || 0) > 0 && (
              <Badge className="absolute top-3 left-3 bg-yellow-500/20 text-yellow-600 border-0 text-[10px]">
                {ordersStats?.accepted}
              </Badge>
            )}
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/community/requests")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <FileText className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">طلبات جديدة</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">تصفح وتقديم عروض</div>
            </div>
            {(pendingRequests || 0) > 0 && (
              <Badge className="absolute top-3 left-3 bg-primary/20 text-primary border-0 text-[10px]">
                {pendingRequests}
              </Badge>
            )}
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/community/messages")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">المحادثات</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">رسائل الزبائن</div>
            </div>
            {(unreadMessages || 0) > 0 && (
              <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground border-0 text-[10px]">
                {unreadMessages}
              </Badge>
            )}
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/community/merchant/store")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Store className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">المنتجات</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">{productsCount || 0} منتج</div>
            </div>
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/merchant-giveaways")}
            className="group relative overflow-hidden rounded-2xl border border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-orange-500/5 p-4 text-right hover:border-amber-500/50 transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-amber-500/20 flex items-center justify-center mb-3">
                <Gift className="h-5 w-5 text-amber-500" />
              </div>
              <div className="text-sm font-bold text-foreground">هدايا التجار</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">انضم للمسابقات واربح</div>
            </div>
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{ordersStats?.total || 0}</div>
                  <div className="text-[10px] text-muted-foreground">إجمالي العروض</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Clock className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{ordersStats?.accepted || 0}</div>
                  <div className="text-[10px] text-muted-foreground">قيد التنفيذ</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{ordersStats?.completed || 0}</div>
                  <div className="text-[10px] text-muted-foreground">مكتملة</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{ratingsData?.avg.toFixed(1) || "0.0"}</div>
                  <div className="text-[10px] text-muted-foreground">{ratingsData?.total || 0} تقييم</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Revenue Card - Mobile */}
          <Card className="border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 lg:hidden col-span-2">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                  <DollarSign className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-black text-primary">
                    {((ordersStats?.totalRevenue || 0) / 1000).toFixed(0)}K
                  </div>
                  <div className="text-[10px] text-muted-foreground">إجمالي الإيرادات</div>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Desktop 5th card */}
          <Card className="hidden lg:block border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0">
                  <Users className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{ordersStats?.submitted || 0}</div>
                  <div className="text-[10px] text-muted-foreground">عروض مقدمة</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Widgets */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <MerchantDashboardWidgets merchantId={merchantApp.id} />
          </div>
          
          {/* Quick Tips */}
          <Card className="border-border/50 bg-card/80">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-primary" />
                نصائح سريعة
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <CheckCircle className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">استجب بسرعة</div>
                  <div className="text-[10px] text-muted-foreground">الرد السريع يزيد فرص قبول عرضك</div>
                </div>
              </div>
              
              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <div className="h-8 w-8 rounded-lg bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Star className="h-4 w-4 text-yellow-500" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">اجمع التقييمات</div>
                  <div className="text-[10px] text-muted-foreground">التقييمات الجيدة ترفع ترتيبك</div>
                </div>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/30">
                <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center shrink-0">
                  <Award className="h-4 w-4 text-green-500" />
                </div>
                <div>
                  <div className="text-xs font-medium text-foreground">أكمل الطلبات</div>
                  <div className="text-[10px] text-muted-foreground">الإنجاز يحسّن شارتك</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Profile Editor */}
        <StoreProfileEditor
          open={profileEditorOpen}
          onOpenChange={setProfileEditorOpen}
          merchantApp={{
            id: merchantApp.id,
            display_name: merchantApp.display_name,
            bio: merchantApp.bio,
            store_image_url: merchantApp.store_image_url,
            social_links: merchantApp.social_links as { facebook?: string; instagram?: string } | null,
            selected_frame_id: merchantApp.selected_frame_id,
            store_layout: (merchantApp.store_layout as "standard" | "grid_images" | "strip" | "sidebar") || undefined,
          }}
        />
      </main>
    </div>
  );
}
