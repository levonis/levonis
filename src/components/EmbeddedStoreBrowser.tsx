import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { X, ShoppingCart, Package, Loader2, ExternalLink, Copy, Check, Globe, Maximize2, Minimize2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings, calculateShippingCost, type ShippingType } from '@/hooks/useShippingCalculator';

interface StoreAddress {
  country: string;
  state: string;
  city: string;
  zip_code: string;
  street: string;
}

interface EmbeddedStoreBrowserProps {
  storeKey: string;
  storeName: string;
  storeUrl: string;
  storeAddress: StoreAddress;
  onClose: () => void;
}

interface ProductEstimate {
  priceUsd: number | null;
  priceIqd: number | null;
  shippingCost: number;
  commission: number;
  total: number;
  productName: string;
  weight: number | null;
  dimensions: { length: number; width: number; height: number } | null;
}

export default function EmbeddedStoreBrowser({
  storeKey,
  storeName,
  storeUrl,
  storeAddress,
  onClose
}: EmbeddedStoreBrowserProps) {
  const [productUrl, setProductUrl] = useState('');
  const [isCalculating, setIsCalculating] = useState(false);
  const [productEstimate, setProductEstimate] = useState<ProductEstimate | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Check if popup is still open
  useEffect(() => {
    if (popupWindow) {
      popupCheckInterval.current = setInterval(() => {
        if (popupWindow.closed) {
          setIsPopupOpen(false);
          setPopupWindow(null);
          if (popupCheckInterval.current) {
            clearInterval(popupCheckInterval.current);
          }
        }
      }, 500);
    }

    return () => {
      if (popupCheckInterval.current) {
        clearInterval(popupCheckInterval.current);
      }
    };
  }, [popupWindow]);

  const handleOpenPopup = () => {
    // Calculate popup dimensions (80% of screen)
    const width = Math.min(window.screen.width * 0.8, 1200);
    const height = Math.min(window.screen.height * 0.8, 800);
    const left = (window.screen.width - width) / 2;
    const top = (window.screen.height - height) / 2;

    const popup = window.open(
      storeUrl,
      `store_${storeKey}`,
      `width=${width},height=${height},left=${left},top=${top},resizable=yes,scrollbars=yes,status=yes,toolbar=yes,menubar=no,location=yes`
    );

    if (popup) {
      setPopupWindow(popup);
      setIsPopupOpen(true);
      popup.focus();
    } else {
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح للنوافذ المنبثقة');
    }
  };

  const handleFocusPopup = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus();
    } else {
      handleOpenPopup();
    }
  };

  const handleClosePopup = () => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    setIsPopupOpen(false);
  };

  const handleCopyAddress = async () => {
    const address = `${storeAddress.street}, ${storeAddress.city}, ${storeAddress.state} ${storeAddress.zip_code}, ${storeAddress.country}`;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCalculateShipping = async () => {
    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج');
      return;
    }

    setIsCalculating(true);
    setProductEstimate(null);

    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: productUrl.trim(),
          sourceCountry: 'usa',
          shippingType: 'air' as ShippingType
        }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const specs = data.data;
        
        let shippingCost = 0;
        let commission = 0;

        if (shippingSettings && (specs.dimensions || specs.weight)) {
          const calc = calculateShippingCost(
            'usa',
            'air',
            specs.dimensions,
            specs.weight,
            shippingSettings
          );
          shippingCost = calc.shippingCost;
          commission = calc.commission;
        }

        setProductEstimate({
          priceUsd: specs.price_usd || null,
          priceIqd: specs.price_iqd || null,
          shippingCost,
          commission,
          total: (specs.price_iqd || 0) + shippingCost + commission,
          productName: specs.product_name || 'منتج',
          weight: specs.weight || null,
          dimensions: specs.dimensions || null
        });
        
        toast.success('تم حساب تكلفة الشحن');
      } else {
        toast.error(data?.error || 'لم يتم العثور على معلومات المنتج');
      }
    } catch (error) {
      console.error('Calculation error:', error);
      toast.error('حدث خطأ في حساب التكلفة');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleAddToRequests = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!productEstimate) {
      toast.error('يرجى حساب تكلفة الشحن أولاً');
      return;
    }

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('custom_product_requests').insert({
        user_id: user.id,
        product_link: productUrl,
        product_name: productEstimate.productName,
        quantity: 1,
        source_country: 'usa',
        shipping_type: 'air',
        product_weight: productEstimate.weight,
        product_dimensions: productEstimate.dimensions,
        estimated_shipping_cost: productEstimate.shippingCost + productEstimate.commission,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('تم إضافة المنتج لطلباتك! سنتواصل معك قريباً');
      onClose();
    } catch (error) {
      console.error('Error adding to requests:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <X className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">{storeName}</h1>
          <div className="w-10" />
        </div>

        {/* Popup Status Bar */}
        {isPopupOpen && (
          <Card className="mb-4 border-primary/50 bg-primary/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">المتجر مفتوح في نافذة منبثقة</span>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" onClick={handleFocusPopup} className="gap-1">
                    <Maximize2 className="w-3 h-3" />
                    عرض المتجر
                  </Button>
                  <Button variant="ghost" size="sm" onClick={handleClosePopup}>
                    <X className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Store Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                تصفح المتجر
              </CardTitle>
              {!isPopupOpen ? (
                <Button onClick={handleOpenPopup} className="gap-2">
                  <ExternalLink className="w-4 h-4" />
                  فتح المتجر
                </Button>
              ) : (
                <Button onClick={handleFocusPopup} variant="secondary" className="gap-2">
                  <Maximize2 className="w-4 h-4" />
                  إظهار النافذة
                </Button>
              )}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground mb-2">عنوان الشحن:</p>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium" dir="ltr">
                  {storeAddress.street}, {storeAddress.city}, {storeAddress.state} {storeAddress.zip_code}
                </p>
                <Button variant="ghost" size="sm" onClick={handleCopyAddress}>
                  {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
              <p className="text-sm text-amber-700 dark:text-amber-400">
                💡 {isPopupOpen ? 'تصفح المتجر في النافذة المنبثقة، ثم انسخ رابط المنتج هنا' : 'افتح المتجر، اختر المنتج، وانسخ رابطه هنا لحساب التكلفة'}
              </p>
            </div>
          </CardContent>
        </Card>

        {/* Product URL Input */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              حساب تكلفة المنتج
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Input
                value={productUrl}
                onChange={(e) => setProductUrl(e.target.value)}
                placeholder="الصق رابط المنتج هنا..."
                className="text-sm"
                dir="ltr"
              />
            </div>

            <Button
              onClick={handleCalculateShipping}
              disabled={isCalculating || !productUrl.trim()}
              className="w-full gap-2"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري حساب التكلفة...
                </>
              ) : (
                <>
                  <Package className="w-4 h-4" />
                  حساب التكلفة التقديرية
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Results */}
        {productEstimate && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-center">{productEstimate.productName}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {productEstimate.priceIqd && (
                <div className="text-center p-4 bg-primary/5 rounded-lg">
                  <p className="text-sm text-muted-foreground mb-1">سعر المنتج</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(productEstimate.priceIqd)}</p>
                  {productEstimate.priceUsd && (
                    <p className="text-xs text-muted-foreground">${productEstimate.priceUsd.toFixed(2)} USD</p>
                  )}
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">تكلفة الشحن</p>
                  <p className="text-lg font-bold">{formatPrice(productEstimate.shippingCost)}</p>
                </div>
                <div className="p-3 bg-muted/50 rounded-lg text-center">
                  <p className="text-xs text-muted-foreground mb-1">العمولة</p>
                  <p className="text-lg font-bold">{formatPrice(productEstimate.commission)}</p>
                </div>
              </div>

              <div className="p-4 bg-primary/10 rounded-lg text-center border border-primary/20">
                <p className="text-sm text-muted-foreground mb-1">الإجمالي التقديري</p>
                <p className="text-3xl font-bold text-primary">{formatPrice(productEstimate.total)}</p>
              </div>

              <Button
                onClick={handleAddToRequests}
                disabled={isSubmitting}
                className="w-full gap-2"
                size="lg"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    جاري الإضافة...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="w-4 h-4" />
                    إضافة للطلبات
                  </>
                )}
              </Button>

              <p className="text-xs text-amber-600 text-center">
                ⚠️ هذه تكلفة تقديرية وقد تختلف عن السعر النهائي
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}
