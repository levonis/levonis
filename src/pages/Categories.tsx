import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CategoryCard from '@/components/CategoryCard';
import { Loader2 } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';
import { useMemo } from 'react';

const Categories = () => {
  const { t } = useLanguage();
  const { data: categories, isLoading } = useQuery({
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

  // Check which categories have products with available direct sale stock
  const categoryIds = useMemo(() => categories?.map(c => c.id) || [], [categories]);
  const { data: directSaleCategories } = useQuery({
    queryKey: ['categories-direct-sale', categoryIds],
    enabled: categoryIds.length > 0,
    queryFn: async () => {
      // Get products that have direct sale AND stock > 0
      const { data, error } = await supabase
        .from('products')
        .select('category_id, has_in_stock, direct_stock')
        .eq('has_in_stock', true)
        .in('category_id', categoryIds);
      
      if (error) throw error;
      
      // Build set of category IDs that have at least one product with available direct stock
      const availableCategories = new Set<string>();
      for (const p of (data || [])) {
        // If direct_stock is null (unlimited) or > 0, it's available
        if (p.category_id && (p.direct_stock == null || Number(p.direct_stock) > 0)) {
          availableCategories.add(p.category_id);
        }
      }
      return availableCategories;
    },
    staleTime: 60_000,
  });

  return (
    <div className="min-h-screen bg-transparent relative">
      <div className="fixed inset-0 pointer-events-none z-0 bg-gradient-to-b from-primary/5 via-transparent to-accent/5" />
      <main className="container mx-auto px-4 py-8 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">{t('category_all')}</h1>
          <p className="text-muted-foreground">{t('category_browse_desc')}</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2.5 sm:gap-3">
            {categories?.map((category) => (
              <CategoryCard
                key={category.id}
                name={category.name}
                nameAr={category.name_ar}
                slug={category.slug}
                icon={category.icon}
                description={category.description}
                descriptionAr={category.description_ar}
                hasDirectSale={directSaleCategories?.has(category.id) ?? false}
              />
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default Categories;
