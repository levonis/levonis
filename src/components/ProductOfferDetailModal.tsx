import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Gift, ShoppingCart, Loader2, Plus, Minus, Wallet, AlertCircle, X } from "lucide-react";
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
    if (!isAuthenticated || !canAfford) return;
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
        <DialogContent className="w-[280px] max-w-[85vw] p-0 overflow-hidden rounded-lg" dir="rtl" hideClose>
          <DialogHeader className="sr-only">
            <DialogTitle>{offer.title_ar}</DialogTitle>
            <DialogDescription>تفاصيل العرض</DialogDescription>
          </DialogHeader>

          {/* Close Button - Custom */}
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1 left-1 z-10 h-7 w-7 rounded-full bg-black/50 hover:bg-black/70 text-white"
            onClick={handleClose}
          >
            <X className="h-4 w-4" />
          </Button>

          {/* Product Image - 3:2 ratio for better fit */}
          <div 
            className="relative aspect-[3/2] bg-white"
            onClick={() => images.length > 1 && setImageIndex((prev) => (prev + 1) % images.length)}
          >
            {images.length > 0 ? (
              <OptimizedImage
                src={images[imageIndex]}
                alt={offer.title_ar}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-secondary">
                <ShoppingCart className="h-8 w-8 text-muted-foreground/50" />
              </div>
            )}

            {/* Gift Badge */}
            <Badge className="absolute top-1 right-1 bg-green-600 text-white gap-0.5 text-[9px] px-1.5 py-0.5">
              <Gift className="h-2.5 w-2.5" />
              +{offer.gift_tickets}
            </Badge>

            {/* Image dots */}
            {images.length > 1 && (
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, idx) => (
                  <span 
                    key={idx} 
                    className={`w-1 h-1 rounded-full ${idx === imageIndex ? 'bg-primary' : 'bg-primary/30'}`} 
                  />
                ))}
              </div>
            )}

            {isOutOfStock && (
              <div className="absolute inset-0 bg-black/60 flex items-center justify-center">
                <span className="text-white text-xs font-bold">نفذت الكمية</span>
              </div>
            )}
          </div>

          {/* Product Info - Compact */}
          <div className="p-3 space-y-2.5">
            <h2 className="text-sm font-bold line-clamp-1">{offer.title_ar}</h2>

            {/* Price Row */}
            <div className="flex items-center justify-between text-sm">
              <span className="font-bold text-primary text-base">{offer.price.toLocaleString()} {offer.currency}</span>
              <span className="text-green-600 text-xs flex items-center gap-0.5">
                <Gift className="h-3 w-3" />
                {offer.gift_tickets} تذكرة
              </span>
            </div>

            {/* Quantity + Total Row */}
            <div className="flex items-center justify-between gap-2 p-2 bg-secondary/50 rounded-lg">
              <div className="flex items-center gap-1.5">
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleQuantityChange(-1)}
                  disabled={quantity <= 1 || isOutOfStock}
                >
                  <Minus className="h-3 w-3" />
                </Button>
                <span className="text-sm font-bold w-6 text-center">{quantity}</span>
                <Button
                  variant="outline"
                  size="icon"
                  className="h-6 w-6"
                  onClick={() => handleQuantityChange(1)}
                  disabled={quantity >= maxQuantity || isOutOfStock}
                >
                  <Plus className="h-3 w-3" />
                </Button>
              </div>
              <div className="text-left">
                <p className="text-[10px] text-muted-foreground">المجموع</p>
                <p className="text-sm font-bold">{totalPrice.toLocaleString()}</p>
              </div>
            </div>

            {/* Warning */}
            {isAuthenticated && !canAfford && (
              <div className="flex items-center gap-1.5 text-destructive text-[11px]">
                <AlertCircle className="h-3 w-3" />
                <span>رصيد غير كافٍ</span>
              </div>
            )}

            {/* Buy Button */}
            <Button
              className="w-full gap-1.5 h-9 text-sm"
              onClick={handleBuyClick}
              disabled={isPurchasing || isOutOfStock || (isAuthenticated && !canAfford)}
            >
              {isPurchasing ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <Wallet className="h-4 w-4" />
                  {!isAuthenticated ? 'سجل دخول' : isOutOfStock ? 'نفذت' : !canAfford ? 'رصيد غير كافٍ' : 'شراء'}
                </>
              )}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Confirmation Dialog - Compact */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent dir="rtl" className="max-w-[300px]">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-base">تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-right text-sm">
                <div className="p-2 bg-secondary/50 rounded-lg space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span>{offer.title_ar}</span>
                    <span>×{quantity}</span>
                  </div>
                  <div className="flex justify-between font-bold">
                    <span>المجموع:</span>
                    <span className="text-primary">{totalPrice.toLocaleString()} {offer.currency}</span>
                  </div>
                  <div className="flex justify-between text-green-600 text-xs">
                    <span>تذاكر هدية:</span>
                    <span>{totalTickets}</span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={handleConfirmPurchase} disabled={isPurchasing} className="h-8 text-sm">
              {isPurchasing && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              تأكيد
            </AlertDialogAction>
            <AlertDialogCancel className="h-8 text-sm">إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
