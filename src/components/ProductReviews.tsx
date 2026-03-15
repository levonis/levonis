import { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Star, Loader2, Upload, X, Video, Image as ImageIcon,
  SlidersHorizontal, ChevronDown, CheckCircle, MessageSquareText
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import ReviewSummary from '@/components/reviews/ReviewSummary';
import TaobaoReviewCard from '@/components/reviews/TaobaoReviewCard';
import BuyerShowcase from '@/components/reviews/BuyerShowcase';

interface ProductReviewsProps {
  productId: string;
}

type TabKey = 'all' | 'media' | 'positive' | 'neutral' | 'negative';
type SortKey = 'recent' | 'highest' | 'lowest' | 'media';

const TABS: { key: TabKey; label: string }[] = [
  { key: 'all', label: 'الكل' },
  { key: 'media', label: 'صور/فيديو' },
  { key: 'positive', label: 'إيجابي' },
  { key: 'neutral', label: 'محايد' },
  { key: 'negative', label: 'سلبي' },
];

const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'recent', label: 'الأحدث' },
  { key: 'highest', label: 'الأعلى تقييماً' },
  { key: 'lowest', label: 'الأقل تقييماً' },
  { key: 'media', label: 'مع صور أولاً' },
];

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<TabKey>('all');
  const [sortBy, setSortBy] = useState<SortKey>('recent');
  const [showSort, setShowSort] = useState(false);
  const [showAllReviews, setShowAllReviews] = useState(false);

  // Review form state
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);
  const [mediaFiles, setMediaFiles] = useState<File[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);
  const [showForm, setShowForm] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Fetch reviews
  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      if (!data || data.length === 0) return [];

      // Fetch profiles separately
      const userIds = Array.from(new Set(data.map((r) => r.user_id)));
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);
      const profileMap = new Map(profiles?.map((p) => [p.id, p]) || []);

      return data.map((r) => ({
        ...r,
        product_id: productId,
        profiles: profileMap.get(r.user_id) || null,
      }));
    },
  });

  // Check if user purchased
  const { data: userReview } = useQuery({
    queryKey: ['user-review', productId, user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('reviews')
        .select('*')
        .eq('product_id', productId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: hasPurchased } = useQuery({
    queryKey: ['has-purchased', productId, user?.id],
    queryFn: async () => {
      if (!user) return false;
      const { data, error } = await supabase
        .from('order_items')
        .select('id, orders!inner(status)')
        .eq('product_id', productId)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return !!data;
    },
    enabled: !!user,
  });

  // Submit review
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      setUploadingMedia(true);

      const uploadedUrls: string[] = [];
      for (const file of mediaFiles) {
        const ext = file.name.split('.').pop();
        const name = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
        const { error } = await supabase.storage.from('review-media').upload(name, file, { cacheControl: '3600', upsert: false });
        if (error) throw error;
        const { data: { publicUrl } } = supabase.storage.from('review-media').getPublicUrl(name);
        uploadedUrls.push(publicUrl);
      }

      const reviewData = {
        user_id: user.id,
        product_id: productId,
        rating,
        comment: comment.trim() || null,
        media_files: uploadedUrls,
      };

      if (userReview) {
        const { error } = await supabase.from('reviews').update(reviewData).eq('id', userReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('reviews').insert([reviewData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', productId, user?.id] });
      setComment('');
      setMediaFiles([]);
      setUploadingMedia(false);
      setShowForm(false);
      toast.success(userReview ? 'تم تحديث تقييمك بنجاح' : 'تم إضافة تقييمك بنجاح ✨');
    },
    onError: (error: any) => {
      setUploadingMedia(false);
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  // Delete review
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', productId, user?.id] });
      toast.success('تم حذف التقييم');
    },
  });

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter((f) => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} أكبر من 10 ميجابايت`); return false; }
      return true;
    });
    setMediaFiles((prev) => [...prev, ...files].slice(0, 5));
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Filter + Sort
  const filtered = useMemo(() => {
    let list = [...reviews];
    switch (activeTab) {
      case 'media':
        list = list.filter((r) => (r.media_files?.length || 0) > 0 || r.video_url);
        break;
      case 'positive':
        list = list.filter((r) => r.rating >= 4);
        break;
      case 'neutral':
        list = list.filter((r) => r.rating === 3);
        break;
      case 'negative':
        list = list.filter((r) => r.rating <= 2);
        break;
    }
    // Always prioritize manual reviews over auto-ratings
    const manualFirst = (a: any, b: any) => {
      const aAuto = a.is_auto_rating ? 1 : 0;
      const bAuto = b.is_auto_rating ? 1 : 0;
      return aAuto - bAuto;
    };

    switch (sortBy) {
      case 'recent':
        list.sort((a, b) => manualFirst(a, b) || new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        break;
      case 'highest':
        list.sort((a, b) => manualFirst(a, b) || b.rating - a.rating);
        break;
      case 'lowest':
        list.sort((a, b) => manualFirst(a, b) || a.rating - b.rating);
        break;
      case 'media':
        list.sort((a, b) => manualFirst(a, b) || ((b.media_files?.length || 0) + (b.video_url ? 1 : 0)) - ((a.media_files?.length || 0) + (a.video_url ? 1 : 0)));
        break;
    }
    return list;
  }, [reviews, activeTab, sortBy]);

  const displayReviews = showAllReviews ? filtered : filtered.slice(0, 5);

  const isVideo = (name: string) => /\.(mp4|webm|mov)$/i.test(name);

  const tabCounts = useMemo(() => ({
    all: reviews.length,
    media: reviews.filter((r) => (r.media_files?.length || 0) > 0 || r.video_url).length,
    positive: reviews.filter((r) => r.rating >= 4).length,
    neutral: reviews.filter((r) => r.rating === 3).length,
    negative: reviews.filter((r) => r.rating <= 2).length,
  }), [reviews]);

  if (isLoading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-36 rounded-2xl" />
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-32 rounded-2xl" />
        <Skeleton className="h-32 rounded-2xl" />
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-foreground flex items-center gap-2">
          <MessageSquareText className="h-5 w-5 text-primary" />
          التقييمات والمراجعات
        </h2>
        {user && hasPurchased && !userReview && (
          <Button
            size="sm"
            onClick={() => setShowForm(!showForm)}
            className="h-8 rounded-xl"
          >
            <Star className="h-3.5 w-3.5 ml-1" />
            أضف تقييمك
          </Button>
        )}
      </div>

      {/* Rating Summary */}
      {reviews.length > 0 && <ReviewSummary reviews={reviews} totalCount={reviews.length} />}

      {/* Buyer Showcase */}
      <BuyerShowcase reviews={reviews} />

      {/* Review Form */}
      <AnimatePresence>
        {showForm && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl rounded-2xl p-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-primary/20 space-y-4">
              <h3 className="text-sm font-bold">شارك تجربتك</h3>

              {/* Stars */}
              <div className="flex gap-2 justify-center py-2">
                {[1, 2, 3, 4, 5].map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setRating(s)}
                    onMouseEnter={() => setHoveredRating(s)}
                    onMouseLeave={() => setHoveredRating(0)}
                    className="transition-transform hover:scale-125 active:scale-95"
                  >
                    <Star
                      className={`h-9 w-9 transition-colors ${
                        s <= (hoveredRating || rating)
                          ? 'fill-primary text-primary drop-shadow-[0_2px_6px_hsl(var(--primary)/0.5)]'
                          : 'text-muted-foreground/30'
                      }`}
                    />
                  </button>
                ))}
              </div>

              <Textarea
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="شارك تجربتك مع هذا المنتج..."
                rows={3}
                maxLength={500}
                className="rounded-xl border-border/50 resize-none"
              />

              {/* Media Upload */}
              <div>
                <input ref={fileInputRef} type="file" accept="image/*,video/*" multiple onChange={handleFileSelect} className="hidden" />
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={mediaFiles.length >= 5}
                  className="w-full rounded-xl border-dashed border-2 h-12"
                >
                  <Upload className="h-4 w-4 ml-2" />
                  {mediaFiles.length > 0 ? `${mediaFiles.length} ملفات مختارة` : 'أضف صور أو فيديو'}
                </Button>
                {mediaFiles.length > 0 && (
                  <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                    {mediaFiles.map((file, i) => (
                      <div key={i} className="relative shrink-0 w-16 h-16 rounded-xl overflow-hidden border border-border group">
                        {isVideo(file.name) ? (
                          <div className="w-full h-full bg-muted flex items-center justify-center">
                            <Video className="h-5 w-5 text-muted-foreground" />
                          </div>
                        ) : (
                          <img src={URL.createObjectURL(file)} alt="" className="w-full h-full object-cover" />
                        )}
                        <button
                          onClick={() => setMediaFiles((prev) => prev.filter((_, idx) => idx !== i))}
                          className="absolute top-0.5 right-0.5 p-0.5 rounded-full bg-destructive text-destructive-foreground opacity-0 group-hover:opacity-100 transition"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <div className="flex gap-2">
                <Button
                  onClick={() => submitMutation.mutate()}
                  disabled={submitMutation.isPending || uploadingMedia}
                  className="flex-1 rounded-xl"
                >
                  {(submitMutation.isPending || uploadingMedia) && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
                  {uploadingMedia ? 'جاري الرفع...' : 'إرسال التقييم'}
                </Button>
                <Button variant="outline" onClick={() => setShowForm(false)} className="rounded-xl">
                  إلغاء
                </Button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* No Reviews */}
      {reviews.length === 0 && (
        <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl rounded-2xl p-8 text-center shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-border/30">
          <div className="absolute -top-10 -right-10 w-24 h-24 bg-primary/8 rounded-full blur-3xl pointer-events-none" />
          <div className="relative w-14 h-14 mx-auto mb-3 rounded-full bg-primary/10 flex items-center justify-center">
            <Star className="h-7 w-7 text-primary" />
          </div>
          <p className="text-sm font-medium text-foreground">لا توجد تقييمات بعد</p>
          <p className="text-xs text-muted-foreground mt-1">كن أول من يقيّم هذا المنتج!</p>
        </div>
      )}

      {/* Tabs & Sort */}
      {reviews.length > 0 && (
        <>
          <div className="flex items-center gap-2">
            {/* Tabs */}
            <div className="flex-1 flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              {TABS.map((tab) => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`shrink-0 px-3 py-1.5 rounded-full text-xs font-medium transition-all whitespace-nowrap ${
                    activeTab === tab.key
                      ? 'bg-primary text-primary-foreground shadow-[0_4px_16px_hsl(var(--primary)/0.25)]'
                      : 'bg-background/50 backdrop-blur-sm text-muted-foreground hover:bg-background/70 border border-border/20'
                  }`}
                >
                  {tab.label} ({tabCounts[tab.key]})
                </button>
              ))}
            </div>

            {/* Sort */}
            <div className="relative shrink-0">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowSort(!showSort)}
                className="h-7 px-2 rounded-lg text-xs gap-1"
              >
                <SlidersHorizontal className="h-3 w-3" />
                <ChevronDown className="h-3 w-3" />
              </Button>
              <AnimatePresence>
                {showSort && (
                  <motion.div
                    initial={{ opacity: 0, y: -5 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -5 }}
                    className="absolute left-0 top-full mt-1 z-50 bg-card/90 backdrop-blur-xl rounded-xl shadow-[0_8px_32px_rgba(0,0,0,0.2)] border border-border/30 p-1 min-w-[140px]"
                  >
                    {SORT_OPTIONS.map((opt) => (
                      <button
                        key={opt.key}
                        onClick={() => { setSortBy(opt.key); setShowSort(false); }}
                        className={`w-full text-right px-3 py-2 text-xs rounded-lg transition ${
                          sortBy === opt.key ? 'bg-primary/10 text-primary' : 'hover:bg-background/50'
                        }`}
                      >
                        {opt.label}
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </div>

          {/* Reviews List */}
          <div className="relative overflow-hidden bg-card/60 backdrop-blur-xl rounded-2xl px-4 shadow-[0_8px_32px_rgba(0,0,0,0.12)] border border-border/30">
            {displayReviews.length > 0 ? (
              displayReviews.map((review) => (
                <TaobaoReviewCard
                  key={review.id}
                  review={review}
                  isAdmin={isAdmin}
                  currentUserId={user?.id}
                  onDelete={(id) => deleteMutation.mutate(id)}
                />
              ))
            ) : (
              <div className="py-8 text-center text-sm text-muted-foreground">
                لا توجد تقييمات في هذا التصنيف
              </div>
            )}
          </div>

          {/* Load More */}
          {filtered.length > 5 && !showAllReviews && (
            <Button
              variant="outline"
              onClick={() => setShowAllReviews(true)}
              className="w-full rounded-xl border-primary/30 text-primary hover:bg-primary/10"
            >
              عرض كل التقييمات ({filtered.length})
            </Button>
          )}
        </>
      )}
    </div>
  );
}
