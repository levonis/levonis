import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Palette, Ruler, Clock, Layers,
  Link2, Video, ChevronLeft, ChevronRight, MapPin, Hash,
  Pencil, Trash2, ExternalLink
} from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import AcceptOfferDialog from "./AcceptOfferDialog";
import OffersListSection from "./OffersListSection";
import CustomerRequestStrip from "./CustomerRequestStrip";

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

interface CustomerRequestDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  request: PrintRequest | null;
  onEdit?: (request: PrintRequest) => void;
}

const MATERIAL_LABELS: Record<string, { label: string; color: string }> = {
  filament: { label: "فلمنت (FDM)", color: "bg-blue-500/20 text-blue-600" },
  resin: { label: "رزن (SLA)", color: "bg-purple-500/20 text-purple-600" },
  both: { label: "كلاهما", color: "bg-emerald-500/20 text-emerald-600" },
  any: { label: "لا يهم", color: "bg-muted text-muted-foreground" },
};

export default function CustomerRequestDetailSheet({
  open,
  onOpenChange,
  request,
  onEdit,
}: CustomerRequestDetailSheetProps) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [acceptOfferDialog, setAcceptOfferDialog] = useState<any>(null);

  // Fetch customer profile with fallback
  const { data: customerProfile } = useQuery({
    queryKey: ["customer-profile-sheet", request?.user_id],
    enabled: !!request?.user_id && open,
    queryFn: async () => {
      const { data: communityProfile } = await supabase
        .from("community_customer_profiles_public")
        .select("display_name, avatar_url")
        .eq("user_id", request!.user_id)
        .maybeSingle();
      if (communityProfile?.display_name) return { full_name: communityProfile.display_name, avatar_url: communityProfile.avatar_url, username: null };
      const { data: profile } = await supabase
        .from("profiles_public")
        .select("full_name, avatar_url, username")
        .eq("id", request!.user_id)
        .maybeSingle();
      return profile || null;
    },
  });

  // Fetch edit history
  const { data: editHistory = [] } = useQuery({
    queryKey: ["request-edit-history", request?.id],
    enabled: !!request?.id && open,
    queryFn: async () => {
      const { data } = await supabase
        .from("request_edit_history")
        .select("id, field_name, old_value, new_value, created_at")
        .eq("request_id", request!.id)
        .order("created_at", { ascending: false });
      return data || [];
    },
  });

  // Fetch offers
  const { data: offers = [], refetch: refetchOffers } = useQuery({
    queryKey: ["request-offers-sheet", request?.id],
    enabled: !!request?.id && open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("print_offers")
        .select("id, trader_id, price_iqd, duration_days, grams, notes, status, created_at, edit_count")
        .eq("request_id", request!.id)
        .order("created_at", { ascending: true });

      if (error) throw error;

      const traderIds = data?.map((o) => o.trader_id) || [];
      if (traderIds.length === 0) return [];

      // Fetch merchant applications by user_id (trader_id)
      const [merchantsRes, ratingsRes] = await Promise.all([
        supabase
          .from("merchant_applications")
          .select("id, user_id, display_name, store_image_url, status")
          .in("user_id", traderIds)
          .eq("status", "approved"),
        supabase
          .from("merchant_rating_stats")
          .select("merchant_id, average_rating, total_ratings"),
      ]);

      const merchantByUserId = new Map(merchantsRes.data?.map((m) => [m.user_id, m]) || []);
      const ratingsMap = new Map(ratingsRes.data?.map((r) => [r.merchant_id, r]) || []);

      return data.map((offer) => {
        const merchant = merchantByUserId.get(offer.trader_id);
        return {
          ...offer,
          merchant: merchant ? {
            id: merchant.id,
            display_name: merchant.display_name,
            store_image_url: merchant.store_image_url,
            is_verified: true,
            badge_tier: null,
          } : null,
          rating: merchant ? ratingsMap.get(merchant.id) || null : null,
        };
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async () => {
      if (!request) return;
      const { error } = await supabase
        .from("community_print_requests")
        .delete()
        .eq("id", request.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["my-print-requests"] });
      qc.invalidateQueries({ queryKey: ["community-print-requests"] });
      toast({ title: "تم حذف الطلب" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حذف الطلب", description: err?.message, variant: "destructive" });
    },
  });

  if (!request) return null;

  const images = request.images?.length ? request.images : request.image_url ? [request.image_url] : [];
  const isOwner = user?.id === request.user_id;
  const isAccepted = !!request.accepted_offer_id;
  const material = request.material_type ? MATERIAL_LABELS[request.material_type] : null;
  const canEdit = ["pending_review", "approved"].includes(request.status);

  const nextImage = () => setCurrentImageIndex((prev) => (prev + 1) % images.length);
  const prevImage = () => setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);

  const handleStartChat = (merchantId: string) => {
    const params = new URLSearchParams();
    params.set("merchant_id", merchantId);
    params.set("request_id", request.id);
    navigate(`/community/messages?${params.toString()}`);
    onOpenChange(false);
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent side="left" className="w-full sm:max-w-md p-0 flex flex-col">
          <SheetHeader className="p-4 pb-3 border-b border-border/50 shrink-0">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center shrink-0">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1 min-w-0">
                <SheetTitle className="text-sm font-bold truncate">{request.title}</SheetTitle>
                <SheetDescription className="text-[11px]">
                  {new Date(request.created_at).toLocaleDateString("ar-IQ")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 min-h-0 overflow-y-auto space-y-4 p-4">
            {/* Customer Profile Strip */}
            <CustomerRequestStrip
              customerId={request.user_id}
              customerProfile={customerProfile}
              isOwner={isOwner}
            />

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

                {/* Video Badge */}
                {request.video_url && (
                  <a href={request.video_url} target="_blank" rel="noopener noreferrer" className="absolute top-2 right-2">
                    <Badge className="bg-red-500 hover:bg-red-600 text-[10px] gap-1">
                      <Video className="h-3 w-3" />
                      فيديو
                    </Badge>
                  </a>
                )}
              </div>
            )}

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

              {material && (
                <div className="p-2.5 rounded-lg bg-muted/30 border border-border/50">
                  <div className="flex items-center gap-1.5 text-muted-foreground mb-1">
                    <Layers className="h-3 w-3" />
                    <span className="text-[10px]">المادة</span>
                  </div>
                  <Badge className={`text-[10px] ${material.color}`}>{material.label}</Badge>
                </div>
              )}

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
                <div className="p-2.5 rounded-lg bg-primary/5 border border-primary/20 col-span-2">
                  <div className="flex items-center gap-1.5 text-primary mb-1">
                    <MapPin className="h-3 w-3" />
                    <span className="text-[10px]">الموقع</span>
                  </div>
                  <p className="font-medium text-xs text-primary">{request.customer_governorate}</p>
                </div>
              )}
            </div>

            {/* Description */}
            <div className="space-y-1.5">
              <h4 className="font-medium text-xs">الوصف</h4>
              <p className="text-[11px] text-muted-foreground whitespace-pre-wrap leading-relaxed">
                {request.description}
              </p>
            </div>

            {/* Notes */}
            {request.notes && (
              <div className="space-y-1.5">
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

            {/* Edit History */}
            {editHistory.length > 0 && (
              <div className="space-y-1.5">
                <h4 className="font-medium text-xs flex items-center gap-1.5">
                  <Clock className="h-3.5 w-3.5" />
                  سجل التعديلات ({editHistory.length})
                </h4>
                <div className="space-y-1">
                  {editHistory.map((edit: any) => {
                    const FIELD_LABELS: Record<string, string> = {
                      title: "العنوان", description: "الوصف", size: "الحجم",
                      colors: "الألوان", notes: "الملاحظات", material_type: "المادة",
                      quantity: "الكمية", images: "الصور", video_url: "الفيديو",
                    };
                    return (
                      <div key={edit.id} className="p-2 rounded-lg bg-muted/30 border border-border/50 text-[10px]">
                        <div className="flex items-center justify-between mb-1">
                          <span className="font-medium text-foreground">
                            {FIELD_LABELS[edit.field_name] || edit.field_name}
                          </span>
                          <span className="text-muted-foreground">
                            {new Date(edit.created_at).toLocaleDateString("ar-IQ")}
                          </span>
                        </div>
                        <div className="text-muted-foreground">
                          <span className="line-through">{edit.old_value || "—"}</span>
                          {" → "}
                          <span className="text-foreground">{edit.new_value || "—"}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            <Separator />

            {/* Offers Section with Pagination & Filtering */}
            <OffersListSection
              offers={offers}
              requestId={request.id}
              customerId={request.user_id}
              acceptedOfferId={request.accepted_offer_id}
              currentUserId={user?.id}
              onRefetch={refetchOffers}
            />
          </div>

          {/* Footer Actions */}
          {isOwner && canEdit && (
            <div className="p-4 pt-3 border-t border-border/50 shrink-0 flex gap-2">
              <Button
                variant="outline"
                className="flex-1 h-9 text-xs gap-1.5"
                onClick={() => request && onEdit?.(request)}
              >
                <Pencil className="h-3.5 w-3.5" />
                تعديل
              </Button>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="icon" className="h-9 w-9 shrink-0">
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>حذف الطلب؟</AlertDialogTitle>
                    <AlertDialogDescription>سيتم حذف الطلب نهائياً.</AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction onClick={() => deleteMutation.mutate()}>
                      حذف
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Accept Offer Dialog */}
      {acceptOfferDialog && (
        <AcceptOfferDialog
          open={!!acceptOfferDialog}
          onOpenChange={(isOpen) => {
            if (!isOpen) {
              refetchOffers();
              setAcceptOfferDialog(null);
              qc.invalidateQueries({ queryKey: ["community-print-requests"] });
            }
          }}
          offer={acceptOfferDialog}
          requestId={request.id}
        />
      )}
    </>
  );
}
