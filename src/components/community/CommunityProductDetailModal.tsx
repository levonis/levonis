import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { Store, MessageCircle, Clock, BadgePercent, Play, Link as LinkIcon, ExternalLink, Palette, Package } from "lucide-react";
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

    // Create or get existing conversation
    const { data: existingConv } = await supabase
      .from("listing_conversations")
      .select("id")
      .eq("buyer_id", user.id)
      .eq("seller_id", product.merchant_id)
      .maybeSingle();

    let conversationId = existingConv?.id;

    if (!conversationId) {
      // Create new conversation
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

    // Send automatic system message with product info
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

      // Update conversation timestamp
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

  if (!product) return null;

  return (
    <>
      {/* Main Product Detail Modal */}
      <Dialog open={open && !messageDialogOpen} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-lg">{product.title}</DialogTitle>
          </DialogHeader>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Media Section */}
            <div className="space-y-3">
              {product.image_urls && product.image_urls.length > 0 ? (
                <div className="rounded-2xl overflow-hidden border border-border bg-muted/10">
                  <div className="relative aspect-square bg-muted/20">
                    <img
                      src={product.image_urls[Math.min(activeMediaIndex, product.image_urls.length - 1)]}
                      alt={product.title}
                      className="w-full h-full object-cover"
                    />
                    {!!product.video_url && (
                      <div className="absolute bottom-3 left-3">
                        <div className="inline-flex items-center gap-1 rounded-full bg-background/80 backdrop-blur px-2 py-1 border border-border text-xs text-muted-foreground">
                          <Play className="h-3.5 w-3.5" />
                          فيديو متاح
                        </div>
                      </div>
                    )}
                  </div>
                  {product.image_urls.length > 1 && (
                    <div className="grid grid-cols-5 gap-2 p-3 bg-background/40">
                      {product.image_urls.slice(0, 10).map((url, idx) => (
                        <button
                          key={idx}
                          type="button"
                          onClick={() => setActiveMediaIndex(idx)}
                          className={`relative aspect-square rounded-lg overflow-hidden border transition-colors ${
                            idx === activeMediaIndex ? "border-primary ring-2 ring-primary/30" : "border-border hover:border-primary/50"
                          }`}
                        >
                          <img src={url} alt={`${product.title} ${idx + 1}`} className="w-full h-full object-cover" />
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

              {product.video_url && (
                <div className="rounded-2xl border border-border overflow-hidden">
                  <video controls className="w-full" preload="metadata">
                    <source src={product.video_url} />
                    المتصفح لا يدعم تشغيل الفيديو.
                  </video>
                </div>
              )}
            </div>

            {/* Details Section */}
            <div className="space-y-4">
              {/* Merchant Info */}
              {merchantApp && (
                <button
                  onClick={handleVisitStore}
                  className="w-full rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-4 hover:shadow-lg transition-all group"
                >
                  <div className="flex items-center gap-3">
                    <AvatarWithFrame
                      imageUrl={merchantApp.store_image_url}
                      frameUrl={selectedFrame?.image_url}
                      size="sm"
                      animated
                    />
                    <div className="flex-1 text-right min-w-0">
                      <p className="font-bold text-sm truncate group-hover:text-primary transition-colors">
                        {merchantApp.display_name}
                      </p>
                      <p className="text-xs text-muted-foreground">زيارة المتجر</p>
                    </div>
                    <ExternalLink className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
                  </div>
                </button>
              )}

              {/* Price */}
              {(product.price_iqd || product.original_price_iqd) && (
                <div className="rounded-2xl border border-border bg-gradient-to-br from-card to-primary/5 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs text-muted-foreground">السعر</p>
                      <div className="mt-1 flex items-baseline gap-2 flex-wrap">
                        {product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd && (
                          <span className="text-sm text-muted-foreground line-through">
                            {product.original_price_iqd.toLocaleString()} د.ع
                          </span>
                        )}
                        {product.price_iqd ? (
                          <span className="text-2xl font-black text-primary">
                            {product.price_iqd.toLocaleString()} د.ع
                          </span>
                        ) : (
                          <span className="text-sm text-muted-foreground">السعر عند التواصل</span>
                        )}
                      </div>
                    </div>
                    {product.original_price_iqd && product.price_iqd && product.original_price_iqd > product.price_iqd && (
                      <Badge variant="outline" className="gap-1 bg-destructive/10 border-destructive/30 text-destructive">
                        <BadgePercent className="h-3.5 w-3.5" />
                        خصم
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Estimated Days */}
              {product.estimated_days && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-xl bg-primary/10 flex items-center justify-center">
                      <Clock className="h-5 w-5 text-primary" />
                    </div>
                    <div>
                      <Label className="text-xs text-muted-foreground">وقت التنفيذ</Label>
                      <p className="text-sm font-semibold">{product.estimated_days} يوم تقريباً</p>
                    </div>
                  </div>
                </div>
              )}

              {/* Description */}
              {product.description && (
                <div className="rounded-2xl border border-border bg-card p-4">
                  <Label className="text-xs text-muted-foreground">الوصف</Label>
                  <p className="text-sm text-foreground/80 mt-2 whitespace-pre-wrap leading-relaxed">
                    {product.description}
                  </p>
                </div>
              )}

              {/* Action Buttons */}
              <div className="flex gap-2">
                <Button className="flex-1 gap-2" onClick={handleContactMerchant}>
                  <MessageCircle className="h-4 w-4" />
                  تواصل للطلب
                </Button>
                <Button variant="outline" className="gap-2" onClick={handleVisitStore}>
                  <Store className="h-4 w-4" />
                  المتجر
                </Button>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Message Confirmation Dialog */}
      <Dialog open={messageDialogOpen} onOpenChange={setMessageDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>مراسلة التاجر</DialogTitle>
            <DialogDescription>
              سيتم فتح محادثة جديدة مع {merchantApp?.display_name || "التاجر"}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4">
            {/* Product Preview */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-muted/20 border border-border">
              <div className="h-14 w-14 rounded-lg overflow-hidden bg-muted/30 shrink-0">
                {product.image_urls?.[0] ? (
                  <img
                    src={product.image_urls[0]}
                    alt={product.title}
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center">
                    <Store className="h-6 w-6 text-muted-foreground" />
                  </div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium line-clamp-2">{product.title}</p>
                {product.price_iqd && (
                  <p className="text-xs text-primary font-bold mt-1">
                    {product.price_iqd.toLocaleString()} د.ع
                  </p>
                )}
              </div>
            </div>

            {/* Auto-send Option */}
            <div className="flex items-start gap-3 p-3 rounded-xl bg-primary/5 border border-primary/20">
              <Checkbox
                id="include-product-link"
                checked={includeProductLink}
                onCheckedChange={(checked) => setIncludeProductLink(!!checked)}
                className="mt-0.5"
              />
              <label htmlFor="include-product-link" className="text-sm cursor-pointer flex-1">
                <div className="flex items-center gap-2">
                  <LinkIcon className="h-4 w-4 text-primary" />
                  <span className="font-medium">إرسال تفاصيل المنتج تلقائياً</span>
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  سيتم إرسال رسالة تحتوي على اسم المنتج وسعره ورابطه لتسهيل التواصل
                </p>
              </label>
            </div>

            {/* Action Buttons */}
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
    </>
  );
}
