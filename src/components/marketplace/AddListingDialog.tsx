import { useState, useRef, useCallback } from 'react';
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
import { Plus, Upload, X, Loader2, Receipt, RotateCcw } from 'lucide-react';

interface AddListingDialogProps {
  children?: React.ReactNode;
}

const conditionOptions = [
  { value: 'new', label: 'جديد' },
  { value: 'like_new', label: 'شبه جديد' },
  { value: 'good', label: 'جيد' },
  { value: 'used', label: 'مستعمل' },
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
  const [purchaseReceiptUrl, setPurchaseReceiptUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  
  // Image cropping state
  const [cropDialogOpen, setCropDialogOpen] = useState(false);
  const [imageToCrop, setImageToCrop] = useState<string | null>(null);
  const [cropPosition, setCropPosition] = useState({ x: 0, y: 0 });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  const [formData, setFormData] = useState({
    title_ar: '',
    title: '',
    description_ar: '',
    description: '',
    price: '',
    condition: 'used',
    shipping_method: 'through_site',
    location: '',
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
      
      // Check wallet balance if fee is required
      if (feeSettings?.is_active && fee > 0) {
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
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      queryClient.invalidateQueries({ queryKey: ['approved-listings'] });
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
      shipping_method: 'through_site',
      location: '',
    });
    setImages([]);
    setPurchaseReceiptUrl(null);
  };

  const processImageToCrop = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageToCrop(e.target?.result as string);
      setImageFile(file);
      setCropDialogOpen(true);
    };
    reader.readAsDataURL(file);
  };

  const handleCropConfirm = async () => {
    if (!imageToCrop || !imageFile || !canvasRef.current || !user) return;
    
    setUploading(true);
    
    try {
      const img = new Image();
      img.src = imageToCrop;
      
      await new Promise((resolve) => {
        img.onload = resolve;
      });
      
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      
      // Set canvas to square
      const size = Math.min(img.width, img.height);
      canvas.width = 800;
      canvas.height = 800;
      
      // Draw cropped image
      ctx.drawImage(
        img,
        cropPosition.x * (img.width - size),
        cropPosition.y * (img.height - size),
        size,
        size,
        0,
        0,
        800,
        800
      );
      
      // Convert to blob
      const blob = await new Promise<Blob>((resolve) => {
        canvas.toBlob((b) => resolve(b!), 'image/jpeg', 0.9);
      });
      
      // Upload
      const fileName = `${user.id}/${Date.now()}.jpg`;
      const { error: uploadError } = await supabase.storage
        .from('listing-images')
        .upload(fileName, blob);
      
      if (uploadError) throw uploadError;
      
      const { data: { publicUrl } } = supabase.storage
        .from('listing-images')
        .getPublicUrl(fileName);
      
      setImages(prev => [...prev, publicUrl]);
      setCropDialogOpen(false);
      setImageToCrop(null);
      setImageFile(null);
    } catch (error) {
      console.error('Crop error:', error);
      toast.error('فشل معالجة الصورة');
    } finally {
      setUploading(false);
    }
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !user) return;
    
    // Process first file for cropping
    if (files[0]) {
      processImageToCrop(files[0]);
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

  const removeImage = (index: number) => {
    setImages(prev => prev.filter((_, i) => i !== index));
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
  const hasEnoughBalance = !feeSettings?.is_active || fee === 0 || (userWallet?.balance || 0) >= fee;

  return (
    <>
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
            <DialogDescription>أضف منتجك للبيع في سوق المستعمل</DialogDescription>
          </DialogHeader>
          
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Fee Notice */}
            {feeSettings?.is_active && fee > 0 ? (
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
            ) : (
              <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 text-sm">
                <p className="text-green-600 font-medium">✓ الإضافة مجانية حالياً!</p>
              </div>
            )}

            {/* Images with Cropping */}
            <div className="space-y-2">
              <Label>صور المنتج (مربعة) *</Label>
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
                <label className="w-20 h-20 border-2 border-dashed border-border rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors">
                  {uploading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : (
                    <>
                      <Upload className="w-5 h-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground mt-1">رفع</span>
                    </>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageUpload}
                    className="hidden"
                    disabled={uploading}
                  />
                </label>
              </div>
            </div>

            {/* Purchase Receipt */}
            <div className="space-y-2">
              <Label className="flex items-center gap-2">
                <Receipt className="w-4 h-4" />
                وصل الشراء (اختياري - لإثبات الملكية)
              </Label>
              {purchaseReceiptUrl ? (
                <div className="relative w-24 h-24">
                  <img src={purchaseReceiptUrl} alt="وصل الشراء" className="w-full h-full object-cover rounded-lg border-2 border-primary" />
                  <button
                    type="button"
                    onClick={() => setPurchaseReceiptUrl(null)}
                    className="absolute -top-2 -right-2 bg-destructive text-destructive-foreground rounded-full p-1"
                  >
                    <X className="w-3 h-3" />
                  </button>
                </div>
              ) : (
                <label className="w-24 h-24 border-2 border-dashed border-primary/50 rounded-lg flex flex-col items-center justify-center cursor-pointer hover:border-primary transition-colors bg-primary/5">
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
                onChange={(e) => setFormData(prev => ({ ...prev, title_ar: e.target.value, title: e.target.value }))}
                placeholder="مثال: طابعة Bambulab A1"
                required
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label>الوصف (عربي)</Label>
              <Textarea
                value={formData.description_ar}
                onChange={(e) => setFormData(prev => ({ ...prev, description_ar: e.target.value }))}
                placeholder="وصف تفصيلي للمنتج، سبب البيع، أي عيوب..."
                rows={3}
              />
            </div>

            {/* Price & Condition */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
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
                <li>سيتم مراجعة منتجك قبل نشره (خلال 24 ساعة)</li>
                <li>يُفضّل إرفاق وصل الشراء لإثبات الملكية والأصالة</li>
                <li>جميع المعاملات تتم عبر الموقع لضمان حقوق الطرفين</li>
                <li>البائع مسؤول عن دقة المعلومات المقدمة</li>
              </ul>
            </div>

            <div className="flex gap-3 justify-end">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                إلغاء
              </Button>
              <Button 
                type="submit" 
                disabled={createListingMutation.isPending || !hasEnoughBalance}
              >
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

      {/* Crop Dialog */}
      <Dialog open={cropDialogOpen} onOpenChange={setCropDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>قص الصورة</DialogTitle>
            <DialogDescription>حرّك المنزلق لاختيار منطقة القص</DialogDescription>
          </DialogHeader>
          
          {imageToCrop && (
            <div className="space-y-4">
              <div className="relative aspect-square overflow-hidden rounded-lg border">
                <img
                  src={imageToCrop}
                  alt="Preview"
                  className="w-full h-full object-cover"
                  style={{
                    objectPosition: `${cropPosition.x * 100}% ${cropPosition.y * 100}%`,
                  }}
                />
              </div>
              
              <div className="space-y-2">
                <Label>تحريك أفقي</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={cropPosition.x}
                  onChange={(e) => setCropPosition(prev => ({ ...prev, x: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              <div className="space-y-2">
                <Label>تحريك عمودي</Label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.01"
                  value={cropPosition.y}
                  onChange={(e) => setCropPosition(prev => ({ ...prev, y: parseFloat(e.target.value) }))}
                  className="w-full"
                />
              </div>
              
              <canvas ref={canvasRef} className="hidden" />
              
              <div className="flex gap-3">
                <Button onClick={handleCropConfirm} disabled={uploading} className="flex-1">
                  {uploading ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد'}
                </Button>
                <Button variant="outline" onClick={() => {
                  setCropDialogOpen(false);
                  setImageToCrop(null);
                  setCropPosition({ x: 0, y: 0 });
                }}>
                  <RotateCcw className="w-4 h-4 ml-2" />
                  إلغاء
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default AddListingDialog;
