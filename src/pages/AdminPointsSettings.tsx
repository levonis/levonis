import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, Save, Plus, Trash2, CheckSquare, Edit, Coins, Gift, LogIn, Share2, UserPlus, Star, ShoppingCart } from "lucide-react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

// الطرق المدعومة للكسب في النظام
const SYSTEM_EARNING_METHODS = [
  { key: 'points_per_order', label: 'نقاط ثابتة لكل طلب مكتمل', icon: ShoppingCart, description: 'يمنح تلقائياً عند تسليم الطلب' },
  { key: 'points_per_review', label: 'نقاط لكل تقييم', icon: Star, description: 'يمنح تلقائياً عند إضافة تقييم' },
  { key: 'points_per_verified_review', label: 'نقاط إضافية لتقييم الطلب المؤكد', icon: Star, description: 'يمنح للتقييمات على طلبات مؤكدة' },
];

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // إعدادات النقاط
  const [pointsPerOrder, setPointsPerOrder] = useState("10");
  const [pointsPerReview, setPointsPerReview] = useState("5");
  const [pointsPerVerifiedReview, setPointsPerVerifiedReview] = useState("10");
  const [orderValueMultiplier, setOrderValueMultiplier] = useState("0");
  const [pointsToMoneyRate, setPointsToMoneyRate] = useState("100");
  const [pointsToCouponRate, setPointsToCouponRate] = useState("50");
  const [referrerPoints, setReferrerPoints] = useState("50");
  const [referredPoints, setReferredPoints] = useState("20");
  const [pointsStatus, setPointsStatus] = useState<'active' | 'maintenance' | 'disabled'>('active');

  // المهام اليومية
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

  // جلب إعدادات النقاط
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

  // جلب إعدادات الدعوة
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

  // جلب المهام اليومية
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

  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const settings = pointsSettings.setting_value as any;
      setPointsPerOrder(settings.points_per_order?.toString() || "10");
      setPointsPerReview(settings.points_per_review?.toString() || "5");
      setPointsPerVerifiedReview(settings.points_per_verified_review?.toString() || "10");
      setOrderValueMultiplier(settings.order_value_multiplier?.toString() || "0");
      setPointsToMoneyRate(settings.conversion_rate?.toString() || settings.points_to_money_rate?.toString() || "100");
      setPointsToCouponRate(settings.points_to_coupon_rate?.toString() || "50");
      setPointsStatus(settings.points_status || 'active');
    }
  }, [pointsSettings]);

  useEffect(() => {
    if (referralSettings?.setting_value) {
      const settings = referralSettings.setting_value as any;
      setReferrerPoints(settings.points_for_referrer?.toString() || "50");
      setReferredPoints(settings.points_for_referred?.toString() || "20");
    }
  }, [referralSettings]);

  // حفظ إعدادات النقاط
  const saveSettings = useMutation({
    mutationFn: async () => {
      const settingsValue = {
        points_status: pointsStatus,
        points_per_order: parseFloat(pointsPerOrder),
        points_per_review: parseFloat(pointsPerReview),
        points_per_verified_review: parseFloat(pointsPerVerifiedReview),
        order_value_multiplier: parseFloat(orderValueMultiplier),
        conversion_rate: parseFloat(pointsToMoneyRate),
        points_to_money_rate: parseFloat(pointsToMoneyRate),
        points_to_coupon_rate: parseFloat(pointsToCouponRate),
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
          .insert({
            setting_key: "points_settings",
            setting_value: settingsValue,
          });

        if (error) throw error;
      }

      // حفظ إعدادات الدعوة
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
          .insert({
            setting_key: "referral_settings",
            setting_value: referralSettingsValue,
          });

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

  // حذف مهمة
  const deleteTask = useMutation({
    mutationFn: async (taskId: string) => {
      const { error } = await supabase
        .from("daily_tasks")
        .delete()
        .eq("id", taskId);

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

  // إضافة أو تحديث مهمة
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
        const { error } = await supabase
          .from("daily_tasks")
          .update(taskData)
          .eq("id", editingTask.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("daily_tasks")
          .insert(taskData);

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
    const values = [
      parseFloat(pointsPerOrder),
      parseFloat(pointsPerReview),
      parseFloat(pointsPerVerifiedReview),
      parseFloat(orderValueMultiplier),
      parseFloat(pointsToMoneyRate),
      parseFloat(pointsToCouponRate),
      parseFloat(referrerPoints),
      parseFloat(referredPoints),
    ];

    if (values.some(v => isNaN(v) || v < 0)) {
      toast.error("الرجاء إدخال قيم صحيحة");
      return;
    }

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
      setDisplayOrder("0");
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

  const getIconComponent = (iconName: string) => {
    const icons: Record<string, any> = {
      Gift, LogIn, Share2, UserPlus, Coins, Star, ShoppingCart, CheckSquare
    };
    const IconComponent = icons[iconName] || Gift;
    return <IconComponent className="h-4 w-4" />;
  };

  if (!user) return null;

  const isLoading = isLoadingSettings || isLoadingTasks;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
            <Settings className="h-8 w-8" />
            إعدادات نظام النقاط والمهام
          </h1>
          <p className="text-muted-foreground">إدارة إعدادات المكافآت والنقاط والمهام اليومية</p>
        </div>

        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <Tabs defaultValue="settings" className="space-y-6">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="settings" className="flex items-center gap-2">
                <Coins className="h-4 w-4" />
                إعدادات النقاط
              </TabsTrigger>
              <TabsTrigger value="tasks" className="flex items-center gap-2">
                <CheckSquare className="h-4 w-4" />
                المهام اليومية
              </TabsTrigger>
            </TabsList>

            <TabsContent value="settings" className="space-y-6">
              {/* حالة النظام */}
              <Card>
                <CardHeader>
                  <CardTitle>حالة نظام النقاط</CardTitle>
                  <CardDescription>التحكم في حالة نظام النقاط بالكامل</CardDescription>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    <Select value={pointsStatus} onValueChange={(value: 'active' | 'maintenance' | 'disabled') => setPointsStatus(value)}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">مفعّل</SelectItem>
                        <SelectItem value="maintenance">تحت الصيانة</SelectItem>
                        <SelectItem value="disabled">معطّل</SelectItem>
                      </SelectContent>
                    </Select>
                    <div className="p-4 rounded-lg bg-muted">
                      <p className="text-sm">
                        {pointsStatus === 'active' && "✅ النظام مفعّل - يمكن للمستخدمين كسب واستخدام النقاط"}
                        {pointsStatus === 'maintenance' && "🔧 تحت الصيانة - لن يتمكن المستخدمون من كسب أو استخدام النقاط مؤقتاً"}
                        {pointsStatus === 'disabled' && "❌ معطّل - تم إيقاف نظام النقاط بالكامل"}
                      </p>
                    </div>
                  </div>
                </CardContent>
              </Card>

              {/* طرق كسب النقاط المربوطة بالنظام */}
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Coins className="h-5 w-5" />
                    طرق كسب النقاط (مربوطة بالنظام)
                  </CardTitle>
                  <CardDescription>هذه الطرق تعمل تلقائياً عند تحقق الشروط</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {SYSTEM_EARNING_METHODS.map((method) => (
                    <div key={method.key} className="flex items-center justify-between p-4 border rounded-lg">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <method.icon className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <p className="font-medium">{method.label}</p>
                          <p className="text-sm text-muted-foreground">{method.description}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          className="w-24"
                          value={
                            method.key === 'points_per_order' ? pointsPerOrder :
                            method.key === 'points_per_review' ? pointsPerReview :
                            pointsPerVerifiedReview
                          }
                          onChange={(e) => {
                            if (method.key === 'points_per_order') setPointsPerOrder(e.target.value);
                            else if (method.key === 'points_per_review') setPointsPerReview(e.target.value);
                            else setPointsPerVerifiedReview(e.target.value);
                          }}
                        />
                        <span className="text-sm text-muted-foreground">نقطة</span>
                      </div>
                    </div>
                  ))}

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <div>
                        <p className="font-medium">نقاط إضافية حسب قيمة الطلب</p>
                        <p className="text-sm text-muted-foreground">معامل النقاط لكل دينار (مثال: 0.01 = 1 نقطة لكل 100 دينار)</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Input
                          type="number"
                          min="0"
                          step="0.001"
                          className="w-24"
                          value={orderValueMultiplier}
                          onChange={(e) => setOrderValueMultiplier(e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>

              <div className="grid md:grid-cols-2 gap-6">
                {/* نسب التحويل */}
                <Card>
                  <CardHeader>
                    <CardTitle>نسب التحويل</CardTitle>
                    <CardDescription>معدلات تحويل النقاط إلى قيمة</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>نقاط = 1 دينار عراقي (نقدي)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={pointsToMoneyRate}
                        onChange={(e) => setPointsToMoneyRate(e.target.value)}
                      />
                      <p className="text-sm text-muted-foreground mt-1">
                        مثال: 100 نقطة = 1 دينار عراقي
                      </p>
                    </div>
                    <div>
                      <Label>نقاط = 1 دينار عراقي (كوبون)</Label>
                      <Input
                        type="number"
                        min="1"
                        value={pointsToCouponRate}
                        onChange={(e) => setPointsToCouponRate(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>

                {/* برنامج الدعوة */}
                <Card>
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <UserPlus className="h-5 w-5" />
                      برنامج الدعوة
                    </CardTitle>
                    <CardDescription>نقاط دعوة الأصدقاء</CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <Label>نقاط المُحيل (من يدعو)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={referrerPoints}
                        onChange={(e) => setReferrerPoints(e.target.value)}
                      />
                    </div>
                    <div>
                      <Label>نقاط المُحال (المدعو)</Label>
                      <Input
                        type="number"
                        min="0"
                        value={referredPoints}
                        onChange={(e) => setReferredPoints(e.target.value)}
                      />
                    </div>
                  </CardContent>
                </Card>
              </div>

              <Button 
                onClick={handleSaveSettings} 
                disabled={saveSettings.isPending}
                className="w-full"
                size="lg"
              >
                <Save className="ml-2 h-5 w-5" />
                {saveSettings.isPending ? "جاري الحفظ..." : "حفظ الإعدادات"}
              </Button>
            </TabsContent>

            <TabsContent value="tasks" className="space-y-6">
              <div className="flex justify-between items-center">
                <div>
                  <h2 className="text-xl font-semibold">المهام والتحديات</h2>
                  <p className="text-muted-foreground">إدارة المهام اليومية والأسبوعية للمستخدمين</p>
                </div>
                <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                  <DialogTrigger asChild>
                    <Button onClick={() => handleOpenDialog()}>
                      <Plus className="ml-2 h-4 w-4" />
                      إضافة مهمة
                    </Button>
                  </DialogTrigger>
                  <DialogContent className="max-w-lg">
                    <DialogHeader>
                      <DialogTitle>{editingTask ? "تعديل المهمة" : "إضافة مهمة جديدة"}</DialogTitle>
                      <DialogDescription>
                        قم بتعبئة المعلومات لإضافة أو تعديل مهمة
                      </DialogDescription>
                    </DialogHeader>
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label>مفتاح المهمة (بالإنجليزية)</Label>
                        <Input
                          value={taskKey}
                          onChange={(e) => setTaskKey(e.target.value)}
                          placeholder="daily_login"
                          disabled={!!editingTask}
                        />
                        <p className="text-xs text-muted-foreground">
                          استخدم: daily_login للدخول اليومي، share_product للمشاركة، etc
                        </p>
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
                        <Input
                          value={descriptionAr}
                          onChange={(e) => setDescriptionAr(e.target.value)}
                          placeholder="سجل دخولك كل يوم..."
                        />
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                          <Label>الأيقونة</Label>
                          <Select value={icon} onValueChange={setIcon}>
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="LogIn">تسجيل دخول</SelectItem>
                              <SelectItem value="Share2">مشاركة</SelectItem>
                              <SelectItem value="UserPlus">دعوة</SelectItem>
                              <SelectItem value="Gift">هدية</SelectItem>
                              <SelectItem value="Coins">عملات</SelectItem>
                              <SelectItem value="Star">نجمة</SelectItem>
                              <SelectItem value="ShoppingCart">سلة</SelectItem>
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
                      </div>
                      <div className="grid grid-cols-2 gap-4">
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
                            </SelectContent>
                          </Select>
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
                      <div className="flex items-center space-x-2 space-x-reverse">
                        <Switch
                          checked={isActive}
                          onCheckedChange={setIsActive}
                        />
                        <Label>مفعلة</Label>
                      </div>
                    </div>
                    <DialogFooter>
                      <Button variant="outline" onClick={handleCloseDialog}>
                        إلغاء
                      </Button>
                      <Button onClick={handleSaveTask} disabled={saveTask.isPending}>
                        {saveTask.isPending ? "جاري الحفظ..." : "حفظ"}
                      </Button>
                    </DialogFooter>
                  </DialogContent>
                </Dialog>
              </div>

              <Card>
                <CardHeader>
                  <CardTitle>قائمة المهام</CardTitle>
                  <CardDescription>
                    المهام المربوطة بالنظام (مثل daily_login) تعمل تلقائياً
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>المهمة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>النقاط</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead className="text-left">الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks && tasks.length > 0 ? (
                        tasks.map((task) => (
                          <TableRow key={task.id}>
                            <TableCell>
                              <div className="flex items-center gap-3">
                                <div className="p-2 bg-primary/10 rounded-lg">
                                  {getIconComponent(task.icon)}
                                </div>
                                <div>
                                  <p className="font-medium">{task.title_ar}</p>
                                  <p className="text-sm text-muted-foreground">{task.description_ar}</p>
                                  <Badge variant="outline" className="mt-1 text-xs">
                                    {task.task_key}
                                  </Badge>
                                </div>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge variant="secondary">
                                {task.task_type === "daily" ? "يومي" : 
                                 task.task_type === "weekly" ? "أسبوعي" : "مرة واحدة"}
                              </Badge>
                            </TableCell>
                            <TableCell>
                              <span className="font-semibold">{task.points_reward}</span> نقطة
                            </TableCell>
                            <TableCell>
                              {task.is_active ? (
                                <Badge variant="default">مفعلة</Badge>
                              ) : (
                                <Badge variant="secondary">معطلة</Badge>
                              )}
                            </TableCell>
                            <TableCell className="text-left">
                              <div className="flex gap-2">
                                <Button
                                  variant="outline"
                                  size="icon"
                                  onClick={() => handleOpenDialog(task)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                                <Button
                                  variant="destructive"
                                  size="icon"
                                  onClick={() => deleteTask.mutate(task.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </TableCell>
                          </TableRow>
                        ))
                      ) : (
                        <TableRow>
                          <TableCell colSpan={5} className="text-center py-8">
                            لا توجد مهام - أضف مهمة جديدة للبدء
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* معلومات مهمة */}
              <Card className="border-primary/20 bg-primary/5">
                <CardHeader>
                  <CardTitle className="text-lg">كيف تعمل المهام؟</CardTitle>
                </CardHeader>
                <CardContent className="space-y-2 text-sm">
                  <p>• <strong>daily_login:</strong> يتم تنفيذها تلقائياً عند دخول المستخدم للتطبيق</p>
                  <p>• المهام الأخرى يمكن ربطها بأزرار في التطبيق حسب task_key</p>
                  <p>• المهام اليومية تتجدد كل يوم، والأسبوعية كل أسبوع</p>
                  <p>• المهام "مرة واحدة" تُنفذ مرة واحدة فقط لكل مستخدم</p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        )}
      </main>
    </div>
  );
}