import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Gift, Loader2, Wallet, Package, ShoppingCart, ChevronLeft, ChevronRight, Ticket, ArrowRight, Trophy } from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductOption {
  name_ar: string;
  price_adjustment: number;
  in_stock: boolean;
}

interface ProductColor {
  name_ar: string;
  hex_code: string;
  image_url: string | null;
  in_stock: boolean;
}

interface ProductOffer {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  price: number;
  currency: string;
  gift_tickets: number;
  stock_quantity: number | null;
  options: ProductOption[] | null;
  colors: ProductColor[] | null;
}

export default function ProductOffersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [selectedOffer, setSelectedOffer] = useState<ProductOffer | null>(null);
  const [showPurchaseDialog, setShowPurchaseDialog] = useState(false);
  const [imageIndices, setImageIndices] = useState<Record<string, number>>({});

  const { data: offers, isLoading } = useQuery({
    queryKey: ['product-offers-active'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('product_offers')
        .select('*')
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as unknown as ProductOffer[];
    },
  });

  const { data: wallet } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase.from('user_wallets').select('balance').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: ticketBalance } = useQuery({
    queryKey: ['user-ticket-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase.from('user_tickets').select('ticket_count').eq('user_id', user.id).single();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user,
  });

  const purchaseMutation = useMutation({
    mutationFn: async (offerId: string) => {
      const { data, error } = await supabase.rpc('purchase_product_offer', { p_offer_id: offerId, p_quantity: 1 });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['product-offers-active'] });
        toast.success(`🎁 تم شراء ${data.product_name} وحصلت على ${data.gift_tickets} تذكرة هدية!`);
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: { message: `🛍️ <b>شراء منتج</b>\n📦 ${data.product_name}\n💰 ${data.total_cost?.toLocaleString() || 0} دينار\n🎁 ${data.gift_tickets} تذكرة` },
          });
        } catch (e) { console.error(e); }
        setShowPurchaseDialog(false);
        setSelectedOffer(null);
      } else {
        toast.error(data.error || 'حدث خطأ');
      }
    },
    onError: (error) => toast.error('خطأ: ' + error.message),
  });

  const handlePurchaseClick = (offer: ProductOffer) => {
    if (!user) { navigate('/auth'); return; }
    setSelectedOffer(offer);
    setShowPurchaseDialog(true);
  };

  const navigateImage = (offerId: string, direction: 'prev' | 'next', images: string[]) => {
    const currentIndex = imageIndices[offerId] || 0;
    const newIndex = direction === 'prev' ? (currentIndex - 1 + images.length) % images.length : (currentIndex + 1) % images.length;
    setImageIndices(prev => ({ ...prev, [offerId]: newIndex }));
  };

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-4 py-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <Button variant="ghost" size="icon" onClick={() => navigate('/')}><ArrowRight className="h-5 w-5" /></Button>
              <div>
                <h1 className="text-lg font-bold flex items-center gap-2"><Package className="h-5 w-5 text-primary" />عروض المنتجات</h1>
                <p className="text-xs text-muted-foreground">اشترِ منتجات واحصل على تذاكر هدية!</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <>
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 rounded-full text-sm"><Ticket className="h-3 w-3 text-primary" /><span className="font-medium text-xs">{ticketBalance || 0}</span></div>
                  <div className="inline-flex items-center gap-1 px-2 py-1 bg-secondary/50 rounded-full text-sm"><Wallet className="h-3 w-3 text-primary" /><span className="font-medium text-xs">{(wallet?.balance || 0).toLocaleString()}</span></div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="flex items-center justify-center gap-3 mb-6">
          <Button variant="outline" size="sm" onClick={() => navigate('/my-offer-purchases')} className="gap-1"><ShoppingCart className="h-4 w-4" />مشترياتي</Button>
          <Button variant="outline" size="sm" onClick={() => navigate('/competitions')} className="gap-1"><Trophy className="h-4 w-4" />المسابقات</Button>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : offers?.length === 0 ? (
          <Card className="text-center py-12"><CardContent className="pt-6"><Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" /><p className="text-muted-foreground">لا توجد عروض متاحة حالياً</p></CardContent></Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
            {offers?.map((offer) => {
              const images = offer.images && offer.images.length > 0 ? offer.images : (offer.image_url ? [offer.image_url] : []);
              const currentIndex = imageIndices[offer.id] || 0;
              const hasMultipleImages = images.length > 1;
              const canAfford = !user || !wallet || wallet.balance >= offer.price;
              const isOutOfStock = offer.stock_quantity !== null && offer.stock_quantity <= 0;

              return (
                <Card key={offer.id} className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-green-500/20">
                  <div className="relative aspect-square">
                    {images.length > 0 ? (
                      <OptimizedImage src={images[currentIndex]} alt={offer.title_ar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full bg-secondary flex items-center justify-center"><Package className="h-12 w-12 text-muted-foreground" /></div>
                    )}
                    <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1 shadow-lg"><Gift className="h-3 w-3" />{offer.gift_tickets} تذكرة هدية</Badge>
                    {isOutOfStock && <Badge className="absolute top-2 left-2 bg-red-600 text-white">نفذت الكمية</Badge>}
                    {hasMultipleImages && (
                      <>
                        <Button variant="ghost" size="icon" className="absolute left-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); navigateImage(offer.id, 'prev', images); }}><ChevronLeft className="h-4 w-4" /></Button>
                        <Button variant="ghost" size="icon" className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 bg-black/40 hover:bg-black/60 text-white opacity-0 group-hover:opacity-100 transition-opacity" onClick={(e) => { e.stopPropagation(); navigateImage(offer.id, 'next', images); }}><ChevronRight className="h-4 w-4" /></Button>
                        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">{images.map((_, idx) => (<button key={idx} className={`w-1.5 h-1.5 rounded-full ${idx === currentIndex ? 'bg-white' : 'bg-white/50'}`} onClick={(e) => { e.stopPropagation(); setImageIndices(prev => ({ ...prev, [offer.id]: idx })); }} />))}</div>
                      </>
                    )}
                  </div>
                  <CardContent className="p-3 space-y-2">
                    <h3 className="font-semibold text-sm line-clamp-2">{offer.title_ar}</h3>
                    {offer.description_ar && <p className="text-xs text-muted-foreground line-clamp-2">{offer.description_ar}</p>}
                    
                    {/* Colors Display */}
                    {offer.colors && (offer.colors as ProductColor[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(offer.colors as ProductColor[]).filter(c => c.in_stock).map((color, idx) => (
                          <div
                            key={idx}
                            className="w-5 h-5 rounded-full border-2 border-white shadow-sm"
                            style={{ backgroundColor: color.hex_code }}
                            title={color.name_ar}
                          />
                        ))}
                      </div>
                    )}
                    
                    {/* Options Display */}
                    {offer.options && (offer.options as ProductOption[]).length > 0 && (
                      <div className="flex flex-wrap gap-1">
                        {(offer.options as ProductOption[]).filter(o => o.in_stock).slice(0, 3).map((opt, idx) => (
                          <Badge key={idx} variant="secondary" className="text-[10px] px-1.5 py-0.5">
                            {opt.name_ar}
                          </Badge>
                        ))}
                        {(offer.options as ProductOption[]).filter(o => o.in_stock).length > 3 && (
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0.5">
                            +{(offer.options as ProductOption[]).filter(o => o.in_stock).length - 3}
                          </Badge>
                        )}
                      </div>
                    )}
                    
                    <div className="flex items-center justify-between pt-2 border-t">
                      <div><p className="font-bold text-primary">{offer.price.toLocaleString()}</p><p className="text-xs text-muted-foreground">{offer.currency}</p></div>
                      <Button size="sm" className="gap-1" onClick={() => handlePurchaseClick(offer)} disabled={purchaseMutation.isPending || isOutOfStock || (user && !canAfford)}>
                        {purchaseMutation.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <ShoppingCart className="h-3 w-3" />}
                        {!user ? 'سجّل دخول' : isOutOfStock ? 'نفذ' : !canAfford ? 'رصيد غير كافٍ' : 'شراء'}
                      </Button>
                    </div>
                    <div className="text-center py-2 bg-green-500/10 rounded-lg border border-green-500/20"><p className="text-xs text-green-700 dark:text-green-400 font-medium">🎁 مع كل شراء تحصل على {offer.gift_tickets} تذكرة مجاناً!</p></div>
                    {offer.stock_quantity !== null && !isOutOfStock && (
                      <p className="text-xs text-center text-amber-600 font-medium bg-amber-500/10 py-1 rounded">
                        📦 متبقي: {offer.stock_quantity} فقط
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </main>

      <Footer />

      <AlertDialog open={showPurchaseDialog} onOpenChange={setShowPurchaseDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2"><ShoppingCart className="h-5 w-5 text-primary" />تأكيد الشراء</AlertDialogTitle>
            <AlertDialogDescription className="text-right space-y-3">
              {selectedOffer && (
                <>
                  <p>هل تريد شراء <span className="font-bold text-foreground">{selectedOffer.title_ar}</span>؟</p>
                  <div className="p-3 bg-secondary/50 rounded-lg space-y-2">
                    <div className="flex justify-between"><span>السعر:</span><span className="font-bold">{selectedOffer.price.toLocaleString()} {selectedOffer.currency}</span></div>
                    <div className="flex justify-between text-green-600"><span>تذاكر هدية:</span><span className="font-bold">🎁 {selectedOffer.gift_tickets} تذكرة</span></div>
                  </div>
                  {wallet && wallet.balance < selectedOffer.price && <p className="text-destructive text-sm">⚠️ رصيد المحفظة غير كافٍ (رصيدك: {wallet.balance.toLocaleString()} دينار)</p>}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => selectedOffer && purchaseMutation.mutate(selectedOffer.id)} disabled={purchaseMutation.isPending || (wallet && selectedOffer && wallet.balance < selectedOffer.price)}>
              {purchaseMutation.isPending && <Loader2 className="h-4 w-4 animate-spin ml-2" />}تأكيد الشراء
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}