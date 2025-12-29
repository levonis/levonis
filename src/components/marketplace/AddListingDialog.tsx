import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Plus, Upload, X, Loader2 } from 'lucide-react';

interface AddListingDialogProps {
  children?: React.ReactNode;
}

const conditionOptions = [
  { value: 'new', label: 'جديد' },
  { value: 'like_new', label: 'شبه جديد' },
  { value: 'good', label: 'جيد' },
  { value: 'used', label: 'مستعمل' },
  { value: 'for_parts', label: 'للقطع' },
];

const shippingOptions = [
  { value: 'through_site', label: 'عبر الموقع (موصى به)' },
  { value: 'direct', label: 'توصيل مباشر للمشتري' },
];

export const AddListingDialog = ({ children }: AddListingDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  
  const [formData, setFormData] = useState({
    title_ar: '',
    title: '',
    description_ar: '',
    description: '',
    price: '',
    condition: 'used',
    category_id: '',
    shipping_method: 'through_site',
    location: '',
  });

  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('categories')
        .select('id, name_ar')
        .order('name_ar');
      if (error) throw error;
      return data;
    },
  });

  const { data: feeSettings } = useQuery({
    queryKey: ['listing-fee-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_fees_settings')
        .select('*')
        .eq('is_active', true)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const createListingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const { data, error } = await supabase
        .from('user_listings')
        .insert({
          seller_id: user.id,
          title_ar: formData.title_ar,
          title: formData.title || formData.title_ar,
          description_ar: formData.description_ar,
          description: formData.description || formData.description_ar,
          price: parseFloat(formData.price),
          condition: formData.condition,
          category_id: formData.category_id || null,
          shipping_method: formData.shipping_method,
          location: formData.location,
          images,
        })
        .select()
        .single();
      
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم إرسال المنتج للمراجعة');
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['user-listings'] });
      setOpen(false);
      resetForm();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const resetForm = () => {
    setFormData({
      title_ar: '',
      title: '',
      description_ar: '',
      description: '',
      price: '',
      condition: 'used',
      category_id: '',
      shipping_method: 'through_site',
      location: '',
    });
    setImages([]);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;

    setUploading(true);
    try {
      for (const file of Array.from(files)) {
        const fileExt = file.name.split('.').pop();
        const fileName = `${user.id}/${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('listing-images')
          .upload(fileName, file);
        
        if (uploadError) {
          // Try creating the bucket if it doesn't exist
          if (uploadError.message.includes('not found')) {
            toast.error('مشكلة في رفع الصورة');
            continue;
          }
          throw uploadError;
        }
        
        const { data: { publicUrl } } = supabase.storage
          .from('listing-images')
          .getPublicUrl(fileName);
        
        setImages(prev => [...prev, publicUrl]);
      }
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_ar || !formData.price) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    createListingMutation.mutate();
  };

  const calculateFee = () => {
    if (!feeSettings || !formData.price) return 0;
    const price = parseFloat(formData.price);
    if (feeSettings.fee_type === 'percentage') {
      let fee = (price * feeSettings.fee_value) / 100;
      if (feeSettings.min_fee && fee < feeSettings.min_fee) fee = feeSettings.min_fee;
      if (feeSettings.max_fee && fee > feeSettings.max_fee) fee = feeSettings.max_fee;
      return fee;
    }
    return feeSettings.fee_value;
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {children || (
          <Button size="sm" className="gap-2">
            <Plus className="w-4 h-4" />
            أضف منتج للبيع
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-right">إضافة منتج للبيع</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Fee Notice */}
          {feeSettings && (
            <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
              <p className="text-primary font-medium">رسوم المنصة:</p>
              <p className="text-muted-foreground">{feeSettings.terms_ar}</p>
              {formData.price && (
                <p className="mt-1">
                  الرسوم المتوقعة: <span className="font-bold text-primary">{calculateFee().toLocaleString()} دينار</span>
                </p>
              )}
            </div>
          )}

          {/* Images */}
          <div className="space-y-2">
            <Label>صور المنتج</Label>
            <div className="flex flex-wrap gap-2">
              {images.map((img, idx) => (
                <div key={idx} className="relative w-20 h-20">
                  <img src={img} alt="" className="w-full h-full object-cover rounded-lg" />
                  <button
                    type="button"
                    onClick={() => removeImage(idx)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ))}
              <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex items-center justify-center cursor-pointer hover:border-primary transition-colors">
                {uploading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <Upload className="w-5 h-5 text-muted-foreground" />
                )}
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleImageUpload}
                  className="hidden"
                  disabled={uploading}
                />
              </label>
            </div>
          </div>

          {/* Title */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>عنوان المنتج (عربي) *</Label>
              <Input
                value={formData.title_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))}
                placeholder="مثال: ايفون 14 برو ماكس"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>عنوان المنتج (إنجليزي)</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="iPhone 14 Pro Max"
              />
            </div>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label>الوصف (عربي)</Label>
            <Textarea
              value={formData.description_ar}
              onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))}
              placeholder="وصف تفصيلي للمنتج..."
              rows={3}
            />
          </div>

          {/* Price & Condition */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="space-y-2">
              <Label>السعر (دينار) *</Label>
              <Input
                type="number"
                value={formData.price}
                onChange={(e) => setFormData(prev => ({ ...prev, price: e.target.value }))}
                placeholder="100000"
                required
              />
            </div>
            <div className="space-y-2">
              <Label>الحالة</Label>
              <Select
                value={formData.condition}
                onValueChange={(value) => setFormData(prev => ({ ...prev, condition: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {conditionOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>القسم</Label>
              <Select
                value={formData.category_id}
                onValueChange={(value) => setFormData(prev => ({ ...prev, category_id: value }))}
              >
                <SelectTrigger>
                  <SelectValue placeholder="اختر القسم" />
                </SelectTrigger>
                <SelectContent>
                  {categories?.map(cat => (
                    <SelectItem key={cat.id} value={cat.id}>{cat.name_ar}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Shipping & Location */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>طريقة الشحن</Label>
              <Select
                value={formData.shipping_method}
                onValueChange={(value) => setFormData(prev => ({ ...prev, shipping_method: value }))}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {shippingOptions.map(opt => (
                    <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="مثال: بغداد، الكرادة"
              />
            </div>
          </div>

          {/* Terms */}
          <div className="bg-muted/50 rounded-lg p-3 text-sm text-muted-foreground">
            <p className="font-medium mb-1">شروط البيع:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>سيتم مراجعة منتجك قبل نشره</li>
              <li>جميع المعاملات تتم عبر الموقع لضمان حقوق الطرفين</li>
              <li>يتم خصم رسوم المنصة عند إتمام البيع</li>
              <li>يمكنك تعديل أو حذف منتجك في أي وقت</li>
            </ul>
          </div>

          <div className="flex gap-3 justify-end">
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              إلغاء
            </Button>
            <Button type="submit" disabled={createListingMutation.isPending}>
              {createListingMutation.isPending ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin ml-2" />
                  جاري الإرسال...
                </>
              ) : (
                'إرسال للمراجعة'
              )}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default AddListingDialog;
