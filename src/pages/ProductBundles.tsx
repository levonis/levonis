import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Badge } from '@/components/ui/badge';
import { Package, ArrowRight, Sparkles, Clock } from 'lucide-react';
import { ListCardsSkeleton } from '@/components/ui/PageSkeletons';
import { formatPrice } from '@/lib/utils';
import { Link, Navigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { pickI18n } from '@/lib/i18nField';
import { useActiveLevoCard } from '@/hooks/useActiveLevoCard';

// Compact countdown shown on bundle cards.
// Renders D:H:M when > 1 day remains, otherwise H:M:S.
function BundleCountdown({ endsAt, onExpire }: { endsAt: string; onExpire?: () => void }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(endsAt).getTime() - now;
  useEffect(() => {
    if (diff <= 0) onExpire?.();
  }, [diff <= 0]); // eslint-disable-line react-hooks/exhaustive-deps
  if (diff <= 0) return null;
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const label = days > 0
    ? `${days}:${pad(hours)}:${pad(minutes)}`
    : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return (
    <div className="absolute bottom-1.5 left-1.5 right-1.5 z-20 flex items-center justify-center gap-1 px-1.5 py-0.5 rounded-md bg-background/80 backdrop-blur-xl border border-primary/30 text-primary text-[9px] font-bold leading-none shadow-md font-mono">
      <Clock className="h-2.5 w-2.5 animate-pulse" />
      <span dir="ltr">{label}</span>
    </div>
  );
}

const SALE_TYPE_KEYS: Record<string, 'sale_type_direct' | 'sale_type_preorder_air' | 'sale_type_preorder_sea'> = {
  'direct': 'sale_type_direct',
  'preorder-air': 'sale_type_preorder_air',
  'preorder-sea': 'sale_type_preorder_sea',
};

const ProductBundles = () => {
  const { language, t } = useLanguage();
  const { data: activeCard, isLoading: cardLoading } = useActiveLevoCard();
  const { data: bundles, isLoading } = useQuery({
    queryKey: ['product-bundles'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('id, title_ar, title_en, title_ku, description_ar, description_en, description_ku, image_url, bundle_price, original_price, sale_type, display_order, offer_ends_at, bundle_items(product_id, quantity, selected_color, selected_option_id)')
        .eq('is_active', true)
        .or(`offer_ends_at.is.null,offer_ends_at.gt.${new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()}`)
        .order('display_order');
      if (error) throw error;
      if (!data?.length) return [];

      // Stock check applies ONLY to direct-sale bundles.
      // Pre-order bundles (preorder-air / preorder-sea) do NOT consume direct stock
      // and must never be marked as out of stock based on products.direct_stock.
      const directBundles = data.filter((b: any) => (b.sale_type || 'direct') === 'direct');
      const productIds = [...new Set(directBundles.flatMap((b: any) => b.bundle_items?.map((i: any) => i.product_id) || []))];
      const stockMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: stockData } = await supabase
          .from('products')
          .select('id, direct_stock, colors')
          .in('id', productIds);
        (stockData || []).forEach((p: any) => stockMap.set(p.id, p));
      }

      return data.map((b: any) => {
        const saleType = b.sale_type || 'direct';
        if (saleType !== 'direct') return { ...b, outOfStock: false };
        let outOfStock = false;
        for (const item of (b.bundle_items || [])) {
          const product = stockMap.get(item.product_id);
          if (!product) { outOfStock = true; break; }
          if (item.selected_color && product.colors) {
            const colorArr = Array.isArray(product.colors) ? product.colors : [];
            const colorEntry = colorArr.find((c: any) => c.name === item.selected_color || c.name_ar === item.selected_color);
            if (colorEntry) {
              const optStocks = colorEntry.option_stocks || {};
              let stock = 0;
              if (item.selected_option_id) {
                stock = optStocks[item.selected_option_id] ?? 0;
              } else if (Object.keys(optStocks).length > 0) {
                stock = (Object.values(optStocks) as number[]).reduce((sum: number, v: number) => sum + Number(v), 0);
              } else {
                stock = colorEntry.stock ?? product.direct_stock ?? 0;
              }
              if (stock < (item.quantity || 1)) { outOfStock = true; break; }
            }
          } else {
            if ((product.direct_stock ?? 0) < (item.quantity || 1)) { outOfStock = true; break; }
          }
        }
        return { ...b, outOfStock };
      });
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // Gate: bundles are exclusive to active Levo card holders
  if (!cardLoading && !activeCard) {
    return <Navigate to="/rewards?tab=cards" replace state={{ lockedReason: 'bundles' }} />;
  }

  return (
    <div className="min-h-screen bg-transparent" dir="rtl">
      <div className="container max-w-lg mx-auto px-3 pt-4 pb-24">
        {/* Page title */}
        <div className="flex items-center gap-2 mb-4">
          <Link
            to="/"
            aria-label={t('bundles_back_home')}
            className="w-9 h-9 rounded-xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl border border-white/15 dark:border-white/10 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.15)] flex items-center justify-center hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowRight className="h-4 w-4 text-foreground" aria-hidden="true" />
          </Link>
          <div className="w-8 h-8 rounded-xl bg-primary/15 backdrop-blur-xl border border-primary/30 flex items-center justify-center" aria-hidden="true">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <h1 className="text-lg font-black text-foreground tracking-tight">{t('section_bundles_title')}</h1>
        </div>

        {isLoading ? (
          <ListCardsSkeleton count={4} />
        ) : !bundles?.length ? (
          <div className="text-center py-20 space-y-3">
            <div className="w-16 h-16 mx-auto rounded-2xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl border border-white/15 dark:border-white/10 flex items-center justify-center">
              <Package className="h-8 w-8 text-muted-foreground/40" />
            </div>
            <p className="text-sm text-muted-foreground">{t('bundles_empty')}</p>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2.5">
            {bundles.map((bundle: any, idx: number) => {
              const discount = bundle.original_price > 0
                ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
                : 0;
              const saleType = bundle.sale_type || 'direct';
              const endsAt = bundle.offer_ends_at ? new Date(bundle.offer_ends_at).getTime() : null;
              const isExpired = endsAt !== null && endsAt <= Date.now();
              const isDisabled = bundle.outOfStock || isExpired;

              return (
                <motion.div
                  key={bundle.id}
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: idx * 0.04 }}
                >
                  <Link
                    to={`/bundles/${bundle.id}`}
                    aria-label={`${pickI18n(bundle, "title", language)} — ${formatPrice(bundle.bundle_price)} دينار${discount > 0 ? `، خصم ${discount}%` : ''}${bundle.outOfStock ? '، نفذ من المخزون' : ''}`}
                    className="group relative block rounded-2xl overflow-hidden border border-white/15 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.15)] hover:shadow-[0_8px_28px_-4px_hsl(var(--primary)/0.3)] hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                  >
                    {/* Top highlight */}
                    <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/40 dark:via-white/20 to-transparent z-20 pointer-events-none" />
                    {/* Glass tint */}
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/8 via-transparent to-accent/5 pointer-events-none z-[5]" />

                    {/* Image */}
                    <div className="relative aspect-square overflow-hidden">
                      {bundle.image_url ? (
                        <img
                          src={bundle.image_url}
                          alt=""
                          className={`w-full h-full object-cover group-hover:scale-105 transition-transform duration-500 ${isDisabled ? 'opacity-50 grayscale' : ''}`}
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-primary/10 to-accent/5" aria-hidden="true">
                          <Package className="h-8 w-8 text-primary/40" />
                        </div>
                      )}
                      <div className="absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-background/40 to-transparent backdrop-blur-[1px]" />

                      {/* Diagonal ribbon: expired takes precedence over out-of-stock */}
                      {(isExpired || bundle.outOfStock) && (
                        <div className="absolute inset-0 z-10 overflow-hidden pointer-events-none" aria-hidden="true">
                          <div className="absolute bg-destructive text-destructive-foreground text-[8px] font-bold px-6 py-0.5 rotate-[-35deg] origin-center whitespace-nowrap shadow-lg"
                            style={{ top: '50%', left: '50%', transform: 'translate(-50%, -50%) rotate(-35deg)', minWidth: '150%', textAlign: 'center' }}>
                            {isExpired ? t('bundles_offer_ended') : t('bundles_out_of_stock')}
                          </div>
                        </div>
                      )}

                      {/* Badges */}
                      {discount > 0 && (
                        <div className="absolute top-1.5 left-1.5 z-20 px-1.5 py-0.5 rounded-md bg-destructive text-destructive-foreground text-[9px] font-bold leading-none shadow-lg" aria-hidden="true">
                          -{discount}%
                        </div>
                      )}
                      <div className="absolute top-1.5 right-1.5 z-20 px-1.5 py-0.5 rounded-md bg-background/70 backdrop-blur-xl border border-white/30 dark:border-white/15 text-foreground text-[8px] font-semibold leading-none shadow-sm" aria-hidden="true">
                        {SALE_TYPE_KEYS[saleType] ? t(SALE_TYPE_KEYS[saleType]) : saleType}
                      </div>

                      {/* Countdown timer */}
                      {bundle.offer_ends_at && !isExpired && !bundle.outOfStock && (
                        <BundleCountdown endsAt={bundle.offer_ends_at} />
                      )}
                    </div>

                    {/* Info */}
                    <div className="relative z-20 p-2 space-y-1">
                      <p className="text-[11px] font-bold text-foreground line-clamp-2 leading-tight">{pickI18n(bundle, "title", language)}</p>
                      <div className="flex items-baseline gap-1">
                        <span className="text-sm font-black text-primary">{formatPrice(bundle.bundle_price)}</span>
                        <span className="text-[9px] text-foreground/70 font-medium">د.ع</span>
                      </div>
                      {bundle.original_price > 0 && bundle.original_price > bundle.bundle_price && (
                        <span className="text-[9px] text-foreground/55 line-through block leading-none">
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
