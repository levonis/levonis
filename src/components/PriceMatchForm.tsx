import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { BadgeDollarSign, Upload, X, Loader2, CheckCircle } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PriceMatchFormProps {
  productId: string;
  productName: string;
}

const PriceMatchForm = ({ productId, productName }: PriceMatchFormProps) => {
  const { user } = useAuth();
  const [open, setOpen] = useState(false);
  const [foundPrice, setFoundPrice] = useState('');
  const [sourceUrl, setSourceUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 5 ميجابايت');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  };

  const handleSubmit = async () => {
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    if (!foundPrice || Number(foundPrice) <= 0) {
      toast.error('يرجى إدخال السعر الذي وجدته');
      return;
    }

    setSubmitting(true);
    try {
      let imageUrl: string | null = null;

      if (imageFile) {
        const fileExt = imageFile.name.split('.').pop();
        const fileName = `price-match/${user.id}/${Date.now()}.${fileExt}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(fileName, imageFile);
        if (uploadError) throw uploadError;
        const { data: { publicUrl } } = supabase.storage
          .from('product-images')
          .getPublicUrl(fileName);
        imageUrl = publicUrl;
      }

      const { error } = await supabase
        .from('price_match_requests')
        .insert({
          user_id: user.id,
          product_id: productId,
          found_price: Number(foundPrice),
          image_url: imageUrl,
          source_url: sourceUrl || null,
          notes: notes || null,
        });

      if (error) throw error;

      setSubmitted(true);
      toast.success('تم إرسال طلبك بنجاح! سنراجعه قريباً');
    } catch (error) {
      console.error('Error submitting price match:', error);
      toast.error('حدث خطأ في إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  if (submitted) {
    return (
      <div className="border border-primary/20 rounded-xl p-4 bg-primary/5 text-center space-y-2">
        <CheckCircle className="h-8 w-8 text-primary mx-auto" />
        <p className="text-sm font-bold text-primary">تم إرسال طلبك بنجاح!</p>
        <p className="text-xs text-muted-foreground">سنراجع السعر ونرد عليك قريباً</p>
      </div>
    );
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="w-full flex items-center justify-center gap-2 py-3 px-4 rounded-xl border border-dashed border-primary/30 bg-primary/5 hover:bg-primary/10 transition-all text-primary text-sm font-bold active:scale-[0.98]"
      >
        <BadgeDollarSign className="h-4 w-4" />
        وجدت السعر أقل في مكان آخر؟
      </button>
    );
  }

  return (
    <div className="border border-border/30 rounded-xl p-4 bg-card/50 backdrop-blur-sm space-y-3 animate-fade-in">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-black flex items-center gap-2">
          <BadgeDollarSign className="h-4 w-4 text-primary" />
          أبلغنا عن سعر أقل
        </h4>
        <button onClick={() => setOpen(false)} className="text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold">السعر الذي وجدته (بالدولار) *</Label>
        <Input
          type="number"
          step="0.01"
          min="0"
          value={foundPrice}
          onChange={(e) => setFoundPrice(e.target.value)}
          placeholder="مثال: 15.99"
          className="text-sm h-9"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold">رابط المصدر (اختياري)</Label>
        <Input
          type="url"
          value={sourceUrl}
          onChange={(e) => setSourceUrl(e.target.value)}
          placeholder="https://..."
          className="text-sm h-9"
          dir="ltr"
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold">صورة إثبات السعر (اختياري)</Label>
        {imagePreview ? (
          <div className="relative w-full h-32 rounded-lg overflow-hidden border border-border/30">
            <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
            <button
              onClick={() => { setImageFile(null); setImagePreview(null); }}
              className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded-full p-1"
            >
              <X className="h-3 w-3" />
            </button>
          </div>
        ) : (
          <label className="flex items-center justify-center gap-2 py-4 border border-dashed border-border/40 rounded-lg cursor-pointer hover:bg-muted/30 transition-colors">
            <Upload className="h-4 w-4 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">اضغط لرفع صورة</span>
            <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
          </label>
        )}
      </div>

      <div className="space-y-2">
        <Label className="text-xs font-bold">ملاحظات إضافية (اختياري)</Label>
        <Textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="أي تفاصيل إضافية..."
          className="text-sm min-h-[60px] resize-none"
        />
      </div>

      <Button
        onClick={handleSubmit}
        disabled={submitting || !foundPrice}
        className="w-full h-9 text-sm font-bold rounded-xl"
      >
        {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <BadgeDollarSign className="h-4 w-4 ml-2" />}
        إرسال
      </Button>
    </div>
  );
};

export default PriceMatchForm;
