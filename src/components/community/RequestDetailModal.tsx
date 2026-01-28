import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import {
  Package,
  Ruler,
  Palette,
  Layers,
  MapPin,
  Clock,
  MessageSquare,
  ExternalLink,
  Hash,
  ChevronLeft,
  ChevronRight,
  X,
  User,
  Star,
  CheckCircle2,
  Plus,
  Play,
  Edit3,
  Sparkles,
  Send,
  Tag,
  Lock,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea, ScrollBar } from "@/components/ui/scroll-area";
import AcceptOfferDialog from "@/components/community/AcceptOfferDialog";
import EditOfferDialog from "@/components/community/EditOfferDialog";

interface PrintRequest {
  id: string;
  user_id: string;
  title: string;
  description: string;
  size: string;
  colors: string;
  notes: string | null;
  material_type: string | null;
  images: string[] | null;
  image_url: string | null;
  video_url: string | null;
  reference_links: string[] | null;
  status: string;
  created_at: string;
  accepted_offer_id: string | null;
  quantity?: number;
  customer_governorate?: string;
}

interface PrintOffer {
  id: string;
  trader_id: string;
  price_iqd: number;
  duration_days: number;
  grams: number | null;
  notes: string | null;
  status: string;
  created_at: string;
  edit_count?: number;
  merchant?: {
    display_name: string | null;
    store_image_url: string | null;
    is_verified: boolean;
    badge_tier: string | null;
  };
}

interface RequestDetailModalProps {
  request: PrintRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMerchant?: boolean;
  merchantId?: string;
  onAddOffer?: () => void;
}

const MATERIAL_CONFIG: Record<string, { label: string; icon: string; color: string }> = {
  filament: { label: "فلمنت (FDM)", icon: "🔧", color: "from-blue-500/20 to-blue-600/10 border-blue-500/30 text-blue-300" },
  resin: { label: "رزن (SLA/DLP)", icon: "💎", color: "from-purple-500/20 to-purple-600/10 border-purple-500/30 text-purple-300" },
  both: { label: "كلا النوعين", icon: "⚡", color: "from-emerald-500/20 to-emerald-600/10 border-emerald-500/30 text-emerald-300" },
  any: { label: "لا يهم النوع", icon: "✨", color: "from-slate-500/20 to-slate-600/10 border-slate-500/30 text-slate-300" },
};

export default function RequestDetailModal({
  request,
  open,
  onOpenChange,
  isMerchant = false,
  merchantId,
  onAddOffer,
}: RequestDetailModalProps) {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [acceptOffer, setAcceptOffer] = useState<PrintOffer | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [editOffer, setEditOffer] = useState<PrintOffer | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Fetch offers for this request
  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["request-offers", request?.id],
    enabled: open && !!request?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select(`
          id,
          trader_id,
          price_iqd,
          duration_days,
          grams,
          notes,
          status,
          created_at,
          edit_count
        `)
        .eq("request_id", request!.id)
        .order("price_iqd", { ascending: true });

      if (error) throw error;

      const traderIds = [...new Set((data || []).map((o) => o.trader_id))];
      if (traderIds.length === 0) return [];

      const { data: merchants } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, is_verified, badge_tier")
        .in("id", traderIds);

      const merchantMap = new Map((merchants || []).map((m) => [m.id, m]));

      return (data || []).map((offer) => ({
        ...offer,
        merchant: merchantMap.get(offer.trader_id) || null,
      })) as PrintOffer[];
    },
  });

  const myOffer = offers.find((o) => o.trader_id === merchantId);

  if (!request) return null;

  const images = request.images?.length ? request.images : request.image_url ? [request.image_url] : [];
  const hasImages = images.length > 0;
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_CONFIG[request.material_type] : null;
  const lowestPrice = offers.length > 0 ? Math.min(...offers.map(o => o.price_iqd)) : null;

  const nextImage = () => setCurrentImageIndex((i) => (i + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((i) => (i - 1 + images.length) % images.length);

  const handleAcceptOffer = (offer: PrintOffer) => {
    setAcceptOffer(offer);
    setShowAcceptDialog(true);
  };

  const handleChatWithMerchant = (traderId: string) => {
    navigate(`/community/messages?merchant=${traderId}&request=${request.id}`);
    onOpenChange(false);
  };

  const handleChatAboutRequest = () => {
    navigate(`/community/messages?request=${request.id}`);
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          hideClose
          className="!p-0 !gap-0 sm:max-w-lg max-h-[90vh] overflow-hidden"
        >
          {/* Hero Image Section */}
          <div className="relative">
            {hasImages ? (
              <div className="relative aspect-[16/9] bg-black/30">
                <img
                  src={images[currentImageIndex]}
                  alt={request.title}
                  className="w-full h-full object-contain"
                />
                
                {/* Navigation arrows */}
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/40 hover:bg-white/60"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Video badge */}
                {request.video_url && (
                  <a
                    href={request.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-3 right-3 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-red-500 text-white text-xs font-medium hover:bg-red-600 transition-colors"
                  >
                    <Play className="h-3 w-3" />
                    مشاهدة الفيديو
                  </a>
                )}
              </div>
            ) : (
              <div className="aspect-[16/9] bg-gradient-to-br from-primary/10 to-primary/5 flex items-center justify-center">
                <Package className="h-16 w-16 text-primary/20" />
              </div>
            )}

            {/* Close button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-3 left-3 h-9 w-9 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-all hover:scale-110 z-10"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Status Badge */}
            {isAccepted && (
              <Badge className="absolute top-3 right-3 bg-green-500 text-white border-0 gap-1">
                <Lock className="h-3 w-3" />
                تم الطلب - العروض مقفلة
              </Badge>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="max-h-[55vh] overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-4">
              
              {/* Title & Quick Stats */}
              <div className="space-y-3">
                <h2 className="text-lg font-bold text-foreground leading-tight">{request.title}</h2>
                
                {/* Stats Row */}
                <div className="flex items-center gap-3 flex-wrap">
                  {material && (
                    <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r border ${material.color}`}>
                      <Layers className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{material.label}</span>
                    </div>
                  )}
                  {request.customer_governorate && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-rose-500/20 to-rose-600/10 border border-rose-500/30 text-rose-300">
                      <MapPin className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{request.customer_governorate}</span>
                    </div>
                  )}
                  {request.quantity && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-gradient-to-r from-cyan-500/20 to-cyan-600/10 border border-cyan-500/30 text-cyan-300">
                      <Hash className="h-3.5 w-3.5" />
                      <span className="text-xs font-medium">{request.quantity} قطعة</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Specs Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Ruler className="h-3.5 w-3.5" />
                    <span className="text-[10px]">الحجم</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">{request.size}</p>
                </div>
                <div className="rounded-xl bg-white/5 border border-white/10 p-3">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Palette className="h-3.5 w-3.5" />
                    <span className="text-[10px]">الألوان</span>
                  </div>
                  <p className="font-semibold text-sm text-foreground">{request.colors}</p>
                </div>
              </div>

              {/* Description */}
              <div className="rounded-xl bg-white/5 border border-white/10 p-4">
                <p className="text-sm text-foreground/90 leading-relaxed whitespace-pre-wrap">
                  {request.description}
                </p>
              </div>

              {/* Notes */}
              {request.notes && (
                <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4">
                  <div className="flex items-center gap-2 text-amber-400 mb-2">
                    <Sparkles className="h-4 w-4" />
                    <span className="text-xs font-medium">ملاحظات العميل</span>
                  </div>
                  <p className="text-sm text-foreground/90">{request.notes}</p>
                </div>
              )}

              {/* Reference Links */}
              {request.reference_links && request.reference_links.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">روابط مرجعية</p>
                  <div className="flex flex-wrap gap-2">
                    {request.reference_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-xs text-primary hover:text-primary/80 bg-primary/10 hover:bg-primary/20 px-3 py-1.5 rounded-full transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        رابط {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Buttons - Chat & Price */}
              <div className="flex gap-2 pt-2">
                <Button
                  variant="outline"
                  className="flex-1 h-10 gap-2 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                  onClick={handleChatAboutRequest}
                >
                  <MessageSquare className="h-4 w-4" />
                  تواصل حول الطلب
                </Button>
                
                {/* Pricing Button for Merchants */}
                {isMerchant && !isOwner && !isAccepted && onAddOffer && (
                  myOffer ? (
                    <div className="flex-1 rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 text-center">
                      <p className="text-[10px] text-emerald-400 mb-0.5">عرضك</p>
                      <p className="font-bold text-emerald-300">{myOffer.price_iqd.toLocaleString()} د.ع</p>
                      {(myOffer.edit_count ?? 0) < 1 && (
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-[10px] gap-1 text-emerald-400 hover:bg-emerald-500/20 mt-1"
                          onClick={() => {
                            setEditOffer(myOffer);
                            setShowEditDialog(true);
                          }}
                        >
                          <Edit3 className="h-3 w-3" />
                          تعديل
                        </Button>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="flex-1 h-10 gap-2 bg-gradient-to-r from-primary to-emerald-600 hover:from-primary/90 hover:to-emerald-600/90"
                      onClick={onAddOffer}
                    >
                      <Plus className="h-4 w-4" />
                      تسعير الطلب
                    </Button>
                  )
                )}
              </div>

              {/* Offers Locked Notice */}
              {isAccepted && (
                <div className="rounded-xl bg-green-500/10 border border-green-500/30 p-3 flex items-center gap-3">
                  <Lock className="h-5 w-5 text-green-400 shrink-0" />
                  <div>
                    <p className="text-sm font-medium text-green-300">العروض مقفلة</p>
                    <p className="text-[10px] text-muted-foreground">تم قبول عرض لهذا الطلب - لم يعد بالإمكان تقديم عروض جديدة</p>
                  </div>
                </div>
              )}

              {/* Offers Section */}
              {offers.length > 0 && (
                <div className="pt-3 border-t border-white/10 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <h3 className="font-bold text-sm text-foreground">عروض الأسعار</h3>
                      <Badge className="bg-primary/20 text-primary border-0 text-[10px]">
                        {offers.length} عرض
                      </Badge>
                    </div>
                    {lowestPrice && (
                      <div className="flex items-center gap-1.5 text-xs text-emerald-400">
                        <Tag className="h-3.5 w-3.5" />
                        أقل سعر: {lowestPrice.toLocaleString()} د.ع
                      </div>
                    )}
                  </div>
                  
                  <ScrollArea className="w-full">
                    <div className="flex gap-3 pb-2">
                      {offers.map((offer, index) => (
                        <div
                          key={offer.id}
                          className={`shrink-0 w-52 rounded-2xl border p-3 space-y-2.5 transition-all ${
                            request.accepted_offer_id === offer.id
                              ? "border-green-500/50 bg-green-500/10 shadow-[0_0_20px_hsl(142_76%_36%/0.2)]"
                              : index === 0
                              ? "border-amber-500/30 bg-gradient-to-br from-amber-500/10 to-transparent"
                              : "border-white/10 bg-white/5"
                          }`}
                        >
                          {/* Best price badge */}
                          {index === 0 && !request.accepted_offer_id && (
                            <Badge className="bg-amber-500/20 text-amber-300 border-amber-500/30 text-[9px] mb-1">
                              <Star className="h-2.5 w-2.5 ml-0.5" />
                              أفضل سعر
                            </Badge>
                          )}
                          
                          {/* Merchant Info */}
                          <div className="flex items-center gap-2.5">
                            <Avatar className="h-9 w-9 border-2 border-white/10">
                              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
                              <AvatarFallback className="text-xs bg-primary/20 text-primary">
                                <User className="h-4 w-4" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-semibold text-xs truncate text-foreground">
                                {offer.merchant?.display_name || "تاجر"}
                              </p>
                              <div className="flex items-center gap-1 mt-0.5">
                                {offer.merchant?.is_verified && (
                                  <CheckCircle2 className="h-3 w-3 text-primary" />
                                )}
                                {offer.merchant?.badge_tier && offer.merchant.badge_tier !== "none" && (
                                  <Star className="h-3 w-3 text-amber-400" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Price & Duration */}
                          <div className="flex items-end justify-between pt-1">
                            <div>
                              <p className="text-lg font-bold text-primary">
                                {offer.price_iqd.toLocaleString()}
                              </p>
                              <p className="text-[9px] text-muted-foreground">دينار عراقي</p>
                            </div>
                            <div className="text-left bg-white/5 rounded-lg px-2 py-1">
                              <p className="font-bold text-sm">{offer.duration_days}</p>
                              <p className="text-[9px] text-muted-foreground">يوم</p>
                            </div>
                          </div>

                          {/* Notes preview */}
                          {offer.notes && (
                            <p className="text-[10px] text-muted-foreground line-clamp-2 whitespace-normal bg-white/5 rounded-lg p-2">
                              {offer.notes}
                            </p>
                          )}

                          {/* Actions for Owner */}
                          {isOwner && !isAccepted && (
                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[10px] h-7 border-blue-500/30 text-blue-300 hover:bg-blue-500/20"
                                onClick={() => handleChatWithMerchant(offer.trader_id)}
                              >
                                <Send className="h-3 w-3 ml-0.5" />
                                تواصل
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 text-[10px] h-7 bg-green-600 hover:bg-green-700"
                                onClick={() => handleAcceptOffer(offer)}
                              >
                                <CheckCircle2 className="h-3 w-3 ml-0.5" />
                                قبول
                              </Button>
                            </div>
                          )}

                          {request.accepted_offer_id === offer.id && (
                            <Badge className="w-full justify-center bg-green-600 text-white text-[10px] border-0 py-1">
                              <CheckCircle2 className="h-3 w-3 ml-1" />
                              العرض المقبول
                            </Badge>
                          )}
                        </div>
                      ))}
                    </div>
                    <ScrollBar orientation="horizontal" />
                  </ScrollArea>
                </div>
              )}

              {/* Timestamp */}
              <div className="flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground pt-2">
                <Clock className="h-3 w-3" />
                تم النشر: {new Date(request.created_at).toLocaleDateString("ar-IQ", { 
                  year: 'numeric', 
                  month: 'long', 
                  day: 'numeric' 
                })}
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Accept Offer Dialog */}
      {acceptOffer && request && (
        <AcceptOfferDialog
          open={showAcceptDialog}
          onOpenChange={setShowAcceptDialog}
          offer={acceptOffer}
          requestId={request.id}
        />
      )}

      {/* Edit Offer Dialog */}
      {editOffer && request && (
        <EditOfferDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          offerId={editOffer.id}
          requestId={request.id}
          currentPrice={editOffer.price_iqd}
          currentDuration={editOffer.duration_days}
          currentGrams={editOffer.grams}
          currentNotes={editOffer.notes}
          editCount={editOffer.edit_count ?? 0}
          onSuccess={() => {
            setShowEditDialog(false);
            refetchOffers();
          }}
        />
      )}
    </>
  );
}
