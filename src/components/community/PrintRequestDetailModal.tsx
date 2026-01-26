import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Package,
  Palette,
  Ruler,
  Clock,
  MessageSquare,
  DollarSign,
  Layers,
  User,
  Calendar,
  Link2,
  Video,
  ChevronLeft,
  ChevronRight,
  Star,
  Store,
  Send,
  X,
  CheckCircle,
  ExternalLink,
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import MerchantOfferStrip from "./MerchantOfferStrip";
import AddOfferDialog from "./AddOfferDialog";

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
  accepted_at: string | null;
  escrow_amount: number | null;
}

interface PrintRequestDetailModalProps {
  request: PrintRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMerchant?: boolean;
  merchantId?: string;
}

const MATERIAL_LABELS: Record<string, string> = {
  filament: "فلمنت (FDM)",
  resin: "رزن (SLA/DLP)",
  both: "كلاهما",
  any: "لا يهم",
};

export default function PrintRequestDetailModal({
  request,
  open,
  onOpenChange,
  isMerchant = false,
  merchantId,
}: PrintRequestDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAddOffer, setShowAddOffer] = useState(false);

  // Fetch customer profile
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile", request?.user_id],
    enabled: !!request?.user_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("community_customer_profiles")
        .select("display_name, avatar_url")
        .eq("user_id", request!.user_id)
        .maybeSingle();
      return data;
    },
  });

  // Fetch offers for this request
  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["request-offers", request?.id],
    enabled: !!request?.id,
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
          offer_sent_at
        `)
        .eq("request_id", request!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      // Fetch merchant profiles
      const traderIds = data?.map((o) => o.trader_id) || [];
      if (traderIds.length === 0) return [];

      const { data: merchants } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, badge_tier")
        .in("id", traderIds);

      // Fetch merchant ratings
      const { data: ratings } = await supabase
        .from("merchant_rating_stats")
        .select("merchant_id, average_rating, total_ratings")
        .in("merchant_id", traderIds);

      const merchantsMap = new Map(merchants?.map((m) => [m.id, m]) || []);
      const ratingsMap = new Map(ratings?.map((r) => [r.merchant_id, r]) || []);

      return data.map((offer) => ({
        ...offer,
        merchant: merchantsMap.get(offer.trader_id),
        rating: ratingsMap.get(offer.trader_id),
      }));
    },
  });

  // Check if current merchant has an offer
  const myOffer = offers.find((o) => o.trader_id === merchantId);

  if (!request) return null;

  const images = request.images?.length ? request.images : request.image_url ? [request.image_url] : [];
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;

  const nextImage = () => {
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = () => {
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  // Sort offers: my offer first, then accepted, then others
  const sortedOffers = [...offers].sort((a, b) => {
    if (a.trader_id === merchantId) return -1;
    if (b.trader_id === merchantId) return 1;
    if (a.id === request.accepted_offer_id) return -1;
    if (b.id === request.accepted_offer_id) return 1;
    return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
  });

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-2xl p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Header */}
          <DialogHeader className="p-4 pb-0 shrink-0">
            <DialogTitle className="flex items-center gap-2 text-lg">
              <Package className="h-5 w-5 text-primary" />
              {request.title}
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-4 space-y-4">
              {/* Image Gallery */}
              {images.length > 0 && (
                <div className="relative rounded-xl overflow-hidden bg-muted aspect-video">
                  <img
                    src={images[currentImageIndex]}
                    alt={request.title}
                    className="w-full h-full object-contain"
                  />
                  
                  {images.length > 1 && (
                    <>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                        onClick={prevImage}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-full"
                        onClick={nextImage}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            className={`h-1.5 rounded-full transition-all ${
                              i === currentImageIndex ? "w-4 bg-primary" : "w-1.5 bg-white/60"
                            }`}
                            onClick={() => setCurrentImageIndex(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Video Badge */}
                  {request.video_url && (
                    <a
                      href={request.video_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="absolute top-2 left-2"
                    >
                      <Badge className="bg-red-500 hover:bg-red-600 gap-1">
                        <Video className="h-3 w-3" />
                        فيديو
                      </Badge>
                    </a>
                  )}

                  {/* Status Badge */}
                  {isAccepted && (
                    <Badge className="absolute top-2 right-2 bg-green-500 text-white gap-1">
                      <CheckCircle className="h-3 w-3" />
                      تم القبول
                    </Badge>
                  )}
                </div>
              )}

              {/* Customer Info */}
              <div className="flex items-center gap-3 p-3 rounded-xl bg-muted/50 border border-border">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={customerProfile?.avatar_url || undefined} />
                  <AvatarFallback>
                    <User className="h-5 w-5" />
                  </AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-sm truncate">
                    {customerProfile?.display_name || "زبون"}
                  </p>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(request.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Ruler className="h-4 w-4" />
                    <span className="text-xs">الحجم</span>
                  </div>
                  <p className="font-semibold text-sm">{request.size}</p>
                </div>

                <div className="p-3 rounded-xl bg-muted/30 border border-border">
                  <div className="flex items-center gap-2 text-muted-foreground mb-1">
                    <Palette className="h-4 w-4" />
                    <span className="text-xs">الألوان</span>
                  </div>
                  <p className="font-semibold text-sm">{request.colors}</p>
                </div>

                {request.material_type && (
                  <div className="p-3 rounded-xl bg-muted/30 border border-border col-span-2">
                    <div className="flex items-center gap-2 text-muted-foreground mb-1">
                      <Layers className="h-4 w-4" />
                      <span className="text-xs">نوع المادة</span>
                    </div>
                    <p className="font-semibold text-sm">
                      {MATERIAL_LABELS[request.material_type] || request.material_type}
                    </p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-2">
                <h4 className="font-semibold text-sm">الوصف</h4>
                <p className="text-sm text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {request.description}
                </p>
              </div>

              {/* Notes */}
              {request.notes && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm">ملاحظات إضافية</h4>
                  <p className="text-sm text-muted-foreground whitespace-pre-wrap">
                    {request.notes}
                  </p>
                </div>
              )}

              {/* Reference Links */}
              {request.reference_links && request.reference_links.length > 0 && (
                <div className="space-y-2">
                  <h4 className="font-semibold text-sm flex items-center gap-2">
                    <Link2 className="h-4 w-4" />
                    روابط مرجعية
                  </h4>
                  <div className="flex flex-wrap gap-2">
                    {request.reference_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-primary hover:underline bg-primary/10 px-2 py-1 rounded-md"
                      >
                        <ExternalLink className="h-3 w-3" />
                        رابط {i + 1}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              <Separator />

              {/* Offers Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-sm flex items-center gap-2">
                    <DollarSign className="h-4 w-4 text-primary" />
                    عروض التجار ({offers.length})
                  </h4>

                  {isMerchant && !isOwner && !isAccepted && !myOffer && (
                    <Button
                      size="sm"
                      className="h-8 text-xs bg-gradient-to-b from-primary to-accent"
                      onClick={() => setShowAddOffer(true)}
                    >
                      <DollarSign className="h-3 w-3 ml-1" />
                      إضافة تسعير
                    </Button>
                  )}
                </div>

                {sortedOffers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-sm">
                    لا توجد عروض بعد
                  </div>
                ) : (
                  <div className="space-y-2">
                    {/* My Offer First (highlighted) */}
                    {myOffer && (
                      <div className="border-2 border-primary rounded-xl overflow-hidden">
                        <div className="bg-primary/10 px-3 py-1.5 text-xs font-semibold text-primary">
                          تسعيرتك
                        </div>
                        <MerchantOfferStrip
                          offer={myOffer}
                          isOwner={isOwner}
                          isAccepted={myOffer.id === request.accepted_offer_id}
                          requestId={request.id}
                          customerId={request.user_id}
                        />
                      </div>
                    )}

                    {/* Horizontal Scroll for Other Offers */}
                    {sortedOffers.filter((o) => o.trader_id !== merchantId).length > 0 && (
                      <div className="overflow-x-auto -mx-4 px-4">
                        <div className="flex gap-3 pb-2" style={{ minWidth: "max-content" }}>
                          {sortedOffers
                            .filter((o) => o.trader_id !== merchantId)
                            .map((offer) => (
                              <div key={offer.id} className="w-72 shrink-0">
                                <MerchantOfferStrip
                                  offer={offer}
                                  isOwner={isOwner}
                                  isAccepted={offer.id === request.accepted_offer_id}
                                  requestId={request.id}
                                  customerId={request.user_id}
                                />
                              </div>
                            ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </ScrollArea>
        </DialogContent>
      </Dialog>

      {/* Add Offer Dialog */}
      <AddOfferDialog
        open={showAddOffer}
        onOpenChange={setShowAddOffer}
        requestId={request.id}
        requestTitle={request.title}
        merchantId={merchantId || ""}
        onSuccess={() => {
          refetchOffers();
          setShowAddOffer(false);
        }}
      />
    </>
  );
}
