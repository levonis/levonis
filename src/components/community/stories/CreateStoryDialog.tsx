import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { supabase } from '@/integrations/supabase/client';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ImagePlus, Loader2 } from 'lucide-react';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreated: () => void;
}

export default function CreateStoryDialog({ open, onOpenChange, onCreated }: Props) {
  const { user } = useAuth();
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [productId, setProductId] = useState<string>('none');
  const [uploading, setUploading] = useState(false);

  // Fetch merchant products for selection
  const { data: products = [] } = useQuery<{ id: string; title: string; price_iqd: number | null; image_urls: string[] | null }[]>({
    queryKey: ['merchant-products-for-story', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('merchant_products')
        .select('id, title, price_iqd, image_urls')
        .eq('merchant_id', user.id)
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(50);
      return (data as any) || [];
    },
    enabled: !!user?.id && open,
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;

    // Max 10MB
    if (f.size > 10 * 1024 * 1024) {
      toast.error('الحد الأقصى 10 ميغابايت');
      return;
    }

    setFile(f);
    setPreview(URL.createObjectURL(f));
  };

  const handleSubmit = async () => {
    if (!user?.id || !file) return;

    setUploading(true);
    try {
      // Upload file
      const ext = file.name.split('.').pop();
      const path = `merchant-stories/${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('community').upload(path, file);

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('community').getPublicUrl(path);
      const mediaType = file.type.startsWith('video/') ? 'video' : 'image';

      const { error: insertError } = await supabase.from('merchant_stories').insert({
        merchant_id: user.id,
        media_url: urlData.publicUrl,
        media_type: mediaType,
        caption: caption.trim() || null,
        product_id: productId !== 'none' ? productId : null,
      });

      if (insertError) throw insertError;

      toast.success('تم نشر الستوري بنجاح!');
      onCreated();
      onOpenChange(false);
      setFile(null);
      setPreview(null);
      setCaption('');
      setProductId('none');
    } catch (err: any) {
      console.error(err);
      toast.error('حدث خطأ أثناء النشر');
    } finally {
      setUploading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-right">نشر ستوري جديد</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Media upload */}
          <div>
            <Label className="text-right block mb-2">صورة أو فيديو</Label>
            {preview ? (
              <div className="relative aspect-[9/16] max-h-[300px] rounded-xl overflow-hidden bg-muted mx-auto">
                {file?.type.startsWith('video/') ? (
                  <video src={preview} className="w-full h-full object-cover" muted autoPlay loop playsInline />
                ) : (
                  <img src={preview} className="w-full h-full object-cover" alt="" />
                )}
                <button
                  onClick={() => { setFile(null); setPreview(null); }}
                  className="absolute top-2 left-2 bg-black/50 text-white rounded-full p-1 text-xs"
                >
                  ✕
                </button>
              </div>
            ) : (
              <label className="flex flex-col items-center justify-center h-40 border-2 border-dashed border-primary/30 rounded-xl cursor-pointer hover:bg-primary/5 transition-colors">
                <ImagePlus className="h-8 w-8 text-primary/50 mb-2" />
                <span className="text-sm text-muted-foreground">اضغط لرفع صورة أو فيديو</span>
                <input type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
              </label>
            )}
          </div>

          {/* Caption */}
          <div>
            <Label className="text-right block mb-2">وصف (اختياري)</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              placeholder="أضف وصف للستوري..."
              className="text-right"
              maxLength={200}
              rows={2}
            />
          </div>

          {/* Product selection */}
          <div>
            <Label className="text-right block mb-2">ربط منتج (اختياري)</Label>
            <Select value={productId} onValueChange={setProductId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر منتج" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">بدون منتج</SelectItem>
                {products.map((p) => (
                  <SelectItem key={p.id} value={p.id}>
                    {p.title} - {p.price_iqd?.toLocaleString()} د.ع
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <Button
            onClick={handleSubmit}
            disabled={!file || uploading}
            className="w-full"
          >
            {uploading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
                جاري النشر...
              </>
            ) : (
              'نشر الستوري'
            )}
          </Button>

          <p className="text-[10px] text-muted-foreground text-center">
            الستوري يختفي بعد 24 ساعة
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
