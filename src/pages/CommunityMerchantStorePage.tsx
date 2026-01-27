import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, Facebook, Instagram, ArrowRight, Clock, BadgePercent, Play, 
  MessageCircle, Link as LinkIcon, Settings, Star, Sparkles, Package,
  ShoppingBag, Users, TrendingUp, Eye, Droplets, Layers
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Checkbox } from "@/components/ui/checkbox";
import RatingsPreview from "@/components/merchant/RatingsPreview";
import CompactBadgesDisplay from "@/components/merchant/CompactBadgesDisplay";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
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
  estimated_days: number | null;
  material_type?: "resin" | "filament" | "both" | null;
}

export default function CommunityMerchantStorePage() {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId: string }>();
  const { user } = useAuth();
  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [includeProductLink, setIncludeProductLink] = useState(true);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);

  // Check if current user owns this store
  const { data: isOwner } = useQuery({
    queryKey: ["is-store-owner", merchantId, user?.id],
    enabled: !!merchantId && !!user?.id,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("id", merchantId!)
        .eq("user_id", user!.id)
        .maybeSingle();
      return !!data;
    },
  });

  // Fetch merchant application for editing (only if owner)
  const { data: editableMerchantApp } = useQuery({
    queryKey: ["merchant-app-editable", merchantId, user?.id],
    enabled: !!isOwner && !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_applications")
        .select("id, display_name, bio, store_image_url, social_links, selected_frame_id, specialty")
        .eq("id", merchantId!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: merchantApp, isLoading: appLoading } = useQuery({
    queryKey: ["merchant-store", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, bio, store_image_url, social_links, is_verified, badge_tier, selected_frame_id, specialty")
        .eq("id", merchantId!)
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

  const { data: products = [], isLoading: productsLoading } = useQuery({
    queryKey: ["merchant-store-products", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("*")
        .eq("merchant_id", merchantId!)
        .eq("is_active", true)
        .order("is_featured", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as MerchantProduct[];
    },
  });

  // Fetch store stats
  const { data: storeStats } = useQuery({
    queryKey: ["store-stats", merchantId],
    enabled: !!merchantId,
    queryFn: async () => {
      const [ordersRes, ratingsRes] = await Promise.all([
        supabase
          .from("chat_orders")
          .select("id", { count: "exact" })
          .eq("seller_id", merchantId!)
          .eq("status", "delivered"),
        supabase
          .from("merchant_ratings")
          .select("rating")
          .eq("merchant_id", merchantId!)
      ]);
      
      const totalOrders = ordersRes.count || 0;
      const ratings = ratingsRes.data || [];
      const avgRating = ratings.length > 0 
        ? ratings.reduce((sum, r) => sum + r.rating, 0) / ratings.length 
        : 0;
      
      return { totalOrders, avgRating, totalRatings: ratings.length };
    },
  });

  const handleOpenDetail = (product: MerchantProduct) => {
    setSelectedProduct(product);
    setActiveMediaIndex(product.primary_image_index || 0);
    setDetailDialogOpen(true);
  };

  const handleContactMerchant = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setMessageDialogOpen(true);
  };

  const handleStartConversation = () => {
    const productUrl = selectedProduct 
      ? `${window.location.origin}/store/${merchantId}?product=${selectedProduct.id}`
      : null;
    
    const params = new URLSearchParams();
    params.set("merchant_id", merchantId!);
    if (includeProductLink && selectedProduct) {
      params.set("product_title", selectedProduct.title);
      params.set("product_url", productUrl!);
    }
    
    navigate(`/community/messages?${params.toString()}`);
  };

  const getMaterialBadge = (type?: string | null) => {
    if (type === "resin") return { icon: Droplets, label: "رزن", color: "bg-blue-500/10 text-blue-500 border-blue-500/20" };
    if (type === "filament") return { icon: Layers, label: "فلمنت", color: "bg-orange-500/10 text-orange-500 border-orange-500/20" };
    return null;
  };

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-72 rounded-3xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="h-72 rounded-2xl" />
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
            <p className="text-lg font-medium mb-2">لا يمكن العثور على هذا المتجر</p>
            <p className="text-sm text-muted-foreground mb-6">قد يكون المتجر غير موجود أو تم إلغاؤه</p>
            <Button variant="outline" onClick={() => navigate("/community")}>
              <ArrowRight className="ml-2 h-4 w-4" />
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
          {/* Background Gradient */}
          <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-primary/10 to-background" />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-primary/30 via-transparent to-transparent" />
          
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-96 h-96 bg-primary/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2" />
          <div className="absolute bottom-0 left-0 w-64 h-64 bg-primary/20 rounded-full blur-3xl translate-y-1/2 -translate-x-1/2" />
          
          <div className="relative z-10 p-8 sm:p-12">
            <div className="flex flex-col lg:flex-row gap-8 items-center lg:items-start">
              {/* Store Avatar Section */}
              <div className="flex flex-col items-center text-center lg:text-right">
                <div className="relative group">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/50 to-primary/20 rounded-full blur-2xl group-hover:blur-3xl transition-all duration-500 opacity-50" />
                  <AvatarWithFrame
                    imageUrl={merchantApp.store_image_url}
                    frameUrl={selectedFrame?.image_url}
                    size="xl"
                    animated
                  />
                  {isOwner && (
                    <Button
                      size="icon"
                      variant="secondary"
                      className="absolute -bottom-2 -right-2 h-10 w-10 rounded-full shadow-xl border-2 border-background hover:scale-110 transition-transform"
                      onClick={() => setProfileEditorOpen(true)}
                    >
                      <Settings className="h-4 w-4" />
                    </Button>
                  )}
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
                <div className="flex flex-col lg:flex-row items-center lg:items-start gap-3 mb-3">
                  <h1 className="text-3xl sm:text-4xl font-black bg-gradient-to-l from-primary via-primary to-primary/70 bg-clip-text text-transparent">
                    {merchantApp.display_name}
                  </h1>
                  <CompactBadgesDisplay
                    isVerified={merchantApp.is_verified}
                    badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                  />
                </div>
                
                <p className="text-sm text-muted-foreground mb-4">متجر داخل مجتمع ليفو للطباعة ثلاثية الأبعاد</p>

                {merchantApp.bio && (
                  <p className="text-sm text-foreground/80 mb-6 whitespace-pre-wrap leading-relaxed max-w-2xl mx-auto lg:mx-0">
                    {merchantApp.bio}
                  </p>
                )}

                {/* Quick Stats */}
                <div className="grid grid-cols-3 gap-3 mb-6 max-w-md mx-auto lg:mx-0">
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <Package className="h-5 w-5 text-primary mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{products.length}</p>
                    <p className="text-[10px] text-muted-foreground">منتج نشط</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <ShoppingBag className="h-5 w-5 text-primary mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{storeStats?.totalOrders || 0}</p>
                    <p className="text-[10px] text-muted-foreground">طلب مكتمل</p>
                  </div>
                  <div className="bg-background/60 backdrop-blur-sm rounded-2xl p-4 border border-border/50">
                    <Star className="h-5 w-5 text-yellow-500 fill-yellow-500 mx-auto lg:mx-0 mb-2" />
                    <p className="text-xl font-bold text-foreground">{storeStats?.avgRating?.toFixed(1) || "0.0"}</p>
                    <p className="text-[10px] text-muted-foreground">{storeStats?.totalRatings || 0} تقييم</p>
                  </div>
                </div>

                {/* Social & Actions */}
                <div className="flex flex-wrap gap-3 justify-center lg:justify-start">
                  <Button
                    size="lg"
                    className="gap-2 shadow-lg hover:shadow-xl transition-all"
                    onClick={() => {
                      if (!user) {
                        navigate("/auth");
                        return;
                      }
                      setSelectedProduct(null);
                      setMessageDialogOpen(true);
                    }}
                  >
                    <MessageCircle className="h-4 w-4" />
                    تواصل مع التاجر
                  </Button>
                  
                  {socialLinks?.facebook && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 bg-background/50 backdrop-blur-sm"
                      asChild
                    >
                      <a href={socialLinks.facebook} target="_blank" rel="noopener noreferrer">
                        <Facebook className="h-4 w-4" />
                        فيسبوك
                      </a>
                    </Button>
                  )}
                  
                  {socialLinks?.instagram && (
                    <Button
                      variant="outline"
                      size="lg"
                      className="gap-2 bg-background/50 backdrop-blur-sm"
                      asChild
                    >
                      <a href={socialLinks.instagram} target="_blank" rel="noopener noreferrer">
                        <Instagram className="h-4 w-4" />
                        إنستقرام
                      </a>
                    </Button>
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

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Ratings */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 overflow-hidden">
              <CardContent className="p-5">
                <div className="flex items-center gap-2 mb-4">
                  <div className="h-8 w-8 rounded-xl bg-yellow-500/10 flex items-center justify-center">
                    <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
                  </div>
                  <h2 className="text-sm font-bold text-foreground">تقييمات العملاء</h2>
                </div>
                <RatingsPreview merchantId={merchantId!} />
              </CardContent>
            </Card>
          </div>

          {/* Main: Products */}
          <div className="lg:col-span-3">
            <div className="flex items-center justify-between mb-5">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Store className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <h2 className="text-lg font-bold text-foreground">المنتجات</h2>
                  <p className="text-xs text-muted-foreground">{products.length} منتج متاح</p>
                </div>
              </div>
            </div>

            {products.length === 0 ? (
              <Card className="border-border/50 bg-card/50 p-12">
                <div className="text-center">
                  <div className="h-20 w-20 rounded-3xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
                    <Package className="h-10 w-10 text-muted-foreground" />
                  </div>
                  <p className="text-lg font-medium mb-2">لا توجد منتجات متاحة</p>
                  <p className="text-sm text-muted-foreground">لم يقم التاجر بإضافة منتجات بعد</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                {products.map((p) => {
                  const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
                  const material = getMaterialBadge(p.material_type);
                  const hasDiscount = p.original_price_iqd && p.price_iqd && p.original_price_iqd > p.price_iqd;
                  
                  return (
                    <Card
                      key={p.id}
                      className="group border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-2xl hover:border-primary/30 transition-all duration-300"
                      onClick={() => handleOpenDetail(p)}
                    >
                      <div className="relative aspect-square bg-gradient-to-br from-muted/30 to-muted/10 overflow-hidden">
                        {mainImg ? (
                          <img 
                            src={mainImg} 
                            alt={p.title} 
                            className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" 
                          />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Package className="h-16 w-16 text-muted-foreground/50" />
                          </div>
                        )}
                        
                        {/* Overlay Badges */}
                        <div className="absolute top-2 right-2 flex flex-col gap-1">
                          {hasDiscount && (
                            <Badge className="bg-destructive text-destructive-foreground text-[10px] gap-1">
                              <BadgePercent className="h-3 w-3" />
                              خصم
                            </Badge>
                          )}
                          {material && (
                            <Badge variant="outline" className={`text-[10px] gap-1 ${material.color} backdrop-blur-sm`}>
                              <material.icon className="h-3 w-3" />
                              {material.label}
                            </Badge>
                          )}
                        </div>
                        
                        {p.video_url && (
                          <div className="absolute bottom-2 left-2">
                            <Badge variant="secondary" className="gap-1 text-[10px] backdrop-blur-sm">
                              <Play className="h-3 w-3" />
                              فيديو
                            </Badge>
                          </div>
                        )}
                        
                        {/* Hover Overlay */}
                        <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
                        <div className="absolute bottom-0 left-0 right-0 p-3 translate-y-full group-hover:translate-y-0 transition-transform duration-300">
                          <Button size="sm" className="w-full gap-2 shadow-lg">
                            <Eye className="h-3.5 w-3.5" />
                            عرض التفاصيل
                          </Button>
                        </div>
                      </div>
                      
                      <CardContent className="p-4">
                        <p className="text-sm font-semibold line-clamp-1 mb-2 group-hover:text-primary transition-colors">
                          {p.title}
                        </p>
                        
                        {p.price_iqd && (
                          <div className="flex items-baseline gap-2 mb-2">
                            <span className="text-lg font-bold text-primary">
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
                            <span className="text-[11px]">{p.estimated_days} يوم للتنفيذ</span>
                          </div>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Product Detail Dialog - Premium Design */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-4xl max-h-[90vh] overflow-hidden">
            <DialogHeader className="pb-4 border-b border-border/50">
              <DialogTitle className="text-xl font-bold">{selectedProduct?.title}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[70vh] overflow-y-auto py-4">
                {/* Media Section */}
                <div className="space-y-4">
                  {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden border border-border/50 bg-muted/10">
                      <div className="relative aspect-square">
                        <img
                          src={selectedProduct.image_urls[Math.min(activeMediaIndex, selectedProduct.image_urls.length - 1)]}
                          alt={selectedProduct.title}
                          className="w-full h-full object-contain bg-gradient-to-br from-muted/20 to-background"
                        />
                        {selectedProduct.video_url && (
                          <Badge variant="secondary" className="absolute bottom-3 left-3 gap-1 backdrop-blur-sm">
                            <Play className="h-3.5 w-3.5" />
                            فيديو متاح
                          </Badge>
                        )}
                      </div>
                      {selectedProduct.image_urls.length > 1 && (
                        <div className="grid grid-cols-6 gap-2 p-3 bg-background/50">
                          {selectedProduct.image_urls.slice(0, 6).map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveMediaIndex(idx)}
                              className={`relative aspect-square rounded-xl overflow-hidden border-2 transition-all ${
                                idx === activeMediaIndex 
                                  ? "border-primary ring-2 ring-primary/20" 
                                  : "border-border/50 hover:border-primary/50"
                              }`}
                            >
                              <img src={url} alt="" className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border/50 bg-muted/20 aspect-square flex items-center justify-center">
                      <Package className="h-20 w-20 text-muted-foreground/30" />
                    </div>
                  )}
                  
                  {selectedProduct.video_url && (
                    <div className="rounded-2xl border border-border/50 overflow-hidden">
                      <video controls className="w-full" preload="metadata">
                        <source src={selectedProduct.video_url} />
                      </video>
                    </div>
                  )}
                </div>

                {/* Details Section */}
                <div className="space-y-4">
                  {/* Price Card */}
                  {(selectedProduct.price_iqd || selectedProduct.original_price_iqd) && (
                    <div className="rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20 p-5">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="text-xs text-muted-foreground mb-1">السعر</p>
                          <div className="flex items-baseline gap-3">
                            {selectedProduct.price_iqd && (
                              <span className="text-3xl font-black text-primary">
                                {selectedProduct.price_iqd.toLocaleString()}
                              </span>
                            )}
                            <span className="text-sm text-muted-foreground">د.ع</span>
                          </div>
                          {selectedProduct.original_price_iqd && selectedProduct.price_iqd && 
                           selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                            <p className="text-sm text-muted-foreground line-through mt-1">
                              {selectedProduct.original_price_iqd.toLocaleString()} د.ع
                            </p>
                          )}
                        </div>
                        {selectedProduct.original_price_iqd && selectedProduct.price_iqd && 
                         selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                          <Badge className="bg-destructive/10 text-destructive border-destructive/20 gap-1">
                            <BadgePercent className="h-3.5 w-3.5" />
                            خصم {Math.round((1 - selectedProduct.price_iqd / selectedProduct.original_price_iqd) * 100)}%
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Execution Time */}
                  {selectedProduct.estimated_days && (
                    <div className="rounded-2xl border border-border/50 bg-card p-4">
                      <div className="flex items-center gap-4">
                        <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Clock className="h-6 w-6 text-primary" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">وقت التنفيذ المتوقع</Label>
                          <p className="text-lg font-bold">{selectedProduct.estimated_days} يوم</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Description */}
                  {selectedProduct.description && (
                    <div className="rounded-2xl border border-border/50 bg-card p-5">
                      <Label className="text-xs text-muted-foreground">وصف المنتج</Label>
                      <p className="text-sm text-foreground/80 mt-3 whitespace-pre-wrap leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}

                  {/* CTA */}
                  <Button size="lg" className="w-full gap-2 shadow-lg" onClick={handleContactMerchant}>
                    <MessageCircle className="h-5 w-5" />
                    تواصل للطلب
                  </Button>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>

        {/* Message Dialog */}
        <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageCircle className="h-5 w-5 text-primary" />
                مراسلة التاجر
              </DialogTitle>
              <DialogDescription>
                سيتم فتح محادثة جديدة مع {merchantApp?.display_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 pt-2">
              {selectedProduct && (
                <div className="flex items-start gap-4 p-4 rounded-2xl bg-muted/20 border border-border/50">
                  <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted/30 shrink-0">
                    {selectedProduct.image_urls?.[0] ? (
                      <img
                        src={selectedProduct.image_urls[0]}
                        alt={selectedProduct.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium line-clamp-1">{selectedProduct.title}</p>
                    {selectedProduct.price_iqd && (
                      <p className="text-sm text-primary font-bold mt-1">
                        {selectedProduct.price_iqd.toLocaleString()} د.ع
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedProduct && (
                <div className="flex items-center gap-3 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                  <Checkbox
                    id="include-link"
                    checked={includeProductLink}
                    onCheckedChange={(checked) => setIncludeProductLink(!!checked)}
                  />
                  <label htmlFor="include-link" className="text-sm cursor-pointer flex-1">
                    <div className="flex items-center gap-2 font-medium">
                      <LinkIcon className="h-4 w-4 text-primary" />
                      إرسال رابط المنتج تلقائياً
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      سيتم إرفاق رابط المنتج في بداية المحادثة
                    </p>
                  </label>
                </div>
              )}

              <div className="flex gap-3 pt-2">
                <Button variant="outline" className="flex-1" onClick={() => setMessageDialogOpen(false)}>
                  إلغاء
                </Button>
                <Button className="flex-1 gap-2" onClick={handleStartConversation}>
                  <MessageCircle className="h-4 w-4" />
                  بدء المحادثة
                </Button>
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* Store Profile Editor */}
        {isOwner && editableMerchantApp && (
          <StoreProfileEditor
            open={profileEditorOpen}
            onOpenChange={setProfileEditorOpen}
            merchantApp={{
              ...editableMerchantApp,
              social_links: editableMerchantApp.social_links as { facebook?: string; instagram?: string } | null,
              specialty: editableMerchantApp.specialty as "resin" | "filament" | "both" | undefined,
            }}
          />
        )}
      </main>
    </div>
  );
}
