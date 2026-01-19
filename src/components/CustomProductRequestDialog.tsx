import { useState, useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useQueryClient } from '@tanstack/react-query';
import { z } from 'zod';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from './ui/dialog';
import { Button } from './ui/button';
import { Input } from './ui/input';
import { Label } from './ui/label';
import { Textarea } from './ui/textarea';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from './ui/form';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from './ui/select';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Package, Loader2, X, Ship, Plane, Globe, Sparkles, ChevronDown, ChevronUp, Calculator } from 'lucide-react';
import { useShippingSettings, calculateShippingCost, type SourceCountry, type ShippingType, type ProductDimensions } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from './ui/collapsible';

const customProductSchema = z.object({
  product_link: z.string().url({ message: 'الرجاء إدخال رابط صحيح' }).min(1, 'رابط المنتج مطلوب'),
  product_name: z.string().min(1, 'اسم المنتج مطلوب').max(200, 'الاسم طويل جداً'),
  quantity: z.number().min(1, 'الكمية يجب أن تكون 1 على الأقل').max(100, 'الكمية كبيرة جداً'),
  description: z.string().max(1000, 'الوصف طويل جداً').optional(),
});

type CustomProductFormData = z.infer<typeof customProductSchema>;

interface CustomProductRequestDialogProps {
  children: React.ReactNode;
}

interface AICalculationResult {
  dimensions: ProductDimensions | null;
  weight: number | null;
  priceUsd: number | null;
  priceIqd: number | null;
  source: string;
  estimated: boolean;
  notes: string | null;
}

const CustomProductRequestDialog = ({ children }: CustomProductRequestDialogProps) => {
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const { user } = useAuth();
  
  // Shipping options
  const [sourceCountry, setSourceCountry] = useState<SourceCountry>('china');
  const [shippingType, setShippingType] = useState<ShippingType>('sea');
  
  // AI Calculation state
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  const [aiResult, setAiResult] = useState<AICalculationResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  
  const { data: shippingSettings } = useShippingSettings();

  const form = useForm<CustomProductFormData>({
    resolver: zodResolver(customProductSchema),
    defaultValues: {
      product_link: '',
      product_name: '',
      quantity: 1,
      description: '',
    },
  });

  // Reset shipping type if sea is selected for USA
  useEffect(() => {
    if (sourceCountry === 'usa' && shippingType === 'sea') {
      setShippingType('air');
    }
  }, [sourceCountry, shippingType]);

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
      setOpen(false);
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
    setSourceCountry('china');
    setShippingType('sea');
    setAiResult(null);
    setShowDetails(false);
  };

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      setOpen(isOpen);
      if (!isOpen) resetForm();
    }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <Package className="w-6 h-6" />
            طلب منتج مخصص
          </DialogTitle>
          <DialogDescription>
            أدخل تفاصيل المنتج الذي ترغب في طلبه وسنحسب لك التكلفة التقديرية
          </DialogDescription>
        </DialogHeader>

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

            {/* Country & Shipping Type Selection */}
            <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg border border-border/50">
              <div className="space-y-2">
                <Label className="flex items-center gap-2">
                  <Globe className="h-4 w-4" />
                  دولة الشحن
                </Label>
                <Select value={sourceCountry} onValueChange={(v) => {
                  setSourceCountry(v as SourceCountry);
                  setAiResult(null); // Reset AI result when country changes
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
                  setAiResult(null); // Reset AI result when type changes
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
              <div className="space-y-3 p-4 bg-gradient-to-br from-primary/5 to-accent/5 rounded-lg border border-primary/20">
                {/* Main Price Summary */}
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
                  
                  {/* Total Estimate */}
                  {aiResult.priceIqd && shippingCalculation && (
                    <div className="p-3 bg-primary/10 rounded-lg border border-primary/30">
                      <p className="text-xs text-muted-foreground mb-1">الإجمالي التقديري (منتج + شحن + عمولة)</p>
                      <p className="text-2xl font-bold text-primary">
                        {formatPrice(aiResult.priceIqd + shippingCalculation.totalCost)}
                      </p>
                    </div>
                  )}
                </div>

                {/* Source info */}
                <div className="flex items-center justify-center gap-2 text-xs text-muted-foreground">
                  <Sparkles className="h-3 w-3" />
                  {aiResult.estimated ? 'تقدير بالذكاء الاصطناعي' : 'مواصفات دقيقة'}
                  {aiResult.source && ` - ${aiResult.source}`}
                </div>

                {/* Collapsible Details */}
                <Collapsible open={showDetails} onOpenChange={setShowDetails}>
                  <CollapsibleTrigger asChild>
                    <Button variant="ghost" size="sm" className="w-full gap-2">
                      <Calculator className="h-4 w-4" />
                      {showDetails ? 'إخفاء التفاصيل' : 'عرض التفاصيل'}
                      {showDetails ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                    </Button>
                  </CollapsibleTrigger>
                  <CollapsibleContent className="mt-2 space-y-2">
                    {/* Dimensions & Weight */}
                    {aiResult.dimensions && (
                      <div className="p-2 bg-background rounded text-sm">
                        <span className="text-muted-foreground">الأبعاد: </span>
                        <span className="font-medium">
                          {aiResult.dimensions.length} × {aiResult.dimensions.width} × {aiResult.dimensions.height} سم
                        </span>
                      </div>
                    )}
                    {aiResult.weight && (
                      <div className="p-2 bg-background rounded text-sm">
                        <span className="text-muted-foreground">الوزن: </span>
                        <span className="font-medium">{aiResult.weight} كغ</span>
                      </div>
                    )}
                    
                    {/* Shipping Breakdown */}
                    {shippingCalculation && shippingCalculation.breakdown.length > 0 && (
                      <div className="p-2 bg-background rounded space-y-1">
                        <p className="text-xs font-medium text-muted-foreground mb-2">تفاصيل حساب الشحن:</p>
                        {shippingCalculation.breakdown.map((item, idx) => (
                          <div key={idx} className="flex justify-between text-sm">
                            <span className="text-muted-foreground">{item.label}:</span>
                            <span className={item.label === 'الإجمالي' ? 'font-bold text-primary' : ''}>
                              {typeof item.value === 'number' && 
                               !item.label.includes('CBM') && 
                               !item.label.includes('المقسوم') &&
                               !item.label.includes('كغ')
                                ? formatPrice(item.value as number) 
                                : item.value}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                    
                    {/* Notes */}
                    {aiResult.notes && (
                      <p className="text-xs text-amber-600 p-2 bg-amber-50 dark:bg-amber-950/30 rounded">
                        💡 {aiResult.notes}
                      </p>
                    )}
                    
                    {shippingCalculation?.notes.map((note, idx) => (
                      <p key={idx} className="text-xs text-muted-foreground">⚠️ {note}</p>
                    ))}
                  </CollapsibleContent>
                </Collapsible>
              </div>
            )}

            {/* Image Upload */}
            <div className="space-y-2">
              <Label htmlFor="image">صورة المنتج (اختياري)</Label>
              <Input
                id="image"
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                disabled={isSubmitting}
              />
              {imagePreview && (
                <div className="relative w-full h-48 mt-2 rounded-lg overflow-hidden border border-border">
                  <img
                    src={imagePreview}
                    alt="معاينة الصورة"
                    className="w-full h-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedImage(null);
                      setImagePreview(null);
                    }}
                    className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1 hover:bg-destructive/90"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>
              )}
              <p className="text-xs text-muted-foreground">
                الحد الأقصى لحجم الملف: 5 ميجابايت
              </p>
            </div>

            <FormField
              control={form.control}
              name="description"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>وصف إضافي (اختياري)</FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="أي ملاحظات أو متطلبات إضافية..."
                      rows={3}
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-b from-primary to-accent"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإرسال...
                  </>
                ) : (
                  'إرسال الطلب'
                )}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setOpen(false)}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
};

export default CustomProductRequestDialog;
