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
import { toast } from "sonner";
import { CheckSquare, Edit, Trash2, Plus } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function AdminDailyTasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
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

  // جلب المهام
  const { data: tasks, isLoading } = useQuery({
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

  const handleSave = () => {
    if (!taskKey || !titleAr || !descriptionAr) {
      toast.error("الرجاء ملء جميع الحقول المطلوبة");
      return;
    }
    saveTask.mutate();
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Header />

      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <CheckSquare className="h-8 w-8" />
              إدارة المهام اليومية
            </h1>
            <p className="text-muted-foreground">إدارة المهام والتحديات للمستخدمين</p>
          </div>
          <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={() => handleOpenDialog()}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة مهمة جديدة
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
                  <Label htmlFor="taskKey">مفتاح المهمة (بالإنجليزية)</Label>
                  <Input
                    id="taskKey"
                    value={taskKey}
                    onChange={(e) => setTaskKey(e.target.value)}
                    placeholder="daily_login"
                    disabled={!!editingTask}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="titleAr">العنوان</Label>
                  <Input
                    id="titleAr"
                    value={titleAr}
                    onChange={(e) => setTitleAr(e.target.value)}
                    placeholder="تسجيل الدخول اليومي"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="descriptionAr">الوصف</Label>
                  <Input
                    id="descriptionAr"
                    value={descriptionAr}
                    onChange={(e) => setDescriptionAr(e.target.value)}
                    placeholder="سجل دخولك كل يوم..."
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="icon">الأيقونة</Label>
                    <Select value={icon} onValueChange={setIcon}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="LogIn">LogIn</SelectItem>
                        <SelectItem value="Share2">Share2</SelectItem>
                        <SelectItem value="UserPlus">UserPlus</SelectItem>
                        <SelectItem value="Gift">Gift</SelectItem>
                        <SelectItem value="Coins">Coins</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="pointsReward">النقاط</Label>
                    <Input
                      id="pointsReward"
                      type="number"
                      value={pointsReward}
                      onChange={(e) => setPointsReward(e.target.value)}
                    />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="taskType">نوع المهمة</Label>
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
                    <Label htmlFor="displayOrder">الترتيب</Label>
                    <Input
                      id="displayOrder"
                      type="number"
                      value={displayOrder}
                      onChange={(e) => setDisplayOrder(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex items-center space-x-2 space-x-reverse">
                  <Switch
                    id="isActive"
                    checked={isActive}
                    onCheckedChange={setIsActive}
                  />
                  <Label htmlFor="isActive">مفعلة</Label>
                </div>
              </div>
              <DialogFooter>
                <Button variant="outline" onClick={handleCloseDialog}>
                  إلغاء
                </Button>
                <Button onClick={handleSave} disabled={saveTask.isPending}>
                  {saveTask.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>قائمة المهام</CardTitle>
              <CardDescription>إدارة جميع المهام اليومية والأسبوعية</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>العنوان</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>النقاط</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>الترتيب</TableHead>
                    <TableHead className="text-left">الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {tasks && tasks.length > 0 ? (
                    tasks.map((task) => (
                      <TableRow key={task.id}>
                        <TableCell className="font-medium">
                          <div>
                            <p>{task.title_ar}</p>
                            <p className="text-sm text-muted-foreground">
                              {task.description_ar}
                            </p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline">
                            {task.task_type === "daily"
                              ? "يومي"
                              : task.task_type === "weekly"
                              ? "أسبوعي"
                              : "مرة واحدة"}
                          </Badge>
                        </TableCell>
                        <TableCell>{task.points_reward} نقطة</TableCell>
                        <TableCell>
                          {task.is_active ? (
                            <Badge variant="default">مفعلة</Badge>
                          ) : (
                            <Badge variant="secondary">معطلة</Badge>
                          )}
                        </TableCell>
                        <TableCell>{task.display_order}</TableCell>
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
                      <TableCell colSpan={6} className="text-center py-8">
                        لا توجد مهام
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
}
