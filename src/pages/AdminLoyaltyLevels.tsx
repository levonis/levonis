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
import { Plus, Pencil, Trash2, CreditCard, Users, Gift, Settings, Tag, Eye, Palette, Clock, Percent, Zap, Truck, Crown, Sparkles, User, Headphones } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminLayout, { AdminSection, AdminCard, AdminCardContent, AdminCardHeader, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import LoyaltyCardPreview from "@/components/admin/LoyaltyCardPreview";

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
    color: "#FFD700",
    discount_percentage: 0,
    bonus_points_percentage: 0,
    free_shipping: false,
    free_shipping_min_order: 0,
    is_purchasable: true,
    purchase_price_points: 0,
    duration_days: 30,
    card_discounts_enabled: false,
    icon: "crown",
    // New features
    vip_support: false,
    priority_shipping: false,
    early_access: false,
    exclusive_products: false,
    monthly_free_shipping: 0,
    wallet_price: null as number | null,
    is_vip_plus: false,
    wholesale_discount_enabled: false,
    free_daily_games: 0,
    investment_enabled: false,
    priority_packaging: false,
    priority_support: false,
    special_name_style: { enabled: false, color: null as string | null, glow: false, badge_icon: null as string | null },
    profile_effects: { enabled: false, border_color: null as string | null, background_glow: false, avatar_frame: null as string | null },
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

  const { data: stats } = useQuery({
    queryKey: ["loyaltyStats"],
    queryFn: async () => {
      const [cardsRes, holdersRes] = await Promise.all([
        supabase.from("loyalty_levels").select("id", { count: "exact" }),
        supabase.from("user_cards").select("id", { count: "exact" }).eq("is_active", true),
      ]);
      return {
        totalCards: cardsRes.count || 0,
        activeHolders: holdersRes.count || 0,
      };
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
      queryClient.invalidateQueries({ queryKey: ["loyaltyStats"] });
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
      queryClient.invalidateQueries({ queryKey: ["loyaltyStats"] });
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
      color: "#FFD700",
      discount_percentage: 0,
      bonus_points_percentage: 0,
      free_shipping: false,
      free_shipping_min_order: 0,
      is_purchasable: true,
      purchase_price_points: 0,
      duration_days: 30,
      card_discounts_enabled: false,
      icon: "crown",
      vip_support: false,
      priority_shipping: false,
      early_access: false,
      exclusive_products: false,
      monthly_free_shipping: 0,
      wallet_price: null,
      is_vip_plus: false,
      wholesale_discount_enabled: false,
      free_daily_games: 0,
      investment_enabled: false,
      priority_packaging: false,
      priority_support: false,
      special_name_style: { enabled: false, color: null, glow: false, badge_icon: null },
      profile_effects: { enabled: false, border_color: null, background_glow: false, avatar_frame: null },
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
      is_purchasable: level.is_purchasable ?? true,
      purchase_price_points: level.purchase_price_points || 0,
      duration_days: level.duration_days || 30,
      card_discounts_enabled: level.card_discounts_enabled || false,
      icon: level.icon || "crown",
      vip_support: level.vip_support || false,
      priority_shipping: level.priority_shipping || false,
      early_access: level.early_access || false,
      exclusive_products: level.exclusive_products || false,
      monthly_free_shipping: level.monthly_free_shipping || 0,
      wallet_price: level.wallet_price || null,
      is_vip_plus: level.is_vip_plus || false,
      wholesale_discount_enabled: level.wholesale_discount_enabled || false,
      free_daily_games: level.free_daily_games || 0,
      investment_enabled: level.investment_enabled || false,
      priority_packaging: level.priority_packaging || false,
      priority_support: level.priority_support || false,
      special_name_style: level.special_name_style || { enabled: false, color: null, glow: false, badge_icon: null },
      profile_effects: level.profile_effects || { enabled: false, border_color: null, background_glow: false, avatar_frame: null },
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

  const COLOR_PRESETS = [
    { name: "ذهبي", color: "#FFD700" },
    { name: "بلاتيني", color: "#E5E4E2" },
    { name: "فضي", color: "#C0C0C0" },
    { name: "برونزي", color: "#CD7F32" },
    { name: "الماسي", color: "#B9F2FF" },
    { name: "ياقوتي", color: "#E0115F" },
    { name: "زمردي", color: "#50C878" },
    { name: "ملكي", color: "#4169E1" },
  ];

  if (!user) return null;

  if (isLoading) {
    return <AdminLoading />;
  }

  return (
    <AdminLayout
      title="إدارة البطاقات والمكافآت"
      description="إدارة بطاقات الولاء والمزايا والعروض الحصرية"
      icon={<CreditCard className="h-5 w-5" />}
    >
      {/* Stats Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <Card className="bg-gradient-to-br from-amber-500/10 to-yellow-500/5 border-amber-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-amber-500/20">
              <CreditCard className="h-5 w-5 text-amber-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.totalCards || 0}</p>
              <p className="text-xs text-muted-foreground">البطاقات المتاحة</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-green-500/10 to-emerald-500/5 border-green-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-green-500/20">
              <Users className="h-5 w-5 text-green-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{stats?.activeHolders || 0}</p>
              <p className="text-xs text-muted-foreground">مشترك نشط</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-purple-500/10 to-violet-500/5 border-purple-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-purple-500/20">
              <Gift className="h-5 w-5 text-purple-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{exclusiveOffers?.length || 0}</p>
              <p className="text-xs text-muted-foreground">عرض حصري</p>
            </div>
          </CardContent>
        </Card>
        <Card className="bg-gradient-to-br from-blue-500/10 to-cyan-500/5 border-blue-500/20">
          <CardContent className="p-4 flex items-center gap-3">
            <div className="p-3 rounded-xl bg-blue-500/20">
              <Sparkles className="h-5 w-5 text-blue-600" />
            </div>
            <div>
              <p className="text-2xl font-bold">{cardHolders?.length || 0}</p>
              <p className="text-xs text-muted-foreground">بطاقة نشطة</p>
            </div>
          </CardContent>
        </Card>
      </div>

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
          <TabsTrigger value="settings" className="admin-tab flex items-center gap-2">
            <Settings className="h-4 w-4" />
            الإعدادات
          </TabsTrigger>
        </TabsList>

        {/* Cards Tab */}
        <TabsContent value="cards" className="space-y-4">
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              البطاقات المتاحة للمستخدمين للشراء أو الحصول عليها تلقائياً
            </p>
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button className="admin-btn-primary" onClick={resetForm}>
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة بطاقة جديدة
                </Button>
              </DialogTrigger>
              <DialogContent className="admin-dialog max-w-4xl h-[90vh] p-0 flex flex-col">
                <DialogHeader className="px-6 py-4 border-b shrink-0">
                  <DialogTitle>{editingLevel ? "تعديل البطاقة" : "إضافة بطاقة جديدة"}</DialogTitle>
                </DialogHeader>

                <ScrollArea className="flex-1 overflow-y-auto">
                  <div className="px-6 py-4 space-y-6">
                    {/* Card Preview */}
                    <div className="flex justify-center p-6 bg-gradient-to-br from-muted/50 to-muted/30 rounded-xl">
                      <LoyaltyCardPreview
                        name_ar={formData.name_ar || "اسم البطاقة"}
                        name_en={formData.name_en || "Card Name"}
                        color={formData.color}
                        discount_percentage={formData.discount_percentage}
                        bonus_points_percentage={formData.bonus_points_percentage}
                        free_shipping={formData.free_shipping}
                        free_shipping_min_order={formData.free_shipping_min_order}
                        duration_days={formData.duration_days}
                        is_purchasable={formData.is_purchasable}
                        purchase_price_points={formData.purchase_price_points}
                        min_points={formData.min_points}
                        vip_support={formData.vip_support}
                        special_name_style={formData.special_name_style}
                        profile_effects={formData.profile_effects}
                        size="lg"
                      />
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {/* Basic Info */}
                      <AdminCard>
                        <AdminCardHeader title="المعلومات الأساسية" icon={<Tag className="h-4 w-4" />} />
                        <AdminCardContent>
                          <div className="space-y-4">
                            <div className="admin-form-group">
                              <Label>مفتاح البطاقة (بالإنجليزي)</Label>
                              <Input
                                value={formData.level_key}
                                onChange={(e) => setFormData({ ...formData, level_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                placeholder="gold, platinum, diamond"
                                disabled={!!editingLevel}
                              />
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div className="admin-form-group">
                                <Label>الاسم بالعربي</Label>
                                <Input
                                  value={formData.name_ar}
                                  onChange={(e) => setFormData({ ...formData, name_ar: e.target.value })}
                                  placeholder="الذهبية"
                                />
                              </div>
                              <div className="admin-form-group">
                                <Label>الاسم بالإنجليزي</Label>
                                <Input
                                  value={formData.name_en}
                                  onChange={(e) => setFormData({ ...formData, name_en: e.target.value })}
                                  placeholder="Gold"
                                />
                              </div>
                            </div>

                            <div className="admin-form-group">
                              <Label className="flex items-center gap-2">
                                <Palette className="h-4 w-4" />
                                لون البطاقة
                              </Label>
                              <div className="flex gap-2 mb-2 flex-wrap">
                                {COLOR_PRESETS.map((preset) => (
                                  <button
                                    key={preset.name}
                                    type="button"
                                    className={`w-8 h-8 rounded-lg border-2 transition-all ${formData.color === preset.color ? 'border-primary scale-110' : 'border-transparent'}`}
                                    style={{ backgroundColor: preset.color }}
                                    onClick={() => setFormData({ ...formData, color: preset.color })}
                                    title={preset.name}
                                  />
                                ))}
                              </div>
                              <div className="flex gap-2">
                                <Input
                                  type="color"
                                  value={formData.color}
                                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                  className="w-14 h-10 cursor-pointer"
                                />
                                <Input
                                  value={formData.color}
                                  onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                  className="flex-1 font-mono"
                                  placeholder="#FFD700"
                                />
                              </div>
                            </div>

                            <div className="admin-form-group">
                              <Label className="flex items-center gap-2">
                                <Clock className="h-4 w-4" />
                                مدة الصلاحية (أيام)
                              </Label>
                              <Input
                                type="number"
                                value={formData.duration_days}
                                onChange={(e) => setFormData({ ...formData, duration_days: parseInt(e.target.value) })}
                              />
                            </div>
                          </div>
                        </AdminCardContent>
                      </AdminCard>

                      {/* Purchase Settings */}
                      <AdminCard>
                        <AdminCardHeader title="إعدادات الحصول على البطاقة" icon={<CreditCard className="h-4 w-4" />} />
                        <AdminCardContent>
                          <div className="space-y-4">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <Label className="font-medium">قابلة للشراء بالنقاط</Label>
                              <Switch
                                checked={formData.is_purchasable}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_purchasable: checked })}
                              />
                            </div>

                            {formData.is_purchasable ? (
                              <div className="admin-form-group">
                                <Label>سعر البطاقة (نقاط)</Label>
                                <Input
                                  type="number"
                                  value={formData.purchase_price_points}
                                  onChange={(e) => setFormData({ ...formData, purchase_price_points: parseInt(e.target.value) })}
                                  placeholder="1000"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  المستخدم يدفع هذا العدد من النقاط للحصول على البطاقة
                                </p>
                              </div>
                              <div className="admin-form-group">
                                <Label>سعر المحفظة (د.ع) - اختياري</Label>
                                <Input
                                  type="number"
                                  value={formData.wallet_price || ''}
                                  onChange={(e) => setFormData({ ...formData, wallet_price: e.target.value ? parseInt(e.target.value) : null })}
                                  placeholder="مثلاً 50000"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  سعر الشراء بالمحفظة (اتركه فارغاً لتعطيل الشراء بالمحفظة)
                                </p>
                              </div>
                            ) : (
                              <div className="admin-form-group">
                                <Label>الحد الأدنى من النقاط (تلقائي)</Label>
                                <Input
                                  type="number"
                                  value={formData.min_points}
                                  onChange={(e) => setFormData({ ...formData, min_points: parseFloat(e.target.value) })}
                                  placeholder="5000"
                                />
                                <p className="text-xs text-muted-foreground mt-1">
                                  عند وصول المستخدم لهذا العدد يحصل على البطاقة تلقائياً
                                </p>
                              </div>
                            )}
                          </div>
                        </AdminCardContent>
                      </AdminCard>
                    </div>

                    {/* Benefits Settings */}
                    <AdminCard>
                      <AdminCardHeader title="المميزات والخصومات" icon={<Gift className="h-4 w-4" />} />
                      <AdminCardContent>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                          <div className="admin-form-group">
                            <Label className="flex items-center gap-2">
                              <Percent className="h-4 w-4" />
                              نسبة الخصم (%)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              max="100"
                              value={formData.discount_percentage}
                              onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              يظهر للمستخدمين غير الحاملين: "خصم X% مع بطاقة {formData.name_ar}"
                            </p>
                          </div>
                          <div className="admin-form-group">
                            <Label className="flex items-center gap-2">
                              <Zap className="h-4 w-4" />
                              نسبة النقاط الإضافية (%)
                            </Label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.bonus_points_percentage}
                              onChange={(e) => setFormData({ ...formData, bonus_points_percentage: parseFloat(e.target.value) })}
                            />
                          </div>
                          <div className="admin-form-group">
                            <Label className="flex items-center gap-2">
                              <Truck className="h-4 w-4" />
                              الحد الأدنى للشحن المجاني (د.ع)
                            </Label>
                            <Input
                              type="number"
                              value={formData.free_shipping_min_order}
                              onChange={(e) => setFormData({ ...formData, free_shipping_min_order: parseFloat(e.target.value) })}
                              disabled={!formData.free_shipping}
                              placeholder="مثال: 250000"
                            />
                            <p className="text-xs text-muted-foreground mt-1">
                              {formData.free_shipping && formData.free_shipping_min_order > 0 
                                ? `شحن مجاني للطلبات أكثر من ${formData.free_shipping_min_order.toLocaleString()} د.ع`
                                : 'شحن مجاني على كل الطلبات'}
                            </p>
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <Label className="flex items-center gap-2 text-sm">
                              <Truck className="h-4 w-4" />
                              شحن مجاني
                            </Label>
                            <Switch
                              checked={formData.free_shipping}
                              onCheckedChange={(checked) => setFormData({ ...formData, free_shipping: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <Label className="flex items-center gap-2 text-sm">
                              <Tag className="h-4 w-4" />
                              خصومات منتجات
                            </Label>
                            <Switch
                              checked={formData.card_discounts_enabled}
                              onCheckedChange={(checked) => setFormData({ ...formData, card_discounts_enabled: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-amber-500/10 rounded-lg border border-amber-500/20">
                            <Label className="flex items-center gap-2 text-sm">
                              <Crown className="h-4 w-4 text-amber-600" />
                              دعم VIP
                            </Label>
                            <Switch
                              checked={formData.vip_support}
                              onCheckedChange={(checked) => setFormData({ ...formData, vip_support: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <Label className="flex items-center gap-2 text-sm">
                              <Truck className="h-4 w-4" />
                              أولوية الشحن
                            </Label>
                            <Switch
                              checked={formData.priority_shipping}
                              onCheckedChange={(checked) => setFormData({ ...formData, priority_shipping: checked })}
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <Label className="flex items-center gap-2 text-sm">
                              <Sparkles className="h-4 w-4" />
                              وصول مبكر
                            </Label>
                            <Switch
                              checked={formData.early_access}
                              onCheckedChange={(checked) => setFormData({ ...formData, early_access: checked })}
                            />
                          </div>
                          <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                            <Label className="flex items-center gap-2 text-sm">
                              <Gift className="h-4 w-4" />
                              منتجات حصرية
                            </Label>
                            <Switch
                              checked={formData.exclusive_products}
                              onCheckedChange={(checked) => setFormData({ ...formData, exclusive_products: checked })}
                            />
                          </div>
                          <div className="admin-form-group">
                            <Label className="text-xs">شحن مجاني شهرياً</Label>
                            <Input
                              type="number"
                              min="0"
                              value={formData.monthly_free_shipping}
                              onChange={(e) => setFormData({ ...formData, monthly_free_shipping: parseInt(e.target.value) || 0 })}
                              placeholder="0"
                            />
                          </div>
                        </div>
                      </AdminCardContent>
                    </AdminCard>

                    {/* Special Name Style */}
                    <AdminCard>
                      <AdminCardHeader title="تأثيرات الاسم والبروفايل" icon={<User className="h-4 w-4" />} />
                      <AdminCardContent>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          {/* Name Style */}
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">اسم مميز للمستخدم</Label>
                              <Switch
                                checked={formData.special_name_style?.enabled || false}
                                onCheckedChange={(checked) => setFormData({ 
                                  ...formData, 
                                  special_name_style: { ...formData.special_name_style, enabled: checked } 
                                })}
                              />
                            </div>
                            {formData.special_name_style?.enabled && (
                              <div className="space-y-3">
                                <div className="admin-form-group">
                                  <Label className="text-xs">لون الاسم</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={formData.special_name_style?.color || formData.color}
                                      onChange={(e) => setFormData({ 
                                        ...formData, 
                                        special_name_style: { ...formData.special_name_style, color: e.target.value } 
                                      })}
                                      className="w-12 h-9 cursor-pointer"
                                    />
                                    <Input
                                      value={formData.special_name_style?.color || formData.color}
                                      onChange={(e) => setFormData({ 
                                        ...formData, 
                                        special_name_style: { ...formData.special_name_style, color: e.target.value } 
                                      })}
                                      className="flex-1 font-mono text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                  <Label className="text-xs">تأثير توهج</Label>
                                  <Switch
                                    checked={formData.special_name_style?.glow || false}
                                    onCheckedChange={(checked) => setFormData({ 
                                      ...formData, 
                                      special_name_style: { ...formData.special_name_style, glow: checked } 
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Profile Effects */}
                          <div className="space-y-4 p-4 border rounded-lg">
                            <div className="flex items-center justify-between">
                              <Label className="font-medium">تأثيرات البروفايل</Label>
                              <Switch
                                checked={formData.profile_effects?.enabled || false}
                                onCheckedChange={(checked) => setFormData({ 
                                  ...formData, 
                                  profile_effects: { ...formData.profile_effects, enabled: checked } 
                                })}
                              />
                            </div>
                            {formData.profile_effects?.enabled && (
                              <div className="space-y-3">
                                <div className="admin-form-group">
                                  <Label className="text-xs">لون الإطار</Label>
                                  <div className="flex gap-2">
                                    <Input
                                      type="color"
                                      value={formData.profile_effects?.border_color || formData.color}
                                      onChange={(e) => setFormData({ 
                                        ...formData, 
                                        profile_effects: { ...formData.profile_effects, border_color: e.target.value } 
                                      })}
                                      className="w-12 h-9 cursor-pointer"
                                    />
                                    <Input
                                      value={formData.profile_effects?.border_color || formData.color}
                                      onChange={(e) => setFormData({ 
                                        ...formData, 
                                        profile_effects: { ...formData.profile_effects, border_color: e.target.value } 
                                      })}
                                      className="flex-1 font-mono text-xs"
                                    />
                                  </div>
                                </div>
                                <div className="flex items-center justify-between p-2 bg-muted/50 rounded">
                                  <Label className="text-xs">توهج الخلفية</Label>
                                  <Switch
                                    checked={formData.profile_effects?.background_glow || false}
                                    onCheckedChange={(checked) => setFormData({ 
                                      ...formData, 
                                      profile_effects: { ...formData.profile_effects, background_glow: checked } 
                                    })}
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        </div>
                      </AdminCardContent>
                    </AdminCard>

                    {/* Custom Benefits */}
                    <AdminCard>
                      <AdminCardHeader 
                        title="مزايا إضافية مخصصة" 
                        icon={<Sparkles className="h-4 w-4" />}
                        actions={
                          <Button size="sm" variant="outline" onClick={handleAddBenefit}>
                            <Plus className="ml-2 h-3 w-3" />
                            إضافة ميزة
                          </Button>
                        }
                      />
                      <AdminCardContent>
                        {benefits.length === 0 ? (
                          <div className="text-center py-8 text-muted-foreground">
                            <Sparkles className="h-8 w-8 mx-auto mb-2 opacity-50" />
                            <p>لا توجد مزايا إضافية</p>
                            <p className="text-xs">اضغط على "إضافة ميزة" لإضافة مزايا مخصصة</p>
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {benefits.map((benefit, index) => (
                              <div key={index} className="flex gap-2 items-start p-3 border rounded-lg bg-muted/30">
                                <div className="flex-1 grid grid-cols-2 gap-2">
                                  <Input
                                    placeholder="النص بالعربي"
                                    value={benefit.text_ar}
                                    onChange={(e) => handleBenefitChange(index, "text_ar", e.target.value)}
                                  />
                                  <Input
                                    placeholder="Text in English"
                                    value={benefit.text_en}
                                    onChange={(e) => handleBenefitChange(index, "text_en", e.target.value)}
                                  />
                                </div>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  className="shrink-0 text-destructive hover:text-destructive hover:bg-destructive/10"
                                  onClick={() => handleRemoveBenefit(index)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        )}
                      </AdminCardContent>
                    </AdminCard>
                  </div>
                </ScrollArea>

                <div className="flex justify-end gap-2 px-6 py-4 border-t shrink-0 bg-background">
                  <Button variant="outline" onClick={() => setDialogOpen(false)}>
                    إلغاء
                  </Button>
                  <Button 
                    className="admin-btn-primary"
                    onClick={() => saveMutation.mutate()} 
                    disabled={saveMutation.isPending}
                  >
                    {saveMutation.isPending ? "جاري الحفظ..." : "حفظ البطاقة"}
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>

          {/* Cards Grid */}
          {!levels || levels.length === 0 ? (
            <AdminEmptyState
              icon={<CreditCard className="h-12 w-12" />}
              title="لا توجد بطاقات"
              description="قم بإضافة بطاقة جديدة لبرنامج المكافآت"
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {levels.map((level) => (
                <div key={level.id} className="relative group">
                  <LoyaltyCardPreview
                    name_ar={level.name_ar}
                    name_en={level.name_en}
                    color={level.color}
                    discount_percentage={level.discount_percentage}
                    bonus_points_percentage={level.bonus_points_percentage}
                    free_shipping={level.free_shipping}
                    free_shipping_min_order={level.free_shipping_min_order}
                    duration_days={level.duration_days}
                    is_purchasable={level.is_purchasable}
                    purchase_price_points={level.purchase_price_points}
                    min_points={level.min_points}
                    vip_support={level.vip_support}
                    size="md"
                  />
                  <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2">
                    <Button
                      size="sm"
                      variant="secondary"
                      onClick={() => handleEdit(level)}
                    >
                      <Pencil className="h-4 w-4 ml-1" />
                      تعديل
                    </Button>
                    <Button
                      size="sm"
                      variant="destructive"
                      onClick={() => {
                        if (confirm("هل أنت متأكد من حذف هذه البطاقة؟")) {
                          deleteMutation.mutate(level.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 ml-1" />
                      حذف
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          <div className="flex justify-between items-center">
            <p className="text-sm text-muted-foreground">
              العروض الحصرية لحاملي البطاقات
            </p>
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

                  <div className="grid grid-cols-2 gap-3">
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

                  <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
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
                            {offer.offer_type === 'discount' ? `${offer.offer_value}%` : `${offer.offer_value} دينار`}
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

        {/* Settings Tab */}
        <TabsContent value="settings" className="space-y-4">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <AdminCard>
              <AdminCardHeader 
                title="إعدادات عامة" 
                description="إعدادات نظام البطاقات والمكافآت"
                icon={<Settings className="h-4 w-4" />}
              />
              <AdminCardContent>
                <div className="space-y-4">
                  <div className="p-4 bg-muted/50 rounded-lg">
                    <p className="text-sm font-medium mb-2">معلومة</p>
                    <p className="text-xs text-muted-foreground">
                      يمكنك التحكم في إعدادات النقاط والمهام اليومية من خلال صفحة 
                      <a href="/cp-x9A3kL7m/points-settings" className="text-primary mr-1 hover:underline">
                        إعدادات النقاط
                      </a>
                    </p>
                  </div>
                  
                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">البطاقات المتاحة</p>
                        <p className="text-xs text-muted-foreground">عدد البطاقات في النظام</p>
                      </div>
                      <Badge variant="outline" className="text-lg px-3">
                        {levels?.length || 0}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">المشتركين النشطين</p>
                        <p className="text-xs text-muted-foreground">عدد حاملي البطاقات النشطة</p>
                      </div>
                      <Badge variant="outline" className="text-lg px-3">
                        {cardHolders?.length || 0}
                      </Badge>
                    </div>
                  </div>

                  <div className="p-4 border rounded-lg">
                    <div className="flex items-center justify-between mb-3">
                      <div>
                        <p className="font-medium">العروض الحصرية</p>
                        <p className="text-xs text-muted-foreground">عدد العروض المتاحة</p>
                      </div>
                      <Badge variant="outline" className="text-lg px-3">
                        {exclusiveOffers?.length || 0}
                      </Badge>
                    </div>
                  </div>
                </div>
              </AdminCardContent>
            </AdminCard>

            <AdminCard>
              <AdminCardHeader 
                title="روابط سريعة" 
                description="الوصول السريع للإعدادات المرتبطة"
                icon={<Zap className="h-4 w-4" />}
              />
              <AdminCardContent>
                <div className="grid grid-cols-1 gap-3">
                  <a 
                    href="/cp-x9A3kL7m/points-settings" 
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 bg-amber-500/10 rounded-lg">
                      <Crown className="h-5 w-5 text-amber-600" />
                    </div>
                    <div>
                      <p className="font-medium">إعدادات النقاط والمهام</p>
                      <p className="text-xs text-muted-foreground">تحكم في كسب واستبدال النقاط</p>
                    </div>
                  </a>
                  
                  <a 
                    href="/cp-x9A3kL7m/coupons" 
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 bg-green-500/10 rounded-lg">
                      <Tag className="h-5 w-5 text-green-600" />
                    </div>
                    <div>
                      <p className="font-medium">إدارة الكوبونات</p>
                      <p className="text-xs text-muted-foreground">إضافة وتعديل كوبونات الخصم</p>
                    </div>
                  </a>

                  <a 
                    href="/cp-x9A3kL7m/competitions" 
                    className="flex items-center gap-3 p-4 border rounded-lg hover:bg-muted/50 transition-colors"
                  >
                    <div className="p-2 bg-purple-500/10 rounded-lg">
                      <Gift className="h-5 w-5 text-purple-600" />
                    </div>
                    <div>
                      <p className="font-medium">إدارة المسابقات</p>
                      <p className="text-xs text-muted-foreground">إنشاء وإدارة المسابقات والجوائز</p>
                    </div>
                  </a>
                </div>
              </AdminCardContent>
            </AdminCard>
          </div>
        </TabsContent>
      </Tabs>
    </AdminLayout>
  );
}
