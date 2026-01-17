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
import { Plus, Pencil, Trash2, CreditCard, Users, Gift, Settings, Tag } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import AdminLayout, { AdminSection, AdminCard, AdminCardContent, AdminCardHeader, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';

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
    free_shipping_min_order: 0,
    is_purchasable: false,
    purchase_price_points: 0,
    duration_days: 30,
    card_discounts_enabled: false,
  });
  const [benefits, setBenefits] = useState<Array<{ text_ar: string; text_en: string }>>([]);

  // Offer dialog state
  const [offerDialogOpen, setOfferDialogOpen] = useState(false);
  const [editingOffer, setEditingOffer] = useState<any>(null);
  const [offerData, setOfferData] = useState({
    title_ar: "",
    description_ar: "",
    min_card_level_id: "",
    offer_type: "discount",
    offer_value: 0,
    is_active: true,
  });

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

  const { data: cardHolders } = useQuery({
    queryKey: ["cardHolders"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_cards")
        .select(`
          *,
          profiles:user_id(full_name, username, email),
          loyalty_levels:level_id(name_ar, color)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  const { data: exclusiveOffers } = useQuery({
    queryKey: ["cardExclusiveOffers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_exclusive_offers")
        .select(`
          *,
          loyalty_levels:min_card_level_id(name_ar, color)
        `)
        .order("created_at", { ascending: false });

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
      toast.success(editingLevel ? "تم تحديث البطاقة بنجاح" : "تم إضافة البطاقة بنجاح");
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
      toast.success("تم حذف البطاقة بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const saveOfferMutation = useMutation({
    mutationFn: async () => {
      const data = {
        ...offerData,
        min_card_level_id: offerData.min_card_level_id || null,
      };

      if (editingOffer) {
        const { error } = await supabase
          .from("card_exclusive_offers")
          .update(data)
          .eq("id", editingOffer.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("card_exclusive_offers")
          .insert([data]);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cardExclusiveOffers"] });
      toast.success(editingOffer ? "تم تحديث العرض" : "تم إضافة العرض");
      setOfferDialogOpen(false);
      resetOfferForm();
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ");
    },
  });

  const deleteOfferMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("card_exclusive_offers")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cardExclusiveOffers"] });
      toast.success("تم حذف العرض");
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
      free_shipping_min_order: 0,
      is_purchasable: false,
      purchase_price_points: 0,
      duration_days: 30,
      card_discounts_enabled: false,
    });
    setBenefits([]);
    setEditingLevel(null);
  };

  const resetOfferForm = () => {
    setOfferData({
      title_ar: "",
      description_ar: "",
      min_card_level_id: "",
      offer_type: "discount",
      offer_value: 0,
      is_active: true,
    });
    setEditingOffer(null);
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
      free_shipping_min_order: level.free_shipping_min_order || 0,
      is_purchasable: level.is_purchasable || false,
      purchase_price_points: level.purchase_price_points || 0,
      duration_days: level.duration_days || 30,
      card_discounts_enabled: level.card_discounts_enabled || false,
    });
    setBenefits(level.benefits || []);
    setDialogOpen(true);
  };

  const handleEditOffer = (offer: any) => {
    setEditingOffer(offer);
    setOfferData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || "",
      min_card_level_id: offer.min_card_level_id || "",
      offer_type: offer.offer_type || "discount",
      offer_value: offer.offer_value || 0,
      is_active: offer.is_active,
    });
    setOfferDialogOpen(true);
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
      title="إدارة البطاقات"
      description="إدارة البطاقات والمزايا والعروض الحصرية"
      icon={<CreditCard className="h-5 w-5" />}
    >
      <Tabs defaultValue="cards" className="space-y-6">
        <TabsList className="admin-tabs">
          <TabsTrigger value="cards" className="admin-tab flex items-center gap-2">
            <CreditCard className="h-4 w-4" />
            البطاقات
          </TabsTrigger>
          <TabsTrigger value="holders" className="admin-tab flex items-center gap-2">
            <Users className="h-4 w-4" />
            المشتركين
          </TabsTrigger>
          <TabsTrigger value="offers" className="admin-tab flex items-center gap-2">
            <Gift className="h-4 w-4" />
            العروض الحصرية
          </TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="admin-btn-primary" onClick={resetForm}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة بطاقة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="admin-dialog max-w-2xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                  <DialogTitle>{editingLevel ? "تعديل البطاقة" : "إضافة بطاقة جديدة"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="admin-form-group">
                    <Label>مفتاح البطاقة (بالإنجليزي، بدون مسافات)</Label>
                    <Input
                      value={formData.level_key}
                      onChange={(e) => setFormData({ ...formData, level_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                      placeholder="مثال: gold, platinum"
                      disabled={!!editingLevel}
                    />
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
                    <div className="admin-form-group">
                      <Label>مدة الصلاحية (أيام)</Label>
                      <Input
                        type="number"
                        value={formData.duration_days}
                        onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                      />
                    </div>
                  </div>

                  {/* Purchase Settings */}
                  <AdminCard>
                    <AdminCardHeader title="إعدادات الشراء" icon={<Tag className="h-4 w-4" />} />
                    <AdminCardContent>
                      <div className="space-y-4">
                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Switch
                            checked={formData.is_purchasable}
                            onCheckedChange={(checked) => setFormData({ ...formData, is_purchasable: checked })}
                          />
                          <Label>قابلة للشراء بالنقاط</Label>
                        </div>

                        {formData.is_purchasable && (
                          <div className="admin-form-group">
                            <Label>سعر البطاقة (نقاط)</Label>
                            <Input
                              type="number"
                              value={formData.purchase_price_points}
                              onChange={(e) => setFormData({ ...formData, purchase_price_points: parseInt(e.target.value) })}
                            />
                          </div>
                        )}

                        {!formData.is_purchasable && (
                          <div className="admin-form-group">
                            <Label>الحد الأدنى من النقاط للحصول عليها تلقائياً</Label>
                            <Input
                              type="number"
                              value={formData.min_points}
                              onChange={(e) => setFormData({ ...formData, min_points: parseFloat(e.target.value) })}
                            />
                          </div>
                        )}
                      </div>
                    </AdminCardContent>
                  </AdminCard>

                  {/* Benefits Settings */}
                  <AdminCard>
                    <AdminCardHeader title="المميزات" icon={<Gift className="h-4 w-4" />} />
                    <AdminCardContent>
                      <div className="space-y-4">
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

                        {formData.free_shipping && (
                          <div className="admin-form-group">
                            <Label>الحد الأدنى للطلب للشحن المجاني (دينار)</Label>
                            <Input
                              type="number"
                              value={formData.free_shipping_min_order}
                              onChange={(e) => setFormData({ ...formData, free_shipping_min_order: parseFloat(e.target.value) })}
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                          <Switch
                            checked={formData.card_discounts_enabled}
                            onCheckedChange={(checked) => setFormData({ ...formData, card_discounts_enabled: checked })}
                          />
                          <Label>تفعيل خصومات المنتجات الخاصة</Label>
                        </div>
                      </div>
                    </AdminCardContent>
                  </AdminCard>

                  {/* Custom Benefits */}
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <Label>مزايا إضافية</Label>
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
          </div>

          <AdminCard hover={false}>
            <AdminCardContent noPadding>
              {!levels || levels.length === 0 ? (
                <AdminEmptyState
                  icon={<CreditCard className="h-12 w-12" />}
                  title="لا توجد بطاقات"
                  description="قم بإضافة بطاقة جديدة لبرنامج المكافآت"
                />
              ) : (
                <div className="admin-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow className="admin-table-header">
                        <TableHead>البطاقة</TableHead>
                        <TableHead>نوع الحصول</TableHead>
                        <TableHead>المدة</TableHead>
                        <TableHead>الخصم</TableHead>
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
                          <TableCell>
                            {level.is_purchasable ? (
                              <Badge variant="secondary">
                                شراء: {level.purchase_price_points?.toLocaleString()} نقطة
                              </Badge>
                            ) : (
                              <Badge variant="outline">
                                تلقائي: {level.min_points?.toLocaleString()} نقطة
                              </Badge>
                            )}
                          </TableCell>
                          <TableCell>{level.duration_days || 30} يوم</TableCell>
                          <TableCell>{level.discount_percentage}%</TableCell>
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
                                  if (confirm("هل أنت متأكد من حذف هذه البطاقة؟")) {
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
        </TabsContent>

        {/* Card Holders Tab */}
        <TabsContent value="holders" className="space-y-4">
          <AdminCard hover={false}>
            <AdminCardHeader title="المشتركين في البطاقات" description="عرض جميع المستخدمين الذين يحملون بطاقات نشطة" />
            <AdminCardContent noPadding>
              {!cardHolders || cardHolders.length === 0 ? (
                <AdminEmptyState
                  icon={<Users className="h-12 w-12" />}
                  title="لا يوجد مشتركين"
                  description="لم يشترك أي مستخدم في البطاقات بعد"
                />
              ) : (
                <div className="admin-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow className="admin-table-header">
                        <TableHead>المستخدم</TableHead>
                        <TableHead>البطاقة</TableHead>
                        <TableHead>تاريخ الشراء</TableHead>
                        <TableHead>تاريخ الانتهاء</TableHead>
                        <TableHead>الأيام المتبقية</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {cardHolders.map((holder: any) => {
                        const daysLeft = Math.max(0, Math.ceil((new Date(holder.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24)));
                        return (
                          <TableRow key={holder.id} className="admin-table-row">
                            <TableCell>
                              <div>
                                <p className="font-medium">{holder.profiles?.full_name || holder.profiles?.username || 'غير معروف'}</p>
                                <p className="text-xs text-muted-foreground">{holder.profiles?.email}</p>
                              </div>
                            </TableCell>
                            <TableCell>
                              <Badge style={{ backgroundColor: holder.loyalty_levels?.color }}>
                                {holder.loyalty_levels?.name_ar}
                              </Badge>
                            </TableCell>
                            <TableCell>{new Date(holder.purchased_at).toLocaleDateString('ar-IQ')}</TableCell>
                            <TableCell>{new Date(holder.expires_at).toLocaleDateString('ar-IQ')}</TableCell>
                            <TableCell>
                              <Badge variant={daysLeft < 7 ? 'destructive' : 'secondary'}>
                                {daysLeft} يوم
                              </Badge>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </div>
              )}
            </AdminCardContent>
          </AdminCard>
        </TabsContent>

        {/* Exclusive Offers Tab */}
        <TabsContent value="offers" className="space-y-4">
          <div className="flex justify-end">
            <Dialog open={offerDialogOpen} onOpenChange={setOfferDialogOpen}>
              <DialogTrigger asChild>
                <Button className="admin-btn-primary" onClick={resetOfferForm}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة عرض حصري
                </Button>
              </DialogTrigger>
              <DialogContent className="admin-dialog max-w-lg">
                <DialogHeader>
                  <DialogTitle>{editingOffer ? "تعديل العرض" : "إضافة عرض حصري"}</DialogTitle>
                </DialogHeader>

                <div className="space-y-4">
                  <div className="admin-form-group">
                    <Label>عنوان العرض</Label>
                    <Input
                      value={offerData.title_ar}
                      onChange={(e) => setOfferData({ ...offerData, title_ar: e.target.value })}
                    />
                  </div>

                  <div className="admin-form-group">
                    <Label>الوصف</Label>
                    <Textarea
                      value={offerData.description_ar}
                      onChange={(e) => setOfferData({ ...offerData, description_ar: e.target.value })}
                    />
                  </div>

                  <div className="admin-form-group">
                    <Label>الحد الأدنى للبطاقة</Label>
                    <Select 
                      value={offerData.min_card_level_id} 
                      onValueChange={(v) => setOfferData({ ...offerData, min_card_level_id: v })}
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="اختر البطاقة" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="">جميع البطاقات</SelectItem>
                        {levels?.map((level) => (
                          <SelectItem key={level.id} value={level.id}>{level.name_ar}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="admin-form-row">
                    <div className="admin-form-group">
                      <Label>نوع العرض</Label>
                      <Select 
                        value={offerData.offer_type} 
                        onValueChange={(v) => setOfferData({ ...offerData, offer_type: v })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="discount">خصم نسبة</SelectItem>
                          <SelectItem value="fixed">خصم ثابت</SelectItem>
                          <SelectItem value="free_product">منتج مجاني</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="admin-form-group">
                      <Label>القيمة</Label>
                      <Input
                        type="number"
                        value={offerData.offer_value}
                        onChange={(e) => setOfferData({ ...offerData, offer_value: parseFloat(e.target.value) })}
                      />
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <Switch
                      checked={offerData.is_active}
                      onCheckedChange={(checked) => setOfferData({ ...offerData, is_active: checked })}
                    />
                    <Label>العرض مفعّل</Label>
                  </div>

                  <div className="flex justify-end gap-2 pt-4 border-t">
                    <Button variant="outline" onClick={() => setOfferDialogOpen(false)}>
                      إلغاء
                    </Button>
                    <Button 
                      className="admin-btn-primary"
                      onClick={() => saveOfferMutation.mutate()} 
                      disabled={saveOfferMutation.isPending}
                    >
                      {saveOfferMutation.isPending ? "جاري الحفظ..." : "حفظ"}
                    </Button>
                  </div>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          <AdminCard hover={false}>
            <AdminCardContent noPadding>
              {!exclusiveOffers || exclusiveOffers.length === 0 ? (
                <AdminEmptyState
                  icon={<Gift className="h-12 w-12" />}
                  title="لا توجد عروض"
                  description="قم بإضافة عروض حصرية لحاملي البطاقات"
                />
              ) : (
                <div className="admin-table-container">
                  <Table>
                    <TableHeader>
                      <TableRow className="admin-table-header">
                        <TableHead>العرض</TableHead>
                        <TableHead>الحد الأدنى للبطاقة</TableHead>
                        <TableHead>النوع</TableHead>
                        <TableHead>القيمة</TableHead>
                        <TableHead>الحالة</TableHead>
                        <TableHead>الإجراءات</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {exclusiveOffers.map((offer: any) => (
                        <TableRow key={offer.id} className="admin-table-row">
                          <TableCell>
                            <p className="font-medium">{offer.title_ar}</p>
                            <p className="text-xs text-muted-foreground line-clamp-1">{offer.description_ar}</p>
                          </TableCell>
                          <TableCell>
                            {offer.loyalty_levels ? (
                              <Badge style={{ backgroundColor: offer.loyalty_levels.color }}>
                                {offer.loyalty_levels.name_ar}
                              </Badge>
                            ) : (
                              <Badge variant="outline">جميع البطاقات</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            {offer.offer_type === 'discount' && 'خصم نسبة'}
                            {offer.offer_type === 'fixed' && 'خصم ثابت'}
                            {offer.offer_type === 'free_product' && 'منتج مجاني'}
                          </TableCell>
                          <TableCell>
                            {offer.offer_type === 'discount' ? `${offer.offer_value}%` : offer.offer_value?.toLocaleString()}
                          </TableCell>
                          <TableCell>
                            <Badge variant={offer.is_active ? 'default' : 'secondary'}>
                              {offer.is_active ? 'مفعّل' : 'معطّل'}
                            </Badge>
                          </TableCell>
                          <TableCell>
                            <div className="flex gap-1">
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8"
                                onClick={() => handleEditOffer(offer)}
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-8 w-8 text-destructive hover:text-destructive"
                                onClick={() => {
                                  if (confirm("هل أنت متأكد من حذف هذا العرض؟")) {
                                    deleteOfferMutation.mutate(offer.id);
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
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}