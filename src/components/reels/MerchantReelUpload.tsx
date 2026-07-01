import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Upload, Film, Loader2, X, Check, AlertCircle } from 'lucide-react';
import { toast } from 'sonner';

interface MerchantReelUploadProps {
  merchantId: string;
  children: React.ReactNode;
}

export default function MerchantReelUpload({ merchantId, children }: MerchantReelUploadProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch merchant products
  const { data: products } = useQuery({
    queryKey: ['merchant-products-for-reel', merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_products')
        .select('id, title, price_iqd, image_urls')
        .eq('merchant_id', merchantId)
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch community categories
  const { data: categories } = useQuery({
    queryKey: ['community-categories-reels'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_categories')
        .select('id, name_ar')
        .eq('is_active', true)
        .order('display_order');
      if (error) throw error;
      return data;
    },
    enabled: open,
  });

  // Fetch reels settings
  const { data: settings } = useQuery({
    queryKey: ['reels-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('community_settings')
        .select('value')
        .eq('key', 'reels_settings')
        .maybeSingle();
      if (error) throw error;
      return (data?.value as any) || { max_file_size_mb: 50, max_duration_seconds: 45, min_duration_seconds: 10, daily_upload_limit: 5 };
    },
    enabled: open,
    staleTime: 5 * 60 * 1000,
  });

  // Check daily upload count
  const { data: todayCount = 0 } = useQuery({
    queryKey: ['reel-upload-count-today', merchantId],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count, error } = await supabase
        .from('merchant_reels')
        .select('*', { count: 'exact', head: true })
        .eq('merchant_id', merchantId)
        .gte('created_at', today);
      if (error) throw error;
      return count || 0;
    },
    enabled: open,
  });

  const maxSize = (settings?.max_file_size_mb || 50) * 1024 * 1024;
  const dailyLimit = settings?.daily_upload_limit || 5;
  const canUpload = todayCount < dailyLimit;

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > maxSize) {
      toast.error(`حجم الفيديو يتجاوز الحد الأقصى (${settings?.max_file_size_mb || 50}MB)`);
      return;
    }

    if (!file.type.startsWith('video/')) {
      toast.error('يرجى اختيار ملف فيديو صالح');
      return;
    }

    setVideoFile(file);
    setVideoPreview(URL.createObjectURL(file));
  };

  const uploadMutation = useMutation({
    mutationFn: async () => {
      if (!videoFile || !user?.id) throw new Error('Missing data');
      setUploading(true);

      // Upload video to storage
      const ext = videoFile.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('merchant-reels')
        .upload(path, videoFile, { contentType: videoFile.type });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('merchant-reels')
        .getPublicUrl(path);

      // Create reel record
      const { error: insertError } = await supabase
        .from('merchant_reels')
        .insert({
          merchant_id: merchantId,
          video_url: publicUrl,
          caption: caption.trim() || null,
          product_id: selectedProductId || null,
          category_id: selectedCategoryId || null,
          status: 'pending',
        });

      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('تم رفع الريل بنجاح! سيتم مراجعته قبل النشر');
      queryClient.invalidateQueries({ queryKey: ['merchant-reels'] });
      queryClient.invalidateQueries({ queryKey: ['reel-upload-count-today'] });
      resetForm();
      setOpen(false);
    },
    onError: (err: any) => {
      toast.error(err.message || 'فشل رفع الريل');
    },
    onSettled: () => setUploading(false),
  });

  const resetForm = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
    setSelectedProductId('');
    setSelectedCategoryId('');
  };

  return (
    <Dialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) resetForm(); }}>
      <DialogTrigger asChild>{children}</DialogTrigger>
      <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Film className="w-5 h-5 text-primary" />
            رفع ريل جديد
          </DialogTitle>
        </DialogHeader>

        {!canUpload && (
          <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-sm">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span>وصلت للحد اليومي ({dailyLimit} ريلز). حاول غداً.</span>
          </div>
        )}

        <div className="space-y-4">
          {/* Video upload area */}
          <div>
            <Label className="mb-2 block">الفيديو *</Label>
            {videoPreview ? (
              <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[300px]">
                <video src={videoPreview} className="w-full h-full object-contain" controls muted />
                <button
                  onClick={() => { setVideoFile(null); setVideoPreview(null); }}
                  className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center"
                >
                  <X className="w-4 h-4 text-white" />
                </button>
              </div>
            ) : (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={!canUpload}
                className="w-full aspect-[9/16] max-h-[200px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors disabled:opacity-50"
              >
                <Upload className="w-8 h-8 text-muted-foreground" />
                <span className="text-sm text-muted-foreground">اختر فيديو عمودي (9:16)</span>
                <span className="text-xs text-muted-foreground">
                  {settings?.min_duration_seconds || 10}-{settings?.max_duration_seconds || 45} ثانية، حد أقصى {settings?.max_file_size_mb || 50}MB
                </span>
              </button>
            )}
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*"
              onChange={handleFileSelect}
              className="hidden"
            />
          </div>

          {/* Caption */}
          <div>
            <Label className="mb-2 block">الوصف (اختياري)</Label>
            <Textarea
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 120))}
              placeholder="وصف قصير للريل..."
              className="resize-none"
              rows={2}
            />
            <p className="text-[11px] text-muted-foreground mt-1 text-left">{caption.length}/120</p>
          </div>

          {/* Product link */}
          <div>
            <Label className="mb-2 block">ربط بمنتج (اختياري)</Label>
            <Select value={selectedProductId} onValueChange={setSelectedProductId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر منتج..." />
              </SelectTrigger>
              <SelectContent>
                {products?.map(p => (
                  <SelectItem key={p.id} value={p.id}>
                    <div className="flex items-center gap-2">
                      {p.image_urls?.[0] && (
                        <img src={p.image_urls[0]} alt="" className="w-6 h-6 rounded object-cover" />
                      )}
                      <span className="truncate">{p.title}</span>
                      {p.price_iqd && <span className="text-xs text-muted-foreground">{p.price_iqd.toLocaleString()} د.ع</span>}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Category */}
          <div>
            <Label className="mb-2 block">القسم (اختياري)</Label>
            <Select value={selectedCategoryId} onValueChange={setSelectedCategoryId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر قسم..." />
              </SelectTrigger>
              <SelectContent>
                {categories?.map(c => (
                  <SelectItem key={c.id} value={c.id}>{c.name_ar}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Submit */}
          <Button
            onClick={() => uploadMutation.mutate()}
            disabled={!videoFile || uploading || !canUpload}
            className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground"
          >
            {uploading ? (
              <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الرفع...</>
            ) : (
              <><Check className="w-4 h-4 ml-2" /> رفع الريل</>
            )}
          </Button>

          <p className="text-[11px] text-muted-foreground text-center">
            سيتم مراجعة الريل من قبل الإدارة قبل نشره
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
