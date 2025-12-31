import { memo, useState, useCallback } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { ShoppingCart, Gift, Ticket, ChevronLeft, ChevronRight, Package, Minus, Plus, Loader2, Info } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductCompetition {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  prize_description_ar: string;
  ticket_price: number;
  currency: string;
  gift_tickets_per_purchase: number;
  product_id: string | null;
  legal_disclaimer: string | null;
  status: 'active' | 'completed';
}

interface ProductShopCardProps {
  product: ProductCompetition;
  walletBalance: number;
  onPurchase: (productId: string, quantity: number) => void;
  isPurchasing: boolean;
  isAuthenticated: boolean;
}

const ProductShopCard = memo(({
  product,
  walletBalance,
  onPurchase,
  isPurchasing,
  isAuthenticated,
}: ProductShopCardProps) => {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [quantity, setQuantity] = useState(1);

  const images = product.images?.length ? product.images : (product.image_url ? [product.image_url] : []);
  const giftTickets = product.gift_tickets_per_purchase || 1;
  const totalCost = product.ticket_price * quantity;
  const totalGiftTickets = giftTickets * quantity;
  const canAfford = walletBalance >= totalCost;

  const navigateImage = useCallback((direction: 'next' | 'prev') => {
    if (direction === 'next') {
      setCurrentImageIndex(prev => (prev + 1) % images.length);
    } else {
      setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length);
    }
  }, [images.length]);

  const handlePurchase = () => {
    onPurchase(product.id, quantity);
    setShowPurchaseDialog(false);
    setQuantity(1);
  };

  return (
    <>
      <Card className="overflow-hidden group hover:shadow-lg transition-all duration-300">
        {/* Image Section */}
        <div className="relative aspect-square">
          {images.length > 0 ? (
            <OptimizedImage
              src={images[currentImageIndex]}
              alt={product.title_ar}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full bg-secondary flex items-center justify-center">
              <Package className="h-12 w-12 text-muted-foreground" />
            </div>
          )}

          {/* Image Navigation */}
          {images.length > 1 && (
            <>
              <Button
                variant="ghost"
                size="icon"
                className="absolute left-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); navigateImage('prev'); }}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 h-6 w-6 bg-black/50 hover:bg-black/70 text-white opacity-0 group-hover:opacity-100 transition-opacity"
                onClick={(e) => { e.stopPropagation(); navigateImage('next'); }}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
              <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, idx) => (
                  <div
                    key={idx}
                    className={`w-1.5 h-1.5 rounded-full transition-colors ${idx === currentImageIndex ? 'bg-white' : 'bg-white/50'}`}
                  />
                ))}
              </div>
            </>
          )}

          {/* Gift Badge */}
          <Badge className="absolute top-2 right-2 bg-gradient-to-r from-green-500 to-emerald-500 text-white border-0 gap-1">
            <Gift className="h-3 w-3" />
            +{giftTickets} تذكرة هدية
          </Badge>
        </div>

        {/* Content */}
        <CardContent className="p-3">
          <h3 className="font-semibold text-sm mb-1 line-clamp-2">{product.title_ar}</h3>
          
          {product.description_ar && (
            <p className="text-xs text-muted-foreground line-clamp-2 mb-2">{product.description_ar}</p>
          )}

          {/* Price */}
          <div className="flex items-center justify-between mb-3">
            <div>
              <span className="text-lg font-bold text-primary">{product.ticket_price.toLocaleString()}</span>
              <span className="text-xs text-muted-foreground mr-1">{product.currency}</span>
            </div>
          </div>

          {/* Purchase Button */}
          <Button 
            className="w-full gap-2"
            onClick={() => setShowPurchaseDialog(true)}
            disabled={isPurchasing || product.status !== 'active'}
          >
            <ShoppingCart className="h-4 w-4" />
            شراء المنتج
          </Button>

          {/* Legal Disclaimer */}
          <p className="text-[10px] text-muted-foreground text-center mt-2 flex items-center justify-center gap-1">
            <Info className="h-3 w-3" />
            التذاكر هدية مجانية مع الشراء
          </p>
        </CardContent>
      </Card>

      {/* Purchase Dialog */}
      <Dialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <ShoppingCart className="h-5 w-5 text-primary" />
              شراء المنتج
            </DialogTitle>
            <DialogDescription className="text-right">
              {product.title_ar}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Product Preview */}
            <div className="flex gap-3">
              {images[0] && (
                <img 
                  src={images[0]} 
                  alt={product.title_ar}
                  className="w-20 h-20 rounded-lg object-cover"
                />
              )}
              <div className="flex-1">
                <h4 className="font-medium text-sm">{product.title_ar}</h4>
                <p className="text-primary font-bold mt-1">{product.ticket_price.toLocaleString()} {product.currency}</p>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium">الكمية:</span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity(q => Math.max(1, q - 1))}
                  disabled={quantity <= 1}
                >
                  <Minus className="h-4 w-4" />
                </Button>
                <Input
                  type="number"
                  min={1}
                  value={quantity}
                  onChange={(e) => setQuantity(Math.max(1, parseInt(e.target.value) || 1))}
                  className="w-16 h-8 text-center"
                />
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => setQuantity(q => q + 1)}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </div>
            </div>

            {/* Summary */}
            <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
              <div className="flex justify-between text-sm">
                <span>إجمالي السعر:</span>
                <span className="font-bold text-primary">{totalCost.toLocaleString()} {product.currency}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="flex items-center gap-1">
                  <Gift className="h-4 w-4 text-green-500" />
                  التذاكر الهدية:
                </span>
                <span className="font-bold text-green-500">{totalGiftTickets} تذكرة</span>
              </div>
            </div>

            {/* Balance Check */}
            {!canAfford && (
              <div className="bg-destructive/10 text-destructive text-sm p-3 rounded-lg text-center">
                رصيد المحفظة غير كافٍ. تحتاج {(totalCost - walletBalance).toLocaleString()} {product.currency} إضافية.
              </div>
            )}

            {/* Legal Notice */}
            <div className="bg-green-50 dark:bg-green-950 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-xs text-green-700 dark:text-green-300 text-center">
                ⚖️ {product.legal_disclaimer || 'الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مع كل عملية شراء.'}
              </p>
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={handlePurchase}
              disabled={!isAuthenticated || !canAfford || isPurchasing}
              className="gap-2"
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingCart className="h-4 w-4" />
              )}
              تأكيد الشراء
            </Button>
            <Button variant="outline" onClick={() => setShowPurchaseDialog(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
});

ProductShopCard.displayName = "ProductShopCard";

export default ProductShopCard;
