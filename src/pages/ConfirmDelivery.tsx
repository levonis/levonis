import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Star, Loader2, ArrowRight, CheckCircle, Package } from 'lucide-react';
import { toast } from 'sonner';

const ConfirmDelivery = () => {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [ratings, setRatings] = useState<Record<string, number>>({});
  const [comments, setComments] = useState<Record<string, string>>({});

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

      // Update order to confirmed
      const { error: orderError } = await supabase
        .from('orders')
        .update({
          user_confirmed_delivery: true,
          user_confirmed_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (orderError) throw orderError;

      // Create reviews for each product (only for regular products, not custom requests)
      const reviews = order.order_items
        .filter((item: any) => item.product_id) // Only products, not custom requests
        .map((item: any) => ({
          product_id: item.product_id,
          user_id: user.id,
          rating: ratings[item.product_id] || 5,
          comment: comments[item.product_id] || 'ممتاز'
        }));

      if (reviews.length > 0) {
        const { error: reviewError } = await supabase
          .from('reviews')
          .insert(reviews);

        if (reviewError) throw reviewError;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      toast.success('تم تأكيد الاستلام وإضافة التقييمات بنجاح');
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
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {order?.user_confirmed_delivery ? 'تم تأكيد الاستلام مسبقاً' : 'الطلب غير متاح'}
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

  const handleRatingClick = (productId: string, rating: number) => {
    setRatings(prev => ({ ...prev, [productId]: rating }));
  };

  // Get items that can be rated (only regular products)
  const ratableItems = order.order_items.filter((item: any) => item.product_id);
  // Get custom request items (cannot be rated)
  const customItems = order.order_items.filter((item: any) => item.custom_request_id);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-3xl">
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate(`/order/${orderId}`)}
            className="mb-4"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى تفاصيل الطلب
          </Button>
          <h1 className="text-4xl font-black text-primary mb-2">تأكيد استلام الطلب</h1>
          <p className="text-muted-foreground">رقم الطلب: {order.order_number}</p>
        </div>

        <Card className="mb-6 border-green-500/50 bg-green-50/50 dark:bg-green-950/20">
          <CardContent className="py-6 text-center">
            <CheckCircle className="h-16 w-16 text-green-600 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-green-700 dark:text-green-400 mb-2">تهانينا!</h2>
            <p className="text-muted-foreground">
              نرجو تأكيد استلام طلبك وتقييم المنتجات لمساعدة العملاء الآخرين
            </p>
          </CardContent>
        </Card>

        {/* Regular products that can be rated */}
        {ratableItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Star className="h-5 w-5 text-yellow-500" />
              قيّم المنتجات
            </h3>
            {ratableItems.map((item: any) => {
              const imageUrl = item.products?.images?.[0] || item.products?.image_url;
              return (
                <Card key={item.id} className="mb-4 border-primary/20">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-4">
                      {imageUrl && (
                        <img
                          src={imageUrl}
                          alt={item.product_name_ar}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      )}
                      <span className="text-base">{item.product_name_ar}</span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">التقييم</label>
                      <div className="flex gap-2">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => handleRatingClick(item.product_id, star)}
                            className="transition-transform hover:scale-110"
                          >
                            <Star
                              className={`h-8 w-8 ${
                                star <= (ratings[item.product_id] || 5)
                                  ? 'fill-yellow-400 text-yellow-400'
                                  : 'text-gray-300'
                              }`}
                            />
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <label className="text-sm font-medium mb-2 block">التعليق (اختياري)</label>
                      <Textarea
                        value={comments[item.product_id] || ''}
                        onChange={(e) => setComments(prev => ({ ...prev, [item.product_id]: e.target.value }))}
                        placeholder="شاركنا رأيك في المنتج..."
                        rows={3}
                      />
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Custom request items (cannot be rated) */}
        {customItems.length > 0 && (
          <div className="mb-6">
            <h3 className="text-lg font-bold text-foreground mb-4 flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              الطلبات المخصصة
            </h3>
            {customItems.map((item: any) => {
              const imageUrl = item.custom_product_requests?.image_url;
              const productName = item.custom_product_requests?.product_name || item.product_name_ar;
              return (
                <Card key={item.id} className="mb-4 border-amber-500/20 bg-amber-50/50 dark:bg-amber-950/20">
                  <CardContent className="py-4">
                    <div className="flex items-center gap-4">
                      {imageUrl ? (
                        <img
                          src={imageUrl}
                          alt={productName}
                          className="w-16 h-16 object-cover rounded-lg border"
                        />
                      ) : (
                        <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center">
                          <Package className="h-8 w-8 text-muted-foreground" />
                        </div>
                      )}
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-bold">{productName}</span>
                          <Badge variant="secondary" className="text-xs">طلب خاص</Badge>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          الطلبات المخصصة لا يمكن تقييمها
                        </p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        <Card className="border-primary/20">
          <CardContent className="py-6">
            <Button
              onClick={() => confirmMutation.mutate()}
              disabled={confirmMutation.isPending}
              className="w-full bg-green-600 hover:bg-green-700"
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
              ملاحظة: سيتم تأكيد الاستلام تلقائياً مع تقييم 5 نجوم بعد 7 أيام من التوصيل
            </p>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default ConfirmDelivery;
