import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Store,
  Plus,
  Edit2,
  X,
  Star,
  Facebook,
  Instagram,
  ArrowRight,
  Settings,
  Droplets,
  Layers,
  Eye,
  EyeOff,
  Sparkles,
  Package,
  Clock,
  TrendingUp,
  MessageCircle,
  ExternalLink,
  Image as ImageIcon,
  LayoutGrid,
  List,
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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

export default function CommunityMerchantStore() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [productDialogOpen, setProductDialogOpen] = useState(false);
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
  const [viewMode, setViewMode] = useState<"grid" | "list">("grid");
  const [activeTab, setActiveTab] = useState("all");

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
        .select("id, status, display_name, bio, store_image_url, social_links, selected_frame_id, specialty")
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

  // Fetch public profile for badges
  const { data: publicProfile } = useQuery({
    queryKey: ["merchant-public-profile", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("is_verified, badge_tier")
        .eq("id", merchantApp!.id)
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
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MerchantProduct[];
    },
  });

  // Fetch store stats
  const { data: storeStats } = useQuery({
    queryKey: ["merchant-store-stats", merchantApp?.id],
    enabled: !!merchantApp?.id,
    queryFn: async () => {
      const [offersRes, ratingsRes, conversationsRes] = await Promise.all([
        supabase
          .from("print_offers")
          .select("id, status")
          .eq("trader_id", merchantApp!.id),
        supabase
          .from("merchant_ratings")
          .select("rating")
          .eq("merchant_id", merchantApp!.id),
        supabase
          .from("listing_conversations")
          .select("id")
          .eq("seller_id", merchantApp!.id),
      ]);

      const offers = offersRes.data || [];
      const ratings = ratingsRes.data || [];
      const conversations = conversationsRes.data || [];

      const completedOrders = offers.filter((o) => o.status === "completed").length;
      const avgRating =
        ratings.length > 0 ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length : 0;

      return {
        totalProducts: products.length,
        activeProducts: products.filter((p) => p.is_active).length,
        completedOrders,
        avgRating,
        totalRatings: ratings.length,
        totalConversations: conversations.length,
      };
    },
  });

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
        const { error } = await supabase.from("merchant_products").update(payload).eq("id", selectedProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-products"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-store-stats"] });
      setProductDialogOpen(false);
      setSelectedProduct(null);
      setFormData({
        title: "",
        description: "",
        price_iqd: "",
        original_price_iqd: "",
        estimated_days: "",
        is_active: true,
        is_featured: false,
        material_type: "both",
      });
      setMediaState({
        image_urls: [],
        video_url: "",
        primary_image_index: 0,
      });
      toast({ title: selectedProduct ? "تم التحديث" : "تمت الإضافة", description: "المنتج حُفظ بنجاح." });
    },
    onError: () => {
      toast({
        title: "خطأ",
        description: "فشل حفظ المنتج. قد تكون وصلت للحد الأقصى (3 منتجات مميزة).",
        variant: "destructive",
      });
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
      queryClient.invalidateQueries({ queryKey: ["merchant-store-stats"] });
      toast({ title: "تم الحذف", description: "المنتج حُذف بنجاح." });
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حذف المنتج.", variant: "destructive" });
    },
  });

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
    setProductDialogOpen(true);
  };

  const handleOpenDetail = (product: MerchantProduct) => {
    setSelectedProduct(product);
    setDetailDialogOpen(true);
  };

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  // Filter products by tab
  const filteredProducts = products.filter((p) => {
    if (activeTab === "all") return true;
    if (activeTab === "active") return p.is_active;
    if (activeTab === "hidden") return !p.is_active;
    if (activeTab === "featured") return p.is_featured;
    return true;
  });

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-2xl" />
            <div className="grid grid-cols-4 gap-3">
              {[1, 2, 3, 4].map((i) => (
                <Skeleton key={i} className="h-20 rounded-xl" />
              ))}
            </div>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-64 rounded-xl" />
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="border-primary/20 bg-gradient-to-b from-card to-background p-8">
            <div className="text-center space-y-4">
              <div className="h-16 w-16 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                <Store className="h-8 w-8 text-primary" />
              </div>
              <h2 className="text-xl font-bold">لا يمكن الوصول</h2>
              <p className="text-sm text-muted-foreground">لا يمكن الوصول لهذه الصفحة إلا للتجار المقبولين.</p>
              <Button variant="outline" onClick={() => navigate("/community")} className="gap-2">
                <ArrowRight className="h-4 w-4" />
                العودة للمجتمع
              </Button>
            </div>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl space-y-6">
        {/* Hero Store Header - Premium Design */}
        <Card className="border-primary/20 bg-gradient-to-br from-card via-card to-primary/5 overflow-hidden relative">
          {/* Decorative Background */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-48 h-48 bg-primary/5 rounded-full blur-2xl -translate-x-1/2 translate-y-1/2" />
          </div>

          <CardContent className="p-6 sm:p-8 relative">
            <div className="flex flex-col md:flex-row items-center md:items-start gap-6">
              {/* Store Avatar with Frame */}
              <div className="relative shrink-0">
                <AvatarWithFrame imageUrl={merchantApp.store_image_url} frameUrl={selectedFrame?.image_url} size="xl" animated />
                <Button
                  size="icon"
                  variant="secondary"
                  className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full shadow-lg border-2 border-background hover:scale-105 transition-transform"
                  onClick={() => setProfileEditorOpen(true)}
                >
                  <Settings className="h-4 w-4" />
                </Button>
              </div>

              {/* Store Info */}
              <div className="flex-1 text-center md:text-right space-y-3">
                <div className="space-y-1">
                  <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-l from-primary to-primary/70 bg-clip-text text-transparent">
                    {merchantApp.display_name}
                  </h1>
                  <p className="text-sm text-muted-foreground">@{profile?.username || "—"}</p>
                </div>

                {/* Badges */}
                <CompactBadgesDisplay
                  isVerified={publicProfile?.is_verified}
                  badgeTier={(publicProfile?.badge_tier || "none") as BadgeTier}
                />

                {merchantApp.bio && (
                  <p className="text-sm text-foreground/80 whitespace-pre-wrap leading-relaxed max-w-lg">{merchantApp.bio}</p>
                )}

                {/* Social Links */}
                {(socialLinks?.facebook || socialLinks?.instagram) && (
                  <div className="flex gap-2 justify-center md:justify-start pt-2">
                    {socialLinks.facebook && (
                      <a
                        href={socialLinks.facebook}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
                        <Facebook className="h-3.5 w-3.5" />
                        فيسبوك
                      </a>
                    )}
                    {socialLinks.instagram && (
                      <a
                        href={socialLinks.instagram}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-xs font-medium hover:bg-primary/20 transition-colors"
                      >
                        <Instagram className="h-3.5 w-3.5" />
                        إنستقرام
                      </a>
                    )}
                  </div>
                )}
              </div>

              {/* Actions */}
              <div className="flex flex-col gap-2 shrink-0">
                <Button variant="outline" size="sm" onClick={() => navigate(`/store/${merchantApp.id}`)} className="gap-2">
                  <ExternalLink className="h-4 w-4" />
                  معاينة المتجر
                </Button>
                <Button variant="ghost" size="sm" onClick={() => navigate(-1)} className="gap-2">
                  <ArrowRight className="h-4 w-4" />
                  رجوع
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Stats Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <Card className="border-primary/20 bg-gradient-to-b from-card to-background overflow-hidden group hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center shrink-0 group-hover:bg-primary/20 transition-colors">
                  <Package className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <p className="text-2xl font-black text-primary">{storeStats?.activeProducts || 0}</p>
                  <p className="text-[10px] text-muted-foreground">منتج نشط</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-b from-card to-background overflow-hidden group hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-500/10 flex items-center justify-center shrink-0 group-hover:bg-emerald-500/20 transition-colors">
                  <TrendingUp className="h-5 w-5 text-emerald-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-emerald-500">{storeStats?.completedOrders || 0}</p>
                  <p className="text-[10px] text-muted-foreground">طلب مكتمل</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-b from-card to-background overflow-hidden group hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-yellow-500/10 flex items-center justify-center shrink-0 group-hover:bg-yellow-500/20 transition-colors">
                  <Star className="h-5 w-5 text-yellow-500 fill-yellow-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-yellow-500">{storeStats?.avgRating?.toFixed(1) || "0.0"}</p>
                  <p className="text-[10px] text-muted-foreground">{storeStats?.totalRatings || 0} تقييم</p>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card className="border-primary/20 bg-gradient-to-b from-card to-background overflow-hidden group hover:border-primary/40 transition-colors">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-blue-500/10 flex items-center justify-center shrink-0 group-hover:bg-blue-500/20 transition-colors">
                  <MessageCircle className="h-5 w-5 text-blue-500" />
                </div>
                <div>
                  <p className="text-2xl font-black text-blue-500">{storeStats?.totalConversations || 0}</p>
                  <p className="text-[10px] text-muted-foreground">محادثة</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Products Section */}
        <div className="space-y-4">
          {/* Header with Tabs and Actions */}
          <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full sm:w-auto">
              <TabsList className="bg-muted/30 border border-border/50">
                <TabsTrigger value="all" className="text-xs gap-1.5">
                  <Package className="h-3.5 w-3.5" />
                  الكل ({products.length})
                </TabsTrigger>
                <TabsTrigger value="active" className="text-xs gap-1.5">
                  <Eye className="h-3.5 w-3.5" />
                  نشط ({products.filter((p) => p.is_active).length})
                </TabsTrigger>
                <TabsTrigger value="hidden" className="text-xs gap-1.5">
                  <EyeOff className="h-3.5 w-3.5" />
                  مخفي ({products.filter((p) => !p.is_active).length})
                </TabsTrigger>
                <TabsTrigger value="featured" className="text-xs gap-1.5">
                  <Sparkles className="h-3.5 w-3.5" />
                  مميز ({products.filter((p) => p.is_featured).length})
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="flex items-center gap-2">
              {/* View Toggle */}
              <div className="flex border border-border/50 rounded-lg overflow-hidden">
                <button
                  onClick={() => setViewMode("grid")}
                  className={`p-2 transition-colors ${viewMode === "grid" ? "bg-primary/20 text-primary" : "hover:bg-muted/50"}`}
                >
                  <LayoutGrid className="h-4 w-4" />
                </button>
                <button
                  onClick={() => setViewMode("list")}
                  className={`p-2 transition-colors ${viewMode === "list" ? "bg-primary/20 text-primary" : "hover:bg-muted/50"}`}
                >
                  <List className="h-4 w-4" />
                </button>
              </div>

              <Button onClick={handleOpenAdd} className="gap-2">
                <Plus className="h-4 w-4" />
                إضافة منتج
              </Button>
            </div>
          </div>

          {/* Products Grid/List */}
          {filteredProducts.length === 0 ? (
            <Card className="border-dashed border-2 border-primary/20 bg-gradient-to-b from-card to-background p-12">
              <div className="text-center space-y-4">
                <div className="h-20 w-20 rounded-2xl bg-primary/10 flex items-center justify-center mx-auto">
                  <ImageIcon className="h-10 w-10 text-primary/50" />
                </div>
                <div>
                  <p className="text-lg font-bold">لا توجد منتجات</p>
                  <p className="text-sm text-muted-foreground mt-1">ابدأ بإضافة منتجك الأول لعرضه في متجرك</p>
                </div>
                <Button onClick={handleOpenAdd} className="gap-2">
                  <Plus className="h-4 w-4" />
                  إضافة منتج جديد
                </Button>
              </div>
            </Card>
          ) : viewMode === "grid" ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
              {filteredProducts.map((p) => {
                const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
                return (
                  <Card
                    key={p.id}
                    className="border-primary/10 bg-gradient-to-b from-card to-background overflow-hidden cursor-pointer hover:shadow-xl hover:border-primary/30 hover:scale-[1.02] transition-all duration-300 group"
                    onClick={() => handleOpenDetail(p)}
                  >
                    <div className="relative aspect-square bg-muted/20">
                      {mainImg ? (
                        <img
                          src={mainImg}
                          alt={p.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                      ) : (
                        <div className="flex items-center justify-center w-full h-full">
                          <Store className="h-12 w-12 text-muted-foreground/30" />
                        </div>
                      )}

                      {/* Overlay Badges */}
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
                        {p.original_price_iqd && p.price_iqd && p.original_price_iqd > p.price_iqd && (
                          <Badge className="bg-destructive text-destructive-foreground text-[10px]">خصم</Badge>
                        )}
                      </div>

                      {/* Edit/Delete Buttons */}
                      <div className="absolute top-2 left-2 opacity-0 group-hover:opacity-100 transition-opacity flex gap-1">
                        <Button
                          size="sm"
                          variant="secondary"
                          className="h-8 w-8 p-0 shadow-lg"
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
                          className="h-8 w-8 p-0 shadow-lg"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("متأكد من الحذف؟")) deleteMutation.mutate(p.id);
                          }}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    <CardContent className="p-3 space-y-2">
                      <p className="text-sm font-semibold line-clamp-1">{p.title}</p>

                      {p.price_iqd && (
                        <div className="flex items-baseline gap-1.5">
                          {p.original_price_iqd && p.original_price_iqd > p.price_iqd && (
                            <span className="text-[10px] text-muted-foreground line-through">
                              {p.original_price_iqd.toLocaleString()}
                            </span>
                          )}
                          <span className="text-sm font-bold text-primary">
                            {p.price_iqd.toLocaleString()} <span className="text-[10px]">د.ع</span>
                          </span>
                        </div>
                      )}

                      {p.estimated_days && (
                        <div className="flex items-center gap-1">
                          <Clock className="h-3 w-3 text-muted-foreground" />
                          <span className="text-[10px] text-muted-foreground">{p.estimated_days} يوم</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          ) : (
            <div className="space-y-2">
              {filteredProducts.map((p) => {
                const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
                return (
                  <Card
                    key={p.id}
                    className="border-primary/10 bg-gradient-to-b from-card to-background overflow-hidden cursor-pointer hover:shadow-lg hover:border-primary/30 transition-all group"
                    onClick={() => handleOpenDetail(p)}
                  >
                    <CardContent className="p-3 flex items-center gap-4">
                      <div className="relative h-16 w-16 rounded-xl overflow-hidden shrink-0 bg-muted/20">
                        {mainImg ? (
                          <img src={mainImg} alt={p.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Store className="h-6 w-6 text-muted-foreground/30" />
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold truncate">{p.title}</p>
                          {p.is_featured && (
                            <Badge className="bg-primary text-primary-foreground text-[10px] gap-0.5 shrink-0">
                              <Sparkles className="h-2.5 w-2.5" />
                              مميز
                            </Badge>
                          )}
                          {!p.is_active && (
                            <Badge variant="secondary" className="text-[10px] gap-0.5 shrink-0">
                              <EyeOff className="h-2.5 w-2.5" />
                              مخفي
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-4 mt-1">
                          {p.price_iqd && (
                            <span className="text-sm font-bold text-primary">{p.price_iqd.toLocaleString()} د.ع</span>
                          )}
                          {p.estimated_days && (
                            <span className="text-xs text-muted-foreground flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              {p.estimated_days} يوم
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleOpenEdit(p);
                          }}
                        >
                          <Edit2 className="h-4 w-4" />
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-8 w-8 p-0 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (confirm("متأكد من الحذف؟")) deleteMutation.mutate(p.id);
                          }}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Add/Edit Product Dialog */}
        <Dialog open={productDialogOpen} onOpenChange={setProductDialogOpen}>
          <DialogContent className="sm:max-w-xl">
            <DialogHeader className="pb-3 border-b border-border/50">
              <DialogTitle className="text-lg">{selectedProduct ? "تعديل المنتج" : "إضافة منتج جديد"}</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 max-h-[55vh] overflow-y-auto px-0.5 py-2">
              <div className="space-y-1.5">
                <Label htmlFor="title" className="text-xs font-medium text-foreground/80">
                  العنوان *
                </Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                  placeholder="مثلاً: طباعة 3D مخصصة"
                  className="h-9 text-sm bg-background/50 border-border/60 focus:border-primary/50"
                />
              </div>

              <div className="space-y-1.5">
                <Label htmlFor="description" className="text-xs font-medium text-foreground/80">
                  الوصف
                </Label>
                <Textarea
                  id="description"
                  rows={2}
                  value={formData.description}
                  onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                  placeholder="وصف المنتج..."
                  className="text-sm bg-background/50 border-border/60 focus:border-primary/50 resize-none"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="price" className="text-xs font-medium text-foreground/80">
                    السعر (د.ع)
                  </Label>
                  <Input
                    id="price"
                    type="number"
                    value={formData.price_iqd}
                    onChange={(e) => setFormData({ ...formData, price_iqd: e.target.value })}
                    placeholder="50000"
                    className="h-9 text-sm bg-background/50 border-border/60 focus:border-primary/50"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="original_price" className="text-xs font-medium text-foreground/80">
                    السعر قبل الخصم
                  </Label>
                  <Input
                    id="original_price"
                    type="number"
                    value={formData.original_price_iqd}
                    onChange={(e) => setFormData({ ...formData, original_price_iqd: e.target.value })}
                    placeholder="70000"
                    className="h-9 text-sm bg-background/50 border-border/60 focus:border-primary/50"
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

              <div className="space-y-1.5">
                <Label htmlFor="estimated_days" className="text-xs font-medium text-foreground/80">
                  وقت التنفيذ (بالأيام)
                </Label>
                <Input
                  id="estimated_days"
                  type="number"
                  value={formData.estimated_days}
                  onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })}
                  placeholder="7"
                  className="h-9 text-sm bg-background/50 border-border/60 focus:border-primary/50"
                />
              </div>

              <div className="flex flex-wrap gap-4 p-3 rounded-lg bg-background/30 border border-border/40">
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_active"
                    checked={formData.is_active}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_active: checked })}
                  />
                  <Label htmlFor="is_active" className="text-xs cursor-pointer">
                    نشر المنتج
                  </Label>
                </div>
                <div className="flex items-center gap-2">
                  <Switch
                    id="is_featured"
                    checked={formData.is_featured}
                    onCheckedChange={(checked) => setFormData({ ...formData, is_featured: checked })}
                  />
                  <Label htmlFor="is_featured" className="text-xs cursor-pointer">
                    منتج مميز
                  </Label>
                </div>
              </div>

              {/* Material Type Selector */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-foreground/80">نوع المادة</Label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, material_type: "resin" })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      formData.material_type === "resin"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                    }`}
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    رزن
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, material_type: "filament" })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      formData.material_type === "filament"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                    }`}
                  >
                    <Layers className="h-3.5 w-3.5" />
                    فلمنت
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData({ ...formData, material_type: "both" })}
                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      formData.material_type === "both"
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                    }`}
                  >
                    <Droplets className="h-3.5 w-3.5" />
                    <Layers className="h-3.5 w-3.5 -mr-0.5" />
                    كلاهما
                  </button>
                </div>
              </div>
            </div>

            <div className="flex gap-2 pt-3 border-t border-border/50">
              <Button variant="outline" onClick={() => setProductDialogOpen(false)} className="flex-1 h-9 text-sm">
                إلغاء
              </Button>
              <Button
                onClick={() => saveMutation.mutate()}
                disabled={!formData.title.trim() || saveMutation.isPending}
                className="flex-1 h-9 text-sm"
              >
                {saveMutation.isPending ? "جارٍ الحفظ..." : selectedProduct ? "حفظ التعديل" : "إضافة"}
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Product Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader className="pb-3 border-b border-border/50">
              <DialogTitle className="text-lg line-clamp-1">{selectedProduct?.title}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="space-y-4 max-h-[55vh] overflow-y-auto px-0.5 py-2">
                {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 && (
                  <div className="grid grid-cols-2 gap-2">
                    {selectedProduct.image_urls.map((url, idx) => (
                      <img
                        key={idx}
                        src={url}
                        alt={`${selectedProduct.title} ${idx + 1}`}
                        className="w-full aspect-square rounded-lg object-cover border border-border/50"
                      />
                    ))}
                  </div>
                )}

                {selectedProduct.video_url && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/80">الفيديو</Label>
                    <video controls className="w-full rounded-lg border border-border/50">
                      <source src={selectedProduct.video_url} />
                      المتصفح لا يدعم تشغيل الفيديو.
                    </video>
                  </div>
                )}

                {selectedProduct.description && (
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium text-foreground/80">الوصف</Label>
                    <p className="text-sm text-foreground/80 whitespace-pre-wrap p-2.5 rounded-lg bg-background/30 border border-border/40">
                      {selectedProduct.description}
                    </p>
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  {selectedProduct.price_iqd && (
                    <div className="p-3 rounded-lg bg-background/30 border border-border/40">
                      <Label className="text-xs font-medium text-foreground/60">السعر</Label>
                      <div className="flex items-baseline gap-1.5 mt-1">
                        {selectedProduct.original_price_iqd && (
                          <span className="text-xs text-muted-foreground line-through">
                            {selectedProduct.original_price_iqd.toLocaleString()}
                          </span>
                        )}
                        <span className="text-base font-bold text-primary">{selectedProduct.price_iqd.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  )}

                  {selectedProduct.estimated_days && (
                    <div className="p-3 rounded-lg bg-background/30 border border-border/40">
                      <Label className="text-xs font-medium text-foreground/60">وقت التنفيذ</Label>
                      <p className="text-sm font-medium text-foreground mt-1">{selectedProduct.estimated_days} يوم</p>
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2 pt-2">
                  <Badge variant={selectedProduct.is_active ? "default" : "secondary"} className="text-xs">
                    {selectedProduct.is_active ? "نشط" : "مخفي"}
                  </Badge>
                  {selectedProduct.is_featured && (
                    <Badge className="text-xs bg-primary/20 text-primary border-primary/30">مميز</Badge>
                  )}
                </div>

                <div className="flex gap-2 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => handleOpenEdit(selectedProduct)}>
                    <Edit2 className="h-4 w-4 ml-2" />
                    تعديل
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
              specialty: merchantApp.specialty as "resin" | "filament" | "both" | null,
            }}
          />
        )}
      </main>
    </div>
  );
}
