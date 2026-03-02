import { useState, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { Card } from '@/components/ui/card';
import { Upload, Film, Loader2, X, Check, Trash2, Plus, Eye, Heart, Play, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const statusLabels: Record<string, { label: string; variant: 'default' | 'secondary' | 'destructive' | 'outline' }> = {
  pending: { label: 'قيد المراجعة', variant: 'secondary' },
  approved: { label: 'معتمد', variant: 'default' },
  rejected: { label: 'مرفوض', variant: 'destructive' },
};

export default function AdminReelsManager() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showUpload, setShowUpload] = useState(false);
  const [videoFile, setVideoFile] = useState<File | null>(null);
  const [videoPreview, setVideoPreview] = useState<string | null>(null);
  const [caption, setCaption] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch all reels (admin sees all statuses)
  const { data: reels = [], isLoading } = useQuery({
    queryKey: ['admin-reels-list'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('merchant_reels')
        .select('id, video_url, thumbnail_url, caption, status, views_count, likes_count, saves_count, created_at, merchant_id, site_product_id, product_id')
        .order('created_at', { ascending: false })
        .limit(100);
      if (error) throw error;
      return data || [];
    },
  });

  // Fetch site products for linking
  const { data: siteProducts } = useQuery({
    queryKey: ['admin-site-products-for-reel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, name_ar, price, image_url')
        .order('created_at', { ascending: false })
        .limit(200);
      if (error) throw error;
      return data || [];
    },
    enabled: showUpload,
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 100 * 1024 * 1024) {
      toast.error('حجم الفيديو يتجاوز 100MB');
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

      const ext = videoFile.name.split('.').pop();
      const path = `admin/${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from('merchant-reels')
        .upload(path, videoFile, { contentType: videoFile.type });
      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('merchant-reels')
        .getPublicUrl(path);

      const { error: insertError } = await supabase
        .from('merchant_reels')
        .insert({
          video_url: publicUrl,
          caption: caption.trim() || null,
          site_product_id: selectedProductId || null,
          status: 'approved',
        });
      if (insertError) throw insertError;
    },
    onSuccess: () => {
      toast.success('تم رفع الريل بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['admin-reels-list'] });
      queryClient.invalidateQueries({ queryKey: ['home-reels-bar'] });
      resetForm();
      setShowUpload(false);
    },
    onError: (err: any) => toast.error(err.message || 'فشل رفع الريل'),
    onSettled: () => setUploading(false),
  });

  const deleteMutation = useMutation({
    mutationFn: async (reelId: string) => {
      const { error } = await supabase.from('merchant_reels').delete().eq('id', reelId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف الريل');
      queryClient.invalidateQueries({ queryKey: ['admin-reels-list'] });
      queryClient.invalidateQueries({ queryKey: ['home-reels-bar'] });
    },
    onError: () => toast.error('فشل حذف الريل'),
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ reelId, status }: { reelId: string; status: string }) => {
      const updates: any = { status };
      if (status === 'approved') updates.approved_at = new Date().toISOString();
      const { error } = await supabase.from('merchant_reels').update(updates).eq('id', reelId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث الحالة');
      queryClient.invalidateQueries({ queryKey: ['admin-reels-list'] });
      queryClient.invalidateQueries({ queryKey: ['home-reels-bar'] });
    },
    onError: () => toast.error('فشل التحديث'),
  });

  const resetForm = () => {
    setVideoFile(null);
    setVideoPreview(null);
    setCaption('');
    setSelectedProductId('');
  };

  const formatCount = (n: number) => {
    if (n >= 1000) return (n / 1000).toFixed(1) + 'K';
    return n.toString();
  };

  const adminReels = reels.filter(r => !r.merchant_id);
  const merchantReels = reels.filter(r => r.merchant_id);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload Button */}
      <Button onClick={() => setShowUpload(true)} size="sm" className="gap-1.5">
        <Plus className="w-3.5 h-3.5" />
        رفع ريل جديد
      </Button>

      {/* Admin Reels */}
      {adminReels.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-foreground mb-2">ريلز الإدارة ({adminReels.length})</h4>
          <ReelsGrid reels={adminReels} onDelete={(id) => deleteMutation.mutate(id)} onStatusChange={(id, s) => updateStatusMutation.mutate({ reelId: id, status: s })} formatCount={formatCount} />
        </div>
      )}

      {/* Merchant Reels */}
      {merchantReels.length > 0 && (
        <div>
          <h4 className="text-xs font-bold text-foreground mb-2">ريلز التجار ({merchantReels.length})</h4>
          <ReelsGrid reels={merchantReels} onDelete={(id) => deleteMutation.mutate(id)} onStatusChange={(id, s) => updateStatusMutation.mutate({ reelId: id, status: s })} formatCount={formatCount} />
        </div>
      )}

      {reels.length === 0 && (
        <Card className="p-8 text-center border-border/50">
          <Film className="h-10 w-10 text-muted-foreground/30 mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">لا توجد ريلز بعد</p>
        </Card>
      )}

      {/* Upload Dialog */}
      <Dialog open={showUpload} onOpenChange={(v) => { setShowUpload(v); if (!v) resetForm(); }}>
        <DialogContent className="max-w-md max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Film className="w-5 h-5 text-primary" />
              رفع ريل جديد (إدارة)
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Video */}
            <div>
              <Label className="mb-2 block">الفيديو *</Label>
              {videoPreview ? (
                <div className="relative rounded-xl overflow-hidden bg-black aspect-[9/16] max-h-[300px]">
                  <video src={videoPreview} className="w-full h-full object-contain" controls muted />
                  <button onClick={() => { setVideoFile(null); setVideoPreview(null); }} className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/60 flex items-center justify-center">
                    <X className="w-4 h-4 text-white" />
                  </button>
                </div>
              ) : (
                <button onClick={() => fileInputRef.current?.click()} className="w-full aspect-[9/16] max-h-[200px] border-2 border-dashed border-border rounded-xl flex flex-col items-center justify-center gap-2 hover:border-primary/50 transition-colors">
                  <Upload className="w-8 h-8 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">اختر فيديو عمودي (9:16)</span>
                  <span className="text-xs text-muted-foreground">حد أقصى 100MB</span>
                </button>
              )}
              <input ref={fileInputRef} type="file" accept="video/*" onChange={handleFileSelect} className="hidden" />
            </div>

            {/* Caption */}
            <div>
              <Label className="mb-2 block">الوصف (اختياري)</Label>
              <Textarea value={caption} onChange={(e) => setCaption(e.target.value.slice(0, 200))} placeholder="وصف الريل..." className="resize-none" rows={2} />
              <p className="text-[11px] text-muted-foreground mt-1 text-left">{caption.length}/200</p>
            </div>

            {/* Site Product link */}
            <div>
              <Label className="mb-2 block">ربط بمنتج من الموقع (اختياري)</Label>
              <Select value={selectedProductId} onValueChange={setSelectedProductId}>
                <SelectTrigger>
                  <SelectValue placeholder="اختر منتج..." />
                </SelectTrigger>
                <SelectContent className="max-h-[200px]">
                  {siteProducts?.map(p => (
                    <SelectItem key={p.id} value={p.id}>
                      <div className="flex items-center gap-2">
                        {p.image_url && <img src={p.image_url} alt="" className="w-6 h-6 rounded object-cover" />}
                        <span className="truncate">{p.name_ar}</span>
                        {p.price && <span className="text-xs text-muted-foreground">{p.price.toLocaleString()} د.ع</span>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Submit */}
            <Button onClick={() => uploadMutation.mutate()} disabled={!videoFile || uploading} className="w-full">
              {uploading ? <><Loader2 className="w-4 h-4 animate-spin ml-2" /> جاري الرفع...</> : <><Check className="w-4 h-4 ml-2" /> رفع الريل</>}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

function ReelsGrid({ reels, onDelete, onStatusChange, formatCount }: {
  reels: any[];
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: string) => void;
  formatCount: (n: number) => string;
}) {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
      {reels.map((reel) => {
        const st = statusLabels[reel.status] || { label: reel.status, variant: 'outline' as const };
        return (
          <div key={reel.id} className="relative rounded-xl overflow-hidden bg-muted group aspect-[9/16]">
            {reel.thumbnail_url ? (
              <img src={reel.thumbnail_url} alt="" className="w-full h-full object-cover" />
            ) : (
              <video src={reel.video_url} className="w-full h-full object-cover" muted preload="metadata" />
            )}
            <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />

            {/* Status badge */}
            <Badge variant={st.variant} className="absolute top-1.5 right-1.5 text-[8px] h-4 px-1.5">
              {st.label}
            </Badge>

            {/* Stats */}
            <div className="absolute bottom-1 left-1 flex items-center gap-1.5 text-white text-[9px]">
              <span className="flex items-center gap-0.5"><Eye className="w-2.5 h-2.5" />{formatCount(reel.views_count)}</span>
              <span className="flex items-center gap-0.5"><Heart className="w-2.5 h-2.5" />{formatCount(reel.likes_count)}</span>
            </div>

            {/* Actions on hover */}
            <div className="absolute top-1.5 left-1.5 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
              {reel.status === 'pending' && (
                <button onClick={() => onStatusChange(reel.id, 'approved')} className="w-5 h-5 rounded-full bg-green-500/80 flex items-center justify-center" title="موافقة">
                  <Check className="w-3 h-3 text-white" />
                </button>
              )}
              {reel.status !== 'rejected' && reel.status === 'pending' && (
                <button onClick={() => onStatusChange(reel.id, 'rejected')} className="w-5 h-5 rounded-full bg-red-500/80 flex items-center justify-center" title="رفض">
                  <X className="w-3 h-3 text-white" />
                </button>
              )}
              <button onClick={() => { if (confirm('هل أنت متأكد من حذف هذا الريل؟')) onDelete(reel.id); }} className="w-5 h-5 rounded-full bg-black/60 flex items-center justify-center" title="حذف">
                <Trash2 className="w-3 h-3 text-white" />
              </button>
            </div>

            {/* Date */}
            <div className="absolute bottom-1 right-1 text-[8px] text-white/60">
              {format(new Date(reel.created_at), 'MM/dd')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
