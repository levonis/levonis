import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import Footer from "@/components/Footer";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { ShoppingBag, Gift, Loader2, Wallet, Info, Package, Ticket, History } from "lucide-react";
import { toast } from "sonner";
import ProductWithGiftCard from "@/components/ProductWithGiftCard";

interface ProductBasedCompetition {
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
  is_featured: boolean;
  product_id: string | null;
  is_product_based: boolean;
  status: string;
}

export default function ProductShop() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [showPurchaseConfirm, setShowPurchaseConfirm] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductBasedCompetition | null>(null);
  const [showInsufficientBalance, setShowInsufficientBalance] = useState(false);
  const [productNotes, setProductNotes] = useState<Record<string, string>>({});

  // Fetch product-based competitions
  const { data: products, isLoading } = useQuery({
    queryKey: ['product-shop'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('competitions')
        .select('*')
        .eq('is_product_based', true)
        .eq('status', 'active')
        .order('is_featured', { ascending: false })
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data as ProductBasedCompetition[];
    },
    staleTime: 30000,
  });

  // Fetch wallet balance
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

  // Fetch user's ticket balance
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

  // Purchase product mutation
  const purchaseMutation = useMutation({
    mutationFn: async (competitionId: string) => {
      const { data, error } = await supabase.rpc('purchase_product_with_gift_tickets', {
        p_competition_id: competitionId,
        p_quantity: 1
      });
      if (error) throw error;
      return data;
    },
    onSuccess: async (data: any) => {
      if (data.success) {
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
        queryClient.invalidateQueries({ queryKey: ['user-ticket-balance'] });
        queryClient.invalidateQueries({ queryKey: ['user-purchased-products'] });
        
        toast.success(
          <div className="flex flex-col gap-1">
            <span className="font-bold">🎉 تم الشراء بنجاح!</span>
            <span className="text-sm">حصلت على {data.gift_tickets} تذكرة هدية</span>
          </div>
        );
        
        // Send Telegram notification
        try {
          await supabase.functions.invoke('send-telegram-notification', {
            body: {
              message: `🛒 <b>شراء منتج جديد</b>\n\n` +
                `👤 المستخدم: ${user?.email || 'غير معروف'}\n` +
                `📦 المنتج: ${selectedProduct?.title_ar}\n` +
                `💰 السعر: ${selectedProduct?.ticket_price.toLocaleString()} ${selectedProduct?.currency}\n` +
                `🎁 التذاكر الهدية: ${data.gift_tickets}`,
            },
          });
        } catch (e) {
          console.error('Error sending telegram notification:', e);
        }
      } else {
        toast.error(data.error || 'حدث خطأ في الشراء');
      }
      setShowPurchaseConfirm(false);
      setSelectedProduct(null);
    },
    onError: (error) => {
      toast.error('حدث خطأ: ' + error.message);
    }
  });

  const handlePurchaseClick = useCallback((product: ProductBasedCompetition) => {
    if (!user) {
      navigate('/auth');
      return;
    }
    
    if ((wallet?.balance || 0) < product.ticket_price) {
      setShowInsufficientBalance(true);
      return;
    }
    
    setSelectedProduct(product);
    setShowPurchaseConfirm(true);
  }, [user, wallet, navigate]);

  return (
    <div className="min-h-screen bg-background flex flex-col" dir="rtl">
      {/* Insufficient Balance Dialog */}
      <AlertDialog open={showInsufficientBalance} onOpenChange={setShowInsufficientBalance}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Wallet className="h-5 w-5" />
              رصيد غير كافٍ
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right">
              رصيد المحفظة غير كافٍ لشراء هذا المنتج.
              <br />
              رصيدك الحالي: <span className="font-bold text-foreground">{(wallet?.balance || 0).toLocaleString()} دينار</span>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogCancel>إغلاق</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={showPurchaseConfirm} onOpenChange={setShowPurchaseConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <ShoppingBag className="h-5 w-5 text-primary" />
              تأكيد شراء المنتج
            </AlertDialogTitle>
            <AlertDialogDescription className="text-right" asChild>
              <div className="space-y-3">
                {selectedProduct && (
                  <>
                    <p>
                      هل تريد شراء <span className="font-bold text-foreground">{selectedProduct.title_ar}</span>؟
                    </p>
                    <div className="bg-secondary/50 rounded-lg p-3 space-y-2">
                      <div className="flex justify-between">
                        <span>سعر المنتج:</span>
                        <span className="font-bold">{selectedProduct.ticket_price.toLocaleString()} {selectedProduct.currency}</span>
                      </div>
                      <div className="flex justify-between text-emerald-600">
                        <span className="flex items-center gap-1">
                          <Gift className="h-4 w-4" />
                          تذاكر هدية:
                        </span>
                        <span className="font-bold">+{selectedProduct.gift_tickets_per_purchase} تذكرة</span>
                      </div>
                    </div>
                    {productNotes[selectedProduct.id] && (
                      <div className="bg-muted/50 rounded-lg p-3 border">
                        <p className="text-[10px] text-muted-foreground mb-1">📝 ملاحظاتك:</p>
                        <p className="text-xs">{productNotes[selectedProduct.id]}</p>
                      </div>
                    )}
                    <div className="bg-amber-500/10 rounded-lg p-3 border border-amber-500/20">
                      <div className="flex items-start gap-2">
                        <Info className="h-4 w-4 text-amber-600 mt-0.5 flex-shrink-0" />
                        <p className="text-xs text-amber-700 dark:text-amber-400">
                          الشراء يتم على منتجات حقيقية، والتذاكر هدية مجانية مرفقة مع المنتج.
                        </p>
                      </div>
                    </div>
                  </>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => {
                if (selectedProduct) {
                  purchaseMutation.mutate(selectedProduct.id);
                }
              }}
              className="gap-1"
              disabled={purchaseMutation.isPending}
            >
              {purchaseMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ShoppingBag className="h-4 w-4" />
              )}
              تأكيد الشراء
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Header Bar */}
      <div className="sticky top-0 z-50 bg-card/95 backdrop-blur border-b shadow-sm">
        <div className="container mx-auto px-2 sm:px-4 py-2 sm:py-3">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              {user && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-secondary/50 rounded-full text-sm">
                  <Ticket className="h-4 w-4 text-primary" />
                  <span className="font-medium">{userTicketBalance || 0} تذكرة</span>
                </div>
              )}
              {user && wallet && (
                <div className="inline-flex items-center gap-2 px-3 py-1.5 bg-primary/10 rounded-full text-sm">
                  <Wallet className="h-4 w-4 text-primary" />
                  <span className="font-medium">{wallet.balance.toLocaleString()} دينار</span>
                </div>
              )}
            </div>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate('/my-products')}
              className="gap-1"
            >
              <Package className="h-4 w-4" />
              منتجاتي
            </Button>
          </div>
        </div>
      </div>

      <main className="flex-1 container mx-auto px-4 py-6">
        <div className="text-center mb-6">
          <h1 className="text-2xl font-bold flex items-center justify-center gap-2 mb-1">
            <ShoppingBag className="h-6 w-6 text-primary" />
            متجر المنتجات
          </h1>
          <p className="text-sm text-muted-foreground mb-3">
            اشترِ منتجات حقيقية واحصل على تذاكر هدية مجانية!
          </p>
          
          {/* Legal Notice */}
          <div className="max-w-lg mx-auto bg-gradient-to-r from-emerald-500/10 via-green-500/10 to-teal-500/10 rounded-xl p-4 border border-emerald-500/20">
            <div className="flex items-start gap-2">
              <Info className="h-5 w-5 text-emerald-600 mt-0.5 flex-shrink-0" />
              <div className="text-right">
                <p className="text-sm font-medium text-emerald-700 dark:text-emerald-400">
                  ملاحظة هامة
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  الشراء يتم على منتجات حقيقية بأسعار واضحة. التذاكر المرفقة هي هدية مجانية وليست سبب الشراء. لا يوجد أي شكل من أشكال المقامرة أو الحظ المدفوع.
                </p>
              </div>
            </div>
          </div>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
          </div>
        ) : products?.length === 0 ? (
          <Card className="text-center py-8 max-w-sm mx-auto">
            <CardContent className="pt-6">
              <ShoppingBag className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">لا توجد منتجات متاحة حالياً</p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
            {products?.map((product) => (
              <ProductWithGiftCard
                key={product.id}
                competition={product}
                onPurchase={() => handlePurchaseClick(product)}
                isPurchasing={purchaseMutation.isPending}
                isAuthenticated={!!user}
                walletBalance={wallet?.balance || 0}
                notes={productNotes[product.id] || ''}
                onNotesChange={(notes) => setProductNotes(prev => ({ ...prev, [product.id]: notes }))}
              />
            ))}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
}
