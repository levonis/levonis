import { useState, useMemo, useEffect } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Star, Package, Sparkles, ShoppingBag, ChevronLeft, ChevronRight, 
  Users, Shield, CheckCircle, ArrowRight, MessageCircle, Droplets, Layers, Settings
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import RatingsPreview from "@/components/merchant/RatingsPreview";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import CompactProductCard from "@/components/merchant/CompactProductCard";
import ProfessionalCustomerOrderDialog from "@/components/merchant/ProfessionalCustomerOrderDialog";
import StoreFollowButton from "@/components/community/StoreFollowButton";
import PrinterModelsCard from "@/components/merchant/PrinterModelsCard";
import CommunityProductDetailModal from "@/components/community/CommunityProductDetailModal";
import MerchantReelsSection from "@/components/merchant/MerchantReelsSection";

const PRODUCTS_PER_PAGE = 20;

interface MerchantProduct {
  id: string;
  merchant_id: string;
  title: string;
  description: string | null;
  price_iqd: number | null;
  original_price_iqd: number | null;
  image_urls: string[] | null;
  video_url: string | null;
  primary_image_index: number;
  estimated_days: number | null;
  is_featured?: boolean;
  material_type?: "resin" | "filament" | "both" | null;
}

export default function CommunityMerchantStorePage() {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
  const [detailModalOpen, setDetailModalOpen] = useState(false);
  const [orderDialogOpen, setOrderDialogOpen] = useState(false);
  const [profileEditorOpen, setProfileEditorOpen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);

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

  // Pagination
  const totalPages = Math.ceil(products.length / PRODUCTS_PER_PAGE);
  const paginatedProducts = useMemo(() => {
    const start = (currentPage - 1) * PRODUCTS_PER_PAGE;
    return products.slice(start, start + PRODUCTS_PER_PAGE);
  }, [products, currentPage]);

  // Auto-open product from query param (e.g., from reels)
  useEffect(() => {
    const productId = searchParams.get('product');
    if (productId && products.length > 0) {
      const product = products.find(p => p.id === productId);
      if (product) {
        handleOpenDetail(product);
      }
    }
  }, [searchParams, products]);

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
    setSelectedProduct({ ...product, merchant_id: merchantId! });
    setDetailModalOpen(true);
  };

  const handleContactMerchant = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    const params = new URLSearchParams();
    params.set("merchant_id", merchantId!);
    navigate(`/community/messages?${params.toString()}`);
  };

  const getSpecialtyInfo = (specialty?: string | null) => {
    if (specialty === "resin") return { icon: Droplets, label: "رزن", color: "text-blue-400" };
    if (specialty === "filament") return { icon: Layers, label: "فلمنت", color: "text-orange-400" };
    if (specialty === "both") return { icons: [Droplets, Layers], label: "رزن وفلمنت" };
    return null;
  };

  const specialtyInfo = getSpecialtyInfo(merchantApp?.specialty);

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-6 pt-20 max-w-5xl">
          <Skeleton className="h-48 rounded-2xl mb-4" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-6 pt-20 max-w-3xl">
          <Card className="p-8 text-center rounded-2xl border-border/50">
            <Store className="h-12 w-12 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-lg font-bold mb-1">لا يمكن العثور على المتجر</p>
            <p className="text-sm text-muted-foreground mb-4">قد يكون غير موجود أو تم إلغاؤه</p>
            <Button variant="outline" onClick={() => navigate("/community")}>
              العودة للمجتمع
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <main className="container mx-auto px-4 py-6 pt-20 max-w-5xl">
        {/* Professional Hero Section */}
        <div className="relative mb-6 rounded-2xl overflow-hidden border border-border/50 bg-gradient-to-br from-[hsl(160_52%_18%)] via-[hsl(160_50%_14%)] to-[hsl(160_48%_10%)]">
          {/* Decorative elements */}
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,hsl(160_60%_25%/0.15),transparent_50%)]" />
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_70%_80%,hsl(160_60%_20%/0.1),transparent_50%)]" />
          
          <div className="relative p-6 sm:p-8">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar Section */}
              <div className="relative shrink-0">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/40 to-primary/10 rounded-full blur-2xl scale-150 opacity-30" />
                <AvatarWithFrame
                  imageUrl={merchantApp.store_image_url}
                  frameUrl={selectedFrame?.image_url}
                  size="xl"
                  animated
                />
                {merchantApp.is_verified && (
                  <div className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full bg-primary flex items-center justify-center ring-2 ring-background shadow-lg">
                    <CheckCircle className="h-4 w-4 text-primary-foreground" />
                  </div>
                )}
              </div>

              {/* Info Section */}
              <div className="flex-1 text-center sm:text-right min-w-0 space-y-3">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2">
                    <h1 className="text-2xl sm:text-3xl font-black text-white">
                      {merchantApp.display_name}
                    </h1>
                    {merchantApp.badge_tier && merchantApp.badge_tier !== "none" && (
                      <Badge variant="secondary" className="text-[10px] h-5 gap-1 bg-white/10 text-white/90 border-white/20">
                        <Shield className="h-3 w-3" />
                        {merchantApp.badge_tier}
                      </Badge>
                    )}
                  </div>
                  
                  {merchantApp.bio && (
                    <p className="text-sm text-white/70 line-clamp-2 max-w-lg">
                      {merchantApp.bio}
                    </p>
                  )}
                </div>

                {/* Stats Pills */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start">
                  {specialtyInfo && (
                    <Badge variant="secondary" className="text-xs h-7 gap-1.5 bg-white/10 text-white/90 border-white/20">
                      {"icons" in specialtyInfo ? (
                        <>
                          <Droplets className="h-3.5 w-3.5 text-blue-400" />
                          <Layers className="h-3.5 w-3.5 text-orange-400" />
                        </>
                      ) : (
                        <specialtyInfo.icon className={`h-3.5 w-3.5 ${specialtyInfo.color}`} />
                      )}
                      {specialtyInfo.label}
                    </Badge>
                  )}
                  
                  <Badge variant="secondary" className="text-xs h-7 gap-1.5 bg-white/10 text-white/90 border-white/20">
                    <Package className="h-3.5 w-3.5 text-primary" />
                    {products.length} منتج
                  </Badge>
                  
                  <Badge variant="secondary" className="text-xs h-7 gap-1.5 bg-white/10 text-white/90 border-white/20">
                    <ShoppingBag className="h-3.5 w-3.5 text-emerald-400" />
                    {storeStats?.totalOrders || 0} طلب مكتمل
                  </Badge>
                  
                  <Badge variant="secondary" className="text-xs h-7 gap-1.5 bg-white/10 text-white/90 border-white/20">
                    <Star className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />
                    {storeStats?.avgRating?.toFixed(1) || "0"} ({storeStats?.totalRatings || 0})
                  </Badge>
                </div>

                {/* Action Buttons */}
                <div className="flex flex-wrap gap-2 justify-center sm:justify-start pt-2">
                  {merchantId && (
                    <StoreFollowButton storeId={merchantId} compact showCount />
                  )}
                  
                  {!isOwner && (
                    <Button 
                      size="sm" 
                      onClick={handleContactMerchant}
                      className="h-8 text-xs gap-1.5 bg-white/10 hover:bg-white/20 text-white border-0"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      تواصل
                    </Button>
                  )}

                  {isOwner && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setProfileEditorOpen(true)}
                      className="h-8 text-xs gap-1.5 bg-white/10 hover:bg-white/20 text-white border-white/20"
                    >
                      <Settings className="h-3.5 w-3.5" />
                      إعدادات المتجر
                    </Button>
                  )}

                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-8 text-xs gap-1 text-white/70 hover:text-white hover:bg-white/10"
                    onClick={() => navigate(-1)}
                  >
                    رجوع
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Content Grid */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 order-2 lg:order-1 space-y-3">
            {/* Printer Models Card */}
            <PrinterModelsCard merchantId={merchantId!} />
            
            {/* Ratings Card */}
            <Card className="rounded-xl overflow-hidden border-border/50 bg-gradient-to-br from-[hsl(160_52%_16%)] to-[hsl(160_48%_12%)]">
              <CardContent className="p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="p-1.5 rounded-lg bg-amber-500/20">
                    <Star className="h-4 w-4 text-amber-400 fill-amber-400" />
                  </div>
                  <span className="text-sm font-bold text-white">التقييمات</span>
                </div>
                <RatingsPreview merchantId={merchantId!} />
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3 order-1 lg:order-2 space-y-4">
            {products.length === 0 ? (
              <Card className="p-8 rounded-xl text-center border-border/50">
                <Sparkles className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-medium">لا توجد منتجات</p>
                <p className="text-xs text-muted-foreground">سيتم عرضها بمجرد إضافتها</p>
              </Card>
            ) : (
              <>
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-sm font-bold text-foreground">المنتجات</h2>
                  <span className="text-xs text-muted-foreground">{products.length} منتج</span>
                </div>
                
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2.5">
                  {paginatedProducts.map((product) => (
                    <CompactProductCard
                      key={product.id}
                      product={product}
                      onView={() => handleOpenDetail(product)}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    <div className="flex items-center gap-1">
                      {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
                        let page: number;
                        if (totalPages <= 5) {
                          page = i + 1;
                        } else if (currentPage <= 3) {
                          page = i + 1;
                        } else if (currentPage >= totalPages - 2) {
                          page = totalPages - 4 + i;
                        } else {
                          page = currentPage - 2 + i;
                        }
                        return (
                          <Button
                            key={page}
                            size="sm"
                            variant={currentPage === page ? "default" : "ghost"}
                            className="h-8 w-8 p-0 text-xs"
                            onClick={() => setCurrentPage(page)}
                          >
                            {page}
                          </Button>
                        );
                      })}
                    </div>
                    <Button
                      size="sm"
                      variant="outline"
                      className="h-8 w-8 p-0"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
          {/* Merchant Reels */}
          {merchantId && <MerchantReelsSection merchantId={merchantId} />}
        </div>
      </main>

      {/* Use the same Product Detail Modal as Community Products */}
      <CommunityProductDetailModal
        product={selectedProduct}
        open={detailModalOpen}
        onOpenChange={setDetailModalOpen}
      />

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
