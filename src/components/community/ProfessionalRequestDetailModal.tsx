import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import {
  Package, Palette, Ruler, Clock, DollarSign, Layers, Eye,
  User, Calendar, Link2, Video, ChevronLeft, ChevronRight,
  Star, CheckCircle, ExternalLink, MapPin, Hash
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
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
  quantity?: number;
  customer_governorate?: string;
}

interface ProfessionalRequestDetailModalProps {
  request: PrintRequest | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  isMerchant?: boolean;
  merchantId?: string;
}

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت (FDM)", color: "bg-blue-500/20 text-blue-600" },
  resin: { label: "رزن (SLA/DLP)", color: "bg-purple-500/20 text-purple-600" },
  both: { label: "كلاهما", color: "bg-emerald-500/20 text-emerald-600" },
  any: { label: "لا يهم", color: "bg-muted text-muted-foreground" },
};

export default function ProfessionalRequestDetailModal({
  request,
  open,
  onOpenChange,
  isMerchant = false,
  merchantId,
}: ProfessionalRequestDetailModalProps) {
  const { user } = useAuth();
  const { toast } = useToast();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showAddOffer, setShowAddOffer] = useState(false);

  // Fetch customer profile - fallback to profiles table
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile", request?.user_id],
    enabled: !!request?.user_id,
    queryFn: async () => {
      // Try community profile first
      const { data: communityProfile } = await supabase
        .from("community_customer_profiles_public")
        .select("display_name, avatar_url")
        .eq("user_id", request!.user_id)
        .maybeSingle();
      if (communityProfile?.display_name) return communityProfile;
      // Fallback to profiles_public view
      const { data: profile } = await supabase
        .from("profiles_public")
        .select("full_name, avatar_url")
        .eq("id", request!.user_id)
        .maybeSingle();
      if (profile) return { display_name: profile.full_name, avatar_url: profile.avatar_url };
      return null;
    },
  });

  // Fetch offers for this request
  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["request-offers", request?.id],
    enabled: !!request?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, trader_id, price_iqd, duration_days, grams, notes, status, created_at, offer_sent_at")
        .eq("request_id", request!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const traderIds = data?.map((o) => o.trader_id) || [];
      if (traderIds.length === 0) return [];

      const { data: merchants } = await supabase
        .from("merchant_public_profiles")
        .select("id, display_name, store_image_url, badge_tier")
        .in("id", traderIds);

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

  const myOffer = offers.find((o) => o.trader_id === merchantId);

  if (!request) return null;

  const images = request.images?.length ? request.images : request.image_url ? [request.image_url] : [];
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_LABELS[request.material_type] : null;

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

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
        <DialogContent className="sm:max-w-lg p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
          {/* Compact Header */}
          <DialogHeader className="p-3 pb-2 shrink-0 border-b border-border/50">
            <DialogTitle className="text-sm font-bold flex items-center gap-2 truncate">
              <Package className="h-4 w-4 text-primary shrink-0" />
              <span className="truncate">{request.title}</span>
            </DialogTitle>
          </DialogHeader>

          <ScrollArea className="flex-1 min-h-0">
            <div className="p-3 space-y-3">
              {/* Image Gallery */}
              {images.length > 0 && (
                <div className="relative rounded-lg overflow-hidden bg-muted aspect-video">
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
                        className="absolute right-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                        onClick={prevImage}
                      >
                        <ChevronRight className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="secondary"
                        className="absolute left-1.5 top-1/2 -translate-y-1/2 h-7 w-7 rounded-full"
                        onClick={nextImage}
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </Button>
                      
                      <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                        {images.map((_, i) => (
                          <button
                            key={i}
                            className={`h-1 rounded-full transition-all ${
                              i === currentImageIndex ? "w-3 bg-primary" : "w-1 bg-white/60"
                            }`}
                            onClick={() => setCurrentImageIndex(i)}
                          />
                        ))}
                      </div>
                    </>
                  )}

                  {/* Badges */}
                  <div className="absolute top-2 right-2 left-2 flex items-start justify-between">
                    {request.video_url && (
                      <a href={request.video_url} target="_blank" rel="noopener noreferrer">
                        <Badge className="bg-red-500 hover:bg-red-600 text-[10px] gap-1">
                          <Video className="h-3 w-3" />
                          فيديو
                        </Badge>
                      </a>
                    )}
                    {isAccepted && (
                      <Badge className="bg-green-500 text-white text-[10px] gap-1 mr-auto">
                        <CheckCircle className="h-3 w-3" />
                        تم القبول
                      </Badge>
                    )}
                  </div>
                </div>
              )}

              {/* Customer & Material Info */}
              <div className="flex items-center gap-2.5 p-2.5 rounded-lg bg-muted/50 border border-border/50">
                <Avatar className="h-9 w-9">
                  <AvatarImage src={customerProfile?.avatar_url || undefined} />
                  <AvatarFallback><User className="h-4 w-4" /></AvatarFallback>
                </Avatar>
                <div className="flex-1 min-w-0">
                  <p className="font-medium text-xs truncate">{customerProfile?.display_name || "عميل"}</p>
                  <p className="text-[10px] text-muted-foreground flex items-center gap-1">
                    <Calendar className="h-3 w-3" />
                    {new Date(request.created_at).toLocaleDateString("ar-IQ")}
                  </p>
                </div>
                {material && (
                  <Badge className={`text-[10px] shrink-0 ${material.color}`}>{material.label}</Badge>
                )}
              </div>

              {/* Details Grid */}
              <div className="grid grid-cols-2 gap-2">
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Ruler className="h-3 w-3" />
                    <span className="text-[10px]">الحجم</span>
                  </div>
                  <p className="font-medium text-xs">{request.size}</p>
                </div>

                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Palette className="h-3 w-3" />
                    <span className="text-[10px]">الألوان</span>
                  </div>
                  <p className="font-medium text-xs">{request.colors}</p>
                </div>

                {request.quantity && request.quantity > 1 && (
                  <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                    <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                      <Hash className="h-3 w-3" />
                      <span className="text-[10px]">الكمية</span>
                    </div>
                    <p className="font-medium text-xs">{request.quantity}×</p>
                  </div>
                )}

                {request.customer_governorate && (
                  <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20">
                    <div className="flex items-center gap-1.5 text-primary mb-1">
                      <MapPin className="h-3 w-3" />
                      <span className="text-[10px]">الموقع</span>
                    </div>
                    <p className="font-medium text-xs text-primary">{request.customer_governorate}</p>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="space-y-1">
                <h4 className="font-medium text-xs">الوصف</h4>
                <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                  {request.description}
                </p>
              </div>

              {/* Notes */}
              {request.notes && (
                <div className="space-y-1">
                  <h4 className="font-medium text-xs">ملاحظات</h4>
                  <p className="text-[11px] text-muted-foreground">{request.notes}</p>
                </div>
              )}

              {/* Reference Links */}
              {request.reference_links && request.reference_links.length > 0 && (
                <div className="space-y-1.5">
                  <h4 className="font-medium text-xs flex items-center gap-1.5">
                    <Link2 className="h-3.5 w-3.5" />
                    روابط مرجعية
                  </h4>
                  <div className="flex flex-wrap gap-1.5">
                    {request.reference_links.map((link, i) => (
                      <a
                        key={i}
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-[10px] text-primary hover:underline bg-primary/10 px-2 py-1 rounded"
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
              <div className="space-y-2.5">
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-xs flex items-center gap-1.5">
                    <DollarSign className="h-3.5 w-3.5 text-primary" />
                    عروض التجار ({offers.length})
                  </h4>

                  {isMerchant && !isOwner && !isAccepted && !myOffer && (
                    <Button size="sm" className="h-7 text-[10px]" onClick={() => setShowAddOffer(true)}>
                      <DollarSign className="h-3 w-3 ml-1" />
                      تسعير
                    </Button>
                  )}
                </div>

                {sortedOffers.length === 0 ? (
                  <div className="text-center py-6 text-muted-foreground text-xs">لا توجد عروض بعد</div>
                ) : (
                  <div className="space-y-2">
                    {myOffer && (
                      <div className="border-2 border-primary rounded-lg overflow-hidden">
                        <div className="bg-primary/10 px-2.5 py-1 text-[10px] font-medium text-primary">تسعيرتك</div>
                        <MerchantOfferStrip
                          offer={myOffer}
                          isOwner={isOwner}
                          isAccepted={myOffer.id === request.accepted_offer_id}
                          requestId={request.id}
                          customerId={request.user_id}
                        />
                      </div>
                    )}

                    {sortedOffers.filter((o) => o.trader_id !== merchantId).length > 0 && (
                      <div className="overflow-x-auto -mx-3 px-3">
                        <div className="flex gap-2.5 pb-1" style={{ minWidth: "max-content" }}>
                          {sortedOffers
                            .filter((o) => o.trader_id !== merchantId)
                            .map((offer) => (
                              <div key={offer.id} className="w-64 shrink-0">
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
