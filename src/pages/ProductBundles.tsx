import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Loader2, Package, ArrowRight, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';

const SALE_TYPE_LABELS: Record<string, string> = {
  'direct': 'بيع مباشر',
  'preorder-air': 'طلب مسبق (جوي)',
  'preorder-sea': 'طلب مسبق (بحري)',
};

const ProductBundles = () => {
  const { data: bundles, isLoading } = useQuery({
    queryKey: ['product-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('id, title_ar, description_ar, image_url, bundle_price, original_price, sale_type, display_order')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

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
          <div className="grid grid-cols-2 gap-2.5">
            {bundles.map((bundle: any, idx: number) => {
              const discount = bundle.original_price > 0
                ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
                : 0;
              const saleType = bundle.sale_type || 'direct';

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link
                    to={`/bundles/${bundle.id}`}
                    className="block rounded-xl overflow-hidden border border-border/30 bg-card/80 backdrop-blur-md hover:border-primary/30 transition-all duration-300 group"
                  >
                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden">
                      {bundle.image_url ? (
                        <img
                          src={bundle.image_url}
                          alt={bundle.title_ar}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-muted/20">
                          <Package className="h-8 w-8 text-muted-foreground/20" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-card to-transparent" />

                      {/* Badges */}
                      {discount > 0 && (
                        <Badge className="absolute top-1.5 left-1.5 bg-destructive/90 text-destructive-foreground text-[8px] px-1.5 py-0.5">
                          -{discount}%
                        </Badge>
                      )}
                      <Badge className="absolute top-1.5 right-1.5 bg-card/70 text-foreground text-[7px] px-1 py-0.5 backdrop-blur-md border border-border/30">
                        {SALE_TYPE_LABELS[saleType] || saleType}
                      </Badge>
                    </div>

                    {/* Info */}
                    <div className="p-2 space-y-1">
                      <p className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight">{bundle.title_ar}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                        <span className="text-[8px] text-muted-foreground">د.ع</span>
                      </div>
                      {bundle.original_price > 0 && (
                        <span className="text-[9px] text-muted-foreground/60 line-through block leading-none">
                          {formatPrice(bundle.original_price)}
                        </span>
                      )}
                    </div>
                  </Link>
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
