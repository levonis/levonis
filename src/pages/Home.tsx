import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import { Loader2 } from 'lucide-react';

const Home = () => {
  const { data: mainSections, isLoading: mainSectionsLoading } = useQuery({
    queryKey: ['main-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('main_sections')
        .select('*')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    }
  });

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

  // تنظيم الأقسام حسب الأقسام الرئيسية
  const categoriesByMainSection = categories?.reduce((acc, category) => {
    const sectionId = category.main_section_id || 'no-section';
    if (!acc[sectionId]) {
      acc[sectionId] = [];
    }
    acc[sectionId].push(category);
    return acc;
  }, {} as Record<string, typeof categories>);

  return (
    <div className="min-h-screen relative overflow-hidden bg-background">
      {/* Full page decorative border - starts below header */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 opacity-90"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
          filter: 'drop-shadow(0 0 20px rgba(212, 175, 55, 0.3))',
        }}
      />
      
      {/* Glow effect overlay */}
      <div className="fixed inset-0 pointer-events-none z-0">
        <div className="absolute top-0 left-0 w-64 h-64 bg-ring/10 rounded-full blur-3xl animate-pulse-glow" />
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl animate-pulse-glow" style={{ animationDelay: '1s' }} />
      </div>
      
      <main className="relative z-10">
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
          
          <div className="flex items-center justify-center gap-4 animate-in fade-in slide-in-from-bottom-7 duration-700 delay-450">
            <a 
              href="https://www.facebook.com/levonisiq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Facebook ▾
            </a>
            <a 
              href="https://www.instagram.com/levonis_iq?igsh=MTZpeWxqYXN4MGtzbw==" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Instagram ▾
            </a>
          </div>
        </section>

        {/* Categories Section */}
        <section id="categories" className="container mx-auto px-4 py-16 relative">
          {/* Decorative glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl animate-pulse-glow pointer-events-none" />
          
          <div className="text-center mb-12 animate-scale-in relative z-10">
            <div className="inline-block mb-3">
              <h2 className="text-2xl md:text-3xl font-black px-32 md:px-40 py-4 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground shadow-lg relative overflow-hidden">
                {/* Glossy overlay effect */}
                <span className="absolute inset-0 bg-gradient-to-b from-white/30 via-white/10 to-transparent pointer-events-none" />
                <span className="relative z-10">الأقسام</span>
              </h2>
            </div>
            <p className="text-muted-foreground text-sm">اختر القسم الفرعي للانتقال</p>
          </div>
          
          {categoriesLoading || mainSectionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="space-y-16">
              {/* الأقسام الرئيسية مع الأقسام الفرعية */}
              {mainSections?.map((mainSection, sectionIndex) => {
                const sectionCategories = categoriesByMainSection?.[mainSection.id] || [];
                if (sectionCategories.length === 0) return null;
                
                return (
                  <div 
                    key={mainSection.id} 
                    className="animate-slide-in-up"
                    style={{ animationDelay: `${sectionIndex * 0.2}s` }}
                  >
                    <div className="flex items-center gap-3 mb-6">
                      <div className="w-1 h-8 bg-gradient-to-b from-primary to-accent rounded-full" />
                      <h3 className="text-2xl font-black text-primary">{mainSection.name_ar}</h3>
                    </div>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                      {sectionCategories.map((category, index) => (
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
                );
              })}
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