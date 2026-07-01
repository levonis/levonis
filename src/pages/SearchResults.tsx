import { useEffect } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { Loader2, Search as SearchIcon, X } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useIslandSearch, pickName } from '@/island/useIslandSearch';
import { useInfiniteReveal } from '@/hooks/useInfiniteReveal';
import SEO from '@/components/SEO';
import { breadcrumbLd } from '@/lib/seo/structured';


const SearchResults = () => {
  const { t, language } = useLanguage();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const q = (searchParams.get('q') || '').trim();

  // Reuse the island search hook for consistent multilingual matching + ranking
  const { allProducts, isFetching } = useIslandSearch({
    query: q,
    scope: 'global',
    enabled: q.length >= 2,
    limit: 60,
  });

  useEffect(() => {
    document.title = q
      ? `${q} — ${language === 'en' ? 'Search' : language === 'ku' ? 'گەڕان' : 'بحث'}`
      : language === 'en'
      ? 'Search'
      : language === 'ku'
      ? 'گەڕان'
      : 'بحث';
  }, [q, language]);

  const clearSearch = () => {
    const next = new URLSearchParams(searchParams);
    next.delete('q');
    setSearchParams(next, { replace: true });
    navigate('/');
  };

  const labelResultsFor =
    language === 'en' ? `Results for:` : language === 'ku' ? `ئەنجامی گەڕان بۆ:` : `نتائج البحث عن:`;
  const labelEmpty =
    language === 'en'
      ? 'Type something in the search bar to find products.'
      : language === 'ku'
      ? 'لە خانەی گەڕاندا شتێک بنووسە بۆ دۆزینەوەی بەرهەمەکان.'
      : 'اكتب كلمة في شريط البحث للعثور على المنتجات.';
  const labelNone =
    language === 'en'
      ? 'No products matched your search.'
      : language === 'ku'
      ? 'هیچ بەرهەمێک نەدۆزرایەوە.'
      : 'لم يتم العثور على منتجات مطابقة.';
  const labelSearching =
    language === 'en' ? 'Searching…' : language === 'ku' ? 'گەڕان...' : 'جاري البحث...';
  const labelCount = (n: number) =>
    language === 'en'
      ? `${n} ${n === 1 ? 'result' : 'results'}`
      : language === 'ku'
      ? `${n} ئەنجام`
      : `${n} نتيجة`;

  const searchTitleBase = language === 'en' ? 'Search' : language === 'ku' ? 'گەڕان' : 'بحث';
  const seoTitle = q ? `${q} — ${searchTitleBase}` : searchTitleBase;
  const seoDesc = q
    ? (language === 'en'
        ? `Search results for "${q}" on LEVONIS — find 3D printers, electronics, filaments and accessories in Iraq.`
        : language === 'ku'
        ? `ئەنجامی گەڕان بۆ "${q}" لە LEVONIS — چاپکەری 3D، ئەلیکترۆنی و پێداویستی لە عێراق.`
        : `نتائج البحث عن "${q}" في LEVONIS — اعثر على طابعات 3D، إلكترونيات، فلامنت وملحقات في العراق.`)
    : (language === 'en'
        ? 'Search products on LEVONIS — 3D printers, filaments, electronics and accessories in Iraq.'
        : language === 'ku'
        ? 'گەڕان بۆ بەرهەمەکانی LEVONIS — چاپکەری 3D، فلامێنت و ئەلیکترۆنی لە عێراق.'
        : 'ابحث في منتجات LEVONIS — طابعات 3D، فلامنت، إلكترونيات وملحقات في العراق.');
  const seoUrl = q
    ? `https://levonisiq.com/search?q=${encodeURIComponent(q)}`
    : 'https://levonisiq.com/search';

  return (
    <div className="min-h-screen relative overflow-hidden">
      <SEO
        title={seoTitle}
        description={seoDesc}
        url={seoUrl}
        canonical="https://levonisiq.com/search"
        noindex={!q}
        jsonLd={[
          breadcrumbLd([
            { name: 'Home', url: '/' },
            { name: searchTitleBase, url: '/search' },
          ]),
        ]}
      />
      <main className="relative z-10 container mx-auto px-4 py-6 md:py-10">

        {/* Header */}
        <header className="mb-6">
          <div className="flex items-center gap-3 mb-2 text-foreground/60 text-sm">
            <Link to="/" className="hover:text-primary transition-colors">
              {t('nav_home')}
            </Link>
            <span>/</span>
            <span className="text-primary font-semibold">
              {language === 'en' ? 'Search' : language === 'ku' ? 'گەڕان' : 'بحث'}
            </span>
          </div>
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <h1 className="text-xl md:text-2xl font-extrabold text-foreground flex items-center gap-2.5" dir="auto">
              <SearchIcon className="h-5 w-5 text-primary" strokeWidth={2.5} />
              {q ? (
                <>
                  <span className="text-foreground/70 font-semibold">{labelResultsFor}</span>
                  <span className="text-primary">«{q}»</span>
                </>
              ) : (
                <span>{language === 'en' ? 'Search' : language === 'ku' ? 'گەڕان' : 'بحث'}</span>
              )}
            </h1>
            {q && (
              <button
                onClick={clearSearch}
                className="inline-flex items-center gap-1.5 rounded-full bg-foreground/10 hover:bg-foreground/15 px-3 py-1.5 text-xs font-medium text-foreground/85 transition"
              >
                <X className="h-3.5 w-3.5" strokeWidth={2.5} />
                {language === 'en' ? 'Clear' : language === 'ku' ? 'پاکردنەوە' : 'مسح'}
              </button>
            )}
          </div>
          {q && !isFetching && allProducts.length > 0 && (
            <div className="text-foreground/55 text-xs mt-2">{labelCount(allProducts.length)}</div>
          )}
        </header>

        {/* Body */}
        {!q ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-10 text-center text-foreground/60">
            {labelEmpty}
          </div>
        ) : isFetching ? (
          <div className="flex items-center justify-center py-16 text-foreground/60 text-sm">
            <Loader2 className="h-5 w-5 animate-spin mr-2" />
            {labelSearching}
          </div>
        ) : allProducts.length === 0 ? (
          <div className="rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md p-10 text-center text-foreground/60">
            {labelNone}
          </div>
        ) : (
          <SearchGrid products={allProducts} language={language} t={t} />
        )}
      </main>
    </div>
  );
};

function SearchGrid({
  products,
  language,
  t,
}: {
  products: any[];
  language: string;
  t: (k: any) => string;
}) {
  // Reveal in chunks so first paint stays fast even at limit=60.
  const { visible, sentinelRef, hasMore } = useInfiniteReveal(products.length, 18, 18);
  const items = products.slice(0, visible);
  return (
    <>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 md:gap-4">
        {items.map((p) => {
          const name = pickName(p, language as any);
          return (
            <Link
              key={p.id}
              to={`/product/${p.slug || p.id}`}
              className="group rounded-2xl border border-border/40 bg-card/70 backdrop-blur-md p-2.5 hover:border-primary/40 hover:shadow-lg transition-all cv-auto"
            >
              <div className="aspect-square w-full overflow-hidden rounded-xl bg-foreground/5 mb-2">
                {p.image_url && (
                  <img
                    src={p.image_url}
                    alt={name || ''}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                )}
              </div>
              <div
                className="text-[12px] md:text-[13px] font-semibold text-foreground line-clamp-2 leading-tight"
                dir="auto"
              >
                {name}
              </div>
              {p.price != null && (
                <div className="text-[12px] text-primary font-bold mt-1">
                  {Number(p.price).toLocaleString()} {t('common_iqd')}
                </div>
              )}
            </Link>
          );
        })}
      </div>
      {hasMore && (
        <div ref={sentinelRef} className="py-6 flex justify-center">
          <div className="h-5 w-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" />
        </div>
      )}
    </>
  );
}


export default SearchResults;
