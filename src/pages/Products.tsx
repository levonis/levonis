import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import { Loader2, Search, SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { z } from 'zod';
import { useLanguage } from '@/lib/i18n';
import { useNavigate } from 'react-router-dom';
import ProductHeroCard from '@/components/ProductHeroCard';
import ProductMasonryCard from '@/components/ProductMasonryCard';
import {
  Pagination,
  PaginationContent,
  PaginationEllipsis,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from '@/components/ui/pagination';
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

const searchSchema = z.string()
  .max(100, 'Search query too long')
  .regex(/^[\u0600-\u06FFa-zA-Z0-9\s]*$/, 'Invalid characters in search');

const sanitizeSearchQuery = (query: string | null): string | null => {
  if (!query) return null;
  try {
    return searchSchema.parse(query.trim());
  } catch {
    return null;
  }
};

const Products = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'>('default');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [inlineSearch, setInlineSearch] = useState(searchQuery);
  const ITEMS_PER_PAGE = 24;
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const navigate = useNavigate();

  const handleInlineSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inlineSearch.trim()) {
      navigate(`/products?search=${encodeURIComponent(inlineSearch.trim())}`);
    } else {
      navigate('/products');
    }
  };

  // Fetch featured hero product
  const { data: heroProduct } = useQuery({
    queryKey: ['hero-product'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('featured', true)
        .eq('is_pricing_updated', true)
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    }
  });

  // Fetch categories
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_ar')
        .order('name_ar');
      if (error) throw error;
      return data;
    }
  });

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery, currentPage, sortBy, stockFilter, categoryFilter],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' });

      if (!isAdmin) {
        query = query.eq('is_pricing_updated', true);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }

      if (stockFilter === 'in-stock') {
        query = query.eq('in_stock', true);
      } else if (stockFilter === 'out-of-stock') {
        query = query.eq('in_stock', false);
      }

      if (sortBy === 'price-asc') {
        query = query.order('price', { ascending: true });
      } else if (sortBy === 'price-desc') {
        query = query.order('price', { ascending: false });
      } else if (sortBy === 'name-asc') {
        query = query.order('name_ar', { ascending: true });
      } else if (sortBy === 'name-desc') {
        query = query.order('name_ar', { ascending: false });
      } else {
        query = query.order('created_at', { ascending: false });
      }

      query = query.range(from, to);

      const sanitizedSearch = sanitizeSearchQuery(searchQuery);
      if (sanitizedSearch) {
        query = query.or(`name_ar.ilike.%${sanitizedSearch}%,description_ar.ilike.%${sanitizedSearch}%`);
      }
      
      const { data, error, count } = await query;
      if (error) throw error;
      return { products: data, totalCount: count || 0 };
    }
  });

  const products = productsData?.products || [];
  const totalPages = Math.ceil((productsData?.totalCount || 0) / ITEMS_PER_PAGE);

  const renderPageNumbers = () => {
    const pages: (number | 'ellipsis')[] = [];
    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) pages.push(i);
    } else {
      if (currentPage <= 3) {
        for (let i = 1; i <= 5; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      } else if (currentPage >= totalPages - 2) {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = totalPages - 4; i <= totalPages; i++) pages.push(i);
      } else {
        pages.push(1);
        pages.push('ellipsis');
        for (let i = currentPage - 1; i <= currentPage + 1; i++) pages.push(i);
        pages.push('ellipsis');
        pages.push(totalPages);
      }
    }
    return pages;
  };

  const FiltersContent = () => (
    <div className="space-y-4">
      {/* Category */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">{t('products_category_filter')}</label>
        <Select value={categoryFilter} onValueChange={(v) => { setCategoryFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="bg-white/10 border-white/15 text-white text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">{t('products_all_categories')}</SelectItem>
            {categories?.map((c) => (
              <SelectItem key={c.id} value={c.id} className="text-xs">{c.name_ar}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
      {/* Stock */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">{t('products_status_filter')}</label>
        <Select value={stockFilter} onValueChange={(v: 'all' | 'in-stock' | 'out-of-stock') => { setStockFilter(v); setCurrentPage(1); }}>
          <SelectTrigger className="bg-white/10 border-white/15 text-white text-xs h-9">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all" className="text-xs">{t('common_all')}</SelectItem>
            <SelectItem value="in-stock" className="text-xs">{t('product_in_stock')}</SelectItem>
            <SelectItem value="out-of-stock" className="text-xs">{t('product_out_of_stock')}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      {/* Sort */}
      <div className="space-y-1.5">
        <label className="text-xs text-white/60">{t('products_sort')}</label>
        <Select value={sortBy} onValueChange={(v: any) => { setSortBy(v); setCurrentPage(1); }}>
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
          <img
            src="/og-logo.png"
            alt="Logo"
            className="h-10 w-auto object-contain flex-shrink-0"
          />
        </div>

        {/* Hero product */}
        {heroProduct && !searchQuery && currentPage === 1 && (
          <ProductHeroCard
            id={heroProduct.id}
            name_ar={heroProduct.name_ar}
            description_ar={heroProduct.description_ar}
            price={Number(heroProduct.price)}
            original_price={heroProduct.original_price ? Number(heroProduct.original_price) : null}
            image_url={heroProduct.image_url}
            images={heroProduct.images}
            currency={heroProduct.currency}
            slug={heroProduct.slug}
          />
        )}

        {/* Filter bar */}
        <div className="flex items-center justify-between mb-4">
          <div>
            {searchQuery && (
              <p className="text-white/60 text-xs">
                {productsData?.totalCount || 0} {t('products_count')} — <span className="text-white/90">{searchQuery}</span>
              </p>
            )}
          </div>
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

        {/* Products masonry grid */}
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-white/50" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 auto-rows-[minmax(200px,auto)]">
            {products.map((product, index) => (
              <ProductMasonryCard
                key={product.id}
                id={product.id}
                name_ar={product.name_ar}
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
          <div className="text-center py-16">
            <p className="text-sm text-white/50">{t('products_not_found')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-8 mb-4">
            <Pagination dir="ltr">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={`text-white/70 hover:text-white hover:bg-white/10 ${currentPage === 1 ? 'pointer-events-none opacity-30' : 'cursor-pointer'}`}
                  />
                </PaginationItem>
                {renderPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === 'ellipsis' ? (
                      <PaginationEllipsis className="text-white/40" />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className={`cursor-pointer ${currentPage === page ? 'bg-white/20 text-white border-white/30' : 'text-white/60 hover:text-white hover:bg-white/10'}`}
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={`text-white/70 hover:text-white hover:bg-white/10 ${currentPage === totalPages ? 'pointer-events-none opacity-30' : 'cursor-pointer'}`}
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          </div>
        )}
      </main>
    </div>
  );
};

export default Products;
