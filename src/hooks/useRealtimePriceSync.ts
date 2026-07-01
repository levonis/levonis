import { useEffect, useRef } from 'react';
import { useQueryClient, type QueryKey } from '@tanstack/react-query';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

/**
 * Global realtime price sync with OPTIMISTIC cache patching.
 *
 * Instead of only invalidating queries (which waits for a network refetch),
 * we directly mutate every matching React Query cache entry with the new
 * price fields so the UI updates in the same tick the Realtime payload
 * arrives — even on flaky networks or right after a reconnect.
 *
 * After the optimistic patch we still trigger a debounced background
 * refetch so the cache stays canonical.
 */
export function useRealtimePriceSync(cartProductNames?: Map<string, string>) {
  const queryClient = useQueryClient();
  const cartRef = useRef(cartProductNames);
  cartRef.current = cartProductNames;

  const pendingRef = useRef<number | null>(null);
  const toastedRef = useRef<Map<string, number>>(new Map());

  useEffect(() => {
    const QUERY_KEYS: QueryKey[] = [
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
    ];

    const scheduleInvalidate = () => {
      if (pendingRef.current !== null) return;
      pendingRef.current = window.setTimeout(() => {
        pendingRef.current = null;
        QUERY_KEYS.forEach((key) =>
          queryClient.invalidateQueries({ queryKey: key, refetchType: 'active' }),
        );
      }, 250);
    };

    /**
     * Walk every cached query and apply `patch(node)` recursively to any
     * object that looks like the target row (matched by `match(node)`).
     * Returns the next cached value (or the same reference if nothing changed).
     */
    const patchCaches = (
      match: (node: any) => boolean,
      patch: (node: any) => any,
    ) => {
      const cache = queryClient.getQueryCache();
      cache.getAll().forEach((query) => {
        const data = query.state.data;
        if (data === undefined || data === null) return;
        let mutated = false;

        const walk = (value: any): any => {
          if (value === null || value === undefined) return value;
          if (Array.isArray(value)) {
            let arrChanged = false;
            const next = value.map((item) => {
              const n = walk(item);
              if (n !== item) arrChanged = true;
              return n;
            });
            return arrChanged ? next : value;
          }
          if (typeof value === 'object') {
            let objChanged = false;
            const next: any = Array.isArray(value) ? [...value] : { ...value };
            for (const k of Object.keys(value)) {
              const n = walk(value[k]);
              if (n !== value[k]) {
                next[k] = n;
                objChanged = true;
              }
            }
            if (match(next)) {
              const patched = patch(next);
              if (patched !== next) {
                mutated = true;
                return patched;
              }
            }
            return objChanged ? next : value;
          }
          return value;
        };

        const nextData = walk(data);
        if (mutated || nextData !== data) {
          queryClient.setQueryData(query.queryKey, nextData);
        }
      });
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

    // Single channel with 3 handlers → 1 WebSocket subscription instead of 3.
    const priceChannel = supabase
      .channel('rt-prices')
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const id = newP.id ?? oldP.id;
          if (!id) return;
          const priceChanged =
            oldP.price !== newP.price ||
            oldP.original_price !== newP.original_price ||
            oldP.direct_sale_price !== newP.direct_sale_price;
          if (!priceChanged) return;

          patchCaches(
            (n) => n && n.id === id && ('price' in n || 'original_price' in n),
            (n) => ({
              ...n,
              ...(newP.price !== undefined ? { price: newP.price } : {}),
              ...(newP.original_price !== undefined
                ? { original_price: newP.original_price }
                : {}),
              ...(newP.direct_sale_price !== undefined
                ? { direct_sale_price: newP.direct_sale_price }
                : {}),
            }),
          );

          scheduleInvalidate();
          maybeNotifyCart(id);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_options' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const optionId = newP.id ?? oldP.id;
          if (payload.eventType === 'UPDATE' && optionId) {
            if (oldP.price_adjustment === newP.price_adjustment) return;
            patchCaches(
              (n) => n && n.id === optionId && 'price_adjustment' in n,
              (n) => ({ ...n, price_adjustment: newP.price_adjustment }),
            );
          }
          scheduleInvalidate();
          maybeNotifyCart(newP.product_id ?? oldP.product_id);
        },
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'product_offers' },
        (payload: any) => {
          const oldP = payload.old ?? {};
          const newP = payload.new ?? {};
          const offerId = newP.id ?? oldP.id;
          if (payload.eventType === 'UPDATE' && offerId) {
            const changed =
              oldP.offer_price !== newP.offer_price ||
              oldP.is_active !== newP.is_active;
            if (!changed) return;
            patchCaches(
              (n) => n && n.id === offerId && ('offer_price' in n || 'is_active' in n),
              (n) => ({
                ...n,
                ...(newP.offer_price !== undefined
                  ? { offer_price: newP.offer_price }
                  : {}),
                ...(newP.is_active !== undefined
                  ? { is_active: newP.is_active }
                  : {}),
              }),
            );
          }
          scheduleInvalidate();
          maybeNotifyCart(newP.product_id ?? oldP.product_id);
        },
      )
      .subscribe();

    // Re-invalidate on reconnect so we catch any events missed while offline.
    const handleOnline = () => scheduleInvalidate();
    window.addEventListener('online', handleOnline);

    return () => {
      window.removeEventListener('online', handleOnline);
      if (pendingRef.current !== null) {
        clearTimeout(pendingRef.current);
        pendingRef.current = null;
      }
      supabase.removeChannel(priceChannel);

    };
  }, [queryClient]);
}
