import { useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  User, Star, Package, MessageCircle, Settings, ShieldCheck,
  MapPin, Calendar, Award, TrendingUp
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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

  const { data: profile, isLoading } = useQuery({
    queryKey: ["customer-profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("community_customer_profiles")
        .select("*")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch user stats - simplified to avoid type issues
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
        completedOrders: 0,
        unreadMessages: 0,
      };
    },
  });

  // Calculate profile completion
  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    let score = 0;
    if (profile.display_name) score += 25;
    if (profile.avatar_url) score += 25;
    if (profile.bio) score += 25;
    score += 25; // Account created
    return score;
  }, [profile]);

  if (isLoading) {
    return (
      <Card className="rounded-xl overflow-hidden">
        <CardContent className="p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-14 w-14 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-3 w-24" />
            </div>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="rounded-xl overflow-hidden border-primary/20">
      <CardContent className="p-4 space-y-4">
        {/* Profile Header */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <Avatar className="h-14 w-14 border-2 border-primary/30">
              <AvatarImage src={profile?.avatar_url || undefined} />
              <AvatarFallback className="bg-primary/10">
                <User className="h-6 w-6 text-primary" />
              </AvatarFallback>
            </Avatar>
            {profile?.is_verified && (
              <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center">
                <ShieldCheck className="h-3 w-3 text-primary-foreground" />
              </div>
            )}
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-bold text-sm truncate">
                {profile?.display_name || "مستخدم جديد"}
              </h3>
              {profile?.is_verified && (
                <Badge className="bg-primary/20 text-primary border-0 text-[9px] h-4 px-1">موثق</Badge>
              )}
            </div>
            <div className="flex items-center gap-2 mt-0.5 text-[11px] text-muted-foreground">
              <span className="flex items-center gap-0.5">
                <Star className="h-3 w-3 text-amber-500 fill-amber-500" />
                {profile?.reputation_score || 0}
              </span>
              <span>•</span>
              <span>{stats?.totalRequests || 0} طلب</span>
            </div>
          </div>

          <Button
            size="icon"
            variant="ghost"
            className="h-8 w-8 shrink-0"
            onClick={onSettingsClick}
          >
            <Settings className="h-4 w-4" />
          </Button>
        </div>

        {/* Profile Completion */}
        {profileCompletion < 100 && (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between text-[11px]">
              <span className="text-muted-foreground">اكتمال الملف</span>
              <span className="font-medium text-primary">{profileCompletion}%</span>
            </div>
            <Progress value={profileCompletion} className="h-1.5" />
            <p className="text-[10px] text-muted-foreground">
              أكمل ملفك الشخصي للحصول على مزايا إضافية
            </p>
          </div>
        )}

        {/* Quick Stats */}
        <div className="grid grid-cols-3 gap-2">
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-center">
            <Package className="h-4 w-4 text-primary mx-auto mb-1" />
            <p className="text-sm font-bold">{stats?.activeRequests || 0}</p>
            <p className="text-[9px] text-muted-foreground">طلب نشط</p>
          </div>
          <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-center">
            <Award className="h-4 w-4 text-emerald-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{stats?.completedOrders || 0}</p>
            <p className="text-[9px] text-muted-foreground">طلب مكتمل</p>
          </div>
          <button
            onClick={() => navigate("/community/messages")}
            className="p-2.5 rounded-lg bg-muted/30 border border-border/50 text-center hover:border-primary/40 transition-all relative"
          >
            <MessageCircle className="h-4 w-4 text-blue-500 mx-auto mb-1" />
            <p className="text-sm font-bold">{stats?.unreadMessages || 0}</p>
            <p className="text-[9px] text-muted-foreground">رسالة</p>
            {(stats?.unreadMessages || 0) > 0 && (
              <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-destructive" />
            )}
          </button>
        </div>

        {/* Quick Actions */}
        <div className="flex gap-2">
          <Button
            size="sm"
            className="flex-1 h-9 text-xs gap-1.5"
            onClick={onNewRequest}
          >
            <Package className="h-3.5 w-3.5" />
            طلب جديد
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1 h-9 text-xs gap-1.5"
            onClick={onViewRequests}
          >
            <TrendingUp className="h-3.5 w-3.5" />
            طلباتي
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
