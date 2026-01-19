import { Badge } from '@/components/ui/badge';
import { Coins, CreditCard, Crown, TrendingUp } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface CardDiscount {
  level_id: string;
  discount_amount: number;
}

interface LoyaltyLevel {
  id: string;
  name_ar: string;
  color: string;
  display_order: number;
}

interface ProductRewardsSectionProps {
  pointsReward: number;
  cardDiscounts: CardDiscount[];
  loyaltyLevels: LoyaltyLevel[];
  userHasCard?: boolean;
  userCardLevelId?: string;
  userCardLevelOrder?: number;
  productPrice: number;
  currency: string;
}

const ProductRewardsSection = ({
  pointsReward,
  cardDiscounts,
  loyaltyLevels,
  userHasCard,
  userCardLevelId,
  userCardLevelOrder,
  productPrice,
  currency
}: ProductRewardsSectionProps) => {
  const levelMap = new Map(loyaltyLevels.map(l => [l.id, l]));
  
  const validDiscounts = cardDiscounts
    .filter(d => d.level_id && d.discount_amount > 0 && levelMap.has(d.level_id))
    .map(d => {
      const level = levelMap.get(d.level_id)!;
      const percentage = productPrice > 0 ? (d.discount_amount / productPrice) * 100 : 0;
      return {
        ...d,
        level,
        displayPercentage: Math.round(percentage * 10) / 10
      };
    })
    .sort((a, b) => a.level.display_order - b.level.display_order);

  const qualifyingDiscounts = validDiscounts.filter(d => 
    userHasCard && 
    userCardLevelOrder !== undefined &&
    userCardLevelOrder >= d.level.display_order
  );
  
  const bestUserDiscount = qualifyingDiscounts.length > 0 
    ? qualifyingDiscounts.reduce((best, curr) => curr.discount_amount > best.discount_amount ? curr : best)
    : null;

  const discountedPrice = bestUserDiscount 
    ? productPrice - bestUserDiscount.discount_amount
    : null;

  if (pointsReward <= 0 && validDiscounts.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1.5">
      {/* Points Reward */}
      {pointsReward > 0 && (
        <Badge 
          variant="secondary" 
          className="gap-1 px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary border-primary/15 hover:bg-primary/12"
        >
          <Coins className="h-3 w-3" />
          +{pointsReward.toLocaleString()}
        </Badge>
      )}

      {/* User's Qualifying Discount */}
      {bestUserDiscount && discountedPrice !== null && discountedPrice > 0 && (
        <Badge 
          variant="secondary"
          className="gap-1 px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
        >
          <CreditCard className="h-3 w-3" />
          -{bestUserDiscount.displayPercentage}%
        </Badge>
      )}

      {/* Card Discounts Promotion for non-cardholders */}
      {validDiscounts.length > 0 && !userHasCard && (
        <Badge 
          variant="outline"
          className="gap-1 px-2 py-0.5 text-[11px] font-normal text-muted-foreground border-dashed"
        >
          <Crown className="h-3 w-3" />
          حتى {Math.max(...validDiscounts.map(d => d.displayPercentage))}% للأعضاء
        </Badge>
      )}

      {/* Upgrade hints for cardholders */}
      {userHasCard && validDiscounts.filter(d => 
        userCardLevelOrder !== undefined && d.level.display_order > userCardLevelOrder
      ).length > 0 && (
        <Badge 
          variant="outline"
          className="gap-1 px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
        >
          <TrendingUp className="h-3 w-3" />
          ترقية = خصم أكبر
        </Badge>
      )}
    </div>
  );
};

export default ProductRewardsSection;
