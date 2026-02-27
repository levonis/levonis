import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShoppingCart, ArrowRight, Package, Shield, Truck, Heart, Minus, Plus, Star, Award, Check, CheckCircle, Zap, Sparkles, Cpu, Battery, Wifi, Smartphone, Monitor, Headphones, Camera, Music, Video, Image, Disc, Download, Upload, Rocket, Flame, Gift, Crown, Gem, Clock, Timer, Globe, Lock, Unlock, Key, Settings, Hammer, Lightbulb, Sun, Moon, Cloud, Droplet, Wind, Leaf, TreePine, Feather, Target, ThumbsUp, Home, Building, Store, ShoppingBag, CreditCard, Wallet, DollarSign, Tag, BarChart, TrendingUp, Users, User, Mail, Phone, MessageCircle, Send, Bell, Volume2, Mic, X, AlertTriangle, BoxIcon } from 'lucide-react';
import { toast } from 'sonner';
import { useState, useCallback, useMemo } from 'react';
import { formatPrice } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';
import ProductReviews from '@/components/ProductReviews';
import TaobaoLinkButton from '@/components/admin/TaobaoLinkButton';
import ProductRewardsSection from '@/components/ProductRewardsSection';
import { useLanguage } from '@/lib/i18n';

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

  const { data: product, isLoading, refetch: refetchProduct } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar, name)')
        .eq('slug', slug)
        .maybeSingle();
      
      if (data && !data.is_pricing_updated) {
        throw new Error('Product not found');
      }
      
      if (error) throw error;
      if (!data) throw new Error('Product not found');
      return data;
    }
  });

  const { data: allLoyaltyLevels } = useQuery({
    queryKey: ['loyalty-levels-for-discounts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('id, name_ar, color, level_key, display_order')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    }
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-card', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select('*, loyalty_levels:level_id(id, name_ar, display_order)')
        .eq('user_id', user.id)
        .gt('expires_at', new Date().toISOString())
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) { console.error('Error fetching user card:', error); return null; }
      return data;
    },
    enabled: !!user
  });

  const { data: productOptions } = useQuery({
    queryKey: ['product-options', product?.id],
    queryFn: async () => {
      if (!product) return [];
      const { data, error } = await supabase
        .from('product_options')
        .select('*')
        .eq('product_id', product.id)
        .order('name_ar');
      if (error) throw error;
      return data || [];
    },
    enabled: !!product
  });

  const { data: isFavorite, isLoading: favoriteLoading } = useQuery({
    queryKey: ['favorite', product?.id, user?.id],
    queryFn: async () => {
      if (!user || !product) return false;
      const { data, error } = await supabase
        .from('favorites')
        .select('id')
        .eq('user_id', user.id)
        .eq('product_id', product.id)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user && !!product
  });

  const { data: relatedProducts } = useQuery({
    queryKey: ['related-products', product?.category_id, product?.id],
    queryFn: async () => {
      if (!product || !product.category_id) return [];
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', product.category_id)
        .eq('in_stock', true)
        .neq('id', product.id)
        .limit(4);
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
      if (error.message === 'User not authenticated') {
        toast.error(t('product_login_required'));
        navigate('/auth');
      } else {
        toast.error(t('product_error_retry'));
      }
    }
  });

  // Determine available sale types
  const hasDirectSale = product?.has_in_stock ?? false;
  const hasPreOrder = product?.has_pre_order ?? false;
  const hasBothTypes = hasDirectSale && hasPreOrder;

  // Auto-select sale type
  const activeSaleType = useMemo(() => {
    if (selectedSaleType) return selectedSaleType;
    if (hasDirectSale) return 'direct';
    if (hasPreOrder) return 'preorder';
    return 'direct';
  }, [selectedSaleType, hasDirectSale, hasPreOrder]);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

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
    return product.images && product.images.length > 0 
      ? product.images 
      : product.image_url ? [product.image_url] : [];
  };
  
  const productImages = getProductImages();
  const currency = product.currency || 'دينار عراقي';

  // Get selected option data
  const selectedOptionData = productOptions?.find((opt: any) => opt.id === selectedOption);
  const selectedOptionName = selectedOptionData?.name_ar;

  // Filter colors based on selected option's linked_options
  const allColors = Array.isArray(product.colors) ? (product.colors as any[]) : [];
  
  const getFilteredColors = () => {
    return allColors.map(color => {
      // Check availability for current sale type
      const isAvailableForType = activeSaleType === 'direct'
        ? (color.available_for_direct_sale ?? true)
        : (color.available_for_pre_order ?? false);
      
      // Check linked_options filter
      const linkedOptions = color.linked_options as string[] | undefined;
      const isLinkedToOption = !linkedOptions || linkedOptions.length === 0 || !selectedOptionName
        ? true
        : linkedOptions.includes(selectedOptionName);
      
      const isInStock = color.in_stock !== false;
      
      return {
        ...color,
        isAvailable: isAvailableForType && isLinkedToOption && isInStock,
        isLinkedToOption,
      };
    });
  };

  const filteredColors = getFilteredColors();

  // Price calculation
  const selectedColorData = allColors.find((c: any) => c.name_ar === selectedColor);
  
  const getPrice = () => {
    // For direct sale, use direct_sale_price if available
    if (activeSaleType === 'direct' && selectedColorData?.direct_sale_price) {
      return Number(selectedColorData.direct_sale_price);
    }
    const base = selectedColorData?.price != null
      ? Number(selectedColorData.price)
      : Number(product.price);
    return base;
  };

  const basePrice = getPrice();
  const optionAdjustment = selectedOptionData ? Number(selectedOptionData.price_adjustment) : 0;
  
  let shippingAdjustment = 0;
  if (activeSaleType === 'preorder' && selectedShippingOption !== null && Array.isArray(product.pre_order_shipping_options) && product.pre_order_shipping_options[selectedShippingOption]) {
    const shippingOption = product.pre_order_shipping_options[selectedShippingOption] as any;
    shippingAdjustment = Number(shippingOption.price_adjustment || 0);
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

  // Stock info for direct sale - support per-option stocks
  const directStockQuantity = selectedColorData
    ? (selectedOptionName && selectedColorData.option_stocks?.[selectedOptionName] != null
        ? selectedColorData.option_stocks[selectedOptionName]
        : selectedColorData.stock_quantity)
    : undefined;
  const hasStockInfo = activeSaleType === 'direct' && directStockQuantity != null && directStockQuantity > 0;

  const handleAddToCart = async () => {
    if (productOptions && productOptions.length > 0 && !selectedOption) {
      toast.error(t('product_select_option'));
      return;
    }

    const preOrderShippingOptions = Array.isArray(product.pre_order_shipping_options) ? product.pre_order_shipping_options : [];
    const hasCustomShippingOptions = activeSaleType === 'preorder' && preOrderShippingOptions.length > 0;
    if (hasCustomShippingOptions && selectedShippingOption === null) {
      toast.error(t('product_choose_shipping'));
      return;
    }

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
    // Reset selections when switching sale type
    setSelectedColor(null);
    setColorImageUrl(null);
    setSelectedShippingOption(null);
  };

  // Filter options based on sale type
  const getFilteredOptions = () => {
    if (!productOptions) return [];
    return productOptions.map((option: any) => {
      const isAvailable = activeSaleType === 'direct'
        ? (option.available_for_direct_sale ?? true)
        : (option.available_for_pre_order ?? false);
      return { ...option, isAvailable: isAvailable && option.in_stock };
    });
  };

  const filteredOptions = getFilteredOptions();

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        {/* Back Button & Breadcrumb */}
        <div className="mb-6">
          <Button variant="outline" onClick={() => navigate(-1)} className="mb-3">
            <ArrowRight className="h-4 w-4 ml-2" />
            {t('product_go_back')}
          </Button>
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button onClick={() => navigate('/')} className="hover:text-primary transition-colors">{t('nav_home')}</button>
            <span>/</span>
            <button onClick={() => navigate('/products')} className="hover:text-primary transition-colors">{t('nav_products')}</button>
            <span>/</span>
            <span className="text-foreground">{product.name_ar}</span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-10 mb-12">
          {/* Image Section */}
          <div className="relative">
            {hasSale && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute -top-4 -left-4 z-20 cursor-help">
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/40 rounded-full blur-lg animate-pulse" />
                        <div className="relative bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-full p-3 shadow-xl backdrop-blur-sm border border-primary-foreground/20 hover:scale-110 transition-transform">
                          <Tag className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-primary text-primary-foreground font-bold text-base px-4 py-2">
                    <p>خصم {finalOriginalPrice ? Math.round((savings / Number(finalOriginalPrice)) * 100) : 0}%</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="rounded-2xl p-4 sm:p-6 border border-border/50 bg-card/50 backdrop-blur-sm">
              {productImages.length > 0 ? (
                <div className="space-y-4">
                  {productImages.length > 1 ? (
                    <Carousel 
                      opts={{ loop: true, direction: 'rtl', dragFree: false }}
                      className="w-full"
                      setApi={(api) => {
                        api?.on('select', () => setSelectedImage(api.selectedScrollSnap()));
                      }}
                    >
                      <CarouselContent className="-ml-0">
                        {productImages.map((img, idx) => (
                          <CarouselItem key={idx} className="pl-0">
                            <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                              <img src={img} alt={`${product.name_ar} - صورة ${idx + 1}`} className="w-full h-full object-cover" draggable={false} />
                            </div>
                          </CarouselItem>
                        ))}
                      </CarouselContent>
                      <CarouselPrevious className="right-2 left-auto h-10 w-10 bg-background/80 hover:bg-background border-border/50" />
                      <CarouselNext className="left-2 right-auto h-10 w-10 bg-background/80 hover:bg-background border-border/50" />
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 bg-background/80 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-medium">
                        {selectedImage + 1} / {productImages.length}
                      </div>
                    </Carousel>
                  ) : (
                    <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                      <img src={productImages[0]} alt={product.name_ar} className="w-full h-full object-cover" />
                    </div>
                  )}
                  
                  {!product.in_stock && (
                    <div className="absolute inset-0 bg-background/80 flex items-center justify-center rounded-xl">
                      <Badge variant="destructive" className="text-lg px-6 py-2">{t('product_out_of_stock')}</Badge>
                    </div>
                  )}
                  
                  {productImages.length > 1 && (
                    <div className="flex justify-center gap-1.5">
                      {productImages.map((_, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${selectedImage === idx ? 'bg-primary w-4' : 'bg-border hover:bg-primary/50'}`}
                        />
                      ))}
                    </div>
                  )}
                  
                  {productImages.length > 1 && (
                    <div className="hidden sm:grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2">
                      {productImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === idx ? 'border-primary ring-2 ring-primary/20' : 'border-border/30 hover:border-primary/50'
                          }`}
                        >
                          <img src={img} alt={`${product.name_ar} - صورة مصغرة ${idx + 1}`} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : (
                <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                  <div className="w-full h-full flex items-center justify-center">
                    <Package className="w-24 h-24 text-muted-foreground/30" />
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Product Info Section */}
          <div className="flex flex-col gap-4">
            <div className="rounded-2xl p-5 md:p-6 border border-border/50 bg-card/50 backdrop-blur-sm">
              {/* Category */}
              {product.categories && (
                <Badge variant="outline" className="mb-3 text-xs">
                  {(product as any).categories.name_ar}
                </Badge>
              )}

              {/* Title */}
              <h1 className="text-2xl md:text-3xl font-black text-foreground mb-2 flex items-center gap-2 leading-tight">
                {product.name_ar}
                {isAdmin && (product as any).taobao_url && (
                  <TaobaoLinkButton taobaoUrl={(product as any).taobao_url} />
                )}
              </h1>
              
              {/* Description */}
              {product.description_ar && (
                <div className="text-muted-foreground text-sm mb-5 leading-relaxed">
                  <p className={`${!showFullDescription && product.description_ar.length > 150 ? 'line-clamp-2' : ''}`}>
                    {product.description_ar}
                  </p>
                  {product.description_ar.length > 150 && (
                    <button onClick={() => setShowFullDescription(!showFullDescription)} className="text-primary hover:underline text-xs mt-1 font-medium">
                      {showFullDescription ? t('product_show_less') : t('product_show_more')}
                    </button>
                  )}
                </div>
              )}

              {/* === Sale Type Tabs === */}
              {hasBothTypes ? (
                <Tabs value={activeSaleType} onValueChange={handleSaleTypeChange} className="mb-5">
                  <TabsList className="w-full grid grid-cols-2 h-12 bg-muted/50 rounded-xl p-1">
                    <TabsTrigger 
                      value="direct" 
                      className="rounded-lg gap-2 text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                    >
                      <Package className="h-4 w-4" />
                      {t('product_direct_sale')}
                    </TabsTrigger>
                    <TabsTrigger 
                      value="preorder"
                      className="rounded-lg gap-2 text-sm font-bold data-[state=active]:bg-primary data-[state=active]:text-primary-foreground data-[state=active]:shadow-md transition-all"
                    >
                      <Clock className="h-4 w-4" />
                      {t('product_pre_order')}
                    </TabsTrigger>
                  </TabsList>
                  
                  <div className="mt-1">
                    <p className="text-[10px] text-muted-foreground text-center">
                      {activeSaleType === 'direct' ? t('product_direct_sale_desc') : t('product_pre_order_desc')}
                    </p>
                  </div>
                </Tabs>
              ) : (
                <div className="mb-4">
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-primary/5 border border-primary/15">
                    <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                      {hasDirectSale ? <Package className="h-4 w-4 text-primary" /> : <Clock className="h-4 w-4 text-primary" />}
                    </div>
                    <div>
                      <span className="font-bold text-sm text-primary block">
                        {hasDirectSale ? t('product_direct_sale') : t('product_pre_order')}
                      </span>
                      <span className="text-[10px] text-primary/70">
                        {hasDirectSale ? t('product_direct_sale_desc') : t('product_pre_order_desc')}
                      </span>
                    </div>
                  </div>
                </div>
              )}

              {/* === Content based on sale type === */}
              <div className="space-y-4">
                {/* Shipping Options - Only for pre-order */}
                {activeSaleType === 'preorder' && Array.isArray(product.pre_order_shipping_options) && product.pre_order_shipping_options.length > 0 && (
                  <div className="p-3 rounded-xl bg-card/80 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Truck className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold block">{t('product_shipping_type')}</Label>
                        <span className="text-[9px] text-muted-foreground">{t('product_choose_shipping')}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {product.pre_order_shipping_options.map((option: any, index: number) => (
                        <button
                          key={index}
                          onClick={() => setSelectedShippingOption(index)}
                          className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            selectedShippingOption === index
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-border/40 hover:border-primary/40 bg-background/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedShippingOption === index ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selectedShippingOption === index && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <span className="font-medium text-xs block truncate">{option.name_ar}</span>
                              {option.description && (
                                <span className="text-[9px] text-muted-foreground block truncate">{option.description}</span>
                              )}
                            </div>
                            {option.price_adjustment > 0 ? (
                              <span className="text-[10px] font-bold text-primary shrink-0">
                                +{formatPrice(option.price_adjustment)} {currency}
                              </span>
                            ) : (
                              <Badge variant="outline" className="text-[8px] shrink-0 text-emerald-600 border-emerald-500/30 px-1 py-0 h-4">
                                {t('product_free')}
                              </Badge>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Legacy Pre-Order Shipping */}
                {activeSaleType === 'preorder' && (!Array.isArray(product.pre_order_shipping_options) || product.pre_order_shipping_options.length === 0) && (product.pre_order_free_shipping_price || product.pre_order_fast_shipping_price) && (
                  <div className="p-3 rounded-xl bg-card/80 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-primary/10 flex items-center justify-center">
                        <Truck className="h-3.5 w-3.5 text-primary" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold block">{t('product_shipping_type')}</Label>
                        <span className="text-[9px] text-muted-foreground">{t('product_choose_shipping')}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      {product.pre_order_free_shipping_price && (
                        <button
                          onClick={() => setSelectedShippingOption(0)}
                          className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            selectedShippingOption === 0 ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/40 hover:border-primary/40 bg-background/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedShippingOption === 0 ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selectedShippingOption === 0 && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div><span className="font-medium text-xs block">شحن بحري</span><span className="text-[9px] text-muted-foreground">45 يوم تقريباً</span></div>
                            <Badge variant="outline" className="text-[8px] shrink-0 text-primary border-primary/30 px-1 py-0 h-4">{t('product_free')}</Badge>
                          </div>
                        </button>
                      )}
                      {product.pre_order_fast_shipping_price && (
                        <button
                          onClick={() => setSelectedShippingOption(1)}
                          className={`w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            selectedShippingOption === 1 ? 'border-primary bg-primary/10 shadow-sm' : 'border-border/40 hover:border-primary/40 bg-background/30'
                          }`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedShippingOption === 1 ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selectedShippingOption === 1 && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div><span className="font-medium text-xs block">شحن جوي سريع</span><span className="text-[9px] text-muted-foreground">15 يوم تقريباً</span></div>
                            <span className="text-[10px] font-bold text-primary shrink-0">+{formatPrice(Number(product.pre_order_fast_shipping_price))} {currency}</span>
                          </div>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* Product Options */}
                {filteredOptions.length > 0 && (
                  <div className="p-3 rounded-xl bg-card/80 border border-border/30">
                    <div className="flex items-center gap-2 mb-2">
                      <div className="w-7 h-7 rounded-lg bg-secondary flex items-center justify-center">
                        <Settings className="h-3.5 w-3.5 text-secondary-foreground" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold block">{t('product_options_available')}</Label>
                        <span className="text-[9px] text-muted-foreground">{t('product_choose_option')}</span>
                      </div>
                    </div>
                    <div className="space-y-1.5 max-h-[280px] overflow-y-auto scrollbar-thin">
                      {filteredOptions.map((option: any) => (
                        <button
                          key={option.id}
                          onClick={() => {
                            if (!option.isAvailable) return;
                            setSelectedOption(option.id);
                            // Reset color when option changes (due to linked_options filtering)
                            setSelectedColor(null);
                            setColorImageUrl(null);
                            if (option.image_url) {
                              setOptionImageUrl(option.image_url);
                              setSelectedImage(0);
                            } else {
                              setOptionImageUrl(null);
                            }
                          }}
                          disabled={!option.isAvailable}
                          className={`relative w-full flex items-center gap-2 p-2.5 rounded-lg border transition-all ${
                            selectedOption === option.id
                              ? 'border-primary bg-primary/10 shadow-sm'
                              : 'border-border/40 hover:border-primary/40 bg-background/30'
                          } ${!option.isAvailable ? 'opacity-40 cursor-not-allowed' : ''}`}
                        >
                          <div className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                            selectedOption === option.id ? 'border-primary bg-primary' : 'border-muted-foreground/30'
                          }`}>
                            {selectedOption === option.id && <Check className="h-2.5 w-2.5 text-primary-foreground" />}
                          </div>
                          {option.image_url && (
                            <div className="w-8 h-8 rounded-md overflow-hidden border border-border/30 shrink-0">
                              <img src={option.image_url} alt={option.name_ar} className="w-full h-full object-cover" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0 flex items-center justify-between gap-1">
                            <div className="min-w-0">
                              <span className="font-medium text-xs truncate block">{option.name_ar}</span>
                              {activeSaleType === 'direct' && option.stock_quantity != null && option.stock_quantity > 0 && (
                                <span className="text-[9px] text-muted-foreground">متبقي {option.stock_quantity} قطعة</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                              {option.price_adjustment !== 0 && (
                                <span className={`text-[10px] font-bold ${option.price_adjustment > 0 ? 'text-primary' : 'text-emerald-600'}`}>
                                  {option.price_adjustment > 0 ? '+' : ''}{formatPrice(option.price_adjustment)}
                                </span>
                              )}
                              {!option.isAvailable && (
                                <Badge variant="destructive" className="text-[8px] px-1 py-0 h-4">{t('product_out_of_stock')}</Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Product Colors - Filtered */}
                {filteredColors.length > 0 && (
                  <div className="p-3 rounded-xl bg-card/80 border border-border/30">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-7 h-7 rounded-lg bg-muted flex items-center justify-center">
                        <div className="w-4 h-4 rounded-full bg-gradient-to-br from-primary via-accent to-secondary" />
                      </div>
                      <div>
                        <Label className="text-xs font-bold block">{t('product_colors_available')}</Label>
                        {selectedColor && (
                          <span className="text-[10px] text-muted-foreground">{t('product_selected_color')}: {selectedColor}</span>
                        )}
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {filteredColors.map((color: any, index: number) => (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!color.isAvailable) return;
                            const newSelectedColor = selectedColor === color.name_ar ? null : color.name_ar;
                            setSelectedColor(newSelectedColor);
                            if (newSelectedColor && color.image_url) {
                              setColorImageUrl(color.image_url);
                              setSelectedImage(0);
                            } else {
                              setColorImageUrl(null);
                            }
                          }}
                          disabled={!color.isAvailable}
                          className={`group relative flex flex-col items-center gap-1.5 p-2 rounded-xl border-2 transition-all min-w-[70px] ${
                            selectedColor === color.name_ar
                              ? 'border-primary bg-primary/5 shadow-sm'
                              : 'border-border/50 hover:border-primary/30 bg-background/50'
                          } ${!color.isAvailable ? 'opacity-30 cursor-not-allowed' : ''}`}
                        >
                          <div className="relative">
                            <div
                              className={`w-8 h-8 rounded-full border-2 transition-transform group-hover:scale-110 ${
                                selectedColor === color.name_ar ? 'border-primary ring-2 ring-primary/30' : 'border-border'
                              }`}
                              style={{ backgroundColor: color.hex_code }}
                            />
                            {selectedColor === color.name_ar && (
                              <div className="absolute inset-0 flex items-center justify-center">
                                <Check className={`h-4 w-4 ${
                                  color.hex_code?.toLowerCase() === '#ffffff' || color.hex_code?.toLowerCase() === '#fff' 
                                    ? 'text-foreground' : 'text-white'
                                }`} />
                              </div>
                            )}
                          </div>
                          <span className="font-medium text-[10px] leading-tight text-center">{color.name_ar}</span>
                          {/* Show stock for direct sale - per option or general */}
                          {activeSaleType === 'direct' && (() => {
                            const stock = selectedOptionName && color.option_stocks?.[selectedOptionName] != null
                              ? color.option_stocks[selectedOptionName]
                              : color.stock_quantity;
                            return stock != null && stock > 0 ? (
                              <span className="text-[8px] text-muted-foreground">متبقي {stock}</span>
                            ) : null;
                          })()}
                          {color.price != null && color.price !== product.price && activeSaleType !== 'direct' && (
                            <span className="text-[9px] text-muted-foreground">{formatPrice(color.price)}</span>
                          )}
                          {activeSaleType === 'direct' && color.direct_sale_price && (
                            <span className="text-[9px] font-bold text-primary">{formatPrice(color.direct_sale_price)}</span>
                          )}
                          {!color.isAvailable && (
                            <div className="absolute inset-0 flex items-center justify-center bg-background/60 rounded-xl">
                              <X className="h-4 w-4 text-destructive" />
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Price Section */}
              <div className="border-t border-border/30 pt-5 mt-4 mb-4">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-3xl font-black text-primary">
                    {formatPrice(finalPrice)}
                  </span>
                  <span className="text-lg text-muted-foreground">{currency}</span>
                  {hasSale && finalOriginalPrice && (
                    <span className="text-lg line-through text-muted-foreground/60 mr-2">
                      {formatPrice(finalOriginalPrice)}
                    </span>
                  )}
                </div>
                {hasStockInfo && (
                  <p className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                    <BoxIcon className="h-3 w-3" />
                    متبقي {directStockQuantity} قطعة في المخزون
                  </p>
                )}
              </div>

              {/* Product Rewards Section */}
              {(Number((product as any).points_reward) > 0 || (Array.isArray((product as any).card_discounts) && (product as any).card_discounts.length > 0)) && allLoyaltyLevels && (
                <div className="mb-4">
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
                </div>
              )}

              {/* Quantity */}
              {product.in_stock && (
                <div className="border-t border-border/30 pt-5 mb-5">
                  <label className="text-sm font-medium text-foreground mb-2 block">{t('common_quantity')}</label>
                  <div className="flex items-center gap-3">
                    <Button size="icon" variant="outline" className="h-11 w-11" onClick={decrementQuantity} disabled={quantity <= 1}>
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => { const val = parseInt(e.target.value); if (val > 0) setQuantity(val); }}
                      className="h-11 text-center text-lg font-bold w-20"
                    />
                    <Button size="icon" variant="outline" className="h-11 w-11" onClick={incrementQuantity}>
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  size="lg"
                  className="flex-1 bg-primary text-primary-foreground hover:bg-primary/90 text-lg h-14"
                  onClick={handleAddToCart}
                  disabled={!product.in_stock}
                >
                  <ShoppingCart className="ml-2 h-5 w-5" />
                  {product.in_stock ? t('product_add_to_cart') : t('product_out_of_stock')}
                </Button>
                <Button 
                  size="lg"
                  variant="outline"
                  className={`h-14 px-6 ${isFavorite ? 'text-red-500 border-red-500' : ''}`}
                  onClick={handleToggleFavorite}
                  disabled={favoriteLoading || toggleFavoriteMutation.isPending}
                >
                  <Heart className={`h-5 w-5 ${isFavorite ? 'fill-current' : ''}`} />
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Features */}
        {product.features && Array.isArray(product.features) && product.features.length > 0 && (
          <div className="rounded-2xl p-6 border border-border/50 bg-card/50 mb-8">
            <h3 className="text-2xl font-bold text-primary mb-4">{t('product_features')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {product.features.map((feature: any, index: number) => {
                const iconName = feature.icon || 'Package';
                const IconComponent = {
                  Package, Shield, Truck, Star, Award, Check, CheckCircle, Zap, Heart, Sparkles, 
                  Cpu, Battery, Wifi, Smartphone, Monitor, Headphones, Camera, Music, Video, 
                  Image, Disc, Download, Upload, Rocket, Flame, Gift, Crown, Gem, Clock, Timer, 
                  Globe, Lock, Unlock, Key, Settings, Hammer, Lightbulb, Sun, Moon, Cloud, 
                  Droplet, Wind, Leaf, TreePine, Feather, Target, ThumbsUp, Home, Building, Store, 
                  ShoppingBag, CreditCard, Wallet, DollarSign, Tag, BarChart, TrendingUp, Users, 
                  User, Mail, Phone, MessageCircle, Send, Bell, Volume2, Mic
                }[iconName] || Package;
                
                return (
                  <div key={`spec-${index}`} className="flex items-start gap-3 p-3 rounded-lg bg-card/30 border border-border/30">
                    <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                      <IconComponent className="w-5 h-5 text-primary" />
                    </div>
                    <div className="flex-1">
                      <p className="font-medium text-foreground">{feature.text_ar}</p>
                      {feature.text && feature.text !== feature.text_ar && (
                        <p className="text-sm text-muted-foreground mt-1">{feature.text}</p>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Reviews */}
        <div className="mb-8">
          <ProductReviews productId={product.id} />
        </div>

        {/* Related Products */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-3xl font-black text-foreground mb-8">{t('product_related')}</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
              {relatedProducts.map((relatedProduct: any) => (
                <ProductCard
                  key={relatedProduct.id}
                  id={relatedProduct.id}
                  name={relatedProduct.name}
                  nameAr={relatedProduct.name_ar}
                  description={relatedProduct.description}
                  descriptionAr={relatedProduct.description_ar}
                  price={Number(relatedProduct.price)}
                  originalPrice={relatedProduct.original_price ? Number(relatedProduct.original_price) : undefined}
                  imageUrl={relatedProduct.image_url}
                  images={relatedProduct.images}
                  currency={relatedProduct.currency || 'دينار عراقي'}
                  slug={relatedProduct.slug}
                  hasDirectSale={relatedProduct.has_in_stock ?? false}
                />
              ))}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ProductDetail;
