import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare, ChevronLeft } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import MerchantRatingsModal from "./MerchantRatingsModal";

interface RatingsPreviewProps {
  merchantId: string;
}

interface Rating {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
}

interface RatingStats {
  total_ratings: number;
  average_rating: number;
}

export default function RatingsPreview({ merchantId }: RatingsPreviewProps) {
  const [modalOpen, setModalOpen] = useState(false);

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["merchant-rating-stats", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_stats")
        .select("total_ratings, average_rating")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return data as RatingStats | null;
    },
  });

  const { data: recentRatings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ["merchant-recent-ratings", merchantId],
    queryFn: async () => {
      const { data: ratingsData, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, review_text, created_at, customer_id")
        .eq("merchant_id", merchantId)
        .not("review_text", "is", null)
        .order("created_at", { ascending: false })
        .limit(3);
      if (error) throw error;

      if (!ratingsData || ratingsData.length === 0) return [];

      const customerIds = Array.from(new Set(ratingsData.map((r) => r.customer_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", customerIds);

      const profilesMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return ratingsData.map((r) => {
        const profile = profilesMap.get(r.customer_id);
        return {
          ...r,
          customer_name: profile?.full_name || null,
          customer_avatar: profile?.avatar_url || null,
        } as Rating;
      });
    },
  });

  if (statsLoading || ratingsLoading) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  if (!stats || stats.total_ratings === 0) {
    return (
      <Card className="border-border bg-card/50">
        <CardContent className="p-4 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">لا توجد تقييمات بعد</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <Card className="border-border bg-card/50 overflow-hidden">
        <CardContent className="p-4 space-y-3">
          {/* Summary Row */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(stats.average_rating)
                        ? "fill-yellow-500 text-yellow-500"
                        : "text-muted-foreground/30"
                    }`}
                  />
                ))}
              </div>
              <span className="text-lg font-bold text-primary">{stats.average_rating.toFixed(1)}</span>
              <span className="text-xs text-muted-foreground">({stats.total_ratings} تقييم)</span>
            </div>
          </div>

          {/* Recent Reviews */}
          {recentRatings.length > 0 && (
            <div className="space-y-2">
              {recentRatings.map((rating) => (
                <div
                  key={rating.id}
                  className="p-2.5 rounded-lg bg-muted/30 border border-border/50"
                >
                  <div className="flex items-start gap-2">
                    <Avatar className="h-7 w-7">
                      <AvatarImage src={rating.customer_avatar || undefined} />
                      <AvatarFallback className="text-[10px] bg-primary/10 text-primary">
                        {rating.customer_name?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-1">
                        <span className="text-xs font-medium truncate">
                          {rating.customer_name || "زبون"}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-2.5 w-2.5 ${
                                star <= rating.rating
                                  ? "fill-yellow-500 text-yellow-500"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      {rating.review_text && (
                        <p className="text-[11px] text-foreground/70 mt-1 line-clamp-2">
                          {rating.review_text}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* View All Button */}
          {stats.total_ratings > 3 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setModalOpen(true)}
              className="w-full h-8 text-xs gap-1"
            >
              عرض جميع التقييمات ({stats.total_ratings})
              <ChevronLeft className="h-3 w-3" />
            </Button>
          )}
        </CardContent>
      </Card>

      <MerchantRatingsModal
        merchantId={merchantId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
