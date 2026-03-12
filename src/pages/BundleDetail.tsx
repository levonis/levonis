import { useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ShoppingCart, AlertTriangle, Package, Plus, Minus, ChevronLeft, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';

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

const BundleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { addBundleToCart, cartSaleType, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { data: bundle, isLoading } = useQuery({
    queryKey: ['bundle-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('*')
        .eq('id', id!)
        .eq('is_active', true)
        .single();
      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*, products:product_id(id, slug, name_ar, image_url, images, direct_sale_price, price, colors, direct_stock)')
        .eq('bundle_id', id!);
      if (itemsError) throw itemsError;

      const saleType = data.sale_type || 'direct';
      const isDirect = saleType === 'direct';

      const isOutOfStock = isDirect && (items || []).some((item: any) => {
        const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
        return stock < item.quantity;
      });

      // Collect images
      const allImages: string[] = [];
      if (data.image_url) allImages.push(data.image_url);
      const storedImages = Array.isArray(data.images) ? data.images : [];
      for (const img of storedImages) {
        if (img && !allImages.includes(img)) allImages.push(img);
      }
      for (const item of (items || [])) {
        const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
        if (item.selected_color) {
          const colorObj = colors.find((c: any) => (c.color || c.name) === item.selected_color);
          const cImg = (colorObj as any)?.image_url || (colorObj as any)?.image;
          if (cImg && !allImages.includes(cImg)) allImages.push(cImg);
        }
      }

      // Calculate max quantity
      let maxQty = isDirect ? Infinity : 99;
      if (isDirect) {
        for (const item of (items || [])) {
          const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
          const perBundle = item.quantity || 1;
          maxQty = Math.min(maxQty, Math.floor(stock / perBundle));
        }
        if (maxQty === Infinity) maxQty = 0;
      }

      return { ...data, items: items || [], isOutOfStock, allImages, maxQuantity: maxQty };
    },
    enabled: !!id,
  });

  const handleAddToCart = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!bundle || bundle.isOutOfStock) { toast.error('هذا العرض انتهى - المخزون غير كافٍ'); return; }

    const bundleSaleType = bundle.sale_type === 'direct' ? 'direct' : 'preorder';
    setIsAdding(true);
    try {
      if (cartItems.length > 0 && cartSaleType && cartSaleType !== bundleSaleType) {
        toast.error('السلة تحتوي على نوع مختلف من الطلبات. يرجى إكمال الطلب الحالي أو تفريغ السلة');
        return;
      }
      const success = await addBundleToCart(bundle.id, bundleSaleType as 'direct' | 'preorder', quantity);
      if (success) {
        toast.success('تم إضافة الباقة للسلة بنجاح! 🎉');
        setQuantity(1);
      }
    } catch (error) {
      console.error('Error adding bundle to cart:', error);
      toast.error('حدث خطأ في إضافة الباقة');
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-3" dir="rtl">
        <Package className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">الباقة غير موجودة</p>
        <Link to="/bundles" className="text-xs text-primary">العودة للباقات</Link>
      </div>
    );
  }

  const saleType = bundle.sale_type || 'direct';
  const isDirect = saleType === 'direct';
  const discount = bundle.original_price > 0
    ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
    : 0;
  const activeImage = bundle.allImages?.[selectedImageIndex] || bundle.image_url;
  const maxQty = bundle.maxQuantity || 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/80 backdrop-blur-md border-b border-border/30">
        <div className="container max-w-lg mx-auto px-3 py-2.5 flex items-center gap-2">
          <Link to="/bundles" className="w-8 h-8 rounded-lg bg-card border border-border/50 flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-foreground" />
          </Link>
          <h1 className="text-sm font-bold text-foreground truncate flex-1">{bundle.title_ar}</h1>
          <Badge className="bg-muted text-muted-foreground text-[9px] px-1.5 py-0.5 border border-border/30">
            {SALE_TYPE_LABELS[saleType] || saleType}
          </Badge>
        </div>
      </div>

      <div className="container max-w-lg mx-auto px-3 pb-32">
        {/* Main Image */}
        {activeImage && (
          <div className="relative mt-3 rounded-2xl overflow-hidden border border-border/20">
            <img src={activeImage} alt={bundle.title_ar} className="w-full aspect-square object-cover" />
            {bundle.isOutOfStock && (
              <div className="absolute inset-0 bg-background/60 flex items-center justify-center">
                <Badge className="bg-destructive text-destructive-foreground text-sm px-4 py-1.5">انتهى العرض</Badge>
              </div>
            )}
            {!bundle.isOutOfStock && discount > 0 && (
              <Badge className="absolute top-3 left-3 bg-destructive/90 text-destructive-foreground text-xs px-2.5 py-1">
                خصم {discount}%
              </Badge>
            )}
          </div>
        )}

        {/* Image thumbnails */}
        {bundle.allImages.length > 1 && (
          <div className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1">
            {bundle.allImages.map((img: string, i: number) => (
              <button
                key={i}
                onClick={() => setSelectedImageIndex(i)}
                className={`w-14 h-14 rounded-xl overflow-hidden border-2 shrink-0 transition-all ${
                  selectedImageIndex === i
                    ? 'border-primary shadow-sm shadow-primary/20'
                    : 'border-border/30 opacity-60 hover:opacity-100'
                }`}
              >
                <img src={img} className="w-full h-full object-cover" />
              </button>
            ))}
          </div>
        )}

        {/* Title & Description */}
        <div className="mt-4 space-y-2">
          <h2 className="text-lg font-black text-foreground">{bundle.title_ar}</h2>
          {bundle.description_ar && (
            <p className="text-xs text-muted-foreground leading-relaxed">{bundle.description_ar}</p>
          )}
        </div>

        {/* Price section */}
        <div className="mt-4 p-3 rounded-xl bg-card border border-border/30">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                <span className="text-[10px] text-muted-foreground">د.ع</span>
              </div>
              {bundle.original_price > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-muted-foreground/60 line-through">{formatPrice(bundle.original_price)}</span>
                  {discount > 0 && (
                    <span className="text-[10px] text-primary font-bold">وفّر {formatPrice(bundle.original_price - bundle.bundle_price)} د.ع</span>
                  )}
                </div>
              )}
            </div>
            {isDirect && !bundle.isOutOfStock && maxQty > 0 && (
              <div className="text-[10px] text-muted-foreground text-left">
                <span className="block">متوفر</span>
                <span className="font-bold text-foreground">{maxQty} باقة</span>
              </div>
            )}
          </div>
        </div>

        {/* Bundle Contents */}
        <div className="mt-4">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Package className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">محتويات الباقة</h3>
            <span className="text-[10px] text-muted-foreground">({bundle.items.length} منتجات)</span>
          </div>

          <div className="space-y-2">
            {bundle.items.map((item: any, idx: number) => {
              const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
              const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
              const itemImage = colorObj?.image_url || colorObj?.image || item.products?.image_url || item.products?.images?.[0];
              const productSlug = item.products?.slug || item.products?.id || item.product_id;
              return (
                <Link
                  to={`/product/${productSlug}`}
                  key={idx}
                >
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-2.5 rounded-xl bg-card border border-border/20 hover:border-primary/30 transition-colors"
                  >
                  {itemImage && (
                    <img src={itemImage} className="w-14 h-14 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{item.products?.name_ar || 'منتج'}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                      <span>الكمية: {item.quantity}</span>
                      {item.selected_color && <span>• {item.selected_color}</span>}
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-muted-foreground/40 shrink-0" />
                </motion.div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Products Strip */}
        <div className="mt-5">
          <div className="flex items-center gap-1.5 mb-2.5">
            <Sparkles className="h-4 w-4 text-primary" />
            <h3 className="text-sm font-bold text-foreground">المنتجات في هذه الباقة</h3>
          </div>
          <div className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2">
            {bundle.items.map((item: any, idx: number) => {
              const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
              const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
              const itemImage = colorObj?.image_url || colorObj?.image || item.products?.image_url || item.products?.images?.[0];
              const productSlug = item.products?.slug || item.products?.id || item.product_id;
              return (
                <Link
                  key={idx}
                  to={`/product/${productSlug}`}
                  className="shrink-0 w-[100px] rounded-xl overflow-hidden border border-border/30 bg-card hover:border-primary/40 transition-all group"
                >
                  {itemImage && (
                    <div className="h-[80px] overflow-hidden">
                      <img src={itemImage} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300" />
                    </div>
                  )}
                  <div className="p-1.5">
                    <p className="text-[9px] font-bold text-foreground line-clamp-2 leading-tight">{item.products?.name_ar || 'منتج'}</p>
                    <p className="text-[8px] text-primary mt-0.5">عرض المنتج ←</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-card border-t border-border/30" style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}>
        <div className="container max-w-lg mx-auto px-3 py-3 flex items-center gap-3">
          {/* Quantity selector */}
          {isDirect && !bundle.isOutOfStock && maxQty > 0 && (
            <div className="flex items-center border border-border/40 rounded-lg overflow-hidden shrink-0">
              <button
                onClick={() => setQuantity(q => Math.max(1, q - 1))}
                disabled={quantity <= 1}
                className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:bg-muted/50 disabled:opacity-30"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="h-9 w-10 flex items-center justify-center text-sm font-bold text-foreground border-x border-border/40 bg-muted/20">
                {quantity}
              </span>
              <button
                onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                disabled={quantity >= maxQty}
                className="h-9 w-9 flex items-center justify-center text-muted-foreground hover:bg-muted/50 disabled:opacity-30"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          {/* Price */}
          <div className="flex-1 min-w-0">
            <div className="flex items-baseline gap-1">
              <span className="text-base font-black text-primary">{formatPrice(bundle.bundle_price * quantity)}</span>
              <span className="text-[9px] text-muted-foreground">د.ع</span>
            </div>
            {quantity > 1 && (
              <span className="text-[9px] text-muted-foreground">{formatPrice(bundle.bundle_price)} × {quantity}</span>
            )}
          </div>

          {/* Add to cart */}
          <Button
            onClick={handleAddToCart}
            disabled={isAdding || bundle.isOutOfStock}
            size="sm"
            variant={bundle.isOutOfStock ? "secondary" : "default"}
            className="h-10 text-xs gap-2 px-5"
          >
            {isAdding ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : bundle.isOutOfStock ? (
              <AlertTriangle className="h-4 w-4" />
            ) : (
              <ShoppingCart className="h-4 w-4" />
            )}
            {isAdding ? 'جارٍ...' : bundle.isOutOfStock ? 'انتهى' : 'أضف للسلة'}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default BundleDetail;
