import { memo } from "react";
import { MessageCircle, Settings, Star, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      className="border-border bg-card overflow-hidden group w-full min-w-0"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <CardContent className="p-3 sm:p-4">
        <div className="flex items-center gap-3 min-w-0">
          {/* Store image (fixed, no layout jumps) */}
          <div className="relative h-16 w-16 shrink-0 rounded-2xl bg-muted/20 border border-border overflow-hidden">
            {storeImageUrl ? (
              <img
                src={storeImageUrl}
                alt={displayName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Store className="h-8 w-8 text-muted-foreground" />
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
                <span className="inline-flex items-center gap-1 rounded-full border border-border bg-muted/20 px-1.5 py-0.5 text-[9px] font-bold text-foreground shrink-0">
                  مميز
                </span>
              )}
            </div>
            <div className="mt-0.5 flex items-center gap-1 min-w-0">
              <Star className="h-3 w-3 fill-primary text-primary" />
              <span className="text-[10px] font-bold tabular-nums">{hasRatings ? avg.toFixed(1) : "0.0"}</span>
              <span className="text-[10px] text-muted-foreground">({stats?.total_ratings || 0})</span>
            </div>
          </div>

          {/* Featured product thumbs (stay in one row; 2 on mobile, 3+ on larger) */}
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
                  <div className="h-14 w-14 rounded-2xl bg-muted/20 overflow-hidden border border-border">
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

          {/* Actions (icon-only) */}
          <div className="flex items-center gap-2 shrink-0">
            {isAdmin && onAdminManage ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-2xl"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdminManage();
                }}
                aria-label="إدارة التجار"
                title="إدارة التجار"
              >
                <Settings className="h-4.5 w-4.5" />
              </Button>
            ) : null}

            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-9 w-9 rounded-2xl"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
              aria-label="زيارة المتجر"
              title="زيارة المتجر"
            >
              <Store className="h-4.5 w-4.5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-9 w-9 rounded-2xl"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
              aria-label="تواصل"
              title="تواصل"
            >
              <MessageCircle className="h-4.5 w-4.5" />
            </Button>
          </div>
        </div>

        {/* Mobile-only: show up to 3 larger thumbs (no overflow) */}
        {featuredProducts.length ? (
          <div className="mt-3 grid grid-cols-3 gap-2 sm:hidden">
            {featuredProducts.slice(0, 3).map((p) => {
              const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
              return (
                <div
                  key={p.id}
                  className="aspect-square rounded-2xl bg-muted/20 overflow-hidden border border-border"
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
      </CardContent>
    </Card>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
