import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import { Loader2 } from 'lucide-react';

const Home = () => {
  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('*')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

  const { data: products, isLoading: productsLoading } = useQuery({
    queryKey: ['featured-products'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*')
        .eq('featured', true)
        .eq('in_stock', true)
        .order('created_at', { ascending: false })
        .limit(6);
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative ornamental corners */}
      <div className="fixed top-0 right-0 w-80 h-80 pointer-events-none opacity-20 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <path d="M10,10 Q50,10 50,50 L50,150 Q50,190 90,190 L150,190" 
                stroke="url(#goldGradient)" strokeWidth="1" fill="none" />
          <circle cx="50" cy="50" r="3" fill="hsl(var(--ring))" />
          <circle cx="90" cy="90" r="2" fill="hsl(var(--primary))" />
          <defs>
            <linearGradient id="goldGradient" x1="0%" y1="0%" x2="100%" y2="100%">
              <stop offset="0%" stopColor="hsl(var(--ring))" />
              <stop offset="100%" stopColor="hsl(var(--accent))" />
            </linearGradient>
          </defs>
        </svg>
      </div>
      
      <div className="fixed bottom-0 left-0 w-96 h-96 pointer-events-none opacity-15 animate-float" style={{ animationDelay: '1s' }}>
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="40" stroke="hsl(var(--accent) / 0.3)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      {/* Floating geometric patterns */}
      <div className="fixed top-1/4 left-1/4 w-32 h-32 pointer-events-none opacity-10 animate-float" style={{ animationDelay: '2s' }}>
        <div className="w-full h-full border border-primary/40 rotate-45 rounded-lg" />
      </div>
      
      <div className="fixed top-2/3 right-1/3 w-24 h-24 pointer-events-none opacity-10 animate-float" style={{ animationDelay: '3s' }}>
        <div className="w-full h-full border border-ring/30 rotate-12" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
      </div>
      
      <Header />
      
      <main className="relative">
        {/* Hero Section */}
        <section className="container mx-auto px-4 py-16 text-center">
          <h1 className="text-5xl md:text-6xl font-black mb-4 text-gradient-gold animate-in fade-in slide-in-from-bottom-4 duration-700">
            LEVONIS
          </h1>
          <p className="text-lg md:text-xl text-muted-foreground max-w-3xl mx-auto mb-8 animate-in fade-in slide-in-from-bottom-5 duration-700 delay-150">
            نوفّر لك أحدث الإلكترونيات من حول العالم بأسعار تنافسية… بضمان رسمي وخدمة سريعة بلا منافس
          </p>
          
          <div className="mb-8 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
            <SearchBar />
          </div>
          
          <a 
            href="https://www.instagram.com/levonis_iq?igsh=MTZpeWxqYXN4MGtzbw==" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            Instagram ▾
          </a>
        </section>

        {/* Categories Section */}
        <section id="categories" className="container mx-auto px-4 py-16 relative">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />
          
          <div className="text-center mb-12 animate-scale-in relative z-10">
            <h2 className="text-4xl md:text-5xl font-black text-gradient-gold mb-3 animate-glow">الأقسام</h2>
            <div className="w-24 h-1 bg-gradient-to-r from-transparent via-primary to-transparent mx-auto mb-3 animate-shimmer" />
            <p className="text-muted-foreground text-sm">اختر القسم الفرعي للانتقال</p>
          </div>
          
          {categoriesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-16">
              {/* First Row - Hardware Categories */}
              <div className="animate-slide-in-up">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                  <h3 className="text-2xl font-black text-primary">قطع الكمبيوتر</h3>
                </div>
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                  {categories?.slice(0, 6).map((category, index) => (
                    <div key={category.id} className={`stagger-${(index % 6) + 1}`}>
                      <CategoryCard
                        name={category.name}
                        nameAr={category.name_ar}
                        slug={category.slug}
                        icon={category.icon}
                        description={category.description}
                        descriptionAr={category.description_ar}
                      />
                    </div>
                  ))}
                </div>
              </div>

              {/* Second Row - 3D Printing Materials */}
              {categories && categories.length > 6 && (
                <div className="animate-slide-in-up" style={{ animationDelay: '0.2s' }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                    <h3 className="text-2xl font-black text-primary">المواد</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {categories.slice(6, 12).map((category, index) => (
                      <div key={category.id} className={`stagger-${(index % 6) + 1}`}>
                        <CategoryCard
                          name={category.name}
                          nameAr={category.name_ar}
                          slug={category.slug}
                          icon={category.icon}
                          description={category.description}
                          descriptionAr={category.description_ar}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Third Row - Additional Categories */}
              {categories && categories.length > 12 && (
                <div className="animate-slide-in-up" style={{ animationDelay: '0.4s' }}>
                  <div className="flex items-center gap-3 mb-6">
                    <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                    <h3 className="text-2xl font-black text-primary">أقسام أخرى</h3>
                  </div>
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                    {categories.slice(12).map((category, index) => (
                      <div key={category.id} className={`stagger-${(index % 6) + 1}`}>
                        <CategoryCard
                          name={category.name}
                          nameAr={category.name_ar}
                          slug={category.slug}
                          icon={category.icon}
                          description={category.description}
                          descriptionAr={category.description_ar}
                        />
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>

        {/* Featured Products Section */}
        <section id="products" className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-primary">منتجات مميزة</h2>
            <span className="text-sm text-muted-foreground">أحدث العروض</span>
          </div>
          
          {productsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
              {products?.map((product) => (
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
          )}
        </section>

        <Footer />
      </main>
    </div>
  );
};

export default Home;