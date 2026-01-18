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
import OptimizedImage from "@/components/OptimizedImage";
import TicketProductBadges from "../TicketProductBadges";
import { toast } from "sonner";
import { X, Ticket, Package, Loader2, ShoppingCart, ChevronLeft, ChevronRight, Minus, Plus } from "lucide-react";

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

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-offers', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
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
      
      // Check stock
      if (offer.stock_quantity !== null && offer.stock_quantity < qty) {
        throw new Error('الكمية المطلوبة غير متوفرة');
      }

      // Create purchase record
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
        
        const { data: existingTickets } = await supabase
          .from('user_tickets')
          .select('ticket_count')
          .eq('user_id', user.id)
          .maybeSingle();
        
        if (existingTickets) {
          await supabase
            .from('user_tickets')
            .update({ ticket_count: existingTickets.ticket_count + totalTickets })
            .eq('user_id', user.id);
        } else {
          await supabase
            .from('user_tickets')
            .insert({ user_id: user.id, ticket_count: totalTickets });
        }
      }

      // Update stock
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
      queryClient.invalidateQueries({ queryKey: ['user-points-offers'] });
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
      <div className="space-y-3">
        {[1, 2, 3, 4].map(i => (
          <Skeleton key={i} className="h-24 w-full rounded-xl" />
        ))}
      </div>
    );
  }

  if (offers.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-muted-foreground">
          <Package className="h-12 w-12 mx-auto mb-3 opacity-50" />
          لا توجد باقات متاحة حالياً
        </CardContent>
      </Card>
    );
  }

  return (
    <>
      <div className="space-y-3">
        {offers.map((offer) => (
          <Card 
            key={offer.id} 
            className="cursor-pointer hover:shadow-md transition-shadow"
            onClick={() => handleOfferClick(offer)}
          >
            <CardContent className="p-3 flex items-center gap-3">
              <div className="w-20 h-20 rounded-lg overflow-hidden shrink-0 bg-muted">
                <OptimizedImage
                  src={offer.image_url || '/placeholder.svg'}
                  alt={offer.title_ar}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium line-clamp-1">{offer.title_ar}</p>
                {offer.description_ar && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-0.5">
                    {offer.description_ar}
                  </p>
                )}
                <p className="text-sm text-primary font-bold mt-1">
                  {offer.price?.toLocaleString()} {offer.currency || 'د.ع'}
                </p>
                <TicketProductBadges ticketCount={offer.gift_tickets || 0} />
                {offer.stock_quantity !== null && offer.stock_quantity <= 5 && offer.stock_quantity > 0 && (
                  <Badge variant="outline" className="text-[9px] text-orange-600 border-orange-300 mt-1">
                    متبقي {offer.stock_quantity} فقط
                  </Badge>
                )}
              </div>
            </CardContent>
          </Card>
        ))}
        
        {/* Load more trigger */}
        <div ref={loadMoreRef} className="py-4 flex justify-center">
          {isFetchingNextPage && (
            <div className="flex items-center gap-2 text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              <span className="text-sm">جاري التحميل...</span>
            </div>
          )}
        </div>
      </div>

      {/* Offer Detail Sheet */}
      <Sheet open={!!selectedOffer} onOpenChange={(open) => !open && setSelectedOffer(null)}>
        <SheetContent side="bottom" className="h-[85vh] rounded-t-2xl px-0 pb-0">
          <SheetHeader className="sticky top-0 z-10 bg-background px-4 pb-3 border-b">
            <div className="flex items-center justify-between">
              <SheetTitle className="text-base">تفاصيل الباقة</SheetTitle>
              <SheetClose asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <X className="h-4 w-4" />
                </Button>
              </SheetClose>
            </div>
          </SheetHeader>
          
          {selectedOffer && (
            <div className="overflow-y-auto h-full px-4 py-4 pb-32">
              {/* Image Gallery */}
              <div className="aspect-square rounded-xl overflow-hidden mb-4 relative bg-muted">
                <OptimizedImage
                  src={offerImages[currentImageIndex] || '/placeholder.svg'}
                  alt={selectedOffer.title_ar}
                  className="w-full h-full object-cover"
                />
                
                {offerImages.length > 1 && (
                  <>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white h-8 w-8 rounded-full"
                      onClick={() => setCurrentImageIndex(prev => (prev - 1 + offerImages.length) % offerImages.length)}
                    >
                      <ChevronLeft className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white h-8 w-8 rounded-full"
                      onClick={() => setCurrentImageIndex(prev => (prev + 1) % offerImages.length)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                    
                    <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1.5 bg-black/30 backdrop-blur-sm px-2 py-1 rounded-full">
                      {offerImages.map((_: any, idx: number) => (
                        <button
                          key={idx}
                          onClick={() => setCurrentImageIndex(idx)}
                          className={`w-2 h-2 rounded-full transition-all ${
                            idx === currentImageIndex ? 'bg-white w-4' : 'bg-white/50'
                          }`}
                        />
                      ))}
                    </div>
                  </>
                )}
              </div>

              {/* Title & Price */}
              <h2 className="text-xl font-bold mb-2">{selectedOffer.title_ar}</h2>
              
              <div className="flex items-center gap-3 mb-4">
                <span className="text-2xl font-bold text-primary">
                  {selectedOffer.price?.toLocaleString()} {selectedOffer.currency || 'د.ع'}
                </span>
                <TicketProductBadges ticketCount={selectedOffer.gift_tickets || 0} />
              </div>

              {/* Description */}
              {selectedOffer.description_ar && (
                <p className="text-sm text-muted-foreground mb-4">
                  {selectedOffer.description_ar}
                </p>
              )}

              {/* Stock info */}
              {selectedOffer.stock_quantity !== null && (
                <div className="mb-4">
                  {selectedOffer.stock_quantity > 0 ? (
                    <Badge variant="outline" className={`${selectedOffer.stock_quantity <= 5 ? 'text-orange-600 border-orange-300' : ''}`}>
                      متوفر: {selectedOffer.stock_quantity} قطعة
                    </Badge>
                  ) : (
                    <Badge variant="destructive">نفذت الكمية</Badge>
                  )}
                </div>
              )}

              {/* Quantity selector */}
              <Card className="mb-4">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">الكمية</span>
                    <div className="flex items-center gap-3">
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setQuantity(q => Math.max(1, q - 1))}
                        disabled={quantity <= 1}
                      >
                        <Minus className="h-4 w-4" />
                      </Button>
                      <span className="font-bold text-lg w-8 text-center">{quantity}</span>
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => setQuantity(q => q + 1)}
                        disabled={selectedOffer.stock_quantity !== null && quantity >= selectedOffer.stock_quantity}
                      >
                        <Plus className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="mt-3 pt-3 border-t flex justify-between text-sm">
                    <span>المجموع:</span>
                    <span className="font-bold text-primary">
                      {(selectedOffer.price * quantity).toLocaleString()} {selectedOffer.currency || 'د.ع'}
                    </span>
                  </div>
                  
                  {selectedOffer.gift_tickets > 0 && (
                    <div className="flex justify-between text-sm text-muted-foreground mt-1">
                      <span>التذاكر المجانية:</span>
                      <span className="flex items-center gap-1">
                        <Ticket className="h-3 w-3" />
                        {selectedOffer.gift_tickets * quantity} تذكرة
                      </span>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Purchase Button */}
              <Button 
                className="w-full"
                size="lg"
                onClick={handlePurchase}
                disabled={
                  !user || 
                  (selectedOffer.stock_quantity !== null && selectedOffer.stock_quantity < quantity)
                }
              >
                <ShoppingCart className="h-4 w-4 ml-2" />
                شراء الآن
              </Button>

              {!user && (
                <p className="text-xs text-center text-muted-foreground mt-2">
                  سجّل الدخول للشراء
                </p>
              )}
            </div>
          )}
        </SheetContent>
      </Sheet>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                هل تريد شراء <strong>{quantity}x {selectedOffer?.title_ar}</strong>؟
              </p>
              <p className="text-sm">
                سيتم خصم <strong>{((selectedOffer?.price || 0) * quantity).toLocaleString()} د.ع</strong> من محفظتك.
              </p>
              {selectedOffer?.gift_tickets > 0 && (
                <p className="text-sm text-green-600">
                  ستحصل على <strong>{selectedOffer.gift_tickets * quantity}</strong> تذكرة مجانية!
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedOffer && purchaseMutation.mutate({ offer: selectedOffer, qty: quantity })}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الشراء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
