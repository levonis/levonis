import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useEffect, useMemo, useRef, useState } from 'react';
import FloatingProductCard from '@/components/FloatingProductCard';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';
import { ArrowRight, SlidersHorizontal, ArrowUpDown, Package, Check } from 'lucide-react';
import { ProductGridSkeleton } from '@/components/ui/PageSkeletons';

import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import SEO from '@/components/SEO';
import { breadcrumbLd, collectionPageLd } from '@/lib/seo/structured';
import { usePageTitle } from '@/island/usePageTitle';
import { usePageSearchSection, usePageLiveQuery, type PageSearchItem } from '@/island/PageSearchContext';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { useCodDefaults } from '@/hooks/useCodDefaults';
import { fetchLiveDirectSalePrices } from '@/lib/priceGuard';
import { computeUnifiedCardPrice, computeUnifiedCardOriginalPrice } from '@/lib/cardPrice';

type SortKey =
  | 'default'
  | 'price-asc'
  | 'price-desc'
  | 'newest'
  | 'best-selling'
  | 'name-asc';

const CategoryDetail = () => {
  const { t, language } = useLanguage();
  const pickName = (en?: string | null, ar?: string | null) => (language === 'ar' ? (ar || en || '') : (en || ar || ''));
  const pickDesc = pickName;

  const { isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [searchParams] = useSearchParams();
  const liveQuery = usePageLiveQuery();
  // Live (typing) query wins; otherwise fall back to ?q= URL param (deep-link / submit).
  const searchQ = (liveQuery || searchParams.get('q') || '').trim().toLowerCase();

  // Sort & filter state
  const [sortBy, setSortBy] = useState<SortKey>('default');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [directOnly, setDirectOnly] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');
  const [brandFilter, setBrandFilter] = useState<string>('all');

  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1300;
  const { data: codDefaults } = useCodDefaults();

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  usePageTitle('category', category ? pickName(category.name as any, category.name_ar as any) : undefined);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['category-products', category?.id, isAdmin],
    queryFn: async () => {
      if (!category?.id) return [];
      let query = supabase
        .from('products')
        .select('id, name, name_ar, name_en, name_ku, description, description_ar, description_en, description_ku, price, original_price, image_url, images, currency, slug, has_in_stock, sold_count, in_stock, is_pricing_updated, direct_stock, colors, category_id, created_at, card_discounts, direct_sale_price, link_direct_commission_to_cod, has_pre_order, shipping_type, price_usd, personal_delivery_cost, referral_earnings_iqd, sea_price, air_price, round_up_price, display_order, brand, product_options(name_ar, price_adjustment, stock_quantity, available_for_direct_sale)')
        .eq('category_id', category.id)
        .eq('in_stock', true)
        .order('display_order', { ascending: true })
        .order('price', { ascending: false });

      if (!isAdmin) {
        query = query.eq('is_pricing_updated', true);
      }

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch server-computed live direct-sale prices for all products linked to global COD %.
  // This ensures the card price matches what the product detail page shows — no leak.
  const linkedIds = useMemo(
    () => (products || [])
      .filter((p: any) => p.link_direct_commission_to_cod && (p.has_in_stock ?? false))
      .map((p: any) => p.id),
    [products]
  );
  const { data: liveDirectMap } = useQuery({
    queryKey: ['category-live-direct-prices', linkedIds],
    queryFn: () => fetchLiveDirectSalePrices(linkedIds),
    enabled: linkedIds.length > 0,
    staleTime: 60 * 1000,
  });

  // Apply filters & sort
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;

    // Tokenize query for multi-word matching (every token must match somewhere).
    const qTokens = searchQ ? searchQ.split(/\s+/).filter(Boolean) : [];

    // --- Tiny Levenshtein (capped at 'max' for early-exit performance) ---
    const editDistance = (a: string, b: string, max: number): number => {
      if (a === b) return 0;
      const al = a.length;
      const bl = b.length;
      if (Math.abs(al - bl) > max) return max + 1;
      if (al === 0) return bl;
      if (bl === 0) return al;
      let prev = new Array(bl + 1);
      let curr = new Array(bl + 1);
      for (let j = 0; j <= bl; j++) prev[j] = j;
      for (let i = 1; i <= al; i++) {
        curr[0] = i;
        let rowMin = curr[0];
        for (let j = 1; j <= bl; j++) {
          const cost = a.charCodeAt(i - 1) === b.charCodeAt(j - 1) ? 0 : 1;
          curr[j] = Math.min(prev[j] + 1, curr[j - 1] + 1, prev[j - 1] + cost);
          if (curr[j] < rowMin) rowMin = curr[j];
        }
        if (rowMin > max) return max + 1; // early exit
        [prev, curr] = [curr, prev];
      }
      return prev[bl];
    };

    /** Fuzzy distance: best edit-distance between any query token and any
     *  word inside the haystack strings. Returns Infinity if all tokens
     *  exceed their per-token threshold. */
    const fuzzyDistance = (haystacks: string[]): number => {
      if (qTokens.length === 0) return Infinity;
      let total = 0;
      for (const tok of qTokens) {
        // Threshold scales with token length: 1 typo for 3-4 chars, 2 for 5-7, 3 for 8+.
        const thr = tok.length <= 2 ? 0 : tok.length <= 4 ? 1 : tok.length <= 7 ? 2 : 3;
        if (thr === 0) {
          if (!haystacks.some((h) => h.includes(tok))) return Infinity;
          continue;
        }
        let best = Infinity;
        for (const h of haystacks) {
          for (const word of h.split(/\s+/)) {
            if (!word) continue;
            const d = editDistance(tok, word, thr);
            if (d < best) best = d;
            if (best === 0) break;
          }
          if (best === 0) break;
        }
        if (best > thr) return Infinity;
        total += best;
      }
      return total;
    };

    /**
     * Lower score = more relevant. Combines:
     *  - exact name match              → 0
     *  - name starts with full query   → 5
     *  - any name token starts with q  → 10
     *  - name contains full query      → 20
     *  - all tokens found in names     → 30
     *  - all tokens found in keywords  → 50  (colors / option names / slug)
     *  - all tokens found in desc      → 70
     *  - fuzzy name match (typo)       → 90 + edit distance
     *  - no match                      → Infinity (filtered out)
     * Shorter names get a tiny bonus (closer match = less noise around the term).
     */
    const scoreFor = (p: any): number => {
      if (!searchQ) return 0;
      const names = [p.name, p.name_ar, p.name_en, p.name_ku]
        .filter(Boolean)
        .map((s: string) => String(s).toLowerCase());
      const descs = [p.description, p.description_ar, p.description_en, p.description_ku]
        .filter(Boolean)
        .map((s: string) => String(s).toLowerCase());
      const colorWords = Array.isArray(p.colors)
        ? p.colors.flatMap((c: any) => [c?.name, c?.name_ar, c?.name_en, c?.name_ku].filter(Boolean))
        : [];
      const keywords = [p.slug, ...colorWords]
        .filter(Boolean)
        .map((s: string) => String(s).toLowerCase());

      const allTokensIn = (haystacks: string[]) =>
        qTokens.every((tok) => haystacks.some((h) => h.includes(tok)));

      let base = Infinity;
      if (names.some((n) => n === searchQ)) base = 0;
      else if (names.some((n) => n.startsWith(searchQ))) base = 5;
      else if (names.some((n) => n.split(/\s+/).some((w) => w.startsWith(searchQ)))) base = 10;
      else if (names.some((n) => n.includes(searchQ))) base = 20;
      else if (qTokens.length > 1 && allTokensIn(names)) base = 30;
      else if (allTokensIn(keywords)) base = 50;
      else if (descs.some((d) => d.includes(searchQ)) || (qTokens.length > 1 && allTokensIn(descs))) base = 70;
      else if (searchQ.length >= 3) {
        // Fuzzy fallback — only when nothing else hits and query is non-trivial.
        const fd = fuzzyDistance(names);
        if (isFinite(fd)) base = 90 + fd;
      }

      if (!isFinite(base)) return Infinity;
      // Shorter, more focused names rank slightly higher (max +5 penalty).
      const shortest = Math.min(...names.map((n) => n.length), 999);
      const lenBonus = Math.min(5, shortest / 20);
      return base + lenBonus;
    };

    let arr = products.filter((p: any) => {
      const priceNum = Number(p.price) || 0;
      const hasDirect = (p.has_in_stock ?? false) && !isAllDirectStockDepleted(p);

      if (stockFilter === 'in-stock' && !p.in_stock) return false;
      if (stockFilter === 'out-of-stock' && p.in_stock) return false;
      if (directOnly && !hasDirect) return false;
      if (minP != null && priceNum < minP) return false;
      if (maxP != null && priceNum > maxP) return false;
      if (brandFilter !== 'all' && (p.brand || '').toString().trim() !== brandFilter) return false;
      if (searchQ && !isFinite(scoreFor(p))) return false;
      return true;
    });

    const sorters: Record<SortKey, (a: any, b: any) => number> = {
      'default': () => 0,
      'price-asc': (a, b) => Number(a.price) - Number(b.price),
      'price-desc': (a, b) => Number(b.price) - Number(a.price),
      'newest': (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      'best-selling': (a, b) => (b.sold_count ?? 0) - (a.sold_count ?? 0),
      'name-asc': (a, b) => String(a.name_ar || '').localeCompare(String(b.name_ar || ''), 'ar'),
    };
    // When searching, relevance fully drives the order; popularity (sold_count)
    // breaks ties so well-known matches surface first.
    // Without a query, prioritize direct-sale products and apply the chosen sort.
    const directRank = (p: any) =>
      (p.has_in_stock ?? false) && !isAllDirectStockDepleted(p) ? 0 : 1;
    const userSortActive = sortBy !== 'default';
    arr = [...arr].sort((a, b) => {
      if (searchQ) {
        const s = scoreFor(a) - scoreFor(b);
        if (s !== 0) return s;
        const pop = (b.sold_count ?? 0) - (a.sold_count ?? 0);
        if (pop !== 0) return pop;
        return directRank(a) - directRank(b);
      }
      // Only prioritize direct-sale products when no explicit sort is chosen.
      if (!userSortActive) {
        const d = directRank(a) - directRank(b);
        if (d !== 0) return d;
      }
      return sorters[sortBy](a, b);
    });
    return arr;
  }, [products, sortBy, stockFilter, directOnly, minPrice, maxPrice, brandFilter, searchQ]);

  const featuredProduct = (() => {
    if (!products?.length) return undefined;
    if (category?.featured_product_id) {
      const found = products.find((p) => p.id === category.featured_product_id);
      if (found) return found;
    }
    return products[0];
  })();

  // Exclude featured product from grid to avoid duplication
  const otherProducts = useMemo(
    () => filteredProducts.filter((p: any) => p.id !== featuredProduct?.id),
    [filteredProducts, featuredProduct?.id]
  );

  // Register category products for in-page (local) search via the dynamic island
  const sectionKey = `category:${slug ?? ''}`;
  const searchItems = useMemo<PageSearchItem[]>(() => {
    if (!products) return [];
    return products.slice(0, 200).map((p: any) => ({
      id: `cat-${p.id}`,
      label: pickName(p.name as any, p.name_ar as any) || p.name_ar || p.name || '',
      hint: category ? pickName(category.name as any, category.name_ar as any) : undefined,
      keywords: [p.name, p.name_ar, p.name_en, p.name_ku].filter(Boolean) as string[],
      to: `/product/${p.slug || p.id}`,
    }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [products, category, language]);
  usePageSearchSection(sectionKey, searchItems);

  const resetFilters = () => {
    setSortBy('default');
    setStockFilter('all');
    setDirectOnly(false);
    setMinPrice('');
    setMaxPrice('');
    setBrandFilter('all');
  };

  const filtersActive =
    sortBy !== 'default' ||
    stockFilter !== 'all' ||
    directOnly ||
    minPrice !== '' ||
    maxPrice !== '' ||
    brandFilter !== 'all';

  const availableBrands = useMemo(() => {
    if (!products) return [] as string[];
    const set = new Set<string>();
    for (const p of products as any[]) {
      const b = (p.brand || '').toString().trim();
      if (b) set.add(b);
    }
    return Array.from(set).sort((a, b) => a.localeCompare(b));
  }, [products]);

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 relative z-10">
        {categoryLoading ? (
          <ProductGridSkeleton count={8} />
        ) : category ? (
          <>
            {productsLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products && products.length > 0 ? (
              <div className="space-y-10 md:space-y-16">
                {/* Hero card: glassmorphism rectangular card with product image (left) + info (right) */}
                {featuredProduct && (
                  <Link
                    to={`/product/${featuredProduct.slug}`}
                    className="group block relative rounded-3xl overflow-hidden isolate transition-transform duration-300 hover:scale-[1.01]"
                    style={{
                      backdropFilter: 'blur(40px) saturate(1.6)',
                      WebkitBackdropFilter: 'blur(40px) saturate(1.6)',
                      background:
                        'linear-gradient(135deg, hsl(160 35% 16% / 0.32) 0%, hsl(160 30% 11% / 0.42) 55%, hsl(160 25% 7% / 0.55) 100%)',
                      border: '1px solid hsl(160 30% 30% / 0.22)',
                      boxShadow:
                        '0 18px 50px -12px hsl(0 0% 0% / 0.55), inset 0 1px 0 hsl(160 45% 55% / 0.12)',
                    }}
                  >
                    {/* Soft inner highlight */}
                    <div
                      aria-hidden
                      className="pointer-events-none absolute inset-0 opacity-60"
                      style={{
                        background:
                          'radial-gradient(ellipse 70% 60% at 0% 100%, hsl(160 50% 35% / 0.18) 0%, transparent 60%), radial-gradient(ellipse 50% 50% at 100% 0%, hsl(0 80% 50% / 0.10) 0%, transparent 60%)',
                      }}
                    />

                    <div className="relative flex flex-row-reverse items-center gap-3 sm:gap-5 md:gap-8 p-3 sm:p-5 md:p-8">
                      {/* Product image — left side (visually) */}
                      <div className="flex-shrink-0 w-28 h-28 sm:w-44 sm:h-44 md:w-64 md:h-64 relative">
                        <img
                          src={featuredProduct.image_url || '/placeholder.svg'}
                          alt={pickName(featuredProduct.name as any, featuredProduct.name_ar as any)}
                          loading="eager"
                          className="w-full h-full object-contain drop-shadow-[0_12px_24px_rgba(0,0,0,0.5)] transition-transform duration-500 group-hover:scale-105"
                        />
                      </div>

                      {/* Info — right side (visually) */}
                      <div className="flex-1 min-w-0 text-right">
                        <h1 className="text-lg sm:text-2xl md:text-4xl font-black text-foreground mb-1 md:mb-2 tracking-tight leading-tight line-clamp-2">
                          {pickName(featuredProduct.name as any, featuredProduct.name_ar as any)}
                        </h1>
                        {(featuredProduct.description_ar || (featuredProduct as any).description) && (
                          <p className="text-foreground/55 text-[11px] sm:text-sm md:text-base line-clamp-2 mb-2 md:mb-3">
                            {pickDesc((featuredProduct as any).description, featuredProduct.description_ar)}
                          </p>
                        )}
                        <div className="flex items-baseline justify-end gap-1.5 mb-2 md:mb-3">
                          {(() => {
                            const fpFinal = computeUnifiedCardPrice(featuredProduct, usdToIqd, codDefaults, liveDirectMap);
                            const fpOriginal = computeUnifiedCardOriginalPrice(featuredProduct, usdToIqd, codDefaults, liveDirectMap);
                            return (
                              <>
                                <span className="text-base sm:text-xl md:text-3xl font-black text-primary">
                                  {fpFinal.toLocaleString()}
                                </span>
                                <span className="text-[10px] sm:text-xs md:text-sm text-primary/70 font-bold">
                                  {featuredProduct.currency === 'IQD' || !featuredProduct.currency ? 'د.ع' : featuredProduct.currency}
                                </span>
                                {fpOriginal != null && (
                                  <span className="text-[10px] sm:text-xs md:text-sm text-foreground/40 line-through mr-2">
                                    {fpOriginal.toLocaleString()}
                                  </span>
                                )}
                              </>
                            );
                          })()}
                        </div>
                        <span className="inline-flex items-center gap-1 text-primary text-[11px] sm:text-sm font-semibold group-hover:underline">
                          {t('catdetail_view_more')}
                          <ArrowRight className="h-3 w-3 sm:h-4 sm:w-4 rtl:rotate-180" />
                        </span>
                      </div>
                    </div>
                  </Link>
                )}

                {/* Sort & Filter toolbar — Glassmorphism Professional */}
                {(() => {
                  const sortOptions: { value: SortKey; label: string }[] = [
                    { value: 'default', label: t('catdetail_sort_default') },
                    { value: 'price-asc', label: t('catdetail_sort_price_asc') },
                    { value: 'price-desc', label: t('catdetail_sort_price_desc') },
                    { value: 'newest', label: t('catdetail_sort_newest') },
                    { value: 'best-selling', label: t('catdetail_sort_best_selling') },
                    { value: 'name-asc', label: t('catdetail_sort_name_asc') },
                  ];
                  const currentSortLabel =
                    sortOptions.find((o) => o.value === sortBy)?.label ?? t('catdetail_sort_label');

                  const glassPanel =
                    'rounded-2xl border border-[hsl(var(--border)/0.4)] bg-[linear-gradient(135deg,hsl(var(--card)/0.55),hsl(var(--card)/0.25))] backdrop-blur-2xl backdrop-saturate-150 shadow-[0_8px_32px_-12px_hsl(0_0%_0%/0.45),inset_0_1px_0_hsl(0_0%_100%/0.08)]';
                  const glassBtn =
                    'h-10 px-3.5 text-xs md:text-sm rounded-xl border border-[hsl(var(--border)/0.5)] bg-[hsl(var(--card)/0.5)] backdrop-blur-xl hover:bg-[hsl(var(--card)/0.7)] transition-all duration-300 data-[state=open]:ring-2 data-[state=open]:ring-primary/40 data-[state=open]:bg-[hsl(var(--card)/0.8)]';

                  return (
                    <div className={cn(glassPanel, 'flex items-center justify-between gap-3 flex-wrap px-4 py-3')}>
                      {/* Count chip */}
                      <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[hsl(var(--primary)/0.08)] border border-[hsl(var(--primary)/0.15)]">
                        <Package className="h-3.5 w-3.5 text-primary" />
                        <span className="text-xs md:text-sm font-semibold text-foreground/80 tabular-nums">
                          {t('catdetail_products_count', { count: filteredProducts.length })}
                        </span>
                      </div>

                      <div className="flex items-center gap-2">
                        {/* Sort Popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" className={cn(glassBtn, 'gap-2')}>
                              <ArrowUpDown className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium">{currentSortLabel}</span>
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="end"
                            sideOffset={8}
                            className={cn(
                              'w-56 p-1.5 border-[hsl(var(--border)/0.5)]',
                              'bg-[linear-gradient(135deg,hsl(var(--card)/0.85),hsl(var(--card)/0.65))] backdrop-blur-2xl backdrop-saturate-150',
                              'shadow-[0_20px_50px_-12px_hsl(0_0%_0%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.1)]',
                            )}
                          >
                            <div className="flex flex-col gap-0.5" dir="rtl">
                              {sortOptions.map((opt) => {
                                const active = opt.value === sortBy;
                                return (
                                  <button
                                    key={opt.value}
                                    type="button"
                                    onClick={() => setSortBy(opt.value)}
                                    className={cn(
                                      'flex items-center justify-between gap-2 w-full px-3 py-2 rounded-lg text-xs md:text-sm text-right transition-all duration-200',
                                      active
                                        ? 'bg-[hsl(var(--primary)/0.15)] text-foreground font-bold'
                                        : 'text-foreground/75 hover:bg-[hsl(var(--foreground)/0.06)]',
                                    )}
                                  >
                                    <span>{opt.label}</span>
                                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                                  </button>
                                );
                              })}
                            </div>
                          </PopoverContent>
                        </Popover>

                        {/* Filter Popover */}
                        <Popover>
                          <PopoverTrigger asChild>
                            <Button variant="ghost" className={cn(glassBtn, 'gap-2 relative')}>
                              <SlidersHorizontal className="h-3.5 w-3.5 text-primary" />
                              <span className="font-medium">{t('catdetail_filter_button')}</span>
                              {filtersActive && (
                                <span className="absolute -top-1 -right-1 h-2.5 w-2.5 rounded-full bg-primary ring-2 ring-background animate-pulse" />
                              )}
                            </Button>
                          </PopoverTrigger>
                          <PopoverContent
                            side="bottom"
                            align="end"
                            sideOffset={8}
                            className={cn(
                              'w-[320px] p-4 border-[hsl(var(--border)/0.5)]',
                              'bg-[linear-gradient(135deg,hsl(var(--card)/0.85),hsl(var(--card)/0.65))] backdrop-blur-2xl backdrop-saturate-150',
                              'shadow-[0_20px_50px_-12px_hsl(0_0%_0%/0.55),inset_0_1px_0_hsl(0_0%_100%/0.1)]',
                            )}
                          >
                            <div className="space-y-4 text-right" dir="rtl">
                              <div className="flex items-center justify-between pb-2 border-b border-[hsl(var(--border)/0.4)]">
                                <span className="text-sm font-bold text-foreground">{t('catdetail_filter_title')}</span>
                                <SlidersHorizontal className="h-4 w-4 text-primary" />
                              </div>

                              {/* Availability */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground/80">{t('catdetail_filter_availability')}</Label>
                                <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
                                  <SelectTrigger className="w-full h-9 rounded-lg bg-[hsl(var(--background)/0.6)] backdrop-blur border-[hsl(var(--border)/0.5)]">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="all">{t('catdetail_filter_avail_all')}</SelectItem>
                                    <SelectItem value="in-stock">{t('catdetail_filter_avail_in')}</SelectItem>
                                    <SelectItem value="out-of-stock">{t('catdetail_filter_avail_out')}</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>

                              {/* Brand filter */}
                              {availableBrands.length > 0 && (
                                <div className="space-y-1.5">
                                  <Label className="text-xs font-bold text-foreground/80">الشركة المصنعة</Label>
                                  <Select value={brandFilter} onValueChange={setBrandFilter}>
                                    <SelectTrigger className="w-full h-9 rounded-lg bg-[hsl(var(--background)/0.6)] backdrop-blur border-[hsl(var(--border)/0.5)]">
                                      <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent>
                                      <SelectItem value="all">الكل</SelectItem>
                                      {availableBrands.map((b) => (
                                        <SelectItem key={b} value={b}>{b}</SelectItem>
                                      ))}
                                    </SelectContent>
                                  </Select>
                                </div>
                              )}

                              {/* Direct sale */}
                              <div className="flex items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border)/0.4)] bg-[hsl(var(--background)/0.4)] backdrop-blur p-3">
                                <div className="flex-1">
                                  <Label htmlFor="direct-only" className="text-xs font-bold">
                                    {t('catdetail_filter_direct_only')}
                                  </Label>
                                  <p className="text-[10px] text-muted-foreground mt-0.5">
                                    {t('catdetail_filter_direct_only_desc')}
                                  </p>
                                </div>
                                <Switch id="direct-only" checked={directOnly} onCheckedChange={setDirectOnly} />
                              </div>

                              {/* Price range */}
                              <div className="space-y-1.5">
                                <Label className="text-xs font-bold text-foreground/80">{t('catdetail_filter_price_range')}</Label>
                                <div className="flex items-center gap-2">
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder={t('catdetail_filter_price_from')}
                                    value={minPrice}
                                    onChange={(e) => setMinPrice(e.target.value)}
                                    className="text-right h-9 rounded-lg bg-[hsl(var(--background)/0.6)] backdrop-blur border-[hsl(var(--border)/0.5)]"
                                  />
                                  <span className="text-muted-foreground">—</span>
                                  <Input
                                    type="number"
                                    inputMode="numeric"
                                    placeholder={t('catdetail_filter_price_to')}
                                    value={maxPrice}
                                    onChange={(e) => setMaxPrice(e.target.value)}
                                    className="text-right h-9 rounded-lg bg-[hsl(var(--background)/0.6)] backdrop-blur border-[hsl(var(--border)/0.5)]"
                                  />
                                </div>
                              </div>

                              <Button
                                variant="outline"
                                className="w-full h-9 rounded-lg bg-[hsl(var(--background)/0.4)] backdrop-blur border-[hsl(var(--border)/0.5)] hover:bg-[hsl(var(--background)/0.7)]"
                                onClick={resetFilters}
                                disabled={!filtersActive}
                              >
                                {t('catdetail_filter_reset')}
                              </Button>
                            </div>
                          </PopoverContent>
                        </Popover>
                      </div>
                    </div>
                  );
                })()}

                {/* Responsive grid of product cards — incremental render on scroll */}
                {otherProducts.length > 0 ? (
                  <IncrementalProductGrid
                    products={otherProducts}
                    usdToIqd={usdToIqd}
                    codDefaults={codDefaults}
                    liveDirectMap={liveDirectMap}
                    searchQ={searchQ}
                  />
                ) : (
                  <div className="glass-panel text-center py-12 px-6">
                    <p className="text-foreground/60 text-sm">{t('catdetail_no_match')}</p>
                  </div>
                )}
              </div>
            ) : (
              <div className="glass-panel text-center py-16 px-6">
                <p className="text-foreground/70 text-lg mb-6">{t('category_no_products')}</p>
                <Link to="/">
                  <Button variant="outline" className="gap-2">
                    <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                    {t('products_browse')}
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="glass-panel text-center py-16 px-6">
            <p className="text-foreground/70 text-lg mb-6">{t('category_not_found')}</p>
            <Link to="/">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4 rtl:rotate-180" />
                {t('category_back')}
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

// Incrementally renders product cards as the user scrolls down.
// Initial batch is small (fast paint), more batches load when sentinel approaches viewport.
const PAGE_SIZE = 12;
const IncrementalProductGrid = ({
  products,
  usdToIqd,
  codDefaults,
  liveDirectMap,
  searchQ,
}: {
  products: any[];
  usdToIqd: number;
  codDefaults: any;
  liveDirectMap: any;
  searchQ: string;
}) => {
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const sentinelRef = useRef<HTMLDivElement | null>(null);

  // Reset when the underlying list changes (filters / sort / search)
  useEffect(() => {
    setVisibleCount(PAGE_SIZE);
  }, [products]);

  useEffect(() => {
    if (visibleCount >= products.length) return;
    const el = sentinelRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisibleCount((c) => Math.min(c + PAGE_SIZE, products.length));
        }
      },
      { rootMargin: '600px 0px' },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [visibleCount, products.length]);

  const visible = products.slice(0, visibleCount);

  return (
    <>
      <div
        className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5"
        style={{ contentVisibility: 'auto' as any, containIntrinsicSize: '600px' }}
      >
        {visible.map((product: any) => {
          const finalCardPrice = computeUnifiedCardPrice(product, usdToIqd, codDefaults, liveDirectMap);
          const cardOriginal = computeUnifiedCardOriginalPrice(product, usdToIqd, codDefaults, liveDirectMap) ?? undefined;
          return (
            <FloatingProductCard
              key={product.id}
              id={product.id}
              name={product.name}
              nameAr={product.name_ar}
              price={finalCardPrice}
              originalPrice={cardOriginal}
              imageUrl={product.image_url || undefined}
              currency={product.currency || undefined}
              slug={product.slug}
              hasDirectSale={(product.has_in_stock ?? false) && !isAllDirectStockDepleted(product)}
              directSalePriceLive={null}
              highlightQuery={searchQ}
            />
          );
        })}
      </div>
      {visibleCount < products.length && (
        <div ref={sentinelRef} className="h-16 w-full flex items-center justify-center">
          <div className="h-6 w-6 rounded-full border-2 border-primary/30 border-t-primary animate-spin" />
        </div>
      )}
    </>
  );
};

export default CategoryDetail;
