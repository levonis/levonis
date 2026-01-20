import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient, useQuery } from '@tanstack/react-query';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Separator } from '@/components/ui/separator';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Package, Loader2, X, Ship, Plane, Globe, Sparkles, ChevronDown, ChevronUp, Upload, Store, ExternalLink, ArrowRight } from 'lucide-react';
import { useShippingSettings, calculateShippingCost, type SourceCountry, type ShippingType, type ProductDimensions } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { useNavigate } from 'react-router-dom';
import EmbeddedStoreBrowser from '@/components/EmbeddedStoreBrowser';

const customProductSchema = z.object({
  product_link: z.string().url({ message: 'الرجاء إدخال رابط صحيح' }).min(1, 'رابط المنتج مطلوب'),
  product_name: z.string().min(1, 'اسم المنتج مطلوب').max(200, 'الاسم طويل جداً'),
  quantity: z.number().min(1, 'الكمية يجب أن تكون 1 على الأقل').max(100, 'الكمية كبيرة جداً'),
  description: z.string().max(1000, 'الوصف طويل جداً').optional(),
});

type CustomProductFormData = z.infer<typeof customProductSchema>;

interface AICalculationResult {
  dimensions: ProductDimensions | null;
  weight: number | null;
  priceUsd: number | null;
  priceIqd: number | null;
  source: string;
  estimated: boolean;
  notes: string | null;
}

interface StoreConfig {
  name_ar: string;
  logo_url: string;
  base_url: string;
  address: {
    country: string;
    state: string;
    city: string;
    zip_code: string;
    street: string;
  };
}

interface StoreSettings {
  amazon: StoreConfig;
  newegg: StoreConfig;
  bestbuy: StoreConfig;
}

export default function CustomProductRequest() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user, loading: authLoading } = useAuth();
  
  // Shipping options
  const [sourceCountry, setSourceCountry] = useState<SourceCountry>('usa');
  const [shippingType, setShippingType] = useState<ShippingType>('air');
  
  // AI Calculation state
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AICalculationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  // Embedded store state
  const [selectedStore, setSelectedStore] = useState<string | null>(null);
  
  const { data: shippingSettings } = useShippingSettings();

  // Fetch store settings
  const { data: storeSettings } = useQuery({
    queryKey: ['external-store-addresses'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'external_store_addresses')
        .single();
      
      if (error) throw error;
      return data?.setting_value as unknown as StoreSettings;
    }
  });

  const form = useForm<CustomProductFormData>({
    resolver: zodResolver(customProductSchema),
    defaultValues: {
      product_link: '',
      product_name: '',
      quantity: 1,
      description: '',
    },
  });

  // Redirect to auth if not logged in
  useEffect(() => {
    if (!authLoading && !user) {
      navigate('/auth');
    }
  }, [user, authLoading, navigate]);

  // Calculate shipping based on AI result
  const shippingCalculation = shippingSettings && aiResult && (
    (aiResult.dimensions && aiResult.dimensions.length > 0) || (aiResult.weight && aiResult.weight > 0)
  )
    ? calculateShippingCost(
        sourceCountry, 
        shippingType, 
        aiResult.dimensions, 
        aiResult.weight, 
        shippingSettings
      )
    : null;

  // AI-powered calculation
  const handleAICalculate = async () => {
    const productName = form.getValues('product_name');
    const productLink = form.getValues('product_link');
    
    if (!productName && !productLink) {
      toast.error('يرجى إدخال اسم المنتج أو الرابط أولاً');
      return;
    }
    
    setIsCalculatingAI(true);
    setAiResult(null);
    
    try {
      const { data, error } = await supabase.functions.invoke('calculate-shipping-ai', {
        body: { 
          productName, 
          productUrl: productLink,
          sourceCountry,
          shippingType 
        }
      });
      
      if (error) throw error;
      
      if (data?.success && data?.data) {
        const specs = data.data;
        
        setAiResult({
          dimensions: specs.dimensions || null,
          weight: specs.weight || null,
          priceUsd: specs.price_usd || null,
          priceIqd: specs.price_iqd || null,
          source: specs.source || '',
          estimated: specs.estimated ?? true,
          notes: specs.notes || null
        });
        
        setShowDetails(true);
        toast.success('تم حساب التكلفة التقديرية بنجاح');
      } else {
        toast.error(data?.error || 'لم يتم العثور على مواصفات المنتج');
      }
    } catch (error) {
      console.error('AI calculation error:', error);
      toast.error('حدث خطأ في حساب التكلفة');
    } finally {
      setIsCalculatingAI(false);
    }
  };

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('حجم الصورة يجب أن يكون أقل من 5 ميجابايت');
        return;
      }
      
      if (!file.type.startsWith('image/')) {
        toast.error('يرجى اختيار ملف صورة');
        return;
      }

      setSelectedImage(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const uploadImage = async (): Promise<string | null> => {
    if (!selectedImage || !user) return null;

    const fileExt = selectedImage.name.split('.').pop();
    const fileName = `${user.id}/${Date.now()}.${fileExt}`;

    const { data, error } = await supabase.storage
      .from('custom-product-images')
      .upload(fileName, selectedImage);

    if (error) {
      console.error('Error uploading image:', error);
      throw error;
    }

    const { data: { publicUrl } } = supabase.storage
      .from('custom-product-images')
      .getPublicUrl(data.path);

    return publicUrl;
  };

  const onSubmit = async (data: CustomProductFormData) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }

    setIsSubmitting(true);

    try {
      let imageUrl: string | null = null;
      
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      const insertData: any = {
        user_id: user.id,
        product_link: data.product_link,
        product_name: data.product_name,
        quantity: data.quantity,
        image_url: imageUrl,
        description: data.description || null,
        source_country: sourceCountry,
        shipping_type: shippingType,
        product_dimensions: aiResult?.dimensions || null,
        product_weight: aiResult?.weight || null,
        estimated_shipping_cost: shippingCalculation?.totalCost || null,
        shipping_notes: shippingCalculation?.notes?.join(' | ') || null,
      };

      const { error } = await supabase.from('custom_product_requests').insert(insertData);

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
            message: `📦 <b>طلب منتج مخصص جديد</b>\n\n👤 المستخدم: ${userName}\n📝 المنتج: ${data.product_name}\n🔢 الكمية: ${data.quantity}\n🌍 الدولة: ${countryLabel}\n🚚 نوع الشحن: ${shippingLabel}\n💰 سعر المنتج التقديري: ${aiResult?.priceIqd ? formatPrice(aiResult.priceIqd) : 'غير محسوب'}\n📦 تكلفة الشحن التقديرية: ${shippingCalculation?.shippingCost ? formatPrice(shippingCalculation.shippingCost) : 'غير محسوبة'}\n💵 عمولتنا: ${shippingCalculation?.commission ? formatPrice(shippingCalculation.commission) : '-'}\n🔗 الرابط: ${data.product_link}`,
          },
        });
      } catch (telegramError) {
        console.error('خطأ في إرسال إشعار التيليجرام:', telegramError);
      }

      toast.success('تم إرسال طلبك بنجاح! سنتواصل معك قريباً');
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['custom-requests'] });
      resetForm();
      navigate('/my-requests');
    } catch (error) {
      console.error('Error submitting custom product request:', error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const resetForm = () => {
    form.reset();
    setSelectedImage(null);
    setImagePreview(null);
    setSourceCountry('usa');
    setShippingType('air');
    setAiResult(null);
    setShowDetails(false);
  };

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  // If a store is selected, show embedded browser
  if (selectedStore && storeSettings) {
    const store = storeSettings[selectedStore as keyof StoreSettings];
    return (
      <EmbeddedStoreBrowser
        storeKey={selectedStore}
        storeName={store.name_ar}
        storeUrl={store.base_url}
        storeAddress={store.address}
        onClose={() => setSelectedStore(null)}
      />
    );
  }

  return (
    <div className="min-h-screen bg-background pb-20">
      <div className="container max-w-4xl mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/10 rounded-full mb-4">
            <Package className="w-5 h-5 text-primary" />
            <span className="text-primary font-medium">طلب منتج مخصص</span>
          </div>
          <h1 className="text-2xl md:text-3xl font-bold">اطلب أي منتج من أي متجر</h1>
          <p className="text-muted-foreground mt-2">أدخل رابط المنتج أو تصفح المتاجر الشهيرة</p>
        </div>

        {/* Manual Request Form */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              إرسال رابط المنتج
            </CardTitle>
            <CardDescription>
              أدخل رابط المنتج من أي متجر وسنحسب لك التكلفة التقديرية
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
                <FormField
                  control={form.control}
                  name="product_link"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>رابط المنتج *</FormLabel>
                      <FormControl>
                        <Input 
                          placeholder="https://example.com/product" 
                          {...field} 
                          dir="ltr"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="product_name"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>اسم المنتج *</FormLabel>
                        <FormControl>
                          <Input placeholder="مثال: Intel Core i9-14900K" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="quantity"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>الكمية *</FormLabel>
                        <FormControl>
                          <Input 
                            type="number" 
                            min={1}
                            max={100}
                            {...field}
                            onChange={(e) => field.onChange(parseInt(e.target.value) || 1)}
                          />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Country & Shipping Type Selection */}
                <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      <Globe className="h-4 w-4" />
                      دولة الشحن
                    </Label>
                    <Select value={sourceCountry} onValueChange={(v) => {
                      setSourceCountry(v as SourceCountry);
                      setAiResult(null);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="china">🇨🇳 الصين</SelectItem>
                        <SelectItem value="usa">🇺🇸 أمريكا</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  <div className="space-y-2">
                    <Label className="flex items-center gap-2">
                      {shippingType === 'sea' ? <Ship className="h-4 w-4" /> : <Plane className="h-4 w-4" />}
                      نوع الشحن
                    </Label>
                    <Select value={shippingType} onValueChange={(v) => {
                      setShippingType(v as ShippingType);
                      setAiResult(null);
                    }}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {sourceCountry === 'china' && (
                          <SelectItem value="sea">
                            <span className="flex items-center gap-2">
                              <Ship className="h-4 w-4" />
                              شحن بحري
                            </span>
                          </SelectItem>
                        )}
                        <SelectItem value="air">
                          <span className="flex items-center gap-2">
                            <Plane className="h-4 w-4" />
                            شحن جوي
                          </span>
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>ملاحظات إضافية (اختياري)</FormLabel>
                      <FormControl>
                        <Textarea 
                          placeholder="أضف أي ملاحظات مثل اللون المطلوب أو المواصفات الخاصة..."
                          className="resize-none"
                          rows={3}
                          {...field}
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Image Upload */}
                <div className="space-y-2">
                  <Label>صورة المنتج (اختياري)</Label>
                  <div className="flex items-center gap-4">
                    <label className="flex-1 flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-border rounded-lg cursor-pointer hover:bg-muted/50 transition-colors">
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-muted-foreground">اختر صورة</span>
                      <input 
                        type="file" 
                        accept="image/*" 
                        className="hidden" 
                        onChange={handleImageChange}
                      />
                    </label>
                    {imagePreview && (
                      <div className="relative w-16 h-16">
                        <img 
                          src={imagePreview} 
                          alt="Preview" 
                          className="w-full h-full object-cover rounded-lg"
                        />
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedImage(null);
                            setImagePreview(null);
                          }}
                          className="absolute -top-2 -right-2 w-5 h-5 bg-destructive text-destructive-foreground rounded-full flex items-center justify-center"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* AI Calculate Button */}
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleAICalculate}
                  disabled={isCalculatingAI}
                  className="w-full gap-2 bg-gradient-to-r from-primary/10 to-accent/10 hover:from-primary/20 hover:to-accent/20 border-primary/30"
                >
                  {isCalculatingAI ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري حساب التكلفة التقديرية...
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-5 w-5" />
                      حساب التكلفة التقديرية بالذكاء الاصطناعي
                    </>
                  )}
                </Button>

                {/* AI Calculation Results */}
                {aiResult && (
                  <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                    <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/20">
                      <div className="text-center space-y-2">
                        {aiResult.priceIqd && (
                          <div className="p-3 bg-background rounded-lg">
                            <p className="text-xs text-muted-foreground mb-1">سعر المنتج التقديري</p>
                            <p className="text-2xl font-bold text-primary">{formatPrice(aiResult.priceIqd)}</p>
                            {aiResult.priceUsd && (
                              <p className="text-xs text-muted-foreground">${aiResult.priceUsd.toFixed(2)} USD</p>
                            )}
                          </div>
                        )}
                        
                        {shippingCalculation && shippingCalculation.totalCost > 0 && (
                          <div className="grid grid-cols-2 gap-2">
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">تكلفة الشحن</p>
                              <p className="text-lg font-bold">{formatPrice(shippingCalculation.shippingCost)}</p>
                            </div>
                            <div className="p-3 bg-background rounded-lg">
                              <p className="text-xs text-muted-foreground mb-1">عمولتنا</p>
                              <p className="text-lg font-bold">{formatPrice(shippingCalculation.commission)}</p>
                            </div>
                          </div>
                        )}
                        
                        {aiResult.priceIqd && shippingCalculation && (
                          <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                            <p className="text-xs text-muted-foreground mb-1">الإجمالي التقديري</p>
                            <p className="text-2xl font-bold text-primary">
                              {formatPrice(aiResult.priceIqd + shippingCalculation.totalCost)}
                            </p>
                          </div>
                        )}
                      </div>

                      <CollapsibleTrigger asChild>
                        <Button variant="ghost" size="sm" className="w-full gap-2">
                          {showDetails ? (
                            <>
                              إخفاء التفاصيل <ChevronUp className="h-4 w-4" />
                            </>
                          ) : (
                            <>
                              عرض التفاصيل <ChevronDown className="h-4 w-4" />
                            </>
                          )}
                        </Button>
                      </CollapsibleTrigger>

                      <CollapsibleContent className="space-y-2">
                        {aiResult.dimensions && (
                          <div className="text-sm bg-background p-2 rounded">
                            <span className="text-muted-foreground">الأبعاد: </span>
                            {aiResult.dimensions.length} × {aiResult.dimensions.width} × {aiResult.dimensions.height} سم
                          </div>
                        )}
                        {aiResult.weight && (
                          <div className="text-sm bg-background p-2 rounded">
                            <span className="text-muted-foreground">الوزن: </span>
                            {aiResult.weight} كجم
                          </div>
                        )}
                        {aiResult.notes && (
                          <div className="text-xs text-muted-foreground bg-background p-2 rounded">
                            {aiResult.notes}
                          </div>
                        )}
                        {aiResult.estimated && (
                          <p className="text-xs text-amber-600 text-center">
                            ⚠️ هذه قيم تقديرية وقد تختلف عن السعر الفعلي
                          </p>
                        )}
                      </CollapsibleContent>
                    </div>
                  </Collapsible>
                )}

                <Button type="submit" disabled={isSubmitting} className="w-full gap-2">
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-5 w-5 animate-spin" />
                      جاري الإرسال...
                    </>
                  ) : (
                    <>
                      <Package className="h-5 w-5" />
                      إرسال الطلب
                    </>
                  )}
                </Button>
              </form>
            </Form>
          </CardContent>
        </Card>

        {/* Separator */}
        <div className="relative my-8">
          <Separator />
          <span className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 bg-background px-4 text-muted-foreground text-sm">
            أو تصفح المتاجر الشهيرة
          </span>
        </div>

        {/* Popular Stores Section */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Store className="w-5 h-5" />
              المتاجر الشهيرة
            </CardTitle>
            <CardDescription>
              اختر متجراً لتصفح المنتجات مباشرة وإضافتها للسلة
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {storeSettings && Object.entries(storeSettings).map(([key, store]) => (
                <button
                  key={key}
                  onClick={() => setSelectedStore(key)}
                  className="flex flex-col items-center gap-3 p-6 rounded-xl border-2 border-border hover:border-primary/50 hover:bg-primary/5 transition-all group"
                >
                  <div className="w-20 h-12 flex items-center justify-center">
                    <img 
                      src={store.logo_url} 
                      alt={store.name_ar}
                      className="max-w-full max-h-full object-contain"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = '/placeholder.svg';
                      }}
                    />
                  </div>
                  <span className="font-medium">{store.name_ar}</span>
                  <span className="text-xs text-muted-foreground flex items-center gap-1">
                    تصفح المنتجات
                    <ArrowRight className="w-3 h-3 group-hover:translate-x-1 transition-transform" />
                  </span>
                </button>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
