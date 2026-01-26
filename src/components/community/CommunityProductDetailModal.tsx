import { useState } from "react";
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
  Sparkles,
  Shield,
  Star,
  X,
  Maximize2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

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
      const productUrl = `${window.location.origin}/store/${product.merchant_id}?product=${product.id}`;
      const systemMessage = `📦 طلب استفسار عن منتج

🏷️ المنتج: ${product.title}
${product.price_iqd ? `💰 السعر: ${product.price_iqd.toLocaleString()} د.ع` : "💰 السعر: غير محدد"}
${product.description ? `📝 الوصف: ${product.description.slice(0, 100)}${product.description.length > 100 ? "..." : ""}` : ""}

🔗 رابط المنتج: ${productUrl}

---
مرحباً، أنا مهتم بهذا المنتج وأود الاستفسار عنه.`;

      await supabase.from("listing_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: systemMessage,
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

  const discountPercent = product?.original_price_iqd && product?.price_iqd && product.original_price_iqd > product.price_iqd
    ? Math.round(((product.original_price_iqd - product.price_iqd) / product.original_price_iqd) * 100)
    : 0;

  if (!product) return null;

  return (
    <>
      {/* Main Product Detail Modal - Premium Redesign */}
      <Dialog open={open && !messageDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent 
          className="sm:max-w-4xl p-0 gap-0 overflow-hidden border-0 bg-gradient-to-b from-background via-background to-muted/20"
          hideClose
        >
          {/* Custom Header with Gradient */}
          <div className="relative">
            {/* Hero Image Section */}
            <div className="relative aspect-[16/10] sm:aspect-[2/1] bg-gradient-to-br from-muted/50 to-muted overflow-hidden">
              {product.image_urls && product.image_urls.length > 0 ? (
                <>
                  <img
                    src={product.image_urls[Math.min(activeMediaIndex, product.image_urls.length - 1)]}
                    alt={product.title}
                    className="w-full h-full object-cover"
                    onClick={() => setFullscreenImage(true)}
                  />
                  {/* Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-transparent to-transparent" />
                  
                  {/* Navigation Arrows */}
                  {product.image_urls.length > 1 && (
                    <>
                      <button
                        onClick={() => navigateMedia("next")}
                        className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors shadow-lg"
                      >
                        <ChevronLeft className="h-5 w-5" />
                      </button>
                      <button
                        onClick={() => navigateMedia("prev")}
                        className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors shadow-lg"
                      >
                        <ChevronRight className="h-5 w-5" />
                      </button>
                    </>
                  )}

                  {/* Fullscreen Button */}
                  <button
                    onClick={() => setFullscreenImage(true)}
                    className="absolute top-3 left-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
                  >
                    <Maximize2 className="h-4 w-4" />
                  </button>
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center">
                  <Store className="h-16 w-16 text-muted-foreground/30" />
                </div>
              )}

              {/* Close Button */}
              <button
                onClick={() => onOpenChange(false)}
                className="absolute top-3 right-3 h-9 w-9 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 flex items-center justify-center hover:bg-background transition-colors"
              >
                <X className="h-4 w-4" />
              </button>

              {/* Discount Badge */}
              {discountPercent > 0 && (
                <div className="absolute top-3 left-14 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-destructive text-destructive-foreground text-sm font-bold shadow-lg">
                  <BadgePercent className="h-4 w-4" />
                  <span>خصم {discountPercent}%</span>
                </div>
              )}

              {/* Video Badge */}
              {product.video_url && (
                <div className="absolute bottom-16 left-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs font-medium">
                  <Play className="h-3.5 w-3.5 text-primary" />
                  فيديو متاح
                </div>
              )}

              {/* Image Counter */}
              {product.image_urls && product.image_urls.length > 1 && (
                <div className="absolute bottom-16 right-3 px-3 py-1.5 rounded-full bg-background/80 backdrop-blur-sm border border-border/50 text-xs font-bold tabular-nums">
                  {activeMediaIndex + 1} / {product.image_urls.length}
                </div>
              )}
            </div>

            {/* Thumbnails Strip */}
            {product.image_urls && product.image_urls.length > 1 && (
              <div className="absolute -bottom-4 left-1/2 -translate-x-1/2 flex gap-1.5 p-2 rounded-2xl bg-background/95 backdrop-blur border border-border/50 shadow-xl">
                {product.image_urls.slice(0, 6).map((url, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => setActiveMediaIndex(idx)}
                    className={`relative h-12 w-12 rounded-xl overflow-hidden border-2 transition-all ${
                      idx === activeMediaIndex 
                        ? "border-primary ring-2 ring-primary/20 scale-110" 
                        : "border-transparent hover:border-primary/30"
                    }`}
                  >
                    <img src={url} alt={`${idx + 1}`} className="w-full h-full object-cover" />
                  </button>
                ))}
                {product.image_urls.length > 6 && (
                  <div className="h-12 w-12 rounded-xl bg-muted/50 flex items-center justify-center text-xs font-bold text-muted-foreground">
                    +{product.image_urls.length - 6}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Content Section */}
          <div className="p-5 pt-8 space-y-4 max-h-[50vh] overflow-y-auto">
            {/* Title & Price Row */}
            <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
              <div className="flex-1 min-w-0">
                <h2 className="text-xl sm:text-2xl font-black text-foreground leading-tight">
                  {product.title}
                </h2>
                {product.estimated_days && (
                  <div className="flex items-center gap-1.5 mt-2 text-sm text-muted-foreground">
                    <Clock className="h-4 w-4" />
                    <span>التنفيذ خلال {product.estimated_days} يوم</span>
                  </div>
                )}
              </div>
              
              {/* Price Card */}
              <div className="shrink-0 p-4 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-transparent border border-primary/20">
                {product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd && (
                  <div className="text-sm text-muted-foreground line-through mb-0.5">
                    {product.original_price_iqd.toLocaleString()} د.ع
                  </div>
                )}
                {product.price_iqd ? (
                  <div className="text-2xl sm:text-3xl font-black text-primary tabular-nums">
                    {product.price_iqd.toLocaleString()}
                    <span className="text-sm font-semibold mr-1">د.ع</span>
                  </div>
                ) : (
                  <div className="text-sm text-muted-foreground flex items-center gap-1.5">
                    <Sparkles className="h-4 w-4 text-primary" />
                    السعر عند التواصل
                  </div>
                )}
              </div>
            </div>

            {/* Merchant Card - Premium */}
            {merchantApp && (
              <button
                onClick={handleVisitStore}
                className="w-full rounded-2xl border border-border/60 bg-gradient-to-r from-card via-card to-primary/5 p-4 hover:shadow-xl hover:border-primary/30 transition-all group"
              >
                <div className="flex items-center gap-4">
                  <div className="relative">
                    <AvatarWithFrame
                      imageUrl={merchantApp.store_image_url}
                      frameUrl={selectedFrame?.image_url}
                      size="md"
                      animated
                    />
                    {merchantApp.is_verified && (
                      <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-primary flex items-center justify-center ring-2 ring-background">
                        <Shield className="h-3 w-3 text-primary-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="flex-1 text-right min-w-0">
                    <div className="flex items-center gap-2 justify-end">
                      <p className="font-bold text-base truncate group-hover:text-primary transition-colors">
                        {merchantApp.display_name}
                      </p>
                      {merchantApp.badge_tier && (
                        <Badge variant="secondary" className="text-[10px] shrink-0">
                          {merchantApp.badge_tier}
                        </Badge>
                      )}
                    </div>
                    {merchantRatings && merchantRatings.count > 0 && (
                      <div className="flex items-center gap-1.5 justify-end mt-1">
                        <span className="text-sm font-semibold">{merchantRatings.avg.toFixed(1)}</span>
                        <Star className="h-3.5 w-3.5 text-amber-500 fill-amber-500" />
                        <span className="text-xs text-muted-foreground">({merchantRatings.count})</span>
                      </div>
                    )}
                  </div>
                  <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                    <ExternalLink className="h-5 w-5" />
                  </div>
                </div>
              </button>
            )}

            {/* Description */}
            {product.description && (
              <div className="rounded-2xl border border-border/60 bg-card/50 p-4">
                <Label className="text-xs text-muted-foreground font-medium">الوصف</Label>
                <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">
                  {product.description}
                </p>
              </div>
            )}

            {/* Video Section */}
            {product.video_url && (
              <div className="rounded-2xl border border-border/60 overflow-hidden">
                <video controls className="w-full" preload="metadata">
                  <source src={product.video_url} />
                  المتصفح لا يدعم تشغيل الفيديو.
                </video>
              </div>
            )}

            {/* Action Buttons - Fixed Bottom */}
            <div className="flex gap-3 pt-2">
              <Button 
                size="lg"
                className="flex-1 gap-2 h-12 text-base font-bold rounded-xl shadow-lg shadow-primary/20" 
                onClick={handleContactMerchant}
              >
                <MessageCircle className="h-5 w-5" />
                تواصل للطلب
              </Button>
              <Button 
                variant="outline" 
                size="lg"
                className="gap-2 h-12 rounded-xl" 
                onClick={handleVisitStore}
              >
                <Store className="h-5 w-5" />
                المتجر
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Fullscreen Image Viewer */}
      <Dialog open={fullscreenImage} onOpenChange={setFullscreenImage}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] p-0 border-0 bg-black/95">
          <button
            onClick={() => setFullscreenImage(false)}
            className="absolute top-4 right-4 z-50 h-10 w-10 rounded-full bg-white/10 backdrop-blur flex items-center justify-center hover:bg-white/20 transition-colors"
          >
            <X className="h-5 w-5 text-white" />
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

      {/* Message Confirmation Dialog - Improved */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-md border-primary/20">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
                <MessageCircle className="h-4 w-4 text-primary" />
              </div>
              مراسلة التاجر
            </DialogTitle>
            <DialogDescription>
              سيتم فتح محادثة مع {merchantApp?.display_name || "التاجر"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product Preview - Enhanced */}
            <div className="flex items-start gap-4 p-4 rounded-2xl bg-gradient-to-br from-muted/30 to-muted/10 border border-border/60">
              <div className="h-16 w-16 rounded-xl overflow-hidden bg-muted/50 shrink-0 ring-2 ring-border/30">
                {product.image_urls?.[0] ? (
                  <img
                    src={product.image_urls[0]}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Store className="h-7 w-7 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-bold line-clamp-2">{product.title}</p>
                {product.price_iqd && (
                  <p className="text-base text-primary font-black mt-1 tabular-nums">
                    {product.price_iqd.toLocaleString()} د.ع
                  </p>
                )}
              </div>
            </div>

            {/* Auto-send Option - Enhanced */}
            <div className="flex items-start gap-3 p-4 rounded-2xl bg-primary/5 border-2 border-primary/20">
              <Checkbox
                id="include-product-link"
                checked={includeProductLink}
                onCheckedChange={(checked) => setIncludeProductLink(!!checked)}
                className="mt-0.5"
              />
              <label htmlFor="include-product-link" className="text-sm cursor-pointer flex-1">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <span className="font-bold">إرسال تفاصيل المنتج تلقائياً</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1 leading-relaxed">
                  سيتم إرسال رسالة تحتوي على اسم المنتج وسعره ورابطه
                </p>
              </label>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3 pt-2">
              <Button variant="outline" className="flex-1 h-11 rounded-xl" onClick={() => setMessageDialogOpen(false)}>
                إلغاء
              </Button>
              <Button className="flex-1 gap-2 h-11 rounded-xl font-bold" onClick={handleStartConversation}>
                <MessageCircle className="h-4 w-4" />
                بدء المحادثة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
