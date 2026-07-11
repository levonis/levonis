import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle
} from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { Star, Trash2, Eye, Image as ImageIcon, Video, Gift, Search, MessageSquareOff } from 'lucide-react';

const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; label: string } | null>(null);
  const [confirmClearComment, setConfirmClearComment] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [ratingFilter, setRatingFilter] = useState<number | null>(null);

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews-all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, products:product_id(name_ar, image_url, images)')
        .order('created_at', { ascending: false })
        .limit(500);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: stats } = useQuery({
    queryKey: ['admin-reviews-stats'],
    queryFn: async () => {
      const { count: total } = await supabase.from('reviews').select('id', { count: 'exact', head: true });
      const { count: lowRated } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).lte('rating', 2);
      const { count: withMedia } = await supabase.from('reviews').select('id', { count: 'exact', head: true }).not('media_files', 'is', null);
      return { total: total || 0, lowRated: lowRated || 0, withMedia: withMedia || 0 };
    },
  });

  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.from('reviews').delete().eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-all'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-stats'] });
      setSelectedReview(null);
      setConfirmDelete(null);
      toast.success('تم حذف التقييم');
    },
    onError: (err: any) => toast.error(err.message || 'فشل الحذف'),
  });

  const clearCommentMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase.from('reviews').update({ comment: null }).eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-all'] });
      setConfirmClearComment(null);
      toast.success('تم حذف نص التعليق (النجوم محفوظة)');
    },
    onError: (err: any) => toast.error(err.message || 'فشل الحذف'),
  });

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted-foreground/30'}`} />
      ))}
    </div>
  );

  const getProductImage = (review: any) => {
    const p = review.products;
    if (!p) return null;
    return p.image_url || (p.images && p.images[0]) || null;
  };

  const filtered = reviews.filter((r: any) => {
    if (ratingFilter !== null && r.rating !== ratingFilter) return false;
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      const productName = (r.products?.name_ar || '').toLowerCase();
      const comment = (r.comment || '').toLowerCase();
      if (!productName.includes(q) && !comment.includes(q)) return false;
    }
    return true;
  });

  return (
    <AdminLayout title="إدارة التقييمات" icon={<Star className="h-6 w-6" />}>
      {/* Info banner */}
      <Card className="mb-4 border-emerald-500/30 bg-emerald-500/5">
        <CardContent className="py-3 flex items-center gap-3">
          <div className="h-8 w-8 rounded-lg bg-emerald-500/15 flex items-center justify-center">
            <Star className="h-4 w-4 text-emerald-600 fill-emerald-600" />
          </div>
          <p className="text-sm text-emerald-700 dark:text-emerald-300">
            التقييمات تُنشر تلقائياً بدون مراجعة. يمكنك حذف أي تقييم مسيء أو مسح نص التعليق فقط.
          </p>
        </CardContent>
      </Card>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 mb-4">
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-primary">{stats?.total || 0}</p>
          <p className="text-xs text-muted-foreground">إجمالي التقييمات</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-destructive">{stats?.lowRated || 0}</p>
          <p className="text-xs text-muted-foreground">منخفضة (≤2★)</p>
        </CardContent></Card>
        <Card><CardContent className="p-3 text-center">
          <p className="text-2xl font-black text-emerald-600">{stats?.withMedia || 0}</p>
          <p className="text-xs text-muted-foreground">تحتوي وسائط</p>
        </CardContent></Card>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="ابحث في اسم المنتج أو التعليق..."
            className="pr-9"
          />
        </div>
        <div className="flex gap-1">
          <Button
            size="sm"
            variant={ratingFilter === null ? 'default' : 'outline'}
            onClick={() => setRatingFilter(null)}
          >الكل</Button>
          {[5, 4, 3, 2, 1].map(n => (
            <Button
              key={n}
              size="sm"
              variant={ratingFilter === n ? 'default' : 'outline'}
              onClick={() => setRatingFilter(ratingFilter === n ? null : n)}
              className="gap-1"
            >
              {n}<Star className="h-3 w-3 fill-current" />
            </Button>
          ))}
        </div>
      </div>

      {/* List */}
      {isLoading ? (
        <div className="space-y-3">{[1,2,3].map(i => (
          <div key={i} className="rounded-lg border bg-card p-4 h-24 animate-pulse" />
        ))}</div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">لا توجد تقييمات</div>
      ) : (
        <div className="space-y-3">
          {filtered.map((review: any) => {
            const productImg = getProductImage(review);
            return (
              <Card key={review.id} className="overflow-hidden">
                <CardContent className="p-4">
                  <div className="flex gap-4" dir="rtl">
                    {productImg && (
                      <img src={productImg} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" loading="lazy" decoding="async" />
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      <div className="flex items-center justify-between gap-2">
                        <h4 className="font-medium text-sm truncate">{review.products?.name_ar || 'منتج محذوف'}</h4>
                        {renderStars(review.rating)}
                      </div>
                      {review.comment && (
                        <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {review.media_files?.length > 0 && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <ImageIcon className="h-3 w-3" />{review.media_files.length}
                          </Badge>
                        )}
                        {review.video_url && (
                          <Badge variant="secondary" className="gap-1 text-xs">
                            <Video className="h-3 w-3" />فيديو
                          </Badge>
                        )}
                        {review.is_auto_rating && (
                          <Badge variant="outline" className="text-xs">تلقائي</Badge>
                        )}
                        {review.points_awarded > 0 && (
                          <Badge className="gap-1 text-xs bg-amber-500/10 text-amber-700 border-amber-500/30">
                            <Gift className="h-3 w-3" />{review.points_awarded}
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground mr-auto">
                          {new Date(review.created_at).toLocaleDateString('ar-IQ')}
                        </span>
                      </div>
                    </div>
                    <div className="flex flex-col gap-1.5 shrink-0">
                      <Button size="sm" variant="outline" onClick={() => setSelectedReview(review)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      {review.comment && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => setConfirmClearComment(review.id)}
                          title="مسح نص التعليق فقط"
                        >
                          <MessageSquareOff className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setConfirmDelete({ id: review.id, label: review.products?.name_ar || 'التقييم' })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => setSelectedReview(null)}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader><DialogTitle>تفاصيل التقييم</DialogTitle></DialogHeader>
          {selectedReview && (
            <div className="space-y-4">
              <div className="flex items-center gap-3">
                {getProductImage(selectedReview) && (
                  <img src={getProductImage(selectedReview)} alt="" className="w-14 h-14 rounded-lg object-cover" loading="lazy" decoding="async" />
                )}
                <div>
                  <p className="font-medium">{selectedReview.products?.name_ar || 'منتج محذوف'}</p>
                  <div className="mt-1">{renderStars(selectedReview.rating)}</div>
                </div>
              </div>
              {selectedReview.comment && (
                <div>
                  <Label className="text-sm text-muted-foreground">التعليق</Label>
                  <p className="mt-1 text-sm bg-muted/50 rounded-lg p-3">{selectedReview.comment}</p>
                </div>
              )}
              {selectedReview.media_files?.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">الوسائط</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedReview.media_files.map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt="" className="w-full aspect-square object-cover rounded-lg border" loading="lazy" decoding="async" />
                      </a>
                    ))}
                  </div>
                </div>
              )}
              {selectedReview.video_url && (
                <video src={selectedReview.video_url} controls className="w-full rounded-lg" />
              )}
              <div className="flex gap-2 border-t pt-4">
                {selectedReview.comment && (
                  <Button
                    variant="outline"
                    className="flex-1"
                    onClick={() => setConfirmClearComment(selectedReview.id)}
                  >
                    <MessageSquareOff className="h-4 w-4 ml-2" />
                    حذف التعليق فقط
                  </Button>
                )}
                <Button
                  variant="destructive"
                  className="flex-1"
                  onClick={() => setConfirmDelete({ id: selectedReview.id, label: selectedReview.products?.name_ar || 'التقييم' })}
                >
                  <Trash2 className="h-4 w-4 ml-2" />
                  حذف التقييم
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!confirmDelete} onOpenChange={() => setConfirmDelete(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف التقييم؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم حذف التقييم بالكامل (النجوم، التعليق، الوسائط). هذا الإجراء لا يمكن التراجع عنه.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmDelete && deleteReviewMutation.mutate(confirmDelete.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >حذف</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Clear comment confirmation */}
      <AlertDialog open={!!confirmClearComment} onOpenChange={() => setConfirmClearComment(null)}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>مسح نص التعليق؟</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم مسح نص التعليق فقط. النجوم والوسائط تبقى محفوظة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => confirmClearComment && clearCommentMutation.mutate(confirmClearComment)}
            >مسح</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
};

export default AdminReviews;
