import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Gift, Ticket, Coins, ShoppingCart, ChevronLeft, ChevronRight } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
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
  const navigate = useNavigate();
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

  if (!offers || offers.length === 0) return null;

  const offer = offers[currentIndex % offers.length];
  const hasMultiple = offers.length > 1;

  return (
    <div className="mt-3 mb-1 w-full overflow-hidden">
      <div className="rounded-lg border border-primary/20 bg-primary/5 p-2 flex items-center gap-2 w-full" dir="rtl">
        {/* Icon */}
        <div className="shrink-0 w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center">
          <Gift className="h-3.5 w-3.5 text-primary" />
        </div>

        {/* Offer image thumbnail */}
        {offer.image_url && (
          <img src={offer.image_url} alt="" className="shrink-0 w-9 h-9 rounded-md object-cover border border-border/30" />
        )}

        {/* Info */}
        <div className="flex-1 min-w-0 overflow-hidden">
          <p className="text-[11px] font-bold text-foreground truncate">{offer.title_ar}</p>
          <div className="flex items-center gap-1 mt-0.5 flex-wrap">
            <span className="text-[11px] font-black text-primary">{formatPrice(offer.price)}</span>
            <span className="text-[8px] text-muted-foreground">د.ع</span>
            {offer.gift_tickets > 0 && (
              <span className="text-[8px] text-purple-600 flex items-center gap-0.5">
                <Ticket className="h-2.5 w-2.5" />+{offer.gift_tickets}
              </span>
            )}
            {offer.points_reward && offer.points_reward > 0 && (
              <span className="text-[8px] text-amber-600 flex items-center gap-0.5">
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

        {/* Navigate to offers page */}
        <Button
          size="sm"
          className="shrink-0 h-7 text-[9px] gap-0.5 px-2"
          onClick={() => navigate('/offers')}
        >
          <ShoppingCart className="h-3 w-3" />
          عرض التفاصيل
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