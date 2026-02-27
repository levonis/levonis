import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, Package } from 'lucide-react';
import { CartItem } from '@/hooks/useCart';

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
  // Get the first item for common product info
  const firstItem = items[0];
  const product = firstItem.products;
  
  if (!product) return null;

  // Calculate total for all variants
  const calculateItemPrice = (item: CartItem) => {
    const isDirect = (item as any).sale_type === 'direct';
    const itemOption = (item as any).product_options;
    const itemColor = (item as any).selected_color;
    const colorData = itemColor && product.colors
      ? (product.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
      : null;
    
    let itemPrice = Number(product.price);
    
    if (isDirect && (product as any).direct_sale_price != null) {
      itemPrice = Number((product as any).direct_sale_price);
    } else if (!isDirect) {
      const shippingType = (item as any).shipping_type;
      if (shippingType === 'sea' && (product as any).sea_price != null) {
        itemPrice = Number((product as any).sea_price);
      } else if (shippingType === 'air' && (product as any).air_price != null) {
        itemPrice = Number((product as any).air_price);
      }
    }
    
    if (colorData) {
      if (isDirect && colorData.direct_sale_price != null) {
        itemPrice = Number(colorData.direct_sale_price);
      } else if (colorData.price != null) {
        itemPrice = Number(colorData.price);
      }
    }
    
    if (itemOption?.price_adjustment) {
      itemPrice += Number(itemOption.price_adjustment);
    }

    const shippingIndex = (item as any).shipping_option_index;
    const shippingOptions = product.pre_order_shipping_options;
    if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
      const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
      itemPrice += shippingAdjustment;
    }
    
    return itemPrice;
  };

  const groupTotal = items.reduce((sum, item) => {
    return sum + calculateItemPrice(item) * item.quantity;
  }, 0);

  const totalQuantity = items.reduce((sum, item) => sum + item.quantity, 0);

  // Get display image
  const displayImage = (items[0] as any).option_image_url || 
    (items[0] as any).color_image_url || 
    (product.images && product.images[0]) || 
    product.image_url;

  // Get common option and color (should be same for grouped items)
  const itemOption = (firstItem as any).product_options;
  const itemColor = (firstItem as any).selected_color;
  const colorData = itemColor && product.colors
    ? (product.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
    : null;

  return (
    <div className="glass-effect rounded-2xl p-4 border border-border/50 group hover:border-primary/30 transition-all">
      <div className="flex flex-col sm:flex-row gap-4">
        {/* Product Image */}
        {displayImage && (
          <Link 
            to={`/product/${product.slug}`}
            className="flex-shrink-0 mx-auto sm:mx-0"
          >
            <img 
              src={displayImage}
              alt={product.name_ar || ''}
              className="w-32 h-32 sm:w-24 sm:h-24 object-cover rounded-xl border border-border/40 hover:border-primary/50 transition-colors"
            />
          </Link>
        )}
        
        {/* Product Info */}
        <div className="flex-1 flex flex-col gap-3">
          <div className="text-center sm:text-right">
            <Link 
              to={`/product/${product.slug}`}
              className="font-bold text-base text-foreground mb-1 inline-flex items-center gap-2 hover:text-primary transition-colors"
            >
              {product.name_ar}
            </Link>
            
            {/* Common option and color */}
            {(itemOption || colorData) && (
              <div className="text-sm text-muted-foreground mb-2 space-y-1">
                {itemOption && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-medium">الخيار:</span>
                    <span>{itemOption.name_ar}</span>
                  </div>
                )}
                {colorData && (
                  <div className="flex items-center justify-center sm:justify-start gap-2">
                    <span className="font-medium">اللون:</span>
                    <div className="flex items-center gap-1.5">
                      <div 
                        className="w-4 h-4 rounded-full border border-border"
                        style={{ backgroundColor: colorData.hex_code }}
                      />
                      <span>{colorData.name_ar}</span>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Shipping Variants */}
          <div className="space-y-3 border-t border-border/20 pt-3">
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Package className="h-4 w-4" />
              <span>خيارات الشحن ({items.length})</span>
            </div>
            
            {items.map((item) => {
              const shippingName = (item as any).shipping_option_name_ar || 'شحن افتراضي';
              const itemPrice = calculateItemPrice(item);
              
              return (
                <div 
                  key={item.id}
                  className="bg-background/30 rounded-lg p-3 border border-border/30"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                    <span className="text-sm font-medium text-foreground">
                      {shippingName}
                    </span>
                    <span className="text-sm font-bold text-primary">
                      {formatPrice(itemPrice)} دينار عراقي
                    </span>
                  </div>
                  
                  <div className="flex items-center justify-between gap-2">
                    {/* Quantity Controls */}
                    <div className="flex items-center gap-2 bg-background/50 rounded-lg p-1 border border-border/40">
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 touch-manipulation"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateQuantity(item.id, item.quantity - 1);
                        }}
                        disabled={item.quantity <= 1}
                        aria-label="تقليل الكمية"
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      
                      <span className="w-8 text-center font-bold text-sm" aria-live="polite">
                        {item.quantity}
                      </span>
                      
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 touch-manipulation"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          updateQuantity(item.id, item.quantity + 1);
                        }}
                        aria-label="زيادة الكمية"
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>

                    <div className="flex items-center gap-2">
                      <span className="text-sm text-muted-foreground">
                        {formatPrice(itemPrice * item.quantity)} دينار
                      </span>
                      
                      <Button
                        type="button"
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 w-8 touch-manipulation"
                        onClick={(e) => {
                          e.preventDefault();
                          e.stopPropagation();
                          removeFromCart(item.id);
                        }}
                        aria-label="حذف"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          {/* Group Total */}
          <div className="flex items-center justify-between pt-3 border-t border-border/20">
            <div className="text-sm text-muted-foreground">
              إجمالي المنتج ({totalQuantity} قطع)
            </div>
            <div className="text-lg font-black text-primary">
              {formatPrice(groupTotal)} دينار عراقي
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GroupedCartItem;
