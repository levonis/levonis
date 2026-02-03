import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Package, ChevronLeft, Ticket, Sparkles } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

export default function OffersStorageSection() {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch latest offers (max 6)
  const { data: offers, isLoading: offersLoading } = useQuery({
    queryKey: ['home-product-offers-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('id, title_ar, image_url, price, currency, gift_tickets, stock_quantity')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user's storage count
  const { data: storageCount } = useQuery({
    queryKey: ['user-storage-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      
      const [offerRes, prizeRes] = await Promise.all([
        supabase
          .from('product_offer_purchases')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .in('purchase_status', ['pending', 'purchased', 'shipping_requested', 'shipped']),
        supabase
          .from('competition_prizes')
          .select('id', { count: 'exact', head: true })
          .eq('user_id', user.id)
          .eq('prize_type', 'physical')
          .in('status', ['pending', 'shipping_requested', 'shipped'])
      ]);
      
      return (offerRes.count || 0) + (prizeRes.count || 0);
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const hasOffers = offers && offers.length > 0;

  return (
    <section className="container mx-auto px-4 py-6">
      {/* Compact Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-primary to-accent flex items-center justify-center shadow-md shadow-primary/20">
            <Sparkles className="h-4 w-4 text-primary-foreground" />
          </div>
          <div>
            <h2 className="text-sm md:text-base font-bold text-foreground">عروض حصرية</h2>
          </div>
        </div>
        
        <div className="flex items-center gap-1.5">
          {user && storageCount !== undefined && storageCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="h-8 gap-1 text-xs border-primary/30 text-primary hover:bg-primary/10 rounded-lg px-2"
              onClick={() => navigate('/offers')}
            >
              <Package className="h-3.5 w-3.5" />
              <span className="font-bold">{storageCount}</span>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="h-8 gap-0.5 text-xs text-primary hover:text-primary/80 hover:bg-primary/10 px-2"
            onClick={() => navigate('/offers')}
          >
            الكل
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {/* Compact Product Strip */}
      {offersLoading ? (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="shrink-0 w-[100px]">
              <Skeleton className="aspect-square rounded-xl mb-1.5" />
              <Skeleton className="h-3 w-full mb-1" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !hasOffers ? (
        <Card className="bg-muted/30 border-dashed border-muted-foreground/20">
          <CardContent className="p-6 text-center">
            <Gift className="h-8 w-8 mx-auto text-muted-foreground/50 mb-2" />
            <p className="text-xs text-muted-foreground">لا توجد عروض حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1 -mx-4 px-4">
          {offers.map((offer) => (
            <Card 
              key={offer.id}
              className="shrink-0 w-[100px] overflow-hidden group cursor-pointer hover:shadow-lg hover:shadow-primary/5 transition-all duration-300 border-border/50 hover:border-primary/20 bg-card"
              onClick={() => navigate('/offers')}
            >
              <div className="relative aspect-square bg-muted/20">
                <OptimizedImage
                  src={offer.image_url || '/placeholder.svg'}
                  alt={offer.title_ar}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Gift Badge */}
                {offer.gift_tickets && offer.gift_tickets > 0 && (
                  <Badge className="absolute top-1 right-1 bg-primary/90 text-primary-foreground gap-0.5 text-[8px] px-1 py-0 h-4">
                    <Ticket className="h-2.5 w-2.5" />
                    +{offer.gift_tickets}
                  </Badge>
                )}
                
                {/* Low Stock */}
                {offer.stock_quantity !== null && offer.stock_quantity <= 3 && offer.stock_quantity > 0 && (
                  <div className="absolute bottom-1 left-1 right-1">
                    <div className="bg-destructive/90 text-destructive-foreground text-[7px] px-1 py-0.5 rounded text-center font-medium">
                      متبقي {offer.stock_quantity}
                    </div>
                  </div>
                )}
              </div>
              
              <CardContent className="p-1.5">
                <h3 className="font-medium text-[10px] line-clamp-1 mb-0.5 text-foreground/90">{offer.title_ar}</h3>
                <p className="font-bold text-primary text-[11px]">
                  {offer.price?.toLocaleString()}
                  <span className="text-[8px] text-muted-foreground font-normal mr-0.5">{offer.currency || 'د.ع'}</span>
                </p>
              </CardContent>
            </Card>
          ))}
          
          {/* View All Mini Card */}
          <Card 
            className="shrink-0 w-[70px] overflow-hidden cursor-pointer hover:shadow-lg transition-all duration-300 bg-gradient-to-br from-primary/5 to-accent/10 border-primary/10 hover:border-primary/30 flex items-center justify-center"
            onClick={() => navigate('/offers')}
          >
            <CardContent className="p-2 text-center">
              <div className="w-8 h-8 mx-auto mb-1 rounded-full bg-primary/10 flex items-center justify-center">
                <ChevronLeft className="h-4 w-4 text-primary" />
              </div>
              <p className="text-[9px] font-semibold text-primary">المزيد</p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}
