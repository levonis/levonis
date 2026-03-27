import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout from '@/components/admin/AdminLayout';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Star, Check, X, Eye, Image, Video, Gift, Loader2 } from 'lucide-react';
import { ADMIN_ROUTES } from '@/config/adminConfig';

const AdminReviews = () => {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('pending');
  const [selectedReview, setSelectedReview] = useState<any>(null);
  const [customPoints, setCustomPoints] = useState('');

  const { data: reviews = [], isLoading } = useQuery({
    queryKey: ['admin-reviews', activeTab],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select('*, products:product_id(name_ar, image_url, images)')
        .eq('status', activeTab)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
  });

  const { data: reviewSettings } = useQuery({
    queryKey: ['review-reward-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('*')
        .in('setting_key', ['points_per_review', 'points_per_verified_review']);
      const settings: Record<string, number> = {};
      data?.forEach((s: any) => {
        settings[s.setting_key] = typeof s.setting_value === 'object' 
          ? (s.setting_value as any).value || 0 
          : Number(s.setting_value) || 0;
      });
      return settings;
    },
  });

  const { data: counts } = useQuery({
    queryKey: ['admin-reviews-counts'],
    queryFn: async () => {
      const [pending, approved, rejected] = await Promise.all([
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'pending'),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'approved'),
        supabase.from('reviews').select('id', { count: 'exact', head: true }).eq('status', 'rejected'),
      ]);
      return { pending: pending.count || 0, approved: approved.count || 0, rejected: rejected.count || 0 };
    },
  });

  const updateReviewMutation = useMutation({
    mutationFn: async ({ reviewId, status, pointsOverride }: { reviewId: string; status: string; pointsOverride?: number }) => {
      const review = reviews.find((r: any) => r.id === reviewId);
      if (!review) throw new Error('Review not found');

      // Update review status
      const updateData: any = { status };
      if (pointsOverride !== undefined) {
        updateData.points_awarded = pointsOverride;
      }
      
      const { error } = await supabase.from('reviews').update(updateData).eq('id', reviewId);
      if (error) throw error;

      // If approving, award points
      if (status === 'approved') {
        const hasMedia = (review.media_files?.length > 0) || review.video_url;
        const basePoints = reviewSettings?.points_per_review || 10;
        const mediaPoints = reviewSettings?.points_per_verified_review || 25;
        const pointsToAward = pointsOverride ?? (hasMedia ? mediaPoints : basePoints);

        if (pointsToAward > 0) {
          // Add points transaction
          await supabase.from('points_transactions').insert({
            user_id: review.user_id,
            points: pointsToAward,
            type: 'earned',
            source: hasMedia ? 'verified_review' : 'review',
            description: `جائزة تقييم المنتج`,
            related_id: review.product_id,
          });

          // Update user points
          const { data: currentPoints } = await supabase
            .from('user_points').select('*').eq('user_id', review.user_id).maybeSingle();

          if (currentPoints) {
            await supabase.from('user_points').update({
              total_points: (currentPoints.total_points || 0) + pointsToAward,
              available_points: (currentPoints.available_points || 0) + pointsToAward,
            }).eq('user_id', review.user_id);
          } else {
            await supabase.from('user_points').insert({
              user_id: review.user_id,
              total_points: pointsToAward,
              available_points: pointsToAward,
            });
          }
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-reviews'] });
      queryClient.invalidateQueries({ queryKey: ['admin-reviews-counts'] });
      setSelectedReview(null);
      setCustomPoints('');
      toast.success('تم تحديث التقييم بنجاح');
    },
    onError: (err: any) => toast.error(err.message),
  });

  const handleApprove = (reviewId: string, points?: number) => {
    updateReviewMutation.mutate({ reviewId, status: 'approved', pointsOverride: points });
  };

  const handleReject = (reviewId: string) => {
    updateReviewMutation.mutate({ reviewId, status: 'rejected' });
  };

  const renderStars = (rating: number) => (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map(i => (
        <Star key={i} className={`h-4 w-4 ${i <= rating ? 'fill-yellow-400 text-yellow-400' : 'text-muted'}`} />
      ))}
    </div>
  );

  const getProductImage = (review: any) => {
    const product = review.products;
    if (!product) return null;
    return product.image_url || (product.images && product.images[0]) || null;
  };

  const ReviewCard = ({ review }: { review: any }) => {
    const hasMedia = (review.media_files?.length > 0) || review.video_url;
    const productImg = getProductImage(review);

    return (
      <Card className="overflow-hidden">
        <CardContent className="p-4">
          <div className="flex gap-4" dir="rtl">
            {/* Product Image */}
            {productImg && (
              <img src={productImg} alt="" className="w-16 h-16 rounded-lg object-cover shrink-0" />
            )}

            <div className="flex-1 min-w-0 space-y-2">
              {/* Product Name & Rating */}
              <div className="flex items-center justify-between gap-2">
                <h4 className="font-medium text-sm truncate">{review.products?.name_ar || 'منتج محذوف'}</h4>
                {renderStars(review.rating)}
              </div>

              {/* Comment */}
              {review.comment && (
                <p className="text-sm text-muted-foreground line-clamp-2">{review.comment}</p>
              )}

              {/* Media indicators */}
              <div className="flex items-center gap-2 flex-wrap">
                {review.media_files?.length > 0 && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Image className="h-3 w-3" />
                    {review.media_files.length} صور
                  </Badge>
                )}
                {review.video_url && (
                  <Badge variant="secondary" className="gap-1 text-xs">
                    <Video className="h-3 w-3" />
                    فيديو
                  </Badge>
                )}
                {review.is_auto_rating && (
                  <Badge variant="outline" className="text-xs">تقييم تلقائي</Badge>
                )}
                {review.points_awarded > 0 && (
                  <Badge className="gap-1 text-xs bg-amber-500/10 text-amber-600 border-amber-200">
                    <Gift className="h-3 w-3" />
                    {review.points_awarded} نقطة
                  </Badge>
                )}
              </div>

              {/* Date */}
              <p className="text-xs text-muted-foreground">
                {new Date(review.created_at).toLocaleDateString('ar-IQ')}
              </p>
            </div>

            {/* Actions */}
            <div className="flex flex-col gap-2 shrink-0">
              <Button size="sm" variant="outline" onClick={() => setSelectedReview(review)}>
                <Eye className="h-4 w-4" />
              </Button>
              {activeTab === 'pending' && (
                <>
                  <Button size="sm" variant="default" className="bg-green-600 hover:bg-green-700"
                    onClick={() => handleApprove(review.id)}
                    disabled={updateReviewMutation.isPending}>
                    <Check className="h-4 w-4" />
                  </Button>
                  <Button size="sm" variant="destructive"
                    onClick={() => handleReject(review.id)}
                    disabled={updateReviewMutation.isPending}>
                    <X className="h-4 w-4" />
                  </Button>
                </>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
    );
  };

  return (
    <AdminLayout title="إدارة التقييمات" icon={<Star className="h-6 w-6" />}>
      <Tabs value={activeTab} onValueChange={setActiveTab} dir="rtl">
        <TabsList className="grid w-full grid-cols-3 mb-6">
          <TabsTrigger value="pending" className="gap-2">
            بانتظار الموافقة
            {counts?.pending ? <Badge variant="destructive" className="text-xs">{counts.pending}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="approved" className="gap-2">
            تمت الموافقة
            {counts?.approved ? <Badge variant="secondary" className="text-xs">{counts.approved}</Badge> : null}
          </TabsTrigger>
          <TabsTrigger value="rejected" className="gap-2">
            مرفوض
            {counts?.rejected ? <Badge variant="secondary" className="text-xs">{counts.rejected}</Badge> : null}
          </TabsTrigger>
        </TabsList>

        {['pending', 'approved', 'rejected'].map(tab => (
          <TabsContent key={tab} value={tab}>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : reviews.length === 0 ? (
              <div className="text-center py-12 text-muted-foreground">
                لا توجد تقييمات
              </div>
            ) : (
              <div className="space-y-3">
                {reviews.map((review: any) => (
                  <ReviewCard key={review.id} review={review} />
                ))}
              </div>
            )}
          </TabsContent>
        ))}
      </Tabs>

      {/* Review Detail Dialog */}
      <Dialog open={!!selectedReview} onOpenChange={() => { setSelectedReview(null); setCustomPoints(''); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تفاصيل التقييم</DialogTitle>
          </DialogHeader>

          {selectedReview && (
            <div className="space-y-4">
              {/* Product */}
              <div className="flex items-center gap-3">
                {getProductImage(selectedReview) && (
                  <img src={getProductImage(selectedReview)} alt="" className="w-14 h-14 rounded-lg object-cover" />
                )}
                <div>
                  <p className="font-medium">{selectedReview.products?.name_ar || 'منتج محذوف'}</p>
                  <div className="mt-1">{renderStars(selectedReview.rating)}</div>
                </div>
              </div>

              {/* Comment */}
              {selectedReview.comment && (
                <div>
                  <Label className="text-sm text-muted-foreground">التعليق</Label>
                  <p className="mt-1 text-sm bg-muted/50 rounded-lg p-3">{selectedReview.comment}</p>
                </div>
              )}

              {/* Media */}
              {selectedReview.media_files?.length > 0 && (
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">الوسائط المرفقة</Label>
                  <div className="grid grid-cols-3 gap-2">
                    {selectedReview.media_files.map((url: string, idx: number) => (
                      <a key={idx} href={url} target="_blank" rel="noreferrer">
                        <img src={url} alt={`Media ${idx + 1}`} className="w-full aspect-square object-cover rounded-lg border hover:opacity-80 transition" />
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {selectedReview.video_url && (
                <div>
                  <Label className="text-sm text-muted-foreground mb-2 block">فيديو</Label>
                  <video src={selectedReview.video_url} controls className="w-full rounded-lg" />
                </div>
              )}

              {/* Points Award Section */}
              {selectedReview.status === 'pending' && (
                <div className="border-t pt-4 space-y-3">
                  <Label className="font-medium flex items-center gap-2">
                    <Gift className="h-4 w-4 text-amber-500" />
                    تحديد الجائزة (نقاط)
                  </Label>
                  
                  <div className="flex items-center gap-3">
                    <div className="flex gap-2">
                      <Button size="sm" variant="outline" onClick={() => setCustomPoints(String(reviewSettings?.points_per_review || 10))}>
                        تقييم عادي ({reviewSettings?.points_per_review || 10})
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => setCustomPoints(String(reviewSettings?.points_per_verified_review || 25))}>
                        مع وسائط ({reviewSettings?.points_per_verified_review || 25})
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <Input
                      type="number"
                      min="0"
                      placeholder="أو أدخل قيمة مخصصة"
                      value={customPoints}
                      onChange={(e) => setCustomPoints(e.target.value)}
                      className="flex-1"
                    />
                    <span className="text-sm text-muted-foreground">نقطة</span>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleApprove(selectedReview.id, customPoints ? parseInt(customPoints) : undefined)}
                      disabled={updateReviewMutation.isPending}
                    >
                      {updateReviewMutation.isPending ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : <Check className="h-4 w-4 ml-2" />}
                      موافقة
                    </Button>
                    <Button
                      variant="destructive"
                      className="flex-1"
                      onClick={() => handleReject(selectedReview.id)}
                      disabled={updateReviewMutation.isPending}
                    >
                      <X className="h-4 w-4 ml-2" />
                      رفض
                    </Button>
                  </div>
                </div>
              )}

              {/* Already processed */}
              {selectedReview.status !== 'pending' && (
                <div className="border-t pt-4">
                  <Badge variant={selectedReview.status === 'approved' ? 'default' : 'destructive'}>
                    {selectedReview.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}
                  </Badge>
                  {selectedReview.points_awarded > 0 && (
                    <p className="text-sm mt-2 text-amber-600">
                      تم منح {selectedReview.points_awarded} نقطة
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminReviews;
