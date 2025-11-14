import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import CategoryCard from '@/components/CategoryCard';
import { Loader2 } from 'lucide-react';

const Categories = () => {
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

  return (
    <div className="min-h-screen bg-transparent">
      <main className="container mx-auto px-4 py-8 pt-28">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">جميع الأقسام</h1>
          <p className="text-muted-foreground">تصفح الأقسام المختلفة للمنتجات</p>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-4">
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
      </main>
    </div>
  );
};

export default Categories;