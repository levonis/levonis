import { useState } from "react";
import MerchantReelUpload from "@/components/reels/MerchantReelUpload";
import MerchantReelsSection from "@/components/merchant/MerchantReelsSection";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Store, Plus, Star, Eye, Package, Sparkles, Film, FolderOpen } from "lucide-react";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { AlertCircle } from "lucide-react";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { Badge } from "@/components/ui/badge";

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
type StoreTab = "products" | "categories";

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

        {/* Store Pause Control */}
        <div className="mb-6">
          <StorePauseControl merchantId={merchantApp.id} storePaused={merchantApp.store_paused || false} storePauseEndDate={merchantApp.store_pause_end_date} storePauseMessage={merchantApp.store_pause_message} />
        </div>

        {/* Main Tabs: Products & Categories */}
        <Tabs value={storeTab} onValueChange={(v) => setStoreTab(v as StoreTab)} className="space-y-6">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <TabsList className="h-10">
              <TabsTrigger value="products" className="gap-1.5 text-sm"><Package className="h-4 w-4" />المنتجات</TabsTrigger>
              <TabsTrigger value="categories" className="gap-1.5 text-sm"><FolderOpen className="h-4 w-4" />الأقسام</TabsTrigger>
            </TabsList>

            {storeTab === "products" && (
              <div className="flex items-center gap-2">
                {merchantApp?.id && (
                  <MerchantReelUpload merchantId={merchantApp.id}>
                    <Button size="sm" variant="outline" className="gap-1.5"><Film className="h-4 w-4" />رفع ريل</Button>
                  </MerchantReelUpload>
                )}
                <Button size="sm" onClick={handleOpenAdd} className="gap-1.5 shadow-lg"><Plus className="h-4 w-4" />إضافة منتج</Button>
              </div>
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
        </Tabs>

        {/* Reels */}
        {merchantApp?.id && <MerchantReelsSection merchantId={merchantApp.id} />}
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

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden rounded-2xl border-border/50" dir="rtl">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-base font-bold flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              {selectedProduct?.title}
            </DialogTitle>
            <DialogDescription className="text-xs">معاينة المنتج</DialogDescription>
          </DialogHeader>
          {selectedProduct && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto py-3">
              {selectedProduct.image_urls?.[0] && (
                <div className="relative rounded-xl overflow-hidden bg-muted">
                  <AspectRatio ratio={1}>
                    <img src={selectedProduct.image_urls[selectedProduct.primary_image_index] || selectedProduct.image_urls[0]} alt={selectedProduct.title} className="w-full h-full object-contain" />
                  </AspectRatio>
                  {selectedProduct.is_preorder && <Badge className="absolute top-2 right-2 bg-amber-500 text-white">حجز مسبق</Badge>}
                  {selectedProduct.stock_quantity !== null && <Badge variant="secondary" className="absolute top-2 left-2 text-[10px]">مخزون: {selectedProduct.stock_quantity}</Badge>}
                </div>
              )}

              <div className="flex items-baseline gap-2 p-3 rounded-xl bg-primary/5 border border-primary/20">
                {selectedProduct.price_iqd ? (
                  <><span className="text-xl font-bold text-primary">{selectedProduct.price_iqd.toLocaleString()}</span><span className="text-xs text-muted-foreground">د.ع</span></>
                ) : (
                  <span className="text-muted-foreground text-sm">لم يتم تحديد السعر</span>
                )}
              </div>

              {/* Colors preview */}
              {Array.isArray(selectedProduct.colors) && selectedProduct.colors.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedProduct.colors as any[]).map((c: any, i: number) => (
                    <div key={i} className="flex items-center gap-1 px-2 py-1 rounded-lg border border-border/50 text-[10px]">
                      <span className="h-3 w-3 rounded-full border" style={{ backgroundColor: c.hex_code }} />
                      {c.name}
                    </div>
                  ))}
                </div>
              )}

              {/* Options preview */}
              {Array.isArray(selectedProduct.options) && selectedProduct.options.length > 0 && (
                <div className="flex flex-wrap gap-1.5">
                  {(selectedProduct.options as any[]).map((o: any, i: number) => (
                    <Badge key={i} variant="outline" className="text-[10px]">
                      {o.name} {o.price_adjustment ? `(${o.price_adjustment > 0 ? "+" : ""}${o.price_adjustment.toLocaleString()})` : ""}
                    </Badge>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" className="flex-1" onClick={() => { setDetailDialogOpen(false); handleOpenEdit(selectedProduct); }}>تعديل</Button>
                <Button size="sm" variant="outline" onClick={() => navigate(`/store/${merchantApp.id}`)}>عرض المتجر</Button>
              </div>
            </div>
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
    </div>
  );
}
