// Strict TypeScript — keep CartItem typing tight; do not add @ts-nocheck.
import React, { createContext, useContext, useState, useEffect, useMemo, useRef, ReactNode, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from './useAuth';
import { useShippingSettings } from './useShippingCalculator';
import { fetchVariantDirectSalePrices, getCartItemVariantOverrideCostIqd, getGuardedCartItemPrice } from '@/lib/priceGuard';
import { useCodDefaults } from './useCodDefaults';
import { toast } from 'sonner';
import { trackMetaEvent } from '@/lib/metaPixel';
import { deriveCartSaleType, detectSaleTypeConflict, type SaleType } from '@/lib/cartSaleType';
import { useRealtimePriceSync } from './useRealtimePriceSync';

// Default IQD rate fallback used across the cart when shipping settings haven't
// loaded yet. Kept in sync with the production exchange rate so prices computed
// before the live settings arrive remain stable.
const DEFAULT_USD_TO_IQD = 1540;

export const MAX_QUANTITY_PER_ITEM = 50;

export interface CartItem {
  id: string;
  product_id: string | null;
  custom_request_id: string | null;
  bundle_id?: string | null;
  /** Random Filament offer link — items linked here go through RF flow. */
  rf_offer_id?: string | null;
  offer_purchase_id?: string | null;
  quantity: number;
  product_option_id?: string | null;
  selected_color?: string | null;
  color_image_url?: string | null;
  option_image_url?: string | null;
  shipping_option_index?: number | null;
  shipping_option_name_ar?: string | null;
  /**
   * Cart item sale_type. Source of truth lives on the linked entity
   * (product / bundle / rf_offer) and is copied onto the row at insert.
   * Use helpers from `@/lib/cartSaleType` instead of reading directly.
   */
  sale_type?: SaleType | null;
  // ---- Gift / locked / random-filament metadata ----
  /** True when the row was inserted as a gift (price forced to 0). */
  is_gift?: boolean | null;
  /** Gift category, e.g. competition / red-envelope / membership. */
  gift_type?: string | null;
  /** Source id for the gift (envelope id, prize id, etc.). */
  gift_id?: string | null;
  /** Locked row that the user cannot remove/edit (e.g. revealed RF). */
  is_locked?: boolean | null;
  /** True when the row belongs to the Random Filament flow. */
  is_random_filament?: boolean | null;
  /** True after RF order is revealed and the actual product is shown. */
  is_random_filament_revealed?: boolean | null;
  /** Hydrated final IQD price for revealed RF rows. */
  random_filament_price_iqd?: number | null;
  /** Max stock cap propagated from RF offer summary. */
  random_filament_max_stock?: number | null;
  /** True when quantity was clamped server-side to RF max stock. */
  random_filament_was_capped?: boolean;
  /** Marker set during fetch when an RF row was deleted server-side. */
  __rf_removed?: boolean;
  /** Admin-overridden unit price (IQD). When set, overrides product price. */
  admin_set_price?: number | null;
  products?: {
    id: string;
    name: string;
    name_ar: string;
    price: number;
    direct_sale_price?: number | null;
    sea_price?: number | null;
    air_price?: number | null;
    original_price: number | null;
    image_url: string | null;
    images?: string[];
    slug: string;
    colors?: any[];
    pre_order_shipping_options?: any;
    shipping_type?: string | null;
    category_id?: string | null;
    cod_enabled?: boolean | null;
    link_direct_commission_to_cod?: boolean | null;
    categories?: {
      id: string;
      tax_rate: number | null;
      main_section_id: string | null;
    } | null;
  };
  product_options?: {
    id: string;
    name_ar: string;
    price_adjustment: number | null;
  };
  custom_product_requests?: {
    id: string;
    product_name: string;
    suggested_price: number;
    image_url: string | null;
    quantity: number;
  };
  product_bundles?: {
    id: string;
    title_ar: string;
    bundle_price: number;
    original_price: number;
    image_url: string | null;
    sale_type: string | null;
  };
  offer_purchase?: {
    id: string;
    offer_id: string;
    quantity: number;
    product_offers: {
      id: string;
      title_ar: string;
      image_url: string | null;
      images: string[] | null;
      price: number;
      currency: string | null;
    };
  };
}

export interface PendingCartRequest {
  id: string;
  cart_code: string;
  adjusted_total: number | null;
  admin_notes: string | null;
  status: string;
}

interface CartContextType {
  items: CartItem[];
  loading: boolean;
  itemCount: number;
  total: number;
  pendingCartRequest: PendingCartRequest | null;
  addToCart: (productId: string, optionId?: string, color?: string, quantity?: number, shippingInfo?: { index: number; name_ar: string; type?: string }, saleType?: 'direct' | 'preorder') => Promise<boolean>;
  forceAddToCart: (productId: string, optionId?: string, color?: string, quantity?: number, shippingInfo?: { index: number; name_ar: string; type?: string }, saleType?: 'direct' | 'preorder') => Promise<boolean>;
  addBundleToCart: (bundleId: string, saleType: 'direct' | 'preorder', quantity?: number) => Promise<boolean>;
  cartSaleType: string | null;
  addCustomRequestToCart: (customRequestId: string) => Promise<void>;
  addOfferPurchaseToCart: (offerPurchaseId: string) => Promise<boolean>;
  updateQuantity: (itemId: string, quantity: number) => Promise<void>;
  removeFromCart: (itemId: string) => Promise<void>;
  clearCart: () => Promise<void>;
  refreshCart: () => Promise<void>;
  deleteCartRequest: () => Promise<boolean>;
  checkAndWarnCartRequest: () => Promise<boolean>;
}

export const CartContext = createContext<CartContextType | undefined>(undefined);

export const CartProvider = ({ children }: { children: ReactNode }) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<CartItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [pendingCartRequest, setPendingCartRequest] = useState<PendingCartRequest | null>(null);
  // Optimistic-update lock — bumped on local mutations so concurrent fetchCart()
  // calls don't overwrite an in-flight optimistic state with stale server data.
  const optimisticLockRef = useRef(0);
  // Live shipping settings — drive USD→IQD conversion for guarded prices.
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = (shippingSettings as any)?.usd_to_iqd_rate || DEFAULT_USD_TO_IQD;
  // Global COD defaults — shared hook with realtime sync. Cart prices for
  // products linked to `link_direct_commission_to_cod` recompute live whenever
  // the admin changes the COD %.
  const { data: codDefaults = null } = useCodDefaults();

  // Realtime price sync — invalidates all product queries the moment admin/assistant
  // updates products / product_options / product_offers prices. Cart items in the
  // user's cart show a small silent toast when their price changes.
  const cartProductNames = React.useMemo(() => {
    const map = new Map<string, string>();
    items.forEach((it: any) => {
      const pid = it.products?.id ?? it.product_id;
      if (pid) map.set(pid, it.products?.name_ar || it.products?.name || '');
    });
    return map;
  }, [items]);
  useRealtimePriceSync(cartProductNames);

  // Server-computed live direct-sale prices (RPC) — internal cost columns are
  // hidden from clients, so we ask the DB to return the final IQD value.
  const [liveDirectPrices, setLiveDirectPrices] = useState<Map<string, number>>(new Map());
  const [liveVariantDirectPrices, setLiveVariantDirectPrices] = useState<Map<string, number>>(new Map());

  useEffect(() => {
    const ids = items
      .filter((it) => it.sale_type === 'direct' && it.products?.link_direct_commission_to_cod && it.products?.id)
      .map((it) => it.products!.id);
    if (ids.length === 0) {
      if (liveDirectPrices.size > 0) setLiveDirectPrices(new Map());
      return;
    }
    let cancelled = false;
    (async () => {
      const { fetchLiveDirectSalePrices } = await import('@/lib/priceGuard');
      const map = await fetchLiveDirectSalePrices(ids);
      if (!cancelled) setLiveDirectPrices(map);
    })();
    return () => { cancelled = true; };
    // Re-fetch when item set, exchange rate, or COD defaults change.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i: any) => i.products?.id || '').join(','), usdToIqd, codDefaults?.value, codDefaults?.type]);

  useEffect(() => {
    const requests = items.flatMap((it: any) => {
      if (it.sale_type !== 'direct' || !it.products?.id || !it.products?.link_direct_commission_to_cod) return [];
      const costIqd = getCartItemVariantOverrideCostIqd(it, usdToIqd);
      return costIqd ? [{ productId: it.products.id, costIqd }] : [];
    });
    if (requests.length === 0) {
      if (liveVariantDirectPrices.size > 0) setLiveVariantDirectPrices(new Map());
      return;
    }
    let cancelled = false;
    fetchVariantDirectSalePrices(requests).then((map) => {
      if (!cancelled) setLiveVariantDirectPrices(map);
    });
    return () => { cancelled = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [items.map((i: any) => `${i.products?.id || ''}:${i.product_options?.price_adjustment || ''}:${i.selected_color || ''}`).join('|'), usdToIqd, codDefaults?.value, codDefaults?.type]);

  // Fetch pending cart request
  const fetchPendingCartRequest = async () => {
    if (!user) {
      setPendingCartRequest(null);
      return;
    }

    try {
      const { data, error } = await supabase
        .from('cart_requests')
        .select('id, cart_code, adjusted_total, admin_notes, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'adjusted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      setPendingCartRequest(data as PendingCartRequest | null);
    } catch (error) {
      console.error('Error fetching cart request:', error);
    }
  };

  // Delete cart request
  const deleteCartRequest = async (): Promise<boolean> => {
    if (!user) return false;

    try {
      // First fetch the latest pending request to ensure we have the correct ID
      const { data: latestRequest, error: fetchError } = await supabase
        .from('cart_requests')
        .select('id')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) {
        console.error('Error fetching cart request for deletion:', fetchError);
        throw fetchError;
      }

      if (latestRequest) {
        console.log('Deleting cart request:', latestRequest.id);
        
        const { error: deleteError } = await supabase
          .from('cart_requests')
          .delete()
          .eq('id', latestRequest.id)
          .eq('user_id', user.id); // Extra safety check

        if (deleteError) {
          console.error('Delete error:', deleteError);
          throw deleteError;
        }
        
        setPendingCartRequest(null);
        toast.success('تم حذف رمز السلة والسعر المعدل');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Error deleting cart request:', error);
      toast.error('حدث خطأ في حذف رمز السلة');
      return false;
    }
  };

  // Check and warn about cart request deletion
  const checkAndWarnCartRequest = async (): Promise<boolean> => {
    if (!user) return false;
    
    // Fetch directly from database to get latest state
    const { data } = await supabase
      .from('cart_requests')
      .select('id, cart_code, adjusted_total, admin_notes, status')
      .eq('user_id', user.id)
      .in('status', ['pending', 'adjusted'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();
    
    // Update state with latest data
    setPendingCartRequest(data as PendingCartRequest | null);
    
    return !!data;
  };

  const fetchCart = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }

    const lockValue = optimisticLockRef.current;

    try {
      
      const { data, error } = await supabase
        .from('cart_items')
        .select(`
          id,
          product_id,
          custom_request_id,
          bundle_id,
          offer_purchase_id,
          quantity,
          product_option_id,
          selected_color,
          color_image_url,
          option_image_url,
          shipping_option_index,
          shipping_option_name_ar,
          sale_type,
          is_gift,
          is_locked,
          rf_offer_id,
          rf_category_id,
          products (
            id,
            name,
            name_ar,
            price,
            price_usd,
            direct_sale_price,
            sea_price,
            air_price,
            original_price,
            round_up_price,
            image_url,
            images,
            slug,
            colors,
            pre_order_shipping_options,
            shipping_type,
            category_id,
            card_discounts,
            referral_earnings_iqd,
            cod_enabled,
            link_direct_commission_to_cod,
            has_pre_order,
            personal_delivery_cost,
            is_system_reserved,
            categories!products_category_id_fkey (
              id,
              name_ar,
              tax_rate,
              main_section_id
            )
          ),
          product_options (
            id,
            name_ar,
            price_adjustment
          ),
          custom_product_requests!cart_items_custom_request_id_fkey (
            id,
            product_name,
            suggested_price,
            image_url,
            quantity
          ),
          product_bundles:bundle_id (
            id,
            title_ar,
            bundle_price,
            original_price,
            image_url,
            sale_type
          ),
          product_offer_purchases!cart_items_offer_purchase_id_fkey (
            id,
            offer_id,
            quantity,
            product_offers (
              id,
              title_ar,
              image_url,
              images,
              price,
              currency
            )
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Fetch cart error:', error);
        throw error;
      }

      const cartRows = [...(data || [])];
      try {
        // Safety net for Random Filament rows: they intentionally have product_id = null,
        // so keep a lightweight direct read and merge them if an embedded select misses them.
        const { data: rfCartRows, error: rfCartError } = await (supabase as any)
          .from('cart_items')
          .select(`
            id,
            product_id,
            custom_request_id,
            bundle_id,
            offer_purchase_id,
            quantity,
            product_option_id,
            selected_color,
            color_image_url,
            option_image_url,
            shipping_option_index,
            shipping_option_name_ar,
            sale_type,
            is_gift,
            is_locked,
            rf_offer_id,
            rf_category_id
          `)
          .eq('user_id', user.id)
          .not('rf_offer_id', 'is', null);
        if (rfCartError) {
          console.warn('[useCart.fetchCart] RF fallback read failed:', rfCartError);
        } else if (rfCartRows?.length) {
          const knownIds = new Set(cartRows.map((row: any) => row.id));
          for (const row of rfCartRows) {
            if (!knownIds.has(row.id)) cartRows.push(row);
          }
        }
      } catch (rfFallbackError) {
        console.warn('[useCart.fetchCart] RF fallback crashed:', rfFallbackError);
      }
      
      // Only update if no optimistic operation happened while we were fetching
      if (optimisticLockRef.current === lockValue) {
        // Detect RF items: new flow uses rf_offer_id on cart_items;
        // legacy flow used random_filament_orders.cart_item_id link.
        let rfIds = new Set<string>();
        const rfRevealedIds = new Set<string>();
        const rfPriceById = new Map<string, number>();
        const rfMaxStockById = new Map<string, number>();
        const cappedIds = new Set<string>();
        try {
          const ids = cartRows.map((i: any) => i.id).filter(Boolean);
          cartRows.forEach((it: any) => {
            if (it?.rf_offer_id) rfIds.add(it.id);
          });
          // legacy link
          if (ids.length > 0) {
            const { data: rfRows } = await (supabase as any)
              .from('random_filament_orders')
              .select('cart_item_id, price_iqd, revealed_at, order_id')
              .in('cart_item_id', ids);
            (rfRows || []).forEach((r: any) => {
              if (r?.cart_item_id) {
                rfIds.add(r.cart_item_id);
                rfPriceById.set(r.cart_item_id, Number(r.price_iqd) || 0);
                if (r.revealed_at) rfRevealedIds.add(r.cart_item_id);
              }
            });
          }
          // fetch offer prices + stock for new-flow RF rows; auto-cap qty against available stock
          const offerIds = Array.from(new Set(cartRows.map((i: any) => i.rf_offer_id).filter(Boolean)));
          if (offerIds.length > 0) {
            const { data: offerRows } = await (supabase as any)
              .from('random_filament_offers')
              .select('id, price_iqd, sale_type')
              .in('id', offerIds);
            const offerMap = new Map<string, any>();
            (offerRows || []).forEach((o: any) => offerMap.set(o.id, o));
            for (const it of cartRows) {
              if (!it?.rf_offer_id) continue;
              const o = offerMap.get(it.rf_offer_id);
              if (o) rfPriceById.set(it.id, Number(o.price_iqd) || 0);
              if (o?.sale_type === 'direct') {
                try {
                  const { data: s } = await (supabase as any).rpc('rf_offer_stock_summary', { p_offer_id: it.rf_offer_id });
                  const maxStock = Number(s?.direct_stock_total ?? 0);
                  rfMaxStockById.set(it.id, maxStock);
                  // Auto-cap quantity if it now exceeds available stock (and item not already locked/finalized)
                  if (!rfRevealedIds.has(it.id) && Number(it.quantity) > maxStock) {
                    if (maxStock > 0) {
                      await (supabase as any).from('cart_items').update({ quantity: maxStock }).eq('id', it.id);
                      it.quantity = maxStock;
                      cappedIds.add(it.id);
                    } else {
                      await (supabase as any).from('cart_items').delete().eq('id', it.id);
                      (it as any).__rf_removed = true;
                    }
                  }
                } catch {}
              }
            }
          }
        } catch (e) { /* non-blocking */ }

        const mappedData = cartRows
          .filter((it: any) => !it.__rf_removed)
          .map((item: any) => ({
            ...item,
            offer_purchase: item.product_offer_purchases || null,
            is_locked: item.is_locked || rfRevealedIds.has(item.id),
            is_random_filament: rfIds.has(item.id),
            is_random_filament_revealed: rfRevealedIds.has(item.id),
            random_filament_price_iqd: rfPriceById.get(item.id) ?? null,
            random_filament_max_stock: rfMaxStockById.get(item.id) ?? null,
            random_filament_was_capped: (typeof URLSearchParams !== 'undefined') && false || false,
          }));
        // attach capped flag explicitly (avoid TDZ)
        const cappedSet = (typeof Set !== 'undefined') ? new Set(Array.from(cappedIds || [])) : null;
        if (cappedSet && cappedSet.size > 0) {
          for (const m of mappedData as any[]) {
            if (cappedSet.has(m.id)) m.random_filament_was_capped = true;
          }
        }
        setItems(mappedData as CartItem[]);
      }
    } catch (error: any) {
      const details = {
        name: error?.name,
        message: error?.message,
        code: error?.code,
        details: error?.details,
        hint: error?.hint,
        stack: error?.stack,
        userId: user?.id,
        timestamp: new Date().toISOString(),
      };
      console.error('[useCart.fetchCart] Failed:', details);
      console.warn('[useCart.fetchCart] Non-critical fail:', details);
      // Best-effort telemetry to backend logs (silently no-op if RPC missing)
      try {
        (supabase as any).rpc('log_client_error', {
          p_source: 'useCart.fetchCart',
          p_message: String(error?.message || error),
          p_context: details,
        })?.then?.(() => {}, () => {});
      } catch { /* swallow telemetry errors */ }
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    fetchCart();
    fetchPendingCartRequest();
  }, [user]);

  useEffect(() => {
    if (!user?.id) return;

    let channel: any = null;
    let pendingRefresh = false;

    const handleChange = () => {
      // Skip refetch when tab is hidden — refetch once on visibility return
      if (typeof document !== 'undefined' && document.hidden) {
        pendingRefresh = true;
        return;
      }
      fetchCart();
    };

    const subscribe = () => {
      channel = supabase
        .channel(`cart-items-${user.id}`)
        .on(
          'postgres_changes',
          {
            event: '*',
            schema: 'public',
            table: 'cart_items',
            filter: `user_id=eq.${user.id}`,
          },
          handleChange
        )
        .subscribe();
    };

    subscribe();

    const onVisibility = () => {
      if (!document.hidden && pendingRefresh) {
        pendingRefresh = false;
        fetchCart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      if (channel) supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCart]);

  // Realtime: when stock of a product currently sitting in the user's cart
  // changes (e.g. another user's RF reveal deducted option_stocks via
  // finalize_and_reveal_rf_for_order), refetch the cart so quantities and
  // availability reflect reality immediately.
  useEffect(() => {
    if (!user?.id) return;
    const productIds = Array.from(
      new Set(items.map((i) => i.products?.id).filter(Boolean) as string[])
    );
    if (productIds.length === 0) return;

    let pendingRefresh = false;
    const handleChange = () => {
      // Always invalidate the Cart page's stock-check query so quantities
      // refresh even if the user is not on Cart.tsx yet.
      queryClient.invalidateQueries({ queryKey: ['cart-stock-check'] });
      queryClient.invalidateQueries({ queryKey: ['bundle-max-qty'] });
      if (typeof document !== 'undefined' && document.hidden) {
        pendingRefresh = true;
        return;
      }
      fetchCart();
    };

    // Single channel with one binding per product id → 1 websocket instead of N.
    let ch = supabase.channel(`cart-products-${user.id}`);
    productIds.forEach((pid) => {
      ch = ch.on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'products', filter: `id=eq.${pid}` },
        handleChange
      );
    });
    const channel = ch.subscribe();


    const onVisibility = () => {
      if (!document.hidden && pendingRefresh) {
        pendingRefresh = false;
        fetchCart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, items.map((i) => i.products?.id || '').join(','), fetchCart, queryClient]);

  // Global always-on listener: ANY random_filament_orders INSERT/UPDATE may
  // deduct stock from products that any user has in their cart. Runs even when
  // the cart is empty so opening Cart immediately reflects fresh stock/prices.
  useEffect(() => {
    if (!user?.id) return;
    let pendingRefresh = false;
    const refresh = () => {
      queryClient.invalidateQueries({ queryKey: ['cart-stock-check'] });
      queryClient.invalidateQueries({ queryKey: ['bundle-max-qty'] });
      queryClient.invalidateQueries({ queryKey: ['random-filament-offers'] });
      queryClient.invalidateQueries({ queryKey: ['random-filament-section-stats'] });
      queryClient.invalidateQueries({ queryKey: ['product'] });
      queryClient.invalidateQueries({ queryKey: ['products'] });
      if (typeof document !== 'undefined' && document.hidden) {
        pendingRefresh = true;
        return;
      }
      fetchCart();
    };
    const channel = supabase
      .channel(`cart-rf-global-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'random_filament_orders' },
        refresh
      )
      .subscribe();
    const onVisibility = () => {
      if (!document.hidden && pendingRefresh) {
        pendingRefresh = false;
        fetchCart();
      }
    };
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      supabase.removeChannel(channel);
    };
  }, [user?.id, fetchCart, queryClient]);

  const addToCart = async (productId: string, optionId?: string, color?: string, quantity: number = 1, shippingInfo?: { index: number; name_ar: string; type?: string }, saleType: 'direct' | 'preorder' = 'preorder'): Promise<boolean> => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Check for sale_type conflict via centralized helper.
      // Policy: the existing cart's sale_type wins; the new item must match
      // or the user has to clear the cart first.
      const conflict = detectSaleTypeConflict(items, saleType);
      if (conflict) {
        // Signal conflict - let the caller handle confirmation UI.
        const err: any = new Error('SALE_TYPE_CONFLICT');
        err.conflict = conflict;
        throw err;
      }

      // Get product data to find color image
      const { data: productData } = await supabase
        .from('products')
        .select('colors, images, image_url')
        .eq('id', productId)
        .maybeSingle();
      
      let colorImageUrl: string | null = null;
      if (color && productData?.colors) {
        const selectedColorData = (productData.colors as any[]).find(
          (c: any) => c.name === color || c.name_ar === color
        );
        colorImageUrl = selectedColorData?.image_url || null;
      }
      
      // Get option data to find option image
      let optionImageUrl: string | null = null;
      if (optionId) {
        const { data: optionData } = await supabase
          .from('product_options')
          .select('image_url')
          .eq('id', optionId)
          .maybeSingle();
        
        optionImageUrl = optionData?.image_url || null;
      }
      
      // Check if item with same product, option, color and shipping already exists
      const normalize = (v: any) => v ? v.toString().trim() : null;
      const normalizeShippingIndex = (v: any): number | null => (v === null || v === undefined) ? null : Number(v);
      
      const targetShippingIndex = normalizeShippingIndex(shippingInfo?.index);
      
      // Block adding/merging with a locked Random Filament item that matches the same product/option/color
      const conflictingRf = items.find((item: any) =>
        (item.is_random_filament || item.is_locked) &&
        item.product_id === productId &&
        normalize(item.product_option_id) === normalize(optionId) &&
        normalize(item.selected_color) === normalize(color)
      );
      if (conflictingRf) {
        toast.error('هذا المنتج محجوز كفلمنت عشوائي في سلتك ولا يمكن تعديله أو إضافته مرة أخرى');
        return false;
      }

      const existingItem = items.find(item =>
        item.product_id === productId &&
        normalize(item.product_option_id) === normalize(optionId) &&
        normalize(item.selected_color) === normalize(color) &&
        normalizeShippingIndex(item.shipping_option_index) === targetShippingIndex &&
        item.sale_type === saleType &&
        item.is_gift === false &&
        !item.is_random_filament &&
        !item.is_locked &&
        !item.bundle_id &&
        !item.offer_purchase_id
      );
      
      if (existingItem) {
        const newQty = existingItem.quantity + quantity;
        if (newQty > MAX_QUANTITY_PER_ITEM) {
          toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
          return false;
        }
        await updateQuantity(existingItem.id, newQty);
        return true;
      }

      if (quantity > MAX_QUANTITY_PER_ITEM) {
        toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
        return false;
      }

      const insertData: any = { 
        user_id: user.id, 
        product_id: productId, 
        quantity: quantity,
        sale_type: saleType,
      };
      
      if (optionId) {
        insertData.product_option_id = optionId;
      }
      
      if (color) {
        insertData.selected_color = color;
      }
      
      if (colorImageUrl) {
        insertData.color_image_url = colorImageUrl;
      }
      
      if (optionImageUrl) {
        insertData.option_image_url = optionImageUrl;
      }
      
      const safeShippingIndex = normalizeShippingIndex(shippingInfo?.index);
      const safeShippingNameAr = shippingInfo?.name_ar;

      if (safeShippingIndex !== null && Number.isFinite(safeShippingIndex)) {
        insertData.shipping_option_index = Math.trunc(safeShippingIndex);
        insertData.shipping_option_name_ar = safeShippingNameAr || null;
      }
      // Persist the chosen shipping type (sea/air/land) so cart pricing
      // can use the exact selected price instead of Math.min over all modes.
      if (shippingInfo?.type) {
        insertData.shipping_type = shippingInfo.type;
      }
      // Don't set shipping_option_index at all if null — let DB default handle it

      const { data: insertedData, error } = await supabase
        .from('cart_items')
        .insert([insertData])
        .select('id')
        .single();

      if (error) {
        // Handle unique violation - item already exists, try to increment quantity
        if (error.code === '23505') {
          const { data: existing } = await supabase
            .from('cart_items')
            .select('id, quantity')
            .eq('user_id', user.id)
            .eq('product_id', productId)
            .eq('is_gift', false)
            .limit(1)
            .maybeSingle();
          if (existing) {
            const newQty = existing.quantity + quantity;
            if (newQty > MAX_QUANTITY_PER_ITEM) {
              toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
              return false;
            }
            await updateQuantity(existing.id, newQty);
            return true;
          }
        }
        console.error('Insert error:', error);
        throw error;
      }
      
      await fetchCart();
      // Meta Pixel + CAPI: AddToCart (non-blocking)
      try {
        void trackMetaEvent({
          eventName: 'AddToCart',
          customData: {
            content_ids: [productId],
            content_type: 'product',
            currency: 'IQD',
            num_items: quantity,
          },
        });
      } catch {}
      return true;
    } catch (error: any) {
      if (error?.message === 'SALE_TYPE_CONFLICT') throw error;
      console.error('Error adding to cart - Full Context:', {
        productId,
        optionId,
        color,
        quantity,
        saleType,
        error
      });
      const msg = error?.message || error?.error_description || 'حدث خطأ في إضافة المنتج';
      toast.error(msg);
      return false;
    }
  };

  const addCustomRequestToCart = async (customRequestId: string) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    try {
      // Check if custom request already exists in cart
      const existingItem = items.find(item => item.custom_request_id === customRequestId);
      
      if (existingItem) {
        toast.info('هذا الطلب موجود بالفعل في السلة');
        return;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([{ user_id: user.id, product_id: null, custom_request_id: customRequestId, quantity: 1 }]);

      if (error) throw error;
      
      await fetchCart();
      toast.success('تمت إضافة الطلب المخصص إلى السلة');
    } catch (error) {
      console.error('Error adding custom request to cart:', error);
      toast.error('حدث خطأ في إضافة الطلب المخصص');
    }
  };

  const updateQuantity = async (itemId: string, quantity: number) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    if (quantity < 1) return;
    if (quantity > MAX_QUANTITY_PER_ITEM) {
      toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
      return;
    }
    // Revealed random-filament items cannot change quantity
    const target = items.find(i => i.id === itemId);
    if (target?.is_random_filament_revealed || target?.is_locked) {
      toast.error('لا يمكن تعديل كمية طلب الفلمنت العشوائي بعد الكشف عن اللون');
      return;
    }

    // Optimistic update with lock to prevent fetchCart from overwriting
    optimisticLockRef.current++;
    const previousItems = items;
    setItems(prev => prev.map(item => item.id === itemId ? { ...item, quantity } : item));

    try {
      const { error } = await supabase
        .from('cart_items')
        .update({ quantity })
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Update quantity error:', error);
        setItems(previousItems);
        optimisticLockRef.current--;
        throw error;
      }
      
      toast.success('تم تحديث الكمية');
    } catch (error) {
      console.error('Error updating quantity:', error);
      toast.error('حدث خطأ في تحديث الكمية');
    }
  };

  const removeFromCart = async (itemId: string) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    // Note: do NOT hard-block on client side based on is_random_filament_revealed/is_locked.
    // The DB trigger `protect_random_filament_cart_delete` is the source of truth — it only
    // blocks when there is an actual linked order (order_id IS NOT NULL OR revealed_at IS NOT NULL).
    // Client-side flags can become stale (e.g. accidental reveal without order), which would
    // otherwise leave the user unable to delete a perfectly removable cart row.
    // Optimistic update with lock
    optimisticLockRef.current++;
    const previousItems = items;
    setItems(prev => prev.filter(item => item.id !== itemId));
    
    try {
      const { error } = await supabase
        .from('cart_items')
        .delete()
        .eq('id', itemId)
        .eq('user_id', user.id);

      if (error) {
        console.error('Remove from cart error:', error);
        // Revert on error
        setItems(previousItems);
        const msg = String((error as any)?.message || '');
        if (msg.includes('RANDOM_FILAMENT_LOCKED')) {
          toast.error('لا يمكن إلغاء طلب الفلمنت العشوائي. أي محاولة قد تؤدي للحظر الدائم من القسم.');
          return;
        }
        throw error;
      }
      
      toast.success('تم حذف المنتج من السلة');
    } catch (error) {
      console.error('Error removing from cart:', error);
      const msg = String((error as any)?.message || '');
      if (!msg.includes('RANDOM_FILAMENT_LOCKED')) {
        toast.error('حدث خطأ في حذف المنتج');
      }
    }
  };

  const clearCart = async () => {
    if (!user) return;

    // Items the DB will refuse to delete: revealed Random Filament, locked items, and gifts.
    // Exclude them up-front so the rest of the cart actually empties.
    const nonDeletable = (i: any) =>
      i.is_random_filament_revealed || i.is_locked || i.is_gift;
    const keptIds = new Set(items.filter(nonDeletable).map((i: any) => i.id));
    const deletableIds = items.filter((i: any) => !keptIds.has(i.id)).map((i: any) => i.id);
    const hasRevealed = items.some((i: any) => i.is_random_filament_revealed);
    const hasKeptOther = items.some((i: any) => (i.is_locked || i.is_gift) && !i.is_random_filament_revealed);

    if (deletableIds.length === 0) {
      toast.info('لا توجد عناصر يمكن حذفها من السلة');
      return;
    }

    try {
      const { error, data } = await supabase
        .from('cart_items')
        .delete()
        .eq('user_id', user.id)
        .in('id', deletableIds)
        .select('id');

      if (error) {
        const msg = String((error as any)?.message || '');
        if (msg.includes('RANDOM_FILAMENT_LOCKED')) {
          toast.error('لا يمكن إلغاء طلب الفلمنت العشوائي بعد ربطه بطلب.');
          await fetchCart();
          return;
        }
        throw error;
      }

      const deletedSet = new Set((data || []).map((r: any) => r.id));
      setItems(prev => prev.filter((i) => !deletedSet.has(i.id)));
      if (hasRevealed || hasKeptOther) {
        toast.success('تم تفريغ السلة (تم الإبقاء على العناصر المقفلة/الهدايا)');
      } else {
        toast.success('تم تفريغ السلة');
      }
    } catch (error) {
      console.error('Error clearing cart:', error);
      toast.error('حدث خطأ في تفريغ السلة');
    }
  };

  const forceAddToCart = async (productId: string, optionId?: string, color?: string, quantity: number = 1, shippingInfo?: { index: number; name_ar: string; type?: string }, saleType: 'direct' | 'preorder' = 'preorder'): Promise<boolean> => {
    if (!user) return false;
    // Block force-add when a matching RF item is already locked in the cart
    const normalize = (v: any) => v ? v.toString().trim() : null;
    const conflictingRf = items.find((item: any) =>
      (item.is_random_filament || item.is_locked) &&
      item.product_id === productId &&
      normalize(item.product_option_id) === normalize(optionId) &&
      normalize(item.selected_color) === normalize(color)
    );
    if (conflictingRf) {
      toast.error('هذا المنتج محجوز كفلمنت عشوائي في سلتك ولا يمكن تعديله أو إضافته مرة أخرى');
      return false;
    }
    try {
      // Clear cart items directly in DB — exclude locked / random-filament items
      const deletableIds = items
        .filter((i: any) => !i.is_random_filament && !i.is_locked)
        .map(i => i.id);
      if (deletableIds.length > 0) {
        const { error: clearError } = await supabase
          .from('cart_items')
          .delete()
          .eq('user_id', user.id)
          .in('id', deletableIds);
        if (clearError) throw clearError;
      }
      // Reset local items, keeping locked ones
      setItems(prev => prev.filter((i: any) => i.is_random_filament || i.is_locked));

      // Now insert the new item directly (bypass addToCart conflict check)
      const { data: productData } = await supabase
        .from('products')
        .select('colors, images, image_url')
        .eq('id', productId)
        .single();

      let colorImageUrl: string | null = null;
      if (color && productData?.colors) {
        const selectedColorData = (productData.colors as any[]).find(
          (c: any) => c.name === color || c.name_ar === color
        );
        colorImageUrl = selectedColorData?.image_url || null;
      }

      let optionImageUrl: string | null = null;
      if (optionId) {
        const { data: optionData } = await supabase
          .from('product_options')
          .select('image_url')
          .eq('id', optionId)
          .single();
        optionImageUrl = optionData?.image_url || null;
      }

      const insertData: any = {
        user_id: user.id,
        product_id: productId,
        quantity,
        sale_type: saleType,
      };
      if (optionId) insertData.product_option_id = optionId;
      if (color) insertData.selected_color = color;
      if (colorImageUrl) insertData.color_image_url = colorImageUrl;
      if (optionImageUrl) insertData.option_image_url = optionImageUrl;
      if (shippingInfo?.index !== null && shippingInfo?.index !== undefined && Number.isFinite(shippingInfo.index)) {
        insertData.shipping_option_index = Math.trunc(shippingInfo.index);
        insertData.shipping_option_name_ar = shippingInfo.name_ar || null;
      }
      if (shippingInfo?.type) {
        insertData.shipping_type = shippingInfo.type;
      }

      const { error } = await supabase.from('cart_items').insert([insertData]);
      if (error) throw error;

      await fetchCart();
      return true;
    } catch (error) {
      console.error('Error in forceAddToCart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
      return false;
    }
  };

  const addBundleToCart = async (bundleId: string, saleType: 'direct' | 'preorder', quantity: number = 1): Promise<boolean> => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Check for sale_type conflict via centralized helper.
      const conflict = detectSaleTypeConflict(items, saleType);
      if (conflict) {
        const err: any = new Error('SALE_TYPE_CONFLICT');
        err.conflict = conflict;
        throw err;
      }

      // Check if this bundle already exists in the cart
      const existingBundle = items.find(item => item.bundle_id === bundleId);
      if (existingBundle) {
        const newQty = existingBundle.quantity + quantity;
        if (newQty > MAX_QUANTITY_PER_ITEM) {
          toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
          return false;
        }
        await updateQuantity(existingBundle.id, newQty);
        return true;
      }
      if (quantity > MAX_QUANTITY_PER_ITEM) {
        toast.error(`الحد الأقصى ${MAX_QUANTITY_PER_ITEM} قطعة لكل منتج في السلة`);
        return false;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([{
          user_id: user.id,
          bundle_id: bundleId,
          quantity: quantity,
          sale_type: saleType,
        }]);

      if (error) {
        console.error('Bundle insert error:', error);
        throw error;
      }

      await fetchCart();
      return true;
    } catch (error: any) {
      if (error?.message === 'SALE_TYPE_CONFLICT') throw error;
      console.error('Error adding bundle to cart:', error);
      toast.error('حدث خطأ في إضافة الباقة');
      return false;
    }
  };

  const addOfferPurchaseToCart = async (offerPurchaseId: string): Promise<boolean> => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return false;
    }

    try {
      // Check if already in cart
      const existingItem = items.find(item => item.offer_purchase_id === offerPurchaseId);
      if (existingItem) {
        toast.info('هذا المنتج موجود بالفعل في السلة');
        return false;
      }

      const { error } = await supabase
        .from('cart_items')
        .insert([{
          user_id: user.id,
          offer_purchase_id: offerPurchaseId,
          quantity: 1,
          sale_type: 'direct',
        }]);

      if (error) throw error;

      await fetchCart();
      toast.success('تمت إضافة المنتج إلى السلة');
      return true;
    } catch (error) {
      console.error('Error adding offer purchase to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج للسلة');
      return false;
    }
  };

  const itemCount = items.reduce((sum, item) => sum + item.quantity, 0);
  
  const total = items.reduce((sum, item) => {
    // Gift items are free
    if (item.is_gift) return sum;
    // Offer purchase items are free (already paid)
    if (item.offer_purchase_id) return sum;
    if (item.is_random_filament) {
      const rfPrice = Number(item.random_filament_price_iqd) || 0;
      return sum + (rfPrice * item.quantity);
    }
    if (item.products) {
      const itemPrice = getGuardedCartItemPrice(item, usdToIqd, codDefaults, liveDirectPrices, liveVariantDirectPrices);
      return sum + (itemPrice * item.quantity);
    } else if (item.custom_product_requests) {
      return sum + (Number(item.custom_product_requests.suggested_price) * item.quantity);
    } else if (item.product_bundles) {
      return sum + (Number(item.product_bundles.bundle_price) * item.quantity);
    }
    return sum;
  }, 0);

  // Combined refresh function
  const refreshAll = async () => {
    await fetchCart();
    await fetchPendingCartRequest();
  };

  // Determine the current cart's sale type (centralized helper covers
  // product_id / bundle_id / rf_offer_id consistently).
  const cartSaleType = deriveCartSaleType(items);


  // Memoize the context value so consumers only re-render when one of the
  // underlying fields actually changes. Without this, every parent render
  // (Auth/Language/Island updates) forced a fresh object identity and cascaded
  // re-renders through the entire component tree.
  const value = useMemo(
    () => ({
      items,
      loading,
      itemCount,
      total,
      pendingCartRequest,
      cartSaleType,
      addToCart,
      forceAddToCart,
      addBundleToCart,
      addCustomRequestToCart,
      addOfferPurchaseToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      refreshCart: refreshAll,
      deleteCartRequest,
      checkAndWarnCartRequest,
    }),
    [
      items,
      loading,
      itemCount,
      total,
      pendingCartRequest,
      cartSaleType,
      addToCart,
      forceAddToCart,
      addBundleToCart,
      addCustomRequestToCart,
      addOfferPurchaseToCart,
      updateQuantity,
      removeFromCart,
      clearCart,
      refreshAll,
      deleteCartRequest,
      checkAndWarnCartRequest,
    ],
  );

  return (
    <CartContext.Provider value={value}>
      {children}
    </CartContext.Provider>
  );
};

export const useCart = () => {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error('useCart must be used within a CartProvider');
  }
  return context;
};