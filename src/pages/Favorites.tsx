import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Heart, ShoppingCart, Trash2, ArrowRight, Package } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice, cn } from '@/lib/utils';
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
  <div className="grid grid-cols-2 gap-2.5 px-3 py-3">
    {[1, 2, 3, 4].map(i => (
      <div key={i} className="rounded-2xl border bg-card overflow-hidden">
        <Skeleton className="aspect-square w-full" />
        <div className="p-2.5 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-5 w-2/3" />
        </div>
        <Skeleton className="h-9 w-full rounded-none" />
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
  const [removingId, setRemovingId] = useState<string | null>(null);

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
    setRemovingId(favoriteId);
    try {
      const { error } = await supabase.from('favorites').delete().eq('id', favoriteId);
      if (error) throw error;
      setFavorites(favorites.filter(fav => fav.id !== favoriteId));
      toast.success(t('favorites_removed'));
    } catch (error) {
      console.error('Error removing favorite:', error);
      toast.error(t('favorites_remove_error'));
    } finally {
      setRemovingId(null);
    }
  };

  const handleAddToCart = (e: React.MouseEvent, productId: string) => {
    e.stopPropagation();
    addToCart(productId);
    toast.success(t('favorites_cart_added'));
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border/30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-destructive/15 flex items-center justify-center">
                <Heart className="h-5 w-5 text-destructive fill-destructive" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground">{t('favorites_title')}</h1>
                {!loading && (
                  <p className="text-xs text-muted-foreground">{favorites.length} منتج</p>
                )}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate(-1)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-24">
        {authLoading || loading ? (
          <FavoriteSkeleton />
        ) : favorites.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-destructive/10 flex items-center justify-center mb-5">
              <Heart className="h-10 w-10 text-destructive/30" />
            </div>
            <h3 className="font-black text-foreground mb-1.5 text-lg">{t('favorites_empty')}</h3>
            <p className="text-sm text-muted-foreground mb-5">{t('favorites_empty_desc')}</p>
            <Button onClick={() => navigate('/')} className="rounded-xl">
              <Package className="h-4 w-4 ml-1.5" />
              {t('common_browse_products')}
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2.5 px-3 py-3">
            {favorites.map((favorite) => {
              const product = favorite.products;
              const productImage = product.images?.[0] || product.image_url;
              const currency = product.currency || t('common_iqd');
              const isRemoving = removingId === favorite.id;

              return (
                <div
                  key={favorite.id}
                  className={cn(
                    "rounded-2xl border border-border/40 bg-card overflow-hidden transition-all cursor-pointer hover:border-primary/20",
                    isRemoving && "opacity-50 scale-95"
                  )}
                  onClick={() => navigate(`/product/${product.slug}`)}
                >
                  {/* Image */}
                  <div className="relative aspect-square bg-muted overflow-hidden">
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
                        <Package className="w-8 h-8 text-muted-foreground/20" />
                      </div>
                    )}
                    {/* Heart button */}
                    <button
                      onClick={(e) => { e.stopPropagation(); handleRemoveFavorite(favorite.id); }}
                      className="absolute top-2 left-2 w-8 h-8 rounded-full bg-card/90 flex items-center justify-center transition-all hover:bg-destructive/20 active:scale-90"
                    >
                      <Heart className="h-4 w-4 text-destructive fill-destructive" />
                    </button>
                    {!product.in_stock && (
                      <div className="absolute bottom-0 inset-x-0 bg-background/80 text-center py-1">
                        <span className="text-[10px] font-bold text-destructive">{t('product_out_of_stock')}</span>
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2.5">
                    <p className="text-xs font-bold text-foreground line-clamp-2 mb-1.5 leading-snug min-h-[2.25rem]">
                      {product.name_ar}
                    </p>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-black text-primary">{formatPrice(Number(product.price))}</span>
                      <span className="text-[9px] text-muted-foreground">{currency}</span>
                    </div>
                  </div>

                  {/* Add to cart bar */}
                  <button
                    onClick={(e) => handleAddToCart(e, product.id)}
                    disabled={!product.in_stock}
                    className={cn(
                      "w-full flex items-center justify-center gap-1.5 py-2.5 text-xs font-bold transition-colors border-t border-border/30",
                      product.in_stock
                        ? "text-primary bg-primary/5 hover:bg-primary/10 active:bg-primary/15"
                        : "text-muted-foreground bg-muted/20 cursor-not-allowed"
                    )}
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    أضف للسلة
                  </button>
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
