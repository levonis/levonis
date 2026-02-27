import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, MessageCircle, Clock, BadgePercent, Play, ExternalLink, ChevronLeft,
  ChevronRight, Shield, Star, X, Maximize2, Package, ShoppingBag, Palette, Settings2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import SocialActions from "@/components/community/SocialActions";
import CommentsSection from "@/components/community/CommentsSection";
import AddToCartSheet from "@/components/community/AddToCartSheet";

interface ProductColor {
  name: string;
  hex_code: string;
  image_url: string | null;
  stock_quantity: number | null;
}

interface ProductOption {
  name: string;
  image_url: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
}

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
  category_ids?: string[] | null;
  colors?: ProductColor[] | null;
  options?: ProductOption[] | null;
}

interface CommunityProductDetailModalProps {
  product: MerchantProduct | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function CommunityProductDetailModal({
  product,
  open,
  onOpenChange,
}: CommunityProductDetailModalProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [activeMediaIndex, setActiveMediaIndex] = useState(0);
  const [fullscreenImage, setFullscreenImage] = useState(false);
  const [cartSheetOpen, setCartSheetOpen] = useState(false);

  // Check if current user is a merchant
  const { data: currentUserMerchant } = useQuery({
    queryKey: ["current-user-merchant", user?.id],
    enabled: !!user?.id,
    staleTime: 300_000,
    queryFn: async () => {
      const { data } = await supabase
        .from("merchant_applications")
        .select("id")
        .eq("user_id", user!.id)
        .eq("status", "approved")
        .maybeSingle();
      return data;
    },
  });
  const isMerchant = !!currentUserMerchant;

  // Fetch full product details (with colors/options)
  const { data: fullProduct } = useQuery({
    queryKey: ["product-full", product?.id],
    enabled: !!product?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_products")
        .select("colors, options")
        .eq("id", product!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const productColors = (fullProduct?.colors || product?.colors || []) as ProductColor[];
  const productOptions = (fullProduct?.options || product?.options || []) as ProductOption[];

  const handleAddToCart = () => {
    if (!user) { navigate("/auth"); return; }
    setCartSheetOpen(true);
  };

  const mediaItems = useMemo(() => {
    const items: { type: 'video' | 'image'; url: string }[] = [];
    if (product?.video_url) items.push({ type: 'video', url: product.video_url });
    if (product?.image_urls) product.image_urls.forEach((url) => items.push({ type: 'image', url }));
    return items;
  }, [product?.video_url, product?.image_urls]);

  // Fetch merchant info
  const { data: merchantApp } = useQuery({
    queryKey: ["merchant-profile", product?.merchant_id],
    enabled: !!product?.merchant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, selected_frame_id, is_verified, badge_tier")
        .eq("id", product!.merchant_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: merchantRatings } = useQuery({
    queryKey: ["merchant-ratings-summary", product?.merchant_id],
    enabled: !!product?.merchant_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_ratings")
        .select("rating")
        .eq("merchant_id", product!.merchant_id);
      if (error) throw error;
      const count = data?.length || 0;
      const avg = count > 0 ? data.reduce((sum, r) => sum + r.rating, 0) / count : 0;
      return { count, avg };
    },
  });

  const { data: selectedFrame } = useQuery({
    queryKey: ["merchant-frame", merchantApp?.selected_frame_id],
    enabled: !!merchantApp?.selected_frame_id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("id, image_url")
        .eq("id", merchantApp!.selected_frame_id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: similarProducts } = useQuery({
    queryKey: ["similar-products", product?.id, product?.merchant_id],
    enabled: !!product?.id && open,
    queryFn: async () => {
      const { data: sameMerchant } = await supabase
        .from("merchant_products")
        .select(`id, title, price_iqd, image_urls, merchant_id, merchant:merchant_public_profiles!inner(display_name, store_image_url)`)
        .eq("merchant_id", product!.merchant_id)
        .neq("id", product!.id)
        .eq("is_active", true)
        .not("price_iqd", "is", null)
        .gt("price_iqd", 0)
        .limit(4);

      const { data: otherMerchants } = await supabase
        .from("merchant_products")
        .select(`id, title, price_iqd, image_urls, merchant_id, merchant:merchant_public_profiles!inner(display_name, store_image_url)`)
        .neq("merchant_id", product!.merchant_id)
        .neq("id", product!.id)
        .eq("is_active", true)
        .not("price_iqd", "is", null)
        .gt("price_iqd", 0)
        .limit(4);

      return { sameMerchant: sameMerchant || [], otherMerchants: otherMerchants || [] };
    },
  });

  const handleContactMerchant = async () => {
    if (!user) { navigate("/auth"); return; }
    if (!product) return;
    const params = new URLSearchParams({
      merchant_id: product.merchant_id,
      product_title: product.title,
      product_price: product.price_iqd?.toString() || '',
      product_image: product.image_urls?.[0] || '',
      product_id: product.id,
    });
    onOpenChange(false);
    navigate(`/community/messages?${params.toString()}`);
  };

  const handleVisitStore = () => {
    if (product?.merchant_id) {
      onOpenChange(false);
      navigate(`/store/${product.merchant_id}`);
    }
  };

  const navigateMedia = (direction: "prev" | "next") => {
    if (mediaItems.length === 0) return;
    const len = mediaItems.length;
    if (direction === "prev") setActiveMediaIndex((i) => (i - 1 + len) % len);
    else setActiveMediaIndex((i) => (i + 1) % len);
  };

  const discountPercent = useMemo(() => {
    if (!product?.original_price_iqd || !product?.price_iqd) return 0;
    if (product.original_price_iqd <= product.price_iqd) return 0;
    return Math.round(((product.original_price_iqd - product.price_iqd) / product.original_price_iqd) * 100);
  }, [product?.original_price_iqd, product?.price_iqd]);




  if (!product) return null;

  const activeMedia = mediaItems[Math.min(activeMediaIndex, mediaItems.length - 1)] || null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border border-border/30 bg-background shadow-2xl max-h-[90vh]"
          hideClose
        >
          <div className="flex flex-col max-h-[90vh] overflow-y-auto overscroll-contain">
            {/* Hero Media */}
            <div className="relative aspect-[5/3] bg-muted/20 overflow-hidden shrink-0">
              {activeMedia ? (
                <>
                  {activeMedia.type === 'video' ? (
                    <video src={activeMedia.url} controls className="w-full h-full object-contain bg-black" preload="metadata" />
                  ) : (
                    <img src={activeMedia.url} alt={product.title} className="w-full h-full object-contain bg-muted/10 cursor-zoom-in" onClick={() => setFullscreenImage(true)} />
                  )}
                  
                  {mediaItems.length > 1 && (
                    <>
                      <button onClick={() => navigateMedia("next")} className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow">
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button onClick={() => navigateMedia("prev")} className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow">
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {activeMedia.type === 'image' && (
                    <button onClick={() => setFullscreenImage(true)} className="absolute top-2 left-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors">
                      <Maximize2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}

              <button onClick={() => onOpenChange(false)} className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors">
                <X className="h-3.5 w-3.5" />
              </button>

              {discountPercent > 0 && (
                <Badge className="absolute top-2 left-11 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 gap-0.5">
                  <BadgePercent className="h-3 w-3" />{discountPercent}%
                </Badge>
              )}

              {activeMedia?.type === 'video' && (
                <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] gap-1"><Play className="h-3 w-3" />فيديو</Badge>
              )}

              {mediaItems.length > 1 && (
                <Badge variant="secondary" className="absolute bottom-2 right-2 text-[10px] tabular-nums">{activeMediaIndex + 1}/{mediaItems.length}</Badge>
              )}
            </div>

            {/* Thumbnails */}
            {mediaItems.length > 1 && (
              <div className="flex gap-1 p-2 border-b border-border/50 overflow-x-auto shrink-0">
                {mediaItems.slice(0, 8).map((media, idx) => (
                  <button key={idx} onClick={() => setActiveMediaIndex(idx)}
                    className={`relative shrink-0 h-10 w-10 rounded-md overflow-hidden border transition-all ${idx === activeMediaIndex ? "border-primary ring-1 ring-primary/30" : "border-border/50 hover:border-primary/50"}`}>
                    {media.type === 'video' ? (
                      <>
                        <video src={media.url} className="w-full h-full object-cover" muted />
                        <div className="absolute inset-0 bg-black/30 flex items-center justify-center"><Play className="h-3 w-3 text-white fill-white" /></div>
                      </>
                    ) : (
                      <img src={media.url} alt="" className="w-full h-full object-cover" />
                    )}
                  </button>
                ))}
              </div>
            )}

            {/* Content */}
            <div className="flex-1">
              <div className="p-2.5 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xs font-bold text-foreground line-clamp-2 leading-tight">{product.title}</h2>
                    {product.estimated_days && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />{product.estimated_days} يوم
                      </div>
                    )}
                  </div>
                  <div className="shrink-0 text-left">
                    {product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd && (
                      <div className="text-[10px] text-muted-foreground line-through">{product.original_price_iqd.toLocaleString()}</div>
                    )}
                    {product.price_iqd ? (
                      <div className="text-base font-bold text-primary tabular-nums">
                        {product.price_iqd.toLocaleString()}<span className="text-[10px] font-medium mr-0.5">د.ع</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">عند التواصل</span>
                    )}
                  </div>
                </div>

                {/* Options & Colors Preview */}
                {productOptions.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Settings2 className="h-2.5 w-2.5" />الخيارات</p>
                    <div className="flex flex-wrap gap-1">
                      {productOptions.map((opt, i) => (
                        <Badge key={i} variant="outline" className="text-[9px] h-5 px-1.5">
                          {opt.name}{opt.price_adjustment ? ` (${opt.price_adjustment > 0 ? '+' : ''}${opt.price_adjustment.toLocaleString()})` : ''}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
                {productColors.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-[10px] font-bold text-muted-foreground flex items-center gap-1"><Palette className="h-2.5 w-2.5" />الألوان</p>
                    <div className="flex flex-wrap gap-1">
                      {productColors.map((c, i) => (
                        <div key={i} className="flex items-center gap-1 px-1.5 py-0.5 rounded border border-border/50 bg-muted/10">
                          <span className="h-3 w-3 rounded-full border border-border/50" style={{ backgroundColor: c.hex_code }} />
                          <span className="text-[9px]">{c.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex justify-end">
                  <SocialActions targetType="product" targetId={product.id} showComments={false} compact />
                </div>

                {/* Merchant */}
                {merchantApp && (
                  <button onClick={handleVisitStore} className="w-full rounded-lg border border-border/50 bg-muted/20 p-2 hover:bg-muted/40 transition-colors group">
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <AvatarWithFrame imageUrl={merchantApp.store_image_url} frameUrl={selectedFrame?.image_url} size="xs" />
                        {merchantApp.is_verified && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center ring-1 ring-background">
                            <Shield className="h-2 w-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">{merchantApp.display_name}</p>
                        {merchantRatings && (
                          <div className="flex items-center gap-1 justify-end">
                            <span className="text-[11px] font-medium">{merchantRatings.avg.toFixed(1)}</span>
                            <Star className="h-2.5 w-2.5 text-amber-500 fill-amber-500" />
                            <span className="text-[10px] text-muted-foreground">({merchantRatings.count})</span>
                          </div>
                        )}
                      </div>
                      <ExternalLink className="h-3.5 w-3.5 text-muted-foreground group-hover:text-primary" />
                    </div>
                  </button>
                )}

                {/* Description */}
                {product.description && (
                  <div className="rounded-lg border border-border/50 bg-muted/10 p-2">
                    <Label className="text-[10px] text-muted-foreground">الوصف</Label>
                    <p className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-4">{product.description}</p>
                  </div>
                )}

                {/* Similar Products - Same Merchant */}
                {similarProducts?.sameMerchant && similarProducts.sameMerchant.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground mb-2 block">منتجات أخرى من نفس التاجر</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {similarProducts.sameMerchant.slice(0, 4).map((p: any) => (
                        <button key={p.id} onClick={() => { setActiveMediaIndex(0); navigate(`/store/${p.merchant_id}?product=${p.id}`); onOpenChange(false); }}
                          className="rounded-md border border-border/40 bg-muted/20 overflow-hidden hover:border-primary/40 transition-colors">
                          <div className="aspect-square bg-muted/30">
                            {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>}
                          </div>
                          <div className="p-1">
                            <p className="text-[9px] font-medium line-clamp-1">{p.title}</p>
                            {p.price_iqd && <p className="text-[9px] text-primary font-bold">{p.price_iqd.toLocaleString()}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Similar Products - Other Merchants */}
                {similarProducts?.otherMerchants && similarProducts.otherMerchants.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground mb-2 block">منتجات مشابهة من تجار آخرين</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {similarProducts.otherMerchants.slice(0, 4).map((p: any) => (
                        <button key={p.id} onClick={() => { navigate(`/store/${p.merchant_id}?product=${p.id}`); onOpenChange(false); }}
                          className="rounded-md border border-border/40 bg-muted/20 overflow-hidden hover:border-primary/40 transition-colors">
                          <div className="aspect-square bg-muted/30">
                            {p.image_urls?.[0] ? <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover" /> : <div className="w-full h-full flex items-center justify-center"><Package className="h-4 w-4 text-muted-foreground/30" /></div>}
                          </div>
                          <div className="p-1">
                            <p className="text-[9px] font-medium line-clamp-1">{p.title}</p>
                            <p className="text-[8px] text-muted-foreground truncate">{p.merchant?.display_name}</p>
                            {p.price_iqd && <p className="text-[9px] text-primary font-bold">{p.price_iqd.toLocaleString()}</p>}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments */}
                <div className="pt-3 border-t border-white/10">
                  <CommentsSection targetType="product" targetId={product.id} initialVisibleCount={3} />
                </div>

                {/* Actions - hidden for merchants */}
                {!isMerchant && (
                  <div className="flex gap-1.5 pt-0.5 sticky bottom-0 bg-background pb-2">
                    <Button size="sm" className="flex-1 gap-1 h-9 text-xs font-bold rounded-xl" onClick={handleAddToCart}>
                      <ShoppingBag className="h-3.5 w-3.5" />أضف للسلة
                    </Button>
                    <Button variant="outline" size="sm" className="gap-1 h-9 text-xs rounded-xl" onClick={handleContactMerchant}>
                      <MessageCircle className="h-3.5 w-3.5" />مراسلة
                    </Button>
                    <Button variant="ghost" size="sm" className="gap-1 h-9 text-xs rounded-xl" onClick={handleVisitStore}>
                      <Store className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image */}
      <Dialog open={fullscreenImage} onOpenChange={setFullscreenImage}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 rounded-3xl border-0 bg-black/95">
          <button onClick={() => setFullscreenImage(false)} className="absolute top-2 right-2 z-50 h-7 w-7 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20">
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          {activeMedia?.type === 'image' && (
            <img src={activeMedia.url} alt={product.title} className="w-full h-full object-contain" />
          )}
        </DialogContent>
      </Dialog>

      {/* Add to Cart Sheet */}
      <AddToCartSheet
        product={product}
        open={cartSheetOpen}
        onOpenChange={setCartSheetOpen}
      />
    </>
  );
}
