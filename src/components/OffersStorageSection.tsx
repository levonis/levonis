import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Package, ChevronLeft, Ticket, ArrowLeft } from "lucide-react";
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
        .select('id, title_ar, description_ar, image_url, price, currency, gift_tickets, stock_quantity')
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
    <section className="container mx-auto px-4 py-8 md:py-12">
      {/* Section Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <div className="w-1.5 h-8 bg-gradient-to-b from-primary via-accent to-primary/50 rounded-full" />
          <div>
            <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              عروض حصرية
            </h2>
            <p className="text-xs text-muted-foreground">منتجات مميزة مع تذاكر هدية</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Storage Quick Access */}
          {user && storageCount !== undefined && storageCount > 0 && (
            <Button 
              variant="outline" 
              size="sm" 
              className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"
              onClick={() => navigate('/offers')}
            >
              <Package className="h-4 w-4" />
              <span className="font-bold">{storageCount}</span>
            </Button>
          )}
          
          <Button 
            variant="ghost" 
            size="sm" 
            className="gap-1 text-primary hover:text-primary/80 hover:bg-primary/10"
            onClick={() => navigate('/offers')}
          >
            عرض الكل
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Products Horizontal Strip */}
      {offersLoading ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shrink-0 w-[140px] md:w-[160px]">
              <Skeleton className="aspect-square rounded-xl mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !hasOffers ? (
        <Card className="bg-card/50 border-dashed border-primary/20">
          <CardContent className="p-8 text-center">
            <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-primary/10 flex items-center justify-center">
              <Gift className="h-8 w-8 text-primary/60" />
            </div>
            <p className="text-muted-foreground font-medium">لا توجد عروض حالياً</p>
            <p className="text-xs text-muted-foreground/70 mt-1">ترقب العروض القادمة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          {offers.map((offer) => (
            <Card 
              key={offer.id}
              className="shrink-0 w-[140px] md:w-[160px] overflow-hidden group cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 border-border/50 hover:border-primary/30 bg-card"
              onClick={() => navigate('/offers')}
            >
              <div className="relative aspect-square bg-muted/30">
                <OptimizedImage
                  src={offer.image_url || '/placeholder.svg'}
                  alt={offer.title_ar}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                />
                
                {/* Gradient Overlay */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity" />
                
                {/* Gift Badge */}
                {offer.gift_tickets && offer.gift_tickets > 0 && (
                  <Badge className="absolute top-2 right-2 bg-primary text-primary-foreground gap-1 text-[10px] px-1.5 py-0.5 shadow-lg">
                    <Ticket className="h-3 w-3" />
                    +{offer.gift_tickets}
                  </Badge>
                )}
                
                {/* Low Stock */}
                {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                  <Badge className="absolute bottom-2 left-2 bg-destructive/90 text-destructive-foreground text-[9px] px-1.5 py-0.5">
                    متبقي {offer.stock_quantity}
                  </Badge>
                )}
              </div>
              
              <CardContent className="p-2.5">
                <h3 className="font-semibold text-xs line-clamp-2 mb-1.5 text-foreground/90">{offer.title_ar}</h3>
                <p className="font-bold text-primary text-sm">
                  {offer.price?.toLocaleString()} <span className="text-[10px] text-muted-foreground font-normal">{offer.currency || 'د.ع'}</span>
                </p>
              </CardContent>
            </Card>
          ))}
          
          {/* View All Card */}
          <Card 
            className="shrink-0 w-[100px] md:w-[120px] overflow-hidden cursor-pointer hover:shadow-xl hover:shadow-primary/10 transition-all duration-300 bg-gradient-to-br from-primary/5 to-accent/5 border-primary/20 hover:border-primary/40 flex items-center justify-center min-h-[180px]"
            onClick={() => navigate('/offers')}
          >
            <CardContent className="p-3 text-center">
              <div className="w-10 h-10 mx-auto mb-2 rounded-full bg-primary/10 flex items-center justify-center group-hover:bg-primary/20 transition-colors">
                <ArrowLeft className="h-5 w-5 text-primary" />
              </div>
              <p className="text-xs font-bold text-primary">عرض الكل</p>
            </CardContent>
          </Card>
        </div>
      )}
    </section>
  );
}