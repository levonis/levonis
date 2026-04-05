import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import ProductMasonryCard from '@/components/ProductMasonryCard';
import ProductListItem from '@/components/ProductListItem';
import { Loader2, ArrowRight, Grid3x3, List, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import { isAllDirectStockDepleted } from '@/lib/stockUtils';

const CategoryDetail = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const navigate = useNavigate();
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [inlineSearch, setInlineSearch] = useState('');

  const handleInlineSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineSearch.trim()) {
      navigate(`/products?search=${encodeURIComponent(inlineSearch.trim())}`);
    }
  };

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
    }
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['category-products', category?.id, sortBy],
    queryFn: async () => {
      if (!category?.id) return [];
      let query = supabase
        .from('products')
        .select('id, name, name_ar, description, description_ar, price, original_price, image_url, images, currency, slug, has_in_stock, sold_count, in_stock, is_pricing_updated, direct_stock, colors, category_id, created_at, card_discounts')
        .eq('category_id', category.id)
        .eq('in_stock', true);

      if (!isAdmin) {
        query = query.eq('is_pricing_updated', true);
      }

      if (sortBy === 'price-asc') query = query.order('price', { ascending: true });
      else if (sortBy === 'price-desc') query = query.order('price', { ascending: false });
      else if (sortBy === 'name-asc') query = query.order('name_ar', { ascending: true });
      else if (sortBy === 'name-desc') query = query.order('name_ar', { ascending: false });
      else query = query.order('created_at', { ascending: false });

      const { data, error } = await query;
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id,
    staleTime: 2 * 60 * 1000,
  });

  const FiltersContent = () => (
    <div className="space-y-4">
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">{t('products_sort')}</label>
        <Select value={sortBy} onValueChange={(v: any) => setSortBy(v)}>
          <SelectTrigger className="bg-white/10 border-white/15 text-white text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="default" className="text-xs">{t('products_sort_default')}</SelectItem>
            <SelectItem value="price-asc" className="text-xs">{t('products_sort_price_asc')}</SelectItem>
            <SelectItem value="price-desc" className="text-xs">{t('products_sort_price_desc')}</SelectItem>
            <SelectItem value="name-asc" className="text-xs">{t('products_sort_name_asc')}</SelectItem>
            <SelectItem value="name-desc" className="text-xs">{t('products_sort_name_desc')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">طريقة العرض</label>
        <div className="flex items-center gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('grid')}
            className="h-8 w-8 p-0 text-white"
          >
            <Grid3x3 className="h-4 w-4" />
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'ghost'}
            size="sm"
            onClick={() => setViewMode('list')}
            className="h-8 w-8 p-0 text-white"
          >
            <List className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-gradient-to-b from-[#1a4a2e] via-[#1d5c38] to-[#0f3d22] relative" dir="rtl">
      {/* Subtle texture overlay */}
      <div className="fixed inset-0 pointer-events-none z-0 opacity-[0.03] bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSI2MCIgaGVpZ2h0PSI2MCI+CjxwYXRoIGQ9Ik0wIDBoNjB2NjBIMHoiIGZpbGw9Im5vbmUiLz4KPHBhdGggZD0iTTMwIDBMMCA2MGg2MHoiIGZpbGw9IndoaXRlIiBmaWxsLW9wYWNpdHk9IjAuMDUiLz4KPC9zdmc+')]" />

      <main className="container mx-auto px-3 sm:px-4 py-4 relative z-10">
        {/* Top bar: Search (right) + Logo (left) */}
        <div className="flex items-center gap-4 mb-6">
          <form onSubmit={handleInlineSearch} className="flex-1 flex items-center gap-2 bg-white/10 backdrop-blur-sm border border-white/15 rounded-xl px-3 py-2">
            <button type="submit" className="text-white/50 hover:text-white transition-colors">
              <Search className="h-4 w-4" />
            </button>
            <Input
              type="search"
              placeholder={t('search_placeholder')}
              value={inlineSearch}
              onChange={(e) => setInlineSearch(e.target.value)}
              className="flex-1 bg-transparent border-0 text-white placeholder:text-white/40 focus-visible:ring-0 h-8 text-sm p-0"
            />
          </form>
          <img src="/og-logo.png" alt="Logo" className="h-10 w-auto object-contain flex-shrink-0" />
        </div>

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-white/50">
          <Link to="/" className="hover:text-white/80 transition-colors">{t('nav_home')}</Link>
          <span>/</span>
          <Link to="/categories" className="hover:text-white/80 transition-colors">{t('nav_categories')}</Link>
          <span>/</span>
          {categoryLoading ? (
            <span>...</span>
          ) : (
            <span className="text-white font-medium">{category?.name_ar}</span>
          )}
        </div>

        {categoryLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : category ? (
          <>
            {/* Category Header */}
            <div className="mb-8">
              <div className="bg-white/[0.07] backdrop-blur-sm rounded-2xl p-6 sm:p-8 border border-white/10">
                <div className="flex items-start gap-4 sm:gap-6">
                  <div
                    className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl flex items-center justify-center text-white font-black text-xl sm:text-2xl flex-shrink-0 bg-white/10 border border-white/20"
                  >
                    {category.icon}
                  </div>
                  <div className="flex-1">
                    <h1 className="text-2xl sm:text-4xl font-black text-white mb-2">
                      {category.name_ar}
                    </h1>
                    <p className="text-sm sm:text-lg text-white/60 mb-3">
                      {category.description_ar}
                    </p>
                    <span className="inline-block px-3 py-1 rounded-full bg-white/10 text-white/80 text-xs border border-white/15">
                      {products?.length || 0} {t('products_available')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Products section */}
            {productsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-6 w-6 animate-spin text-white/50" />
              </div>
            ) : products && products.length > 0 ? (
              <div>
                {/* Filter bar */}
                <div className="flex items-center justify-between mb-4">
                  <p className="text-white/60 text-xs">
                    {t('products_showing').replace('{count}', String(products.length))}
                  </p>
                  <Sheet>
                    <SheetTrigger asChild>
                      <Button variant="ghost" size="sm" className="text-white/70 hover:text-white hover:bg-white/10 gap-1.5">
                        <SlidersHorizontal className="h-3.5 w-3.5" />
                        <span className="text-xs">{t('products_sort')}</span>
                      </Button>
                    </SheetTrigger>
                    <SheetContent side="left" className="bg-[#1a4a2e] border-white/10 text-white w-72">
                      <SheetHeader>
                        <SheetTitle className="text-white text-right">الفلاتر</SheetTitle>
                      </SheetHeader>
                      <div className="mt-6">
                        <FiltersContent />
                      </div>
                    </SheetContent>
                  </Sheet>
                </div>

                {viewMode === 'grid' ? (
                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 sm:gap-4 auto-rows-[minmax(200px,auto)]">
                    {products.map((product, index) => (
                      <ProductMasonryCard
                        key={product.id}
                        id={product.id}
                        name_ar={product.name_ar || ''}
                        price={Number(product.price)}
                        original_price={product.original_price ? Number(product.original_price) : null}
                        image_url={product.image_url}
                        images={product.images}
                        currency={product.currency}
                        slug={product.slug}
                        in_stock={product.in_stock ?? true}
                        isTall={index % 5 === 1 || index % 7 === 3}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col gap-3">
                    {products.map((product) => (
                      <ProductListItem
                        key={product.id}
                        id={product.id}
                        name={product.name}
                        nameAr={product.name_ar}
                        description={product.description}
                        descriptionAr={product.description_ar}
                        price={Number(product.price)}
                        originalPrice={product.original_price ? Number(product.original_price) : undefined}
                        imageUrl={product.image_url || undefined}
                        images={product.images || undefined}
                        currency={product.currency || undefined}
                        slug={product.slug}
                      />
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <div className="text-center py-16 bg-white/[0.07] backdrop-blur-sm rounded-2xl border border-white/10">
                <div className="w-20 h-20 mx-auto mb-4 opacity-30">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" stroke="white" strokeWidth="1" fill="none" />
                  </svg>
                </div>
                <p className="text-white/60 text-lg mb-6">{t('category_no_products')}</p>
                <Link to="/">
                  <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10">
                    <ArrowRight className="h-4 w-4" />
                    {t('products_browse')}
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-white/60 text-lg mb-6">{t('category_not_found')}</p>
            <Link to="/categories">
              <Button variant="outline" className="gap-2 border-white/20 text-white hover:bg-white/10">
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
