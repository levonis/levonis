import { memo } from "react";
import { MessageCircle, Settings, Star, Store } from "lucide-react";

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
  isAdmin,
  onAdminManage,
}: Props) {
  const hasRatings = !!stats && stats.total_ratings > 0;
  const avg = hasRatings ? Number(stats!.average_rating) : 0;

  return (
    <div
      className="group relative rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <div className="p-2 sm:p-2.5">
        <div className="flex items-center gap-2 min-w-0">
          {/* Circular Store image with Frame */}
          <div className="shrink-0">
            <AvatarWithFrame
              imageUrl={storeImageUrl}
              frameUrl={storeFrameUrl}
              size="xs"
              animated
            />
          </div>

          {/* Name + rating */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1 min-w-0">
              <h3 className="text-[11px] sm:text-xs font-bold leading-tight truncate max-w-[100px]" title={displayName}>
                {displayName}
              </h3>
              <MerchantBadgesDisplay 
                isVerified={isVerified} 
                badgeTier={badgeTier} 
                size="sm" 
              />
              {featured && (
                <span className="inline-flex items-center rounded-full bg-primary/10 px-1 py-0.5 text-[7px] font-bold text-primary shrink-0">
                  مميز
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-0.5 min-w-0">
              <Star className="h-2.5 w-2.5 fill-primary text-primary" />
              <span className="text-[9px] font-bold tabular-nums">{hasRatings ? avg.toFixed(1) : "0.0"}</span>
              <span className="text-[8px] text-muted-foreground">({stats?.total_ratings || 0})</span>
            </div>
          </div>

          {/* Featured product thumbs (desktop) */}
          <div className="hidden sm:flex items-center gap-1 shrink-0">
            {featuredProducts.slice(0, 3).map((p, idx) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
              const hideOnSm = idx === 2;

              return (
                <div
                  key={p.id}
                  className={hideOnSm ? "hidden lg:block" : "block"}
                  title={p.title}
                >
                  <div className="h-8 w-8 rounded-md overflow-hidden border border-border/40 bg-muted/20">
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-3 w-3 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 shrink-0">
            {isAdmin && onAdminManage && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-6 w-6 rounded-md border-0 bg-muted/50"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdminManage();
                }}
                aria-label="إدارة التجار"
              >
                <Settings className="h-3 w-3" />
              </Button>
            )}

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-6 w-6 rounded-md border-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
              aria-label="زيارة المتجر"
            >
              <Store className="h-3 w-3" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-6 w-6 rounded-md border-0 bg-muted/50"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
              aria-label="تواصل"
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
          </div>
        </div>

        {/* Mobile: Featured product thumbs */}
        {featuredProducts.length > 0 && (
          <div className="mt-2 grid grid-cols-3 gap-1 sm:hidden">
            {featuredProducts.slice(0, 3).map((p) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
              return (
                <div
                  key={p.id}
                  className="aspect-square rounded-md overflow-hidden border border-border/40 bg-muted/20"
                  title={p.title}
                >
                  {mainImg ? (
                    <img src={mainImg} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Store className="h-4 w-4 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
