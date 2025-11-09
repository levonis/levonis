import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Star, Trash2, Loader2, CheckCircle } from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import LevelBadge from '@/components/LevelBadge';

interface ProductReviewsProps {
  productId: string;
}

export default function ProductReviews({ productId }: ProductReviewsProps) {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [hoveredRating, setHoveredRating] = useState(0);

  // جلب المراجعات
  const { data: reviews, isLoading } = useQuery({
    queryKey: ['reviews', productId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          profiles (
            full_name,
            username,
            avatar_url
          )
        `)
        .eq('product_id', productId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
  });

  // جلب مراجعة المستخدم الحالي
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

  // التحقق من أن المستخدم اشترى المنتج واستلمه
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

  // إضافة أو تحديث مراجعة
  const submitReviewMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      const reviewData = {
        user_id: user.id,
        product_id: productId,
        rating,
        comment: comment.trim() || null,
      };

      if (userReview) {
        const { error } = await supabase
          .from('reviews')
          .update(reviewData)
          .eq('id', userReview.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from('reviews')
          .insert([reviewData]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', productId, user?.id] });
      setComment('');
      toast.success(userReview ? 'تم تحديث تقييمك بنجاح' : 'تم إضافة تقييمك بنجاح');
    },
    onError: (error: any) => {
      toast.error('حدث خطأ: ' + error.message);
    },
  });

  // حذف مراجعة
  const deleteReviewMutation = useMutation({
    mutationFn: async (reviewId: string) => {
      const { error } = await supabase
        .from('reviews')
        .delete()
        .eq('id', reviewId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      queryClient.invalidateQueries({ queryKey: ['user-review', productId, user?.id] });
      toast.success('تم حذف التقييم بنجاح');
    },
    onError: () => {
      toast.error('حدث خطأ أثناء حذف التقييم');
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) {
      toast.error('يجب تسجيل الدخول أولاً');
      return;
    }
    submitReviewMutation.mutate();
  };

  const canDelete = (review: any) => {
    return isAdmin || (user && review.user_id === user.id);
  };

  // حساب متوسط التقييم
  const averageRating = reviews?.length
    ? (reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length).toFixed(1)
    : 0;

  return (
    <div className="space-y-6">
      {/* ملخص التقييمات */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-primary fill-primary" />
            التقييمات والمراجعات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {reviews && reviews.length > 0 ? (
            <div className="flex items-center gap-4">
              <div className="text-center">
                <div className="text-4xl font-black text-primary">{averageRating}</div>
                <div className="flex items-center justify-center gap-1 my-2">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <Star
                      key={star}
                      className={`h-4 w-4 ${
                        star <= Math.round(Number(averageRating))
                          ? 'text-primary fill-primary'
                          : 'text-muted-foreground'
                      }`}
                    />
                  ))}
                </div>
                <div className="text-sm text-muted-foreground">
                  {reviews.length} {reviews.length === 1 ? 'تقييم' : 'تقييمات'}
                </div>
              </div>
            </div>
          ) : (
            <p className="text-muted-foreground text-center py-4">لا توجد تقييمات بعد</p>
          )}
        </CardContent>
      </Card>

      {/* نموذج إضافة/تعديل تقييم */}
      {user && (
        <Card>
          <CardHeader>
            <CardTitle>
              {userReview ? 'تعديل تقييمك' : 'أضف تقييمك'}
            </CardTitle>
          </CardHeader>
          <CardContent>
            {hasPurchased ? (
              <form onSubmit={handleSubmit} className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">التقييم</label>
                  <div className="flex gap-2">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setRating(star)}
                        onMouseEnter={() => setHoveredRating(star)}
                        onMouseLeave={() => setHoveredRating(0)}
                        className="transition-transform hover:scale-110"
                      >
                        <Star
                          className={`h-8 w-8 ${
                            star <= (hoveredRating || rating)
                              ? 'text-primary fill-primary'
                              : 'text-muted-foreground'
                          }`}
                        />
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className="block text-sm font-medium mb-2">
                    التعليق (اختياري)
                  </label>
                  <Textarea
                    value={comment}
                    onChange={(e) => setComment(e.target.value)}
                    placeholder="شارك تجربتك مع هذا المنتج..."
                    rows={4}
                    maxLength={500}
                  />
                </div>

                <Button
                  type="submit"
                  disabled={submitReviewMutation.isPending}
                  className="w-full"
                >
                  {submitReviewMutation.isPending && (
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  )}
                  {userReview ? 'تحديث التقييم' : 'إضافة التقييم'}
                </Button>
              </form>
            ) : (
              <div className="text-center py-8 space-y-3">
                <div className="w-16 h-16 mx-auto bg-muted rounded-full flex items-center justify-center mb-4">
                  <Star className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-muted-foreground font-medium">
                  يمكنك التقييم فقط بعد شراء المنتج واستلامه
                </p>
                <p className="text-sm text-muted-foreground">
                  نريد التأكد من أن جميع التقييمات من مشترين حقيقيين
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* قائمة المراجعات */}
      {isLoading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-4">
          {reviews?.map((review) => (
            <Card key={review.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <Avatar>
                    <AvatarImage src={(review as any).profiles?.avatar_url || undefined} />
                    <AvatarFallback>
                      {(review as any).profiles?.full_name?.[0] || (review as any).profiles?.username?.[0] || 'م'}
                    </AvatarFallback>
                  </Avatar>

                  <div className="flex-1">
                    <div className="flex items-start justify-between">
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold">
                            {(review as any).profiles?.username || (review as any).profiles?.full_name || 'مستخدم'}
                          </span>
                          <LevelBadge userId={review.user_id} size="sm" />
                          <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/30">
                            <CheckCircle className="h-3 w-3 ml-1" />
                            عملية شراء مؤكدة
                          </Badge>
                        </div>
                        <div className="flex items-center gap-1 my-1">
                          {[1, 2, 3, 4, 5].map((star) => (
                            <Star
                              key={star}
                              className={`h-4 w-4 ${
                                star <= review.rating
                                  ? 'text-primary fill-primary'
                                  : 'text-muted-foreground'
                              }`}
                            />
                          ))}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {formatDistanceToNow(new Date(review.created_at), {
                            addSuffix: true,
                            locale: ar,
                          })}
                        </div>
                      </div>

                      {canDelete(review) && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => deleteReviewMutation.mutate(review.id)}
                          disabled={deleteReviewMutation.isPending}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </div>

                    {review.comment && (
                      <p className="mt-3 text-muted-foreground">{review.comment}</p>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
