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
      className="border-border bg-card overflow-hidden group w-full min-w-0"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <CardContent className="p-4 sm:p-4">
        {/* Top: Store image */}
        <div className="relative">
          <div className="aspect-[16/10] rounded-2xl bg-muted/20 border border-border overflow-hidden">
            {storeImageUrl ? (
              <img
                src={storeImageUrl}
                alt={displayName}
                loading="lazy"
                className="h-full w-full object-cover"
              />
            ) : (
              <div className="h-full w-full flex items-center justify-center">
                <Store className="h-10 w-10 text-muted-foreground" />
              </div>
            )}
          </div>

          {featured ? (
            <div className="absolute top-3 right-3">
              <span className="inline-flex items-center gap-1 rounded-full border border-border bg-background/85 backdrop-blur px-2.5 py-1 text-[11px] font-bold text-foreground">
                <ShieldCheck className="h-3.5 w-3.5 text-primary" />
                مميز
              </span>
            </div>
          ) : null}
        </div>

        {/* Name + rating */}
        <div className="mt-3 min-w-0">
          <h3 className="text-base sm:text-base font-extrabold leading-tight truncate">
            {displayName}
          </h3>

          <div className="mt-1 flex items-center gap-2">
            {hasRatings ? (
              <div className="flex items-center gap-1">
                <Star className="h-4 w-4 fill-primary text-primary" />
                <span className="text-xs font-bold tabular-nums">{avg.toFixed(1)}</span>
                <span className="text-xs text-muted-foreground">({stats!.total_ratings})</span>
              </div>
            ) : (
              <span className="text-xs text-muted-foreground">لا توجد تقييمات بعد</span>
            )}
          </div>
        </div>

        {/* Featured products: clearer sizing, responsive count */}
        <div className="mt-4">
          {featuredProducts.length ? (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {featuredProducts.slice(0, 3).map((p, idx) => {
                  const mainImg =
                    p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;

                  // Render all 3, but hide 3rd on small screens via class
                  const hideOnMobile = idx === 2;

                  return (
                    <div key={p.id} className={hideOnMobile ? "hidden md:block" : "block"}>
                      <div className="aspect-square rounded-2xl bg-muted/20 overflow-hidden border border-border">
                        {mainImg ? (
                          <img
                            src={mainImg}
                            alt={p.title}
                            loading="lazy"
                            className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                          />
                        ) : (
                          <div className="h-full w-full flex items-center justify-center">
                            <Store className="h-6 w-6 text-muted-foreground" />
                          </div>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-semibold text-foreground/90 line-clamp-1">
                        {p.title}
                      </p>
                    </div>
                  );
                })}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-muted/10 p-4">
              <p className="text-xs text-muted-foreground">لا توجد منتجات مميزة</p>
            </div>
          )}
        </div>

        {/* Icon-only actions (no big buttons) */}
        <div className="mt-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="h-10 w-10 rounded-2xl"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
              aria-label="زيارة المتجر"
              title="زيارة المتجر"
            >
              <Store className="h-5 w-5" />
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-2xl"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
              aria-label="تواصل"
              title="تواصل"
            >
              <MessageCircle className="h-5 w-5" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
