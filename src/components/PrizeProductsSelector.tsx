import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Plus, X, Package, Eye } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

interface Product {
  id: string;
  name_ar: string;
  image_url: string | null;
  price: number;
}

interface PrizeProduct {
  product_id: string;
  quantity: number;
}

interface PrizeProductsSelectorProps {
  products: Product[];
  selectedProducts: PrizeProduct[];
  onChange: (products: PrizeProduct[]) => void;
  showViewLink?: boolean;
}

export default function PrizeProductsSelector({
  products,
  selectedProducts,
  onChange,
  showViewLink = false
}: PrizeProductsSelectorProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // Filter products based on search
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products;
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name_ar.toLowerCase().includes(query)
    );
  }, [products, searchQuery]);

  // Get selected product details
  const selectedProductDetails = useMemo(() => {
    return selectedProducts.map(sp => ({
      ...sp,
      product: products.find(p => p.id === sp.product_id)
    })).filter(sp => sp.product);
  }, [selectedProducts, products]);

  const addProduct = (productId: string) => {
    if (selectedProducts.some(p => p.product_id === productId)) {
      // Increase quantity if already selected
      onChange(selectedProducts.map(p => 
        p.product_id === productId 
          ? { ...p, quantity: p.quantity + 1 }
          : p
      ));
    } else {
      onChange([...selectedProducts, { product_id: productId, quantity: 1 }]);
    }
  };

  const removeProduct = (productId: string) => {
    onChange(selectedProducts.filter(p => p.product_id !== productId));
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity < 1) {
      removeProduct(productId);
      return;
    }
    onChange(selectedProducts.map(p => 
      p.product_id === productId ? { ...p, quantity } : p
    ));
  };

  return (
    <div className="space-y-3">
      {/* Selected Products */}
      {selectedProductDetails.length > 0 && (
        <div className="space-y-2">
          <p className="text-sm font-medium">المنتجات المختارة:</p>
          <div className="flex flex-wrap gap-2">
            {selectedProductDetails.map(({ product_id, quantity, product }) => (
              <Card key={product_id} className="flex items-center gap-2 p-2 pr-3">
                {product?.image_url && (
                  <OptimizedImage 
                    src={product.image_url} 
                    alt={product?.name_ar || ''} 
                    className="w-10 h-10 rounded object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">{product?.name_ar}</p>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => updateQuantity(product_id, quantity - 1)}
                    >
                      <span className="text-lg">-</span>
                    </Button>
                    <Badge variant="secondary" className="text-xs">
                      ×{quantity}
                    </Badge>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-5 w-5"
                      onClick={() => updateQuantity(product_id, quantity + 1)}
                    >
                      <span className="text-lg">+</span>
                    </Button>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  {showViewLink && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-6 w-6"
                      onClick={() => window.open(`/product/${product_id}`, '_blank')}
                    >
                      <Eye className="h-3 w-3" />
                    </Button>
                  )}
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    className="h-6 w-6 text-destructive"
                    onClick={() => removeProduct(product_id)}
                  >
                    <X className="h-3 w-3" />
                  </Button>
                </div>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Search and Add */}
      <div className="space-y-2">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="ابحث عن منتج..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pr-10"
          />
        </div>
        
        {searchQuery && filteredProducts.length > 0 && (
          <ScrollArea className="h-[200px] border rounded-lg">
            <div className="p-2 space-y-1">
              {filteredProducts.map(product => {
                const isSelected = selectedProducts.some(p => p.product_id === product.id);
                return (
                  <button
                    key={product.id}
                    type="button"
                    className={`w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-right ${
                      isSelected ? 'bg-primary/10 border border-primary/30' : ''
                    }`}
                    onClick={() => addProduct(product.id)}
                  >
                    {product.image_url ? (
                      <OptimizedImage 
                        src={product.image_url} 
                        alt={product.name_ar} 
                        className="w-10 h-10 rounded object-cover"
                      />
                    ) : (
                      <div className="w-10 h-10 rounded bg-muted flex items-center justify-center">
                        <Package className="h-4 w-4 text-muted-foreground" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{product.name_ar}</p>
                      <p className="text-xs text-muted-foreground">{product.price.toLocaleString()} دينار</p>
                    </div>
                    {isSelected ? (
                      <Badge variant="secondary" className="text-xs">مُضاف</Badge>
                    ) : (
                      <Plus className="h-4 w-4 text-muted-foreground" />
                    )}
                  </button>
                );
              })}
            </div>
          </ScrollArea>
        )}
        
        {searchQuery && filteredProducts.length === 0 && (
          <p className="text-sm text-muted-foreground text-center py-4">
            لا توجد منتجات مطابقة
          </p>
        )}
      </div>
    </div>
  );
}
