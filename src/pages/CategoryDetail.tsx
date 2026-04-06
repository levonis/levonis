import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import FloatingProductCard from '@/components/FloatingProductCard';
import { Loader2, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

const CategoryDetail = () => {
  const { t } = useLanguage();
  const [showFullDesc, setShowFullDesc] = useState(false);
  const { isAdmin } = useAuth();
  const { slug } = useParams<{ slug: string }>();

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
    queryKey: ['category-products', category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      let query = supabase
        .from('products')
        .select('id, name, name_ar, description, description_ar, price, original_price, image_url, images, currency, slug, has_in_stock, sold_count, in_stock, is_pricing_updated, direct_stock, colors, category_id, created_at, card_discounts')
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

  const featuredProduct = (() => {
    if (!products?.length) return undefined;
    if (category?.featured_product_id) {
      const found = products.find(p => p.id === category.featured_product_id);
      if (found) return found;
    }
    return products[0];
  })();
  const otherProducts = products?.filter(p => p.id !== featuredProduct?.id) || [];

  // Split other products into 3 columns for staggered layout
  const columns: typeof otherProducts[] = [[], [], []];
  otherProducts.forEach((p, i) => {
    columns[i % 3].push(p);
  });

  return (
    <div className="min-h-screen category-luxury-bg">
      <main className="container mx-auto px-4 py-8 relative z-10 bg-background">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-8 text-sm text-foreground/50">
          <Link to="/" className="hover:text-primary transition-colors">{t('nav_home')}</Link>
          <span>/</span>
          <Link to="/categories" className="hover:text-primary transition-colors">{t('nav_categories')}</Link>
          <span>/</span>
          {categoryLoading ? <span>...</span> : (
            <span className="text-primary font-medium">{category?.name_ar}</span>
          )}
        </div>

        {categoryLoading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="h-10 w-10 animate-spin text-primary" />
          </div>
        ) : category ? (
          <>
            {productsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : products && products.length > 0 ? (
              <div className="space-y-16">
                {/* Hero section: Title + Featured product side by side */}
                {featuredProduct && (
                  <div className="flex flex-col-reverse md:flex-row items-center md:items-start gap-8 md:gap-16">
                    {/* Title & description — left side */}
                    <div className="flex-1 text-right pt-4 md:pt-12">
                      <h1 className="text-4xl md:text-6xl font-black text-foreground/90 mb-4 tracking-tight leading-tight">
                        {featuredProduct.name_ar}
                      </h1>
                      {featuredProduct.description_ar && (
                        <div>
                          <p className={`text-foreground/40 text-base md:text-lg max-w-md mr-0 ml-auto ${!showFullDesc ? 'line-clamp-2' : ''}`}>
                            {featuredProduct.description_ar}
                          </p>
                          <button
                            onClick={() => setShowFullDesc(!showFullDesc)}
                            className="text-primary text-sm mt-2 hover:underline"
                          >
                            {showFullDesc ? 'عرض أقل' : 'عرض المزيد'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Featured product on right */}
                    <div className="flex-shrink-0 w-full max-w-sm">
                      <FloatingProductCard
                        id={featuredProduct.id}
                        name={featuredProduct.name}
                        nameAr={featuredProduct.name_ar}
                        price={Number(featuredProduct.price)}
                        originalPrice={featuredProduct.original_price ? Number(featuredProduct.original_price) : undefined}
                        imageUrl={featuredProduct.image_url || undefined}
                        currency={featuredProduct.currency || undefined}
                        slug={featuredProduct.slug}
                        featured
                      />
                    </div>
                  </div>
                )}


                {/* Staggered grid of product cards */}
                {otherProducts.length > 0 && (
                  <div className="hidden md:flex gap-6 items-start">
                    {columns.map((col, colIdx) => (
                      <div
                        key={colIdx}
                        className="flex-1 flex flex-col gap-6"
                        style={{ marginTop: colIdx === 1 ? '3rem' : colIdx === 2 ? '1.5rem' : '0' }}
                      >
                        {col.map((product) => (
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
                          />
                        ))}
                      </div>
                    ))}
                  </div>
                )}

                {/* Mobile: simple 2-column grid */}
                {otherProducts.length > 0 && (
                  <div className="grid grid-cols-2 gap-4 md:hidden">
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
                      />
                    ))}
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
            <Link to="/categories">
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
