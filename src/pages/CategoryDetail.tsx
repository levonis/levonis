import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link, useSearchParams } from 'react-router-dom';
import { useMemo, useState } from 'react';
import FloatingProductCard from '@/components/FloatingProductCard';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';
import { ArrowRight, SlidersHorizontal } from 'lucide-react';
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
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from '@/components/ui/sheet';
import { useLanguage } from '@/lib/i18n';
import { usePageTitle } from '@/island/usePageTitle';

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
  const searchQ = (searchParams.get('q') || '').trim().toLowerCase();

  // Sort & filter state
  const [sortBy, setSortBy] = useState<SortKey>('default');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [directOnly, setDirectOnly] = useState(false);
  const [minPrice, setMinPrice] = useState<string>('');
  const [maxPrice, setMaxPrice] = useState<string>('');

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
  });

  usePageTitle('category', category ? pickName(category.name as any, category.name_ar as any) : undefined);

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['category-products', category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      let query = supabase
        .from('products')
        .select('id, name, name_ar, description, description_ar, price, original_price, image_url, images, currency, slug, has_in_stock, sold_count, in_stock, is_pricing_updated, direct_stock, colors, category_id, created_at, card_discounts, product_options(stock_quantity, available_for_direct_sale)')
        .eq('category_id', category.id)
        .eq('in_stock', true)
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

  // Apply filters & sort
  const filteredProducts = useMemo(() => {
    if (!products) return [];
    const minP = minPrice ? Number(minPrice) : null;
    const maxP = maxPrice ? Number(maxPrice) : null;

    let arr = products.filter((p: any) => {
      const priceNum = Number(p.price) || 0;
      const hasDirect = (p.has_in_stock ?? false) && !isAllDirectStockDepleted(p);

      if (stockFilter === 'in-stock' && !p.in_stock) return false;
      if (stockFilter === 'out-of-stock' && p.in_stock) return false;
      if (directOnly && !hasDirect) return false;
      if (minP != null && priceNum < minP) return false;
      if (maxP != null && priceNum > maxP) return false;
      if (searchQ) {
        const hay = `${p.name ?? ''} ${p.name_ar ?? ''} ${p.description ?? ''} ${p.description_ar ?? ''}`.toLowerCase();
        if (!hay.includes(searchQ)) return false;
      }
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
    // Always prioritize direct-sale products first, then apply chosen sort as tie-breaker
    const directRank = (p: any) =>
      (p.has_in_stock ?? false) && !isAllDirectStockDepleted(p) ? 0 : 1;
    arr = [...arr].sort((a, b) => {
      const d = directRank(a) - directRank(b);
      if (d !== 0) return d;
      return sorters[sortBy](a, b);
    });
    return arr;
  }, [products, sortBy, stockFilter, directOnly, minPrice, maxPrice, searchQ]);

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

  const resetFilters = () => {
    setSortBy('default');
    setStockFilter('all');
    setDirectOnly(false);
    setMinPrice('');
    setMaxPrice('');
  };

  const filtersActive =
    sortBy !== 'default' ||
    stockFilter !== 'all' ||
    directOnly ||
    minPrice !== '' ||
    maxPrice !== '';

  return (
    <div className="min-h-screen">
      <main className="container mx-auto px-4 py-8 relative z-10">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm text-foreground/50">
          <Link to="/" className="hover:text-primary transition-colors">{t('nav_home')}</Link>
          <span>/</span>
          <Link to="/" className="hover:text-primary transition-colors">{t('nav_categories')}</Link>
          <span>/</span>
          {categoryLoading ? <span>...</span> : (
            <span className="text-primary font-medium">{pickName(category?.name as any, category?.name_ar as any)}</span>
          )}
        </div>

        {categoryLoading ? (
          <ProductGridSkeleton count={8} />
        ) : category ? (
          <>
            {productsLoading ? (
              <ProductGridSkeleton count={8} />
            ) : products && products.length > 0 ? (
              <div className="space-y-10 md:space-y-16">
                {/* Hero section: Title + Featured product side by side */}
                {featuredProduct && (
                  <div className="flex flex-row items-center gap-4 md:gap-16">
                    {/* Title & description — right side (RTL) */}
                    <div className="flex-1 text-right pt-2 md:pt-12">
                      <h1 className="text-xl sm:text-3xl md:text-6xl font-black text-foreground/90 mb-1 md:mb-2 tracking-tight leading-tight">
                        {pickName(featuredProduct.name as any, featuredProduct.name_ar as any)}
                      </h1>
                      {(featuredProduct.description_ar || (featuredProduct as any).description) && (
                        <div>
                          <p className="text-foreground/40 text-xs sm:text-sm md:text-lg max-w-md mr-0 ml-auto line-clamp-2">
                            {pickDesc((featuredProduct as any).description, featuredProduct.description_ar)}
                          </p>
                          <Link
                            to={`/product/${featuredProduct.slug}`}
                            className="text-primary text-xs md:text-sm mt-1 md:mt-2 hover:underline inline-block"
                          >
                            {t('catdetail_view_more')}
                          </Link>
                        </div>
                      )}
                    </div>

                    {/* Featured product on left (smaller on mobile) */}
                    <div className="flex-shrink-0 w-32 sm:w-48 md:w-full md:max-w-sm">
                      <FloatingProductCard
                        id={featuredProduct.id}
                        name={featuredProduct.name}
                        nameAr={featuredProduct.name_ar}
                        price={Number(featuredProduct.price)}
                        originalPrice={featuredProduct.original_price ? Number(featuredProduct.original_price) : undefined}
                        imageUrl={featuredProduct.image_url || undefined}
                        currency={featuredProduct.currency || undefined}
                        slug={featuredProduct.slug}
                        hasDirectSale={(featuredProduct.has_in_stock ?? false) && !isAllDirectStockDepleted(featuredProduct)}
                        featured
                      />
                    </div>
                  </div>
                )}

                {/* Sort & Filter toolbar */}
                <div className="flex items-center justify-between gap-2 flex-wrap border-b border-border/40 pb-3">
                  <div className="text-xs md:text-sm text-foreground/60">
                    {t('catdetail_products_count', { count: filteredProducts.length })}
                  </div>

                  <div className="flex items-center gap-2">
                    <Select value={sortBy} onValueChange={(v) => setSortBy(v as SortKey)}>
                      <SelectTrigger className="h-9 text-xs md:text-sm w-40">
                        <SelectValue placeholder={t('catdetail_sort_label')} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="default">{t('catdetail_sort_default')}</SelectItem>
                        <SelectItem value="price-asc">{t('catdetail_sort_price_asc')}</SelectItem>
                        <SelectItem value="price-desc">{t('catdetail_sort_price_desc')}</SelectItem>
                        <SelectItem value="newest">{t('catdetail_sort_newest')}</SelectItem>
                        <SelectItem value="best-selling">{t('catdetail_sort_best_selling')}</SelectItem>
                        <SelectItem value="name-asc">{t('catdetail_sort_name_asc')}</SelectItem>
                      </SelectContent>
                    </Select>

                    <Sheet>
                      <SheetTrigger asChild>
                        <Button variant="outline" size="sm" className="gap-1.5 h-9 text-xs md:text-sm relative">
                          <SlidersHorizontal className="h-3.5 w-3.5" />
                          {t('catdetail_filter_button')}
                          {filtersActive && (
                            <span className="absolute -top-1 -right-1 h-2 w-2 rounded-full bg-primary" />
                          )}
                        </Button>
                      </SheetTrigger>
                      <SheetContent side="left" className="w-full sm:max-w-sm">
                        <SheetHeader>
                          <SheetTitle className="text-right">{t('catdetail_filter_title')}</SheetTitle>
                        </SheetHeader>

                        <div className="mt-6 space-y-6 text-right" dir="rtl">
                          {/* Availability */}
                          <div className="space-y-2">
                            <Label className="text-sm font-bold">{t('catdetail_filter_availability')}</Label>
                            <Select value={stockFilter} onValueChange={(v) => setStockFilter(v as any)}>
                              <SelectTrigger className="w-full">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="all">{t('catdetail_filter_avail_all')}</SelectItem>
                                <SelectItem value="in-stock">{t('catdetail_filter_avail_in')}</SelectItem>
                                <SelectItem value="out-of-stock">{t('catdetail_filter_avail_out')}</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>

                          {/* Direct sale */}
                          <div className="flex items-center justify-between gap-3 rounded-lg border border-border/40 p-3">
                            <div>
                              <Label htmlFor="direct-only" className="text-sm font-bold">
                                {t('catdetail_filter_direct_only')}
                              </Label>
                              <p className="text-[11px] text-muted-foreground mt-0.5">
                                {t('catdetail_filter_direct_only_desc')}
                              </p>
                            </div>
                            <Switch
                              id="direct-only"
                              checked={directOnly}
                              onCheckedChange={setDirectOnly}
                            />
                          </div>

                          {/* Price range */}
                          <div className="space-y-2">
                            <Label className="text-sm font-bold">{t('catdetail_filter_price_range')}</Label>
                            <div className="flex items-center gap-2">
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder={t('catdetail_filter_price_from')}
                                value={minPrice}
                                onChange={(e) => setMinPrice(e.target.value)}
                                className="text-right"
                              />
                              <span className="text-muted-foreground">—</span>
                              <Input
                                type="number"
                                inputMode="numeric"
                                placeholder={t('catdetail_filter_price_to')}
                                value={maxPrice}
                                onChange={(e) => setMaxPrice(e.target.value)}
                                className="text-right"
                              />
                            </div>
                          </div>

                          <Button
                            variant="outline"
                            className="w-full"
                            onClick={resetFilters}
                            disabled={!filtersActive}
                          >
                            {t('catdetail_filter_reset')}
                          </Button>
                        </div>
                      </SheetContent>
                    </Sheet>
                  </div>
                </div>

                {/* Responsive grid of product cards */}
                {otherProducts.length > 0 ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3 md:gap-5">
                    {otherProducts.map((product) => (
                      <FloatingProductCard
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        nameAr={product.name_ar}
                        price={Number(product.price)}
                        originalPrice={product.original_price ? Number(product.original_price) : undefined}
                        imageUrl={product.image_url || undefined}
                        currency={product.currency || undefined}
                        slug={product.slug}
                        hasDirectSale={(product.has_in_stock ?? false) && !isAllDirectStockDepleted(product)}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="text-center py-10 text-foreground/50 text-sm">
                    {t('catdetail_no_match')}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-20">
                <p className="text-foreground/50 text-lg mb-6">{t('category_no_products')}</p>
                <Link to="/">
                  <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                    <ArrowRight className="h-4 w-4" />
                    {t('products_browse')}
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-20">
            <p className="text-foreground/50 text-lg mb-6">{t('category_not_found')}</p>
            <Link to="/">
              <Button variant="outline" className="gap-2 border-primary/30 text-primary hover:bg-primary/10">
                <ArrowRight className="h-4 w-4" />
                {t('category_back')}
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryDetail;
