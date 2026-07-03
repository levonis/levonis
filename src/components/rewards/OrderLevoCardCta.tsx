import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ShoppingCart, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNumberFormat } from '@/lib/i18n/numberFormat';

/**
 * Shown in "My Cards" for users who don't yet have a Levo physical card
 * assigned. Adds the reserved Levo card product to cart.
 */
export default function OrderLevoCardCta() {
  const { user } = useAuth();
  const { addToCart } = useCart();
  const { fmt } = useNumberFormat();
  const [busy, setBusy] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ['levo-card-my-lite', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('levo_card_assignments' as any)
        .select('id')
        .eq('user_id', user!.id)
        .is('released_at', null)
        .maybeSingle();
      return data as any;
    },
    staleTime: 30_000,
  });

  const { data: product } = useQuery({
    queryKey: ['levo-card-product'],
    queryFn: async () => {
      const { data: idRes } = await (supabase as any).rpc('get_levo_card_product_id');
      const productId = idRes as string;
      if (!productId) return null;
      const { data } = await supabase
        .from('products')
        .select('id, name_ar, price, image_url, images')
        .eq('id', productId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!user || assignment || !product) return null;

  const handleOrder = async () => {
    setBusy(true);
    try {
      const ok = await addToCart(product.id, undefined, undefined, 1);
      if (ok) toast.success('تمت إضافة البطاقة إلى السلة');
    } catch (e: any) {
      toast.error(e?.message || 'فشلت الإضافة');
    } finally {
      setBusy(false);
    }
  };

  const image = product.image_url || (Array.isArray(product.images) && product.images[0]) || null;

  return (
    <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
      <CardContent className="p-4 flex items-center gap-3">
        <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
          {image ? (
            <img src={image} alt={product.name_ar} className="w-full h-full object-cover" loading="lazy" />
          ) : (
            <CreditCard className="h-7 w-7 text-primary" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm truncate">{product.name_ar || 'بطاقة ليفو الفيزيائية'}</div>
          <div className="text-xs text-muted-foreground mt-0.5">
            بطاقة فيزيائية تصلك للمنزل — فعّلها بعد الاستلام
          </div>
          <div className="text-sm font-bold text-primary mt-1">{fmt(Number(product.price || 0))} د.ع</div>
        </div>
        <Button size="sm" onClick={handleOrder} disabled={busy}>
          {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (<><ShoppingCart className="h-4 w-4 ml-1" /> اطلب</>)}
        </Button>
      </CardContent>
    </Card>
  );
}
