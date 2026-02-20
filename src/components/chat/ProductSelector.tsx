import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Search, Package, Loader2, Plus } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface MerchantProduct {
  id: string;
  title: string;
  price_iqd: number;
  image_urls: string[] | null;
  primary_image_index: number | null;
  is_active: boolean;
}

interface SiteProduct {
  id: string;
  name_ar: string;
  price: number;
  image_url: string | null;
}

export type SelectedProduct = {
  id: string;
  title: string;
  price: number;
  imageUrl: string | null;
};

interface ProductSelectorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId?: string;
  /** If true, fetch site products (products table) instead of merchant_products */
  useSiteProducts?: boolean;
  onSelectProduct: (product: SelectedProduct) => void;
  onCreateCustomOrder?: () => void;
}

export default function ProductSelector({
  open,
  onOpenChange,
  merchantId,
  useSiteProducts = false,
  onSelectProduct,
  onCreateCustomOrder,
}: ProductSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch merchant products
  const { data: merchantProducts = [], isLoading: loadingMerchant } = useQuery({
    queryKey: ['merchant-products-selector', merchantId],
    enabled: !useSiteProducts && !!merchantId && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_products')
        .select('id, title, price_iqd, image_urls, primary_image_index, is_active')
        .eq('merchant_id', merchantId!)
        .eq('is_active', true)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return (data || []) as unknown as MerchantProduct[];
    },
  });

  // Fetch site products
  const { data: siteProducts = [], isLoading: loadingSite } = useQuery({
    queryKey: ['site-products-selector', searchQuery],
    enabled: useSiteProducts && open,
    queryFn: async () => {
      let query = supabase
        .from('products')
        .select('id, name_ar, price, image_url')
        .eq('in_stock', true)
        .order('created_at', { ascending: false })
        .limit(50);

      if (searchQuery.trim()) {
        query = query.ilike('name_ar', `%${searchQuery}%`);
      }

      const { data, error } = await query;
      if (error) throw error;
      return (data || []) as SiteProduct[];
    },
  });

  const isLoading = useSiteProducts ? loadingSite : loadingMerchant;

  // Normalize products to a common shape
  const normalizedProducts: SelectedProduct[] = useSiteProducts
    ? siteProducts.map((p) => ({
        id: p.id,
        title: p.name_ar,
        price: p.price,
        imageUrl: p.image_url,
      }))
    : merchantProducts.map((p) => {
        const primaryIndex = p.primary_image_index || 0;
        return {
          id: p.id,
          title: p.title,
          price: p.price_iqd,
          imageUrl: p.image_urls?.[primaryIndex] || p.image_urls?.[0] || null,
        };
      });

  // Filter products by search (merchant products filtered client-side)
  const filteredProducts = useSiteProducts
    ? normalizedProducts
    : normalizedProducts.filter((p) =>
        p.title.toLowerCase().includes(searchQuery.toLowerCase())
      );

  const handleSelect = (product: SelectedProduct) => {
    onSelectProduct(product);
    onOpenChange(false);
    setSearchQuery('');
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[80vh] flex flex-col">
        <DialogHeader className="p-4 pb-0 shrink-0">
          <div className="flex items-center justify-between gap-2">
            <DialogTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {useSiteProducts ? 'اختر منتج من المتجر' : 'اختر منتج للإرسال'}
            </DialogTitle>
            {onCreateCustomOrder && (
              <Button
                size="sm"
                variant="outline"
                className="h-8 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                onClick={() => {
                  onOpenChange(false);
                  onCreateCustomOrder();
                }}
              >
                <Plus className="h-3.5 w-3.5" />
                إنشاء طلب
              </Button>
            )}
          </div>
        </DialogHeader>

        {/* Search */}
        <div className="p-4 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="ابحث عن منتج..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pr-10"
            />
          </div>
        </div>

        {/* Products List */}
        <ScrollArea className="flex-1 min-h-0">
          <div className="p-4 pt-2 space-y-2">
            {isLoading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package className="h-10 w-10 text-muted-foreground/30 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? 'لا توجد نتائج' : 'لا توجد منتجات'}
                </p>
              </div>
            ) : (
              filteredProducts.map((product) => (
                <button
                  key={product.id}
                  onClick={() => handleSelect(product)}
                  className="w-full flex items-center gap-3 p-3 rounded-xl border border-border bg-card hover:bg-muted/50 hover:border-primary/30 transition-all"
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.title}
                      className="h-14 w-14 rounded-lg object-cover bg-muted"
                    />
                  ) : (
                    <div className="h-14 w-14 rounded-lg bg-muted flex items-center justify-center">
                      <Package className="h-5 w-5 text-muted-foreground/40" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0 text-right">
                    <h4 className="font-semibold text-sm truncate">{product.title}</h4>
                    <p className="text-primary font-bold text-sm">
                      {product.price.toLocaleString()} د.ع
                    </p>
                  </div>
                </button>
              ))
            )}
          </div>
        </ScrollArea>

        {/* Cancel */}
        <div className="p-4 pt-2 shrink-0 border-t">
          <Button
            variant="outline"
            className="w-full"
            onClick={() => onOpenChange(false)}
          >
            إلغاء
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
