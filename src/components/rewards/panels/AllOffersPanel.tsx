import { useState, useEffect, useRef, useCallback } from "react";
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
import {
  Carousel,
  CarouselContent,
  CarouselItem,
} from "@/components/ui/carousel";
import OptimizedImage from "@/components/OptimizedImage";
import { toast } from "sonner";
import { X, Ticket, Gift, Loader2, ShoppingCart, Minus, Plus, Flame, Star, Sparkles, Coins, TrendingUp } from "lucide-react";

const PAGE_SIZE = 10;

export default function AllOffersPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const [scrollY, setScrollY] = useState(0);
  const scrollRef = useRef<HTMLDivElement>(null);
  const autoSlideRef = useRef<NodeJS.Timeout | null>(null);
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

  // Auto-slide for carousel in detail view
  useEffect(() => {
    if (!selectedOffer || !carouselApi) return;
    
    const images = selectedOffer.images?.length ? selectedOffer.images : (selectedOffer.image_url ? [selectedOffer.image_url] : []);
    if (images.length <= 1) return;

    autoSlideRef.current = setInterval(() => {
      if (carouselApi) {
        carouselApi.scrollNext();
      }
    }, 4000);

    return () => {
      if (autoSlideRef.current) clearInterval(autoSlideRef.current);
    };
  }, [selectedOffer, carouselApi]);

  // Update current image index from carousel
  useEffect(() => {
    if (!carouselApi) return;
    
    carouselApi.on("select", () => {
      setCurrentImageIndex(carouselApi.selectedScrollSnap());
    });
  }, [carouselApi]);

  // Handle scroll for parallax effect
  const handleScroll = useCallback(() => {
    if (scrollRef.current) {
      setScrollY(scrollRef.current.scrollTop);
    }
  }, []);

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

      // Award tickets
      if (offer.gift_tickets && offer.gift_tickets > 0) {
        const totalTickets = offer.gift_tickets * qty;
        await supabase.rpc('add_user_tickets', {
          p_user_id: user.id,
          p_amount: totalTickets,
          p_source: 'offer_purchase'
        });
      }

      // Award points
      if (offer.points_reward && offer.points_reward > 0) {
        const totalPoints = offer.points_reward * qty;
        await supabase.from('points_transactions').insert({
          user_id: user.id,
          points: totalPoints,
          type: 'earn',
          source: 'offer_purchase',
          description: `نقاط من شراء ${offer.title_ar}`,
        });
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

      return { totalPrice, tickets: (offer.gift_tickets || 0) * qty, points: (offer.points_reward || 0) * qty };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['user-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['all-storage-panel'] });
      queryClient.invalidateQueries({ queryKey: ['all-product-offers-panel-infinite'] });
      
      let message = 'تم الشراء بنجاح!';
      if (data.tickets > 0 && data.points > 0) {
        message = `تم الشراء! حصلت على ${data.tickets} تذكرة و ${data.points} نقطة`;
      } else if (data.tickets > 0) {
        message = `تم الشراء! حصلت على ${data.tickets} تذكرة`;
      } else if (data.points > 0) {
        message = `تم الشراء! حصلت على ${data.points} نقطة`;
      }
      
      toast.success(message);
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
    setScrollY(0);
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
          <Skeleton key={i} className="aspect-[3/4] rounded-3xl" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <div className="w-20 h-20 rounded-3xl bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center mb-4">
          <Gift className="h-10 w-10 text-primary/50" />
        </div>
        <p className="text-muted-foreground font-medium">لا توجد عروض متاحة</p>
        <p className="text-xs text-muted-foreground/70 mt-1">ترقب العروض القادمة</p>
      </div>
    );
  }

  // Parallax image transform
  const imageTransform = Math.min(scrollY * 0.3, 100);

  return (
    <>
      {/* Products Grid - Compact Professional Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {offers.map((offer, index) => (
          <div 
            key={offer.id} 
            className="group cursor-pointer"
            onClick={() => handleOfferClick(offer)}
          >
            {/* Card with Subtle Border */}
            <div className="relative rounded-xl overflow-hidden bg-gradient-to-b from-primary/20 via-primary/5 to-transparent p-[1px] shadow-md hover:shadow-lg hover:shadow-primary/15 transition-all duration-300">
              <div className="relative rounded-[11px] overflow-hidden bg-card">
                {/* Square Image Container */}
                <div className="relative aspect-square overflow-hidden">
                  <OptimizedImage
                    src={offer.image_url || '/placeholder.svg'}
                    alt={offer.title_ar}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                  />
                  
                  {/* Subtle Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background/80 via-transparent to-transparent" />
                  
                  {/* Compact Rewards Badges */}
                  <div className="absolute top-1.5 right-1.5 flex flex-col gap-1">
                    {offer.gift_tickets > 0 && (
                      <div className="bg-gradient-to-r from-primary to-accent text-primary-foreground px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md text-[9px] font-bold">
                        <Ticket className="h-2.5 w-2.5" />
                        +{offer.gift_tickets}
                      </div>
                    )}
                    {offer.points_reward > 0 && (
                      <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md text-[9px] font-bold">
                        <Coins className="h-2.5 w-2.5" />
                        +{offer.points_reward}
                      </div>
                    )}
                  </div>
                  
                  {/* Stock Warning */}
                  {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                    <div className="absolute top-1.5 left-1.5">
                      <div className="bg-destructive/90 text-destructive-foreground px-1.5 py-0.5 rounded-md flex items-center gap-0.5 shadow-md text-[8px] font-medium">
                        <Flame className="h-2 w-2" />
                        آخر {offer.stock_quantity}
                      </div>
                    </div>
                  )}
                  
                  {/* Out of Stock Overlay */}
                  {offer.stock_quantity !== null && offer.stock_quantity <= 0 && (
                    <div className="absolute inset-0 bg-background/70 backdrop-blur-[2px] flex items-center justify-center">
                      <span className="text-foreground font-bold text-xs bg-muted/80 px-2 py-1 rounded-md">نفذت</span>
                    </div>
                  )}
                </div>
                
                {/* Compact Content */}
                <div className="p-2 pt-1.5">
                  <h3 className="font-semibold text-foreground text-[11px] line-clamp-1 mb-1.5">
                    {offer.title_ar}
                  </h3>
                  
                  {/* Price Row */}
                  <div className="flex items-center justify-between gap-1">
                    <div className="bg-gradient-to-r from-card to-muted/50 border border-primary/20 rounded-lg px-2 py-1">
                      <span className="font-black text-primary text-xs">
                        {offer.price?.toLocaleString()}
                      </span>
                      <span className="text-[8px] text-muted-foreground font-medium mr-0.5">{offer.currency || 'د.ع'}</span>
                    </div>
                    
                    <Button 
                      size="icon" 
                      className="h-7 w-7 rounded-lg shadow-sm bg-gradient-to-br from-primary to-primary/80"
                      onClick={(e) => {
                        e.stopPropagation();
                        handleOfferClick(offer);
                      }}
                    >
                      <ShoppingCart className="h-3 w-3" />
                    </Button>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-2 bg-muted/50 px-4 py-2 rounded-xl">
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
            <span className="text-xs text-muted-foreground">جاري التحميل...</span>
          </div>
        )}
      </div>

      {/* Compact Product Detail Sheet */}
      <Sheet open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <SheetContent side="bottom" className="h-[90vh] rounded-t-3xl px-0 pb-0 border-t-0 bg-background overflow-hidden">
          {/* Sheet Handle */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2 w-10 h-1 rounded-full bg-muted-foreground/30 z-10" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل المنتج</SheetTitle>
          </SheetHeader>
          
          {selectedOffer && (
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto"
            >
              {/* Compact Image Gallery with Parallax */}
              <div 
                className="relative w-full h-64 overflow-hidden"
                style={{
                  transform: `translateY(-${imageTransform}px)`,
                  transition: 'transform 0.1s ease-out'
                }}
              >
                {offerImages.length > 1 ? (
                  <Carousel
                    setApi={setCarouselApi}
                    opts={{ loop: true, direction: 'rtl' }}
                    className="w-full h-full"
                  >
                    <CarouselContent className="-ml-0">
                      {offerImages.map((img: string, idx: number) => (
                        <CarouselItem key={idx} className="pl-0">
                          <div className="relative h-64 w-full">
                            <OptimizedImage
                              src={img}
                              alt={`${selectedOffer.title_ar} - ${idx + 1}`}
                              className="w-full h-full object-cover"
                            />
                          </div>
                        </CarouselItem>
                      ))}
                    </CarouselContent>
                  </Carousel>
                ) : (
                  <OptimizedImage
                    src={offerImages[0] || '/placeholder.svg'}
                    alt={selectedOffer.title_ar}
                    className="w-full h-full object-cover"
                  />
                )}
                
                {/* Close Button */}
                <SheetClose asChild>
                  <Button 
                    variant="secondary" 
                    size="icon" 
                    className="absolute top-3 right-3 h-9 w-9 rounded-xl bg-white/90 backdrop-blur-md shadow-lg border-0 z-10"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </SheetClose>
                
                {/* Image Indicators */}
                {offerImages.length > 1 && (
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/40 backdrop-blur-md px-2.5 py-1.5 rounded-xl z-10">
                    {offerImages.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => carouselApi?.scrollTo(idx)}
                        className={`transition-all duration-300 rounded-full ${
                          idx === currentImageIndex 
                            ? 'bg-white w-5 h-1.5' 
                            : 'bg-white/40 w-1.5 h-1.5 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Compact Rewards Badges */}
                <div className="absolute top-3 left-3 flex flex-col gap-1.5 z-10">
                  {selectedOffer.gift_tickets > 0 && (
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg text-xs font-bold">
                      <Ticket className="h-3 w-3" />
                      +{selectedOffer.gift_tickets} تذكرة
                    </div>
                  )}
                  {selectedOffer.points_reward > 0 && (
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-2.5 py-1 rounded-lg flex items-center gap-1.5 shadow-lg text-xs font-bold">
                      <Coins className="h-3 w-3" />
                      +{selectedOffer.points_reward} نقطة
                    </div>
                  )}
                </div>
              </div>

              {/* Content Container */}
              <div 
                className="relative bg-background rounded-t-2xl -mt-4 px-4 pt-4 pb-28"
                style={{
                  transform: `translateY(-${Math.min(imageTransform * 0.4, 40)}px)`,
                }}
              >
                {/* Title & Price Section */}
                <div className="mb-4">
                  <h2 className="text-lg font-bold mb-2 leading-snug">{selectedOffer.title_ar}</h2>
                  
                  <div className="flex items-center gap-2 flex-wrap">
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-xl px-3 py-1.5">
                      <div className="flex items-baseline gap-1">
                        <span className="text-xl font-black text-primary">
                          {selectedOffer.price?.toLocaleString()}
                        </span>
                        <span className="text-xs text-muted-foreground font-medium">{selectedOffer.currency || 'د.ع'}</span>
                      </div>
                    </div>
                    
                    {selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`px-2 py-1 text-xs font-medium border-0 ${
                          selectedOffer.stock_quantity <= 5 
                            ? 'bg-red-500/10 text-red-600' 
                            : 'bg-green-500/10 text-green-600'
                        }`}
                      >
                        {selectedOffer.stock_quantity <= 5 && <Flame className="h-3 w-3 ml-0.5" />}
                        متوفر: {selectedOffer.stock_quantity}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                {selectedOffer.description_ar && (
                  <div className="mb-4 p-3 bg-muted/30 rounded-xl">
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {selectedOffer.description_ar}
                    </p>
                  </div>
                )}

                {/* Compact Rewards Cards */}
                {(selectedOffer.gift_tickets > 0 || selectedOffer.points_reward > 0) && (
                  <div className="grid grid-cols-2 gap-2 mb-4">
                    {selectedOffer.gift_tickets > 0 && (
                      <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-3 text-center">
                        <div className="w-8 h-8 mx-auto rounded-lg bg-primary/20 flex items-center justify-center mb-1.5">
                          <Ticket className="h-4 w-4 text-primary" />
                        </div>
                        <p className="text-lg font-black text-primary">+{selectedOffer.gift_tickets * quantity}</p>
                        <p className="text-[10px] text-muted-foreground">تذكرة</p>
                      </div>
                    )}
                    
                    {selectedOffer.points_reward > 0 && (
                      <div className="bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-xl p-3 text-center">
                        <div className="w-8 h-8 mx-auto rounded-lg bg-amber-500/20 flex items-center justify-center mb-1.5">
                          <Coins className="h-4 w-4 text-amber-600" />
                        </div>
                        <p className="text-lg font-black text-amber-600">+{selectedOffer.points_reward * quantity}</p>
                        <p className="text-[10px] text-muted-foreground">نقطة</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Compact Quantity Selector */}
                <Card className="border border-primary/20 bg-gradient-to-br from-primary/5 to-transparent rounded-xl overflow-hidden mb-4">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm">الكمية</span>
                      <div className="flex items-center gap-1 bg-muted/50 rounded-lg p-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-background"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="h-3.5 w-3.5" />
                        </Button>
                        <span className="font-bold text-lg w-10 text-center">{quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-8 w-8 rounded-lg hover:bg-background"
                          onClick={() => setQuantity(q => q + 1)}
                          disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                        >
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Total */}
                    <div className="flex justify-between items-center pt-3 mt-3 border-t border-primary/10">
                      <span className="text-muted-foreground text-sm">المجموع</span>
                      <span className="font-black text-primary text-lg">
                        {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                      </span>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fixed Bottom CTA */}
              <div className="fixed bottom-0 left-0 right-0 p-4 border-t bg-background/95 backdrop-blur-xl z-20 shadow-xl">
                <Button 
                  className="w-full h-12 rounded-xl text-sm font-bold shadow-lg shadow-primary/20 bg-gradient-to-r from-primary to-primary/90"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={
                    !user || 
                    (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)
                  }
                >
                  <ShoppingCart className="h-4 w-4 ml-2" />
                  شراء - {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                </Button>

                {!user && (
                  <p className="text-[10px] text-center text-muted-foreground mt-2">
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
        <AlertDialogContent className="rounded-3xl max-w-sm mx-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-xl font-black">تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                {/* Product Preview */}
                <div className="flex items-center gap-3 p-3 bg-muted/30 rounded-2xl">
                  <div className="w-16 h-16 rounded-xl overflow-hidden shrink-0">
                    <OptimizedImage
                      src={selectedOffer?.image_url || '/placeholder.svg'}
                      alt={selectedOffer?.title_ar || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-foreground line-clamp-2">{selectedOffer?.title_ar}</p>
                    <p className="text-xs text-muted-foreground mt-1">الكمية: {quantity}</p>
                  </div>
                </div>
                
                {/* Summary Card */}
                <Card className="bg-gradient-to-br from-muted/50 to-muted/30 border-0 rounded-2xl">
                  <CardContent className="p-4 space-y-3">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">المبلغ الإجمالي</span>
                      <span className="font-black text-primary text-xl">{((selectedOffer?.price || 0) * quantity).toLocaleString()} د.ع</span>
                    </div>
                    
                    {selectedOffer?.gift_tickets > 0 && (
                      <div className="flex justify-between text-sm pt-3 border-t">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Ticket className="h-4 w-4 text-primary" />
                          تذاكر مجانية
                        </span>
                        <span className="font-bold text-primary">{selectedOffer.gift_tickets * quantity}</span>
                      </div>
                    )}
                    
                    {selectedOffer?.points_reward > 0 && (
                      <div className="flex justify-between text-sm pt-3 border-t">
                        <span className="text-muted-foreground flex items-center gap-2">
                          <Coins className="h-4 w-4 text-amber-500" />
                          نقاط مكافأة
                        </span>
                        <span className="font-bold text-amber-600">{selectedOffer.points_reward * quantity}</span>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-3 mt-2">
            <AlertDialogCancel className="rounded-2xl flex-1 h-12">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-2xl flex-1 h-12 font-bold"
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
