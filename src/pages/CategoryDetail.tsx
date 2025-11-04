import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useParams, Link } from 'react-router-dom';
import Header from '@/components/Header';
import ProductCard from '@/components/ProductCard';
import { Loader2, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';

const CategoryDetail = () => {
  const { slug } = useParams<{ slug: string }>();

  const { data: category, isLoading: categoryLoading } = useQuery({
    queryKey: ['category', slug],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .eq('slug', slug)
        .single();
      
      if (error) throw error;
      return data;
    }
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['category-products', category?.id],
    queryFn: async () => {
      if (!category?.id) return [];
      
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('category_id', category.id)
        .eq('in_stock', true)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-0 right-0 w-80 h-80 pointer-events-none opacity-15 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M10,10 Q50,10 50,50 L50,150 Q50,190 90,190" 
                stroke="hsl(var(--ring) / 0.5)" strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="3" fill="hsl(var(--ring))" />
        </svg>
      </div>
      
      <div className="fixed bottom-20 left-20 w-64 h-64 pointer-events-none opacity-10 animate-float" style={{ animationDelay: '2s' }}>
        <div className="w-full h-full border border-primary/30 rotate-45 rounded-2xl" />
      </div>
      
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        {/* Breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-sm text-muted-foreground">
          <Link to="/" className="hover:text-primary transition-colors">
            الرئيسية
          </Link>
          <span>/</span>
          <Link to="/categories" className="hover:text-primary transition-colors">
            الأقسام
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
                {/* Decorative corner accent */}
                <div className="absolute top-0 left-0 w-32 h-32 opacity-20">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" stroke="hsl(var(--ring))" strokeWidth="0.5" fill="none" />
                    <circle cx="50" cy="50" r="30" stroke="hsl(var(--primary))" strokeWidth="0.5" fill="none" />
                  </svg>
                </div>
                
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
                        {products?.length || 0} منتج متاح
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
                <div className="flex items-center justify-between mb-6">
                  <h2 className="text-2xl font-black text-foreground">المنتجات المتاحة</h2>
                  <span className="text-muted-foreground text-sm">
                    عرض {products.length} {products.length === 1 ? 'منتج' : 'منتجات'}
                  </span>
                </div>
                
                <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
              </div>
            ) : (
              <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
                <div className="w-20 h-20 mx-auto mb-4 opacity-30">
                  <svg viewBox="0 0 100 100" className="w-full h-full">
                    <circle cx="50" cy="50" r="40" stroke="hsl(var(--muted-foreground))" strokeWidth="1" fill="none" />
                  </svg>
                </div>
                <p className="text-muted-foreground text-lg mb-6">
                  لا توجد منتجات متاحة في هذا القسم حالياً
                </p>
                <Link to="/">
                  <Button variant="outline" className="gap-2">
                    <ArrowRight className="h-4 w-4" />
                    تصفح المنتجات
                  </Button>
                </Link>
              </div>
            )}
          </>
        ) : (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-lg mb-6">
              القسم غير موجود
            </p>
            <Link to="/categories">
              <Button variant="outline" className="gap-2">
                <ArrowRight className="h-4 w-4" />
                العودة للأقسام
              </Button>
            </Link>
          </div>
        )}
      </main>
    </div>
  );
};

export default CategoryDetail;