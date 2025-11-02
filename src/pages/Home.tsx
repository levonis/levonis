import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import CategoryCard from '@/components/CategoryCard';
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
            href="https://instagram.com" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-border/50 text-sm text-muted-foreground hover:border-primary/50 hover:text-primary transition-colors"
          >
            Instagram ▾
          </a>
        </section>

        {/* Categories Section */}
        <section id="categories" className="container mx-auto px-4 py-12">
          <div className="flex items-center justify-between mb-8">
            <h2 className="text-3xl font-black text-primary">الأقسام</h2>
            <span className="text-sm text-muted-foreground">اختر القسم للانتقال</span>
          </div>
          
          {categoriesLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              {categories?.map((category) => (
                <CategoryCard
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
                  slug={product.slug}
                />
              ))}
            </div>
          )}
        </section>

        {/* Footer */}
        <footer className="border-t border-border/40 py-8 mt-16 relative">
          {/* Decorative divider */}
          <div className="absolute top-0 left-0 right-0 h-px">
            <div className="h-full bg-gradient-to-r from-transparent via-ring/40 to-transparent" />
          </div>
          
          <div className="container mx-auto px-4 text-center relative">
            {/* Ornamental icon */}
            <div className="w-12 h-12 mx-auto mb-4 opacity-30">
              <svg viewBox="0 0 50 50" className="w-full h-full">
                <circle cx="25" cy="25" r="20" stroke="hsl(var(--ring))" strokeWidth="0.5" fill="none" />
                <circle cx="25" cy="25" r="15" stroke="hsl(var(--primary))" strokeWidth="0.5" fill="none" />
                <circle cx="25" cy="25" r="10" stroke="hsl(var(--accent))" strokeWidth="0.5" fill="none" />
              </svg>
            </div>
            
            <p className="text-muted-foreground">
              © {new Date().getFullYear()} LEVONIS IQ — كل الحقوق محفوظة
            </p>
          </div>
        </footer>
      </main>

      {/* WhatsApp Float Button */}
      <a
        href="https://wa.me/9647700000000"
        target="_blank"
        rel="noopener noreferrer"
        className="fixed bottom-6 left-6 w-16 h-16 rounded-full flex items-center justify-center z-50 shadow-2xl hover:scale-110 transition-all duration-300 group"
        style={{
          background: 'radial-gradient(120% 120% at 30% 30%, #2fe080 0%, #25D366 60%, #1da955 100%)',
          boxShadow: '0 8px 20px rgba(0,0,0,.35), inset 0 0 0 2px rgba(255,255,255,.08)'
        }}
        aria-label="دردشة واتساب"
      >
        {/* Pulse ring on hover */}
        <span className="absolute inset-0 rounded-full bg-[#25D366] opacity-0 group-hover:opacity-30 group-hover:scale-150 transition-all duration-500" />
        
        <svg className="w-8 h-8 fill-white relative z-10" viewBox="0 0 32 32" aria-hidden="true">
          <path d="M19.11 17.03c-.27-.14-1.58-.78-1.83-.87-.25-.09-.43-.14-.62.14-.18.27-.71.86-.87 1.03-.16.18-.32.2-.59.07-.27-.14-1.14-.42-2.17-1.33-.8-.71-1.34-1.58-1.5-1.85-.16-.27-.02-.42.12-.56.12-.12.27-.32.41-.48.14-.16.18-.27.27-.45.09-.18.05-.34-.02-.48-.07-.14-.62-1.5-.86-2.05-.23-.55-.46-.48-.62-.48-.16 0-.34-.02-.52-.02s-.48.07-.73.34c-.25.27-.96.94-.96 2.29 0 1.35.98 2.66 1.12 2.85.14.18 1.93 2.95 4.68 4.02.65.28 1.16.45 1.55.58.65.2 1.24.17 1.71.1.52-.08 1.58-.64 1.8-1.26.23-.62.23-1.16.16-1.26-.07-.09-.25-.16-.52-.3zM16.02 3.2C8.83 3.2 3 8.98 3 16.1c0 2.28.61 4.42 1.67 6.26L3 29l6.83-1.79c1.79.98 3.85 1.54 6.19 1.54 7.19 0 13.02-5.78 13.02-12.9C29.04 8.98 23.21 3.2 16.02 3.2zm0 22.96c-1.98 0-3.82-.53-5.4-1.45l-.39-.23-4.05 1.06 1.08-3.94-.25-.41A10.6 10.6 0 0 1 5.42 16.1c0-5.86 4.8-10.62 10.7-10.62s10.7 4.76 10.7 10.62-4.8 10.62-10.7 10.62z"/>
        </svg>
      </a>
    </div>
  );
};

export default Home;