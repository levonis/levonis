import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { ShoppingBag } from 'lucide-react';

const FeaturedProductsGrid = () => {
  const { data: products, isLoading } = useQuery({
    queryKey: ['featured-products-grid'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, price, image_url, category_id')
        .eq('has_in_stock', true)
        .eq('is_pricing_updated', true)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(6);
      if (error) throw error;
      return data;
    },
    staleTime: 2 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-16">
        <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-6">
          {[...Array(5)].map((_, i) => (
            <div key={i} className={`rounded-2xl bg-card/30 animate-pulse ${i === 0 ? 'md:col-span-8 md:row-span-2 h-64 md:h-auto' : 'md:col-span-4 h-64'}`} />
          ))}
        </div>
      </section>
    );
  }

  if (!products || products.length === 0) return null;

  // Layout: first card large, rest standard
  const [hero, ...rest] = products;

  return (
    <section className="max-w-[1400px] mx-auto px-6 md:px-10 py-12 md:py-20">
      <div className="flex items-center gap-3 mb-8 md:mb-12">
        <div className="w-1 h-7 bg-gradient-to-b from-primary to-accent rounded-full" />
        <h2 className="font-amiri text-2xl md:text-3xl font-bold text-foreground">أحدث المنتجات</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-12 gap-4 md:gap-6">
        {/* Hero product — large card */}
        <Link
          to={`/product/${hero.id}`}
          className="col-span-2 md:col-span-8 md:row-span-2 group relative rounded-2xl overflow-hidden bg-card/60 border border-border/30 hover:border-primary/40 transition-all duration-500 shadow-lg hover:shadow-2xl"
        >
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent z-10" />
          <img
            src={hero.image_url}
            alt={hero.name_ar}
            className="w-full h-full object-cover min-h-[300px] md:min-h-[520px] group-hover:scale-[1.03] transition-transform duration-700"
          />
          <div className="absolute bottom-0 right-0 left-0 p-6 md:p-8 z-20">
            <h3 className="font-bold text-white text-xl md:text-2xl mb-2 drop-shadow-lg">{hero.name_ar}</h3>
            <div className="flex items-center justify-between">
              <span className="text-primary font-black text-lg md:text-xl drop-shadow">
                {Number(hero.price).toLocaleString('ar-IQ')} <span className="text-sm text-white/70">د.ع</span>
              </span>
              <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-lg group-hover:scale-105 transition-transform">
                <ShoppingBag className="w-4 h-4" />
                اطلب الآن
              </span>
            </div>
          </div>
        </Link>

        {/* Remaining products — smaller cards */}
        {rest.slice(0, 4).map((product) => (
          <Link
            key={product.id}
            to={`/product/${product.id}`}
            className="col-span-1 md:col-span-4 group rounded-2xl overflow-hidden bg-card/60 border border-border/30 hover:border-primary/40 transition-all duration-400 shadow-md hover:shadow-xl"
          >
            <div className="aspect-square overflow-hidden">
              <img
                src={product.image_url}
                alt={product.name_ar}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                loading="lazy"
              />
            </div>
            <div className="p-3 md:p-4">
              <h3 className="font-bold text-foreground text-sm md:text-base mb-1 line-clamp-1">{product.name_ar}</h3>
              <div className="flex items-center justify-between">
                <span className="text-primary font-black text-sm md:text-base">
                  {Number(product.price).toLocaleString('ar-IQ')} <span className="text-[10px] md:text-xs text-muted-foreground">د.ع</span>
                </span>
                <span className="text-[10px] md:text-xs text-primary font-medium opacity-0 group-hover:opacity-100 transition-opacity">
                  اطلب الآن ←
                </span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
};

export default FeaturedProductsGrid;
