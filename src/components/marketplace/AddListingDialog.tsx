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
  DialogDescription,
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
import { Plus, Upload, Loader2, Receipt, ImagePlus } from 'lucide-react';
import { ImageCropper } from './ImageCropper';
import { SortableImageList } from './SortableImageList';

interface AddListingDialogProps {
  children?: React.ReactNode;
  editMode?: boolean;
  editData?: {
    id: string;
    title_ar: string;
    description_ar: string;
    price: number;
    condition: string;
    shipping_method: string;
    location: string;
    images: string[];
    usage_duration?: string;
  };
  onClose?: () => void;
}

const conditionOptions = [
  { value: 'new', label: 'جديد (لم يُستخدم)' },
  { value: 'like_new', label: 'شبه جديد (استخدام خفيف جداً)' },
  { value: 'good', label: 'جيد (آثار استخدام بسيطة)' },
  { value: 'used', label: 'مستعمل (آثار استخدام واضحة)' },
];

const usageDurationOptions = [
  { value: 'less_than_month', label: 'أقل من شهر' },
  { value: '1_3_months', label: '1-3 أشهر' },
  { value: '3_6_months', label: '3-6 أشهر' },
  { value: '6_12_months', label: '6-12 شهر' },
  { value: '1_2_years', label: '1-2 سنة' },
  { value: '2_3_years', label: '2-3 سنوات' },
  { value: 'more_than_3_years', label: 'أكثر من 3 سنوات' },
];

// Removed shipping options - customer decides this, not seller

export const AddListingDialog = ({ children, editMode = false, editData, onClose }: AddListingDialogProps) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(editMode);
  const [images, setImages] = useState<string[]>(editData?.images || []);
  const [purchaseReceiptUrl, setPurchaseReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Image cropping state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [editingImageIndex, setEditingImageIndex] = useState<number | null>(null);
  
  const [formData, setFormData] = useState({
    title_ar: editData?.title_ar || '',
    description_ar: editData?.description_ar || '',
    price: editData?.price ? String(editData.price) : '',
    original_price: (editData as any)?.original_price ? String((editData as any).original_price) : '',
    condition: editData?.condition || 'new',
    location: editData?.location || '',
    usage_duration: editData?.usage_duration || '',
  });

  const { data: feeSettings } = useQuery({
    queryKey: ['listing-fee-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('listing_fees_settings')
        .select('*')
        .eq('is_active', true)
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
  });

  const { data: userWallet } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      return data;
    },
    enabled: !!user,
  });

  const createListingMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const fee = calculateFee();
      
      // Check wallet balance if fee is required (only for new listings)
      if (!editMode && feeSettings?.is_active && fee > 0) {
        if (!userWallet || userWallet.balance < fee) {
          throw new Error('رصيد المحفظة غير كافٍ لدفع رسوم الإضافة');
        }
        
        // Deduct fee from wallet
        const { error: walletError } = await supabase
          .from('user_wallets')
          .update({ balance: userWallet.balance - fee })
          .eq('user_id', user.id);
        
        if (walletError) throw walletError;
        
        // Record transaction
        await supabase.from('wallet_transactions').insert({
          user_id: user.id,
          type: 'listing_fee',
          amount: -fee,
          status: 'completed',
        });
      }

      const listingData = {
        title_ar: formData.title_ar,
        title: formData.title_ar,
        description_ar: formData.description_ar,
        description: formData.description_ar,
        price: parseFloat(formData.price),
        original_price: formData.original_price ? parseFloat(formData.original_price) : null,
        condition: formData.condition,
        shipping_method: 'through_site', // Default shipping method
        location: formData.location,
        images,
        status: 'pending',
      };

      if (editMode && editData?.id) {
        const { error } = await supabase
          .from('user_listings')
          .update(listingData)
          .eq('id', editData.id)
          .eq('seller_id', user.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('user_listings')
          .insert({
            ...listingData,
            seller_id: user.id,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editMode ? 'تم تحديث المنتج وسيراجع من قبل الإدارة' : 'تم إرسال المنتج للمراجعة');
      queryClient.invalidateQueries({ queryKey: ['my-listings'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
      handleClose();
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  const handleClose = () => {
    setOpen(false);
    if (onClose) onClose();
    if (!editMode) {
      resetForm();
    }
  };

  const resetForm = () => {
    setFormData({
      title_ar: '',
      description_ar: '',
      price: '',
      original_price: '',
      condition: 'new',
      location: '',
      usage_duration: '',
    });
    setImages([]);
    setPurchaseReceiptUrl(null);
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    
    // Reset input
    e.target.value = '';
    
    setUploading(true);
    try {
      // Create canvas to crop image to square automatically
      const img = new Image();
      const objectUrl = URL.createObjectURL(file);
      
      img.onload = async () => {
        URL.revokeObjectURL(objectUrl);
        
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        if (!ctx) throw new Error('Canvas context error');
        
        // Calculate square crop dimensions (center crop)
        const size = Math.min(img.width, img.height);
        const x = (img.width - size) / 2;
        const y = (img.height - size) / 2;
        
        // Set canvas size (max 1024px for optimization)
        const outputSize = Math.min(size, 1024);
        canvas.width = outputSize;
        canvas.height = outputSize;
        
        // Draw cropped square image
        ctx.drawImage(img, x, y, size, size, 0, 0, outputSize, outputSize);
        
        // Convert to blob
        canvas.toBlob(async (blob) => {
          if (!blob) {
            toast.error('فشل معالجة الصورة');
            setUploading(false);
            return;
          }
          
          const fileName = `${user.id}/${Date.now()}.jpg`;
          const { error: uploadError } = await supabase.storage
            .from('listing-images')
            .upload(fileName, blob, { contentType: 'image/jpeg' });
          
          if (uploadError) throw uploadError;
          
          const { data: { publicUrl } } = supabase.storage
            .from('listing-images')
            .getPublicUrl(fileName);
          
          setImages(prev => [...prev, publicUrl]);
          setUploading(false);
        }, 'image/jpeg', 0.9);
      };
      
      img.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        toast.error('فشل تحميل الصورة');
        setUploading(false);
      };
      
      img.src = objectUrl;
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة');
      setUploading(false);
    }
  };

  const handleEditImage = async (index: number) => {
    // Fetch the existing image and convert to data URL for cropper
    try {
      const response = await fetch(images[index]);
      const blob = await response.blob();
      const reader = new FileReader();
      reader.onload = () => {
        setImageToCrop(reader.result as string);
        setEditingImageIndex(index);
        setCropDialogOpen(true);
      };
      reader.readAsDataURL(blob);
    } catch (error) {
      console.error('Error loading image for crop:', error);
      toast.error('فشل تحميل الصورة للقص');
    }
  };

  const handleCropComplete = async (blob: Blob) => {
    if (!user) return;
    
    setUploading(true);
    try {
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(fileName, blob, { contentType: 'image/jpeg' });
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(fileName);
      
      if (editingImageIndex !== null) {
        // Replace existing image
        const newImages = [...images];
        newImages[editingImageIndex] = publicUrl;
        setImages(newImages);
      } else {
        // Add new image
        setImages(prev => [...prev, publicUrl]);
      }
      
      setCropDialogOpen(false);
      setImageToCrop(null);
      setEditingImageIndex(null);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    setUploadingReceipt(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `receipts/${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(fileName, file);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(fileName);
      
      setPurchaseReceiptUrl(publicUrl);
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('فشل رفع وصل الشراء');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title_ar || !formData.price) {
      toast.error('يرجى ملء الحقول المطلوبة');
      return;
    }
    if (images.length === 0) {
      toast.error('يرجى إضافة صورة واحدة على الأقل');
      return;
    }
    createListingMutation.mutate();
  };

  const calculateFee = () => {
    if (!feeSettings?.is_active || !formData.price) return 0;
    const price = parseFloat(formData.price);
    if (feeSettings.fee_type === 'percentage') {
      let fee = (price * feeSettings.fee_value) / 100;
      if (feeSettings.min_fee && fee < feeSettings.min_fee) fee = feeSettings.min_fee;
      if (feeSettings.max_fee && fee > feeSettings.max_fee) fee = feeSettings.max_fee;
      return fee;
    }
    return feeSettings.fee_value;
  };

  const fee = calculateFee();
  const hasEnoughBalance = editMode || !feeSettings?.is_active || fee === 0 || (userWallet?.balance || 0) >= fee;

  return (
    <>
      <Dialog open={open} onOpenChange={(v) => v ? setOpen(true) : handleClose()}>
        {!editMode && (
          <DialogTrigger asChild>
            {children || (
              <Button size="sm" className="gap-2">
                <Plus className="w-4 h-4" />
                أضف منتج للبيع
              </Button>
            )}
          </DialogTrigger>
        )}
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-right">
              {editMode ? 'تعديل المنتج' : 'إضافة منتج للبيع'}
            </DialogTitle>
            <DialogDescription>
              {editMode ? 'سيتم إعادة المنتج للمراجعة بعد التعديل' : 'أضف منتجك للبيع في سوق المستعمل'}
            </DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fee Notice */}
            {!editMode && feeSettings?.is_active && fee > 0 ? (
              <div className="bg-primary/10 border border-primary/20 rounded-lg p-3 text-sm">
                <p className="text-primary font-medium">رسوم المنصة:</p>
                <p className="text-muted-foreground">{feeSettings.terms_ar}</p>
                <p className="mt-1">
                  الرسوم: <span className="font-bold text-primary">{fee.toLocaleString()} دينار</span>
                  {!hasEnoughBalance && (
                    <span className="text-destructive mr-2">(رصيد المحفظة غير كافٍ)</span>
                  )}
                </p>
              </div>
            ) : !editMode && (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                <p className="text-green-600 font-medium">✓ الإضافة مجانية حالياً!</p>
              </div>
            )}

            {/* Images - Auto Square Crop */}
            <div className="space-y-3">
              <Label>صور المنتج *</Label>
              <p className="text-xs text-muted-foreground">يتم قص الصور تلقائياً بشكل مربع. اسحب لإعادة الترتيب.</p>
              
              <SortableImageList
                images={images}
                onImagesChange={setImages}
                onEditImage={handleEditImage}
                primaryIndex={0}
              />
              
              <label className="inline-flex items-center gap-2 px-4 py-2 border-2 border-dashed border-border rounded-lg cursor-pointer hover:border-primary transition-colors bg-muted/30">
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ImagePlus className="w-4 h-4 text-muted-foreground" />
                )}
                <span className="text-sm text-muted-foreground">إضافة صورة</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleImageSelect}
                  className="hidden"
                  disabled={uploading}
                  readOnly
                />
              </label>
            </div>

            {/* Purchase Receipt */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                وصل الشراء (اختياري - لإثبات الملكية)
              </Label>
              {purchaseReceiptUrl ? (
                <div className="relative w-24 h-24 inline-block">
                  <img src={purchaseReceiptUrl} alt="وصل الشراء" className="w-full h-full object-cover rounded-lg border-2 border-primary" />
                  <button
                    type="button"
                    onClick={() => setPurchaseReceiptUrl(null)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    ✕
                  </button>
                </div>
              ) : (
                <label className="inline-flex w-24 h-24 border-2 border-dashed border-primary/50 rounded-lg flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-primary/5">
                  {uploadingReceipt ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Receipt className="w-5 h-5 text-primary" />
                      <span className="text-xs text-primary mt-1">رفع الوصل</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleReceiptUpload}
                    className="hidden"
                    disabled={uploadingReceipt}
                  />
                </label>
              )}
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label>عنوان المنتج *</Label>
              <Input
                value={formData.title_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value }))}
                placeholder="مثال: طابعة Bambulab A1"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>الوصف</Label>
              <Textarea
                value={formData.description_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))}
                placeholder="وصف تفصيلي للمنتج، سبب البيع، أي عيوب..."
                rows={3}
              />
            </div>

            {/* Price */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>السعر (دينار) *</Label>
                <Input
                  type="text"
                  value={formData.price ? Number(formData.price.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, '');
                    if (/^\d*$/.test(rawValue)) {
                      setFormData(prev => ({ ...prev, price: rawValue }));
                    }
                  }}
                  placeholder="100,000"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label>السعر الأصلي (اختياري - للتخفيضات)</Label>
                <Input
                  type="text"
                  value={formData.original_price ? Number(formData.original_price.replace(/,/g, '')).toLocaleString() : ''}
                  onChange={(e) => {
                    const rawValue = e.target.value.replace(/,/g, '');
                    if (/^\d*$/.test(rawValue)) {
                      setFormData(prev => ({ ...prev, original_price: rawValue }));
                    }
                  }}
                  placeholder="150,000"
                />
              </div>
            </div>

            {/* Condition */}
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

            {/* Usage Duration - Only show if not new */}
            {formData.condition !== 'new' && (
              <div className="space-y-2">
                <Label>مدة الاستخدام</Label>
                <Select
                  value={formData.usage_duration}
                  onValueChange={(value) => setFormData(prev => ({ ...prev, usage_duration: value }))}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="اختر مدة الاستخدام" />
                  </SelectTrigger>
                  <SelectContent>
                    {usageDurationOptions.map(opt => (
                      <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Location */}
            <div className="space-y-2">
              <Label>الموقع</Label>
              <Input
                value={formData.location}
                onChange={(e) => setFormData(prev => ({ ...prev, location: e.target.value }))}
                placeholder="بغداد، الكرادة"
              />
            </div>

            {/* Terms & Conditions */}
            <div className="bg-muted/50 border border-border rounded-lg p-3 text-xs text-muted-foreground space-y-2">
              <p className="font-semibold text-foreground">شروط البيع:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                <li>يجب أن يكون المنتج مملوكاً لك بشكل قانوني</li>
                <li>يُمنع بيع المنتجات المقلدة أو المسروقة</li>
                <li>يجب وصف حالة المنتج بدقة وصدق</li>
                <li>الصور يجب أن تكون حقيقية للمنتج الفعلي</li>
                <li>يحق للإدارة رفض أي منتج لا يتوافق مع الشروط</li>
              </ul>
              <p className="font-semibold text-foreground mt-2">شروط الشراء:</p>
              <ul className="list-disc list-inside space-y-1 mr-2">
                <li>التحقق من المنتج قبل إتمام الشراء</li>
                <li>التواصل عبر المنصة فقط للحماية</li>
                <li>الدفع عبر المحفظة أو عند الاستلام</li>
              </ul>
            </div>

            {/* Submit */}
            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                className="flex-1"
                disabled={createListingMutation.isPending || !hasEnoughBalance}
              >
                {createListingMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}
                {editMode ? 'حفظ التعديلات' : 'إرسال للمراجعة'}
              </Button>
              <Button type="button" variant="outline" onClick={handleClose}>
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Image Cropper for editing */}
      {imageToCrop && (
        <ImageCropper
          open={cropDialogOpen}
          onOpenChange={(v) => {
            if (!v) {
              setCropDialogOpen(false);
              setImageToCrop(null);
              setEditingImageIndex(null);
            }
          }}
          imageSrc={imageToCrop}
          onCropComplete={handleCropComplete}
          aspectRatio={1}
          isUploading={uploading}
        />
      )}
    </>
  );
};

export default AddListingDialog;
