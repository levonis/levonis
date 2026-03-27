import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import {
  Loader2, ArrowRight, CheckCircle, Package, Sparkles,
  Star, Upload, X, Image as ImageIcon, Video, Gift, Coins, Camera
} from 'lucide-react';
import { toast } from 'sonner';
import { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

type Step = 'confirm' | 'rating' | 'done';

interface ItemRating {
  rating: number;
  comment: string;
  mediaFiles: File[];
  mediaPreviews: string[];
}

const ConfirmDelivery = () => {
  const { orderId } = useParams();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [step, setStep] = useState<Step>('confirm');
  const [itemRatings, setItemRatings] = useState<Record<string, ItemRating>>({});
  const [submittingReviews, setSubmittingReviews] = useState(false);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

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

  const { data: pointsSettings } = useQuery({
    queryKey: ['points-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'points_settings')
        .maybeSingle();
      return (data?.setting_value as any) || {};
    },
  });

  const reviewPoints = pointsSettings?.points_per_review || 25;
  const mediaBonus = pointsSettings?.points_per_verified_review || 10;

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
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
      queryClient.invalidateQueries({ queryKey: ['my-orders'] });
      queryClient.invalidateQueries({ queryKey: ['order'] });
      toast.success('تم تأكيد الاستلام بنجاح ✅');

      // Initialize ratings for ratable items
      const ratableItems = order?.order_items?.filter((item: any) => item.product_id) || [];
      const initial: Record<string, ItemRating> = {};
      ratableItems.forEach((item: any) => {
        initial[item.id] = { rating: 5, comment: '', mediaFiles: [], mediaPreviews: [] };
      });
      setItemRatings(initial);

      if (ratableItems.length > 0) {
        setStep('rating');
      } else {
        setStep('done');
      }
    },
    onError: () => {
      toast.error('حدث خطأ أثناء تأكيد الاستلام');
    }
  });

  const updateItemRating = (itemId: string, field: keyof ItemRating, value: any) => {
    setItemRatings(prev => ({
      ...prev,
      [itemId]: { ...prev[itemId], [field]: value }
    }));
  };

  const handleFileSelect = (itemId: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []).filter(f => {
      if (f.size > 10 * 1024 * 1024) { toast.error(`${f.name} أكبر من 10 ميجابايت`); return false; }
      return true;
    });

    const current = itemRatings[itemId];
    const newFiles = [...current.mediaFiles, ...files].slice(0, 5);
    const newPreviews = newFiles.map(f => URL.createObjectURL(f));

    // Cleanup old previews
    current.mediaPreviews.forEach(url => URL.revokeObjectURL(url));

    updateItemRating(itemId, 'mediaFiles', newFiles);
    updateItemRating(itemId, 'mediaPreviews', newPreviews);

    if (fileInputRefs.current[itemId]) fileInputRefs.current[itemId]!.value = '';
  };

  const removeMedia = (itemId: string, index: number) => {
    const current = itemRatings[itemId];
    URL.revokeObjectURL(current.mediaPreviews[index]);
    const newFiles = current.mediaFiles.filter((_, i) => i !== index);
    const newPreviews = current.mediaPreviews.filter((_, i) => i !== index);
    updateItemRating(itemId, 'mediaFiles', newFiles);
    updateItemRating(itemId, 'mediaPreviews', newPreviews);
  };

  const handleSubmitReviews = async () => {
    if (!user || !order) return;
    setSubmittingReviews(true);

    try {
      let totalPointsEarned = 0;

      for (const [itemId, data] of Object.entries(itemRatings)) {
        const item = order.order_items.find((i: any) => i.id === itemId);
        if (!item?.product_id) continue;

        // Upload media
        const uploadedUrls: string[] = [];
        for (const file of data.mediaFiles) {
          const ext = file.name.split('.').pop();
          const name = `${user.id}/${Date.now()}-${Math.random().toString(36).substring(7)}.${ext}`;
          const { error } = await supabase.storage.from('review-media').upload(name, file, { cacheControl: '3600', upsert: false });
          if (error) throw error;
          const { data: urlData } = supabase.storage.from('review-media').getPublicUrl(name);
          uploadedUrls.push(urlData.publicUrl);
        }

        const hasMedia = uploadedUrls.length > 0;
        const pointsForThisReview = reviewPoints + (hasMedia ? mediaBonus : 0);

        // Check if user already has a review for this product
        const { data: existingReview } = await supabase
          .from('reviews')
          .select('id')
          .eq('user_id', user.id)
          .eq('product_id', item.product_id)
          .maybeSingle();

        if (existingReview) {
          // Update existing review - status pending for admin approval
          await supabase.from('reviews').update({
            rating: data.rating,
            comment: data.comment.trim() || null,
            media_files: uploadedUrls.length > 0 ? uploadedUrls : null,
            is_auto_rating: false,
            status: 'pending',
          }).eq('id', existingReview.id);
        } else {
          // Insert new review - status pending for admin approval
          const { error: reviewError } = await supabase.from('reviews').insert({
            user_id: user.id,
            product_id: item.product_id,
            rating: data.rating,
            comment: data.comment.trim() || null,
            media_files: uploadedUrls.length > 0 ? uploadedUrls : null,
            status: 'pending',
          });
          if (reviewError) throw reviewError;
        }

        const pointsForThisReview = reviewPoints + (hasMedia ? mediaBonus : 0);
        totalPointsEarned += pointsForThisReview;
      }

      queryClient.invalidateQueries({ queryKey: ['reviews'] });
      queryClient.invalidateQueries({ queryKey: ['reviewable-orders'] });
      toast.success(`تم إرسال التقييمات بنجاح! سيتم مراجعتها ومنح الجوائز بعد الموافقة 🎉`);
      setStep('done');
    } catch (error: any) {
      console.error('Error submitting reviews:', error);
      toast.error('حدث خطأ: ' + (error.message || 'غير معروف'));
    } finally {
      setSubmittingReviews(false);
    }
  };

  if (authLoading || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order || order.status !== 'delivered' || order.user_confirmed_delivery || order.auto_confirmed) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm">
        <main className="container mx-auto px-4 py-8">
          <Card className="border-border/50 bg-card/40 backdrop-blur-xl">
            <CardContent className="py-12 text-center">
              <h3 className="text-xl font-bold text-foreground mb-2">
                {(order?.user_confirmed_delivery || order?.auto_confirmed) ? 'تم تأكيد الاستلام مسبقاً ✅' : 'الطلب غير متاح'}
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
      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Header */}
        <div className="mb-6">
          <Button variant="ghost" onClick={() => navigate(`/order/${orderId}`)} className="mb-4">
            <ArrowRight className="ml-2 h-4 w-4" />
            العودة إلى تفاصيل الطلب
          </Button>
          <h1 className="text-3xl font-black text-primary mb-2">
            {step === 'confirm' ? 'تأكيد استلام الطلب' : step === 'rating' ? 'قيّم منتجاتك واربح نقاط 🎁' : 'شكراً لك! 🎉'}
          </h1>
          <p className="text-muted-foreground">رقم الطلب: {order.order_number}</p>

          {/* Step indicator */}
          {step !== 'done' && (
            <div className="flex items-center gap-2 mt-4">
              <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 'confirm' ? 'bg-primary' : 'bg-primary'}`} />
              <div className={`h-1.5 flex-1 rounded-full transition-colors ${step === 'rating' ? 'bg-primary' : 'bg-muted'}`} />
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {/* Step 1: Confirm Delivery */}
          {step === 'confirm' && (
            <motion.div
              key="confirm"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
            >
              {/* Rewards preview banner */}
              <Card className="mb-6 relative overflow-hidden border border-amber-500/30 bg-amber-500/5 backdrop-blur-xl">
                <CardContent className="py-5">
                  <div className="flex items-start gap-3">
                    <div className="w-10 h-10 rounded-xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <Gift className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h3 className="font-bold text-foreground mb-1">أكد الاستلام وقيّم لتربح نقاط!</h3>
                      <div className="space-y-1.5 text-sm text-muted-foreground">
                        <div className="flex items-center gap-2">
                          <Coins className="h-3.5 w-3.5 text-amber-500" />
                          <span><strong className="text-amber-600">{reviewPoints} نقطة</strong> لكل تقييم</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Camera className="h-3.5 w-3.5 text-emerald-500" />
                          <span><strong className="text-emerald-600">+{mediaBonus} نقطة إضافية</strong> عند إرفاق صور أو فيديو!</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Products */}
              {ratableItems.length > 0 && (
                <div className="mb-6 space-y-3">
                  {ratableItems.map((item: any) => {
                    const imageUrl = item.products?.images?.[0] || item.products?.image_url;
                    return (
                      <Card key={item.id} className="border border-border/50 bg-card/40 backdrop-blur-xl">
                        <CardContent className="py-4">
                          <div className="flex items-center gap-4">
                            {imageUrl ? (
                              <img src={imageUrl} alt={item.product_name_ar} className="w-14 h-14 object-cover rounded-xl border border-border/50 bg-muted" />
                            ) : (
                              <div className="w-14 h-14 bg-muted/50 rounded-xl flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div className="flex-1 min-w-0">
                              <span className="font-bold text-sm line-clamp-1">{item.product_name_ar}</span>
                              <p className="text-xs text-muted-foreground mt-0.5">الكمية: {item.quantity}</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
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
                              <img src={imageUrl} alt={productName} className="w-14 h-14 object-cover rounded-xl border border-border/50" />
                            ) : (
                              <div className="w-14 h-14 bg-muted/50 rounded-xl flex items-center justify-center">
                                <Package className="h-6 w-6 text-muted-foreground" />
                              </div>
                            )}
                            <div>
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm">{productName}</span>
                                <Badge variant="secondary" className="text-[10px]">طلب خاص</Badge>
                              </div>
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              )}

              {/* Confirm button */}
              <Card className="relative overflow-hidden border border-emerald-500/30 bg-card/40 backdrop-blur-xl shadow-[0_8px_32px_rgba(34,197,94,0.1)]">
                <div className="absolute -bottom-12 -left-12 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
                <CardContent className="relative py-6">
                  <Button
                    onClick={() => confirmMutation.mutate()}
                    disabled={confirmMutation.isPending}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white shadow-[0_4px_16px_rgba(34,197,94,0.3)] hover:shadow-[0_6px_24px_rgba(34,197,94,0.4)] transition-all duration-300"
                    size="lg"
                  >
                    {confirmMutation.isPending ? (
                      <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                    ) : (
                      <CheckCircle className="ml-2 h-5 w-5" />
                    )}
                    تأكيد الاستلام
                  </Button>
                  <p className="text-xs text-center text-muted-foreground mt-4">
                    ⏰ سيتم التأكيد تلقائياً مع تقييم 5 نجوم (بدون نقاط) بعد 7 أيام من التوصيل
                  </p>
                </CardContent>
              </Card>
            </motion.div>
          )}

          {/* Step 2: Rate Products */}
          {step === 'rating' && (
            <motion.div
              key="rating"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.3 }}
              className="space-y-4"
            >
              {/* Rewards reminder */}
              <Card className="border border-primary/20 bg-primary/5 backdrop-blur-xl">
                <CardContent className="py-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-primary" />
                      <span className="font-bold text-sm">جوائز التقييم</span>
                    </div>
                    <div className="flex gap-3">
                      <Badge variant="secondary" className="bg-amber-500/10 text-amber-600 border-amber-500/20">
                        <Star className="h-3 w-3 ml-1 fill-amber-500 text-amber-500" />
                        {reviewPoints} نقطة
                      </Badge>
                      <Badge variant="secondary" className="bg-emerald-500/10 text-emerald-600 border-emerald-500/20">
                        <Camera className="h-3 w-3 ml-1" />
                        +{mediaBonus} مع صور/فيديو
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* Rating forms per product */}
              {ratableItems.map((item: any) => {
                const imageUrl = item.products?.images?.[0] || item.products?.image_url;
                const itemData = itemRatings[item.id] || { rating: 5, comment: '', mediaFiles: [], mediaPreviews: [] };
                const hasMedia = itemData.mediaFiles.length > 0;
                const potentialPoints = reviewPoints + (hasMedia ? mediaBonus : 0);

                return (
                  <Card key={item.id} className="border border-border/50 bg-card/40 backdrop-blur-xl overflow-hidden">
                    <CardContent className="py-5 space-y-4">
                      {/* Product header */}
                      <div className="flex items-center gap-3">
                        {imageUrl ? (
                          <img src={imageUrl} alt={item.product_name_ar} className="w-14 h-14 object-cover rounded-xl border border-border/50 bg-muted" />
                        ) : (
                          <div className="w-14 h-14 bg-muted/50 rounded-xl flex items-center justify-center">
                            <Package className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-sm line-clamp-1">{item.product_name_ar}</p>
                          <div className="flex items-center gap-1 mt-1">
                            <Coins className="h-3 w-3 text-amber-500" />
                            <span className="text-xs font-bold text-amber-600">
                              +{potentialPoints} نقطة
                            </span>
                            {hasMedia && (
                              <Badge variant="secondary" className="text-[9px] px-1.5 py-0 bg-emerald-500/10 text-emerald-600 border-0">
                                يشمل مكافأة الوسائط!
                              </Badge>
                            )}
                          </div>
                        </div>
                      </div>

                      {/* Star rating */}
                      <div>
                        <label className="text-xs font-medium mb-2 block text-muted-foreground">تقييمك</label>
                        <div className="flex gap-1.5">
                          {[1, 2, 3, 4, 5].map(star => (
                            <button
                              key={star}
                              type="button"
                              onClick={() => updateItemRating(item.id, 'rating', star)}
                              className="transition-transform hover:scale-125 active:scale-95"
                            >
                              <Star className={`h-8 w-8 ${star <= itemData.rating
                                ? 'text-amber-500 fill-amber-500 drop-shadow-[0_0_6px_rgba(245,158,11,0.4)]'
                                : 'text-muted-foreground/30'
                              }`} />
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Comment */}
                      <div>
                        <label className="text-xs font-medium mb-1.5 block text-muted-foreground">تعليقك (اختياري)</label>
                        <Textarea
                          value={itemData.comment}
                          onChange={e => updateItemRating(item.id, 'comment', e.target.value)}
                          placeholder="شاركنا رأيك في المنتج..."
                          rows={3}
                          className="text-sm resize-none"
                        />
                      </div>

                      {/* Media upload */}
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <label className="text-xs font-medium text-muted-foreground">صور أو فيديو (اختياري)</label>
                          {!hasMedia && (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-600 animate-pulse">
                              +{mediaBonus} نقطة إضافية!
                            </Badge>
                          )}
                        </div>
                        <input
                          ref={el => { fileInputRefs.current[item.id] = el; }}
                          type="file"
                          accept="image/*,video/*"
                          multiple
                          onChange={e => handleFileSelect(item.id, e)}
                          className="hidden"
                        />

                        <div className="flex gap-2 flex-wrap">
                          {itemData.mediaPreviews.map((url, idx) => {
                            const file = itemData.mediaFiles[idx];
                            const isVideo = file?.type?.startsWith('video');
                            return (
                              <div key={idx} className="relative w-16 h-16 rounded-lg overflow-hidden border border-border/50 bg-muted group">
                                {isVideo ? (
                                  <div className="w-full h-full flex items-center justify-center bg-muted">
                                    <Video className="h-6 w-6 text-muted-foreground" />
                                  </div>
                                ) : (
                                  <img src={url} alt="" className="w-full h-full object-cover" />
                                )}
                                <button
                                  onClick={() => removeMedia(item.id, idx)}
                                  className="absolute top-0.5 left-0.5 bg-destructive/80 rounded-full w-4 h-4 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                                >
                                  <X className="h-2.5 w-2.5 text-white" />
                                </button>
                              </div>
                            );
                          })}

                          {itemData.mediaFiles.length < 5 && (
                            <button
                              onClick={() => fileInputRefs.current[item.id]?.click()}
                              className="w-16 h-16 rounded-lg border-2 border-dashed border-border/50 hover:border-primary/30 flex flex-col items-center justify-center gap-1 transition-colors"
                            >
                              <Upload className="h-4 w-4 text-muted-foreground" />
                              <span className="text-[8px] text-muted-foreground">إضافة</span>
                            </button>
                          )}
                        </div>
                        <p className="text-[10px] text-muted-foreground mt-1.5">
                          {itemData.mediaFiles.length}/5 ملفات • صور أو فيديو (حد 10 ميجا)
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}

              {/* Submit reviews */}
              <div className="flex gap-3">
                <Button
                  onClick={handleSubmitReviews}
                  disabled={submittingReviews}
                  className="flex-1 bg-primary hover:bg-primary/90 shadow-lg"
                  size="lg"
                >
                  {submittingReviews ? (
                    <Loader2 className="ml-2 h-5 w-5 animate-spin" />
                  ) : (
                    <Star className="ml-2 h-5 w-5" />
                  )}
                  إرسال التقييمات
                </Button>
                <Button
                  variant="ghost"
                  onClick={() => {
                    setStep('done');
                    toast.info('يمكنك التقييم لاحقاً من صفحة المهام');
                  }}
                  size="lg"
                >
                  لاحقاً
                </Button>
              </div>
            </motion.div>
          )}

          {/* Step 3: Done */}
          {step === 'done' && (
            <motion.div
              key="done"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4 }}
            >
              <Card className="relative overflow-hidden border border-emerald-500/30 bg-emerald-500/5 backdrop-blur-xl">
                <div className="absolute -top-16 -right-16 w-32 h-32 bg-emerald-500/10 rounded-full blur-3xl pointer-events-none" />
                <CardContent className="relative py-12 text-center">
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    transition={{ type: 'spring', stiffness: 200, damping: 15, delay: 0.2 }}
                  >
                    <CheckCircle className="h-20 w-20 text-emerald-500 mx-auto mb-4" />
                  </motion.div>
                  <h2 className="text-2xl font-black text-foreground mb-2">
                    شكراً لك! 🎉
                  </h2>
                  <p className="text-muted-foreground mb-6">
                    تم تأكيد الاستلام بنجاح. تقييماتك تساعد العملاء الآخرين!
                  </p>
                  <Button onClick={() => navigate('/my-orders')} size="lg">
                    <ArrowRight className="ml-2 h-4 w-4" />
                    العودة إلى طلباتي
                  </Button>
                </CardContent>
              </Card>
            </motion.div>
          )}
        </AnimatePresence>
      </main>
    </div>
  );
};

export default ConfirmDelivery;