import { memo } from "react";
import { ArrowUpRight, MessageCircle, Star, Store } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export type MerchantShowcaseProduct = {
  id: string;
  title: string;
  image_urls: string[] | null;
  primary_image_index: number;
};

export type MerchantShowcaseRating = {
  average_rating: number;
  total_ratings: number;
} | null;

type Props = {
  name: string;
  storeImageUrl: string | null;
  rating: MerchantShowcaseRating;
  products: MerchantShowcaseProduct[];
  onVisit: () => void;
  onContact: () => void;
};

function Stars({ value }: { value: number }) {
  const rounded = Math.round(value);
  return (
    <div className="flex items-center gap-1">
      {[1, 2, 3, 4, 5].map((i) => (
        <Star
          key={i}
          className={
            "h-3.5 w-3.5 " +
            (i <= rounded ? "fill-primary text-primary" : "text-muted-foreground")
          }
        />
      ))}
    </div>
  );
}

function getMainImage(p: MerchantShowcaseProduct) {
  return p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
}

function MerchantShowcaseCard({ name, storeImageUrl, rating, products, onVisit, onContact }: Props) {
  return (
    <Card
      className="group relative overflow-hidden border-border bg-card hover:shadow-lg transition-shadow"
      role="button"
      tabIndex={0}
      onClick={onVisit}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onVisit();
      }}
    >
      {/* Cover */}
      <div className="relative h-24 sm:h-28">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 via-background to-secondary/20" />
        <div className="absolute inset-0 opacity-40 bg-[radial-gradient(closest-side,hsl(var(--primary)/0.30),transparent)]" />
        {/* subtle frame */}
        <div className="absolute inset-x-0 bottom-0 h-px bg-border" />
      </div>

      {/* Header row */}
      <div className="px-4 sm:px-5 -mt-8">
        <div className="flex items-end justify-between gap-3">
          <div className="flex items-end gap-3 min-w-0">
            <div className="h-14 w-14 sm:h-16 sm:w-16 rounded-2xl border border-border bg-background shadow-sm overflow-hidden flex items-center justify-center">
              {storeImageUrl ? (
                <img
                  src={storeImageUrl}
                  alt={name}
                  loading="lazy"
                  className="h-full w-full object-cover"
                />
              ) : (
                <Store className="h-7 w-7 text-muted-foreground" />
              )}
            </div>

            <div className="min-w-0 pb-1">
              <div className="flex items-center gap-2">
                <h3 className="font-black text-base sm:text-lg leading-tight truncate">{name}</h3>
              </div>

              {rating && rating.total_ratings > 0 ? (
                <div className="mt-1 flex items-center gap-2">
                  <Stars value={rating.average_rating} />
                  <span className="text-xs text-muted-foreground">
                    {rating.average_rating.toFixed(1)} • {rating.total_ratings} تقييم
                  </span>
                </div>
              ) : (
                <p className="mt-1 text-xs text-muted-foreground">لا توجد تقييمات بعد</p>
              )}
            </div>
          </div>

          <div className="flex items-center gap-2 pb-1">
            <Button
              variant="outline"
              size="sm"
              className="h-9"
              onClick={(e) => {
                e.stopPropagation();
                onContact();
              }}
            >
              <MessageCircle className="h-4 w-4 ml-2" />
              تواصل
            </Button>
            <Button
              size="sm"
              className="h-9"
              onClick={(e) => {
                e.stopPropagation();
                onVisit();
              }}
            >
              <ArrowUpRight className="h-4 w-4 ml-2" />
              زيارة
            </Button>
          </div>
        </div>
      </div>

      {/* Products strip */}
      <div className="px-4 sm:px-5 pb-4 pt-4">
        {products.length ? (
          <div className="grid grid-cols-3 gap-2">
            {products.slice(0, 3).map((p) => {
              const img = getMainImage(p);
              return (
                <div
                  key={p.id}
                  className="rounded-xl border border-border bg-background/60 overflow-hidden"
                >
                  <div className="aspect-square bg-muted/20 overflow-hidden">
                    {img ? (
                      <img
                        src={img}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center">
                        <Store className="h-5 w-5 text-muted-foreground" />
                      </div>
                    )}
                  </div>
                  <div className="p-2">
                    <p className="text-xs font-semibold line-clamp-1">{p.title}</p>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="rounded-2xl border border-border bg-background/50 p-4 text-center">
            <p className="text-sm text-muted-foreground">لا توجد منتجات مميزة حالياً</p>
          </div>
        )}
      </div>
    </Card>
  );
}

export default memo(MerchantShowcaseCard);
