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
import { X, Ticket, Gift, Loader2, ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus, Flame, Star, Eye } from "lucide-react";

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
          <Skeleton key={i} className="aspect-[3/4] rounded-2xl" />
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
      {/* Products Grid - Professional Cards */}
      <div className="grid grid-cols-2 gap-3">
        {offers.map((offer) => (
          <Card 
            key={offer.id} 
            className="overflow-hidden cursor-pointer group border-0 shadow-sm hover:shadow-xl transition-all duration-300 bg-card rounded-2xl"
            onClick={() => handleOfferClick(offer)}
          >
            <div className="relative aspect-[3/4]">
              <OptimizedImage
                src={offer.image_url || '/placeholder.svg'}
                alt={offer.title_ar}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent" />
              
              {/* Top Right - Gift Tickets */}
              {offer.gift_tickets && offer.gift_tickets > 0 && (
                <div className="absolute top-2 right-2">
                  <div className="bg-primary text-primary-foreground px-2 py-1 rounded-lg flex items-center gap-1 shadow-lg">
                    <Ticket className="h-3 w-3" />
                    <span className="text-[10px] font-bold">+{offer.gift_tickets}</span>
                  </div>
                </div>
              )}
              
              {/* Top Left - Stock Warning */}
              {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                <div className="absolute top-2 left-2">
                  <div className="bg-destructive text-destructive-foreground px-2 py-1 rounded-lg flex items-center gap-1">
                    <Flame className="h-3 w-3" />
                    <span className="text-[10px] font-bold">{offer.stock_quantity}</span>
                  </div>
                </div>
              )}
              
              {/* Bottom Content */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <h3 className="font-bold text-white text-sm line-clamp-2 mb-2 drop-shadow-lg">
                  {offer.title_ar}
                </h3>
                <div className="flex items-center justify-between">
                  <div className="bg-white/95 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-lg">
                    <span className="font-black text-primary text-sm">
                      {offer.price?.toLocaleString()}
                    </span>
                    <span className="text-[9px] text-muted-foreground mr-1">{offer.currency || 'د.ع'}</span>
                  </div>
                  <Button 
                    size="sm" 
                    className="h-8 w-8 rounded-xl p-0 shadow-lg"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleOfferClick(offer);
                    }}
                  >
                    <Eye className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
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
        <SheetContent side="bottom" className="h-[95vh] rounded-t-[2rem] px-0 pb-0 border-t-0 bg-background">
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1 rounded-full bg-muted-foreground/30" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل المنتج</SheetTitle>
          </SheetHeader>
          
          {selectedOffer && (
            <div className="h-full flex flex-col">
              {/* Image Gallery with Premium Design */}
              <div className="relative aspect-square bg-muted shrink-0">
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
                    className="absolute top-4 right-4 h-11 w-11 rounded-2xl bg-white/90 backdrop-blur-sm shadow-xl border-0"
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
                      className="absolute left-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-white/80 backdrop-blur-sm border-0"
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + offerImages.length) % offerImages.length)}
                    >
                      <ChevronLeft className="h-5 w-5" />
                    </Button>
                    <Button
                      variant="secondary"
                      size="icon"
                      className="absolute right-3 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl bg-white/80 backdrop-blur-sm border-0"
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % offerImages.length)}
                    >
                      <ChevronRight className="h-5 w-5" />
                    </Button>
                    
                    {/* Image Indicators */}
                    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 bg-black/40 backdrop-blur-sm px-3 py-2 rounded-full">
                      {offerImages.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`transition-all duration-300 rounded-full ${
                            idx === currentImageIndex 
                              ? 'bg-white w-6 h-2' 
                              : 'bg-white/50 w-2 h-2 hover:bg-white/70'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
                
                {/* Gift Badge */}
                {selectedOffer.gift_tickets > 0 && (
                  <div className="absolute top-4 left-4">
                    <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-4 py-2 rounded-2xl flex items-center gap-2 shadow-xl">
                      <Star className="h-4 w-4" />
                      <span className="font-bold text-sm">+{selectedOffer.gift_tickets} تذكرة هدية</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Content - Scrollable */}
              <div className="flex-1 overflow-y-auto">
                <div className="px-5 py-5">
                  {/* Title & Price */}
                  <div className="mb-4">
                    <h2 className="text-xl font-black mb-3 leading-relaxed">{selectedOffer.title_ar}</h2>
                    <div className="flex items-baseline gap-2">
                      <span className="text-3xl font-black text-primary">
                        {selectedOffer.price?.toLocaleString()}
                      </span>
                      <span className="text-sm text-muted-foreground">{selectedOffer.currency || 'د.ع'}</span>
                    </div>
                  </div>

                  {/* Description */}
                  {selectedOffer.description_ar && (
                    <div className="mb-5 p-4 bg-muted/30 rounded-2xl">
                      <p className="text-sm text-muted-foreground leading-relaxed">
                        {selectedOffer.description_ar}
                      </p>
                    </div>
                  )}

                  {/* Stock Status */}
                  {selectedOffer.stock_quantity !== null && (
                    <div className="mb-5">
                      {selectedOffer.stock_quantity > 0 ? (
                        <div className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl ${
                          selectedOffer.stock_quantity <= 5 
                            ? 'bg-destructive/10 text-destructive' 
                            : 'bg-primary/10 text-primary'
                        }`}>
                          {selectedOffer.stock_quantity <= 5 && <Flame className="h-4 w-4" />}
                          <span className="font-semibold text-sm">
                            متوفر: {selectedOffer.stock_quantity} قطعة
                          </span>
                        </div>
                      ) : (
                        <Badge variant="destructive" className="px-4 py-2 text-sm">نفذت الكمية</Badge>
                      )}
                    </div>
                  )}

                  {/* Quantity Selector - Premium */}
                  <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 to-transparent rounded-2xl overflow-hidden">
                    <CardContent className="p-5">
                      <div className="flex items-center justify-between mb-4">
                        <span className="font-bold">الكمية</span>
                        <div className="flex items-center gap-3 bg-muted/50 rounded-xl p-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-background"
                            onClick={() => setQuantity(q => Math.max(1, q - 1))}
                            disabled={quantity <= 1}
                          >
                            <Minus className="h-4 w-4" />
                          </Button>
                          <span className="font-black text-xl w-10 text-center">{quantity}</span>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-10 w-10 rounded-xl hover:bg-background"
                            onClick={() => setQuantity(q => q + 1)}
                            disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                          >
                            <Plus className="h-4 w-4" />
                          </Button>
                        </div>
                      </div>
                      
                      <div className="space-y-3 pt-4 border-t border-primary/10">
                        <div className="flex justify-between items-center">
                          <span className="text-muted-foreground">المجموع</span>
                          <span className="font-black text-primary text-xl">
                            {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                          </span>
                        </div>
                        
                        {selectedOffer.gift_tickets > 0 && (
                          <div className="flex justify-between items-center bg-primary/10 rounded-xl px-4 py-3">
                            <span className="text-sm font-medium">تذاكر مجانية</span>
                            <span className="flex items-center gap-2 text-primary font-bold">
                              <Ticket className="h-5 w-5" />
                              {selectedOffer.gift_tickets * quantity} تذكرة
                            </span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>

              {/* Fixed Bottom CTA */}
              <div className="shrink-0 p-5 pt-4 border-t bg-card/95 backdrop-blur-xl">
                <Button 
                  className="w-full h-14 rounded-2xl text-base font-black shadow-xl shadow-primary/30 bg-gradient-to-r from-primary to-primary/90"
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
                  <p className="text-xs text-center text-muted-foreground mt-3">
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
        <AlertDialogContent className="rounded-3xl max-w-sm">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-lg">تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <p className="text-center">
                  هل تريد شراء <strong className="text-foreground">{quantity}x {selectedOffer?.title_ar}</strong>؟
                </p>
                <Card className="bg-muted/30 border-0">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المبلغ</span>
                      <span className="font-black text-primary text-lg">{((selectedOffer?.price || 0) * quantity).toLocaleString()} د.ع</span>
                    </div>
                    {selectedOffer?.gift_tickets > 0 && (
                      <div className="flex justify-between text-sm pt-2 border-t">
                        <span className="text-muted-foreground">التذاكر المجانية</span>
                        <span className="font-bold flex items-center gap-1 text-primary">
                          <Ticket className="h-4 w-4" />
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
            <AlertDialogCancel className="rounded-xl flex-1">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-xl flex-1"
              onClick={() => selectedOffer && purchaseMutation.mutate({ offer: selectedOffer, qty: quantity })}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
