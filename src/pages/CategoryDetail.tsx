import { useQuery } from '@tanstack/react-query';
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

const CategoryDetail = () => {
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
        .select('*')
        .eq('category_id', category.id)
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
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    },
    enabled: !!category?.id
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-5 animate-float-decoration blur-sm"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
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
      
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
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
                <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between mb-6 gap-4">
                  <div className="flex items-center gap-4">
                    <h2 className="text-2xl font-black text-foreground">المنتجات المتاحة</h2>
                    <span className="text-muted-foreground text-sm">
                      عرض {products.length} {products.length === 1 ? 'منتج' : 'منتجات'}
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
                      <label className="text-sm text-muted-foreground whitespace-nowrap">ترتيب:</label>
                      <Select value={sortBy} onValueChange={(value: 'default' | 'price-asc' | 'price-desc' | 'name-asc' | 'name-desc') => setSortBy(value)}>
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