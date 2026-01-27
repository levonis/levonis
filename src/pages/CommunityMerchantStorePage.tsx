import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, Play, MessageCircle, Link as LinkIcon, Star, Package, Sparkles
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
import { AspectRatio } from "@/components/ui/aspect-ratio";
import RatingsPreview from "@/components/merchant/RatingsPreview";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import StoreHeroSection from "@/components/merchant/StoreHeroSection";
import StoreStatsGrid from "@/components/merchant/StoreStatsGrid";
import ProductCardEnhanced from "@/components/merchant/ProductCardEnhanced";

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

  const socialLinks = merchantApp?.social_links as { facebook?: string; instagram?: string } | undefined;

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-6xl">
          <Skeleton className="h-80 rounded-[2rem] mb-8" />
          <Skeleton className="h-24 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
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
            <p className="text-xl font-bold mb-2">لا يمكن العثور على هذا المتجر</p>
            <p className="text-sm text-muted-foreground mb-8">قد يكون المتجر غير موجود أو تم إلغاؤه</p>
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
          isOwner={isOwner}
          onSettingsClick={() => setProfileEditorOpen(true)}
          onContactClick={handleContactMerchant}
          showContactButton
        />

        {/* Stats Grid */}
        <div className="mb-8">
          <StoreStatsGrid
            stats={{
              activeProducts: products.length,
              completedOrders: storeStats?.totalOrders || 0,
              avgRating: storeStats?.avgRating || 0,
              totalRatings: storeStats?.totalRatings || 0,
            }}
            variant="client"
          />
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Sidebar: Ratings */}
          <div className="lg:col-span-1 space-y-4">
            <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 overflow-hidden rounded-2xl shadow-lg">
              <CardContent className="p-5">
                <div className="flex items-center gap-3 mb-4">
                  <div className="h-10 w-10 rounded-xl bg-amber-500/10 flex items-center justify-center">
                    <Star className="h-5 w-5 text-amber-500 fill-amber-500" />
                  </div>
                  <div>
                    <h2 className="text-sm font-bold text-foreground">تقييمات العملاء</h2>
                    <p className="text-[10px] text-muted-foreground">آخر التقييمات</p>
                  </div>
                </div>
                <RatingsPreview merchantId={merchantId!} />
              </CardContent>
            </Card>
          </div>

          {/* Main: Products */}
          <div className="lg:col-span-3">
            <div className="flex items-center gap-3 mb-6">
              <div className="h-12 w-12 rounded-2xl bg-primary/10 flex items-center justify-center">
                <Package className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-foreground">منتجات المتجر</h2>
                <p className="text-xs text-muted-foreground">{products.length} منتج متاح للطلب</p>
              </div>
            </div>

            {products.length === 0 ? (
              <Card className="border-border/50 bg-gradient-to-br from-card to-card/80 p-16 rounded-3xl">
                <div className="text-center">
                  <div className="h-24 w-24 rounded-3xl bg-muted/20 flex items-center justify-center mx-auto mb-6">
                    <Sparkles className="h-12 w-12 text-muted-foreground/30" />
                  </div>
                  <p className="text-lg font-bold mb-2">لا توجد منتجات متاحة</p>
                  <p className="text-sm text-muted-foreground">سيتم عرض المنتجات هنا بمجرد إضافتها</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {products.map((product) => (
                  <ProductCardEnhanced
                    key={product.id}
                    product={product}
                    variant="client"
                    onView={() => handleOpenDetail(product)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      </main>

      {/* Product Detail Dialog */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden rounded-3xl border-border/50">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              {selectedProduct?.title}
            </DialogTitle>
            <DialogDescription>تفاصيل المنتج</DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-4 max-h-[60vh] overflow-y-auto py-4">
              {/* Media Section */}
              {(selectedProduct.image_urls?.length || selectedProduct.video_url) && (
                <div className="space-y-3">
                  <div className="relative rounded-2xl overflow-hidden bg-muted">
                    <AspectRatio ratio={1}>
                      {selectedProduct.video_url && activeMediaIndex === (selectedProduct.image_urls?.length || 0) ? (
                        <video
                          src={selectedProduct.video_url}
                          controls
                          className="w-full h-full object-contain bg-black"
                        />
                      ) : (
                        <img
                          src={selectedProduct.image_urls?.[activeMediaIndex]}
                          alt={selectedProduct.title}
                          className="w-full h-full object-contain"
                        />
                      )}
                    </AspectRatio>
                  </div>
                  
                  {/* Thumbnails */}
                  {(selectedProduct.image_urls?.length || 0) + (selectedProduct.video_url ? 1 : 0) > 1 && (
                    <div className="flex gap-2 overflow-x-auto pb-2">
                      {selectedProduct.image_urls?.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveMediaIndex(i)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                            activeMediaIndex === i ? "border-primary shadow-lg" : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {selectedProduct.video_url && (
                        <button
                          onClick={() => setActiveMediaIndex(selectedProduct.image_urls?.length || 0)}
                          className={`relative w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all bg-black flex items-center justify-center ${
                            activeMediaIndex === (selectedProduct.image_urls?.length || 0)
                              ? "border-primary shadow-lg"
                              : "border-transparent opacity-60 hover:opacity-100"
                          }`}
                        >
                          <Play className="h-6 w-6 text-white fill-white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedProduct.description && (
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {selectedProduct.description}
                </p>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2 p-4 rounded-2xl bg-primary/5 border border-primary/20">
                {selectedProduct.price_iqd ? (
                  <>
                    <span className="text-2xl font-bold text-primary">
                      {selectedProduct.price_iqd.toLocaleString()}
                    </span>
                    <span className="text-sm text-muted-foreground">د.ع</span>
                    {selectedProduct.original_price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                      <span className="text-sm text-muted-foreground line-through mr-auto">
                        {selectedProduct.original_price_iqd.toLocaleString()} د.ع
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-muted-foreground">تواصل مع التاجر للسعر</span>
                )}
              </div>

              {/* Contact Button */}
              <Button className="w-full h-12 text-base gap-2" onClick={handleContactMerchant}>
                <MessageCircle className="h-5 w-5" />
                طلب هذا المنتج
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-md rounded-3xl border-border/50">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <MessageCircle className="h-5 w-5 text-primary" />
              بدء محادثة
            </DialogTitle>
            <DialogDescription>تواصل مع التاجر لطلب المنتج</DialogDescription>
          </DialogHeader>
          
          <div className="space-y-4 py-4">
            {selectedProduct && (
              <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/50 border border-border/50">
                {selectedProduct.image_urls?.[0] && (
                  <img
                    src={selectedProduct.image_urls[0]}
                    alt=""
                    className="h-14 w-14 rounded-xl object-cover"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-sm truncate">{selectedProduct.title}</p>
                  {selectedProduct.price_iqd && (
                    <p className="text-sm text-primary font-bold">
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
                  onCheckedChange={(c) => setIncludeProductLink(!!c)}
                />
                <Label htmlFor="include-link" className="text-sm cursor-pointer flex items-center gap-2">
                  <LinkIcon className="h-4 w-4" />
                  إرسال رابط المنتج مع الرسالة
                </Label>
              </div>
            )}

            <Button className="w-full h-12 text-base gap-2" onClick={handleStartConversation}>
              <MessageCircle className="h-5 w-5" />
              بدء المحادثة
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Profile Editor */}
      {editableMerchantApp && (
        <StoreProfileEditor
          open={profileEditorOpen}
          onOpenChange={setProfileEditorOpen}
          merchantApp={{
            id: editableMerchantApp.id,
            display_name: editableMerchantApp.display_name,
            bio: editableMerchantApp.bio,
            store_image_url: editableMerchantApp.store_image_url,
            social_links: (editableMerchantApp.social_links as { facebook?: string; instagram?: string }) || null,
            selected_frame_id: editableMerchantApp.selected_frame_id,
            specialty: (editableMerchantApp.specialty as "resin" | "filament" | "both") || undefined,
          }}
        />
      )}
    </div>
  );
}
