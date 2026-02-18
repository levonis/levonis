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
  Eye,
  Scale,
  Layers,
  Users,
  AlertCircle,
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
  offer_sent_at?: string | null;
  material_type?: string | null;
  material_subtypes?: string[] | null;
  merchant?: {
    id?: string;
    display_name: string | null;
    store_image_url: string | null;
    badge_tier?: string | null;
    is_verified?: boolean;
    followers_count?: number;
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
  onAddOffer?: () => void;
}

const BADGE_CONFIG: Record<string, { label: string; color: string }> = {
  bronze: { label: "برونز", color: "text-amber-600" },
  silver: { label: "فضي", color: "text-slate-400" },
  gold: { label: "ذهبي", color: "text-yellow-500" },
  platinum: { label: "بلاتين", color: "text-violet-400" },
  diamond: { label: "ماسي", color: "text-cyan-400" },
  emerald: { label: "زمردي", color: "text-emerald-400" },
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
  onAddOffer,
}: OffersListSectionProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();

  const [currentPage, setCurrentPage] = useState(1);
  const [sortBy, setSortBy] = useState<SortOption>("price_asc");
  const [selectedOffer, setSelectedOffer] = useState<MerchantOffer | null>(null);
  const [showAcceptDialog, setShowAcceptDialog] = useState(false);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showingNotes, setShowingNotes] = useState<string | null>(null);

  // Separate my offer from others - use user.id since trader_id is auth uid
  const myOffer = offers.find((o) => o.trader_id === user?.id);
  const otherOffers = offers.filter((o) => o.trader_id !== user?.id);

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
  const isMerchant = !!merchantId;
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

  const showNotesToast = (notes: string) => {
    setShowingNotes(notes);
    setTimeout(() => setShowingNotes(null), 4000);
  };

  const sortLabels: Record<SortOption, string> = {
    price_asc: "السعر ↑",
    price_desc: "السعر ↓",
    duration_asc: "الأسرع",
    rating_desc: "الأعلى تقييماً",
  };

  // Radically redesigned Offer Strip Card
  const OfferStrip = ({ offer, isMyOffer = false }: { offer: MerchantOffer; isMyOffer?: boolean }) => {
    const isBestPrice = offer.price_iqd === lowestPrice && !acceptedOfferId;
    const isThisAccepted = acceptedOfferId === offer.id;
    const canEdit = offer.trader_id === user?.id && (offer.edit_count ?? 0) < 1 && !isAccepted;
    const hasEdited = (offer.edit_count ?? 0) >= 1;

    const merchantName = offer.merchant?.display_name || "تاجر";
    const badgeTier = offer.merchant?.badge_tier;
    const badgeConfig = badgeTier ? BADGE_CONFIG[badgeTier] : null;
    const followersCount = offer.merchant?.followers_count || 0;

    return (
      <div
        className={`relative rounded-lg border transition-all duration-200 ${
          isThisAccepted
            ? "bg-emerald-500/10 border-emerald-500/50 ring-1 ring-emerald-500/30"
            : isMyOffer
            ? "bg-primary/8 border-primary/50 ring-1 ring-primary/20"
            : isBestPrice
            ? "bg-amber-500/5 border-amber-500/40"
            : "bg-card/80 border-border/60 hover:border-primary/40 hover:bg-card"
        }`}
      >
        {/* My Offer Pinned Label */}
        {isMyOffer && (
          <div className="absolute -top-2.5 right-3 px-2 py-0.5 rounded-md bg-primary text-[8px] font-bold text-primary-foreground shadow-sm">
            عرضك الخاص
          </div>
        )}

        <div className="flex items-stretch h-[72px]">
          {/* LEFT: Store Avatar */}
          <div 
            className="shrink-0 w-[60px] flex items-center justify-center cursor-pointer hover:opacity-80 transition-opacity border-l border-border/30"
            onClick={() => handleVisitStore(offer)}
          >
            <Avatar className="h-10 w-10 border-2 border-background shadow-md">
              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
              <AvatarFallback className="bg-muted text-muted-foreground text-xs">
                <Store className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* CENTER: Two-Row Info */}
          <div className="flex-1 min-w-0 flex flex-col justify-center py-1.5 px-2.5">
            {/* Row 1: Store Name, Badges, Rating, Followers */}
            <div className="flex items-center gap-1 mb-1 overflow-hidden">
              <span 
                className="font-bold text-[10px] text-foreground truncate max-w-[70px] cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleVisitStore(offer)}
              >
                {merchantName}
              </span>
              
              {offer.merchant?.is_verified && (
                <ShieldCheck className="h-2.5 w-2.5 text-primary shrink-0" />
              )}
              
              {badgeConfig && (
                <span className={`text-[7px] font-bold ${badgeConfig.color} shrink-0`}>
                  {badgeConfig.label}
                </span>
              )}

              <span className="w-px h-2.5 bg-border/50 mx-0.5 shrink-0" />

              {/* Rating */}
              <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground shrink-0">
                <Star className="h-2 w-2 fill-amber-500 text-amber-500" />
                {offer.rating && offer.rating.total_ratings > 0 
                  ? `${offer.rating.average_rating.toFixed(1)}` 
                  : "0.0"
                }
              </span>

              {/* Followers */}
              <span className="flex items-center gap-0.5 text-[8px] text-muted-foreground shrink-0">
                <Users className="h-2 w-2" />
                {followersCount}
              </span>

              {/* Status Badge */}
              {isThisAccepted && (
                <Badge className="text-[7px] px-1 py-0 h-3.5 bg-emerald-500 text-white border-0 gap-0.5 mr-auto shrink-0">
                  <CheckCircle className="h-2 w-2" />
                  مقبول
                </Badge>
              )}
              {isBestPrice && !isThisAccepted && (
                <Badge className="text-[7px] px-1 py-0 h-3.5 bg-amber-500/80 text-white border-0 mr-auto shrink-0">
                  الأفضل
                </Badge>
              )}
            </div>

            {/* Row 2: Price, Duration, Material, Grams */}
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Price - Primary Highlight */}
              <div className="flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-primary/15 border border-primary/30">
                <span className="font-extrabold text-xs text-primary tabular-nums">
                  {offer.price_iqd.toLocaleString("ar-IQ")}
                </span>
                <span className="text-[7px] text-primary/70">د.ع</span>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                <Clock className="h-2.5 w-2.5" />
                <span>{offer.duration_days} يوم</span>
              </div>

              {/* Material Type */}
              {offer.material_type && (
                <div className={`flex items-center gap-0.5 text-[8px] px-1 py-0.5 rounded font-medium ${
                  offer.material_type === 'filament' 
                    ? 'bg-blue-500/15 text-blue-500 border border-blue-500/30' 
                    : 'bg-purple-500/15 text-purple-500 border border-purple-500/30'
                }`}>
                  <Layers className="h-2 w-2" />
                  <span>{offer.material_type === 'filament' ? 'FDM' : 'SLA'}</span>
                </div>
              )}

              {/* Grams */}
              {offer.grams && (
                <div className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Scale className="h-2.5 w-2.5" />
                  <span>{offer.grams}g</span>
                </div>
              )}
            </div>
          </div>

          {/* RIGHT: Action Buttons */}
          <div className="shrink-0 flex items-center gap-1 px-2 border-r border-border/30">
            {/* Notes Button - Shows toast on click */}
            {offer.notes && (
              <button
                className="h-6 w-6 flex items-center justify-center rounded text-amber-500 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/30 transition-colors"
                onClick={() => showNotesToast(offer.notes!)}
                title="عرض الملاحظات"
              >
                <Eye className="h-3 w-3" />
              </button>
            )}

            {/* Visit Store */}
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-muted-foreground bg-muted/50 hover:bg-muted border border-border/50 transition-colors"
              onClick={() => handleVisitStore(offer)}
              title="زيارة المتجر"
            >
              <ExternalLink className="h-3 w-3" />
            </button>

            {/* Message */}
            <button
              className="h-6 w-6 flex items-center justify-center rounded text-primary bg-primary/10 hover:bg-primary/20 border border-primary/30 transition-colors"
              onClick={() => handleMessage(offer)}
              title="مراسلة"
            >
              <Send className="h-3 w-3" />
            </button>

            {/* Customer: Accept Button */}
            {isCustomer && !isAccepted && (
              <Button
                size="sm"
                className="h-6 px-2 text-[9px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => handleAccept(offer)}
              >
                قبول
              </Button>
            )}

            {/* Merchant: 3-State Pricing Button */}
            {isMyOffer && !isAccepted && (
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[9px] gap-0.5 border-amber-500/50 text-amber-600 hover:bg-amber-500/15"
                  onClick={() => handleEdit(offer)}
                >
                  <Edit3 className="h-2.5 w-2.5" />
                  تعديل
                </Button>
              ) : hasEdited ? (
                <div className="flex items-center gap-0.5 px-2 py-1 rounded bg-muted/60 border border-border/50 text-[8px] text-muted-foreground">
                  <Lock className="h-2 w-2" />
                  مغلق
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    );
  };

  // Merchant Pricing Button - 3 States
  const MerchantPricingButton = () => {
    if (!isMerchant || isAccepted) return null;
    
    if (myOffer) {
      const canEdit = (myOffer.edit_count ?? 0) < 1;
      const hasEdited = (myOffer.edit_count ?? 0) >= 1;
      
      if (canEdit) {
        // State 2: Can edit once
        return (
          <Button
            className="w-full h-8 text-[10px] font-bold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600 shadow-sm"
            onClick={() => handleEdit(myOffer)}
          >
            <Edit3 className="h-3 w-3 ml-1" />
            تعديل السعر ({myOffer.price_iqd.toLocaleString()} د.ع)
          </Button>
        );
      } else if (hasEdited) {
        // State 3: Locked - no more edits
        return (
          <div className="w-full h-8 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center gap-1.5 text-[10px] text-muted-foreground">
            <Lock className="h-3 w-3" />
            تم التسعير ({myOffer.price_iqd.toLocaleString()} د.ع) - لا يمكن التعديل
          </div>
        );
      }
      return null;
    }

    // State 1: No offer yet - can price
    return (
      <Button
        className="w-full h-8 text-[10px] font-bold bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70 shadow-sm"
        onClick={onAddOffer}
      >
        <Tag className="h-3 w-3 ml-1" />
        تسعير الطلب
      </Button>
    );
  };

  if (offers.length === 0 && !isMerchant) {
    return (
      <div className="text-center py-6 text-muted-foreground text-sm">
        لا توجد عروض أسعار حتى الآن
      </div>
    );
  }

  return (
    <div className="space-y-2 relative">
      {/* Floating Notes Toast */}
      {showingNotes && (
        <div className="absolute top-0 left-0 right-0 z-50 animate-in slide-in-from-top-2 fade-in duration-200">
          <div className="mx-auto max-w-[280px] p-3 rounded-lg bg-popover border border-border shadow-xl">
            <div className="flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-amber-500 shrink-0 mt-0.5" />
              <div>
                <p className="text-[10px] font-bold text-foreground mb-1">ملاحظات التاجر</p>
                <p className="text-[10px] text-muted-foreground leading-relaxed whitespace-pre-wrap">
                  {showingNotes}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Header with Sort */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-[11px] text-foreground flex items-center gap-1">
          <Tag className="h-3 w-3 text-primary" />
          عروض الأسعار
          <span className="text-[9px] font-normal text-muted-foreground">({offers.length})</span>
        </h3>

        {offers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-6 text-[9px] gap-0.5 px-1.5 text-muted-foreground hover:text-foreground">
                <Filter className="h-2.5 w-2.5" />
                {sortLabels[sortBy]}
                <ArrowUpDown className="h-2 w-2" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs min-w-[100px]">
              {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setCurrentPage(1);
                  }}
                  className={`text-[10px] ${sortBy === key ? "bg-primary/10" : ""}`}
                >
                  {label}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>

      {/* Merchant Pricing Button */}
      <MerchantPricingButton />

      {/* My Offer - Pinned at Top */}
      {myOffer && (
        <div className="pt-1">
          <OfferStrip offer={myOffer} isMyOffer />
        </div>
      )}

      {/* Other Offers */}
      {paginatedOffers.length > 0 && (
        <div className="space-y-1.5">
          {paginatedOffers.map((offer) => (
            <OfferStrip key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1 pt-1.5">
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronRight className="h-3 w-3" />
          </Button>

          <div className="flex items-center gap-0.5">
            {Array.from({ length: Math.min(totalPages, 5) }, (_, i) => {
              let page: number;
              if (totalPages <= 5) {
                page = i + 1;
              } else if (currentPage <= 3) {
                page = i + 1;
              } else if (currentPage >= totalPages - 2) {
                page = totalPages - 4 + i;
              } else {
                page = currentPage - 2 + i;
              }
              return (
                <Button
                  key={page}
                  variant={page === currentPage ? "default" : "ghost"}
                  size="icon"
                  className={`h-6 w-6 text-[9px] ${page === currentPage ? "bg-primary" : ""}`}
                  onClick={() => setCurrentPage(page)}
                >
                  {page}
                </Button>
              );
            })}
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronLeft className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Results info */}
      {sortedOffers.length > ITEMS_PER_PAGE && (
        <div className="text-center text-[8px] text-muted-foreground">
          {startIndex + 1} - {Math.min(startIndex + ITEMS_PER_PAGE, sortedOffers.length)} من {sortedOffers.length}
        </div>
      )}

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
