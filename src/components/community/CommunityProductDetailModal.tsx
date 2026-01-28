import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { 
  Store, 
  MessageCircle, 
  Clock, 
  BadgePercent, 
  Play, 
  Link as LinkIcon, 
  ExternalLink, 
  ChevronLeft,
  ChevronRight,
  Shield,
  Star,
  X,
  Maximize2,
  Package,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import SocialActions from "@/components/community/SocialActions";
import CommentsSection from "@/components/community/CommentsSection";

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
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [includeProductLink, setIncludeProductLink] = useState(true);
  const [fullscreenImage, setFullscreenImage] = useState(false);

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

  // Fetch merchant ratings
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

  // Fetch selected frame
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

  // Fetch similar products
  const { data: similarProducts } = useQuery({
    queryKey: ["similar-products", product?.id, product?.merchant_id],
    enabled: !!product?.id && open,
    queryFn: async () => {
      // Get products from same merchant
      const { data: sameMerchant, error: err1 } = await supabase
        .from("merchant_products")
        .select(`
          id, title, price_iqd, image_urls, merchant_id,
          merchant:merchant_public_profiles!inner(display_name, store_image_url)
        `)
        .eq("merchant_id", product!.merchant_id)
        .neq("id", product!.id)
        .eq("is_active", true)
        .limit(4);

      // Get products from other merchants
      const { data: otherMerchants, error: err2 } = await supabase
        .from("merchant_products")
        .select(`
          id, title, price_iqd, image_urls, merchant_id,
          merchant:merchant_public_profiles!inner(display_name, store_image_url)
        `)
        .neq("merchant_id", product!.merchant_id)
        .neq("id", product!.id)
        .eq("is_active", true)
        .limit(4);

      if (err1) console.error(err1);
      if (err2) console.error(err2);

      return {
        sameMerchant: sameMerchant || [],
        otherMerchants: otherMerchants || [],
      };
    },
  });

  const handleContactMerchant = () => {
    if (!user) {
      navigate("/auth");
      return;
    }
    setMessageDialogOpen(true);
  };

  const handleStartConversation = async () => {
    if (!user || !product) return;

    const { data: existingConv } = await supabase
      .from("listing_conversations")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("seller_id", product.merchant_id)
      .maybeSingle();

    let conversationId = existingConv?.id;

    if (!conversationId) {
      const convCode = `P${Date.now().toString(36).toUpperCase()}`;
      const { data: newConv, error } = await supabase
        .from("listing_conversations")
        .insert({
          buyer_id: user.id,
          seller_id: product.merchant_id,
          listing_id: product.id,
          conversation_code: convCode,
        })
        .select("id")
        .single();
      
      if (error) {
        console.error("Error creating conversation:", error);
        return;
      }
      conversationId = newConv.id;
    }

    if (includeProductLink && conversationId) {
      // Rich product message without URL (cleaner display)
      const systemMessage = `📦 ${product.title}
💰 ${product.price_iqd ? `${product.price_iqd.toLocaleString()} د.ع` : "السعر عند التواصل"}`;

      await supabase.from("listing_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: systemMessage,
        // Store product image for rich display
        image_url: product.image_urls?.[0] || null,
      });

      await supabase
        .from("listing_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);
    }

    onOpenChange(false);
    setMessageDialogOpen(false);
    navigate(`/community/messages?auto_open=${conversationId}`);
  };

  const handleVisitStore = () => {
    if (product?.merchant_id) {
      onOpenChange(false);
      navigate(`/store/${product.merchant_id}`);
    }
  };

  const navigateMedia = (direction: "prev" | "next") => {
    if (!product?.image_urls) return;
    const len = product.image_urls.length;
    if (direction === "prev") {
      setActiveMediaIndex((i) => (i - 1 + len) % len);
    } else {
      setActiveMediaIndex((i) => (i + 1) % len);
    }
  };

  const discountPercent = useMemo(() => {
    if (!product?.original_price_iqd || !product?.price_iqd) return 0;
    if (product.original_price_iqd <= product.price_iqd) return 0;
    return Math.round(((product.original_price_iqd - product.price_iqd) / product.original_price_iqd) * 100);
  }, [product?.original_price_iqd, product?.price_iqd]);

  if (!product) return null;

  const activeUrl = product.image_urls?.[Math.min(activeMediaIndex, (product.image_urls?.length || 1) - 1)];

  return (
    <>
      {/* Main Product Detail Modal */}
      <Dialog open={open && !messageDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-md p-0 gap-0 overflow-hidden rounded-3xl border border-border/30 bg-background shadow-2xl"
          hideClose
        >
          <div className="flex flex-col max-h-[90vh]">
            {/* Sticky Hero Image */}
            <div className="relative aspect-[5/3] bg-muted/20 overflow-hidden shrink-0 sticky top-0 z-10">
              {activeUrl ? (
                <>
                  <img
                    src={activeUrl}
                    alt={product.title}
                    className="w-full h-full object-contain bg-muted/10 cursor-zoom-in"
                    onClick={() => setFullscreenImage(true)}
                  />
                  
                  {/* Navigation */}
                  {product.image_urls && product.image_urls.length > 1 && (
                    <>
                      <button
                        onClick={() => navigateMedia("next")}
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={() => navigateMedia("prev")}
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors shadow"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </>
                  )}

                  {/* Fullscreen */}
                  <button
                    onClick={() => setFullscreenImage(true)}
                    className="absolute top-2 left-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <Maximize2 className="h-3.5 w-3.5" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Package className="h-12 w-12 text-muted-foreground/30" />
                </div>
              )}

              {/* Close */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-2 right-2 h-7 w-7 rounded-full bg-background/80 backdrop-blur-sm flex items-center justify-center hover:bg-background transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>

              {/* Discount */}
              {discountPercent > 0 && (
                <Badge className="absolute top-2 left-11 bg-destructive text-destructive-foreground text-[10px] px-1.5 py-0 gap-0.5">
                  <BadgePercent className="h-3 w-3" />
                  {discountPercent}%
                </Badge>
              )}

              {/* Video Badge */}
              {product.video_url && (
                <Badge variant="secondary" className="absolute bottom-2 left-2 text-[10px] gap-1">
                  <Play className="h-3 w-3" />
                  فيديو
                </Badge>
              )}

              {/* Counter */}
              {product.image_urls && product.image_urls.length > 1 && (
                <Badge variant="secondary" className="absolute bottom-2 right-2 text-[10px] tabular-nums">
                  {activeMediaIndex + 1}/{product.image_urls.length}
                </Badge>
              )}
            </div>

            {/* Thumbnails */}
            {product.image_urls && product.image_urls.length > 1 && (
              <div className="flex gap-1 p-2 border-b border-border/50 overflow-x-auto shrink-0">
                {product.image_urls.slice(0, 8).map((url, idx) => (
                  <button
                    key={idx}
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`shrink-0 h-10 w-10 rounded-md overflow-hidden border transition-all ${
                      idx === activeMediaIndex 
                        ? "border-primary ring-1 ring-primary/30" 
                        : "border-border/50 hover:border-primary/50"
                    }`}
                  >
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Scrollable Content */}
            <div className="flex-1 overflow-y-auto overscroll-contain">
              <div className="p-2.5 space-y-2">
                {/* Title & Price */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-xs font-bold text-foreground line-clamp-2 leading-tight">
                      {product.title}
                    </h2>
                    {product.estimated_days && (
                      <div className="flex items-center gap-1 mt-1 text-[11px] text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {product.estimated_days} يوم
                      </div>
                    )}
                  </div>
                  
                  <div className="shrink-0 text-left">
                    {product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd && (
                      <div className="text-[10px] text-muted-foreground line-through">
                        {product.original_price_iqd.toLocaleString()}
                      </div>
                    )}
                    {product.price_iqd ? (
                      <div className="text-base font-bold text-primary tabular-nums">
                        {product.price_iqd.toLocaleString()}
                        <span className="text-[10px] font-medium mr-0.5">د.ع</span>
                      </div>
                    ) : (
                      <span className="text-[11px] text-muted-foreground">عند التواصل</span>
                    )}
                  </div>
                </div>

                {/* Social Actions */}
                <div className="flex justify-end">
                  <SocialActions 
                    targetType="product" 
                    targetId={product.id}
                    showComments={false}
                    compact
                  />
                </div>

                {/* Merchant */}
                {merchantApp && (
                  <button
                    onClick={handleVisitStore}
                    className="w-full rounded-lg border border-border/50 bg-muted/20 p-2 hover:bg-muted/40 transition-colors group"
                  >
                    <div className="flex items-center gap-2">
                      <div className="relative">
                        <AvatarWithFrame
                          imageUrl={merchantApp.store_image_url}
                          frameUrl={selectedFrame?.image_url}
                          size="xs"
                        />
                        {merchantApp.is_verified && (
                          <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-primary flex items-center justify-center ring-1 ring-background">
                            <Shield className="h-2 w-2 text-primary-foreground" />
                          </div>
                        )}
                      </div>
                      <div className="flex-1 min-w-0 text-right">
                        <p className="text-xs font-semibold truncate group-hover:text-primary transition-colors">
                          {merchantApp.display_name}
                        </p>
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
                    <p className="text-xs text-foreground/80 mt-1 whitespace-pre-wrap leading-relaxed line-clamp-4">
                      {product.description}
                    </p>
                  </div>
                )}

                {/* Video */}
                {product.video_url && (
                  <div className="rounded-lg border border-border/50 overflow-hidden">
                    <video controls className="w-full max-h-40" preload="metadata">
                      <source src={product.video_url} />
                    </video>
                  </div>
                )}

                {/* Similar Products - Same Merchant */}
                {similarProducts?.sameMerchant && similarProducts.sameMerchant.length > 0 && (
                  <div className="pt-1">
                    <Label className="text-[10px] text-muted-foreground mb-2 block">منتجات أخرى من نفس التاجر</Label>
                    <div className="grid grid-cols-4 gap-1.5">
                      {similarProducts.sameMerchant.slice(0, 4).map((p: any) => (
                        <button
                          key={p.id}
                          onClick={() => {
                            setActiveMediaIndex(0);
                            navigate(`/store/${p.merchant_id}?product=${p.id}`);
                            onOpenChange(false);
                          }}
                          className="rounded-md border border-border/40 bg-muted/20 overflow-hidden hover:border-primary/40 transition-colors"
                        >
                          <div className="aspect-square bg-muted/30">
                            {p.image_urls?.[0] ? (
                              <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="p-1">
                            <p className="text-[9px] font-medium line-clamp-1">{p.title}</p>
                            {p.price_iqd && (
                              <p className="text-[9px] text-primary font-bold">{p.price_iqd.toLocaleString()}</p>
                            )}
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
                        <button
                          key={p.id}
                          onClick={() => {
                            navigate(`/store/${p.merchant_id}?product=${p.id}`);
                            onOpenChange(false);
                          }}
                          className="rounded-md border border-border/40 bg-muted/20 overflow-hidden hover:border-primary/40 transition-colors"
                        >
                          <div className="aspect-square bg-muted/30">
                            {p.image_urls?.[0] ? (
                              <img src={p.image_urls[0]} alt="" className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center">
                                <Package className="h-4 w-4 text-muted-foreground/30" />
                              </div>
                            )}
                          </div>
                          <div className="p-1">
                            <p className="text-[9px] font-medium line-clamp-1">{p.title}</p>
                            <p className="text-[8px] text-muted-foreground truncate">{p.merchant?.display_name}</p>
                            {p.price_iqd && (
                              <p className="text-[9px] text-primary font-bold">{p.price_iqd.toLocaleString()}</p>
                            )}
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Comments Section */}
                <div className="pt-3 border-t border-white/10">
                  <CommentsSection 
                    targetType="product" 
                    targetId={product.id}
                    initialVisibleCount={3}
                  />
                </div>

                {/* Actions - Compact */}
                <div className="flex gap-1.5 pt-0.5 sticky bottom-0 bg-background pb-2">
                  <Button 
                    size="sm"
                    className="flex-1 gap-1 h-8 text-[11px] font-bold rounded-xl" 
                    onClick={handleContactMerchant}
                  >
                    <MessageCircle className="h-3 w-3" />
                    تواصل للطلب
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    className="gap-1 h-8 text-[11px] rounded-xl" 
                    onClick={handleVisitStore}
                  >
                    <Store className="h-3 w-3" />
                    المتجر
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen */}
      <Dialog open={fullscreenImage} onOpenChange={setFullscreenImage}>
        <DialogContent className="max-w-[90vw] max-h-[90vh] p-0 rounded-3xl border-0 bg-black/95">
          <button
            onClick={() => setFullscreenImage(false)}
            className="absolute top-2 right-2 z-50 h-7 w-7 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20"
          >
            <X className="h-3.5 w-3.5 text-white" />
          </button>
          {product.image_urls && (
            <img
              src={product.image_urls[activeMediaIndex]}
              alt={product.title}
              className="w-full h-full object-contain"
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Message Dialog - Compact */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-xs rounded-2xl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-1.5 text-xs">
              <MessageCircle className="h-3.5 w-3.5 text-primary" />
              مراسلة التاجر
            </DialogTitle>
            <DialogDescription className="text-[11px]">
              {merchantApp?.display_name || "التاجر"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-2">
            {/* Product Preview */}
            <div className="flex items-center gap-2 p-1.5 rounded-lg bg-muted/30 border border-border/50">
              <div className="h-8 w-8 rounded-md overflow-hidden bg-muted/50 shrink-0">
                {product.image_urls?.[0] ? (
                  <img src={product.image_urls[0]} alt="" className="h-full w-full object-cover" />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Package className="h-3 w-3 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-medium line-clamp-1">{product.title}</p>
                {product.price_iqd && (
                  <p className="text-[11px] text-primary font-bold">{product.price_iqd.toLocaleString()} د.ع</p>
                )}
              </div>
            </div>

            {/* Auto-send Option */}
            <div className="flex items-start gap-1.5 p-1.5 rounded-lg bg-primary/5 border border-primary/20">
              <Checkbox
                id="include-link"
                checked={includeProductLink}
                onCheckedChange={(c) => setIncludeProductLink(!!c)}
                className="mt-0.5 h-3.5 w-3.5"
              />
              <label htmlFor="include-link" className="text-[11px] cursor-pointer flex-1">
                <span className="font-medium flex items-center gap-1">
                  <LinkIcon className="h-2.5 w-2.5" />
                  إرسال تفاصيل المنتج
                </span>
              </label>
            </div>

            {/* Buttons */}
            <div className="flex gap-1.5">
              <Button variant="outline" size="sm" className="flex-1 h-7 text-[11px] rounded-xl" onClick={() => setMessageDialogOpen(false)}>
                إلغاء
              </Button>
              <Button size="sm" className="flex-1 gap-1 h-7 text-[11px] rounded-xl" onClick={handleStartConversation}>
                <MessageCircle className="h-2.5 w-2.5" />
                بدء المحادثة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
