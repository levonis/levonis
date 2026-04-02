import { useState } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, Package, Gift } from 'lucide-react';
import { CartItem } from '@/hooks/useCart';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import AnimatedQuantity from '@/components/ui/AnimatedQuantity';
import { getGuardedCartItemPrice } from '@/lib/priceGuard';
import { useShippingSettings } from '@/hooks/useShippingCalculator';

interface GroupedCartItemProps {
  productId: string;
  items: CartItem[];
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  formatPrice: (price: number) => string;
}

const GroupedCartItem = ({ 
  productId, 
  items, 
  updateQuantity, 
  removeFromCart, 
  formatPrice 
}: GroupedCartItemProps) => {
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const firstItem = items[0];
  const product = firstItem.products;
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1300;
  
  if (!product) return null;

  const calculateItemPrice = (item: CartItem) => {
    return getGuardedCartItemPrice(item as any, usdToIqd);
  };

  const groupTotal = items.reduce((sum, item) => sum + calculateItemPrice(item) * item.quantity, 0);
  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  const displayImage = (items[0] as any).option_image_url || 
    (items[0] as any).color_image_url || 
    (product.images && product.images[0]) || 
    product.image_url;

  const itemOption = (firstItem as any).product_options;
  const itemColor = (firstItem as any).selected_color;
  const colorData = itemColor && product.colors
    ? (product.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
    : null;

  const handleRemove = (itemId: string) => {
    setRemovingIds(prev => new Set(prev).add(itemId));
    setTimeout(() => removeFromCart(itemId), 300);
  };

  return (
    <div className="rounded-xl p-2.5 sm:p-4 border border-border/50 bg-card hover:border-primary/30 transition-all w-full max-w-full overflow-hidden">
      <div className="flex gap-2.5 sm:gap-4 w-full min-w-0">
        {/* Product Image */}
        {displayImage && (
          <Link to={`/product/${product.slug}`} className="flex-shrink-0">
            <img 
              src={displayImage}
              alt={product.name_ar || ''}
              className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-border/40"
            />
          </Link>
        )}
        
        {/* Product Info */}
        <div className="flex-1 min-w-0">
          <Link 
            to={`/product/${product.slug}`}
            className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block"
          >
            {product.name_ar}
          </Link>
          
          {/* Option/Color tags */}
          {(itemOption || colorData) && (
            <div className="flex flex-wrap gap-1 mt-0.5">
               {itemOption && (
                <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded">{itemOption.name_ar}</span>
              )}
              {colorData && (
                <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                  <span className="w-2.5 h-2.5 rounded-full border border-border/50 inline-block" style={{ backgroundColor: colorData.hex_code }} />
                  {colorData.name_ar}
                </span>
              )}
            </div>
          )}

          {/* Shipping Variants */}
          <div className="mt-2 space-y-1.5">
            <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
              <Package className="h-3 w-3" />
              <span>خيارات الشحن ({items.length})</span>
            </div>
            
            {items.map((item) => {
              const shippingName = (item as any).shipping_option_name_ar || 'شحن افتراضي';
              const isGift = !!(item as any).is_gift;
              const isLocked = !!(item as any).is_locked;
              const itemPrice = isGift ? 0 : calculateItemPrice(item);
              const isRemoving = removingIds.has(item.id);
              
              return (
                <div 
                  key={item.id} 
                  className={`bg-card rounded-lg p-2 border transition-all duration-300 max-w-full overflow-hidden ${
                    isGift ? 'border-primary/40 bg-primary/5' : 'border-border/30'
                  } ${
                    isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !m-0 overflow-hidden' : 'opacity-100 scale-100 translate-x-0 max-h-40'
                  }`}
                >
                  {isGift && (
                    <div className="flex items-center gap-1 mb-1">
                      <Gift className="h-3 w-3 text-primary" />
                      <span className="text-[10px] font-bold text-primary">🎁 هدية مجانية</span>
                    </div>
                  )}
                  <div className="flex items-center justify-between gap-1 mb-1">
                    <span className="text-[11px] font-medium text-foreground line-clamp-1">{shippingName}</span>
                    {isGift ? (
                      <span className="text-[11px] font-bold text-primary shrink-0">مجاناً</span>
                    ) : (
                      <>
                        <AnimatedPrice 
                          value={itemPrice} 
                          formatFn={formatPrice} 
                          className="text-[11px] font-bold text-primary shrink-0"
                        />
                        <span className="text-[11px] font-bold text-primary shrink-0">د.ع</span>
                      </>
                    )}
                  </div>
                  
                  <div className="flex items-center justify-between">
                    {!isLocked ? (
                      <div className="flex items-center gap-1 bg-background rounded border border-border/40">
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 touch-manipulation active:scale-90 transition-transform"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(item.id, item.quantity - 1); }}
                          disabled={item.quantity <= 1}>
                          <Minus className="h-2.5 w-2.5" />
                        </Button>
                        <AnimatedQuantity value={item.quantity} className="w-5 text-center font-bold text-[11px]" />
                        <Button type="button" size="icon" variant="ghost" className="h-6 w-6 touch-manipulation active:scale-90 transition-transform"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(item.id, item.quantity + 1); }}>
                          <Plus className="h-2.5 w-2.5" />
                        </Button>
                      </div>
                    ) : (
                      <div className="text-[10px] text-muted-foreground">الكمية: {item.quantity}</div>
                    )}

                    <div className="flex items-center gap-1.5">
                      {!isGift && item.quantity > 1 && (
                        <span className="text-[10px] text-muted-foreground transition-all duration-300">
                          <AnimatedPrice value={itemPrice * item.quantity} formatFn={formatPrice} /> د.ع
                        </span>
                      )}
                      {!isLocked && (
                        <Button type="button" size="icon" variant="ghost"
                          className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 touch-manipulation active:scale-75 transition-transform"
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); handleRemove(item.id); }}>
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Group Total */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/20">
            <span className="text-[11px] text-muted-foreground">إجمالي ({totalQuantity} قطع)</span>
            <span className="text-sm font-black text-primary">
              <AnimatedPrice value={groupTotal} formatFn={formatPrice} /> د.ع
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupedCartItem;
