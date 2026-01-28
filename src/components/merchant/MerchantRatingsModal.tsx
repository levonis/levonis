import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Star, MessageSquare, Filter } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";

interface MerchantRatingsModalProps {
  merchantId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
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

export default function MerchantRatingsModal({ merchantId, open, onOpenChange }: MerchantRatingsModalProps) {
  const [filterStars, setFilterStars] = useState<number | null>(null);

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
      // Use profiles_public view to protect sensitive user data
      const { data: profiles } = await supabase
        .from("profiles_public")
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
            <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
            جميع التقييمات ({ratings.length})
          </DialogTitle>
        </DialogHeader>

        {/* Filter Buttons */}
        <div className="flex flex-wrap gap-2 pb-3 border-b border-border">
          <Button
            size="sm"
            variant={filterStars === null ? "default" : "outline"}
            onClick={() => setFilterStars(null)}
            className="h-8 text-xs"
          >
            الكل
          </Button>
          {starCounts.map(({ star, count }) => (
            <Button
              key={star}
              size="sm"
              variant={filterStars === star ? "default" : "outline"}
              onClick={() => setFilterStars(star)}
              className="h-8 text-xs gap-1"
              disabled={count === 0}
            >
              {star}
              <Star className="h-3 w-3 fill-current" />
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
                <div
                  key={rating.id}
                  className="p-3 rounded-xl bg-muted/30 border border-border"
                >
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
                                  ? "fill-yellow-500 text-yellow-500"
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
