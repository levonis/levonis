import { useMemo, lazy, Suspense, memo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import SearchBar from '@/components/SearchBar';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import BannerCarousel from '@/components/BannerCarousel';
import { Loader2 } from 'lucide-react';

// Lazy load non-critical components
const CustomerChat = lazy(() => import('@/components/CustomerChat'));
const MarketplaceSection = lazy(() => import('@/components/marketplace/MarketplaceSection'));

// Memoized category card for performance
const MemoizedCategoryCard = memo(CategoryCard);

const Home = () => {
  const { data: mainSections, isLoading: mainSectionsLoading } = useQuery({
    queryKey: ['main-sections'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('main_sections')
        .select('id, name_ar, display_order')
        .order('display_order', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes cache
  });

  const { data: categories, isLoading: categoriesLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name, name_ar, slug, icon, description, description_ar, main_section_id')
        .order('created_at', { ascending: true });
      
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
  });

  // Memoized grouping - runs only when categories change
  const categoriesByMainSection = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, category) => {
      const sectionId = category.main_section_id || 'no-section';
      if (!acc[sectionId]) {
        acc[sectionId] = [];
      }
      acc[sectionId].push(category);
      return acc;
    }, {} as Record<string, typeof categories>);
  }, [categories]);

  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent">
      <main className="relative z-10 pt-20">
        {/* Banner Carousel - minimal spacing */}
        <section className="w-full">
          <BannerCarousel />
        </section>

        {/* Hero Section - Simplified for mobile */}
        <section className="container mx-auto px-4 py-6 md:py-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black mb-3 text-gradient-gold">
            LEVONIS
          </h1>
          <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6">
            نوفّر لك أحدث الإلكترونيات من حول العالم بأسعار تنافسية… بضمان رسمي وخدمة سريعة بلا منافس
          </p>
          
          <div className="mb-4 md:mb-6">
            <SearchBar />
          </div>
          
          {/* Social links - Hidden on very small screens */}
          <div className="hidden sm:flex items-center justify-center gap-3 md:gap-4">
            <a 
              href="https://www.facebook.com/levonisiq" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-border/50 text-xs md:text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Facebook ▾
            </a>
            <a 
              href="https://www.instagram.com/levonis_iq?igsh=MTZpeWxqYXN4MGtzbw==" 
              target="_blank" 
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-border/50 text-xs md:text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              Instagram ▾
            </a>
            <a
              href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار%20عن%20منتجاتكم"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-3 md:px-4 py-2 rounded-full border border-border/50 text-xs md:text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
            >
              <svg className="w-4 h-4 fill-current" viewBox="0 0 32 32">
                <path d="M19.11 17.03c-.27-.14-1.58-.78-1.83-.87-.25-.09-.43-.14-.62.14-.18.27-.71.86-.87 1.03-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.86-2.05-.23-.55-.46-.48-.62-.48-.16 0-.34-.02-.52-.02s-.48.07-.73.34c-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.85.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.55.58.65.2 1.24.17 1.71.1.52-.08 1.58-.64 1.8-1.26.23-.62.23-1.16.16-1.26-.07-.09-.25-.16-.52-.3zM16.02 3.2C8.83 3.2 3 8.98 3 16.1c0 2.28.61 4.42 1.67 6.26L3 29l6.83-1.79c1.79.98 3.85 1.54 6.19 1.54 7.19 0 13.02-5.78 13.02-12.9C29.04 8.98 23.21 3.2 16.02 3.2zm0 22.96c-1.98 0-3.82-.53-5.4-1.45l-.39-.23-4.05 1.06 1.08-3.94-.25-.41A10.6 10.6 0 0 1 5.42 16.1c0-5.86 4.8-10.62 10.7-10.62s10.7 4.76 10.7 10.62-4.8 10.62-10.7 10.62z"/>
              </svg>
              WhatsApp
            </a>
          </div>
        </section>

        {/* Categories Section - Optimized DOM */}
        <section id="categories" className="container mx-auto px-4 py-8 md:py-12 relative" style={{ contain: 'layout' }}>
          {/* Decorative glow - hidden on mobile */}
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center mb-6 md:mb-8 relative z-10">
            <div className="inline-block mb-2">
              <h2 className="text-lg md:text-2xl font-black px-16 md:px-32 py-2 md:py-3 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground shadow-lg relative overflow-hidden">
                <span className="relative z-10">الأقسام</span>
              </h2>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm">اختر القسم الفرعي للانتقال</p>
          </div>
          
          {categoriesLoading || mainSectionsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
              {[...Array(6)].map((_, i) => (
                <div key={i} className="bg-card/50 rounded-xl p-3 md:p-4 border border-border/40 animate-pulse h-[140px] md:h-[172px]">
                  <div className="w-8 h-8 md:w-12 md:h-12 bg-muted rounded-xl mb-2 mx-auto" />
                  <div className="h-3 bg-muted rounded mb-2 w-3/4 mx-auto" />
                </div>
              ))}
            </div>
          ) : (
            <div className="space-y-10 md:space-y-16">
              {mainSections?.map((mainSection) => {
                const sectionCategories = categoriesByMainSection?.[mainSection.id] || [];
                if (sectionCategories.length === 0) return null;
                
                return (
                  <div key={mainSection.id}>
                    <div className="flex items-center gap-2 md:gap-3 mb-4 md:mb-6">
                      <div className="w-1 h-5 md:h-6 bg-gradient-to-b from-primary to-accent rounded-full" />
                      <h3 className="text-lg md:text-xl font-black text-primary">{mainSection.name_ar}</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
                      {sectionCategories.map((category) => (
                        <MemoizedCategoryCard
                          key={category.id}
                          name={category.name}
                          nameAr={category.name_ar}
                          slug={category.slug}
                          icon={category.icon}
                          description={category.description}
                          descriptionAr={category.description_ar}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* Marketplace Section - Lazy loaded */}
        <Suspense fallback={<div className="h-32 md:h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-primary" /></div>}>
          <MarketplaceSection />
        </Suspense>

        <Footer />
      </main>
      <Suspense fallback={null}>
        <CustomerChat />
      </Suspense>
    </div>
  );
};

export default Home;