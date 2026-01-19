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
import { Package, Loader2, X, Ship, Plane, Calculator, Globe, Sparkles } from 'lucide-react';
import { useShippingSettings, calculateShippingCost, type SourceCountry, type ShippingType, type ProductDimensions } from '@/hooks/useShippingCalculator';
import { formatPrice } from '@/lib/utils';

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
  const [dimensions, setDimensions] = useState<ProductDimensions>({ length: 0, width: 0, height: 0 });
  const [weight, setWeight] = useState<number>(0);
  const [showShippingCalculator, setShowShippingCalculator] = useState(false);
  const [isCalculatingAI, setIsCalculatingAI] = useState(false);
  const [aiSpecsSource, setAiSpecsSource] = useState<string | null>(null);
  
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

  const shippingCalculation = shippingSettings && (dimensions.length > 0 || weight > 0)
    ? calculateShippingCost(sourceCountry, shippingType, dimensions.length > 0 ? dimensions : null, weight > 0 ? weight : null, shippingSettings)
    : null;

  // AI-powered shipping calculation
  const handleAICalculate = async () => {
    const productName = form.getValues('product_name');
    const productLink = form.getValues('product_link');
    
    if (!productName && !productLink) {
      toast.error('يرجى إدخال اسم المنتج أو الرابط أولاً');
      return;
    }
    
    setIsCalculatingAI(true);
    setAiSpecsSource(null);
    
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
        
        if (specs.dimensions) {
          setDimensions({
            length: specs.dimensions.length || 0,
            width: specs.dimensions.width || 0,
            height: specs.dimensions.height || 0
          });
        }
        
        if (specs.weight) {
          setWeight(specs.weight);
        }
        
        setAiSpecsSource(specs.estimated 
          ? `تقدير: ${specs.source || 'بناءً على منتجات مشابهة'}`
          : `مواصفات دقيقة${specs.source ? ': ' + specs.source : ''}`
        );
        
        if (specs.notes) {
          toast.info(specs.notes);
        }
        
        toast.success('تم حساب المواصفات بنجاح');
      } else {
        toast.error(data?.error || 'لم يتم العثور على مواصفات');
      }
    } catch (error) {
      console.error('AI calculation error:', error);
      toast.error('حدث خطأ في حساب المواصفات');
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

      const productDimensions = dimensions.length > 0 ? dimensions : null;
      const productWeight = weight > 0 ? weight : null;

      const insertData: any = {
        user_id: user.id,
        product_link: data.product_link,
        product_name: data.product_name,
        quantity: data.quantity,
        image_url: imageUrl,
        description: data.description || null,
        source_country: sourceCountry,
        shipping_type: shippingType,
        product_dimensions: productDimensions,
        product_weight: productWeight,
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
            message: `📦 <b>طلب منتج مخصص جديد</b>\n\n👤 المستخدم: ${userName}\n📝 المنتج: ${data.product_name}\n🔢 الكمية: ${data.quantity}\n🌍 الدولة: ${countryLabel}\n🚚 نوع الشحن: ${shippingLabel}\n💰 تكلفة الشحن التقديرية: ${shippingCalculation?.totalCost ? formatPrice(shippingCalculation.totalCost) : 'غير محسوبة'}\n🔗 الرابط: ${data.product_link}`,
          },
        });
      } catch (telegramError) {
        console.error('خطأ في إرسال إشعار التيليجرام:', telegramError);
      }

      toast.success('تم إرسال طلبك بنجاح! سنتواصل معك قريباً');
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['custom-requests'] });
      form.reset();
      setSelectedImage(null);
      setImagePreview(null);
      setSourceCountry('china');
      setShippingType('sea');
      setDimensions({ length: 0, width: 0, height: 0 });
      setWeight(0);
      setShowShippingCalculator(false);
      setAiSpecsSource(null);
      setOpen(false);
    } catch (error) {
      console.error('Error submitting custom product request:', error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-primary flex items-center gap-2">
            <Package className="w-6 h-6" />
            طلب منتج مخصص
          </DialogTitle>
          <DialogDescription>
            أدخل تفاصيل المنتج الذي ترغب في طلبه وسنتواصل معك
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
                <Select value={sourceCountry} onValueChange={(v) => setSourceCountry(v as SourceCountry)}>
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
                <Select value={shippingType} onValueChange={(v) => setShippingType(v as ShippingType)}>
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

            {/* Shipping Calculator Toggle */}
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowShippingCalculator(!showShippingCalculator)}
              className="w-full gap-2"
            >
              <Calculator className="h-4 w-4" />
              {showShippingCalculator ? 'إخفاء حاسبة الشحن' : 'حساب تكلفة الشحن التقديرية'}
            </Button>

            {/* Shipping Calculator */}
            {showShippingCalculator && (
              <div className="space-y-4 p-4 bg-accent/10 rounded-lg border border-accent/30">
                <div className="flex items-center justify-between">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Calculator className="h-4 w-4" />
                    حاسبة تكلفة الشحن
                  </h4>
                  
                  {/* AI Calculate Button */}
                  <Button
                    type="button"
                    variant="secondary"
                    size="sm"
                    onClick={handleAICalculate}
                    disabled={isCalculatingAI}
                    className="gap-2"
                  >
                    {isCalculatingAI ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4" />
                    )}
                    {isCalculatingAI ? 'جاري الحساب...' : 'حساب تلقائي بالذكاء الاصطناعي'}
                  </Button>
                </div>
                
                {/* AI Source Info */}
                {aiSpecsSource && (
                  <div className="text-xs text-muted-foreground bg-primary/10 p-2 rounded flex items-center gap-2">
                    <Sparkles className="h-3 w-3 text-primary" />
                    {aiSpecsSource}
                  </div>
                )}
                
                {/* Dimensions */}
                <div className="space-y-2">
                  <Label className="text-xs text-muted-foreground">أبعاد المنتج (سم) - يمكن ملؤها يدوياً أو بالذكاء الاصطناعي</Label>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <Input
                        type="number"
                        placeholder="الطول"
                        value={dimensions.length || ''}
                        onChange={(e) => setDimensions({ ...dimensions, length: Number(e.target.value) || 0 })}
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">طول</span>
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="العرض"
                        value={dimensions.width || ''}
                        onChange={(e) => setDimensions({ ...dimensions, width: Number(e.target.value) || 0 })}
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">عرض</span>
                    </div>
                    <div>
                      <Input
                        type="number"
                        placeholder="الارتفاع"
                        value={dimensions.height || ''}
                        onChange={(e) => setDimensions({ ...dimensions, height: Number(e.target.value) || 0 })}
                        min={0}
                      />
                      <span className="text-xs text-muted-foreground">ارتفاع</span>
                    </div>
                  </div>
                </div>
                
                {/* Weight (for USA air shipping) */}
                {sourceCountry === 'usa' && shippingType === 'air' && (
                  <div className="space-y-2">
                    <Label className="text-xs text-muted-foreground">وزن المنتج (كغ)</Label>
                    <Input
                      type="number"
                      placeholder="الوزن بالكيلوغرام"
                      value={weight || ''}
                      onChange={(e) => setWeight(Number(e.target.value) || 0)}
                      min={0}
                      step={0.1}
                    />
                  </div>
                )}
                
                {/* Calculation Result */}
                {shippingCalculation && shippingCalculation.totalCost > 0 && (
                  <div className="mt-4 p-3 bg-background rounded-lg border space-y-2">
                    <h5 className="font-medium text-sm">تفاصيل التكلفة التقديرية:</h5>
                    <div className="space-y-1 text-sm">
                      {shippingCalculation.breakdown.map((item, idx) => (
                        <div key={idx} className="flex justify-between">
                          <span className="text-muted-foreground">{item.label}:</span>
                          <span className={item.label === 'الإجمالي' ? 'font-bold text-primary' : ''}>
                            {typeof item.value === 'number' && item.label !== 'الحجم CBM' && item.label !== 'المقسوم عليه'
                              ? formatPrice(item.value) 
                              : item.value}
                          </span>
                        </div>
                      ))}
                    </div>
                    {shippingCalculation.notes.map((note, idx) => (
                      <p key={idx} className="text-xs text-amber-600 mt-2">⚠️ {note}</p>
                    ))}
                  </div>
                )}
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
