import { memo } from "react";
import { Store, Eye } from "lucide-react";

import { Button } from "@/components/ui/button";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

type Props = {
  title: string;
  priceIqd?: number | null;
  imageUrl?: string | null;
  merchantName?: string;
  merchantImageUrl?: string | null;
  merchantFrameUrl?: string | null;
  onOpenStore: () => void;
  /** Opens the product detail modal */
  onProductClick?: () => void;
  /** Optional: if you already have a chat action elsewhere */
  onContact?: () => void;
};

function CommunityProductCardBase({
  title,
  priceIqd,
  imageUrl,
  merchantName,
  merchantImageUrl,
  merchantFrameUrl,
  onOpenStore,
  onProductClick,
}: Props) {
  return (
    <div
      className="group relative rounded-lg border border-border/50 bg-card/80 backdrop-blur-sm overflow-hidden cursor-pointer hover:border-primary/30 hover:shadow-md transition-all duration-200"
      role="button"
      tabIndex={0}
      onClick={onProductClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onProductClick?.();
      }}
    >
      {/* Image */}
      <div className="relative aspect-square bg-muted/10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="h-5 w-5 text-muted-foreground/40" />
          </div>
        )}

        {/* Compact action buttons */}
        <div className="absolute top-1 left-1 flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-6 w-6 rounded-md bg-background/90 backdrop-blur-sm border-0 shadow-sm"
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
            variant="secondary"
            size="icon"
            className="h-6 w-6 rounded-md bg-background/90 backdrop-blur-sm border-0 shadow-sm"
            onClick={(e) => {
              e.stopPropagation();
              onProductClick?.();
            }}
            aria-label="عرض التفاصيل"
          >
            <Eye className="h-3 w-3" />
          </Button>
        </div>
      </div>

      {/* Content - Compact */}
      <div className="p-1.5">
        <p className="text-[10px] font-semibold leading-tight line-clamp-1 text-foreground">{title}</p>

        <div className="mt-1 flex items-center justify-between gap-1">
          {priceIqd ? (
            <p className="text-[11px] font-bold text-primary tabular-nums">
              {priceIqd.toLocaleString()}
            </p>
          ) : (
            <p className="text-[8px] text-muted-foreground">تواصل</p>
          )}

          {merchantName && (
            <div className="flex items-center gap-0.5 min-w-0">
              <AvatarWithFrame
                imageUrl={merchantImageUrl}
                frameUrl={merchantFrameUrl}
                size="xs"
              />
              <span className="text-[8px] text-muted-foreground truncate max-w-[50px]">
                {merchantName}
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

const CommunityProductCard = memo(CommunityProductCardBase);
export default CommunityProductCard;
