import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';

const BundlesSection = () => {
  const { data: bundles } = useQuery({
    queryKey: ['home-bundles-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('id, title_ar, image_url, bundle_price, original_price, sale_type')
        .eq('is_active', true)
        .order('display_order')
        .limit(6);
      if (error) throw error;
      return data;
    },
    staleTime: 60 * 1000,
  });

  if (!bundles || bundles.length === 0) return null;

  return (
    <section className="container mx-auto px-3 py-2">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-1.5">
          <Sparkles className="h-3.5 w-3.5 text-primary" />
          <h2 className="text-sm font-black text-foreground">باقات وعروض</h2>
        </div>
        <Link to="/bundles" className="flex items-center gap-0.5 text-[10px] text-primary font-medium">
          الكل
          <ArrowLeft className="h-2.5 w-2.5" />
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
        {bundles.map((bundle) => {
          const discount = bundle.original_price > 0
            ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
            : 0;

          return (
            <Link
              key={bundle.id}
              to="/bundles"
              className="shrink-0 w-[120px] rounded-xl overflow-hidden group relative border border-border/30 bg-card/80 backdrop-blur-md hover:border-primary/40 transition-all duration-300"
            >
              {/* Glass shine */}
              <div className="absolute inset-0 z-10 pointer-events-none rounded-xl opacity-20 group-hover:opacity-30 transition-opacity bg-gradient-to-br from-primary/10 via-transparent to-transparent" />

              {/* Image */}
              {bundle.image_url ? (
                <div className="relative h-[80px] overflow-hidden">
                  <img
                    src={bundle.image_url}
                    alt={bundle.title_ar}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500"
                  />
                  <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
                  {discount > 0 && (
                    <Badge className="absolute top-1 left-1 bg-destructive/90 text-destructive-foreground text-[8px] px-1 py-0 leading-4">
                      -{discount}%
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="h-[80px] flex items-center justify-center bg-muted/20">
                  <Sparkles className="h-5 w-5 text-muted-foreground/20" />
                </div>
              )}

              {/* Info */}
              <div className="relative z-20 px-2 pt-1 pb-2 space-y-0.5">
                <p className="text-[10px] font-bold leading-tight line-clamp-1 text-foreground">{bundle.title_ar}</p>
                <div className="flex items-baseline gap-0.5">
                  <span className="text-xs font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                  <span className="text-[7px] text-muted-foreground">د.ع</span>
                </div>
                {bundle.original_price > 0 && (
                  <span className="text-[8px] text-muted-foreground/60 line-through block leading-none">
                    {formatPrice(bundle.original_price)}
                  </span>
                )}
              </div>
            </Link>
          );
        })}
      </div>
    </section>
  );
};

export default BundlesSection;
