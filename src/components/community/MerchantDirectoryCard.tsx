import { memo } from "react";
import { MessageCircle, Star, Store, Sparkles, TrendingUp, Package } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MerchantBadgesDisplay, BadgeTier } from "./MerchantBadges";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

type FeaturedProduct = {
  id: string;
  title: string;
  image_urls: string[] | null;
  primary_image_index: number;
};

type RatingStats = {
  total_ratings: number;
  average_rating: number;
} | null;

type Props = {
  id: string;
  displayName: string;
  storeImageUrl?: string | null;
  storeFrameUrl?: string | null;
  featured?: boolean;
  isVerified?: boolean;
  badgeTier?: BadgeTier;
  stats?: RatingStats;
  featuredProducts?: FeaturedProduct[];
  onOpenStore: () => void;
  onContact?: () => void;
  isAdmin?: boolean;
  onAdminManage?: () => void;
};

function MerchantDirectoryCardBase({
  displayName,
  storeImageUrl,
  storeFrameUrl,
  featured,
  isVerified = false,
  badgeTier = "none",
  stats,
  featuredProducts = [],
  onOpenStore,
  onContact,
}: Props) {
  const hasRatings = !!stats && stats.total_ratings > 0;
  const avg = hasRatings ? Number(stats!.average_rating) : 0;
  const productCount = featuredProducts.length;

  return (
    <div
      className="group relative w-full cursor-pointer overflow-hidden rounded-2xl border border-border/40 bg-gradient-to-br from-card via-card/95 to-background shadow-lg transition-all duration-300 hover:shadow-xl hover:shadow-primary/5 hover:border-primary/30 hover:-translate-y-0.5"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      {/* Premium Gradient Overlay */}
      <div className="absolute inset-0 bg-gradient-to-t from-primary/5 via-transparent to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
      
      {/* Featured Badge - Top Corner */}
      {featured && (
        <div className="absolute top-0 right-0 z-10">
          <div className="flex items-center gap-1 rounded-bl-xl rounded-tr-2xl bg-gradient-to-r from-primary to-primary/80 px-2.5 py-1 shadow-lg">
            <Sparkles className="h-3 w-3 text-primary-foreground animate-pulse" />
            <span className="text-[10px] font-bold text-primary-foreground">مميز</span>
          </div>
        </div>
      )}

      <div className="relative p-3 sm:p-4">
        {/* Header Section */}
        <div className="flex items-start gap-3">
          {/* Store Avatar - Enhanced */}
          <div className="relative shrink-0">
            <div className="rounded-full p-0.5 bg-gradient-to-br from-primary/20 to-primary/5 group-hover:from-primary/30 group-hover:to-primary/10 transition-all duration-300">
              <AvatarWithFrame
                imageUrl={storeImageUrl}
                frameUrl={storeFrameUrl}
                size="md"
                animated
              />
            </div>
            {/* Online Indicator */}
            <div className="absolute -bottom-0.5 -right-0.5 h-3.5 w-3.5 rounded-full border-2 border-card bg-emerald-500 shadow-sm" />
          </div>

          {/* Store Info */}
          <div className="min-w-0 flex-1 space-y-1.5">
            {/* Name Row */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <h3 
                className="text-sm sm:text-base font-bold leading-tight truncate max-w-[120px] sm:max-w-[160px] text-foreground group-hover:text-primary transition-colors duration-200" 
                title={displayName}
              >
                {displayName}
              </h3>
              <MerchantBadgesDisplay 
                isVerified={isVerified} 
                badgeTier={badgeTier} 
                size="sm" 
              />
            </div>

            {/* Rating Row - Enhanced */}
            <div className="flex items-center gap-2">
              <div className="flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5">
                <Star className="h-3 w-3 fill-primary text-primary" />
                <span className="text-xs font-bold text-primary tabular-nums">
                  {hasRatings ? avg.toFixed(1) : "0.0"}
                </span>
              </div>
              <span className="text-[10px] text-muted-foreground">
                ({stats?.total_ratings || 0} تقييم)
              </span>
            </div>

            {/* Stats Row */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-1 text-muted-foreground">
                <Package className="h-3 w-3" />
                <span className="text-[10px]">{productCount} منتج</span>
              </div>
              {hasRatings && avg >= 4.5 && (
                <div className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <TrendingUp className="h-3 w-3" />
                  <span className="text-[10px] font-medium">متميز</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Featured Products Grid */}
        {productCount > 0 && (
          <div className="mt-3 pt-3 border-t border-border/30">
            <div className="grid grid-cols-3 gap-2">
              {featuredProducts.slice(0, 3).map((p, idx) => {
                const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
                return (
                  <div
                    key={p.id}
                    className="group/thumb relative aspect-square overflow-hidden rounded-xl border border-border/30 bg-muted/30 transition-all duration-200 hover:border-primary/40 hover:shadow-md"
                    title={p.title}
                  >
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover transition-transform duration-300 group-hover/thumb:scale-110"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center bg-muted/50">
                        <Store className="h-5 w-5 text-muted-foreground/50" />
                      </div>
                    )}
                    {/* Product Overlay */}
                    <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent opacity-0 group-hover/thumb:opacity-100 transition-opacity duration-200" />
                    {idx === 2 && productCount > 3 && (
                      <div className="absolute inset-0 flex items-center justify-center bg-black/60 backdrop-blur-sm">
                        <span className="text-xs font-bold text-white">+{productCount - 3}</span>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Action Buttons - Bottom */}
        <div className="mt-3 flex items-center gap-2">
          <Button
            type="button"
            className="flex-1 h-9 rounded-xl bg-gradient-to-r from-primary to-primary/90 text-primary-foreground font-medium text-xs shadow-md hover:shadow-lg hover:from-primary/90 hover:to-primary transition-all duration-200"
            onClick={(e) => {
              e.stopPropagation();
              onOpenStore();
            }}
          >
            <Store className="h-3.5 w-3.5 ml-1.5" />
            زيارة المتجر
          </Button>

          <Button
            type="button"
            variant="outline"
            className="h-9 w-9 rounded-xl border-border/50 bg-background/50 backdrop-blur-sm hover:bg-primary/10 hover:border-primary/50 hover:text-primary transition-all duration-200"
            disabled={!onContact}
            onClick={(e) => {
              e.stopPropagation();
              onContact?.();
            }}
            aria-label="تواصل"
            title="تواصل مع المتجر"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Decorative Elements */}
      <div className="absolute -top-12 -right-12 h-24 w-24 rounded-full bg-primary/5 blur-2xl group-hover:bg-primary/10 transition-colors duration-500" />
      <div className="absolute -bottom-8 -left-8 h-16 w-16 rounded-full bg-primary/5 blur-xl group-hover:bg-primary/10 transition-colors duration-500" />
    </div>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
