import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Gift, Package, ChevronLeft, Ticket, Sparkles, ShoppingBag } from "lucide-react";
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
          <div className="w-1 h-6 bg-gradient-to-b from-rose-500 to-pink-600 rounded-full" />
          <div>
            <h2 className="text-lg md:text-xl font-black text-foreground flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-rose-500" />
              عروض حصرية مع هدايا
            </h2>
            <p className="text-xs text-muted-foreground">منتجات مع تذاكر مجانية للمسابقات</p>
          </div>
        </div>
        
        <Button 
          variant="ghost" 
          size="sm" 
          className="gap-1 text-primary hover:text-primary/80"
          onClick={() => navigate('/offers-storage')}
        >
          عرض الكل
          <ChevronLeft className="h-4 w-4" />
        </Button>
      </div>

      {/* Quick Stats Bar */}
      {user && (
        <div className="flex gap-3 mb-5 overflow-x-auto scrollbar-hide pb-1">
          <Card 
            className="shrink-0 cursor-pointer hover:shadow-md transition-all bg-blue-500/10 border-blue-500/30"
            onClick={() => navigate('/offers-storage')}
          >
            <CardContent className="p-3 flex items-center gap-2">
              <div className="p-2 rounded-lg bg-blue-500/20">
                <Package className="h-4 w-4 text-blue-500" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">مخزني</p>
                <p className="font-bold text-sm">{storageCount || 0} عنصر</p>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Products Horizontal Strip */}
      {offersLoading ? (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2">
          {[1, 2, 3, 4].map(i => (
            <div key={i} className="shrink-0 w-[160px] md:w-[180px]">
              <Skeleton className="aspect-square rounded-xl mb-2" />
              <Skeleton className="h-4 w-full mb-1" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          ))}
        </div>
      ) : !hasOffers ? (
        <Card className="bg-muted/30">
          <CardContent className="p-8 text-center">
            <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">لا توجد عروض حالياً</p>
          </CardContent>
        </Card>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-hide pb-2 -mx-4 px-4">
          {offers.map((offer) => (
            <Card 
              key={offer.id}
              className="shrink-0 w-[160px] md:w-[180px] overflow-hidden group cursor-pointer hover:shadow-lg transition-all border-primary/10"
              onClick={() => navigate('/offers-storage')}
            >
              <div className="relative aspect-square">
                <OptimizedImage
                  src={offer.image_url || '/placeholder.svg'}
                  alt={offer.title_ar}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                />
                
                {/* Gift Badge */}
                {offer.gift_tickets && offer.gift_tickets > 0 && (
                  <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1 text-[10px] px-1.5 py-0.5">
                    <Ticket className="h-3 w-3" />
                    +{offer.gift_tickets}
                  </Badge>
                )}
                
                {/* Low Stock */}
                {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                  <Badge className="absolute bottom-2 left-2 bg-orange-500 text-white text-[9px] px-1.5 py-0.5">
                    متبقي {offer.stock_quantity}
                  </Badge>
                )}
              </div>
              
              <CardContent className="p-3">
                <h3 className="font-semibold text-xs line-clamp-2 mb-1">{offer.title_ar}</h3>
                <p className="font-bold text-primary text-sm">
                  {offer.price?.toLocaleString()} <span className="text-[10px] text-muted-foreground">{offer.currency || 'د.ع'}</span>
                </p>
              </CardContent>
            </Card>
          ))}
          
          {/* View All Card */}
          <Card 
            className="shrink-0 w-[120px] md:w-[140px] overflow-hidden cursor-pointer hover:shadow-lg transition-all bg-gradient-to-br from-rose-500/10 to-pink-500/10 border-rose-500/20 flex items-center justify-center"
            onClick={() => navigate('/offers-storage')}
          >
            <CardContent className="p-4 text-center">
              <div className="w-12 h-12 mx-auto mb-2 rounded-full bg-gradient-to-br from-rose-500 to-pink-600 flex items-center justify-center">
                <ChevronLeft className="h-6 w-6 text-white" />
              </div>
              <p className="text-sm font-bold text-rose-600">عرض الكل</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Ticket Earning Info - Compact */}
      <div className="mt-6 p-4 rounded-xl bg-gradient-to-br from-purple-500/5 to-purple-500/10 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Gift className="h-4 w-4 text-purple-500" />
          <h4 className="font-bold text-xs">طرق الحصول على التذاكر</h4>
        </div>
        <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground">
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/10 border border-amber-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-500" />
            تحويل النقاط
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-blue-500/10 border border-blue-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
            مزايا البطاقة
          </span>
          <span className="flex items-center gap-1 px-2 py-1 rounded-full bg-rose-500/10 border border-rose-500/20">
            <span className="w-1.5 h-1.5 rounded-full bg-rose-500" />
            مضمنة مع المنتجات
          </span>
        </div>
      </div>
    </section>
  );
}
