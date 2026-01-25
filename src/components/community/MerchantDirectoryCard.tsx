import { memo } from "react";
import { MessageCircle, Settings, Star, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { MerchantBadgesDisplay, BadgeTier } from "./MerchantBadges";

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
      className="levo-card-frame group w-full min-w-0 cursor-pointer"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <div className="p-3 sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Store image */}
          <div className="levo-thumb-frame relative h-16 w-16 shrink-0">
            {storeImageUrl ? (
              <img
                src={storeImageUrl}
                alt={displayName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <div className="levo-icon-frame h-10 w-10">
                  <Store className="h-5 w-5 text-primary/60" />
                </div>
              </div>
            )}
          </div>

          {/* Name + rating */}
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-1.5 min-w-0">
              <h3 className="text-[15px] sm:text-base font-extrabold leading-tight" title={displayName}>
                {displayName}
              </h3>
              <MerchantBadgesDisplay 
                isVerified={isVerified} 
                badgeTier={badgeTier} 
                size="sm" 
              />
              {featured && (
                <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 border border-primary/20 px-1.5 py-0.5 text-[9px] font-bold text-primary shrink-0">
                  مميز
                </span>
              )}
            </div>
            <div className="mt-1 flex items-center gap-1 min-w-0">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="text-[10px] font-bold tabular-nums">{hasRatings ? avg.toFixed(1) : "0.0"}</span>
              <span className="text-[10px] text-muted-foreground">({stats?.total_ratings || 0})</span>
            </div>
          </div>

          {/* Featured product thumbs (desktop) */}
          <div className="hidden sm:flex items-center gap-2 shrink-0">
            {featuredProducts.slice(0, 3).map((p, idx) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
              const hideOnSm = idx === 2;

              return (
                <div
                  key={p.id}
                  className={hideOnSm ? "hidden lg:block" : "block"}
                  title={p.title}
                >
                  <div className="levo-thumb-frame h-14 w-14">
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-1 sm:gap-2 shrink-0">
            {isAdmin && onAdminManage ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="levo-action-frame h-7 w-7 sm:h-9 sm:w-9 rounded-full border-0"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdminManage();
                }}
                aria-label="إدارة التجار"
                title="إدارة التجار"
              >
                <Settings className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="levo-action-frame h-7 w-7 sm:h-9 sm:w-9 rounded-full border-0"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
              aria-label="زيارة المتجر"
              title="زيارة المتجر"
            >
              <Store className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="levo-action-frame h-7 w-7 sm:h-9 sm:w-9 rounded-full border-0"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
              aria-label="تواصل"
              title="تواصل"
            >
              <MessageCircle className="h-3.5 w-3.5 sm:h-4 sm:w-4" />
            </Button>
          </div>
        </div>

        {/* Mobile: Featured product thumbs */}
        {featuredProducts.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
            {featuredProducts.slice(0, 3).map((p) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
              return (
                <div
                  key={p.id}
                  className="levo-thumb-frame aspect-square"
                  title={p.title}
                >
                  {mainImg ? (
                    <img src={mainImg} alt={p.title} loading="lazy" className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center">
                      <Store className="h-5 w-5 text-muted-foreground" />
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
