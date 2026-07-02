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
import { Plus, Pencil, Trash2, CreditCard, Users, Gift, Settings, Tag, Eye, Palette, Clock, Percent, Zap, Truck, Crown, Sparkles, User, Headphones, CalendarIcon, Check } from "lucide-react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { cn } from "@/lib/utils";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import AdminLayout, { AdminSection, AdminCard, AdminCardContent, AdminCardHeader, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import LoyaltyCardPreview from "@/components/admin/LoyaltyCardPreview";
// Old loyalty code batches replaced by Levo Physical Cards (/admin/levo-cards)
import { History, Ticket } from "lucide-react";
import { ADMIN_BASE_PATH } from "@/config/adminConfig";

export default function AdminLoyaltyLevels() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [createBatchOpen, setCreateBatchOpen] = useState(false);
  const [editingLevel, setEditingLevel] = useState<any>(null);
  const [formData, setFormData] = useState({
    level_key: "",
    name_ar: "",
    name_en: "",
    min_points: 0,
    color: "#FFD700",
    discount_percentage: 0,
    discount_percentage_max_amount: null as number | null,
    bonus_points_percentage: 0,
    free_shipping: false,
    free_shipping_min_order: 0,
    free_shipping_methods: ["standard"] as string[],
    free_shipping_max_uses: null as number | null,
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
    discount_applicable_category_ids: [] as string[],
    free_shipping_applicable_category_ids: [] as string[],
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

  // Admin gift dialog state
  const [giftDialogOpen, setGiftDialogOpen] = useState(false);
  const [giftLevel, setGiftLevel] = useState<any>(null);
  const [giftSearch, setGiftSearch] = useState("");
  const [giftRecipientId, setGiftRecipientId] = useState<string | null>(null);
  const [giftMessage, setGiftMessage] = useState("");

  // Search users for gifting
  const { data: giftSearchResults = [] } = useQuery({
    queryKey: ['admin-gift-card-search', giftSearch],
    queryFn: async () => {
      if (giftSearch.trim().length < 2) return [];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .or(`full_name.ilike.%${giftSearch}%,username.ilike.%${giftSearch}%`)
        .limit(20);
      return data || [];
    },
    enabled: giftDialogOpen && giftSearch.trim().length >= 2,
  });

  const adminGiftMutation = useMutation({
    mutationFn: async ({ levelId, recipientId, message }: { levelId: string; recipientId: string; message: string }) => {
      const { data, error } = await supabase.rpc('admin_gift_loyalty_card' as any, {
        p_user_id: recipientId,
        p_card_id: levelId,
        p_admin_note: message || null,
      });
      if (error) throw error;
      const result = data as { success?: boolean; error?: string };
      if (!result?.success) throw new Error(result?.error || 'فشل الإهداء');
      return result;
    },
    onSuccess: () => {
      toast.success('تم إهداء البطاقة بنجاح');
      setGiftDialogOpen(false);
      setGiftLevel(null);
      setGiftSearch("");
      setGiftRecipientId(null);
      setGiftMessage("");
      queryClient.invalidateQueries({ queryKey: ['admin-card-holders'] });
    },
    onError: (e: any) => toast.error(e?.message || 'فشل الإهداء'),
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
    queryKey: ["membershipCards"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("membership_cards")
        .select("*")
        .order("display_order", { ascending: true });

      if (error) throw error;
      return data;
    },
  });

  const { data: allCategoriesForBenefits } = useQuery({
    queryKey: ["all-categories-for-loyalty-benefits"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("categories")
        .select("id, name, name_ar")
        .order("name");
      if (error) throw error;
      return (data || []) as Array<{ id: string; name: string; name_ar: string | null }>;
    },
  });

  const { data: cardHolders } = useQuery({
    queryKey: ["cardHolders"],
    queryFn: async () => {
      const { data: cards, error } = await supabase
        .from("user_cards")
        .select(`
          *,
          membership_cards:card_id(name_ar, color)
        `)
        .eq("is_active", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      if (!cards || cards.length === 0) return [];

      const userIds = Array.from(new Set(cards.map((c: any) => c.user_id).filter(Boolean)));
      const { data: profilesData } = await supabase
        .from("profiles")
        .select("id, full_name, username, email")
        .in("id", userIds);

      const profileMap = new Map((profilesData || []).map((p: any) => [p.id, p]));
      return cards.map((c: any) => ({
        ...c,
        profiles: profileMap.get(c.user_id) || null,
        loyalty_levels: c.membership_cards, // backward-compat for existing UI bindings
      }));
    },
  });

  const { data: exclusiveOffers } = useQuery({
    queryKey: ["cardExclusiveOffers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("card_exclusive_offers")
        .select(`
          *,
          membership_cards:min_card_id(name_ar, color)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return (data || []).map((o: any) => ({ ...o, loyalty_levels: o.membership_cards }));
    },
  });

  const { data: stats } = useQuery({
    queryKey: ["loyaltyStats"],
    queryFn: async () => {
      const [cardsRes, holdersRes] = await Promise.all([
        supabase.from("membership_cards").select("id", { count: "exact", head: true }),
        supabase.from("user_cards").select("id", { count: "exact", head: true }).eq("is_active", true),
      ]);
      return {
        totalCards: cardsRes.count || 0,
        activeHolders: holdersRes.count || 0,
      };
    },
  });

  const updateExpiryMutation = useMutation({
    mutationFn: async ({ holderId, newDate }: { holderId: string; newDate: Date }) => {
      const isActive = newDate.getTime() > Date.now();
      const { error } = await supabase
        .from("user_cards")
        .update({ expires_at: newDate.toISOString(), is_active: isActive })
        .eq("id", holderId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cardHolders"] });
      queryClient.invalidateQueries({ queryKey: ["loyaltyStats"] });
      toast.success("تم تحديث تاريخ الانتهاء");
    },
    onError: (err: any) => {
      toast.error("فشل التحديث: " + (err?.message || "خطأ غير معروف"));
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

      // Map form fields → membership_cards columns
      const {
        level_key,
        min_points,
        purchase_price_points,
        ...rest
      } = formData;

      const cardData: any = {
        ...rest,
        card_key: level_key,
        price_points: purchase_price_points,
        benefits,
        display_order: displayOrder,
        discount_applicable_category_ids: formData.discount_applicable_category_ids.length > 0
          ? formData.discount_applicable_category_ids
          : null,
        free_shipping_applicable_category_ids: formData.free_shipping_applicable_category_ids.length > 0
          ? formData.free_shipping_applicable_category_ids
          : null,
      };

      if (editingLevel) {
        const { error } = await (supabase as any)
          .from("membership_cards")
          .update(cardData)
          .eq("id", editingLevel.id);

        if (error) throw error;
      } else {
        const { error } = await (supabase as any)
          .from("membership_cards")
          .insert([cardData]);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipCards"] });
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
        .from("membership_cards")
        .delete()
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["membershipCards"] });
      queryClient.invalidateQueries({ queryKey: ["loyaltyStats"] });
      toast.success("تم حذف البطاقة بنجاح");
    },
    onError: (error: any) => {
      toast.error(error.message || "حدث خطأ أثناء الحذف");
    },
  });

  const saveOfferMutation = useMutation({
    mutationFn: async () => {
      const { min_card_level_id, ...rest } = offerData as any;
      const data: any = {
        ...rest,
        min_card_id: min_card_level_id || null,
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
      discount_percentage_max_amount: null,
      bonus_points_percentage: 0,
      free_shipping: false,
      free_shipping_min_order: 0,
      free_shipping_methods: ["standard"],
      free_shipping_max_uses: null,
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
      discount_applicable_category_ids: [],
      free_shipping_applicable_category_ids: [],
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
      level_key: level.card_key || level.level_key || "",
      name_ar: level.name_ar,
      name_en: level.name_en,
      min_points: level.min_points ?? 0,
      color: level.color,
      discount_percentage: level.discount_percentage || 0,
      discount_percentage_max_amount: level.discount_percentage_max_amount ?? null,
      bonus_points_percentage: level.bonus_points_percentage || 0,
      free_shipping: level.free_shipping || false,
      free_shipping_min_order: level.free_shipping_min_order || 0,
      free_shipping_methods: Array.isArray(level.free_shipping_methods) ? level.free_shipping_methods : ["standard"],
      free_shipping_max_uses: level.free_shipping_max_uses ?? null,
      is_purchasable: level.is_purchasable ?? true,
      purchase_price_points: level.price_points ?? level.purchase_price_points ?? 0,
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
      discount_applicable_category_ids: Array.isArray(level.discount_applicable_category_ids) ? level.discount_applicable_category_ids : [],
      free_shipping_applicable_category_ids: Array.isArray(level.free_shipping_applicable_category_ids) ? level.free_shipping_applicable_category_ids : [],
    });
    setBenefits(level.benefits || []);
    setDialogOpen(true);
  };

  const handleEditOffer = (offer: any) => {
    setEditingOffer(offer);
    setOfferData({
      title_ar: offer.title_ar,
      description_ar: offer.description_ar || "",
      min_card_level_id: offer.min_card_id || offer.min_card_level_id || "",
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
          <TabsTrigger value="codes" className="admin-tab flex items-center gap-2">
            <Ticket className="h-4 w-4" />
            أكواد التفعيل
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
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              البطاقات المتاحة للمستخدمين للشراء أو الحصول عليها تلقائياً
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="admin-btn-primary" onClick={resetForm}>
                    <Plus className="ml-2 h-4 w-4" />
                    إضافة بطاقة جديدة
                  </Button>
                </DialogTrigger>
              <DialogContent className="admin-dialog w-[calc(100%-1.5rem)] !max-w-6xl sm:!max-w-6xl h-[92vh] p-0 flex flex-col !overflow-hidden !max-h-none">
                <DialogHeader className="px-6 py-4 border-b shrink-0 bg-gradient-to-r from-primary/5 to-transparent">
                  <DialogTitle className="flex items-center gap-2 text-lg">
                    <CreditCard className="h-5 w-5 text-primary" />
                    {editingLevel ? `تعديل البطاقة: ${formData.name_ar || formData.level_key}` : "إضافة بطاقة جديدة"}
                  </DialogTitle>
                  <p className="text-xs text-muted-foreground mt-1">
                    عدّل الحقول من اليسار وراقب المعاينة المباشرة على اليمين
                  </p>
                </DialogHeader>

                <div className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-0 min-h-0">
                  {/* Form area - scrollable */}
                  <ScrollArea className="h-full min-w-0">
                    <div className="px-6 py-5">
                      <Accordion
                        type="multiple"
                        defaultValue={["basic", "purchase", "discounts", "shipping", "perks", "design", "preview-mobile"]}
                        className="space-y-3"
                      >
                        {/* Mobile preview - only on small screens */}
                        <AccordionItem value="preview-mobile" className="lg:hidden border rounded-xl bg-gradient-to-br from-muted/40 to-muted/10 overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <Eye className="h-4 w-4 text-primary" />
                              <span className="font-semibold text-sm">معاينة البطاقة</span>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="flex justify-center">
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
                                size="md"
                              />
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* 1. Basic Info */}
                        <AccordionItem value="basic" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-primary/10">
                                <Tag className="h-4 w-4 text-primary" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">المعلومات الأساسية</div>
                                <div className="text-[11px] text-muted-foreground font-normal">الاسم، اللون، المدة</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 space-y-4">
                            <div className="admin-form-group">
                              <Label>مفتاح البطاقة (بالإنجليزي)</Label>
                              <Input
                                value={formData.level_key}
                                onChange={(e) => setFormData({ ...formData, level_key: e.target.value.toLowerCase().replace(/\s+/g, '_') })}
                                placeholder="levo, levo_plus, levo_pro, levo_vip"
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
                                مدة الصلاحية
                              </Label>
                              <div className="grid grid-cols-2 gap-2">
                                <div>
                                  <Label className="text-xs text-muted-foreground">أشهر</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={Math.max(1, Math.round((formData.duration_days || 30) / 30))}
                                    onChange={(e) => {
                                      const months = Math.max(1, Number(e.target.value) || 1);
                                      setFormData({ ...formData, duration_days: months * 30 });
                                    }}
                                  />
                                </div>
                                <div>
                                  <Label className="text-xs text-muted-foreground">أيام (دقيق)</Label>
                                  <Input
                                    type="number"
                                    min={1}
                                    value={formData.duration_days}
                                    onChange={(e) => setFormData({ ...formData, duration_days: Math.max(1, parseInt(e.target.value) || 1) })}
                                  />
                                </div>
                              </div>
                              <p className="text-[11px] text-muted-foreground mt-1">
                                مثال: 10 أشهر = 300 يوم. تُمثّل كل دورة 30 يوماً لإعادة احتساب السقف.
                              </p>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* 2. Purchase / Acquisition */}
                        <AccordionItem value="purchase" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-blue-500/10">
                                <CreditCard className="h-4 w-4 text-blue-600" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">طريقة الحصول على البطاقة</div>
                                <div className="text-[11px] text-muted-foreground font-normal">
                                  {formData.is_purchasable ? `بالشراء — ${formData.purchase_price_points || 0} نقطة` : 'عن طريق كود تفعيل فقط'}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 space-y-4">
                            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                              <div>
                                <Label className="font-medium">قابلة للشراء بالنقاط/المحفظة</Label>
                                <p className="text-[11px] text-muted-foreground mt-0.5">
                                  عند التعطيل: تتفعّل البطاقة فقط عبر كود تفعيل
                                </p>
                              </div>
                              <Switch
                                checked={formData.is_purchasable}
                                onCheckedChange={(checked) => setFormData({ ...formData, is_purchasable: checked })}
                              />
                            </div>

                            {formData.is_purchasable ? (
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="admin-form-group">
                                  <Label>سعر البطاقة (نقاط)</Label>
                                  <Input
                                    type="number"
                                    value={formData.purchase_price_points}
                                    onChange={(e) => setFormData({ ...formData, purchase_price_points: parseInt(e.target.value) })}
                                    placeholder="1000"
                                  />
                                </div>
                                <div className="admin-form-group">
                                  <Label>سعر المحفظة (د.ع) — اختياري</Label>
                                  <Input
                                    type="number"
                                    value={formData.wallet_price || ''}
                                    onChange={(e) => setFormData({ ...formData, wallet_price: e.target.value ? parseInt(e.target.value) : null })}
                                    placeholder="مثلاً 50000"
                                  />
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    اتركه فارغاً لتعطيل الشراء بالمحفظة
                                  </p>
                                </div>
                              </div>
                            ) : (
                              <div className="rounded-lg border border-dashed border-primary/40 bg-primary/5 p-4 space-y-3">
                                <div className="flex items-start gap-3">
                                  <div className="p-2 rounded-lg bg-primary/10 shrink-0">
                                    <Tag className="h-4 w-4 text-primary" />
                                  </div>
                                  <div className="flex-1 space-y-1">
                                    <p className="font-semibold text-sm">تفعيل عبر كود حصري</p>
                                    <p className="text-[11px] text-muted-foreground leading-relaxed">
                                      هذه البطاقة لن تظهر للشراء. يحصل عليها المستخدم فقط عند إدخال كود تفعيل صادر من الإدارة (يتطلب وجود ضمان طابعة فعّال).
                                    </p>
                                  </div>
                                </div>
                                <Button
                                  type="button"
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={() => { setDialogOpen(false); setTimeout(() => setCreateBatchOpen(true), 200); }}
                                >
                                  <Tag className="h-3.5 w-3.5 ml-1" />
                                  إنشاء دفعة أكواد جديدة
                                </Button>
                              </div>
                            )}
                          </AccordionContent>
                        </AccordionItem>

                        {/* 3. Discounts & Points */}
                        <AccordionItem value="discounts" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-emerald-500/10">
                                <Percent className="h-4 w-4 text-emerald-600" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">الخصومات والنقاط</div>
                                <div className="text-[11px] text-muted-foreground font-normal">
                                  خصم {formData.discount_percentage || 0}% • نقاط +{formData.bonus_points_percentage || 0}%
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 space-y-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                              <div className="admin-form-group">
                                <Label className="flex items-center gap-2">
                                  <Percent className="h-4 w-4" />
                                  نسبة الخصم العامة (%)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  max="100"
                                  value={formData.discount_percentage}
                                  onChange={(e) => setFormData({ ...formData, discount_percentage: parseFloat(e.target.value) })}
                                />
                              </div>
                              <div className="admin-form-group">
                                <Label className="flex items-center gap-2">
                                  <Zap className="h-4 w-4" />
                                  نقاط إضافية (%)
                                </Label>
                                <Input
                                  type="number"
                                  min="0"
                                  value={formData.bonus_points_percentage}
                                  onChange={(e) => setFormData({ ...formData, bonus_points_percentage: parseFloat(e.target.value) })}
                                />
                              </div>
                            </div>

                            <div className="admin-form-group">
                              <Label className="text-xs text-muted-foreground">
                                الحد الأقصى للخصم بالدينار خلال صلاحية الباقة (اتركه فارغاً = بدون سقف)
                              </Label>
                              <Input
                                type="number"
                                min="0"
                                step="1000"
                                placeholder="مثال: 50000"
                                value={(formData as any).discount_percentage_max_amount ?? ''}
                                onChange={(e) => setFormData({
                                  ...formData,
                                  discount_percentage_max_amount: e.target.value === '' ? null : parseFloat(e.target.value),
                                } as any)}
                                disabled={!formData.discount_percentage || formData.discount_percentage <= 0}
                              />
                              <p className="text-[11px] text-muted-foreground mt-1">
                                يظهر للمستخدمين: "خصم {formData.discount_percentage || 0}% مع بطاقة {formData.name_ar || '—'}"
                                {(formData as any).discount_percentage_max_amount > 0 && ` بحد أقصى ${Number((formData as any).discount_percentage_max_amount).toLocaleString()} د.ع`}
                              </p>
                            </div>

                            <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                              <Label className="text-sm font-semibold">الأقسام المشمولة بالخصم</Label>
                              <p className="text-[11px] text-muted-foreground mb-2">اتركه فارغًا ليشمل جميع الأقسام</p>
                              <div className="flex flex-wrap gap-2">
                                {(allCategoriesForBenefits || []).map((c) => {
                                  const selected = formData.discount_applicable_category_ids;
                                  const checked = selected.includes(c.id);
                                  return (
                                    <label
                                      key={c.id}
                                      className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-xs select-none border ${
                                        checked ? 'bg-primary/10 border-primary/40' : 'bg-background border-border'
                                      }`}
                                    >
                                      <Switch
                                        checked={checked}
                                        onCheckedChange={(v) => {
                                          const next = v
                                            ? Array.from(new Set([...selected, c.id]))
                                            : selected.filter((x) => x !== c.id);
                                          setFormData({ ...formData, discount_applicable_category_ids: next });
                                        }}
                                      />
                                      <span>{c.name_ar || c.name}</span>
                                    </label>
                                  );
                                })}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>

                        {/* 4. Shipping (consolidated) */}
                        <AccordionItem value="shipping" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-orange-500/10">
                                <Truck className="h-4 w-4 text-orange-600" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">إعدادات الشحن</div>
                                <div className="text-[11px] text-muted-foreground font-normal">
                                  {formData.free_shipping ? 'شحن مجاني مفعّل' : 'شحن مجاني معطّل'}
                                  {formData.monthly_free_shipping > 0 && ` • ${formData.monthly_free_shipping} شحنات/شهر`}
                                </div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4 space-y-4">
                            <p className="text-[11px] text-muted-foreground">
                              فعّل/أوقف "الشحن المجاني" من قسم "المزايا الإضافية" أدناه. هذه الحقول إعدادات تفصيلية له.
                            </p>

                            <div className={cn("space-y-4 transition-opacity", !formData.free_shipping && "opacity-50 pointer-events-none")}>
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                <div className="admin-form-group">
                                  <Label>الحد الأدنى للطلب (د.ع)</Label>
                                  <Input
                                    type="number"
                                    value={formData.free_shipping_min_order}
                                    onChange={(e) => setFormData({ ...formData, free_shipping_min_order: parseFloat(e.target.value) })}
                                    placeholder="مثال: 250000"
                                  />
                                  <p className="text-[11px] text-muted-foreground mt-1">
                                    {formData.free_shipping_min_order > 0
                                      ? `يُطبَّق للطلبات أكثر من ${formData.free_shipping_min_order.toLocaleString()} د.ع`
                                      : 'يُطبَّق على كل الطلبات'}
                                  </p>
                                </div>
                                <div className="admin-form-group">
                                  <Label>الحد الأقصى لعدد المرات</Label>
                                  <Input
                                    type="number"
                                    min={0}
                                    value={formData.free_shipping_max_uses ?? ""}
                                    onChange={(e) =>
                                      setFormData({
                                        ...formData,
                                        free_shipping_max_uses: e.target.value === "" ? null : parseInt(e.target.value),
                                      })
                                    }
                                    placeholder="فارغ = غير محدود"
                                  />
                                </div>
                              </div>

                              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                                <Label className="text-sm font-semibold">طرق التوصيل المشمولة</Label>
                                <p className="text-[11px] text-muted-foreground mb-2">الاستلام من المخزن مجاني افتراضياً</p>
                                <div className="flex flex-wrap gap-3">
                                  {[
                                    { key: "standard", label: "التوصيل الاعتيادي" },
                                    { key: "personal", label: "التوصيل الشخصي" },
                                  ].map((m) => {
                                    const checked = formData.free_shipping_methods.includes(m.key);
                                    return (
                                      <label key={m.key} className="flex items-center gap-2 cursor-pointer text-sm select-none">
                                        <Switch
                                          checked={checked}
                                          onCheckedChange={(v) => {
                                            const next = v
                                              ? Array.from(new Set([...formData.free_shipping_methods, m.key]))
                                              : formData.free_shipping_methods.filter((k) => k !== m.key);
                                            setFormData({ ...formData, free_shipping_methods: next });
                                          }}
                                        />
                                        {m.label}
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>

                              <div className="rounded-lg border border-dashed border-border bg-muted/20 p-3">
                                <Label className="text-sm font-semibold">الأقسام المشمولة بالتوصيل المجاني</Label>
                                <p className="text-[11px] text-muted-foreground mb-2">اتركه فارغًا ليشمل جميع الأقسام</p>
                                <div className="flex flex-wrap gap-2">
                                  {(allCategoriesForBenefits || []).map((c) => {
                                    const selected = formData.free_shipping_applicable_category_ids;
                                    const checked = selected.includes(c.id);
                                    return (
                                      <label
                                        key={c.id}
                                        className={`flex items-center gap-1.5 px-2 py-1 rounded-md cursor-pointer text-xs select-none border ${
                                          checked ? 'bg-primary/10 border-primary/40' : 'bg-background border-border'
                                        }`}
                                      >
                                        <Switch
                                          checked={checked}
                                          onCheckedChange={(v) => {
                                            const next = v
                                              ? Array.from(new Set([...selected, c.id]))
                                              : selected.filter((x) => x !== c.id);
                                            setFormData({ ...formData, free_shipping_applicable_category_ids: next });
                                          }}
                                        />
                                        <span>{c.name_ar || c.name}</span>
                                      </label>
                                    );
                                  })}
                                </div>
                              </div>
                            </div>

                          </AccordionContent>
                        </AccordionItem>

                        {/* 5. Perks & VIP toggles */}
                        <AccordionItem value="perks" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-amber-500/10">
                                <Crown className="h-4 w-4 text-amber-600" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">المزايا الإضافية</div>
                                <div className="text-[11px] text-muted-foreground font-normal">VIP، الأولوية، الوصول المبكر</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <p className="text-xs text-muted-foreground mb-3">
                              فعّل أو أوقف كل ميزة. الميزة المُوقَفة لن تظهر للعميل ولن تُطبَّق في السلة.
                            </p>
                            {(() => {
                              const items: Array<{
                                key: string;
                                text: string;
                                enabled: boolean;
                                toggle: (v: boolean) => void;
                                visible: boolean;
                              }> = [
                                {
                                  key: 'free_shipping',
                                  visible: true,
                                  enabled: formData.free_shipping,
                                  toggle: (v) => setFormData({ ...formData, free_shipping: v }),
                                  text: formData.free_shipping
                                    ? (formData.free_shipping_min_order > 0
                                        ? `شحن مجاني للطلبات أكثر من ${Number(formData.free_shipping_min_order).toLocaleString()} د.ع`
                                        : 'شحن مجاني على جميع الطلبات')
                                      + (Array.isArray(formData.free_shipping_methods) && formData.free_shipping_methods.length > 0
                                          ? ` • ${formData.free_shipping_methods.map((m) => m === 'standard' ? 'اعتيادي' : m === 'personal' ? 'شخصي' : m).join(' + ')}`
                                          : '')
                                      + (formData.free_shipping_max_uses ? ` • حتى ${formData.free_shipping_max_uses} مرات` : '')
                                    : 'شحن مجاني (معطّل)',
                                },
                                {
                                  key: 'monthly_free_shipping',
                                  visible: true,
                                  enabled: formData.monthly_free_shipping > 0,
                                  toggle: (v) => setFormData({ ...formData, monthly_free_shipping: v ? (formData.monthly_free_shipping || 1) : 0 }),
                                  text: formData.monthly_free_shipping > 0 ? `${formData.monthly_free_shipping} شحنات مجانية شهرياً` : 'شحنات مجانية شهرياً',
                                },
                                { key: 'vip_support', visible: true, enabled: formData.vip_support, toggle: (v) => setFormData({ ...formData, vip_support: v }), text: 'دعم عملاء مميز وأولوية الرد' },
                                { key: 'priority_shipping', visible: true, enabled: formData.priority_shipping, toggle: (v) => setFormData({ ...formData, priority_shipping: v }), text: 'أولوية في الشحن والتوصيل' },
                                { key: 'priority_packaging', visible: true, enabled: formData.priority_packaging, toggle: (v) => setFormData({ ...formData, priority_packaging: v }), text: 'أولوية في التغليف' },
                                { key: 'priority_support', visible: true, enabled: formData.priority_support, toggle: (v) => setFormData({ ...formData, priority_support: v }), text: 'دعم فني ذو أولوية' },
                                { key: 'early_access', visible: true, enabled: formData.early_access, toggle: (v) => setFormData({ ...formData, early_access: v }), text: 'الوصول المبكر للمنتجات الجديدة' },
                                { key: 'exclusive_products', visible: true, enabled: formData.exclusive_products, toggle: (v) => setFormData({ ...formData, exclusive_products: v }), text: 'منتجات حصرية لحاملي البطاقة' },
                                { key: 'card_discounts_enabled', visible: true, enabled: formData.card_discounts_enabled, toggle: (v) => setFormData({ ...formData, card_discounts_enabled: v }), text: 'خصومات إضافية على منتجات مختارة' },
                                { key: 'wholesale_discount_enabled', visible: true, enabled: formData.wholesale_discount_enabled, toggle: (v) => setFormData({ ...formData, wholesale_discount_enabled: v }), text: 'أسعار الجملة على المنتجات المؤهلة' },
                                { key: 'investment_enabled', visible: true, enabled: formData.investment_enabled, toggle: (v) => setFormData({ ...formData, investment_enabled: v }), text: 'الوصول لميزة الاستثمار' },
                                { key: 'is_vip_plus', visible: true, enabled: formData.is_vip_plus, toggle: (v) => setFormData({ ...formData, is_vip_plus: v }), text: 'عضوية VIP+ كاملة المزايا' },
                                {
                                  key: 'free_daily_games',
                                  visible: true,
                                  enabled: formData.free_daily_games > 0,
                                  toggle: (v) => setFormData({ ...formData, free_daily_games: v ? (formData.free_daily_games || 1) : 0 }),
                                  text: formData.free_daily_games > 0 ? `${formData.free_daily_games} ألعاب مجانية يومياً` : 'ألعاب مجانية يومياً',
                                },
                              ];
                              return (
                                <div className="space-y-3">
                                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
                                    {items.map((it) => (
                                      <li
                                        key={it.key}
                                        className={cn(
                                          "flex items-center justify-between gap-3 p-2.5 rounded-lg border text-sm transition-colors",
                                          it.enabled ? "bg-primary/5 border-primary/30" : "bg-muted/20 border-border/50 opacity-60"
                                        )}
                                      >
                                        <div className="flex items-start gap-2 flex-1 min-w-0">
                                          <Check className={cn("h-4 w-4 shrink-0 mt-0.5", it.enabled ? "text-primary" : "text-muted-foreground")} />
                                          <span className={cn("leading-tight", !it.enabled && "line-through")}>{it.text}</span>
                                        </div>
                                        <Switch checked={it.enabled} onCheckedChange={it.toggle} />
                                      </li>
                                    ))}
                                  </ul>
                                  {(formData.free_daily_games > 0 || formData.monthly_free_shipping > 0) && (
                                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 pt-2 border-t">
                                      {formData.monthly_free_shipping > 0 && (
                                        <div className="p-2.5 rounded-lg border border-dashed">
                                          <Label className="text-xs">عدد الشحنات المجانية شهرياً</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            value={formData.monthly_free_shipping}
                                            onChange={(e) => setFormData({ ...formData, monthly_free_shipping: parseInt(e.target.value) || 0 })}
                                            className="mt-1"
                                          />
                                        </div>
                                      )}
                                      {formData.free_daily_games > 0 && (
                                        <div className="p-2.5 rounded-lg border border-dashed">
                                          <Label className="text-xs">عدد الألعاب المجانية يومياً</Label>
                                          <Input
                                            type="number"
                                            min="1"
                                            value={formData.free_daily_games}
                                            onChange={(e) => setFormData({ ...formData, free_daily_games: parseInt(e.target.value) || 0 })}
                                            className="mt-1"
                                          />
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>
                              );
                            })()}
                          </AccordionContent>
                        </AccordionItem>

                        {/* 6. Visual / Profile design */}
                        <AccordionItem value="design" className="border rounded-xl bg-card overflow-hidden">
                          <AccordionTrigger className="px-4 py-3 hover:no-underline">
                            <div className="flex items-center gap-2">
                              <div className="p-1.5 rounded-md bg-purple-500/10">
                                <Sparkles className="h-4 w-4 text-purple-600" />
                              </div>
                              <div className="text-right">
                                <div className="font-semibold text-sm">تأثيرات الاسم والبروفايل</div>
                                <div className="text-[11px] text-muted-foreground font-normal">للحاملين</div>
                              </div>
                            </div>
                          </AccordionTrigger>
                          <AccordionContent className="px-4 pb-4">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                              {/* Name Style */}
                              <div className="space-y-3 p-3 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <Label className="font-medium text-sm">اسم مميز للمستخدم</Label>
                                  <Switch
                                    checked={formData.special_name_style?.enabled || false}
                                    onCheckedChange={(checked) => setFormData({
                                      ...formData,
                                      special_name_style: { ...formData.special_name_style, enabled: checked }
                                    })}
                                  />
                                </div>
                                {formData.special_name_style?.enabled && (
                                  <>
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
                                  </>
                                )}
                              </div>

                              {/* Profile Effects */}
                              <div className="space-y-3 p-3 border rounded-lg">
                                <div className="flex items-center justify-between">
                                  <Label className="font-medium text-sm">تأثيرات البروفايل</Label>
                                  <Switch
                                    checked={formData.profile_effects?.enabled || false}
                                    onCheckedChange={(checked) => setFormData({
                                      ...formData,
                                      profile_effects: { ...formData.profile_effects, enabled: checked }
                                    })}
                                  />
                                </div>
                                {formData.profile_effects?.enabled && (
                                  <>
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
                                  </>
                                )}
                              </div>
                            </div>
                          </AccordionContent>
                        </AccordionItem>
                      </Accordion>
                    </div>
                  </ScrollArea>

                  {/* Sticky Preview Sidebar - Desktop only */}
                  <aside className="hidden lg:flex flex-col border-r bg-gradient-to-b from-muted/40 to-muted/10 overflow-hidden">
                    <div className="px-4 py-3 border-b bg-background/60 backdrop-blur shrink-0">
                      <div className="flex items-center gap-2">
                        <Eye className="h-4 w-4 text-primary" />
                        <span className="font-semibold text-sm">معاينة مباشرة</span>
                      </div>
                    </div>
                    <ScrollArea className="flex-1">
                      <div className="p-5 flex flex-col items-center gap-4">
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
                          size="md"
                        />
                        <div className="w-full space-y-1.5 text-xs">
                          <div className="flex justify-between p-2 rounded bg-background/60">
                            <span className="text-muted-foreground">المدة</span>
                            <span className="font-medium">{formData.duration_days} يوم</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background/60">
                            <span className="text-muted-foreground">الخصم</span>
                            <span className="font-medium">{formData.discount_percentage || 0}%</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background/60">
                            <span className="text-muted-foreground">نقاط إضافية</span>
                            <span className="font-medium">+{formData.bonus_points_percentage || 0}%</span>
                          </div>
                          <div className="flex justify-between p-2 rounded bg-background/60">
                            <span className="text-muted-foreground">شحن مجاني</span>
                            <span className={cn("font-medium", formData.free_shipping ? "text-emerald-600" : "text-muted-foreground")}>
                              {formData.free_shipping ? 'مفعّل' : 'معطّل'}
                            </span>
                          </div>
                          {formData.is_vip_plus && (
                            <div className="flex justify-between p-2 rounded bg-amber-500/10 border border-amber-500/20">
                              <span className="text-amber-700 dark:text-amber-500">VIP+</span>
                              <Crown className="h-3.5 w-3.5 text-amber-600" />
                            </div>
                          )}
                        </div>
                      </div>
                    </ScrollArea>
                  </aside>
                </div>

                <div className="flex justify-end gap-2 px-6 py-3 border-t shrink-0 bg-background">
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
              {levels.map((lvl) => {
                const level: any = lvl;
                return (
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
                  <div className="absolute inset-0 bg-black/60 rounded-2xl opacity-0 group-hover:opacity-100 transition-all flex items-center justify-center gap-2 flex-wrap p-2">
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
                      variant="default"
                      onClick={() => {
                        setGiftLevel(level);
                        setGiftDialogOpen(true);
                      }}
                      title={!level.is_purchasable ? "بطاقة حصرية للإهداء الإداري" : "إهداء البطاقة"}
                    >
                      <Gift className="h-4 w-4 ml-1" />
                      إهداء
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
                  {!level.is_purchasable && (
                    <Badge className="absolute top-2 right-2 bg-amber-500/90 text-white text-[10px] gap-1 z-10">
                      <Crown className="h-3 w-3" />
                      حصرية - إهداء فقط
                    </Badge>
                  )}
                </div>
                );
              })}
            </div>
          )}

        </TabsContent>

        {/* Activation Codes Tab (merged from /loyalty-card-codes) */}
        <TabsContent value="codes" className="space-y-4">
          <div className="flex justify-between items-center flex-wrap gap-2">
            <p className="text-sm text-muted-foreground">
              إنشاء وإدارة دفعات أكواد تفعيل بطاقات الولاء
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => navigate(`${ADMIN_BASE_PATH}/user-card-cycles`)}
              >
                <History className="h-4 w-4 ml-1" /> ملخص دورات المستخدمين
              </Button>
              <Button
                size="sm"
                onClick={() => navigate(`${ADMIN_BASE_PATH}/levo-cards`)}
              >
                <CreditCard className="h-4 w-4 ml-1" /> إدارة بطاقات ليفو الفيزيائية
              </Button>
            </div>
          </div>
          <AdminCard hover={false}>
            <AdminCardContent>
              <div className="text-center py-8 text-muted-foreground text-sm">
                تم استبدال نظام الأكواد القديم ببطاقات ليفو الفيزيائية.
                <br />
                استخدم زر "إدارة بطاقات ليفو الفيزيائية" أعلاه لتوليد وإدارة البطاقات.
              </div>
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
                            <TableCell>
                              <div className="flex items-center gap-2">
                                <span>{new Date(holder.expires_at).toLocaleDateString('ar-IQ')}</span>
                                <Popover>
                                  <PopoverTrigger asChild>
                                    <Button variant="ghost" size="icon" className="h-7 w-7">
                                      <Pencil className="h-3.5 w-3.5" />
                                    </Button>
                                  </PopoverTrigger>
                                  <PopoverContent className="w-auto p-3 space-y-2" align="start">
                                    <div className="flex gap-2">
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const base = new Date(holder.expires_at);
                                          const next = base.getTime() > Date.now() ? base : new Date();
                                          next.setDate(next.getDate() + 30);
                                          updateExpiryMutation.mutate({ holderId: holder.id, newDate: next });
                                        }}
                                      >
                                        +30 يوم
                                      </Button>
                                      <Button
                                        size="sm"
                                        variant="outline"
                                        onClick={() => {
                                          const base = new Date(holder.expires_at);
                                          const next = base.getTime() > Date.now() ? base : new Date();
                                          next.setFullYear(next.getFullYear() + 1);
                                          updateExpiryMutation.mutate({ holderId: holder.id, newDate: next });
                                        }}
                                      >
                                        +1 سنة
                                      </Button>
                                    </div>
                                    <Calendar
                                      mode="single"
                                      selected={new Date(holder.expires_at)}
                                      onSelect={(d) => {
                                        if (d) updateExpiryMutation.mutate({ holderId: holder.id, newDate: d });
                                      }}
                                      initialFocus
                                      className={cn("p-3 pointer-events-auto")}
                                    />
                                  </PopoverContent>
                                </Popover>
                              </div>
                            </TableCell>
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
                      <a href="/cp-x9A3kL5a/points-settings" className="text-primary mr-1 hover:underline">
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
                    href="/cp-x9A3kL5a/points-settings" 
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
                    href="/cp-x9A3kL5a/coupons" 
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
                    href="/cp-x9A3kL5a/competitions" 
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
      {/* Admin Gift Card Dialog */}
      <Dialog open={giftDialogOpen} onOpenChange={(o) => { if (!o) { setGiftLevel(null); setGiftSearch(""); setGiftRecipientId(null); setGiftMessage(""); } setGiftDialogOpen(o); }}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Gift className="h-5 w-5 text-primary" />
              إهداء بطاقة {giftLevel?.name_ar}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            {!giftLevel?.is_purchasable && (
              <div className="text-xs p-2 rounded bg-amber-500/10 text-amber-700 border border-amber-500/30">
                هذه البطاقة حصرية وغير متاحة للشراء العام، يمكنك إهداؤها للمستخدمين فقط.
              </div>
            )}
            <div>
              <Label className="text-xs">ابحث عن المستلم (الاسم أو اسم المستخدم)</Label>
              <Input
                value={giftSearch}
                onChange={(e) => { setGiftSearch(e.target.value); setGiftRecipientId(null); }}
                placeholder="اكتب على الأقل حرفين..."
                className="mt-1"
              />
            </div>
            {giftSearch.trim().length >= 2 && (
              <div className="max-h-48 overflow-y-auto border border-border rounded-md divide-y divide-border">
                {giftSearchResults.length === 0 ? (
                  <p className="text-xs text-muted-foreground p-3 text-center">لا توجد نتائج</p>
                ) : (
                  giftSearchResults.map((u: any) => (
                    <button
                      key={u.id}
                      type="button"
                      onClick={() => setGiftRecipientId(u.id)}
                      className={cn(
                        "w-full p-2 text-right text-sm hover:bg-muted transition-colors flex items-center gap-2",
                        giftRecipientId === u.id && "bg-primary/10"
                      )}
                    >
                      {giftRecipientId === u.id && <Check className="h-4 w-4 text-primary" />}
                      <span className="flex-1 truncate">{u.full_name || u.username}</span>
                      {u.username && <span className="text-xs text-muted-foreground">@{u.username}</span>}
                    </button>
                  ))
                )}
              </div>
            )}
            <div>
              <Label className="text-xs">رسالة (اختياري)</Label>
              <Textarea
                value={giftMessage}
                onChange={(e) => setGiftMessage(e.target.value)}
                placeholder="رسالة شخصية للمستلم..."
                className="mt-1 min-h-[60px]"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <Button variant="outline" onClick={() => setGiftDialogOpen(false)}>إلغاء</Button>
              <Button
                disabled={!giftRecipientId || adminGiftMutation.isPending}
                onClick={() => giftRecipientId && giftLevel && adminGiftMutation.mutate({ levelId: giftLevel.id, recipientId: giftRecipientId, message: giftMessage })}
              >
                {adminGiftMutation.isPending ? "جارٍ الإهداء..." : "إهداء البطاقة"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
