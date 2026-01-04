import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { Gift, Loader2, Wallet, Package, ShoppingCart, ChevronLeft, ChevronRight, Ticket, ArrowRight, Trophy, X } from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductOption {
  name_ar: string;
  price_adjustment: number;
  in_stock: boolean;
  stock_quantity: number | null;
}

interface ProductColor {
  name_ar: string;
  hex_code: string;
  image_url: string | null;
  in_stock: boolean;
  stock_quantity: number | null;
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
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [detailOffer, setDetailOffer] = useState<ProductOffer | null>(null);
  const [detailImageIndex, setDetailImageIndex] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ProductColor | null>(null);
  const [selectedOption, setSelectedOption] = useState<ProductOption | null>(null);
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

  const handleOfferClick = (offer: ProductOffer) => {
    setDetailOffer(offer);
    setDetailImageIndex(0);
    setSelectedColor(null);
    setSelectedOption(null);
    setShowDetailDialog(true);
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
                <Card 
                  key={offer.id} 
                  className="overflow-hidden group hover:shadow-lg transition-all duration-300 border-green-500/20 cursor-pointer"
                  onClick={() => handleOfferClick(offer)}
                >
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
                      <Button size="sm" className="gap-1" onClick={(e) => { e.stopPropagation(); handlePurchaseClick(offer); }} disabled={purchaseMutation.isPending || isOutOfStock || (user && !canAfford)}>
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

      {/* Product Detail Dialog */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="max-w-lg max-h-[90vh] p-0 overflow-hidden" dir="rtl">
          <div className="flex flex-col max-h-[90vh]">
            {detailOffer && (() => {
              const images = detailOffer.images && detailOffer.images.length > 0 ? detailOffer.images : (detailOffer.image_url ? [detailOffer.image_url] : []);
              const hasMultipleImages = images.length > 1;
              const colors = (detailOffer.colors as ProductColor[]) || [];
              const options = (detailOffer.options as ProductOption[]) || [];
              const availableColors = colors.filter(c => c.in_stock);
              const availableOptions = options.filter(o => o.in_stock);
              const canAfford = !user || !wallet || wallet.balance >= detailOffer.price;
              const isOutOfStock = detailOffer.stock_quantity !== null && detailOffer.stock_quantity <= 0;

              return (
                <>
                  {/* Image Gallery */}
                  <div className="relative aspect-square bg-secondary">
                    {images.length > 0 ? (
                      <OptimizedImage src={selectedColor?.image_url || images[detailImageIndex]} alt={detailOffer.title_ar} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Package className="h-16 w-16 text-muted-foreground" /></div>
                    )}
                    <Button variant="ghost" size="icon" className="absolute top-2 left-2 bg-black/40 hover:bg-black/60 text-white h-8 w-8" onClick={() => setShowDetailDialog(false)}><X className="h-4 w-4" /></Button>
                    <Badge className="absolute top-2 right-2 bg-green-600 text-white gap-1 shadow-lg"><Gift className="h-3 w-3" />{detailOffer.gift_tickets} تذكرة هدية</Badge>
                    {hasMultipleImages && (
                      <>
                        <Button variant="ghost" size="icon" className="absolute left-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/40 hover:bg-black/60 text-white" onClick={() => setDetailImageIndex((detailImageIndex - 1 + images.length) % images.length)}><ChevronLeft className="h-5 w-5" /></Button>
                        <Button variant="ghost" size="icon" className="absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 bg-black/40 hover:bg-black/60 text-white" onClick={() => setDetailImageIndex((detailImageIndex + 1) % images.length)}><ChevronRight className="h-5 w-5" /></Button>
                        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-2">
                          {images.map((_, idx) => (
                            <button key={idx} className={`w-2.5 h-2.5 rounded-full transition-all ${idx === detailImageIndex ? 'bg-white scale-125' : 'bg-white/50'}`} onClick={() => setDetailImageIndex(idx)} />
                          ))}
                        </div>
                      </>
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 overflow-y-auto p-4 space-y-4" style={{ WebkitOverflowScrolling: 'touch', touchAction: 'pan-y' }}>
                    <div>
                      <h2 className="text-xl font-bold">{detailOffer.title_ar}</h2>
                      {detailOffer.description_ar && <p className="text-muted-foreground mt-1">{detailOffer.description_ar}</p>}
                    </div>

                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-2xl font-bold text-primary">{detailOffer.price.toLocaleString()}</p>
                        <p className="text-sm text-muted-foreground">{detailOffer.currency}</p>
                      </div>
                      {detailOffer.stock_quantity !== null && !isOutOfStock && (
                        <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">📦 متبقي: {detailOffer.stock_quantity}</Badge>
                      )}
                      {isOutOfStock && <Badge variant="destructive">نفذت الكمية</Badge>}
                    </div>

                    {/* Colors Selection */}
                    {availableColors.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm">اختر اللون:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableColors.map((color, idx) => (
                            <div key={idx} className="flex flex-col items-center gap-1">
                              <button
                                className={`w-10 h-10 rounded-full border-2 transition-all ${selectedColor?.hex_code === color.hex_code ? 'border-primary ring-2 ring-primary/30 scale-110' : 'border-border hover:scale-105'} ${color.stock_quantity === 0 ? 'opacity-50' : ''}`}
                                style={{ backgroundColor: color.hex_code }}
                                onClick={() => setSelectedColor(selectedColor?.hex_code === color.hex_code ? null : color)}
                                title={color.name_ar}
                                disabled={color.stock_quantity === 0}
                              />
                              {color.stock_quantity !== null && color.stock_quantity > 0 && (
                                <span className="text-[10px] text-muted-foreground">{color.stock_quantity}</span>
                              )}
                              {color.stock_quantity === 0 && (
                                <span className="text-[10px] text-destructive">نفذ</span>
                              )}
                            </div>
                          ))}
                        </div>
                        {selectedColor && (
                          <p className="text-sm text-muted-foreground">
                            اللون المختار: {selectedColor.name_ar}
                            {selectedColor.stock_quantity !== null && selectedColor.stock_quantity > 0 && (
                              <span className="text-amber-600 mr-2">(متبقي: {selectedColor.stock_quantity})</span>
                            )}
                          </p>
                        )}
                      </div>
                    )}

                    {/* Options Selection */}
                    {availableOptions.length > 0 && (
                      <div className="space-y-2">
                        <p className="font-medium text-sm">اختر الخيار:</p>
                        <div className="flex flex-wrap gap-2">
                          {availableOptions.map((opt, idx) => (
                            <Button
                              key={idx}
                              variant={selectedOption?.name_ar === opt.name_ar ? "default" : "outline"}
                              size="sm"
                              onClick={() => setSelectedOption(selectedOption?.name_ar === opt.name_ar ? null : opt)}
                              className="gap-1 flex-col h-auto py-2"
                              disabled={opt.stock_quantity === 0}
                            >
                              <span className="flex items-center gap-1">
                                {opt.name_ar}
                                {opt.price_adjustment !== 0 && (
                                  <span className="text-xs">({opt.price_adjustment > 0 ? '+' : ''}{opt.price_adjustment.toLocaleString()})</span>
                                )}
                              </span>
                              {opt.stock_quantity !== null && (
                                <span className={`text-[10px] ${opt.stock_quantity === 0 ? 'text-destructive' : 'text-muted-foreground'}`}>
                                  {opt.stock_quantity === 0 ? 'نفذ' : `متبقي: ${opt.stock_quantity}`}
                                </span>
                              )}
                            </Button>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Gift Tickets Info */}
                    <div className="p-3 bg-green-500/10 rounded-lg border border-green-500/20">
                      <p className="text-sm text-green-700 dark:text-green-400 font-medium text-center">
                        🎁 مع كل شراء تحصل على {detailOffer.gift_tickets} تذكرة مجاناً للمشاركة في السحوبات!
                      </p>
                    </div>

                    {/* Purchase Button */}
                    <Button 
                      className="w-full gap-2" 
                      size="lg"
                      onClick={() => {
                        setShowDetailDialog(false);
                        handlePurchaseClick(detailOffer);
                      }}
                      disabled={purchaseMutation.isPending || isOutOfStock || (user && !canAfford)}
                    >
                      {purchaseMutation.isPending ? <Loader2 className="h-5 w-5 animate-spin" /> : <ShoppingCart className="h-5 w-5" />}
                      {!user ? 'سجّل دخول للشراء' : isOutOfStock ? 'نفذت الكمية' : !canAfford ? 'رصيد غير كافٍ' : 'شراء الآن'}
                    </Button>
                  </div>
                </>
              );
            })()}
          </div>
        </DialogContent>
      </Dialog>

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