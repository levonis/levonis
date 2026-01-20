import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { AlertTriangle, CheckCircle2, Package, Truck, Calculator, Percent, DollarSign } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import type { CostBreakdown, BreakdownItem } from '@/lib/stores/costEngine';

interface CostBreakdownCardProps {
  breakdown: CostBreakdown;
  productName?: string;
  showDetails?: boolean;
}

const getItemIcon = (type: BreakdownItem['type']) => {
  switch (type) {
    case 'price':
      return <Package className="w-4 h-4" />;
    case 'shipping':
      return <Truck className="w-4 h-4" />;
    case 'tax':
      return <Percent className="w-4 h-4" />;
    case 'commission':
      return <Calculator className="w-4 h-4" />;
    case 'total':
      return <DollarSign className="w-4 h-4" />;
    default:
      return null;
  }
};

export default function CostBreakdownCard({ 
  breakdown, 
  productName,
  showDetails = true 
}: CostBreakdownCardProps) {
  const nonTotalItems = breakdown.breakdown.filter(item => item.type !== 'total');
  const totalItem = breakdown.breakdown.find(item => item.type === 'total');
  
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3 bg-gradient-to-r from-primary/5 to-primary/10">
        <div className="flex items-center justify-between">
          <CardTitle className="text-lg flex items-center gap-2">
            <Calculator className="w-5 h-5 text-primary" />
            تفاصيل التكلفة
          </CardTitle>
          <Badge 
            variant={breakdown.isEstimated ? "secondary" : "default"}
            className="gap-1"
          >
            {breakdown.isEstimated ? (
              <>
                <AlertTriangle className="w-3 h-3" />
                تقديري
              </>
            ) : (
              <>
                <CheckCircle2 className="w-3 h-3" />
                فعلي
              </>
            )}
          </Badge>
        </div>
        {productName && (
          <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{productName}</p>
        )}
      </CardHeader>
      
      <CardContent className="pt-4 space-y-4">
        {/* Breakdown Items */}
        {showDetails && (
          <div className="space-y-2">
            {nonTotalItems.map((item, index) => (
              <div 
                key={index}
                className="flex items-center justify-between py-2 px-3 rounded-lg bg-muted/30 hover:bg-muted/50 transition-colors"
              >
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">
                    {getItemIcon(item.type)}
                  </span>
                  <span className="text-sm font-medium">{item.labelAr}</span>
                  {item.isEstimated && (
                    <Badge variant="outline" className="text-xs h-5">تقديري</Badge>
                  )}
                </div>
                <div className="text-left">
                  <span className="font-bold">{formatPrice(item.valueIqd)}</span>
                  {item.valueUsd && (
                    <span className="text-xs text-muted-foreground block">
                      ${item.valueUsd.toFixed(2)}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
        
        <Separator />
        
        {/* Total */}
        {totalItem && (
          <div className="p-4 rounded-xl bg-gradient-to-r from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DollarSign className="w-5 h-5 text-primary" />
                <span className="font-bold text-lg">{totalItem.labelAr}</span>
              </div>
              <div className="text-left">
                <span className="text-2xl font-bold text-primary">
                  {formatPrice(totalItem.valueIqd)}
                </span>
                {totalItem.valueUsd && (
                  <span className="text-sm text-muted-foreground block">
                    ${totalItem.valueUsd.toFixed(2)} USD
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
        
        {/* Estimation Warning */}
        {breakdown.isEstimated && breakdown.estimationReasons && breakdown.estimationReasons.length > 0 && (
          <div className="flex items-start gap-2 p-3 rounded-lg bg-amber-500/10 border border-amber-500/20">
            <AlertTriangle className="w-4 h-4 text-amber-600 mt-0.5 shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-700 dark:text-amber-400">
                تنبيه: تكلفة تقديرية
              </p>
              <ul className="text-xs text-amber-600 dark:text-amber-500 list-disc list-inside">
                {breakdown.estimationReasons.map((reason, idx) => (
                  <li key={idx}>{reason}</li>
                ))}
              </ul>
            </div>
          </div>
        )}
        
        {/* Shipping Details */}
        {breakdown.shippingDetails && Object.keys(breakdown.shippingDetails).length > 0 && showDetails && (
          <div className="text-xs text-muted-foreground space-y-1 p-2 bg-muted/20 rounded-lg">
            {breakdown.shippingDetails.weightWithPackaging && (
              <div className="flex justify-between">
                <span>الوزن مع التغليف:</span>
                <span dir="ltr">{breakdown.shippingDetails.weightWithPackaging.toFixed(2)} kg</span>
              </div>
            )}
            {breakdown.shippingDetails.cbm && (
              <div className="flex justify-between">
                <span>الحجم:</span>
                <span dir="ltr">{breakdown.shippingDetails.cbm.toFixed(4)} CBM</span>
              </div>
            )}
            <div className="flex justify-between">
              <span>سعر الصرف:</span>
              <span dir="ltr">1 USD = {breakdown.exchangeRate.toLocaleString()} IQD</span>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
