import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Award } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import AdminLayout, { AdminSection, AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';

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

  if (isLoading) {
    return <AdminLoading />;
  }

  return (
    <AdminLayout
      title="إدارة مستويات الولاء"
      description="إدارة المستويات والمزايا الخاصة بكل مستوى"
      icon={<Award className="h-5 w-5" />}
      actions={
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="admin-btn-primary" onClick={resetForm}>
              <Plus className="ml-2 h-4 w-4" />
              إضافة مستوى جديد
            </Button>
          </DialogTrigger>
          <DialogContent className="admin-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>{editingLevel ? "تعديل المستوى" : "إضافة مستوى جديد"}</DialogTitle>
            </DialogHeader>

            <div className="space-y-4">
              <div className="admin-form-group">
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

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <Label>الاسم بالعربي</Label>
                  <Input
                    value={formData.name_ar}
                    onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                  />
                </div>
                <div className="admin-form-group">
                  <Label>الاسم بالإنجليزي</Label>
                  <Input
                    value={formData.name_en}
                    onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                  />
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <Label>الحد الأدنى من النقاط</Label>
                  <Input
                    type="number"
                    value={formData.min_points}
                    onChange={(e) => setFormData({ ...formData, min_points: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="admin-form-group">
                  <Label>اللون</Label>
                  <div className="flex gap-2">
                    <Input
                      type="color"
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="w-16 h-10"
                    />
                    <Input
                      value={formData.color}
                      onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                      className="flex-1"
                    />
                  </div>
                </div>
              </div>

              <div className="admin-form-row">
                <div className="admin-form-group">
                  <Label>نسبة الخصم (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={formData.discount_percentage}
                    onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                  />
                </div>
                <div className="admin-form-group">
                  <Label>نسبة النقاط الإضافية (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    value={formData.bonus_points_percentage}
                    onChange={(e) => setFormData({ ...formData, bonus_points_percentage: parseFloat(e.target.value) })}
                  />
                </div>
              </div>

              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <Switch
                  checked={formData.free_shipping}
                  onCheckedChange={(checked) => setFormData({ ...formData, free_shipping: checked })}
                />
                <Label>شحن مجاني</Label>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <Label>المزايا</Label>
                  <Button size="sm" variant="outline" onClick={handleAddBenefit}>
                    <Plus className="ml-2 h-3 w-3" />
                    إضافة ميزة
                  </Button>
                </div>

                <div className="space-y-3">
                  {benefits.map((benefit, index) => (
                    <div key={index} className="admin-card p-3">
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
                          className="shrink-0 text-destructive hover:text-destructive"
                          onClick={() => handleRemoveBenefit(index)}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-4 border-t">
                <Button variant="outline" onClick={() => setDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button 
                  className="admin-btn-primary"
                  onClick={() => saveMutation.mutate()} 
                  disabled={saveMutation.isPending}
                >
                  {saveMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      }
    >
      <AdminSection>
        <AdminCard hover={false}>
          <AdminCardContent noPadding>
            {!levels || levels.length === 0 ? (
              <AdminEmptyState
                icon={<Award className="h-12 w-12" />}
                title="لا توجد مستويات"
                description="قم بإضافة مستوى جديد لبرنامج الولاء"
              />
            ) : (
              <div className="admin-table-container">
                <Table>
                  <TableHeader>
                    <TableRow className="admin-table-header">
                      <TableHead>المستوى</TableHead>
                      <TableHead>الحد الأدنى من النقاط</TableHead>
                      <TableHead>الخصم</TableHead>
                      <TableHead>النقاط الإضافية</TableHead>
                      <TableHead>شحن مجاني</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {levels.map((level) => (
                      <TableRow key={level.id} className="admin-table-row">
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div
                              className="w-4 h-4 rounded-full"
                              style={{ backgroundColor: level.color }}
                            />
                            <span className="font-medium">{level.name_ar}</span>
                          </div>
                        </TableCell>
                        <TableCell>{level.min_points.toLocaleString()}</TableCell>
                        <TableCell>{level.discount_percentage}%</TableCell>
                        <TableCell>{level.bonus_points_percentage}%</TableCell>
                        <TableCell>
                          <span className={level.free_shipping ? 'admin-badge-success' : 'admin-badge'}>
                            {level.free_shipping ? 'نعم' : 'لا'}
                          </span>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => handleEdit(level)}
                            >
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8 text-destructive hover:text-destructive"
                              onClick={() => {
                                if (confirm("هل أنت متأكد من حذف هذا المستوى؟")) {
                                  deleteMutation.mutate(level.id);
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
          </AdminCardContent>
        </AdminCard>
      </AdminSection>
    </AdminLayout>
  );
}
