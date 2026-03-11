import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ShoppingCart, ArrowRight, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';

/** Check stock for a bundle item (direct sale) */
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
  'direct': 'مباشر',
  'preorder-air': 'جوي',
  'preorder-sea': 'بحري',
};

const ProductBundles = () => {
  const { user } = useAuth();
  const { addToCart, cartSaleType, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null);

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

        return { ...bundle, items: bundleItems, isOutOfStock };
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

      for (const item of bundle.items) {
        const product = item.products;
        if (!product) continue;
        for (let i = 0; i < item.quantity; i++) {
          const success = await addToCart(
            item.product_id,
            item.selected_option_id || undefined,
            item.selected_color || undefined,
            1,
            undefined,
            bundleSaleType
          );
          if (!success) { toast.error(`فشل إضافة ${product.name_ar} للسلة`); return; }
        }
      }
      toast.success('تم إضافة البندل للسلة بنجاح! 🎉');
    } catch (error) {
      console.error('Error adding bundle to cart:', error);
      toast.error('حدث خطأ في إضافة البندل');
    } finally {
      setAddingBundleId(null);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container max-w-lg mx-auto px-3 pt-4 pb-24">
        {/* Page title */}
        <div className="flex items-center gap-2 mb-4">
          <Link to="/" className="w-8 h-8 rounded-lg bg-muted flex items-center justify-center">
            <ArrowRight className="h-4 w-4 text-foreground" />
          </Link>
          <Package className="h-5 w-5 text-primary" />
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
          <div className="grid grid-cols-2 gap-2.5">
            {bundles.map((bundle: any) => {
              const discount = bundle.original_price > 0
                ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
                : 0;
              const isAdding = addingBundleId === bundle.id;
              const saleType = bundle.sale_type || 'direct';
              const mainImage = bundle.image_url;

              return (
                <div
                  key={bundle.id}
                  className={`rounded-xl border overflow-hidden bg-card transition-all ${bundle.isOutOfStock ? 'opacity-60 border-destructive/30' : 'border-border hover:border-primary/30'}`}
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-muted">
                    {mainImage ? (
                      <img src={mainImage} alt={bundle.title_ar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-8 w-8 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Badges */}
                    {bundle.isOutOfStock ? (
                      <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                        انتهى
                      </Badge>
                    ) : discount > 0 ? (
                      <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                        -{discount}%
                      </Badge>
                    ) : null}
                    <Badge className="absolute top-1.5 right-1.5 bg-background/80 text-foreground text-[9px] px-1 py-0.5 backdrop-blur-sm">
                      {SALE_TYPE_LABELS[saleType] || saleType}
                    </Badge>
                    {/* Items count */}
                    <div className="absolute bottom-1.5 right-1.5 bg-background/80 backdrop-blur-sm rounded-md px-1.5 py-0.5 text-[9px] font-bold text-foreground">
                      {bundle.items.length} منتجات
                    </div>
                  </div>

                  {/* Info */}
                  <div className="p-2.5 space-y-1.5">
                    <p className="text-xs font-bold leading-tight line-clamp-2">{bundle.title_ar}</p>

                    {/* Items preview - small avatars */}
                    <div className="flex items-center -space-x-1.5 rtl:space-x-reverse">
                      {bundle.items.slice(0, 4).map((item: any, idx: number) => {
                        const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
                        const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
                        const img = colorObj?.image_url || colorObj?.image || item.products?.image_url;
                        return (
                          <div key={idx} className="w-6 h-6 rounded-full border-2 border-card overflow-hidden bg-muted shrink-0">
                            {img ? <img src={img} className="w-full h-full object-cover" /> : <Package className="w-3 h-3 m-auto text-muted-foreground/30" />}
                          </div>
                        );
                      })}
                      {bundle.items.length > 4 && (
                        <div className="w-6 h-6 rounded-full border-2 border-card bg-muted flex items-center justify-center text-[8px] font-bold text-muted-foreground">
                          +{bundle.items.length - 4}
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                      <span className="text-[8px] text-muted-foreground">د.ع</span>
                    </div>
                    {bundle.original_price > 0 && (
                      <span className="text-[10px] text-muted-foreground line-through block -mt-1">{formatPrice(bundle.original_price)}</span>
                    )}

                    {/* CTA */}
                    <Button
                      onClick={() => handleAddBundleToCart(bundle)}
                      disabled={isAdding || bundle.isOutOfStock}
                      size="sm"
                      variant={bundle.isOutOfStock ? "secondary" : "default"}
                      className="w-full h-7 text-[11px] gap-1"
                    >
                      {isAdding ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : bundle.isOutOfStock ? (
                        <AlertTriangle className="h-3 w-3" />
                      ) : (
                        <ShoppingCart className="h-3 w-3" />
                      )}
                      {isAdding ? 'جارٍ...' : bundle.isOutOfStock ? 'انتهى' : 'أضف للسلة'}
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductBundles;
