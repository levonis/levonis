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
      {/* Products Grid - Premium Luxury Cards */}
      <div className="grid grid-cols-2 gap-4">
        {offers.map((offer, index) => (
          <div 
            key={offer.id} 
            className="group cursor-pointer"
            onClick={() => handleOfferClick(offer)}
            style={{ animationDelay: `${index * 50}ms` }}
          >
            {/* Card with Gold Border Effect */}
            <div className="relative rounded-[1.25rem] overflow-hidden bg-gradient-to-b from-primary/30 via-primary/10 to-transparent p-[1px] shadow-lg hover:shadow-2xl hover:shadow-primary/20 transition-all duration-500">
              <div className="relative rounded-[1.2rem] overflow-hidden bg-card">
                {/* Image Container */}
                <div className="relative aspect-[4/5] overflow-hidden">
                  <OptimizedImage
                    src={offer.image_url || '/placeholder.svg'}
                    alt={offer.title_ar}
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700 ease-out"
                  />
                  
                  {/* Premium Gradient Overlay */}
                  <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent opacity-95" />
                  
                  {/* Decorative Corner Accent */}
                  <div className="absolute top-0 left-0 w-16 h-16 bg-gradient-to-br from-primary/20 to-transparent" />
                  
                  {/* Rewards Badges - Floating Top Right */}
                  <div className="absolute top-3 right-3 flex flex-col gap-2">
                    {offer.gift_tickets > 0 && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-primary/40 blur-lg rounded-full" />
                        <div className="relative bg-gradient-to-r from-primary via-primary to-accent text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-primary/30">
                          <Ticket className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-black">+{offer.gift_tickets}</span>
                        </div>
                      </div>
                    )}
                    {offer.points_reward > 0 && (
                      <div className="relative">
                        <div className="absolute inset-0 bg-accent/40 blur-lg rounded-full" />
                        <div className="relative bg-gradient-to-r from-accent to-primary text-primary-foreground px-3 py-1.5 rounded-full flex items-center gap-1.5 shadow-xl border border-accent/30">
                          <Coins className="h-3.5 w-3.5" />
                          <span className="text-[11px] font-black">+{offer.points_reward}</span>
                        </div>
                      </div>
                    )}
                  </div>
                  
                  {/* Stock Warning - Premium Style */}
                  {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                    <div className="absolute top-3 left-3">
                      <div className="bg-destructive/90 text-destructive-foreground px-2.5 py-1 rounded-full flex items-center gap-1 shadow-lg backdrop-blur-sm border border-destructive/30">
                        <Flame className="h-3 w-3 animate-pulse" />
                        <span className="text-[10px] font-bold">آخر {offer.stock_quantity}</span>
                      </div>
                    </div>
                  )}
                  
                  {/* Out of Stock Overlay */}
                  {offer.stock_quantity !== null && offer.stock_quantity <= 0 && (
                    <div className="absolute inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center">
                      <div className="bg-muted/80 px-4 py-2 rounded-full">
                        <span className="text-foreground font-bold text-sm">نفذت الكمية</span>
                      </div>
                    </div>
                  )}
                </div>
                
                {/* Content Section - Below Image */}
                <div className="relative p-3 pt-0 -mt-12 z-10">
                  {/* Title */}
                  <h3 className="font-bold text-foreground text-sm line-clamp-2 mb-3 leading-relaxed drop-shadow-sm">
                    {offer.title_ar}
                  </h3>
                  
                  {/* Price & Action Row */}
                  <div className="flex items-center justify-between gap-2">
                    {/* Premium Price Tag */}
                    <div className="relative flex-1">
                      <div className="absolute inset-0 bg-gradient-to-r from-primary/20 to-accent/20 blur-lg rounded-xl" />
                      <div className="relative bg-gradient-to-r from-card to-card/95 border border-primary/30 rounded-xl px-3 py-2 shadow-lg">
                        <div className="flex items-baseline gap-1">
                          <span className="font-black text-primary text-base leading-none">
                            {offer.price?.toLocaleString()}
                          </span>
                          <span className="text-[9px] text-muted-foreground font-medium">{offer.currency || 'د.ع'}</span>
                        </div>
                      </div>
                    </div>
                    
                    {/* Shop Button */}
                    <div className="relative">
                      <div className="absolute inset-0 bg-primary/40 blur-lg rounded-xl" />
                      <Button 
                        size="icon" 
                        className="relative h-10 w-10 rounded-xl shadow-xl bg-gradient-to-br from-primary to-accent hover:from-primary/90 hover:to-accent/90 border border-primary/30"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOfferClick(offer);
                        }}
                      >
                        <ShoppingCart className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Load more trigger */}
      <div ref={loadMoreRef} className="py-8 flex justify-center">
        {isFetchingNextPage && (
          <div className="flex items-center gap-3 bg-muted/50 px-6 py-3 rounded-2xl">
            <Loader2 className="h-5 w-5 animate-spin text-primary" />
            <span className="text-sm text-muted-foreground">جاري التحميل...</span>
          </div>
        )}
      </div>

      {/* Premium Product Detail Sheet */}
      <Sheet open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <SheetContent side="bottom" className="h-[95vh] rounded-t-[2.5rem] px-0 pb-0 border-t-0 bg-background overflow-hidden">
          {/* Sheet Handle */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-muted-foreground/30 z-10" />
          
          <SheetHeader className="sr-only">
            <SheetTitle>تفاصيل المنتج</SheetTitle>
          </SheetHeader>
          
          {selectedOffer && (
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="h-full overflow-y-auto"
            >
              {/* Hero Image Gallery with Parallax */}
              <div 
                className="relative w-full aspect-square overflow-hidden"
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
                          <div className="relative aspect-square">
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
                    className="absolute top-5 right-5 h-12 w-12 rounded-2xl bg-white/90 backdrop-blur-md shadow-2xl border-0 z-10"
                  >
                    <X className="h-5 w-5" />
                  </Button>
                </SheetClose>
                
                {/* Image Indicators - Premium Style */}
                {offerImages.length > 1 && (
                  <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex gap-2 bg-black/40 backdrop-blur-md px-4 py-2.5 rounded-2xl z-10">
                    {offerImages.map((_: any, idx: number) => (
                      <button
                        key={idx}
                        onClick={() => carouselApi?.scrollTo(idx)}
                        className={`transition-all duration-300 rounded-full ${
                          idx === currentImageIndex 
                            ? 'bg-white w-8 h-2' 
                            : 'bg-white/40 w-2 h-2 hover:bg-white/60'
                        }`}
                      />
                    ))}
                  </div>
                )}
                
                {/* Rewards Badges on Image */}
                <div className="absolute top-5 left-5 flex flex-col gap-2 z-10">
                  {selectedOffer.gift_tickets > 0 && (
                    <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                      <Ticket className="h-4 w-4" />
                      <span className="font-bold text-sm">+{selectedOffer.gift_tickets} تذكرة</span>
                    </div>
                  )}
                  {selectedOffer.points_reward > 0 && (
                    <div className="bg-gradient-to-r from-amber-500 to-orange-500 text-white px-4 py-2 rounded-2xl flex items-center gap-2 shadow-2xl backdrop-blur-sm">
                      <Coins className="h-4 w-4" />
                      <span className="font-bold text-sm">+{selectedOffer.points_reward} نقطة</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Content Container */}
              <div 
                className="relative bg-background rounded-t-[2rem] -mt-8 px-5 pt-6 pb-32"
                style={{
                  transform: `translateY(-${Math.min(imageTransform * 0.5, 50)}px)`,
                }}
              >
                {/* Title & Price Section */}
                <div className="mb-5">
                  <h2 className="text-2xl font-black mb-4 leading-relaxed">{selectedOffer.title_ar}</h2>
                  
                  <div className="flex items-center gap-3">
                    <div className="bg-gradient-to-r from-primary/10 to-primary/5 rounded-2xl px-5 py-3">
                      <div className="flex items-baseline gap-2">
                        <span className="text-3xl font-black text-primary">
                          {selectedOffer.price?.toLocaleString()}
                        </span>
                        <span className="text-sm text-muted-foreground font-medium">{selectedOffer.currency || 'د.ع'}</span>
                      </div>
                    </div>
                    
                    {/* Stock Status */}
                    {selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity > 0 && (
                      <Badge 
                        variant="outline" 
                        className={`px-4 py-2 text-sm font-semibold border-0 ${
                          selectedOffer.stock_quantity <= 5 
                            ? 'bg-red-500/10 text-red-600' 
                            : 'bg-green-500/10 text-green-600'
                        }`}
                      >
                        {selectedOffer.stock_quantity <= 5 && <Flame className="h-4 w-4 ml-1" />}
                        متوفر: {selectedOffer.stock_quantity}
                      </Badge>
                    )}
                  </div>
                </div>

                {/* Description */}
                {selectedOffer.description_ar && (
                  <div className="mb-6 p-5 bg-muted/30 rounded-3xl">
                    <p className="text-sm text-muted-foreground leading-relaxed">
                      {selectedOffer.description_ar}
                    </p>
                  </div>
                )}

                {/* Rewards Info Cards */}
                {(selectedOffer.gift_tickets > 0 || selectedOffer.points_reward > 0) && (
                  <div className="grid grid-cols-2 gap-3 mb-6">
                    {selectedOffer.gift_tickets > 0 && (
                      <Card className="border-0 bg-gradient-to-br from-primary/10 to-primary/5 rounded-3xl overflow-hidden">
                        <CardContent className="p-4 text-center">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-primary/20 flex items-center justify-center mb-3">
                            <Ticket className="h-6 w-6 text-primary" />
                          </div>
                          <p className="text-2xl font-black text-primary">+{selectedOffer.gift_tickets * quantity}</p>
                          <p className="text-xs text-muted-foreground mt-1">تذكرة مجانية</p>
                        </CardContent>
                      </Card>
                    )}
                    
                    {selectedOffer.points_reward > 0 && (
                      <Card className="border-0 bg-gradient-to-br from-amber-500/10 to-orange-500/5 rounded-3xl overflow-hidden">
                        <CardContent className="p-4 text-center">
                          <div className="w-12 h-12 mx-auto rounded-2xl bg-amber-500/20 flex items-center justify-center mb-3">
                            <Coins className="h-6 w-6 text-amber-600" />
                          </div>
                          <p className="text-2xl font-black text-amber-600">+{selectedOffer.points_reward * quantity}</p>
                          <p className="text-xs text-muted-foreground mt-1">نقطة مكافأة</p>
                        </CardContent>
                      </Card>
                    )}
                  </div>
                )}

                {/* Quantity Selector - Premium Design */}
                <Card className="border-2 border-primary/20 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 rounded-3xl overflow-hidden mb-6">
                  <CardContent className="p-5">
                    <div className="flex items-center justify-between mb-5">
                      <span className="font-bold text-lg">اختر الكمية</span>
                      <div className="flex items-center gap-1 bg-muted/50 rounded-2xl p-1.5">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 rounded-xl hover:bg-background"
                          onClick={() => setQuantity(q => Math.max(1, q - 1))}
                          disabled={quantity <= 1}
                        >
                          <Minus className="h-5 w-5" />
                        </Button>
                        <span className="font-black text-2xl w-14 text-center">{quantity}</span>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-11 w-11 rounded-xl hover:bg-background"
                          onClick={() => setQuantity(q => q + 1)}
                          disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                        >
                          <Plus className="h-5 w-5" />
                        </Button>
                      </div>
                    </div>
                    
                    {/* Total Summary */}
                    <div className="space-y-4 pt-5 border-t border-primary/10">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground text-lg">المجموع</span>
                        <span className="font-black text-primary text-2xl">
                          {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                        </span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Fixed Bottom CTA */}
              <div className="fixed bottom-0 left-0 right-0 p-5 pt-4 border-t bg-background/95 backdrop-blur-xl z-20 shadow-2xl shadow-black/10">
                <Button 
                  className="w-full h-16 rounded-3xl text-lg font-black shadow-xl shadow-primary/30 bg-gradient-to-r from-primary via-primary to-primary/90"
                  size="lg"
                  onClick={handlePurchase}
                  disabled={
                    !user || 
                    (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)
                  }
                >
                  <ShoppingCart className="h-6 w-6 ml-3" />
                  شراء الآن - {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
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
