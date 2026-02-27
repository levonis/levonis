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
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { ShoppingCart, ArrowRight, Package, Truck, Heart, Minus, Plus, Star, Check, Clock, Tag, X, BoxIcon, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useMemo } from 'react';
import { formatPrice, cn } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import TaobaoLinkButton from '@/components/admin/TaobaoLinkButton';
import ProductRewardsSection from '@/components/ProductRewardsSection';
import { useLanguage } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';

// Dynamic icon map for features
const FEATURE_ICONS: Record<string, any> = {
  Package, Truck, Star, Check, Clock, Tag, Heart,
};

const ProductDetailSkeleton = () => (
  <div className="min-h-screen bg-background" dir="rtl">
    {/* Full-width image skeleton */}
    <div className="relative">
      <Skeleton className="w-full aspect-square" />
      <div className="absolute top-4 right-4">
        <Skeleton className="w-9 h-9 rounded-xl" />
      </div>
    </div>
    {/* Content card */}
    <div className="px-4 -mt-6 relative z-10">
      <div className="rounded-2xl border bg-card p-4 space-y-4">
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
  const { t } = useLanguage();
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user, isAdmin } = useAuth();
  const { addToCart } = useCart();
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

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar, name)')
        .eq('slug', slug)
        .maybeSingle();
      if (data && !data.is_pricing_updated && !isAdmin) throw new Error('Product not found');
      if (error) throw error;
      if (!data) throw new Error('Product not found');
      return data;
    }
  });

  const { data: allLoyaltyLevels } = useQuery({
    queryKey: ['loyalty-levels-for-discounts'],
    staleTime: 10 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase.from('loyalty_levels').select('id, name_ar, color, level_key, display_order').order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-card', user?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('user_cards').select('*, loyalty_levels:level_id(id, name_ar, display_order)').eq('user_id', user.id).gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false }).limit(1).maybeSingle();
      if (error) { console.error('Error fetching user card:', error); return null; }
      return data;
    },
    enabled: !!user
  });

  const { data: productOptions } = useQuery({
    queryKey: ['product-options', product?.id],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      if (!product) return [];
      const { data, error } = await supabase.from('product_options').select('*').eq('product_id', product.id).order('name_ar');
      if (error) throw error;
      return data || [];
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
      const { data, error } = await supabase.from('products').select('*').eq('category_id', product.category_id).eq('in_stock', true).neq('id', product.id).limit(4);
      if (error) throw error;
      return data || [];
    },
    enabled: !!product && !!product.category_id
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

  const hasDirectSale = product?.has_in_stock ?? false;
  const hasPreOrder = product?.has_pre_order ?? false;
  const hasBothTypes = hasDirectSale && hasPreOrder;

  const activeSaleType = useMemo(() => {
    if (selectedSaleType) return selectedSaleType;
    if (hasDirectSale) return 'direct';
    if (hasPreOrder) return 'preorder';
    return 'direct';
  }, [selectedSaleType, hasDirectSale, hasPreOrder]);

  if (isLoading) return <ProductDetailSkeleton />;

  if (!product) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
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
  const currency = product.currency || 'دينار عراقي';

  const selectedOptionData = productOptions?.find((opt: any) => opt.id === selectedOption);
  const selectedOptionName = selectedOptionData?.name_ar;

  const allColors = Array.isArray(product.colors) ? (product.colors as any[]) : [];
  const getFilteredColors = () => {
    return allColors.map(color => {
      const isAvailableForType = activeSaleType === 'direct' ? (color.available_for_direct_sale ?? true) : (color.available_for_pre_order ?? false);
      const linkedOptions = color.linked_options as string[] | undefined;
      const isLinkedToOption = !linkedOptions || linkedOptions.length === 0 || !selectedOptionName ? true : linkedOptions.includes(selectedOptionName);
      const isInStock = color.in_stock !== false;
      return { ...color, isAvailable: isAvailableForType && isLinkedToOption && isInStock, isLinkedToOption };
    });
  };
  const filteredColors = getFilteredColors();

  const selectedColorData = allColors.find((c: any) => c.name_ar === selectedColor);
  const getPrice = () => {
    if (activeSaleType === 'direct' && selectedColorData?.direct_sale_price) return Number(selectedColorData.direct_sale_price);
    const base = selectedColorData?.price != null ? Number(selectedColorData.price) : Number(product.price);
    return base;
  };

  const basePrice = getPrice();
  const optionAdjustment = selectedOptionData ? Number(selectedOptionData.price_adjustment) : 0;
  let shippingAdjustment = 0;
  if (activeSaleType === 'preorder' && selectedShippingOption !== null && Array.isArray(product.pre_order_shipping_options) && product.pre_order_shipping_options[selectedShippingOption]) {
    shippingAdjustment = Number((product.pre_order_shipping_options[selectedShippingOption] as any).price_adjustment || 0);
  }
  const finalPrice = basePrice + optionAdjustment + shippingAdjustment;

  let finalOriginalPrice: number | null = null;
  if (product.original_price != null) {
    const productOriginal = Number(product.original_price);
    const colorDelta = selectedColorData?.price != null ? (Number(selectedColorData.price) - Number(product.price)) : 0;
    finalOriginalPrice = productOriginal + colorDelta + optionAdjustment;
  }
  const hasSale = finalOriginalPrice != null && finalOriginalPrice > finalPrice;
  const savings = hasSale && finalOriginalPrice != null ? (finalOriginalPrice - finalPrice) : 0;

  const directStockQuantity = selectedColorData
    ? (selectedOptionName && selectedColorData.option_stocks?.[selectedOptionName] != null ? selectedColorData.option_stocks[selectedOptionName] : selectedColorData.stock_quantity)
    : undefined;
  const hasStockInfo = activeSaleType === 'direct' && directStockQuantity != null && directStockQuantity > 0;

  const handleAddToCart = async () => {
    if (productOptions && productOptions.length > 0 && !selectedOption) { toast.error(t('product_select_option')); return; }
    const preOrderShippingOptions = Array.isArray(product.pre_order_shipping_options) ? product.pre_order_shipping_options : [];
    const hasCustomShippingOptions = activeSaleType === 'preorder' && preOrderShippingOptions.length > 0;
    if (hasCustomShippingOptions && selectedShippingOption === null) { toast.error(t('product_choose_shipping')); return; }
    const shippingInfo = selectedShippingOption !== null && preOrderShippingOptions[selectedShippingOption]
      ? { index: selectedShippingOption, name_ar: (preOrderShippingOptions[selectedShippingOption] as any).name_ar }
      : undefined;
    await addToCart(product.id, selectedOption || undefined, selectedColor || undefined, quantity, shippingInfo);
    toast.success(t('product_added_to_cart').replace('{count}', String(quantity)));
    setQuantity(1);
  };

  const handleToggleFavorite = () => { toggleFavoriteMutation.mutate(); };
  const incrementQuantity = () => { setQuantity(prev => prev + 1); };
  const decrementQuantity = () => { if (quantity > 1) setQuantity(prev => prev - 1); };

  const handleSaleTypeChange = (type: string) => {
    setSelectedSaleType(type as 'direct' | 'preorder');
    setSelectedColor(null);
    setColorImageUrl(null);
    setSelectedShippingOption(null);
  };

  const getFilteredOptions = () => {
    if (!productOptions) return [];
    return productOptions.map((option: any) => {
      const isAvailable = activeSaleType === 'direct' ? (option.available_for_direct_sale ?? true) : (option.available_for_pre_order ?? false);
      return { ...option, isAvailable: isAvailable && option.in_stock };
    });
  };
  const filteredOptions = getFilteredOptions();

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Full-width image section (mobile) / grid (desktop) */}
      <div className="md:container md:mx-auto md:px-4 md:pt-24">
        <div className="md:grid md:grid-cols-2 md:gap-8">
          {/* Image */}
          <div className="relative md:sticky md:top-24 md:self-start">
            {/* Back button overlay */}
            <button
              onClick={() => navigate(-1)}
              className="absolute top-4 right-4 z-20 w-9 h-9 rounded-xl bg-card/80 flex items-center justify-center md:hidden"
            >
              <ArrowRight className="h-4 w-4 text-foreground" />
            </button>

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
                            <img src={img} alt={`${product.name_ar} - ${idx + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" draggable={false} />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                    <CarouselPrevious className="right-2 left-auto h-9 w-9 bg-card/80 hover:bg-card border-border/30 hidden md:flex" />
                    <CarouselNext className="left-2 right-auto h-9 w-9 bg-card/80 hover:bg-card border-border/30 hidden md:flex" />
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

                {!product.in_stock && (
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
            <div className="rounded-2xl border border-border/40 bg-card p-4 md:p-6 space-y-4 md:border-0 md:bg-transparent md:p-0">
              {/* Desktop back */}
              <div className="hidden md:block mb-4">
                <Button variant="outline" size="sm" onClick={() => navigate(-1)} className="rounded-xl">
                  <ArrowRight className="h-4 w-4 ml-1.5" />
                  {t('product_go_back')}
                </Button>
              </div>

              {/* Category */}
              {product.categories && (
                <Badge variant="outline" className="text-[11px] rounded-lg">
                  {(product as any).categories.name_ar}
                </Badge>
              )}

              {/* Title */}
              <h1 className="text-xl md:text-2xl font-black text-foreground leading-tight flex items-center gap-2">
                {product.name_ar}
                {isAdmin && (product as any).taobao_url && <TaobaoLinkButton taobaoUrl={(product as any).taobao_url} />}
              </h1>

              {/* Description */}
              {product.description_ar && (
                <div className="text-muted-foreground text-sm leading-relaxed">
                  <p className={!showFullDescription && product.description_ar.length > 150 ? 'line-clamp-2' : ''}>
                    {product.description_ar}
                  </p>
                  {product.description_ar.length > 150 && (
                    <button onClick={() => setShowFullDescription(!showFullDescription)} className="text-primary text-xs mt-1 font-bold">
                      {showFullDescription ? t('product_show_less') : t('product_show_more')}
                    </button>
                  )}
                </div>
              )}

              {/* Price section */}
              <div className="rounded-xl bg-primary/5 border border-primary/15 p-3">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-2xl font-black text-primary">{formatPrice(finalPrice)}</span>
                  <span className="text-sm text-muted-foreground">{currency}</span>
                  {hasSale && finalOriginalPrice && (
                    <span className="text-sm line-through text-muted-foreground/50">{formatPrice(finalOriginalPrice)}</span>
                  )}
                </div>
                {hasStockInfo && (
                  <p className="text-[11px] text-muted-foreground mt-1 flex items-center gap-1">
                    <BoxIcon className="h-3 w-3" />
                    متبقي {directStockQuantity} قطعة
                  </p>
                )}
              </div>

              {/* Sale Type Tabs */}
              {hasBothTypes && (
                <Tabs value={activeSaleType} onValueChange={handleSaleTypeChange}>
                  <TabsList className="w-full grid grid-cols-2 h-11 rounded-xl p-1 bg-accent/80">
                    <TabsTrigger value="direct" className="rounded-lg gap-1.5 text-xs font-black data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Package className="h-3.5 w-3.5" />{t('product_direct_sale')}
                    </TabsTrigger>
                    <TabsTrigger value="preorder" className="rounded-lg gap-1.5 text-xs font-black data-[state=active]:bg-primary data-[state=active]:text-primary-foreground">
                      <Clock className="h-3.5 w-3.5" />{t('product_pre_order')}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              )}

              {/* Accordion sections */}
              <Accordion type="multiple" defaultValue={['shipping', 'options', 'colors']} className="space-y-2">
                {/* Shipping Options */}
                {activeSaleType === 'preorder' && Array.isArray(product.pre_order_shipping_options) && product.pre_order_shipping_options.length > 0 && (
                  <AccordionItem value="shipping" className="border border-border/30 rounded-xl overflow-hidden">
                    <AccordionTrigger className="px-3 py-2.5 text-xs font-black hover:no-underline">
                      <span className="flex items-center gap-2"><Truck className="h-4 w-4 text-primary" />{t('product_shipping_type')}</span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="space-y-1.5">
                        {product.pre_order_shipping_options.map((option: any, index: number) => (
                          <button key={index} onClick={() => setSelectedShippingOption(index)}
                            className={cn("w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-right",
                              selectedShippingOption === index ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/40')}>
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
                                <span className="text-[10px] font-black text-primary shrink-0">+{formatPrice(option.price_adjustment)}</span>
                              ) : (
                                <Badge variant="outline" className="text-[8px] shrink-0 px-1 py-0 h-4">{t('product_free')}</Badge>
                              )}
                            </div>
                          </button>
                        ))}
                      </div>
                    </AccordionContent>
                  </AccordionItem>
                )}

                {/* Product Options */}
                {filteredOptions.length > 0 && (
                  <AccordionItem value="options" className="border border-border/30 rounded-xl overflow-hidden">
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
                            className={cn("w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all text-right",
                              selectedOption === option.id ? 'border-primary bg-primary/10' : 'border-border/40 hover:border-primary/40',
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
                                {activeSaleType === 'direct' && option.stock_quantity != null && option.stock_quantity > 0 && (
                                  <span className="text-[9px] text-muted-foreground">متبقي {option.stock_quantity}</span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 shrink-0">
                                {option.price_adjustment !== 0 && (
                                  <span className={cn("text-[10px] font-black", option.price_adjustment > 0 ? 'text-primary' : 'text-emerald-600')}>
                                    {option.price_adjustment > 0 ? '+' : ''}{formatPrice(option.price_adjustment)}
                                  </span>
                                )}
                                {!option.isAvailable && <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">{t('product_out_of_stock')}</Badge>}
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
                  <AccordionItem value="colors" className="border border-border/30 rounded-xl overflow-hidden">
                    <AccordionTrigger className="px-3 py-2.5 text-xs font-black hover:no-underline">
                      <span className="flex items-center gap-2">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary via-accent to-secondary" />
                        {t('product_colors_available')} {selectedColor && <span className="font-normal text-muted-foreground">({selectedColor})</span>}
                      </span>
                    </AccordionTrigger>
                    <AccordionContent className="px-3 pb-3">
                      <div className="flex flex-wrap gap-2">
                        {filteredColors.map((color: any, index: number) => (
                          <button key={index} type="button"
                            onClick={() => {
                              if (!color.isAvailable) return;
                              const newColor = selectedColor === color.name_ar ? null : color.name_ar;
                              setSelectedColor(newColor);
                              if (newColor && color.image_url) { setColorImageUrl(color.image_url); setSelectedImage(0); }
                              else setColorImageUrl(null);
                            }}
                            disabled={!color.isAvailable}
                            className={cn("group relative flex flex-col items-center gap-1 p-2 rounded-xl border-2 transition-all min-w-[65px]",
                              selectedColor === color.name_ar ? 'border-primary bg-primary/5' : 'border-border/50 hover:border-primary/30',
                              !color.isAvailable && 'opacity-30 cursor-not-allowed')}>
                            <div className="relative">
                              <div className={cn("w-7 h-7 rounded-full border-2 transition-transform group-hover:scale-110",
                                selectedColor === color.name_ar ? 'border-primary ring-2 ring-primary/30' : 'border-border')}
                                style={{ backgroundColor: color.hex_code }} />
                              {selectedColor === color.name_ar && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <Check className={cn("h-3.5 w-3.5",
                                    color.hex_code?.toLowerCase() === '#ffffff' || color.hex_code?.toLowerCase() === '#fff' ? 'text-foreground' : 'text-white')} />
                                </div>
                              )}
                            </div>
                            <span className="font-bold text-[10px] leading-tight text-center">{color.name_ar}</span>
                            {activeSaleType === 'direct' && (() => {
                              const stock = selectedOptionName && color.option_stocks?.[selectedOptionName] != null ? color.option_stocks[selectedOptionName] : color.stock_quantity;
                              return stock != null && stock > 0 ? <span className="text-[8px] text-muted-foreground">متبقي {stock}</span> : null;
                            })()}
                            {activeSaleType === 'direct' && color.direct_sale_price && (
                              <span className="text-[9px] font-black text-primary">{formatPrice(color.direct_sale_price)}</span>
                            )}
                            {!color.isAvailable && (
                              <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                                <X className="h-4 w-4 text-destructive" />
                              </div>
                            )}
                          </button>
                        ))}
                      </div>
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
                  userCardLevelOrder={userCard?.loyalty_levels?.display_order}
                  productPrice={finalPrice}
                  currency={currency}
                />
              )}

              {/* Features */}
              {product.features && Array.isArray(product.features) && product.features.length > 0 && (
                <div className="rounded-xl border border-border/30 p-4">
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

              {/* Reviews */}
              <ProductReviews productId={product.id} />

              {/* Related Products */}
              {relatedProducts && relatedProducts.length > 0 && (
                <div>
                  <h2 className="text-lg font-black text-foreground mb-4">{t('product_related')}</h2>
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {relatedProducts.map((rp: any) => (
                      <ProductCard key={rp.id} id={rp.id} name={rp.name} nameAr={rp.name_ar}
                        description={rp.description} descriptionAr={rp.description_ar}
                        price={Number(rp.price)} originalPrice={rp.original_price ? Number(rp.original_price) : undefined}
                        imageUrl={rp.image_url} images={rp.images}
                        currency={rp.currency || 'دينار عراقي'} slug={rp.slug}
                        hasDirectSale={rp.has_in_stock ?? false} />
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Sticky bottom bar */}
      <div className="fixed bottom-[4.5rem] md:bottom-0 left-0 right-0 z-40 bg-card border-t border-border/30 px-3 py-2">
        <div className="flex items-center gap-1.5 w-full">
          {/* Share */}
          <Button size="icon" variant="outline" className="h-10 w-10 rounded-xl shrink-0"
            onClick={async () => {
              const url = `${window.location.origin}/product/${slug}`;
              try {
                if (navigator.share) {
                  await navigator.share({ title: product.name_ar, url });
                } else {
                  await navigator.clipboard.writeText(url);
                  toast.success('تم نسخ الرابط');
                }
              } catch {}
            }}>
            <Share2 className="h-4 w-4" />
          </Button>

          {/* Favorite */}
          <Button size="icon" variant="outline"
            className={cn("h-10 w-10 rounded-xl shrink-0", isFavorite && "text-destructive border-destructive/50")}
            onClick={handleToggleFavorite} disabled={favoriteLoading || toggleFavoriteMutation.isPending}>
            <Heart className={cn("h-4 w-4", isFavorite && "fill-current")} />
          </Button>

          {/* Add to cart */}
          <Button className="flex-1 h-10 rounded-xl font-black text-xs min-w-0" onClick={handleAddToCart} disabled={!product.in_stock}>
            <ShoppingCart className="ml-1 h-4 w-4 shrink-0" />
            <span className="truncate">
              {product.in_stock ? `${t('product_add_to_cart')} • ${formatPrice(finalPrice * quantity)}` : t('product_out_of_stock')}
            </span>
          </Button>

          {/* Quantity */}
          {product.in_stock && (
            <div className="flex items-center shrink-0">
              <Button size="icon" variant="outline" className="h-10 w-10 rounded-r-xl rounded-l-none border-l-0" onClick={incrementQuantity}>
                <Plus className="h-3.5 w-3.5" />
              </Button>
              <Input type="number" min="1" value={quantity} onChange={(e) => { const v = parseInt(e.target.value); if (v > 0) setQuantity(v); }}
                className="h-10 text-center text-sm font-black w-10 rounded-none border-x-0 px-0" />
              <Button size="icon" variant="outline" className="h-10 w-10 rounded-l-xl rounded-r-none border-r-0" onClick={decrementQuantity} disabled={quantity <= 1}>
                <Minus className="h-3.5 w-3.5" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductDetail;
