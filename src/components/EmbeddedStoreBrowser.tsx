import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { X, ShoppingCart, Package, Loader2, ExternalLink, Copy, Check, Globe } from 'lucide-react';
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
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();

  const handleOpenStore = () => {
    window.open(storeUrl, '_blank');
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

        {/* Store Card */}
        <Card className="mb-6">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Globe className="w-5 h-5" />
                تصفح المتجر
              </CardTitle>
              <Button onClick={handleOpenStore} className="gap-2">
                <ExternalLink className="w-4 h-4" />
                فتح المتجر
              </Button>
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
                💡 افتح المتجر، اختر المنتج، وانسخ رابطه هنا لحساب التكلفة
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
