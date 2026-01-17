import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Trophy, Ticket, Package, ArrowLeft } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import TicketProductBadges from "./TicketProductBadges";
import OptimizedImage from "@/components/OptimizedImage";
import { 
  TicketBalanceSkeleton, 
  CompetitionsGridSkeleton, 
  OffersListSkeleton, 
  StorageListSkeleton 
} from "./SkeletonLoaders";

interface CompetitionsSectionProps {
  activeSubTab: SubTabId;
}

export default function CompetitionsSection({ activeSubTab }: CompetitionsSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Only fetch when competitions tab is active
  const { data: competitions, isLoading: loadingCompetitions } = useQuery({
    queryKey: ['active-competitions-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('id, title_ar, image_url, prize_description_ar, ticket_price, status')
        .eq('status', 'active')
        .neq('is_product_based', true)
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: activeSubTab === 'competitions',
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch when competitions tab is active
  const { data: userTickets, isLoading: loadingTickets } = useQuery({
    queryKey: ['user-tickets-count', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user && activeSubTab === 'competitions',
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch when get-tickets tab is active
  const { data: productOffers, isLoading: loadingOffers } = useQuery({
    queryKey: ['product-offers-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('id, title_ar, image_url, price, gift_tickets, currency')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: activeSubTab === 'get-tickets',
    staleTime: 5 * 60 * 1000,
  });

  // Only fetch when storage tab is active
  const { data: purchasedProducts, isLoading: loadingStorage } = useQuery({
    queryKey: ['my-storage-preview', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('product_offer_purchases')
        .select('id, created_at, quantity, purchase_status, product_offers(title_ar, image_url)')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(4);
      if (error) throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'storage',
    staleTime: 5 * 60 * 1000,
  });

  // Competitions sub-tab
  if (activeSubTab === 'competitions') {
    return (
      <div className="space-y-4">
        {/* Ticket Balance */}
        {loadingTickets ? (
          <TicketBalanceSkeleton />
        ) : (
          <Card className="bg-gradient-to-br from-purple-500/10 to-purple-500/5 border-purple-500/20">
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-full bg-purple-500/20 flex items-center justify-center">
                    <Ticket className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">رصيد التذاكر</p>
                    <p className="text-xl font-bold">{userTickets || 0}</p>
                  </div>
                </div>
                <Button size="sm" onClick={() => navigate('/competitions')}>
                  عرض الكل
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Active Competitions */}
        {loadingCompetitions ? (
          <CompetitionsGridSkeleton />
        ) : competitions && competitions.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {competitions.slice(0, 4).map((comp) => (
              <Card 
                key={comp.id} 
                className="cursor-pointer hover:shadow-md transition-shadow overflow-hidden"
                onClick={() => navigate('/competitions')}
              >
                <div className="aspect-video relative">
                  <OptimizedImage
                    src={comp.image_url || '/placeholder.svg'}
                    alt={comp.title_ar}
                    className="w-full h-full object-cover"
                  />
                  <Badge className="absolute top-2 right-2 text-[9px]">
                    {comp.ticket_price} تذكرة
                  </Badge>
                </div>
                <CardContent className="p-2">
                  <p className="text-xs font-medium line-clamp-1">{comp.title_ar}</p>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              لا توجد مسابقات نشطة حالياً
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Get Tickets sub-tab
  if (activeSubTab === 'get-tickets') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          اشترِ باقات التذاكر واحصل على تذاكر مجانية للمسابقات
        </p>

        {loadingOffers ? (
          <OffersListSkeleton />
        ) : productOffers && productOffers.length > 0 ? (
          <div className="space-y-3">
            {productOffers.map((offer) => (
              <Card 
                key={offer.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/product-offers')}
              >
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-16 h-16 rounded-lg overflow-hidden shrink-0">
                    <OptimizedImage
                      src={offer.image_url || '/placeholder.svg'}
                      alt={offer.title_ar}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">{offer.title_ar}</p>
                    <p className="text-sm text-primary font-bold">
                      {offer.price?.toLocaleString()} {offer.currency || 'د.ع'}
                    </p>
                    <TicketProductBadges ticketCount={offer.gift_tickets || 0} />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/product-offers')}
            >
              عرض جميع الباقات
              <ArrowLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              لا توجد باقات متاحة حالياً
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Storage sub-tab
  if (activeSubTab === 'storage') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          منتجاتك المخزنة في انتظار طلب الشحن
        </p>

        {!user ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">سجّل الدخول لعرض مخزنك</p>
              <Button onClick={() => navigate('/auth')}>تسجيل الدخول</Button>
            </CardContent>
          </Card>
        ) : loadingStorage ? (
          <StorageListSkeleton />
        ) : purchasedProducts && purchasedProducts.length > 0 ? (
          <div className="space-y-3">
            {purchasedProducts.map((purchase: any) => (
              <Card key={purchase.id}>
                <CardContent className="p-3 flex items-center gap-3">
                  <div className="w-12 h-12 rounded-lg overflow-hidden shrink-0 bg-muted">
                    <OptimizedImage
                      src={purchase.product_offers?.image_url || '/placeholder.svg'}
                      alt={purchase.product_offers?.title_ar || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm line-clamp-1">
                      {purchase.product_offers?.title_ar}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      الكمية: {purchase.quantity}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-[10px]">
                    {purchase.purchase_status === 'pending' ? 'في المخزن' : purchase.purchase_status}
                  </Badge>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/my-offer-purchases')}
            >
              عرض المخزن الكامل
              <ArrowLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">مخزنك فارغ</p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  return null;
}
