import { useMemo, lazy, Suspense, memo, Component, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import BannerCarousel from '@/components/BannerCarousel';
import { Loader2 } from 'lucide-react';
import StoriesBar from '@/components/stories/StoriesBar';
import BundlesSection from '@/components/BundlesSection';
import ReelsBar from '@/components/reels/ReelsBar';
import { useLanguage } from '@/lib/i18n';
import HeroSection from '@/components/home/HeroSection';
import FeaturedProductsGrid from '@/components/home/FeaturedProductsGrid';
import CommunityGardenTransition from '@/components/home/CommunityGardenTransition';

const CommunitySection = lazy(() => import('@/components/community/CommunitySection').catch(() => {
  return import('@/components/community/CommunitySection');
}));
const OffersStorageSection = lazy(() => import('@/components/OffersStorageSection'));

class ErrorBoundaryFallback extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  render() {
    if (this.state.hasError) return <div className="text-center py-8 text-muted-foreground text-sm">تعذر تحميل المحتوى. يرجى تحديث الصفحة.</div>;
    return this.props.children;
  }
}

const MemoizedCategoryCard = memo(CategoryCard);

const Home = () => {
  const { t, language } = useLanguage();

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
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
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

  const { data: directSaleCategoryIds } = useQuery({
    queryKey: ['direct-sale-categories-v2'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('category_id, direct_stock, colors')
        .eq('has_in_stock', true)
        .eq('is_pricing_updated', true);
      if (error) throw error;
      const ids = new Set<string>();
      for (const p of (data || [])) {
        if (!p.category_id) continue;
        if (!isAllDirectStockDepleted(p)) {
          ids.add(p.category_id);
        }
      }
      return ids;
    },
    staleTime: 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
  });

  const categoriesByMainSection = useMemo(() => {
    if (!categories) return {};
    return categories.reduce((acc, category) => {
      const sectionId = category.main_section_id || 'no-section';
      if (!acc[sectionId]) acc[sectionId] = [];
      acc[sectionId].push(category);
      return acc;
    }, {} as Record<string, typeof categories>);
  }, [categories]);

  const getSectionName = (section: any) => {
    if (language === 'en') return (section as any).name_en || section.name_ar;
    if (language === 'ku') return (section as any).name_ku || section.name_ar;
    return section.name_ar;
  };

  const getCategoryName = (cat: any) => {
    if (language === 'en') return cat.name || cat.name_ar;
    if (language === 'ku') return cat.name_ar;
    return cat.name_ar;
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent">
      <main className="relative z-10">
        {/* 1. Hero Section */}
        <HeroSection />

        {/* 2. Wishes Banner — subtle */}
        <section className="max-w-[1400px] mx-auto px-6 md:px-10 mb-4">
          <a href="/wishes" className="block relative rounded-2xl overflow-hidden group">
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/30 via-accent/40 to-primary/30 bg-[length:300%_100%] rounded-2xl animate-shimmer opacity-40 group-hover:opacity-70 transition-opacity" />
            <div className="relative bg-card/80 rounded-[15px] py-3.5 px-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-primary/15 to-accent/15 border border-primary/10 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <span className="text-lg">✨</span>
                </div>
                <div>
                  <span className="text-sm font-black text-foreground block leading-tight">الأمنيات</span>
                  <span className="text-[11px] text-muted-foreground">تمنّى منتجاً وسنوفره لك</span>
                </div>
              </div>
              <div className="w-8 h-8 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all">
                <svg className="w-4 h-4 text-primary group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px] transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </div>
            </div>
          </a>
        </section>

        {/* 3. Banner Carousel */}
        <section className="max-w-[1400px] mx-auto px-6 md:px-10">
          <BannerCarousel />
        </section>

        {/* 4. Reels Bar */}
        <section className="max-w-[1400px] mx-auto px-0 md:px-10 mt-6">
          <ReelsBar />
        </section>

        {/* 5. Featured Products Grid */}
        <FeaturedProductsGrid />

        {/* 6. Stories Bar */}
        <section className="max-w-[1400px] mx-auto px-0 md:px-10">
          <StoriesBar />
        </section>

        {/* 7. Bundles Section */}
        <div className="max-w-[1400px] mx-auto px-3 md:px-10">
          <BundlesSection />
        </div>

        {/* 8. Categories Section */}
        <section id="categories" className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 md:py-20 relative" style={{ contain: 'layout' }}>
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/4 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center mb-8 md:mb-12 relative z-10">
            <div className="inline-block mb-3">
              <h2 className="font-amiri text-2xl md:text-3xl lg:text-4xl font-bold px-10 md:px-16 py-3 md:py-4 rounded-2xl bg-gradient-to-b from-primary to-accent text-primary-foreground shadow-xl relative overflow-hidden">
                <span className="relative z-10">{t('home_sections')}</span>
              </h2>
            </div>
            <p className="text-muted-foreground text-sm md:text-base">{t('home_sections_desc')}</p>
          </div>
          
          {categoriesLoading || mainSectionsLoading ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="bg-card/30 rounded-2xl p-4 md:p-5 border border-border/20 animate-pulse h-[180px] md:h-[220px]" />
              ))}
            </div>
          ) : (
            <div className="space-y-14 md:space-y-20">
              {mainSections?.map((mainSection) => {
                const sectionCategories = categoriesByMainSection?.[mainSection.id] || [];
                if (sectionCategories.length === 0) return null;
                
                return (
                  <div key={mainSection.id}>
                    <div className="flex items-center gap-3 mb-6 md:mb-8">
                      <div className="w-1 h-6 md:h-7 bg-gradient-to-b from-primary to-accent rounded-full" />
                      <h3 className="font-amiri text-xl md:text-2xl font-bold text-primary">{getSectionName(mainSection)}</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 md:gap-6">
                      {sectionCategories.map((category) => (
                        <MemoizedCategoryCard
                          key={category.id}
                          name={category.name}
                          nameAr={getCategoryName(category)}
                          slug={category.slug}
                          icon={category.icon}
                          description={category.description}
                          descriptionAr={category.description_ar}
                          hasDirectSale={directSaleCategoryIds?.has(category.id)}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>

        {/* 9. Offers/Storage */}
        <div className="max-w-[1400px] mx-auto">
          <Suspense fallback={<div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
            <OffersStorageSection />
          </Suspense>
        </div>

        {/* 10. Community Section */}
        <Suspense fallback={<div className="h-48 md:h-64 flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>}>
          <ErrorBoundaryFallback>
            <CommunityGardenTransition>
              <CommunitySection />
            </CommunityGardenTransition>
          </ErrorBoundaryFallback>
        </Suspense>

        <Footer />
      </main>
    </div>
  );
};

export default Home;
