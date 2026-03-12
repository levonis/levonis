import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Gift, Ticket, Coins, Loader2, Plus, ShoppingCart } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';

interface CartUpsellOffer {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  price: number;
  currency: string;
  gift_tickets: number;
  points_reward: number | null;
  stock_quantity: number | null;
  status: string;
}

export default function CartUpsellOffers() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const { data: offers } = useQuery({
    queryKey: ['cart-upsell-offers'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('product_offers')
        .select('id, title_ar, description_ar, image_url, price, currency, gift_tickets, points_reward, stock_quantity, status')
        .eq('status', 'active')
        .eq('show_in_cart', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return (data || []).filter((o: CartUpsellOffer) => o.stock_quantity === null || o.stock_quantity > 0) as CartUpsellOffer[];
    },
  });

  const purchaseMutation = useMutation({
    mutationFn: async (offer: CartUpsellOffer) => {
      if (!user) throw new Error('not_authenticated');
      
      // Check wallet balance
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const balance = wallet?.balance || 0;
      if (balance < offer.price) {
        throw new Error('insufficient_balance');
      }

      // Deduct wallet
      const { error: deductError } = await supabase.rpc('deduct_wallet_balance', {
        p_user_id: user.id,
        p_amount: offer.price,
      });
      if (deductError) throw deductError;

      // Create purchase record
      const { error: purchaseError } = await supabase
        .from('product_offer_purchases')
        .insert({
          user_id: user.id,
          offer_id: offer.id,
          quantity: 1,
          unit_price: offer.price,
          total_price: offer.price,
          gift_tickets_awarded: offer.gift_tickets,
        });
      if (purchaseError) throw purchaseError;

      // Award tickets
      if (offer.gift_tickets > 0) {
        await supabase.rpc('add_user_tickets', {
          p_user_id: user.id,
          p_amount: offer.gift_tickets,
          p_source: 'cart_upsell_offer',
        });
      }

      // Award points
      if (offer.points_reward && offer.points_reward > 0) {
        await supabase.rpc('admin_adjust_points', {
          p_user_id: user.id,
          p_amount: offer.points_reward,
          p_reason: 'مكافأة شراء عرض إضافي',
        } as any);
      }

      // Decrement stock
      if (offer.stock_quantity !== null) {
        await (supabase as any)
          .from('product_offers')
          .update({ 
            stock_quantity: Math.max(0, offer.stock_quantity - 1),
            total_sold: (offer as any).total_sold ? (offer as any).total_sold + 1 : 1
          })
          .eq('id', offer.id);
      }

      return offer;
    },
    onSuccess: (offer) => {
      const rewards: string[] = [];
      if (offer.gift_tickets > 0) rewards.push(`${offer.gift_tickets} تذكرة`);
      if (offer.points_reward && offer.points_reward > 0) rewards.push(`${offer.points_reward} نقطة`);
      toast.success(`تم شراء "${offer.title_ar}" بنجاح! 🎉${rewards.length > 0 ? ` +${rewards.join(' و')}` : ''}`);
      queryClient.invalidateQueries({ queryKey: ['cart-upsell-offers'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['tickets-balance'] });
      queryClient.invalidateQueries({ queryKey: ['points-balance'] });
    },
    onError: (error: any) => {
      if (error.message === 'not_authenticated') {
        navigate('/auth');
        return;
      }
      if (error.message === 'insufficient_balance') {
        toast.error('رصيد المحفظة غير كافٍ لشراء هذا العرض');
        return;
      }
      toast.error('حدث خطأ أثناء الشراء');
    },
  });

  if (!offers || offers.length === 0) return null;

  return (
    <div className="mt-4 mb-2">
      <div className="flex items-center gap-2 mb-3">
        <Gift className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold text-foreground">عروض إضافية</h3>
        <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-primary/10 text-primary border-primary/20">
          جديد
        </Badge>
      </div>

      <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2">
        {offers.map((offer) => (
          <div
            key={offer.id}
            className="shrink-0 w-[200px] rounded-xl border border-border/40 bg-card overflow-hidden hover:border-primary/30 transition-all"
          >
            {/* Image */}
            {offer.image_url && (
              <div className="h-[100px] overflow-hidden bg-muted">
                <img src={offer.image_url} alt={offer.title_ar} className="w-full h-full object-cover" />
              </div>
            )}

            <div className="p-2.5 space-y-2">
              <h4 className="text-xs font-bold text-foreground line-clamp-2 leading-tight">{offer.title_ar}</h4>
              
              {offer.description_ar && (
                <p className="text-[10px] text-muted-foreground line-clamp-2">{offer.description_ar}</p>
              )}

              {/* Rewards badges */}
              <div className="flex flex-wrap gap-1">
                {offer.gift_tickets > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-purple-500/10 text-purple-600 border-purple-500/20 gap-0.5">
                    <Ticket className="h-2.5 w-2.5" />
                    {offer.gift_tickets} تذكرة
                  </Badge>
                )}
                {offer.points_reward && offer.points_reward > 0 && (
                  <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-amber-500/10 text-amber-600 border-amber-500/20 gap-0.5">
                    <Coins className="h-2.5 w-2.5" />
                    {offer.points_reward} نقطة
                  </Badge>
                )}
              </div>

              {/* Price + Buy */}
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-black text-primary">{formatPrice(offer.price)}</span>
                  <span className="text-[9px] text-muted-foreground mr-0.5">د.ع</span>
                </div>
                <Button
                  size="sm"
                  className="h-7 text-[10px] gap-1 px-2.5"
                  onClick={() => purchaseMutation.mutate(offer)}
                  disabled={purchaseMutation.isPending}
                >
                  {purchaseMutation.isPending ? (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  ) : (
                    <ShoppingCart className="h-3 w-3" />
                  )}
                  اشتري
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
