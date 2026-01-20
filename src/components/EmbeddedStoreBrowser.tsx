import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, ExternalLink, X, ShoppingCart, Package, Loader2, Sparkles, Link as LinkIcon } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { useShippingSettings, calculateShippingCost, type ShippingType } from '@/hooks/useShippingCalculator';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';

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
  dimensions: { length: number; width: number; height: number } | null;
  weight: number | null;
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
  const [isAddingToCart, setIsAddingToCart] = useState(false);
  const { user } = useAuth();
  const { data: shippingSettings } = useShippingSettings();

  const handleCalculateShipping = async () => {
    if (!productUrl.trim()) {
      toast.error('يرجى إدخال رابط المنتج أولاً');
      return;
    }

    setIsCalculating(true);
    setProductEstimate(null);

    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: {
          productUrl: productUrl,
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
          dimensions: specs.dimensions || null,
          weight: specs.weight || null
        });
        
        toast.success('تم حساب تكلفة الشحن بنجاح');
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

  const handleAddToCart = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    if (!productEstimate) {
      toast.error('يرجى حساب تكلفة الشحن أولاً');
      return;
    }

    setIsAddingToCart(true);

    try {
      const { error } = await supabase.from('custom_product_requests').insert({
        user_id: user.id,
        product_link: productUrl,
        product_name: productEstimate.productName,
        quantity: 1,
        source_country: 'usa',
        shipping_type: 'air',
        estimated_shipping_cost: productEstimate.shippingCost + productEstimate.commission,
        product_dimensions: productEstimate.dimensions,
        product_weight: productEstimate.weight,
        status: 'pending'
      });

      if (error) throw error;

      // Send Telegram notification
      try {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username')
          .eq('id', user.id)
          .single();
        
        const userName = profile?.full_name || profile?.username || 'مستخدم';
        
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `📦 <b>طلب منتج من ${storeName}</b>\n\n👤 المستخدم: ${userName}\n📝 المنتج: ${productEstimate.productName}\n💰 سعر المنتج: ${productEstimate.priceIqd ? formatPrice(productEstimate.priceIqd) : 'غير محدد'}\n📦 تكلفة الشحن: ${formatPrice(productEstimate.shippingCost)}\n💵 عمولتنا: ${formatPrice(productEstimate.commission)}\n🔗 الرابط: ${productUrl}`,
          },
        });
      } catch (telegramError) {
        console.error('Telegram error:', telegramError);
      }

      toast.success('تم إضافة المنتج لطلباتك! سنتواصل معك قريباً');
      setProductUrl('');
      setProductEstimate(null);
    } catch (error) {
      console.error('Error adding to cart:', error);
      toast.error('حدث خطأ في إضافة المنتج');
    } finally {
      setIsAddingToCart(false);
    }
  };

  const handleOpenStore = () => {
    window.open(storeUrl, '_blank');
  };

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-2xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Button variant="ghost" size="icon" onClick={onClose}>
            <ArrowLeft className="w-5 h-5" />
          </Button>
          <div className="flex-1">
            <h1 className="text-xl font-bold">{storeName}</h1>
            <p className="text-sm text-muted-foreground">
              📍 {storeAddress.city}, {storeAddress.state} - {storeAddress.zip_code}
            </p>
          </div>
        </div>

        {/* Open Store Button */}
        <Card className="mb-6">
          <CardContent className="p-6 text-center space-y-4">
            <Package className="w-16 h-16 mx-auto text-primary/50" />
            <div>
              <h2 className="text-lg font-bold mb-2">تصفح {storeName}</h2>
              <p className="text-muted-foreground text-sm mb-4">
                افتح المتجر في نافذة جديدة، ثم انسخ رابط المنتج الذي تريده وألصقه هنا لحساب التكلفة
              </p>
            </div>
            <Button onClick={handleOpenStore} className="gap-2">
              <ExternalLink className="w-4 h-4" />
              فتح {storeName}
            </Button>
          </CardContent>
        </Card>

        {/* Product URL Input */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <LinkIcon className="w-5 h-5" />
              رابط المنتج
            </CardTitle>
            <CardDescription>
              الصق رابط المنتج من {storeName} لحساب تكلفة الشحن
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <Input
              value={productUrl}
              onChange={(e) => setProductUrl(e.target.value)}
              placeholder={`مثال: ${storeUrl}/product/...`}
              dir="ltr"
              className="text-sm"
            />

            {/* Calculate Button */}
            <Button
              onClick={handleCalculateShipping}
              disabled={isCalculating || !productUrl.trim()}
              className="w-full gap-2 bg-gradient-to-r from-primary/90 to-accent/90 hover:from-primary hover:to-accent"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  جاري حساب التكلفة...
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  حساب التكلفة بالذكاء الاصطناعي
                </>
              )}
            </Button>

            {/* Results */}
            {productEstimate && (
              <div className="space-y-4 p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/20">
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
                  <div className="p-2 bg-background rounded-lg">
                    <p className="text-muted-foreground text-xs">سعر المنتج</p>
                    <p className="font-bold">{formatPrice(productEstimate.priceIqd || 0)}</p>
                  </div>
                  <div className="p-2 bg-background rounded-lg">
                    <p className="text-muted-foreground text-xs">الشحن</p>
                    <p className="font-bold">{formatPrice(productEstimate.shippingCost)}</p>
                  </div>
                  <div className="p-2 bg-background rounded-lg">
                    <p className="text-muted-foreground text-xs">العمولة</p>
                    <p className="font-bold">{formatPrice(productEstimate.commission)}</p>
                  </div>
                </div>

                {/* Additional details */}
                {(productEstimate.dimensions || productEstimate.weight) && (
                  <div className="grid grid-cols-2 gap-2 text-sm">
                    {productEstimate.dimensions && (
                      <div className="p-2 bg-background rounded text-center">
                        <span className="text-muted-foreground text-xs">الأبعاد: </span>
                        <span className="font-medium">
                          {productEstimate.dimensions.length} × {productEstimate.dimensions.width} × {productEstimate.dimensions.height} سم
                        </span>
                      </div>
                    )}
                    {productEstimate.weight && (
                      <div className="p-2 bg-background rounded text-center">
                        <span className="text-muted-foreground text-xs">الوزن: </span>
                        <span className="font-medium">{productEstimate.weight} كجم</span>
                      </div>
                    )}
                  </div>
                )}
                
                <div className="p-3 bg-primary/10 rounded-lg text-center border border-primary/20">
                  <p className="text-xs text-muted-foreground mb-1">الإجمالي التقديري</p>
                  <p className="text-2xl font-bold text-primary">{formatPrice(productEstimate.total)}</p>
                </div>
                
                <Button 
                  onClick={handleAddToCart}
                  disabled={isAddingToCart}
                  className="w-full gap-2"
                >
                  {isAddingToCart ? (
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
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
