import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import { useState } from 'react';
import ProductCard from '@/components/ProductCard';
import ProductListItem from '@/components/ProductListItem';
import { Loader2, ArrowRight, Grid3x3, List } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useLanguage } from '@/lib/i18n';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';

const CategoryDetail = () => {
  const { t } = useLanguage();
  const { isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();
  const [sortBy, setSortBy] = useState<'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc'>('default');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');

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
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id,
    staleTime: 2 * 60 * 1000,
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">
            {t('nav_home')}
          </Link>
          <span>/</span>
          <Link to="/categories" className="hover:text-primary transition-colors">
            {t('nav_categories')}
          </Link>
          <span>/</span>
          {categoryLoading ? (
            <span>...</span>
          ) : (
            <span className="text-foreground font-medium">{category?.name_ar}</span>
          )}
        </div>

        {categoryLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : category ? (
          <>
            {/* Category Header */}
            <div className="mb-10 relative">
              <div className="glass-effect rounded-2xl p-8 border border-border/50 relative overflow-hidden">
                
                <div className="flex items-start gap-6 relative z-10">
                  {/* Category Icon */}
                  <div 
                    className="w-20 h-20 rounded-2xl flex items-center justify-center text-primary-foreground font-black text-2xl flex-shrink-0 shadow-lg"
                    style={{ 
                      background: 'var(--gradient-radial-gold)',
                      border: '1px solid hsl(var(--ring))'
                    }}
                  >
                    {category.icon}
                  </div>
                  
                  <div className="flex-1">
                    <h1 className="text-4xl font-black text-primary mb-2">
                      {category.name_ar}
                    </h1>
                    <p className="text-lg text-muted-foreground mb-4">
                      {category.description_ar}
                    </p>
                    <div className="flex items-center gap-2 text-sm">
                       <span className="px-3 py-1 rounded-full bg-primary/10 text-primary border border-primary/20">
                         {products?.length || 0} {t('products_available')}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {productsLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-primary" />
              </div>
            ) : products && products.length > 0 ? (
              <div>
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-4">
                     <h2 className="text-2xl font-black text-foreground">{t('products_available_title')}</h2>
                    <span className="text-muted-foreground text-sm">
                      {t('products_showing').replace('{count}', String(products.length))}
                    </span>
                  </div>
                  
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
                       <label className="text-sm text-muted-foreground whitespace-nowrap">{t('products_sort')}</label>
                      <Select value={sortBy} onValueChange={(value: 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc') => setSortBy(value)}>
                        <SelectTrigger className="w-full lg:w-[200px]">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="default">{t('products_sort_default')}</SelectItem>
                          <SelectItem value="price-asc">{t('products_sort_price_asc')}</SelectItem>
                          <SelectItem value="price-desc">{t('products_sort_price_desc')}</SelectItem>
                          <SelectItem value="name-asc">{t('products_sort_name_asc')}</SelectItem>
                          <SelectItem value="name-desc">{t('products_sort_name_desc')}</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                </div>
                
                {viewMode === 'grid' ? (
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
                        hasDirectSale={(product.has_in_stock ?? false) && !isAllDirectStockDepleted(product)}
                        soldCount={product.sold_count ?? 0}
                        cardDiscounts={(product as any).card_discounts}
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
                )}
              </div>
            ) : (
              <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
                <div className="w-20 h-20 mx-auto mb-4 opacity-30">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" stroke="hsl(var(--muted-foreground))" strokeWidth="1" fill="none" />
                  </svg>
                </div>
                 <p className="text-muted-foreground text-lg mb-6">
                  {t('category_no_products')}
                </p>
                <Link to="/">
                  <Button variant="outline" className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    {t('products_browse')}
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
             <p className="text-muted-foreground text-lg mb-6">
              {t('category_not_found')}
            </p>
            <Link to="/categories">
              <Button variant="outline" className="gap-2">
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