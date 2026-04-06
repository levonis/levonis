import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import FloatingProductCard from '@/components/FloatingProductCard';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

const CategoryDetail = () => {
  const { t } = useLanguage();
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

  const featuredProduct = products?.[0];
  const otherProducts = products?.slice(1) || [];

  return (
    <div className="min-h-screen category-luxury-bg">
      <main className="container mx-auto px-4 py-8 relative z-10">
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
            {/* Category Title */}
            <div className="text-center mb-12">
              <h1 className="text-4xl md:text-5xl font-black text-foreground/95 mb-3">
                {category.name_ar}
              </h1>
              {category.description_ar && (
                <p className="text-foreground/50 text-lg max-w-xl mx-auto">
                  {category.description_ar}
                </p>
              )}
            </div>

            {productsLoading ? (
              <div className="flex justify-center py-20">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
              </div>
            ) : products && products.length > 0 ? (
              <div className="space-y-12">
                {/* Featured Product */}
                {featuredProduct && (
                  <div className="flex justify-center">
                    <div className="w-full max-w-md">
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

                {/* Products Grid */}
                {otherProducts.length > 0 && (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-6">
                    {otherProducts.map((product, i) => (
                      <div
                        key={product.id}
                        className="animate-[stagger-in_0.4s_ease-out_forwards]"
                        style={{ animationDelay: `${i * 80}ms`, opacity: 0 }}
                      >
                        <FloatingProductCard
                          id={product.id}
                          name={product.name}
                          nameAr={product.name_ar}
                          price={Number(product.price)}
                          originalPrice={product.original_price ? Number(product.original_price) : undefined}
                          imageUrl={product.image_url || undefined}
                          currency={product.currency || undefined}
                          slug={product.slug}
                        />
                      </div>
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
