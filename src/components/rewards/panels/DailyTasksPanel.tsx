import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, Circle, Coins, ChevronDown, Star, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";

export default function DailyTasksPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedReviews, setExpandedReviews] = useState(false);

  const { data: tasks, isLoading } = useQuery({
    queryKey: ['daily-tasks-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_tasks')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const { data: completedTasks } = useQuery({
    queryKey: ['user-completed-tasks-today', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const today = new Date().toISOString().split('T')[0];
      const { data, error } = await supabase
        .from('user_task_completions')
        .select('task_key')
        .eq('user_id', user.id)
        .gte('completed_at', today);
      if (error && error.code !== 'PGRST116') return [];
      return data?.map(t => t.task_key) || [];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

  // Fetch orders that can be reviewed (delivered orders without reviews)
  const { data: reviewableOrders } = useQuery({
    queryKey: ['reviewable-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data: orderItems, error } = await supabase
        .from('order_items')
        .select(`
          id,
          product_id,
          product_name_ar,
          product_name,
          orders!inner(id, status, order_number, delivered_at, user_id)
        `)
        .eq('orders.user_id', user.id)
        .eq('orders.status', 'delivered')
        .not('product_id', 'is', null);

      if (error) throw error;

      // Check which products already have reviews
      const productIds = orderItems?.map(item => item.product_id).filter(Boolean) || [];
      if (productIds.length === 0) return [];

      const { data: existingReviews } = await supabase
        .from('reviews')
        .select('product_id')
        .eq('user_id', user.id)
        .in('product_id', productIds);

      const reviewedProductIds = new Set(existingReviews?.map(r => r.product_id) || []);
      
      return orderItems?.filter(item => !reviewedProductIds.has(item.product_id)) || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Fetch points settings for review points
  const { data: pointsSettings } = useQuery({
    queryKey: ['points-settings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'points_settings')
        .single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.setting_value as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  // Complete daily login task
  const completeLoginTask = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const loginTask = tasks?.find(t => t.task_key === 'Daily_login');
      if (!loginTask) throw new Error('مهمة غير موجودة');

      // Check if already completed today
      const today = new Date().toISOString().split('T')[0];
      const { data: existing } = await supabase
        .from('user_task_completions')
        .select('id')
        .eq('user_id', user.id)
        .eq('task_key', 'Daily_login')
        .gte('completed_at', today)
        .maybeSingle();

      if (existing) throw new Error('لقد أكملت هذه المهمة اليوم');

      // Complete the task
      const { error: taskError } = await supabase
        .from('user_task_completions')
        .insert({
          user_id: user.id,
          task_key: 'Daily_login',
          points_earned: loginTask.points_reward,
        });
      if (taskError) throw taskError;

      // Add points transaction
      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id,
          points: loginTask.points_reward,
          type: 'earned',
          source: 'daily_task',
          description: `مهمة: ${loginTask.title_ar}`,
        });
      if (pointsError) throw pointsError;

      // Update user points
      const { data: currentPoints } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (currentPoints) {
        await supabase
          .from('user_points')
          .update({
            total_points: (currentPoints.total_points || 0) + loginTask.points_reward,
            available_points: (currentPoints.available_points || 0) + loginTask.points_reward,
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_points')
          .insert({
            user_id: user.id,
            total_points: loginTask.points_reward,
            available_points: loginTask.points_reward,
          });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-completed-tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
      toast.success('تم إكمال المهمة! تمت إضافة النقاط');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const handleTaskClick = (task: any) => {
    if (!user) {
      toast.error('يجب تسجيل الدخول');
      return;
    }
    if (task.task_key === 'Daily_login') {
      completeLoginTask.mutate();
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          سجّل الدخول لعرض المهام اليومية
        </CardContent>
      </Card>
    );
  }

  const reviewPoints = pointsSettings?.points_per_review || 5;
  const mediaBonus = pointsSettings?.points_per_verified_review || 10;

  return (
    <div className="space-y-3">
      {/* Regular Tasks */}
      {tasks?.map((task) => {
        const isCompleted = completedTasks?.includes(task.task_key);
        const isLoading = completeLoginTask.isPending && task.task_key === 'Daily_login';
        
        return (
          <Card key={task.id} className={isCompleted ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500/20' : 'bg-primary/10'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : (
                    <Circle className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{task.title_ar}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description_ar}</p>
                  <div className="flex items-center gap-1 mt-2">
                    <Coins className="h-3.5 w-3.5 text-amber-500" />
                    <span className="text-xs font-bold text-amber-600">+{task.points_reward} نقطة</span>
                  </div>
                </div>
                {!isCompleted && (
                  <Button 
                    size="sm" 
                    variant="outline" 
                    className="shrink-0"
                    onClick={() => handleTaskClick(task)}
                    disabled={isLoading}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'ابدأ'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

      {/* Review Tasks */}
      {reviewableOrders && reviewableOrders.length > 0 && (
        <Card className="border-amber-500/30 bg-amber-500/5">
          <Collapsible open={expandedReviews} onOpenChange={setExpandedReviews}>
            <CollapsibleTrigger asChild>
              <CardContent className="p-4 cursor-pointer">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
                      <Star className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <p className="font-medium text-sm">تقييم المنتجات</p>
                      <p className="text-xs text-muted-foreground">
                        {reviewableOrders.length} منتج بانتظار تقييمك
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-600">
                          +{reviewPoints} نقطة (+ {mediaBonus} إضافية مع صورة/فيديو)
                        </span>
                      </div>
                    </div>
                  </div>
                  <ChevronDown className={`h-5 w-5 transition-transform ${expandedReviews ? 'rotate-180' : ''}`} />
                </div>
              </CardContent>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="px-4 pb-4 space-y-2">
                {reviewableOrders.map((item: any) => (
                  <ReviewableProduct 
                    key={item.id} 
                    item={item}
                    reviewPoints={reviewPoints}
                    mediaBonus={mediaBonus}
                  />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {(!tasks || tasks.length === 0) && (!reviewableOrders || reviewableOrders.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            لا توجد مهام متاحة حالياً
          </CardContent>
        </Card>
      )}
    </div>
  );
}

// ReviewableProduct component for inline review
function ReviewableProduct({ item, reviewPoints, mediaBonus }: { item: any; reviewPoints: number; mediaBonus: number }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!user) return;
    if (comment.length < 15) {
      toast.error('التعليق يجب أن يكون 15 حرفاً على الأقل');
      return;
    }

    setSubmitting(true);
    try {
      // Add review
      const { error: reviewError } = await supabase
        .from('reviews')
        .insert({
          user_id: user.id,
          product_id: item.product_id,
          order_item_id: item.id,
          rating,
          comment,
          is_verified_purchase: true,
          points_awarded: reviewPoints,
        });
      if (reviewError) throw reviewError;

      // Add points
      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id,
          points: reviewPoints,
          type: 'earned',
          source: 'review',
          description: `تقييم المنتج: ${item.product_name_ar || item.product_name}`,
          related_id: item.product_id,
        });
      if (pointsError) throw pointsError;

      // Update user points
      const { data: currentPoints } = await supabase
        .from('user_points')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();

      if (currentPoints) {
        await supabase
          .from('user_points')
          .update({
            total_points: (currentPoints.total_points || 0) + reviewPoints,
            available_points: (currentPoints.available_points || 0) + reviewPoints,
          })
          .eq('user_id', user.id);
      } else {
        await supabase
          .from('user_points')
          .insert({
            user_id: user.id,
            total_points: reviewPoints,
            available_points: reviewPoints,
          });
      }

      queryClient.invalidateQueries({ queryKey: ['reviewable-orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      toast.success(`تم إضافة التقييم! حصلت على ${reviewPoints} نقطة`);
      setExpanded(false);
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-3">
      <div 
        className="flex items-center gap-3 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden">
          {/* Product image placeholder */}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">
            {item.product_name_ar || item.product_name}
          </p>
          <p className="text-xs text-muted-foreground">
            طلب رقم: {item.orders?.order_number}
          </p>
        </div>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          قيّم
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          {/* Rating */}
          <div>
            <label className="text-xs font-medium mb-1 block">التقييم</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setRating(star)}
                  className="transition-transform hover:scale-110"
                >
                  <Star
                    className={`h-6 w-6 ${
                      star <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'
                    }`}
                  />
                </button>
              ))}
            </div>
          </div>

          {/* Comment */}
          <div>
            <label className="text-xs font-medium mb-1 block">
              التعليق (15 حرفاً على الأقل)
            </label>
            <Textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="شارك تجربتك مع هذا المنتج..."
              rows={3}
              className="text-sm"
            />
            <p className="text-[10px] text-muted-foreground mt-1">
              {comment.length}/15 حرف • أضف صورة أو فيديو لتحصل على {mediaBonus} نقطة إضافية
            </p>
          </div>

          <Button 
            size="sm" 
            className="w-full"
            onClick={handleSubmitReview}
            disabled={submitting || comment.length < 15}
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            إرسال التقييم (+{reviewPoints} نقطة)
          </Button>
        </div>
      )}
    </div>
  );
}
