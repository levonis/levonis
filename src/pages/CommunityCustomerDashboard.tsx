import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  User,
  ArrowRight,
  PlusCircle,
  ClipboardList,
  MessageCircle,
  Star,
  Shield,
  TrendingUp,
  Calendar,
  Package,
  Award,
  ChevronLeft,
  Sparkles,
  Settings,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import CommunityCustomerProfileModal from "@/components/community/CommunityCustomerProfileModal";
import MerchantSignupDialog from "@/components/community/MerchantSignupDialog";
import NewPrintRequestDialog from "@/components/community/NewPrintRequestDialog";
import { useUserCardFrame } from "@/hooks/useUserCardFrame";
import type { FrameAnimationType } from "@/components/merchant/AvatarWithFrame";

export default function CommunityCustomerDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [profileOpen, setProfileOpen] = useState(false);
  const [merchantOpen, setMerchantOpen] = useState(false);
  const [newRequestOpen, setNewRequestOpen] = useState(false);

  // Get user's card frame
  const { data: cardFrame } = useUserCardFrame(user?.id);

  // Fetch profile
  const { data: profile, isLoading: profileLoading } = useQuery({
    queryKey: ["customer-dashboard-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("profiles")
        .select("full_name, phone_number, username, avatar_url, birth_date, gender, created_at")
        .eq("id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Fetch community profile
  const { data: communityProfile } = useQuery({
    queryKey: ["customer-community-profile", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("community_customer_profiles")
        .select("reputation_score, total_requests_made, total_requests_received, total_spent, is_verified")
        .eq("user_id", user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Fetch merchant status
  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-status-dashboard", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Fetch user's requests
  const { data: requestsStats } = useQuery({
    queryKey: ["customer-requests-stats", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("community_print_requests")
        .select("id, status")
        .eq("user_id", user.id);
      if (error) throw error;
      
      const total = data?.length || 0;
      const pending = data?.filter(r => r.status === "pending" || r.status === "open")?.length || 0;
      const completed = data?.filter(r => r.status === "completed" || r.status === "delivered")?.length || 0;
      const inProgress = data?.filter(r => r.status === "accepted" || r.status === "in_progress")?.length || 0;
      
      return { total, pending, completed, inProgress };
    },
    enabled: !!user?.id,
    staleTime: 30_000,
  });

  // Fetch unread messages
  const { data: unreadMessages } = useQuery({
    queryKey: ["customer-unread-messages", user?.id],
    queryFn: async () => {
      if (!user?.id) return 0;
      const { count, error } = await supabase
        .from("listing_messages")
        .select("id", { count: "exact", head: true })
        .neq("sender_id", user.id)
        .eq("is_read", false);
      if (error) throw error;
      return count || 0;
    },
    enabled: !!user?.id,
    staleTime: 15_000,
  });

  const isProfileComplete = useMemo(() => {
    if (!profile) return false;
    return !!(
      profile.full_name?.trim() &&
      profile.phone_number?.trim() &&
      profile.username?.trim() &&
      profile.birth_date &&
      (profile.gender === "male" || profile.gender === "female") &&
      profile.avatar_url
    );
  }, [profile]);

  const isMerchant = merchantApp?.status === "approved";

  const accountAge = useMemo(() => {
    if (!profile?.created_at) return 0;
    const days = Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24));
    return days;
  }, [profile?.created_at]);

  if (!user) {
    navigate("/auth");
    return null;
  }

  if (profileLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
          <Skeleton className="h-48 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 gap-4">
            {[1, 2, 3, 4].map(i => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl space-y-6">
        
        {/* Hero Profile Card */}
        <Card className="relative overflow-hidden border-border bg-gradient-to-br from-card via-card to-primary/5">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-48 h-48 bg-primary/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl translate-y-1/2 -translate-x-1/2" />
          
          <CardContent className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-6">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                <AvatarWithFrame
                  imageUrl={profile?.avatar_url || undefined}
                  frameUrl={cardFrame?.frame_url}
                  size="xl"
                  animated={!!cardFrame?.frame_url}
                  animationType={cardFrame?.frame_animation as FrameAnimationType}
                  badgeColor={cardFrame?.card_color}
                  isUser
                />
                <button
                  onClick={() => setProfileOpen(true)}
                  className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center shadow-lg border-2 border-background hover:bg-primary/90 transition-colors"
                >
                  <Settings className="h-4 w-4 text-primary-foreground" />
                </button>
              </div>

              {/* Info Section */}
              <div className="flex-1 text-center sm:text-right">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-black text-foreground">
                    {profile?.full_name || "مستخدم جديد"}
                  </h1>
                  {communityProfile?.is_verified && (
                    <Badge variant="secondary" className="gap-1 bg-primary/10 text-primary border-primary/20">
                      <Shield className="h-3 w-3" />
                      موثق
                    </Badge>
                  )}
                </div>
                
                {profile?.username && (
                  <p className="text-sm text-muted-foreground mb-3">@{profile.username}</p>
                )}

                {/* Stats Row */}
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-3 mb-4">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Calendar className="h-3.5 w-3.5" />
                    <span>{accountAge} يوم</span>
                  </div>
                  {communityProfile?.reputation_score && communityProfile.reputation_score > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <Star className="h-3.5 w-3.5 text-yellow-500 fill-yellow-500" />
                      <span>{communityProfile.reputation_score} نقطة سمعة</span>
                    </div>
                  )}
                  {(communityProfile?.total_spent || 0) > 0 && (
                    <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                      <TrendingUp className="h-3.5 w-3.5 text-primary" />
                      <span>{communityProfile?.total_spent?.toLocaleString()} د.ع إنفاق</span>
                    </div>
                  )}
                </div>

                {/* Profile Completion */}
                {!isProfileComplete && (
                  <div className="bg-destructive/10 border border-destructive/20 rounded-xl p-3 mb-4">
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-destructive" />
                      <span className="text-sm font-medium text-destructive">أكمل ملفك الشخصي</span>
                    </div>
                    <Progress value={60} className="h-1.5" />
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => setProfileOpen(true)}
                  >
                    <User className="h-4 w-4" />
                    تعديل الملف
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => navigate("/")}
                    className="gap-2"
                  >
                    <ArrowRight className="h-4 w-4" />
                    الرئيسية
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Quick Actions Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <button
            onClick={() => isProfileComplete ? setNewRequestOpen(true) : setProfileOpen(true)}
            className="group relative overflow-hidden rounded-2xl border border-primary/30 bg-gradient-to-br from-primary/10 to-primary/5 p-4 text-right hover:border-primary/50 transition-all"
          >
            <div className="absolute top-0 right-0 w-20 h-20 bg-primary/10 rounded-full blur-2xl" />
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center mb-3">
                <PlusCircle className="h-5 w-5 text-primary" />
              </div>
              <div className="text-sm font-bold text-foreground">طلب جديد</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">إضافة طلب طباعة</div>
            </div>
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/community/customer/requests")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <ClipboardList className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">طلباتي</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">
                {requestsStats?.total || 0} طلب
              </div>
            </div>
            {(requestsStats?.pending || 0) > 0 && (
              <Badge className="absolute top-3 left-3 bg-primary/20 text-primary border-0 text-[10px]">
                {requestsStats?.pending} جديد
              </Badge>
            )}
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/chats")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <MessageCircle className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">المحادثات</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">التواصل مع التجار</div>
            </div>
            {(unreadMessages || 0) > 0 && (
              <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground border-0 text-[10px]">
                {unreadMessages}
              </Badge>
            )}
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>

          <button
            onClick={() => navigate("/community")}
            className="group relative overflow-hidden rounded-2xl border border-border/50 bg-card/80 p-4 text-right hover:border-border transition-all"
          >
            <div className="relative">
              <div className="h-10 w-10 rounded-xl bg-muted/50 flex items-center justify-center mb-3">
                <Package className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="text-sm font-bold text-foreground">المجتمع</div>
              <div className="text-[10px] text-muted-foreground mt-0.5">تصفح التجار</div>
            </div>
            <ChevronLeft className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
          </button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{requestsStats?.total || 0}</div>
                  <div className="text-[10px] text-muted-foreground">إجمالي الطلبات</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0">
                  <Star className="h-5 w-5 text-yellow-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{requestsStats?.inProgress || 0}</div>
                  <div className="text-[10px] text-muted-foreground">قيد التنفيذ</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-green-500/10 flex items-center justify-center shrink-0">
                  <Award className="h-5 w-5 text-green-500" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{requestsStats?.completed || 0}</div>
                  <div className="text-[10px] text-muted-foreground">مكتملة</div>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-border/50 bg-card/80">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-accent/10 flex items-center justify-center shrink-0">
                  <Shield className="h-5 w-5 text-accent" />
                </div>
                <div>
                  <div className="text-2xl font-black text-foreground">{communityProfile?.reputation_score || 0}</div>
                  <div className="text-[10px] text-muted-foreground">نقاط السمعة</div>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Merchant CTA */}
        {!isMerchant && isProfileComplete && (
          <Card className="border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
            <CardContent className="p-6">
              <div className="flex flex-col sm:flex-row items-center gap-4">
                <div className="h-14 w-14 rounded-2xl bg-primary/10 flex items-center justify-center shrink-0">
                  <Award className="h-7 w-7 text-primary" />
                </div>
                <div className="flex-1 text-center sm:text-right">
                  <h3 className="text-lg font-bold text-foreground mb-1">انضم كتاجر</h3>
                  <p className="text-sm text-muted-foreground">
                    ابدأ بتقديم خدماتك في مجتمع ليفو واحصل على طلبات من الزبائن
                  </p>
                </div>
                <Button onClick={() => setMerchantOpen(true)} className="gap-2 shrink-0">
                  <Sparkles className="h-4 w-4" />
                  تقديم طلب
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Profile Dialog */}
        <Dialog open={profileOpen} onOpenChange={setProfileOpen}>
          <DialogContent className="sm:max-w-2xl p-0 gap-0">
            <DialogHeader className="sr-only">
              <DialogTitle>الملف الشخصي</DialogTitle>
            </DialogHeader>
            <div className="scrollbar-stable max-h-[85vh] overflow-y-auto overflow-x-hidden">
              <CommunityCustomerProfileModal
                onDone={() => setProfileOpen(false)}
                onOpenMerchantSignup={() => {
                  setProfileOpen(false);
                  setMerchantOpen(true);
                }}
              />
            </div>
          </DialogContent>
        </Dialog>

        <MerchantSignupDialog open={merchantOpen} onOpenChange={setMerchantOpen} />
        <NewPrintRequestDialog open={newRequestOpen} onOpenChange={setNewRequestOpen} />
      </main>
    </div>
  );
}
