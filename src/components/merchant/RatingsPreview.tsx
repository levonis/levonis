import { useState, useEffect, useRef, useCallback } from "react";
import { useQuery, useInfiniteQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, Reply, Send, ArrowUp, SortDesc, Trash2, Shield, ChevronDown, ChevronUp } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

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
  image_urls: string[] | null;
  video_url: string | null;
  created_at: string;
  customer_id: string;
  customer_name: string | null;
  customer_avatar: string | null;
  reply?: RatingReply | null;
  is_hidden?: boolean;
  is_auto_rating?: boolean;
  purchase_count?: number;
}

interface RatingComment {
  id: string;
  rating_id: string;
  user_id: string;
  content: string;
  is_admin_reply: boolean;
  created_at: string;
  user_name?: string;
  user_avatar?: string;
}

interface RatingStats {
  total_ratings: number;
  average_rating: number;
}

const PAGE_SIZE = 10;

export default function RatingsPreview({ merchantId }: RatingsPreviewProps) {
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const [filterStars, setFilterStars] = useState<number | null>(null);
  const [sortBy, setSortBy] = useState<"newest" | "oldest" | "highest" | "lowest">("newest");
  const [showScrollTop, setShowScrollTop] = useState(false);
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

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

  // Check if admin
  const { data: isAdmin } = useQuery({
    queryKey: ["is-admin-ratings", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user!.id)
        .eq("role", "admin")
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

  // Star distribution
  const { data: starCounts = [] } = useQuery({
    queryKey: ["merchant-star-counts", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("rating")
        .eq("merchant_id", merchantId);
      if (error) throw error;
      return [5, 4, 3, 2, 1].map((star) => ({
        star,
        count: (data || []).filter((r) => r.rating === star).length,
      }));
    },
  });

  const fetchRatingsPage = async ({ pageParam = 0 }: { pageParam?: number }) => {
    let query = supabase
      .from("merchant_ratings")
      .select("id, rating, review_text, image_urls, video_url, created_at, customer_id, is_hidden, is_auto_rating, purchase_count")
      .eq("merchant_id", merchantId);

    if (filterStars) {
      query = query.eq("rating", filterStars);
    }

    // Sort
    if (sortBy === "newest") query = query.order("created_at", { ascending: false });
    else if (sortBy === "oldest") query = query.order("created_at", { ascending: true });
    else if (sortBy === "highest") query = query.order("rating", { ascending: false });
    else if (sortBy === "lowest") query = query.order("rating", { ascending: true });

    const { data: ratingsData, error } = await query
      .range(pageParam, pageParam + PAGE_SIZE - 1);
    if (error) throw error;
    if (!ratingsData || ratingsData.length === 0) return { ratings: [], nextOffset: null };

    const customerIds = Array.from(new Set(ratingsData.map((r) => r.customer_id)));
    const ratingIds = ratingsData.map((r) => r.id);

    const [profilesRes, repliesRes] = await Promise.all([
      supabase.from("profiles_public").select("id, full_name, avatar_url").in("id", customerIds),
      supabase.from("merchant_rating_replies").select("id, rating_id, reply_text, created_at").in("rating_id", ratingIds),
    ]);

    const profilesMap = new Map(profilesRes.data?.map((p) => [p.id, p]) || []);
    const repliesMap = new Map(repliesRes.data?.map((r) => [r.rating_id, r]) || []);

    const ratings = ratingsData.map((r) => {
      const profile = profilesMap.get(r.customer_id);
      const reply = repliesMap.get(r.id);
      return {
        ...r,
        customer_name: profile?.full_name || null,
        customer_avatar: profile?.avatar_url || null,
        reply: reply ? { id: reply.id, reply_text: reply.reply_text, created_at: reply.created_at } : null,
      } as Rating;
    });

    return {
      ratings,
      nextOffset: ratingsData.length === PAGE_SIZE ? pageParam + PAGE_SIZE : null,
    };
  };

  const {
    data: ratingsPages,
    isLoading: ratingsLoading,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = useInfiniteQuery({
    queryKey: ["merchant-ratings-infinite", merchantId, filterStars, sortBy],
    queryFn: fetchRatingsPage,
    getNextPageParam: (lastPage) => lastPage.nextOffset,
    initialPageParam: 0,
  });

  const allRatings = ratingsPages?.pages.flatMap((p) => p.ratings) || [];
  const visibleRatings = isAdmin ? allRatings : allRatings.filter(r => !r.is_hidden);

  // Fetch comments for visible ratings
  const visibleRatingIds = visibleRatings.map(r => r.id);
  const { data: allComments = [] } = useQuery({
    queryKey: ["rating-comments-preview", merchantId, visibleRatingIds],
    enabled: visibleRatingIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_rating_comments")
        .select("*")
        .in("rating_id", visibleRatingIds)
        .order("created_at", { ascending: true });
      if (error) throw error;
      if (!data || data.length === 0) return [];
      const userIds = Array.from(new Set(data.map(c => c.user_id)));
      const { data: profiles } = await supabase.from("profiles").select("id, full_name, avatar_url").in("id", userIds);
      const pm = new Map(profiles?.map(p => [p.id, p]) || []);
      return data.map(c => ({
        ...c,
        user_name: pm.get(c.user_id)?.full_name || "مستخدم",
        user_avatar: pm.get(c.user_id)?.avatar_url || null,
      })) as RatingComment[];
    },
  });

  // Infinite scroll observer
  useEffect(() => {
    const el = loadMoreRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  // Scroll-to-top detection
  useEffect(() => {
    const handleScroll = () => {
      setShowScrollTop(window.scrollY > 600);
    };
    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const replyMutation = useMutation({
    mutationFn: async ({ ratingId, text }: { ratingId: string; text: string }) => {
      const { error } = await supabase
        .from("merchant_rating_replies")
        .insert({ rating_id: ratingId, merchant_id: merchantId, reply_text: text });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-ratings-infinite", merchantId] });
      setReplyingTo(null);
      setReplyText("");
      toast({ title: "تم إرسال الرد بنجاح" });
    },
  });

  const hideRatingMutation = useMutation({
    mutationFn: async (ratingId: string) => {
      const { error } = await supabase.from("merchant_ratings").update({ is_hidden: true }).eq("id", ratingId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-ratings-infinite", merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-rating-stats"] });
      toast({ title: "تم إخفاء التقييم" });
    },
  });

  const addCommentMutation = useMutation({
    mutationFn: async ({ ratingId, text, asAdmin }: { ratingId: string; text: string; asAdmin: boolean }) => {
      if (!user?.id) return;
      const { error } = await supabase.from("merchant_rating_comments").insert({
        rating_id: ratingId,
        user_id: user.id,
        content: text.trim(),
        is_admin_reply: asAdmin,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rating-comments-preview"] });
      toast({ title: "تم إضافة الرد" });
    },
  });

  const deleteCommentMutation = useMutation({
    mutationFn: async (commentId: string) => {
      const { error } = await supabase.from("merchant_rating_comments").delete().eq("id", commentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["rating-comments-preview"] });
    },
  });

  if (statsLoading) {
    return <Skeleton className="h-32 rounded-xl" />;
  }

  if (!stats || stats.total_ratings === 0) {
    return (
      <div className="text-center py-8">
        <MessageSquare className="h-10 w-10 text-muted-foreground/20 mx-auto mb-2" />
        <p className="text-sm text-muted-foreground">لا توجد تقييمات بعد</p>
      </div>
    );
  }

  return (
    <div ref={scrollContainerRef} className="space-y-4">
      {/* Summary */}
      <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/30 border border-border">
        <div className="text-center px-3">
          <div className="text-3xl font-black text-primary">{stats.average_rating.toFixed(1)}</div>
          <div className="flex items-center gap-0.5 justify-center mt-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <Star
                key={star}
                className={`h-3.5 w-3.5 ${
                  star <= Math.round(stats.average_rating)
                    ? "fill-primary text-primary"
                    : "text-muted-foreground/20"
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">{stats.total_ratings} تقييم</p>
        </div>
        <div className="flex-1 space-y-1">
          {starCounts.map(({ star, count }) => (
            <div key={star} className="flex items-center gap-1.5">
              <span className="text-[10px] text-muted-foreground w-3">{star}</span>
              <Star className="h-2.5 w-2.5 fill-primary/40 text-primary/40" />
              <div className="flex-1 h-1.5 rounded-full bg-muted overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${stats.total_ratings > 0 ? (count / stats.total_ratings) * 100 : 0}%` }}
                />
              </div>
              <span className="text-[10px] text-muted-foreground w-5 text-left">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Filters & Sort */}
      <div className="flex flex-wrap items-center gap-1.5">
        <Button
          size="sm"
          variant={filterStars === null ? "default" : "outline"}
          onClick={() => setFilterStars(null)}
          className="h-7 text-[10px] px-2.5"
        >
          الكل
        </Button>
        {starCounts.map(({ star, count }) => (
          <Button
            key={star}
            size="sm"
            variant={filterStars === star ? "default" : "outline"}
            onClick={() => setFilterStars(star)}
            className="h-7 text-[10px] gap-0.5 px-2"
            disabled={count === 0}
          >
            {star}
            <Star className="h-2.5 w-2.5 fill-current" />
          </Button>
        ))}

        <div className="mr-auto" />

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
          className="h-7 text-[10px] rounded-md border border-border bg-background px-2 text-foreground"
        >
          <option value="newest">الأحدث</option>
          <option value="oldest">الأقدم</option>
          <option value="highest">الأعلى تقييماً</option>
          <option value="lowest">الأقل تقييماً</option>
        </select>
      </div>

      {/* Ratings List */}
      {ratingsLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
      ) : visibleRatings.length === 0 ? (
        <div className="py-6 text-center">
          <MessageSquare className="h-8 w-8 text-muted-foreground/20 mx-auto mb-2" />
          <p className="text-xs text-muted-foreground">
            {filterStars ? `لا توجد تقييمات بـ ${filterStars} نجوم` : "لا توجد تقييمات"}
          </p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {visibleRatings.map((rating) => {
            const ratingComments = allComments.filter(c => c.rating_id === rating.id);
            return (
              <RatingCard
                key={rating.id}
                rating={rating}
                comments={ratingComments}
                isOwner={!!isOwner}
                isAdmin={!!isAdmin}
                userId={user?.id}
                replyingTo={replyingTo}
                replyText={replyText}
                setReplyingTo={setReplyingTo}
                setReplyText={setReplyText}
                onMerchantReply={(ratingId, text) => replyMutation.mutate({ ratingId, text })}
                replyPending={replyMutation.isPending}
                onHide={(id) => hideRatingMutation.mutate(id)}
                onAddComment={(ratingId, text, asAdmin) => addCommentMutation.mutate({ ratingId, text, asAdmin })}
                addCommentPending={addCommentMutation.isPending}
                onDeleteComment={(id) => deleteCommentMutation.mutate(id)}
              />
            );
          })}

          {/* Load more trigger */}
          <div ref={loadMoreRef} className="py-2">
            {isFetchingNextPage && (
              <div className="flex justify-center">
                <div className="h-6 w-6 rounded-full border-2 border-primary border-t-transparent animate-spin" />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Scroll to top */}
      {showScrollTop && (
        <button
          onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
          className="fixed bottom-20 left-4 z-50 h-10 w-10 rounded-full bg-primary text-primary-foreground shadow-lg flex items-center justify-center hover:bg-primary/90 transition-all"
        >
          <ArrowUp className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}

// Sub-component for each rating card
function RatingCard({
  rating,
  comments,
  isOwner,
  isAdmin,
  userId,
  replyingTo,
  replyText,
  setReplyingTo,
  setReplyText,
  onMerchantReply,
  replyPending,
  onHide,
  onAddComment,
  addCommentPending,
  onDeleteComment,
}: {
  rating: Rating;
  comments: RatingComment[];
  isOwner: boolean;
  isAdmin: boolean;
  userId?: string;
  replyingTo: string | null;
  replyText: string;
  setReplyingTo: (id: string | null) => void;
  setReplyText: (text: string) => void;
  onMerchantReply: (ratingId: string, text: string) => void;
  replyPending: boolean;
  onHide: (id: string) => void;
  onAddComment: (ratingId: string, text: string, asAdmin: boolean) => void;
  addCommentPending: boolean;
  onDeleteComment: (id: string) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentText, setCommentText] = useState("");

  return (
    <div className={`p-3 rounded-xl bg-muted/30 border border-border ${rating.is_hidden ? "opacity-50" : ""}`}>
      <div className="flex items-start gap-2.5">
        <Avatar className="h-8 w-8">
          <AvatarImage src={rating.customer_avatar || undefined} />
          <AvatarFallback className="text-[10px] bg-primary/20 text-primary">
            {rating.customer_name?.charAt(0) || "؟"}
          </AvatarFallback>
        </Avatar>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-1">
            <span className="text-xs font-semibold truncate">
              {rating.customer_name || "عميل"}
            </span>
            <div className="flex items-center gap-1 shrink-0">
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <Star
                    key={star}
                    className={`h-3 w-3 ${
                      star <= rating.rating
                        ? "fill-primary text-primary"
                        : "text-muted-foreground/20"
                    }`}
                  />
                ))}
              </div>
              {isAdmin && (
                <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => onHide(rating.id)}>
                  <Trash2 className="h-3 w-3 text-destructive" />
                </Button>
              )}
            </div>
          </div>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            {new Date(rating.created_at).toLocaleDateString("ar-IQ")}
          </p>
          {rating.is_hidden && (
            <Badge variant="destructive" className="text-[10px] mt-1">مخفي</Badge>
          )}
          {rating.review_text && (
            <p className="text-xs text-foreground/80 mt-1.5 whitespace-pre-wrap leading-relaxed">
              {rating.review_text}
            </p>
          )}

          {/* Images */}
          {rating.image_urls && rating.image_urls.length > 0 && (
            <div className="flex gap-1.5 mt-2 flex-wrap">
              {rating.image_urls.map((url, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer">
                  <img src={url} alt="" className="w-14 h-14 rounded-md object-cover border border-border hover:opacity-80 transition" />
                </a>
              ))}
            </div>
          )}

          {/* Video */}
          {rating.video_url && (
            <div className="mt-2">
              <video src={rating.video_url} className="w-full max-h-32 rounded-md border border-border" controls />
            </div>
          )}

          {/* Merchant Reply */}
          {rating.reply && (
            <div className="mt-2 mr-2 p-2 rounded-lg bg-primary/5 border border-primary/10">
              <div className="flex items-center gap-1 mb-1">
                <Reply className="h-2.5 w-2.5 text-primary" />
                <span className="text-[10px] font-bold text-primary">رد التاجر</span>
                <span className="text-[9px] text-muted-foreground mr-auto">
                  {new Date(rating.reply.created_at).toLocaleDateString("ar-IQ")}
                </span>
              </div>
              <p className="text-[11px] text-foreground/70">{rating.reply.reply_text}</p>
            </div>
          )}

          {/* Reply action for merchant owner */}
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
                      disabled={!replyText.trim() || replyPending}
                      onClick={() => onMerchantReply(rating.id, replyText)}
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

          {/* Comments toggle */}
          <button
            onClick={() => setShowComments(!showComments)}
            className="flex items-center gap-1 text-[10px] text-muted-foreground mt-2 hover:text-foreground transition"
          >
            <MessageSquare className="h-3 w-3" />
            {comments.length > 0 ? `${comments.length} تعليق` : "تعليق"}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>

          {/* Comments */}
          {showComments && (
            <div className="mt-2 space-y-1.5 pr-3 border-r-2 border-muted">
              {comments.map((c) => (
                <div
                  key={c.id}
                  className={`p-1.5 rounded-lg text-[11px] ${
                    c.is_admin_reply
                      ? "bg-primary/10 border border-primary/20"
                      : "bg-muted/50"
                  }`}
                >
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1">
                      <Avatar className="h-4 w-4">
                        <AvatarImage src={c.user_avatar || undefined} />
                        <AvatarFallback className="text-[8px]">{c.user_name?.charAt(0) || "؟"}</AvatarFallback>
                      </Avatar>
                      <span className="font-semibold text-[10px]">{c.user_name}</span>
                      {c.is_admin_reply && (
                        <Badge variant="default" className="text-[8px] h-3.5 px-1 gap-0.5">
                          <Shield className="h-2 w-2" />
                          الإدارة
                        </Badge>
                      )}
                    </div>
                    {(isAdmin || c.user_id === userId) && (
                      <button onClick={() => onDeleteComment(c.id)} className="text-destructive hover:text-destructive/80">
                        <Trash2 className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <p className="mt-0.5 text-foreground/80">{c.content}</p>
                  <p className="text-[9px] text-muted-foreground mt-0.5">
                    {new Date(c.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
              ))}

              {/* Add comment */}
              {userId && (
                <div className="flex gap-1.5">
                  <Textarea
                    value={commentText}
                    onChange={(e) => setCommentText(e.target.value)}
                    placeholder={isAdmin ? "رد الإدارة..." : "اكتب تعليقاً..."}
                    className="min-h-[32px] text-[11px]"
                    rows={1}
                  />
                  <Button
                    size="icon"
                    className="h-8 w-8 shrink-0"
                    disabled={!commentText.trim() || addCommentPending}
                    onClick={() => {
                      onAddComment(rating.id, commentText, !!isAdmin);
                      setCommentText("");
                    }}
                  >
                    <Send className="h-3 w-3" />
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
