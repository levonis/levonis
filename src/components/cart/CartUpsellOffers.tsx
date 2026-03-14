import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Gift, Ticket, Coins, Loader2, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [currentIndex, setCurrentIndex] = useState(0);

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
      
      const { data: wallet } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      
      const balance = wallet?.balance || 0;
      if (balance < offer.price) {
        throw new Error('insufficient_balance');
      }

      const { error: deductError } = await supabase.rpc('deduct_wallet_balance', {
        p_user_id: user.id,
        p_amount: offer.price,
      });
      if (deductError) throw deductError;

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

      if (offer.gift_tickets > 0) {
        await supabase.rpc('add_user_tickets', {
          p_user_id: user.id,
          p_amount: offer.gift_tickets,
          p_source: 'cart_upsell_offer',
        });
      }

      if (offer.points_reward && offer.points_reward > 0) {
        await supabase.rpc('admin_adjust_points', {
          p_user_id: user.id,
          p_amount: offer.points_reward,
          p_reason: 'مكافأة شراء عرض إضافي',
        } as any);
      }

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

  const offer = offers[currentIndex % offers.length];
  const hasMultiple = offers.length > 1;

  return (
    <div className="mt-3 mb-1">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2.5 flex items-center gap-2.5" dir="rtl">
        {/* Icon */}
        <div className="shrink-0 w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="h-4 w-4 text-primary" />
        </div>

        {/* Offer image thumbnail */}
        {offer.image_url && (
          <img src={offer.image_url} alt="" className="shrink-0 w-10 h-10 rounded-md object-cover border border-border/30" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0">
          <p className="text-xs font-bold text-foreground truncate">{offer.title_ar}</p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="text-xs font-black text-primary">{formatPrice(offer.price)}</span>
            <span className="text-[9px] text-muted-foreground">د.ع</span>
            {offer.gift_tickets > 0 && (
              <span className="text-[9px] text-purple-600 flex items-center gap-0.5">
                <Ticket className="h-2.5 w-2.5" />+{offer.gift_tickets}
              </span>
            )}
            {offer.points_reward && offer.points_reward > 0 && (
              <span className="text-[9px] text-amber-600 flex items-center gap-0.5">
                <Coins className="h-2.5 w-2.5" />+{offer.points_reward}
              </span>
            )}
          </div>
        </div>

        {/* Nav arrows */}
        {hasMultiple && (
          <div className="shrink-0 flex flex-col gap-0.5">
            <button
              onClick={() => setCurrentIndex((i) => (i + 1) % offers.length)}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <ChevronRight className="h-3 w-3 text-muted-foreground" />
            </button>
            <button
              onClick={() => setCurrentIndex((i) => (i - 1 + offers.length) % offers.length)}
              className="p-0.5 rounded hover:bg-muted transition-colors"
            >
              <ChevronLeft className="h-3 w-3 text-muted-foreground" />
            </button>
          </div>
        )}

        {/* Buy button */}
        <Button
          size="sm"
          className="shrink-0 h-7 text-[10px] gap-1 px-2.5"
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

      {/* Dots indicator */}
      {hasMultiple && (
        <div className="flex justify-center gap-1 mt-1.5">
          {offers.map((_, i) => (
            <button
              key={i}
              onClick={() => setCurrentIndex(i)}
              className={`w-1.5 h-1.5 rounded-full transition-colors ${i === currentIndex % offers.length ? 'bg-primary' : 'bg-muted-foreground/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}