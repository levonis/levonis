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
  const ITEMS_PER_PAGE = 24;

  const { data: productsData, isLoading } = useQuery({
    queryKey: ['products', searchQuery, currentPage, sortBy],
    queryFn: async () => {
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let query = supabase
        .from('products')
        .select('*', { count: 'exact' })
        .eq('in_stock', true);

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
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-10 animate-float-decoration"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      {/* Decorative elements */}
      <div className="fixed top-0 left-1/3 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        <div className="mb-8">
          <SearchBar />
        </div>

        <div className="mb-6 flex flex-col lg:flex-row gap-4 justify-between items-start lg:items-center">
          {searchQuery ? (
            <div>
              <h2 className="text-2xl font-black text-primary">
                نتائج البحث عن: <span className="text-foreground">{searchQuery}</span>
              </h2>
              <p className="text-muted-foreground mt-1">
                {productsData?.totalCount || 0} منتج
              </p>
            </div>
          ) : (
            <div className="flex-1" />
          )}

          <div className="flex items-center gap-4 w-full lg:w-auto">
            {/* View Mode Toggle */}
            <div className="flex items-center gap-2 border border-border/40 rounded-lg p-1">
              <Button
                variant={viewMode === 'grid' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('grid')}
                className="h-8 w-8 p-0"
              >
                <Grid3x3 className="h-4 w-4" />
              </Button>
              <Button
                variant={viewMode === 'list' ? 'default' : 'ghost'}
                size="sm"
                onClick={() => setViewMode('list')}
                className="h-8 w-8 p-0"
              >
                <List className="h-4 w-4" />
              </Button>
            </div>

            {/* Sort Select */}
            <div className="flex items-center gap-2 flex-1 lg:flex-initial">
              <label className="text-sm text-muted-foreground whitespace-nowrap">ترتيب:</label>
              <Select value={sortBy} onValueChange={(value: 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc') => {
                setSortBy(value);
                setCurrentPage(1);
              }}>
                <SelectTrigger className="w-full lg:w-[200px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="default">افتراضي</SelectItem>
                  <SelectItem value="price-asc">السعر: الأرخص للأغلى</SelectItem>
                  <SelectItem value="price-desc">السعر: الأغلى للأرخص</SelectItem>
                  <SelectItem value="name-asc">الاسم: A إلى Z</SelectItem>
                  <SelectItem value="name-desc">الاسم: Z إلى A</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products && products.length > 0 ? (
          viewMode === 'grid' ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-3 sm:gap-4">
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
                />
              ))}
            </div>
          )
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">لم يتم العثور على منتجات</p>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="mt-12 mb-8">
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