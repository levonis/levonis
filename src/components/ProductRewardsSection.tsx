import { Badge } from '@/components/ui/badge';
import { Coins, CreditCard, Crown, TrendingUp } from 'lucide-react';
import { useLanguage } from '@/lib/i18n';

interface CardDiscount {
  card_id?: string;
  level_id?: string;
  discount_amount: number;
}

interface MembershipCard {
  id: string;
  name_ar: string;
  name_en?: string | null;
  card_key?: string | null;
  color?: string | null;
  card_color?: string | null;
  display_order: number;
}

interface ProductRewardsSectionProps {
  pointsReward: number;
  cardDiscounts: CardDiscount[];
  loyaltyLevels: MembershipCard[]; // now membership cards (kept name for compat)
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
  userCardLevelOrder,
  productPrice,
}: ProductRewardsSectionProps) => {
  const { t } = useLanguage();
  const cardMap = new Map(loyaltyLevels.map(l => [l.id, l]));

  const validDiscounts = cardDiscounts
    .map(d => ({ ...d, _id: d.card_id || d.level_id || '' }))
    .filter(d => d._id && d.discount_amount > 0 && cardMap.has(d._id))
    .map(d => {
      const card = cardMap.get(d._id)!;
      const percentage = productPrice > 0 ? (d.discount_amount / productPrice) * 100 : 0;
      return {
        ...d,
        card,
        displayPercentage: Math.round(percentage * 10) / 10,
      };
    })
    .sort((a, b) => a.card.display_order - b.card.display_order);

  const qualifyingDiscounts = validDiscounts.filter(d =>
    userHasCard &&
    userCardLevelOrder !== undefined &&
    userCardLevelOrder >= d.card.display_order
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
      {pointsReward > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 px-2 py-0.5 text-[11px] font-medium bg-primary/8 text-primary border-primary/15 hover:bg-primary/12"
        >
          <Coins className="h-3 w-3" />
          +{pointsReward.toLocaleString()}
        </Badge>
      )}

      {bestUserDiscount && discountedPrice !== null && discountedPrice > 0 && (
        <Badge
          variant="secondary"
          className="gap-1 px-2 py-0.5 text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/15"
        >
          <CreditCard className="h-3 w-3" />
          {bestUserDiscount.card.name_ar} -{bestUserDiscount.displayPercentage}%
        </Badge>
      )}

      {validDiscounts.length > 0 && !userHasCard && (
        <Badge
          variant="outline"
          className="gap-1 px-2 py-0.5 text-[11px] font-normal text-muted-foreground border-dashed"
        >
          <Crown className="h-3 w-3" />
          {t('product_card_discount_up_to', { n: Math.max(...validDiscounts.map(d => d.displayPercentage)) })}
        </Badge>
      )}

      {userHasCard && validDiscounts.filter(d =>
        userCardLevelOrder !== undefined && d.card.display_order > userCardLevelOrder
      ).length > 0 && (
        <Badge
          variant="outline"
          className="gap-1 px-2 py-0.5 text-[11px] font-normal text-muted-foreground"
        >
          <TrendingUp className="h-3 w-3" />
          {t('product_card_upgrade_bigger')}
        </Badge>
      )}
    </div>
  );
};

export default ProductRewardsSection;
