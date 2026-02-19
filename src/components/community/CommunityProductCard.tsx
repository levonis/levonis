import { memo } from "react";
import { MessageCircle, Store, ShoppingCart } from "lucide-react";

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
  /** Contact the merchant */
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
  onContact,
}: Props) {
  return (
    <div
      className="levo-card-frame group w-full min-w-0 cursor-pointer overflow-hidden"
      role="button"
      tabIndex={0}
      onClick={onProductClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onProductClick?.();
      }}
    >
      {/* Image */}
      <div className="relative aspect-[4/3] bg-gradient-to-b from-muted/5 to-muted/15">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="levo-icon-frame h-10 w-10">
              <Store className="h-5 w-5 text-primary/60" />
            </div>
          </div>
        )}

        {/* Action buttons - compact */}
        <div className="absolute top-1.5 left-1.5 flex items-center gap-1">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="levo-action-frame h-7 w-7 border-0"
            onClick={(e) => {
              e.stopPropagation();
              onOpenStore();
            }}
            aria-label="زيارة المتجر"
            title="زيارة المتجر"
          >
            <Store className="h-3 w-3" />
          </Button>

          {onContact && (
            <Button
              type="button"
              variant="secondary"
              size="icon"
              className="levo-action-frame h-7 w-7 border-0"
              onClick={(e) => {
                e.stopPropagation();
                onContact();
              }}
              aria-label="تواصل مع التاجر"
              title="تواصل مع التاجر"
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>

      {/* Content - compact */}
      <div className="p-2">
        <p className="text-xs font-bold leading-tight line-clamp-1">{title}</p>

        <div className="mt-1.5 flex items-center justify-between gap-1">
          {priceIqd ? (
            <p className="text-xs font-extrabold text-primary tabular-nums">
              {priceIqd.toLocaleString()} د.ع
            </p>
          ) : (
            <p className="text-[10px] text-muted-foreground">تواصل للسعر</p>
          )}

          {merchantName ? (
            <div className="flex items-center gap-1 min-w-0">
              <AvatarWithFrame
                imageUrl={merchantImageUrl}
                frameUrl={merchantFrameUrl}
                size="xs"
              />
              <span className="text-[10px] text-muted-foreground truncate max-w-[60px]" title={merchantName}>
                {merchantName}
              </span>
            </div>
          ) : null}
        </div>

        {/* Order Button */}
        <div className="mt-1.5 flex gap-1" onClick={(e) => e.stopPropagation()}>
          <Button
            type="button"
            size="sm"
            className="flex-1 h-7 text-[10px] gap-1 font-bold"
            onClick={onContact}
          >
            <ShoppingCart className="h-3 w-3" />
            اطلب
          </Button>
          {onContact && (
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-7 w-7"
              onClick={onContact}
            >
              <MessageCircle className="h-3 w-3" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}

const CommunityProductCard = memo(CommunityProductCardBase);
export default CommunityProductCard;
