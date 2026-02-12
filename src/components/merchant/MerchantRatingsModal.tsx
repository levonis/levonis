import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Star, MessageSquare, Reply, Send } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

interface MerchantRatingsModalProps {
  merchantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function MerchantRatingsModal({ merchantId, open, onOpenChange }: MerchantRatingsModalProps) {
  const [filterStars, setFilterStars] = useState<number | null>(null);
  const [replyingTo, setReplyingTo] = useState<string | null>(null);
  const [replyText, setReplyText] = useState("");
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: isOwner } = useQuery({
    queryKey: ["is-store-owner-modal", merchantId, user?.id],
    enabled: !!merchantId && !!user?.id && open,
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

  const { data: ratings = [], isLoading } = useQuery({
    queryKey: ["merchant-all-ratings", merchantId],
    enabled: open,
    queryFn: async () => {
      const { data: ratingsData, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, review_text, created_at, customer_id")
        .eq("merchant_id", merchantId)
        .order("created_at", { ascending: false });
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
      queryClient.invalidateQueries({ queryKey: ["merchant-all-ratings", merchantId] });
      queryClient.invalidateQueries({ queryKey: ["merchant-recent-ratings", merchantId] });
      setReplyingTo(null);
      setReplyText("");
      toast({ title: "تم إرسال الرد بنجاح" });
    },
  });

  const filteredRatings = filterStars
    ? ratings.filter((r) => r.rating === filterStars)
    : ratings;

  const starCounts = [5, 4, 3, 2, 1].map((star) => ({
    star,
    count: ratings.filter((r) => r.rating === star).length,
  }));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary fill-primary" />
            جميع التقييمات ({ratings.length})
          </DialogTitle>
        </DialogHeader>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-1.5 pb-3 border-b border-border">
          <Button
            size="sm"
            variant={filterStars === null ? "default" : "outline"}
            onClick={() => setFilterStars(null)}
            className="h-7 text-[10px] px-2"
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
              <span className="text-muted-foreground">({count})</span>
            </Button>
          ))}
        </div>

        {isLoading ? (
          <div className="space-y-4 py-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-20 rounded-xl" />
            ))}
          </div>
        ) : filteredRatings.length === 0 ? (
          <div className="py-8 text-center">
            <MessageSquare className="h-10 w-10 text-muted-foreground mx-auto mb-2" />
            <p className="text-sm text-muted-foreground">
              {filterStars ? `لا توجد تقييمات بـ ${filterStars} نجوم` : "لا توجد تقييمات"}
            </p>
          </div>
        ) : (
          <ScrollArea className="max-h-[50vh]">
            <div className="space-y-3 pr-2">
              {filteredRatings.map((rating) => (
                <div key={rating.id} className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-start gap-3">
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={rating.customer_avatar || undefined} />
                      <AvatarFallback className="text-xs bg-primary/10 text-primary">
                        {rating.customer_name?.charAt(0) || "؟"}
                      </AvatarFallback>
                    </Avatar>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-semibold truncate">
                          {rating.customer_name || "زبون"}
                        </span>
                        <div className="flex items-center gap-0.5 shrink-0">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-3 w-3 ${
                                star <= rating.rating
                                  ? "fill-primary text-primary"
                                  : "text-muted-foreground/30"
                              }`}
                            />
                          ))}
                        </div>
                      </div>
                      <p className="text-[10px] text-muted-foreground mt-0.5">
                        {new Date(rating.created_at).toLocaleDateString("ar-IQ")}
                      </p>
                      {rating.review_text && (
                        <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">
                          {rating.review_text}
                        </p>
                      )}

                      {/* Merchant Reply */}
                      {rating.reply && (
                        <div className="mt-2.5 mr-2 p-2.5 rounded-lg bg-primary/5 border border-primary/10">
                          <div className="flex items-center gap-1 mb-1">
                            <Reply className="h-3 w-3 text-primary" />
                            <span className="text-[11px] font-bold text-primary">رد التاجر</span>
                            <span className="text-[9px] text-muted-foreground mr-auto">
                              {new Date(rating.reply.created_at).toLocaleDateString("ar-IQ")}
                            </span>
                          </div>
                          <p className="text-xs text-foreground/70">{rating.reply.reply_text}</p>
                        </div>
                      )}

                      {/* Reply action for owner */}
                      {isOwner && !rating.reply && (
                        <>
                          {replyingTo === rating.id ? (
                            <div className="mt-2 space-y-1.5">
                              <Textarea
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder="اكتب ردك على هذا التقييم..."
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
                              className="mt-1.5 text-[10px] text-primary hover:underline flex items-center gap-0.5"
                            >
                              <Reply className="h-3 w-3" />
                              رد على هذا التقييم
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}
      </DialogContent>
    </Dialog>
  );
}
