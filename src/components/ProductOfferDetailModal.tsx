import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Gift, ShoppingCart, Loader2, Plus, Minus, Wallet, AlertCircle, ChevronLeft, ChevronRight } from "lucide-react";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductOffer {
  id: string;
  title_ar: string;
  description_ar?: string | null;
  image_url: string | null;
  images: string[] | null;
  price: number;
  currency: string;
  gift_tickets: number;
  stock_quantity: number | null;
}

interface ProductOfferDetailModalProps {
  offer: ProductOffer | null;
  isOpen: boolean;
  onClose: () => void;
  onPurchase: (offerId: string, quantity: number) => void;
  isPurchasing: boolean;
  walletBalance: number;
  isAuthenticated: boolean;
}

export default function ProductOfferDetailModal({
  offer,
  isOpen,
  onClose,
  onPurchase,
  isPurchasing,
  walletBalance,
  isAuthenticated,
}: ProductOfferDetailModalProps) {
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  if (!offer) return null;

  const images = offer.images && offer.images.length > 0 
    ? offer.images 
    : (offer.image_url ? [offer.image_url] : []);

  const isOutOfStock = offer.stock_quantity !== null && offer.stock_quantity <= 0;
  const maxQuantity = offer.stock_quantity !== null ? offer.stock_quantity : 99;
  
  const totalPrice = offer.price * quantity;
  const totalTickets = offer.gift_tickets * quantity;
  const canAfford = walletBalance >= totalPrice;

  const handleQuantityChange = (delta: number) => {
    setQuantity(prev => Math.max(1, Math.min(maxQuantity, prev + delta)));
  };

  const handleBuyClick = () => {
    if (!isAuthenticated) {
      return;
    }
    if (!canAfford) {
      return;
    }
    setShowConfirmDialog(true);
  };

  const handleConfirmPurchase = () => {
    onPurchase(offer.id, quantity);
    setShowConfirmDialog(false);
    setQuantity(1);
  };

  const handleClose = () => {
    setQuantity(1);
    setImageIndex(0);
    onClose();
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
        <DialogContent className="max-w-sm w-[95vw] p-0 overflow-hidden max-h-[90vh]" dir="rtl">
          <DialogHeader className="sr-only">
            <DialogTitle>{offer.title_ar}</DialogTitle>
            <DialogDescription>تفاصيل العرض</DialogDescription>
          </DialogHeader>

          {/* Product Image */}
          <div className="relative aspect-[4/3] bg-secondary">
            {images.length > 0 ? (
              <OptimizedImage
                src={images[imageIndex]}
                alt={offer.title_ar}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center">
                <ShoppingCart className="h-16 w-16 text-muted-foreground/50" />
              </div>
            )}

            {/* Gift Badge */}
            <Badge className="absolute top-3 right-3 bg-green-600 text-white gap-1.5 text-sm px-3 py-1.5">
              <Gift className="h-4 w-4" />
              +{offer.gift_tickets} تذكرة هدية
            </Badge>

            {/* Image Navigation */}
            {images.length > 1 && (
              <>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                  onClick={() => setImageIndex((imageIndex - 1 + images.length) % images.length)}
                >
                  <ChevronLeft className="h-5 w-5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/70 text-white h-8 w-8"
                  onClick={() => setImageIndex((imageIndex + 1) % images.length)}
                >
                  <ChevronRight className="h-5 w-5" />
                </Button>
                <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                  {images.map((_, idx) => (
                    <button
                      key={idx}
                      className={`w-2 h-2 rounded-full transition-colors ${idx === imageIndex ? 'bg-white' : 'bg-white/50'}`}
                      onClick={() => setImageIndex(idx)}
                    />
                  ))}
                </div>
              </>
            )}

            {/* Out of Stock Overlay */}
            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xl font-bold">نفذت الكمية</span>
              </div>
            )}
          </div>

          {/* Product Info */}
          <div className="p-3 space-y-3 overflow-y-auto max-h-[45vh]">
            <div>
              <h2 className="text-lg font-bold mb-0.5">{offer.title_ar}</h2>
              {offer.description_ar && (
                <p className="text-xs text-muted-foreground line-clamp-2">{offer.description_ar}</p>
              )}
            </div>

            {/* Price and Tickets */}
            <div className="flex items-center justify-between p-2 bg-secondary/50 rounded-lg">
              <div>
                <p className="text-xs text-muted-foreground">سعر الوحدة</p>
                <p className="text-lg font-bold text-primary">{offer.price.toLocaleString()} <span className="text-xs">{offer.currency}</span></p>
              </div>
              <div className="text-left">
                <p className="text-xs text-muted-foreground">تذاكر هدية</p>
                <p className="text-sm font-bold text-green-600 flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {offer.gift_tickets}
                </p>
              </div>
            </div>

            {/* Quantity Selector */}
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">الكمية</p>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1 || isOutOfStock}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-lg font-bold w-8 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-8 w-8"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxQuantity || isOutOfStock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
            </div>

            {/* Total Summary */}
            <div className="p-2 bg-primary/10 rounded-lg space-y-1">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">المجموع:</span>
                <span className="text-lg font-bold">{totalPrice.toLocaleString()} {offer.currency}</span>
              </div>
              <div className="flex justify-between items-center text-green-600 text-sm">
                <span>إجمالي التذاكر:</span>
                <span className="font-bold flex items-center gap-1">
                  <Gift className="h-3 w-3" />
                  {totalTickets} تذكرة
                </span>
              </div>
            </div>

            {/* Wallet Balance Warning */}
            {isAuthenticated && !canAfford && (
              <div className="flex items-center gap-2 p-2 bg-destructive/10 text-destructive rounded-lg text-xs">
                <AlertCircle className="h-3 w-3 flex-shrink-0" />
                <span>رصيد غير كافٍ ({walletBalance.toLocaleString()})</span>
              </div>
            )}

            {/* Buy Button */}
            <Button
              className="w-full gap-2"
              onClick={handleBuyClick}
              disabled={isPurchasing || isOutOfStock || (isAuthenticated && !canAfford)}
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {!isAuthenticated 
                    ? 'سجل دخول للشراء' 
                    : isOutOfStock 
                      ? 'نفذت الكمية' 
                      : !canAfford 
                        ? 'رصيد غير كافٍ' 
                        : 'شراء الآن'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              تأكيد عملية الشراء
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-right">
                <p>هل تريد تأكيد شراء المنتج التالي؟</p>
                
                <div className="p-4 bg-secondary/50 rounded-lg space-y-3">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">المنتج:</span>
                    <span className="font-bold text-foreground">{offer.title_ar}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">الكمية:</span>
                    <span className="font-bold text-foreground">{quantity}</span>
                  </div>
                  <div className="flex justify-between border-t border-border pt-2">
                    <span className="text-muted-foreground">المبلغ الإجمالي:</span>
                    <span className="font-bold text-lg text-primary">{totalPrice.toLocaleString()} {offer.currency}</span>
                  </div>
                  <div className="flex justify-between text-green-600">
                    <span>تذاكر هدية:</span>
                    <span className="font-bold flex items-center gap-1">
                      <Gift className="h-4 w-4" />
                      {totalTickets} تذكرة
                    </span>
                  </div>
                </div>

                <p className="text-sm text-muted-foreground">
                  سيتم خصم المبلغ من رصيد محفظتك
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={handleConfirmPurchase}
              disabled={isPurchasing}
              className="gap-2"
            >
              {isPurchasing && <Loader2 className="h-4 w-4 animate-spin" />}
              تأكيد الشراء
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
