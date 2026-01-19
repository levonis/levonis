import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { Coins, CreditCard, Sparkles, Gift } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

interface ProductRewardsSectionProps {
  pointsReward: number;
  cardDiscountPercentage: number;
  cardDiscountLevelName?: string;
  cardDiscountLevelColor?: string;
  cardDiscountLevelOrder?: number;
  userHasCard?: boolean;
  userCardLevel?: string;
  userCardLevelOrder?: number;
  productPrice: number;
  currency: string;
}

const ProductRewardsSection = ({
  pointsReward,
  cardDiscountPercentage,
  cardDiscountLevelName,
  cardDiscountLevelColor,
  cardDiscountLevelOrder,
  userHasCard,
  userCardLevel,
  userCardLevelOrder,
  productPrice,
  currency
}: ProductRewardsSectionProps) => {
  // Check if user qualifies for card discount based on card level order
  // User qualifies if they have a card with equal or higher order (higher order = better card)
  const qualifiesForDiscount = userHasCard && 
    cardDiscountPercentage > 0 && 
    userCardLevelOrder !== undefined && 
    cardDiscountLevelOrder !== undefined &&
    userCardLevelOrder >= cardDiscountLevelOrder;
    
  const discountedPrice = qualifiesForDiscount 
    ? productPrice * (1 - cardDiscountPercentage / 100) 
    : null;

  if (pointsReward <= 0 && cardDiscountPercentage <= 0) {
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

          {/* Card Discount - User has qualifying card */}
          {qualifiesForDiscount && discountedPrice && (
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
              <Badge className="bg-gradient-to-r from-emerald-500 to-green-500 text-white border-0 text-sm px-3 py-1">
                خصم {cardDiscountPercentage}%
              </Badge>
            </div>
          )}

          {/* Card Discount Promotion - User doesn't have card */}
          {cardDiscountPercentage > 0 && !userHasCard && cardDiscountLevelName && (
            <div className="flex items-center justify-between p-2.5 rounded-lg bg-gradient-to-r from-purple-500/10 to-indigo-500/10 border border-purple-500/20 border-dashed">
              <div className="flex items-center gap-2">
                <div 
                  className="w-8 h-8 rounded-full flex items-center justify-center shadow-sm"
                  style={{ 
                    background: `linear-gradient(135deg, ${cardDiscountLevelColor || '#8B5CF6'}, ${cardDiscountLevelColor || '#8B5CF6'}dd)` 
                  }}
                >
                  <Sparkles className="h-4 w-4 text-white" />
                </div>
                <div>
                  <span className="font-medium text-sm">عرض خاص لحاملي البطاقات</span>
                  <p className="text-xs text-muted-foreground">
                    احصل على بطاقة <span className="font-semibold" style={{ color: cardDiscountLevelColor }}>{cardDiscountLevelName}</span> للحصول على الخصم
                  </p>
                </div>
              </div>
              <Badge 
                variant="outline" 
                className="text-sm px-3 py-1 border-purple-500/30"
                style={{ color: cardDiscountLevelColor }}
              >
                خصم {cardDiscountPercentage}%
              </Badge>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export default ProductRewardsSection;
