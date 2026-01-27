import { useState, useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { 
  Store, Play, Star, Package, Sparkles, ShoppingBag, ChevronLeft, ChevronRight
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { AspectRatio } from "@/components/ui/aspect-ratio";
import { useToast } from "@/hooks/use-toast";
import RatingsPreview from "@/components/merchant/RatingsPreview";
import StoreProfileEditor from "@/components/merchant/StoreProfileEditor";
import MinimalStoreHero from "@/components/merchant/MinimalStoreHero";
import CompactProductCard from "@/components/merchant/CompactProductCard";
import ProfessionalCustomerOrderDialog from "@/components/merchant/ProfessionalCustomerOrderDialog";

const PRODUCTS_PER_PAGE = 20;

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
  is_featured?: boolean;
  material_type?: "resin" | "filament" | "both" | null;
}

export default function CommunityMerchantStorePage() {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId: string }>();
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [detailDialogOpen, setDetailDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<MerchantProduct | null>(null);
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
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

  const handleOrderProduct = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setDetailDialogOpen(false);
    setOrderDialogOpen(true);
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

  // Submit order mutation
  const submitOrderMutation = useMutation({
    mutationFn: async (orderData: {
      quantity: number;
      paymentMethod: string;
      addressId: string;
      governorate: string;
      commissionRate: number;
      totalWithCommission: number;
    }) => {
      if (!selectedProduct || !user) throw new Error("Missing data");
      
      const params = new URLSearchParams();
      params.set("merchant_id", merchantId!);
      params.set("product_id", selectedProduct.id);
      params.set("product_title", selectedProduct.title);
      params.set("product_price", String(selectedProduct.price_iqd || 0));
      params.set("quantity", String(orderData.quantity));
      params.set("payment_method", orderData.paymentMethod);
      params.set("governorate", orderData.governorate);
      params.set("address_id", orderData.addressId);
      params.set("total", String(orderData.totalWithCommission));
      
      navigate(`/community/messages?${params.toString()}`);
    },
    onSuccess: () => {
      setOrderDialogOpen(false);
      toast({ title: "تم بدء المحادثة", description: "سيتم إرسال تفاصيل طلبك للتاجر" });
    },
  });

  if (appLoading || productsLoading) {
    return (
      <div className="min-h-screen bg-background">
        <main className="container mx-auto px-4 py-6 pt-20 max-w-5xl">
          <Skeleton className="h-32 rounded-2xl mb-4" />
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
          <Card className="p-8 text-center rounded-2xl">
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
        {/* Minimal Hero */}
        <MinimalStoreHero
          merchantApp={{
            display_name: merchantApp.display_name,
            bio: merchantApp.bio,
            store_image_url: merchantApp.store_image_url,
            specialty: merchantApp.specialty,
            is_verified: merchantApp.is_verified,
            badge_tier: merchantApp.badge_tier,
          }}
          selectedFrame={selectedFrame}
          isOwner={isOwner}
          onSettingsClick={() => setProfileEditorOpen(true)}
          onContactClick={handleContactMerchant}
          showContactButton
        />

        {/* Stats Row - Compact */}
        <div className="flex gap-3 mb-5 overflow-x-auto pb-1">
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 shrink-0 text-xs">
            <Package className="h-3.5 w-3.5 text-primary" />
            <span className="font-medium">{products.length} منتج</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 shrink-0 text-xs">
            <ShoppingBag className="h-3.5 w-3.5 text-emerald-500" />
            <span className="font-medium">{storeStats?.totalOrders || 0} طلب</span>
          </div>
          <div className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg bg-muted/50 shrink-0 text-xs">
            <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
            <span className="font-medium">{storeStats?.avgRating?.toFixed(1) || "0"} ({storeStats?.totalRatings || 0})</span>
          </div>
        </div>

        {/* Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-4">
          {/* Sidebar */}
          <div className="lg:col-span-1 order-2 lg:order-1">
            <Card className="rounded-xl overflow-hidden">
              <CardContent className="p-3">
                <div className="flex items-center gap-1.5 mb-2">
                  <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                  <span className="text-xs font-semibold">التقييمات</span>
                </div>
                <RatingsPreview merchantId={merchantId!} />
              </CardContent>
            </Card>
          </div>

          {/* Products Grid */}
          <div className="lg:col-span-3 order-1 lg:order-2 space-y-4">
            {products.length === 0 ? (
              <Card className="p-8 rounded-xl text-center">
                <Sparkles className="h-10 w-10 text-muted-foreground/20 mx-auto mb-3" />
                <p className="font-medium">لا توجد منتجات</p>
                <p className="text-xs text-muted-foreground">سيتم عرضها بمجرد إضافتها</p>
              </Card>
            ) : (
              <>
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
                      {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
                        <Button
                          key={page}
                          size="sm"
                          variant={currentPage === page ? "default" : "ghost"}
                          className="h-8 w-8 p-0 text-xs"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      ))}
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
        </div>
      </main>

      {/* Product Detail Dialog - Compact */}
      <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
        <DialogContent className="sm:max-w-sm max-h-[85vh] overflow-hidden p-0">
          <DialogHeader className="p-3 pb-2 border-b border-border/50">
            <DialogTitle className="text-sm font-bold truncate pr-6">{selectedProduct?.title}</DialogTitle>
            <DialogDescription className="sr-only">تفاصيل المنتج</DialogDescription>
          </DialogHeader>
          
          {selectedProduct && (
            <div className="space-y-3 max-h-[55vh] overflow-y-auto p-3">
              {/* Media */}
              {(selectedProduct.image_urls?.length || selectedProduct.video_url) && (
                <div className="space-y-2">
                  <div className="relative rounded-lg overflow-hidden bg-muted">
                    <AspectRatio ratio={1}>
                      {selectedProduct.video_url && activeMediaIndex === (selectedProduct.image_urls?.length || 0) ? (
                        <video src={selectedProduct.video_url} controls className="w-full h-full object-contain bg-black" />
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
                    <div className="flex gap-1 overflow-x-auto pb-1">
                      {selectedProduct.image_urls?.map((url, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveMediaIndex(i)}
                          className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 transition-all ${
                            activeMediaIndex === i ? "border-primary" : "border-transparent opacity-60"
                          }`}
                        >
                          <img src={url} alt="" className="w-full h-full object-cover" />
                        </button>
                      ))}
                      {selectedProduct.video_url && (
                        <button
                          onClick={() => setActiveMediaIndex(selectedProduct.image_urls?.length || 0)}
                          className={`w-10 h-10 rounded-lg overflow-hidden shrink-0 border-2 bg-black flex items-center justify-center ${
                            activeMediaIndex === (selectedProduct.image_urls?.length || 0) ? "border-primary" : "border-transparent opacity-60"
                          }`}
                        >
                          <Play className="h-4 w-4 text-white fill-white" />
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Description */}
              {selectedProduct.description && (
                <p className="text-xs text-muted-foreground">{selectedProduct.description}</p>
              )}

              {/* Price */}
              <div className="flex items-baseline gap-2 p-3 rounded-lg bg-primary/5 border border-primary/20">
                {selectedProduct.price_iqd ? (
                  <>
                    <span className="text-lg font-bold text-primary">{selectedProduct.price_iqd.toLocaleString()}</span>
                    <span className="text-xs text-muted-foreground">د.ع</span>
                    {selectedProduct.original_price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                      <span className="text-xs text-muted-foreground line-through mr-auto">
                        {selectedProduct.original_price_iqd.toLocaleString()}
                      </span>
                    )}
                  </>
                ) : (
                  <span className="text-sm text-muted-foreground">تواصل للسعر</span>
                )}
              </div>

              {/* Order Button */}
              <Button className="w-full h-9 gap-2 text-sm" onClick={handleOrderProduct}>
                <ShoppingBag className="h-4 w-4" />
                طلب المنتج
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Order Dialog - Using Professional Version */}
      <ProfessionalCustomerOrderDialog
        open={orderDialogOpen}
        onOpenChange={setOrderDialogOpen}
        product={selectedProduct}
        merchantName={merchantApp.display_name}
        onSubmit={(data) => submitOrderMutation.mutate(data)}
        isSubmitting={submitOrderMutation.isPending}
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
