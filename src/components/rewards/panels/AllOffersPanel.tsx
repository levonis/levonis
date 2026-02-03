import { useState, useEffect, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
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
import { X, Ticket, Gift, Loader2, ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus, Sparkles, Flame } from "lucide-react";

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

  // Intersection Observer for infinite scroll
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

  const offerImages = selectedOffer?.images?.length 
    ? selectedOffer.images 
    : selectedOffer?.image_url 
      ? [selectedOffer.image_url] 
      : [];

  if (isLoading) {
    return (
      <div className="grid grid-cols-2 gap-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="aspect-[4/5] rounded-2xl" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-muted/50 flex items-center justify-center mb-4">
          <Gift className="h-10 w-10 text-muted-foreground/50" />
        </div>
        <p className="text-muted-foreground font-medium">لا توجد عروض متاحة</p>
        <p className="text-xs text-muted-foreground/70 mt-1">ترقب العروض القادمة</p>
      </div>
    );
  }

  return (
    <>
      {/* Products Grid */}
      <div className="grid grid-cols-2 gap-3">
        {offers.map((offer) => (
          <Card 
            key={offer.id} 
            className="overflow-hidden cursor-pointer group border-border/50 hover:border-primary/30 hover:shadow-xl hover:shadow-primary/5 transition-all duration-300 bg-card"
            onClick={() => handleOfferClick(offer)}
          >
            <div className="relative aspect-square bg-muted/20">
              <OptimizedImage
                src={offer.image_url || '/placeholder.svg'}
                alt={offer.title_ar}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent" />
              
              {/* Top Badges */}
              <div className="absolute top-2 right-2 left-2 flex justify-between items-start">
                {offer.gift_tickets && offer.gift_tickets > 0 && (
                  <Badge className="bg-primary text-primary-foreground gap-1 text-[10px] px-2 py-0.5 shadow-lg">
                    <Ticket className="h-3 w-3" />
                    +{offer.gift_tickets}
                  </Badge>
                )}
                {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                  <Badge className="bg-destructive text-destructive-foreground text-[9px] px-1.5 py-0.5 gap-1">
                    <Flame className="h-2.5 w-2.5" />
                    {offer.stock_quantity}
                  </Badge>
                )}
              </div>
              
              {/* Bottom Price */}
              <div className="absolute bottom-2 left-2 right-2">
                <div className="bg-background/95 backdrop-blur-sm rounded-lg px-2 py-1.5 shadow-lg">
                  <p className="font-bold text-primary text-sm">
                    {offer.price?.toLocaleString()}
                    <span className="text-[10px] text-muted-foreground font-normal mr-1">{offer.currency || 'د.ع'}</span>
                  </p>
                </div>
              </div>
            </div>
            
            <CardContent className="p-2.5">
              <h3 className="font-semibold text-xs line-clamp-2 text-foreground/90 leading-relaxed">{offer.title_ar}</h3>
            </CardContent>
          </Card>
        ))}
      </div>
      
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-6 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm">جاري التحميل...</span>
          </div>
        )}
      </div>

      {/* Premium Product Detail Sheet */}
      <Sheet open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl px-0 pb-0 border-t-0">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/20" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل المنتج</SheetTitle>
          </SheetHeader>
          
          {selectedOffer && (
            <div className="h-full flex flex-col">
              {/* Image Gallery */}
              <div className="relative aspect-square bg-muted/20 shrink-0">
                <OptimizedImage
                  src={offerImages[currentImageIndex] || '/placeholder.svg'}
                  alt={selectedOffer.title_ar}
                  className="w-full h-full object-cover"
                />
                
                {/* Close Button */}
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-4 right-4 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm shadow-lg"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
                
                {/* Image Navigation */}
                {offerImages.length > 1 && (
                  <>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + offerImages.length) % offerImages.length)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-full bg-background/80 backdrop-blur-sm"
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % offerImages.length)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-background/50 backdrop-blur-sm px-3 py-1.5 rounded-full">
                      {offerImages.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentImageIndex ? 'bg-primary w-5' : 'bg-muted-foreground/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                {/* Gift Tickets Badge */}
                {selectedOffer.gift_tickets > 0 && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-primary text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-lg">
                      <Sparkles className="h-4 w-4" />
                      <span className="font-bold text-sm">+{selectedOffer.gift_tickets} تذكرة</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Content */}
              <div className="flex-1 overflow-y-auto px-5 py-5">
                <h2 className="text-xl font-bold mb-2">{selectedOffer.title_ar}</h2>
                
                <div className="flex items-center gap-3 mb-4">
                  <span className="text-2xl font-black text-primary">
                    {selectedOffer.price?.toLocaleString()}
                    <span className="text-sm text-muted-foreground font-normal mr-1">{selectedOffer.currency || 'د.ع'}</span>
                  </span>
                </div>

                {selectedOffer.description_ar && (
                  <p className="text-sm text-muted-foreground mb-5 leading-relaxed">
                    {selectedOffer.description_ar}
                  </p>
                )}

                {/* Stock */}
                {selectedOffer.stock_quantity !== null && (
                  <div className="mb-5">
                    {selectedOffer.stock_quantity > 0 ? (
                      <Badge variant="outline" className={`${selectedOffer.stock_quantity <= 5 ? 'border-destructive/50 text-destructive bg-destructive/5' : 'border-primary/30 text-primary bg-primary/5'}`}>
                        متوفر: {selectedOffer.stock_quantity} قطعة
                      </Badge>
                    ) : (
                      <Badge variant="destructive">نفذت الكمية</Badge>
                    )}
                  </div>
                )}

                {/* Quantity Selector */}
                <Card className="mb-5 border-primary/10 bg-primary/5">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <span className="font-medium text-sm">الكمية</span>
                      <div className="flex items-center gap-4">
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="h-4 w-4" />
                        </Button>
                        <span className="font-bold text-xl w-8 text-center">{quantity}</span>
                        <Button
                          variant="outline"
                          size="icon"
                          className="h-9 w-9 rounded-xl"
                          onClick={() => setQuantity(q => q + 1)}
                          disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                        >
                          <Plus className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    
                    <div className="mt-4 pt-4 border-t border-primary/10 space-y-2">
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">المجموع</span>
                        <span className="font-bold text-primary text-lg">
                          {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                        </span>
                      </div>
                      
                      {selectedOffer.gift_tickets > 0 && (
                        <div className="flex justify-between text-sm">
                          <span className="text-muted-foreground">التذاكر المجانية</span>
                          <span className="flex items-center gap-1 text-primary font-medium">
                            <Ticket className="h-4 w-4" />
                            {selectedOffer.gift_tickets * quantity} تذكرة
                          </span>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fixed Bottom CTA */}
              <div className="shrink-0 p-5 pt-3 border-t bg-background/95 backdrop-blur-sm">
                <Button 
                  className="w-full h-12 rounded-2xl text-base font-bold shadow-lg shadow-primary/25"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={
                    !user || 
                    (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)
                  }
                >
                  <ShoppingCart className="h-5 w-5 ml-2" />
                  شراء الآن
                </Button>

                {!user && (
                  <p className="text-xs text-center text-muted-foreground mt-2">
                    سجّل الدخول للشراء
                  </p>
                )}
              </div>
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent className="rounded-3xl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>
                  هل تريد شراء <strong>{quantity}x {selectedOffer?.title_ar}</strong>؟
                </p>
                <Card className="bg-muted/50">
                  <CardContent className="p-3 space-y-2">
                    <div className="flex justify-between text-sm">
                      <span>المبلغ</span>
                      <span className="font-bold">{((selectedOffer?.price || 0) * quantity).toLocaleString()} د.ع</span>
                    </div>
                    {selectedOffer?.gift_tickets > 0 && (
                      <div className="flex justify-between text-sm text-primary">
                        <span>التذاكر المجانية</span>
                        <span className="font-bold flex items-center gap-1">
                          <Ticket className="h-3.5 w-3.5" />
                          {selectedOffer.gift_tickets * quantity}
                        </span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel className="rounded-xl">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl"
              onClick={() => selectedOffer && purchaseMutation.mutate({ offer: selectedOffer, qty: quantity })}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              تأكيد الشراء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
