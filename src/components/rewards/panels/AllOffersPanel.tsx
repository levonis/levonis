import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import OptimizedImage from "@/components/OptimizedImage";
import TicketProductBadges from "../TicketProductBadges";
import { toast } from "sonner";

export default function AllOffersPanel() {
  const { user } = useAuth();

  const { data: offers, isLoading } = useQuery({
    queryKey: ['all-product-offers-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 w-full" />
        ))}
      </div>
    );
  }

  if (!offers || offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          لا توجد باقات متاحة حالياً
        </CardContent>
      </Card>
    );
  }

  const handleOfferClick = (offer: any) => {
    if (!user) {
      toast.error('سجّل الدخول للشراء');
      return;
    }
    toast.info(`سيتم فتح تفاصيل: ${offer.title_ar}`);
  };

  return (
    <div className="space-y-3">
      {offers.map((offer) => (
        <Card 
          key={offer.id} 
          className="cursor-pointer hover:shadow-md transition-shadow"
          onClick={() => handleOfferClick(offer)}
        >
          <CardContent className="p-3 flex items-center gap-3">
            <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0">
              <OptimizedImage
                src={offer.image_url || '/placeholder.svg'}
                alt={offer.title_ar}
                className="w-full h-full object-cover"
              />
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium line-clamp-1">{offer.title_ar}</p>
              {offer.description_ar && (
                <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                  {offer.description_ar}
                </p>
              )}
              <p className="text-sm text-primary font-bold mt-1">
                {offer.price?.toLocaleString()} {offer.currency || 'د.ع'}
              </p>
              <TicketProductBadges ticketCount={offer.gift_tickets || 0} />
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
