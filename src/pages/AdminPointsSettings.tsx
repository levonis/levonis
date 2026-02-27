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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { 
  Settings, Save, Plus, Trash2, CheckSquare, Edit, Coins, Gift, LogIn, 
  Share2, UserPlus, Star, ShoppingCart, Users, Zap, Target, TrendingUp,
  Clock, Calendar, Award, Sparkles, RefreshCw, Shield, Percent, ArrowUpRight,
  Package, Activity, ChevronLeft, ChevronRight, Eye, EyeOff, Wallet, Instagram,
  Image, Ticket, Tag, Box, Flame, Camera
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
import AdminPointsAuditTab from "@/components/admin/AdminPointsAuditTab";
import AdminTaskApprovalsTab from "@/components/admin/AdminTaskApprovalsTab";

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
  { name: 'Instagram', icon: Instagram, label: 'انستجرام' },
  { name: 'Camera', icon: Camera, label: 'كاميرا' },
  { name: 'Flame', icon: Flame, label: 'نار' },
];

// مهام جاهزة للإضافة السريعة
const PRESET_TASKS = [
  { task_key: 'daily_login', title_ar: 'تسجيل الدخول اليومي', description_ar: 'سجل دخولك يومياً للحصول على نقاط', icon: 'LogIn', points_reward: 5, task_type: 'daily', streak_bonus_enabled: true },
  { task_key: 'weekly_purchase', title_ar: 'اشترِ منتج هذا الأسبوع', description_ar: 'قم بشراء أي منتج للحصول على نقاط إضافية', icon: 'ShoppingCart', points_reward: 20, task_type: 'weekly', streak_bonus_enabled: true },
  { task_key: 'instagram_share', title_ar: 'شارك على انستجرام', description_ar: 'شارك منتجاتنا على انستجرام مع تاغ صفحتنا', icon: 'Instagram', points_reward: 50, task_type: 'once', requires_confirmation: true, confirmation_type: 'image_upload' },
  { task_key: 'invite_friend', title_ar: 'ادعُ صديق', description_ar: 'ادعُ صديقاً للتسجيل واحصل على نقاط', icon: 'UserPlus', points_reward: 30, task_type: 'unlimited' },
  { task_key: 'first_review', title_ar: 'أضف تقييمك الأول', description_ar: 'قيّم أول منتج اشتريته', icon: 'Star', points_reward: 15, task_type: 'once' },
  { task_key: 'complete_profile', title_ar: 'أكمل ملفك الشخصي', description_ar: 'أضف صورة وبياناتك الكاملة', icon: 'Award', points_reward: 25, task_type: 'once' },
];

// أنواع القسائم
const PRODUCT_TYPES = [
  { value: 'coupon', label: 'كوبون خصم', icon: Tag },
  { value: 'free_shipping', label: 'توصيل مجاني', icon: Package },
  { value: 'discount', label: 'خصم مباشر', icon: Percent },
];

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // System settings - Removed pointsPerDinar as each product now has its own points
  const [pointsPerReview, setPointsPerReview] = useState("5");
  const [pointsPerInstagramShare, setPointsPerInstagramShare] = useState("50");
  const [referrerPoints, setReferrerPoints] = useState("50");
  const [referredPoints, setReferredPoints] = useState("20");
  const [pointsStatus, setPointsStatus] = useState<'active' | 'maintenance' | 'disabled'>('active');
  
  // Redemption settings - wallet
  const [walletDinarsPerPoint, setWalletDinarsPerPoint] = useState("1");
  const [minWalletRedeemPoints, setMinWalletRedeemPoints] = useState("100");
  
  // Redemption settings - coupons
  const [couponDinarsPerPoint, setCouponDinarsPerPoint] = useState("2.67"); // 2000 / 750 = 2.67
  const [minCouponPoints, setMinCouponPoints] = useState("100");
  
  // Redemption settings - tickets
  const [pointsPerTicket, setPointsPerTicket] = useState("100");
  
  // Additional settings
  const [maxDailyRedemption, setMaxDailyRedemption] = useState("1000");
  const [pointsExpireDays, setPointsExpireDays] = useState("365");
  const [enablePointsExpiry, setEnablePointsExpiry] = useState(false);
  const [bonusMultiplier, setBonusMultiplier] = useState("1");
  const [welcomeBonus, setWelcomeBonus] = useState("0");
  const [birthdayBonus, setBirthdayBonus] = useState("0");
  const [enableDailyStreak, setEnableDailyStreak] = useState(true);
  const [streakBonusPerDay, setStreakBonusPerDay] = useState("5");
  const [maxStreakDays, setMaxStreakDays] = useState("7");

  // Task dialog
  const [isTaskDialogOpen, setIsTaskDialogOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<any>(null);
  const [taskKey, setTaskKey] = useState("");
  const [titleAr, setTitleAr] = useState("");
  const [descriptionAr, setDescriptionAr] = useState("");
  const [icon, setIcon] = useState("Gift");
  const [pointsReward, setPointsReward] = useState("5");
  const [taskType, setTaskType] = useState("daily");
  const [isActive, setIsActive] = useState(true);
  const [displayOrder, setDisplayOrder] = useState("0");
  const [streakBonusEnabled, setStreakBonusEnabled] = useState(false);
  const [taskStreakBonus, setTaskStreakBonus] = useState("2");
  const [taskMaxStreak, setTaskMaxStreak] = useState("7");
  const [requiresConfirmation, setRequiresConfirmation] = useState(false);
  const [confirmationType, setConfirmationType] = useState("auto");

  // Redeemable product dialog
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);
  const [productTitleAr, setProductTitleAr] = useState("");
  const [productDescriptionAr, setProductDescriptionAr] = useState("");
  const [productType, setProductType] = useState("coupon");
  const [productValue, setProductValue] = useState("0");
  const [productPointsCost, setProductPointsCost] = useState("100");
  const [productStock, setProductStock] = useState("5");
  const [productMaxPerUser, setProductMaxPerUser] = useState("1");
  const [productValidDays, setProductValidDays] = useState("30");
  const [productIsActive, setProductIsActive] = useState(true);

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

  const { data: redeemableProducts, isLoading: isLoadingProducts } = useQuery({
    queryKey: ["redeemableProducts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("points_redeemable_products")
        .select("*")
        .order("created_at", { ascending: false });
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

  const { data: pendingInstagramSubmissions } = useQuery({
    queryKey: ["pending-instagram-submissions"],
    queryFn: async () => {
      const { count } = await supabase
        .from('instagram_share_submissions')
        .select('*', { count: 'exact', head: true })
        .eq('status', 'pending');
      return count || 0;
    },
    staleTime: 60 * 1000,
  });

  // Load settings
  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const s = pointsSettings.setting_value as any;
      // Removed pointsPerDinar - each product has its own points now
      setPointsPerReview(s.points_per_review?.toString() || "5");
      setPointsPerInstagramShare(s.points_per_instagram_share?.toString() || "50");
      setPointsStatus(s.points_status || 'active');
      
      // Wallet conversion
      setWalletDinarsPerPoint(s.wallet_dinars_per_point?.toString() || "1");
      setMinWalletRedeemPoints(s.min_wallet_redeem_points?.toString() || "100");
      
      // Coupon conversion
      setCouponDinarsPerPoint(s.coupon_dinars_per_point?.toString() || "2.67");
      setMinCouponPoints(s.min_coupon_points?.toString() || "100");
      
      // Tickets
      setPointsPerTicket(s.points_per_ticket?.toString() || "100");
      
      setMaxDailyRedemption(s.max_daily_redemption?.toString() || "1000");
      setPointsExpireDays(s.points_expire_days?.toString() || "365");
      setEnablePointsExpiry(s.enable_points_expiry || false);
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
        // Removed points_per_dinar - each product now has its own points (points_reward field)
        points_per_review: parseFloat(pointsPerReview),
        points_per_instagram_share: parseFloat(pointsPerInstagramShare),
        
        // Wallet
        wallet_dinars_per_point: parseFloat(walletDinarsPerPoint),
        min_wallet_redeem_points: parseFloat(minWalletRedeemPoints),
        
        // Coupon
        coupon_dinars_per_point: parseFloat(couponDinarsPerPoint),
        min_coupon_points: parseFloat(minCouponPoints),
        
        // Tickets
        points_per_ticket: parseFloat(pointsPerTicket),
        
        max_daily_redemption: parseFloat(maxDailyRedemption),
        points_expire_days: parseInt(pointsExpireDays),
        enable_points_expiry: enablePointsExpiry,
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
        streak_bonus_enabled: streakBonusEnabled,
        streak_bonus_per_day: parseFloat(taskStreakBonus),
        max_streak_days: parseInt(taskMaxStreak),
        requires_confirmation: requiresConfirmation,
        confirmation_type: confirmationType,
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
      handleCloseTaskDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  // Redeemable product mutations
  const saveProduct = useMutation({
    mutationFn: async () => {
      const productData = {
        title_ar: productTitleAr,
        description_ar: productDescriptionAr,
        product_type: productType,
        value_amount: parseFloat(productValue),
        points_cost: parseInt(productPointsCost),
        stock_quantity: parseInt(productStock),
        max_per_user: parseInt(productMaxPerUser),
        valid_days: parseInt(productValidDays),
        is_active: productIsActive,
      };

      if (editingProduct) {
        const { error } = await supabase.from("points_redeemable_products").update(productData).eq("id", editingProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("points_redeemable_products").insert(productData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["redeemableProducts"] });
      toast.success(editingProduct ? "تم تحديث العرض بنجاح" : "تم إضافة العرض بنجاح");
      handleCloseProductDialog();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  const deleteProduct = useMutation({
    mutationFn: async (productId: string) => {
      const { error } = await supabase.from("points_redeemable_products").delete().eq("id", productId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["redeemableProducts"] });
      toast.success("تم حذف العرض بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء حذف العرض");
    },
  });

  const handleOpenTaskDialog = (task?: any) => {
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
      setStreakBonusEnabled(task.streak_bonus_enabled || false);
      setTaskStreakBonus(task.streak_bonus_per_day?.toString() || "2");
      setTaskMaxStreak(task.max_streak_days?.toString() || "7");
      setRequiresConfirmation(task.requires_confirmation || false);
      setConfirmationType(task.confirmation_type || "auto");
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
      setStreakBonusEnabled(false);
      setTaskStreakBonus("2");
      setTaskMaxStreak("7");
      setRequiresConfirmation(false);
      setConfirmationType("auto");
    }
    setIsTaskDialogOpen(true);
  };

  const handleCloseTaskDialog = () => {
    setIsTaskDialogOpen(false);
    setEditingTask(null);
  };

  const handleAddPresetTask = (preset: any) => {
    setEditingTask(null);
    setTaskKey(preset.task_key);
    setTitleAr(preset.title_ar);
    setDescriptionAr(preset.description_ar);
    setIcon(preset.icon);
    setPointsReward(preset.points_reward.toString());
    setTaskType(preset.task_type);
    setIsActive(true);
    setDisplayOrder((tasks?.length || 0).toString());
    setStreakBonusEnabled(preset.streak_bonus_enabled || false);
    setTaskStreakBonus("2");
    setTaskMaxStreak("7");
    setRequiresConfirmation(preset.requires_confirmation || false);
    setConfirmationType(preset.confirmation_type || "auto");
    setIsTaskDialogOpen(true);
  };

  const handleOpenProductDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      setProductTitleAr(product.title_ar);
      setProductDescriptionAr(product.description_ar || "");
      setProductType(product.product_type);
      setProductValue(product.value_amount.toString());
      setProductPointsCost(product.points_cost.toString());
      setProductStock(product.stock_quantity.toString());
      setProductMaxPerUser(product.max_per_user.toString());
      setProductValidDays(product.valid_days.toString());
      setProductIsActive(product.is_active);
    } else {
      setEditingProduct(null);
      setProductTitleAr("");
      setProductDescriptionAr("");
      setProductType("coupon");
      setProductValue("0");
      setProductPointsCost("100");
      setProductStock("5");
      setProductMaxPerUser("1");
      setProductValidDays("30");
      setProductIsActive(true);
    }
    setIsProductDialogOpen(true);
  };

  const handleCloseProductDialog = () => {
    setIsProductDialogOpen(false);
    setEditingProduct(null);
  };

  const getIconComponent = (iconName: string, size = "h-5 w-5") => {
    const iconData = TASK_ICONS.find(i => i.name === iconName);
    const IconComponent = iconData?.icon || Gift;
    return <IconComponent className={size} />;
  };

  const getProductTypeInfo = (type: string) => {
    return PRODUCT_TYPES.find(t => t.value === type) || PRODUCT_TYPES[0];
  };

  if (!user) return null;

  const isLoading = isLoadingSettings || isLoadingTasks || isLoadingProducts;

  return (
    <AdminLayout
      title="إدارة نظام النقاط والمكافآت"
      icon={<Coins className="h-5 w-5" />}
      description="إعدادات شاملة للنقاط والمهام اليومية ومكافآت الولاء"
      actions={
        <Button onClick={() => saveSettings.mutate()} disabled={saveSettings.isPending} className="gap-2">
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
          <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
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
                    <p className="text-xs text-muted-foreground">مهمة مكتملة</p>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 border-pink-500/20">
              <CardContent className="p-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 rounded-lg bg-pink-500/20">
                    <Instagram className="h-5 w-5 text-pink-500" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold">{pendingInstagramSubmissions || 0}</p>
                    <p className="text-xs text-muted-foreground">طلب انستجرام</p>
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
            <TabsList className="grid grid-cols-7 w-full">
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
              <TabsTrigger value="approvals" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">الموافقات</span>
              </TabsTrigger>
              <TabsTrigger value="bonuses" className="flex items-center gap-2">
                <Sparkles className="h-4 w-4" />
                <span className="hidden sm:inline">المكافآت</span>
              </TabsTrigger>
              <TabsTrigger value="users" className="flex items-center gap-2">
                <Users className="h-4 w-4" />
                <span className="hidden sm:inline">المستخدمين</span>
              </TabsTrigger>
              <TabsTrigger value="audit" className="flex items-center gap-2">
                <Shield className="h-4 w-4" />
                <span className="hidden sm:inline">المراجعة</span>
              </TabsTrigger>
            </TabsList>

            {/* Earning Tab */}
            <TabsContent value="earning" className="space-y-4">
              {/* Info about new points system */}
              <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-lg bg-amber-500/20">
                      <Coins className="h-5 w-5 text-amber-500" />
                    </div>
                    <div>
                      <h4 className="font-medium">نقاط المنتجات</h4>
                      <p className="text-sm text-muted-foreground mt-1">
                        يتم تحديد النقاط لكل منتج بشكل منفصل من صفحة تعديل المنتج. 
                        يتم حساب النقاط تلقائياً (1 نقطة لكل 1000 دينار) عند استخراج المنتج بالذكاء الاصطناعي، ويمكن للأدمن تعديلها.
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* نقاط للتقييم */}
                <Card className="bg-gradient-to-br from-purple-500/10 to-pink-500/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-purple-500/20">
                          <Star className="h-5 w-5 text-purple-500" />
                        </div>
                        <div>
                          <h4 className="font-medium">نقاط لكل تقييم</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">عند إضافة تقييم منتج</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-24 h-9 text-center"
                          value={pointsPerReview}
                          onChange={(e) => setPointsPerReview(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* نقاط لمشاركة انستجرام */}
                <Card className="bg-gradient-to-br from-pink-500/10 to-rose-500/5 border-primary/20">
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <div className="p-2 rounded-lg bg-pink-500/20">
                          <Instagram className="h-5 w-5 text-pink-500" />
                        </div>
                        <div>
                          <h4 className="font-medium">نقاط مشاركة انستجرام</h4>
                          <p className="text-xs text-muted-foreground mt-0.5">مشاركة منتج مع تاغ الصفحة</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-24 h-9 text-center"
                          value={pointsPerInstagramShare}
                          onChange={(e) => setPointsPerInstagramShare(e.target.value)}
                        />
                        <span className="text-xs text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                    <div className="mt-3 p-2 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground flex items-center gap-1">
                        <Camera className="h-3 w-3" />
                        يتطلب رفع صورة للتأكيد من قبل الإدارة
                      </p>
                    </div>
                  </CardContent>
                </Card>
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
              {/* Conversion Rates */}
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                {/* تحويل للمحفظة */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Wallet className="h-4 w-4 text-green-500" />
                      </div>
                      التحويل للمحفظة
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">كم دينار تساوي نقطة واحدة</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={walletDinarsPerPoint}
                        onChange={(e) => setWalletDinarsPerPoint(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        مثال: 1000 نقطة = {(1000 * parseFloat(walletDinarsPerPoint || "1")).toLocaleString()} دينار
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">الحد الأدنى للتحويل</Label>
                      <Input
                        type="number"
                        value={minWalletRedeemPoints}
                        onChange={(e) => setMinWalletRedeemPoints(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* تحويل لكوبون */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Percent className="h-4 w-4 text-purple-500" />
                      </div>
                      التحويل لكوبون
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">كم دينار تساوي نقطة واحدة</Label>
                      <Input
                        type="number"
                        step="0.01"
                        value={couponDinarsPerPoint}
                        onChange={(e) => setCouponDinarsPerPoint(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        مثال: 750 نقطة = كوبون {(750 * parseFloat(couponDinarsPerPoint || "2.67")).toLocaleString()} دينار
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">الحد الأدنى للكوبون</Label>
                      <Input
                        type="number"
                        value={minCouponPoints}
                        onChange={(e) => setMinCouponPoints(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* تحويل لتذاكر */}
                <Card>
                  <CardHeader className="pb-3">
                    <CardTitle className="text-base flex items-center gap-2">
                      <div className="p-2 rounded-lg bg-orange-500/20">
                        <Ticket className="h-4 w-4 text-orange-500" />
                      </div>
                      التحويل لتذاكر
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div className="space-y-2">
                      <Label className="text-sm">كم نقطة تساوي تذكرة واحدة</Label>
                      <Input
                        type="number"
                        value={pointsPerTicket}
                        onChange={(e) => setPointsPerTicket(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        مثال: {pointsPerTicket} نقطة = 1 تذكرة
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Limits */}
              <Card>
                <CardContent className="p-4">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="space-y-2">
                      <Label className="text-sm">الحد اليومي للاستبدال</Label>
                      <Input
                        type="number"
                        value={maxDailyRedemption}
                        onChange={(e) => setMaxDailyRedemption(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label className="text-sm">انتهاء صلاحية النقاط</Label>
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
                  </div>
                </CardContent>
              </Card>

              {/* Redeemable Products */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="text-base flex items-center gap-2">
                      <Box className="h-5 w-5" />
                      قسائم ومنتجات قابلة للشراء بالنقاط
                    </CardTitle>
                    <Button onClick={() => handleOpenProductDialog()} size="sm" className="gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة عرض
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!redeemableProducts || redeemableProducts.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <Box className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>لا توجد عروض حالياً</p>
                      <p className="text-sm">أضف قسائم ومنتجات يمكن للمستخدمين شراؤها بالنقاط</p>
                    </div>
                  ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
                      {redeemableProducts.map((product: any) => {
                        const typeInfo = getProductTypeInfo(product.product_type);
                        const TypeIcon = typeInfo.icon;
                        return (
                          <Card key={product.id} className={`relative ${!product.is_active ? 'opacity-60' : ''}`}>
                            <CardContent className="p-4">
                              <div className="flex items-start justify-between mb-3">
                                <div className="flex items-center gap-2">
                                  <div className="p-2 rounded-lg bg-primary/10">
                                    <TypeIcon className="h-4 w-4 text-primary" />
                                  </div>
                                  <div>
                                    <h4 className="font-medium text-sm">{product.title_ar}</h4>
                                    <Badge variant="outline" className="text-xs mt-1">
                                      {typeInfo.label}
                                    </Badge>
                                  </div>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleOpenProductDialog(product)}>
                                    <Edit className="h-3.5 w-3.5" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => deleteProduct.mutate(product.id)}>
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </Button>
                                </div>
                              </div>
                              <div className="space-y-2">
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">القيمة:</span>
                                  <span className="font-medium">{product.value_amount.toLocaleString()} دينار</span>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">السعر:</span>
                                  <Badge className="bg-amber-500/20 text-amber-700">
                                    <Coins className="h-3 w-3 ml-1" />
                                    {product.points_cost.toLocaleString()}
                                  </Badge>
                                </div>
                                <div className="flex justify-between text-sm">
                                  <span className="text-muted-foreground">المخزون:</span>
                                  <Badge variant={product.stock_quantity > 0 ? "default" : "destructive"}>
                                    {product.stock_quantity} متاح
                                  </Badge>
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Tasks Tab */}
            <TabsContent value="tasks" className="space-y-4">
              {/* Preset Tasks */}
              <Card>
                <CardHeader className="pb-3">
                  <CardTitle className="text-base">مهام جاهزة للإضافة السريعة</CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="flex flex-wrap gap-2">
                    {PRESET_TASKS.map((preset) => {
                      const isAdded = tasks?.some((t: any) => t.task_key === preset.task_key);
                      return (
                        <Button
                          key={preset.task_key}
                          variant={isAdded ? "secondary" : "outline"}
                          size="sm"
                          disabled={isAdded}
                          onClick={() => handleAddPresetTask(preset)}
                          className="gap-2"
                        >
                          {getIconComponent(preset.icon, "h-4 w-4")}
                          {preset.title_ar}
                          {isAdded && <CheckSquare className="h-3 w-3 text-green-500" />}
                        </Button>
                      );
                    })}
                  </div>
                </CardContent>
              </Card>

              {/* Tasks List */}
              <Card>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="text-base">المهام اليومية</CardTitle>
                      <p className="text-sm text-muted-foreground mt-1">
                        {tasks?.length || 0} مهمة • {tasks?.filter((t: any) => t.is_active).length || 0} مفعّلة
                      </p>
                    </div>
                    <Button onClick={() => handleOpenTaskDialog()} className="gap-2">
                      <Plus className="h-4 w-4" />
                      مهمة جديدة
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {!tasks || tasks.length === 0 ? (
                    <div className="text-center py-8 text-muted-foreground">
                      <CheckSquare className="h-12 w-12 mx-auto mb-4 opacity-50" />
                      <p>لا توجد مهام حالياً</p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {tasks.map((task: any) => (
                        <Card key={task.id} className={`${!task.is_active ? 'opacity-60' : ''}`}>
                          <CardContent className="p-4">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${task.is_active ? 'bg-primary/10' : 'bg-muted'}`}>
                                  {getIconComponent(task.icon)}
                                </div>
                                <div>
                                  <div className="flex items-center gap-2">
                                    <h4 className="font-medium">{task.title_ar}</h4>
                                    {task.streak_bonus_enabled && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Flame className="h-3 w-3 text-orange-500" />
                                        ستريك
                                      </Badge>
                                    )}
                                    {task.requires_confirmation && (
                                      <Badge variant="outline" className="text-xs gap-1">
                                        <Camera className="h-3 w-3" />
                                        تأكيد
                                      </Badge>
                                    )}
                                  </div>
                                  <p className="text-xs text-muted-foreground">{task.description_ar}</p>
                                </div>
                              </div>
                              <div className="flex items-center gap-3">
                                <div className="text-left">
                                  <Badge className="bg-amber-500/20 text-amber-700">
                                    <Coins className="h-3 w-3 ml-1" />
                                    {task.points_reward}
                                  </Badge>
                                  <p className="text-xs text-muted-foreground mt-1">
                                    {task.task_type === 'daily' ? 'يومي' : 
                                     task.task_type === 'weekly' ? 'أسبوعي' : 
                                     task.task_type === 'once' ? 'مرة واحدة' : 'غير محدود'}
                                  </p>
                                </div>
                                <div className="flex gap-1">
                                  <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => handleOpenTaskDialog(task)}>
                                    <Edit className="h-4 w-4" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive" onClick={() => deleteTask.mutate(task.id)}>
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            {/* Bonuses Tab */}
            <TabsContent value="bonuses" className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-green-500/20">
                        <Gift className="h-5 w-5 text-green-500" />
                      </div>
                      <h4 className="font-medium">مكافأة الترحيب</h4>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط عند التسجيل الجديد</Label>
                      <Input
                        type="number"
                        value={welcomeBonus}
                        onChange={(e) => setWelcomeBonus(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card>
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-pink-500/20">
                        <Calendar className="h-5 w-5 text-pink-500" />
                      </div>
                      <h4 className="font-medium">مكافأة عيد الميلاد</h4>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">نقاط في يوم ميلاد المستخدم</Label>
                      <Input
                        type="number"
                        value={birthdayBonus}
                        onChange={(e) => setBirthdayBonus(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 rounded-lg bg-orange-500/20">
                          <Flame className="h-5 w-5 text-orange-500" />
                        </div>
                        <div>
                          <h4 className="font-medium">نظام الستريك</h4>
                          <p className="text-xs text-muted-foreground">مكافأة إضافية للدخول المتواصل</p>
                        </div>
                      </div>
                      <Switch checked={enableDailyStreak} onCheckedChange={setEnableDailyStreak} />
                    </div>
                    {enableDailyStreak && (
                      <div className="grid grid-cols-2 gap-4 pt-2">
                        <div className="space-y-2">
                          <Label className="text-sm">نقاط إضافية لكل يوم متواصل</Label>
                          <Input
                            type="number"
                            value={streakBonusPerDay}
                            onChange={(e) => setStreakBonusPerDay(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">الحد الأقصى للستريك (أيام)</Label>
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

                <Card className="md:col-span-2">
                  <CardContent className="p-4 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="p-2 rounded-lg bg-purple-500/20">
                        <Sparkles className="h-5 w-5 text-purple-500" />
                      </div>
                      <h4 className="font-medium">مضاعف النقاط</h4>
                    </div>
                    <div className="space-y-2">
                      <Label className="text-sm">معامل مضاعفة النقاط (1 = عادي، 2 = ضعف)</Label>
                      <Input
                        type="number"
                        step="0.1"
                        min="1"
                        value={bonusMultiplier}
                        onChange={(e) => setBonusMultiplier(e.target.value)}
                      />
                      <p className="text-xs text-muted-foreground">
                        يمكن استخدامه في المناسبات لمضاعفة النقاط
                      </p>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>

            {/* Users Tab */}
            <TabsContent value="users">
              <AdminUsersPointsTab />
            </TabsContent>

            {/* Approvals Tab */}
            <TabsContent value="approvals">
              <AdminTaskApprovalsTab />
            </TabsContent>

            {/* Audit Tab */}
            <TabsContent value="audit">
              <AdminPointsAuditTab />
            </TabsContent>
          </Tabs>

          {/* Task Dialog */}
          <Dialog open={isTaskDialogOpen} onOpenChange={setIsTaskDialogOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>
                  {editingTask ? "تعديل المهمة" : "إضافة مهمة جديدة"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 overscroll-contain" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                <div className="space-y-4 py-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>معرّف المهمة</Label>
                      <Input
                        value={taskKey}
                        onChange={(e) => setTaskKey(e.target.value)}
                        placeholder="daily_login"
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>نوع المهمة</Label>
                      <Select value={taskType} onValueChange={setTaskType}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="daily">يومي</SelectItem>
                          <SelectItem value="weekly">أسبوعي</SelectItem>
                          <SelectItem value="once">مرة واحدة</SelectItem>
                          <SelectItem value="unlimited">غير محدود</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>العنوان بالعربية</Label>
                    <Input
                      value={titleAr}
                      onChange={(e) => setTitleAr(e.target.value)}
                      placeholder="تسجيل الدخول اليومي"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>الوصف بالعربية</Label>
                    <Textarea
                      value={descriptionAr}
                      onChange={(e) => setDescriptionAr(e.target.value)}
                      placeholder="سجل دخولك يومياً للحصول على نقاط"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div className="space-y-2">
                      <Label>الأيقونة</Label>
                      <Select value={icon} onValueChange={setIcon}>
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {TASK_ICONS.map((i) => (
                            <SelectItem key={i.name} value={i.name}>
                              <span className="flex items-center gap-2">
                                <i.icon className="h-4 w-4" />
                                {i.label}
                              </span>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-2">
                      <Label>النقاط</Label>
                      <Input
                        type="number"
                        value={pointsReward}
                        onChange={(e) => setPointsReward(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الترتيب</Label>
                      <Input
                        type="number"
                        value={displayOrder}
                        onChange={(e) => setDisplayOrder(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label>مفعّلة</Label>
                    <Switch checked={isActive} onCheckedChange={setIsActive} />
                  </div>

                  {/* Streak Settings */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Flame className="h-4 w-4 text-orange-500" />
                        <Label>نظام الستريك</Label>
                      </div>
                      <Switch checked={streakBonusEnabled} onCheckedChange={setStreakBonusEnabled} />
                    </div>
                    {streakBonusEnabled && (
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <Label className="text-sm">نقاط إضافية/يوم</Label>
                          <Input
                            type="number"
                            value={taskStreakBonus}
                            onChange={(e) => setTaskStreakBonus(e.target.value)}
                          />
                        </div>
                        <div className="space-y-2">
                          <Label className="text-sm">أقصى عدد أيام</Label>
                          <Input
                            type="number"
                            value={taskMaxStreak}
                            onChange={(e) => setTaskMaxStreak(e.target.value)}
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Confirmation Settings */}
                  <div className="border rounded-lg p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Camera className="h-4 w-4" />
                        <Label>يتطلب تأكيد</Label>
                      </div>
                      <Switch checked={requiresConfirmation} onCheckedChange={setRequiresConfirmation} />
                    </div>
                    {requiresConfirmation && (
                      <div className="space-y-2">
                        <Label className="text-sm">نوع التأكيد</Label>
                        <Select value={confirmationType} onValueChange={setConfirmationType}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="auto">تلقائي</SelectItem>
                            <SelectItem value="image_upload">رفع صورة</SelectItem>
                            <SelectItem value="admin_approval">موافقة الإدارة</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    )}
                  </div>
                </div>
              </div>
              <DialogFooter className="p-6 pt-4 border-t">
                <Button variant="outline" onClick={handleCloseTaskDialog}>
                  إلغاء
                </Button>
                <Button onClick={() => saveTask.mutate()} disabled={saveTask.isPending}>
                  {saveTask.isPending ? "جاري الحفظ..." : editingTask ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {/* Product Dialog */}
          <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
            <DialogContent className="max-w-lg max-h-[85vh] overflow-hidden p-0">
              <DialogHeader className="p-6 pb-0">
                <DialogTitle>
                  {editingProduct ? "تعديل العرض" : "إضافة عرض جديد"}
                </DialogTitle>
              </DialogHeader>
              <div className="flex-1 overflow-y-auto px-6 overscroll-contain" style={{ maxHeight: 'calc(85vh - 140px)' }}>
                <div className="space-y-4 py-4">
                  <div className="space-y-2">
                    <Label>نوع العرض</Label>
                    <Select value={productType} onValueChange={setProductType}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {PRODUCT_TYPES.map((type) => (
                          <SelectItem key={type.value} value={type.value}>
                            <span className="flex items-center gap-2">
                              <type.icon className="h-4 w-4" />
                              {type.label}
                            </span>
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-2">
                    <Label>العنوان بالعربية</Label>
                    <Input
                      value={productTitleAr}
                      onChange={(e) => setProductTitleAr(e.target.value)}
                      placeholder="كوبون توصيل مجاني"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>الوصف بالعربية (اختياري)</Label>
                    <Textarea
                      value={productDescriptionAr}
                      onChange={(e) => setProductDescriptionAr(e.target.value)}
                      placeholder="احصل على توصيل مجاني لطلبك القادم"
                      rows={2}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>قيمة الخصم (دينار)</Label>
                      <Input
                        type="number"
                        value={productValue}
                        onChange={(e) => setProductValue(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>السعر بالنقاط</Label>
                      <Input
                        type="number"
                        value={productPointsCost}
                        onChange={(e) => setProductPointsCost(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>المخزون المتاح</Label>
                      <Input
                        type="number"
                        value={productStock}
                        onChange={(e) => setProductStock(e.target.value)}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>الحد لكل مستخدم</Label>
                      <Input
                        type="number"
                        value={productMaxPerUser}
                        onChange={(e) => setProductMaxPerUser(e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>صلاحية القسيمة (أيام)</Label>
                    <Input
                      type="number"
                      value={productValidDays}
                      onChange={(e) => setProductValidDays(e.target.value)}
                    />
                  </div>

                  <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <Label>مفعّل</Label>
                    <Switch checked={productIsActive} onCheckedChange={setProductIsActive} />
                  </div>
                </div>
              </div>
              <DialogFooter className="p-6 pt-4 border-t">
                <Button variant="outline" onClick={handleCloseProductDialog}>
                  إلغاء
                </Button>
                <Button onClick={() => saveProduct.mutate()} disabled={saveProduct.isPending}>
                  {saveProduct.isPending ? "جاري الحفظ..." : editingProduct ? "تحديث" : "إضافة"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}
    </AdminLayout>
  );
}