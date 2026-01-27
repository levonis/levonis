import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Plus, Edit2, X, Star, Facebook, Instagram, ArrowRight, Settings, 
  Droplets, Layers, Package, Eye, EyeOff, Sparkles, BarChart3, Users,
  ShoppingBag, TrendingUp, Clock, Grid, List, Filter, BadgePercent
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";
import MerchantProductMediaUpload from "@/components/merchant/MerchantProductMediaUpload";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import CompactBadgesDisplay from "@/components/merchant/CompactBadgesDisplay";
import type { BadgeTier } from "@/components/merchant/CompactBadgesDisplay";

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
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
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

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-72 rounded-3xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 rounded-2xl" />
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
          <Card className="border-border bg-card p-8 text-center">
            <Store className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
            <p className="text-lg font-medium mb-2">لا يمكن الوصول لهذه الصفحة</p>
            <p className="text-sm text-muted-foreground mb-6">هذه الصفحة متاحة للتجار المقبولين فقط</p>
            <Button variant="outline" onClick={() => navigate("/community")}>
              العودة للمجتمع
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/10">
      <main className="container mx-auto px-4 py-8 pt-20 max-w-6xl">
        {/* Premium Hero Header */}
        <div className="relative mb-8 overflow-hidden rounded-3xl">
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
          
          {/* Decorative */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 p-8 sm:p-10">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
              {/* Store Avatar */}
              <div className="flex flex-col items-center">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-primary/20 rounded-full blur-2xl opacity-50" />
                  <AvatarWithFrame
                    imageUrl={merchantApp.store_image_url}
                    frameUrl={selectedFrame?.image_url}
                    size="xl"
                    animated
                  />
                  <Button
                    size="icon"
                    variant="secondary"
                    className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full shadow-xl border-2 border-background hover:scale-110 transition-transform"
                    onClick={() => setProfileEditorOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                </div>
                
                {/* Specialty Badge */}
                {merchantApp.specialty && (
                  <Badge variant="outline" className="mt-4 gap-1.5 bg-background/50 backdrop-blur-sm">
                    {merchantApp.specialty === "resin" && <Droplets className="h-3 w-3" />}
                    {merchantApp.specialty === "filament" && <Layers className="h-3 w-3" />}
                    {merchantApp.specialty === "both" && (
                      <>
                        <Droplets className="h-3 w-3" />
                        <Layers className="h-3 w-3" />
                      </>
                    )}
                    {merchantApp.specialty === "resin" ? "متخصص رزن" : merchantApp.specialty === "filament" ? "متخصص فلمنت" : "رزن وفلمنت"}
                  </Badge>
                )}
              </div>

              {/* Store Info */}
              <div className="flex-1 text-center lg:text-right">
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3 mb-2">
                  <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-l from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    {merchantApp.display_name}
                  </h1>
                  <CompactBadgesDisplay
                    isVerified={merchantApp.is_verified}
                    badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                  />
                </div>
                
                <p className="text-sm text-muted-foreground mb-1">@{profile?.username || "—"}</p>
                <p className="text-xs text-muted-foreground mb-4">لوحة إدارة المتجر</p>

                {merchantApp.bio && (
                  <p className="text-sm text-foreground/80 mb-6 whitespace-pre-wrap leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    {merchantApp.bio}
                  </p>
                )}

                {/* Stats Dashboard */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <Package className="h-5 w-5 text-primary mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{productCounts.active}</p>
                    <p className="text-[10px] text-muted-foreground">منتج نشط</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <ShoppingBag className="h-5 w-5 text-green-500 mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{storeStats?.completedOrders || 0}</p>
                    <p className="text-[10px] text-muted-foreground">طلب مكتمل</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{storeStats?.avgRating?.toFixed(1) || "0.0"}</p>
                    <p className="text-[10px] text-muted-foreground">{storeStats?.totalRatings || 0} تقييم</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <Users className="h-5 w-5 text-blue-500 mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{storeStats?.conversations || 0}</p>
                    <p className="text-[10px] text-muted-foreground">محادثة عميل</p>
                  </div>
                </div>

                {/* Actions */}
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <Button size="lg" onClick={handleOpenAdd} className="gap-2 shadow-lg">
                    <Plus className="h-4 w-4" />
                    إضافة منتج جديد
                  </Button>
                  <Button
                    variant="outline"
                    size="lg"
                    className="gap-2 bg-background/50 backdrop-blur-sm"
                    onClick={() => setProfileEditorOpen(true)}
                  >
                    <Edit2 className="h-4 w-4" />
                    تعديل المتجر
                  </Button>
                  {(socialLinks?.facebook || socialLinks?.instagram) && (
                    <div className="flex gap-2">
                      {socialLinks.facebook && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                            <Facebook className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                      {socialLinks.instagram && (
                        <Button variant="ghost" size="icon" asChild>
                          <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                            <Instagram className="h-4 w-4" />
                          </a>
                        </Button>
                      )}
                    </div>
                  )}
                  <Button variant="ghost" size="lg" onClick={() => navigate(-1)}>
                    <ArrowRight className="ml-2 h-4 w-4" />
                    رجوع
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Products Management Section */}
        <Card className="border-border/50 bg-card/80 backdrop-blur-sm mb-6">
          <CardContent className="p-5">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              {/* Filter Tabs */}
              <Tabs value={productFilter} onValueChange={(v) => setProductFilter(v as ProductFilter)}>
                <TabsList className="bg-muted/50">
                  <TabsTrigger value="all" className="gap-1.5 text-xs">
                    <Filter className="h-3 w-3" />
                    الكل
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{productCounts.all}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="active" className="gap-1.5 text-xs">
                    <Eye className="h-3 w-3" />
                    نشط
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{productCounts.active}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="hidden" className="gap-1.5 text-xs">
                    <EyeOff className="h-3 w-3" />
                    مخفي
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{productCounts.hidden}</Badge>
                  </TabsTrigger>
                  <TabsTrigger value="featured" className="gap-1.5 text-xs">
                    <Sparkles className="h-3 w-3" />
                    مميز
                    <Badge variant="secondary" className="h-5 px-1.5 text-[10px]">{productCounts.featured}</Badge>
                  </TabsTrigger>
                </TabsList>
              </Tabs>

              {/* View Mode Toggle */}
              <div className="flex items-center gap-2">
                <Button
                  variant={viewMode === "grid" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("grid")}
                >
                  <Grid className="h-4 w-4" />
                </Button>
                <Button
                  variant={viewMode === "list" ? "default" : "outline"}
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setViewMode("list")}
                >
                  <List className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid/List */}
        {filteredProducts.length === 0 ? (
          <Card className="border-border/50 bg-card/50 p-12">
            <div className="text-center">
              <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                <Package className="h-10 w-10 text-muted-foreground" />
              </div>
              <p className="text-lg font-medium mb-2">
                {productFilter === "all" ? "لا توجد منتجات بعد" : `لا توجد منتجات ${productFilter === "active" ? "نشطة" : productFilter === "hidden" ? "مخفية" : "مميزة"}`}
              </p>
              <p className="text-sm text-muted-foreground mb-6">ابدأ بإضافة منتج جديد لمتجرك</p>
              <Button onClick={handleOpenAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </div>
          </Card>
        ) : viewMode === "grid" ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {filteredProducts.map((p) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
              const hasDiscount = p.original_price_iqd && p.price_iqd && p.original_price_iqd > p.price_iqd;
              
              return (
                <Card
                  key={p.id}
                  className="group border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-2xl hover:border-primary/30 transition-all duration-300"
                  onClick={() => handleOpenDetail(p)}
                >
                  <div className="relative aspect-square bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
                    {mainImg ? (
                      <img src={mainImg} alt={p.title} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
                    ) : (
                      <div className="flex items-center justify-center w-full h-full">
                        <Package className="h-12 w-12 text-muted-foreground/50" />
                      </div>
                    )}
                    
                    {/* Status Badges */}
                    <div className="absolute top-2 right-2 flex flex-col gap-1">
                      {!p.is_active && (
                        <Badge variant="secondary" className="text-[10px] gap-1">
                          <EyeOff className="h-3 w-3" />
                          مخفي
                        </Badge>
                      )}
                      {p.is_featured && (
                        <Badge className="bg-primary text-primary-foreground text-[10px] gap-1">
                          <Sparkles className="h-3 w-3" />
                          مميز
                        </Badge>
                      )}
                      {hasDiscount && (
                        <Badge className="bg-destructive text-destructive-foreground text-[10px]">
                          خصم
                        </Badge>
                      )}
                    </div>
                    
                    {/* Quick Actions */}
                    <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                      <Button
                        size="icon"
                        variant="secondary"
                        className="h-8 w-8 rounded-lg shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(p);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="destructive"
                        className="h-8 w-8 rounded-lg shadow-lg"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("متأكد من حذف هذا المنتج؟")) deleteMutation.mutate(p.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </div>
                  
                  <CardContent className="p-4">
                    <p className="text-sm font-semibold line-clamp-1 mb-2 group-hover:text-primary transition-colors">
                      {p.title}
                    </p>
                    {p.price_iqd && (
                      <div className="flex items-baseline gap-2 mb-2">
                        <span className="text-base font-bold text-primary">
                          {p.price_iqd.toLocaleString()}
                        </span>
                        <span className="text-[10px] text-muted-foreground">د.ع</span>
                        {hasDiscount && (
                          <span className="text-xs text-muted-foreground line-through">
                            {p.original_price_iqd?.toLocaleString()}
                          </span>
                        )}
                      </div>
                    )}
                    {p.estimated_days && (
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        <span className="text-[11px]">{p.estimated_days} يوم</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        ) : (
          // List View
          <div className="space-y-3">
            {filteredProducts.map((p) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
              
              return (
                <Card
                  key={p.id}
                  className="group border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all"
                  onClick={() => handleOpenDetail(p)}
                >
                  <CardContent className="p-4 flex items-center gap-4">
                    <div className="h-20 w-20 rounded-xl overflow-hidden bg-muted/20 shrink-0">
                      {mainImg ? (
                        <img src={mainImg} alt={p.title} className="w-full h-full object-cover" />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <Package className="h-8 w-8 text-muted-foreground/50" />
                        </div>
                      )}
                    </div>
                    
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-semibold line-clamp-1">{p.title}</p>
                        {!p.is_active && <Badge variant="secondary" className="text-[10px]">مخفي</Badge>}
                        {p.is_featured && <Badge className="bg-primary text-primary-foreground text-[10px]">مميز</Badge>}
                      </div>
                      {p.price_iqd && (
                        <p className="text-primary font-bold">{p.price_iqd.toLocaleString()} د.ع</p>
                      )}
                      {p.estimated_days && (
                        <p className="text-xs text-muted-foreground">{p.estimated_days} يوم للتنفيذ</p>
                      )}
                    </div>
                    
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenEdit(p);
                        }}
                      >
                        <Edit2 className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={(e) => {
                          e.stopPropagation();
                          if (confirm("متأكد من حذف هذا المنتج؟")) deleteMutation.mutate(p.id);
                        }}
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}

        {/* Add/Edit Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className="sm:max-w-xl max-h-[90vh] overflow-hidden">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                {selectedProduct ? <Edit2 className="h-5 w-5" /> : <Plus className="h-5 w-5" />}
                {selectedProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </DialogTitle>
            </DialogHeader>
            
            <div className="space-y-5 max-h-[60vh] overflow-y-auto py-4 px-1">
              <div className="space-y-2">
                <Label htmlFor="title" className="text-sm font-medium">عنوان المنتج *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثلاً: طباعة 3D مخصصة"
                  className="h-11"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="description" className="text-sm font-medium">وصف المنتج</Label>
                <Textarea
                  id="description"
                  rows={3}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف تفصيلي للمنتج..."
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="price" className="text-sm font-medium">السعر (د.ع)</Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price_iqd}
                    onChange={(e) => setFormData({ ...formData, price_iqd: e.target.value })}
                    placeholder="50000"
                    className="h-11"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="original_price" className="text-sm font-medium">السعر قبل الخصم</Label>
                  <Input
                    id="original_price"
                    type="number"
                    value={formData.original_price_iqd}
                    onChange={(e) => setFormData({ ...formData, original_price_iqd: e.target.value })}
                    placeholder="70000"
                    className="h-11"
                  />
                </div>
              </div>

              <MerchantProductMediaUpload
                imageUrls={mediaState.image_urls}
                onImagesChange={(urls) => setMediaState({ ...mediaState, image_urls: urls })}
                primaryImageIndex={mediaState.primary_image_index}
                onPrimaryImageChange={(idx) => setMediaState({ ...mediaState, primary_image_index: idx })}
                videoUrl={mediaState.video_url}
                onVideoUrlChange={(url) => setMediaState({ ...mediaState, video_url: url })}
              />

              <div className="space-y-2">
                <Label htmlFor="estimated_days" className="text-sm font-medium">وقت التنفيذ (بالأيام)</Label>
                <Input
                  id="estimated_days"
                  type="number"
                  value={formData.estimated_days}
                  onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
                  placeholder="7"
                  className="h-11"
                />
              </div>

              {/* Material Type */}
              <div className="space-y-3">
                <Label className="text-sm font-medium">نوع المادة *</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "resin", label: "رزن", icon: Droplets },
                    { value: "filament", label: "فلمنت", icon: Layers },
                    { value: "both", label: "كلاهما", icons: [Droplets, Layers] },
                  ].map((opt) => (
                    <button
                      key={opt.value}
                      type="button"
                      onClick={() => setFormData({ ...formData, material_type: opt.value as MaterialType })}
                      className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                        formData.material_type === opt.value
                          ? "bg-primary text-primary-foreground border-primary shadow-sm"
                          : "bg-background border-border hover:border-primary/50"
                      }`}
                    >
                      {"icons" in opt ? (
                        <>
                          {opt.icons.map((Icon, i) => (
                            <Icon key={i} className="h-4 w-4" />
                          ))}
                        </>
                      ) : (
                        <opt.icon className="h-4 w-4" />
                      )}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Toggles */}
              <div className="flex flex-wrap gap-6 p-4 rounded-xl bg-muted/30 border border-border/50">
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="cursor-pointer">
                    <span className="font-medium">نشر المنتج</span>
                    <p className="text-xs text-muted-foreground">إظهار المنتج للعملاء</p>
                  </Label>
                </div>
                <div className="flex items-center gap-3">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label htmlFor="is_featured" className="cursor-pointer">
                    <span className="font-medium">منتج مميز</span>
                    <p className="text-xs text-muted-foreground">يظهر في الأعلى (حد 3)</p>
                  </Label>
                </div>
              </div>
            </div>

            <div className="flex gap-3 pt-4 border-t border-border/50">
              <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="flex-1">
                إلغاء
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!formData.title.trim() || !formData.material_type || saveMutation.isPending}
                className="flex-1"
              >
                {saveMutation.isPending ? "جارٍ الحفظ..." : selectedProduct ? "حفظ التعديل" : "إضافة المنتج"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-lg font-bold line-clamp-1">{selectedProduct?.title}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
                {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.image_urls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt=""
                        className="w-full aspect-square rounded-xl object-cover border border-border/50"
                      />
                    ))}
                  </div>
                )}

                {selectedProduct.video_url && (
                  <video controls className="w-full rounded-xl border border-border/50">
                    <source src={selectedProduct.video_url} />
                  </video>
                )}

                {selectedProduct.description && (
                  <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                    <Label className="text-xs text-muted-foreground">الوصف</Label>
                    <p className="text-sm mt-2 whitespace-pre-wrap">{selectedProduct.description}</p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {selectedProduct.price_iqd && (
                    <div className="p-4 rounded-xl bg-primary/5 border border-primary/20">
                      <Label className="text-xs text-muted-foreground">السعر</Label>
                      <p className="text-lg font-bold text-primary mt-1">
                        {selectedProduct.price_iqd.toLocaleString()} د.ع
                      </p>
                    </div>
                  )}
                  {selectedProduct.estimated_days && (
                    <div className="p-4 rounded-xl bg-muted/30 border border-border/50">
                      <Label className="text-xs text-muted-foreground">وقت التنفيذ</Label>
                      <p className="text-lg font-bold mt-1">{selectedProduct.estimated_days} يوم</p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap gap-2">
                  <Badge variant={selectedProduct.is_active ? "default" : "secondary"}>
                    {selectedProduct.is_active ? "نشط" : "مخفي"}
                  </Badge>
                  {selectedProduct.is_featured && (
                    <Badge className="bg-primary/20 text-primary border-primary/30">مميز</Badge>
                  )}
                  {selectedProduct.material_type && (
                    <Badge variant="outline">
                      {selectedProduct.material_type === "resin" ? "رزن" : selectedProduct.material_type === "filament" ? "فلمنت" : "رزن وفلمنت"}
                    </Badge>
                  )}
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleOpenEdit(selectedProduct)}>
                    <Edit2 className="ml-2 h-4 w-4" />
                    تعديل
                  </Button>
                  <Button
                    variant="destructive"
                    className="flex-1"
                    onClick={() => {
                      if (confirm("متأكد من حذف هذا المنتج؟")) {
                        deleteMutation.mutate(selectedProduct.id);
                        setDetailDialogOpen(false);
                      }
                    }}
                  >
                    <X className="ml-2 h-4 w-4" />
                    حذف
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Store Profile Editor */}
        {merchantApp && (
          <StoreProfileEditor
            open={profileEditorOpen}
            onOpenChange={setProfileEditorOpen}
            merchantApp={{
              id: merchantApp.id,
              display_name: merchantApp.display_name,
              bio: merchantApp.bio,
              store_image_url: merchantApp.store_image_url,
              social_links: socialLinks || null,
              selected_frame_id: merchantApp.selected_frame_id || null,
              specialty: merchantApp.specialty as "resin" | "filament" | "both" | undefined,
            }}
          />
        )}
      </main>
    </div>
  );
}
