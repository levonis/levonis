import { useState } from 'react';
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
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Package, Loader2, X } from 'lucide-react';

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

  const form = useForm<CustomProductFormData>({
    resolver: zodResolver(customProductSchema),
    defaultValues: {
      product_link: '',
      product_name: '',
      quantity: 1,
      description: '',
    },
  });

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
      
      // Upload image if selected
      if (selectedImage) {
        imageUrl = await uploadImage();
      }

      const { error } = await supabase.from('custom_product_requests').insert({
        user_id: user.id,
        product_link: data.product_link,
        product_name: data.product_name,
        quantity: data.quantity,
        image_url: imageUrl,
        description: data.description || null,
      });

      if (error) throw error;

      toast.success('تم إرسال طلبك بنجاح! سنتواصل معك قريباً');
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
      queryClient.invalidateQueries({ queryKey: ['custom-requests'] });
      form.reset();
      setSelectedImage(null);
      setImagePreview(null);
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
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto">
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