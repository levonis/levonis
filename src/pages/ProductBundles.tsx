import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ShoppingCart, Sparkles, ArrowRight, Check, AlertTriangle } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

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
  'direct': 'بيع مباشر',
  'preorder-air': 'طلب مسبق (جوي)',
  'preorder-sea': 'طلب مسبق (بحري)',
};

const ProductBundles = () => {
  const { user } = useAuth();
  const { addToCart, cartSaleType, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [addingBundleId, setAddingBundleId] = useState<string | null>(null);
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

        // Stock check only for direct sale
        const isOutOfStock = isDirect && bundleItems.some((item: any) => {
          const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
          return stock < item.quantity;
        });

        // Collect all images: main image + color images from items
        const allImages: string[] = [];
        if (bundle.image_url) allImages.push(bundle.image_url);
        // Add stored color images
        const storedImages = Array.isArray(bundle.images) ? bundle.images : [];
        for (const img of storedImages) {
          if (img && !allImages.includes(img)) allImages.push(img);
        }
        // Also get color images from items
        for (const item of bundleItems) {
          const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
          if (item.selected_color) {
          const colorObj = colors.find((c: any) => (c.color || c.name) === item.selected_color);
            const cImg = (colorObj as any)?.image;
            if (cImg && !allImages.includes(cImg)) {
              allImages.push(cImg);
            }
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
      // Check cart compatibility
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

  const getActiveImage = (bundle: any) => {
    const idx = selectedImageIndex[bundle.id] || 0;
    return bundle.allImages?.[idx] || bundle.image_url;
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <div className="w-10 h-10 rounded-xl bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Package className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-xl font-black text-foreground">باقات المنتجات</h1>
            <p className="text-sm text-muted-foreground">اشترِ بالجملة ووفر أكثر</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : !bundles?.length ? (
          <div className="text-center py-20 space-y-3">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/30" />
            <p className="text-muted-foreground">لا توجد باقات متاحة حالياً</p>
            <Link to="/">
              <Button variant="outline" size="sm">
                <ArrowRight className="h-4 w-4 ml-1" />
                العودة للرئيسية
              </Button>
            </Link>
          </div>
        ) : (
          <div className="space-y-4">
            {bundles.map((bundle: any) => {
              const discount = bundle.original_price > 0
                ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
                : 0;
              const isAdding = addingBundleId === bundle.id;
              const saleType = bundle.sale_type || 'direct';
              const isDirect = saleType === 'direct';
              const activeImage = getActiveImage(bundle);
              const allImages = bundle.allImages || [];

              return (
                <Card key={bundle.id} className={`overflow-hidden transition-all ${bundle.isOutOfStock ? 'opacity-70 border-destructive/30' : 'border-primary/10 hover:border-primary/30'}`}>
                  {/* Main Image */}
                  {activeImage && (
                    <div className="relative h-48 bg-muted">
                      <img src={activeImage} alt={bundle.title_ar} className="w-full h-full object-cover" />
                      {bundle.isOutOfStock ? (
                        <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-sm px-3 py-1">
                          انتهى العرض
                        </Badge>
                      ) : discount > 0 ? (
                        <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-sm px-3 py-1">
                          خصم {discount}%
                        </Badge>
                      ) : null}
                      {/* Sale type badge */}
                      <Badge className="absolute top-3 right-3 bg-background/80 text-foreground text-xs backdrop-blur-sm">
                        {SALE_TYPE_LABELS[saleType] || saleType}
                      </Badge>
                    </div>
                  )}

                  {/* Image thumbnails */}
                  {allImages.length > 1 && (
                    <div className="flex gap-1.5 px-4 pt-3 overflow-x-auto">
                      {allImages.map((img: string, i: number) => (
                        <button
                          key={i}
                          onClick={() => setSelectedImageIndex(prev => ({ ...prev, [bundle.id]: i }))}
                          className={`w-12 h-12 rounded-lg overflow-hidden border-2 shrink-0 transition-colors ${(selectedImageIndex[bundle.id] || 0) === i ? 'border-primary' : 'border-border'}`}
                        >
                          <img src={img} className="w-full h-full object-cover" />
                        </button>
                      ))}
                    </div>
                  )}

                  <CardContent className="p-4 space-y-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">{bundle.title_ar}</h2>
                        {!activeImage && bundle.isOutOfStock && (
                          <Badge className="bg-destructive text-destructive-foreground text-xs">انتهى العرض</Badge>
                        )}
                        {!activeImage && !bundle.isOutOfStock && discount > 0 && (
                          <Badge className="bg-destructive text-destructive-foreground text-xs">خصم {discount}%</Badge>
                        )}
                      </div>
                      {bundle.description_ar && (
                        <p className="text-sm text-muted-foreground mt-1">{bundle.description_ar}</p>
                      )}
                    </div>

                    {/* Stock status - only for direct */}
                    {isDirect && !bundle.isOutOfStock && (
                      <div className="flex items-center gap-1.5 text-xs text-primary">
                        <span className="w-2 h-2 rounded-full bg-primary animate-pulse" />
                        العرض مستمر حتى نفاد الكمية
                      </div>
                    )}
                    {isDirect && bundle.isOutOfStock && (
                      <div className="flex items-center gap-1.5 text-xs text-destructive">
                        <AlertTriangle className="h-3.5 w-3.5" />
                        انتهت الكمية المتاحة لهذا العرض
                      </div>
                    )}
                    {!isDirect && (
                      <div className="flex items-center gap-1.5 text-xs text-accent-foreground">
                        <span className="w-2 h-2 rounded-full bg-accent-foreground/70 animate-pulse" />
                        طلب مسبق - {saleType === 'preorder-air' ? 'شحن جوي' : 'شحن بحري'}
                      </div>
                    )}

                    {/* Bundle Items */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        محتويات الباقة
                      </p>
                      <div className="space-y-1.5">
                        {bundle.items.map((item: any, idx: number) => {
                          const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
                          const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
                          const itemImage = colorObj?.image || item.products?.image_url || item.products?.images?.[0];
                          return (
                            <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                              {itemImage && (
                                <img src={itemImage} className="w-10 h-10 rounded object-cover shrink-0" />
                              )}
                              <div className="flex-1 min-w-0">
                                <p className="text-sm font-medium truncate">{item.products?.name_ar || 'منتج'}</p>
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>الكمية: {item.quantity}</span>
                                  {item.selected_color && <span>• {item.selected_color}</span>}
                                </div>
                              </div>
                              <Check className="h-4 w-4 text-primary shrink-0" />
                            </div>
                          );
                        })}
                      </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div>
                        <span className="text-xl font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                        <span className="text-xs text-muted-foreground mr-1">د.ع</span>
                        {bundle.original_price > 0 && (
                          <span className="text-sm text-muted-foreground line-through mr-2">{formatPrice(bundle.original_price)}</span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleAddBundleToCart(bundle)}
                        disabled={isAdding || bundle.isOutOfStock}
                        className="gap-2"
                        variant={bundle.isOutOfStock ? "secondary" : "default"}
                      >
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : bundle.isOutOfStock ? (
                          <AlertTriangle className="h-4 w-4" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                        {isAdding ? 'جارٍ الإضافة...' : bundle.isOutOfStock ? 'انتهى العرض' : 'أضف للسلة'}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>
      <Footer />
    </div>
  );
};

export default ProductBundles;
