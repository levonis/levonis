import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  X, ShoppingCart, Package, Loader2, ExternalLink, Copy, Check, 
  Globe, Maximize2, RefreshCw, AlertCircle, Truck, Calculator,
  ChevronDown, ChevronUp
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings, type ShippingType, type SourceCountry } from '@/hooks/useShippingCalculator';
import { detectStore, extractProductIdentity, getSourceCountryFromUrl } from '@/lib/stores/storeAdapters';
import { calculateFullCost, type ProductSpecs } from '@/lib/stores/costEngine';
import CostBreakdownCard from './CostBreakdownCard';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

interface StoreAddress {
  country: string;
  state: string;
  city: string;
  zip_code: string;
  street: string;
}

interface StoreBrowserPopupProps {
  storeKey: string;
  storeName: string;
  storeUrl: string;
  storeAddress: StoreAddress;
  onClose: () => void;
}

type CalculationStatus = 'idle' | 'calculating' | 'success' | 'error';

export default function StoreBrowserPopup({
  storeKey,
  storeName,
  storeUrl,
  storeAddress,
  onClose
}: StoreBrowserPopupProps) {
  const [productUrl, setProductUrl] = useState('');
  const [calculationStatus, setCalculationStatus] = useState<CalculationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productSpecs, setProductSpecs] = useState<ProductSpecs | null>(null);
  const [copied, setCopied] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [detectedStore, setDetectedStore] = useState<string | null>(null);
  const [shippingType, setShippingType] = useState<ShippingType>('air');
  
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

  // Detect store when URL changes
  useEffect(() => {
    if (productUrl.trim()) {
      const adapter = detectStore(productUrl);
      setDetectedStore(adapter?.nameAr || null);
    } else {
      setDetectedStore(null);
    }
  }, [productUrl]);

  const handleOpenPopup = useCallback(() => {
    const width = Math.min(window.screen.width * 0.85, 1400);
    const height = Math.min(window.screen.height * 0.85, 900);
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
      toast.error('تم حظر النافذة المنبثقة. يرجى السماح للنوافذ المنبثقة من إعدادات المتصفح');
    }
  }, [storeUrl, storeKey]);

  const handleFocusPopup = useCallback(() => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.focus();
    } else {
      handleOpenPopup();
    }
  }, [popupWindow, handleOpenPopup]);

  const handleClosePopup = useCallback(() => {
    if (popupWindow && !popupWindow.closed) {
      popupWindow.close();
    }
    setPopupWindow(null);
    setIsPopupOpen(false);
  }, [popupWindow]);

  const handleCopyAddress = async () => {
    const address = `${storeAddress.street}, ${storeAddress.city}, ${storeAddress.state} ${storeAddress.zip_code}, ${storeAddress.country}`;
    await navigator.clipboard.writeText(address);
    setCopied(true);
    toast.success('تم نسخ العنوان');
    setTimeout(() => setCopied(false), 2000);
  };

  const handleCalculateCost = async () => {
    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج');
      return;
    }

    // Validate URL
    try {
      new URL(productUrl);
    } catch {
      toast.error('رابط غير صالح. يرجى إدخال رابط كامل يبدأ بـ https://');
      return;
    }

    // Extract product identity
    const identity = extractProductIdentity(productUrl);
    if (!identity) {
      toast.warning('لم نتعرف على المتجر تلقائياً، سنحاول استخراج المعلومات');
    }

    setCalculationStatus('calculating');
    setErrorMessage(null);
    setProductSpecs(null);

    try {
      // Determine source country
      const detectedCountry = getSourceCountryFromUrl(productUrl);
      const sourceCountry: SourceCountry = detectedCountry || 'usa';

      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: productUrl.trim(),
          sourceCountry,
          shippingType
        }
      });

      if (error) throw error;

      if (data?.success && data?.data) {
        const specs = data.data;
        
        setProductSpecs({
          productName: specs.product_name || 'منتج',
          priceUsd: specs.price_usd || null,
          priceOriginal: specs.original_price || null,
          originalCurrency: specs.original_currency || 'USD',
          dimensions: specs.dimensions || null,
          weight: specs.weight || null,
          internalShipping: specs.internal_shipping || null,
          tax: specs.tax || null,
          estimated: specs.estimated ?? true,
          source: specs.source || '',
          notes: specs.notes || null,
        });
        
        setCalculationStatus('success');
        toast.success('تم حساب التكلفة بنجاح');
      } else {
        setCalculationStatus('error');
        setErrorMessage(data?.error || 'لم يتم العثور على معلومات المنتج');
        toast.error(data?.error || 'لم يتم العثور على معلومات المنتج');
      }
    } catch (error) {
      console.error('Calculation error:', error);
      setCalculationStatus('error');
      setErrorMessage('حدث خطأ في حساب التكلفة. يرجى المحاولة مرة أخرى.');
      toast.error('حدث خطأ في حساب التكلفة');
    }
  };

  const handleAddToRequests = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!productSpecs || !shippingSettings) {
      toast.error('يرجى حساب تكلفة الشحن أولاً');
      return;
    }

    const sourceCountry: SourceCountry = getSourceCountryFromUrl(productUrl) || 'usa';
    const costBreakdown = calculateFullCost(productSpecs, sourceCountry, shippingType, shippingSettings);

    setIsSubmitting(true);
    try {
      const { error } = await supabase.from('custom_product_requests').insert([{
        user_id: user.id,
        product_link: productUrl,
        product_name: productSpecs.productName,
        quantity: 1,
        source_country: sourceCountry,
        shipping_type: shippingType,
        product_weight: productSpecs.weight,
        product_dimensions: productSpecs.dimensions as any,
        estimated_shipping_cost: costBreakdown.shippingCost + costBreakdown.commission,
        suggested_price: productSpecs.priceUsd ? Math.round(productSpecs.priceUsd) : null,
        status: 'pending'
      }]);

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

  const handleRetry = () => {
    setCalculationStatus('idle');
    setErrorMessage(null);
    handleCalculateCost();
  };

  // Calculate cost breakdown
  const costBreakdown = productSpecs && shippingSettings
    ? calculateFullCost(
        productSpecs,
        getSourceCountryFromUrl(productUrl) || 'usa',
        shippingType,
        shippingSettings
      )
    : null;

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
          <Card className="mb-4 border-green-500/50 bg-green-500/5">
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-sm font-medium">المتجر مفتوح في نافذة منفصلة</span>
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
            {/* Shipping Address */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2 mb-2">
                <Truck className="w-4 h-4 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">عنوان الشحن (للمخزن):</p>
              </div>
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium" dir="ltr">
                  {storeAddress.street}, {storeAddress.city}, {storeAddress.state} {storeAddress.zip_code}
                </p>
                <Button variant="ghost" size="sm" onClick={handleCopyAddress}>
                  {copied ? <Check className="w-4 h-4 text-green-500" /> : <Copy className="w-4 h-4" />}
                </Button>
              </div>
            </div>

            <div className="p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg">
              <p className="text-sm text-blue-700 dark:text-blue-400">
                💡 {isPopupOpen 
                  ? 'تصفح المتجر واختر المنتج والخيارات (اللون، الحجم، البائع)، ثم انسخ الرابط هنا' 
                  : 'افتح المتجر، اختر المنتج مع كل الخيارات، وانسخ رابطه لحساب التكلفة'}
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
              <div className="relative">
                <Input
                  value={productUrl}
                  onChange={(e) => setProductUrl(e.target.value)}
                  placeholder="الصق رابط المنتج هنا..."
                  className="text-sm pr-4"
                  dir="ltr"
                />
                {detectedStore && (
                  <Badge variant="secondary" className="absolute left-2 top-1/2 -translate-y-1/2 text-xs">
                    {detectedStore}
                  </Badge>
                )}
              </div>
            </div>

            <Button
              onClick={handleCalculateCost}
              disabled={calculationStatus === 'calculating' || !productUrl.trim()}
              className="w-full gap-2"
            >
              {calculationStatus === 'calculating' ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري حساب التكلفة...
                </>
              ) : (
                <>
                  <Calculator className="w-4 h-4" />
                  حساب التكلفة
                </>
              )}
            </Button>

            {/* Error State */}
            {calculationStatus === 'error' && errorMessage && (
              <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-lg">
                <div className="flex items-start gap-2">
                  <AlertCircle className="w-5 h-5 text-red-500 mt-0.5" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-red-700 dark:text-red-400">
                      {errorMessage}
                    </p>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={handleRetry}
                      className="mt-2 gap-1 text-red-600"
                    >
                      <RefreshCw className="w-3 h-3" />
                      إعادة المحاولة
                    </Button>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Results */}
        {costBreakdown && productSpecs && (
          <>
            <Collapsible open={showBreakdown} onOpenChange={setShowBreakdown}>
              <CollapsibleTrigger asChild>
                <div className="flex items-center justify-between mb-2 cursor-pointer group">
                  <span className="text-sm font-medium text-muted-foreground group-hover:text-foreground transition-colors">
                    تفاصيل التكلفة
                  </span>
                  {showBreakdown ? (
                    <ChevronUp className="w-4 h-4 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="w-4 h-4 text-muted-foreground" />
                  )}
                </div>
              </CollapsibleTrigger>
              <CollapsibleContent>
                <CostBreakdownCard
                  breakdown={costBreakdown}
                  productName={productSpecs.productName}
                  showDetails={true}
                />
              </CollapsibleContent>
            </Collapsible>

            {/* Quick Summary if collapsed */}
            {!showBreakdown && (
              <Card className="mb-6">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">{productSpecs.productName}</span>
                    <span className="text-xl font-bold text-primary">
                      {formatPrice(costBreakdown.totalIqd)}
                    </span>
                  </div>
                </CardContent>
              </Card>
            )}

            <Button
              onClick={handleAddToRequests}
              disabled={isSubmitting}
              className="w-full gap-2 mt-4"
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
          </>
        )}
      </div>
    </div>
  );
}
