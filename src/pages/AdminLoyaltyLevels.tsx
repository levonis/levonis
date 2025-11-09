import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Settings, Save, Plus, Pencil, Trash2, Award } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";

export default function AdminLoyaltyLevels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any>(null);
  const [formData, setFormData] = useState({
    level_key: "",
    name_ar: "",
    name_en: "",
    min_points: 0,
    color: "#000000",
    discount_percentage: 0,
    bonus_points_percentage: 0,
    free_shipping: false,
  });
  const [benefits, setBenefits] = useState<Array<{ text_ar: string; text_en: string }>>([]);

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

  const { data: levels, isLoading } = useQuery({
    queryKey: ["loyaltyLevels"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("loyalty_levels")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      // حساب display_order التلقائي
      let displayOrder = 1;
      if (!editingLevel && levels) {
        displayOrder = levels.length + 1;
      } else if (editingLevel) {
        displayOrder = editingLevel.display_order;
      }

      const levelData = {
        ...formData,
        benefits,
        display_order: displayOrder,
      };

      if (editingLevel) {
        const { error } = await supabase
          .from("loyalty_levels")
          .update(levelData)
          .eq("id", editingLevel.id);

        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("loyalty_levels")
          .insert([levelData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyaltyLevels"] });
      toast.success(editingLevel ? "تم تحديث المستوى بنجاح" : "تم إضافة المستوى بنجاح");
      setDialogOpen(false);
      resetForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("loyalty_levels")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["loyaltyLevels"] });
      toast.success("تم حذف المستوى بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const resetForm = () => {
    setFormData({
      level_key: "",
      name_ar: "",
      name_en: "",
      min_points: 0,
      color: "#000000",
      discount_percentage: 0,
      bonus_points_percentage: 0,
      free_shipping: false,
    });
    setBenefits([]);
    setEditingLevel(null);
  };

  const handleEdit = (level: any) => {
    setEditingLevel(level);
    setFormData({
      level_key: level.level_key,
      name_ar: level.name_ar,
      name_en: level.name_en,
      min_points: level.min_points,
      color: level.color,
      discount_percentage: level.discount_percentage || 0,
      bonus_points_percentage: level.bonus_points_percentage || 0,
      free_shipping: level.free_shipping || false,
    });
    setBenefits(level.benefits || []);
    setDialogOpen(true);
  };

  const handleAddBenefit = () => {
    setBenefits([...benefits, { text_ar: "", text_en: "" }]);
  };

  const handleRemoveBenefit = (index: number) => {
    setBenefits(benefits.filter((_, i) => i !== index));
  };

  const handleBenefitChange = (index: number, field: "text_ar" | "text_en", value: string) => {
    const newBenefits = [...benefits];
    newBenefits[index][field] = value;
    setBenefits(newBenefits);
  };

  if (!user) return null;

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold mb-2 flex items-center gap-2">
              <Award className="h-8 w-8" />
              إدارة مستويات الولاء
            </h1>
            <p className="text-muted-foreground">إدارة المستويات والمزايا الخاصة بكل مستوى</p>
          </div>

          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button onClick={resetForm}>
                <Plus className="ml-2 h-4 w-4" />
                إضافة مستوى جديد
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
              <DialogHeader>
                <DialogTitle>{editingLevel ? "تعديل المستوى" : "إضافة مستوى جديد"}</DialogTitle>
              </DialogHeader>

              <div className="space-y-4">
                <div>
                  <Label>مفتاح المستوى (بالإنجليزي، بدون مسافات)</Label>
                  <Input
                    value={formData.level_key}
                    onChange={(e) => setFormData({ ...formData, level_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                    placeholder="مثال: vip, premium"
                    disabled={!!editingLevel}
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    لا يمكن تغيير المفتاح بعد الإنشاء
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الاسم بالعربي</Label>
                    <Input
                      value={formData.name_ar}
                      onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>الاسم بالإنجليزي</Label>
                    <Input
                      value={formData.name_en}
                      onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>الحد الأدنى من النقاط</Label>
                    <Input
                      type="number"
                      value={formData.min_points}
                      onChange={(e) => setFormData({ ...formData, min_points: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>اللون</Label>
                    <div className="flex gap-2">
                      <Input
                        type="color"
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                        className="w-20"
                      />
                      <Input
                        value={formData.color}
                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <Label>نسبة الخصم (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      value={formData.discount_percentage}
                      onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                    />
                  </div>
                  <div>
                    <Label>نسبة النقاط الإضافية (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      value={formData.bonus_points_percentage}
                      onChange={(e) => setFormData({ ...formData, bonus_points_percentage: parseFloat(e.target.value) })}
                    />
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Switch
                    checked={formData.free_shipping}
                    onCheckedChange={(checked) => setFormData({ ...formData, free_shipping: checked })}
                  />
                  <Label>شحن مجاني</Label>
                </div>

                <div>
                  <div className="flex items-center justify-between mb-2">
                    <Label>المزايا</Label>
                    <Button size="sm" variant="outline" onClick={handleAddBenefit}>
                      <Plus className="ml-2 h-3 w-3" />
                      إضافة ميزة
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {benefits.map((benefit, index) => (
                      <Card key={index}>
                        <CardContent className="pt-4">
                          <div className="flex gap-2">
                            <div className="flex-1 space-y-2">
                              <Input
                                placeholder="النص بالعربي"
                                value={benefit.text_ar}
                                onChange={(e) => handleBenefitChange(index, "text_ar", e.target.value)}
                              />
                              <Input
                                placeholder="النص بالإنجليزي"
                                value={benefit.text_en}
                                onChange={(e) => handleBenefitChange(index, "text_en", e.target.value)}
                              />
                            </div>
                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => handleRemoveBenefit(index)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </CardContent>
                      </Card>
                    ))}
                  </div>
                </div>

                <div className="flex justify-end gap-2">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button onClick={() => saveMutation.mutate()} disabled={saveMutation.isPending}>
                    {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="text-center py-12">جاري التحميل...</div>
        ) : (
          <Card>
            <CardHeader>
              <CardTitle>المستويات الحالية</CardTitle>
              <CardDescription>قائمة جميع مستويات الولاء المتاحة</CardDescription>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستوى</TableHead>
                    <TableHead>الحد الأدنى من النقاط</TableHead>
                    <TableHead>الخصم</TableHead>
                    <TableHead>النقاط الإضافية</TableHead>
                    <TableHead>شحن مجاني</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {levels && levels.length > 0 ? (
                    levels.map((level) => (
                      <TableRow key={level.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: level.color }}
                            />
                            <span className="font-medium">{level.name_ar}</span>
                          </div>
                        </TableCell>
                        <TableCell>{level.min_points}</TableCell>
                        <TableCell>{level.discount_percentage}%</TableCell>
                        <TableCell>{level.bonus_points_percentage}%</TableCell>
                        <TableCell>
                          {level.free_shipping ? (
                            <Badge variant="default">نعم</Badge>
                          ) : (
                            <Badge variant="secondary">لا</Badge>
                          )}
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => handleEdit(level)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="ghost"
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا المستوى؟")) {
                                  deleteMutation.mutate(level.id);
                                }
                              }}
                            >
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))
                  ) : (
                    <TableRow>
                      <TableCell colSpan={6} className="text-center py-8 text-muted-foreground">
                        لا توجد مستويات بعد
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}