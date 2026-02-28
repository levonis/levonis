import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Loader2, ArrowRight, CheckCircle, Package, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import ProductRatingCard from '@/components/reviews/ProductRatingCard';

const ConfirmDelivery = () => {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});
  const [productImages, setProductImages] = useState<Record<string, File[]>>({});
  const [productVideos, setProductVideos] = useState<Record<string, File | null>>({});

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId],
    queryFn: async () => {
      if (!orderId || !user) return null;
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            *,
            products!order_items_product_id_fkey(name_ar, image_url, images),
            custom_product_requests(product_name, image_url)
          )
        `)
        .eq('id', orderId)
        .eq('user_id', user.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!orderId && !!user && !authLoading
  });

  const confirmMutation = useMutation({
    mutationFn: async () => {
      if (!order || !user) throw new Error('Missing data');

      const { error: orderError } = await supabase
        .from('orders')
        .update({
          user_confirmed_delivery: true,
          user_confirmed_at: new Date().toISOString()
        })
        .eq('id', order.id);
      if (orderError) throw orderError;

      // Upload media and create/update reviews
      const ratableItems = order.order_items.filter((item: any) => item.product_id);
      
      for (const item of ratableItems) {
        const pid = item.product_id;
        const uploadedImageUrls: string[] = [];
        
        // Upload images
        for (const img of (productImages[pid] || [])) {
          const ext = img.name.split('.').pop() || 'jpg';
          const path = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error } = await supabase.storage.from("review-media").upload(path, img);
          if (error) {
            console.error('Image upload error:', error);
          } else {
            const { data } = supabase.storage.from("review-media").getPublicUrl(path);
            uploadedImageUrls.push(data.publicUrl);
          }
        }

        // Upload video
        let videoUrl: string | null = null;
        const vid = productVideos[pid];
        if (vid) {
          const path = `${user.id}/${Date.now()}-video.mp4`;
          const { error } = await supabase.storage.from("review-media").upload(path, vid);
          if (error) {
            console.error('Video upload error:', error);
          } else {
            const { data } = supabase.storage.from("review-media").getPublicUrl(path);
            videoUrl = data.publicUrl;
          }
        }

        // Calculate points
        let points = 0;
        const userRating = ratings[pid] || 5;
        const deliveredAt = order.delivered_at ? new Date(order.delivered_at) : null;
        const now = new Date();
        const isWithin24h = deliveredAt && (now.getTime() - deliveredAt.getTime()) < 24 * 60 * 60 * 1000;
        if (userRating === 5 && isWithin24h) points = 10;
        if (uploadedImageUrls.length > 0) points += 50;
        if (videoUrl) points += 250;

        // Check if user already reviewed this product
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id, reorder_count, additional_comments')
          .eq('product_id', pid)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existingReview) {
          // User already reviewed - increment reorder_count and add as additional comment
          const newCount = (existingReview.reorder_count || 1) + 1;
          const existingComments = (existingReview.additional_comments as any[]) || [];
          const newComment: any = {
            comment: comments[pid] || '',
            rating: userRating,
            date: new Date().toISOString(),
            media_files: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
            video_url: videoUrl,
          };
          
          const { error: updateError } = await supabase
            .from('reviews')
            .update({
              reorder_count: newCount,
              additional_comments: [...existingComments, newComment],
              updated_at: new Date().toISOString(),
            })
            .eq('id', existingReview.id);
          if (updateError) console.error('Review update error:', updateError);
        } else {
          // First review for this product
          const { error: reviewError } = await supabase
            .from('reviews')
            .insert({
              product_id: pid,
              user_id: user.id,
              rating: userRating,
              comment: comments[pid] || 'ممتاز',
              media_files: uploadedImageUrls.length > 0 ? uploadedImageUrls : null,
              video_url: videoUrl,
              points_awarded: points,
              reorder_count: 1,
            });
          if (reviewError) console.error('Review error:', reviewError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      toast.success('تم تأكيد الاستلام والتقييم بنجاح ✅');
      navigate('/my-orders');
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تأكيد الاستلام');
      console.error(error);
    }
  });

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order || order.status !== 'delivered' || order.user_confirmed_delivery) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm">
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {order?.user_confirmed_delivery ? 'تم تأكيد الاستلام مسبقاً ✅' : 'الطلب غير متاح'}
              </h3>
              <Button onClick={() => navigate('/my-orders')} className="mt-4">
                <ArrowRight className="ml-2 h-4 w-4" />
                العودة إلى طلباتي
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const ratableItems = order.order_items.filter((item: any) => item.product_id);
  const customItems = order.order_items.filter((item: any) => item.custom_request_id);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/order/${orderId}`)} className="mb-4">
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى تفاصيل الطلب
          </Button>
          <h1 className="text-4xl font-black text-primary mb-2">تأكيد استلام الطلب</h1>
          <p className="text-muted-foreground">رقم الطلب: {order.order_number}</p>
        </div>

        {/* Success banner - glassmorphism */}
        <Card className="mb-6 relative overflow-hidden border border-green-500/30 bg-green-500/5 backdrop-blur-xl shadow-[0_8px_32px_rgba(34,197,94,0.1)]">
          <div className="absolute -top-16 -right-16 w-32 h-32 bg-green-500/10 rounded-full blur-3xl pointer-events-none" />
          <CardContent className="relative py-8 text-center">
            <div className="relative inline-block mb-4">
              <CheckCircle className="h-16 w-16 text-green-500" />
              <div className="absolute inset-0 translate-y-1 blur-md -z-10">
                <CheckCircle className="h-16 w-16 text-green-500/30" />
              </div>
            </div>
            <h2 className="text-2xl font-bold text-green-600 dark:text-green-400 mb-2 flex items-center justify-center gap-2">
              <Sparkles className="h-5 w-5" />
              تهانينا!
              <Sparkles className="h-5 w-5" />
            </h2>
            <p className="text-muted-foreground">
              نرجو تأكيد استلام طلبك وتقييم المنتجات لمساعدة العملاء الآخرين
            </p>
          </CardContent>
        </Card>

        {/* Product ratings */}
        {ratableItems.length > 0 && (
          <div className="mb-6 space-y-4">
            {ratableItems.map((item: any) => {
              const imageUrl = item.products?.images?.[0] || item.products?.image_url;
              return (
                <ProductRatingCard
                  key={item.id}
                  itemId={item.id}
                  productId={item.product_id}
                  productName={item.product_name_ar}
                  imageUrl={imageUrl}
                  rating={ratings[item.product_id] || 5}
                  comment={comments[item.product_id] || ''}
                  onRatingChange={(pid, r) => setRatings(prev => ({ ...prev, [pid]: r }))}
                  onCommentChange={(pid, c) => setComments(prev => ({ ...prev, [pid]: c }))}
                  images={productImages[item.product_id] || []}
                  onImagesChange={(pid, imgs) => setProductImages(prev => ({ ...prev, [pid]: imgs }))}
                  video={productVideos[item.product_id] || null}
                  onVideoChange={(pid, v) => setProductVideos(prev => ({ ...prev, [pid]: v }))}
                />
              );
            })}
          </div>
        )}

        {/* Custom items */}
        {customItems.length > 0 && (
          <div className="mb-6 space-y-3">
            {customItems.map((item: any) => {
              const imageUrl = item.custom_product_requests?.image_url;
              const productName = item.custom_product_requests?.product_name || item.product_name_ar;
              return (
                <Card key={item.id} className="border border-amber-500/20 bg-amber-500/5 backdrop-blur-xl">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {imageUrl ? (
                        <img src={imageUrl} alt={productName} className="w-16 h-16 object-cover rounded-xl border border-border/50" />
                      ) : (
                        <div className="w-16 h-16 bg-muted/50 rounded-xl flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{productName}</span>
                          <Badge variant="secondary" className="text-xs">طلب خاص</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">الطلبات المخصصة لا يمكن تقييمها</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Confirm button - 3D glassmorphism */}
        <Card className="relative overflow-hidden border border-green-500/30 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(34,197,94,0.1)]">
          <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-green-500/10 rounded-full blur-2xl pointer-events-none" />
          <CardContent className="relative py-6">
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700 shadow-[0_4px_16px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_24px_rgba(34,197,94,0.4)] transition-all duration-300"
              size="lg"
            >
              {confirmMutation.isPending ? (
                <Loader2 className="ml-2 h-5 w-5 animate-spin" />
              ) : (
                <CheckCircle className="ml-2 h-5 w-5" />
              )}
              تأكيد الاستلام {ratableItems.length > 0 ? 'وإرسال التقييمات' : ''}
            </Button>
            <p className="text-xs text-center text-muted-foreground mt-4">
              ⏰ ملاحظة: سيتم تأكيد الاستلام تلقائياً مع تقييم 5 نجوم (بدون نقاط) بعد 7 أيام من التوصيل
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ConfirmDelivery;
