import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Carousel, CarouselContent, CarouselItem, CarouselNext, CarouselPrevious } from '@/components/ui/carousel';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, ShoppingCart, ArrowRight, Package, Shield, Truck, Heart, Minus, Plus, Star, Award, Check, CheckCircle, Zap, Sparkles, Cpu, Battery, Wifi, Smartphone, Monitor, Headphones, Camera, Music, Video, Image, Disc, Download, Upload, Rocket, Flame, Gift, Crown, Gem, Clock, Timer, Globe, Lock, Unlock, Key, Settings, Hammer, Lightbulb, Sun, Moon, Cloud, Droplet, Wind, Leaf, TreePine, Feather, Target, ThumbsUp, Home, Building, Store, ShoppingBag, CreditCard, Wallet, DollarSign, Tag, BarChart, TrendingUp, Users, User, Mail, Phone, MessageCircle, Send, Bell, Volume2, Mic } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { formatPrice } from '@/lib/utils';
import ProductCard from '@/components/ProductCard';

const ProductDetail = () => {
  const { slug } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { addToCart } = useCart();
  const queryClient = useQueryClient();
  const [selectedImage, setSelectedImage] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [selectedOption, setSelectedOption] = useState<string | null>(null);
  const [selectedColor, setSelectedColor] = useState<string | null>(null);
  const [colorImageUrl, setColorImageUrl] = useState<string | null>(null);
  const [selectedShippingOption, setSelectedShippingOption] = useState<'free' | 'fast' | null>(null);

  const { data: product, isLoading } = useQuery({
    queryKey: ['product', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name_ar, name)')
        .eq('slug', slug)
        .maybeSingle();
      
      if (error) throw error;
      if (!data) throw new Error('Product not found');
      return data;
    }
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
      if (!user || !product) {
        throw new Error('User not authenticated');
      }

      if (isFavorite) {
        const { error } = await supabase
          .from('favorites')
          .delete()
          .eq('user_id', user.id)
          .eq('product_id', product.id);
        
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('favorites')
          .insert({
            user_id: user.id,
            product_id: product.id
          });
        
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['favorite', product?.id, user?.id] });
      toast.success(isFavorite ? 'تم حذف المنتج من المفضلة' : 'تم إضافة المنتج للمفضلة');
    },
    onError: (error: any) => {
      if (error.message === 'User not authenticated') {
        toast.error('يجب تسجيل الدخول أولاً');
        navigate('/auth');
      } else {
        toast.error('حدث خطأ، حاول مرة أخرى');
      }
    }
  });

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
          <h2 className="text-2xl font-bold text-foreground mb-4">المنتج غير موجود</h2>
          <Button onClick={() => navigate('/')}>العودة للرئيسية</Button>
        </div>
      </div>
    );
  }

  // إذا كان هناك لون محدد وله صورة، استخدمها بدلاً من صور المنتج الأساسية
  const getProductImages = () => {
    if (colorImageUrl) {
      return [colorImageUrl];
    }
    return product.images && product.images.length > 0 
      ? product.images 
      : product.image_url 
        ? [product.image_url] 
        : [];
  };
  
  const productImages = getProductImages();
  
  const currency = product.currency || 'دينار عراقي';

  // السعر النهائي بحسب اللون والخيار
  const selectedOptionData = productOptions?.find((opt: any) => opt.id === selectedOption);
  const selectedColorData = Array.isArray(product.colors)
    ? (product.colors as any[]).find((c: any) => c.name_ar === selectedColor)
    : null;

  const basePrice = selectedColorData?.price != null
    ? Number(selectedColorData.price)
    : Number(product.price);

  const optionAdjustment = selectedOptionData ? Number(selectedOptionData.price_adjustment) : 0;
  const finalPrice = basePrice + optionAdjustment;

  // اضبط السعر الأصلي ليتماشى مع فرق سعر اللون إن وُجد، ثم أضف فرق الخيار
  let finalOriginalPrice: number | null = null;
  if (product.original_price != null) {
    const productOriginal = Number(product.original_price);
    const colorDelta = selectedColorData?.price != null ? (Number(selectedColorData.price) - Number(product.price)) : 0;
    finalOriginalPrice = productOriginal + colorDelta + optionAdjustment;
  }

  const hasSale = finalOriginalPrice != null && finalOriginalPrice > finalPrice;
  const savings = hasSale && finalOriginalPrice != null ? (finalOriginalPrice - finalPrice) : 0;

  const handleAddToCart = () => {
    // Check if product has options and none selected
    if (productOptions && productOptions.length > 0 && !selectedOption) {
      toast.error('الرجاء اختيار أحد الخيارات المتاحة');
      return;
    }

    // Check if pre-order has shipping options and none selected
    const hasShippingOptions = product.has_pre_order && (product.pre_order_free_shipping_price || product.pre_order_fast_shipping_price);
    if (hasShippingOptions && !selectedShippingOption) {
      toast.error('الرجاء اختيار نوع الشحن للطلب المسبق');
      return;
    }

    addToCart(product.id, selectedOption || undefined, selectedColor || undefined, quantity);
    toast.success(`تم إضافة ${quantity} من المنتج إلى السلة`);
    setQuantity(1);
  };

  const handleToggleFavorite = () => {
    toggleFavoriteMutation.mutate();
  };

  const incrementQuantity = () => {
    setQuantity(prev => prev + 1);
  };

  const decrementQuantity = () => {
    if (quantity > 1) {
      setQuantity(prev => prev - 1);
    }
  };

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        {/* Back Button & Breadcrumb */}
        <div className="mb-8">
          <Button
            variant="outline"
            onClick={() => navigate(-1)}
            className="mb-4"
          >
            <ArrowRight className="h-4 w-4 ml-2" />
            الرجوع للخلف
          </Button>
          
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <button 
              onClick={() => navigate('/')}
              className="hover:text-primary transition-colors"
            >
              الرئيسية
            </button>
            <span>/</span>
            <button 
              onClick={() => navigate('/products')}
              className="hover:text-primary transition-colors"
            >
              المنتجات
            </button>
            <span>/</span>
            <span className="text-foreground">{product.name_ar}</span>
          </div>
        </div>

        {/* Product Details */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 md:gap-8 mb-12">
          {/* Image Section */}
          <div className="relative">
            {hasSale && (
              <TooltipProvider>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <div className="absolute -top-4 -left-4 z-20 cursor-help">
                      <div className="relative">
                        {/* Glow effect */}
                        <div className="absolute inset-0 bg-primary/40 rounded-full blur-lg animate-pulse" />
                        {/* Icon container */}
                        <div className="relative bg-gradient-to-br from-primary to-accent text-primary-foreground rounded-full p-3 shadow-xl backdrop-blur-sm border border-primary-foreground/20 hover:scale-110 transition-transform">
                          <Tag className="h-5 w-5" />
                        </div>
                      </div>
                    </div>
                  </TooltipTrigger>
                  <TooltipContent className="bg-primary text-primary-foreground font-bold text-base px-4 py-2">
                    <p>خصم {finalOriginalPrice ? Math.round((savings / Number(finalOriginalPrice)) * 100) : Math.round((savings / Number(product.original_price!)) * 100)}%</p>
                  </TooltipContent>
                </Tooltip>
              </TooltipProvider>
            )}
            <div className="glass-effect rounded-2xl p-6 border border-border/50 card-premium">
              {productImages.length > 0 ? (
                <div className="space-y-4">
                  {/* Main Image */}
                  <div className="relative aspect-square rounded-xl overflow-hidden bg-card/50">
                    <img 
                      src={productImages[selectedImage]} 
                      alt={`${product.name_ar} - صورة ${selectedImage + 1}`}
                      className="w-full h-full object-cover"
                    />
                    {!product.in_stock && (
                      <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                        <Badge variant="destructive" className="text-lg px-6 py-2">
                          غير متوفر
                        </Badge>
                      </div>
                    )}
                  </div>
                  
                  {/* Thumbnails */}
                  {productImages.length > 1 && (
                    <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-4 gap-2">
                      {productImages.map((img, idx) => (
                        <button
                          key={idx}
                          onClick={() => setSelectedImage(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border-2 transition-all ${
                            selectedImage === idx 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : 'border-border/30 hover:border-primary/50'
                          }`}
                        >
                          <img 
                            src={img} 
                            alt={`${product.name_ar} - صورة مصغرة ${idx + 1}`}
                            className="w-full h-full object-cover"
                          />
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

          {/* Details Section */}
          <div className="flex flex-col gap-6">
            <div className="glass-effect rounded-2xl p-6 border border-border/50">
              {/* Category Badge */}
              {product.categories && (
                <Badge variant="outline" className="mb-4">
                  {(product as any).categories.name_ar}
                </Badge>
              )}

              <h1 className="text-4xl font-black text-gradient-gold mb-4">
                {product.name_ar}
              </h1>
              
              <p className="text-muted-foreground text-lg mb-6 leading-relaxed">
                {product.description_ar || 'لا يوجد وصف متوفر'}
              </p>

              {/* Availability Types */}
              {(product.has_in_stock || product.has_pre_order) && (
                <div className="mb-6 p-4 border border-border/50 rounded-lg bg-card/30">
                  <Label className="text-sm font-bold mb-2 block">خيارات التوفر</Label>
                  <div className="flex flex-wrap gap-2">
                    {product.has_in_stock && (
                      <Badge variant="outline" className="px-3 py-1 text-sm">
                        <Package className="h-4 w-4 ml-1" />
                        متاح في المخزن
                      </Badge>
                    )}
                    {product.has_pre_order && (
                      <Badge variant="outline" className="px-3 py-1 text-sm">
                        <Truck className="h-4 w-4 ml-1" />
                        طلب مسبق
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Pre-Order Shipping Options */}
              {product.has_pre_order && (product.pre_order_free_shipping_price || product.pre_order_fast_shipping_price) && (
                <div className="mb-6">
                  <Label className="text-lg font-bold mb-3 block">خيارات الشحن للطلب المسبق</Label>
                  <RadioGroup 
                    value={selectedShippingOption || ''} 
                    onValueChange={(value) => setSelectedShippingOption(value as 'free' | 'fast')}
                    className="space-y-3"
                  >
                    {product.pre_order_free_shipping_price && (
                      <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-colors bg-card/50">
                        <RadioGroupItem value="free" id="shipping-free" className="flex-shrink-0" />
                        <Label
                          htmlFor="shipping-free"
                          className="flex-1 cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <Truck className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-bold text-foreground">شحن بحري مجاناً (45 يوماً)</div>
                              <div className="text-sm text-muted-foreground">توصيل خلال 45 يوم عمل</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {formatPrice(Number(product.pre_order_free_shipping_price))} {currency}
                          </div>
                        </Label>
                      </div>
                    )}

                    {product.pre_order_fast_shipping_price && (
                      <div className="flex items-center space-x-3 space-x-reverse p-4 border-2 border-border rounded-lg hover:border-primary/50 transition-colors bg-card/50">
                        <RadioGroupItem value="fast" id="shipping-fast" className="flex-shrink-0" />
                        <Label
                          htmlFor="shipping-fast"
                          className="flex-1 cursor-pointer flex items-center justify-between gap-4"
                        >
                          <div className="flex items-center gap-3">
                            <Zap className="h-5 w-5 text-primary" />
                            <div>
                              <div className="font-bold text-foreground">شحن سريع جوي (15 يوماً)</div>
                              <div className="text-sm text-muted-foreground">توصيل خلال 15 يوم عمل</div>
                            </div>
                          </div>
                          <div className="text-lg font-bold text-primary">
                            {formatPrice(Number(product.pre_order_fast_shipping_price))} {currency}
                          </div>
                        </Label>
                      </div>
                    )}
                  </RadioGroup>
                </div>
              )}

              {/* Product Options */}
              {productOptions && productOptions.length > 0 && (
                <div className="border-t border-border/30 pt-6 mb-6">
                  <Label className="text-lg font-bold text-foreground mb-4 block">الخيارات المتاحة</Label>
                  <RadioGroup value={selectedOption || ''} onValueChange={setSelectedOption}>
                    <div className="space-y-3">
                      {productOptions.map((option: any) => (
                        <label
                          key={option.id}
                          htmlFor={`option-${option.id}`}
                          className={`flex items-center justify-between p-4 rounded-lg border-2 transition-all cursor-pointer ${
                            selectedOption === option.id
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/50 hover:bg-accent/5'
                          } ${!option.in_stock ? 'opacity-50 cursor-not-allowed' : ''}`}
                        >
                          <div className="flex items-center gap-3 flex-1">
                            <RadioGroupItem 
                              value={option.id} 
                              id={`option-${option.id}`}
                              disabled={!option.in_stock}
                              className="cursor-pointer"
                            />
                            <div className="flex-1 cursor-pointer">
                              <div className="flex items-center gap-2">
                                <span className="font-medium text-foreground">{option.name_ar}</span>
                                {!option.in_stock && (
                                  <Badge variant="destructive" className="text-xs">غير متوفر</Badge>
                                )}
                              </div>
                              {option.name !== option.name_ar && (
                                <span className="text-sm text-muted-foreground">{option.name}</span>
                              )}
                            </div>
                          </div>
                          <div className="text-left pointer-events-none">
                            {option.price_adjustment !== 0 && (
                              <span className={`font-bold ${option.price_adjustment > 0 ? 'text-primary' : 'text-green-600'}`}>
                                {option.price_adjustment > 0 ? '+' : ''}{formatPrice(Number(option.price_adjustment))} {currency}
                              </span>
                            )}
                          </div>
                        </label>
                      ))}
                    </div>
                  </RadioGroup>
                </div>
              )}

              {/* Product Colors */}
              {product.colors && Array.isArray(product.colors) && product.colors.length > 0 && (
                <div className="border-t border-border/30 pt-6 mb-6">
                  <Label className="text-sm font-bold text-foreground mb-3 block">الألوان المتاحة</Label>
                  <div className="flex flex-wrap gap-2">
                    {product.colors.map((color: any, index: number) => {
                      // اللون متاح إذا كان المنتج طلب مسبق، أو إذا كان متاحاً في المخزون ولم يتم تحديد أنه غير متوفر
                      const isColorAvailable = product.has_pre_order || (product.has_in_stock && color.in_stock !== false);
                      return (
                        <button
                          key={index}
                          type="button"
                          onClick={() => {
                            if (!isColorAvailable) return;
                            const newSelectedColor = selectedColor === color.name_ar ? null : color.name_ar;
                            setSelectedColor(newSelectedColor);
                            // إذا كان للون صورة خاصة، استخدمها
                            if (newSelectedColor && color.image_url) {
                              setColorImageUrl(color.image_url);
                              setSelectedImage(0); // اذهب للصورة الأولى
                            } else {
                              setColorImageUrl(null);
                            }
                          }}
                          disabled={!isColorAvailable}
                          className={`flex items-center gap-2 px-3 py-2 rounded-lg border-2 transition-all ${
                            selectedColor === color.name_ar
                              ? 'border-primary bg-primary/5 ring-2 ring-primary/20'
                              : 'border-border hover:border-primary/50'
                          } ${!isColorAvailable ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer'}`}
                        >
                          <div
                            className="w-5 h-5 rounded-full border-2 border-border shadow-sm"
                            style={{ backgroundColor: color.hex_code }}
                          />
                          <div className="text-right">
                            <div className="font-medium text-foreground text-sm flex items-center gap-2">
                              {color.name_ar}
                              {!isColorAvailable && (
                                <Badge variant="destructive" className="text-xs">غير متوفر</Badge>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Price Section */}
              <div className="border-t border-border/30 pt-6 mb-6">
                <div className="flex items-baseline gap-3 mb-2">
                  <span className="text-5xl font-black text-primary">
                    {formatPrice(finalPrice)}
                  </span>
                  <span className="text-2xl text-muted-foreground">{currency}</span>
                </div>
                
                {hasSale && finalOriginalPrice && (
                  <div className="flex items-center gap-3">
                    <span className="text-2xl line-through text-muted-foreground/60">
                      {formatPrice(finalOriginalPrice)} {currency}
                    </span>
                    <Badge variant="secondary" className="bg-primary/10 text-primary">
                      وفر {formatPrice(finalOriginalPrice - finalPrice)} {currency}
                    </Badge>
                  </div>
                )}
              </div>

              {/* Quantity Selector */}
              {product.in_stock && (
                <div className="border-t border-border/30 pt-6 mb-6">
                  <label className="text-sm font-medium text-foreground mb-2 block">الكمية</label>
                  <div className="flex items-center gap-3">
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-12 w-12"
                      onClick={decrementQuantity}
                      disabled={quantity <= 1}
                    >
                      <Minus className="h-4 w-4" />
                    </Button>
                    <Input
                      type="number"
                      min="1"
                      value={quantity}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (val > 0) setQuantity(val);
                      }}
                      className="h-12 text-center text-lg font-bold w-20"
                    />
                    <Button
                      size="icon"
                      variant="outline"
                      className="h-12 w-12"
                      onClick={incrementQuantity}
                    >
                      <Plus className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-3">
                <Button 
                  size="lg"
                  className="flex-1 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 text-lg h-14"
                  onClick={handleAddToCart}
                  disabled={!product.in_stock}
                >
                  <ShoppingCart className="ml-2 h-5 w-5" />
                  {product.in_stock ? 'أضف إلى السلة' : 'غير متوفر'}
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

            {/* Features - Only admin-added features */}
            {product.features && Array.isArray(product.features) && product.features.length > 0 && (
              <div className="glass-effect rounded-2xl p-6 border border-border/50">
                <h3 className="text-xl font-bold text-foreground mb-4">المميزات</h3>
                <div className="space-y-3">
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
                      <div key={`feature-${index}`} className="flex items-start gap-3">
                        <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center flex-shrink-0">
                          <IconComponent className="w-5 h-5 text-primary" />
                        </div>
                        <div className="flex-1">
                          <p className="font-medium text-foreground">{feature.text_ar}</p>
                          {feature.text !== feature.text_ar && (
                            <p className="text-sm text-muted-foreground">{feature.text}</p>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Additional Info */}
        {(product.description || product.name) && (
          <div className="glass-effect rounded-2xl p-6 border border-border/50 mb-8">
            <h3 className="text-2xl font-bold text-primary mb-4">معلومات إضافية</h3>
            <div className="prose prose-invert max-w-none">
              <p className="text-muted-foreground leading-relaxed">
                {product.description || product.description_ar}
              </p>
            </div>
          </div>
        )}

        {/* Related Products Section */}
        {relatedProducts && relatedProducts.length > 0 && (
          <div className="mb-8">
            <h2 className="text-3xl font-black text-gradient-gold mb-8">منتجات مشابهة</h2>
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
