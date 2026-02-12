import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, ChevronLeft, Reply, Send, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import MerchantRatingsModal from "./MerchantRatingsModal";

interface RatingsPreviewProps {
  merchantId: string;
}

interface RatingReply {
  id: string;
  reply_text: string;
  created_at: string;
}

interface Rating {
  id: string;
  rating: number;
  review_text: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
  reply?: RatingReply | null;
}

interface RatingStats {
  total_ratings: number;
  average_rating: number;
}

export default function RatingsPreview({ merchantId }: RatingsPreviewProps) {
  const [modalOpen, setModalOpen] = useState(false);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Check if current user is the merchant owner
  const { data: isOwner } = useQuery({
    queryKey: ["is-store-owner-ratings", merchantId, user?.id],
    enabled: !!merchantId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("id", merchantId)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

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
      const ratingIds = ratingsData.map(r => r.id);

      const [profilesRes, repliesRes] = await Promise.all([
        supabase.from("profiles_public").select("id, full_name, avatar_url").in("id", customerIds),
        supabase.from("merchant_rating_replies").select("id, rating_id, reply_text, created_at").in("rating_id", ratingIds),
      ]);

      const profilesMap = new Map(profilesRes.data?.map((p) => [p.id, p]) || []);
      const repliesMap = new Map(repliesRes.data?.map((r) => [r.rating_id, r]) || []);

      return ratingsData.map((r) => {
        const profile = profilesMap.get(r.customer_id);
        const reply = repliesMap.get(r.id);
        return {
          ...r,
          customer_name: profile?.full_name || null,
          customer_avatar: profile?.avatar_url || null,
          reply: reply ? { id: reply.id, reply_text: reply.reply_text, created_at: reply.created_at } : null,
        } as Rating;
      });
    },
  });

  const replyMutation = useMutation({
    mutationFn: async ({ ratingId, text }: { ratingId: string; text: string }) => {
      const { error } = await supabase
        .from("merchant_rating_replies")
        .insert({ rating_id: ratingId, merchant_id: merchantId, reply_text: text });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-recent-ratings", merchantId] });
      setReplyingTo(null);
      setReplyText("");
      toast({ title: "تم إرسال الرد بنجاح" });
    },
  });

  if (statsLoading || ratingsLoading) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  if (!stats || stats.total_ratings === 0) {
    return (
      <div className="text-center py-4">
        <MessageSquare className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
        <p className="text-xs text-muted-foreground">لا توجد تقييمات بعد</p>
      </div>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {/* Summary Row */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-0.5">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= Math.round(stats.average_rating)
                      ? "fill-primary text-primary"
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
              <div key={rating.id} className="p-2.5 rounded-lg bg-muted/30 border border-border">
                <div className="flex items-start gap-2">
                  <Avatar className="h-7 w-7">
                    <AvatarImage src={rating.customer_avatar || undefined} />
                    <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
                      {rating.customer_name?.charAt(0) || "؟"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-1">
                      <span className="text-xs font-medium truncate">
                        {rating.customer_name || "عميل"}
                      </span>
                      <div className="flex items-center gap-0.5 shrink-0">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <Star
                            key={star}
                            className={`h-2.5 w-2.5 ${
                              star <= rating.rating
                                ? "fill-primary text-primary"
                                : "text-muted-foreground/20"
                            }`}
                          />
                        ))}
                      </div>
                    </div>
                    {rating.review_text && (
                      <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">
                        {rating.review_text}
                      </p>
                    )}

                    {/* Merchant Reply */}
                    {rating.reply && (
                      <div className="mt-2 mr-2 p-2 rounded-md bg-primary/5 border border-primary/10">
                        <div className="flex items-center gap-1 mb-1">
                          <Reply className="h-2.5 w-2.5 text-primary" />
                          <span className="text-[10px] font-bold text-primary">رد التاجر</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{rating.reply.reply_text}</p>
                      </div>
                    )}

                    {/* Reply action */}
                    {isOwner && !rating.reply && (
                      <>
                        {replyingTo === rating.id ? (
                          <div className="mt-2 space-y-1.5">
                            <Textarea
                              value={replyText}
                              onChange={(e) => setReplyText(e.target.value)}
                              placeholder="اكتب ردك..."
                              className="text-xs min-h-[60px] resize-none"
                            />
                            <div className="flex gap-1.5 justify-end">
                              <Button size="sm" variant="ghost" className="h-6 text-[10px]" onClick={() => { setReplyingTo(null); setReplyText(""); }}>
                                إلغاء
                              </Button>
                              <Button
                                size="sm"
                                className="h-6 text-[10px] gap-1"
                                disabled={!replyText.trim() || replyMutation.isPending}
                                onClick={() => replyMutation.mutate({ ratingId: rating.id, text: replyText })}
                              >
                                <Send className="h-2.5 w-2.5" />
                                إرسال
                              </Button>
                            </div>
                          </div>
                        ) : (
                          <button
                            onClick={() => setReplyingTo(rating.id)}
                            className="mt-1 text-[10px] text-primary hover:underline flex items-center gap-0.5"
                          >
                            <Reply className="h-2.5 w-2.5" />
                            رد
                          </button>
                        )}
                      </>
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
            className="w-full h-8 text-xs gap-1 text-muted-foreground hover:text-foreground"
          >
            عرض جميع التقييمات ({stats.total_ratings})
            <ChevronLeft className="h-3 w-3" />
          </Button>
        )}
      </div>

      <MerchantRatingsModal
        merchantId={merchantId}
        open={modalOpen}
        onOpenChange={setModalOpen}
      />
    </>
  );
}
