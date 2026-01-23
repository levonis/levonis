import { memo } from "react";
import { MessageCircle, ShieldCheck, Star, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

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
  stats?: RatingStats;
  featuredProducts?: FeaturedProduct[];
  onOpenStore: () => void;
  onContact?: () => void;
};

function MerchantDirectoryCardBase({
  displayName,
  storeImageUrl,
  featured,
  stats,
  featuredProducts = [],
  onOpenStore,
  onContact,
}: Props) {
  const hasRatings = !!stats && stats.total_ratings > 0;
  const avg = hasRatings ? Number(stats!.average_rating) : 0;

  return (
    <Card
      className="border-border bg-card overflow-hidden group"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <CardContent className="p-0">
        {/* Header */}
        <div className="relative">
          <div className="h-16 bg-muted/30" />

          <div className="absolute inset-x-0 top-4 px-4 flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div className="h-12 w-12 rounded-2xl bg-background border border-border shadow-sm overflow-hidden flex items-center justify-center shrink-0">
                {storeImageUrl ? (
                  <img
                    src={storeImageUrl}
                    alt={displayName}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <Store className="h-6 w-6 text-muted-foreground" />
                )}
              </div>

              <div className="min-w-0">
                <div className="flex items-center gap-2 min-w-0">
                  <h3 className="text-sm sm:text-base font-extrabold leading-tight truncate">
                    {displayName}
                  </h3>
                  {featured ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/80 px-2 py-0.5 text-[11px] font-bold text-foreground">
                      <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                      مميز
                    </span>
                  ) : null}
                </div>

                <div className="mt-1 flex items-center justify-between gap-2">
                  {hasRatings ? (
                    <div className="flex items-center gap-1">
                      <Star className="h-4 w-4 fill-primary text-primary" />
                      <span className="text-xs font-bold tabular-nums">{avg.toFixed(1)}</span>
                      <span className="text-xs text-muted-foreground">
                        ({stats!.total_ratings} تقييم)
                      </span>
                    </div>
                  ) : (
                    <span className="text-xs text-muted-foreground">لا توجد تقييمات بعد</span>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Featured products */}
        <div className="px-4 pb-4 pt-6">
          {featuredProducts.length ? (
            <div className="grid grid-cols-3 gap-2">
              {featuredProducts.slice(0, 3).map((p) => {
                const mainImg =
                  p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;

                return (
                  <div key={p.id} className="min-w-0">
                    <div className="aspect-square rounded-xl bg-muted/20 overflow-hidden border border-border">
                      {mainImg ? (
                        <img
                          src={mainImg}
                          alt={p.title}
                          loading="lazy"
                          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center">
                          <Store className="h-6 w-6 text-muted-foreground" />
                        </div>
                      )}
                    </div>
                    <p className="mt-1 text-[11px] font-semibold text-foreground/90 line-clamp-1">
                      {p.title}
                    </p>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-border bg-muted/10 p-3">
              <p className="text-xs text-muted-foreground">لا توجد منتجات مميزة</p>
            </div>
          )}

          {/* Actions */}
          {/* Mobile: icon-only actions (≤768px) */}
          <div className="mt-3 flex items-center justify-end gap-2 md:hidden">
            <Button
              variant="outline"
              className="h-9 w-9 p-0"
              aria-label="زيارة المتجر"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
            >
              <Store className="h-4 w-4" />
            </Button>
            <Button
              variant="outline"
              className="h-9 w-9 p-0"
              aria-label="تواصل مع التاجر"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
            >
              <MessageCircle className="h-4 w-4" />
            </Button>
          </div>

          {/* Desktop: keep text buttons */}
          <div className="mt-4 hidden grid-cols-2 gap-2 md:grid">
            <Button
              variant="default"
              className="h-10"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
            >
              زيارة المتجر
            </Button>
            <Button
              variant="outline"
              className="h-10"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
            >
              <MessageCircle className="h-4 w-4 ms-2" />
              تواصل
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
