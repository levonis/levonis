import { useState, useEffect, useRef, useCallback } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useMutation, useQueryClient, useInfiniteQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerClose,
} from "@/components/ui/drawer";
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
import { X, Ticket, Gift, Loader2, ShoppingCart, Minus, Plus, Flame, Coins, Palette, Settings2 } from "lucide-react";

const PAGE_SIZE = 10;

// Format price with English numbers
const formatPrice = (price: number) => {
  return price.toLocaleString('en-US');
};

// Types for colors and options
interface ProductColor {
  name_ar: string;
  hex_code: string;
  image_url: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
}

interface ProductOption {
  name_ar: string;
  price_adjustment: number;
  in_stock: boolean;
  stock_quantity: number | null;
}

export default function AllOffersPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState<any>(null);
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [carouselApi, setCarouselApi] = useState<any>(null);
  const [scrollY, setScrollY] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);
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
    setSelectedColor(null);
    setSelectedOption(null);
  };

  const handlePurchase = () => {
    if (!user) {
      toast.error('سجّل الدخول للشراء');
      return;
    }
    setPurchaseDialogOpen(true);
  };

  // Parse colors and options from selectedOffer
  const colors: ProductColor[] = selectedOffer?.colors 
    ? (Array.isArray(selectedOffer.colors) ? selectedOffer.colors : [])
    : [];
  const options: ProductOption[] = selectedOffer?.options 
    ? (Array.isArray(selectedOffer.options) ? selectedOffer.options : [])
    : [];
  const availableColors = colors.filter(c => c.in_stock && (c.stock_quantity === null || c.stock_quantity > 0));
  const availableOptions = options.filter(o => o.in_stock && (o.stock_quantity === null || o.stock_quantity > 0));

  // Calculate price with option adjustment
  const basePrice = (selectedOffer?.price || 0) + (selectedOption?.price_adjustment || 0);
  const totalPrice = basePrice * quantity;

  const offerImages = selectedOffer?.images?.length 
    ? selectedOffer.images 
    : selectedOffer?.image_url 
      ? [selectedOffer.image_url] 
      : [];
  
  // Get display image (selected color image or default)
  const displayImage = selectedColor?.image_url || (offerImages.length > 0 ? offerImages[currentImageIndex] : null);

  if (isLoading) {
    return (
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-2">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Skeleton key={i} className="aspect-square rounded-xl" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12">
        <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center mb-3">
          <Gift className="h-7 w-7 text-primary/50" />
        </div>
        <p className="text-muted-foreground text-sm font-medium">لا توجد عروض</p>
      </div>
    );
  }

  return (
    <>
      {/* Compact Square Grid - Min 3 columns */}
      <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-1.5">
        {offers.map((offer) => (
          <div 
            key={offer.id} 
            className="group cursor-pointer"
            onClick={() => handleOfferClick(offer)}
          >
            {/* Minimal Square Card */}
            <div className="relative aspect-square rounded-lg overflow-hidden bg-card border border-border/40 hover:border-primary/40 hover:shadow-md transition-all duration-200">
              <OptimizedImage
                src={offer.image_url || '/placeholder.svg'}
                alt={offer.title_ar}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
              />
              
              {/* Gradient Overlay */}
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-transparent" />
              
              {/* Top Badges Row */}
              <div className="absolute top-1 left-1 right-1 flex justify-between items-start">
                {/* Stock Warning */}
                {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 ? (
                  <div className="bg-destructive/90 text-destructive-foreground px-1 py-0.5 rounded text-[7px] font-bold flex items-center gap-0.5">
                    <Flame className="h-2 w-2" />
                    {offer.stock_quantity}
                  </div>
                ) : <div />}
                
                {/* Rewards */}
                <div className="flex gap-0.5">
                  {offer.gift_tickets > 0 && (
                    <div className="bg-primary/90 text-primary-foreground px-1 py-0.5 rounded text-[7px] font-bold flex items-center gap-0.5">
                      <Ticket className="h-2 w-2" />
                      {offer.gift_tickets}
                    </div>
                  )}
                  {offer.points_reward > 0 && (
                    <div className="bg-amber-500/90 text-white px-1 py-0.5 rounded text-[7px] font-bold flex items-center gap-0.5">
                      <Coins className="h-2 w-2" />
                      {offer.points_reward}
                    </div>
                  )}
                </div>
              </div>
              
              {/* Out of Stock Overlay */}
              {offer.stock_quantity !== null && offer.stock_quantity <= 0 && (
                <div className="absolute inset-0 bg-background/85 flex items-center justify-center">
                  <span className="text-foreground font-bold text-[9px] bg-muted px-2 py-0.5 rounded">نفذت</span>
                </div>
              )}
              
              {/* Bottom Content */}
              <div className="absolute bottom-0 left-0 right-0 p-1.5">
                <p className="text-white/90 text-[8px] line-clamp-1 mb-0.5 font-normal tracking-tight">
                  {offer.title_ar}
                </p>
                <div className="bg-gradient-to-r from-primary/95 to-primary/80 rounded px-1.5 py-0.5 inline-flex items-baseline gap-0.5 shadow-lg">
                  <span className="font-black text-primary-foreground text-[10px] tracking-tight">
                    {formatPrice(offer.price)}
                  </span>
                  <span className="text-[6px] text-primary-foreground/80 font-medium">{offer.currency || 'د.ع'}</span>
                </div>
              </div>
            </div>
          </div>
        ))}
      </div>
      
      {/* Load more */}
      <div ref={loadMoreRef} className="py-4 flex justify-center">
        {isFetchingNextPage && (
          <Loader2 className="h-4 w-4 animate-spin text-primary" />
        )}
      </div>

      {/* Redesigned Product Detail Drawer - Swipe from anywhere */}
      <Drawer open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <DrawerContent className="max-h-[88vh] rounded-t-2xl focus:outline-none" hideHandle>
          {/* Drag Handle - Wider touch area */}
          <div className="flex justify-center py-2 cursor-grab active:cursor-grabbing">
            <div className="w-10 h-1 bg-muted-foreground/30 rounded-full" />
          </div>
          
          <DrawerHeader className="sr-only">
            <DrawerTitle>تفاصيل المنتج</DrawerTitle>
          </DrawerHeader>
          
          {selectedOffer && (
            <div 
              ref={scrollRef}
              onScroll={handleScroll}
              className="overflow-y-auto max-h-[calc(88vh-24px)] pb-24 overscroll-contain"
            >
              {/* Square Image */}
              <div className="px-3 mb-3">
                <div className="relative rounded-xl overflow-hidden border border-primary/20 bg-muted">
                  <div className="relative aspect-square">
                    {offerImages.length > 1 && !selectedColor?.image_url ? (
                      <Carousel
                        setApi={setCarouselApi}
                        opts={{ loop: true, direction: 'rtl' }}
                        className="w-full h-full"
                      >
                        <CarouselContent className="-ml-0">
                          {offerImages.map((img: string, idx: number) => (
                            <CarouselItem key={idx} className="pl-0">
                              <OptimizedImage
                                src={img}
                                alt={`${selectedOffer.title_ar} - ${idx + 1}`}
                                className="w-full h-full object-cover aspect-square"
                              />
                            </CarouselItem>
                          ))}
                        </CarouselContent>
                      </Carousel>
                    ) : (
                      <OptimizedImage
                        src={displayImage || '/placeholder.svg'}
                        alt={selectedOffer.title_ar}
                        className="w-full h-full object-cover aspect-square"
                      />
                    )}
                    
                    {/* Image Dots */}
                    {offerImages.length > 1 && !selectedColor?.image_url && (
                      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                        {offerImages.map((_: any, idx: number) => (
                          <button
                            key={idx}
                            onClick={() => carouselApi?.scrollTo(idx)}
                            className={`rounded-full transition-all ${
                              idx === currentImageIndex 
                                ? 'bg-white w-4 h-1' 
                                : 'bg-white/40 w-1 h-1'
                            }`}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Close */}
                    <DrawerClose asChild>
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        className="absolute top-2 right-2 h-7 w-7 rounded-full bg-black/40 hover:bg-black/60 text-white"
                      >
                        <X className="h-3.5 w-3.5" />
                      </Button>
                    </DrawerClose>
                    
                    {/* Reward Badges */}
                    <div className="absolute top-2 left-2 flex gap-1">
                      {selectedOffer.gift_tickets > 0 && (
                        <div className="bg-primary/90 text-primary-foreground px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 shadow">
                          <Ticket className="h-2.5 w-2.5" />
                          +{selectedOffer.gift_tickets}
                        </div>
                      )}
                      {selectedOffer.points_reward > 0 && (
                        <div className="bg-amber-500/90 text-white px-1.5 py-0.5 rounded text-[9px] font-bold flex items-center gap-0.5 shadow">
                          <Coins className="h-2.5 w-2.5" />
                          +{selectedOffer.points_reward}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* Product Details */}
              <div className="px-3 space-y-2.5">
                {/* Title & Price */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <h2 className="text-sm font-bold leading-tight line-clamp-2">{selectedOffer.title_ar}</h2>
                    {selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity > 0 && (
                      <p className={`text-[10px] mt-0.5 ${selectedOffer.stock_quantity <= 5 ? 'text-destructive' : 'text-muted-foreground'}`}>
                        متوفر: {selectedOffer.stock_quantity}
                      </p>
                    )}
                  </div>
                  <div className="bg-primary/10 rounded-lg px-2 py-1.5 shrink-0">
                    <span className="text-base font-black text-primary">{formatPrice(basePrice)}</span>
                    <span className="text-[8px] text-muted-foreground mr-0.5">{selectedOffer.currency || 'د.ع'}</span>
                  </div>
                </div>

                {/* Colors Selection */}
                {availableColors.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
                      <Palette className="h-3 w-3" />
                      اختر اللون
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {availableColors.map((color, idx) => (
                        <button
                          key={idx}
                          className={`relative w-7 h-7 rounded-full border-2 transition-all ${
                            selectedColor?.hex_code === color.hex_code 
                              ? 'border-primary ring-2 ring-primary/30 scale-110' 
                              : 'border-border hover:scale-105'
                          }`}
                          style={{ backgroundColor: color.hex_code }}
                          onClick={() => setSelectedColor(selectedColor?.hex_code === color.hex_code ? null : color)}
                          title={color.name_ar}
                        />
                      ))}
                    </div>
                    {selectedColor && (
                      <p className="text-[9px] text-muted-foreground">{selectedColor.name_ar}</p>
                    )}
                  </div>
                )}

                {/* Options Selection */}
                {availableOptions.length > 0 && (
                  <div className="space-y-1.5">
                    <p className="text-[10px] font-medium flex items-center gap-1 text-muted-foreground">
                      <Settings2 className="h-3 w-3" />
                      اختر الخيار
                    </p>
                    <div className="flex flex-wrap gap-1">
                      {availableOptions.map((opt, idx) => (
                        <Button
                          key={idx}
                          variant={selectedOption?.name_ar === opt.name_ar ? "default" : "outline"}
                          size="sm"
                          onClick={() => setSelectedOption(selectedOption?.name_ar === opt.name_ar ? null : opt)}
                          className="h-6 text-[9px] px-2 rounded"
                        >
                          {opt.name_ar}
                          {opt.price_adjustment !== 0 && (
                            <span className="mr-0.5 opacity-70">
                              ({opt.price_adjustment > 0 ? '+' : ''}{formatPrice(opt.price_adjustment)})
                            </span>
                          )}
                        </Button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Description */}
                {selectedOffer.description_ar && (
                  <p className="text-[11px] text-muted-foreground leading-relaxed bg-muted/20 p-2 rounded-lg">
                    {selectedOffer.description_ar}
                  </p>
                )}

                {/* Rewards Summary */}
                {(selectedOffer.gift_tickets > 0 || selectedOffer.points_reward > 0) && (
                  <div className="flex gap-2">
                    {selectedOffer.gift_tickets > 0 && (
                      <div className="flex-1 bg-primary/10 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Ticket className="h-3 w-3 text-primary" />
                          <span className="text-sm font-bold text-primary">+{selectedOffer.gift_tickets * quantity}</span>
                        </div>
                        <p className="text-[8px] text-muted-foreground">تذكرة</p>
                      </div>
                    )}
                    {selectedOffer.points_reward > 0 && (
                      <div className="flex-1 bg-amber-500/10 rounded-lg p-2 text-center">
                        <div className="flex items-center justify-center gap-1">
                          <Coins className="h-3 w-3 text-amber-600" />
                          <span className="text-sm font-bold text-amber-600">+{selectedOffer.points_reward * quantity}</span>
                        </div>
                        <p className="text-[8px] text-muted-foreground">نقطة</p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quantity & Total */}
                <div className="bg-muted/20 rounded-lg p-2">
                  <div className="flex items-center justify-between">
                    <span className="text-[11px] font-medium">الكمية</span>
                    <div className="flex items-center gap-0.5 bg-background rounded p-0.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-3 w-3" />
                      </Button>
                      <span className="font-bold text-sm w-7 text-center">{quantity}</span>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-6 w-6 rounded"
                        onClick={() => setQuantity(q => q + 1)}
                        disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                      >
                        <Plus className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  <div className="flex justify-between items-center pt-2 mt-2 border-t border-border/30">
                    <span className="text-[11px] text-muted-foreground">المجموع</span>
                    <span className="font-black text-primary text-sm">
                      {formatPrice(totalPrice)} {selectedOffer.currency || 'د.ع'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Fixed CTA */}
              <div className="fixed bottom-0 left-0 right-0 p-3 bg-background/95 backdrop-blur-lg border-t shadow-lg z-20">
                <Button 
                  className="w-full h-10 rounded-lg text-xs font-bold"
                  onClick={handlePurchase}
                  disabled={!user || (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)}
                >
                  <ShoppingCart className="h-3.5 w-3.5 ml-1.5" />
                  شراء - {formatPrice(totalPrice)} {selectedOffer.currency || 'د.ع'}
                </Button>
                {!user && (
                  <p className="text-[9px] text-center text-muted-foreground mt-1">سجّل الدخول للشراء</p>
                )}
              </div>
            </div>
          )}
        </DrawerContent>
      </Drawer>

      {/* Compact Confirmation Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent className="rounded-xl max-w-[280px] mx-4 p-4">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-center text-sm font-bold">تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2">
                <div className="flex items-center gap-2 p-2 bg-muted/30 rounded-lg">
                  <div className="w-10 h-10 rounded-md overflow-hidden shrink-0">
                    <OptimizedImage
                      src={selectedOffer?.image_url || '/placeholder.svg'}
                      alt={selectedOffer?.title_ar || ''}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-[10px] text-foreground line-clamp-2">{selectedOffer?.title_ar}</p>
                    <p className="text-[9px] text-muted-foreground">×{quantity}</p>
                  </div>
                </div>
                
                <div className="bg-muted/30 rounded-lg p-2 space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">المبلغ</span>
                    <span className="font-bold text-primary">{formatPrice(totalPrice)} د.ع</span>
                  </div>
                  {selectedColor && (
                    <div className="flex justify-between text-[10px] pt-1.5 border-t border-border/30">
                      <span className="text-muted-foreground">اللون</span>
                      <span className="flex items-center gap-1">
                        <span className="w-3 h-3 rounded-full border" style={{ backgroundColor: selectedColor.hex_code }} />
                        <span className="font-medium">{selectedColor.name_ar}</span>
                      </span>
                    </div>
                  )}
                  {selectedOption && (
                    <div className="flex justify-between text-[10px] pt-1.5 border-t border-border/30">
                      <span className="text-muted-foreground">الخيار</span>
                      <span className="font-medium">{selectedOption.name_ar}</span>
                    </div>
                  )}
                  {selectedOffer?.gift_tickets > 0 && (
                    <div className="flex justify-between text-[10px] pt-1.5 border-t border-border/30">
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        <Ticket className="h-2.5 w-2.5 text-primary" />
                        تذاكر
                      </span>
                      <span className="font-bold text-primary">{selectedOffer.gift_tickets * quantity}</span>
                    </div>
                  )}
                  {selectedOffer?.points_reward > 0 && (
                    <div className="flex justify-between text-[10px] pt-1.5 border-t border-border/30">
                      <span className="text-muted-foreground flex items-center gap-0.5">
                        <Coins className="h-2.5 w-2.5 text-amber-500" />
                        نقاط
                      </span>
                      <span className="font-bold text-amber-600">{selectedOffer.points_reward * quantity}</span>
                    </div>
                  )}
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2 mt-3">
            <AlertDialogCancel className="rounded-lg flex-1 h-9 text-xs">إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="rounded-lg flex-1 h-9 text-xs font-bold"
              onClick={() => selectedOffer && purchaseMutation.mutate({ offer: selectedOffer, qty: quantity })}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending && <Loader2 className="h-3 w-3 animate-spin ml-1" />}
              تأكيد
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
