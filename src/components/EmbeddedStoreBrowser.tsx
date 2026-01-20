import { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { ArrowRight, ArrowLeft, RotateCw, Home, X, ShoppingCart, Package, Loader2, ChevronUp, ChevronDown } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings, calculateShippingCost, type ShippingType } from '@/hooks/useShippingCalculator';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';

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
}

export default function EmbeddedStoreBrowser({
  storeKey,
  storeName,
  storeUrl,
  storeAddress,
  onClose
}: EmbeddedStoreBrowserProps) {
  const [currentUrl, setCurrentUrl] = useState(storeUrl);
  const [inputUrl, setInputUrl] = useState(storeUrl);
  const [isLoading, setIsLoading] = useState(true);
  const [showShippingPanel, setShowShippingPanel] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [productEstimate, setProductEstimate] = useState<ProductEstimate | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();

  // Note: Due to CORS and X-Frame-Options, most sites won't load in iframe
  // This is a concept implementation - production would need a proxy server
  const [iframeError, setIframeError] = useState(false);

  const handleCalculateShipping = async () => {
    setIsCalculating(true);
    setProductEstimate(null);

    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: currentUrl,
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
          productName: specs.product_name || 'منتج'
        });
        
        setShowDetails(true);
        toast.success('تم حساب تكلفة الشحن');
      } else {
        toast.error('لم يتم العثور على معلومات المنتج');
      }
    } catch (error) {
      console.error('Calculation error:', error);
      toast.error('حدث خطأ في حساب التكلفة');
    } finally {
      setIsCalculating(false);
    }
  };

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!productEstimate) {
      toast.error('يرجى حساب تكلفة الشحن أولاً');
      return;
    }

    try {
      const { error } = await supabase.from('custom_product_requests').insert({
        user_id: user.id,
        product_link: currentUrl,
        product_name: productEstimate.productName,
        quantity: 1,
        source_country: 'usa',
        shipping_type: 'air',
        estimated_shipping_cost: productEstimate.shippingCost + productEstimate.commission,
        status: 'pending'
      });

      if (error) throw error;

      toast.success('تم إضافة المنتج لطلباتك! سنتواصل معك قريباً');
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    }
  };

  const navigateTo = (url: string) => {
    setCurrentUrl(url);
    setInputUrl(url);
    setIsLoading(true);
    setProductEstimate(null);
  };

  const handleUrlSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputUrl) {
      navigateTo(inputUrl);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-background flex flex-col">
      {/* Top Navigation Bar */}
      <div className="flex items-center gap-2 p-2 border-b bg-card">
        <Button variant="ghost" size="icon" onClick={onClose}>
          <X className="w-5 h-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => window.history.back()}>
          <ArrowRight className="w-5 h-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => window.history.forward()}>
          <ArrowLeft className="w-5 h-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => navigateTo(currentUrl)}>
          <RotateCw className="w-5 h-5" />
        </Button>
        
        <Button variant="ghost" size="icon" onClick={() => navigateTo(storeUrl)}>
          <Home className="w-5 h-5" />
        </Button>
        
        <form onSubmit={handleUrlSubmit} className="flex-1 flex gap-2">
          <Input
            value={inputUrl}
            onChange={(e) => setInputUrl(e.target.value)}
            placeholder="أدخل رابط المنتج"
            className="flex-1 text-sm"
            dir="ltr"
          />
        </form>
        
        <div className="text-sm font-medium text-muted-foreground px-2">
          {storeName}
        </div>
      </div>

      {/* Address Info */}
      <div className="flex items-center justify-between px-4 py-2 bg-muted/50 text-sm">
        <span className="text-muted-foreground">
          عنوان الشحن المحدد: {storeAddress.city}, {storeAddress.state} - {storeAddress.zip_code}
        </span>
        <span className="text-xs text-muted-foreground">
          (العنوان يُحدد تلقائياً من الإدارة)
        </span>
      </div>

      {/* Main Content Area */}
      <div className="flex-1 relative overflow-hidden">
        {/* Notice for CORS restrictions */}
        {iframeError ? (
          <div className="flex flex-col items-center justify-center h-full gap-4 p-8 text-center">
            <Package className="w-16 h-16 text-muted-foreground" />
            <h2 className="text-xl font-bold">لا يمكن تضمين هذا المتجر مباشرة</h2>
            <p className="text-muted-foreground max-w-md">
              بسبب قيود الأمان، لا يمكن عرض معظم المتاجر داخل التطبيق.
              يمكنك نسخ رابط المنتج من المتجر وإرساله عبر نموذج الطلب المخصص.
            </p>
            <div className="flex gap-2 mt-4">
              <Button onClick={() => window.open(currentUrl, '_blank')}>
                فتح المتجر في نافذة جديدة
              </Button>
              <Button variant="outline" onClick={onClose}>
                العودة لنموذج الطلب
              </Button>
            </div>
          </div>
        ) : (
          <>
            {isLoading && (
              <div className="absolute inset-0 flex items-center justify-center bg-background/80 z-10">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            )}
            <iframe
              ref={iframeRef}
              src={currentUrl}
              className="w-full h-full border-0"
              onLoad={() => setIsLoading(false)}
              onError={() => {
                setIsLoading(false);
                setIframeError(true);
              }}
              sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
            />
          </>
        )}
      </div>

      {/* Bottom Shipping Panel */}
      <Collapsible open={showShippingPanel} onOpenChange={setShowShippingPanel}>
        <div className="border-t bg-card">
          <CollapsibleTrigger asChild>
            <Button 
              variant="ghost" 
              className="w-full flex items-center justify-center gap-2 py-3"
            >
              <Package className="w-5 h-5" />
              تفاصيل الشحن والتكلفة
              {showShippingPanel ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
            </Button>
          </CollapsibleTrigger>
          
          <CollapsibleContent>
            <div className="p-4 space-y-4">
              {!productEstimate ? (
                <div className="text-center">
                  <p className="text-muted-foreground mb-4">
                    انتقل إلى صفحة المنتج ثم اضغط لحساب التكلفة
                  </p>
                  <Button 
                    onClick={handleCalculateShipping}
                    disabled={isCalculating}
                    className="gap-2"
                  >
                    {isCalculating ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        جاري الحساب...
                      </>
                    ) : (
                      <>
                        <Package className="w-4 h-4" />
                        حساب تكلفة الشحن
                      </>
                    )}
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="text-center">
                    <p className="text-sm text-muted-foreground mb-1">{productEstimate.productName}</p>
                    {productEstimate.priceIqd && (
                      <p className="text-2xl font-bold text-primary">{formatPrice(productEstimate.priceIqd)}</p>
                    )}
                    {productEstimate.priceUsd && (
                      <p className="text-xs text-muted-foreground">${productEstimate.priceUsd.toFixed(2)} USD</p>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 text-center text-sm">
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-muted-foreground text-xs">سعر المنتج</p>
                      <p className="font-bold">{formatPrice(productEstimate.priceIqd || 0)}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-muted-foreground text-xs">الشحن</p>
                      <p className="font-bold">{formatPrice(productEstimate.shippingCost)}</p>
                    </div>
                    <div className="p-2 bg-muted rounded-lg">
                      <p className="text-muted-foreground text-xs">العمولة</p>
                      <p className="font-bold">{formatPrice(productEstimate.commission)}</p>
                    </div>
                  </div>
                  
                  <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">الإجمالي التقديري</p>
                    <p className="text-2xl font-bold text-primary">{formatPrice(productEstimate.total)}</p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={handleAddToCart}
                      className="flex-1 gap-2"
                    >
                      <ShoppingCart className="w-4 h-4" />
                      إضافة للطلبات
                    </Button>
                    <Button
                      variant="outline"
                      onClick={handleCalculateShipping}
                      disabled={isCalculating}
                    >
                      <RotateCw className={`w-4 h-4 ${isCalculating ? 'animate-spin' : ''}`} />
                    </Button>
                  </div>
                  
                  <p className="text-xs text-amber-600 text-center">
                    ⚠️ هذه تكلفة تقديرية وقد تختلف عن السعر النهائي
                  </p>
                </div>
              )}
            </div>
          </CollapsibleContent>
        </div>
      </Collapsible>
    </div>
  );
}
