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
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { ShoppingBag, Gift, Wallet, Ticket, Package, ArrowRight, Loader2, Info, CheckCircle, History, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { VisuallyHidden } from "@radix-ui/react-visually-hidden";
import ProductGiftCard from "@/components/ProductGiftCard";
import Header from "@/components/Header";

interface ProductWithGift {
  id: string;
  title: string;
  title_ar: string;
  description: string | null;
  description_ar: string | null;
  image_url: string | null;
  images: string[] | null;
  prize_description: string;
  prize_description_ar: string;
  prize_value: number | null;
  ticket_price: number;
  currency: string;
  gift_tickets_per_purchase: number;
  legal_disclaimer: string | null;
  is_featured?: boolean;
  product_id?: string;
  status: string;
}

export default function ProductsWithGifts() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithGift | null>(null);

  // Fetch product-based competitions (is_product_based = true)
  const { data: products, isLoading } = useQuery({
    queryKey: ['products-with-gifts'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_product_based', true)
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as unknown as ProductWithGift[];
    },
    staleTime: 30000,
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
    enabled: !!user,
    staleTime: 30000,
  });

  // Fetch user ticket balance
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
    enabled: !!user,
    staleTime: 30000,
  });

  // Fetch user purchased products
  const { data: purchasedProducts } = useQuery({
    queryKey: ['user-purchased-products', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_purchased_products')
        .select('competition_id')
        .eq('user_id', user.id);
      
      if (error) throw error;
      return data?.map(p => p.competition_id) || [];
    },
    enabled: !!user,
    staleTime: 30000,
  });

  // Purchase mutation
  const purchaseMutation = useMutation({
    mutationFn: async (productId: string) => {
      const { data, error } = await supabase.rpc('purchase_product_with_gift_tickets', {
        p_competition_id: productId,
        p_quantity: 1
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      if (data?.success) {
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-purchased-products'] });
        
        toast.success(`تم شراء المنتج بنجاح! حصلت على ${data.tickets_awarded || selectedProduct?.gift_tickets_per_purchase || 1} تذكرة مجانية كهدية`);
        
        // Send Telegram notification
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              message: `🛒 <b>شراء منتج جديد</b>\n\n` +
                `👤 المستخدم: ${user?.email || 'غير معروف'}\n` +
                `📦 المنتج: ${selectedProduct?.title_ar}\n` +
                `💰 السعر: ${selectedProduct?.ticket_price?.toLocaleString()} ${selectedProduct?.currency}\n` +
                `🎁 التذاكر الهدية: ${selectedProduct?.gift_tickets_per_purchase}`,
            },
          });
        } catch (e) {
          console.error('Error sending telegram notification:', e);
        }
        
        setShowPurchaseConfirm(false);
        setSelectedProduct(null);
      } else {
        toast.error(data?.message || 'حدث خطأ أثناء الشراء');
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const handlePurchase = (productId: string) => {
    const product = products?.find(p => p.id === productId);
    if (!product) return;

    setSelectedProduct(product);
    
    const balance = wallet?.balance || 0;
    if (balance < product.ticket_price) {
      setShowInsufficientBalance(true);
    } else {
      setShowPurchaseConfirm(true);
    }
  };

  const confirmPurchase = () => {
    if (selectedProduct) {
      purchaseMutation.mutate(selectedProduct.id);
    }
  };

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <Header />
      
      <main className="container mx-auto px-4 py-6 pb-24">
        {/* Page Header */}
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-3 bg-primary/10 rounded-xl">
              <ShoppingBag className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-bold">منتجات مع هدايا</h1>
              <p className="text-sm text-muted-foreground">اشتري منتجات حقيقية واحصل على تذاكر مجانية كهدية</p>
            </div>
          </div>

          {/* Legal Notice */}
          <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-xl p-4 mb-6">
            <div className="flex items-start gap-3">
              <Info className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
              <div>
                <h3 className="font-semibold text-green-800 dark:text-green-200 text-sm mb-1">نظام شراء شفاف وحلال</h3>
                <p className="text-xs text-green-700 dark:text-green-300">
                  الشراء يتم على منتجات حقيقية بسعر واضح. التذاكر المرفقة هي هدايا مجانية وليست للبيع. لا يوجد أي نظام مقامرة أو حظ مدفوع.
                </p>
              </div>
            </div>
          </div>

          {/* User Stats */}
          {user && (
            <div className="grid grid-cols-2 gap-3 mb-6">
              <Card className="bg-gradient-to-br from-primary/10 to-primary/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-primary/20 rounded-lg">
                    <Wallet className="h-5 w-5 text-primary" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">رصيدك</p>
                    <p className="font-bold">{(wallet?.balance || 0).toLocaleString()} د.ع</p>
                  </div>
                </CardContent>
              </Card>
              <Card className="bg-gradient-to-br from-green-500/10 to-green-500/5">
                <CardContent className="p-4 flex items-center gap-3">
                  <div className="p-2 bg-green-500/20 rounded-lg">
                    <Ticket className="h-5 w-5 text-green-600" />
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground">تذاكرك المجانية</p>
                    <p className="font-bold">{userTicketBalance || 0} تذكرة</p>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <div className="flex gap-2 flex-wrap mb-6">
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/my-products')}>
              <Package className="h-4 w-4" />
              منتجاتي المشتراة
            </Button>
            <Button variant="outline" size="sm" className="gap-2" onClick={() => navigate('/wallet')}>
              <Wallet className="h-4 w-4" />
              شحن الرصيد
            </Button>
          </div>
        </div>

        {/* Products Grid */}
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products && products.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {products.map((product) => (
              <ProductGiftCard
                key={product.id}
                product={{
                  id: product.id,
                  title_ar: product.title_ar,
                  description_ar: product.description_ar,
                  image_url: product.image_url,
                  images: product.images,
                  price: product.ticket_price,
                  currency: product.currency,
                  gift_tickets: product.gift_tickets_per_purchase || 1,
                  is_featured: product.is_featured,
                  legal_disclaimer: product.legal_disclaimer,
                  prize_description_ar: product.prize_description_ar,
                }}
                onPurchase={handlePurchase}
                isPurchasing={purchaseMutation.isPending && selectedProduct?.id === product.id}
                isAuthenticated={!!user}
                userBalance={wallet?.balance || 0}
                alreadyPurchased={purchasedProducts?.includes(product.id)}
              />
            ))}
          </div>
        ) : (
          <div className="text-center py-20">
            <Package className="h-16 w-16 mx-auto text-muted-foreground/50 mb-4" />
            <h3 className="font-semibold text-lg mb-2">لا توجد منتجات متاحة حالياً</h3>
            <p className="text-muted-foreground text-sm">سيتم إضافة منتجات جديدة قريباً</p>
          </div>
        )}
      </main>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={showPurchaseConfirm} onOpenChange={setShowPurchaseConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              تأكيد شراء المنتج
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4">
                <div className="bg-muted/50 rounded-lg p-4">
                  <h4 className="font-semibold mb-2">{selectedProduct?.title_ar}</h4>
                  <div className="flex justify-between text-sm">
                    <span>السعر:</span>
                    <span className="font-bold">{selectedProduct?.ticket_price?.toLocaleString()} {selectedProduct?.currency}</span>
                  </div>
                </div>
                
                <div className="bg-green-50 dark:bg-green-950/20 border border-green-200 dark:border-green-800 rounded-lg p-4">
                  <div className="flex items-center gap-2 text-green-700 dark:text-green-300">
                    <Gift className="h-5 w-5" />
                    <span className="font-semibold">هديتك المجانية</span>
                  </div>
                  <p className="text-sm text-green-600 dark:text-green-400 mt-1">
                    ستحصل على <span className="font-bold">{selectedProduct?.gift_tickets_per_purchase || 1} تذكرة مجانية</span> كهدية مع هذا المنتج
                  </p>
                </div>

                <p className="text-xs text-muted-foreground">
                  * المنتج سيُضاف إلى صفحة "منتجاتي" ويمكنك طلب توصيله لاحقاً
                </p>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={confirmPurchase}
              disabled={purchaseMutation.isPending}
              className="gap-2"
            >
              {purchaseMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري الشراء...
                </>
              ) : (
                <>
                  <CheckCircle className="h-4 w-4" />
                  تأكيد الشراء
                </>
              )}
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Insufficient Balance Dialog */}
      <AlertDialog open={showInsufficientBalance} onOpenChange={setShowInsufficientBalance}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Wallet className="h-5 w-5" />
              الرصيد غير كافي
            </AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-3">
                <p>رصيدك الحالي غير كافٍ لشراء هذا المنتج.</p>
                <div className="bg-muted/50 rounded-lg p-3 space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span>رصيدك الحالي:</span>
                    <span className="font-bold">{(wallet?.balance || 0).toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between">
                    <span>سعر المنتج:</span>
                    <span className="font-bold">{selectedProduct?.ticket_price?.toLocaleString()} د.ع</span>
                  </div>
                  <div className="flex justify-between text-destructive border-t pt-1">
                    <span>المبلغ الناقص:</span>
                    <span className="font-bold">
                      {((selectedProduct?.ticket_price || 0) - (wallet?.balance || 0)).toLocaleString()} د.ع
                    </span>
                  </div>
                </div>
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction onClick={() => navigate('/wallet')} className="gap-2">
              <Wallet className="h-4 w-4" />
              شحن الرصيد
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Footer />
    </div>
  );
}
