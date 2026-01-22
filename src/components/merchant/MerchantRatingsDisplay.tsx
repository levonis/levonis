 import { useQuery } from "@tanstack/react-query";
 import { Star, MessageSquare } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
 import { Skeleton } from "@/components/ui/skeleton";
 import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
 import { Progress } from "@/components/ui/progress";
 
 interface MerchantRatingsDisplayProps {
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
   five_stars: number;
   four_stars: number;
   three_stars: number;
   two_stars: number;
   one_star: number;
 }
 
 export default function MerchantRatingsDisplay({ merchantId }: MerchantRatingsDisplayProps) {
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
         .select("id, rating, review_text, created_at, customer_id")
         .eq("merchant_id", merchantId)
         .order("created_at", { ascending: false })
         .limit(20);
       if (error) throw error;
 
       if (!ratingsData || ratingsData.length === 0) return [];
 
       // Fetch customer profiles
       const customerIds = Array.from(new Set(ratingsData.map((r) => r.customer_id)));
       const { data: profiles, error: profilesError } = await supabase
         .from("profiles")
         .select("id, full_name, avatar_url")
         .in("id", customerIds);
       if (profilesError) throw profilesError;
 
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
       {ratings.filter((r) => r.review_text).length > 0 && (
         <Card className="border-border bg-card">
           <CardHeader>
             <CardTitle className="text-base">التعليقات</CardTitle>
           </CardHeader>
           <CardContent className="space-y-4">
             {ratings
               .filter((r) => r.review_text)
               .map((rating) => (
                 <div key={rating.id} className="border-b border-border last:border-0 pb-4 last:pb-0">
                   <div className="flex items-start gap-3">
                     <Avatar className="h-8 w-8">
                       <AvatarImage src={rating.customer_avatar || undefined} />
                       <AvatarFallback className="text-xs">
                         {rating.customer_name?.charAt(0) || "؟"}
                       </AvatarFallback>
                     </Avatar>
                     <div className="flex-1">
                       <div className="flex items-center justify-between gap-2">
                         <p className="text-sm font-semibold">{rating.customer_name || "زبون"}</p>
                         <div className="flex items-center gap-1">
                           {[1, 2, 3, 4, 5].map((star) => (
                             <Star
                               key={star}
                               className={`h-3 w-3 ${
                                 star <= rating.rating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                               }`}
                             />
                           ))}
                         </div>
                       </div>
                       <p className="text-xs text-muted-foreground mt-0.5">
                         {new Date(rating.created_at).toLocaleDateString("ar-IQ")}
                       </p>
                       <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap">{rating.review_text}</p>
                     </div>
                   </div>
                 </div>
               ))}
           </CardContent>
         </Card>
       )}
     </div>
   );
 }