import { useEffect, useRef } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global realtime price sync.
 * Subscribes once per app instance to UPDATE events on:
 *   - products (price, original_price, ...)
 *   - product_options (price_adjustment)
 *   - product_offers (offer_price, is_active)
 * On any change, invalidates the affected React Query caches so every
 * product card, product detail page, cart view, etc. refetches the fresh
 * price within ~hundreds of ms — without a manual reload.
 *
 * If `notifyCartItemIds` is provided, when a price change touches a product
 * currently in the user's cart a silent sonner toast is shown.
 */
export function useRealtimePriceSync(
  cartProductNames?: Map<string, string>
) {
  const queryClient = useQueryClient();
  const cartRef = useRef(cartProductNames);
  cartRef.current = cartProductNames;

  // throttle invalidations
  const pendingRef = useRef<number | null>(null);
  // throttle toasts per product
  const toastedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const scheduleInvalidate = () => {
      if (pendingRef.current !== null) return;
      pendingRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        const qc = queryClient;
        [
          ['products'],
          ['product'],
          ['product-offers'],
          ['product-offer'],
          ['product-options'],
          ['offers'],
          ['cart'],
          ['cart-stock-check'],
          ['merchant-products'],
          ['featured-products'],
          ['category-products'],
        ].forEach((key) => qc.invalidateQueries({ queryKey: key as any }));
      }, 200);
    };

    const maybeNotifyCart = (productId?: string | null) => {
      if (!productId) return;
      const map = cartRef.current;
      if (!map || !map.has(productId)) return;
      const now = Date.now();
      const last = toastedRef.current.get(productId) ?? 0;
      if (now - last < 3000) return;
      toastedRef.current.set(productId, now);
      const name = map.get(productId) || '';
      toast(`تم تحديث سعر ${name}`.trim(), { duration: 2500 });
    };

    const productsChannel = supabase
      .channel('rt-prices-products')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const priceChanged =
            oldP.price !== newP.price ||
            oldP.original_price !== newP.original_price ||
            oldP.direct_sale_price !== newP.direct_sale_price;
          if (!priceChanged) return;
          scheduleInvalidate();
          maybeNotifyCart(newP.id);
        }
      )
      .subscribe();

    const optionsChannel = supabase
      .channel('rt-prices-options')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_options' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const changed =
            payload.eventType !== 'UPDATE' ||
            oldP.price_adjustment !== newP.price_adjustment;
          if (!changed) return;
          scheduleInvalidate();
          maybeNotifyCart(newP.product_id ?? oldP.product_id);
        }
      )
      .subscribe();

    const offersChannel = supabase
      .channel('rt-prices-offers')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_offers' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const changed =
            payload.eventType !== 'UPDATE' ||
            oldP.offer_price !== newP.offer_price ||
            oldP.is_active !== newP.is_active;
          if (!changed) return;
          scheduleInvalidate();
          maybeNotifyCart(newP.product_id ?? oldP.product_id);
        }
      )
      .subscribe();

    return () => {
      if (pendingRef.current !== null) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      supabase.removeChannel(productsChannel);
      supabase.removeChannel(optionsChannel);
      supabase.removeChannel(offersChannel);
    };
  }, [queryClient]);
}
