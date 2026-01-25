import { memo } from "react";
import { MessageCircle, Store } from "lucide-react";

import { Button } from "@/components/ui/button";

type Props = {
  title: string;
  priceIqd?: number | null;
  imageUrl?: string | null;
  merchantName?: string;
  merchantImageUrl?: string | null;
  onOpenStore: () => void;
  /** Optional: if you already have a chat action elsewhere */
  onContact?: () => void;
};

function CommunityProductCardBase({
  title,
  priceIqd,
  imageUrl,
  merchantName,
  merchantImageUrl,
  onOpenStore,
  onContact,
}: Props) {
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
      {/* Image */}
      <div className="relative aspect-square bg-muted/10">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="levo-icon-frame h-14 w-14">
              <Store className="h-7 w-7 text-primary/60" />
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="levo-action-frame h-9 w-9 border-0"
            onClick={(e) => {
              e.stopPropagation();
              onOpenStore();
            }}
            aria-label="زيارة المتجر"
            title="زيارة المتجر"
          >
            <Store className="h-4 w-4" />
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="levo-action-frame h-9 w-9 border-0"
            disabled={!onContact}
            onClick={(e) => {
              e.stopPropagation();
              onContact?.();
            }}
            aria-label="تواصل"
            title="تواصل"
          >
            <MessageCircle className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className="p-3">
        <p className="text-sm font-bold leading-snug line-clamp-1">{title}</p>

        <div className="mt-2 flex items-center justify-between gap-2">
          {priceIqd ? (
            <p className="text-sm font-extrabold text-primary tabular-nums">
              {priceIqd.toLocaleString()} د.ع
            </p>
          ) : (
            <p className="text-xs text-muted-foreground">السعر عند التواصل</p>
          )}

          {merchantName ? (
            <div className="flex items-center gap-1.5 min-w-0">
              {merchantImageUrl ? (
                <img
                  src={merchantImageUrl}
                  alt={merchantName}
                  loading="lazy"
                  className="h-5 w-5 rounded-full object-cover border border-primary/20"
                />
              ) : (
                <div className="levo-icon-frame h-5 w-5 rounded-full">
                  <Store className="h-2.5 w-2.5 text-primary/60" />
                </div>
              )}
              <span className="text-[11px] text-muted-foreground truncate max-w-[80px]" title={merchantName}>
                {merchantName}
              </span>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

const CommunityProductCard = memo(CommunityProductCardBase);
export default CommunityProductCard;
