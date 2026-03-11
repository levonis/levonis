import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { Package, ArrowLeft } from 'lucide-react';
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
    <section className="container mx-auto px-4 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/20 flex items-center justify-center">
            <Package className="h-4 w-4 text-primary" />
          </div>
          <h2 className="text-base font-black text-foreground">باقات وعروض</h2>
        </div>
        <Link to="/bundles" className="flex items-center gap-1 text-xs text-primary font-medium hover:underline">
          عرض الكل
          <ArrowLeft className="h-3 w-3" />
        </Link>
      </div>

      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {bundles.map((bundle) => {
          const discount = bundle.original_price > 0
            ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
            : 0;

          return (
            <Link
              key={bundle.id}
              to="/bundles"
              className="shrink-0 w-40 rounded-xl border border-border bg-card overflow-hidden hover:border-primary/30 transition-colors group"
            >
              {bundle.image_url ? (
                <div className="relative h-28 bg-muted">
                  <img src={bundle.image_url} alt={bundle.title_ar} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
                  {discount > 0 && (
                    <Badge className="absolute top-1.5 left-1.5 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0.5">
                      خصم {discount}%
                    </Badge>
                  )}
                </div>
              ) : (
                <div className="h-28 bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="p-2">
                <p className="text-xs font-bold truncate">{bundle.title_ar}</p>
                <div className="flex items-center gap-1 mt-1">
                  <span className="text-sm font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                  <span className="text-[9px] text-muted-foreground">د.ع</span>
                </div>
                {bundle.original_price > 0 && (
                  <span className="text-[10px] text-muted-foreground line-through">{formatPrice(bundle.original_price)}</span>
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
