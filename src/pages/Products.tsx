import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useSearchParams } from 'react-router-dom';
import Header from '@/components/Header';
import SearchBar from '@/components/SearchBar';
import ProductCard from '@/components/ProductCard';
import { Loader2 } from 'lucide-react';

const Products = () => {
  const [searchParams] = useSearchParams();
  const searchQuery = searchParams.get('search') || '';

  const { data: products, isLoading } = useQuery({
    queryKey: ['products', searchQuery],
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('*')
        .eq('in_stock', true)
        .order('created_at', { ascending: false });

      if (searchQuery) {
        query = query.or(`name_ar.ilike.%${searchQuery}%,description_ar.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query;
      
      if (error) throw error;
      return data;
    }
  });

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-0 left-1/3 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      <Header />
      
      <main className="container mx-auto px-4 py-8">
        <div className="mb-8">
          <SearchBar />
        </div>

        {searchQuery && (
          <div className="mb-6">
            <h2 className="text-2xl font-black text-primary">
              نتائج البحث عن: <span className="text-foreground">{searchQuery}</span>
            </h2>
            <p className="text-muted-foreground mt-1">
              {products?.length || 0} منتج
            </p>
          </div>
        )}

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
            {products.map((product) => (
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
        ) : (
          <div className="text-center py-12">
            <p className="text-muted-foreground">لم يتم العثور على منتجات</p>
          </div>
        )}
      </main>
    </div>
  );
};

export default Products;