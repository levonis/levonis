import { Link, useNavigate } from 'react-router-dom';
import { notifyWalletDeducted } from '@/lib/walletNotifications';
import { linkWalletDeductionToOrder } from '@/lib/walletAuditLog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart, CartItem } from '@/hooks/useCart';
import { useCartProtectionDiscount } from '@/hooks/useCartProtectionDiscount';
import { useCartInsuranceAddons } from '@/hooks/useCartInsurance';
import { useCartCardDiscount } from '@/hooks/useCartCardDiscount';
import { useCartWarrantyBenefits } from '@/hooks/useCartWarrantyBenefits';
import { useCartSubscriptionBenefits } from '@/hooks/useCartSubscriptionBenefits';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X, Wallet, CreditCard, Package, MessageCircle, Hash, FileText, Truck, MapPin, Gift, Sparkles } from 'lucide-react';
import GroupedCartItem from '@/components/GroupedCartItem';
import DirectSaleCheckoutDialog from '@/components/DirectSaleCheckoutDialog';
import OrderSuccessAnimation from '@/components/ui/OrderSuccessAnimation';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import AnimatedQuantity from '@/components/ui/AnimatedQuantity';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { getReferralBannerStyle } from '@/lib/referralBannerStyles';
import { useState, useEffect, useMemo, useRef } from 'react';
import { toast as sonnerToast } from 'sonner';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/lib/i18n';
import { translateShippingOption, getShippingCategory } from '@/lib/shippingLabel';
import { getCartCategories, CART_CATEGORY_LABELS_AR } from '@/lib/cartCategory';
import { buildFriendlyOrderError } from '@/lib/orderErrorMessages';
import { insertOrderItemsWithRollback } from '@/lib/orderItemsInsert';

import WalletDialog from '@/components/WalletDialog';
import CartRequestDialog from '@/components/CartRequestDialog';
import TermsAndConditionsSheet from '@/components/cart/TermsAndConditionsSheet';
import CartUpsellOffers from '@/components/cart/CartUpsellOffers';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { ensurePriceIqd, ensureAdjustmentIqd, getGuardedCartItemPrice, fetchLiveDirectSalePrices, fetchVariantDirectSalePrices } from '@/lib/priceGuard';
import { useCodDefaults } from '@/hooks/useCodDefaults';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Warehouse, UserCheck, ChevronDown } from 'lucide-react';
import { getColorSwatchStyle } from "@/lib/colorSwatch";
import { trackMetaEvent } from "@/lib/metaPixel";
import WavyColors from "@/components/WavyColors";

const Cart = () => {
  const { items, loading, total, updateQuantity, removeFromCart, clearCart, itemCount, pendingCartRequest, deleteCartRequest, refreshCart, cartSaleType } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t, language } = useLanguage();
  const queryClient = useQueryClient();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1540;

  // Global COD defaults — shared hook with realtime sync.
  const { data: codDefaults } = useCodDefaults();

  // Server-computed live direct-sale prices for COD-linked products.
  // Internal cost columns are hidden from clients (column-level RLS), so without
  // this map the cart would fall back to the stale stored `direct_sale_price`
  // and undercharge vs. the product card / detail page.
  const linkedDirectIds = useMemo(
    () =>
      Array.from(
        new Set(
          (items || [])
            .filter((it: any) => it.sale_type === 'direct' && it.products?.link_direct_commission_to_cod && it.products?.id)
            .map((it: any) => it.products!.id as string),
        ),
      ),
    [items],
  );
  const { data: liveDirectPrices } = useQuery({
    queryKey: ['cart-live-direct-prices', linkedDirectIds.join(','), usdToIqd, codDefaults?.value, codDefaults?.type],
    enabled: linkedDirectIds.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchLiveDirectSalePrices(linkedDirectIds),
  });

  const linkedVariantCostRequests = useMemo(() => {
    return (items || []).flatMap((item: any) => {
      const product = item.products;
      if (item.sale_type !== 'direct' || !product?.id || !product.link_direct_commission_to_cod) return [];
      const priceUsd = product.price_usd;
      const colorData = item.selected_color && Array.isArray(product.colors)
        ? (product.colors as any[]).find((c: any) => c.name === item.selected_color || c.name_ar === item.selected_color || c.hex_code === item.selected_color)
        : null;
      const colorCost = colorData
        ? (colorData.direct_sale_price != null
            ? ensurePriceIqd(Number(colorData.direct_sale_price), priceUsd, usdToIqd)
            : colorData.price != null
              ? ensurePriceIqd(Number(colorData.price), priceUsd, usdToIqd)
              : null)
        : null;
      const optionCost = item.product_options?.price_adjustment && Number(item.product_options.price_adjustment) > 0
        ? ensureAdjustmentIqd(Number(item.product_options.price_adjustment), usdToIqd, priceUsd)
        : null;
      const costIqd = colorCost != null && optionCost != null ? colorCost + optionCost : (colorCost ?? optionCost);
      return costIqd ? [{ productId: product.id, costIqd }] : [];
    });
  }, [items, usdToIqd]);

  const { data: liveVariantDirectPrices } = useQuery({
    queryKey: ['cart-variant-live-direct-prices', JSON.stringify(linkedVariantCostRequests), usdToIqd, codDefaults?.value, codDefaults?.type],
    enabled: linkedVariantCostRequests.length > 0,
    staleTime: 30_000,
    queryFn: () => fetchVariantDirectSalePrices(linkedVariantCostRequests),
  });

  // Simple item price getter for protection discount calculation
  const getCartItemPrice = (item: CartItem): number => {
    return getGuardedCartItemPrice(item as any, usdToIqd, codDefaults, liveDirectPrices ?? null, liveVariantDirectPrices ?? null);
  };

  const { cartDiscount: protectionDiscount } = useCartProtectionDiscount(items, getCartItemPrice);
  const { addons: insuranceAddons } = useCartInsuranceAddons();
  const { cardDiscount: rawCardDiscount } = useCartCardDiscount(items, getCartItemPrice, total);
  const { warrantyBenefits } = useCartWarrantyBenefits(items, getCartItemPrice, total);
  // Paid protection-plan subscriptions are an independent system that STACKS with
  // the official warranty (different funding, different consumption ledger).
  const { subscriptionBenefits } = useCartSubscriptionBenefits(items, getCartItemPrice, total);

  // User-controlled selector when both warranty AND subscription are active.
  // 'both' = stack (default). 'warranty' = use only official warranty (freeze subscription).
  // 'subscription' = use only paid plan (freeze warranty).
  const [hardwareBenefitMode, setHardwareBenefitMode] = useState<'both' | 'warranty' | 'subscription'>('both');
  const hasWarrantyContrib = !!(warrantyBenefits && ((warrantyBenefits.totalDiscount || 0) > 0 || warrantyBenefits.freeShipping));
  const hasSubscriptionContrib = !!(subscriptionBenefits && ((subscriptionBenefits.totalDiscount || 0) > 0 || subscriptionBenefits.freeShipping));
  const hasBothActive = hasWarrantyContrib && hasSubscriptionContrib;
  // Auto-reset to 'both' if one source disappears (cart changed, used up, etc.)
  useEffect(() => {
    if (!hasBothActive && hardwareBenefitMode !== 'both') {
      setHardwareBenefitMode('both');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hasBothActive]);

  // Periodic stock re-check while user sits on the cart page.
  // useCart.fetchCart() pulls live RF stock and auto-caps quantities, so a
  // lightweight 30s refresh keeps the cart aligned with inventory without a
  // manual reload. Pauses when the tab is hidden and resumes on visibility.
  useEffect(() => {
    if (!user?.id) return;
    let intervalId: ReturnType<typeof setInterval> | null = null;
    const start = () => {
      if (intervalId) return;
      intervalId = setInterval(() => {
        if (typeof document !== 'undefined' && document.hidden) return;
        try { refreshCart?.(); } catch {}
      }, 30000);
    };
    const stop = () => {
      if (intervalId) { clearInterval(intervalId); intervalId = null; }
    };
    const onVisibility = () => {
      if (document.hidden) { stop(); }
      else { try { refreshCart?.(); } catch {} ; start(); }
    };
    start();
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      stop();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [user?.id, refreshCart]);
  const useWarrantyContrib = hardwareBenefitMode !== 'subscription';
  const useSubscriptionContrib = hardwareBenefitMode !== 'warranty';

  // Loyalty card vs combined hardware benefits (warranty + subscription) — pick best (no stacking with card).
  // Use only the SELECTED sources for this comparison.
  const combinedHardwareDiscount = (useWarrantyContrib ? (warrantyBenefits?.totalDiscount || 0) : 0)
    + (useSubscriptionContrib ? (subscriptionBenefits?.totalDiscount || 0) : 0);
  const useHardwareOverCard = combinedHardwareDiscount > (rawCardDiscount?.totalDiscount || 0);
  const cardDiscount = useHardwareOverCard ? null : rawCardDiscount;
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [appliedReferral, setAppliedReferral] = useState<{ coupon_id: string; owner_username: string; owner_user_id: string; free_delivery_min_order_iqd?: number; custom_message?: string | null; banner_style?: string | null } | null>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [preOrderPaymentOption, setPreOrderPaymentOption] = useState<'full' | 'half' | 'cod'>('full');
  const [extraDonation, setExtraDonation] = useState<number>(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [showCartRequestDialog, setShowCartRequestDialog] = useState(false);
  const [showCartChangeWarning, setShowCartChangeWarning] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [showDirectSaleDialog, setShowDirectSaleDialog] = useState(false);
  
  const [isDirectSaleProcessing, setIsDirectSaleProcessing] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string>('');
  const [successOrderId, setSuccessOrderId] = useState<string | undefined>(undefined);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set());
  const [showAddressSwitcher, setShowAddressSwitcher] = useState(false);
  const [selectedDeliveryMethod, setSelectedDeliveryMethod] = useState<string>('standard');
  const [deliveryOptionsOpen, setDeliveryOptionsOpen] = useState(false);
  // Refresh cart data on mount to get latest pendingCartRequest
  useEffect(() => {
    refreshCart();
  }, []);

  // Check cart sale type
  const isDirectSaleCart = cartSaleType === 'direct';

  // التحقق من وجود منتجات طلب مسبق
  const hasPreOrderItems = !isDirectSaleCart && items.some((item: any) => 
    item.shipping_option_name_ar || 
    (item as any).shipping_option_index !== null
  );

  // الفلمنت العشوائي يجب أن يُدفع من المحفظة فقط (سواء حجز مسبق أو بيع مباشر)
  const hasRandomFilamentItems = items.some((item: any) => item.is_random_filament);

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('governorate')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // جلب طرق التوصيل
  const { data: deliveryMethods = [] } = useQuery({
    queryKey: ['delivery-methods'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_methods').select('id, method_key, name_ar, name_en, name_ku, description_ar, description_en, description_ku, base_price, is_active, display_order, icon, base_price_category_id, base_price_units_per_delivery, free_delivery_enabled, free_delivery_min_order, created_at, updated_at').eq('is_active', true).order('display_order');
      if (error) throw error;
      return data;
    },
  });

  // جلب استثناءات المحافظات للطريقة المختارة
  const { data: govExceptions = [] } = useQuery({
    queryKey: ['delivery-gov-exceptions-cart', selectedDeliveryMethod],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_governorate_exceptions').select('*').eq('delivery_method_key', selectedDeliveryMethod);
      if (error) throw error;
      return data;
    },
  });

  // جلب استثناءات الأقسام للطريقة المختارة
  const { data: catExceptions = [] } = useQuery({
    queryKey: ['delivery-cat-exceptions-cart', selectedDeliveryMethod],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_category_exceptions').select('*').eq('delivery_method_key', selectedDeliveryMethod);
      if (error) throw error;
      return data;
    },
  });

  // جلب جميع استثناءات المحافظات لعرض السعر التقريبي لكل طريقة
  const { data: allGovExceptions = [] } = useQuery({
    queryKey: ['delivery-all-gov-exceptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_governorate_exceptions').select('*');
      if (error) throw error;
      return data;
    },
  });

  // جلب جميع استثناءات الأقسام (لعرض السعر التقريبي لكل طريقة)
  const { data: allCatExceptions = [] } = useQuery({
    queryKey: ['delivery-all-cat-exceptions'],
    queryFn: async () => {
      const { data, error } = await supabase.from('delivery_category_exceptions').select('*');
      if (error) throw error;
      return data;
    },
  });

  // فلترة طرق التوصيل: إخفاء الطرق المخصصة لقسم معين إذا لم يكن في السلة منتج من ذلك القسم
  const visibleDeliveryMethods = useMemo(() => {
    const cartCategoryIds = new Set<string>();
    items.forEach(item => {
      const catId = item.products?.category_id;
      if (catId) cartCategoryIds.add(catId);
    });

    return deliveryMethods.filter((method: any) => {
      // If method has base_price_category_id, only show if cart has items from that category
      if (method.base_price_category_id) {
        return cartCategoryIds.has(method.base_price_category_id);
      }
      return true;
    });
  }, [deliveryMethods, items]);

  // Auto-reset selected method if it becomes unavailable
  useMemo(() => {
    if (visibleDeliveryMethods.length > 0 && !visibleDeliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod)) {
      setSelectedDeliveryMethod(visibleDeliveryMethods[0].method_key);
    }
  }, [visibleDeliveryMethods, selectedDeliveryMethod]);

  // حساب سعر تقريبي لطريقة توصيل معينة (للعرض فقط) - يطابق منطق getDeliveryFee
  const getMethodPreviewPrice = (methodKey: string) => {
    if (methodKey === 'pickup') return 0;
    if (isDirectSaleCart && hasExistingDirectOrderToday) return 0;
    const method = deliveryMethods.find((m: any) => m.method_key === methodKey);
    if (!method) return 0;
    const basePrice = Number(method.base_price) || 0;
    const basePriceCatId = method?.base_price_category_id || null;
    const basePriceUnits = method?.base_price_units_per_delivery || 1;
    const gov = selectedAddress?.governorate || profile?.governorate || null;

    // التوصيل المجاني
    if (method.free_delivery_enabled) {
      const minOrder = Number(method.free_delivery_min_order) || 0;
      if (minOrder === 0 || total >= minOrder) return 0;
    }

    // تجميع الكميات حسب القسم
    const categoryQty: Record<string, number> = {};
    items.forEach(item => {
      const catId = item.products?.category_id;
      if (catId) categoryQty[catId] = (categoryQty[catId] || 0) + (item.quantity || 1);
    });

    // استثناءات الأقسام لهذه الطريقة
    const methodCatExc = (allCatExceptions as any[]).filter((e: any) => e.delivery_method_key === methodKey);
    let totalFee = 0;
    const handled = new Set<string>();

    // دمج كل استثناءات __follow_gov__ في حاوية واحدة مشتركة لتجنب التكرار
    const followGovExcs = methodCatExc.filter((e: any) => e.governorate === '__follow_gov__' && categoryQty[e.category_id]);
    if (followGovExcs.length > 0) {
      let combinedQty = 0;
      let maxUnits = 1;
      for (const exc of followGovExcs) {
        combinedQty += categoryQty[exc.category_id];
        maxUnits = Math.max(maxUnits, exc.units_per_delivery || 1);
        handled.add(exc.category_id);
      }
      const matchingGov = (allGovExceptions as any[]).find((g: any) => g.delivery_method_key === methodKey && g.governorate === gov);
      const govPrice = matchingGov ? Number(matchingGov.delivery_price) : basePrice;
      const deliveryCount = Math.ceil(combinedQty / maxUnits);
      totalFee += govPrice * deliveryCount;
    }

    for (const exc of methodCatExc) {
      const catId = exc.category_id;
      if (handled.has(catId) || !categoryQty[catId]) continue;
      if (exc.governorate === '__follow_gov__') continue; // already merged above

      const matchesGov = !exc.governorate || exc.governorate === gov;
      if (!matchesGov) continue;

      handled.add(catId);
      const qty = categoryQty[catId];
      const unitsPerDelivery = exc.units_per_delivery || 1;
      const deliveryCount = Math.ceil(qty / unitsPerDelivery);
      totalFee += Number(exc.delivery_price) * deliveryCount;
    }

    // base_price مرتبط بقسم محدد
    if (basePriceCatId) {
      if (!handled.has(basePriceCatId) && categoryQty[basePriceCatId]) {
        handled.add(basePriceCatId);
        const qty = categoryQty[basePriceCatId];
        const deliveryCount = Math.ceil(qty / basePriceUnits);
        totalFee += basePrice * deliveryCount;
      }
      const uncoveredCats = Object.keys(categoryQty).filter(c => !handled.has(c));
      const hasNoCategoryItems = items.some(i => !i.products?.category_id);
      if (uncoveredCats.length > 0 || hasNoCategoryItems) {
        const standardMethod = deliveryMethods.find((m: any) => m.method_key === 'standard' && !m.base_price_category_id);
        const standardBasePrice = standardMethod ? Number(standardMethod.base_price) : 0;
        const standardGovExc = (allGovExceptions as any[]).find((e: any) => e.delivery_method_key === 'standard' && e.governorate === gov);
        const standardGovPrice = standardGovExc ? Number(standardGovExc.delivery_price) : standardBasePrice;
        const stdCatExc = (allCatExceptions as any[]).filter((e: any) => e.delivery_method_key === 'standard');

        let addedFlatFallback = false;
        for (const catId of uncoveredCats) {
          const qty = categoryQty[catId];
          const exc =
            stdCatExc.find((e: any) => e.category_id === catId && e.governorate === gov) ||
            stdCatExc.find((e: any) => e.category_id === catId && e.governorate === '__follow_gov__') ||
            stdCatExc.find((e: any) => e.category_id === catId && !e.governorate);
          if (exc) {
            const unitsPerDelivery = exc.units_per_delivery || 1;
            const deliveryCount = Math.ceil(qty / unitsPerDelivery);
            const price = exc.governorate === '__follow_gov__' ? standardGovPrice : Number(exc.delivery_price);
            totalFee += price * deliveryCount;
          } else if (!addedFlatFallback) {
            totalFee += standardGovPrice;
            addedFlatFallback = true;
          }
        }
        if (uncoveredCats.length === 0 && hasNoCategoryItems) {
          totalFee += standardGovPrice;
        }
      }
      return totalFee;
    }

    // عناصر غير مغطاة
    const hasUncovered = Object.keys(categoryQty).some(c => !handled.has(c)) || items.some(i => !i.products?.category_id);
    if (handled.size > 0) {
      if (hasUncovered) {
        const govExc = (allGovExceptions as any[]).find((e: any) => e.delivery_method_key === methodKey && e.governorate === gov);
        totalFee += govExc ? Number(govExc.delivery_price) : basePrice;
      }
      return totalFee;
    }

    // لا استثناءات قسم → استخدم استثناء المحافظة أو السعر الأساسي
    const govExc = (allGovExceptions as any[]).find((e: any) => e.delivery_method_key === methodKey && e.governorate === gov);
    return govExc ? Number(govExc.delivery_price) : basePrice;
  };


  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });

  // Fetch max quantities for bundle items in cart
  const bundleIds = items.filter(i => i.bundle_id).map(i => i.bundle_id!);
  const { data: bundleMaxQtyMap } = useQuery({
    queryKey: ['bundle-max-qty', bundleIds.join(',')],
    queryFn: async () => {
      if (bundleIds.length === 0) return {} as Record<string, number>;
      const { data: bundleItems } = await supabase
        .from('bundle_items')
        .select('bundle_id, quantity, selected_color, selected_option_id, products:product_id(colors, direct_stock)')
        .in('bundle_id', bundleIds);
      if (!bundleItems) return {} as Record<string, number>;

      const map: Record<string, number> = {};
      for (const bid of bundleIds) {
        const bItems = bundleItems.filter((bi: any) => bi.bundle_id === bid);
        let maxQty = Infinity;
        for (const bi of bItems) {
          const product = (bi as any).products;
          const colors = Array.isArray(product?.colors) ? product.colors : [];
          let stock = 0;
          if (colors.length === 0) {
            stock = product?.direct_stock != null ? Number(product.direct_stock) : 0;
          } else {
            const colorName = (bi as any).selected_color;
            const optId = (bi as any).selected_option_id;
            const color = colorName ? colors.find((c: any) => (c.color || c.name) === colorName) : null;
            if (color) {
              const stocks = color.option_stocks;
              if (stocks && typeof stocks === 'object') {
                if (optId && stocks[optId] != null) stock = Math.max(0, Number(stocks[optId]));
                else stock = Object.values(stocks).reduce<number>((s: number, v: any) => s + Math.max(0, Number(v)), 0);
              } else if (color.stock_quantity != null) {
                stock = Math.max(0, Number(color.stock_quantity));
              }
            }
          }
          const perBundle = (bi as any).quantity || 1;
          maxQty = Math.min(maxQty, Math.floor(stock / perBundle));
        }
        map[bid] = maxQty === Infinity ? 0 : maxQty;
      }
      return map;
    },
    enabled: bundleIds.length > 0,
    staleTime: 30_000,
  });

  // ── Stock validation for direct sale items ──
  const directProductIds = [...new Set(items.filter(i => i.sale_type === 'direct' && i.product_id).map(i => i.product_id!))];
  const { data: stockDataMap } = useQuery({
    queryKey: ['cart-stock-check', directProductIds.join(',')],
    queryFn: async () => {
      if (directProductIds.length === 0) return {} as Record<string, any>;
      const { data } = await supabase
        .from('products')
        .select('id, direct_stock, colors')
        .in('id', directProductIds);
      if (!data) return {};
      return data.reduce((acc: Record<string, any>, p: any) => { acc[p.id] = p; return acc; }, {} as Record<string, any>);
    },
    enabled: directProductIds.length > 0,
    staleTime: 10_000,
    refetchOnMount: 'always',
  });

  const getItemAvailableStock = (item: CartItem): number | null => {
    if (item.sale_type !== 'direct' || !item.product_id) return null;
    const product = stockDataMap?.[item.product_id];
    if (!product) return null;
    const colors = Array.isArray(product.colors) ? product.colors : [];
    const selectedColor = (item as any).selected_color;
    const optionId = (item as any).product_option_id;

    if (colors.length === 0) {
      return product.direct_stock != null ? Math.max(0, Number(product.direct_stock)) : 0;
    }

    if (selectedColor) {
      const color = colors.find((c: any) => c.name === selectedColor || c.name_ar === selectedColor || c.hex_code === selectedColor);
      if (!color) return 0;
      if (color.available_for_direct_sale === false) return 0;
      const stocks = color.option_stocks;
      if (stocks && typeof stocks === 'object' && Object.keys(stocks).length > 0) {
        if (optionId && stocks[optionId] != null) return Math.max(0, Number(stocks[optionId]));
        return Object.values(stocks).reduce<number>((s, v: any) => s + Math.max(0, Number(v)), 0);
      }
      if (color.stock_quantity != null) return Math.max(0, Number(color.stock_quantity));
      return 0;
    }

    // No color selected — sum all direct-sale-eligible colors
    let total = 0;
    for (const c of colors) {
      if (c.available_for_direct_sale === false) continue;
      const stocks = c.option_stocks;
      if (stocks && typeof stocks === 'object') {
        total += Object.values(stocks).reduce<number>((s, v: any) => s + Math.max(0, Number(v)), 0);
      } else if (c.stock_quantity != null) {
        total += Math.max(0, Number(c.stock_quantity));
      }
    }
    return total;
  };

  const outOfStockItemIds = new Set<string>();
  const lowStockItems = new Map<string, number>(); // itemId → available
  items.forEach(item => {
    const available = getItemAvailableStock(item);
    if (available === null) return;
    if (available <= 0) outOfStockItemIds.add(item.id);
    else if (available < item.quantity) lowStockItems.set(item.id, available);
  });
  const hasOutOfStockItems = outOfStockItemIds.size > 0;

  const removeOutOfStockItems = async () => {
    for (const id of outOfStockItemIds) {
      await removeFromCart(id);
    }
  };

  // Server-side purge: deletes OOS direct-sale items from cart_items table directly,
  // ensuring DB-level consistency regardless of which page the user is on.
  const oosNotifiedRef = useRef<Set<string>>(new Set());
  const purgeOosFromServer = async () => {
    try {
      const { data, error } = await (supabase as any).rpc('purge_oos_direct_cart_items');
      if (error) return;
      const removed: Array<{ id: string; product_name: string }> =
        (data?.removed as any[]) || [];
      for (const r of removed) {
        if (oosNotifiedRef.current.has(r.id)) continue;
        oosNotifiedRef.current.add(r.id);
        const name = r.product_name || t('cart_out_of_stock');
        sonnerToast.error(`${name} — ${t('cart_out_of_stock_warning')}`, {
          description: t('cart_out_of_stock'),
        });
      }
    } catch {}
  };

  // Trigger server-side purge whenever the local check detects OOS items,
  // and once on mount as a safety net for items that became OOS while away.
  useEffect(() => {
    purgeOosFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (outOfStockItemIds.size === 0) return;
    purgeOosFromServer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outOfStockItemIds.size]);

  // Drop stale entries from the notified set so re-added items can re-trigger.
  useEffect(() => {
    const live = new Set(items.map((i) => i.id));
    oosNotifiedRef.current.forEach((id) => {
      if (!live.has(id)) oosNotifiedRef.current.delete(id);
    });
  }, [items]);


  const { data: userAddresses } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Check if user has active direct sale orders
  const { data: activeDirectOrders } = useQuery({
    queryKey: ['active-direct-orders', user?.id],
    queryFn: async (): Promise<{id: string}[]> => {
      if (!user?.id) return [];
      const result = await (supabase as any)
        .from('orders')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('sale_type', 'direct');
      const filtered = (result.data || []).filter((o: any) => 
        ['pending', 'confirmed', 'processing'].includes(o.status)
      );
      return filtered.slice(0, 1) as {id: string}[];
    },
    enabled: !!user?.id && isDirectSaleCart,
  });

  // Set default selected address
  useEffect(() => {
    if (userAddresses && userAddresses.length > 0 && !selectedAddressId) {
      const def = userAddresses.find((a: any) => a.is_default) || userAddresses[0];
      setSelectedAddressId(def.id);
    }
  }, [userAddresses, selectedAddressId]);

  const selectedAddress = userAddresses?.find((a: any) => a.id === selectedAddressId) || null;
  const defaultUserAddress = selectedAddress;

  // جلب إعدادات الدفع الجزئي
  interface FeeTier {
    min_amount: number;
    max_amount: number;
    fee_percentage: number;
    cod_fee_type?: 'percentage' | 'fixed';
    cod_fee_value?: number;
  }
  
  interface PartialPaymentSettingsData {
    fee_label_ar: string;
    fee_label_en: string;
    fee_tiers?: FeeTier[];
    quarter_payment_fee_percentage?: number; // للتوافق مع الإعدادات القديمة
    cod_label_ar?: string;
    cod_default_fee_type?: 'percentage' | 'fixed';
    cod_default_fee_value?: number;
    cod_enabled?: boolean;
    half_payment_enabled?: boolean;
  }
  
  const { data: partialPaymentSettings } = useQuery({
    queryKey: ['partial-payment-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'partial_payment_settings')
        .single();
      return data?.setting_value as unknown as PartialPaymentSettingsData | null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // الضريبة مدمجة مع سعر المنتج - لا تُعرض بشكل منفصل

  const PRINTER_SECTION_ID = '0a7d1d66-1ddb-4398-8e4a-c6ca8deac5b6';
  const hasPrinterItems = items.some(item => item.products?.categories?.main_section_id === PRINTER_SECTION_ID);

  // Check if user has existing direct sale orders in the current "business day" (resets at 5PM)
  // Also requires same address for free delivery
  const { data: todayDirectOrders } = useQuery({
    queryKey: ['today-direct-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const now = new Date();
      const hour = now.getHours();
      
      // Business day starts at 5PM previous day and ends at 5PM today
      // If before 5PM: window = yesterday 5PM → today 5PM
      // If after 5PM: window = today 5PM → tomorrow 5PM (no previous orders yet, so empty)
      const windowStart = new Date(now);
      if (hour < 17) {
        // Before 5PM - look for orders since yesterday 5PM
        windowStart.setDate(windowStart.getDate() - 1);
        windowStart.setHours(17, 0, 0, 0);
      } else {
        // After 5PM - look for orders since today 5PM (current window just started)
        windowStart.setHours(17, 0, 0, 0);
      }
      
      const { data } = await supabase
        .from('orders')
        .select('id, shipping_address')
        .eq('user_id', user.id)
        .eq('order_type', 'direct')
        .neq('status', 'cancelled')
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.id && isDirectSaleCart,
  });

  // Free delivery only if there's a previous order with the SAME address
  const hasExistingDirectOrderToday = (() => {
    if (!todayDirectOrders || todayDirectOrders.length === 0) return false;
    if (!selectedAddressId && !selectedAddress) return false;
    // Check if any previous order was shipped to same address (compare the full stored shipping_address)
    return todayDirectOrders.some((o: any) => {
      if (!selectedAddress || !o.shipping_address) return false;
      // Reconstruct the same shipping address text format used during checkout
      const currentAddrText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;
      return o.shipping_address === currentAddrText;
    });
  })();

  const getDeliveryFee = (governorate: string | null) => {
    // Pickup = always free
    if (selectedDeliveryMethod === 'pickup') {
      const pickupMethod = deliveryMethods.find((m: any) => m.method_key === 'pickup');
      if (pickupMethod?.free_delivery_enabled) return 0;
      return 0;
    }
    // For 2nd+ direct sale orders before 5PM:
    // The previous order already paid one "base delivery slot" per category,
    // so we waive only the FIRST delivery unit per category — but extras
    // (e.g. printer surcharge, filament beyond units_per_delivery) STILL apply.
    const freeFirstDeliverySlot = isDirectSaleCart && hasExistingDirectOrderToday;

    // Get base price from selected method
    const method = deliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod);
    const basePrice = method ? Number(method.base_price) : 5000;
    const basePriceCatId = method?.base_price_category_id || null;
    const basePriceUnits = method?.base_price_units_per_delivery || 1;

    // Check free delivery eligibility
    if (method?.free_delivery_enabled) {
      const minOrder = method.free_delivery_min_order || 0;
      if (minOrder === 0 || total >= minOrder) {
        return 0;
      }
    }

    // Group items by category_id and sum quantities
    const categoryQty: Record<string, number> = {};
    items.forEach(item => {
      const catId = item.products?.category_id;
      if (catId) {
        categoryQty[catId] = (categoryQty[catId] || 0) + (item.quantity || 1);
      }
    });

    // Calculate category-based delivery fees
    let totalCatFee = 0;
    const handledCategories = new Set<string>();

    // Merge all __follow_gov__ exceptions into one shared bucket so that 2 different
    // categories that both "follow gov" don't get charged the governorate fee twice —
    // they share the same delivery slot. Extras beyond units_per_delivery still apply.
    const followGovExcs = (catExceptions as any[]).filter(
      (e: any) => e.governorate === '__follow_gov__' && categoryQty[e.category_id],
    );
    if (followGovExcs.length > 0) {
      let combinedQty = 0;
      let maxUnits = 1;
      for (const exc of followGovExcs) {
        combinedQty += categoryQty[exc.category_id];
        maxUnits = Math.max(maxUnits, exc.units_per_delivery || 1);
        handledCategories.add(exc.category_id);
      }
      const matchingGov = govExceptions.find((g: any) => g.governorate === governorate);
      const govPrice = matchingGov ? Number(matchingGov.delivery_price) : basePrice;
      const deliveryCount = Math.ceil(combinedQty / maxUnits);
      totalCatFee += govPrice * deliveryCount;
    }

    for (const exc of catExceptions as any[]) {
      const catId = exc.category_id;
      if (handledCategories.has(catId)) continue;
      if (!categoryQty[catId]) continue;
      if (exc.governorate === '__follow_gov__') continue; // already merged above

      const matchesGov = !exc.governorate || exc.governorate === governorate;
      if (!matchesGov) continue;

      handledCategories.add(catId);
      const qty = categoryQty[catId];
      const unitsPerDelivery = exc.units_per_delivery || 1;
      const deliveryCount = Math.ceil(qty / unitsPerDelivery);
      totalCatFee += Number(exc.delivery_price) * deliveryCount;
    }

    // Handle base price: if linked to a specific category, apply only to that category
    if (basePriceCatId) {
      // Base price applies only to the linked category (if not already handled by exceptions)
      if (!handledCategories.has(basePriceCatId) && categoryQty[basePriceCatId]) {
        handledCategories.add(basePriceCatId);
        const qty = categoryQty[basePriceCatId];
        const deliveryCount = Math.ceil(qty / basePriceUnits);
        totalCatFee += basePrice * deliveryCount;
      }

      // Uncovered items: apply standard-method category exceptions per category (honors units_per_delivery)
      const uncoveredCats = Object.keys(categoryQty).filter(catId => !handledCategories.has(catId));
      const hasNoCategoryItems = items.some(item => !item.products?.category_id);

      if (uncoveredCats.length > 0 || hasNoCategoryItems) {
        const standardMethod = deliveryMethods.find((m: any) => m.method_key === 'standard' && !m.base_price_category_id);
        const standardBasePrice = standardMethod ? Number(standardMethod.base_price) : 0;
        const standardGovExc = allGovExceptions.find((e: any) => e.delivery_method_key === 'standard' && e.governorate === governorate);
        const standardGovPrice = standardGovExc ? Number(standardGovExc.delivery_price) : standardBasePrice;
        const stdCatExc = (allCatExceptions as any[]).filter((e: any) => e.delivery_method_key === 'standard');

        let addedFlatFallback = false;
        for (const catId of uncoveredCats) {
          const qty = categoryQty[catId];
          const exc =
            stdCatExc.find((e: any) => e.category_id === catId && e.governorate === governorate) ||
            stdCatExc.find((e: any) => e.category_id === catId && e.governorate === '__follow_gov__') ||
            stdCatExc.find((e: any) => e.category_id === catId && !e.governorate);
          if (exc) {
            const unitsPerDelivery = exc.units_per_delivery || 1;
            const deliveryCount = Math.ceil(qty / unitsPerDelivery);
            const price = exc.governorate === '__follow_gov__' ? standardGovPrice : Number(exc.delivery_price);
            totalCatFee += price * deliveryCount;
          } else if (!addedFlatFallback) {
            totalCatFee += standardGovPrice;
            addedFlatFallback = true;
          }
        }
        if (uncoveredCats.length === 0 && hasNoCategoryItems) {
          totalCatFee += standardGovPrice;
        }
      }
      const finalCatFee = totalCatFee;
      // Waive one base delivery slot if a prior direct-sale order today already paid for it
      if (freeFirstDeliverySlot) {
        const matchingGovExc = govExceptions.find((exc: any) => exc.governorate === governorate);
        const oneSlot = matchingGovExc ? Number(matchingGovExc.delivery_price) : basePrice;
        return Math.max(0, finalCatFee - oneSlot);
      }
      return finalCatFee;
    }

    // Check if there are items NOT covered by category exceptions
    const hasUncoveredItems = Object.keys(categoryQty).some(catId => !handledCategories.has(catId));
    // Also count items with no category
    const hasNoCategoryItems = items.some(item => !item.products?.category_id);

    const matchingGovExc = govExceptions.find((exc: any) => exc.governorate === governorate);
    const govPrice = matchingGovExc ? Number(matchingGovExc.delivery_price) : basePrice;

    let finalFee: number;
    if (handledCategories.size > 0) {
      finalFee = (hasUncoveredItems || hasNoCategoryItems) ? totalCatFee + govPrice : totalCatFee;
    } else {
      finalFee = govPrice;
    }

    // Waive one base slot for 2nd+ direct-sale order today (extras like printer/filament>10 still apply)
    if (freeFirstDeliverySlot) {
      finalFee = Math.max(0, finalFee - govPrice);
    }
    return finalFee;
  };

  // Check if free delivery is active for selected method
  const isFreeDeliveryApplied = useMemo(() => {
    const method = deliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod);
    if (!method?.free_delivery_enabled) return false;
    const minOrder = method.free_delivery_min_order || 0;
    return minOrder === 0 || total >= minOrder;
  }, [deliveryMethods, selectedDeliveryMethod, total]);

  // How much more needed for free delivery
  const freeDeliveryRemaining = useMemo(() => {
    const method = deliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod);
    if (!method?.free_delivery_enabled) return 0;
    const minOrder = method.free_delivery_min_order || 0;
    if (minOrder === 0 || total >= minOrder) return 0;
    return minOrder - total;
  }, [deliveryMethods, selectedDeliveryMethod, total]);

  // Use selected address governorate first, fallback to profile governorate
  const rawDeliveryFee = getDeliveryFee(selectedAddress?.governorate || profile?.governorate || null);
  
  // Apply card free shipping if eligible
  // Apply card free shipping if eligible: must include selected method + have remaining uses + cart contains an item from whitelist (if any)
  const cardShipCats = cardDiscount?.freeShippingApplicableCategoryIds || [];
  const cartHasCardShipCategory = cardShipCats.length === 0
    || (items.filter((it:any)=>!it?.is_gift).length > 0 && items.filter((it:any)=>!it?.is_gift).every((it: any) => it?.products?.category_id && cardShipCats.includes(it.products.category_id)));
  const cardFreeShippingEligibleMethod = !!cardDiscount?.freeShipping
    && (cardDiscount?.freeShippingMethods?.length ? cardDiscount.freeShippingMethods.includes(selectedDeliveryMethod) : true);
  const cardFreeShippingHasUses = cardDiscount?.freeShippingRemainingUses == null
    || (cardDiscount?.freeShippingRemainingUses ?? 0) > 0;
  const cardFreeShippingApplied = cardFreeShippingEligibleMethod
    && cardFreeShippingHasUses
    && cartHasCardShipCategory
    && total >= (cardDiscount?.freeShippingMinOrder || 0);

  // Warranty free shipping (official, free system) — only if not already getting card free shipping
  const warrantyShipCats = warrantyBenefits?.freeShippingApplicableCategoryIds || [];
  const cartHasWarrantyShipCategory = warrantyShipCats.length === 0
    || (items.filter((it:any)=>!it?.is_gift).length > 0 && items.filter((it:any)=>!it?.is_gift).every((it: any) => it?.products?.category_id && warrantyShipCats.includes(it.products.category_id)));
  const warrantyFreeShippingEligibleMethod = !!warrantyBenefits?.freeShipping
    && (warrantyBenefits?.freeShippingMethods?.length ? warrantyBenefits.freeShippingMethods.includes(selectedDeliveryMethod) : true);
  const warrantyFreeShippingHasUses = (warrantyBenefits?.freeShippingRemainingUses ?? 0) > 0;
  // Frozen by user selector
  const warrantyFreeShippingAllowed = useWarrantyContrib;
  const warrantyFreeShippingEligible = !cardFreeShippingApplied
    && warrantyFreeShippingEligibleMethod
    && warrantyFreeShippingHasUses
    && cartHasWarrantyShipCategory
    && total >= (warrantyBenefits?.freeShippingMinOrder || 0);

  // Subscription (paid protection plan) free shipping — independent ledger; falls back if warranty has no uses
  const subShipCats = subscriptionBenefits?.freeShippingApplicableCategoryIds || [];
  const cartHasSubShipCategory = subShipCats.length === 0
    || (items.filter((it:any)=>!it?.is_gift).length > 0 && items.filter((it:any)=>!it?.is_gift).every((it: any) => it?.products?.category_id && subShipCats.includes(it.products.category_id)));
  const subFreeShippingEligibleMethod = !!subscriptionBenefits?.freeShipping
    && (subscriptionBenefits?.freeShippingMethods?.length ? subscriptionBenefits.freeShippingMethods.includes(selectedDeliveryMethod) : true);
  const subFreeShippingHasUses = (subscriptionBenefits?.freeShippingRemainingUses ?? 0) > 0;
  const subFreeShippingEligible = !cardFreeShippingApplied
    && subFreeShippingEligibleMethod
    && subFreeShippingHasUses
    && cartHasSubShipCategory
    && total >= (subscriptionBenefits?.freeShippingMinOrder || 0);

  // Prefer warranty (free to user); fall back to subscription if warranty cannot cover.
  // User selector can freeze either source.
  const warrantyFreeShippingApplied = useWarrantyContrib && warrantyFreeShippingEligible;
  const subscriptionFreeShippingApplied = useSubscriptionContrib && !warrantyFreeShippingApplied && subFreeShippingEligible;
  const hardwareFreeShippingApplied = warrantyFreeShippingApplied || subscriptionFreeShippingApplied;

  // ── Card perks scope notices: tell user which items block free shipping / discount ─────
  const allWhitelistCatIds = useMemo(() => {
    const ids = new Set<string>();
    [
      ...(cardDiscount?.discountApplicableCategoryIds || []),
      ...(cardShipCats || []),
    ].forEach((id) => id && ids.add(id));
    return Array.from(ids);
  }, [cardDiscount?.discountApplicableCategoryIds, cardShipCats]);

  const { data: whitelistCatNames = {} } = useQuery({
    queryKey: ['cart-whitelist-cat-names', allWhitelistCatIds.join(',')],
    queryFn: async () => {
      if (!allWhitelistCatIds.length) return {};
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_ar')
        .in('id', allWhitelistCatIds);
      if (error) throw error;
      return Object.fromEntries((data || []).map((c: any) => [c.id, c.name_ar]));
    },
    enabled: allWhitelistCatIds.length > 0,
    staleTime: 5 * 60 * 1000,
  });

  const nonGiftItems = items.filter((it: any) => !it?.is_gift);

  const buildScopeNotice = (whitelist: string[]) => {
    if (!whitelist.length || nonGiftItems.length === 0) return null;
    const allowedSet = new Set(whitelist);
    const blocking = nonGiftItems.filter((it: any) => {
      const cid = it?.products?.category_id;
      return !cid || !allowedSet.has(cid);
    });
    const allowedNames = whitelist
      .map((id) => (whitelistCatNames as any)[id])
      .filter(Boolean)
      .join('، ');
    const blockingNames = blocking
      .map((it: any) => it?.products?.name_ar || it?.products?.name)
      .filter(Boolean)
      .slice(0, 3)
      .join('، ') + (blocking.length > 3 ? ` +${blocking.length - 3}` : '');
    return { eligible: blocking.length === 0, allowedNames, blockingNames };
  };

  const cardDiscountScope = cardDiscount?.discountApplicableCategoryIds?.length
    ? buildScopeNotice(cardDiscount.discountApplicableCategoryIds)
    : null;
  const cardShippingScope = (cardDiscount?.freeShipping && cardShipCats.length)
    ? buildScopeNotice(cardShipCats)
    : null;

  // Referral coupon: free delivery is conditional on subtotal >= admin-defined min
  const referralMinOrder = (appliedReferral as any)?.free_delivery_min_order_iqd ?? 100000;
  const referralFreeShippingApplied = !!appliedReferral && total >= referralMinOrder;
  const referralRemainingForFreeDelivery = appliedReferral
    ? Math.max(0, referralMinOrder - total)
    : 0;
  const deliveryFee = (cardFreeShippingApplied || hardwareFreeShippingApplied || referralFreeShippingApplied) ? 0 : rawDeliveryFee;

  
  // Referral commission per unit — added to the buyer's final price (paid to VIP+ owner)
  const referralOwnerEarnings = appliedReferral
    ? items.reduce((sum: number, it: any) => sum + (Number(it.products?.referral_earnings_iqd || 0) * (it.quantity || 0)), 0)
    : 0;
  
  // Calculate discount
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    if (appliedCoupon.discount_type === 'percentage') {
      return (total * appliedCoupon.discount_value) / 100;
    }
    return appliedCoupon.discount_value;
  };
  
  const discount = calculateDiscount();
  
  // إذا قام الأدمن بتعديل سعر السلة (cart_requests.adjusted_total) نعتمد السعر المعدّل
  // كأساس لجميع الحسابات اللاحقة (الكوبون، الخصومات، الدفع الجزئي، الإجمالي).
  const hasAdjustedTotal =
    !!pendingCartRequest &&
    pendingCartRequest.status === 'adjusted' &&
    pendingCartRequest.adjusted_total != null &&
    Number(pendingCartRequest.adjusted_total) > 0;
  // Extra insurance addons total (per cart item × quantity)
  const itemQtyMap = new Map<string, number>(items.map((it: any) => [it.id, it.quantity || 0]));
  const insuranceTotal = (insuranceAddons || []).reduce((sum: number, a: any) => {
    const qty = itemQtyMap.get(a.cart_item_id) ?? 0;
    return qty > 0 ? sum + Number(a.price_iqd) * qty : sum;
  }, 0);
  const effectiveSubtotal = (hasAdjustedTotal
    ? Number(pendingCartRequest!.adjusted_total)
    : total) + insuranceTotal;

  // حساب المبلغ الفرعي بناءً على خيار الدفع للطلب المسبق
  const protectionDiscountAmount = (protectionDiscount?.canUse && protectionDiscount?.totalDiscount) ? protectionDiscount.totalDiscount : 0;
  const cardDiscountAmount = cardDiscount?.totalDiscount || 0;
  // Independent ledgers — both stack in the cart total.
  const warrantyDiscountAmount = (useHardwareOverCard && useWarrantyContrib) ? (warrantyBenefits?.totalDiscount || 0) : 0;
  const subscriptionDiscountAmount = (useHardwareOverCard && useSubscriptionContrib) ? (subscriptionBenefits?.totalDiscount || 0) : 0;
  const subtotalAfterDiscount = effectiveSubtotal - discount - protectionDiscountAmount - cardDiscountAmount - warrantyDiscountAmount - subscriptionDiscountAmount + referralOwnerEarnings;
  
  // الضريبة ملغاة نهائياً
  const TEMP_TAX_RATE = 0;
  const taxAmount = 0;
  const subtotalWithTax = subtotalAfterDiscount;

  // التبرعات: 1% تلقائي من قيمة المنتجات بعد الخصم (تُخصم من أرباح المنصة، لا تُضاف على المستخدم)
  // + تبرع إضافي اختياري يكتبه المستخدم (يُضاف على إجمالي الدفع)
  const autoDonationAmount = Math.round(subtotalAfterDiscount * 0.01);
  const extraDonationAmount = Math.max(0, Math.round(extraDonation || 0));
  const donationTotal = autoDonationAmount + extraDonationAmount;
  
  // حساب رسوم الدفع الجزئي بناءً على الشرائح فقط (لا رجوع للإعدادات القديمة)
  const partialPaymentTier = useMemo(() => {
    const tiers = partialPaymentSettings?.fee_tiers || [];
    if (tiers.length === 0) return null;
    return (
      tiers.find(t => subtotalWithTax >= t.min_amount && subtotalWithTax <= t.max_amount)
      || tiers[tiers.length - 1]
    );
  }, [partialPaymentSettings, subtotalWithTax]);

  const calculatePartialPaymentFee = () => {
    if (!hasPreOrderItems || preOrderPaymentOption !== 'half') return 0;
    if (!partialPaymentTier) return 0;
    const pct = Number(partialPaymentTier.fee_percentage ?? 0);
    return Math.ceil(subtotalWithTax * (pct / 100));
  };
  
  const partialPaymentFee = calculatePartialPaymentFee();

  // ===== الدفع عند الاستلام (للطلب المسبق فقط) =====
  // متاح فقط إذا كان كل المنتجات في السلة تدعم الدفع عند الاستلام
  const allItemsSupportCod = hasPreOrderItems && !hasRandomFilamentItems && items.length > 0 && items.every((item: any) => {
    return item.products?.cod_enabled === true;
  });
  // التحكم العام من إعدادات الإدمن (/partial-payment-settings)
  const codGloballyEnabled = partialPaymentSettings?.cod_enabled !== false;
  const halfPaymentGloballyEnabled = partialPaymentSettings?.half_payment_enabled !== false;
  const showCodOption = codGloballyEnabled && allItemsSupportCod;

  // إعادة ضبط الخيار إذا اختفى الشرط، وإجبار الدفع الكامل عند وجود فلمنت عشوائي
  useEffect(() => {
    if (preOrderPaymentOption === 'cod' && !showCodOption) {
      setPreOrderPaymentOption('full');
    }
    if (preOrderPaymentOption === 'half' && !halfPaymentGloballyEnabled) {
      setPreOrderPaymentOption('full');
    }
    if (hasRandomFilamentItems && preOrderPaymentOption !== 'full') {
      setPreOrderPaymentOption('full');
    }
  }, [showCodOption, preOrderPaymentOption, hasRandomFilamentItems, halfPaymentGloballyEnabled]);

  // حساب رسوم الدفع عند الاستلام لكل منتج
  // المنتجات المربوطة بـ link_direct_commission_to_cod: نستخدم نفس حساب سعر "البيع المباشر"
  // المعروض في صفحة المنتج لضمان تطابق الإجمالي. غير ذلك نستخدم شرائح cod_fee_value.
  const codFee = useMemo(() => {
    if (!showCodOption || preOrderPaymentOption !== 'cod') return 0;
    const tiers = partialPaymentSettings?.fee_tiers || [];
    const fallbackCodType = (partialPaymentSettings?.cod_default_fee_type || codDefaults?.type || 'percentage') as 'percentage' | 'fixed';
    const fallbackCodValue = Number(partialPaymentSettings?.cod_default_fee_value ?? codDefaults?.value ?? 0);
    return items.reduce((sum: number, item: any) => {
      const product = item.products;
      if (!product) return sum;
      const qty = item.quantity || 1;
      const preorderUnitPrice = getCartItemPrice(item); // السعر الحالي للطلب المسبق (يشمل الخيار/اللون)
      // إذا كان المنتج مربوطاً بنسبة COD العالمية، احسب فرق سعر البيع المباشر بنفس حارس السعر
      // حتى تكون تكلفة الخيار/اللون بديلاً لتكلفة المنتج وليست إضافة عليها.
      if (product.link_direct_commission_to_cod && codDefaults) {
        const directUnitPrice = getGuardedCartItemPrice(
          { ...item, sale_type: 'direct' } as any,
          usdToIqd,
          codDefaults,
          liveDirectPrices ?? null,
          liveVariantDirectPrices ?? null,
        );
        if (directUnitPrice > 0) {
          const feePerUnit = Math.max(0, directUnitPrice - preorderUnitPrice);
          if (feePerUnit > 0) return sum + (feePerUnit * qty);
          // إذا كان سعر البيع المباشر المحسوب أقل من سعر الطلب الحالي بسبب خيار/حزمة،
          // لا نلغي عمولة COD؛ نكمل للمسار الافتراضي ليحسبها من الشريحة المناسبة.
        }
      }
      // المسار الافتراضي: شرائح COD المخصصة
      const lineTotal = preorderUnitPrice * qty;
      const tier = tiers.length > 0
        ? (tiers.find(t => lineTotal >= t.min_amount && lineTotal <= t.max_amount) || tiers[tiers.length - 1])
        : null;
      const productCodValue = product.cod_fee_value == null ? null : Number(product.cod_fee_value);
      const codType = ((productCodValue != null && productCodValue > 0 ? product.cod_fee_type : null) || tier?.cod_fee_type || fallbackCodType) as 'percentage' | 'fixed';
      const codVal = productCodValue != null && productCodValue > 0
        ? productCodValue
        : Number(tier?.cod_fee_value ?? fallbackCodValue);
      if (!codVal || codVal <= 0) return sum;
      const fee = codType === 'percentage' ? Math.ceil(lineTotal * codVal / 100) : Math.ceil(codVal * qty);
      return sum + fee;
    }, 0);
  }, [showCodOption, preOrderPaymentOption, items, partialPaymentSettings, codDefaults, usdToIqd]);

  const isCodPayment = preOrderPaymentOption === 'cod' && showCodOption;

  const preOrderPaymentAmount = hasPreOrderItems && preOrderPaymentOption === 'half'
    ? Math.ceil(subtotalWithTax * 0.5)
    : (isCodPayment ? 0 : subtotalWithTax);

  // حساب المبلغ المستخدم من المحفظة
  // إذا اختار المستخدم الدفع من المحفظة (أو فلمنت عشوائي) → يشمل المنتجات + التوصيل.
  // خلاف ذلك (COD أفتراضي): المحفظة لا تُستعمل والتوصيل يُدفع عند الاستلام.
  const walletIncludesDelivery = useWalletBalance || hasRandomFilamentItems;
  const walletRequiredAmount = walletIncludesDelivery
    ? preOrderPaymentAmount + deliveryFee
    : preOrderPaymentAmount;
  const walletDeduction = (useWalletBalance || hasRandomFilamentItems) && wallet?.balance && !isCodPayment
    ? Math.min(wallet.balance, walletRequiredAmount)
    : 0;

  // المطلوب الآن: في COD لا شيء. خلاف ذلك: ما تبقى بعد خصم المحفظة (يشمل التوصيل إذا كانت المحفظة تغطيه).
  const grandTotalBase = isCodPayment
    ? 0
    : walletIncludesDelivery
      ? Math.max(0, walletRequiredAmount - walletDeduction)
      : Math.max(0, preOrderPaymentAmount - walletDeduction) + deliveryFee;
  const grandTotal = grandTotalBase + extraDonationAmount;

  // المبلغ المتبقي عند الاستلام (يشمل رسوم COD والتوصيل في حالة COD، أو رسوم الدفع الجزئي)
  const remainingAmount = isCodPayment
    ? subtotalWithTax + codFee + deliveryFee + extraDonationAmount
    : (hasPreOrderItems && preOrderPaymentOption === 'half'
        ? (subtotalWithTax - preOrderPaymentAmount) + partialPaymentFee + deliveryFee
        : 0);

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: t('common_error'),
        description: t('cart_coupon_error_empty'),
        variant: "destructive",
      });
      return;
    }

    setCouponLoading(true);
    try {
      // 1) Try referral coupon first (VIP+ owner gives free delivery)
      const codeTrim = couponCode.trim();
      const { data: refResult } = await supabase.rpc('apply_referral_coupon', {
        p_code: codeTrim,
        p_buyer_user_id: user?.id,
      });
      const ref = refResult as any;
      if (ref?.valid) {
        // Fetch admin-defined min order for free delivery
        const { data: settingsRow } = await supabase
          .from('default_settings')
          .select('setting_value')
          .eq('setting_key', 'referral_settings')
          .maybeSingle();
        const minOrder = Number((settingsRow?.setting_value as any)?.free_delivery_min_order_iqd) || 100000;

        setAppliedReferral({
          coupon_id: ref.coupon_id,
          owner_username: ref.owner_username,
          owner_user_id: ref.owner_user_id,
          free_delivery_min_order_iqd: minOrder,
          custom_message: ref.custom_message ?? null,
          banner_style: ref.banner_style ?? null,
        } as any);
        setAppliedCoupon(null);

        if (total >= minOrder) {
          toast({
            title: t('cart_referral_free_delivery_title'),
            description: t('cart_referral_free_delivery_desc', { username: ref.owner_username }),
          });
        } else {
          const remaining = minOrder - total;
          toast({
            title: t('cart_referral_add_for_free_toast', { username: ref.owner_username, amount: formatPrice(remaining) }),
            description: '',
          });
        }
        return;
      }
      if (ref?.reason === 'self_use_not_allowed') {
        toast({ title: t('cart_referral_self_blocked_title'), description: t('cart_referral_self_blocked_desc'), variant: 'destructive' });
        return;
      }

      // 2) Fall back to standard coupon validation
      const { data: result, error } = await supabase
        .rpc('validate_coupon_with_rate_limit', { coupon_code: codeTrim.toUpperCase() });

      if (error) {
        toast({
          title: t('common_error'),
          description: t('cart_coupon_invalid'),
          variant: "destructive",
        });
        return;
      }

      const couponResult = result as { valid: boolean; error?: string; id?: string; code?: string; discount_type?: string; discount_value?: number; min_purchase_amount?: number; rate_limited?: boolean };

      if (!couponResult.valid) {
        toast({
          title: couponResult.rate_limited ? t('cart_coupon_rate_limited') : t('cart_coupon_invalid'),
          description: couponResult.error || t('cart_coupon_invalid'),
          variant: "destructive",
        });
        return;
      }

      // Check minimum purchase
      if (couponResult.min_purchase_amount && total < couponResult.min_purchase_amount) {
        toast({
          title: t('cart_coupon_min_purchase'),
          description: `${formatPrice(couponResult.min_purchase_amount)} ${t('common_iqd_full')}`,
          variant: "destructive",
        });
        return;
      }

      setAppliedCoupon({
        id: couponResult.id,
        code: couponResult.code,
        discount_type: couponResult.discount_type,
        discount_value: couponResult.discount_value,
        min_purchase_amount: couponResult.min_purchase_amount,
      });
      
      toast({
        title: t('cart_coupon_applied'),
        description: `${couponResult.discount_type === 'percentage' ? `${couponResult.discount_value}%` : `${formatPrice(couponResult.discount_value || 0)} ${t('common_iqd_full')}`}`,
      });
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast({
        title: t('common_error'),
        description: t('cart_order_error'),
        variant: "destructive",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setAppliedReferral(null);
    setCouponCode('');
    toast({
      title: t('cart_coupon_removed'),
      description: t('cart_coupon_removed'),
    });
  };

  // Auto-apply pending coupon coming from /special-coupons "Use" button.
  // Runs once when the cart has loaded and no coupon is currently applied.
  useEffect(() => {
    if (appliedCoupon || appliedReferral) return;
    let pending: { code?: string; title?: string } | null = null;
    try {
      const raw = localStorage.getItem('pending_site_coupon');
      if (raw) pending = JSON.parse(raw);
    } catch {}
    if (!pending?.code) return;
    // Clear immediately to avoid loops on re-render
    try { localStorage.removeItem('pending_site_coupon'); } catch {}
    setCouponCode(pending.code);
    // Defer to next tick so state is set before applyCoupon reads it
    setTimeout(() => { applyCoupon(); }, 50);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Helper to wrap cart-changing actions with cart request warning
  const wrapWithCartRequestCheck = async (action: () => Promise<void>) => {
    // Always check database for latest pending cart request
    const { data } = await supabase
      .from('cart_requests')
      .select('id, cart_code, adjusted_total, admin_notes, status')
      .eq('user_id', user?.id)
      .in('status', ['pending', 'adjusted'])
      .limit(1)
      .maybeSingle();
    
    if (data) {
      // Update local state to show correct cart code in warning dialog
      await refreshCart();
      setPendingAction(() => action);
      setShowCartChangeWarning(true);
    } else {
      action();
    }
  };

  const handleConfirmCartChange = async () => {
    setShowCartChangeWarning(false);
    if (pendingAction) {
      const deleted = await deleteCartRequest();
      console.log('Cart request deleted:', deleted);
      await pendingAction();
      setPendingAction(null);
      // Refresh cart to update pendingCartRequest state
      await refreshCart();
      // Invalidate the cart-request query cache to update CartRequestDialog
      queryClient.invalidateQueries({ queryKey: ['cart-request', user?.id] });
    }
  };

  // Wrapped cart actions
  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    const item = items.find(i => i.id === itemId);
    let finalQty = Math.max(1, Math.min(20, quantity));
    let capped = false;
    let maxAvailable: number | null = null;
    if (item) {
      const rfMax = (item as any).random_filament_max_stock;
      if (typeof rfMax === 'number' && rfMax > 0 && finalQty > rfMax) {
        finalQty = rfMax;
        maxAvailable = rfMax;
        capped = true;
      }
      const available = getItemAvailableStock(item);
      if (typeof available === 'number' && available > 0 && finalQty > available) {
        finalQty = available;
        maxAvailable = available;
        capped = true;
      }
    }
    const showCapToast = () => {
      sonnerToast.info(
        `تم تعديل الكمية تلقائياً إلى الحد الأقصى المتاح في المخزون: ${finalQty} قطعة (المتوفر حالياً: ${maxAvailable ?? finalQty})`
      );
    };
    if (item && finalQty === item.quantity) {
      if (capped) showCapToast();
      return;
    }
    if (capped) showCapToast();
    wrapWithCartRequestCheck(() => updateQuantity(itemId, finalQty));
  };

  const handleRemoveFromCart = (itemId: string) => {
    wrapWithCartRequestCheck(() => removeFromCart(itemId));
  };

  const [showClearCartDialog, setShowClearCartDialog] = useState(false);

  const handleClearCart = () => {
    setShowClearCartDialog(true);
  };

  const confirmClearCart = () => {
    wrapWithCartRequestCheck(() => clearCart());
    setShowClearCartDialog(false);
  };

  // حساب المبلغ المطلوب دفعه الآن من المحفظة (التوصيل يُدفع عند الاستلام دائماً)
  const requiredPaymentNow = hasRandomFilamentItems
    ? preOrderPaymentAmount + deliveryFee
    : preOrderPaymentAmount;
  const walletBalance = wallet?.balance || 0;
  const hasEnoughBalance = walletBalance >= requiredPaymentNow;

  const handleCheckoutClick = () => {
    if (!user) {
      toast({
        title: t('cart_login_required_to_checkout_title'),
        description: t('cart_login_required_to_checkout_desc'),
        variant: "destructive",
      });
      return;
    }

    if (!termsAccepted) {
      toast({
        title: t('cart_terms_required_title'),
        description: t('cart_terms_required_desc'),
        variant: "destructive",
      });
      return;
    }

    // Block mixing different cart categories (direct, preorder air/sea, community,
    // bundles, offers, random filament, gifts). All 8 are mutually exclusive.
    {
      const cats = getCartCategories(items || []);
      if (cats.size > 1) {
        const labels = Array.from(cats).map((c) => CART_CATEGORY_LABELS_AR[c]).join(' + ');
        toast({
          title: t('cart_mixed_categories_title'),
          description: `${t('cart_mixed_categories_desc')}\n${labels}`,
          variant: "destructive",
        });
        return;
      }
    }

    if (isDirectSaleCart) {
      if (!selectedAddress) {
        toast({
          title: t('cart_address_required_title'),
          description: t('cart_address_required_desc2'),
          variant: "destructive",
        });
        return;
      }
      // الفلمنت العشوائي في البيع المباشر يجب أن يُدفع (المنتجات + التوصيل) من المحفظة مسبقاً
      {
        const rfRequired = total + deliveryFee;
        const shortage = Math.max(0, rfRequired - walletBalance);
        if (hasRandomFilamentItems && shortage > 0) {
          toast({
            title: '⚠️ رصيد المحفظة غير كافٍ',
            description: `الفلمنت العشوائي يُدفع بالكامل من المحفظة (المنتجات + التوصيل).\nالمطلوب: ${formatPrice(rfRequired)} د.ع\nرصيدك: ${formatPrice(walletBalance)} د.ع\nالعجز: ${formatPrice(shortage)} د.ع`,
            variant: "destructive",
          });
          return;
        }
      }
      setShowDirectSaleDialog(true);
      return;
    }

    if (!hasEnoughBalance) {
      toast({
        title: t('cart_wallet_insufficient_title'),
        description: t('cart_wallet_insufficient_desc', { balance: formatPrice(walletBalance), required: formatPrice(requiredPaymentNow) }),
        variant: "destructive",
      });
      return;
    }

    // فتح dialog التأكيد مباشرة
    setShowConfirmDialog(true);
  };

  const handleTermsAccepted = () => {
    setTermsAccepted(true);
    setShowTermsSheet(false);
  };

   // Direct sale checkout handler (with optional wallet payment)
  const handleDirectSaleCheckout = async (data: { notes: string; useWallet: boolean; walletDeduction: number }) => {
    if (!user || isDirectSaleProcessing) return;
    setIsDirectSaleProcessing(true);

    try {
      // CRITICAL: refuse to checkout an empty cart (prevents charging wallet for nothing).
      if (!items || items.length === 0) {
        toast({ title: 'السلة فارغة', description: 'لا توجد منتجات لإتمام الطلب', variant: 'destructive' });
        setIsDirectSaleProcessing(false);
        return;
      }
      // حماية إضافية: عند وجود فلمنت عشوائي، يجب الدفع من المحفظة بالكامل لقيمة المنتجات + التوصيل
      if (hasRandomFilamentItems) {
        const productsTotal = total - (appliedCoupon ? calculateDiscount() : 0);
        const requiredAll = productsTotal + (deliveryFee || 0);
        const currentBalance = wallet?.balance || 0;
        const shortage = Math.max(0, requiredAll - currentBalance);
        if (!data.useWallet || shortage > 0) {
          toast({
            title: '⚠️ لا يمكن إكمال الطلب — رصيد المحفظة غير كافٍ',
            description: `الفلمنت العشوائي يُدفع بالكامل من المحفظة (المنتجات + التوصيل).\nالمطلوب: ${formatPrice(requiredAll)} د.ع\nرصيدك: ${formatPrice(currentBalance)} د.ع\nالعجز: ${formatPrice(shortage)} د.ع`,
            variant: 'destructive',
          });
          setIsDirectSaleProcessing(false);
          return;
        }
      }

      // Check address
      const { data: addresses, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (addressError || !addresses || addresses.length === 0) {
        toast({ title: t('cart_address_required_action'), description: t('cart_address_required_desc2'), variant: 'destructive' });
        navigate('/addresses');
        return;
      }

      const { data: defaultAddress } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const selectedAddress = defaultAddress || addresses[0];
      const deliveryFeeCalc = getDeliveryFee(selectedAddress.governorate);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number, governorate, username')
        .eq('id', user.id)
        .single();

      const shippingAddressText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;

      const orderSubtotal = total - (appliedCoupon ? calculateDiscount() : 0);

      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      // Wallet deduction for direct sale — التوصيل يُحسم من المحفظة فقط إذا اختار المستخدم الدفع من المحفظة (أو فلمنت عشوائي)
      const orderGrandTotal = orderSubtotal + deliveryFeeCalc;
      const includeDeliveryInWallet = data.useWallet || hasRandomFilamentItems;
      const walletCap = includeDeliveryInWallet ? orderGrandTotal : orderSubtotal;
      const walletDeductionAmount = data.useWallet
        ? Math.min(data.walletDeduction || (hasRandomFilamentItems ? orderGrandTotal : 0), walletCap)
        : 0;
      const codRemaining = orderGrandTotal - walletDeductionAmount;

      // Deduct from wallet if applicable (idempotent — safe against retries / double-clicks)
      let walletTxId: string | null = null;
      const walletBalanceBefore = wallet?.balance ?? null;
      if (walletDeductionAmount > 0) {
        const { data: walletTxResult, error: walletError } = await supabase.rpc('deduct_wallet_balance', {
          p_user_id: user.id,
          p_amount: walletDeductionAmount,
          p_description: `خصم من المحفظة لطلب بيع مباشر ${orderNumber}`,
          p_idempotency_key: `direct_sale:${orderNumber}`,
        });
        if (walletError) {
          toast({ title: t('cart_wallet_deduct_failed_title'), description: t('cart_wallet_deduct_failed_desc'), variant: 'destructive' });
          return;
        }
        walletTxId = (walletTxResult as unknown as string) || null;
        // Instant notification for the user (non-blocking)
        notifyWalletDeducted({
          userId: user.id,
          amount: walletDeductionAmount,
          summary: `طلب بيع مباشر رقم ${orderNumber}`,
          link: `/profile?tab=orders`,
        });
      }

      const orderInsertData = {
        user_id: user.id,
        order_number: orderNumber,
        total_amount: orderSubtotal + deliveryFeeCalc + extraDonationAmount,
        subtotal: orderSubtotal,
        paid_amount: walletDeductionAmount,
        remaining_amount: codRemaining + extraDonationAmount,
        shipping_address: shippingAddressText,
        phone_number: selectedAddress.phone_number,
        governorate: selectedAddress.governorate,
        status: 'confirmed',
        payment_status: (codRemaining + extraDonationAmount) <= 0 ? 'paid' : 'cod',
        order_type: 'direct',
        delivery_method: selectedDeliveryMethod,
        auto_donation_amount: autoDonationAmount,
        extra_donation_amount: extraDonationAmount,
      } as any;

      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert([orderInsertData])
        .select('id, order_number')
        .single();

      if (orderError || !orderResult) {
        console.error('Direct sale order insert failed:', { userId: user.id, orderNumber, orderError });
        // Server-side log for admin diagnostics (non-blocking)
        try {
          await (supabase as any).rpc('log_order_error', {
            p_context: 'direct_sale_order_insert',
            p_error_code: (orderError as any)?.code || null,
            p_error_message: orderError?.message || 'unknown error',
            p_details: {
              order_number: orderNumber,
              wallet_deducted: walletDeductionAmount,
              cod_remaining: codRemaining,
              delivery_method: selectedDeliveryMethod,
              hint: (orderError as any)?.hint || null,
              details: (orderError as any)?.details || null,
            },
          });
        } catch {}
        // Auto-refund the wallet if we already deducted, so the user is never charged for a non-existent order.
        if (walletDeductionAmount > 0) {
          try {
            await supabase.rpc('refund_wallet_balance' as any, {
              p_user_id: user.id,
              p_amount: walletDeductionAmount,
              p_description: `استرجاع تلقائي - فشل إنشاء الطلب ${orderNumber}`,
              p_idempotency_key: `refund:direct_sale:${orderNumber}`,
            });
          } catch (refundErr) {
            console.error('Auto-refund failed for failed order', orderNumber, refundErr);
          }
        }
        const friendly = buildFriendlyOrderError(orderError, language as any);
        sonnerToast.error(friendly.title, {
          description: friendly.description,
          duration: 9000,
          action: friendly.action
            ? { label: friendly.action.label, onClick: () => navigate(friendly.action!.href) }
            : undefined,
        });
        return;
      }

      // Identify random filament cart items: new flow via cart_items.rf_offer_id, legacy via random_filament_orders link.
      // SAFETY: also re-read cart_items by id from DB so stale local state never drops RF rows.
      const cartItemIdsAll = items.map(i => i.id).filter(Boolean);
      let randomFilamentIds = new Set<string>();
      const rfPriceByCartItem = new Map<string, number>();
      const rfOfferByCartItem = new Map<string, string>();
      const rfCategoryByCartItem = new Map<string, string>();
      items.forEach((it: any) => {
        if (it?.rf_offer_id) {
          randomFilamentIds.add(it.id);
          rfOfferByCartItem.set(it.id, it.rf_offer_id);
          if (it.rf_category_id) rfCategoryByCartItem.set(it.id, it.rf_category_id);
          if (it.random_filament_price_iqd) rfPriceByCartItem.set(it.id, Number(it.random_filament_price_iqd));
        }
      });
      // Fallback 1: direct cart_items read for any rf_offer_id we may have missed locally
      try {
        if (cartItemIdsAll.length > 0) {
          const { data: rfFresh } = await (supabase as any)
            .from('cart_items')
            .select('id, rf_offer_id, rf_category_id')
            .in('id', cartItemIdsAll)
            .not('rf_offer_id', 'is', null);
          (rfFresh || []).forEach((r: any) => {
            randomFilamentIds.add(r.id);
            if (r.rf_offer_id) rfOfferByCartItem.set(r.id, r.rf_offer_id);
            if (r.rf_category_id) rfCategoryByCartItem.set(r.id, r.rf_category_id);
          });
        }
      } catch (e) { console.warn('rf cart_items fallback failed', e); }
      // Fallback 2: legacy random_filament_orders link
      try {
        if (cartItemIdsAll.length > 0) {
          const { data: rfRows } = await (supabase as any)
            .from('random_filament_orders')
            .select('cart_item_id, price_iqd, offer_id')
            .in('cart_item_id', cartItemIdsAll);
          (rfRows || []).forEach((r: any) => {
            randomFilamentIds.add(r.cart_item_id);
            rfPriceByCartItem.set(r.cart_item_id, Number(r.price_iqd) || 0);
            if (r.offer_id) rfOfferByCartItem.set(r.cart_item_id, r.offer_id);
          });
        }
      } catch (e) { console.warn('rf lookup failed', e); }
      // Backfill RF prices from offers table when missing
      try {
        const offerIdsNeedingPrice = Array.from(new Set(
          Array.from(randomFilamentIds)
            .filter((cid) => !rfPriceByCartItem.has(cid))
            .map((cid) => rfOfferByCartItem.get(cid))
            .filter(Boolean) as string[]
        ));
        if (offerIdsNeedingPrice.length > 0) {
          const { data: offers } = await (supabase as any)
            .from('random_filament_offers')
            .select('id, price_iqd')
            .in('id', offerIdsNeedingPrice);
          const priceByOffer = new Map<string, number>();
          (offers || []).forEach((o: any) => priceByOffer.set(o.id, Number(o.price_iqd) || 0));
          for (const cid of randomFilamentIds) {
            if (!rfPriceByCartItem.has(cid)) {
              const oid = rfOfferByCartItem.get(cid);
              if (oid && priceByOffer.has(oid)) rfPriceByCartItem.set(cid, priceByOffer.get(oid)!);
            }
          }
        }
      } catch (e) { console.warn('rf price backfill failed', e); }

      // Create order items (include RF items even when product_id is still null — revealed later)
      const orderItems = items
        .filter(item => item.product_id || item.custom_request_id || (item as any).bundle_id || randomFilamentIds.has(item.id) || (item as any).rf_offer_id)
        .map(item => {
          const isCustomRequest = !!item.custom_request_id;
          const isBundle = !!(item as any).bundle_id;
          const isRandomFilament = randomFilamentIds.has(item.id);
          const itemOption = (item as any).product_options;
          const itemColor = (item as any).selected_color;
          const colorData = itemColor && item.products?.colors
            ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
            : null;

          const isDirect = item.sale_type === 'direct';
          const bundle = isBundle ? (item as any).product_bundles : null;
          const itemPrice = item.is_gift ? 0 : (isRandomFilament ? (rfPriceByCartItem.get(item.id) || 0) : (isBundle ? Number(bundle?.bundle_price || 0) : getCartItemPrice(item as any)));

          const productName = isRandomFilament
            ? 'Mystery Random Filament'
            : isCustomRequest 
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : isBundle ? (bundle?.title_ar || 'بندل') : (item.products?.name || 'منتج');
          const productNameAr = isRandomFilament
            ? 'فلمنت عشوائي مجهول'
            : isCustomRequest 
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : isBundle ? (bundle?.title_ar || 'بندل') : (item.products?.name_ar || 'منتج');

          return {
            order_id: orderResult.id,
            product_id: isCustomRequest || isBundle ? null : item.product_id,
            bundle_id: isBundle ? (item as any).bundle_id : null,
            custom_request_id: isCustomRequest ? item.custom_request_id : null,
            product_option_id: isRandomFilament ? null : ((item as any).product_option_id || null),
            rf_offer_id: isRandomFilament ? (rfOfferByCartItem.get(item.id) || (item as any).rf_offer_id || null) : null,
            quantity: item.quantity,
            unit_price: itemPrice,
            total_price: itemPrice * item.quantity,
            selected_color: isRandomFilament ? null : (itemColor || null),
            color_image_url: isRandomFilament ? null : ((item as any).color_image_url || null),
            selected_option: isRandomFilament ? null : (itemOption?.name_ar || null),
            product_name: productName,
            product_name_ar: productNameAr,
            is_gift: !!item.is_gift,
          };
        });

      // CRITICAL SAFETY: never finalize an empty order. If we somehow built no items
      // (e.g. stale local state, RF row not yet linked), refund + delete and abort.
      if (orderItems.length === 0) {
        console.error('Direct sale: orderItems empty — rolling back', { orderId: orderResult.id, orderNumber, itemsCount: items.length });
        if (walletDeductionAmount > 0) {
          try {
            await supabase.rpc('refund_wallet_balance' as any, {
              p_user_id: user.id,
              p_amount: walletDeductionAmount,
              p_description: `استرجاع تلقائي - عناصر الطلب فارغة ${orderNumber}`,
              p_idempotency_key: `refund:empty_items:${orderNumber}`,
            });
          } catch (e) { console.error('Refund (empty items) failed:', e); }
        }
        try { await supabase.from('orders').delete().eq('id', orderResult.id); } catch (e) { console.error('Delete (empty items) failed:', e); }
        sonnerToast.error('تعذر إنشاء الطلب', {
          description: 'لم يتم العثور على عناصر السلة. تم إعادة المبلغ للمحفظة. يرجى تحديث الصفحة وإعادة المحاولة.',
          duration: 9000,
        });
        return;
      }

      if (orderItems.length > 0) {
        const itemsResult = await insertOrderItemsWithRollback(orderItems, {
          orderId: orderResult.id,
          orderNumber: orderResult.order_number,
          userId: user.id,
          walletDeductedAmount: walletDeductionAmount,
          refundIdempotencyKey: `refund:direct_sale_items:${orderNumber}`,
          refundReason: `استرجاع تلقائي - فشل حفظ عناصر الطلب ${orderNumber}`,
        });
        if (itemsResult.ok === false) {
          const friendly = buildFriendlyOrderError(itemsResult.error, language as any);
          sonnerToast.error(friendly.title, {
            description: friendly.description,
            duration: 9000,
          });
          return;
        }

        // For Random Filament: finalize selection + deduct stock atomically BEFORE generic stock RPC.
        // finalize_and_reveal_rf_for_order picks the random product/color, creates random_filament_orders rows,
        // updates order_items with the chosen product_id/color, and decrements option_stocks.
        const hasRfInOrder = orderItems.some((oi: any) => oi.rf_offer_id);
        if (hasRfInOrder) {
          try {
            await supabase.rpc('finalize_and_reveal_rf_for_order' as any, { p_order_id: orderResult.id });
          } catch (e) {
            console.error('finalize_and_reveal_rf_for_order failed:', e);
          }
        }

        // Deduct stock for direct sale items - retry up to 3 times
        let stockDeducted = false;
        for (let attempt = 0; attempt < 3 && !stockDeducted; attempt++) {
          const { error: stockError } = await supabase.rpc('deduct_order_stock', { p_order_id: orderResult.id });
          if (!stockError) {
            stockDeducted = true;
          } else {
            console.error(`Stock deduction attempt ${attempt + 1} error:`, stockError);
            if (attempt < 2) await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      // Audit log: link the wallet deduction to this order with full breakdown.
      if (walletTxId && walletDeductionAmount > 0) {
        const deliveryFromWallet = includeDeliveryInWallet
          ? Math.max(0, walletDeductionAmount - orderSubtotal)
          : 0;
        const subtotalFromWallet = walletDeductionAmount - deliveryFromWallet;
        await linkWalletDeductionToOrder({
          transactionId: walletTxId,
          orderId: orderResult.id,
          breakdown: {
            source: 'cart_direct_sale',
            subtotal: Math.max(0, subtotalFromWallet),
            delivery_fee: Math.max(0, deliveryFromWallet),
            discount: appliedCoupon ? calculateDiscount() : 0,
            coupon_code: appliedCoupon?.code || null,
            balance_before: walletBalanceBefore ?? undefined,
            balance_after: walletBalanceBefore != null ? walletBalanceBefore - walletDeductionAmount : undefined,
            notes: `طلب بيع مباشر ${orderNumber} — طريقة التوصيل: ${selectedDeliveryMethod}`,
          },
          balanceBefore: walletBalanceBefore,
        });
      }

      // Reveal real product/color to user ONLY when fully paid via wallet (no COD at all).
      try {
        await supabase.rpc('link_random_filament_to_order' as any, { p_order_id: orderResult.id });
        const _hasPreOrderItems = items.some((it: any) => it.sale_type === 'preorder');
        const _isPreOrderWithPartialPayment = _hasPreOrderItems && preOrderPaymentOption === 'half';
        const fullyWalletPaid = !isCodPayment && !_isPreOrderWithPartialPayment;
        if (fullyWalletPaid) {
          await supabase.rpc('reveal_random_filament_orders' as any, { p_order_id: orderResult.id });
          queryClient.invalidateQueries({ queryKey: ['order-detail', orderResult.id] });
          queryClient.invalidateQueries({ queryKey: ['order-rf-rows', orderResult.id] });
          queryClient.invalidateQueries({ queryKey: ['my-orders', user.id] });
        }
      } catch (e) {
        console.warn('random filament link/reveal failed', e);
      }

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['today-direct-orders'] });
      if (walletDeductionAmount > 0) {
        queryClient.invalidateQueries({ queryKey: ['wallet', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance-checkout', user.id] });
      }

      // Send telegram notification
      try {
        const itemDetailsList = items.map((item, idx) => {
          const name = item.custom_request_id
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : (item.products?.name_ar || item.products?.name || 'منتج');
          const color = (item as any).selected_color;
          const option = (item as any).product_options?.name_ar;
          const shippingOpt = item.shipping_option_name_ar;
          let detail = `${idx + 1}. ${name} × ${item.quantity}`;
          if (color) detail += `\n   🎨 اللون: ${color}`;
          if (option) detail += `\n   📐 الخيار: ${option}`;
          if (shippingOpt) detail += `\n   🚚 الشحن: ${shippingOpt}`;
          return detail;
        }).join('\n');

        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🛒 <b>طلب جديد - بيع مباشر ${walletDeductionAmount > 0 ? (codRemaining > 0 ? '(دفع مختلط)' : '(مدفوع من المحفظة)') : '(دفع عند الاستلام)'}</b>\n\n` +
              `👤 العميل: ${profileData?.full_name || 'غير محدد'}\n` +
              `📱 اليوزر: @${profileData?.username || 'غير محدد'}\n` +
              `📞 الهاتف: ${selectedAddress.phone_number}\n\n` +
              `📋 رقم الطلب: ${orderResult.order_number}\n` +
              `📦 عدد المنتجات: ${items.length}\n` +
              `📍 المحافظة: ${selectedAddress.governorate}\n\n` +
              `📝 <b>تفاصيل المنتجات:</b>\n${itemDetailsList}\n\n` +
              `💰 الإجمالي: ${(orderSubtotal + deliveryFeeCalc).toLocaleString()} د.ع\n` +
              (walletDeductionAmount > 0 ? `💳 مدفوع من المحفظة: ${walletDeductionAmount.toLocaleString()} د.ع\n` : '') +
              `💳 ${codRemaining > 0 ? `المتبقي عند الاستلام: ${codRemaining.toLocaleString()} د.ع` : 'تم الدفع بالكامل من المحفظة ✅'}`,
          },
        });
      } catch (e) { console.error('Telegram error:', e); }

      // Update offer purchase statuses to 'shipping_requested'
      const offerPurchaseIds = items
        .filter(item => (item as any).offer_purchase_id)
        .map(item => (item as any).offer_purchase_id);
      if (offerPurchaseIds.length > 0) {
        await supabase
          .from('product_offer_purchases')
          .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
          .in('id', offerPurchaseIds);
      }

      // Record protection discount usage if applied
      if (protectionDiscountAmount > 0 && protectionDiscount?.canUse) {
        await supabase.from('plan_discount_usage' as any).insert({
          user_id: user.id,
          subscription_id: protectionDiscount.subscriptionId,
          plan_id: protectionDiscount.planId,
          order_id: orderResult.id,
          discount_amount: protectionDiscountAmount,
        });
      }

      // Record referral coupon usage (direct sale path)
      if (appliedReferral) {
        await supabase.from('referral_coupon_usages').insert({
          coupon_id: appliedReferral.coupon_id,
          order_id: orderResult.id,
          buyer_user_id: user.id,
          delivery_discount_iqd: rawDeliveryFee,
          owner_earnings_iqd: referralOwnerEarnings,
          status: 'pending',
        });
      }

      try {
        // Record card discount usage if applied (per category)
        if (cardDiscountAmount > 0 && cardDiscount?.discountsByCategory && cardDiscount?.cardId) {
          const categoryIds = Object.keys(cardDiscount.discountsByCategory);
          for (const catId of categoryIds) {
            const catInfo = cardDiscount.discountsByCategory[catId];
            if (catInfo.limited) {
              await supabase.rpc('use_card_discount', {
                p_user_id: user.id,
                p_card_id: cardDiscount.cardId,
                p_category_id: catId,
                p_order_id: orderResult.id,
              });
            }
          }
        }

        // Record percentage discount usage during card validity (direct sale)
        if ((cardDiscount?.percentageDiscount || 0) > 0 && cardDiscount?.cardId) {
          await (supabase as any).from('loyalty_percentage_discount_usage').insert({
            user_id: user.id,
            card_id: cardDiscount.cardId,
            order_id: orderResult.id,
            discount_amount: cardDiscount.percentageDiscount,
          });
        }

        // Record free shipping usage (direct sale)
        if (cardFreeShippingApplied && cardDiscount?.cardId) {
          await (supabase as any).from('loyalty_free_shipping_usage').insert({
            user_id: user.id,
            card_id: cardDiscount.cardId,
            order_id: orderResult.id,
            delivery_method_key: selectedDeliveryMethod,
            saved_amount: rawDeliveryFee,
          });
        }
      } catch (e) {
        console.warn('Loyalty benefit usage recording failed:', e);
      }

      // (Printer warranty benefits removed — loyalty card discounts only.)

      // Record paid subscription benefit usage (direct sale) — independent ledger
      if (subscriptionBenefits && (subscriptionDiscountAmount > 0 || subscriptionFreeShippingApplied)) {
        try {
          if (subscriptionDiscountAmount > 0) {
            await (supabase as any).rpc('consume_subscription_benefit', {
              p_subscription_id: subscriptionBenefits.subscriptionId,
              p_order_id: orderResult.id,
              p_benefit_type: 'discount',
              p_amount: subscriptionDiscountAmount,
              p_delivery_method_key: null,
            });
          }
          if (subscriptionFreeShippingApplied) {
            await (supabase as any).rpc('consume_subscription_benefit', {
              p_subscription_id: subscriptionBenefits.subscriptionId,
              p_order_id: orderResult.id,
              p_benefit_type: 'free_shipping',
              p_amount: rawDeliveryFee,
              p_delivery_method_key: selectedDeliveryMethod,
            });
          }
        } catch (e) {
          console.warn('Subscription benefit consumption failed:', e);
        }
      }

      await clearCart();
      setShowDirectSaleDialog(false);
      setSuccessOrderNumber(orderResult.order_number);
      setSuccessOrderId(orderResult.id);
      setShowOrderSuccess(true);
      // Meta Pixel + CAPI: Purchase (non-blocking)
      try {
        void trackMetaEvent({
          eventName: 'Purchase',
          customData: {
            currency: 'IQD',
            value: Number(orderSubtotal + deliveryFeeCalc) || 0,
            content_ids: items.filter(i => i.product_id).map(i => i.product_id),
            content_type: 'product',
            num_items: items.reduce((s, i) => s + (i.quantity || 0), 0),
            order_id: orderResult.order_number,
          },
        });
      } catch {}
    } catch (error) {
      console.error('Direct sale checkout error:', error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء إتمام الطلب", variant: "destructive" });
    } finally {
      setIsDirectSaleProcessing(false);
    }
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return; // Prevent double-click
    
    setShowConfirmDialog(false);
    
    if (!user) {
      toast({
        title: t('cart_login_required_to_checkout_title'),
        description: t('cart_login_required_to_checkout_desc'),
        variant: "destructive",
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      // Check if user has at least one address
      const { data: addresses, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (addressError || !addresses || addresses.length === 0) {
        toast({
          title: "يجب إضافة عنوان",
          description: "الرجاء إضافة عنوان توصيل أولاً لإتمام الطلب",
          variant: "destructive",
        });
        navigate('/addresses');
        return;
      }

      // Get default address or first address
      const { data: defaultAddress } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const selectedAddress = defaultAddress || addresses[0];

      // Get user profile information
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number, governorate, username')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        toast({
          title: t('cart_order_create_error_title'),
          description: t('cart_order_create_error_desc'),
          variant: "destructive",
        });
        return;
      }

      const deliveryFee = getDeliveryFee(selectedAddress.governorate);

      // Create order in database with full address details
      const shippingAddressText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;
      
      // Calculate payment info for pre-orders
      const isPreOrderWithPartialPayment = hasPreOrderItems && preOrderPaymentOption === 'half';
      const isPreOrderCod = hasPreOrderItems && isCodPayment;

      // Random filament with COD/partial: kept hidden as "Mystery" until full wallet payment.
      // Subtotal includes referral commission (added to buyer price, paid out to VIP+ owner)
      const orderSubtotal = total - discount - protectionDiscountAmount - cardDiscountAmount + referralOwnerEarnings;
      const paidNow = isPreOrderCod ? 0 : (isPreOrderWithPartialPayment ? Math.ceil(orderSubtotal * 0.5) : orderSubtotal);
      const orderRemaining = isPreOrderCod
        ? orderSubtotal + codFee
        : (isPreOrderWithPartialPayment ? orderSubtotal - paidNow : 0);

      const orderDeliveryFee = (cardFreeShippingApplied || hardwareFreeShippingApplied || referralFreeShippingApplied) ? 0 : getDeliveryFee(selectedAddress.governorate);
      
      // استخدام الدالة الذرية الجديدة التي تنشئ الطلب وتخصم المبلغ في عملية واحدة
      // التوصيل يُدفع دائماً عند الاستلام — لا يُحتسب ضمن paid_amount
      const orderData = {
        total_amount: orderSubtotal + orderDeliveryFee + (isPreOrderCod ? codFee : 0) + extraDonationAmount,
        subtotal: orderSubtotal,
        paid_amount: isPreOrderCod ? 0 : (paidNow + extraDonationAmount),
        remaining_amount: orderRemaining + orderDeliveryFee + (isPreOrderCod ? extraDonationAmount : 0),
        cod_fee: isPreOrderCod ? codFee : 0,
        shipping_address: shippingAddressText,
        phone_number: selectedAddress.phone_number,
        governorate: selectedAddress.governorate,
        delivery_method: selectedDeliveryMethod,
        discount_amount: discount + protectionDiscountAmount + cardDiscountAmount,
        card_discount_amount: cardDiscountAmount,
        card_discount_level_name: cardDiscountAmount > 0 ? (cardDiscount?.levelName || null) : null,
        payment_method: isPreOrderCod ? 'cod' : 'wallet',
        payment_status: isPreOrderCod ? 'cod' : (isPreOrderWithPartialPayment ? 'partial' : 'paid'),
        auto_donation_amount: autoDonationAmount,
        extra_donation_amount: extraDonationAmount,
      } as any;
      if (appliedReferral) {
        orderData.referral_coupon_id = appliedReferral.coupon_id;
        orderData.referral_owner_earnings_iqd = referralOwnerEarnings;
      }

      const { data: orderId, error: orderError } = await supabase.rpc('create_order_with_wallet_payment', {
        p_user_id: user.id,
        p_order_data: orderData,
        p_payment_amount: isPreOrderCod ? 0 : (requiredPaymentNow + extraDonationAmount),
      });

      if (orderError || !orderId) {
        console.error('Error creating order with payment:', { userId: user.id, orderError });
        try {
          await (supabase as any).rpc('log_order_error', {
            p_context: 'create_order_with_wallet_payment',
            p_error_code: (orderError as any)?.code || null,
            p_error_message: orderError?.message || 'unknown error',
            p_details: {
              required_payment_now: requiredPaymentNow,
              is_pre_order_cod: isPreOrderCod,
              delivery_method: selectedDeliveryMethod,
              hint: (orderError as any)?.hint || null,
              details: (orderError as any)?.details || null,
            },
          });
        } catch {}
        const friendly = buildFriendlyOrderError(orderError, language as any);
        sonnerToast.error(friendly.title, {
          description: friendly.description,
          duration: 9000,
          action: friendly.action
            ? { label: friendly.action.label, onClick: () => navigate(friendly.action!.href) }
            : undefined,
        });
        return;
      }

      // Record referral coupon usage
      if (appliedReferral) {
        await supabase.from('referral_coupon_usages').insert({
          coupon_id: appliedReferral.coupon_id,
          order_id: orderId,
          buyer_user_id: user.id,
          delivery_discount_iqd: rawDeliveryFee,
          owner_earnings_iqd: referralOwnerEarnings,
          status: 'pending',
        });
        // Update aggregates on coupon
      }

      // Fetch the created order to get order_number
      const { data: order, error: fetchOrderError } = await supabase
        .from('orders')
        .select('id, order_number')
        .eq('id', orderId)
        .single();

      if (fetchOrderError || !order) {
        console.error('Error fetching order:', fetchOrderError);
        toast({
          title: t('cart_order_create_error_title'),
          description: t('cart_order_create_error_desc'),
          variant: "destructive",
        });
        return;
      }

      // إرسال إشعار للتيليجرام عند إنشاء طلب جديد
      try {
        const paymentStatusText = isPreOrderCod ? 'الدفع عند الاستلام' : (isPreOrderWithPartialPayment ? 'دفع جزئي (نصف المبلغ)' : 'مدفوع بالكامل');
        const orderTotalAmount = orderSubtotal + orderDeliveryFee + (isPreOrderCod ? codFee : 0);
        const paidAmountNow = grandTotal;
        const remainingToPay = (isPreOrderCod || isPreOrderWithPartialPayment) ? remainingAmount : 0;

        const paidItemDetailsList = items.map((item, idx) => {
          const name = item.custom_request_id
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : (item.products?.name_ar || item.products?.name || 'منتج');
          const color = (item as any).selected_color;
          const option = (item as any).product_options?.name_ar;
          const shippingOpt = item.shipping_option_name_ar;
          let detail = `${idx + 1}. ${name} × ${item.quantity}`;
          if (color) detail += `\n   🎨 اللون: ${color}`;
          if (option) detail += `\n   📐 الخيار: ${option}`;
          if (shippingOpt) detail += `\n   🚚 الشحن: ${shippingOpt}`;
          return detail;
        }).join('\n');
        
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🛒 <b>طلب جديد - ${isPreOrderCod ? 'الدفع عند الاستلام' : 'مدفوع'}</b>\n\n` +
              `👤 العميل: ${profile?.full_name || 'غير محدد'}\n` +
              `📱 اليوزر: @${profile?.username || 'غير محدد'}\n` +
              `📞 الهاتف: ${selectedAddress.phone_number}\n\n` +
              `📋 رقم الطلب: ${order.order_number}\n` +
              `📦 عدد المنتجات: ${items.length}\n` +
              `📍 المحافظة: ${selectedAddress.governorate}\n\n` +
              `📝 <b>تفاصيل المنتجات:</b>\n${paidItemDetailsList}\n\n` +
              `💰 <b>تفاصيل الدفع:</b>\n` +
              `• المبلغ الإجمالي: ${orderTotalAmount.toLocaleString()} د.ع\n` +
              `• المدفوع الآن: ${paidAmountNow.toLocaleString()} د.ع\n` +
              (remainingToPay > 0 ? `• المتبقي عند الاستلام: ${remainingToPay.toLocaleString()} د.ع\n` : '') +
              `• حالة الدفع: ${paymentStatusText}`,
          },
        });
      } catch (telegramError) {
        console.error('خطأ في إرسال إشعار التيليجرام:', telegramError);
      }

      // للطلبات المسبقة بالدفع الجزئي، تحديث حالة الدفع
      if (isPreOrderWithPartialPayment) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'partial',
          })
          .eq('id', order.id);
      }

      // Fetch custom request data directly if needed
      const customRequestIds = items
        .filter(item => item.custom_request_id && !item.custom_product_requests?.product_name)
        .map(item => item.custom_request_id)
        .filter(Boolean) as string[];

      let customRequestsData: Record<string, any> = {};
      if (customRequestIds.length > 0) {
        const { data: fetchedRequests } = await supabase
          .from('custom_product_requests')
          .select('id, product_name, suggested_price, image_url')
          .in('id', customRequestIds);
        
        if (fetchedRequests) {
          customRequestsData = fetchedRequests.reduce((acc, req) => {
            acc[req.id] = req;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Create order items
      const orderItems = items
        .filter((item) => {
          return item.product_id || item.custom_request_id || (item as any).bundle_id;
        })
        .map((item) => {
          const isCustomRequest = !!item.custom_request_id;
          const isBundle = !!(item as any).bundle_id;
          const itemOption = (item as any).product_options;
          
          const itemColor = (item as any).selected_color;
          const colorData = itemColor && item.products?.colors
            ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
            : null;
          
          const customRequest = item.custom_product_requests || 
            (item.custom_request_id ? customRequestsData[item.custom_request_id] : null);
          
          const bundle = isBundle ? (item as any).product_bundles : null;
          const itemPrice = item.is_gift ? 0 : (isBundle ? Number(bundle?.bundle_price || 0) : getGuardedCartItemPrice(item as any, usdToIqd, codDefaults, liveDirectPrices ?? null));

          const productName = isCustomRequest 
            ? (customRequest?.product_name || 'طلب مخصص')
            : isBundle ? (bundle?.title_ar || 'بندل') : (item.products?.name || 'منتج');
          const productNameAr = isCustomRequest 
            ? (customRequest?.product_name || 'طلب مخصص')
            : isBundle ? (bundle?.title_ar || 'بندل') : (item.products?.name_ar || 'منتج');

          return {
            order_id: order.id,
            product_id: isCustomRequest || isBundle ? null : item.product_id,
            bundle_id: isBundle ? (item as any).bundle_id : null,
            custom_request_id: isCustomRequest ? item.custom_request_id : null,
            product_option_id: (item as any).product_option_id || null,
            quantity: item.quantity,
            unit_price: itemPrice,
            total_price: itemPrice * item.quantity,
            selected_color: itemColor || null,
            color_image_url: (item as any).color_image_url || null,
            selected_option: itemOption?.name_ar || null,
            shipping_option_name_ar: item.shipping_option_name_ar || null,
            product_name: productName,
            product_name_ar: productNameAr,
            is_gift: !!item.is_gift,
          };
        });

      // Check if we have valid items to insert
      if (orderItems.length === 0) {
        toast({
          title: "خطأ",
          description: "لا توجد منتجات صالحة في السلة",
          variant: "destructive",
        });
        return;
      }

      console.log('Inserting order items:', orderItems);

      const walletChargedNow = isPreOrderCod ? 0 : requiredPaymentNow;
      const itemsResult = await insertOrderItemsWithRollback(orderItems, {
        orderId: order.id,
        orderNumber: order.order_number,
        userId: user.id,
        walletDeductedAmount: walletChargedNow,
        refundIdempotencyKey: `refund:preorder_items:${order.order_number}`,
        refundReason: `استرجاع تلقائي - فشل حفظ عناصر الطلب ${order.order_number}`,
      });

      if (itemsResult.ok === false) {
        const friendly = buildFriendlyOrderError(itemsResult.error, language as any);
        sonnerToast.error(friendly.title, {
          description: friendly.description,
          duration: 9000,
        });
        return;
      }

      // Random filament: link selection to order, and reveal immediately if fully wallet-paid.
      // (Wallet-only payments cannot be cancelled by the user → reveal at checkout, not on delivery.)
      try {
        await supabase.rpc('link_random_filament_to_order' as any, { p_order_id: order.id });
        const fullyWalletPaidPreorder = !isPreOrderCod && !isPreOrderWithPartialPayment;
        if (fullyWalletPaidPreorder) {
          await supabase.rpc('reveal_random_filament_orders' as any, { p_order_id: order.id });
          queryClient.invalidateQueries({ queryKey: ['order-detail', order.id] });
          queryClient.invalidateQueries({ queryKey: ['order-rf-rows', order.id] });
          queryClient.invalidateQueries({ queryKey: ['my-orders', user.id] });
        }
      } catch (e) {
        console.warn('random filament link/reveal failed (preorder)', e);
      }

      // تحديث استخدام الكوبون إذا كان موجوداً
      if (appliedCoupon && user) {
        await supabase
          .from('coupon_usage')
          .insert([{
            coupon_id: appliedCoupon.id,
            user_id: user.id
          }]);

        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Build WhatsApp message
      let message = `مرحباً، أريد إتمام طلب:\n\n`;
      message += `🔖 *رقم الطلب:* ${order.order_number}\n\n`;
      message += `📦 *المنتجات:*\n`;
      
      items.forEach((item, index) => {
        const isCustomRequest = !!item.custom_request_id;
        
        // Get custom request data from either the item or fetched data
        const customRequest = item.custom_product_requests || 
          (item.custom_request_id ? customRequestsData[item.custom_request_id] : null);
        
        const itemName = isCustomRequest 
          ? (customRequest?.product_name || 'طلب مخصص')
          : (item.products?.name_ar || 'منتج');
        
        const isDirect = item.sale_type === 'direct';
        const itemPrice = getCartItemPrice(item as any);
        
        // Use product_options data directly from the cart item
        const itemOption = (item as any).product_options;
        
        const itemColor = (item as any).selected_color;
        const colorData = itemColor && item.products?.colors
          ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
          : null;
        
        message += `${index + 1}. ${itemName}${isCustomRequest ? ' ⭐ (طلب خاص)' : ''}\n`;
        if (itemOption) {
          message += `   الخيار: ${itemOption.name_ar}\n`;
        }
        if (colorData) {
          message += `   اللون: ${colorData.name_ar}\n`;
        }
        message += `   الكمية: ${item.quantity}\n`;
        message += `   السعر: ${formatPrice(itemPrice)} دينار عراقي\n`;
        message += `   المجموع: ${formatPrice(itemPrice * item.quantity)} دينار عراقي\n\n`;
      });

      message += `\n👤 *معلومات المشتري:*\n`;
      message += `الاسم: ${selectedAddress.full_name}\n`;
      message += `رقم الهاتف: ${selectedAddress.phone_number}\n`;
      message += `\n📍 *عنوان التوصيل:*\n`;
      message += `المحافظة: ${selectedAddress.governorate}\n`;
      message += `المنطقة: ${selectedAddress.area}\n`;
      if (selectedAddress.neighborhood) {
        message += `الحي: ${selectedAddress.neighborhood}\n`;
      }
      message += `أقرب نقطة دالة: ${selectedAddress.nearest_landmark}\n`;
      if (selectedAddress.additional_notes) {
        message += `ملاحظات: ${selectedAddress.additional_notes}\n`;
      }
      message += `\n`;
      
      message += `💰 *ملخص الطلب:*\n`;
      message += `المجموع الفرعي: ${formatPrice(total)} دينار عراقي\n`;
      if (appliedCoupon) {
        message += `الخصم (${appliedCoupon.code}): -${formatPrice(discount)} دينار عراقي\n`;
      }
      message += `التوصيل: ${formatPrice(deliveryFee)} دينار عراقي\n`;
      if (walletDeduction > 0) {
        message += `الدفع من المحفظة: -${formatPrice(walletDeduction)} دينار عراقي\n`;
      }
      message += `الإجمالي${walletDeduction > 0 ? ' المتبقي' : ''}: ${formatPrice(grandTotal)} دينار عراقي`;
      if (grandTotal === 0 && walletDeduction > 0) {
        message += ` ✓ تم الدفع بالكامل من المحفظة`;
      }

      // If coupon was used, record it
      if (appliedCoupon && user) {
        await supabase.from('coupon_usage').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
        });
        
        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Update offer purchase statuses to 'shipping_requested'
      const offerPurchaseIds2 = items
        .filter(item => (item as any).offer_purchase_id)
        .map(item => (item as any).offer_purchase_id);
      if (offerPurchaseIds2.length > 0) {
        await supabase
          .from('product_offer_purchases')
          .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
          .in('id', offerPurchaseIds2);
      }

      // Record protection discount usage if applied
      if (protectionDiscountAmount > 0 && protectionDiscount?.canUse) {
        await supabase.from('plan_discount_usage' as any).insert({
          user_id: user!.id,
          subscription_id: protectionDiscount.subscriptionId,
          plan_id: protectionDiscount.planId,
          discount_amount: protectionDiscountAmount,
        });
      }

      try {
        // Record card discount usage if applied
        if (cardDiscountAmount > 0 && cardDiscount?.discountsByCategory && cardDiscount?.cardId) {
          const categoryIds = Object.keys(cardDiscount.discountsByCategory);
          for (const catId of categoryIds) {
            const catInfo = cardDiscount.discountsByCategory[catId];
            if (catInfo.limited) {
              await supabase.rpc('use_card_discount', {
                p_user_id: user!.id,
                p_card_id: cardDiscount.cardId,
                p_category_id: catId,
                p_order_id: order.id,
              });
            }
          }
        }

        // Record percentage discount usage during card validity
        if ((cardDiscount?.percentageDiscount || 0) > 0 && cardDiscount?.cardId) {
          await (supabase as any).from('loyalty_percentage_discount_usage').insert({
            user_id: user!.id,
            card_id: cardDiscount.cardId,
            order_id: order.id,
            discount_amount: cardDiscount.percentageDiscount,
          });
        }

        // Record free shipping usage (standard order)
        if (cardFreeShippingApplied && cardDiscount?.cardId) {
          await (supabase as any).from('loyalty_free_shipping_usage').insert({
            user_id: user!.id,
            card_id: cardDiscount.cardId,
            order_id: order.id,
            delivery_method_key: selectedDeliveryMethod,
            saved_amount: rawDeliveryFee,
          });
        }
      } catch (e) {
        console.warn('Loyalty benefit usage recording failed:', e);
      }

      // (Printer warranty benefits removed — loyalty card discounts only.)

      // Record paid subscription benefit usage (standard order) — independent ledger
      if (subscriptionBenefits && (subscriptionDiscountAmount > 0 || subscriptionFreeShippingApplied)) {
        try {
          if (subscriptionDiscountAmount > 0) {
            await (supabase as any).rpc('consume_subscription_benefit', {
              p_subscription_id: subscriptionBenefits.subscriptionId,
              p_order_id: order.id,
              p_benefit_type: 'discount',
              p_amount: subscriptionDiscountAmount,
              p_delivery_method_key: null,
            });
          }
          if (subscriptionFreeShippingApplied) {
            await (supabase as any).rpc('consume_subscription_benefit', {
              p_subscription_id: subscriptionBenefits.subscriptionId,
              p_order_id: order.id,
              p_benefit_type: 'free_shipping',
              p_amount: rawDeliveryFee,
              p_delivery_method_key: selectedDeliveryMethod,
            });
          }
        } catch (e) {
          console.warn('Subscription benefit consumption failed:', e);
        }
      }

      // Update order with card discount info
      if (cardDiscountAmount > 0) {
        await supabase.from('orders').update({
          card_discount_amount: cardDiscountAmount,
          card_discount_level_name: cardDiscount?.levelName || null,
          discount_amount: discount + protectionDiscountAmount + cardDiscountAmount,
        }).eq('id', order.id);
      }

      // Clear cart after successful order
      await clearCart();

      // Invalidate wallet caches so balance updates immediately in UI
      if (!isPreOrderCod && requiredPaymentNow > 0) {
        queryClient.invalidateQueries({ queryKey: ['wallet', user.id] });
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
        queryClient.invalidateQueries({ queryKey: ['wallet-balance-checkout', user.id] });
      }

      // Meta Pixel + CAPI: Purchase (non-blocking)
      try {
        void trackMetaEvent({
          eventName: 'Purchase',
          customData: {
            currency: 'IQD',
            value: Number(grandTotal) || 0,
            content_ids: items.filter(i => i.product_id).map(i => i.product_id),
            content_type: 'product',
            num_items: items.reduce((s, i) => s + (i.quantity || 0), 0),
            order_id: order.order_number,
          },
        });
      } catch {}

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappURL = `https://wa.me/9647838455220?text=${encodedMessage}`;
      
      // Open WhatsApp in new window
      window.open(whatsappURL, '_blank');
      
      toast({
        title: t('cart_order_success_title'),
        description: t('cart_order_success_desc', { number: order.order_number }),
      });
      
    } catch (error) {
      console.error('Error during checkout:', error);
      toast({
        title: t('cart_order_create_error_title'),
        description: t('cart_order_create_error_desc'),
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen pt-6">
        <div className="container mx-auto px-4 max-w-4xl py-8">
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-lg border bg-card p-3 flex gap-3">
                <div className="w-20 h-20 rounded-lg bg-muted animate-pulse shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-3/4 rounded bg-muted animate-pulse" />
                  <div className="h-3 w-1/3 rounded bg-muted animate-pulse" />
                  <div className="flex items-center justify-between">
                    <div className="h-5 w-20 rounded bg-muted animate-pulse" />
                    <div className="h-8 w-24 rounded-md bg-muted animate-pulse" />
                  </div>
                </div>
              </div>
            ))}
            <div className="rounded-lg border bg-card p-4 space-y-3">
              <div className="h-4 w-32 rounded bg-muted animate-pulse" />
              <div className="h-4 w-24 rounded bg-muted animate-pulse" />
              <div className="h-10 w-full rounded-lg bg-muted animate-pulse" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen overflow-x-hidden" dir="rtl">
      <main className="w-full max-w-4xl mx-auto px-4 py-8 overflow-x-hidden">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-primary">{t('cart_title')}</h1>
            {itemCount > 0 && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                isDirectSaleCart
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-accent/10 text-accent-foreground border-accent/20'
              }`}>
                {isDirectSaleCart ? (
                  <><Package className="w-3 h-3" /> {t('cart_label_direct')}</>
                ) : (
                  <><Truck className="w-3 h-3" /> {t('cart_label_preorder')}</>
                )}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {itemCount > 0 ? t('cart_items_in_cart', { count: itemCount, label: itemCount === 1 ? t('cart_product') : t('cart_products') }) : t('cart_empty')}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
            <div className="w-20 h-20 mx-auto mb-6 opacity-20">
              <ShoppingBag className="w-full h-full text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t('cart_empty')}</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              {t('cart_no_items_yet')}
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <ArrowRight className="ml-2 h-4 w-4" />
                {t('cart_browse_products')}
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6 w-full min-w-0">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4 w-full min-w-0">
              {(() => {
                // Group items by product + option + color combination
                const groupedItems = items.reduce((acc, item) => {
                  // Random filament: render each as single mystery item (never grouped)
                  if (item.is_random_filament) {
                    acc.push({ type: 'single', items: [item] });
                    return acc;
                  }
                  // Offer purchase items (from storage) are rendered as single items
                  if ((item as any).offer_purchase_id) {
                    acc.push({ type: 'offer_purchase', items: [item] });
                    return acc;
                  }

                  // Custom requests are not grouped
                  if (item.custom_request_id) {
                    acc.push({ type: 'single', items: [item] });
                    return acc;
                  }

                  // Bundle items are rendered as single items
                  if (item.bundle_id) {
                    acc.push({ type: 'bundle', items: [item] });
                    return acc;
                  }
                  
                  // Create a key for grouping (product + option + color)
                  const key = `${item.product_id || ''}_${item.product_option_id || ''}_${(item as any).selected_color || ''}`;
                  
                  // Find existing group
                  const existingGroup = acc.find(
                    (g) => g.type === 'grouped' && g.key === key
                  );
                  
                  if (existingGroup) {
                    existingGroup.items.push(item);
                  } else {
                    acc.push({ type: 'grouped', key, items: [item] });
                  }
                  
                  return acc;
                }, [] as { type: string; key?: string; items: CartItem[] }[]);

                return groupedItems.map((group, groupIndex) => {
                  // Bundle item rendering
                  if (group.type === 'bundle') {
                    const item = group.items[0];
                    const bundle = (item as any).product_bundles;
                    if (!bundle) return null;
                    const bundlePrice = Number(bundle.bundle_price);
                    const isRemoving = removingItemIds.has(item.id);
                    const bundleMaxQty = item.bundle_id && bundleMaxQtyMap ? (bundleMaxQtyMap[item.bundle_id] ?? 99) : 99;
                    const isDirect = item.sale_type === 'direct';
                    const effectiveMax = isDirect ? bundleMaxQty : 99;
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                      }, 300);
                    };
                    return (
                      <div key={item.id} className={`rounded-xl p-2.5 sm:p-4 border border-primary/20 bg-primary/5 transition-all duration-300 w-full max-w-full overflow-hidden ${isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : ''}`}>
                        <div className="flex gap-2.5 sm:gap-4">
                          {bundle.image_url && (
                            <Link to="/bundles" className="flex-shrink-0">
                              <img src={bundle.image_url} alt={bundle.title_ar} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-primary/30" />
                            </Link>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <Link to="/bundles" className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block">
                                  {bundle.title_ar}
                                </Link>
                                <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5">
                                  <Package className="h-2.5 w-2.5" /> {t('cart_bundle_badge')}
                                </span>
                              </div>
                              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0" onClick={handleAnimatedRemove}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-sm sm:text-base font-black text-primary">
                                <AnimatedPrice value={bundlePrice} formatFn={formatPrice} /> <span className="text-[10px] font-normal text-muted-foreground">{t('cart_iqd_short')}</span>
                              </span>
                              <div className="flex items-center gap-1 bg-muted/30 rounded-lg border border-border/40">
                                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <AnimatedQuantity value={item.quantity} className="w-6 text-center font-bold text-xs" />
                                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= effectiveMax}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {isDirect && effectiveMax < 99 && (
                              <div className="text-[9px] text-muted-foreground mt-0.5">
                                {t('cart_max_bundles', { max: effectiveMax })}
                              </div>
                            )}
                            {item.quantity > 1 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 text-left">
                                {t('cart_total_label')} <AnimatedPrice value={bundlePrice * item.quantity} formatFn={formatPrice} className="font-bold text-foreground" /> {t('cart_iqd_short')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Offer purchase items (from storage - price = 0)
                  if (group.type === 'offer_purchase') {
                    const item = group.items[0];
                    const offerData = (item as any).offer_purchase;
                    const offerInfo = offerData?.product_offers;
                    const isRemoving = removingItemIds.has(item.id);
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                      }, 300);
                    };
                    return (
                      <div key={item.id} className={`rounded-xl p-2.5 sm:p-4 border border-amber-500/30 bg-amber-500/5 transition-all duration-300 w-full max-w-full overflow-hidden ${isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : ''}`}>
                        <div className="flex gap-2.5 sm:gap-4">
                          {offerInfo?.image_url && (
                            <div className="flex-shrink-0">
                              <img src={offerInfo.image_url} alt={offerInfo?.title_ar || ''} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-amber-500/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 block">
                                  {offerInfo?.title_ar || t('cart_storage_default_title')}
                                </span>
                                <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5">
                                  <Package className="h-2.5 w-2.5" /> {t('cart_storage_badge')}
                                </span>
                              </div>
                              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0" onClick={handleAnimatedRemove}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-sm sm:text-base font-black text-emerald-600">
                                {t('cart_paid_in_advance')}
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // If it's a single item (custom request or single shipping option)
                  if (group.type === 'single' || group.items.length === 1) {
                    const item = group.items[0];
                    const itemOption = (item as any).product_options;
                    const itemColor = (item as any).selected_color;
                    const colorData = itemColor && item.products?.colors
                      ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
                      : null;
                    
                    const isDirect = item.sale_type === 'direct';
                    const isGift = !!item.is_gift;
                    const isLocked = !!item.is_locked;
                    const isRandomFilamentItem = !!item.is_random_filament;
                    const itemPrice = isGift
                      ? 0
                      : isRandomFilamentItem
                        ? (Number((item as any).random_filament_price_iqd) || 0)
                        : getGuardedCartItemPrice(item as any, usdToIqd, codDefaults, liveDirectPrices ?? null);
                    
                    const isRemoving = removingItemIds.has(item.id);
                    
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => {
                          const next = new Set(prev);
                          next.delete(item.id);
                          return next;
                        });
                      }, 300);
                    };

                    const itemAvailableStock = getItemAvailableStock(item);
                    const isOutOfStock = itemAvailableStock !== null && itemAvailableStock <= 0;
                    const isLowStock = itemAvailableStock !== null && itemAvailableStock > 0 && itemAvailableStock < item.quantity;

                    return (
                      <div 
                        key={item.id}
                        className={`rounded-xl p-2.5 sm:p-4 border transition-all duration-300 w-full max-w-full overflow-hidden ${
                          isOutOfStock ? 'border-destructive/50 bg-destructive/5 opacity-70' :
                          isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : 'border-border/50 bg-card hover:border-primary/30 opacity-100 scale-100 translate-x-0'
                        }`}
                      >
                        {isOutOfStock && (
                          <div className="flex items-center justify-between gap-2 mb-2 p-2 rounded-lg bg-destructive/10 border border-destructive/20">
                            <span className="text-xs font-bold text-destructive">{t('cart_out_of_stock')}</span>
                            <Button size="sm" variant="destructive" className="h-6 text-[10px] px-2" onClick={() => handleAnimatedRemove()}>
                              <Trash2 className="h-3 w-3 ml-1" /> {t('cart_remove_btn')}
                            </Button>
                          </div>
                        )}
                        {isLowStock && (
                          <div className="flex items-center gap-2 mb-2 p-2 rounded-lg bg-amber-500/10 border border-amber-500/20">
                            <span className="text-xs font-bold text-amber-600">{t('cart_low_stock_only', { qty: itemAvailableStock! })}</span>
                          </div>
                        )}
                        <div className="flex gap-2.5 sm:gap-4">
                          {/* Product Image - compact on mobile. RF items show wavy mystery image. */}
                          {item.is_random_filament ? (
                            <div className="flex-shrink-0 w-16 h-16 sm:w-24 sm:h-24 rounded-lg border border-primary/40 overflow-hidden relative">
                              <WavyColors seed={item.id} />
                              <div className="absolute inset-0 flex items-center justify-center bg-background/20">
                                <Sparkles className="h-5 w-5 sm:h-7 sm:w-7 text-white drop-shadow" />
                              </div>
                            </div>
                          ) : ((item.products?.image_url) || (item.custom_product_requests?.image_url) || (item as any).option_image_url || (item as any).color_image_url) && (
                            <Link 
                              to={item.products ? `/product/${item.products.slug}` : '#'}
                              className="flex-shrink-0"
                            >
                              <img 
                                src={(item as any).option_image_url || (item as any).color_image_url || (item.products?.images && item.products.images[0]) || item.products?.image_url || item.custom_product_requests?.image_url || ''}
                                alt={item.products?.name_ar || item.custom_product_requests?.product_name || ''}
                                className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-border/40"
                              />
                            </Link>
                          )}
                          
                          {/* Product Info - compact */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                {item.is_random_filament ? (
                                  <div className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 flex items-center gap-1">
                                    <Sparkles className="h-3 w-3 text-primary shrink-0" />
                                    فلمنت عشوائي
                                    <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded-full shrink-0">مفاجأة</span>
                                  </div>
                                ) : item.products ? (
                                  <Link 
                                    to={`/product/${item.products.slug}`}
                                    className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block"
                                  >
                                    {item.products.name_ar}
                                  </Link>
                                ) : (
                                  <div className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 flex items-center gap-1">
                                    {item.custom_product_requests?.product_name}
                                    <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded-full shrink-0">{t('cart_special_request_badge')}</span>
                                  </div>
                                )}
                                
                                {/* Option/Color/Shipping tags inline — hidden for RF (mystery) */}
                                {!item.is_random_filament && (itemOption || colorData || item.shipping_option_name_ar) && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {itemOption && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded">{itemOption.name_ar}</span>
                                    )}
                                    {colorData && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <span className="w-2.5 h-2.5 rounded-full border border-border/50 inline-block" style={getColorSwatchStyle(colorData.hex_code)} />
                                        {colorData.name_ar}
                                      </span>
                                    )}
                                    {item.shipping_option_name_ar && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded">{translateShippingOption(item.shipping_option_name_ar, t)}</span>
                                    )}
                                  </div>
                                )}
                                {item.is_random_filament && (
                                  <div className="text-[10px] text-muted-foreground mt-0.5">
                                    سيتم الكشف عن المنتج واللون عند التوصيل
                                  </div>
                                )}
                                {(item as any).random_filament_was_capped && (
                                  <div className="text-[10px] text-amber-600 dark:text-amber-400 mt-1 p-1.5 rounded-md bg-amber-500/10 border border-amber-500/30">
                                    ⚠ تم تحديث الكمية تلقائيًا إلى الحد الأقصى المتوفر في المخزون ({item.quantity})
                                  </div>
                                )}
                              </div>

                              {/* Delete button - hidden for locked gifts */}
                              {!isLocked && (
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0 active:scale-75 transition-transform"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAnimatedRemove();
                                }}
                                aria-label={t('cart_remove_aria')}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                              )}
                            </div>

                            {/* Gift badge */}
                            {isGift && (
                              <div className="flex items-center gap-1 mt-1">
                                <Gift className="h-3 w-3 text-primary" />
                                <span className="text-[10px] font-bold text-primary">{t('cart_gift_free_badge')}</span>
                              </div>
                            )}

                            {/* Price + Quantity row */}
                            <div className="flex items-center justify-between mt-1.5">
                              {isGift ? (
                                <span className="text-sm sm:text-base font-black text-primary">{t('cart_gift_free')}</span>
                              ) : (
                              <span className="text-sm sm:text-base font-black text-primary">
                                <AnimatedPrice value={itemPrice} formatFn={formatPrice} /> <span className="text-[10px] font-normal text-muted-foreground">{t('cart_iqd_short')}</span>
                              </span>
                              )}
                              
                              {!isLocked && (
                              <div className="flex items-center gap-1 bg-muted/30 rounded-lg border border-border/40">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 touch-manipulation active:scale-90 transition-transform"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateQuantity(item.id, item.quantity - 1);
                                  }}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <AnimatedQuantity value={item.quantity} className="w-6 text-center font-bold text-xs" />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 touch-manipulation active:scale-90 transition-transform"
                                  disabled={item.quantity >= 50}
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateQuantity(item.id, item.quantity + 1);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                              )}
                            </div>

                            {/* Total if quantity > 1 */}
                            {!isGift && item.quantity > 1 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 text-left">
                                {t('cart_total_label')} <AnimatedPrice value={itemPrice * item.quantity} formatFn={formatPrice} className="font-bold text-foreground" /> {t('cart_iqd_short')}
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Grouped items (same product with different shipping options)
                  return (
                    <GroupedCartItem
                      key={group.key}
                      productId={group.items[0].product_id || ''}
                      items={group.items}
                      updateQuantity={handleUpdateQuantity}
                      removeFromCart={handleRemoveFromCart}
                      formatPrice={formatPrice}
                      outOfStockItemIds={outOfStockItemIds}
                      lowStockItems={lowStockItems}
                    />
                  );
                });
              })()}

              {/* Out of Stock Warning */}
              {hasOutOfStockItems && (
                <div className="rounded-xl p-3 border border-destructive/30 bg-destructive/5 flex items-center justify-between gap-3">
                  <span className="text-sm font-bold text-destructive">{t('cart_out_of_stock_warning')}</span>
                  <Button size="sm" variant="destructive" className="shrink-0" onClick={removeOutOfStockItems}>
                    <Trash2 className="h-3.5 w-3.5 ml-1" />
                    {t('cart_remove_all')}
                  </Button>
                </div>
              )}

              {/* Cart Upsell Offers */}
              <CartUpsellOffers />

              {/* Cart Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: t('cart_login_required_short'),
                        description: t('cart_login_required_short_desc'),
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowCartRequestDialog(true);
                  }}
                >
                  <Hash className="ml-2 h-4 w-4" />
                  {t('cart_code')}
                </Button>
                {items.some((i: any) => !i.is_random_filament_revealed && !i.is_locked) && (
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  onClick={handleClearCart}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  {t('cart_clear')}
                </Button>
                )}
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="glass-effect rounded-2xl p-6 border border-border/50 sticky top-24">
                
                {/* Coupon Section */}
                <div className="mb-6">
                  <Label htmlFor="coupon" className="text-foreground mb-2 block flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    {t('cart_coupon_label')}
                  </Label>
                  {!appliedCoupon && !appliedReferral ? (
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder={t('cart_coupon_placeholder')}
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                      />
                      <Button
                        onClick={applyCoupon}
                        disabled={couponLoading}
                        variant="outline"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('cart_coupon_apply')}
                      </Button>
                    </div>
                  ) : appliedReferral ? (() => {
                    const refStyle = getReferralBannerStyle(appliedReferral.banner_style);
                    const headlineMessage = appliedReferral.custom_message?.trim()
                      ? appliedReferral.custom_message
                      : t('cart_referral_thanks', { username: appliedReferral.owner_username });
                    return (
                    <div className={`rounded-xl ${refStyle.container} ${refStyle.border} p-3 space-y-2`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="text-lg">🎁</span>
                          <div className="min-w-0">
                            <p className={`text-xs font-bold ${refStyle.title} truncate`}>
                              {headlineMessage}
                            </p>
                            {referralFreeShippingApplied ? (
                              <p className="text-[11px] text-emerald-600 font-semibold">{t('cart_referral_free_shipping_active')}</p>
                            ) : (
                              <p className="text-[11px] text-muted-foreground">
                                <span dangerouslySetInnerHTML={{ __html: t('cart_referral_add_for_free', { amount: `<span class="font-bold ${refStyle.highlight}">${formatPrice(referralRemainingForFreeDelivery)}</span>` }) }} />
                              </p>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={removeCoupon}
                          className="h-6 w-6 p-0 shrink-0 text-muted-foreground hover:text-destructive"
                          title={t('cart_remove_coupon')}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                      {!referralFreeShippingApplied && (
                        <div className="space-y-1">
                          <div className={`h-2 rounded-full ${refStyle.progressTrack} overflow-hidden`}>
                            <div
                              className={`h-full ${refStyle.progressFill} transition-all duration-500`}
                              style={{ width: `${Math.min(100, (total / (appliedReferral.free_delivery_min_order_iqd || 100000)) * 100)}%` }}
                            />
                          </div>
                          <p className="text-[10px] text-muted-foreground text-center">
                            {formatPrice(total)} / {formatPrice(appliedReferral.free_delivery_min_order_iqd || 100000)} {t('cart_iqd_short')}
                          </p>
                        </div>
                      )}
                    </div>
                    );
                  })() : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-green-600" />
                        <span className="font-bold text-green-600">{appliedCoupon.code}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={removeCoupon}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  {hasAdjustedTotal && (
                    <div className="rounded-xl border border-primary/30 bg-primary/5 p-3 text-sm space-y-1 animate-fade-in">
                      <div className="flex items-center gap-2 font-bold text-primary">
                        <Sparkles className="w-4 h-4" />
                        <span>{t('cart_admin_adjusted_title')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {t('cart_admin_adjusted_desc', { code: pendingCartRequest?.cart_code || '' })}
                      </p>
                      <div className="flex justify-between items-center pt-1">
                        <span className="text-muted-foreground text-xs">{t('cart_original_total')}</span>
                        <span className="text-muted-foreground line-through text-xs">{formatPrice(total)} {t('cart_iqd_short')}</span>
                      </div>
                    </div>
                  )}
                  <div className="flex justify-between text-foreground">
                    <span>{t('cart_subtotal')}</span>
                    <span className="font-bold"><AnimatedPrice value={effectiveSubtotal} formatFn={formatPrice} /> {t('pd_currency_iqd')}</span>
                  </div>
                  {insuranceTotal > 0 && (
                    <div className="flex justify-between text-primary text-xs">
                      <span>🛡️ {t('insurance_subtotal')}</span>
                      <span className="font-bold">+<AnimatedPrice value={insuranceTotal} formatFn={formatPrice} /> {t('pd_currency_iqd')}</span>
                    </div>
                  )}
                  
                  {appliedCoupon && discount > 0 && (
                    <div className="flex justify-between animate-fade-in">
                      <span className="text-green-600">{t('cart_discount')} ({appliedCoupon.code})</span>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground line-through text-xs animate-fade-in" style={{ animationDelay: '0.1s' }}>
                          {formatPrice(total)} {t('cart_iqd_short')}
                        </span>
                        <span className="font-bold text-green-600 animate-scale-in" style={{ animationDelay: '0.3s' }}>
                          -<AnimatedPrice value={discount} formatFn={formatPrice} /> {t('pd_currency_iqd')}
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* خصم باقة الحماية */}
                  {protectionDiscountAmount > 0 && protectionDiscount && (
                    <div className="flex justify-between animate-fade-in">
                      <span className="text-emerald-600 text-sm flex items-center gap-1">
                        {t('cart_protection_discount', { plan: protectionDiscount.planNameAr })}
                      </span>
                      <span className="font-bold text-emerald-600">
                        -<AnimatedPrice value={protectionDiscountAmount} formatFn={formatPrice} /> {t('pd_currency_iqd')}
                      </span>
                    </div>
                  )}
                  
                  {/* خصم بطاقة الولاء */}
                  {cardDiscountAmount > 0 && cardDiscount && (
                    <div className="flex justify-between items-center animate-fade-in rounded-xl p-3 border border-primary/30 bg-gradient-to-l from-primary/10 via-primary/5 to-transparent backdrop-blur-sm shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center shadow-inner">
                          <CreditCard className="h-4 w-4 text-primary" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-primary block flex items-center gap-1">
                            {t('cart_card_discount', { level: cardDiscount.levelName })}
                          </span>
                          <span className="text-[9px] text-muted-foreground">{t('cart_card_discount_subtitle')}</span>
                        </div>
                      </div>
                      <span className="font-black text-primary text-sm animate-pulse">
                        -<AnimatedPrice value={cardDiscountAmount} formatFn={formatPrice} /> {t('cart_iqd_short')}
                      </span>
                    </div>
                  )}

                  {/* Selector: Warranty / Subscription / Both — only when both are active */}
                  {hasBothActive && (
                    <div className="animate-fade-in rounded-xl p-3 border border-primary/20 bg-gradient-to-br from-primary/5 via-background/40 to-background/20 backdrop-blur-md shadow-sm space-y-2">
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs font-bold text-foreground">{t('cart_hardware_benefits_picker_title')}</span>
                      </div>
                      <div className="grid grid-cols-3 gap-1.5">
                        <button
                          type="button"
                          onClick={() => setHardwareBenefitMode('warranty')}
                          className={`text-[10px] font-semibold px-2 py-2 rounded-lg border transition-all ${
                            hardwareBenefitMode === 'warranty'
                              ? 'border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 shadow-sm'
                              : 'border-border/50 bg-background/40 text-muted-foreground hover:border-emerald-500/40'
                          }`}
                        >
                          {t('cart_hardware_benefits_use_warranty')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHardwareBenefitMode('subscription')}
                          className={`text-[10px] font-semibold px-2 py-2 rounded-lg border transition-all ${
                            hardwareBenefitMode === 'subscription'
                              ? 'border-amber-500 bg-amber-500/15 text-amber-700 dark:text-amber-400 shadow-sm'
                              : 'border-border/50 bg-background/40 text-muted-foreground hover:border-amber-500/40'
                          }`}
                        >
                          {t('cart_hardware_benefits_use_subscription')}
                        </button>
                        <button
                          type="button"
                          onClick={() => setHardwareBenefitMode('both')}
                          className={`relative text-[10px] font-semibold px-2 py-2 rounded-lg border transition-all ${
                            hardwareBenefitMode === 'both'
                              ? 'border-primary bg-gradient-to-br from-emerald-500/20 to-amber-500/20 text-foreground shadow-sm'
                              : 'border-border/50 bg-background/40 text-muted-foreground hover:border-primary/40'
                          }`}
                        >
                          {t('cart_hardware_benefits_use_both')}
                          <span className="absolute -top-1.5 -right-1.5 text-[7px] font-black px-1 py-0.5 rounded-full bg-primary text-primary-foreground shadow">
                            {t('cart_hardware_benefits_recommended')}
                          </span>
                        </button>
                      </div>
                      <p className="text-[9px] text-muted-foreground leading-relaxed">
                        {t('cart_hardware_benefits_picker_hint')}
                      </p>
                    </div>
                  )}

                  {/* خصم ضمان الطابعة */}
                  {warrantyDiscountAmount > 0 && warrantyBenefits && (
                    <div className="flex justify-between items-center animate-fade-in rounded-xl p-3 border border-emerald-500/30 bg-gradient-to-l from-emerald-500/10 via-emerald-500/5 to-transparent backdrop-blur-sm shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-emerald-500/20 to-teal-500/20 flex items-center justify-center shadow-inner">
                          <Sparkles className="h-4 w-4 text-emerald-600" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 block flex items-center gap-1">
                            {t('cart_warranty_discount', { percent: warrantyBenefits.percentageRate })}
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {t('cart_warranty_discount_subtitle', {
                              remaining: formatPrice(Math.max(0, warrantyBenefits.percentageRemaining - warrantyDiscountAmount)),
                              day: warrantyBenefits.activationDay,
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-emerald-600 text-sm animate-pulse">
                        -<AnimatedPrice value={warrantyDiscountAmount} formatFn={formatPrice} /> {t('cart_iqd_short')}
                      </span>
                    </div>
                  )}

                  {/* خصم باقة الحماية (التأمين المدفوع) — مستقل عن الضمان ويتراكم معه */}
                  {subscriptionDiscountAmount > 0 && subscriptionBenefits && (
                    <div className="flex justify-between items-center animate-fade-in rounded-xl p-3 border border-amber-500/30 bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-transparent backdrop-blur-sm shadow-sm">
                      <div className="flex items-center gap-2.5">
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center shadow-inner">
                          <Sparkles className="h-4 w-4 text-amber-600" />
                        </div>
                        <div>
                          <span className="text-xs font-bold text-amber-700 dark:text-amber-400 block flex items-center gap-1">
                            {subscriptionBenefits.planNameAr || ''} — {subscriptionBenefits.percentageRate}%
                          </span>
                          <span className="text-[9px] text-muted-foreground">
                            {t('cart_warranty_discount_subtitle', {
                              remaining: formatPrice(Math.max(0, subscriptionBenefits.percentageRemaining - subscriptionDiscountAmount)),
                              day: 1,
                            })}
                          </span>
                        </div>
                      </div>
                      <span className="font-black text-amber-600 text-sm animate-pulse">
                        -<AnimatedPrice value={subscriptionDiscountAmount} formatFn={formatPrice} /> {t('cart_iqd_short')}
                      </span>
                    </div>
                  )}

                  {/* Card perk scope notices: explain why free shipping / discount activates or not */}
                  {(cardShippingScope || cardDiscountScope) && (
                    <div className="space-y-1.5">
                      {cardShippingScope && (
                        <div className={`text-[11px] rounded-lg px-3 py-2 border ${
                          cardShippingScope.eligible
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                        }`}>
                          {cardShippingScope.eligible ? (
                            <div className="font-semibold">
                              {t('cart_card_perk_eligible_title', { perk: t('cart_free_delivery_won') })}
                            </div>
                          ) : (
                            <>
                              <div className="font-bold mb-0.5">
                                {t('cart_card_perk_blocked_title', { perk: t('cart_free_delivery_won') })}
                              </div>
                              <div className="leading-relaxed">
                                {t('cart_card_perk_blocked_desc', {
                                  perk: t('cart_free_delivery_won'),
                                  cats: cardShippingScope.allowedNames || '—',
                                  items: cardShippingScope.blockingNames || '—',
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                      {cardDiscountScope && (
                        <div className={`text-[11px] rounded-lg px-3 py-2 border ${
                          cardDiscountScope.eligible
                            ? 'bg-emerald-500/10 border-emerald-500/30 text-emerald-700 dark:text-emerald-400'
                            : 'bg-amber-500/10 border-amber-500/30 text-amber-800 dark:text-amber-300'
                        }`}>
                          {cardDiscountScope.eligible ? (
                            <div className="font-semibold">
                              {t('cart_card_perk_eligible_title', { perk: `${cardDiscount?.percentageRate || 0}%` })}
                            </div>
                          ) : (
                            <>
                              <div className="font-bold mb-0.5">
                                {t('cart_card_perk_blocked_title', { perk: `${cardDiscount?.percentageRate || 0}%` })}
                              </div>
                              <div className="leading-relaxed">
                                {t('cart_card_perk_blocked_desc', {
                                  perk: `${cardDiscount?.percentageRate || 0}%`,
                                  cats: cardDiscountScope.allowedNames || '—',
                                  items: cardDiscountScope.blockingNames || '—',
                                })}
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                  
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-foreground animate-fade-in">
                      <span className="flex items-center gap-1">
                        ضريبة مؤقتة (10%)
                        <span className="text-[9px] text-muted-foreground">(تُطبَّق على جميع أنواع الشحن)</span>
                      </span>
                      <span className="font-bold text-amber-600">
                        +<AnimatedPrice value={taxAmount} formatFn={formatPrice} /> {t('pd_currency_iqd')}
                      </span>
                    </div>
                  )}

                  {/* صف هادئ يجمع التبرع التلقائي + التبرع الإضافي الاختياري */}
                  {(autoDonationAmount > 0 || true) && (
                    <details className="group rounded-lg border border-border/40 bg-muted/20 px-3 py-2 text-[11px] animate-fade-in [&_summary::-webkit-details-marker]:hidden">
                      <summary className="flex items-center justify-between gap-2 cursor-pointer list-none">
                        <span className="flex items-center gap-1.5 text-muted-foreground">
                          <span className="opacity-70">🤲</span>
                          <span>
                            تبرع <span className="font-semibold text-foreground/80">{formatPrice(autoDonationAmount)} {t('pd_currency_iqd')}</span>
                            <span className="opacity-70"> لمؤسسة العين/ودور الأيتام</span>
                          </span>
                        </span>
                        <span className="text-[10px] text-muted-foreground/70 group-open:hidden">إضافة المزيد</span>
                        <span className="text-[10px] text-muted-foreground/70 hidden group-open:inline">إخفاء</span>
                      </summary>

                      <div className="mt-2 pt-2 border-t border-border/30 space-y-2">
                        <p className="text-[10px] text-muted-foreground leading-relaxed">
                          1% من قيمة طلبك يُخصم من أرباح المنصة كتبرع لمؤسسة العين/ودور الأيتام — لا يُضاف على مبلغك.
                          يمكنك المساهمة بمبلغ إضافي اختياري:
                        </p>
                        <button
                          type="button"
                          onClick={() => navigate('/donations')}
                          className="text-[10px] text-primary hover:underline"
                        >
                          عرض إثبات التبرعات والسجل المباشر ←
                        </button>
                        <div className="flex flex-wrap gap-1">
                          {[1000, 2000, 5000, 10000].map((amt) => (
                            <button
                              key={amt}
                              type="button"
                              onClick={() => setExtraDonation(extraDonationAmount === amt ? 0 : amt)}
                              className={`px-2 py-0.5 rounded-md text-[10px] transition-all border ${
                                extraDonationAmount === amt
                                  ? 'bg-foreground/80 text-background border-foreground/80'
                                  : 'bg-transparent text-muted-foreground border-border/50 hover:border-foreground/30 hover:text-foreground'
                              }`}
                            >
                              {formatPrice(amt)}
                            </button>
                          ))}
                          <input
                            type="number"
                            inputMode="numeric"
                            min={0}
                            placeholder="مبلغ آخر"
                            value={extraDonation || ''}
                            onChange={(e) => setExtraDonation(Math.max(0, Number(e.target.value) || 0))}
                            className="flex-1 min-w-[70px] h-6 px-2 rounded-md text-[10px] bg-transparent border border-border/50 focus:border-foreground/40 focus:outline-none text-foreground placeholder:text-muted-foreground/60"
                          />
                        </div>
                        {extraDonationAmount > 0 && (
                          <div className="flex justify-between items-center text-[10px] text-muted-foreground">
                            <span>سيُضاف على إجمالي الدفع</span>
                            <span className="font-semibold text-foreground/80">+{formatPrice(extraDonationAmount)} {t('pd_currency_iqd')}</span>
                          </div>
                        )}
                      </div>
                    </details>
                  )}
                  <div className="flex justify-between text-foreground">
                    <span>{t('cart_delivery')}</span>
                    {(cardFreeShippingApplied || hardwareFreeShippingApplied || isFreeDeliveryApplied) ? (
                      <span className="font-bold text-emerald-600">
                        {t('cart_free_delivery_won')} {rawDeliveryFee > 0 && <span className="text-xs line-through text-muted-foreground mr-1">{formatPrice(rawDeliveryFee)}</span>}
                      </span>
                    ) : (
                      <span className="font-bold"><AnimatedPrice value={deliveryFee} formatFn={formatPrice} /> {t('pd_currency_iqd')}</span>
                    )}
                  </div>
                  {freeDeliveryRemaining > 0 && (
                    <div className="text-xs text-emerald-600 bg-emerald-500/10 rounded-lg px-3 py-1.5 text-center">
                      {t('cart_free_delivery_remaining', { amount: formatPrice(freeDeliveryRemaining) })}
                    </div>
                  )}
                  
                  {/* Address selector for direct sale */}
                  {isDirectSaleCart && (
                    <>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          {t('cart_delivery_address')}
                        </div>
                        <div className="flex items-center gap-1">
                          {userAddresses && userAddresses.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary hover:text-primary/80"
                              onClick={() => setShowAddressSwitcher(true)}
                            >
                              {t('cart_switch_address')}
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => navigate('/addresses')}
                          >
                            {userAddresses && userAddresses.length > 0 ? t('cart_manage_addresses') : t('cart_add_address')}
                          </Button>
                        </div>
                      </div>
                      {selectedAddress ? (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-primary/30 bg-background">
                          <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div className="text-xs space-y-0.5 flex-1">
                            {selectedAddress.label && <p className="font-black text-primary text-[11px]">{selectedAddress.label}</p>}
                            <p className="font-bold text-foreground">{selectedAddress.full_name}</p>
                            <p className="text-muted-foreground">{selectedAddress.governorate} - {selectedAddress.area}</p>
                            <p className="text-muted-foreground" dir="ltr">{selectedAddress.phone_number}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-xs text-muted-foreground mb-2">{t('cart_no_saved_address')}</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => navigate('/addresses')}
                          >
                            <MapPin className="h-3 w-3 ml-1" />
                            {t('cart_add_new_address')}
                          </Button>
                        </div>
                      )}
                    </div>

                    <Dialog open={showAddressSwitcher} onOpenChange={setShowAddressSwitcher}>
                      <DialogContent dir="rtl" className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            {t('cart_choose_address')}
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                          {userAddresses?.map((addr: any) => (
                            <div
                              key={addr.id}
                              onClick={() => {
                                setSelectedAddressId(addr.id);
                                setShowAddressSwitcher(false);
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                selectedAddressId === addr.id
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                                selectedAddressId === addr.id ? 'border-primary' : 'border-muted-foreground/40'
                              }`}>
                                {selectedAddressId === addr.id && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                              </div>
                              <div className="text-sm space-y-0.5 flex-1">
                                {addr.label && <p className="font-black text-primary text-xs">{addr.label}</p>}
                                <p className="font-bold text-foreground">{addr.full_name}</p>
                                <p className="text-muted-foreground text-xs">{addr.governorate} - {addr.area}</p>
                                {addr.nearest_landmark && <p className="text-muted-foreground text-xs">{addr.nearest_landmark}</p>}
                                <p className="text-muted-foreground text-xs" dir="ltr">{addr.phone_number}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    </>
                  )}

                  {/* خيارات التوصيل */}
                  {isFreeDeliveryApplied && !cardFreeShippingApplied && !hardwareFreeShippingApplied ? (
                    (() => {
                      const selectedMethod = visibleDeliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod);
                      return (
                        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/40 py-3 px-4 flex items-center gap-2">
                          <Truck className="h-5 w-5 text-emerald-600 shrink-0" />
                          <div className="flex-1 text-right">
                            <div className="font-bold text-emerald-700 dark:text-emerald-400 text-sm">{t('cart_free_delivery_unlocked')}</div>
                            {selectedMethod && (
                              <div className="text-xs text-muted-foreground">{selectedMethod.name_ar}</div>
                            )}
                          </div>
                        </div>
                      );
                    })()
                  ) : (
                  <div className="rounded-lg border border-border/40 overflow-hidden bg-sidebar">
                    {/* Selected method header - always visible */}
                    {(() => {
                      const selectedMethod = visibleDeliveryMethods.find((m: any) => m.method_key === selectedDeliveryMethod);
                      const selectedFee = getDeliveryFee(selectedAddress?.governorate || profile?.governorate || null);
                      const iconMap: Record<string, React.ReactNode> = {
                        warehouse: <Warehouse className="h-4 w-4" />,
                        truck: <Truck className="h-4 w-4" />,
                        user: <UserCheck className="h-4 w-4" />,
                      };
                      return (
                        <button
                          type="button"
                          onClick={() => setDeliveryOptionsOpen(v => !v)}
                          className="w-full flex items-center gap-2 py-3 px-4 text-right bg-sidebar border-primary"
                        >
                          <Truck className="h-5 w-5 text-primary shrink-0" />
                          <span className="font-bold text-foreground flex-1">{t('cart_delivery_method')}</span>
                          {selectedMethod && (
                            <span className="text-xs text-muted-foreground ml-1 text-center">
                              {selectedMethod.name_ar} — {' '}
                              <span className={`font-bold ${selectedDeliveryMethod === 'pickup' ? 'text-green-500' : 'text-primary'}`}>
                                {selectedDeliveryMethod === 'pickup' ? t('cart_free_label') : `${formatPrice(selectedFee)} ${t('cart_iqd_short')}`}
                              </span>
                            </span>
                          )}
                          <ChevronDown className={`h-4 w-4 text-muted-foreground transition-transform duration-200 ${deliveryOptionsOpen ? 'rotate-180' : ''}`} />
                        </button>
                      );
                    })()}

                    {/* Expandable options list */}
                    <div className={`overflow-hidden transition-all duration-300 ${deliveryOptionsOpen ? 'max-h-[500px] opacity-100' : 'max-h-0 opacity-0'}`}>
                      <RadioGroup
                        value={selectedDeliveryMethod}
                        onValueChange={(v) => {
                          setSelectedDeliveryMethod(v);
                          setDeliveryOptionsOpen(false);
                        }}
                        className="space-y-2 px-4 pb-4"
                      >
                        {visibleDeliveryMethods.map((method: any) => {
                          const iconMap: Record<string, React.ReactNode> = {
                            warehouse: <Warehouse className="h-4 w-4" />,
                            truck: <Truck className="h-4 w-4" />,
                            user: <UserCheck className="h-4 w-4" />,
                          };
                          const previewFee = getMethodPreviewPrice(method.method_key);
                          const methodFreeApplied = method.free_delivery_enabled && (
                            (Number(method.free_delivery_min_order) || 0) === 0 || total >= (Number(method.free_delivery_min_order) || 0)
                          );
                          return (
                            <div
                              key={method.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                                selectedDeliveryMethod === method.method_key
                                  ? 'border-primary bg-primary/5'
                                  : 'border-border/40 hover:border-primary/50'
                              }`}
                              onClick={() => {
                                setSelectedDeliveryMethod(method.method_key);
                                setDeliveryOptionsOpen(false);
                              }}
                            >
                              <RadioGroupItem value={method.method_key} id={`dm-${method.method_key}`} />
                              <div className="text-primary/70">{iconMap[method.icon] || <Package className="h-4 w-4" />}</div>
                              <Label htmlFor={`dm-${method.method_key}`} className="flex-1 cursor-pointer">
                                <div className="font-bold text-sm text-foreground">{
                                  method.method_key === 'standard' ? t('delivery_method_standard_name')
                                  : method.method_key === 'pickup' ? t('delivery_method_pickup_name')
                                  : method.method_key === 'personal' ? t('delivery_method_personal_name')
                                  : method.name_ar
                                }</div>
                                {(() => {
                                  const desc = method.method_key === 'standard' ? t('delivery_method_standard_desc')
                                    : method.method_key === 'pickup' ? t('delivery_method_pickup_desc')
                                    : method.method_key === 'personal' ? t('delivery_method_personal_desc')
                                    : method.description_ar;
                                  return desc ? <div className="text-[11px] text-muted-foreground">{desc}</div> : null;
                                })()}
                              </Label>
                              <span className={`text-sm font-bold ${(method.method_key === 'pickup' || methodFreeApplied) ? 'text-green-500' : 'text-primary'}`}>
                                {method.method_key === 'pickup' || methodFreeApplied ? t('cart_free_label') : `${formatPrice(previewFee)} ${t('cart_iqd_short')}`}
                              </span>
                            </div>
                          );
                        })}
                      </RadioGroup>
                    </div>
                  </div>
                  )}

                  {/* خيارات الدفع للطلب المسبق */}
                  {hasPreOrderItems && (
                    <div className="py-4 px-4 rounded-lg bg-accent/10 border border-accent/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-5 w-5 text-accent" />
                        <span className="font-bold text-foreground">{t('cart_preorder_options')}</span>
                      </div>

                      {hasRandomFilamentItems && (
                        <div className="mb-3 rounded-lg border border-amber-500/40 bg-amber-500/10 p-3">
                          <div className="flex items-start gap-2">
                            <Wallet className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-xs leading-relaxed flex-1">
                              <p className="font-bold text-amber-700 dark:text-amber-300">
                                لديك فلمنت عشوائي في السلة — يجب الدفع من المحفظة مسبقاً
                              </p>
                              <p className="text-muted-foreground mt-1">
                                لا يمكن استخدام الدفع عند الاستلام أو دفع نصف المبلغ مع وجود فلمنت عشوائي.
                                إما إكمال الطلب بالدفع الكامل من المحفظة، أو إزالة منتجات الفلمنت العشوائي لاختيار طريقة دفع أخرى.
                              </p>
                              <div className="mt-2 space-y-1.5">
                                {items.filter((it: any) => it.is_random_filament).map((it: any) => (
                                  <div key={it.id} className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1.5">
                                    <span className="text-[11px] font-medium text-foreground truncate">
                                      🎲 {it.products?.name_ar || it.products?.name || 'فلمنت عشوائي'} × {it.quantity || 1}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => wrapWithCartRequestCheck(() => removeFromCart(it.id))}
                                    >
                                      إزالة
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}

                      <RadioGroup 
                        value={preOrderPaymentOption} 
                        onValueChange={(value) => setPreOrderPaymentOption(value as 'full' | 'half' | 'cod')}
                        className="space-y-3"
                      >
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          preOrderPaymentOption === 'full' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border/40 hover:border-primary/50'
                        }`}>
                          <RadioGroupItem value="full" id="payment-full" />
                          <Label htmlFor="payment-full" className="flex-1 cursor-pointer">
                            <div className="font-bold text-foreground">{t('cart_preorder_full')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('cart_preorder_full_desc', { amount: formatPrice(subtotalWithTax) })}
                            </div>
                          </Label>
                        </div>
                        {halfPaymentGloballyEnabled && !hasRandomFilamentItems && (
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          preOrderPaymentOption === 'half' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border/40 hover:border-primary/50'
                        }`}>
                          <RadioGroupItem value="half" id="payment-half" />
                          <Label htmlFor="payment-half" className="flex-1 cursor-pointer">
                            <div className="font-bold text-foreground">{t('cart_preorder_half')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('cart_preorder_half_pay', { amount: formatPrice(Math.ceil(subtotalWithTax * 0.5)) })}
                            </div>
                            <div className="text-xs text-orange-500 mt-1">
                              {t('cart_preorder_remaining', { amount: formatPrice((subtotalWithTax - Math.ceil(subtotalWithTax * 0.5)) + partialPaymentFee) })}
                            </div>
                          </Label>
                        </div>
                        )}
                        {showCodOption && (
                          <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                            preOrderPaymentOption === 'cod'
                              ? 'border-primary bg-primary/5'
                              : 'border-border/40 hover:border-primary/50'
                          }`}>
                            <RadioGroupItem value="cod" id="payment-cod" />
                            <Label htmlFor="payment-cod" className="flex-1 cursor-pointer">
                              <div className="font-bold text-foreground flex items-center gap-2">
                                <Truck className="h-4 w-4" />
                                {t('cart_cod_title')}
                              </div>
                              <div className="text-xs text-muted-foreground">
                                {t('cart_cod_desc_short')}
                              </div>
                              {preOrderPaymentOption === 'cod' && codFee > 0 && (
                                <div className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                                  {t('cart_cod_fee', { amount: formatPrice(codFee) })}
                                </div>
                              )}
                            </Label>
                          </div>
                        )}
                      </RadioGroup>
                    </div>
                  )}
                  
                  {/* Payment section - different for direct sale vs preorder */}
                  {isDirectSaleCart ? (
                    <div className="py-3 px-4 rounded-lg border bg-primary/5 border-primary/30 space-y-2">
                      <div className="flex items-center gap-2 mb-1">
                        <Truck className="h-5 w-5 text-primary" />
                        <span className="font-bold text-primary">{t('cart_cod_title')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cart_cod_paid_on_receipt')}</p>
                      {hasRandomFilamentItems && (
                        <div className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-3 mt-2">
                          <div className="flex items-start gap-2">
                            <Wallet className="h-4 w-4 text-amber-500 mt-0.5 shrink-0" />
                            <div className="text-xs leading-relaxed flex-1">
                              <p className="font-bold text-amber-700 dark:text-amber-300">
                                الفلمنت العشوائي يُدفع من المحفظة فقط
                              </p>
                              <p className="text-muted-foreground mt-1">
                                لا يمكن إكمال الطلب بالدفع عند الاستلام لقيمة منتجات الفلمنت العشوائي.
                                ادفع قيمة المنتجات + التوصيل من المحفظة مسبقاً، أو أزل الفلمنت العشوائي لاستخدام الدفع عند الاستلام.
                              </p>
                              {(() => {
                                const required = (total || 0) + (deliveryFee || 0);
                                const shortage = Math.max(0, required - walletBalance);
                                if (shortage <= 0) return null;
                                return (
                                  <div className="mt-2 rounded-md border border-destructive/40 bg-destructive/10 p-2 space-y-1">
                                    <p className="text-[11px] font-bold text-destructive">
                                      ⚠️ رصيد المحفظة غير كافٍ لإتمام الطلب
                                    </p>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-muted-foreground">المطلوب (المنتجات + التوصيل):</span>
                                      <span className="font-bold text-foreground">{formatPrice(required)} د.ع</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-muted-foreground">رصيدك الحالي:</span>
                                      <span className="font-bold text-foreground">{formatPrice(walletBalance)} د.ع</span>
                                    </div>
                                    <div className="flex justify-between text-[11px]">
                                      <span className="text-destructive font-bold">العجز:</span>
                                      <span className="font-black text-destructive">{formatPrice(shortage)} د.ع</span>
                                    </div>
                                    <Button
                                      type="button"
                                      size="sm"
                                      className="w-full h-8 mt-1 text-[11px] gap-1"
                                      onClick={() => navigate('/wallet')}
                                    >
                                      <Wallet className="h-3 w-3" />
                                      شحن المحفظة الآن
                                    </Button>
                                  </div>
                                );
                              })()}
                              <div className="mt-2 space-y-1.5">
                                {items.filter((it: any) => it.is_random_filament).map((it: any) => (
                                  <div key={it.id} className="flex items-center justify-between gap-2 rounded-md bg-background/40 px-2 py-1.5">
                                    <span className="text-[11px] font-medium text-foreground truncate">
                                      🎲 {it.products?.name_ar || it.products?.name || 'فلمنت عشوائي'} × {it.quantity || 1}
                                    </span>
                                    <Button
                                      type="button"
                                      size="sm"
                                      variant="ghost"
                                      className="h-7 px-2 text-[11px] text-destructive hover:text-destructive hover:bg-destructive/10"
                                      onClick={() => wrapWithCartRequestCheck(() => removeFromCart(it.id))}
                                    >
                                      إزالة
                                    </Button>
                                  </div>
                                ))}
                              </div>
                            </div>
                          </div>
                        </div>
                      )}
                    </div>
                  ) : isCodPayment ? (
                    <div className="py-3 px-4 rounded-lg border bg-primary/5 border-primary/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-5 w-5 text-primary" />
                        <span className="font-bold text-primary">{t('cart_cod_title')}</span>
                      </div>
                      <p className="text-xs text-muted-foreground">{t('cart_cod_paid_on_receipt_no_wallet')}</p>
                    </div>
                  ) : (
                    <div className={`py-3 px-4 rounded-lg border ${hasEnoughBalance ? 'bg-card border-primary/30' : 'bg-card border-destructive/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className={`h-5 w-5 ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`} />
                        <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                          {t('cart_wallet_payment')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('cart_wallet_balance')}:</span>
                          <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                            {formatPrice(walletBalance)} {t('common_iqd')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('cart_wallet_required')}:</span>
                          <span className="font-bold text-foreground">{formatPrice(requiredPaymentNow)} {t('common_iqd')}</span>
                        </div>
                        {!hasEnoughBalance && (
                          <div className="mt-2 text-xs text-destructive">
                            {t('cart_wallet_charge_extra', { amount: formatPrice(requiredPaymentNow - walletBalance) })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
                  <div className="border-t border-border/40 pt-3 mt-3">
                    {hasPreOrderItems && preOrderPaymentOption === 'half' && (
                      <>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>{t('cart_half_label')}</span>
                          <span className="font-bold">{formatPrice(preOrderPaymentAmount)} {t('cart_iqd_short')}</span>
                        </div>
                        <div className="flex justify-between items-center text-sm text-amber-600 mb-2">
                          <span>{partialPaymentSettings?.fee_label_ar || t('cart_extra_fees')}</span>
                          <span className="font-bold">+{formatPrice(partialPaymentFee)} {t('cart_iqd_short')}</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>{t('cart_delivery')}</span>
                          <span className="font-bold">{formatPrice(deliveryFee)} {t('cart_iqd_short')}</span>
                        </div>
                        <div className="flex justify-between text-sm text-orange-500 mb-3">
                          <span>{t('cart_remaining_on_receipt')}</span>
                          <span className="font-bold">{formatPrice(remainingAmount)} {t('pd_currency_iqd')}</span>
                        </div>
                      </>
                    )}
                    {isCodPayment && (
                      <>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>{t('cart_products_value')}</span>
                          <span className="font-bold">{formatPrice(subtotalWithTax)} {t('cart_iqd_short')}</span>
                        </div>
                        {codFee > 0 && (
                          <div className="flex justify-between items-center text-sm text-amber-600 mb-2">
                            <span>{partialPaymentSettings?.cod_label_ar || t('cart_cod_fees_label')}</span>
                            <span className="font-bold">+{formatPrice(codFee)} {t('cart_iqd_short')}</span>
                          </div>
                        )}
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>{t('cart_delivery')}</span>
                          <span className="font-bold">{formatPrice(deliveryFee)} {t('cart_iqd_short')}</span>
                        </div>
                        <div className="flex justify-between text-sm text-orange-500 mb-3">
                          <span>{t('cart_total_on_receipt')}</span>
                          <span className="font-bold">{formatPrice(remainingAmount)} {t('pd_currency_iqd')}</span>
                        </div>
                      </>
                    )}
                    {referralOwnerEarnings > 0 && (
                      <div className="flex justify-between text-sm mb-2 text-amber-600 dark:text-amber-400">
                        <span className="flex items-center gap-1">
                          {t('cart_referral_support', { username: appliedReferral?.owner_username || '' })}
                        </span>
                        <span className="font-bold">+{formatPrice(referralOwnerEarnings)} {t('cart_iqd_short')}</span>
                      </div>
                    )}
                    <div className="flex justify-between text-xl font-black">
                      <span className="text-foreground">
                        {isCodPayment ? t('cart_required_now') : (hasPreOrderItems && preOrderPaymentOption === 'half' ? t('cart_preorder_required_now') : t('common_total'))}
                      </span>
                      <span className="text-primary"><AnimatedPrice value={grandTotal} formatFn={formatPrice} /> {t('pd_currency_iqd')}</span>
                    </div>
                    {useWalletBalance && walletDeduction > 0 && grandTotal === 0 && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        {t('cart_wallet_paid_full')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Terms and Conditions Checkbox */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="terms-checkbox"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor="terms-checkbox" className="text-xs text-muted-foreground cursor-pointer">
                    {t('cart_terms_agree')}{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsSheet(true);
                      }}
                      className="text-primary hover:underline"
                    >
                      {t('cart_terms_link')}
                    </button>
                  </label>
                </div>

                <Button 
                  className="w-full mb-3 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 disabled:from-primary/40 disabled:to-accent/40 disabled:text-primary-foreground/60"
                  size="lg"
                  onClick={handleCheckoutClick}
                  disabled={isCheckingOut || isDirectSaleProcessing || (!isDirectSaleCart && !hasEnoughBalance) || !termsAccepted || hasOutOfStockItems}
                >
                  {isCheckingOut || isDirectSaleProcessing ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      {t('cart_processing')}
                    </>
                  ) : hasOutOfStockItems ? (
                    <>
                      <Trash2 className="ml-2 h-4 w-4" />
                      {t('cart_remove_oos_first')}
                    </>
                  ) : !termsAccepted ? (
                    <>
                      <FileText className="ml-2 h-4 w-4" />
                      {t('cart_terms_accept_first')}
                    </>
                  ) : isDirectSaleCart ? (
                    <>
                      <Truck className="ml-2 h-4 w-4" />
                      {t('cart_checkout_cod')}
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <Wallet className="ml-2 h-4 w-4" />
                      {t('cart_wallet_insufficient')}
                    </>
                  ) : (
                    t('cart_confirm_order')
                  )}
                </Button>
                
                {!isDirectSaleCart && !hasEnoughBalance && (
                  <Button 
                    className="w-full mb-3 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    size="lg"
                    onClick={() => setShowWalletDialog(true)}
                  >
                    <Wallet className="ml-2 h-4 w-4" />
                    {t('cart_wallet_charge')}
                  </Button>
                )}

                <Link to="/">
                  <Button 
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowRight className="ml-2 h-4 w-4" />
                    {t('cart_continue_shopping')}
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('cart_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('cart_confirm_deduct', { amount: formatPrice(requiredPaymentNow) })}</p>
              <p className="text-sm text-muted-foreground">
                {t('cart_confirm_balance_after', { current: formatPrice(walletBalance), after: formatPrice(walletBalance - requiredPaymentNow) })}
              </p>
              {hasPreOrderItems && preOrderPaymentOption === 'half' && remainingAmount > 0 && (
                <p className="text-orange-600 text-sm">
                  {t('cart_confirm_remaining', { amount: formatPrice(remainingAmount) })}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={handleCheckout}
              className="bg-primary hover:bg-primary/90"
            >
              {t('common_confirm')}
            </AlertDialogAction>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cart Change Warning Dialog */}
      <AlertDialog open={showCartChangeWarning} onOpenChange={setShowCartChangeWarning}>
        <AlertDialogContent 
          dir="rtl" 
          className="bg-card border-destructive/30 max-w-[90vw] sm:max-w-lg z-[200]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t('cart_change_warning')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>{t('cart_change_warning_desc', { code: pendingCartRequest?.cart_code || '' })}</p>
              {pendingCartRequest?.adjusted_total && (
                <p className="text-orange-500">{t('cart_change_warning_price', { amount: formatPrice(pendingCartRequest.adjusted_total) })}</p>
              )}
              <p>{t('common_confirm')}?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-3 mt-4">
            <AlertDialogAction 
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmCartChange();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[48px] w-full sm:w-auto text-base"
            >
              {t('cart_change_confirm')}
            </AlertDialogAction>
            <AlertDialogCancel 
              onClick={(e) => {
                e.stopPropagation();
                setPendingAction(null);
              }}
              className="bg-muted text-foreground hover:bg-muted/80 min-h-[48px] w-full sm:w-auto text-base"
            >
              {t('common_cancel')}
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wallet Dialog */}
      <WalletDialog open={showWalletDialog} onOpenChange={setShowWalletDialog} />

      {/* Cart Request Dialog */}
      <CartRequestDialog 
        open={showCartRequestDialog} 
        onOpenChange={setShowCartRequestDialog}
        cartItems={items}
        total={total}
      />

      {/* Terms and Conditions Sheet */}
      <TermsAndConditionsSheet
        open={showTermsSheet}
        onOpenChange={setShowTermsSheet}
        onAccept={handleTermsAccepted}
        isLoading={isCheckingOut}
      />

      {/* Direct Sale Checkout Dialog */}
      <DirectSaleCheckoutDialog
        open={showDirectSaleDialog}
        onOpenChange={setShowDirectSaleDialog}
        onConfirm={handleDirectSaleCheckout}
        address={defaultUserAddress}
        totalAmount={total}
        deliveryFee={deliveryFee}
        itemCount={itemCount}
        isProcessing={isDirectSaleProcessing}
        walletBalance={walletBalance}
        hasActiveDirectOrders={(activeDirectOrders?.length || 0) > 0}
        forceWalletPayment={hasRandomFilamentItems}
      />

      {/* Order Success Animation */}
      <OrderSuccessAnimation
        open={showOrderSuccess}
        onClose={() => setShowOrderSuccess(false)}
        orderNumber={successOrderNumber}
        orderId={successOrderId}
        timeUntilCutoff={(() => {
          const now = new Date();
          const cutoff = new Date();
          cutoff.setHours(17, 0, 0, 0);
          if (now >= cutoff) return null;
          const ms = cutoff.getTime() - now.getTime();
          const h = Math.floor(ms / 3600000);
          const m = Math.floor((ms % 3600000) / 60000);
          return t('cart_time_h_m', { h, m });
        })()}
      />

      {/* Clear Cart Confirmation Dialog */}
      <AlertDialog open={showClearCartDialog} onOpenChange={setShowClearCartDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('cart_clear_confirm_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {t('cart_clear_confirm_desc', { count: itemCount })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('cart_clear_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearCart}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('cart_clear_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

    </div>
  );
};

export default Cart;