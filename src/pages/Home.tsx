import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import CustomerChat from '@/components/CustomerChat';
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
    <div className="min-h-screen relative overflow-hidden bg-transparent">
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
      <main className="relative z-10 pt-20">
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
            <a
              href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار%20عن%20منتجاتكم"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 32 32">
                <path d="M19.11 17.03c-.27-.14-1.58-.78-1.83-.87-.25-.09-.43-.14-.62.14-.18.27-.71.86-.87 1.03-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.86-2.05-.23-.55-.46-.48-.62-.48-.16 0-.34-.02-.52-.02s-.48.07-.73.34c-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.85.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.55.58.65.2 1.24.17 1.71.1.52-.08 1.58-.64 1.8-1.26.23-.62.23-1.16.16-1.26-.07-.09-.25-.16-.52-.3zM16.02 3.2C8.83 3.2 3 8.98 3 16.1c0 2.28.61 4.42 1.67 6.26L3 29l6.83-1.79c1.79.98 3.85 1.54 6.19 1.54 7.19 0 13.02-5.78 13.02-12.9C29.04 8.98 23.21 3.2 16.02 3.2zm0 22.96c-1.98 0-3.82-.53-5.4-1.45l-.39-.23-4.05 1.06 1.08-3.94-.25-.41A10.6 10.6 0 0 1 5.42 16.1c0-5.86 4.8-10.62 10.7-10.62s10.7 4.76 10.7 10.62-4.8 10.62-10.7 10.62z"/>
              </svg>
              WhatsApp
            </a>
          </div>
          
        </section>

        {/* Categories Section */}
        <section id="categories" className="container mx-auto px-4 py-16 relative" style={{ minHeight: '600px', contain: 'layout' }}>
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4" style={{ minHeight: '400px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card/50 rounded-2xl p-5 border border-border/40 animate-pulse">
                  <div className="w-16 h-16 bg-muted rounded-xl mb-4 mx-auto" />
                  <div className="h-4 bg-muted rounded mb-2 w-3/4 mx-auto" />
                  <div className="h-3 bg-muted rounded w-full" />
                </div>
              ))}
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
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 sm:gap-4">
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
        <section id="products" className="container mx-auto px-4 py-12" style={{ minHeight: '500px', contain: 'layout' }}>
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-primary">منتجات مميزة</h2>
            <span className="text-sm text-muted-foreground">أحدث العروض</span>
          </div>
          
          {productsLoading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4" style={{ minHeight: '350px' }}>
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card rounded-xl p-3 border border-border/40 animate-pulse">
                  <div className="aspect-square bg-muted rounded-lg mb-2" />
                  <div className="h-4 bg-muted rounded mb-2" />
                  <div className="h-3 bg-muted rounded w-3/4" />
                </div>
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3 sm:gap-4">
              {products?.map((product, index) => (
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
                  priority={index < 3}
                />
              ))}
            </div>
          )}
        </section>

        <Footer />
      </main>
      <CustomerChat />
    </div>
  );
};

export default Home;