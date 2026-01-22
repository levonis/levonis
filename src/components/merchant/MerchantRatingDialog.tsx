 import { useState } from "react";
 import { useMutation, useQueryClient } from "@tanstack/react-query";
 import { Star } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
 import { Button } from "@/components/ui/button";
 import { Label } from "@/components/ui/label";
 import { Textarea } from "@/components/ui/textarea";
 import { useToast } from "@/hooks/use-toast";
 
 interface MerchantRatingDialogProps {
   open: boolean;
   onOpenChange: (open: boolean) => void;
   merchantId: string;
   requestId: string;
   existingRating?: {
     id: string;
     rating: number;
     review_text: string | null;
   } | null;
 }
 
 export default function MerchantRatingDialog({
   open,
   onOpenChange,
   merchantId,
   requestId,
   existingRating,
 }: MerchantRatingDialogProps) {
   const { user } = useAuth();
   const { toast } = useToast();
   const queryClient = useQueryClient();
 
   const [rating, setRating] = useState(existingRating?.rating || 0);
   const [hoveredRating, setHoveredRating] = useState(0);
   const [reviewText, setReviewText] = useState(existingRating?.review_text || "");
 
   const saveMutation = useMutation({
     mutationFn: async () => {
       if (!user?.id || rating === 0) throw new Error("Invalid data");
 
       if (existingRating) {
         // Update existing rating
         const { error } = await supabase
           .from("merchant_ratings")
           .update({
             rating,
             review_text: reviewText.trim() || null,
           })
           .eq("id", existingRating.id);
         if (error) throw error;
       } else {
         // Insert new rating
         const { error } = await supabase.from("merchant_ratings").insert({
           merchant_id: merchantId,
           customer_id: user.id,
           request_id: requestId,
           rating,
           review_text: reviewText.trim() || null,
         });
         if (error) throw error;
       }
     },
     onSuccess: () => {
       queryClient.invalidateQueries({ queryKey: ["merchant-ratings"] });
       queryClient.invalidateQueries({ queryKey: ["merchant-rating-stats"] });
       toast({ title: "تم التقييم", description: "شكراً لتقييمك!" });
       onOpenChange(false);
     },
     onError: (err) => {
       console.error(err);
       toast({ title: "خطأ", description: "فشل حفظ التقييم.", variant: "destructive" });
     },
   });
 
   const displayRating = hoveredRating || rating;
 
   return (
     <Dialog open={open} onOpenChange={onOpenChange}>
       <DialogContent className="sm:max-w-md">
         <DialogHeader>
           <DialogTitle>{existingRating ? "تعديل التقييم" : "تقييم التاجر"}</DialogTitle>
         </DialogHeader>
 
         <div className="space-y-4">
           <div>
             <Label>التقييم بالنجوم *</Label>
             <div className="flex items-center gap-1 mt-2">
               {[1, 2, 3, 4, 5].map((star) => (
                 <button
                   key={star}
                   type="button"
                   className="focus:outline-none transition-transform hover:scale-110"
                   onMouseEnter={() => setHoveredRating(star)}
                   onMouseLeave={() => setHoveredRating(0)}
                   onClick={() => setRating(star)}
                 >
                   <Star
                     className={`h-8 w-8 ${
                       star <= displayRating ? "fill-yellow-500 text-yellow-500" : "text-muted-foreground"
                     }`}
                   />
                 </button>
               ))}
               {rating > 0 && (
                 <span className="text-sm text-muted-foreground mr-2">
                   ({rating} {rating === 1 ? "نجمة" : "نجوم"})
                 </span>
               )}
             </div>
           </div>
 
           <div>
             <Label htmlFor="review">التعليق (اختياري)</Label>
             <Textarea
               id="review"
               rows={4}
               value={reviewText}
               onChange={(e) => setReviewText(e.target.value)}
               placeholder="شاركنا تجربتك مع هذا التاجر..."
               className="mt-1"
             />
           </div>
         </div>
 
         <DialogFooter className="gap-2">
           <Button variant="outline" onClick={() => onOpenChange(false)}>
             إلغاء
           </Button>
           <Button onClick={() => saveMutation.mutate()} disabled={rating === 0 || saveMutation.isPending}>
             {saveMutation.isPending ? "جارٍ الحفظ..." : existingRating ? "تحديث" : "حفظ التقييم"}
           </Button>
         </DialogFooter>
       </DialogContent>
     </Dialog>
   );
 }