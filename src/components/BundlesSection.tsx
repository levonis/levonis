import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ArrowLeft, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { pickI18n } from '@/lib/i18nField';
import { resizeSupabaseImage } from '@/lib/imageUtils';
import { useActiveLevoCard } from '@/hooks/useActiveLevoCard';

const BundlesSection = () => {
  const { t, language } = useLanguage();
  const { data: activeLevoCard } = useActiveLevoCard();
  const { data: bundles } = useQuery({
    queryKey: ['home-bundles-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('id, title_ar, title_en, title_ku, image_url, bundle_price, original_price, sale_type')
        .eq('is_active', true)
        .order('display_order')
        .limit(6);
      if (error) throw error;
      return data;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  if (!activeLevoCard) return null;
  if (!bundles || bundles.length === 0) return null;

  return (
    <section className="container mx-auto px-3 py-3">
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-md border border-primary/20 flex items-center justify-center">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
          </div>
          <h2 className="text-sm font-black text-foreground tracking-tight">{t('section_bundles_title')}</h2>
        </div>
        <Link
          to="/bundles"
          className="flex items-center gap-1 text-[11px] font-medium text-primary px-2.5 py-1 rounded-full bg-primary/5 backdrop-blur-md border border-primary/15 hover:bg-primary/10 transition-colors"
        >
          {t('section_view_all')}
          <ArrowLeft className="h-2.5 w-2.5" />
        </Link>
      </div>

      {/* Cards rail */}
      <div
        className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide"
        style={{
          WebkitOverflowScrolling: 'touch',
          overscrollBehaviorX: 'contain',
          overscrollBehaviorY: 'auto',
        }}
      >
        {bundles.map((bundle) => {
          const discount = bundle.original_price > 0
            ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
            : 0;

          return (
            <Link
              key={bundle.id}
              to="/bundles"
              className="group shrink-0 w-[130px] relative rounded-2xl overflow-hidden border border-white/15 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.15)] hover:shadow-[0_8px_28px_-4px_hsl(var(--primary)/0.3)] hover:border-primary/30 hover:-translate-y-0.5 transition-all duration-300"
            >
              {/* Top highlight */}
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent z-20 pointer-events-none" />
              {/* Glass tint */}
              <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5 pointer-events-none z-10" />

              {/* Image */}
              {bundle.image_url ? (
                <div className="relative h-[88px] overflow-hidden">
                  <img
                    src={resizeSupabaseImage(bundle.image_url, 400, 75) || bundle.image_url}
                    alt={pickI18n(bundle, 'title', language)}
                    className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500 pointer-events-none"
                    loading="lazy"
                    decoding="async"
                    draggable={false}
                  />
                  {/* Bottom fade into glass */}
                  <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/40 to-transparent backdrop-blur-[1px]" />
                  {discount > 0 && (
                    <div className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded-md bg-destructive/90 backdrop-blur-md border border-destructive-foreground/20 text-destructive-foreground text-[9px] font-bold leading-none shadow-lg">
                      -{discount}%
                    </div>
                  )}
                </div>
              ) : (
                <div className="h-[88px] flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/5">
                  <Sparkles className="h-6 w-6 text-primary/30" />
                </div>
              )}

              {/* Info */}
              <div className="relative z-20 px-2.5 pt-1.5 pb-2.5 space-y-1">
                <p className="text-[11px] font-bold leading-tight line-clamp-1 text-foreground">
                  {pickI18n(bundle, 'title', language)}
                </p>
                <div className="flex items-baseline gap-1">
                  <span className="text-sm font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                  <span className="text-[8px] text-muted-foreground font-medium">د.ع</span>
                </div>
                {bundle.original_price > 0 && bundle.original_price > bundle.bundle_price && (
                  <span className="text-[9px] text-muted-foreground/60 line-through block leading-none">
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
