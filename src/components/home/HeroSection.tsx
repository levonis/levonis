import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Link } from 'react-router-dom';
import { useLanguage } from '@/lib/i18n';
import SearchBar from '@/components/SearchBar';

const HeroSection = () => {
  const { t } = useLanguage();

  const { data: heroProduct } = useQuery({
    queryKey: ['hero-product'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, price, image_url, description_ar')
        .eq('has_in_stock', true)
        .eq('is_pricing_updated', true)
        .not('image_url', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .single();
      if (error) return null;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  return (
    <section className="relative overflow-hidden py-16 md:py-24 lg:py-32">
      {/* Background layers */}
      <div className="absolute inset-0 bg-gradient-to-bl from-background via-[hsl(var(--emerald-deep))] to-background" />
      <div className="absolute top-1/2 left-1/4 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-primary/5 blur-3xl pointer-events-none" />
      <div className="absolute bottom-0 right-0 w-[400px] h-[400px] rounded-full bg-accent/5 blur-3xl pointer-events-none" />

      <div className="relative z-10 max-w-[1400px] mx-auto px-6 md:px-10">
        <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center">
          {/* Text side — RTL so this is the right side visually */}
          <div className="md:col-span-5 flex flex-col gap-6 text-center md:text-right order-2 md:order-1">
            <h1 className="font-amiri text-4xl md:text-5xl lg:text-6xl font-bold leading-tight text-foreground">
              <span className="text-gradient-gold">LEVONIS</span>
            </h1>
            <p className="text-base md:text-lg text-muted-foreground leading-relaxed max-w-md mx-auto md:mx-0">
              {t('home_subtitle')}
            </p>
            <div className="max-w-sm mx-auto md:mx-0 w-full">
              <SearchBar />
            </div>
            <div className="flex flex-wrap items-center justify-center md:justify-start gap-3 mt-2">
              <a href="https://wa.me/9647838455220?text=مرحباً%20اريد%20الاستفسار" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-primary text-primary-foreground font-bold text-sm hover:scale-105 transition-transform shadow-lg">
                <svg className="w-4 h-4 fill-current" viewBox="0 0 24 24"><path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413z"/></svg>
                تواصل معنا
              </a>
              <a href="https://www.instagram.com/levonis_iq" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/60 text-foreground/80 text-sm hover:border-primary/50 hover:text-primary transition-colors">
                Instagram
              </a>
              <a href="https://www.facebook.com/levonisiq" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full border border-border/60 text-foreground/80 text-sm hover:border-primary/50 hover:text-primary transition-colors">
                Facebook
              </a>
            </div>
          </div>

          {/* Product pedestal side */}
          <div className="md:col-span-7 flex items-center justify-center order-1 md:order-2">
            {heroProduct ? (
              <Link to={`/product/${heroProduct.id}`} className="group relative block">
                {/* Glow behind product */}
                <div className="absolute inset-0 -m-8 rounded-full bg-gradient-to-br from-primary/15 via-accent/10 to-transparent blur-3xl group-hover:from-primary/25 transition-all duration-700" />
                {/* Product card */}
                <div className="relative rounded-3xl overflow-hidden bg-card/60 border border-border/30 shadow-2xl group-hover:shadow-[0_20px_60px_-15px_hsl(var(--primary)/0.25)] transition-all duration-500 max-w-md">
                  <div className="aspect-square overflow-hidden">
                    <img
                      src={heroProduct.image_url}
                      alt={heroProduct.name_ar}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                      loading="eager"
                    />
                  </div>
                  <div className="p-5 text-center">
                    <h2 className="font-bold text-foreground text-lg mb-1 line-clamp-1">{heroProduct.name_ar}</h2>
                    <p className="text-primary font-black text-xl">
                      {Number(heroProduct.price).toLocaleString('ar-IQ')} <span className="text-sm font-medium text-muted-foreground">د.ع</span>
                    </p>
                  </div>
                </div>
              </Link>
            ) : (
              <div className="w-72 h-72 rounded-3xl bg-card/30 border border-border/20 animate-pulse" />
            )}
          </div>
        </div>
      </div>
    </section>
  );
};

export default HeroSection;
