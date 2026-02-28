import { useState } from "react";
import { Progress } from "@/components/ui/progress";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { CheckCircle2, Circle, Coins, ChevronDown, Star, Loader2, Flame, Users, Store, Package } from "lucide-react";
import { toast } from "sonner";
import { Textarea } from "@/components/ui/textarea";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import OptimizedImage from "@/components/OptimizedImage";
import { useLanguage } from "@/lib/i18n";

export default function DailyTasksPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
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

  // Fetch all-time completed once-tasks  
  const { data: completedOnceTasks } = useQuery({
    queryKey: ['user-completed-once-tasks', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_task_completions')
        .select('task_key')
        .eq('user_id', user.id);
      if (error && error.code !== 'PGRST116') return [];
      return data?.map(t => t.task_key) || [];
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Streak data
  const { data: streakData } = useQuery({
    queryKey: ['user-streak', user?.id],
    queryFn: async () => {
      if (!user) return { current: 0, max: 7 };
      // Count consecutive days with at least one task completion
      const { data, error } = await supabase
        .from('user_task_completions')
        .select('completed_at')
        .eq('user_id', user.id)
        .eq('task_key', 'daily_login')
        .order('completed_at', { ascending: false })
        .limit(30);
      if (error || !data || data.length === 0) return { current: 0, max: 7 };

      let streak = 0;
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      const uniqueDays = [...new Set(data.map(d => new Date(d.completed_at).toISOString().split('T')[0]))].sort().reverse();
      
      for (let i = 0; i < uniqueDays.length; i++) {
        const expectedDate = new Date(today);
        expectedDate.setDate(expectedDate.getDate() - i);
        const expected = expectedDate.toISOString().split('T')[0];
        if (uniqueDays[i] === expected) {
          streak++;
        } else {
          break;
        }
      }
      return { current: streak, max: 7 };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Auto-check community profile, merchant registration + products, profile, review, purchase
  const { data: autoCheckData } = useQuery({
    queryKey: ['auto-check-tasks', user?.id],
    queryFn: async () => {
      if (!user) return { hasProfile: false, isMerchant: false, merchantProductCount: 0, hasFullProfile: false, hasReview: false, hasWeeklyPurchase: false };
      
      // Community profile check
      const { data: profile } = await supabase
        .from('community_customer_profiles')
        .select('display_name, avatar_url, bio')
        .eq('user_id', user.id)
        .maybeSingle();
      const hasProfile = !!(profile?.display_name && profile?.avatar_url);

      // Merchant check
      const { data: merchant } = await supabase
        .from('merchant_public_profiles' as any)
        .select('id')
        .eq('id', user.id)
        .maybeSingle();
      const isMerchant = !!merchant;

      let merchantProductCount = 0;
      if (isMerchant) {
        const { count } = await supabase
          .from('merchant_products' as any)
          .select('id', { count: 'exact', head: true })
          .eq('merchant_id', user.id)
          .eq('is_active', true);
        merchantProductCount = count || 0;
      }

      // Full profile check (name + avatar in profiles table)
      const { data: mainProfile } = await supabase
        .from('profiles')
        .select('full_name, avatar_url')
        .eq('id', user.id)
        .maybeSingle();
      const hasFullProfile = !!(mainProfile?.full_name && mainProfile?.avatar_url);

      // Has at least one review
      const { count: reviewCount } = await supabase
        .from('reviews')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id);
      const hasReview = (reviewCount || 0) > 0;

      // Has purchase this week (exclude cancelled orders)
      const weekAgo = new Date();
      weekAgo.setDate(weekAgo.getDate() - 7);
      const { count: orderCount } = await supabase
        .from('orders')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .neq('status', 'cancelled')
        .gte('created_at', weekAgo.toISOString());
      const hasWeeklyPurchase = (orderCount || 0) > 0;

      return { hasProfile, isMerchant, merchantProductCount, hasFullProfile, hasReview, hasWeeklyPurchase };
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  // Fetch pending admin approvals for this user
  const { data: pendingApprovals } = useQuery({
    queryKey: ['pending-task-approvals', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('pending_task_approvals' as any)
        .select('task_key, status')
        .eq('user_id', user.id)
        .in('status', ['pending', 'approved']);
      if (error) return [];
      return data || [];
    },
    enabled: !!user,
    staleTime: 1 * 60 * 1000,
  });

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

  const completeTaskMutation = useMutation({
    mutationFn: async (task: any) => {
      if (!user) throw new Error(t('tasks_login_required'));

      // For once tasks, check all-time completions
      if (task.task_type === 'once') {
        const { data: existing } = await supabase
          .from('user_task_completions')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_key', task.task_key)
          .maybeSingle();
        if (existing) throw new Error('تم إكمال هذه المهمة مسبقاً');
      } else {
        const today = new Date().toISOString().split('T')[0];
        const { data: existing } = await supabase
          .from('user_task_completions')
          .select('id')
          .eq('user_id', user.id)
          .eq('task_key', task.task_key)
          .gte('completed_at', today)
          .maybeSingle();
        if (existing) throw new Error(t('tasks_completed_today'));
      }

      // Validate auto-check tasks
      if (task.task_key === 'complete_community_profile' && !autoCheckData?.hasProfile) {
        throw new Error('يرجى إكمال ملفك في مجتمع ليفو أولاً (الاسم والصورة)');
      }
      if (task.task_key === 'register_merchant') {
        if (!autoCheckData?.isMerchant) throw new Error('يرجى التسجيل كتاجر في مجتمع ليفو أولاً');
        if ((autoCheckData?.merchantProductCount || 0) < 3) throw new Error(`يرجى نشر ٣ منتجات على الأقل (لديك ${autoCheckData?.merchantProductCount || 0} حالياً)`);
      }
      if (task.task_key === 'complete_profile' && !autoCheckData?.hasFullProfile) {
        throw new Error('يرجى إكمال ملفك الشخصي أولاً (الاسم والصورة)');
      }
      if (task.task_key === 'first_review' && !autoCheckData?.hasReview) {
        throw new Error('يرجى إضافة تقييم لأحد المنتجات أولاً');
      }
      if (task.task_key === 'weekly_purchase' && !autoCheckData?.hasWeeklyPurchase) {
        throw new Error('يرجى شراء منتج هذا الأسبوع أولاً');
      }

      // Admin-approval tasks: submit for review instead of completing
      if (task.confirmation_type === 'admin_approval') {
        // Check if already pending
        const existingPending = pendingApprovals?.find((p: any) => p.task_key === task.task_key && p.status === 'pending');
        if (existingPending) throw new Error('طلبك قيد المراجعة بالفعل');
        
        const { error: approvalError } = await supabase
          .from('pending_task_approvals' as any)
          .insert({ user_id: user.id, task_key: task.task_key, status: 'pending' });
        if (approvalError) throw approvalError;
        
        queryClient.invalidateQueries({ queryKey: ['pending-task-approvals'] });
        return { ...task, totalPoints: 0, bonusPoints: 0, pendingApproval: true };
      }

      // Calculate streak bonus
      let bonusPoints = 0;
      if (task.streak_bonus_enabled && streakData) {
        bonusPoints = Math.min(streakData.current, task.max_streak_days || 7) * (task.streak_bonus_per_day || 1);
      }
      const totalPoints = task.points_reward + bonusPoints;

      const { error: taskError } = await supabase
        .from('user_task_completions')
        .insert({ user_id: user.id, task_key: task.task_key, points_earned: totalPoints });
      if (taskError) throw taskError;

      const desc = bonusPoints > 0
        ? `مهمة: ${task.title_ar} (${task.points_reward} + ${bonusPoints} ستريك)`
        : `مهمة: ${task.title_ar}`;

      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id, points: totalPoints, type: 'earned',
          source: 'daily_task', description: desc,
        });
      if (pointsError) throw pointsError;

      const { data: currentPoints } = await supabase
        .from('user_points').select('*').eq('user_id', user.id).maybeSingle();

      if (currentPoints) {
        await supabase.from('user_points').update({
          total_points: (currentPoints.total_points || 0) + totalPoints,
          available_points: (currentPoints.available_points || 0) + totalPoints,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('user_points').insert({
          user_id: user.id, total_points: totalPoints, available_points: totalPoints,
        });
      }
      return { ...task, totalPoints, bonusPoints, pendingApproval: false };
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['user-completed-tasks-today'] });
      queryClient.invalidateQueries({ queryKey: ['user-completed-once-tasks'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-streak'] });
      queryClient.invalidateQueries({ queryKey: ['points-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['pending-task-approvals'] });
      if (result.pendingApproval) {
        toast.success('تم إرسال طلبك للمراجعة من قبل الإدارة ⏳');
      } else {
        const msg = result.bonusPoints > 0
          ? `+${result.totalPoints} نقطة (منها ${result.bonusPoints} مكافأة ستريك 🔥)`
          : `+${result.totalPoints} نقطة ✅`;
        toast.success(msg);
      }
    },
    onError: (error: any) => { toast.error(error.message || t('common_error')); },
  });

  const [activeTaskKey, setActiveTaskKey] = useState<string | null>(null);

  const handleTaskClick = (task: any) => {
    if (!user) { toast.error(t('tasks_login_required')); return; }
    setActiveTaskKey(task.task_key);
    completeTaskMutation.mutate(task, { onSettled: () => setActiveTaskKey(null) });
  };

  const getTaskIcon = (icon: string) => {
    switch (icon) {
      case 'Users': return Users;
      case 'Store': return Store;
      case 'Package': return Package;
      default: return Circle;
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => <Skeleton key={i} className="h-20 w-full" />)}
      </div>
    );
  }

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">{t('tasks_login_required')}</CardContent>
      </Card>
    );
  }

  const reviewPoints = pointsSettings?.points_per_review || 25;
  const mediaBonus = pointsSettings?.points_per_verified_review || 10;
  const streak = streakData?.current || 0;

  return (
    <div className="space-y-3">
      {/* Streak Card */}
      <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/10 border-orange-500/20">
        <CardContent className="p-4">
          <div className="flex items-center gap-3 mb-2">
            <Flame className="h-5 w-5 text-orange-500" />
            <span className="font-medium text-sm">الستريك اليومي</span>
            <span className="text-xs bg-orange-500/20 text-orange-600 px-2 py-0.5 rounded-full font-bold mr-auto">
              {streak} يوم 🔥
            </span>
          </div>
          <div className="flex gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <div
                key={i}
                className={`flex-1 h-2 rounded-full transition-all ${
                  i < streak ? 'bg-orange-500' : 'bg-muted'
                }`}
              />
            ))}
          </div>
          <p className="text-[10px] text-muted-foreground mt-1.5">
            سجّل دخولك يومياً لزيادة الستريك والحصول على نقاط إضافية
          </p>
        </CardContent>
      </Card>

      {tasks?.map((task) => {
        const isOnceTask = task.task_type === 'once';
        const isCompleted = isOnceTask 
          ? completedOnceTasks?.includes(task.task_key)
          : completedTasks?.includes(task.task_key);
        const isTaskLoading = activeTaskKey === task.task_key && completeTaskMutation.isPending;
        const isPending = pendingApprovals?.some((p: any) => p.task_key === task.task_key && p.status === 'pending');
        const isAdminTask = task.confirmation_type === 'admin_approval';
        
        // Auto-check eligibility for special tasks
        let canComplete = true;
        let statusText = '';

        if (task.task_key === 'complete_community_profile' && !autoCheckData?.hasProfile && !isCompleted) {
          canComplete = false;
          statusText = 'أكمل ملفك أولاً';
        }
        if (task.task_key === 'complete_profile' && !autoCheckData?.hasFullProfile && !isCompleted) {
          canComplete = false;
          statusText = 'أكمل بياناتك وأضف صورة أولاً';
        }
        if (task.task_key === 'first_review' && !autoCheckData?.hasReview && !isCompleted) {
          canComplete = false;
          statusText = 'أضف تقييم لمنتج أولاً';
        }
        if (task.task_key === 'weekly_purchase' && !autoCheckData?.hasWeeklyPurchase && !isCompleted) {
          canComplete = false;
          statusText = 'اشترِ منتج هذا الأسبوع أولاً';
        }
        if (task.task_key === 'register_merchant' && !isCompleted) {
          const isMerch = autoCheckData?.isMerchant || false;
          const prodCount = Math.min(autoCheckData?.merchantProductCount || 0, 3);
          canComplete = isMerch && prodCount >= 3;
          if (!isMerch) statusText = '❶ سجّل كتاجر أولاً';
          else if (prodCount < 3) statusText = `❷ انشر ${3 - prodCount} منتجات إضافية (${prodCount}/٣)`;
        }
        if (isPending) {
          canComplete = false;
        }

        const TaskIcon = getTaskIcon(task.icon);
        const streakBonus = task.streak_bonus_enabled ? Math.min(streak, task.max_streak_days || 7) * (task.streak_bonus_per_day || 1) : 0;
        
        return (
          <Card key={task.id} className={isCompleted ? 'opacity-60' : ''}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                  isCompleted ? 'bg-green-500/20' : isPending ? 'bg-amber-500/20' : 'bg-primary/10'
                }`}>
                  {isCompleted ? (
                    <CheckCircle2 className="h-5 w-5 text-green-500" />
                  ) : isPending ? (
                    <Loader2 className="h-5 w-5 text-amber-500" />
                  ) : (
                    <TaskIcon className="h-5 w-5 text-primary" />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-medium text-sm">{task.title_ar}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{task.description_ar}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <div className="flex items-center gap-1">
                      <Coins className="h-3.5 w-3.5 text-amber-500" />
                      <span className="text-xs font-bold text-amber-600">+{task.points_reward} {t('points_unit')}</span>
                    </div>
                    {streakBonus > 0 && !isCompleted && (
                      <span className="text-[10px] bg-orange-500/15 text-orange-600 px-1.5 py-0.5 rounded-full">
                        +{streakBonus} ستريك 🔥
                      </span>
                    )}
                    {isOnceTask && !isCompleted && (
                      <span className="text-[10px] bg-blue-500/15 text-blue-600 px-1.5 py-0.5 rounded-full">مرة واحدة</span>
                    )}
                    {isAdminTask && !isCompleted && !isPending && (
                      <span className="text-[10px] bg-purple-500/15 text-purple-600 px-1.5 py-0.5 rounded-full">تحقق يدوي</span>
                    )}
                  </div>
                  {isPending && (
                    <p className="text-[10px] text-amber-600 mt-1 font-medium">⏳ قيد مراجعة الإدارة</p>
                  )}
                  {statusText && !isPending && (
                    <p className="text-[10px] text-orange-500 mt-1">{statusText}</p>
                  )}
                  {task.task_key === 'register_merchant' && !isCompleted && (
                    <div className="mt-2 space-y-1.5">
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={autoCheckData?.isMerchant ? 'text-green-600' : 'text-muted-foreground'}>
                          {autoCheckData?.isMerchant ? '✅' : '⬜'} التسجيل كتاجر
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-[10px]">
                        <span className={(autoCheckData?.merchantProductCount || 0) >= 3 ? 'text-green-600' : 'text-muted-foreground'}>
                          {(autoCheckData?.merchantProductCount || 0) >= 3 ? '✅' : '⬜'} نشر ٣ منتجات ({Math.min(autoCheckData?.merchantProductCount || 0, 3)}/٣)
                        </span>
                      </div>
                      <Progress 
                        value={((autoCheckData?.isMerchant ? 1 : 0) + Math.min(autoCheckData?.merchantProductCount || 0, 3)) / 4 * 100} 
                        className="h-1.5" 
                      />
                    </div>
                  )}
                </div>
                {!isCompleted && !isPending && (
                  <Button size="sm" variant="outline" className="shrink-0" 
                    onClick={() => handleTaskClick(task)} 
                    disabled={isTaskLoading || !canComplete}
                  >
                    {isTaskLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 
                      canComplete ? (isAdminTask ? 'إرسال' : t('tasks_start')) : '⏳'}
                  </Button>
                )}
              </div>
            </CardContent>
          </Card>
        );
      })}

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
                      <p className="font-medium text-sm">{t('tasks_rate_products')}</p>
                      <p className="text-xs text-muted-foreground">
                        {t('tasks_awaiting_review', { count: reviewableOrders.length })}
                      </p>
                      <div className="flex items-center gap-1 mt-1">
                        <Coins className="h-3.5 w-3.5 text-amber-500" />
                        <span className="text-xs font-bold text-amber-600">
                          {t('tasks_points_per_review', { points: reviewPoints })} ({t('tasks_bonus_media', { points: mediaBonus })})
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
                  <ReviewableProduct key={item.id} item={item} reviewPoints={reviewPoints} mediaBonus={mediaBonus} />
                ))}
              </div>
            </CollapsibleContent>
          </Collapsible>
        </Card>
      )}

      {(!tasks || tasks.length === 0) && (!reviewableOrders || reviewableOrders.length === 0) && (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">{t('tasks_no_tasks')}</CardContent>
        </Card>
      )}
    </div>
  );
}

function ReviewableProduct({ item, reviewPoints, mediaBonus }: { item: any; reviewPoints: number; mediaBonus: number }) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleSubmitReview = async () => {
    if (!user) return;
    if (comment.length < 15) {
      toast.error(t('tasks_comment_label', { min: 15 }));
      return;
    }

    setSubmitting(true);
    try {
      const { error: reviewError } = await supabase.from('reviews').insert({
        user_id: user.id, product_id: item.product_id, order_item_id: item.id,
        rating, comment, is_verified_purchase: true, points_awarded: reviewPoints,
      });
      if (reviewError) throw reviewError;

      const { error: pointsError } = await supabase.from('points_transactions').insert({
        user_id: user.id, points: reviewPoints, type: 'earned', source: 'review',
        description: `تقييم: ${item.product_name_ar || item.product_name}`,
        related_id: item.product_id,
      });
      if (pointsError) throw pointsError;

      const { data: currentPoints } = await supabase
        .from('user_points').select('*').eq('user_id', user.id).maybeSingle();

      if (currentPoints) {
        await supabase.from('user_points').update({
          total_points: (currentPoints.total_points || 0) + reviewPoints,
          available_points: (currentPoints.available_points || 0) + reviewPoints,
        }).eq('user_id', user.id);
      } else {
        await supabase.from('user_points').insert({
          user_id: user.id, total_points: reviewPoints, available_points: reviewPoints,
        });
      }

      queryClient.invalidateQueries({ queryKey: ['reviewable-orders'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      toast.success(t('tasks_review_added', { points: reviewPoints }));
      setExpanded(false);
    } catch (error: any) {
      toast.error(error.message || t('common_error'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="bg-card rounded-lg border p-3">
      <div className="flex items-center gap-3 cursor-pointer" onClick={() => setExpanded(!expanded)}>
        <div className="w-12 h-12 rounded-lg bg-muted overflow-hidden" />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium line-clamp-1">{item.product_name_ar || item.product_name}</p>
          <p className="text-xs text-muted-foreground">{t('tasks_order_number')} {item.orders?.order_number}</p>
        </div>
        <Button size="sm" variant="outline" onClick={(e) => { e.stopPropagation(); setExpanded(!expanded); }}>
          {t('tasks_rate_button')}
        </Button>
      </div>

      {expanded && (
        <div className="mt-3 pt-3 border-t space-y-3">
          <div>
            <label className="text-xs font-medium mb-1 block">{t('tasks_rating_label')}</label>
            <div className="flex gap-1">
              {[1, 2, 3, 4, 5].map((star) => (
                <button key={star} type="button" onClick={() => setRating(star)} className="transition-transform hover:scale-110">
                  <Star className={`h-6 w-6 ${star <= rating ? 'text-amber-500 fill-amber-500' : 'text-muted-foreground'}`} />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="text-xs font-medium mb-1 block">{t('tasks_comment_label', { min: 15 })}</label>
            <Textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder={t('tasks_comment_placeholder')} rows={3} className="text-sm" />
            <p className="text-[10px] text-muted-foreground mt-1">
              {t('tasks_comment_min', { count: comment.length, min: 15 })} • {t('tasks_bonus_media', { points: mediaBonus })}
            </p>
          </div>
          <Button size="sm" className="w-full" onClick={handleSubmitReview} disabled={submitting || comment.length < 15}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
            {t('tasks_submit_review', { points: reviewPoints })}
          </Button>
        </div>
      )}
    </div>
  );
}
