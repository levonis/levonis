import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ShoppingCart, Sparkles, ArrowRight, Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { useNavigate, Link } from 'react-router-dom';
import Header from '@/components/Header';
import Footer from '@/components/Footer';

const ProductBundles = () => {
  const { user } = useAuth();
  const { addToCart, forceAddToCart, cartSaleType, items: cartItems } = useCart();
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

      // Fetch items for each bundle
      const bundleIds = data.map((b: any) => b.id);
      if (bundleIds.length === 0) return [];

      const { data: items, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*, products:product_id(name_ar, image_url, images, direct_sale_price, price, colors)')
        .in('bundle_id', bundleIds);
      if (itemsError) throw itemsError;

      return data.map((bundle: any) => ({
        ...bundle,
        items: (items || []).filter((item: any) => item.bundle_id === bundle.id),
      }));
    },
    staleTime: 60 * 1000,
  });

  const handleAddBundleToCart = async (bundle: any) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setAddingBundleId(bundle.id);
    try {
      // Check if cart has pre-order items
      if (cartItems.length > 0 && cartSaleType === 'preorder') {
        toast.error('السلة تحتوي على طلبات مسبقة. يرجى إكمال الطلب الحالي أو تفريغ السلة');
        return;
      }

      // Add each bundle item to cart
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
            'direct'
          );
          if (!success) {
            toast.error(`فشل إضافة ${product.name_ar} للسلة`);
            return;
          }
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
      <Header />
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        {/* Header */}
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

              return (
                <Card key={bundle.id} className="overflow-hidden border-primary/10 hover:border-primary/30 transition-all">
                  {/* Bundle image */}
                  {bundle.image_url && (
                    <div className="relative h-40 bg-muted">
                      <img src={bundle.image_url} alt={bundle.title_ar} className="w-full h-full object-cover" />
                      {discount > 0 && (
                        <Badge className="absolute top-3 left-3 bg-destructive text-destructive-foreground text-sm px-3 py-1">
                          خصم {discount}%
                        </Badge>
                      )}
                    </div>
                  )}

                  <CardContent className="p-4 space-y-3">
                    {/* Title & Description */}
                    <div>
                      <div className="flex items-center gap-2">
                        <h2 className="text-lg font-bold text-foreground">{bundle.title_ar}</h2>
                        {!bundle.image_url && discount > 0 && (
                          <Badge className="bg-destructive text-destructive-foreground text-xs">خصم {discount}%</Badge>
                        )}
                      </div>
                      {bundle.description_ar && (
                        <p className="text-sm text-muted-foreground mt-1">{bundle.description_ar}</p>
                      )}
                    </div>

                    {/* Bundle Items */}
                    <div className="space-y-2">
                      <p className="text-xs font-bold text-muted-foreground flex items-center gap-1">
                        <Sparkles className="h-3 w-3 text-primary" />
                        محتويات الباقة
                      </p>
                      <div className="space-y-1.5">
                        {bundle.items.map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
                            {(item.products?.image_url || item.products?.images?.[0]) && (
                              <img
                                src={item.products?.image_url || item.products?.images?.[0]}
                                className="w-10 h-10 rounded object-cover shrink-0"
                              />
                            )}
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium truncate">{item.products?.name_ar || 'منتج'}</p>
                              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                <span>الكمية: {item.quantity}</span>
                                {item.selected_color && <span>• اللون: {item.selected_color}</span>}
                              </div>
                            </div>
                            <Check className="h-4 w-4 text-primary shrink-0" />
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Price & CTA */}
                    <div className="flex items-center justify-between pt-2 border-t border-border/50">
                      <div>
                        <span className="text-xl font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                        <span className="text-xs text-muted-foreground mr-1">د.ع</span>
                        {bundle.original_price > 0 && (
                          <span className="text-sm text-muted-foreground line-through mr-2">
                            {formatPrice(bundle.original_price)}
                          </span>
                        )}
                      </div>
                      <Button
                        onClick={() => handleAddBundleToCart(bundle)}
                        disabled={isAdding}
                        className="gap-2"
                      >
                        {isAdding ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <ShoppingCart className="h-4 w-4" />
                        )}
                        {isAdding ? 'جارٍ الإضافة...' : 'أضف للسلة'}
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
