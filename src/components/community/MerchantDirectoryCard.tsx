import { memo } from "react";
import { MessageCircle, Settings, Star, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";
import { BadgeTier, BADGE_TIER_LABELS } from "./MerchantBadges";
import { BadgeCheck, Crown, Diamond, Gem, Medal, Sparkles } from "lucide-react";

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

// Compact inline badge component
function CompactBadge({ tier, isVerified }: { tier: BadgeTier; isVerified: boolean }) {
  const getBadgeConfig = (t: BadgeTier) => {
    switch (t) {
      case "silver":
        return { icon: Medal, color: "text-slate-500", bg: "bg-slate-500/15" };
      case "gold":
        return { icon: Crown, color: "text-amber-600", bg: "bg-amber-500/15" };
      case "diamond_1":
      case "diamond_2":
      case "diamond_3":
      case "diamond_4":
        return { icon: Diamond, color: "text-sky-600", bg: "bg-sky-500/15" };
      case "emerald":
        return { icon: Gem, color: "text-emerald-600", bg: "bg-emerald-500/15", glow: true };
      default:
        return null;
    }
  };

  const config = getBadgeConfig(tier);

  return (
    <div className="flex items-center gap-0.5">
      {isVerified && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="inline-flex">
              <BadgeCheck className="h-3.5 w-3.5 text-amber-600 fill-amber-100" />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            تاجر موثوق
          </TooltipContent>
        </Tooltip>
      )}
      {config && (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className={`inline-flex items-center justify-center h-4 w-4 rounded-full ${config.bg} ${config.glow ? "animate-pulse" : ""}`}>
              <config.icon className={`h-2.5 w-2.5 ${config.color}`} />
            </span>
          </TooltipTrigger>
          <TooltipContent side="top" className="text-xs">
            {BADGE_TIER_LABELS[tier]}
          </TooltipContent>
        </Tooltip>
      )}
    </div>
  );
}

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
  const hasBadge = isVerified || badgeTier !== "none";

  return (
    <div
      className="levo-card-frame group w-full min-w-0 cursor-pointer hover:shadow-lg transition-shadow"
      role="button"
      tabIndex={0}
      onClick={onOpenStore}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onOpenStore();
      }}
    >
      <div className="p-4">
        <div className="flex flex-col items-center text-center gap-3">
          {/* Centered Avatar with Frame */}
          <div className="relative">
            <AvatarWithFrame
              imageUrl={storeImageUrl}
              frameUrl={storeFrameUrl}
              size="md"
              animated={!!storeFrameUrl}
            />
            {featured && (
              <span className="absolute -top-1 -right-1 inline-flex items-center gap-0.5 rounded-full bg-primary px-1.5 py-0.5 text-[9px] font-bold text-primary-foreground shadow-sm">
                <Sparkles className="h-2.5 w-2.5" />
                مميز
              </span>
            )}
          </div>

          {/* Name + Badges centered */}
          <div className="space-y-1">
            <div className="flex items-center justify-center gap-1.5">
              <h3 className="text-sm font-bold leading-tight line-clamp-1" title={displayName}>
                {displayName}
              </h3>
              {hasBadge && <CompactBadge tier={badgeTier} isVerified={isVerified} />}
            </div>
            
            {/* Rating */}
            <div className="flex items-center justify-center gap-1">
              <Star className="h-3 w-3 fill-amber-500 text-amber-500" />
              <span className="text-xs font-semibold tabular-nums">{hasRatings ? avg.toFixed(1) : "0.0"}</span>
              <span className="text-[10px] text-muted-foreground">({stats?.total_ratings || 0})</span>
            </div>
          </div>

          {/* Featured product thumbs */}
          {featuredProducts.length > 0 && (
            <div className="flex items-center justify-center gap-1.5 mt-1">
              {featuredProducts.slice(0, 3).map((p) => {
                const mainImg = p.image_urls?.[p.primary_image_index] || p.image_urls?.[0] || null;
                return (
                  <div
                    key={p.id}
                    className="h-10 w-10 rounded-lg overflow-hidden border border-border/50 bg-muted/20"
                    title={p.title}
                  >
                    {mainImg ? (
                      <img
                        src={mainImg}
                        alt={p.title}
                        loading="lazy"
                        className="h-full w-full object-cover"
                      />
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

          {/* Actions */}
          <div className="flex items-center justify-center gap-2 mt-2">
            {isAdmin && onAdminManage && (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="h-8 w-8 rounded-full"
                onClick={(e) => {
                  e.stopPropagation();
                  onAdminManage();
                }}
                aria-label="إدارة التجار"
                title="إدارة التجار"
              >
                <Settings className="h-3.5 w-3.5" />
              </Button>
            )}

            <Button
              type="button"
              variant="default"
              size="sm"
              className="h-8 px-3 rounded-full text-xs font-semibold"
              onClick={(e) => {
                e.stopPropagation();
                onOpenStore();
              }}
            >
              <Store className="h-3.5 w-3.5 ml-1" />
              زيارة
            </Button>

            <Button
              type="button"
              variant="outline"
              size="icon"
              className="h-8 w-8 rounded-full"
              disabled={!onContact}
              onClick={(e) => {
                e.stopPropagation();
                onContact?.();
              }}
              aria-label="تواصل"
              title="تواصل"
            >
              <MessageCircle className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

const MerchantDirectoryCard = memo(MerchantDirectoryCardBase);
export default MerchantDirectoryCard;
