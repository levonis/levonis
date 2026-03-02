import { useMemo, lazy, Suspense, memo, Component, ReactNode } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { isAllDirectStockDepleted } from '@/lib/stockUtils';
import SearchBar from '@/components/SearchBar';
import CategoryCard from '@/components/CategoryCard';
import Footer from '@/components/Footer';
import BannerCarousel from '@/components/BannerCarousel';
import { Loader2 } from 'lucide-react';
import AnimatedDivider from '@/components/ui/animated-divider';
import StoriesBar from '@/components/stories/StoriesBar';
import ReelsBar from '@/components/reels/ReelsBar';
import { useLanguage } from '@/lib/i18n';

const CommunitySection = lazy(() => import('@/components/community/CommunitySection').catch(() => {
  // Retry once on dynamic import failure (common with HMR/cache issues)
  return import('@/components/community/CommunitySection');
}));
const OffersStorageSection = lazy(() => import('@/components/OffersStorageSection'));

// Simple error boundary for lazy-loaded components
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

  // Fetch category IDs that have at least one direct-sale product with available stock
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
    if (language === 'ku') return cat.name_ar; // fallback until DB has ku
    return cat.name_ar;
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-transparent">
      <main className="relative z-10 pt-6">
        {/* ✨ Wishes Link - Animated Premium Banner */}
        <section className="container mx-auto px-4 mb-2">
          <a href="/wishes" className="block relative rounded-2xl overflow-hidden group">
            {/* Shimmer border */}
            <div className="absolute -inset-[1px] bg-gradient-to-r from-primary/40 via-accent/60 to-primary/40 bg-[length:300%_100%] rounded-2xl animate-shimmer opacity-50 group-hover:opacity-80 transition-opacity" />
            <div className="relative bg-card/95 rounded-[15px] py-3 px-4 flex items-center justify-between">
              {/* Glow blob */}
              <div className="absolute -top-4 right-6 w-16 h-16 bg-primary/10 rounded-full blur-2xl group-hover:bg-primary/20 transition-all duration-700" />
              <div className="relative flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-primary/20 to-accent/20 border border-primary/15 flex items-center justify-center group-hover:scale-110 transition-transform duration-300">
                  <span className="text-base">✨</span>
                </div>
                <div>
                  <span className="text-sm font-black text-foreground block leading-tight">الأمنيات</span>
                  <span className="text-[10px] text-muted-foreground">تمنّى منتجاً وسنوفره لك</span>
                </div>
              </div>
              <div className="relative w-7 h-7 rounded-lg bg-primary/10 group-hover:bg-primary/20 flex items-center justify-center transition-all">
                <svg className="w-3.5 h-3.5 text-primary group-hover:translate-x-[-2px] rtl:group-hover:translate-x-[2px] transition-transform duration-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}><path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" /></svg>
              </div>
            </div>
          </a>
        </section>

        <section className="w-full">
          <BannerCarousel />
        </section>

        <section className="container mx-auto px-0">
          <ReelsBar />
        </section>

        <section className="container mx-auto px-4 py-6 md:py-10 text-center">
          <h1 className="text-3xl md:text-5xl font-black mb-3 text-gradient-gold">
            LEVONIS
          </h1>
          <p className="text-sm md:text-lg text-muted-foreground max-w-2xl mx-auto mb-4 md:mb-6">
            {t('home_subtitle')}
          </p>
          
          <div className="mb-4 md:mb-6">
            <SearchBar />
          </div>
          
          <div className="flex flex-wrap items-center justify-center gap-2 md:gap-3">
            <a href="https://www.facebook.com/levonisiq" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-[11px] md:text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
              Facebook
            </a>
            <a href="https://www.instagram.com/levonis_iq" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-[11px] md:text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 100 12.324 6.162 6.162 0 000-12.324zM12 16a4 4 0 110-8 4 4 0 010 8zm6.406-11.845a1.44 1.44 0 100 2.881 1.44 1.44 0 000-2.881z"/></svg>
              Instagram
            </a>
            <a href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار" target="_blank" rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-[11px] md:text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
              WhatsApp
            </a>
            <a href="tel:+9647838455220"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full border border-border/50 text-[11px] md:text-xs text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors">
              📞 {t('home_call_us')}
            </a>
          </div>
        </section>

        <section className="container mx-auto px-0">
          <StoriesBar />
        </section>

        <section id="categories" className="container mx-auto px-4 py-8 md:py-12 relative" style={{ contain: 'layout' }}>
          <div className="hidden md:block absolute top-0 left-1/2 -translate-x-1/2 w-96 h-96 bg-primary/5 rounded-full blur-3xl pointer-events-none" />
          
          <div className="text-center mb-6 md:mb-8 relative z-10">
            <div className="inline-block mb-2">
              <h2 className="text-lg md:text-2xl font-black px-16 md:px-32 py-2 md:py-3 rounded-xl bg-gradient-to-b from-primary to-accent text-primary-foreground shadow-lg relative overflow-hidden">
                <span className="relative z-10">{t('home_sections')}</span>
              </h2>
            </div>
            <p className="text-muted-foreground text-xs md:text-sm">{t('home_sections_desc')}</p>
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
                      <h3 className="text-lg md:text-xl font-black text-primary">{getSectionName(mainSection)}</h3>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2 sm:gap-3">
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

        <Suspense fallback={<div className="h-32 flex items-center justify-center"><Loader2 className="w-6 h-6 animate-spin text-primary" /></div>}>
          <OffersStorageSection />
        </Suspense>

        <div className="container mx-auto px-4">
          <AnimatedDivider className="my-4 md:my-6 opacity-90" />
        </div>

        <Suspense fallback={<div className="h-32 md:h-64 flex items-center justify-center"><Loader2 className="w-6 h-6 md:w-8 md:h-8 animate-spin text-primary" /></div>}>
          <ErrorBoundaryFallback>
            <CommunitySection />
          </ErrorBoundaryFallback>
        </Suspense>

        <Footer />
      </main>
    </div>
  );
};

export default Home;
