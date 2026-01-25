import { useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Store, Facebook, Instagram, ArrowRight, Clock, BadgePercent, Play, MessageCircle, Link as LinkIcon, Settings, Star, Sparkles } from "lucide-react";
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
}

export default function CommunityMerchantStorePage() {
  const navigate = useNavigate();
  const { merchantId } = useParams<{ merchantId: string }>();
  const [searchParams] = useSearchParams();
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
        .select("id, display_name, bio, store_image_url, social_links, selected_frame_id")
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
        .select("id, display_name, bio, store_image_url, social_links, is_verified, badge_tier, selected_frame_id")
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
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
          <Skeleton className="h-48 rounded-2xl mb-6" />
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 rounded-xl" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (!merchantApp) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-background to-muted/20">
        <main className="container mx-auto px-4 py-8 pt-24 max-w-4xl">
          <Card className="border-border bg-card p-6">
            <p className="text-sm text-muted-foreground">لا يمكن العثور على هذا المتجر.</p>
            <Button className="mt-4" variant="outline" onClick={() => navigate("/community")}>
              العودة للمجتمع
            </Button>
          </Card>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-background via-background to-muted/30">
      <main className="container mx-auto px-4 py-8 pt-24 max-w-5xl">
        {/* Hero Store Header */}
        <Card className="border-border bg-gradient-to-br from-card via-card to-primary/5 mb-6 overflow-hidden relative">
          {/* Decorative Elements */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
          <div className="absolute bottom-0 left-0 w-24 h-24 bg-primary/10 rounded-full blur-2xl" />
          
          <CardContent className="p-6 relative">
            <div className="flex flex-col sm:flex-row gap-5 items-start">
              {/* Circular Store Image with Frame */}
              <div className="shrink-0 relative mx-auto sm:mx-0">
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
                    className="absolute -bottom-1 -right-1 h-8 w-8 rounded-full shadow-lg"
                    onClick={() => setProfileEditorOpen(true)}
                  >
                    <Settings className="h-4 w-4" />
                  </Button>
                )}
              </div>

              <div className="flex-1 text-center sm:text-right">
                {/* Store Name & Badges */}
                <div className="flex flex-col sm:flex-row items-center sm:items-start gap-2 mb-2">
                  <h1 className="text-2xl sm:text-3xl font-black bg-gradient-to-l from-primary to-primary/70 bg-clip-text text-transparent">
                    {merchantApp.display_name}
                  </h1>
                  <CompactBadgesDisplay
                    isVerified={merchantApp.is_verified}
                    badgeTier={(merchantApp.badge_tier || "none") as BadgeTier}
                  />
                </div>
                
                <p className="text-xs text-muted-foreground mb-3">متجر داخل مجتمع ليفو</p>

                {merchantApp.bio && (
                  <p className="text-sm text-foreground/80 mb-4 whitespace-pre-wrap leading-relaxed max-w-md">
                    {merchantApp.bio}
                  </p>
                )}

                {/* Social Links */}
                {(socialLinks?.facebook || socialLinks?.instagram) && (
                  <div className="flex gap-2 justify-center sm:justify-start mb-4">
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

                {/* Quick Actions */}
                <div className="flex gap-2 justify-center sm:justify-start">
                  <Button
                    size="sm"
                    className="gap-2"
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
                  <Button variant="outline" size="sm" onClick={() => navigate("/community")}>
                    <ArrowRight className="ml-1 h-4 w-4" />
                    رجوع
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Two Column Layout: Ratings + Products */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Sidebar: Ratings */}
          <div className="lg:col-span-1 space-y-4">
            <div className="flex items-center gap-2 mb-2">
              <Star className="h-4 w-4 text-yellow-500 fill-yellow-500" />
              <h2 className="text-sm font-bold text-foreground">التقييمات</h2>
            </div>
            <RatingsPreview merchantId={merchantId!} />
          </div>

          {/* Main: Products */}
          <div className="lg:col-span-2">
            <div className="flex items-center gap-2 mb-4">
              <Store className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">المنتجات</h2>
              <Badge variant="secondary" className="text-[10px]">{products.length}</Badge>
            </div>

            {products.length === 0 ? (
              <Card className="border-border bg-card/50 p-8">
                <div className="text-center">
                  <Store className="h-12 w-12 text-muted-foreground mx-auto mb-3" />
                  <p className="text-sm text-muted-foreground">لا توجد منتجات متاحة حالياً</p>
                </div>
              </Card>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {products.map((p) => {
                  const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0];
                  return (
                    <Card
                      key={p.id}
                      className="border-border bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:shadow-xl hover:scale-[1.02] transition-all duration-300 group"
                      onClick={() => handleOpenDetail(p)}
                    >
                      <div className="relative aspect-square bg-muted/20">
                        {mainImg ? (
                          <img src={mainImg} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        ) : (
                          <div className="flex items-center justify-center w-full h-full">
                            <Store className="h-12 w-12 text-muted-foreground" />
                          </div>
                        )}
                        {p.original_price_iqd && p.price_iqd && p.original_price_iqd > p.price_iqd && (
                          <Badge className="absolute top-2 right-2 bg-destructive text-destructive-foreground text-[10px]">
                            خصم
                          </Badge>
                        )}
                      </div>
                      <CardContent className="p-3">
                        <p className="text-sm font-semibold line-clamp-1 mb-1">{p.title}</p>
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
                          <div className="flex items-center gap-1 mt-1.5">
                            <Clock className="h-3 w-3 text-muted-foreground" />
                            <span className="text-[10px] text-muted-foreground">{p.estimated_days} يوم</span>
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

        {/* Product Detail Dialog */}
        <Dialog open={detailDialogOpen} onOpenChange={setDetailDialogOpen}>
          <DialogContent className="sm:max-w-3xl">
            <DialogHeader>
              <DialogTitle>{selectedProduct?.title}</DialogTitle>
            </DialogHeader>
            {selectedProduct && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-h-[70vh] overflow-y-auto px-1">
                {/* Media */}
                <div className="space-y-3">
                  {selectedProduct.image_urls && selectedProduct.image_urls.length > 0 ? (
                    <div className="rounded-2xl overflow-hidden border border-border bg-muted/10">
                      <div className="relative aspect-square bg-muted/20">
                        <img
                          src={selectedProduct.image_urls[Math.min(activeMediaIndex, selectedProduct.image_urls.length - 1)]}
                          alt={selectedProduct.title}
                          className="w-full h-full object-cover"
                        />
                        {!!selectedProduct.video_url && (
                          <div className="absolute bottom-3 left-3">
                            <div className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2 py-1 border border-border text-xs text-muted-foreground">
                              <Play className="h-3.5 w-3.5" />
                              فيديو متاح
                            </div>
                          </div>
                        )}
                      </div>
                      {selectedProduct.image_urls.length > 1 && (
                        <div className="grid grid-cols-5 gap-2 p-3 bg-background/40">
                          {selectedProduct.image_urls.slice(0, 10).map((url, idx) => (
                            <button
                              key={idx}
                              type="button"
                              onClick={() => setActiveMediaIndex(idx)}
                              className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                                idx === activeMediaIndex ? "border-primary" : "border-border hover:border-primary/50"
                              }`}
                            >
                              <img src={url} alt={`${selectedProduct.title} ${idx + 1}`} className="w-full h-full object-cover" />
                            </button>
                          ))}
                        </div>
                      )}
                    </div>
                  ) : (
                    <div className="rounded-2xl border border-border bg-muted/20 aspect-square flex items-center justify-center">
                      <Store className="h-12 w-12 text-muted-foreground" />
                    </div>
                  )}
                  {selectedProduct.video_url && (
                    <div className="rounded-2xl border border-border overflow-hidden">
                      <video controls className="w-full" preload="metadata">
                        <source src={selectedProduct.video_url} />
                        المتصفح لا يدعم تشغيل الفيديو.
                      </video>
                    </div>
                  )}
                </div>

                {/* Details */}
                <div className="space-y-4">
                  {(selectedProduct.price_iqd || selectedProduct.original_price_iqd) && (
                    <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-4">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-xs text-muted-foreground">السعر</p>
                          <div className="mt-1 flex items-baseline gap-2">
                            {selectedProduct.original_price_iqd && selectedProduct.price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                              <span className="text-sm text-muted-foreground line-through">
                                {selectedProduct.original_price_iqd.toLocaleString()} د.ع
                              </span>
                            )}
                            {selectedProduct.price_iqd && (
                              <span className="text-2xl font-black text-primary">
                                {selectedProduct.price_iqd.toLocaleString()} د.ع
                              </span>
                            )}
                          </div>
                        </div>
                        {selectedProduct.original_price_iqd && selectedProduct.price_iqd && selectedProduct.original_price_iqd > selectedProduct.price_iqd && (
                          <Badge variant="outline" className="gap-1 bg-destructive/10 border-destructive/30 text-destructive">
                            <BadgePercent className="h-3.5 w-3.5" />
                            خصم
                          </Badge>
                        )}
                      </div>
                    </div>
                  )}

                  {selectedProduct.estimated_days && (
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                          <Clock className="h-5 w-5 text-primary" />
                        </div>
                        <div>
                          <Label className="text-xs text-muted-foreground">وقت التنفيذ</Label>
                          <p className="text-sm font-semibold">{selectedProduct.estimated_days} يوم تقريباً</p>
                        </div>
                      </div>
                    </div>
                  )}

                  {selectedProduct.description && (
                    <div className="rounded-2xl border border-border bg-card p-4">
                      <Label className="text-xs text-muted-foreground">الوصف</Label>
                      <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}

                  <Button className="w-full gap-2" onClick={handleContactMerchant}>
                    <MessageCircle className="h-4 w-4" />
                    تواصل مع التاجر
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
              <DialogTitle>مراسلة التاجر</DialogTitle>
              <DialogDescription>
                سيتم فتح محادثة جديدة مع {merchantApp?.display_name}
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4">
              {selectedProduct && (
                <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
                  <div className="h-12 w-12 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                    {selectedProduct.image_urls?.[0] ? (
                      <img
                        src={selectedProduct.image_urls[0]}
                        alt={selectedProduct.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium line-clamp-1">{selectedProduct.title}</p>
                    {selectedProduct.price_iqd && (
                      <p className="text-xs text-primary font-bold mt-0.5">
                        {selectedProduct.price_iqd.toLocaleString()} د.ع
                      </p>
                    )}
                  </div>
                </div>
              )}

              {selectedProduct && (
                <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
                  <Checkbox
                    id="include-link"
                    checked={includeProductLink}
                    onCheckedChange={(checked) => setIncludeProductLink(!!checked)}
                  />
                  <label htmlFor="include-link" className="text-sm cursor-pointer flex-1">
                    <div className="flex items-center gap-2">
                      <LinkIcon className="h-4 w-4 text-primary" />
                      <span>إرسال رابط المنتج تلقائياً</span>
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      سيتم إرفاق رابط المنتج في بداية المحادثة
                    </p>
                  </label>
                </div>
              )}

              <div className="flex gap-2">
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

        {/* Store Profile Editor (for owners) */}
        {isOwner && editableMerchantApp && (
          <StoreProfileEditor
            open={profileEditorOpen}
            onOpenChange={setProfileEditorOpen}
            merchantApp={{
              ...editableMerchantApp,
              social_links: editableMerchantApp.social_links as { facebook?: string; instagram?: string } | null,
            }}
          />
        )}
      </main>
    </div>
  );
}
