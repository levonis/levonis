import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import { useState } from 'react';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import ProductListItem from '@/components/ProductListItem';
import { Loader2, Grid3x3, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { z } from 'zod';
import { useLanguage } from '@/lib/i18n';

// Security: Validate and sanitize search input to prevent SQL injection
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

const Products = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';
  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [stockFilter, setStockFilter] = useState<'all' | 'in-stock' | 'out-of-stock'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const ITEMS_PER_PAGE = 24;
  const { t } = useLanguage();

  // Fetch categories for filter
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

      // Apply category filter
      if (categoryFilter !== 'all') {
        query = query.eq('category_id', categoryFilter);
      }

      // Apply stock filter
      if (stockFilter === 'in-stock') {
        query = query.eq('in_stock', true);
      } else if (stockFilter === 'out-of-stock') {
        query = query.eq('in_stock', false);
      }

      // Apply sorting
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

      // Security: Sanitize search query to prevent SQL injection
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
    const pages = [];
    const showEllipsisStart = currentPage > 3;
    const showEllipsisEnd = currentPage < totalPages - 2;

    if (totalPages <= 7) {
      for (let i = 1; i <= totalPages; i++) {
        pages.push(i);
      }
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

  return (
    <div className="min-h-screen bg-transparent relative">
      {/* Decorative frame - Full screen */}
      <div 
        className="fixed inset-0 pointer-events-none z-0 opacity-20"
        style={{
          backgroundImage: 'url(/images/decorative-frame-new.webp)',
          backgroundSize: '100% 100%',
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat'
        }}
      />
      <main className="container mx-auto px-3 sm:px-4 py-4 pt-24 relative z-10">
        <div className="mb-4">
          <SearchBar />
        </div>

        <div className="mb-4 flex flex-col lg:flex-row gap-2 justify-between items-start lg:items-center">
          {searchQuery ? (
            <div>
              <h2 className="text-base font-bold text-primary">
                {t('products_search_results')} <span className="text-foreground">{searchQuery}</span>
              </h2>
              <p className="text-muted-foreground text-xs">
                {productsData?.totalCount || 0} {t('products_count')}
              </p>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-1 border border-border/40 rounded-md p-0.5">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-7 w-7 p-0"
              >
                <Grid3x3 className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-7 w-7 p-0"
              >
                <List className="h-3.5 w-3.5" />
              </Button>
            </div>

            {/* Category Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">{t('products_category_filter')}</label>
              <Select value={categoryFilter} onValueChange={(value: string) => {
                setCategoryFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[120px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{t('products_all_categories')}</SelectItem>
                  {categories?.map((category) => (
                    <SelectItem key={category.id} value={category.id} className="text-xs">
                      {category.name_ar}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Stock Filter */}
            <div className="flex items-center gap-1.5">
              <label className="text-xs text-muted-foreground whitespace-nowrap">{t('products_status_filter')}</label>
              <Select value={stockFilter} onValueChange={(value: 'all' | 'in-stock' | 'out-of-stock') => {
                setStockFilter(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-[100px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all" className="text-xs">{t('common_all')}</SelectItem>
                  <SelectItem value="in-stock" className="text-xs">{t('product_in_stock')}</SelectItem>
                  <SelectItem value="out-of-stock" className="text-xs">{t('product_out_of_stock')}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-1.5 flex-1 lg:flex-initial">
              <label className="text-xs text-muted-foreground whitespace-nowrap">{t('products_sort')}</label>
              <Select value={sortBy} onValueChange={(value: 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc') => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full lg:w-[160px] h-8 text-xs">
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
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
        ) : products && products.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-3 sm:grid-cols-4 md:grid-cols-5 lg:grid-cols-6 xl:grid-cols-7 2xl:grid-cols-8 gap-2">
              {products.map((product) => (
                <ProductCard
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
                  inStock={product.in_stock ?? true}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col gap-4">
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
                  inStock={product.in_stock ?? true}
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-8">
            <p className="text-sm text-muted-foreground">{t('products_not_found')}</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-6 mb-4">
            <Pagination dir="ltr">
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                    className={currentPage === 1 ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-primary/10'}
                  />
                </PaginationItem>

                {renderPageNumbers().map((page, index) => (
                  <PaginationItem key={index}>
                    {page === 'ellipsis' ? (
                      <PaginationEllipsis />
                    ) : (
                      <PaginationLink
                        onClick={() => setCurrentPage(page as number)}
                        isActive={currentPage === page}
                        className="cursor-pointer"
                      >
                        {page}
                      </PaginationLink>
                    )}
                  </PaginationItem>
                ))}

                <PaginationItem>
                  <PaginationNext
                    onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                    className={currentPage === totalPages ? 'pointer-events-none opacity-50' : 'cursor-pointer hover:bg-primary/10'}
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