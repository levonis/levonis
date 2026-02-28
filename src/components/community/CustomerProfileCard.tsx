import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  User, Star, Package, MessageCircle, Settings, ShieldCheck,
  Award, TrendingUp, Sparkles
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";

interface CustomerProfileCardProps {
  onSettingsClick?: () => void;
  onNewRequest?: () => void;
  onViewRequests?: () => void;
}

export default function CustomerProfileCard({
  onSettingsClick,
  onNewRequest,
  onViewRequests,
}: CustomerProfileCardProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch from profiles first, fallback to community
  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer-profile-full", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: stdProfile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url, username")
        .eq("id", user!.id)
        .maybeSingle();

      const { data: communityProfile } = await supabase
        .from("community_customer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();

      return {
        display_name: stdProfile?.full_name || communityProfile?.display_name || null,
        username: stdProfile?.username || null,
        avatar_url: stdProfile?.avatar_url || communityProfile?.avatar_url || null,
        bio: communityProfile?.bio || null,
        is_verified: communityProfile?.is_verified || false,
        reputation_score: communityProfile?.reputation_score || 0,
      };
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["customer-stats", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: requestsData } = await supabase
        .from("community_print_requests")
        .select("id, status")
        .eq("user_id", user!.id);

      const requests = (requestsData as Array<{ id: string; status: string }>) || [];
      const activeRequests = requests.filter((r) => 
        ["approved", "in_progress"].includes(r.status)
      ).length;

      return {
        totalRequests: requests.length,
        activeRequests,
        completedOrders: requests.filter(r => r.status === "completed").length,
      };
    },
  });

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.display_name) score += 25;
    if (profile.avatar_url) score += 25;
    if (profile.bio) score += 25;
    score += 25;
    return score;
  }, [profile]);

  if (isLoading) {
    return (
      <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
        <div className="h-16 bg-gradient-to-bl from-primary/15 to-transparent" />
        <div className="px-4 pb-4 -mt-6">
          <div className="flex items-end gap-3">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2 pb-1">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-3 w-20" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-2xl border border-border/30 bg-card overflow-hidden">
      {/* Mini Banner */}
      <div className="relative h-16 bg-gradient-to-bl from-primary/15 via-primary/5 to-transparent">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_80%,hsl(var(--primary)/0.1),transparent_60%)]" />
        <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-card to-transparent" />
        {/* Settings Button */}
        <Button
          size="icon"
          variant="ghost"
          className="absolute top-2 left-2 h-7 w-7 bg-card/50 backdrop-blur-sm rounded-lg"
          onClick={onSettingsClick}
        >
          <Settings className="h-3.5 w-3.5" />
        </Button>
      </div>

      <div className="px-4 pb-4 -mt-8 space-y-3">
        {/* Profile Row */}
        <div className="flex items-end gap-3">
          <div className="relative">
            <Avatar className="h-12 w-12 border-2 border-card shadow-lg">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-gradient-to-br from-primary/20 to-primary/5">
                <User className="h-5 w-5 text-primary" />
              </AvatarFallback>
            </Avatar>
            {profile?.is_verified && (
              <div className="absolute -bottom-0.5 -right-0.5 h-4.5 w-4.5 rounded-full bg-primary flex items-center justify-center ring-2 ring-card">
                <ShieldCheck className="h-2.5 w-2.5 text-primary-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0 pb-0.5">
            <div className="flex items-center gap-1.5">
              <h3 className="font-black text-sm truncate text-foreground">
                {profile?.display_name || "مستخدم جديد"}
              </h3>
              {profile?.is_verified && (
                <Badge className="bg-primary/15 text-primary border-0 text-[8px] h-4 px-1 rounded-md">موثق</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                {profile?.reputation_score || 0}
              </span>
              <span className="text-border">·</span>
              <span>{stats?.totalRequests || 0} طلب</span>
            </div>
          </div>
        </div>

        {/* Completion Bar */}
        {profileCompletion < 100 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[10px]">
              <span className="text-muted-foreground">اكتمال الملف</span>
              <span className="font-bold text-primary">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-1" />
          </div>
        )}

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-1.5">
          <div className="p-2 rounded-xl bg-muted/30 border border-border/30 text-center">
            <Package className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
            <p className="text-xs font-black">{stats?.activeRequests || 0}</p>
            <p className="text-[8px] text-muted-foreground">نشط</p>
          </div>
          <div className="p-2 rounded-xl bg-muted/30 border border-border/30 text-center">
            <Award className="h-3.5 w-3.5 text-emerald-500 mx-auto mb-0.5" />
            <p className="text-xs font-black">{stats?.completedOrders || 0}</p>
            <p className="text-[8px] text-muted-foreground">مكتمل</p>
          </div>
          <button
            onClick={() => navigate("/chats")}
            className="p-2 rounded-xl bg-muted/30 border border-border/30 text-center hover:border-primary/30 transition-all relative"
          >
            <MessageCircle className="h-3.5 w-3.5 text-blue-500 mx-auto mb-0.5" />
            <p className="text-xs font-black">0</p>
            <p className="text-[8px] text-muted-foreground">رسالة</p>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="flex gap-1.5">
          <Button
            size="sm"
            className="flex-1 h-8 text-[10px] gap-1 rounded-xl font-bold"
            onClick={onNewRequest}
          >
            <Sparkles className="h-3 w-3" />
            طلب جديد
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-8 text-[10px] gap-1 rounded-xl font-bold"
            onClick={onViewRequests}
          >
            <TrendingUp className="h-3 w-3" />
            طلباتي
          </Button>
        </div>
      </div>
    </div>
  );
}
