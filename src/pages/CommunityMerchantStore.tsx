import { useState } from "react";
import MerchantReelUpload from "@/components/reels/MerchantReelUpload";
import MerchantReelsSection from "@/components/merchant/MerchantReelsSection";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Star, Eye, Package, Sparkles, Film, FolderOpen, Settings, MessageSquare, Edit2, Trash2, EyeOff, Clock3, Box, Layers, Droplets, Palette, Scale, Wallet, CreditCard, BadgePercent, ExternalLink, Megaphone, Truck } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import StoreHeroSection from "@/components/merchant/StoreHeroSection";
import StoreStatsGrid from "@/components/merchant/StoreStatsGrid";
import ProductFilterTabs from "@/components/merchant/ProductFilterTabs";
import ProductCardEnhanced from "@/components/merchant/ProductCardEnhanced";
import MerchantCategoriesManager from "@/components/merchant/MerchantCategoriesManager";
import ProductFormDialog, { type ProductFormData, type MediaState } from "@/components/merchant/ProductFormDialog";
import StorePauseControl from "@/components/merchant/StorePauseControl";
import MerchantAdBookingDialog from "@/components/community/MerchantAdBookingDialog";
import MerchantDiscountsManager from "@/components/merchant/MerchantDiscountsManager";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";

interface MerchantProduct {
  id: string;
  title: string;
  description: string | null;
  price_iqd: number | null;
  original_price_iqd: number | null;
  image_urls: string[] | null;
  video_url: string | null;
  primary_image_index: number;
  is_active: boolean;
  estimated_days: number | null;
  is_featured: boolean;
  material_type: "resin" | "filament" | "both";
  stock_quantity: number | null;
  colors: any[] | null;
  options: any[] | null;
  is_preorder: boolean;
  preorder_end_date: string | null;
  preorder_queue_total: number;
  preorder_queue_current: number;
  allow_partial_payment: boolean;
  allow_wallet_payment: boolean;
  category_ids: string[] | null;
}

type ProductFilter = "all" | "active" | "hidden" | "featured";
type ViewMode = "grid" | "list";
type StoreTab = "products" | "categories" | "reels" | "reviews" | "settings";

const emptyFormData: ProductFormData = {
  title: "", description: "", price_iqd: "", original_price_iqd: "", estimated_days: "",
  is_active: true, is_featured: false, material_type: "", category_ids: [],
  stock_quantity: "", colors: [], options: [],
  is_preorder: false, preorder_end_date: "", preorder_queue_total: "",
  allow_partial_payment: false, allow_wallet_payment: true,
};

const emptyMediaState: MediaState = { image_urls: [], video_url: "", primary_image_index: 0 };

export default function CommunityMerchantStore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
  const [productToDelete, setProductToDelete] = useState<string | null>(null);
  const [productFilter, setProductFilter] = useState<ProductFilter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [storeTab, setStoreTab] = useState<StoreTab>("products");
  const [adDialogOpen, setAdDialogOpen] = useState(false);
  const [formData, setFormData] = useState<ProductFormData>(emptyFormData);
  const [mediaState, setMediaState] = useState<MediaState>(emptyMediaState);

  // Fetch merchant application
  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-app", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id, specialty, is_verified, badge_tier, store_paused, store_pause_end_date, store_pause_message")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch merchant payment methods from public profile
  const { data: merchantSettings, refetch: refetchMerchantSettings } = useQuery({
    queryKey: ["merchant-settings", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("accepted_payment_methods, delivery_price_iqd")
        .eq("id", merchantApp!.id)
        .maybeSingle();
      if (error) throw error;
      return {
        paymentMethods: (data?.accepted_payment_methods as string[]) || ['full_prepayment'],
        deliveryPrice: (data?.delivery_price_iqd as number) ?? 5000,
      };
    },
  });

  const paymentMethods = merchantSettings?.paymentMethods || ['full_prepayment'];
  const deliveryPrice = merchantSettings?.deliveryPrice ?? 5000;

  const updatePaymentMethods = useMutation({
    mutationFn: async (methods: string[]) => {
      const { error } = await supabase
        .from("merchant_public_profiles")
        .update({ accepted_payment_methods: methods } as any)
        .eq("id", merchantApp!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMerchantSettings();
      toast({ title: "تم تحديث خيارات الدفع" });
    },
  });

  const updateDeliveryPrice = useMutation({
    mutationFn: async (price: number) => {
      const { error } = await supabase
        .from("merchant_public_profiles")
        .update({ delivery_price_iqd: price } as any)
        .eq("id", merchantApp!.id);
      if (error) throw error;
    },
    onSuccess: () => {
      refetchMerchantSettings();
      toast({ title: "تم تحديث سعر التوصيل" });
    },
  });

  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from("profiles").select("username").eq("id", user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: selectedFrame } = useQuery({
    queryKey: ["selected-frame", merchantApp?.selected_frame_id],
    enabled: !!merchantApp?.selected_frame_id,
    queryFn: async () => {
      const { data, error } = await supabase.from("avatar_frames").select("id, name_ar, image_url").eq("id", merchantApp!.selected_frame_id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["merchant-products", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("*")
        .eq("merchant_id", merchantApp!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MerchantProduct[];
    },
  });

  // Fetch recent reviews
  const { data: recentReviews = [] } = useQuery({
    queryKey: ["merchant-reviews", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("id, rating, comment, created_at, user_id")
        .eq("merchant_id", merchantApp!.id)
        .order("created_at", { ascending: false })
        .limit(20);
      if (error) throw error;
      return data || [];
    },
  });

  const { data: storeStats } = useQuery({
    queryKey: ["store-stats", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const [ordersRes, ratingsRes, conversationsRes] = await Promise.all([
        supabase.from("chat_orders").select("id, status", { count: "exact" }).eq("seller_id", merchantApp!.id),
        supabase.from("merchant_ratings").select("rating").eq("merchant_id", merchantApp!.id),
        supabase.from("listing_conversations").select("id", { count: "exact" }).or(`user_one.eq.${user?.id},user_two.eq.${user?.id}`),
      ]);
      const totalOrders = ordersRes.count || 0;
      const completedOrders = ordersRes.data?.filter(o => o.status === "delivered").length || 0;
      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;
      return { totalOrders, completedOrders, avgRating, totalRatings: ratings.length, conversations: conversationsRes.count || 0 };
    },
  });

  const filteredProducts = products.filter((p) => {
    if (productFilter === "all") return true;
    if (productFilter === "active") return p.is_active;
    if (productFilter === "hidden") return !p.is_active;
    if (productFilter === "featured") return p.is_featured;
    return true;
  });

  const productCounts = {
    all: products.length,
    active: products.filter(p => p.is_active).length,
    hidden: products.filter(p => !p.is_active).length,
    featured: products.filter(p => p.is_featured).length,
  };

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload: any = {
        merchant_id: merchantApp!.id,
        title: formData.title.trim(),
        description: formData.description.trim() || null,
        price_iqd: formData.price_iqd ? parseInt(formData.price_iqd, 10) : null,
        original_price_iqd: formData.original_price_iqd ? parseInt(formData.original_price_iqd, 10) : null,
        image_urls: mediaState.image_urls.length > 0 ? mediaState.image_urls : null,
        video_url: mediaState.video_url || null,
        primary_image_index: mediaState.primary_image_index,
        estimated_days: formData.estimated_days ? parseInt(formData.estimated_days, 10) : null,
        is_active: formData.is_active,
        is_featured: formData.is_featured,
        material_type: formData.material_type,
        category_ids: formData.category_ids.length > 0 ? formData.category_ids : null,
        stock_quantity: formData.stock_quantity ? parseInt(formData.stock_quantity, 10) : null,
        colors: formData.colors.length > 0 ? formData.colors : [],
        options: formData.options.length > 0 ? formData.options : [],
        is_preorder: formData.is_preorder,
        preorder_end_date: formData.preorder_end_date ? new Date(formData.preorder_end_date).toISOString() : null,
        preorder_queue_total: formData.preorder_queue_total ? parseInt(formData.preorder_queue_total, 10) : 0,
        allow_partial_payment: formData.allow_partial_payment,
        allow_wallet_payment: formData.allow_wallet_payment,
      };

      if (selectedProduct) {
        const { error } = await supabase.from("merchant_products").update(payload).eq("id", selectedProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
      setProductDialogOpen(false);
      resetForm();
      toast({ title: selectedProduct ? "تم التحديث" : "تمت الإضافة", description: "المنتج حُفظ بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ المنتج.", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      toast({ title: "تم الحذف" });
    },
  });

  const resetForm = () => {
    setSelectedProduct(null);
    setFormData(emptyFormData);
    setMediaState(emptyMediaState);
  };

  const handleOpenEdit = (product: MerchantProduct) => {
    setSelectedProduct(product);
    setFormData({
      title: product.title,
      description: product.description || "",
      price_iqd: product.price_iqd?.toString() || "",
      original_price_iqd: product.original_price_iqd?.toString() || "",
      estimated_days: product.estimated_days?.toString() || "",
      is_active: product.is_active,
      is_featured: product.is_featured || false,
      material_type: product.material_type || "both",
      category_ids: product.category_ids || [],
      stock_quantity: product.stock_quantity?.toString() || "",
      colors: Array.isArray(product.colors) ? product.colors : [],
      options: Array.isArray(product.options) ? product.options : [],
      is_preorder: product.is_preorder || false,
      preorder_end_date: product.preorder_end_date?.split("T")[0] || "",
      preorder_queue_total: product.preorder_queue_total?.toString() || "",
      allow_partial_payment: product.allow_partial_payment || false,
      allow_wallet_payment: product.allow_wallet_payment !== false,
    });
    setMediaState({
      image_urls: product.image_urls || [],
      video_url: product.video_url || "",
      primary_image_index: product.primary_image_index,
    });
    setProductDialogOpen(true);
  };

  const handleOpenAdd = () => { resetForm(); setProductDialogOpen(true); };
  const handleOpenDetail = (product: MerchantProduct) => { setSelectedProduct(product); setDetailDialogOpen(true); };
  const handleDeleteClick = (productId: string) => { setProductToDelete(productId); setDeleteDialogOpen(true); };

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  const getMaterialLabel = (type?: string | null) => {
    if (type === "resin") return "رزن";
    if (type === "filament") return "فلمنت";
    if (type === "both") return "كلاهما";
    return null;
  };

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-80 rounded-[2rem] mb-8" />
          <Skeleton className="h-24 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="aspect-square rounded-2xl" />)}
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 p-12 text-center rounded-3xl">
            <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mx-auto mb-6">
              <Store className="h-10 w-10 text-muted-foreground" />
            </div>
            <p className="text-xl font-bold mb-2">لا يمكن الوصول لهذه الصفحة</p>
            <p className="text-sm text-muted-foreground mb-8">هذه الصفحة متاحة للتجار المقبولين فقط</p>
            <Button variant="outline" size="lg" onClick={() => navigate("/community")}>العودة للمجتمع</Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/5">
      <main className="container mx-auto px-4 py-8 pt-20 max-w-6xl">
        {/* Hero Section */}
        <StoreHeroSection
          merchantApp={{ display_name: merchantApp.display_name, bio: merchantApp.bio, store_image_url: merchantApp.store_image_url, specialty: merchantApp.specialty, is_verified: merchantApp.is_verified, badge_tier: merchantApp.badge_tier }}
          selectedFrame={selectedFrame}
          socialLinks={socialLinks}
          isOwner
          username={profile?.username}
          onSettingsClick={() => setProfileEditorOpen(true)}
          showContactButton={false}
        />

        {/* Stats */}
        <div className="mb-6">
          <StoreStatsGrid stats={{ activeProducts: productCounts.active, completedOrders: storeStats?.completedOrders || 0, avgRating: storeStats?.avgRating || 0, totalRatings: storeStats?.totalRatings || 0, conversations: storeStats?.conversations || 0 }} variant="merchant" />
        </div>

        {/* Main Tabs */}
        <Tabs value={storeTab} onValueChange={(v) => setStoreTab(v as StoreTab)} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="h-10 flex-wrap">
              <TabsTrigger value="products" className="gap-1.5 text-xs"><Package className="h-3.5 w-3.5" />المنتجات</TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5 text-xs"><FolderOpen className="h-3.5 w-3.5" />الأقسام</TabsTrigger>
              <TabsTrigger value="reels" className="gap-1.5 text-xs"><Film className="h-3.5 w-3.5" />الريلز</TabsTrigger>
              <TabsTrigger value="reviews" className="gap-1.5 text-xs relative">
                <Star className="h-3.5 w-3.5" />التقييمات
                {recentReviews.length > 0 && <span className="absolute -top-1 -left-1 h-4 w-4 rounded-full bg-primary text-[9px] text-primary-foreground flex items-center justify-center">{recentReviews.length}</span>}
              </TabsTrigger>
              <TabsTrigger value="settings" className="gap-1.5 text-xs"><Settings className="h-3.5 w-3.5" />الإعدادات</TabsTrigger>
            </TabsList>

            {storeTab === "products" && (
              <div className="flex items-center gap-2">
                <Button size="sm" variant="outline" onClick={() => setAdDialogOpen(true)} className="gap-1.5 border-primary/30 text-primary hover:bg-primary/10"><Megaphone className="h-4 w-4" />ترويج متجري</Button>
                <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 shadow-lg"><Plus className="h-4 w-4" />إضافة منتج</Button>
              </div>
            )}
            {storeTab === "reels" && merchantApp?.id && (
              <MerchantReelUpload merchantId={merchantApp.id}>
                <Button size="sm" variant="outline" className="gap-1.5"><Film className="h-4 w-4" />رفع ريل</Button>
              </MerchantReelUpload>
            )}
          </div>

          {/* Products Tab */}
          <TabsContent value="products" className="space-y-4">
            <ProductFilterTabs activeFilter={productFilter} onFilterChange={setProductFilter} viewMode={viewMode} onViewModeChange={setViewMode} counts={productCounts} />

            {filteredProducts.length === 0 ? (
              <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 p-12 rounded-2xl">
                <div className="text-center">
                  <div className="h-16 w-16 rounded-2xl bg-muted/20 flex items-center justify-center mx-auto mb-4">
                    <Sparkles className="h-8 w-8 text-muted-foreground/30" />
                  </div>
                  <p className="text-sm font-bold mb-1">لا توجد منتجات</p>
                  <p className="text-xs text-muted-foreground mb-4">أضف منتجك الأول لبدء البيع</p>
                  <Button size="sm" onClick={handleOpenAdd} className="gap-1.5"><Plus className="h-4 w-4" />إضافة منتج</Button>
                </div>
              </Card>
            ) : (
              <div className={viewMode === "grid" ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" : "flex flex-col gap-3"}>
                {filteredProducts.map((product) => (
                  <ProductCardEnhanced key={product.id} product={product} variant="merchant" viewMode={viewMode}
                    onView={() => handleOpenDetail(product)} onEdit={() => handleOpenEdit(product)} onDelete={() => handleDeleteClick(product.id)} />
                ))}
              </div>
            )}
          </TabsContent>

          {/* Categories Tab */}
          <TabsContent value="categories">
            {merchantApp?.id && <MerchantCategoriesManager merchantId={merchantApp.id} />}
          </TabsContent>

          {/* Reels Tab */}
          <TabsContent value="reels">
            {merchantApp?.id && <MerchantReelsSection merchantId={merchantApp.id} />}
          </TabsContent>

          {/* Reviews Tab */}
          <TabsContent value="reviews">
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 rounded-2xl p-6">
              <h3 className="font-bold text-sm mb-4 flex items-center gap-2"><Star className="h-4 w-4 text-amber-500" />التقييمات الأخيرة ({recentReviews.length})</h3>
              {recentReviews.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground text-sm">لا توجد تقييمات بعد</div>
              ) : (
                <div className="space-y-3">
                  {recentReviews.map((review: any) => (
                    <div key={review.id} className="p-3 rounded-xl border border-border/50 bg-muted/10">
                      <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: 5 }).map((_, i) => (
                            <Star key={i} className={`h-3 w-3 ${i < review.rating ? "fill-amber-500 text-amber-500" : "text-muted-foreground/30"}`} />
                          ))}
                        </div>
                        <span className="text-[10px] text-muted-foreground">{new Date(review.created_at).toLocaleDateString("ar-IQ")}</span>
                      </div>
                      {review.comment && <p className="text-xs text-muted-foreground">{review.comment}</p>}
                      <Button size="sm" variant="ghost" className="h-6 text-[10px] gap-1 mt-2 text-primary" onClick={() => navigate(`/community/messages?user_id=${review.user_id}`)}>
                        <MessageSquare className="h-3 w-3" />رد
                      </Button>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </TabsContent>

          {/* Settings Tab */}
          <TabsContent value="settings" className="space-y-3">
            {/* Quick Actions - compact row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setProfileEditorOpen(true)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-accent/10 transition-colors text-right"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Edit2 className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">تعديل الملف</p>
                  <p className="text-[9px] text-muted-foreground">الصورة والبايو</p>
                </div>
              </button>
              <button
                onClick={() => navigate(`/store/${merchantApp.id}`)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-accent/10 transition-colors text-right"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <ExternalLink className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">معاينة المتجر</p>
                  <p className="text-[9px] text-muted-foreground">كزائر</p>
                </div>
              </button>
            </div>

            {/* Ad + Settings row */}
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setAdDialogOpen(true)}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-primary/20 bg-primary/5 hover:bg-primary/10 transition-colors text-right"
              >
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                  <Megaphone className="h-3.5 w-3.5 text-primary" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">ترويج متجري</p>
                  <p className="text-[9px] text-muted-foreground">إعلان مميز</p>
                </div>
              </button>
              <button
                onClick={() => setStoreTab("settings")}
                className="flex items-center gap-2 p-2.5 rounded-xl border border-border/50 bg-card hover:bg-accent/10 transition-colors text-right"
              >
                <div className="h-8 w-8 rounded-lg bg-muted/30 flex items-center justify-center shrink-0">
                  <Settings className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0">
                  <p className="text-[11px] font-bold truncate">إعدادات المتجر</p>
                  <p className="text-[9px] text-muted-foreground">إيقاف مؤقت</p>
                </div>
              </button>
            </div>

            {/* Merchant Discounts */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <MerchantDiscountsManager merchantId={merchantApp.id} merchantName={merchantApp.display_name || "متجر"} />
            </div>

            {/* Payment Methods */}
            <div className="rounded-xl border border-border/50 bg-card p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <CreditCard className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold">خيارات الدفع المقبولة</h3>
              </div>
              <p className="text-[10px] text-muted-foreground">حدد طرق الدفع التي تقبلها من العملاء</p>
              <div className="space-y-2">
                {[
                  { key: 'full_prepayment', label: 'دفع مقدم كامل', desc: 'افتراضي' },
                  { key: 'half_payment', label: 'دفع نصف المبلغ', desc: '50% مقدماً' },
                  { key: 'quarter_payment', label: 'دفع ربع المبلغ', desc: '25% مقدماً' },
                  { key: 'cash_on_delivery', label: 'دفع عند الاستلام', desc: 'بدون مقدم' },
                ].map(method => {
                  const isChecked = paymentMethods.includes(method.key);
                  return (
                    <label key={method.key} className="flex items-center gap-3 p-2.5 rounded-lg border border-border/40 bg-muted/10 cursor-pointer hover:bg-accent/10 transition-colors">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          const newMethods = isChecked
                            ? paymentMethods.filter(m => m !== method.key)
                            : [...paymentMethods, method.key];
                          if (newMethods.length === 0) {
                            toast({ title: "يجب اختيار طريقة دفع واحدة على الأقل", variant: "destructive" });
                            return;
                          }
                          updatePaymentMethods.mutate(newMethods);
                        }}
                        className="h-4 w-4 rounded border-border accent-primary"
                      />
                      <div className="flex-1">
                        <p className="text-[11px] font-bold">{method.label}</p>
                        <p className="text-[9px] text-muted-foreground">{method.desc}</p>
                      </div>
                    </label>
                  );
                })}
              </div>
            </div>

            {/* Delivery Price */}
            <div className="rounded-xl border border-border/50 bg-card p-3.5 space-y-3">
              <div className="flex items-center gap-2">
                <Truck className="h-4 w-4 text-primary" />
                <h3 className="text-xs font-bold">سعر التوصيل</h3>
              </div>
              <p className="text-[10px] text-muted-foreground">حدد سعر التوصيل الذي سيُضاف لطلبات العملاء (لا يُحسب ضمن أرباحك)</p>
              <div className="flex items-center gap-2">
                <input
                  type="number"
                  min="0"
                  step="1000"
                  value={deliveryPrice || ''}
                  placeholder="0"
                  onChange={(e) => {
                    const val = parseInt(e.target.value) || 0;
                    updateDeliveryPrice.mutate(val);
                  }}
                  className="flex-1 bg-background border border-border/50 rounded-lg px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
                />
                <span className="text-xs text-muted-foreground shrink-0">د.ع</span>
              </div>
              {deliveryPrice > 0 && (
                <p className="text-[10px] text-emerald-500 font-medium">✓ سيُضاف {deliveryPrice.toLocaleString()} د.ع كرسوم توصيل لطلبات العملاء</p>
              )}
            </div>

            {/* Store Pause */}
            <StorePauseControl merchantId={merchantApp.id} storePaused={merchantApp.store_paused || false} storePauseEndDate={merchantApp.store_pause_end_date} storePauseMessage={merchantApp.store_pause_message} />
          </TabsContent>
        </Tabs>
      </main>

      {/* Product Form Dialog */}
      <ProductFormDialog
        open={productDialogOpen}
        onOpenChange={setProductDialogOpen}
        formData={formData}
        setFormData={setFormData}
        mediaState={mediaState}
        setMediaState={setMediaState}
        merchantId={merchantApp.id}
        isEditing={!!selectedProduct}
        onSave={() => saveMutation.mutate()}
        isSaving={saveMutation.isPending}
      />

      {/* Enhanced Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border-border/50 p-0" dir="rtl">
          {selectedProduct && (
            <ScrollArea className="max-h-[90vh]">
              <div className="relative">
                {/* Image Gallery */}
                {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                  <div className="relative">
                    <AspectRatio ratio={4/3}>
                      <img src={selectedProduct.image_urls[selectedProduct.primary_image_index] || selectedProduct.image_urls[0]} alt={selectedProduct.title} className="w-full h-full object-cover" />
                    </AspectRatio>
                    {/* Badges overlay */}
                    <div className="absolute top-3 right-3 flex gap-1.5">
                      {selectedProduct.is_preorder && <Badge className="bg-amber-500 text-white border-0">حجز مسبق</Badge>}
                      {selectedProduct.is_featured && <Badge className="bg-amber-500/90 text-white border-0"><Sparkles className="h-3 w-3 mr-1" />مميز</Badge>}
                      {!selectedProduct.is_active && <Badge variant="secondary"><EyeOff className="h-3 w-3 mr-1" />مخفي</Badge>}
                    </div>
                    {selectedProduct.image_urls.length > 1 && (
                      <div className="absolute bottom-3 left-3 right-3 flex gap-1.5 overflow-x-auto">
                        {selectedProduct.image_urls.map((url, i) => (
                          <img key={i} src={url} className={`h-10 w-10 rounded-lg object-cover border-2 ${i === selectedProduct.primary_image_index ? "border-primary" : "border-white/30"}`} />
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="h-40 bg-muted/20 flex items-center justify-center"><Sparkles className="h-12 w-12 text-muted-foreground/20" /></div>
                )}
              </div>

              <div className="p-5 space-y-4">
                {/* Title & Description */}
                <div>
                  <h2 className="text-lg font-bold text-foreground mb-1">{selectedProduct.title}</h2>
                  {selectedProduct.description && <p className="text-sm text-muted-foreground leading-relaxed">{selectedProduct.description}</p>}
                </div>

                {/* Price Section */}
                <div className="flex items-baseline gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  {selectedProduct.price_iqd ? (
                    <>
                      <span className="text-2xl font-bold text-primary">{selectedProduct.price_iqd.toLocaleString()}</span>
                      <span className="text-sm text-muted-foreground">د.ع</span>
                      {selectedProduct.original_price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                        <span className="text-sm text-muted-foreground line-through mr-auto">{selectedProduct.original_price_iqd.toLocaleString()} د.ع</span>
                      )}
                    </>
                  ) : (
                    <span className="text-muted-foreground text-sm">لم يتم تحديد السعر</span>
                  )}
                </div>

                {/* Specs Grid */}
                <div className="grid grid-cols-2 gap-2">
                  {getMaterialLabel(selectedProduct.material_type) && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10">
                      <Layers className="h-4 w-4 text-primary" />
                      <div><p className="text-[10px] text-muted-foreground">المادة</p><p className="text-xs font-bold">{getMaterialLabel(selectedProduct.material_type)}</p></div>
                    </div>
                  )}
                  {selectedProduct.estimated_days && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10">
                      <Clock3 className="h-4 w-4 text-primary" />
                      <div><p className="text-[10px] text-muted-foreground">مدة التنفيذ</p><p className="text-xs font-bold">{selectedProduct.estimated_days} يوم</p></div>
                    </div>
                  )}
                  <div className="flex items-center gap-2 p-2.5 rounded-lg border border-border/50 bg-muted/10">
                    <Box className="h-4 w-4 text-primary" />
                    <div><p className="text-[10px] text-muted-foreground">المخزون</p><p className="text-xs font-bold">{selectedProduct.stock_quantity !== null ? selectedProduct.stock_quantity : "غير محدود"}</p></div>
                  </div>
                  {selectedProduct.is_preorder && (
                    <div className="flex items-center gap-2 p-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5">
                      <Clock3 className="h-4 w-4 text-amber-500" />
                      <div><p className="text-[10px] text-muted-foreground">الطابور</p><p className="text-xs font-bold text-amber-600">{selectedProduct.preorder_queue_current || 0}/{selectedProduct.preorder_queue_total}</p></div>
                    </div>
                  )}
                </div>

                {/* Payment Options */}
                <div className="flex flex-wrap gap-1.5">
                  {selectedProduct.allow_wallet_payment && <Badge variant="outline" className="text-[10px] gap-1"><Wallet className="h-3 w-3" />دفع محفظة</Badge>}
                  {selectedProduct.allow_partial_payment && <Badge variant="outline" className="text-[10px] gap-1"><CreditCard className="h-3 w-3" />دفع جزئي</Badge>}
                  <Badge variant="outline" className={`text-[10px] ${selectedProduct.is_active ? "text-green-500 border-green-500/30" : "text-muted-foreground"}`}>
                    {selectedProduct.is_active ? "نشط" : "مخفي"}
                  </Badge>
                </div>

                {/* Colors */}
                {Array.isArray(selectedProduct.colors) && selectedProduct.colors.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><Palette className="h-3.5 w-3.5 text-primary" />الألوان ({selectedProduct.colors.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedProduct.colors as any[]).map((c: any, i: number) => (
                        <div key={i} className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-border/50 bg-muted/10">
                          <span className="h-4 w-4 rounded-full border border-border/50" style={{ backgroundColor: c.hex_code }} />
                          <span className="text-xs">{c.name || "بدون اسم"}</span>
                          {c.stock_quantity !== null && <span className="text-[9px] text-muted-foreground">(مخزون: {c.stock_quantity})</span>}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Options */}
                {Array.isArray(selectedProduct.options) && selectedProduct.options.length > 0 && (
                  <div>
                    <p className="text-xs font-bold mb-2 flex items-center gap-1.5"><Scale className="h-3.5 w-3.5 text-primary" />الخيارات ({selectedProduct.options.length})</p>
                    <div className="flex flex-wrap gap-2">
                      {(selectedProduct.options as any[]).map((o: any, i: number) => (
                        <Badge key={i} variant="outline" className="text-[10px] gap-1">
                          {o.name}
                          {o.price_adjustment ? ` (${o.price_adjustment > 0 ? "+" : ""}${o.price_adjustment.toLocaleString()})` : ""}
                          {o.stock_quantity !== null && ` • مخزون: ${o.stock_quantity}`}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}

                <Separator />

                {/* Actions */}
                <div className="flex gap-2">
                  <Button size="sm" className="flex-1 gap-1.5" onClick={() => { setDetailDialogOpen(false); handleOpenEdit(selectedProduct); }}>
                    <Edit2 className="h-3.5 w-3.5" />تعديل المنتج
                  </Button>
                  <Button size="sm" variant="outline" className="gap-1.5" onClick={() => navigate(`/store/${merchantApp.id}`)}>
                    <ExternalLink className="h-3.5 w-3.5" />عرض المتجر
                  </Button>
                  <Button size="sm" variant="destructive" className="gap-1.5" onClick={() => { setDetailDialogOpen(false); handleDeleteClick(selectedProduct.id); }}>
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </ScrollArea>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-sm rounded-2xl" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-base flex items-center gap-2 text-destructive"><AlertCircle className="h-4 w-4" />تأكيد الحذف</DialogTitle>
            <DialogDescription className="text-xs">هل أنت متأكد من حذف هذا المنتج؟</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button variant="destructive" size="sm" onClick={() => productToDelete && deleteMutation.mutate(productToDelete)} disabled={deleteMutation.isPending}>
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Profile Editor */}
      <StoreProfileEditor
        open={profileEditorOpen}
        onOpenChange={setProfileEditorOpen}
        merchantApp={{
          id: merchantApp.id,
          display_name: merchantApp.display_name,
          bio: merchantApp.bio,
          store_image_url: merchantApp.store_image_url,
          social_links: socialLinks || null,
          selected_frame_id: merchantApp.selected_frame_id,
          specialty: (merchantApp.specialty as "resin" | "filament" | "both") || undefined,
        }}
      />
      {/* Ad Booking Dialog */}
      <MerchantAdBookingDialog
        open={adDialogOpen}
        onOpenChange={setAdDialogOpen}
        merchantId={merchantApp.id}
      />
    </div>
  );
}
