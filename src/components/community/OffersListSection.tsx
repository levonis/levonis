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
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
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

const BADGE_CONFIG: Record<string, { bg: string; text: string }> = {
  bronze: { bg: "bg-amber-700/30", text: "text-amber-400" },
  silver: { bg: "bg-slate-400/30", text: "text-slate-300" },
  gold: { bg: "bg-yellow-500/30", text: "text-yellow-400" },
  platinum: { bg: "bg-violet-500/30", text: "text-violet-300" },
  diamond: { bg: "bg-cyan-400/30", text: "text-cyan-300" },
  emerald: { bg: "bg-emerald-500/30", text: "text-emerald-300" },
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
  const isMerchant = !!merchantId && user?.id === merchantId;
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
    price_asc: "السعر ↑",
    price_desc: "السعر ↓",
    duration_asc: "الأسرع",
    rating_desc: "الأعلى تقييماً",
  };

  // Offer Strip Card - Professional Theme with better notes visibility
  const OfferStrip = ({ offer, isMyOffer = false }: { offer: MerchantOffer; isMyOffer?: boolean }) => {
    const isBestPrice = offer.price_iqd === lowestPrice && !acceptedOfferId;
    const isThisAccepted = acceptedOfferId === offer.id;
    const canEdit = offer.trader_id === merchantId && (offer.edit_count ?? 0) < 1 && !isAccepted;
    const hasEdited = (offer.edit_count ?? 0) >= 1;

    const merchantName = offer.merchant?.display_name || "تاجر";
    const badgeTier = offer.merchant?.badge_tier;
    const badgeConfig = badgeTier ? BADGE_CONFIG[badgeTier] : null;
    const followersCount = offer.merchant?.followers_count || 0;

    return (
      <div
        className={`relative rounded-xl border overflow-hidden transition-all ${
          isThisAccepted
            ? "bg-gradient-to-l from-emerald-500/15 via-emerald-500/8 to-transparent border-emerald-500/40 dark:border-emerald-500/40"
            : isMyOffer
            ? "bg-gradient-to-l from-primary/15 via-primary/8 to-transparent border-primary/50"
            : isBestPrice
            ? "bg-gradient-to-l from-amber-500/10 via-amber-500/5 to-transparent border-amber-500/30"
            : "bg-card border-border/50 hover:border-primary/30"
        }`}
      >
        {/* My Offer Label */}
        {isMyOffer && (
          <div className="absolute -top-px right-4 px-2.5 py-0.5 rounded-b-md bg-primary text-[9px] font-bold text-primary-foreground z-10">
            عرضك الخاص
          </div>
        )}

        <div className="flex items-stretch">
          {/* Left: Avatar Section */}
          <div 
            className="shrink-0 w-16 flex items-center justify-center bg-muted/30 cursor-pointer hover:bg-muted/50 transition-colors"
            onClick={() => handleVisitStore(offer)}
          >
            <Avatar className="h-11 w-11 border-2 border-primary/30">
              <AvatarImage src={offer.merchant?.store_image_url || undefined} />
              <AvatarFallback className="bg-primary/20 text-primary text-sm">
                <Store className="h-5 w-5" />
              </AvatarFallback>
            </Avatar>
          </div>

          {/* Middle: Info Sections */}
          <div className="flex-1 min-w-0 py-2 px-3">
            {/* Top Row: Store Info */}
            <div className="flex items-center gap-1.5 mb-1.5 flex-wrap">
              <span 
                className="font-semibold text-[11px] truncate max-w-[90px] cursor-pointer hover:text-primary transition-colors"
                onClick={() => handleVisitStore(offer)}
              >
                {merchantName}
              </span>
              
              {offer.merchant?.is_verified && (
                <ShieldCheck className="h-3 w-3 text-primary shrink-0" />
              )}
              
              {badgeConfig && (
                <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded ${badgeConfig.bg} ${badgeConfig.text}`}>
                  {badgeTier}
                </span>
              )}

              {/* Rating - Small */}
              {offer.rating && offer.rating.total_ratings > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Star className="h-2.5 w-2.5 fill-amber-500 text-amber-500" />
                  {offer.rating.average_rating.toFixed(1)}
                  <span className="opacity-50">({offer.rating.total_ratings})</span>
                </span>
              )}

              {/* Followers - Small */}
              {followersCount > 0 && (
                <span className="flex items-center gap-0.5 text-[9px] text-muted-foreground">
                  <Users className="h-2.5 w-2.5" />
                  {followersCount}
                </span>
              )}

              {/* Status Badges */}
              {isBestPrice && !isThisAccepted && (
                <Badge className="text-[8px] px-1.5 py-0 h-4 bg-amber-500/20 text-amber-600 dark:text-amber-400 border-0 mr-auto font-bold">
                  الأفضل
                </Badge>
              )}
              {isThisAccepted && (
                <Badge className="text-[8px] px-1.5 py-0 h-4 bg-emerald-500 text-white border-0 gap-0.5 mr-auto font-bold">
                  <CheckCircle className="h-2.5 w-2.5" />
                  مقبول
                </Badge>
              )}
            </div>

            {/* Bottom Row: Main Stats */}
            <div className="flex items-center gap-2 flex-wrap">
              {/* Price - Primary */}
              <div className="flex items-center gap-1 px-2 py-1 rounded-lg bg-primary/15 border border-primary/30">
                <span className="font-bold text-sm text-primary">
                  {offer.price_iqd.toLocaleString("ar-IQ")}
                </span>
                <span className="text-[9px] text-primary/70">د.ع</span>
              </div>

              {/* Duration */}
              <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                <Clock className="h-3 w-3" />
                <span>{offer.duration_days} يوم</span>
              </div>

              {/* Grams if available */}
              {offer.grams && (
                <div className="flex items-center gap-1 text-[10px] text-muted-foreground">
                  <Scale className="h-3 w-3" />
                  <span>{offer.grams}g</span>
                </div>
              )}

              {/* Material Type Badge */}
              {offer.material_type && (
                <div className={`flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-md font-medium ${
                  offer.material_type === 'filament' 
                    ? 'bg-blue-500/15 text-blue-600 dark:text-blue-400 border border-blue-500/30' 
                    : 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30'
                }`}>
                  <Layers className="h-2.5 w-2.5" />
                  <span>{offer.material_type === 'filament' ? 'FDM' : 'SLA'}</span>
                </div>
              )}
              
              {/* Notes Badge - Always visible when there are notes */}
              {offer.notes && (
                <TooltipProvider delayDuration={100}>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <div className="flex items-center gap-1 px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30 cursor-pointer hover:bg-amber-500/25 transition-colors">
                        <Eye className="h-3 w-3" />
                        <span className="text-[9px] font-medium">ملاحظة</span>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent 
                      side="top" 
                      className="max-w-[250px] text-[11px] bg-popover border-border p-3 shadow-xl z-50"
                    >
                      <p className="font-bold text-foreground mb-1.5 text-xs flex items-center gap-1.5">
                        <Eye className="h-3 w-3 text-amber-500" />
                        ملاحظات التاجر:
                      </p>
                      <p className="text-muted-foreground leading-relaxed whitespace-pre-wrap">{offer.notes}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>

          {/* Right: Actions Section */}
          <div className="shrink-0 flex items-center gap-1.5 px-2 border-r border-border/30">
            {/* Message Button */}
            <button
              className="h-7 w-7 flex items-center justify-center rounded-lg text-primary hover:text-primary bg-primary/10 hover:bg-primary/20 transition-colors border border-primary/20"
              onClick={() => handleMessage(offer)}
              title="مراسلة"
            >
              <Send className="h-3.5 w-3.5" />
            </button>

            {/* Visit Store Button */}
            <button
              className="h-7 w-7 flex items-center justify-center rounded-lg text-muted-foreground hover:text-foreground bg-muted/30 hover:bg-muted/50 transition-colors border border-border/30"
              onClick={() => handleVisitStore(offer)}
              title="زيارة المتجر"
            >
              <ExternalLink className="h-3.5 w-3.5" />
            </button>

            {/* Customer: Accept Button - ALWAYS VISIBLE for customer when not accepted */}
            {isCustomer && !isAccepted && (
              <Button
                size="sm"
                className="h-7 px-3 text-[10px] font-bold bg-emerald-600 hover:bg-emerald-700 text-white shadow-sm"
                onClick={() => handleAccept(offer)}
              >
                <CheckCircle className="h-3 w-3 ml-1" />
                قبول
              </Button>
            )}

            {/* Merchant: Edit/Lock Button - 3 States */}
            {isMyOffer && !isAccepted && (
              canEdit ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="h-7 px-2.5 text-[10px] gap-1 border-amber-500/40 text-amber-600 dark:text-amber-400 hover:bg-amber-500/15 font-medium"
                  onClick={() => handleEdit(offer)}
                >
                  <Edit3 className="h-3 w-3" />
                  تعديل
                </Button>
              ) : hasEdited ? (
                <div className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-muted/50 border border-border/50 text-[9px] text-muted-foreground font-medium">
                  <Lock className="h-2.5 w-2.5" />
                  تم التسعير
                </div>
              ) : null
            )}
          </div>
        </div>
      </div>
    );
  };

  // Merchant Pricing Button - Shows edit if offer exists
  const MerchantPricingButton = () => {
    if (!isMerchant || isAccepted) return null;
    
    if (myOffer) {
      const canEdit = (myOffer.edit_count ?? 0) < 1;
      const hasEdited = (myOffer.edit_count ?? 0) >= 1;
      
      if (canEdit) {
        return (
          <Button
            className="w-full h-9 text-xs font-bold bg-gradient-to-r from-amber-600 to-amber-700 hover:from-amber-500 hover:to-amber-600"
            onClick={() => handleEdit(myOffer)}
          >
            <Edit3 className="h-3.5 w-3.5 ml-1.5" />
            تعديل السعر ({myOffer.price_iqd.toLocaleString()} د.ع)
          </Button>
        );
      } else if (hasEdited) {
        return (
          <div className="w-full h-9 rounded-lg bg-muted/50 border border-border/50 flex items-center justify-center gap-2 text-xs text-muted-foreground font-medium">
            <Lock className="h-3.5 w-3.5" />
            تم التسعير ({myOffer.price_iqd.toLocaleString()} د.ع) - لا يمكن التعديل
          </div>
        );
      }
      return null;
    }

    // State 1: No offer yet - can price
    return (
      <Button
        className="w-full h-9 text-xs font-bold bg-gradient-to-r from-primary to-[hsl(160_60%_25%)] hover:from-primary/90 hover:to-[hsl(160_60%_30%)]"
        onClick={onAddOffer}
      >
        <Tag className="h-3.5 w-3.5 ml-1.5" />
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
    <div className="space-y-3">
      {/* Header with Sort/Filter */}
      <div className="flex items-center justify-between">
        <h3 className="font-bold text-xs text-foreground flex items-center gap-1.5">
          <Tag className="h-3.5 w-3.5 text-primary" />
          عروض الأسعار
          <span className="text-[10px] font-normal text-muted-foreground">({offers.length})</span>
        </h3>

        {offers.length > 0 && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="h-7 text-[10px] gap-1 px-2 text-muted-foreground hover:text-foreground">
                <Filter className="h-3 w-3" />
                {sortLabels[sortBy]}
                <ArrowUpDown className="h-2.5 w-2.5" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="text-xs">
              {(Object.entries(sortLabels) as [SortOption, string][]).map(([key, label]) => (
                <DropdownMenuItem
                  key={key}
                  onClick={() => {
                    setSortBy(key);
                    setCurrentPage(1);
                  }}
                  className={`text-xs ${sortBy === key ? "bg-primary/10" : ""}`}
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

      {/* My Offer - Pinned */}
      {myOffer && (
        <div className="space-y-1">
          <OfferStrip offer={myOffer} isMyOffer />
        </div>
      )}

      {/* Other Offers */}
      {paginatedOffers.length > 0 && (
        <div className="space-y-2">
          {paginatedOffers.map((offer) => (
            <OfferStrip key={offer.id} offer={offer} />
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-1.5 pt-2">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            disabled={currentPage === 1}
            onClick={() => setCurrentPage((p) => p - 1)}
          >
            <ChevronRight className="h-3.5 w-3.5" />
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
                  className={`h-7 w-7 text-[10px] ${page === currentPage ? "bg-primary" : ""}`}
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
            className="h-7 w-7"
            disabled={currentPage === totalPages}
            onClick={() => setCurrentPage((p) => p + 1)}
          >
            <ChevronLeft className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}

      {/* Results info */}
      {sortedOffers.length > ITEMS_PER_PAGE && (
        <div className="text-center text-[9px] text-muted-foreground">
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
