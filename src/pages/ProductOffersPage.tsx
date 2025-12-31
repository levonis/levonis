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
import { Input } from "@/components/ui/input";
import { Gift, Loader2, Wallet, Plus, Minus, Package, ShoppingBag, Ticket, ArrowRight, Check } from "lucide-react";
import { toast } from "sonner";
import OptimizedImage from "@/components/OptimizedImage";

interface ProductOffer {
  id: string;
  title_ar: string;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  ticket_price: number;
  gift_tickets_per_purchase: number;
  status: 'active';
  currency: string;
}

export default function ProductOffersPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedOffer, setSelectedOffer] = useState<ProductOffer | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);

  // Fetch active product offers
  const { data: productOffers, isLoading } = useQuery({
    queryKey: ['product-offers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_product_based', true)
        .eq('status', 'active')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProductOffer[];
    }
  });

  // Fetch user wallet
  const { data: wallet } = useQuery({
    queryKey: ['user-wallet', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user
  });

  // Fetch user tickets
  const { data: userTicketBalance } = useQuery({
    queryKey: ['user-ticket-balance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_tickets')
        .select('ticket_count')
        .eq('user_id', user.id)
        .single();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data?.ticket_count || 0;
    },
    enabled: !!user
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async ({ offerId, quantity }: { offerId: string; quantity: number }) => {
      const { data, error } = await supabase.rpc('purchase_product_with_gift_tickets', {
        p_competition_id: offerId,
        p_quantity: quantity
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-purchased-products'] });
        
        toast.success(`تم شراء ${data.quantity} منتج + ${data.gift_tickets} تذكرة هدية!`);
        
        // Send telegram notification
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              message: `🛒 <b>شراء منتج جديد</b>\n\n` +
                `👤 المستخدم: ${user?.email || 'غير معروف'}\n` +
                `📦 المنتج: ${selectedOffer?.title_ar}\n` +
                `🔢 الكمية: ${data.quantity}\n` +
                `🎁 التذاكر الهدية: ${data.gift_tickets}\n` +
                `💰 المبلغ: ${data.total_cost?.toLocaleString()} دينار`,
            },
          });
        } catch (e) {
          console.error('Error sending telegram notification:', e);
        }
        
        setShowPurchaseConfirm(false);
        setSelectedOffer(null);
        setPurchaseQuantity(1);
      } else {
        toast.error(data.error);
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const handlePurchaseClick = (offer: ProductOffer) => {
    if (!user) {
      navigate('/auth');
      return;
    }

    setSelectedOffer(offer);
    setPurchaseQuantity(1);

    const totalCost = offer.ticket_price * 1;
    if ((wallet?.balance || 0) < totalCost) {
      setShowInsufficientBalance(true);
    } else {
      setShowPurchaseConfirm(true);
    }
  };

  const confirmPurchase = () => {
    if (!selectedOffer) return;
    
    const totalCost = selectedOffer.ticket_price * purchaseQuantity;
    if ((wallet?.balance || 0) < totalCost) {
      setShowPurchaseConfirm(false);
      setShowInsufficientBalance(true);
      return;
    }

    purchaseMutation.mutate({
      offerId: selectedOffer.id,
      quantity: purchaseQuantity
    });
  };

  const totalCost = selectedOffer ? selectedOffer.ticket_price * purchaseQuantity : 0;
  const totalGiftTickets = selectedOffer ? selectedOffer.gift_tickets_per_purchase * purchaseQuantity : 0;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="container mx-auto px-4 py-8">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold mb-2">عروض المنتجات والهدايا</h1>
          <p className="text-muted-foreground">
            اشترِ منتجات حقيقية واحصل على تذاكر هدية مجانية
          </p>
        </div>

        {/* User Balances */}
        {user && (
          <div className="flex flex-wrap justify-center gap-4 mb-8">
            <Card className="px-6 py-3">
              <div className="flex items-center gap-3">
                <Wallet className="h-5 w-5 text-primary" />
                <div>
                  <p className="text-xs text-muted-foreground">رصيد المحفظة</p>
                  <p className="font-bold">{(wallet?.balance || 0).toLocaleString()} دينار</p>
                </div>
              </div>
            </Card>
            <Card className="px-6 py-3">
              <div className="flex items-center gap-3">
                <Ticket className="h-5 w-5 text-green-500" />
                <div>
                  <p className="text-xs text-muted-foreground">التذاكر المتاحة</p>
                  <p className="font-bold">{userTicketBalance || 0} تذكرة</p>
                </div>
              </div>
            </Card>
            <Button
              variant="outline"
              onClick={() => navigate('/my-products')}
            >
              <Package className="h-4 w-4 ml-2" />
              مشترياتي
            </Button>
          </div>
        )}

        {/* Product Offers Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin" />
          </div>
        ) : productOffers && productOffers.length > 0 ? (
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {productOffers.map((offer) => (
              <Card key={offer.id} className="overflow-hidden group hover:shadow-xl transition-all duration-300">
                <div className="aspect-square relative bg-muted">
                  {offer.image_url ? (
                    <OptimizedImage
                      src={offer.image_url}
                      alt={offer.title_ar}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Package className="h-16 w-16 text-muted-foreground" />
                    </div>
                  )}
                  
                  {/* Gift Badge */}
                  <div className="absolute top-3 left-3">
                    <Badge className="bg-green-500 text-white flex items-center gap-1 px-3 py-1">
                      <Gift className="h-3 w-3" />
                      +{offer.gift_tickets_per_purchase} تذكرة هدية
                    </Badge>
                  </div>
                </div>

                <CardContent className="p-5">
                  <h3 className="font-bold text-lg mb-2">{offer.title_ar}</h3>
                  
                  {offer.description_ar && (
                    <p className="text-sm text-muted-foreground mb-4 line-clamp-2">
                      {offer.description_ar}
                    </p>
                  )}

                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <p className="text-xs text-muted-foreground">سعر المنتج</p>
                      <p className="text-2xl font-bold text-primary">
                        {offer.ticket_price?.toLocaleString()} <span className="text-sm">{offer.currency}</span>
                      </p>
                    </div>
                  </div>

                  {/* Info Box */}
                  <div className="bg-green-500/10 border border-green-500/20 rounded-lg p-3 mb-4">
                    <div className="flex items-center gap-2 text-green-400">
                      <Check className="h-4 w-4" />
                      <span className="text-sm">التذاكر هدية مجانية مع المنتج</span>
                    </div>
                  </div>

                  <Button
                    className="w-full"
                    onClick={() => handlePurchaseClick(offer)}
                  >
                    <ShoppingBag className="h-4 w-4 ml-2" />
                    شراء المنتج
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="p-12 text-center">
            <Package className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <h3 className="text-lg font-medium mb-2">لا توجد عروض حالياً</h3>
            <p className="text-muted-foreground">
              ترقبوا العروض الجديدة قريباً
            </p>
          </Card>
        )}
      </div>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={showPurchaseConfirm} onOpenChange={setShowPurchaseConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد شراء المنتج</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="bg-muted p-4 rounded-lg">
                  <p className="font-medium mb-2">{selectedOffer?.title_ar}</p>
                  <p className="text-sm text-muted-foreground">
                    سعر الوحدة: {selectedOffer?.ticket_price?.toLocaleString()} {selectedOffer?.currency}
                  </p>
                </div>

                {/* Quantity Selector */}
                <div className="flex items-center justify-center gap-4">
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPurchaseQuantity(Math.max(1, purchaseQuantity - 1))}
                    disabled={purchaseQuantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <Input
                    type="number"
                    value={purchaseQuantity}
                    onChange={(e) => setPurchaseQuantity(Math.max(1, Math.min(100, parseInt(e.target.value) || 1)))}
                    className="w-20 text-center"
                    min={1}
                    max={100}
                  />
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={() => setPurchaseQuantity(Math.min(100, purchaseQuantity + 1))}
                    disabled={purchaseQuantity >= 100}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>

                <div className="bg-primary/10 p-4 rounded-lg space-y-2">
                  <div className="flex justify-between">
                    <span>المجموع:</span>
                    <span className="font-bold">{totalCost.toLocaleString()} دينار</span>
                  </div>
                  <div className="flex justify-between text-green-400">
                    <span>التذاكر الهدية:</span>
                    <span className="font-bold">+{totalGiftTickets} تذكرة</span>
                  </div>
                </div>

                <p className="text-xs text-muted-foreground text-center">
                  سيتم خصم المبلغ من رصيد محفظتك
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={confirmPurchase}
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الشراء
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient Balance Dialog */}
      <AlertDialog open={showInsufficientBalance} onOpenChange={setShowInsufficientBalance}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>رصيد غير كافٍ</AlertDialogTitle>
            <AlertDialogDescription>
              رصيد محفظتك الحالي ({(wallet?.balance || 0).toLocaleString()} دينار) غير كافٍ لإتمام عملية الشراء.
              يرجى شحن المحفظة أولاً.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => setShowInsufficientBalance(false)}>
              حسناً
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
