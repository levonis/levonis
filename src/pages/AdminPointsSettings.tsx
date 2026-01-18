import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Settings, Save, Plus, Trash2, CheckSquare, Edit, Coins, Gift, LogIn, 
  Share2, UserPlus, Star, ShoppingCart, Users, Zap, Target, TrendingUp,
  Clock, Calendar, Award, Sparkles, RefreshCw, Shield, Percent, ArrowUpRight,
  Package, Activity, ChevronLeft, ChevronRight, Eye, EyeOff, Wallet
} from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminLoading, AdminEmptyState } from "@/components/admin/AdminLayout";
import AdminUsersPointsTab from "@/components/admin/AdminUsersPointsTab";

const TASK_ICONS = [
  { name: 'Gift', icon: Gift, label: 'هدية' },
  { name: 'LogIn', icon: LogIn, label: 'تسجيل دخول' },
  { name: 'Share2', icon: Share2, label: 'مشاركة' },
  { name: 'UserPlus', icon: UserPlus, label: 'دعوة' },
  { name: 'Coins', icon: Coins, label: 'نقاط' },
  { name: 'Star', icon: Star, label: 'نجمة' },
  { name: 'ShoppingCart', icon: ShoppingCart, label: 'تسوق' },
  { name: 'CheckSquare', icon: CheckSquare, label: 'مهمة' },
  { name: 'Award', icon: Award, label: 'جائزة' },
  { name: 'Sparkles', icon: Sparkles, label: 'لمعان' },
  { name: 'Target', icon: Target, label: 'هدف' },
  { name: 'Zap', icon: Zap, label: 'سريع' },
];

const SYSTEM_EARNING_METHODS = [
  { key: 'points_per_dinar', label: 'نقاط لكل X دينار', icon: Coins, description: 'كل X دينار = 1 نقطة', color: 'from-amber-500/20 to-yellow-500/20' },
  { key: 'points_per_order', label: 'نقاط لكل طلب مكتمل', icon: ShoppingCart, description: 'نقاط ثابتة عند التسليم', color: 'from-green-500/20 to-emerald-500/20' },
  { key: 'points_per_review', label: 'نقاط لكل تقييم', icon: Star, description: 'عند إضافة تقييم منتج', color: 'from-purple-500/20 to-pink-500/20' },
  { key: 'points_per_verified_review', label: 'نقاط للتقييم المؤكد', icon: Shield, description: 'تقييم على طلب مؤكد', color: 'from-blue-500/20 to-cyan-500/20' },
];

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // System settings
  const [pointsPerDinar, setPointsPerDinar] = useState("100");
  const [pointsPerOrder, setPointsPerOrder] = useState("10");
  const [pointsPerReview, setPointsPerReview] = useState("5");
  const [pointsPerVerifiedReview, setPointsPerVerifiedReview] = useState("10");
  const [orderValueMultiplier, setOrderValueMultiplier] = useState("0");
  const [pointsToMoneyRate, setPointsToMoneyRate] = useState("100");
  const [pointsToCouponRate, setPointsToCouponRate] = useState("50");
  const [referrerPoints, setReferrerPoints] = useState("50");
  const [referredPoints, setReferredPoints] = useState("20");
  const [pointsStatus, setPointsStatus] = useState<'active' | 'maintenance' | 'disabled'>('active');
  const [minCouponPoints, setMinCouponPoints] = useState("100");
  const [maxDailyRedemption, setMaxDailyRedemption] = useState("1000");
  const [ticketsPerPoint, setTicketsPerPoint] = useState("0.1");
  const [minTicketsConversion, setMinTicketsConversion] = useState("10");
  
  // Additional settings
  const [pointsExpireDays, setPointsExpireDays] = useState("365");
  const [enablePointsExpiry, setEnablePointsExpiry] = useState(false);
  const [minRedeemPoints, setMinRedeemPoints] = useState("100");
  const [bonusMultiplier, setBonusMultiplier] = useState("1");
  const [welcomeBonus, setWelcomeBonus] = useState("0");
  const [birthdayBonus, setBirthdayBonus] = useState("0");
  const [enableDailyStreak, setEnableDailyStreak] = useState(true);
  const [streakBonusPerDay, setStreakBonusPerDay] = useState("5");
  const [maxStreakDays, setMaxStreakDays] = useState("7");

  // Task dialog
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskKey, setTaskKey] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [icon, setIcon] = useState("Gift");
  const [pointsReward, setPointsReward] = useState("5");
  const [taskType, setTaskType] = useState("daily");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [maxCompletionsPerDay, setMaxCompletionsPerDay] = useState("1");
  const [cooldownHours, setCooldownHours] = useState("24");

  useEffect(() => {
    const checkAdmin = async () => {
      if (!user) {
        navigate("/auth");
        return;
      }
      const { data } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", user.id)
        .eq("role", "admin")
        .single();
      if (!data) {
        navigate("/");
        toast.error("غير مصرح لك بالوصول إلى هذه الصفحة");
      }
    };
    checkAdmin();
  }, [user, navigate]);

  // Fetch settings
  const { data: pointsSettings, isLoading: isLoadingSettings } = useQuery({
    queryKey: ["pointsSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("*")
        .eq("setting_key", "points_settings")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: referralSettings } = useQuery({
    queryKey: ["referralSettings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("*")
        .eq("setting_key", "referral_settings")
        .single();
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
  });

  const { data: tasks, isLoading: isLoadingTasks } = useQuery({
    queryKey: ["dailyTasks"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("daily_tasks")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  // Stats queries
  const { data: stats } = useQuery({
    queryKey: ["points-stats"],
    queryFn: async () => {
      const [totalUsers, totalPoints, todayEarned, todayRedeemed] = await Promise.all([
        supabase.from('user_points').select('user_id', { count: 'exact', head: true }),
        supabase.from('user_points').select('total_points'),
        supabase.from('points_transactions')
          .select('points')
          .eq('type', 'earn')
          .gte('created_at', new Date().toISOString().split('T')[0]),
        supabase.from('points_transactions')
          .select('points')
          .eq('type', 'redeem')
          .gte('created_at', new Date().toISOString().split('T')[0]),
      ]);
      
      const totalPointsSum = totalPoints.data?.reduce((acc: number, u: any) => acc + (u.total_points || 0), 0) || 0;
      const todayEarnedSum = todayEarned.data?.reduce((acc: number, t: any) => acc + (t.points || 0), 0) || 0;
      const todayRedeemedSum = todayRedeemed.data?.reduce((acc: number, t: any) => acc + (t.points || 0), 0) || 0;
      
      return {
        totalUsers: totalUsers.count || 0,
        totalPoints: totalPointsSum,
        todayEarned: todayEarnedSum,
        todayRedeemed: todayRedeemedSum,
      };
    },
    staleTime: 60 * 1000,
  });

  const { data: taskCompletions } = useQuery({
    queryKey: ["task-completions-stats"],
    queryFn: async () => {
      const today = new Date().toISOString().split('T')[0];
      const { count } = await supabase
        .from('user_task_completions')
        .select('*', { count: 'exact', head: true })
        .gte('completed_at', today);
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  // Load settings
  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const s = pointsSettings.setting_value as any;
      setPointsPerDinar(s.points_per_dinar?.toString() || "100");
      setPointsPerOrder(s.points_per_order?.toString() || "10");
      setPointsPerReview(s.points_per_review?.toString() || "5");
      setPointsPerVerifiedReview(s.points_per_verified_review?.toString() || "10");
      setOrderValueMultiplier(s.order_value_multiplier?.toString() || "0");
      setPointsToMoneyRate(s.conversion_rate?.toString() || s.points_to_money_rate?.toString() || "100");
      setPointsToCouponRate(s.points_to_coupon_rate?.toString() || "50");
      setPointsStatus(s.points_status || 'active');
      setMinCouponPoints(s.min_coupon_points?.toString() || "100");
      setMaxDailyRedemption(s.max_daily_redemption?.toString() || "1000");
      setTicketsPerPoint(s.tickets_per_point?.toString() || "0.1");
      setMinTicketsConversion(s.min_tickets_conversion?.toString() || "10");
      setPointsExpireDays(s.points_expire_days?.toString() || "365");
      setEnablePointsExpiry(s.enable_points_expiry || false);
      setMinRedeemPoints(s.min_redeem_points?.toString() || "100");
      setBonusMultiplier(s.bonus_multiplier?.toString() || "1");
      setWelcomeBonus(s.welcome_bonus?.toString() || "0");
      setBirthdayBonus(s.birthday_bonus?.toString() || "0");
      setEnableDailyStreak(s.enable_daily_streak !== false);
      setStreakBonusPerDay(s.streak_bonus_per_day?.toString() || "5");
      setMaxStreakDays(s.max_streak_days?.toString() || "7");
    }
  }, [pointsSettings]);

  useEffect(() => {
    if (referralSettings?.setting_value) {
      const s = referralSettings.setting_value as any;
      setReferrerPoints(s.points_for_referrer?.toString() || "50");
      setReferredPoints(s.points_for_referred?.toString() || "20");
    }
  }, [referralSettings]);

  // Save settings mutation
  const saveSettings = useMutation({
    mutationFn: async () => {
      const settingsValue = {
        points_status: pointsStatus,
        points_per_dinar: parseFloat(pointsPerDinar),
        points_per_order: parseFloat(pointsPerOrder),
        points_per_review: parseFloat(pointsPerReview),
        points_per_verified_review: parseFloat(pointsPerVerifiedReview),
        order_value_multiplier: parseFloat(orderValueMultiplier),
        conversion_rate: parseFloat(pointsToMoneyRate),
        points_to_money_rate: parseFloat(pointsToMoneyRate),
        points_to_coupon_rate: parseFloat(pointsToCouponRate),
        min_coupon_points: parseFloat(minCouponPoints),
        max_daily_redemption: parseFloat(maxDailyRedemption),
        tickets_per_point: parseFloat(ticketsPerPoint),
        min_tickets_conversion: parseFloat(minTicketsConversion),
        points_expire_days: parseInt(pointsExpireDays),
        enable_points_expiry: enablePointsExpiry,
        min_redeem_points: parseFloat(minRedeemPoints),
        bonus_multiplier: parseFloat(bonusMultiplier),
        welcome_bonus: parseFloat(welcomeBonus),
        birthday_bonus: parseFloat(birthdayBonus),
        enable_daily_streak: enableDailyStreak,
        streak_bonus_per_day: parseFloat(streakBonusPerDay),
        max_streak_days: parseInt(maxStreakDays),
      };

      if (pointsSettings) {
        const { error } = await supabase
          .from("default_settings")
          .update({ setting_value: settingsValue })
          .eq("setting_key", "points_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("default_settings")
          .insert({ setting_key: "points_settings", setting_value: settingsValue });
        if (error) throw error;
      }

      const referralSettingsValue = {
        points_for_referrer: parseFloat(referrerPoints),
        points_for_referred: parseFloat(referredPoints),
      };

      if (referralSettings) {
        const { error } = await supabase
          .from("default_settings")
          .update({ setting_value: referralSettingsValue })
          .eq("setting_key", "referral_settings");
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("default_settings")
          .insert({ setting_key: "referral_settings", setting_value: referralSettingsValue });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pointsSettings"] });
      queryClient.invalidateQueries({ queryKey: ["referralSettings"] });
      toast.success("تم حفظ الإعدادات بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حفظ الإعدادات");
    },
  });

  // Task mutations
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase.from("daily_tasks").delete().eq("id", taskId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      toast.success("تم حذف المهمة بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حذف المهمة");
    },
  });

  const saveTask = useMutation({
    mutationFn: async () => {
      const taskData = {
        task_key: taskKey,
        title_ar: titleAr,
        description_ar: descriptionAr,
        icon,
        points_reward: parseFloat(pointsReward),
        task_type: taskType,
        is_active: isActive,
        display_order: parseInt(displayOrder),
      };

      if (editingTask) {
        const { error } = await supabase.from("daily_tasks").update(taskData).eq("id", editingTask.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("daily_tasks").insert(taskData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["dailyTasks"] });
      toast.success(editingTask ? "تم تحديث المهمة بنجاح" : "تم إضافة المهمة بنجاح");
      handleCloseDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  const handleSaveSettings = () => {
    saveSettings.mutate();
  };

  const handleOpenDialog = (task?: any) => {
    if (task) {
      setEditingTask(task);
      setTaskKey(task.task_key);
      setTitleAr(task.title_ar);
      setDescriptionAr(task.description_ar);
      setIcon(task.icon);
      setPointsReward(task.points_reward.toString());
      setTaskType(task.task_type);
      setIsActive(task.is_active);
      setDisplayOrder(task.display_order.toString());
    } else {
      setEditingTask(null);
      setTaskKey("");
      setTitleAr("");
      setDescriptionAr("");
      setIcon("Gift");
      setPointsReward("5");
      setTaskType("daily");
      setIsActive(true);
      setDisplayOrder((tasks?.length || 0).toString());
    }
    setIsDialogOpen(true);
  };

  const handleCloseDialog = () => {
    setIsDialogOpen(false);
    setEditingTask(null);
  };

  const handleSaveTask = () => {
    if (!taskKey || !titleAr || !descriptionAr) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }
    saveTask.mutate();
  };

  const getIconComponent = (iconName: string, size = "h-5 w-5") => {
    const iconData = TASK_ICONS.find(i => i.name === iconName);
    const IconComponent = iconData?.icon || Gift;
    return <IconComponent className={size} />;
  };

  if (!user) return null;

  const isLoading = isLoadingSettings || isLoadingTasks;

  return (
    <AdminLayout
      title="إدارة نظام النقاط والمكافآت"
      icon={<Coins className="h-5 w-5" />}
      description="إعدادات شاملة للنقاط والمهام اليومية ومكافآت الولاء"
      actions={
        <Button onClick={handleSaveSettings} disabled={saveSettings.isPending} className="gap-2">
          <Save className="h-4 w-4" />
          {saveSettings.isPending ? 'جاري الحفظ...' : 'حفظ جميع الإعدادات'}
        </Button>
      }
    >
      {isLoading ? (
        <AdminLoading />
      ) : (
        <div className="space-y-6">
          {/* Stats Overview */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Coins className="h-5 w-5 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalPoints?.toLocaleString() || 0}</p>
                    <p className="text-xs text-muted-foreground">إجمالي النقاط</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-green-500/20">
                    <Users className="h-5 w-5 text-green-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{stats?.totalUsers || 0}</p>
                    <p className="text-xs text-muted-foreground">مستخدم نشط</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-blue-500/20">
                    <TrendingUp className="h-5 w-5 text-blue-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-green-500">+{stats?.todayEarned || 0}</p>
                    <p className="text-xs text-muted-foreground">مكتسبة اليوم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-purple-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-purple-500/20">
                    <ArrowUpRight className="h-5 w-5 text-purple-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-red-500">-{stats?.todayRedeemed || 0}</p>
                    <p className="text-xs text-muted-foreground">مستبدلة اليوم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
            
            <Card className="bg-gradient-to-br from-orange-500/10 to-red-500/5 border-orange-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-orange-500/20">
                    <CheckSquare className="h-5 w-5 text-orange-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{taskCompletions || 0}</p>
                    <p className="text-xs text-muted-foreground">مهمة مكتملة اليوم</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* System Status */}
          <Card className={`border-2 ${
            pointsStatus === 'active' ? 'border-green-500/50 bg-green-500/5' :
            pointsStatus === 'maintenance' ? 'border-yellow-500/50 bg-yellow-500/5' :
            'border-red-500/50 bg-red-500/5'
          }`}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className={`p-3 rounded-full ${
                    pointsStatus === 'active' ? 'bg-green-500/20' :
                    pointsStatus === 'maintenance' ? 'bg-yellow-500/20' :
                    'bg-red-500/20'
                  }`}>
                    {pointsStatus === 'active' ? <Zap className="h-6 w-6 text-green-500" /> :
                     pointsStatus === 'maintenance' ? <RefreshCw className="h-6 w-6 text-yellow-500" /> :
                     <EyeOff className="h-6 w-6 text-red-500" />}
                  </div>
                  <div>
                    <h3 className="font-bold text-lg">حالة نظام النقاط</h3>
                    <p className="text-sm text-muted-foreground">
                      {pointsStatus === 'active' && "النظام يعمل بشكل كامل"}
                      {pointsStatus === 'maintenance' && "النظام تحت الصيانة مؤقتاً"}
                      {pointsStatus === 'disabled' && "النظام متوقف"}
                    </p>
                  </div>
                </div>
                <Select value={pointsStatus} onValueChange={(v: any) => setPointsStatus(v)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="active">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-green-500" /> مفعّل</span>
                    </SelectItem>
                    <SelectItem value="maintenance">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500" /> صيانة</span>
                    </SelectItem>
                    <SelectItem value="disabled">
                      <span className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-red-500" /> معطّل</span>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          {/* Main Tabs */}
          <Tabs defaultValue="earning" className="space-y-4">
            <TabsList className="grid grid-cols-5 w-full">
              <TabsTrigger value="earning" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                <span className="hidden sm:inline">كسب النقاط</span>
              </TabsTrigger>
              <TabsTrigger value="redemption" className="flex items-center gap-2">
                <Gift className="h-4 w-4" />
                <span className="hidden sm:inline">الاستبدال</span>
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                <span className="hidden sm:inline">المهام</span>
              </TabsTrigger>
              <TabsTrigger value="bonuses" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">المكافآت</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">المستخدمين</span>
              </TabsTrigger>
            </TabsList>

            {/* Earning Tab */}
            <TabsContent value="earning" className="space-y-4">
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {SYSTEM_EARNING_METHODS.map((method) => (
                  <Card key={method.key} className={`bg-gradient-to-br ${method.color} border-primary/20`}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3">
                          <div className="p-2 rounded-lg bg-primary/20">
                            <method.icon className="h-5 w-5 text-primary" />
                          </div>
                          <div>
                            <h4 className="font-medium">{method.label}</h4>
                            <p className="text-xs text-muted-foreground mt-0.5">{method.description}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Input
                            type="number"
                            min="0"
                            className="w-20 h-9 text-center"
                            value={
                              method.key === 'points_per_dinar' ? pointsPerDinar :
                              method.key === 'points_per_order' ? pointsPerOrder :
                              method.key === 'points_per_review' ? pointsPerReview :
                              pointsPerVerifiedReview
                            }
                            onChange={(e) => {
                              if (method.key === 'points_per_dinar') setPointsPerDinar(e.target.value);
                              else if (method.key === 'points_per_order') setPointsPerOrder(e.target.value);
                              else if (method.key === 'points_per_review') setPointsPerReview(e.target.value);
                              else setPointsPerVerifiedReview(e.target.value);
                            }}
                          />
                          <span className="text-xs text-muted-foreground whitespace-nowrap">
                            {method.key === 'points_per_dinar' ? 'دينار/نقطة' : 'نقطة'}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>

              {/* Referral Settings */}
              <Card>
                <CardContent className="p-4">
                  <div className="flex items-center gap-3 mb-4">
                    <div className="p-2 rounded-lg bg-cyan-500/20">
                      <Share2 className="h-5 w-5 text-cyan-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">نظام الإحالة</h4>
                      <p className="text-xs text-muted-foreground">مكافأة الدعوات الناجحة</p>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط للداعي</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={referrerPoints}
                          onChange={(e) => setReferrerPoints(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط للمدعو</Label>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          value={referredPoints}
                          onChange={(e) => setReferredPoints(e.target.value)}
                          className="flex-1"
                        />
                        <span className="text-xs text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </TabsContent>

            {/* Redemption Tab */}
            <TabsContent value="redemption" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Wallet className="h-5 w-5 text-green-500" />
                      </div>
                      <h4 className="font-medium">التحويل للمحفظة</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">كل نقطة = كم دينار</Label>
                        <Input
                          type="number"
                          value={pointsToMoneyRate}
                          onChange={(e) => setPointsToMoneyRate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">الحد الأدنى للاستبدال</Label>
                        <Input
                          type="number"
                          value={minRedeemPoints}
                          onChange={(e) => setMinRedeemPoints(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Percent className="h-5 w-5 text-purple-500" />
                      </div>
                      <h4 className="font-medium">التحويل لكوبون</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">كل نقطة = كم خصم</Label>
                        <Input
                          type="number"
                          value={pointsToCouponRate}
                          onChange={(e) => setPointsToCouponRate(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">الحد الأدنى للكوبون</Label>
                        <Input
                          type="number"
                          value={minCouponPoints}
                          onChange={(e) => setMinCouponPoints(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <Target className="h-5 w-5 text-orange-500" />
                      </div>
                      <h4 className="font-medium">التحويل لتذاكر</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">كل نقطة = كم تذكرة</Label>
                        <Input
                          type="number"
                          step="0.01"
                          value={ticketsPerPoint}
                          onChange={(e) => setTicketsPerPoint(e.target.value)}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="text-sm">الحد الأدنى للتحويل</Label>
                        <Input
                          type="number"
                          value={minTicketsConversion}
                          onChange={(e) => setMinTicketsConversion(e.target.value)}
                        />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-red-500/20">
                        <Shield className="h-5 w-5 text-red-500" />
                      </div>
                      <h4 className="font-medium">حدود الاستبدال</h4>
                    </div>
                    <div className="space-y-3">
                      <div className="space-y-2">
                        <Label className="text-sm">الحد اليومي للاستبدال</Label>
                        <Input
                          type="number"
                          value={maxDailyRedemption}
                          onChange={(e) => setMaxDailyRedemption(e.target.value)}
                        />
                      </div>
                      <div className="flex items-center justify-between pt-2">
                        <div>
                          <Label className="text-sm">انتهاء صلاحية النقاط</Label>
                          <p className="text-xs text-muted-foreground">بعد {pointsExpireDays} يوم</p>
                        </div>
                        <Switch checked={enablePointsExpiry} onCheckedChange={setEnablePointsExpiry} />
                      </div>
                      {enablePointsExpiry && (
                        <Input
                          type="number"
                          value={pointsExpireDays}
                          onChange={(e) => setPointsExpireDays(e.target.value)}
                          placeholder="عدد الأيام"
                        />
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold">المهام اليومية</h3>
                  <p className="text-sm text-muted-foreground">
                    {tasks?.length || 0} مهمة • {tasks?.filter((t: any) => t.is_active).length || 0} مفعّلة
                  </p>
                </div>
                <Button onClick={() => handleOpenDialog()} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة مهمة
                </Button>
              </div>

              {!tasks || tasks.length === 0 ? (
                <AdminEmptyState
                  icon={<CheckSquare className="h-12 w-12" />}
                  title="لا توجد مهام"
                  description="ابدأ بإضافة مهمة جديدة للمستخدمين"
                  action={
                    <Button onClick={() => handleOpenDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة مهمة
                    </Button>
                  }
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {tasks.map((task: any, idx: number) => (
                    <Card key={task.id} className={`relative overflow-hidden ${!task.is_active && 'opacity-60'}`}>
                      <div className={`absolute top-0 left-0 right-0 h-1 ${
                        task.is_active ? 'bg-gradient-to-r from-primary to-primary/50' : 'bg-muted'
                      }`} />
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between">
                          <div className="flex items-start gap-3">
                            <div className={`p-2.5 rounded-xl ${
                              task.is_active ? 'bg-primary/20' : 'bg-muted'
                            }`}>
                              {getIconComponent(task.icon)}
                            </div>
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <h4 className="font-medium">{task.title_ar}</h4>
                                {task.task_type === 'daily' ? (
                                  <Badge variant="outline" className="text-[10px]">
                                    <Clock className="h-3 w-3 ml-1" />
                                    يومي
                                  </Badge>
                                ) : (
                                  <Badge variant="secondary" className="text-[10px]">مرة واحدة</Badge>
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground line-clamp-1">{task.description_ar}</p>
                              <div className="flex items-center gap-2 mt-2">
                                <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white">
                                  <Coins className="h-3 w-3 ml-1" />
                                  {task.points_reward} نقطة
                                </Badge>
                                <span className="text-[10px] text-muted-foreground">#{idx + 1}</span>
                              </div>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => handleOpenDialog(task)}
                            >
                              <Edit className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                  deleteTask.mutate(task.id);
                                }
                              }}
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              )}
            </TabsContent>

            {/* Bonuses Tab */}
            <TabsContent value="bonuses" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {/* Welcome Bonus */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <UserPlus className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">مكافأة الترحيب</h4>
                        <p className="text-xs text-muted-foreground">للمستخدمين الجدد</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط الترحيب</Label>
                      <Input
                        type="number"
                        value={welcomeBonus}
                        onChange={(e) => setWelcomeBonus(e.target.value)}
                        placeholder="0 = معطّل"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Birthday Bonus */}
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-pink-500/20">
                        <Gift className="h-5 w-5 text-pink-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">مكافأة عيد الميلاد</h4>
                        <p className="text-xs text-muted-foreground">تلقائياً في يوم الميلاد</p>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط عيد الميلاد</Label>
                      <Input
                        type="number"
                        value={birthdayBonus}
                        onChange={(e) => setBirthdayBonus(e.target.value)}
                        placeholder="0 = معطّل"
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* Streak Bonus */}
                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/20">
                          <Zap className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-medium">مكافأة التسلسل اليومي</h4>
                          <p className="text-xs text-muted-foreground">نقاط إضافية للدخول المتتالي</p>
                        </div>
                      </div>
                      <Switch checked={enableDailyStreak} onCheckedChange={setEnableDailyStreak} />
                    </div>
                    {enableDailyStreak && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-sm">نقاط إضافية لكل يوم</Label>
                          <Input
                            type="number"
                            value={streakBonusPerDay}
                            onChange={(e) => setStreakBonusPerDay(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">الحد الأقصى للأيام</Label>
                          <Input
                            type="number"
                            value={maxStreakDays}
                            onChange={(e) => setMaxStreakDays(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Bonus Multiplier */}
                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                      </div>
                      <div>
                        <h4 className="font-medium">مضاعف النقاط العام</h4>
                        <p className="text-xs text-muted-foreground">لمناسبات وعروض خاصة (1 = عادي، 2 = ضعف)</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-4">
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={bonusMultiplier}
                        onChange={(e) => setBonusMultiplier(e.target.value)}
                        className="w-24"
                      />
                      <span className="text-lg font-bold text-primary">x{bonusMultiplier}</span>
                      <div className="flex-1">
                        <Progress value={parseFloat(bonusMultiplier) * 20} className="h-2" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users" className="space-y-4">
              <AdminUsersPointsTab />
            </TabsContent>
          </Tabs>
        </div>
      )}

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg max-h-[90vh]">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'قم بتعديل تفاصيل المهمة' : 'أدخل تفاصيل المهمة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="max-h-[60vh] pr-4">
            <div className="space-y-4">
              {/* Icon Selection */}
              <div className="space-y-2">
                <Label>الأيقونة</Label>
                <div className="grid grid-cols-6 gap-2">
                  {TASK_ICONS.map((iconData) => (
                    <button
                      key={iconData.name}
                      type="button"
                      onClick={() => setIcon(iconData.name)}
                      className={`p-3 rounded-lg border-2 transition-all ${
                        icon === iconData.name
                          ? 'border-primary bg-primary/20'
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      <iconData.icon className="h-5 w-5 mx-auto" />
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-2">
                <Label>مفتاح المهمة (فريد)</Label>
                <Input
                  value={taskKey}
                  onChange={(e) => setTaskKey(e.target.value)}
                  placeholder="daily_login"
                  className="font-mono text-sm"
                />
              </div>

              <div className="space-y-2">
                <Label>العنوان</Label>
                <Input
                  value={titleAr}
                  onChange={(e) => setTitleAr(e.target.value)}
                  placeholder="تسجيل الدخول اليومي"
                />
              </div>

              <div className="space-y-2">
                <Label>الوصف</Label>
                <Textarea
                  value={descriptionAr}
                  onChange={(e) => setDescriptionAr(e.target.value)}
                  placeholder="سجل دخولك يومياً لكسب النقاط"
                  rows={2}
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label>النقاط</Label>
                  <Input
                    type="number"
                    value={pointsReward}
                    onChange={(e) => setPointsReward(e.target.value)}
                    placeholder="5"
                  />
                </div>
                <div className="space-y-2">
                  <Label>النوع</Label>
                  <Select value={taskType} onValueChange={setTaskType}>
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="daily">يومي</SelectItem>
                      <SelectItem value="one_time">لمرة واحدة</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <div className="space-y-2">
                <Label>الترتيب</Label>
                <Input
                  type="number"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                  placeholder="0"
                />
              </div>

              <div className="flex items-center justify-between py-2">
                <div>
                  <Label>حالة المهمة</Label>
                  <p className="text-xs text-muted-foreground">
                    {isActive ? 'المهمة مفعّلة وتظهر للمستخدمين' : 'المهمة معطّلة ومخفية'}
                  </p>
                </div>
                <Switch checked={isActive} onCheckedChange={setIsActive} />
              </div>
            </div>
          </ScrollArea>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>إلغاء</Button>
            <Button onClick={handleSaveTask} disabled={saveTask.isPending}>
              {saveTask.isPending ? 'جاري الحفظ...' : editingTask ? 'تحديث' : 'إضافة'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
