 import { useState, useMemo } from "react";
 import { useQuery } from "@tanstack/react-query";
 import { Star } from "lucide-react";
 import { supabase } from "@/integrations/supabase/client";
 import { useAuth } from "@/hooks/useAuth";
 import { Button } from "@/components/ui/button";
 import MerchantRatingDialog from "./MerchantRatingDialog";
 
 interface RateRequestButtonProps {
   requestId: string;
   requestStatus: string;
 }
 
 export default function RateRequestButton({ requestId, requestStatus }: RateRequestButtonProps) {
   const { user } = useAuth();
   const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
 
   // Only show for delivered requests
   if (requestStatus !== "delivered") return null;
 
   // Fetch merchant_id via accepted offer
   const { data: merchantData } = useQuery({
     queryKey: ["request-merchant", requestId],
     queryFn: async () => {
       // Get accepted offer
       const { data: reqData, error: reqError } = await supabase
         .from("print_requests")
         .select("accepted_offer_id")
         .eq("id", requestId)
         .maybeSingle();
       if (reqError || !reqData?.accepted_offer_id) return null;
 
       // Get trader from offer
       const { data: offerData, error: offerError } = await supabase
         .from("print_offers")
         .select("trader_id")
         .eq("id", reqData.accepted_offer_id)
         .maybeSingle();
       if (offerError || !offerData) return null;
 
       // Get merchant_id from trader
       const { data: merchantApp, error: merchantError } = await supabase
         .from("merchant_applications")
         .select("id")
         .eq("user_id", offerData.trader_id)
         .maybeSingle();
       if (merchantError || !merchantApp) return null;
 
       return merchantApp.id;
     },
   });
 
   // Fetch existing rating
   const { data: existingRating } = useQuery({
     queryKey: ["customer-rating", requestId, user?.id],
     enabled: !!user?.id,
     queryFn: async () => {
        const { data, error } = await supabase
          .from("merchant_ratings")
          .select("id, rating, review_text, merchant_id, image_urls, video_url")
          .eq("customer_id", user!.id)
          .eq("request_id", requestId)
         .maybeSingle();
       if (error) throw error;
       return data;
     },
   });
 
   const merchantId = useMemo(() => {
     return existingRating?.merchant_id || merchantData || null;
   }, [existingRating, merchantData]);
 
   if (!merchantId) return null;
 
   return (
     <>
       <Button
         size="sm"
         variant={existingRating ? "outline" : "default"}
         onClick={() => setRatingDialogOpen(true)}
       >
         <Star className="h-3.5 w-3.5 ml-1" />
         {existingRating ? "تعديل التقييم" : "تقييم التاجر"}
       </Button>
 
       <MerchantRatingDialog
         open={ratingDialogOpen}
         onOpenChange={setRatingDialogOpen}
         merchantId={merchantId}
         requestId={requestId}
         existingRating={existingRating || null}
       />
     </>
   );
 }