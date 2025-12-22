import { memo } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Gift, Ticket, Sparkles, Zap } from "lucide-react";

interface TicketBundle {
  quantity: number;
  bonusTickets: number;
  price: number;
  competitionType?: string;
  label?: string;
  highlight?: boolean;
}

interface TicketBundleOfferProps {
  bundles: TicketBundle[];
  onSelectBundle: (bundle: TicketBundle) => void;
  walletBalance: number;
  isLoading?: boolean;
}

const TicketBundleOffer = memo(({ bundles, onSelectBundle, walletBalance, isLoading }: TicketBundleOfferProps) => {
  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2 text-sm font-medium text-muted-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        <span>عروض خاصة على التذاكر</span>
      </div>
      
      <div className="grid grid-cols-2 gap-3">
        {bundles.map((bundle, idx) => {
          const canAfford = walletBalance >= bundle.price;
          const totalTickets = bundle.quantity + bundle.bonusTickets;
          const savingsPercent = Math.round((bundle.bonusTickets / bundle.quantity) * 100);
          
          return (
            <Card 
              key={idx} 
              className={`relative overflow-hidden transition-all hover:shadow-md cursor-pointer ${
                bundle.highlight 
                  ? 'border-primary/50 bg-gradient-to-br from-primary/5 to-primary/10' 
                  : ''
              } ${!canAfford ? 'opacity-60' : ''}`}
              onClick={() => canAfford && !isLoading && onSelectBundle(bundle)}
            >
              {bundle.highlight && (
                <Badge className="absolute top-2 left-2 bg-primary text-primary-foreground text-xs px-2 py-0.5 gap-1">
                  <Zap className="h-3 w-3" />
                  الأفضل
                </Badge>
              )}
              
              {bundle.bonusTickets > 0 && (
                <Badge className="absolute top-2 right-2 bg-green-500 text-white text-xs px-2 py-0.5 gap-1">
                  <Gift className="h-3 w-3" />
                  +{bundle.bonusTickets} هدية
                </Badge>
              )}
              
              <CardContent className="p-4 pt-8 text-center space-y-2">
                <div className="flex items-center justify-center gap-1">
                  <Ticket className="h-5 w-5 text-primary" />
                  <span className="text-2xl font-bold">{totalTickets}</span>
                </div>
                
                <p className="text-xs text-muted-foreground">
                  {bundle.quantity} تذكرة {bundle.bonusTickets > 0 && `+ ${bundle.bonusTickets} هدية`}
                </p>
                
                {savingsPercent > 0 && (
                  <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600 border-0">
                    وفر {savingsPercent}%
                  </Badge>
                )}
                
                <div className="pt-2">
                  <span className="text-lg font-bold text-primary">
                    {bundle.price.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground mr-1">دينار</span>
                </div>
                
                {bundle.label && (
                  <p className="text-xs text-muted-foreground">{bundle.label}</p>
                )}
                
                <Button 
                  size="sm" 
                  className="w-full mt-2"
                  disabled={!canAfford || isLoading}
                >
                  {canAfford ? 'شراء' : 'رصيد غير كافٍ'}
                </Button>
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
});

TicketBundleOffer.displayName = "TicketBundleOffer";

export default TicketBundleOffer;
