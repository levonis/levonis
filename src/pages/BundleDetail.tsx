import { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, ShoppingCart, AlertTriangle, Package, Plus, Minus, ChevronLeft, Sparkles } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { useLanguage } from '@/lib/i18n';
import { pickI18n } from '@/lib/i18nField';
import { usePageTitle } from '@/island/usePageTitle';

function DetailCountdownBanner({ endsAt }: { endsAt: string }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const diff = new Date(endsAt).getTime() - now;
  if (diff <= 0) {
    return (
      <div className="mt-3 p-3 rounded-2xl bg-destructive/10 backdrop-blur-xl border border-destructive/30 text-destructive text-sm font-bold text-center">
        انتهى وقت العرض
      </div>
    );
  }
  const totalSec = Math.floor(diff / 1000);
  const days = Math.floor(totalSec / 86400);
  const hours = Math.floor((totalSec % 86400) / 3600);
  const minutes = Math.floor((totalSec % 3600) / 60);
  const seconds = totalSec % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  return (
    <div className="mt-3 p-3 rounded-2xl bg-primary/10 backdrop-blur-xl border border-primary/30 flex items-center justify-between gap-2">
      <span className="text-xs font-bold text-foreground">ينتهي العرض خلال</span>
      <span dir="ltr" className="font-mono text-base font-black text-primary">
        {days > 0 ? `${days}:${pad(hours)}:${pad(minutes)}` : `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`}
      </span>
    </div>
  );
}


function getItemStock(product: any, colorName?: string, optionId?: string): number {
  const colors = Array.isArray(product?.colors) ? product.colors : [];
  if (colors.length === 0) {
    return product?.direct_stock != null ? Number(product.direct_stock) : 0;
  }
  if (!colorName) {
    let total = 0;
    for (const c of colors) {
      if (c?.available_for_direct_sale === false) continue;
      const stocks = c?.option_stocks;
      if (stocks && typeof stocks === 'object') {
        total += Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
      } else if (c?.stock_quantity != null) {
        total += Math.max(0, Number(c.stock_quantity));
      }
    }
    return total;
  }
  const color = colors.find((c: any) => c.color === colorName || c.name === colorName);
  if (!color) return 0;
  const stocks = color.option_stocks;
  if (stocks && typeof stocks === 'object') {
    if (optionId && stocks[optionId] != null) return Math.max(0, Number(stocks[optionId]));
    return Object.values(stocks).reduce<number>((s, v) => s + Math.max(0, Number(v)), 0);
  }
  return color.stock_quantity != null ? Math.max(0, Number(color.stock_quantity)) : 0;
}

const SALE_TYPE_LABELS: Record<string, string> = {
  'direct': 'بيع مباشر',
  'preorder-air': 'طلب مسبق (جوي)',
  'preorder-sea': 'طلب مسبق (بحري)',
};

const BundleDetail = () => {
  const { id } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { language } = useLanguage();
  const { addBundleToCart, cartSaleType, items: cartItems } = useCart();
  const navigate = useNavigate();
  const [isAdding, setIsAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);

  const { data: bundle, isLoading } = useQuery({
    queryKey: ['bundle-detail', id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_bundles')
        .select('*')
        .eq('id', id!)
        .eq('is_active', true)
        .single();
      if (error) throw error;

      const { data: items, error: itemsError } = await supabase
        .from('bundle_items')
        .select('*, products:product_id(id, slug, name_ar, image_url, images, direct_sale_price, price, colors, direct_stock)')
        .eq('bundle_id', id!);
      if (itemsError) throw itemsError;

      const saleType = data.sale_type || 'direct';
      const isDirect = saleType === 'direct';

      const isOutOfStock = isDirect && (items || []).some((item: any) => {
        const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
        return stock < item.quantity;
      });

      // Collect images
      const allImages: string[] = [];
      if (data.image_url) allImages.push(data.image_url);
      const storedImages = Array.isArray(data.images) ? data.images : [];
      for (const img of storedImages) {
        if (img && !allImages.includes(img)) allImages.push(img);
      }
      for (const item of (items || [])) {
        const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
        if (item.selected_color) {
          const colorObj = colors.find((c: any) => (c.color || c.name) === item.selected_color);
          const cImg = (colorObj as any)?.image_url || (colorObj as any)?.image;
          if (cImg && !allImages.includes(cImg)) allImages.push(cImg);
        }
      }

      // Calculate max quantity
      let maxQty = isDirect ? Infinity : 99;
      if (isDirect) {
        for (const item of (items || [])) {
          const stock = getItemStock(item.products, item.selected_color, item.selected_option_id);
          const perBundle = item.quantity || 1;
          maxQty = Math.min(maxQty, Math.floor(stock / perBundle));
        }
        if (maxQty === Infinity) maxQty = 0;
      }

      return { ...data, items: items || [], isOutOfStock, allImages, maxQuantity: maxQty };
    },
    enabled: !!id,
  });

  // Unified with ProductDetail: resolve localized title once, then feed Dynamic Island
  const localizedTitle = bundle ? pickI18n(bundle as any, 'title', language) : undefined;
  usePageTitle('product', localizedTitle || (bundle as any)?.title_ar || (bundle as any)?.title);

  const handleAddToCart = async () => {
    if (!user) { navigate('/auth'); return; }
    if (!bundle || bundle.isOutOfStock) { toast.error('هذا العرض انتهى - المخزون غير كافٍ'); return; }
    if ((bundle as any).offer_ends_at && new Date((bundle as any).offer_ends_at).getTime() <= Date.now()) {
      toast.error('انتهى وقت العرض');
      return;
    }

    const bundleSaleType = bundle.sale_type === 'direct' ? 'direct' : 'preorder';
    setIsAdding(true);
    try {
      const { detectSaleTypeConflict } = await import('@/lib/cartSaleType');
      const conflict = detectSaleTypeConflict(cartItems as any, bundleSaleType);
      if (conflict) {
        toast.error(conflict.messageAr);
        return;
      }
      const success = await addBundleToCart(bundle.id, bundleSaleType as 'direct' | 'preorder', quantity);
      if (success) {
        toast.success('تم إضافة الباقة للسلة بنجاح! 🎉');
        setQuantity(1);
      }
    } catch (error: any) {
      if (error?.conflict?.messageAr) {
        toast.error(error.conflict.messageAr);
      } else {
        console.error('Error adding bundle to cart:', error);
        toast.error('حدث خطأ في إضافة الباقة');
      }
    } finally {
      setIsAdding(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-transparent p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-64 w-full rounded-lg bg-muted animate-pulse" />
          <div className="h-7 w-3/4 rounded bg-muted animate-pulse" />
          <div className="h-4 w-1/2 rounded bg-muted animate-pulse" />
          <div className="grid grid-cols-2 gap-3">{[1,2,3,4].map(i=><div key={i} className="rounded-lg border bg-card p-3"><div className="h-20 rounded bg-muted animate-pulse mb-2" /><div className="h-3 w-2/3 rounded bg-muted animate-pulse" /></div>)}</div>
          <div className="h-12 w-full rounded-lg bg-muted animate-pulse" />
        </div>
      </div>
    );
  }

  if (!bundle) {
    return (
      <div className="min-h-screen bg-transparent flex flex-col items-center justify-center gap-3" dir="rtl">
        <Package className="h-12 w-12 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">الباقة غير موجودة</p>
        <Link to="/bundles" className="text-xs text-primary">العودة للباقات</Link>
      </div>
    );
  }

  const saleType = bundle.sale_type || 'direct';
  const isDirect = saleType === 'direct';
  const discount = bundle.original_price > 0
    ? Math.round(((bundle.original_price - bundle.bundle_price) / bundle.original_price) * 100)
    : 0;
  const activeImage = bundle.allImages?.[selectedImageIndex] || bundle.image_url;
  const maxQty = bundle.maxQuantity || 0;
  const offerEndsAt = (bundle as any).offer_ends_at as string | null | undefined;
  const isOfferExpired = !!offerEndsAt && new Date(offerEndsAt).getTime() <= Date.now();

  return (
    <div className="min-h-screen bg-transparent" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-30 bg-background/40 backdrop-blur-2xl border-b border-white/15 dark:border-white/10">
        <div className="container max-w-lg mx-auto px-3 py-2.5 flex items-center gap-2">
          <Link
            to="/bundles"
            aria-label="العودة إلى قائمة الباقات"
            className="w-9 h-9 rounded-xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl border border-white/15 dark:border-white/10 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.15)] flex items-center justify-center hover:border-primary/40 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
          >
            <ArrowRight className="h-4 w-4 text-foreground" aria-hidden="true" />
          </Link>
          <h1 className="text-sm font-bold text-foreground truncate flex-1">{pickI18n(bundle as any, 'title', language)}</h1>
          <div className="px-2 py-1 rounded-md bg-background/60 backdrop-blur-xl border border-white/25 dark:border-white/15 text-foreground text-[10px] font-semibold" aria-label={`نوع البيع: ${SALE_TYPE_LABELS[saleType] || saleType}`}>
            {SALE_TYPE_LABELS[saleType] || saleType}
          </div>
        </div>
      </div>

      <div className="container max-w-lg mx-auto px-3 pb-32">
        {/* Main Image */}
        {activeImage && (
          <div className="relative mt-3 rounded-2xl overflow-hidden border border-white/15 dark:border-white/10 shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.25)]">
            <img src={activeImage} alt={pickI18n(bundle as any, 'title', language)} className="w-full aspect-square object-cover" loading="lazy" decoding="async" />
            {bundle.isOutOfStock && (
              <div className="absolute inset-0 bg-background/50 backdrop-blur-md flex items-center justify-center">
                <div className="px-4 py-1.5 rounded-xl bg-destructive/85 backdrop-blur-md border border-destructive-foreground/20 text-destructive-foreground text-sm font-bold shadow-lg">انتهى العرض</div>
              </div>
            )}
            {!bundle.isOutOfStock && discount > 0 && (
              <div className="absolute top-3 left-3 px-2.5 py-1 rounded-lg bg-destructive/85 backdrop-blur-md border border-destructive-foreground/20 text-destructive-foreground text-xs font-bold shadow-lg">
                خصم {discount}%
              </div>
            )}
          </div>
        )}

        {/* Image thumbnails */}
        {bundle.allImages.length > 1 && (
          <div
            role="tablist"
            aria-label="معرض صور الباقة"
            className="flex gap-2 mt-2 overflow-x-auto scrollbar-hide pb-1"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'auto' }}
          >
            {bundle.allImages.map((img: string, i: number) => {
              const isActive = selectedImageIndex === i;
              return (
                <button
                  key={i}
                  type="button"
                  role="tab"
                  aria-selected={isActive}
                  aria-label={`عرض الصورة ${i + 1} من ${bundle.allImages.length}`}
                  onClick={() => setSelectedImageIndex(i)}
                  className={`w-14 h-14 rounded-xl overflow-hidden border shrink-0 backdrop-blur-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                    isActive
                      ? 'border-primary bg-primary/10 shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.4)] scale-105'
                      : 'border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] opacity-80 hover:opacity-100'
                  }`}
                >
                  <img src={img} alt="" className="w-full h-full object-cover pointer-events-none" draggable={false} loading="lazy" decoding="async" />
                </button>
              );
            })}
          </div>
        )}

        {/* Title & Description */}
        <div className="mt-4 space-y-2">
          <h2 className="text-lg font-black text-foreground">{pickI18n(bundle as any, 'title', language)}</h2>
          {pickI18n(bundle as any, 'description', language) && (
            <p className="text-sm text-foreground/80 leading-relaxed">{pickI18n(bundle as any, 'description', language)}</p>
          )}
        </div>

        {/* Price section */}
        <div className="mt-4 p-3 rounded-2xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_4px_20px_-4px_hsl(var(--primary)/0.15)]">
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-baseline gap-1.5">
                <span className="text-xl font-black text-primary" aria-label={`السعر ${formatPrice(bundle.bundle_price)} دينار عراقي`}>{formatPrice(bundle.bundle_price)}</span>
                <span className="text-[11px] text-foreground/70 font-medium" aria-hidden="true">د.ع</span>
              </div>
              {bundle.original_price > 0 && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className="text-xs text-foreground/55 line-through" aria-label={`السعر الأصلي ${formatPrice(bundle.original_price)}`}>{formatPrice(bundle.original_price)}</span>
                  {discount > 0 && (
                    <span className="text-[11px] text-primary font-bold">وفّر {formatPrice(bundle.original_price - bundle.bundle_price)} د.ع</span>
                  )}
                </div>
              )}
            </div>
            {isDirect && !bundle.isOutOfStock && maxQty > 0 && (
              <div className="text-[10px] text-muted-foreground text-left px-2.5 py-1.5 rounded-xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-md border border-white/15 dark:border-white/10">
                <span className="block">متوفر</span>
                <span className="font-bold text-foreground">{maxQty} باقة</span>
              </div>
            )}
          </div>
        </div>

        {/* Offer countdown / ended banner */}
        {offerEndsAt && (
          <DetailCountdownBanner endsAt={offerEndsAt} />
        )}



        {/* Bundle Contents */}
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-xl border border-primary/20 flex items-center justify-center">
              <Package className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">محتويات الباقة</h3>
            <span className="text-[11px] text-foreground/70 font-medium">({bundle.items.length} منتجات)</span>
          </div>

          <div className="space-y-2">
            {bundle.items.map((item: any, idx: number) => {
              const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
              const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
              const itemImage = colorObj?.image_url || colorObj?.image || item.products?.image_url || item.products?.images?.[0];
              const productSlug = item.products?.slug || item.products?.id || item.product_id;
              const productName = item.products?.name_ar || 'منتج';
              return (
                <Link
                  to={`/product/${productSlug}`}
                  key={idx}
                  aria-label={`عرض المنتج: ${productName}، الكمية ${item.quantity}${item.selected_color ? `، اللون ${item.selected_color}` : ''}`}
                  className="block rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  <motion.div
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: idx * 0.05 }}
                    className="flex items-center gap-3 p-2.5 rounded-2xl bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl border border-white/20 dark:border-white/10 shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.1)] hover:border-primary/40 hover:-translate-y-0.5 transition-all duration-300"
                  >
                  {itemImage && (
                    <img src={itemImage} alt="" className="w-14 h-14 rounded-xl object-cover shrink-0 border border-white/20 dark:border-white/10" loading="lazy" decoding="async" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-bold text-foreground truncate">{productName}</p>
                    <div className="flex items-center gap-2 mt-0.5 text-[11px] text-foreground/70">
                      <span>الكمية: {item.quantity}</span>
                      {item.selected_color && <span>• {item.selected_color}</span>}
                    </div>
                  </div>
                  <ChevronLeft className="h-4 w-4 text-foreground/50 shrink-0" aria-hidden="true" />
                </motion.div>
                </Link>
              );
            })}
          </div>
        </div>

        {/* Products Strip */}
        <div className="mt-5">
          <div className="flex items-center gap-2 mb-2.5">
            <div className="w-7 h-7 rounded-lg bg-primary/10 backdrop-blur-xl border border-primary/20 flex items-center justify-center">
              <Sparkles className="h-3.5 w-3.5 text-primary" />
            </div>
            <h3 className="text-sm font-bold text-foreground">المنتجات في هذه الباقة</h3>
          </div>
          <div
            className="flex gap-2.5 overflow-x-auto scrollbar-hide pb-2"
            style={{ WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain', overscrollBehaviorY: 'auto' }}
          >
            {bundle.items.map((item: any, idx: number) => {
              const colors = Array.isArray(item.products?.colors) ? item.products.colors : [];
              const colorObj = item.selected_color ? colors.find((c: any) => (c.color || c.name) === item.selected_color) : null;
              const itemImage = colorObj?.image_url || colorObj?.image || item.products?.image_url || item.products?.images?.[0];
              const productSlug = item.products?.slug || item.products?.id || item.product_id;
              return (
                <Link
                  key={idx}
                  to={`/product/${productSlug}`}
                  aria-label={`عرض المنتج ${item.products?.name_ar || 'منتج'}`}
                  className="group shrink-0 w-[110px] rounded-2xl overflow-hidden border border-white/20 dark:border-white/10 bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl shadow-[0_2px_12px_-4px_hsl(var(--primary)/0.1)] hover:border-primary/40 hover:-translate-y-0.5 hover:shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.25)] transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background"
                >
                  {itemImage && (
                    <div className="h-[80px] overflow-hidden relative">
                      <img src={itemImage} alt="" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300 pointer-events-none" draggable={false} loading="lazy" decoding="async" />
                      <div className="absolute inset-x-0 bottom-0 h-6 bg-gradient-to-t from-background/30 to-transparent" />
                    </div>
                  )}
                  <div className="p-1.5 relative z-10">
                    <p className="text-[10px] font-bold text-foreground line-clamp-2 leading-tight">{item.products?.name_ar || 'منتج'}</p>
                    <p className="text-[9px] text-primary mt-0.5 font-semibold">عرض المنتج ←</p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </div>

      {/* Fixed Bottom Bar */}
      <div className="fixed bottom-[calc(4rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 z-[60] px-2 pb-1">
        <div className="mx-auto max-w-lg rounded-2xl border border-white/20 dark:border-white/10 bg-background/40 backdrop-blur-2xl shadow-[0_8px_32px_-8px_hsl(var(--primary)/0.3)]">
          <div className="px-3 py-3 flex items-center gap-3">
            {/* Quantity selector */}
            {isDirect && !bundle.isOutOfStock && maxQty > 0 && (
              <div
                role="group"
                aria-label="تعديل الكمية"
                className="flex items-center border border-white/25 dark:border-white/10 rounded-xl overflow-hidden shrink-0 bg-white/10 dark:bg-white/[0.04] backdrop-blur-xl"
              >
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                  aria-label="إنقاص الكمية"
                  className="h-9 w-9 flex items-center justify-center text-foreground hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <Minus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
                <span
                  aria-live="polite"
                  aria-label={`الكمية الحالية ${quantity}`}
                  className="h-9 w-10 flex items-center justify-center text-sm font-bold text-foreground border-x border-white/25 dark:border-white/10 bg-white/5"
                >
                  {quantity}
                </span>
                <button
                  type="button"
                  onClick={() => setQuantity(q => Math.min(maxQty, q + 1))}
                  disabled={quantity >= maxQty}
                  aria-label="زيادة الكمية"
                  className="h-9 w-9 flex items-center justify-center text-foreground hover:bg-primary/10 disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary"
                >
                  <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                </button>
              </div>
            )}

            {/* Price */}
            <div className="flex-1 min-w-0">
              <div className="flex items-baseline gap-1">
                <span className="text-base font-black text-primary" aria-label={`السعر الإجمالي ${formatPrice(bundle.bundle_price * quantity)} دينار`}>{formatPrice(bundle.bundle_price * quantity)}</span>
                <span className="text-[10px] text-foreground/70 font-medium" aria-hidden="true">د.ع</span>
              </div>
              {quantity > 1 && (
                <span className="text-[10px] text-foreground/65">{formatPrice(bundle.bundle_price)} × {quantity}</span>
              )}
            </div>

            {/* Add to cart */}
            <Button
              onClick={handleAddToCart}
              disabled={isAdding || bundle.isOutOfStock}
              size="sm"
              aria-label={isAdding ? 'جارٍ إضافة الباقة للسلة' : bundle.isOutOfStock ? 'الباقة نفذت من المخزون' : 'إضافة الباقة إلى السلة'}
              className={`h-10 text-xs gap-2 px-5 backdrop-blur-xl border transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background ${
                bundle.isOutOfStock
                  ? 'bg-muted/60 border-white/15 text-foreground/70'
                  : 'bg-primary hover:bg-primary border-primary/50 text-primary-foreground shadow-[0_4px_16px_-4px_hsl(var(--primary)/0.5)] hover:shadow-[0_6px_20px_-4px_hsl(var(--primary)/0.6)]'
              }`}
            >
              {isAdding ? (
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : bundle.isOutOfStock ? (
                <AlertTriangle className="h-4 w-4" aria-hidden="true" />
              ) : (
                <ShoppingCart className="h-4 w-4" aria-hidden="true" />
              )}
              {isAdding ? 'جارٍ...' : bundle.isOutOfStock ? 'انتهى' : 'أضف للسلة'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default BundleDetail;
