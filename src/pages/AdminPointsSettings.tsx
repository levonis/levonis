import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { Settings, Save, Plus, Trash2, CheckSquare, Edit, Coins, Gift, LogIn, Share2, UserPlus, Star, ShoppingCart, Users } from "lucide-react";
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

const SYSTEM_EARNING_METHODS = [
  { key: 'points_per_dinar', label: 'نقطة لكل X دينار من قيمة الطلب', icon: Coins, description: 'يحسب تلقائياً عند تسليم الطلب' },
  { key: 'points_per_order', label: 'نقاط ثابتة لكل طلب مكتمل', icon: ShoppingCart, description: 'يمنح تلقائياً عند تسليم الطلب' },
  { key: 'points_per_review', label: 'نقاط لكل تقييم', icon: Star, description: 'يمنح تلقائياً عند إضافة تقييم' },
  { key: 'points_per_verified_review', label: 'نقاط إضافية لتقييم الطلب المؤكد', icon: Star, description: 'يمنح للتقييمات على طلبات مؤكدة' },
];

export default function AdminPointsSettings() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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

  useEffect(() => {
    if (pointsSettings?.setting_value) {
      const settings = pointsSettings.setting_value as any;
      setPointsPerDinar(settings.points_per_dinar?.toString() || "100");
      setPointsPerOrder(settings.points_per_order?.toString() || "10");
      setPointsPerReview(settings.points_per_review?.toString() || "5");
      setPointsPerVerifiedReview(settings.points_per_verified_review?.toString() || "10");
      setOrderValueMultiplier(settings.order_value_multiplier?.toString() || "0");
      setPointsToMoneyRate(settings.conversion_rate?.toString() || settings.points_to_money_rate?.toString() || "100");
      setPointsToCouponRate(settings.points_to_coupon_rate?.toString() || "50");
      setPointsStatus(settings.points_status || 'active');
      setMinCouponPoints(settings.min_coupon_points?.toString() || "100");
      setMaxDailyRedemption(settings.max_daily_redemption?.toString() || "1000");
      setTicketsPerPoint(settings.tickets_per_point?.toString() || "0.1");
      setMinTicketsConversion(settings.min_tickets_conversion?.toString() || "10");
    }
  }, [pointsSettings]);

  useEffect(() => {
    if (referralSettings?.setting_value) {
      const settings = referralSettings.setting_value as any;
      setReferrerPoints(settings.points_for_referrer?.toString() || "50");
      setReferredPoints(settings.points_for_referred?.toString() || "20");
    }
  }, [referralSettings]);

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
    const icons: Record<string, any> = { Gift, LogIn, Share2, UserPlus, Coins, Star, ShoppingCart, CheckSquare };
    const IconComponent = icons[iconName] || Gift;
    return <IconComponent className="h-4 w-4" />;
  };

  if (!user) return null;

  const isLoading = isLoadingSettings || isLoadingTasks;

  return (
    <AdminLayout
      title="إعدادات نظام النقاط والمهام"
      icon={<Settings className="h-5 w-5" />}
      description="إدارة إعدادات المكافآت والنقاط والمهام اليومية"
      actions={
        <Button onClick={handleSaveSettings} disabled={saveSettings.isPending} className="admin-btn-primary gap-2">
          <Save className="h-4 w-4" />
          {saveSettings.isPending ? 'جاري الحفظ...' : 'حفظ الإعدادات'}
        </Button>
      }
    >
      {isLoading ? (
        <AdminLoading />
      ) : (
        <Tabs defaultValue="settings" className="space-y-6">
          <TabsList className="admin-tabs">
            <TabsTrigger value="settings" className="admin-tab flex items-center gap-2">
              <Coins className="h-4 w-4" />
              إعدادات النقاط
            </TabsTrigger>
            <TabsTrigger value="tasks" className="admin-tab flex items-center gap-2">
              <CheckSquare className="h-4 w-4" />
              المهام اليومية
            </TabsTrigger>
            <TabsTrigger value="users" className="admin-tab flex items-center gap-2">
              <Users className="h-4 w-4" />
              المستخدمين
            </TabsTrigger>
          </TabsList>

          <TabsContent value="settings" className="space-y-6">
            {/* System Status */}
            <AdminCard>
              <AdminCardHeader title="حالة نظام النقاط" description="التحكم في حالة نظام النقاط بالكامل" />
              <AdminCardContent>
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
                  <div className="p-4 rounded-lg bg-muted/50">
                    <p className="text-sm">
                      {pointsStatus === 'active' && "✅ النظام مفعّل - يمكن للمستخدمين كسب واستخدام النقاط"}
                      {pointsStatus === 'maintenance' && "🔧 تحت الصيانة - لن يتمكن المستخدمون من كسب أو استخدام النقاط مؤقتاً"}
                      {pointsStatus === 'disabled' && "❌ معطّل - تم إيقاف نظام النقاط بالكامل"}
                    </p>
                  </div>
                </div>
              </AdminCardContent>
            </AdminCard>

            {/* Earning Methods */}
            <AdminCard>
              <AdminCardHeader 
                title="طرق كسب النقاط" 
                icon={<Coins className="h-5 w-5" />}
                description="هذه الطرق تعمل تلقائياً عند تحقق الشروط"
              />
              <AdminCardContent>
                <div className="space-y-4">
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
                        <span className="text-sm text-muted-foreground">
                          {method.key === 'points_per_dinar' ? 'دينار لكل نقطة' : 'نقطة'}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </AdminCardContent>
            </AdminCard>

            {/* Conversion Rates */}
            <AdminCard>
              <AdminCardHeader title="معدلات التحويل" description="تحديد قيمة النقاط عند التحويل" />
              <AdminCardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="admin-form-group">
                    <Label>نقطة = كم دينار</Label>
                    <Input
                      type="number"
                      value={pointsToMoneyRate}
                      onChange={(e) => setPointsToMoneyRate(e.target.value)}
                      placeholder="100"
                    />
                    <p className="text-xs text-muted-foreground mt-1">كل نقطة تساوي كم دينار</p>
                  </div>
                  <div className="admin-form-group">
                    <Label>نقطة = كم خصم (كوبون)</Label>
                    <Input
                      type="number"
                      value={pointsToCouponRate}
                      onChange={(e) => setPointsToCouponRate(e.target.value)}
                      placeholder="50"
                    />
                    <p className="text-xs text-muted-foreground mt-1">قيمة النقطة عند التحويل لكوبون</p>
                  </div>
                </div>
              </AdminCardContent>
            </AdminCard>

            {/* Referral Settings */}
            <AdminCard>
              <AdminCardHeader title="إعدادات الدعوة" icon={<Share2 className="h-5 w-5" />} />
              <AdminCardContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="admin-form-group">
                    <Label>نقاط للداعي</Label>
                    <Input
                      type="number"
                      value={referrerPoints}
                      onChange={(e) => setReferrerPoints(e.target.value)}
                      placeholder="50"
                    />
                  </div>
                  <div className="admin-form-group">
                    <Label>نقاط للمدعو</Label>
                    <Input
                      type="number"
                      value={referredPoints}
                      onChange={(e) => setReferredPoints(e.target.value)}
                      placeholder="20"
                    />
                  </div>
                </div>
              </AdminCardContent>
            </AdminCard>
          </TabsContent>

          <TabsContent value="tasks" className="space-y-6">
            <AdminSection
              title="المهام اليومية"
              description="إدارة المهام التي يمكن للمستخدمين إكمالها لكسب النقاط"
              actions={
                <Button onClick={() => handleOpenDialog()} className="admin-btn-primary gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة مهمة
                </Button>
              }
            >
              {!tasks || tasks.length === 0 ? (
                <AdminEmptyState
                  icon={<CheckSquare className="h-12 w-12" />}
                  title="لا توجد مهام"
                  description="ابدأ بإضافة مهمة جديدة"
                  action={
                    <Button onClick={() => handleOpenDialog()} className="admin-btn-primary gap-2">
                      <Plus className="h-4 w-4" />
                      إضافة مهمة
                    </Button>
                  }
                />
              ) : (
                <div className="admin-table-wrapper">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>الأيقونة</TableHead>
                        <TableHead>العنوان</TableHead>
                        <TableHead>النقاط</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {tasks.map((task: any) => (
                        <TableRow key={task.id}>
                          <TableCell>{getIconComponent(task.icon)}</TableCell>
                          <TableCell className="font-medium">{task.title_ar}</TableCell>
                          <TableCell>
                            <Badge variant="outline">{task.points_reward} نقطة</Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {task.task_type === 'daily' ? 'يومي' : 'لمرة واحدة'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <Badge variant={task.is_active ? 'default' : 'secondary'}>
                              {task.is_active ? 'مفعّل' : 'معطّل'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-2">
                              <Button size="sm" variant="outline" onClick={() => handleOpenDialog(task)}>
                                <Edit className="h-4 w-4" />
                              </Button>
                              <Button
                                size="sm"
                                variant="outline"
                                className="text-destructive"
                                onClick={() => {
                                  if (confirm('هل أنت متأكد من حذف هذه المهمة؟')) {
                                    deleteTask.mutate(task.id);
                                  }
                                }}
                              >
                                <Trash2 className="h-4 w-4" />
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AdminSection>
          </TabsContent>

          <TabsContent value="users" className="space-y-6">
            <AdminUsersPointsTab />
          </TabsContent>
        </Tabs>
      )}

      {/* Task Dialog */}
      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingTask ? 'تعديل المهمة' : 'إضافة مهمة جديدة'}</DialogTitle>
            <DialogDescription>
              {editingTask ? 'قم بتعديل تفاصيل المهمة' : 'أدخل تفاصيل المهمة الجديدة'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="admin-form-group">
              <Label>مفتاح المهمة</Label>
              <Input
                value={taskKey}
                onChange={(e) => setTaskKey(e.target.value)}
                placeholder="daily_login"
              />
            </div>
            <div className="admin-form-group">
              <Label>العنوان</Label>
              <Input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                placeholder="تسجيل الدخول اليومي"
              />
            </div>
            <div className="admin-form-group">
              <Label>الوصف</Label>
              <Input
                value={descriptionAr}
                onChange={(e) => setDescriptionAr(e.target.value)}
                placeholder="سجل دخولك يومياً لكسب النقاط"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div className="admin-form-group">
                <Label>النقاط</Label>
                <Input
                  type="number"
                  value={pointsReward}
                  onChange={(e) => setPointsReward(e.target.value)}
                  placeholder="5"
                />
              </div>
              <div className="admin-form-group">
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
            <div className="flex items-center justify-between">
              <Label>مفعّل</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={handleCloseDialog}>إلغاء</Button>
            <Button onClick={handleSaveTask} disabled={saveTask.isPending}>
              {saveTask.isPending ? 'جاري الحفظ...' : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
