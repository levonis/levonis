import { useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { BadgeDollarSign, Upload, X, Loader2, CheckCircle, Send, MapPin, Camera } from 'lucide-react';

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

  const resetForm = () => {
    setFoundPrice('');
    setSourceUrl('');
    setNotes('');
    setImageFile(null);
    setImagePreview(null);
    setSubmitted(false);
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
      toast.success('شكراً لمساعدتك! سنراجع السعر قريباً 🙏');
    } catch (error) {
      console.error('Error submitting price match:', error);
      toast.error('حدث خطأ في إرسال الطلب');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <>
      {/* Trigger Button */}
      <button
        onClick={() => { resetForm(); setOpen(true); }}
        className="w-full flex items-center justify-center gap-2.5 py-3.5 px-4 rounded-2xl border-2 border-dashed border-amber-500/40 bg-amber-500/5 hover:bg-amber-500/10 transition-all text-amber-600 dark:text-amber-400 text-sm font-black active:scale-[0.97]"
      >
        <BadgeDollarSign className="h-5 w-5" />
        <span>لكيتها بمكان ارخص؟ دلّنا! 👀</span>
      </button>

      {/* Dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm mx-auto rounded-2xl p-0 overflow-hidden z-[100]" dir="rtl">
          {submitted ? (
            <div className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-3">
              <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center">
                <CheckCircle className="h-8 w-8 text-emerald-500" />
              </div>
              <h3 className="text-lg font-black text-foreground">شكراً لك! 🎉</h3>
              <p className="text-sm text-muted-foreground leading-relaxed">
                تم إرسال معلوماتك بنجاح. سنراجع السعر ونحاول نوفره بأفضل عرض!
              </p>
              <Button
                onClick={() => setOpen(false)}
                className="mt-2 rounded-xl"
              >
                تمام 👍
              </Button>
            </div>
          ) : (
            <>
              <DialogHeader className="px-5 pt-5 pb-0">
                <DialogTitle className="flex items-center gap-2 text-base font-black">
                  <BadgeDollarSign className="h-5 w-5 text-amber-500" />
                  دلنا على السعر الأرخص!
                </DialogTitle>
                <p className="text-xs text-muted-foreground mt-1">
                  ساعدنا نكون الأنسب لـ <span className="font-bold text-foreground">{productName}</span>
                </p>
              </DialogHeader>

              <div className="px-5 pb-5 pt-3 space-y-4">
                {/* Chat-like message bubble for context */}
                <div className="bg-muted/50 rounded-2xl rounded-tr-sm p-3 text-xs text-muted-foreground leading-relaxed">
                  💬 شاركنا السعر اللي لكيته ووين، وإذا عندك صورة إثبات ارفقها. نحن نحب نكون الأنسب دائماً!
                </div>

                {/* Price Input */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <BadgeDollarSign className="h-3.5 w-3.5 text-primary" />
                    السعر اللي لكيته *
                  </Label>
                  <Input
                    type="number"
                    step="0.01"
                    min="0"
                    value={foundPrice}
                    onChange={(e) => setFoundPrice(e.target.value)}
                    placeholder="مثال: 15.99 $"
                    className="text-sm h-10 rounded-xl"
                    dir="ltr"
                  />
                </div>

                {/* Source */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <MapPin className="h-3.5 w-3.5 text-primary" />
                    وين لكيته؟ (رابط أو اسم المتجر)
                  </Label>
                  <Input
                    type="text"
                    value={sourceUrl}
                    onChange={(e) => setSourceUrl(e.target.value)}
                    placeholder="رابط الموقع أو اسم المتجر..."
                    className="text-sm h-10 rounded-xl"
                  />
                </div>

                {/* Image Upload */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold flex items-center gap-1">
                    <Camera className="h-3.5 w-3.5 text-primary" />
                    صورة إثبات (اختياري)
                  </Label>
                  {imagePreview ? (
                    <div className="relative w-full h-36 rounded-xl overflow-hidden border border-border/30">
                      <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
                      <button
                        onClick={() => { setImageFile(null); setImagePreview(null); }}
                        className="absolute top-2 right-2 bg-destructive text-destructive-foreground rounded-full p-1.5 shadow-lg"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </div>
                  ) : (
                    <label className="flex flex-col items-center justify-center gap-1.5 py-5 border-2 border-dashed border-border/40 rounded-xl cursor-pointer hover:bg-muted/30 hover:border-primary/30 transition-colors">
                      <Upload className="h-5 w-5 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">اضغط لرفع صورة</span>
                      <input type="file" accept="image/*" className="hidden" onChange={handleImageChange} />
                    </label>
                  )}
                </div>

                {/* Notes */}
                <div className="space-y-1.5">
                  <Label className="text-xs font-bold">ملاحظات إضافية (اختياري)</Label>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="أي تفاصيل ثانية تبي تضيفها..."
                    className="text-sm min-h-[60px] resize-none rounded-xl"
                  />
                </div>

                {/* Submit */}
                <Button
                  onClick={handleSubmit}
                  disabled={submitting || !foundPrice}
                  className="w-full h-11 text-sm font-black rounded-xl gap-2"
                >
                  {submitting ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )}
                  {submitting ? 'جاري الإرسال...' : 'إرسال 🚀'}
                </Button>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
};

export default PriceMatchForm;
