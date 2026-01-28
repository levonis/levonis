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
  DollarSign,
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

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت (FDM)", color: "bg-blue-600/30 text-blue-300 border-blue-500/30" },
  resin: { label: "رزن (SLA/DLP)", color: "bg-purple-600/30 text-purple-300 border-purple-500/30" },
  both: { label: "كلاهما", color: "bg-emerald-600/30 text-emerald-300 border-emerald-500/30" },
  any: { label: "لا يهم", color: "bg-slate-600/30 text-slate-300 border-slate-500/30" },
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
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch merchant profiles separately
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

  // Check if current merchant already has an offer
  const myOffer = offers.find((o) => o.trader_id === merchantId);

  if (!request) return null;

  const images = request.images?.length ? request.images : request.image_url ? [request.image_url] : [];
  const hasImages = images.length > 0;
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;

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

  const material = request.material_type ? MATERIAL_LABELS[request.material_type] : null;

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          hideClose
          className="!p-0 !gap-0 sm:max-w-xl overflow-hidden"
        >
          {/* Header with Image Gallery */}
          <div className="relative">
            {hasImages ? (
              <div className="relative aspect-[16/10] bg-black/20">
                <img
                  src={images[currentImageIndex]}
                  alt={request.title}
                  className="w-full h-full object-contain"
                />
                
                {images.length > 1 && (
                  <>
                    <button
                      onClick={prevImage}
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </button>
                    <button
                      onClick={nextImage}
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors"
                    >
                      <ChevronRight className="h-5 w-5" />
                    </button>
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5">
                      {images.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentImageIndex(i)}
                          className={`h-1.5 rounded-full transition-all ${
                            i === currentImageIndex ? "w-6 bg-white" : "w-1.5 bg-white/50"
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}

                {/* Video indicator */}
                {request.video_url && (
                  <a
                    href={request.video_url}
                    target="_blank"
                    rel="noreferrer"
                    className="absolute bottom-2 right-2 flex items-center gap-1 px-2.5 py-1 rounded-lg bg-red-500 text-white text-xs font-medium"
                  >
                    <Play className="h-3 w-3" />
                    فيديو
                  </a>
                )}
              </div>
            ) : (
              <div className="aspect-[16/10] bg-muted/30 flex items-center justify-center">
                <Package className="h-14 w-14 text-muted-foreground/20" />
              </div>
            )}

            {/* Close button - single button */}
            <button
              onClick={() => onOpenChange(false)}
              className="absolute top-2 left-2 h-8 w-8 rounded-full bg-black/60 text-white flex items-center justify-center hover:bg-black/80 transition-colors z-10"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Status Badge */}
            {isAccepted && (
              <Badge className="absolute top-2 right-2 bg-green-500 text-white border-0">
                تم القبول
              </Badge>
            )}
          </div>

          {/* Scrollable Content */}
          <div className="max-h-[50vh] overflow-y-auto overscroll-contain">
            <div className="p-4 space-y-4">
              {/* Title & Badges */}
              <div>
                <h2 className="text-base font-bold text-foreground mb-2">{request.title}</h2>
                <div className="flex flex-wrap gap-1.5">
                  {material && (
                    <Badge className={`text-[10px] border ${material.color}`}>
                      <Layers className="h-3 w-3 ml-1" />
                      {material.label}
                    </Badge>
                  )}
                  <Badge className="text-[10px] bg-primary/20 text-primary border border-primary/30">
                    <Ruler className="h-3 w-3 ml-1" />
                    {request.size}
                  </Badge>
                  <Badge className="text-[10px] bg-amber-600/20 text-amber-300 border border-amber-500/30">
                    <Palette className="h-3 w-3 ml-1" />
                    {request.colors}
                  </Badge>
                  {request.quantity && (
                    <Badge className="text-[10px] bg-cyan-600/20 text-cyan-300 border border-cyan-500/30">
                      <Hash className="h-3 w-3 ml-1" />
                      {request.quantity} قطعة
                    </Badge>
                  )}
                  {request.customer_governorate && (
                    <Badge className="text-[10px] bg-rose-600/20 text-rose-300 border border-rose-500/30">
                      <MapPin className="h-3 w-3 ml-1" />
                      {request.customer_governorate}
                    </Badge>
                  )}
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    <Clock className="h-3 w-3 ml-1" />
                    {new Date(request.created_at).toLocaleDateString("ar-IQ")}
                  </Badge>
                </div>
              </div>

              {/* Description */}
              <div className="text-sm text-foreground/80 leading-relaxed whitespace-pre-wrap bg-muted/20 rounded-lg p-3 border border-border/50">
                {request.description}
              </div>

              {/* Notes */}
              {request.notes && (
                <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3">
                  <p className="text-[10px] text-amber-400 font-medium mb-1">ملاحظات العميل</p>
                  <p className="text-xs text-foreground/90">{request.notes}</p>
                </div>
              )}

              {/* Reference Links */}
              {request.reference_links && request.reference_links.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-medium text-muted-foreground">روابط مرجعية</p>
                  <div className="flex flex-wrap gap-2">
                    {request.reference_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded-md"
                      >
                        <ExternalLink className="h-3 w-3" />
                        رابط {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* Merchant Action */}
              {isMerchant && !isOwner && !isAccepted && onAddOffer && (
                <div className="pt-2">
                  {myOffer ? (
                    <div className="rounded-lg bg-primary/10 border border-primary/30 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <p className="text-xs text-primary font-medium">عرضك الحالي</p>
                        {(myOffer.edit_count ?? 0) < 1 && (
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 px-2 text-[10px] gap-1 text-primary hover:bg-primary/20"
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
                      <div className="flex items-center gap-4">
                        <div>
                          <p className="font-bold text-lg text-primary">{myOffer.price_iqd.toLocaleString()} <span className="text-xs">د.ع</span></p>
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {myOffer.duration_days} يوم
                        </div>
                      </div>
                      {(myOffer.edit_count ?? 0) >= 1 && (
                        <p className="text-[10px] text-amber-400">تم تعديل هذا العرض (الحد الأقصى مرة واحدة)</p>
                      )}
                    </div>
                  ) : (
                    <Button
                      className="w-full gap-2 bg-gradient-to-b from-primary to-accent h-9"
                      onClick={onAddOffer}
                    >
                      <Plus className="h-4 w-4" />
                      تقديم عرض سعر
                    </Button>
                  )}
                </div>
              )}

              {/* Offers Section - Horizontal Strip */}
              {offers.length > 0 && (
                <div className="pt-3 border-t border-border/50 space-y-2">
                  <div className="flex items-center justify-between">
                    <h3 className="font-bold text-sm text-foreground">عروض الأسعار</h3>
                    <Badge variant="secondary" className="text-[10px]">{offers.length} عرض</Badge>
                  </div>
                  
                  <ScrollArea className="w-full">
                    <div className="flex gap-2 pb-2">
                      {offers.map((offer) => (
                        <div
                          key={offer.id}
                          className={`shrink-0 w-48 rounded-xl border p-2.5 space-y-2 ${
                            request.accepted_offer_id === offer.id
                              ? "border-green-500/50 bg-green-500/10"
                              : "border-border/50 bg-muted/20"
                          }`}
                        >
                          {/* Merchant Info */}
                          <div className="flex items-center gap-2">
                            <Avatar className="h-7 w-7 border border-border/50">
                              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
                              <AvatarFallback className="text-[10px] bg-primary/20">
                                <User className="h-3 w-3" />
                              </AvatarFallback>
                            </Avatar>
                            <div className="min-w-0 flex-1">
                              <p className="font-medium text-[11px] truncate text-foreground">
                                {offer.merchant?.display_name || "تاجر"}
                              </p>
                              <div className="flex items-center gap-1">
                                {offer.merchant?.is_verified && (
                                  <CheckCircle2 className="h-2.5 w-2.5 text-primary" />
                                )}
                                {offer.merchant?.badge_tier && offer.merchant.badge_tier !== "none" && (
                                  <Star className="h-2.5 w-2.5 text-amber-400" />
                                )}
                              </div>
                            </div>
                          </div>

                          {/* Price & Duration */}
                          <div className="flex items-center justify-between">
                            <div>
                              <p className="text-sm font-bold text-primary">
                                {offer.price_iqd.toLocaleString()}
                              </p>
                              <p className="text-[9px] text-muted-foreground">دينار</p>
                            </div>
                            <div className="text-left">
                              <p className="font-bold text-xs">{offer.duration_days}</p>
                              <p className="text-[9px] text-muted-foreground">يوم</p>
                            </div>
                          </div>

                          {/* Notes preview */}
                          {offer.notes && (
                            <p className="text-[9px] text-muted-foreground line-clamp-2 whitespace-normal">
                              {offer.notes}
                            </p>
                          )}

                          {/* Actions */}
                          {isOwner && !isAccepted && (
                            <div className="flex gap-1.5 pt-1">
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 text-[9px] h-6 px-1"
                                onClick={() => handleChatWithMerchant(offer.trader_id)}
                              >
                                <MessageSquare className="h-2.5 w-2.5 ml-0.5" />
                                محادثة
                              </Button>
                              <Button
                                size="sm"
                                className="flex-1 text-[9px] h-6 px-1 bg-green-600 hover:bg-green-700"
                                onClick={() => handleAcceptOffer(offer)}
                              >
                                <CheckCircle2 className="h-2.5 w-2.5 ml-0.5" />
                                قبول
                              </Button>
                            </div>
                          )}

                          {request.accepted_offer_id === offer.id && (
                            <Badge className="w-full justify-center bg-green-600 text-white text-[9px] border-0">
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
