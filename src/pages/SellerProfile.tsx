import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, Calendar } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useUserPrintReputation } from "@/hooks/useUserPrintReputation";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import ReputationBar from "@/components/reputation/ReputationBar";
import { formatDate } from "@/lib/utils";

export default function SellerProfile() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: profile, isLoading } = useQuery({
    queryKey: ["seller-profile", id],
    enabled: !!id,
    queryFn: async () => {
      // Use profiles_public view to protect sensitive user data
      const { data, error } = await supabase
        .from("profiles_public")
        .select("id, full_name, username, avatar_url, created_at")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: rep } = useUserPrintReputation(id);

  const metrics = useMemo(() => {
    const completion = rep?.merchant_completion_percent ?? null;
    const quality = rep?.avg_quality_stars != null ? (Number(rep.avg_quality_stars) / 5) * 100 : null;
    const speed = rep?.avg_speed_stars != null ? (Number(rep.avg_speed_stars) / 5) * 100 : null;

    return [
      {
        key: "completion",
        label: "نسبة الإكمال",
        percent: completion == null ? null : Number(completion),
        hint: "نسبة الأعمال المكتملة من الأعمال المقبولة.",
        rightText:
          rep?.merchant_accepted_jobs != null
            ? `${rep.merchant_completed_jobs ?? 0} من ${rep.merchant_accepted_jobs ?? 0}`
            : undefined,
      },
      {
        key: "quality",
        label: "جودة الطباعة",
        percent: quality == null ? null : Number(quality),
        hint: "تحويل متوسط تقييم الجودة (من 5) إلى نسبة مئوية للعرض.",
      },
      {
        key: "speed",
        label: "سرعة التنفيذ",
        percent: speed == null ? null : Number(speed),
        hint: "تحويل متوسط تقييم السرعة (من 5) إلى نسبة مئوية للعرض.",
      },
    ];
  }, [rep]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
        <div className="container mx-auto px-4 py-8 max-w-4xl">
          <div className="h-10 w-32 bg-muted rounded animate-pulse" />
          <div className="mt-4 h-40 bg-muted rounded-2xl animate-pulse" />
        </div>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
        <div className="container mx-auto px-4 py-8 text-center">
          <h1 className="text-2xl font-bold text-foreground mb-4">المستخدم غير موجود</h1>
          <Button onClick={() => navigate(-1)} className="gap-2">
            <ArrowRight className="h-4 w-4" />
            رجوع
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 pt-6 pb-10 max-w-4xl">
        <Button variant="ghost" onClick={() => navigate(-1)} className="mb-6 gap-2">
          <ArrowRight className="h-4 w-4" />
          رجوع
        </Button>

        <Card className="glass-effect border-border/50 mb-6">
          <CardContent className="pt-6">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4">
              <Avatar className="h-24 w-24 ring-4 ring-primary/20">
                <AvatarImage src={profile.avatar_url || undefined} />
                <AvatarFallback className="text-2xl bg-primary/10 text-primary">
                  {profile.username?.[0] || profile.full_name?.[0] || "م"}
                </AvatarFallback>
              </Avatar>

              <div className="flex-1 text-center sm:text-right">
                <h1 className="text-2xl font-bold text-foreground">{profile.username || profile.full_name || "تاجر"}</h1>
                <div className="mt-2 flex items-center justify-center sm:justify-start gap-2 text-xs text-muted-foreground">
                  <Calendar className="w-3.5 h-3.5" />
                  <span>عضو منذ {profile.created_at ? formatDate(profile.created_at) : "-"}</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <ReputationBar
          title="تقييمات التاجر"
          overallStars={rep?.avg_stars ?? null}
          basisCount={rep?.ratings_count ?? null}
          basisLabel="تقييم"
          metrics={metrics}
        />
      </main>
    </div>
  );
}
