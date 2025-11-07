import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, Heart, ShoppingCart, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';

interface FavoriteProduct {
  id: string;
  product_id: string;
  products: {
    id: string;
    name_ar: string;
    slug: string;
    price: number;
    currency: string;
    image_url: string | null;
    images: string[] | null;
    in_stock: boolean;
  };
}

const Favorites = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const { addToCart } = useCart();
  const [loading, setLoading] = useState(true);
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);

  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
      return;
    }

    if (user) {
      fetchFavorites();
    }
  }, [user, authLoading, navigate]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`
          id,
          product_id,
          products (
            id,
            name_ar,
            slug,
            price,
            currency,
            image_url,
            images,
            in_stock
          )
        `)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error('حدث خطأ في تحميل المفضلة');
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase
        .from('favorites')
        .delete()
        .eq('id', favoriteId);

      if (error) throw error;

      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      toast.success('تم حذف المنتج من المفضلة');
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error('حدث خطأ في حذف المنتج');
    }
  };

  const handleAddToCart = (productId: string) => {
    addToCart(productId);
    toast.success('تم إضافة المنتج إلى السلة');
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Full page decorative border with animations */}
      <div 
        className="fixed top-0 left-0 right-0 bottom-0 pointer-events-none z-0 animate-float-decoration"
        style={{
          backgroundImage: 'url(/images/decorative-border-new.png)',
          backgroundSize: 'cover',
          backgroundPosition: 'top center',
          backgroundRepeat: 'no-repeat',
        }}
      />
      
      <div className="fixed top-20 right-20 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>

      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
            <Heart className="h-8 w-8" />
            المفضلة
          </h1>
          <p className="text-muted-foreground">منتجاتك المفضلة في مكان واحد</p>
        </div>

        {favorites.length === 0 ? (
          <Card className="glass-effect border-border/50">
            <CardContent className="flex flex-col items-center justify-center py-16">
              <Heart className="h-16 w-16 text-muted-foreground/30 mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">لا توجد منتجات مفضلة</h3>
              <p className="text-muted-foreground mb-6">ابدأ بإضافة منتجات لمفضلتك</p>
              <Button onClick={() => navigate('/')}>
                تصفح المنتجات
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {favorites.map((favorite) => {
              const product = favorite.products;
              const productImage = product.images?.[0] || product.image_url;
              const currency = product.currency || 'دينار عراقي';

              return (
                <Card key={favorite.id} className="glass-effect border-border/50 overflow-hidden group">
                  <div className="relative aspect-square bg-card/50">
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={product.name_ar}
                        className="w-full h-full object-cover cursor-pointer"
                        onClick={() => navigate(`/product/${product.slug}`)}
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Heart className="w-16 h-16 text-muted-foreground/30" />
                      </div>
                    )}
                    <Button
                      size="icon"
                      variant="destructive"
                      className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleRemoveFavorite(favorite.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <CardContent className="p-4">
                    <h3
                      className="font-bold text-foreground mb-2 line-clamp-2 cursor-pointer hover:text-primary transition-colors"
                      onClick={() => navigate(`/product/${product.slug}`)}
                    >
                      {product.name_ar}
                    </h3>
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-2xl font-black text-primary">
                        {formatPrice(Number(product.price))}
                      </span>
                      <span className="text-sm text-muted-foreground">{currency}</span>
                    </div>
                    <Button
                      className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={!product.in_stock}
                    >
                      <ShoppingCart className="ml-2 h-4 w-4" />
                      {product.in_stock ? 'أضف للسلة' : 'غير متوفر'}
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Favorites;
