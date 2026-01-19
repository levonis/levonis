import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Coins, CreditCard, Sparkles, Gift } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface CardDiscount {
  level_id: string;
  discount_amount: number; // Amount in IQD
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
  // Build a map of level_id to level info
  const levelMap = new Map(loyaltyLevels.map(l => [l.id, l]));
  
  // Filter valid discounts and get level info (discount_amount > 0)
  const validDiscounts = cardDiscounts
    .filter(d => d.level_id && d.discount_amount > 0 && levelMap.has(d.level_id))
    .map(d => {
      const level = levelMap.get(d.level_id)!;
      // Calculate percentage for display
      const percentage = productPrice > 0 ? (d.discount_amount / productPrice) * 100 : 0;
      return {
        ...d,
        level,
        displayPercentage: Math.round(percentage * 10) / 10 // Round to 1 decimal
      };
    })
    .sort((a, b) => a.level.display_order - b.level.display_order);

  // Find the best discount the user qualifies for
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
    <Card className="overflow-hidden border-primary/20 bg-gradient-to-br from-primary/5 to-accent/5">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center gap-2 text-sm font-semibold text-primary">
          <Gift className="h-4 w-4" />
          <span>مكافآت المنتج</span>
        </div>
        
        <div className="space-y-2">
          {/* Points Reward */}
          {pointsReward > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-amber-500/10 to-yellow-500/10 border border-amber-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-amber-400 to-yellow-500 flex items-center justify-center shadow-sm">
                  <Coins className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-medium text-sm">نقاط المكافأة</span>
                  <p className="text-xs text-muted-foreground">تُضاف عند شراء المنتج</p>
                </div>
              </div>
              <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white border-0 text-sm px-3 py-1">
                +{pointsReward.toLocaleString()} نقطة
              </Badge>
            </div>
          )}

          {/* User's Qualifying Discount - Show discounted price */}
          {bestUserDiscount && discountedPrice !== null && discountedPrice > 0 && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-emerald-500/10 to-green-500/10 border border-emerald-500/20">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-400 to-green-500 flex items-center justify-center shadow-sm">
                  <CreditCard className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-medium text-sm">خصم البطاقة</span>
                  <p className="text-xs text-emerald-600 font-medium">
                    سعرك: {formatPrice(discountedPrice)} {currency}
                  </p>
                </div>
              </div>
              <div className="text-left">
                <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-sm px-3 py-1">
                  خصم {bestUserDiscount.displayPercentage}%
                </Badge>
                <p className="text-xs text-muted-foreground mt-1">
                  وفرت {formatPrice(bestUserDiscount.discount_amount)} {currency}
                </p>
              </div>
            </div>
          )}

          {/* Card Discounts Promotion - Show for non-cardholders as note only */}
          {validDiscounts.length > 0 && !userHasCard && (
            <div className="p-2.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 border-dashed">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-400 to-indigo-500 flex items-center justify-center shadow-sm">
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-medium text-sm">خصومات حصرية لحاملي البطاقات</span>
                  <p className="text-xs text-muted-foreground">احصل على بطاقة للحصول على خصم</p>
                </div>
              </div>
              <div className="flex flex-wrap gap-2 mt-2">
                {validDiscounts.map((discount, index) => (
                  <Badge 
                    key={index}
                    variant="outline" 
                    className="text-xs px-2 py-1"
                    style={{ 
                      borderColor: discount.level.color + '50',
                      color: discount.level.color 
                    }}
                  >
                    {discount.level.name_ar}: خصم {discount.displayPercentage}%
                  </Badge>
                ))}
              </div>
            </div>
          )}

          {/* Show other available discounts for cardholders who might upgrade */}
          {userHasCard && validDiscounts.length > 0 && (
            <>
              {validDiscounts.filter(d => 
                userCardLevelOrder !== undefined && d.level.display_order > userCardLevelOrder
              ).length > 0 && (
                <div className="p-2.5 rounded-lg bg-muted/50 border border-border/50">
                  <p className="text-xs text-muted-foreground mb-2">خصومات إضافية عند ترقية البطاقة:</p>
                  <div className="flex flex-wrap gap-2">
                    {validDiscounts
                      .filter(d => userCardLevelOrder !== undefined && d.level.display_order > userCardLevelOrder)
                      .map((discount, index) => (
                        <Badge 
                          key={index}
                          variant="outline" 
                          className="text-xs px-2 py-1"
                          style={{ 
                            borderColor: discount.level.color + '50',
                            color: discount.level.color 
                          }}
                        >
                          {discount.level.name_ar}: خصم {discount.displayPercentage}%
                        </Badge>
                      ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductRewardsSection;
