// @ts-nocheck
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useCart } from '@/hooks/useCart';
import { useProtectionDiscount, calculateProtectionDiscountedPrice } from '@/hooks/useProtectionDiscount';
import { useAuth } from '@/hooks/useAuth';
import { ShoppingCart, ArrowRight, Package, Truck, Heart, Minus, Plus, Star, Check, Clock, Tag, X, BoxIcon, Share2, Trash2, Bell, BellRing } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useMemo, useEffect, useRef } from 'react';
import { formatPrice, cn } from '@/lib/utils';
import { motion, LayoutGroup } from 'framer-motion';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import TaobaoLinkButton from '@/components/admin/TaobaoLinkButton';
import ProductRewardsSection from '@/components/ProductRewardsSection';
import PriceMatchForm from '@/components/PriceMatchForm';
import { useLanguage } from '@/lib/i18n';
import { useLocalizedProduct } from '@/hooks/useLocalizedProduct';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';
import { ensurePriceIqd, guardProductPrices, ensureAdjustmentIqd, computeLinkedDirectSalePrice, computeLinkedDirectSalePriceFromCostIqd, fetchLiveDirectSalePrices, fetchVariantDirectSalePrices, getCartItemVariantOverrideCostIqd, getDirectVariantPriceMapKey } from '@/lib/priceGuard';
import { computeUnifiedCardPrice, computeUnifiedCardOriginalPrice, assertCardDetailParity } from '@/lib/cardPrice';
import { useCodDefaults } from '@/hooks/useCodDefaults';
import LiveDirectPriceWarning from '@/components/LiveDirectPriceWarning';
import { Skeleton } from '@/components/ui/skeleton';
import { getColorSwatchStyle } from "@/lib/colorSwatch";
import { usePageTitle } from "@/island/usePageTitle";
import SEO from '@/components/SEO';
import { productLd, breadcrumbLd } from '@/lib/seo/structured';
import ProductAIContent from '@/components/ProductAIContent';
import { buildAIContentForLd, normalizeAIContent } from '@/lib/aiContent';

// Dynamic icon map for features
const FEATURE_ICONS: Record<string, any> = {
  Package, Truck, Star, Check, Clock, Tag, Heart,
};

const ProductDetailSkeleton = () => (
  <div className="min-h-screen" dir="rtl">
    {/* Full-width image skeleton */}
    <div className="relative">
      <Skeleton className="w-full aspect-square" />
      <div className="absolute top-4 right-4">
        <Skeleton className="w-9 h-9 rounded-xl" />
      </div>
    </div>
    {/* Content card */}
    <div className="px-4 -mt-6 relative z-10">
      <div className="glass-panel p-4 space-y-4">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-7 w-3/4" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-2/3" />
        <div className="flex gap-3 pt-4">
          <Skeleton className="h-10 w-28" />
          <Skeleton className="h-10 flex-1" />
        </div>
      </div>
    </div>
  </div>
);

const ProductDetail = () => {
  const { t, language } = useLanguage();
  const pickName = (en?: string | null, ar?: string | null) => (language === 'ar' ? (ar || en || '') : (en || ar || ''));
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { addToCart, forceAddToCart } = useCart();
  const [showSaleTypeConflict, setShowSaleTypeConflict] = useState(false);
  const [saleTypeConflictMessage, setSaleTypeConflictMessage] = useState<string | null>(null);
  const pendingAddRef = useRef<{ productId: string; optionId?: string; color?: string; quantity: number; shippingInfo?: { index: number; name_ar: string }; saleType: 'direct' | 'preorder' } | null>(null);
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorImageUrl, setColorImageUrl] = useState<string | null>(null);
  const [optionImageUrl, setOptionImageUrl] = useState<string | null>(null);
  const [selectedShippingOption, setSelectedShippingOption] = useState<number | null>(null);
  const [showFullDescription, setShowFullDescription] = useState(false);
  const [selectedSaleType, setSelectedSaleType] = useState<'direct' | 'preorder' | null>(null);
  const [userManuallySelected, setUserManuallySelected] = useState(false);
  const [notifyLoading, setNotifyLoading] = useState(false);
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1540;

  // Global COD default settings (shared hook with realtime sync — updates
  // instantly when admin changes COD %, so any product linked via
  // `link_direct_commission_to_cod` reflects the new price without reload).
  const { data: codDefaults } = useCodDefaults();
  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name, name_ar, name_en, name_ku, slug, description, description_ar, description_en, description_ku, price, original_price, category_id, image_url, images, colors, features, in_stock, featured, currency, availability_type, has_in_stock, has_pre_order, pre_order_shipping_options, points_reward, card_discounts, ticket_reward, price_usd, original_price_usd, shipping_type, is_pricing_updated, direct_sale_price, sea_price, air_price, land_price, round_up_price, sold_count, direct_stock, pre_order_stock, personal_delivery_cost, referral_earnings_iqd, cod_enabled, cod_fee_type, cod_fee_value, link_direct_commission_to_cod, ai_content, short_summary, searchable_attributes, taobao_url, categories!products_category_id_fkey(name_ar, name, name_ku)')
        .eq('slug', slug)
        .maybeSingle();
      if (data && !data.is_pricing_updated && !isAdmin) throw new Error('Product not found');
      if (error) throw error;
      if (!data) throw new Error('Product not found');
      return data;
    }
  });

  const { data: liveDirectPriceFromRpc } = useQuery({
    queryKey: ['product-live-direct-price', product?.id, product?.link_direct_commission_to_cod],
    staleTime: 60 * 1000,
    queryFn: async () => {
      if (!product?.id || !(product as any).link_direct_commission_to_cod) return null;
      return (await fetchLiveDirectSalePrices([product.id])).get(product.id) ?? null;
    },
    enabled: !!product?.id && !!(product as any).link_direct_commission_to_cod,
  });

  const selectedVariantCostIqd = useMemo(() => {
    if (!product) return null;
    const optionData = productOptions?.find((opt: any) => opt.id === selectedOption);
    return getCartItemVariantOverrideCostIqd({ products: product, sale_type: activeSaleType, selected_color: selectedColor, product_options: optionData }, usdToIqd);
  }, [product, productOptions, selectedColor, selectedOption, activeSaleType, usdToIqd]);

  const { data: liveVariantDirectMap } = useQuery({
    queryKey: ['product-variant-live-direct-price', product?.id, selectedVariantCostIqd, product?.link_direct_commission_to_cod],
    staleTime: 30 * 1000,
    queryFn: () => fetchVariantDirectSalePrices([{ productId: product!.id, costIqd: selectedVariantCostIqd! }]),
    enabled: !!product?.id && !!(product as any).link_direct_commission_to_cod && activeSaleType === 'direct' && !!selectedVariantCostIqd,
  });

  const { name: localizedName, description: localizedDescription } = useLocalizedProduct(product);
  const { discount: protectionDiscount } = useProtectionDiscount(product?.category_id);

  usePageTitle('product', localizedName || (product as any)?.name_ar || (product as any)?.name);

  const { data: allLoyaltyLevels } = useQuery({
    queryKey: ['membership-cards-for-discounts'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('id, name_ar, name_en, card_key, card_color, display_order')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-card', user?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('user_cards').select('*, membership_cards:card_id(id, name_ar, display_order)').eq('user_id', user.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) { console.error('Error fetching user card:', error); return null; }
      return data;
    },
    enabled: !!user
  });

  const { data: productOptions, isLoading: optionsLoading } = useQuery({
    queryKey: ['product-options', product?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!product) return [];
      const { data, error } = await supabase.from('product_options').select('*').eq('product_id', product.id).order('name_ar');
      if (error) throw error;
      // Dedupe by normalized name_ar to avoid duplicate options in UI
      const seen = new Map<string, any>();
      for (const opt of (data || [])) {
        const key = String(opt.name_ar ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').replace(/\s+/g, ' ').trim().toLowerCase();
        if (!key) { seen.set(`__noname_${opt.id}`, opt); continue; }
        const existing = seen.get(key);
        if (!existing) { seen.set(key, opt); continue; }
        // Prefer the one with higher stock_quantity, then with image, then newer
        const pickNew =
          (Number(opt.stock_quantity ?? 0) > Number(existing.stock_quantity ?? 0)) ||
          (Number(opt.stock_quantity ?? 0) === Number(existing.stock_quantity ?? 0) && !!opt.image_url && !existing.image_url);
        if (pickNew) seen.set(key, opt);
      }
      return Array.from(seen.values());
    },
    enabled: !!product
  });

  const { data: isFavorite, isLoading: favoriteLoading } = useQuery({
    queryKey: ['favorite', product?.id, user?.id],
    queryFn: async () => {
      if (!user || !product) return false;
      const { data, error } = await supabase.from('favorites').select('id').eq('user_id', user.id).eq('product_id', product.id).maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!product
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ['related-products', product?.category_id, product?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!product || !product.category_id) return [];
      const { data, error } = await supabase.from('products').select('id, name, name_ar, name_en, name_ku, slug, description, description_ar, description_en, description_ku, price, original_price, category_id, image_url, images, colors, in_stock, featured, currency, availability_type, has_in_stock, has_pre_order, direct_sale_price, sea_price, air_price, land_price, round_up_price, direct_stock, pre_order_stock, sold_count, points_reward, ticket_reward, link_direct_commission_to_cod, cod_enabled, cod_fee_type, cod_fee_value, shipping_type, price_usd, product_options(name_ar, price_adjustment, stock_quantity, available_for_direct_sale)').eq('category_id', product.category_id).eq('in_stock', true).neq('id', product.id).limit(4);
      if (error) throw error;
      return data || [];
    },
    enabled: !!product && !!product.category_id
  });

  // Live direct prices for related products (so cards never leak base price)
  const relatedLinkedIds = useMemo(
    () => (relatedProducts || [])
      .filter((p: any) => p.link_direct_commission_to_cod && (p.has_in_stock ?? false))
      .map((p: any) => p.id),
    [relatedProducts]
  );
  const { data: relatedLiveDirectMap } = useQuery({
    queryKey: ['related-live-direct-prices', relatedLinkedIds],
    queryFn: () => fetchLiveDirectSalePrices(relatedLinkedIds),
    enabled: relatedLinkedIds.length > 0,
    staleTime: 60 * 1000,
  });

  const { data: notifySubscriptions } = useQuery({
    queryKey: ['stock-notify', product?.id, user?.id],
    queryFn: async () => {
      if (!user || !product) return [];
      const { data } = await supabase.from('stock_notifications').select('id, selected_color, selected_option').eq('user_id', user.id).eq('product_id', product.id);
      return (data as any[]) || [];
    },
    enabled: !!user && !!product
  });

  const toggleFavoriteMutation = useMutation({
    mutationFn: async () => {
      if (!user || !product) throw new Error('User not authenticated');
      if (isFavorite) {
        const { error } = await supabase.from('favorites').delete().eq('user_id', user.id).eq('product_id', product.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('favorites').insert({ user_id: user.id, product_id: product.id });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite', product?.id, user?.id] });
      toast.success(isFavorite ? t('favorites_removed') : t('favorites_added'));
    },
    onError: (error: any) => {
      if (error.message === 'User not authenticated') { toast.error(t('product_login_required')); navigate('/auth'); }
      else toast.error(t('product_error_retry'));
    }
  });

  const rawHasDirectSale = product?.has_in_stock ?? false;
  const hasPreOrder = product?.has_pre_order ?? false;
  const hasOptionVariants = (productOptions?.length ?? 0) > 0;
  const hasColorVariants = Array.isArray(product?.colors) && (product?.colors as any[]).length > 0;

  // Check if colors have option_stocks (colors become primary stock source)
  const colorsHaveOptionStocks = useMemo(() => {
    if (!hasColorVariants) return false;
    const colors = Array.isArray(product?.colors) ? (product?.colors as any[]) : [];
    return colors.some((c: any) => c.option_stocks && typeof c.option_stocks === 'object' && Object.keys(c.option_stocks).length > 0);
  }, [hasColorVariants, product]);

  // Get total stock for a given option name across all colors
  const getOptionStockFromColors = (optionName: string): number => {
    if (!hasColorVariants || !optionName) return 0;
    const colors = Array.isArray(product?.colors) ? (product?.colors as any[]) : [];
    const normalizedName = (optionName ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').replace(/\s+/g, ' ').trim();
    let total = 0;
    for (const color of colors) {
      if ((color.available_for_direct_sale ?? true) === false) continue;
      const stocks = color.option_stocks;
      if (!stocks || typeof stocks !== 'object') continue;
      const matchingKey = Object.keys(stocks).find(
        (key) => (key ?? '').normalize('NFKC').replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '').replace(/\s+/g, ' ').trim() === normalizedName
      );
      if (matchingKey) total += Math.max(0, Number(stocks[matchingKey]) || 0);
    }
    return total;
  };

  const hasDirectOptionStock = useMemo(() => {
    if (!hasOptionVariants) return true;

    // If colors have option_stocks, colors are the stock source - ignore option-level stock
    if (colorsHaveOptionStocks) {
      return (productOptions || []).some((opt: any) => {
        if ((opt.available_for_direct_sale ?? true) === false) return false;
        return getOptionStockFromColors(opt.name_ar) > 0;
      });
    }

    return (productOptions || []).some((opt: any) => {
      if ((opt.available_for_direct_sale ?? true) === false) return false;
      if (opt.stock_quantity != null) return Number(opt.stock_quantity) > 0;
      // No stock data = out of stock (no unlimited concept)
      return false;
    });
  }, [hasOptionVariants, productOptions, colorsHaveOptionStocks, product]);

  const hasDirectColorStock = useMemo(() => {
    if (!hasColorVariants) return true;
    return !isAllDirectStockDepleted(product);
  }, [hasColorVariants, product]);

  const hasSimpleDirectStock = useMemo(() => {
    if (hasOptionVariants || hasColorVariants) return true;
    if ((product as any)?.direct_stock != null) return Number((product as any).direct_stock) > 0;
    return false;
  }, [hasOptionVariants, hasColorVariants, product]);

  const directStockDepleted = rawHasDirectSale && (!hasDirectOptionStock || !hasDirectColorStock || !hasSimpleDirectStock);
  // Keep direct sale visible even when depleted - just show as out of stock
  const hasDirectSale = rawHasDirectSale;
  const hasBothTypes = hasDirectSale && hasPreOrder;

  // Restore user's saved sale-type choice for this product (per-product persistence)
  useEffect(() => {
    if (!product?.id) return;
    try {
      const saved = localStorage.getItem(`product:${product.id}:saleType`);
      if (saved === 'direct' || saved === 'preorder') {
        setSelectedSaleType(saved);
        setUserManuallySelected(true);
      }
    } catch {}
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [product?.id]);

  const activeSaleType = useMemo(() => {
    if (selectedSaleType === 'direct' && !hasDirectSale) return hasPreOrder ? 'preorder' : 'direct';
    if (selectedSaleType === 'preorder' && !hasPreOrder) return hasDirectSale ? 'direct' : 'preorder';
    // Auto-switch direct → preorder when direct stock is depleted (only if user hasn't manually chosen direct)
    if (selectedSaleType === 'direct' && directStockDepleted && hasPreOrder && !userManuallySelected) return 'preorder';
    if (selectedSaleType) return selectedSaleType;
    // Default: prefer direct only when it has stock; otherwise fall back to preorder
    if (hasDirectSale && !directStockDepleted) return 'direct';
    if (hasPreOrder) return 'preorder';
    if (hasDirectSale) return 'direct';
    return 'direct';
  }, [selectedSaleType, hasDirectSale, hasPreOrder, directStockDepleted, userManuallySelected]);

  // Auto-select first available option when options load
  useEffect(() => {
    if (!productOptions || productOptions.length === 0 || selectedOption) return;
    const firstAvailable = productOptions.find((opt: any) => {
      const isAvailable = activeSaleType === 'direct' ? (opt.available_for_direct_sale ?? true) : (opt.available_for_pre_order ?? true);
      let passesStockCheck: boolean;
      if (activeSaleType === 'preorder') {
        passesStockCheck = true;
      } else if (colorsHaveOptionStocks) {
        passesStockCheck = getOptionStockFromColors(opt.name_ar) > 0;
      } else {
        passesStockCheck = opt.stock_quantity != null ? Number(opt.stock_quantity) > 0 : false;
      }
      return isAvailable && passesStockCheck;
    });
    if (firstAvailable) {
      setSelectedOption(firstAvailable.id);
      if (firstAvailable.image_url) {
        setOptionImageUrl(firstAvailable.image_url);
        setSelectedImage(0);
      }
    }
  }, [productOptions, activeSaleType, colorsHaveOptionStocks]);

  const selectedOptionData = productOptions?.find((opt: any) => opt.id === selectedOption);
  const selectedOptionName = selectedOptionData?.name_ar;

  const isNotifySubscribed = useMemo(() => {
    if (!notifySubscriptions || notifySubscriptions.length === 0) return false;
    return notifySubscriptions.some((s: any) => 
      (s.selected_color || null) === (selectedColor || null) &&
      (s.selected_option || null) === (selectedOptionName || null)
    );
  }, [notifySubscriptions, selectedColor, selectedOptionName]);

  if (isLoading) return <ProductDetailSkeleton />;

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-foreground mb-4">{t('product_not_found')}</h2>
          <Button onClick={() => navigate('/')}>{t('product_back_home')}</Button>
        </div>
      </div>
    );
  }

  const getProductImages = () => {
    if (optionImageUrl) return [optionImageUrl];
    if (colorImageUrl) return [colorImageUrl];
    return product.images && product.images.length > 0 ? product.images : product.image_url ? [product.image_url] : [];
  };
  const productImages = getProductImages();
  const currency = product.currency || t('pd_currency_iqd');


  const allColors = Array.isArray(product.colors) ? (product.colors as any[]) : [];
  const normalizeOptionValue = (value?: string | null) =>
    (value ?? '')
      .normalize('NFKC')
      .replace(/[\u200B-\u200D\uFEFF\u200E\u200F]/g, '')
      .replace(/\s+/g, ' ')
      .trim();

  const getColorStockForOption = (color: any, optionName?: string | null): number | null => {
    if (!optionName || !color?.option_stocks || typeof color.option_stocks !== 'object') return null;

    const normalizedOptionName = normalizeOptionValue(optionName);
    const matchingKey = Object.keys(color.option_stocks).find(
      (key) => normalizeOptionValue(key) === normalizedOptionName
    );

    if (!matchingKey) return null;

    const stockValue = Number(color.option_stocks[matchingKey]);
    return Number.isFinite(stockValue) ? stockValue : 0;
  };

  const hasAnyColorStock = (color: any): boolean => {
    if (color?.option_stocks && typeof color.option_stocks === 'object' && Object.keys(color.option_stocks).length > 0) {
      return Object.values(color.option_stocks as Record<string, unknown>).some((value) => Number(value) > 0);
    }

    if (color?.stock_quantity != null) {
      return Number(color.stock_quantity) > 0;
    }

    // No concrete stock data available — do NOT assume in-stock
    return false;
  };

  const getFilteredColors = () => {
    const normalizedSelectedOption = normalizeOptionValue(selectedOptionName);
    const preorderOptions = Array.isArray(productOptions)
      ? productOptions.filter((opt: any) => (opt.available_for_pre_order ?? true))
      : [];

    const normalizedPreorderOptionNames = preorderOptions.map((opt: any) => normalizeOptionValue(opt.name_ar));

    const getCompatiblePreOrderOptionId = (normalizedLinkedOptions: string[]) => {
      const matched = preorderOptions.find((opt: any) => normalizedLinkedOptions.includes(normalizeOptionValue(opt.name_ar)));
      return matched?.id ?? null;
    };

    return allColors.map(color => {
      const linkedOptions = color.linked_options as string[] | undefined;
      const normalizedLinkedOptions = Array.isArray(linkedOptions)
        ? linkedOptions.map((option) => normalizeOptionValue(option)).filter(Boolean)
        : [];

      const isLinkedToOption = activeSaleType === 'preorder'
        ? (normalizedLinkedOptions.length === 0 || normalizedLinkedOptions.some((option) => normalizedPreorderOptionNames.includes(option)))
        : (normalizedLinkedOptions.length === 0 || !normalizedSelectedOption
            ? true
            : normalizedLinkedOptions.includes(normalizedSelectedOption));

      const compatiblePreOrderOptionId = activeSaleType === 'preorder' && normalizedLinkedOptions.length > 0
        ? getCompatiblePreOrderOptionId(normalizedLinkedOptions)
        : null;

      // Smart stock check: for direct sale, option_stocks is the SOURCE OF TRUTH
      let isInStock = true;
      let hasActualStock = false; // Track if we found real stock data
      if (activeSaleType === 'direct') {
        const selectedOptionStock = getColorStockForOption(color, selectedOptionName);

        if (selectedOptionStock != null) {
          isInStock = selectedOptionStock > 0;
          hasActualStock = selectedOptionStock > 0;
        } else if (color.option_stocks && Object.keys(color.option_stocks).length > 0) {
          // If an option is selected but not found in option_stocks, this color is out of stock for that option
          if (normalizedSelectedOption) {
            isInStock = false;
          } else {
            const anyStock = hasAnyColorStock(color);
            isInStock = anyStock;
            hasActualStock = anyStock;
          }
        } else if (color.stock_quantity != null) {
          isInStock = Number(color.stock_quantity) > 0;
          hasActualStock = Number(color.stock_quantity) > 0;
        } else {
          isInStock = color.in_stock !== false;
        }
      }

      // For direct sale: if there's ACTUAL stock data proving availability,
      // override available_for_direct_sale flag (stock is source of truth)
      const isAvailableForType = activeSaleType === 'direct'
        ? (hasActualStock ? true : (color.available_for_direct_sale ?? true))
        : (color.available_for_pre_order ?? true);

      // For direct sale with actual stock, also override linked_options check
      const effectiveIsLinkedToOption = (activeSaleType === 'direct' && hasActualStock) ? true : isLinkedToOption;

      return {
        ...color,
        isAvailable: isAvailableForType && effectiveIsLinkedToOption && isInStock,
        isLinkedToOption: effectiveIsLinkedToOption,
        compatiblePreOrderOptionId,
      };
    });
  };
  const filteredColors = getFilteredColors().sort((a: any, b: any) => {
    // Only sort/reorder in direct sale mode (stock-based ordering)
    if (activeSaleType !== 'direct') return 0;
    // Sort by availability first
    if (a.isAvailable && !b.isAvailable) return -1;
    if (!a.isAvailable && b.isAvailable) return 1;
    // Then by stock quantity (highest first)
    const stockA = getColorStockForOption(a, selectedOptionName) ?? (a.stock_quantity ?? 0);
    const stockB = getColorStockForOption(b, selectedOptionName) ?? (b.stock_quantity ?? 0);
    return Number(stockB || 0) - Number(stockA || 0);
  });

  const selectedColorData = allColors.find((c: any) => c.name_ar === selectedColor);
  // Guard all product prices through USD→IQD safeguard
  const guardedPrices = guardProductPrices(product as any, usdToIqd);

  // If the product is linked to global COD %, recompute direct_sale_price live
  // so it adjusts with exchange rate / sea shipping / COD setting changes.
  const liveDirectSalePrice = liveDirectPriceFromRpc ?? computeLinkedDirectSalePrice(
    product as any,
    shippingSettings as any,
    codDefaults as any,
  );
  if (liveDirectSalePrice != null) {
    guardedPrices.direct_sale_price = liveDirectSalePrice;
  }

  const getSaleTypeBasePrice = () => {
    if (activeSaleType === 'direct') {
      if (guardedPrices.direct_sale_price != null) return guardedPrices.direct_sale_price;
    }
    if (activeSaleType === 'preorder') {
      const shippingType: string = (product as any).shipping_type || '';
      const tokens = shippingType === 'both' ? ['sea', 'air'] : shippingType.split(',').map((t: string) => t.trim()).filter(Boolean);
      // Single mode — use that mode's price directly
      if (tokens.length === 1) {
        const t = tokens[0];
        if (t === 'sea' && guardedPrices.sea_price != null) return guardedPrices.sea_price;
        if (t === 'air' && guardedPrices.air_price != null) return guardedPrices.air_price;
        if (t === 'land' && (guardedPrices as any).land_price != null) return (guardedPrices as any).land_price;
      } else if (tokens.length > 1) {
        // Multi mode — base is the cheapest option, adjustments handle the rest
        const opts: number[] = [];
        if (tokens.includes('sea') && guardedPrices.sea_price != null) opts.push(guardedPrices.sea_price);
        if (tokens.includes('air') && guardedPrices.air_price != null) opts.push(guardedPrices.air_price);
        if (tokens.includes('land') && (guardedPrices as any).land_price != null) opts.push((guardedPrices as any).land_price);
        if (opts.length > 0) return Math.min(...opts);
      }
    }
    return guardedPrices.price;
  };

  const basePrice = getSaleTypeBasePrice();
  let shippingAdjustment = 0;
  if (activeSaleType === 'preorder' && selectedShippingOption !== null && Array.isArray(product.pre_order_shipping_options) && product.pre_order_shipping_options[selectedShippingOption]) {
    shippingAdjustment = Number((product.pre_order_shipping_options[selectedShippingOption] as any).price_adjustment || 0);
  }
  let variantPrice = basePrice;
  if (selectedVariantCostIqd != null) {
    if (activeSaleType === 'direct' && (product as any).link_direct_commission_to_cod && codDefaults) {
      const serverVariant = liveVariantDirectMap?.get(getDirectVariantPriceMapKey((product as any).id, selectedVariantCostIqd));
      const localVariant = computeLinkedDirectSalePriceFromCostIqd(
        product as any,
        selectedVariantCostIqd,
        { usd_to_iqd_rate: usdToIqd } as any,
        codDefaults as any,
      );
      variantPrice = serverVariant && serverVariant > 0 ? serverVariant : (localVariant ?? selectedVariantCostIqd);
    } else {
      variantPrice = selectedVariantCostIqd;
    }
  }
  const rawFinalPrice = variantPrice + shippingAdjustment;
  const shouldRoundUp = (product as any).round_up_price === true;
  const finalPrice = shouldRoundUp ? Math.ceil(rawFinalPrice / 250) * 250 : rawFinalPrice;

  let finalOriginalPrice: number | null = null;
  if (guardedPrices.original_price != null) {
    const productOriginal = guardedPrices.original_price;
    const rawOriginal = selectedVariantCostIqd != null ? rawFinalPrice : productOriginal;
    finalOriginalPrice = shouldRoundUp ? Math.ceil(rawOriginal / 250) * 250 : rawOriginal;
  }
  const hasSale = finalOriginalPrice != null && finalOriginalPrice > finalPrice;
  const savings = hasSale && finalOriginalPrice != null ? (finalOriginalPrice - finalPrice) : 0;

  // Dev-only parity check (inline, no hook — runs after early returns are passed).
  if (import.meta.env.DEV && product) {
    const productForCard = { ...product, product_options: productOptions || [] };
    const liveMap = new Map<string, number>();
    if (liveDirectPriceFromRpc != null && product?.id) liveMap.set(product.id, liveDirectPriceFromRpc);
    assertCardDetailParity(
      productForCard,
      usdToIqd,
      codDefaults,
      liveMap,
      finalPrice,
      finalOriginalPrice,
    );
  }

  const directStockQuantity = selectedColorData
    ? (getColorStockForOption(selectedColorData, selectedOptionName) ?? selectedColorData.stock_quantity)
    : undefined;
  const hasStockInfo = activeSaleType === 'direct' && directStockQuantity != null && directStockQuantity > 0;

  const handleAddToCart = async () => {
    // Block if options exist but still loading
    if (optionsLoading) { toast.error(t('pd_loading_options')); return; }

    // If direct stock is fully depleted, force fallback to preorder when available
    if (activeSaleType === 'direct' && directStockDepleted) {
      if (hasPreOrder) {
        setSelectedSaleType('preorder');
        toast.info(t('pd_direct_depleted_switched'));
      } else {
        toast.error(t('product_out_of_stock'));
      }
      return;
    }

    const availableOptions = filteredOptions.filter((opt: any) => opt.isAvailable);

    // Block if options exist but none selected
    if (productOptions && productOptions.length > 0 && !selectedOption) { toast.error(t('product_select_option')); return; }

    // In direct sale: no available options means out of stock for direct sale
    if (activeSaleType === 'direct' && filteredOptions.length > 0 && availableOptions.length === 0) {
      if (hasPreOrder) {
        setSelectedSaleType('preorder');
        toast.info(t('pd_no_direct_options_switched'));
      } else {
        toast.error(t('product_out_of_stock'));
      }
      return;
    }

    const selectedOptionState = selectedOption
      ? filteredOptions.find((opt: any) => opt.id === selectedOption)
      : null;

    if (selectedOptionState && !selectedOptionState.isAvailable) {
      if (activeSaleType === 'direct' && hasPreOrder) {
        setSelectedSaleType('preorder');
        toast.info(t('pd_option_unavailable_switched'));
      } else {
        toast.error(t('product_out_of_stock'));
      }
      return;
    }

    // Block if colors exist but none selected
    const availableColors = filteredColors.filter((c: any) => c.isAvailable);

    if (activeSaleType === 'direct' && filteredColors.length > 0 && availableColors.length === 0) {
      if (hasPreOrder) {
        setSelectedSaleType('preorder');
        toast.info(t('pd_no_color_stock_switched'));
      } else {
        toast.error(t('product_out_of_stock'));
      }
      return;
    }

    if (availableColors.length > 0 && !selectedColor) { toast.error(t('pd_select_color')); return; }

    const selectedColorState = selectedColor
      ? filteredColors.find((c: any) => c.name_ar === selectedColor)
      : null;

    if (selectedColorState && !selectedColorState.isAvailable) {
      if (activeSaleType === 'direct' && hasPreOrder) {
        setSelectedSaleType('preorder');
        toast.info(t('pd_color_unavailable_switched'));
      } else {
        toast.error(t('product_out_of_stock'));
      }
      return;
    }
    const preOrderShippingOptions = Array.isArray(product.pre_order_shipping_options) ? product.pre_order_shipping_options : [];
    // Build fallback options same as in the UI
    const fallbackOpts: any[] = [];
    if (preOrderShippingOptions.length === 0 && activeSaleType === 'preorder') {
      const st: string = (product as any).shipping_type || '';
      const tokens = st === 'both' ? ['sea', 'air'] : st.split(',').map((t: string) => t.trim()).filter(Boolean);
      const seaP = Number((product as any).sea_price || 0);
      const airP = Number((product as any).air_price || 0);
      const landP = Number((product as any).land_price || 0);
      const activePrices: number[] = [];
      if (tokens.includes('sea') && seaP > 0) activePrices.push(seaP);
      if (tokens.includes('air') && airP > 0) activePrices.push(airP);
      if (tokens.includes('land') && landP > 0) activePrices.push(landP);
      const base = activePrices.length > 0 ? Math.min(...activePrices) : 0;
      if (tokens.includes('sea') && seaP > 0) fallbackOpts.push({ name_ar: t('pd_shipping_sea'), price_adjustment: seaP - base, type: 'sea' });
      if (tokens.includes('air') && airP > 0) fallbackOpts.push({ name_ar: t('pd_shipping_air'), price_adjustment: airP - base, type: 'air' });
      if (tokens.includes('land') && landP > 0) fallbackOpts.push({ name_ar: t('pd_shipping_land'), price_adjustment: landP - base, type: 'land' });
    }
    const allShippingOpts = preOrderShippingOptions.length > 0 ? preOrderShippingOptions : fallbackOpts;
    if (activeSaleType === 'preorder' && allShippingOpts.length > 1 && selectedShippingOption === null) {
      toast.error(t('product_choose_shipping'));
      return;
    }
    const shippingInfo = selectedShippingOption !== null && allShippingOpts[selectedShippingOption]
      ? {
          index: selectedShippingOption,
          name_ar: (allShippingOpts[selectedShippingOption] as any).name_ar,
          type: (allShippingOpts[selectedShippingOption] as any).type,
        }
      : undefined;
    try {
      const success = await addToCart(product.id, selectedOption || undefined, selectedColor || undefined, quantity, shippingInfo, activeSaleType);
      if (success) {
        toast.success(t('product_added_to_cart').replace('{count}', String(quantity)));
        setQuantity(1);
      }
    } catch (err: any) {
      if (err?.message === 'SALE_TYPE_CONFLICT') {
        pendingAddRef.current = { productId: product.id, optionId: selectedOption || undefined, color: selectedColor || undefined, quantity, shippingInfo, saleType: activeSaleType };
        setSaleTypeConflictMessage(err?.conflict?.messageAr || null);
        setShowSaleTypeConflict(true);
      } else {
        console.error('Add to cart error:', err);
        toast.error(err?.message || t('product_error_retry'));
      }
    }
  };

  const handleForceAdd = async () => {
    const p = pendingAddRef.current;
    if (!p) return;
    setShowSaleTypeConflict(false);
    const success = await forceAddToCart(p.productId, p.optionId, p.color, p.quantity, p.shippingInfo, p.saleType);
    if (success) {
      toast.success(t('pd_cart_cleared_added'));
      setQuantity(1);
    }
    pendingAddRef.current = null;
  };

  const handleToggleFavorite = () => { toggleFavoriteMutation.mutate(); };
  const incrementQuantity = () => { setQuantity(prev => prev + 1); };
  const decrementQuantity = () => { if (quantity > 1) setQuantity(prev => prev - 1); };

  const handleSaleTypeChange = (type: string) => {
    const t = type as 'direct' | 'preorder';
    setSelectedSaleType(t);
    setUserManuallySelected(true);
    try {
      if (product?.id) localStorage.setItem(`product:${product.id}:saleType`, t);
    } catch {}
    setSelectedColor(null);
    setColorImageUrl(null);
    setSelectedShippingOption(null);
  };

  const getFilteredOptions = () => {
    if (!productOptions) return [];
    return productOptions.map((option: any) => {
      const isAvailableForType = activeSaleType === 'direct' ? (option.available_for_direct_sale ?? true) : (option.available_for_pre_order ?? true);
      let passesStockCheck: boolean;
      if (activeSaleType === 'preorder') {
        passesStockCheck = true;
      } else if (colorsHaveOptionStocks) {
        // Colors are the primary stock source - ignore option's own stock_quantity
        const colorStock = getOptionStockFromColors(option.name_ar);
        passesStockCheck = colorStock > 0;
      } else {
        passesStockCheck = option.stock_quantity != null ? Number(option.stock_quantity) > 0 : false;
      }
      // Attach computed stock for display
      const computedDirectStock = colorsHaveOptionStocks ? getOptionStockFromColors(option.name_ar) : option.stock_quantity;
      return { ...option, isAvailable: isAvailableForType && passesStockCheck, computedDirectStock };
    });
  };
  const filteredOptions = getFilteredOptions();
  const isAvailableForCurrentSaleType = activeSaleType === 'preorder' ? hasPreOrder : (hasDirectSale && !directStockDepleted);

  const handleNotifyMe = async () => {
    if (!user) { toast.error(t('pd_login_required')); navigate('/auth'); return; }
    const notifyColor = selectedColor || null;
    const notifyOption = selectedOptionName || null;
    setNotifyLoading(true);
    try {
      if (isNotifySubscribed) {
        // Unsubscribe
        let q = supabase.from('stock_notifications').delete().eq('user_id', user.id).eq('product_id', product.id);
        if (notifyColor) q = q.eq('selected_color', notifyColor);
        else q = q.is('selected_color', null);
        if (notifyOption) q = q.eq('selected_option', notifyOption);
        else q = q.is('selected_option', null);
        const { error } = await q;
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['stock-notify'] });
        toast.success(t('pd_notify_cancelled'));
      } else {
        // Subscribe
        const { error } = await supabase.from('stock_notifications').insert({
          user_id: user.id,
          product_id: product.id,
          selected_color: notifyColor || null,
          selected_option: notifyOption || null,
        } as any);
        if (error) throw error;
        queryClient.invalidateQueries({ queryKey: ['stock-notify'] });
        toast.success(t('pd_notify_subscribed'));
      }
    } catch (err) {
      console.error(err);
      toast.error(t('pd_generic_error'));
    } finally {
      setNotifyLoading(false);
    }
  };

  const seoName = pickName(product.name, product.name_ar);
  const seoDesc = pickName(product.description, product.description_ar) || seoName;
  const seoUrl = `https://levonisiq.com/product/${product.slug || product.id}`;
  const seoImages = (product.images && product.images.length > 0
    ? product.images
    : product.image_url
    ? [product.image_url]
    : []
  ).filter(Boolean).slice(0, 6);
  const inStockSeo = !!(product.in_stock || product.has_in_stock || product.has_pre_order);
  const aiContentNorm = normalizeAIContent((product as any).ai_content);
  const aiLd = buildAIContentForLd(aiContentNorm, (language || 'ar') as any);
  const shortSummaryRaw = (product as any).short_summary || {};
  const shortSummary = (shortSummaryRaw[language] || shortSummaryRaw.ar || shortSummaryRaw.en || shortSummaryRaw.ku || '').toString().trim();
  const searchableAttrs: string[] = Array.isArray((product as any).searchable_attributes)
    ? ((product as any).searchable_attributes as string[]).filter(Boolean)
    : [];
  const baseDesc = shortSummary || seoDesc;
  const seoDescFinal = (aiLd.descriptionAppendix
    ? `${baseDesc} — ${aiLd.descriptionAppendix}`
    : baseDesc) || seoName;

  return (
    <div className="min-h-screen" dir="rtl">
      <SEO
        title={seoName}
        description={(seoDescFinal || '').slice(0, 158)}
        url={seoUrl}
        type="product"
        image={seoImages[0]}
        keywords={searchableAttrs}
        jsonLd={[
          productLd({
            name: seoName,
            description: seoDescFinal,
            image: seoImages,
            sku: product.sku || product.id,
            brand: product.brand || 'LEVONIS',
            priceIqd: Number(product.price) || null,
            inStock: inStockSeo,
            url: seoUrl,
            category: product.category_name_ar || product.category_name || null,
            additionalProperty: aiLd.additionalProperty,
            keywords: searchableAttrs,
          }),
          breadcrumbLd([
            { name: language === 'en' ? 'Home' : language === 'ku' ? 'سەرەکی' : 'الرئيسية', url: '/' },
            { name: seoName, url: `/product/${product.slug || product.id}` },
          ]),
        ]}
      />
      {/* Full-width image section (mobile) / grid (desktop) */}
      <div className="md:container md:mx-auto md:px-4 md:pt-6">
        <div className="md:grid md:grid-cols-2 md:gap-8">
          {/* Image */}
          <div className="relative md:sticky md:top-6 md:self-start">
            {/* Back button moved to Dynamic Island */}

            {/* Sale badge */}
            {hasSale && finalOriginalPrice && (
              <div className="absolute top-4 left-4 z-20 bg-destructive text-destructive-foreground px-3 py-1 rounded-xl text-xs font-black shadow-md">
                خصم {Math.round((savings / Number(finalOriginalPrice)) * 100)}%
              </div>
            )}

            {productImages.length > 0 ? (
              <>
                {productImages.length > 1 ? (
                  <Carousel opts={{ loop: true, direction: 'rtl' }} className="w-full"
                    setApi={(api) => { api?.on('select', () => setSelectedImage(api.selectedScrollSnap())); }}>
                    <CarouselContent className="-ml-0">
                      {productImages.map((img, idx) => (
                        <CarouselItem key={idx} className="pl-0">
                          <div className="aspect-square overflow-hidden md:rounded-2xl bg-muted">
                            <img src={img} alt={`${product.name_ar} - ${idx + 1}`} className="w-full h-full object-cover bg-background text-inherit" loading="lazy" decoding="async" draggable={false} />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="right-2 left-auto h-9 w-9 glass-trigger hidden md:flex" />
                    <CarouselNext className="left-2 right-auto h-9 w-9 glass-trigger hidden md:flex" />
                  </Carousel>
                ) : (
                  <div className="aspect-square overflow-hidden md:rounded-2xl bg-muted">
                    <img src={productImages[0]} alt={product.name_ar} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  </div>
                )}

                {/* Dots */}
                {productImages.length > 1 && (
                  <div className="flex justify-center gap-1.5 py-2 md:py-3">
                    {productImages.map((_, idx) => (
                      <button
                        key={idx}
                        onClick={() => setSelectedImage(idx)}
                        className={cn("h-1.5 rounded-full transition-all", selectedImage === idx ? 'bg-primary w-5' : 'bg-border w-1.5')}
                      />
                    ))}
                  </div>
                )}

                {/* Desktop thumbnails */}
                {productImages.length > 1 && (
                  <div className="hidden md:grid grid-cols-5 gap-2 mt-2">
                    {productImages.map((img, idx) => (
                      <button key={idx} onClick={() => setSelectedImage(idx)}
                        className={cn("aspect-square rounded-xl overflow-hidden border-2 transition-all", selectedImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-border/30 hover:border-primary/50')}>
                        <img src={img} alt="" className="w-full h-full object-cover" loading="lazy" decoding="async" />
                      </button>
                    ))}
                  </div>
                )}

                {!isAvailableForCurrentSaleType && (
                  <div className="absolute inset-0 bg-background/70 flex items-center justify-center md:rounded-2xl">
                    <Badge variant="destructive" className="text-base px-5 py-2">{t('product_out_of_stock')}</Badge>
                  </div>
                )}
              </>
            ) : (
              <div className="aspect-square bg-muted flex items-center justify-center md:rounded-2xl">
                <Package className="w-20 h-20 text-muted-foreground/20" />
              </div>
            )}
          </div>

          {/* Product Info - Overlap card on mobile */}
          <div className="relative z-10 px-4 -mt-5 md:mt-0 md:px-0 pb-40 md:pb-12">
            <div className="glass-panel p-4 md:p-6 space-y-4 md:border-0 md:bg-transparent md:backdrop-blur-none md:shadow-none md:p-0">
              {/* Desktop back removed — handled by Dynamic Island */}

              {/* Category */}
              {product.categories && (
                <Badge variant="outline" className="text-[11px] rounded-lg">
                  {language === 'en' ? (product as any).categories.name : language === 'ku' ? ((product as any).categories.name_ku || (product as any).categories.name_ar) : (product as any).categories.name_ar}
                </Badge>
              )}

              {/* Title */}
              <h1 className="text-xl md:text-2xl font-black text-foreground leading-tight flex items-center gap-2">
                {localizedName}
                {isAdmin && (product as any).taobao_url && <TaobaoLinkButton taobaoUrl={(product as any).taobao_url} />}
              </h1>

              {/* Sold Count */}
              {(product as any).sold_count > 0 && (
                <div className="flex items-center gap-1.5">
                  <span className="text-xs text-muted-foreground bg-muted/50 px-2 py-0.5 rounded-full">
                    {t('pd_units_sold_count', { count: (product as any).sold_count })}
                  </span>
                </div>
              )}

              {/* Description */}
              {localizedDescription && (
                <div className="text-muted-foreground text-sm leading-relaxed">
                  <p className={!showFullDescription && localizedDescription.length > 150 ? 'line-clamp-2' : ''}>
                    {localizedDescription}
                  </p>
                  {localizedDescription.length > 150 && (
                    <button onClick={() => setShowFullDescription(!showFullDescription)} className="text-primary text-xs mt-1 font-bold">
                      {showFullDescription ? t('product_show_less') : t('product_show_more')}
                    </button>
                  )}
                </div>
              )}

              {/* Price section */}
              <div className="glass-tile rounded-xl p-3">
                {/* Live direct-sale price diagnostic — visible only when the
                    product is linked to global COD% but inputs are missing. */}
                {(product as any).link_direct_commission_to_cod && (
                  <LiveDirectPriceWarning
                    hasIssue={liveDirectSalePrice == null}
                    diagnostics={{
                      price_usd: (product as any).price_usd,
                      usd_to_iqd_rate: shippingSettings?.usd_to_iqd_rate,
                      cod_value: codDefaults?.value,
                      cod_type: codDefaults?.type,
                    }}
                    onRetry={async () => {
                      await Promise.all([
                        queryClient.invalidateQueries({ queryKey: ['product', slug] }),
                        queryClient.invalidateQueries({ queryKey: ['cod-default-settings-global'] }),
                        queryClient.invalidateQueries({ queryKey: ['shipping-settings'] }),
                      ]);
                    }}
                  />
                )}
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-black text-primary">{formatPrice(finalPrice)}</span>
                  <span className="text-sm text-muted-foreground">{currency}</span>
                  {product.original_price != null && Number(product.original_price) > 0 && (
                    <span className="text-sm line-through text-muted-foreground/50">
                      {Number(product.original_price).toLocaleString()} iq
                    </span>
                  )}
                </div>
                {/* Protection Plan Discount Badge */}
                {protectionDiscount && protectionDiscount.discountValue > 0 && (
                  <div className="mt-2 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2">
                    <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400">
                      <Tag className="h-3.5 w-3.5" />
                      <span className="text-xs font-bold">
                        {t('pd_protection_discount_for', { plan: protectionDiscount.planNameAr })}
                      </span>
                    </div>
                    <div className="flex items-baseline gap-2 mt-1">
                      <span className="text-lg font-black text-emerald-600 dark:text-emerald-400">
                        {formatPrice(calculateProtectionDiscountedPrice(finalPrice, protectionDiscount))}
                      </span>
                      <span className="text-xs text-muted-foreground">{currency}</span>
                      <span className="text-xs line-through text-muted-foreground/50">{formatPrice(finalPrice)}</span>
                      {protectionDiscount.discountType === 'fixed'
                        ? <Badge variant="secondary" className="text-[10px]">-{formatPrice(protectionDiscount.discountValue)}</Badge>
                        : <Badge variant="secondary" className="text-[10px]">-{protectionDiscount.discountValue}%</Badge>
                      }
                    </div>
                    <p className="text-[10px] text-muted-foreground mt-1">
                      {protectionDiscount.canUse
                        ? (protectionDiscount.limitType === 'weekly' ? t('pd_remaining_uses_weekly', { count: protectionDiscount.limitCount - protectionDiscount.usedCount }) : t('pd_remaining_uses_monthly', { count: protectionDiscount.limitCount - protectionDiscount.usedCount }))
                        : (protectionDiscount.limitType === 'weekly' ? t('pd_limit_reached_weekly') : t('pd_limit_reached_monthly'))
                      }
                    </p>
                  </div>
                )}
                {hasStockInfo && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <BoxIcon className="h-3 w-3" />
                    {t('pd_remaining_pieces', { count: directStockQuantity })}
                  </p>
                )}
                {directStockDepleted && activeSaleType === 'direct' && (
                  <div className="mt-2 space-y-2">
                    <Badge variant="destructive" className="text-xs">{t('pd_unavailable_now')}</Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      className="w-full gap-2 text-xs font-bold"
                      onClick={handleNotifyMe}
                      disabled={notifyLoading}
                    >
                      {isNotifySubscribed ? (
                        <><BellRing className="h-3.5 w-3.5" /> {t('pd_cancel_notify')}</>
                      ) : (
                        <><Bell className="h-3.5 w-3.5" /> {t('pd_notify_me')}</>
                      )}
                    </Button>
                  </div>
                )}
              </div>

              {/* Sale Type Tabs */}
              {hasBothTypes && (
                <Tabs value={activeSaleType} onValueChange={handleSaleTypeChange}>
                  <TabsList className="w-full grid grid-cols-2 h-11 rounded-xl p-1 glass-tile">
                    <TabsTrigger value="direct" className="rounded-lg gap-1.5 text-xs font-black transition-all data-[state=active]:shadow-[0_4px_12px_hsl(var(--primary)/0.25),inset_0_1px_0_hsl(var(--primary-glow)/0.3)] bg-card text-primary text-center">
                      <Package className="h-3.5 w-3.5" />{t('product_direct_sale')}
                    </TabsTrigger>
                    <TabsTrigger value="preorder" className="rounded-lg gap-1.5 text-xs font-black transition-all data-[state=active]:shadow-[0_4px_12px_hsl(var(--primary)/0.25),inset_0_1px_0_hsl(var(--primary-glow)/0.3)] bg-card text-primary text-center">
                      <Clock className="h-3.5 w-3.5" />{t('product_pre_order')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* Accordion sections */}
              <Accordion type="multiple" defaultValue={['shipping', 'options', 'colors']} className="space-y-2">
                {/* Shipping Options */}
                {activeSaleType === 'preorder' && (() => {
                  const preOrderOpts = Array.isArray(product.pre_order_shipping_options) ? product.pre_order_shipping_options : [];
                  const shippingType: string = (product as any).shipping_type || '';
                  const stTokens = shippingType === 'both' ? ['sea', 'air'] : shippingType.split(',').map((t: string) => t.trim()).filter(Boolean);
                  // Build fallback options from sea_price/air_price/land_price when no custom options exist
                  const fallbackOptions: any[] = [];
                  if (preOrderOpts.length === 0 && stTokens.length > 0) {
                    const seaP = Number((product as any).sea_price || 0);
                    const airP = Number((product as any).air_price || 0);
                    const landP = Number((product as any).land_price || 0);
                    const activePrices: number[] = [];
                    if (stTokens.includes('sea') && seaP > 0) activePrices.push(seaP);
                    if (stTokens.includes('air') && airP > 0) activePrices.push(airP);
                    if (stTokens.includes('land') && landP > 0) activePrices.push(landP);
                    const base = activePrices.length > 0 ? Math.min(...activePrices) : 0;
                    if (stTokens.includes('sea') && seaP > 0) {
                      fallbackOptions.push({ name_ar: t('pd_shipping_sea'), description: 'توصيل خلال 45-55 يوم', price_adjustment: seaP - base, type: 'sea' });
                    }
                    if (stTokens.includes('air') && airP > 0) {
                      fallbackOptions.push({ name_ar: t('pd_shipping_air'), description: 'توصيل خلال 7-15 يوم', price_adjustment: airP - base, type: 'air' });
                    }
                    if (stTokens.includes('land') && landP > 0) {
                      fallbackOptions.push({ name_ar: t('pd_shipping_land'), description: 'توصيل خلال 20-30 يوم', price_adjustment: landP - base, type: 'land' });
                    }
                  }
                  const displayOptions = preOrderOpts.length > 0 ? preOrderOpts : fallbackOptions;
                  // If only one option, auto-select it
                  if (displayOptions.length === 1 && selectedShippingOption === null) {
                    setTimeout(() => setSelectedShippingOption(0), 0);
                  }
                  if (displayOptions.length === 0) return null;
                  return (
                    <AccordionItem value="shipping" className="glass-tile rounded-xl">
                      <AccordionTrigger className="px-3 py-2.5 text-xs font-black hover:no-underline">
                        <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />{t('product_shipping_type')}
                          {selectedShippingOption === null && displayOptions.length > 1 && <Badge variant="destructive" className="text-[8px] px-1.5 py-0 h-4 mr-1">{t('pd_required_badge')}</Badge>}
                        </span>
                      </AccordionTrigger>
                      <AccordionContent className="px-3 pb-3">
                        <div className="space-y-1.5">
                          {displayOptions.map((option: any, index: number) => (
                            <button key={index} onClick={() => setSelectedShippingOption(index)}
                              className={cn("w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all text-right backdrop-blur-sm active:scale-[0.98]",
                                selectedShippingOption === index
                                  ? 'border-primary/40 shadow-[0_4px_16px_hsl(var(--primary)/0.15),inset_0_1px_0_hsl(var(--primary)/0.2)] bg-sidebar'
                                  : 'border-border/30 bg-card/30 hover:border-primary/30 hover:bg-card/50 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]')}>
                              <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                                selectedShippingOption === index ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                                {selectedShippingOption === index && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                              </div>
                              <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                                <div className="min-w-0">
                                  <span className="font-bold text-xs block truncate">{option.name_ar}</span>
                                  {option.description && <span className="text-[9px] text-muted-foreground block truncate">{option.description}</span>}
                                </div>
                                {option.price_adjustment > 0 ? (
                                  <span className="text-[10px] font-black text-primary shrink-0">+{formatPrice(ensureAdjustmentIqd(option.price_adjustment, usdToIqd, (product as any).price_usd))} د.ع</span>
                                ) : (
                                  <Badge variant="outline" className="text-[8px] shrink-0 px-1 py-0 h-4">{t('product_free')}</Badge>
                                )}
                              </div>
                            </button>
                          ))}
                        </div>
                      </AccordionContent>
                    </AccordionItem>
                  );
                })()}

                {/* Product Options */}
                {filteredOptions.length > 0 && (
                  <AccordionItem value="options" className="glass-tile rounded-xl">
                    <AccordionTrigger className="px-3 py-2.5 text-xs font-black hover:no-underline">
                      <span className="flex items-center gap-2"><Package className="h-4 w-4 text-primary" />{t('product_options_available')}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                        {filteredOptions.map((option: any) => (
                          <button key={option.id}
                            onClick={() => {
                              if (!option.isAvailable) return;
                              setSelectedOption(option.id);
                              setSelectedColor(null); setColorImageUrl(null);
                              if (option.image_url) { setOptionImageUrl(option.image_url); setSelectedImage(0); }
                              else setOptionImageUrl(null);
                            }}
                            disabled={!option.isAvailable}
                            className={cn("w-full flex items-center gap-2 p-2.5 rounded-xl border transition-all text-right backdrop-blur-sm active:scale-[0.98]",
                              selectedOption === option.id
                                ? 'border-primary/40 bg-primary/10 shadow-[0_4px_16px_hsl(var(--primary)/0.15),inset_0_1px_0_hsl(var(--primary)/0.2)]'
                                : 'border-border/30 bg-card/30 hover:border-primary/30 hover:bg-card/50 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]',
                              !option.isAvailable && 'opacity-40 cursor-not-allowed')}>
                            <div className={cn("w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0",
                              selectedOption === option.id ? 'border-primary bg-primary' : 'border-muted-foreground/30')}>
                              {selectedOption === option.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                            </div>
                            {option.image_url && (
                              <div className="w-8 h-8 rounded-md overflow-hidden border border-border/30 shrink-0">
                                <img src={option.image_url} alt={option.name_ar} className="w-full h-full object-cover" loading="lazy" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                              <div className="min-w-0">
                                <span className="font-bold text-xs truncate block">{option.name_ar}</span>
                                {activeSaleType === 'direct' && option.computedDirectStock != null && option.computedDirectStock > 0 && (
                                  <span className="text-[9px] text-muted-foreground">{t('pd_remaining_short', { count: option.computedDirectStock })}</span>
                                )}
                                {activeSaleType === 'direct' && option.computedDirectStock != null && option.computedDirectStock <= 0 && (
                                  <span className="text-[9px] text-destructive">{t('pd_unavailable_short')}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {option.price_adjustment !== 0 && (
                                  <span className="text-[10px] font-black text-primary">
                                    {formatPrice(ensureAdjustmentIqd(option.price_adjustment, usdToIqd, (product as any).price_usd))} د.ع
                                  </span>
                                )}
                                {!option.isAvailable && (
                                  <div className="flex items-center gap-1">
                                    <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">{t('product_out_of_stock')}</Badge>
                                    {(() => {
                                      const isSubbed = notifySubscriptions?.some((s: any) =>
                                        (s.selected_color || null) === (selectedColor || null) &&
                                        (s.selected_option || null) === (option.name_ar || null)
                                      );
                                      return (
                                        <button
                                          type="button"
                                          className="p-0.5 rounded-full hover:bg-primary/10"
                                          onClick={(e) => {
                                            e.preventDefault();
                                            e.stopPropagation();
                                            if (!user) { toast.error(t('pd_login_required')); navigate('/auth'); return; }
                                            const colorName = selectedColor || null;
                                            const optName = option.name_ar || null;
                                            if (isSubbed) {
                                              let q = supabase.from('stock_notifications').delete().eq('user_id', user.id).eq('product_id', product.id);
                                              if (colorName) q = q.eq('selected_color', colorName); else q = q.is('selected_color', null);
                                              if (optName) q = q.eq('selected_option', optName); else q = q.is('selected_option', null);
                                              q.then(() => { queryClient.invalidateQueries({ queryKey: ['stock-notify'] }); toast.success(t('pd_notify_cancelled')); });
                                            } else {
                                              supabase.from('stock_notifications').insert({ user_id: user.id, product_id: product.id, selected_color: colorName, selected_option: optName } as any)
                                                .then(() => { queryClient.invalidateQueries({ queryKey: ['stock-notify'] }); toast.success(t('pd_notify_subscribed')); });
                                            }
                                          }}
                                        >
                                          {isSubbed ? <BellRing className="h-3 w-3 text-primary" /> : <Bell className="h-3 w-3 text-muted-foreground" />}
                                        </button>
                                      );
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Colors */}
                {filteredColors.length > 0 && (
                  <AccordionItem value="colors" className="glass-tile rounded-xl">
                    <AccordionTrigger className="px-3 py-2.5 text-xs font-black hover:no-underline">
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary via-accent to-secondary" />
                        {t('product_colors_available')} {selectedColor && <span className="font-normal text-muted-foreground">({selectedColor})</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <LayoutGroup>
                        <motion.div layout="position" className="flex flex-wrap gap-2" transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 1 }}>
                        {filteredColors.map((color: any) => (
                          <motion.button
                            key={color.name_ar}
                            layout="position"
                            layoutId={`color-${color.name_ar}`}
                            initial={false}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.85 }}
                            transition={{ type: 'spring', stiffness: 200, damping: 28, mass: 1 }}
                            type="button"
                            onClick={() => {
                              if (!color.isAvailable) return;

                              if (activeSaleType === 'preorder' && color.compatiblePreOrderOptionId && selectedOption !== color.compatiblePreOrderOptionId) {
                                setSelectedOption(color.compatiblePreOrderOptionId);
                                const autoOption = productOptions?.find((opt: any) => opt.id === color.compatiblePreOrderOptionId);
                                if (autoOption?.image_url) {
                                  setOptionImageUrl(autoOption.image_url);
                                  setSelectedImage(0);
                                }
                              }

                              const newColor = selectedColor === color.name_ar ? null : color.name_ar;
                              setSelectedColor(newColor);
                              if (newColor && color.image_url) { setColorImageUrl(color.image_url); setSelectedImage(0); }
                              else setColorImageUrl(null);
                            }}
                            disabled={!color.isAvailable}
                            className={cn("group relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 min-w-[65px] backdrop-blur-sm active:scale-[0.95]",
                              selectedColor === color.name_ar
                                ? 'border-primary/50 bg-primary/10 shadow-[0_4px_16px_hsl(var(--primary)/0.15),inset_0_1px_0_hsl(var(--primary)/0.15)]'
                                : 'border-border/30 bg-card/30 hover:border-primary/30 hover:bg-card/50 shadow-[0_2px_8px_rgba(0,0,0,0.06),inset_0_1px_0_rgba(255,255,255,0.04)]',
                              !color.isAvailable && 'opacity-30 cursor-not-allowed')}>
                            <div className="relative">
                              <div className={cn("w-7 h-7 rounded-full border-2 transition-transform group-hover:scale-110",
                                selectedColor === color.name_ar ? 'border-primary ring-2 ring-primary/30' : 'border-border')}
                                style={getColorSwatchStyle(color.hex_code)} />
                              {selectedColor === color.name_ar && (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  transition={{ type: 'spring', stiffness: 500, damping: 20 }}
                                  className="absolute inset-0 flex items-center justify-center">
                                  <Check className={cn("h-3.5 w-3.5",
                                    color.hex_code?.toLowerCase() === '#ffffff' || color.hex_code?.toLowerCase() === '#fff' ? 'text-foreground' : 'text-white')} />
                                </motion.div>
                              )}
                            </div>
                            <span className="font-bold text-[10px] leading-tight text-center">{color.name_ar}</span>
                            {activeSaleType === 'direct' && (() => {
                              const stock = getColorStockForOption(color, selectedOptionName) ?? color.stock_quantity;
                              if (stock != null && stock <= 0) {
                                // Out of stock - show notify bell
                                const isSubbed = notifySubscriptions?.some((s: any) =>
                                  (s.selected_color || null) === (color.name_ar || null) &&
                                  (s.selected_option || null) === (selectedOptionName || null)
                                );
                                return (
                                  <button
                                    type="button"
                                    className="text-[8px] text-primary flex items-center gap-0.5 z-10"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      if (!user) { toast.error(t('pd_login_required')); navigate('/auth'); return; }
                                      const colorName = color.name_ar || null;
                                      const optName = selectedOptionName || null;
                                      if (isSubbed) {
                                        let q = supabase.from('stock_notifications').delete().eq('user_id', user.id).eq('product_id', product.id);
                                        if (colorName) q = q.eq('selected_color', colorName); else q = q.is('selected_color', null);
                                        if (optName) q = q.eq('selected_option', optName); else q = q.is('selected_option', null);
                                        q.then(() => { queryClient.invalidateQueries({ queryKey: ['stock-notify'] }); toast.success(t('pd_notify_cancelled')); });
                                      } else {
                                        supabase.from('stock_notifications').insert({ user_id: user.id, product_id: product.id, selected_color: colorName, selected_option: optName } as any)
                                          .then(() => { queryClient.invalidateQueries({ queryKey: ['stock-notify'] }); toast.success(t('pd_notify_subscribed')); });
                                      }
                                    }}
                                  >
                                    {isSubbed ? <BellRing className="h-3 w-3" /> : <Bell className="h-3 w-3" />}
                                    <span>{isSubbed ? t('pd_cancel_short') : t('pd_notify_me').replace(/ .*/, '')}</span>
                                  </button>
                                );
                              }
                              return stock != null && stock > 0 ? <span className="text-[8px] text-muted-foreground">{t('pd_remaining_short', { count: stock })}</span> : null;
                            })()}
                            {activeSaleType === 'direct' && color.direct_sale_price && (
                              <span className="text-[9px] font-black text-primary">{formatPrice(ensurePriceIqd(Number(color.direct_sale_price), (product as any).price_usd, usdToIqd))}</span>
                            )}
                            {!color.isAvailable && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                                <X className="h-4 w-4 text-destructive" />
                              </div>
                            )}
                          </motion.button>
                        ))}
                        </motion.div>
                      </LayoutGroup>
                    </AccordionContent>
                  </AccordionItem>
                )}
              </Accordion>

              {/* Rewards */}
              {(Number((product as any).points_reward) > 0 || (Array.isArray((product as any).card_discounts) && (product as any).card_discounts.length > 0)) && allLoyaltyLevels && (
                <ProductRewardsSection
                  pointsReward={Number((product as any).points_reward) || 0}
                  cardDiscounts={Array.isArray((product as any).card_discounts) ? (product as any).card_discounts : []}
                  loyaltyLevels={allLoyaltyLevels || []}
                  userHasCard={!!userCard}
                  userCardLevelId={userCard?.level_id}
                  userCardLevelOrder={userCard?.membership_cards?.display_order}
                  productPrice={finalPrice}
                  currency={currency}
                />
              )}

              {/* Features */}
              {product.features && Array.isArray(product.features) && product.features.length > 0 && (
                <div className="glass-tile p-4">
                  <h3 className="text-sm font-black text-primary mb-3">{t('product_features')}</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    {product.features.map((feature: any, index: number) => {
                      const IconComp = FEATURE_ICONS[feature.icon] || Package;
                      return (
                        <div key={`f-${index}`} className="flex items-start gap-2.5 p-2.5 rounded-lg bg-background/50 border border-border/20">
                          <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                            <IconComp className="w-4 h-4 text-primary" />
                          </div>
                          <p className="text-xs font-medium text-foreground leading-relaxed">{feature.text_ar}</p>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* AI-Friendly "Why this product" */}
              <ProductAIContent aiContent={(product as any).ai_content} productName={localizedName || seoName} />

              {/* Searchable attribute chips (SEO + AI matching) */}
              {searchableAttrs.length > 0 && (
                <div className="glass-tile p-4">
                  <h3 className="text-sm font-bold text-foreground mb-2">
                    {language === 'en' ? 'Tags' : language === 'ku' ? 'تاگەکان' : 'الوسوم'}
                  </h3>
                  <div className="flex flex-wrap gap-2">
                    {searchableAttrs.map((tag, i) => (
                      <span
                        key={i}
                        className="px-2.5 py-1 text-xs rounded-full bg-primary/10 text-primary border border-primary/20"
                      >
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Reviews */}
              <ProductReviews productId={product.id} />

              {/* Price Match */}
              <PriceMatchForm productId={product.id} productName={product.name_ar} />

              {/* Related Products */}
              {relatedProducts && relatedProducts.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-foreground mb-4">{t('product_related')}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {relatedProducts.map((rp: any) => {
                      const finalPrice = computeUnifiedCardPrice(rp, usdToIqd, codDefaults, relatedLiveDirectMap);
                      const showOrig = computeUnifiedCardOriginalPrice(rp, usdToIqd, codDefaults, relatedLiveDirectMap) ?? undefined;
                      const hasDirect = (rp?.has_in_stock ?? false) && !isAllDirectStockDepleted(rp);
                      return (
                        <ProductCard key={rp.id} id={rp.id} name={rp.name} nameAr={rp.name_ar}
                          description={rp.description} descriptionAr={rp.description_ar}
                          price={finalPrice} originalPrice={showOrig}
                          imageUrl={rp.image_url} images={rp.images}
                          currency={rp.currency || t('pd_currency_iqd')} slug={rp.slug}
                          hasDirectSale={hasDirect}
                          cardDiscounts={(rp as any).card_discounts} />
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar — floats above the bottom navbar */}
      <div className="fixed bottom-[calc(5.5rem+env(safe-area-inset-bottom))] md:bottom-4 left-0 right-0 z-[60] px-3 pointer-events-none">
        <div className="mx-auto w-full max-w-md rounded-full glass-floating p-1.5 pointer-events-auto">
          <div className="flex items-center gap-1 min-w-0">
            {/* Quantity */}
            {isAvailableForCurrentSaleType && (
              <div className="flex items-center shrink-0">
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-r-xl rounded-l-none border-l-0" onClick={incrementQuantity}>
                  <Plus className="h-3.5 w-3.5" />
                </Button>
                <Input
                  type="number"
                  min="1"
                  value={quantity}
                  onChange={(e) => {
                    const v = parseInt(e.target.value);
                    if (v > 0) setQuantity(v);
                  }}
                  className="h-9 w-10 rounded-none border-x-0 px-0 text-center text-sm font-black"
                />
                <Button size="icon" variant="outline" className="h-9 w-9 rounded-l-xl rounded-r-none border-r-0" onClick={decrementQuantity} disabled={quantity <= 1}>
                  <Minus className="h-3.5 w-3.5" />
                </Button>
              </div>
            )}

            {/* Add to cart or Notify me */}
            {directStockDepleted && activeSaleType === 'direct' ? (
              <Button
                className="h-9 flex-1 min-w-0 rounded-xl text-xs font-black whitespace-normal gap-2"
                variant="outline"
                onClick={handleNotifyMe}
                disabled={notifyLoading}
              >
                {isNotifySubscribed ? <><BellRing className="h-4 w-4 shrink-0" /> {t('pd_cancel_notify')}</> : <><Bell className="h-4 w-4 shrink-0" /> {t('pd_notify_me')}</>}
              </Button>
            ) : (
              <Button className="h-9 flex-1 min-w-0 rounded-xl text-xs font-black whitespace-normal" onClick={handleAddToCart} disabled={!isAvailableForCurrentSaleType || optionsLoading}>
                <ShoppingCart className="ml-1 h-4 w-4 shrink-0" />
                <span className="truncate">{isAvailableForCurrentSaleType ? `${t('product_add_to_cart')} • ${formatPrice(finalPrice * quantity)}` : t('product_out_of_stock')}</span>
              </Button>
            )}

            {/* Favorite */}
            <Button
              size="icon"
              variant="outline"
              className={cn("h-9 w-9 rounded-xl shrink-0", isFavorite && "text-destructive border-destructive/50")}
              onClick={handleToggleFavorite}
              disabled={favoriteLoading || toggleFavoriteMutation.isPending}
              aria-label={isFavorite ? t('favorites_remove') || 'Remove from favorites' : t('favorites_add') || 'Add to favorites'}
              aria-pressed={!!isFavorite}
            >
              <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} aria-hidden="true" />
            </Button>


            {/* Share */}
            <Button
              size="icon"
              variant="outline"
              className="h-9 w-9 rounded-xl shrink-0"
              aria-label={t('pd_share') || 'Share product'}
              onClick={async () => {
                const ogUrl = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/product-og?slug=${slug}`;
                const directUrl = `${window.location.origin}/product/${slug}`;
                try {
                  if (navigator.share) {
                    await navigator.share({ title: product.name_ar, url: ogUrl });
                  } else {
                    await navigator.clipboard.writeText(directUrl);
                    toast.success(t('pd_link_copied'));
                  }
                } catch {}
              }}
            >
              <Share2 className="h-4 w-4" aria-hidden="true" />
            </Button>
          </div>
        </div>

      </div>

      {/* Sale Type Conflict Dialog */}
      <AlertDialog open={showSaleTypeConflict} onOpenChange={setShowSaleTypeConflict}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              {t('pd_clear_cart_title')}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {saleTypeConflictMessage || t('pd_clear_cart_desc')}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel onClick={() => { pendingAddRef.current = null; }}>{t('pd_clear_cart_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleForceAdd}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t('pd_clear_cart_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default ProductDetail;
