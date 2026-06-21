import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Minus, Plus, Trash2, Package, Gift, ShieldCheck, Info } from 'lucide-react';
import { CartItem } from '@/hooks/useCart';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import AnimatedQuantity from '@/components/ui/AnimatedQuantity';
import { getGuardedCartItemPrice, fetchLiveDirectSalePrices } from '@/lib/priceGuard';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { useCodDefaults } from '@/hooks/useCodDefaults';
import { useCartInsuranceAddons, useInsurancePlans } from '@/hooks/useCartInsurance';
import InsuranceInfoDialog from '@/components/insurance/InsuranceInfoDialog';
import AddInsuranceDialog from '@/components/insurance/AddInsuranceDialog';
import { useLanguage } from '@/lib/i18n';
import { getColorSwatchStyle } from "@/lib/colorSwatch";

interface GroupedCartItemProps {
  productId: string;
  items: CartItem[];
  updateQuantity: (id: string, quantity: number) => void;
  removeFromCart: (id: string) => void;
  formatPrice: (price: number) => string;
  outOfStockItemIds?: Set<string>;
  lowStockItems?: Map<string, number>;
}

const GroupedCartItem = ({ 
  productId, 
  items, 
  updateQuantity, 
  removeFromCart, 
  formatPrice,
  outOfStockItemIds = new Set(),
  lowStockItems = new Map(),
}: GroupedCartItemProps) => {
  const { t } = useLanguage();
  const [removingIds, setRemovingIds] = useState<Set<string>>(new Set());
  const [infoOpen, setInfoOpen] = useState(false);
  const [addOpenFor, setAddOpenFor] = useState<string | null>(null);
  const firstItem = items[0];
  const product = firstItem.products;
  const { data: shippingSettings } = useShippingSettings();
  const { data: codDefaults } = useCodDefaults();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1540;
  const { byCartItemId, removeInsurance, isRemoving: isRemovingInsurance } = useCartInsuranceAddons();
  const productCategoryId = (product as any)?.category_id || null;
  const { data: insurancePlans = [] } = useInsurancePlans(productCategoryId);
  const insuranceEligible = insurancePlans.length > 0;

  // Server-computed live direct-sale price for COD-linked products.
  // Without it, getGuardedCartItemPrice falls back to the stored direct_sale_price
  // and undercharges vs the product card / detail page.
  const [liveDirectMap, setLiveDirectMap] = useState<Map<string, number> | null>(null);
  const linkedProductId = product?.id;
  const needsLive = !!(product as any)?.link_direct_commission_to_cod && items.some((i: any) => i.sale_type === 'direct');
  useEffect(() => {
    if (!needsLive || !linkedProductId) return;
    let cancelled = false;
    fetchLiveDirectSalePrices([linkedProductId!]).then((map) => {
      if (!cancelled) setLiveDirectMap(map);
    });
    return () => { cancelled = true; };
  }, [needsLive, linkedProductId, usdToIqd, codDefaults?.value, codDefaults?.type]);

  if (!product) return null;

  const calculateItemPrice = (item: CartItem) => {
    return getGuardedCartItemPrice(item as any, usdToIqd, codDefaults ?? null, liveDirectMap);
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
                  <span className="w-2.5 h-2.5 rounded-full border border-border/50 inline-block" style={getColorSwatchStyle(colorData.hex_code)} />
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
              const shippingName = item.shipping_option_name_ar || 'شحن افتراضي';
              const isGift = !!item.is_gift;
              const isLocked = !!item.is_locked;
              const itemPrice = isGift ? 0 : calculateItemPrice(item);
              const isRemoving = removingIds.has(item.id);
              const isItemOOS = outOfStockItemIds.has(item.id);
              const itemLowStock = lowStockItems.get(item.id);
              
              return (
                <div 
                  key={item.id} 
                  className={`bg-card rounded-lg p-2 border transition-all duration-300 max-w-full overflow-hidden ${
                    isItemOOS ? 'border-destructive/40 bg-destructive/5 opacity-70' :
                    isGift ? 'border-primary/40 bg-primary/5' : 'border-border/30'
                  } ${
                    isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !m-0 overflow-hidden' : 'opacity-100 scale-100 translate-x-0 max-h-40'
                  }`}
                >
                  {isItemOOS && (
                    <div className="flex items-center justify-between gap-1 mb-1 p-1 rounded bg-destructive/10">
                      <span className="text-[10px] font-bold text-destructive">⚠️ انتهى من المخزون</span>
                      <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => handleRemove(item.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  )}
                  {itemLowStock !== undefined && (
                    <div className="mb-1 p-1 rounded bg-amber-500/10">
                      <span className="text-[10px] font-bold text-amber-600">⚠️ الكمية المتاحة: {itemLowStock} فقط</span>
                    </div>
                  )}
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
                          onClick={(e) => { e.preventDefault(); e.stopPropagation(); updateQuantity(item.id, item.quantity + 1); }}
                          disabled={item.quantity >= 50}>
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

          {/* Extra Insurance Add-on (per shipping variant when eligible) */}
          {insuranceEligible && items.map((item) => {
            if (item.is_gift) return null;
            const addon = byCartItemId.get(item.id);
            const itemBasePrice = calculateItemPrice(item);
            return (
              <div key={`ins-${item.id}`} className="mt-2">
                {addon ? (
                  <div className="rounded-lg border border-primary/40 bg-primary/5 p-2 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1.5 min-w-0">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                      <span className="text-[11px] font-bold text-primary truncate">
                        {t('insurance_line_label')} {addon.coverage_months} {t('insurance_month' as any)} × {item.quantity}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[11px] font-black text-primary">
                        {formatPrice(addon.price_iqd * item.quantity)} د.ع
                      </span>
                      <Button type="button" size="icon" variant="ghost" disabled={isRemovingInsurance}
                        className="text-destructive hover:bg-destructive/10 h-6 w-6"
                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeInsurance(item.id); }}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between gap-2 rounded-lg border border-dashed border-primary/30 bg-primary/5 p-2">
                    <button
                      type="button"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setAddOpenFor(item.id); }}
                      className="flex items-center gap-1.5 text-[11px] font-bold text-primary hover:underline"
                    >
                      <ShieldCheck className="h-3.5 w-3.5" />
                      {t('insurance_add_extra')}
                    </button>
                    <button
                      type="button"
                      aria-label="info"
                      onClick={(e) => { e.preventDefault(); e.stopPropagation(); setInfoOpen(true); }}
                      className="h-5 w-5 rounded-full bg-primary/20 text-primary flex items-center justify-center hover:bg-primary/30"
                    >
                      <Info className="h-3 w-3" />
                    </button>
                  </div>
                )}
                {addOpenFor === item.id && (
                  <AddInsuranceDialog
                    open={addOpenFor === item.id}
                    onOpenChange={(o) => !o && setAddOpenFor(null)}
                    cartItemId={item.id}
                    printerProductId={product.id}
                    printerCategoryId={productCategoryId}
                    printerPriceIqd={itemBasePrice}
                    printerNameAr={product.name_ar || ''}
                  />
                )}
              </div>
            );
          })}

          {/* Group Total */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-border/20">
            <span className="text-[11px] text-muted-foreground">إجمالي ({totalQuantity} قطع)</span>
            <span className="text-sm font-black text-primary">
              <AnimatedPrice value={groupTotal} formatFn={formatPrice} /> د.ع
            </span>
          </div>
        </div>
      </div>
      <InsuranceInfoDialog open={infoOpen} onOpenChange={setInfoOpen} />
    </div>
  );
};

export default GroupedCartItem;
