import { memo } from "react";
import { MessageCircle, Store } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
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
    <Card
      className="border-border bg-card overflow-hidden group w-full min-w-0"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <div className="relative aspect-square bg-muted/20">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt={title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Store className="h-10 w-10 text-muted-foreground" />
          </div>
        )}

        {/* Icon actions */}
        <div className="absolute top-2 left-2 flex items-center gap-2">
          <Button
            type="button"
            variant="secondary"
            size="icon"
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border shadow-sm"
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
            className="h-9 w-9 rounded-full bg-background/80 backdrop-blur border border-border shadow-sm"
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

      <CardContent className="p-3 sm:p-3">
        <p className="text-sm font-bold leading-snug line-clamp-1">{title}</p>

        <div className="mt-1 flex items-center justify-between gap-2">
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
                  className="h-5 w-5 rounded-full object-cover border border-border"
                />
              ) : (
                <div className="h-5 w-5 rounded-full bg-muted border border-border" />
              )}
              <span className="text-[11px] text-muted-foreground truncate max-w-[80px] sm:max-w-[100px]" title={merchantName}>
                {merchantName.length > 15 ? `${merchantName.slice(0, 15)}...` : merchantName}
              </span>
            </div>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

const CommunityProductCard = memo(CommunityProductCardBase);
export default CommunityProductCard;
