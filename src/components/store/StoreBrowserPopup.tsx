/**
 * Store Browser Popup - المكون الرئيسي لتصفح المتاجر وحساب التكلفة
 * 
 * معمارية Popup + Adapter:
 * - يفتح المتجر في نافذة منفصلة (window.open)
 * - يوفر واجهة للصق الرابط وحساب التكلفة
 * - يعرض تفاصيل التكلفة مع التمييز بين Actual/Estimated
 */

import { useState, useRef, useEffect, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
  X, ShoppingCart, Loader2, ExternalLink, 
  ChevronDown, ChevronUp, ArrowLeft
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings, type ShippingType, type SourceCountry } from '@/hooks/useShippingCalculator';
import { extractProductIdentity, getSourceCountryFromUrl, type ProductIdentity } from '@/lib/stores/storeAdapters';
import { calculateFullCost, type ProductSpecs } from '@/lib/stores/costEngine';
import CostBreakdownCard from './CostBreakdownCard';
import PopupStatusBar from './PopupStatusBar';
import LinkCapturePanel from './LinkCapturePanel';
import DestinationSettings from './DestinationSettings';
import WhyAutoAddressNotPossible from './WhyAutoAddressNotPossible';
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
  // State
  const [calculationStatus, setCalculationStatus] = useState<CalculationStatus>('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [productSpecs, setProductSpecs] = useState<ProductSpecs | null>(null);
  const [productUrl, setProductUrl] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [popupWindow, setPopupWindow] = useState<Window | null>(null);
  const [isPopupOpen, setIsPopupOpen] = useState(false);
  const [showBreakdown, setShowBreakdown] = useState(true);
  const [showAddressInfo, setShowAddressInfo] = useState(false);
  
  // Shipping options
  const [shippingType, setShippingType] = useState<ShippingType>('air');
  const [sourceCountry, setSourceCountry] = useState<SourceCountry>('usa');
  
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();
  const popupCheckInterval = useRef<NodeJS.Timeout | null>(null);

  // Set initial source country based on store
  useEffect(() => {
    const detectedCountry = getSourceCountryFromUrl(storeUrl);
    if (detectedCountry) {
      setSourceCountry(detectedCountry);
    }
  }, [storeUrl]);

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

  // Open store popup
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

  // Calculate cost from URL
  const handleUrlSubmit = async (url: string, identity: ProductIdentity | null) => {
    setProductUrl(url);
    setCalculationStatus('calculating');
    setErrorMessage(null);
    setProductSpecs(null);

    try {
      // Determine source country from URL or use selected
      const detectedCountry = getSourceCountryFromUrl(url);
      const effectiveCountry = detectedCountry || sourceCountry;
      
      if (detectedCountry && detectedCountry !== sourceCountry) {
        setSourceCountry(detectedCountry);
      }

      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: url,
          sourceCountry: effectiveCountry,
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

  // Add to requests
  const handleAddToRequests = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!productSpecs || !shippingSettings) {
      toast.error('يرجى حساب تكلفة الشحن أولاً');
      return;
    }

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

      // Send Telegram notification
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();
        
        const userName = profile?.full_name || profile?.username || 'مستخدم';
        const countryLabel = sourceCountry === 'china' ? 'الصين' : 'أمريكا';
        const shippingLabel = shippingType === 'sea' ? 'بحري' : 'جوي';
        
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `📦 <b>طلب منتج جديد</b>\n\n👤 ${userName}\n📝 ${productSpecs.productName}\n🌍 ${countryLabel} - ${shippingLabel}\n💰 ${formatPrice(costBreakdown.totalIqd)}\n🔗 ${productUrl}`,
          },
        });
      } catch (telegramError) {
        console.error('Telegram notification error:', telegramError);
      }

      toast.success('تم إضافة المنتج لطلباتك! سنتواصل معك قريباً');
      onClose();
    } catch (error) {
      console.error('Error adding to requests:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    } finally {
      setIsSubmitting(false);
    }
  };

  // Calculate cost breakdown
  const costBreakdown = productSpecs && shippingSettings
    ? calculateFullCost(productSpecs, sourceCountry, shippingType, shippingSettings)
    : null;

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <h1 className="text-xl font-bold">{storeName}</h1>
          <Button 
            variant={isPopupOpen ? "secondary" : "default"} 
            size="sm"
            onClick={isPopupOpen ? handleFocusPopup : handleOpenPopup}
            className="gap-1"
          >
            <ExternalLink className="w-4 h-4" />
            {isPopupOpen ? 'عرض' : 'فتح'}
          </Button>
        </div>

        {/* Popup Status */}
        <div className="mb-4">
          <PopupStatusBar
            isOpen={isPopupOpen}
            storeName={storeName}
            storeAddress={storeAddress}
            onFocus={handleFocusPopup}
            onClose={handleClosePopup}
            onReopen={handleOpenPopup}
          />
        </div>

        {/* Open Store Button (when popup not open) */}
        {!isPopupOpen && (
          <Card className="mb-4">
            <CardContent className="py-6 text-center">
              <p className="text-muted-foreground mb-4">
                افتح المتجر في نافذة منفصلة للتصفح واختيار المنتجات
              </p>
              <Button onClick={handleOpenPopup} size="lg" className="gap-2">
                <ExternalLink className="w-4 h-4" />
                فتح {storeName}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Link Capture */}
        <div className="mb-4">
          <LinkCapturePanel
            onUrlSubmit={handleUrlSubmit}
            isCalculating={calculationStatus === 'calculating'}
            popupWindow={popupWindow}
          />
        </div>

        {/* Shipping Options */}
        <div className="mb-4">
          <DestinationSettings
            sourceCountry={sourceCountry}
            shippingType={shippingType}
            onSourceCountryChange={setSourceCountry}
            onShippingTypeChange={setShippingType}
            disabled={calculationStatus === 'calculating'}
          />
        </div>

        {/* Error State */}
        {calculationStatus === 'error' && errorMessage && (
          <Card className="mb-4 border-red-500/50 bg-red-500/5">
            <CardContent className="py-4">
              <p className="text-sm text-red-600">{errorMessage}</p>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => setCalculationStatus('idle')}
                className="mt-2"
              >
                إعادة المحاولة
              </Button>
            </CardContent>
          </Card>
        )}

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
              <Card className="mb-4">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium line-clamp-1">{productSpecs.productName}</span>
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

        {/* Why Auto Address Not Possible - Collapsible */}
        <div className="mt-6">
          <Collapsible open={showAddressInfo} onOpenChange={setShowAddressInfo}>
            <CollapsibleTrigger asChild>
              <Button 
                variant="ghost" 
                size="sm" 
                className="w-full text-muted-foreground text-xs gap-1"
              >
                لماذا لا يمكن إدخال العنوان تلقائياً؟
                {showAddressInfo ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
              </Button>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-2">
              <WhyAutoAddressNotPossible />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </div>
    </div>
  );
}
