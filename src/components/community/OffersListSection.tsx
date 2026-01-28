import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Store,
  Star,
  Clock,
  Send,
  CheckCircle,
  Edit3,
  ExternalLink,
  ShieldCheck,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Filter,
  Lock,
  Tag,
} from "lucide-react";

import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import AcceptOfferDialog from "./AcceptOfferDialog";
import EditOfferDialog from "./EditOfferDialog";

interface MerchantOffer {
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
    id?: string;
    display_name: string | null;
    store_image_url: string | null;
    badge_tier?: string | null;
    is_verified?: boolean;
  } | null;
  rating?: {
    average_rating: number;
    total_ratings: number;
  } | null;
}

interface OffersListSectionProps {
  offers: MerchantOffer[];
  requestId: string;
  customerId: string;
  acceptedOfferId: string | null;
  currentUserId?: string;
  merchantId?: string;
  onRefetch?: () => void;
}

const BADGE_COLORS: Record<string, string> = {
  bronze: "bg-amber-700/80",
  silver: "bg-slate-400/80",
  gold: "bg-yellow-500/80",
  platinum: "bg-violet-500/80",
  diamond: "bg-cyan-400/80",
  emerald: "bg-emerald-500/80",
};

const ITEMS_PER_PAGE = 10;

type SortOption = "price_asc" | "price_desc" | "duration_asc" | "rating_desc";

export default function OffersListSection({
  offers,
  requestId,
  customerId,
  acceptedOfferId,
  currentUserId,
  merchantId,
  onRefetch,
}: OffersListSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("price_asc");
  const [selectedOffer, setSelectedOffer] = useState<MerchantOffer | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);

  // Separate my offer from others
  const myOffer = offers.find((o) => o.trader_id === merchantId);
  const otherOffers = offers.filter((o) => o.trader_id !== merchantId);

  // Sort other offers
  const sortedOffers = useMemo(() => {
    const sorted = [...otherOffers];
    switch (sortBy) {
      case "price_asc":
        sorted.sort((a, b) => a.price_iqd - b.price_iqd);
        break;
      case "price_desc":
        sorted.sort((a, b) => b.price_iqd - a.price_iqd);
        break;
      case "duration_asc":
        sorted.sort((a, b) => a.duration_days - b.duration_days);
        break;
      case "rating_desc":
        sorted.sort((a, b) => {
          const ratingA = a.rating?.average_rating || 0;
          const ratingB = b.rating?.average_rating || 0;
          return ratingB - ratingA;
        });
        break;
    }
    return sorted;
  }, [otherOffers, sortBy]);

  // Pagination
  const totalPages = Math.ceil(sortedOffers.length / ITEMS_PER_PAGE);
  const startIndex = (currentPage - 1) * ITEMS_PER_PAGE;
  const paginatedOffers = sortedOffers.slice(startIndex, startIndex + ITEMS_PER_PAGE);

  const isCustomer = user?.id === customerId;
  const isAccepted = !!acceptedOfferId;

  // Find lowest price for "best" badge
  const lowestPrice = offers.length > 0 ? Math.min(...offers.map((o) => o.price_iqd)) : null;

  const handleMessage = (offer: MerchantOffer) => {
    const merchantAppId = offer.merchant?.id;
    if (!merchantAppId) {
      toast({ title: "لا يمكن بدء المحادثة", variant: "destructive" });
      return;
    }
    navigate(`/community/messages?merchant_id=${merchantAppId}&request_id=${requestId}`);
  };

  const handleVisitStore = (offer: MerchantOffer) => {
    const storeId = offer.merchant?.id;
    if (storeId) {
      navigate(`/store/${storeId}`);
    } else {
      toast({ title: "لا يمكن العثور على المتجر", variant: "destructive" });
    }
  };

  const handleAccept = (offer: MerchantOffer) => {
    setSelectedOffer(offer);
    setShowAcceptDialog(true);
  };

  const handleEdit = (offer: MerchantOffer) => {
    setSelectedOffer(offer);
    setShowEditDialog(true);
  };

  const sortLabels: Record<SortOption, string> = {
    price_asc: "السعر: الأقل أولاً",
    price_desc: "السعر: الأعلى أولاً",
    duration_asc: "مدة التنفيذ: الأسرع",
    rating_desc: "التقييم: الأعلى",
  };

  const renderOfferCard = (offer: MerchantOffer, isMyOffer = false) => {
    const isBestPrice = offer.price_iqd === lowestPrice && !acceptedOfferId;
    const isThisAccepted = acceptedOfferId === offer.id;
    const canEdit = offer.trader_id === merchantId && (offer.edit_count ?? 0) < 1 && !isAccepted;
    const hasEdited = (offer.edit_count ?? 0) >= 1;

    return (
      <div
        key={offer.id}
        className={`group relative rounded-xl border transition-all ${
          isThisAccepted
            ? "bg-gradient-to-r from-green-500/10 to-green-500/5 border-green-500/40"
            : isMyOffer
            ? "bg-gradient-to-r from-primary/10 to-primary/5 border-primary/40"
            : isBestPrice
            ? "bg-gradient-to-r from-amber-500/10 to-amber-500/5 border-amber-500/40"
            : "bg-card/50 border-border/50 hover:border-primary/30"
        }`}
      >
        {/* My Offer Label */}
        {isMyOffer && (
          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-full bg-primary text-[10px] font-bold text-white">
            عرضك الخاص
          </div>
        )}

        <div className="p-3 flex items-center gap-3">
          {/* Avatar & Merchant Info */}
          <div
            className="flex items-center gap-2 min-w-0 flex-1 cursor-pointer"
            onClick={() => handleVisitStore(offer)}
          >
            <Avatar className="h-10 w-10 shrink-0 border-2 border-primary/20">
              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
              <AvatarFallback className="bg-primary/10 text-primary">
                <Store className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>

            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="font-semibold text-sm truncate max-w-[120px] hover:text-primary transition-colors">
                  {offer.merchant?.display_name || "تاجر"}
                </span>
                {offer.merchant?.is_verified && (
                  <ShieldCheck className="h-3.5 w-3.5 text-primary shrink-0" />
                )}
                {offer.merchant?.badge_tier && BADGE_COLORS[offer.merchant.badge_tier] && (
                  <Badge
                    className={`text-[9px] px-1.5 py-0 h-4 ${BADGE_COLORS[offer.merchant.badge_tier]} text-white border-0`}
                  >
                    {offer.merchant.badge_tier}
                  </Badge>
                )}
              </div>

              {/* Rating */}
              {offer.rating && offer.rating.total_ratings > 0 && (
                <div className="flex items-center gap-1 text-xs text-muted-foreground">
                  <Star className="h-3 w-3 fill-yellow-500 text-yellow-500" />
                  <span>{offer.rating.average_rating.toFixed(1)}</span>
                  <span className="opacity-60">({offer.rating.total_ratings})</span>
                </div>
              )}
            </div>
          </div>

          {/* Duration */}
          <div className="shrink-0 flex flex-col items-center gap-0.5 px-3 py-1.5 rounded-lg bg-white/5 border border-white/10">
            <Clock className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-xs font-medium">{offer.duration_days} يوم</span>
          </div>

          {/* Price */}
          <div className="shrink-0 flex flex-col items-center gap-0.5 px-4 py-2 rounded-lg bg-primary/10 border border-primary/30">
            <span className="text-lg font-bold text-primary">
              {offer.price_iqd.toLocaleString("ar-IQ")}
            </span>
            <span className="text-[10px] text-primary/70">د.ع</span>
          </div>

          {/* Actions */}
          <div className="shrink-0 flex flex-col gap-1">
            {/* Customer Actions */}
            {isCustomer && !isAccepted && (
              <Button
                size="sm"
                className="h-8 px-3 text-xs font-bold bg-green-600 hover:bg-green-700 text-white"
                onClick={() => handleAccept(offer)}
              >
                قبول العرض
              </Button>
            )}

            {/* Merchant Edit Actions */}
            {isMyOffer && (
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-8 px-3 text-xs gap-1.5 border-amber-500/30 text-amber-400 hover:bg-amber-500/10"
                  onClick={() => handleEdit(offer)}
                >
                  <Edit3 className="h-3 w-3" />
                  تعديل العرض
                </Button>
              ) : hasEdited ? (
                <div className="flex items-center gap-1 px-2 py-1 rounded bg-muted/50 text-[10px] text-muted-foreground">
                  <Lock className="h-3 w-3" />
                  تم التعديل
                </div>
              ) : null
            )}

            {/* Quick Actions */}
            <div className="flex items-center gap-1">
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-primary/70 hover:text-primary hover:bg-primary/10"
                onClick={() => handleMessage(offer)}
                title="مراسلة"
              >
                <Send className="h-3.5 w-3.5" />
              </Button>
              <Button
                size="icon"
                variant="ghost"
                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-white/5"
                onClick={() => handleVisitStore(offer)}
                title="زيارة المتجر"
              >
                <ExternalLink className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Status Badges */}
          <div className="absolute top-2 left-2 flex items-center gap-1">
            {isBestPrice && !isThisAccepted && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-400 border-0">
                الأفضل سعراً
              </Badge>
            )}
            {isThisAccepted && (
              <Badge className="text-[9px] px-1.5 py-0 h-4 bg-green-500 text-white border-0 gap-0.5">
                <CheckCircle className="h-2.5 w-2.5" />
                مقبول
              </Badge>
            )}
          </div>
        </div>

        {/* Notes Preview */}
        {offer.notes && (
          <div className="px-3 pb-3 pt-0">
            <p className="text-[11px] text-muted-foreground bg-white/5 rounded-lg p-2 line-clamp-2">
              {offer.notes}
            </p>
          </div>
        )}
      </div>
    );
  };

  if (offers.length === 0) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        لا توجد عروض أسعار حتى الآن
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* Header with Sort/Filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-sm text-foreground flex items-center gap-2">
          <Tag className="h-4 w-4 text-primary" />
          عروض الأسعار
          <span className="text-xs font-normal text-muted-foreground">({offers.length})</span>
        </h3>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm" className="h-8 text-xs gap-1.5">
              <Filter className="h-3 w-3" />
              {sortLabels[sortBy]}
              <ArrowUpDown className="h-3 w-3" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
              <DropdownMenuItem
                key={key}
                onClick={() => {
                  setSortBy(key);
                  setCurrentPage(1);
                }}
                className={sortBy === key ? "bg-primary/10" : ""}
              >
                {label}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* My Offer - Pinned */}
      {myOffer && (
        <div className="space-y-1">
          {renderOfferCard(myOffer, true)}
        </div>
      )}

      {/* Other Offers */}
      <div className="space-y-2">
        {paginatedOffers.map((offer) => renderOfferCard(offer))}
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2 pt-2">
          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronRight className="h-4 w-4" />
          </Button>

          <div className="flex items-center gap-1">
            {Array.from({ length: totalPages }, (_, i) => i + 1).map((page) => (
              <Button
                key={page}
                variant={page === currentPage ? "default" : "ghost"}
                size="icon"
                className={`h-8 w-8 text-xs ${page === currentPage ? "bg-primary" : ""}`}
                onClick={() => setCurrentPage(page)}
              >
                {page}
              </Button>
            ))}
          </div>

          <Button
            variant="outline"
            size="icon"
            className="h-8 w-8"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronLeft className="h-4 w-4" />
          </Button>
        </div>
      )}

      {/* Results info */}
      <div className="text-center text-[10px] text-muted-foreground">
        عرض {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, sortedOffers.length)} من {sortedOffers.length} عرض
      </div>

      {/* Accept Dialog */}
      {selectedOffer && (
        <AcceptOfferDialog
          open={showAcceptDialog}
          onOpenChange={setShowAcceptDialog}
          offer={{
            ...selectedOffer,
            merchant: selectedOffer.merchant
              ? {
                  display_name: selectedOffer.merchant.display_name,
                  store_image_url: selectedOffer.merchant.store_image_url,
                }
              : undefined,
          }}
          requestId={requestId}
        />
      )}

      {/* Edit Dialog */}
      {selectedOffer && showEditDialog && (
        <EditOfferDialog
          open={showEditDialog}
          onOpenChange={setShowEditDialog}
          offerId={selectedOffer.id}
          requestId={requestId}
          currentPrice={selectedOffer.price_iqd}
          currentDuration={selectedOffer.duration_days}
          currentGrams={selectedOffer.grams}
          currentNotes={selectedOffer.notes}
          editCount={selectedOffer.edit_count ?? 0}
          onSuccess={() => {
            setShowEditDialog(false);
            onRefetch?.();
          }}
        />
      )}
    </div>
  );
}
