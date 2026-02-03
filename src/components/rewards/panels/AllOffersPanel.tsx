import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import OptimizedImage from "@/components/OptimizedImage";
import { toast } from "sonner";
import { X, Ticket, Gift, Loader2, ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus, Flame, Star } from "lucide-react";

const PAGE_SIZE = 10;

export default function AllOffersPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const observerRef = useRef<IntersectionObserver | null>(null);
  const loadMoreRef = useRef<HTMLDivElement>(null);

  const {
    data,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
    isLoading,
  } = useInfiniteQuery({
    queryKey: ['all-product-offers-panel-infinite'],
    queryFn: async ({ pageParam = 0 }) => {
      const from = pageParam * PAGE_SIZE;
      const to = from + PAGE_SIZE - 1;
      
      const { data, error } = await supabase
        .from('product_offers')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false })
        .range(from, to);
      
      if (error) throw error;
      return data;
    },
    getNextPageParam: (lastPage, allPages) => {
      if (lastPage.length < PAGE_SIZE) return undefined;
      return allPages.length;
    },
    initialPageParam: 0,
    staleTime: 2 * 60 * 1000,
  });

  useEffect(() => {
    if (observerRef.current) observerRef.current.disconnect();
    
    observerRef.current = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasNextPage && !isFetchingNextPage) {
          fetchNextPage();
        }
      },
      { threshold: 0.1 }
    );
    
    if (loadMoreRef.current) {
      observerRef.current.observe(loadMoreRef.current);
    }
    
    return () => {
      if (observerRef.current) observerRef.current.disconnect();
    };
  }, [hasNextPage, isFetchingNextPage, fetchNextPage]);

  const purchaseMutation = useMutation({
    mutationFn: async ({ offer, qty }: { offer: any; qty: number }) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const totalPrice = offer.price * qty;
      
      if (offer.stock_quantity !== null && offer.stock_quantity < qty) {
        throw new Error('الكمية المطلوبة غير متوفرة');
      }

      const { error: purchaseError } = await supabase
        .from('product_offer_purchases')
        .insert({
          user_id: user.id,
          offer_id: offer.id,
          quantity: qty,
          unit_price: offer.price,
          total_price: totalPrice,
          gift_tickets_awarded: (offer.gift_tickets || 0) * qty,
        });
      if (purchaseError) throw purchaseError;

      if (offer.gift_tickets && offer.gift_tickets > 0) {
        const totalTickets = offer.gift_tickets * qty;
        
        const { error: ticketError } = await supabase.rpc('add_user_tickets', {
          p_user_id: user.id,
          p_amount: totalTickets,
          p_source: 'offer_purchase'
        });
        if (ticketError) console.error('Failed to add tickets:', ticketError);
      }

      if (offer.stock_quantity !== null) {
        await supabase
          .from('product_offers')
          .update({ 
            stock_quantity: offer.stock_quantity - qty,
            total_sold: (offer.total_sold || 0) + qty 
          })
          .eq('id', offer.id);
      }

      return { totalPrice, tickets: (offer.gift_tickets || 0) * qty };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['all-storage-panel'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-offers-panel-infinite'] });
      queryClient.invalidateQueries({ queryKey: ['user-storage-count-page'] });
      toast.success(`تم الشراء بنجاح! حصلت على ${data.tickets} تذكرة`);
      setPurchaseDialogOpen(false);
      setSelectedOffer(null);
      setQuantity(1);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const offers = data?.pages.flat() || [];

  const handleOfferClick = (offer: any) => {
    setSelectedOffer(offer);
    setCurrentImageIndex(0);
    setQuantity(1);
  };

  const handlePurchase = () => {
    if (!user) {
      toast.error('سجّل الدخول للشراء');
      return;
    }
    setPurchaseDialogOpen(true);
  };

  // Get images array - handle both single image and array
  const getOfferImages = (offer: any) => {
    if (offer?.images && Array.isArray(offer.images) && offer.images.length > 0) {
      return offer.images;
    }
    if (offer?.image_url) {
      return [offer.image_url];
    }
    return ['/placeholder.svg'];
  };

  const offerImages = getOfferImages(selectedOffer);

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-2.5">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-16 h-16 rounded-2xl bg-muted/50 flex items-center justify-center mb-3">
          <Gift className="h-8 w-8 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium text-sm">لا توجد عروض متاحة</p>
      </div>
    );
  }

  return (
    <>
      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-2.5">
        {offers.map((offer) => (
          <Card 
            key={offer.id} 
            className="overflow-hidden cursor-pointer group border-0 shadow-sm hover:shadow-md transition-all duration-200 bg-card rounded-xl"
            onClick={() => handleOfferClick(offer)}
          >
            <div className="relative aspect-square">
              <OptimizedImage
                src={offer.image_url || '/placeholder.svg'}
                alt={offer.title_ar}
                className="w-full h-full object-cover group-hover:scale-102 transition-transform duration-300"
              />
              
              {/* Gradient */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              
              {/* Gift Tickets Badge */}
              {offer.gift_tickets && offer.gift_tickets > 0 && (
                <div className="absolute top-1.5 right-1.5">
                  <Badge className="bg-primary/90 text-primary-foreground gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                    <Ticket className="h-2.5 w-2.5" />
                    +{offer.gift_tickets}
                  </Badge>
                </div>
              )}
              
              {/* Low Stock */}
              {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                <div className="absolute top-1.5 left-1.5">
                  <Badge variant="destructive" className="gap-0.5 text-[9px] px-1.5 py-0.5 h-5">
                    <Flame className="h-2.5 w-2.5" />
                    {offer.stock_quantity}
                  </Badge>
                </div>
              )}
              
              {/* Bottom - Title & Price */}
              <div className="absolute bottom-0 left-0 right-0 p-2">
                <h3 className="font-semibold text-white text-[11px] line-clamp-1 mb-1">
                  {offer.title_ar}
                </h3>
                <div className="flex items-center justify-between">
                  <span className="bg-background/90 backdrop-blur-sm rounded-md px-2 py-0.5 font-bold text-primary text-xs">
                    {offer.price?.toLocaleString()} <span className="text-[8px] text-muted-foreground">{offer.currency || 'د.ع'}</span>
                  </span>
                </div>
              </div>
            </div>
          </Card>
        ))}
      </div>
      
      {/* Load more */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <Loader2 className="h-5 w-5 animate-spin text-primary" />
        )}
      </div>

      {/* Product Detail Sheet */}
      <Sheet open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <SheetContent side="bottom" className="h-[92vh] rounded-t-3xl p-0 border-t-0 bg-background overflow-hidden">
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30 z-10" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل المنتج</SheetTitle>
          </SheetHeader>
          
          {selectedOffer && (
            <div className="h-full flex flex-col">
              {/* Image Section */}
              <div className="relative w-full aspect-[4/3] bg-muted shrink-0">
                <img
                  src={offerImages[currentImageIndex]}
                  alt={selectedOffer.title_ar}
                  className="w-full h-full object-contain bg-muted"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = '/placeholder.svg';
                  }}
                />
                
                {/* Close */}
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-background/80 backdrop-blur-sm shadow-md border-0"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
                
                {/* Image Navigation */}
                {offerImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-background/70 backdrop-blur-sm border-0"
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + offerImages.length) % offerImages.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg bg-background/70 backdrop-blur-sm border-0"
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % offerImages.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    {/* Dots */}
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-background/50 backdrop-blur-sm px-2 py-1 rounded-full">
                      {offerImages.map((_: string, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`rounded-full transition-all ${
                            idx === currentImageIndex 
                              ? 'bg-primary w-4 h-1.5' 
                              : 'bg-muted-foreground/50 w-1.5 h-1.5'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                {/* Gift Badge */}
                {selectedOffer.gift_tickets > 0 && (
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-primary text-primary-foreground gap-1 text-xs px-2 py-1">
                      <Star className="h-3 w-3" />
                      +{selectedOffer.gift_tickets} تذكرة
                    </Badge>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-4 py-4">
                <h2 className="text-lg font-bold mb-2 leading-relaxed">{selectedOffer.title_ar}</h2>
                
                <div className="flex items-baseline gap-1 mb-3">
                  <span className="text-2xl font-black text-primary">
                    {selectedOffer.price?.toLocaleString()}
                  </span>
                  <span className="text-xs text-muted-foreground">{selectedOffer.currency || 'د.ع'}</span>
                </div>

                {selectedOffer.description_ar && (
                  <p className="text-sm text-muted-foreground mb-4 leading-relaxed bg-muted/30 p-3 rounded-xl">
                    {selectedOffer.description_ar}
                  </p>
                )}

                {/* Stock */}
                {selectedOffer.stock_quantity !== null && (
                  <div className="mb-4">
                    {selectedOffer.stock_quantity > 0 ? (
                      <Badge 
                        variant="outline" 
                        className={selectedOffer.stock_quantity <= 5 
                          ? 'border-destructive/50 text-destructive bg-destructive/5' 
                          : 'border-primary/30 text-primary bg-primary/5'
                        }
                      >
                        {selectedOffer.stock_quantity <= 5 && <Flame className="h-3 w-3 ml-1" />}
                        متوفر: {selectedOffer.stock_quantity}
                      </Badge>
                    ) : (
                      <Badge variant="destructive">نفذت الكمية</Badge>
                    )}
                  </div>
                )}

                {/* Quantity */}
                <Card className="border border-primary/20 bg-primary/5 rounded-xl">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between mb-3">
                      <span className="font-medium text-sm">الكمية</span>
                      <div className="flex items-center gap-2 bg-background rounded-lg p-0.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="h-3 w-3" />
                        </Button>
                        <span className="font-bold text-lg w-8 text-center">{quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-md"
                          onClick={() => setQuantity(q => q + 1)}
                          disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                        >
                          <Plus className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="space-y-2 pt-3 border-t border-primary/10">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">المجموع</span>
                        <span className="font-bold text-primary">
                          {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                        </span>
                      </div>
                      
                      {selectedOffer.gift_tickets > 0 && (
                        <div className="flex justify-between text-sm bg-primary/10 rounded-lg px-3 py-2">
                          <span>تذاكر مجانية</span>
                          <span className="flex items-center gap-1 text-primary font-bold">
                            <Ticket className="h-4 w-4" />
                            {selectedOffer.gift_tickets * quantity}
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Bottom CTA */}
              <div className="shrink-0 p-4 pt-2 border-t bg-background">
                <Button 
                  className="w-full h-12 rounded-xl font-bold shadow-lg shadow-primary/20"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={!user || (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)}
                >
                  <ShoppingCart className="h-5 w-5 ml-2" />
                  شراء الآن
                </Button>
                {!user && (
                  <p className="text-xs text-center text-muted-foreground mt-2">سجّل الدخول للشراء</p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Purchase Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent className="rounded-2xl max-w-xs">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center">تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p className="text-center text-sm">
                  شراء <strong className="text-foreground">{quantity}× {selectedOffer?.title_ar}</strong>
                </p>
                <Card className="bg-muted/30 border-0">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>المبلغ</span>
                      <span className="font-bold text-primary">{((selectedOffer?.price || 0) * quantity).toLocaleString()} د.ع</span>
                    </div>
                    {selectedOffer?.gift_tickets > 0 && (
                      <div className="flex justify-between text-sm text-primary">
                        <span>التذاكر</span>
                        <span className="font-bold flex items-center gap-1">
                          <Ticket className="h-3 w-3" />
                          {selectedOffer.gift_tickets * quantity}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel className="rounded-lg flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg flex-1"
              onClick={() => selectedOffer && purchaseMutation.mutate({ offer: selectedOffer, qty: quantity })}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-1" />}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
