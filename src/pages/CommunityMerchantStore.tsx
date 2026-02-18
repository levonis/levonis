import { useState } from "react";
import MerchantReelUpload from "@/components/reels/MerchantReelUpload";
import MerchantReelsSection from "@/components/merchant/MerchantReelsSection";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Plus, Star, Eye, Package, Play, Sparkles, AlertCircle, Film
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import { Alert, AlertDescription } from "@/components/ui/alert";
import MerchantProductMediaUpload from "@/components/merchant/MerchantProductMediaUpload";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import StoreHeroSection from "@/components/merchant/StoreHeroSection";
import StoreStatsGrid from "@/components/merchant/StoreStatsGrid";
import ProductFilterTabs from "@/components/merchant/ProductFilterTabs";
import ProductCardEnhanced from "@/components/merchant/ProductCardEnhanced";

import { Droplets, Layers } from "lucide-react";

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
}

type MaterialType = "resin" | "filament" | "both";
type ProductFilter = "all" | "active" | "hidden" | "featured";
type ViewMode = "grid" | "list";

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

  const [formData, setFormData] = useState({
    title: "",
    description: "",
    price_iqd: "",
    original_price_iqd: "",
    estimated_days: "",
    is_active: true,
    is_featured: false,
    material_type: "" as MaterialType | "",
    category_ids: [] as string[],
  });

  const [mediaState, setMediaState] = useState({
    image_urls: [] as string[],
    video_url: "",
    primary_image_index: 0,
  });

  // Fetch merchant application
  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-app", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id, specialty, is_verified, badge_tier")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch profile for username
  const { data: profile } = useQuery({
    queryKey: ["profile", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch selected frame
  const { data: selectedFrame } = useQuery({
    queryKey: ["selected-frame", merchantApp?.selected_frame_id],
    enabled: !!merchantApp?.selected_frame_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("id, name_ar, image_url")
        .eq("id", merchantApp!.selected_frame_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  // Fetch merchant products
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

  // Fetch store stats
  const { data: storeStats } = useQuery({
    queryKey: ["store-stats", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const [ordersRes, ratingsRes, conversationsRes] = await Promise.all([
        supabase
          .from("chat_orders")
          .select("id, status", { count: "exact" })
          .eq("seller_id", merchantApp!.id),
        supabase
          .from("merchant_ratings")
          .select("rating")
          .eq("merchant_id", merchantApp!.id),
        supabase
          .from("listing_conversations")
          .select("id", { count: "exact" })
          .or(`user_one.eq.${user?.id},user_two.eq.${user?.id}`)
      ]);
      
      const totalOrders = ordersRes.count || 0;
      const completedOrders = ordersRes.data?.filter(o => o.status === "delivered").length || 0;
      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;
      const conversations = conversationsRes.count || 0;
      
      return { totalOrders, completedOrders, avgRating, totalRatings: ratings.length, conversations };
    },
  });

  // Filter products
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

  // Save product mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
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
      };

      if (selectedProduct) {
        const { error } = await supabase
          .from("merchant_products")
          .update(payload)
          .eq("id", selectedProduct.id);
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
      toast({ title: "خطأ", description: "فشل حفظ المنتج. قد تكون وصلت للحد الأقصى (3 منتجات مميزة).", variant: "destructive" });
    },
  });

  // Delete product mutation
  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
      setDeleteDialogOpen(false);
      setProductToDelete(null);
      toast({ title: "تم الحذف", description: "المنتج حُذف بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف المنتج.", variant: "destructive" });
    },
  });

  const resetForm = () => {
    setSelectedProduct(null);
    setFormData({
      title: "",
      description: "",
      price_iqd: "",
      original_price_iqd: "",
      estimated_days: "",
      is_active: true,
      is_featured: false,
      material_type: "",
      category_ids: [],
    });
    setMediaState({
      image_urls: [],
      video_url: "",
      primary_image_index: 0,
    });
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
      category_ids: (product as any).category_ids || [],
    });
    setMediaState({
      image_urls: product.image_urls || [],
      video_url: product.video_url || "",
      primary_image_index: product.primary_image_index,
    });
    setProductDialogOpen(true);
  };

  const handleOpenAdd = () => {
    resetForm();
    setProductDialogOpen(true);
  };

  const handleOpenDetail = (product: MerchantProduct) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  };

  const handleDeleteClick = (productId: string) => {
    setProductToDelete(productId);
    setDeleteDialogOpen(true);
  };

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-80 rounded-[2rem] mb-8" />
          <Skeleton className="h-24 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-2xl" />
            ))}
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
            <Button variant="outline" size="lg" onClick={() => navigate("/community")}>
              العودة للمجتمع
            </Button>
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
          merchantApp={{
            display_name: merchantApp.display_name,
            bio: merchantApp.bio,
            store_image_url: merchantApp.store_image_url,
            specialty: merchantApp.specialty,
            is_verified: merchantApp.is_verified,
            badge_tier: merchantApp.badge_tier,
          }}
          selectedFrame={selectedFrame}
          socialLinks={socialLinks}
          isOwner
          username={profile?.username}
          onSettingsClick={() => setProfileEditorOpen(true)}
          showContactButton={false}
        />

        {/* Stats Grid */}
        <div className="mb-8">
          <StoreStatsGrid
            stats={{
              activeProducts: productCounts.active,
              completedOrders: storeStats?.completedOrders || 0,
              avgRating: storeStats?.avgRating || 0,
              totalRatings: storeStats?.totalRatings || 0,
              conversations: storeStats?.conversations || 0,
            }}
            variant="merchant"
          />
        </div>

        {/* Products Section */}
        <div className="space-y-6">
          {/* Header & Add Button */}
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">إدارة المنتجات</h2>
                <p className="text-xs text-muted-foreground">أضف وعدل منتجاتك</p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              {merchantApp?.id && (
                <MerchantReelUpload merchantId={merchantApp.id}>
                  <Button size="lg" variant="outline" className="gap-2">
                    <Film className="h-5 w-5" />
                    رفع ريل
                  </Button>
                </MerchantReelUpload>
              )}
              <Button size="lg" onClick={handleOpenAdd} className="gap-2 shadow-lg hover:shadow-xl transition-all">
                <Plus className="h-5 w-5" />
                إضافة منتج جديد
              </Button>
            </div>
          </div>

          {/* Filter Tabs */}
          <ProductFilterTabs
            activeFilter={productFilter}
            onFilterChange={setProductFilter}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
            counts={productCounts}
          />

          {/* Products Grid/List */}
          {filteredProducts.length === 0 ? (
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 p-16 rounded-3xl">
              <div className="text-center">
                <div className="h-24 w-24 rounded-3xl bg-muted/20 flex items-center justify-center mx-auto mb-6">
                  <Sparkles className="h-12 w-12 text-muted-foreground/30" />
                </div>
                <p className="text-lg font-bold mb-2">
                  {productFilter === "all" ? "لا توجد منتجات بعد" : `لا توجد منتجات ${productFilter === "active" ? "نشطة" : productFilter === "hidden" ? "مخفية" : "مميزة"}`}
                </p>
                <p className="text-sm text-muted-foreground mb-6">أضف منتجك الأول لبدء البيع</p>
                <Button onClick={handleOpenAdd} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة منتج
                </Button>
              </div>
            </Card>
          ) : (
            <div className={viewMode === "grid" 
              ? "grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4" 
              : "flex flex-col gap-3"
            }>
              {filteredProducts.map((product) => (
                <ProductCardEnhanced
                  key={product.id}
                  product={product}
                  variant="merchant"
                  viewMode={viewMode}
                  onView={() => handleOpenDetail(product)}
                  onEdit={() => handleOpenEdit(product)}
                  onDelete={() => handleDeleteClick(product.id)}
                />
              ))}
            </div>
          )}
        </div>

        {/* Merchant Reels Section */}
        {merchantApp?.id && <MerchantReelsSection merchantId={merchantApp.id} />}
      </main>

      {/* Product Dialog */}
      <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
        <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden rounded-3xl border-border/50">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
            </DialogTitle>
            <DialogDescription>أضف تفاصيل منتجك ليظهر في متجرك</DialogDescription>
          </DialogHeader>

          <div className="space-y-5 max-h-[55vh] overflow-y-auto py-4 px-1">
            {/* Media Upload */}
            <div>
              <Label className="text-sm font-medium mb-2 block">الصور والفيديو</Label>
              <MerchantProductMediaUpload
                imageUrls={mediaState.image_urls}
                onImagesChange={(urls) => setMediaState(prev => ({ ...prev, image_urls: urls }))}
                videoUrl={mediaState.video_url}
                onVideoUrlChange={(url) => setMediaState(prev => ({ ...prev, video_url: url }))}
                primaryImageIndex={mediaState.primary_image_index}
                onPrimaryImageChange={(idx) => setMediaState(prev => ({ ...prev, primary_image_index: idx }))}
              />
            </div>

            {/* Title */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">اسم المنتج *</Label>
              <Input
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="مثال: مجسم شخصية أنمي"
                maxLength={100}
                className="h-11"
              />
            </div>

            {/* Description */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">الوصف</Label>
              <Textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="وصف تفصيلي للمنتج..."
                rows={3}
                maxLength={500}
              />
            </div>

            {/* Material Type */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">نوع المادة *</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "resin", label: "رزن", icon: Droplets, color: "text-blue-400" },
                  { value: "filament", label: "فلمنت", icon: Layers, color: "text-orange-400" },
                  { value: "both", label: "كلاهما", icons: [Droplets, Layers] },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormData({ ...formData, material_type: opt.value as MaterialType })}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      formData.material_type === opt.value
                        ? "bg-primary text-primary-foreground border-primary shadow-md"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {"icons" in opt ? (
                      <>
                        <Droplets className="h-4 w-4 text-blue-400" />
                        <Layers className="h-4 w-4 text-orange-400" />
                      </>
                    ) : (
                      <opt.icon className={`h-4 w-4 ${opt.color}`} />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Price Fields */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">السعر (د.ع)</Label>
                <Input
                  type="number"
                  value={formData.price_iqd}
                  onChange={(e) => setFormData({ ...formData, price_iqd: e.target.value })}
                  placeholder="25000"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">السعر قبل الخصم</Label>
                <Input
                  type="number"
                  value={formData.original_price_iqd}
                  onChange={(e) => setFormData({ ...formData, original_price_iqd: e.target.value })}
                  placeholder="30000"
                  className="h-11"
                />
              </div>
            </div>

            {/* Estimated Days */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">مدة التنفيذ (أيام)</Label>
              <Input
                type="number"
                value={formData.estimated_days}
                onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
                placeholder="3"
                className="h-11"
              />
            </div>

            {/* Switches */}
            <div className="grid grid-cols-2 gap-4">
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Eye className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">نشط للعرض</Label>
                </div>
                <Switch
                  checked={formData.is_active}
                  onCheckedChange={(c) => setFormData({ ...formData, is_active: c })}
                />
              </div>
              <div className="flex items-center justify-between p-4 rounded-xl border border-border/50 bg-muted/20">
                <div className="flex items-center gap-2">
                  <Star className="h-4 w-4 text-muted-foreground" />
                  <Label className="text-sm">منتج مميز</Label>
                </div>
                <Switch
                  checked={formData.is_featured}
                  onCheckedChange={(c) => setFormData({ ...formData, is_featured: c })}
                />
              </div>
            </div>
          </div>

          {/* Commission Notice */}
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ عمولة المنصة: <strong>1.7%</strong> تُخصم من كل عملية بيع. يتحكم الأدمن بنسبة العمولة.
            </AlertDescription>
          </Alert>
          <Alert className="border-amber-500/30 bg-amber-500/10">
            <AlertDescription className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ عمولة المنصة: <strong>1.7%</strong> تُخصم من كل عملية بيع. يتحكم الأدمن بنسبة العمولة.
            </AlertDescription>
          </Alert>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!formData.title.trim() || !formData.material_type || saveMutation.isPending}
              className="w-full h-12 text-base"
            >
              {saveMutation.isPending ? "جاري الحفظ..." : selectedProduct ? "حفظ التغييرات" : "إضافة المنتج"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden rounded-3xl border-border/50">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedProduct?.title}
            </DialogTitle>
            <DialogDescription>معاينة المنتج</DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
              {selectedProduct.image_urls?.[0] && (
                <div className="relative rounded-2xl overflow-hidden bg-muted">
                  <AspectRatio ratio={1}>
                    <img
                      src={selectedProduct.image_urls[selectedProduct.primary_image_index] || selectedProduct.image_urls[0]}
                      alt={selectedProduct.title}
                      className="w-full h-full object-contain"
                    />
                  </AspectRatio>
                  {!selectedProduct.is_active && (
                    <Badge className="absolute top-3 right-3" variant="secondary">مخفي</Badge>
                  )}
                  {selectedProduct.is_featured && (
                    <Badge className="absolute top-3 left-3 bg-amber-500 text-white">مميز</Badge>
                  )}
                </div>
              )}

              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground">{selectedProduct.description}</p>
              )}

              <div className="flex items-baseline gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                {selectedProduct.price_iqd ? (
                  <>
                    <span className="text-2xl font-bold text-primary">
                      {selectedProduct.price_iqd.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">د.ع</span>
                  </>
                ) : (
                  <span className="text-muted-foreground">لم يتم تحديد السعر</span>
                )}
              </div>

              <div className="flex gap-3">
                <Button className="flex-1" onClick={() => { setDetailDialogOpen(false); handleOpenEdit(selectedProduct); }}>
                  تعديل المنتج
                </Button>
                <Button variant="outline" onClick={() => navigate(`/store/${merchantApp.id}`)}>
                  عرض المتجر
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-destructive">
              <AlertCircle className="h-5 w-5" />
              تأكيد الحذف
            </DialogTitle>
            <DialogDescription>هل أنت متأكد من حذف هذا المنتج؟ لا يمكن التراجع عن هذا الإجراء.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-3 sm:gap-0">
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>إلغاء</Button>
            <Button 
              variant="destructive" 
              onClick={() => productToDelete && deleteMutation.mutate(productToDelete)}
              disabled={deleteMutation.isPending}
            >
              {deleteMutation.isPending ? "جاري الحذف..." : "حذف المنتج"}
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
