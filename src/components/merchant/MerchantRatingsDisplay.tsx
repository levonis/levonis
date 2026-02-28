import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, Trash2, Shield, Send, ChevronDown, ChevronUp, Image as ImageIcon, PlayCircle } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Progress } from "@/components/ui/progress";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";

interface MerchantRatingsDisplayProps {
  merchantId: string;
  isAdmin?: boolean;
}

interface Rating {
  id: string;
  rating: number;
  review_text: string | null;
  image_urls: string[] | null;
  video_url: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
  is_hidden: boolean;
}

interface RatingComment {
  id: string;
  rating_id: string;
  user_id: string;
  content: string;
  is_admin_reply: boolean;
  parent_id: string | null;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface RatingStats {
  total_ratings: number;
  average_rating: number;
  five_stars: number;
  four_stars: number;
  three_stars: number;
  two_stars: number;
  one_star: number;
}

export default function MerchantRatingsDisplay({ merchantId, isAdmin = false }: MerchantRatingsDisplayProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ["merchant-rating-stats", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_stats")
        .select("*")
        .eq("merchant_id", merchantId)
        .maybeSingle();
      if (error) throw error;
      return data as RatingStats | null;
    },
  });

  const { data: ratings = [], isLoading: ratingsLoading } = useQuery({
    queryKey: ["merchant-ratings", merchantId],
    queryFn: async () => {
      const { data: ratingsData, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, review_text, image_urls, video_url, created_at, customer_id, is_hidden")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false })
        .limit(20);
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

  // Fetch comments for all ratings
  const ratingIds = ratings.map(r => r.id);
  const { data: comments = [] } = useQuery({
    queryKey: ["rating-comments", merchantId, ratingIds],
    enabled: ratingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_comments")
        .select("*")
        .in("rating_id", ratingIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      const userIds = Array.from(new Set(data.map(c => c.user_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds);
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return data.map(c => ({
        ...c,
        user_name: profilesMap.get(c.user_id)?.full_name || "مستخدم",
        user_avatar: profilesMap.get(c.user_id)?.avatar_url || null,
      })) as RatingComment[];
    },
  });

  // Delete rating (admin)
  const deleteMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      const { error } = await supabase.from("merchant_ratings").update({ is_hidden: true }).eq("id", ratingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-ratings"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-rating-stats"] });
      toast({ title: "تم إخفاء التقييم" });
    },
  });

  if (statsLoading || ratingsLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-32 rounded-xl" />
        <Skeleton className="h-40 rounded-xl" />
      </div>
    );
  }

  if (!stats || stats.total_ratings === 0) {
    return (
      <Card className="border-border bg-card">
        <CardContent className="p-6 text-center">
          <MessageSquare className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
          <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد.</p>
        </CardContent>
      </Card>
    );
  }

  const total = stats.total_ratings;
  const visibleRatings = isAdmin ? ratings : ratings.filter(r => !r.is_hidden);

  return (
    <div className="space-y-4">
      {/* Rating Summary */}
      <Card className="border-border bg-card">
        <CardHeader>
          <CardTitle className="text-base">التقييم العام</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-start gap-6">
            <div className="text-center">
              <div className="text-4xl font-bold text-primary">{stats.average_rating.toFixed(1)}</div>
              <div className="flex items-center justify-center gap-1 mt-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-4 w-4 ${
                      star <= Math.round(stats.average_rating) ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              <p className="text-xs text-muted-foreground mt-1">{total} تقييم</p>
            </div>

            <div className="flex-1 space-y-2">
              {[
                { stars: 5, count: stats.five_stars },
                { stars: 4, count: stats.four_stars },
                { stars: 3, count: stats.three_stars },
                { stars: 2, count: stats.two_stars },
                { stars: 1, count: stats.one_star },
              ].map(({ stars, count }) => (
                <div key={stars} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-12">{stars} نجوم</span>
                  <Progress value={(count / total) * 100} className="h-2" />
                  <span className="text-xs text-muted-foreground w-8">{count}</span>
                </div>
              ))}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Reviews List */}
      {visibleRatings.length > 0 && (
        <Card className="border-border bg-card">
          <CardHeader>
            <CardTitle className="text-base">المراجعات ({visibleRatings.length})</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {visibleRatings.map((rating) => (
              <RatingItem
                key={rating.id}
                rating={rating}
                comments={comments.filter(c => c.rating_id === rating.id)}
                isAdmin={isAdmin}
                userId={user?.id}
                onDelete={() => deleteMutation.mutate(rating.id)}
                merchantId={merchantId}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}

function RatingItem({
  rating,
  comments,
  isAdmin,
  userId,
  onDelete,
  merchantId,
}: {
  rating: Rating;
  comments: RatingComment[];
  isAdmin: boolean;
  userId?: string;
  onDelete: () => void;
  merchantId: string;
}) {
  const [showComments, setShowComments] = useState(false);
  const [replyText, setReplyText] = useState("");
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const addCommentMutation = useMutation({
    mutationFn: async () => {
      if (!userId || !replyText.trim()) return;
      const { error } = await supabase.from("merchant_rating_comments").insert({
        rating_id: rating.id,
        user_id: userId,
        content: replyText.trim(),
        is_admin_reply: isAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setReplyText("");
      queryClient.invalidateQueries({ queryKey: ["rating-comments"] });
      toast({ title: "تم إضافة الرد" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("merchant_rating_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rating-comments"] });
    },
  });

  return (
    <div className={`border-b border-border last:border-0 pb-4 last:pb-0 ${rating.is_hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-3">
        <Avatar className="h-8 w-8">
          <AvatarImage src={rating.customer_avatar || undefined} />
          <AvatarFallback className="text-xs">
            {rating.customer_name?.charAt(0) || "؟"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold">{rating.customer_name || "زبون"}</p>
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= rating.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                    }`}
                  />
                ))}
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={onDelete}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            {new Date(rating.created_at).toLocaleDateString("ar-IQ")}
          </p>

          {rating.is_hidden && (
            <Badge variant="destructive" className="mt-1 text-xs">مخفي</Badge>
          )}

          {rating.review_text && (
            <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{rating.review_text}</p>
          )}

          {/* Images */}
          {rating.image_urls && rating.image_urls.length > 0 && (
            <div className="flex gap-2 mt-2 flex-wrap">
              {rating.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img
                    src={url}
                    alt={`مراجعة ${i + 1}`}
                    className="w-16 h-16 rounded-md object-cover border border-border hover:opacity-80 transition"
                  />
                </a>
              ))}
            </div>
          )}

          {/* Video */}
          {rating.video_url && (
            <div className="mt-2">
              <video src={rating.video_url} className="w-full max-h-40 rounded-md border border-border" controls />
            </div>
          )}

          {/* Comments toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-xs text-muted-foreground mt-2 hover:text-foreground transition"
          >
            <MessageSquare className="h-3 w-3" />
            {comments.length > 0 ? `${comments.length} رد` : "رد"}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* Comments section */}
          {showComments && (
            <div className="mt-2 space-y-2 pr-4 border-r-2 border-muted">
              {comments.map((comment) => (
                <div
                  key={comment.id}
                  className={`p-2 rounded-lg text-sm ${
                    comment.is_admin_reply
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5">
                      <Avatar className="h-5 w-5">
                        <AvatarImage src={comment.user_avatar || undefined} />
                        <AvatarFallback className="text-[10px]">
                          {comment.user_name?.charAt(0) || "؟"}
                        </AvatarFallback>
                      </Avatar>
                      <span className="text-xs font-semibold">{comment.user_name}</span>
                      {comment.is_admin_reply && (
                        <Badge variant="default" className="text-[10px] h-4 px-1 gap-0.5">
                          <Shield className="h-2.5 w-2.5" />
                          الإدارة
                        </Badge>
                      )}
                    </div>
                    {(isAdmin || comment.user_id === userId) && (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-5 w-5"
                        onClick={() => deleteCommentMutation.mutate(comment.id)}
                      >
                        <Trash2 className="h-2.5 w-2.5 text-destructive" />
                      </Button>
                    )}
                  </div>
                  <p className="mt-1 text-foreground/80">{comment.content}</p>
                  <p className="text-[10px] text-muted-foreground mt-1">
                    {new Date(comment.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
              ))}

              {/* Reply input */}
              {userId && (
                <div className="flex gap-2 mt-1">
                  <Textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder={isAdmin ? "رد الإدارة..." : "اكتب تعليقاً..."}
                    className="min-h-[36px] text-sm"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    className="h-9 w-9 shrink-0"
                    disabled={!replyText.trim() || addCommentMutation.isPending}
                    onClick={() => addCommentMutation.mutate()}
                  >
                    <Send className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
