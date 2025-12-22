import { useState, useMemo } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Search, Package, X } from 'lucide-react';
import OptimizedImage from './OptimizedImage';

interface Product {
  id: string;
  name_ar: string;
  image_url: string | null;
  price: number;
}

interface ProductSearchSelectProps {
  products: Product[];
  value: string;
  onChange: (productId: string) => void;
  placeholder?: string;
}

export default function ProductSearchSelect({
  products,
  value,
  onChange,
  placeholder = "ابحث واختر منتج..."
}: ProductSearchSelectProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  const selectedProduct = useMemo(() => {
    return products.find(p => p.id === value);
  }, [products, value]);

  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) return products.slice(0, 10);
    const query = searchQuery.toLowerCase();
    return products.filter(p => 
      p.name_ar.toLowerCase().includes(query)
    ).slice(0, 20);
  }, [products, searchQuery]);

  const handleSelect = (productId: string) => {
    onChange(productId);
    setIsOpen(false);
    setSearchQuery('');
  };

  const handleClear = () => {
    onChange('');
    setSearchQuery('');
  };

  return (
    <div className="relative">
      {selectedProduct ? (
        <div className="flex items-center gap-2 p-2 border rounded-lg bg-muted/50">
          {selectedProduct.image_url && (
            <OptimizedImage 
              src={selectedProduct.image_url} 
              alt={selectedProduct.name_ar} 
              className="w-8 h-8 rounded object-cover"
            />
          )}
          <span className="flex-1 text-sm truncate">{selectedProduct.name_ar}</span>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            onClick={handleClear}
          >
            <X className="h-3 w-3" />
          </Button>
        </div>
      ) : (
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder={placeholder}
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setIsOpen(true);
            }}
            onFocus={() => setIsOpen(true)}
            className="pr-10"
          />
        </div>
      )}
      
      {isOpen && !selectedProduct && (
        <div className="absolute z-50 w-full mt-1 bg-background border rounded-lg shadow-lg">
          <ScrollArea className="h-[200px]">
            <div className="p-2 space-y-1">
              <button
                type="button"
                className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-right text-muted-foreground"
                onClick={() => {
                  onChange('');
                  setIsOpen(false);
                }}
              >
                بدون منتج
              </button>
              {filteredProducts.map(product => (
                <button
                  key={product.id}
                  type="button"
                  className="w-full flex items-center gap-2 p-2 rounded-lg hover:bg-muted transition-colors text-right"
                  onClick={() => handleSelect(product.id)}
                >
                  {product.image_url ? (
                    <OptimizedImage 
                      src={product.image_url} 
                      alt={product.name_ar} 
                      className="w-8 h-8 rounded object-cover"
                    />
                  ) : (
                    <div className="w-8 h-8 rounded bg-muted flex items-center justify-center">
                      <Package className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate">{product.name_ar}</p>
                  </div>
                </button>
              ))}
              {filteredProducts.length === 0 && searchQuery && (
                <p className="text-sm text-muted-foreground text-center py-4">
                  لا توجد منتجات مطابقة
                </p>
              )}
            </div>
          </ScrollArea>
        </div>
      )}
      
      {isOpen && (
        <div 
          className="fixed inset-0 z-40" 
          onClick={() => setIsOpen(false)}
        />
      )}
    </div>
  );
}
