import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ShoppingCart, ArrowRight, AlertTriangle, Check, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';

function getItemStock(product: any, colorName?: string, optionId?: string): number {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  if (colors.length === 0) {
    return product?.direct_stock != null ? Number(product.direct_stock) : 0;
  }
  if (!colorName) {
    let total = 0;
    for (const c of colors) {
      if (c?.available_for_direct_sale === false) continue;
      const stocks = c?.option_stocks;
      if (stocks && typeof stocks === 'object') {
        total += Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
      } else if (c?.stock_quantity != null) {
        total += Math.max(0, Number(c.stock_quantity));
      }
    }
    return total;
  }
  const color = colors.find((c: any) => c.color === colorName || c.name === colorName);
  if (!color) return 0;
  const stocks = color.option_stocks;
  if (stocks && typeof stocks === 'object') {
    if (optionId && stocks[optionId] != null) return Math.max(0, Number(stocks[optionId]));
    return Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
  }
  return color.stock_quantity != null ? Math.max(0, Number(color.stock_quantity)) : 0;
}

const SALE_TYPE_LABELS: Record<string, string> = {
  'direct': 'بيع مباشر',
  'preorder-air': 'طلب مسبق (جوي)',
  'preorder-sea': 'طلب مسبق (بحري)',
};

const ProductBundles = () => {
  const { user } = useAuth();
  const { addBundleToCart, cartSaleType, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null);
  const [expandedBundleId, setExpandedBundleId] = useState<string | null>(null);
  const [selectedImageIndex, setSelectedImageIndex] = useState<Record<string, number>>({});

  const { data: bundles, isLoading } = useQuery({
    queryKey: ['product-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('*')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;

      const bundleIds = data.map((b: any) => b.id);
      if (bundleIds.length === 0) return [];

      const { data: items, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*, products:product_id(name_ar, image_url, images, direct_sale_price, price, colors, direct_stock)')
        .in('bundle_id', bundleIds);
      if (itemsError) throw itemsError;

      return data.map((bundle: any) => {
        const bundleItems = (items || []).filter((item: any) => item.bundle_id === bundle.id);
        const saleType = bundle.sale_type || 'direct';
        const isDirect = saleType === 'direct';

        const isOutOfStock = isDirect && bundleItems.some((item: any) => {
          const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
          return stock < item.quantity;
        });

        // Collect images
        const allImages: string[] = [];
        if (bundle.image_url) allImages.push(bundle.image_url);
        const storedImages = Array.isArray(bundle.images) ? bundle.images : [];
        for (const img of storedImages) {
          if (img && !allImages.includes(img)) allImages.push(img);
        }
        for (const item of bundleItems) {
          const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
          if (item.selected_color) {
            const colorObj = colors.find((c: any) => (c.color || c.name) === item.selected_color);
            const cImg = (colorObj as any)?.image_url || (colorObj as any)?.image;
            if (cImg && !allImages.includes(cImg)) allImages.push(cImg);
          }
        }

        return { ...bundle, items: bundleItems, isOutOfStock, allImages };
      });
    },
    staleTime: 60 * 1000,
  });

  const handleAddBundleToCart = async (bundle: any) => {
    if (!user) { navigate('/auth'); return; }
    if (bundle.isOutOfStock) { toast.error('هذا العرض انتهى - المخزون غير كافٍ'); return; }

    const bundleSaleType = bundle.sale_type === 'direct' ? 'direct' : 'preorder';

    setAddingBundleId(bundle.id);
    try {
      if (cartItems.length > 0 && cartSaleType && cartSaleType !== bundleSaleType) {
        toast.error('السلة تحتوي على نوع مختلف من الطلبات. يرجى إكمال الطلب الحالي أو تفريغ السلة');
        return;
      }

      const success = await addBundleToCart(bundle.id, bundleSaleType as 'direct' | 'preorder');
      if (success) {
        toast.success('تم إضافة الباقة للسلة بنجاح! 🎉');
      }
    } catch (error) {
      console.error('Error adding bundle to cart:', error);
      toast.error('حدث خطأ في إضافة الباقة');
    } finally {
      setAddingBundleId(null);
    }
  };

  const getActiveImage = (bundle: any) => {
    const idx = selectedImageIndex[bundle.id] || 0;
    return bundle.allImages?.[idx] || bundle.image_url;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container max-w-lg mx-auto px-3 pt-4 pb-24">
        {/* Page title */}
        <div className="flex items-center gap-2 mb-4">
          <Link to="/" className="w-8 h-8 rounded-lg bg-card border border-border/50 flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-foreground" />
          </Link>
          <Sparkles className="h-4 w-4 text-primary" />
          <h1 className="text-lg font-black text-foreground">باقات وعروض</h1>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !bundles?.length ? (
          <div className="text-center py-20 space-y-3">
            <Package className="h-12 w-12 mx-auto text-muted-foreground/30" />
            <p className="text-sm text-muted-foreground">لا توجد باقات متاحة حالياً</p>
          </div>
        ) : (
          <div className="space-y-3">
            {bundles.map((bundle: any) => {
              const discount = bundle.original_price > 0
                ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
                : 0;
              const isAdding = addingBundleId === bundle.id;
              const saleType = bundle.sale_type || 'direct';
              const isDirect = saleType === 'direct';
              const activeImage = getActiveImage(bundle);
              const allImages = bundle.allImages || [];
              const isExpanded = expandedBundleId === bundle.id;

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  className={`rounded-2xl border overflow-hidden backdrop-blur-md transition-all duration-300 ${
                    bundle.isOutOfStock 
                      ? 'opacity-60 border-destructive/20 bg-card/60' 
                      : 'border-border/30 bg-card/80 hover:border-primary/30'
                  }`}
                  style={{
                    boxShadow: '0 2px 20px -6px hsl(var(--primary) / 0.06)',
                  }}
                >
                  {/* Main Image */}
                  {activeImage && (
                    <div className="relative h-44 overflow-hidden">
                      <img src={activeImage} alt={bundle.title_ar} className="w-full h-full object-cover" />
                      <div className="absolute inset-0 bg-gradient-to-t from-card via-transparent to-transparent" />
                      
                      {/* Badges */}
                      <div className="absolute top-2.5 left-2.5 flex flex-col gap-1">
                        {bundle.isOutOfStock ? (
                          <Badge className="bg-destructive/90 text-destructive-foreground text-[10px] px-2 py-0.5 backdrop-blur-sm">
                            انتهى العرض
                          </Badge>
                        ) : discount > 0 ? (
                          <Badge className="bg-destructive/90 text-destructive-foreground text-[10px] px-2 py-0.5 backdrop-blur-sm">
                            خصم {discount}%
                          </Badge>
                        ) : null}
                      </div>
                      <Badge className="absolute top-2.5 right-2.5 bg-card/70 text-foreground text-[9px] px-1.5 py-0.5 backdrop-blur-md border border-border/30">
                        {SALE_TYPE_LABELS[saleType] || saleType}
                      </Badge>
                    </div>
                  )}

                  {/* Image thumbnails */}
                  {allImages.length > 1 && (
                    <div className="flex gap-1.5 px-3 pt-2 overflow-x-auto scrollbar-hide">
                      {allImages.map((img: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIndex(prev => ({ ...prev, [bundle.id]: i }))}
                          className={`w-10 h-10 rounded-lg overflow-hidden border-2 shrink-0 transition-all ${
                            (selectedImageIndex[bundle.id] || 0) === i 
                              ? 'border-primary shadow-sm shadow-primary/20' 
                              : 'border-border/30 opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  {/* Content */}
                  <div className="p-3 space-y-2.5">
                    {/* Title & description */}
                    <div>
                      <h2 className="text-sm font-bold text-foreground">{bundle.title_ar}</h2>
                      {bundle.description_ar && (
                        <p className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">{bundle.description_ar}</p>
                      )}
                    </div>

                    {/* Status */}
                    {isDirect && !bundle.isOutOfStock && (
                      <div className="flex items-center gap-1 text-[10px] text-primary">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                        متاح حتى نفاد الكمية
                      </div>
                    )}
                    {isDirect && bundle.isOutOfStock && (
                      <div className="flex items-center gap-1 text-[10px] text-destructive">
                        <AlertTriangle className="h-3 w-3" />
                        انتهت الكمية
                      </div>
                    )}

                    {/* Bundle items toggle */}
                    <button
                      onClick={() => setExpandedBundleId(isExpanded ? null : bundle.id)}
                      className="flex items-center justify-between w-full py-1.5 px-2.5 rounded-lg bg-muted/30 border border-border/20 text-[11px] font-medium text-muted-foreground hover:bg-muted/50 transition-colors"
                    >
                      <span className="flex items-center gap-1.5">
                        <Package className="h-3 w-3" />
                        محتويات الباقة ({bundle.items.length} منتجات)
                      </span>
                      {isExpanded ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                    </button>

                    <AnimatePresence>
                      {isExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.2 }}
                          className="overflow-hidden"
                        >
                          <div className="space-y-1.5 pt-1">
                            {bundle.items.map((item: any, idx: number) => {
                              const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
                              const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
                              const itemImage = colorObj?.image_url || colorObj?.image || item.products?.image_url || item.products?.images?.[0];
                              return (
                                <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/20 border border-border/10">
                                  {itemImage && (
                                    <img src={itemImage} className="w-9 h-9 rounded-lg object-cover shrink-0" />
                                  )}
                                  <div className="flex-1 min-w-0">
                                    <p className="text-[11px] font-medium truncate text-foreground">{item.products?.name_ar || 'منتج'}</p>
                                    <div className="flex items-center gap-1.5 text-[9px] text-muted-foreground">
                                      <span>×{item.quantity}</span>
                                      {item.selected_color && <span>• {item.selected_color}</span>}
                                    </div>
                                  </div>
                                  <Check className="h-3.5 w-3.5 text-primary shrink-0" />
                                </div>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between pt-1.5 border-t border-border/20">
                      <div className="flex items-baseline gap-1">
                        <span className="text-base font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                        <span className="text-[9px] text-muted-foreground">د.ع</span>
                        {bundle.original_price > 0 && (
                          <span className="text-[10px] text-muted-foreground/60 line-through mr-1">{formatPrice(bundle.original_price)}</span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleAddBundleToCart(bundle)}
                        disabled={isAdding || bundle.isOutOfStock}
                        size="sm"
                        variant={bundle.isOutOfStock ? "secondary" : "default"}
                        className="h-8 text-[11px] gap-1.5 px-3"
                      >
                        {isAdding ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : bundle.isOutOfStock ? (
                          <AlertTriangle className="h-3.5 w-3.5" />
                        ) : (
                          <ShoppingCart className="h-3.5 w-3.5" />
                        )}
                        {isAdding ? 'جارٍ...' : bundle.isOutOfStock ? 'انتهى' : 'أضف للسلة'}
                      </Button>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductBundles;
