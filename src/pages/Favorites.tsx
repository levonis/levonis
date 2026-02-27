import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Trash2, ArrowRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useCart } from '@/hooks/useCart';
import { useLanguage } from '@/lib/i18n';
import { Skeleton } from '@/components/ui/skeleton';

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

const FavoriteSkeleton = () => (
  <div className="space-y-2">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="flex gap-3 p-3 rounded-2xl border bg-card">
        <Skeleton className="w-20 h-20 rounded-xl shrink-0" />
        <div className="flex-1 space-y-2 py-1">
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-5 w-24" />
        </div>
        <div className="flex flex-col gap-1.5 py-1">
          <Skeleton className="h-8 w-8 rounded-lg" />
          <Skeleton className="h-8 w-8 rounded-lg" />
        </div>
      </div>
    ))}
  </div>
);

const Favorites = () => {
  const { t } = useLanguage();
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
    if (user) fetchFavorites();
  }, [user, authLoading, navigate]);

  const fetchFavorites = async () => {
    try {
      const { data, error } = await supabase
        .from('favorites')
        .select(`id, product_id, products (id, name_ar, slug, price, currency, image_url, images, in_stock)`)
        .eq('user_id', user?.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFavorites(data || []);
    } catch (error) {
      console.error('Error fetching favorites:', error);
      toast.error(t('favorites_error'));
    } finally {
      setLoading(false);
    }
  };

  const handleRemoveFavorite = async (favoriteId: string) => {
    try {
      const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
      if (error) throw error;
      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      toast.success(t('favorites_removed'));
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error(t('favorites_remove_error'));
    }
  };

  const handleAddToCart = (productId: string) => {
    addToCart(productId);
    toast.success(t('favorites_cart_added'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Heart className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">{t('favorites_title')}</h1>
            {!loading && (
              <span className="text-xs text-muted-foreground">({favorites.length})</span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-3 py-3">
        {authLoading || loading ? (
          <FavoriteSkeleton />
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Heart className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-bold text-foreground mb-1">{t('favorites_empty')}</h3>
            <p className="text-sm text-muted-foreground mb-4">{t('favorites_empty_desc')}</p>
            <Button size="sm" onClick={() => navigate('/')}>
              <Package className="h-4 w-4 ml-1.5" />
              {t('common_browse_products')}
            </Button>
          </div>
        ) : (
          <div className="space-y-2">
            {favorites.map((favorite) => {
              const product = favorite.products;
              const productImage = product.images?.[0] || product.image_url;
              const currency = product.currency || t('common_iqd');

              return (
                <div
                  key={favorite.id}
                  className="flex gap-3 p-3 rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all active:scale-[0.99] overflow-hidden"
                >
                  {/* Image */}
                  <div
                    className="w-20 h-20 rounded-xl overflow-hidden bg-muted shrink-0 cursor-pointer"
                    onClick={() => navigate(`/product/${product.slug}`)}
                  >
                    {productImage ? (
                      <img
                        src={productImage}
                        alt={product.name_ar}
                        className="w-full h-full object-cover"
                        loading="lazy"
                        decoding="async"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Heart className="w-6 h-6 text-muted-foreground/30" />
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div
                    className="flex-1 min-w-0 cursor-pointer py-0.5"
                    onClick={() => navigate(`/product/${product.slug}`)}
                  >
                    <p className="text-sm font-medium text-foreground line-clamp-2 mb-1.5 leading-snug">
                      {product.name_ar}
                    </p>
                    <div className="flex items-baseline gap-1.5">
                      <span className="text-base font-black text-primary">{formatPrice(Number(product.price))}</span>
                      <span className="text-[10px] text-muted-foreground">{currency}</span>
                    </div>
                    {!product.in_stock && (
                      <span className="text-[10px] text-destructive font-medium">{t('product_out_of_stock')}</span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex flex-col gap-1.5 shrink-0 justify-center">
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-primary hover:bg-primary/10"
                      onClick={() => handleAddToCart(product.id)}
                      disabled={!product.in_stock}
                    >
                      <ShoppingCart className="h-4 w-4" />
                    </Button>
                    <Button
                      size="icon"
                      variant="ghost"
                      className="h-8 w-8 text-destructive hover:bg-destructive/10"
                      onClick={() => handleRemoveFavorite(favorite.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default Favorites;
