import { Badge } from '@/components/ui/badge';
import { Coins, CreditCard, Sparkles } from 'lucide-react';
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
    <div className="flex flex-wrap items-center gap-2">
      {/* Points Reward - Compact Badge */}
      {pointsReward > 0 && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-amber-50 dark:bg-amber-950/30 border border-amber-200/60 dark:border-amber-800/40">
          <Coins className="h-3.5 w-3.5 text-amber-600 dark:text-amber-400" />
          <span className="text-xs font-medium text-amber-700 dark:text-amber-300">
            +{pointsReward.toLocaleString()} نقطة
          </span>
        </div>
      )}

      {/* User's Qualifying Discount */}
      {bestUserDiscount && discountedPrice !== null && discountedPrice > 0 && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200/60 dark:border-emerald-800/40">
          <CreditCard className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
          <span className="text-xs font-medium text-emerald-700 dark:text-emerald-300">
            خصم {bestUserDiscount.displayPercentage}% • {formatPrice(discountedPrice)} {currency}
          </span>
        </div>
      )}

      {/* Card Discounts Promotion for non-cardholders */}
      {validDiscounts.length > 0 && !userHasCard && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50 border-dashed">
          <Sparkles className="h-3.5 w-3.5 text-slate-500 dark:text-slate-400" />
          <span className="text-xs text-slate-600 dark:text-slate-400">
            خصم حتى {Math.max(...validDiscounts.map(d => d.displayPercentage))}% لحاملي البطاقات
          </span>
        </div>
      )}

      {/* Upgrade hints for cardholders */}
      {userHasCard && validDiscounts.filter(d => 
        userCardLevelOrder !== undefined && d.level.display_order > userCardLevelOrder
      ).length > 0 && (
        <div className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-slate-50 dark:bg-slate-800/50 border border-slate-200/60 dark:border-slate-700/50">
          <Sparkles className="h-3 w-3 text-slate-400" />
          <span className="text-[11px] text-slate-500 dark:text-slate-400">
            خصم أكبر عند الترقية
          </span>
        </div>
      )}
    </div>
  );
};

export default ProductRewardsSection;
