import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowRight, 
  Package, 
  MapPin, 
  CreditCard, 
  Wallet, 
  Truck, 
  Percent,
  CheckCircle,
  Loader2,
  AlertCircle,
  Plus,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { cn } from '@/lib/utils';
import AddressDialog from '@/components/AddressDialog';

type PaymentMethod = 'wallet' | 'cod' | 'partial';

interface ChatOrder {
  id: string;
  conversation_id: string;
  product_id: string;
  product_title: string;
  product_image: string | null;
  quantity: number;
  unit_price: number;
  total_price: number;
  notes: string | null;
  description: string | null;
  status: string;
  seller_id: string;
  customer_id: string;
  payment_method: PaymentMethod | null;
  partial_payment_percent: number | null;
  commission_rate: number;
  commission_amount: number;
}

interface UserAddress {
  id: string;
  full_name: string;
  phone_number: string;
  governorate: string;
  area: string;
  neighborhood: string;
  nearest_landmark: string;
  additional_notes: string;
  is_default: boolean;
}

const COMMISSION_RATES = {
  wallet: 0,
  cod: 10,
  partial: 5,
};

export default function ChatOrderCheckout() {
  const { orderId } = useParams<{ orderId: string }>();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  const [selectedAddress, setSelectedAddress] = useState<string | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('wallet');
  const [deliveryNotes, setDeliveryNotes] = useState('');
  const [showAddressDialog, setShowAddressDialog] = useState(false);

  // Fetch order details
  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['chat-order-checkout', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase
        .from('chat_orders')
        .select('*')
        .eq('id', orderId)
        .single();
      if (error) throw error;
      return data as ChatOrder;
    },
    enabled: !!orderId,
  });

  // Fetch user addresses
  const { data: addresses = [], isLoading: loadingAddresses } = useQuery({
    queryKey: ['user-addresses-checkout', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      if (error) throw error;
      return data as UserAddress[];
    },
    enabled: !!user,
  });

  // Fetch wallet balance
  const { data: walletBalance = 0 } = useQuery({
    queryKey: ['wallet-balance-checkout', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      return data?.balance || 0;
    },
    enabled: !!user,
  });

  // Set default address
  useEffect(() => {
    if (addresses.length && !selectedAddress) {
      const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
      setSelectedAddress(defaultAddr.id);
    }
  }, [addresses, selectedAddress]);

  // Use partial payment percent from order if set by merchant
  const partialPercent = order?.partial_payment_percent ?? 50;
  
  // Calculate amounts
  const baseTotal = order?.total_price || 0;
  const commissionRate = COMMISSION_RATES[paymentMethod];
  const commissionAmount = Math.round(baseTotal * (commissionRate / 100));
  const finalTotal = baseTotal + commissionAmount;
  
  const amountToPay = paymentMethod === 'wallet' 
    ? finalTotal
    : paymentMethod === 'partial'
    ? Math.round(finalTotal * (partialPercent / 100))
    : 0;
  
  const remainingAmount = finalTotal - amountToPay;
  const insufficientBalance = paymentMethod !== 'cod' && amountToPay > walletBalance;

  // Complete checkout mutation
  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!user || !order || !selectedAddress) throw new Error('بيانات ناقصة');
      if (insufficientBalance) throw new Error('رصيد المحفظة غير كافٍ');

      // Deduct from wallet using secure RPC function
      if (amountToPay > 0) {
        const { error: walletError } = await supabase.rpc('deduct_wallet_balance', {
          p_user_id: user.id,
          p_amount: amountToPay,
          p_description: `دفع طلب محادثة #${order.id.slice(0, 8)}`
        });
        if (walletError) throw new Error(walletError.message || 'فشل خصم المحفظة');
      }

      // Update order
      const { error: orderError } = await supabase
        .from('chat_orders')
        .update({
          payment_method: paymentMethod,
          commission_rate: commissionRate,
          commission_amount: commissionAmount,
          delivery_address_id: selectedAddress,
          delivery_notes: deliveryNotes || null,
          paid_amount: amountToPay,
          remaining_amount: remainingAmount,
          status: paymentMethod === 'cod' ? 'waiting_payment' : 'paid',
          checkout_completed_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      
      if (orderError) throw orderError;

      // Send order card message in chat
      await supabase.from('listing_messages').insert({
        conversation_id: order.conversation_id,
        sender_id: user.id,
        content: JSON.stringify({
          type: 'order_card',
          order_id: order.id,
          product_title: order.product_title,
          product_image: order.product_image,
          quantity: order.quantity,
          total_price: order.total_price,
          status: paymentMethod === 'cod' ? 'waiting_payment' : 'paid',
        }),
      });

      // Send system message
      await supabase.from('listing_messages').insert({
        conversation_id: order.conversation_id,
        sender_id: user.id,
        content: `🔔 تم إتمام الطلب بنجاح!\nالمبلغ المدفوع: ${amountToPay.toLocaleString()} د.ع${remainingAmount > 0 ? `\nالمتبقي عند الاستلام: ${remainingAmount.toLocaleString()} د.ع` : ''}\nطريقة الدفع: ${paymentMethod === 'wallet' ? 'المحفظة' : paymentMethod === 'cod' ? 'عند الاستلام' : 'دفعة مقدمة'}`,
      });

      // Notify merchant via Telegram
      if (order.seller_id) {
        supabase.functions.invoke('send-user-telegram-notification', {
          body: {
            user_id: order.seller_id,
            title: '🛒 طلب جديد مدفوع',
            message: `لديك طلب جديد: ${order.product_title} بقيمة ${order.total_price.toLocaleString()} د.ع`,
            notification_type: 'info',
          },
        }).catch(err => console.error('Telegram notify merchant failed:', err));
      }

      // Clear cart items for this merchant's products
      // Get seller's merchant_application id
      const { data: merchantApp } = await supabase
        .from('merchant_applications')
        .select('id')
        .eq('user_id', order.seller_id)
        .eq('status', 'approved')
        .maybeSingle();
      
      if (merchantApp) {
        await supabase
          .from('community_cart_items')
          .delete()
          .eq('user_id', user.id)
          .eq('merchant_id', merchantApp.id);
      }

      return order;
    },
    onSuccess: (order) => {
      toast.success('تم إتمام الطلب بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['chat-orders'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      queryClient.invalidateQueries({ queryKey: ['community-cart'] });
      navigate(`/community/messages?auto_open=${order.conversation_id}`);
    },
    onError: (error: Error) => {
      toast.error(error.message);
    },
  });

  if (loadingOrder || loadingAddresses) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <AlertCircle className="h-12 w-12 text-destructive" />
        <p className="text-lg font-medium">الطلب غير موجود</p>
        <Button onClick={() => navigate(-1)}>العودة</Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background pb-32">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card border-b">
        <div className="container mx-auto px-4 py-3 flex items-center gap-3">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => navigate(-1)}
            className="rounded-full"
          >
            <ArrowRight className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="font-bold">إتمام الطلب</h1>
            <p className="text-xs text-muted-foreground">طلب #{order.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-4 max-w-lg space-y-4">
        {/* Order Summary */}
        <Card className="overflow-hidden">
          <CardHeader className="pb-2 bg-muted/30">
            <CardTitle className="text-sm flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              ملخص الطلب
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4">
            <div className="flex gap-3">
              {order.product_image ? (
                <img
                  src={order.product_image}
                  alt={order.product_title}
                  className="h-20 w-20 rounded-lg object-cover"
                />
              ) : (
                <div className="h-20 w-20 rounded-lg bg-muted flex items-center justify-center">
                  <Package className="h-8 w-8 text-muted-foreground/30" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-semibold line-clamp-2">{order.product_title}</h3>
                {order.description && (
                  <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.description}</p>
                )}
                <div className="flex items-center gap-2 mt-2 text-sm">
                  <span className="text-muted-foreground">الكمية: {order.quantity}</span>
                  <span className="text-muted-foreground">×</span>
                  <span>{order.unit_price.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Address */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center justify-between">
              <span className="flex items-center gap-2">
                <MapPin className="h-4 w-4 text-primary" />
                عنوان التوصيل
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setShowAddressDialog(true)}
                className="text-xs h-7"
              >
                <Plus className="h-3 w-3 ml-1" />
                إضافة
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            {addresses.length === 0 ? (
              <div className="text-center py-4">
                <p className="text-sm text-muted-foreground mb-2">لا توجد عناوين محفوظة</p>
                <Button size="sm" onClick={() => setShowAddressDialog(true)}>
                  إضافة عنوان
                </Button>
              </div>
            ) : (
              <RadioGroup value={selectedAddress || ''} onValueChange={setSelectedAddress}>
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <Label
                      key={addr.id}
                      htmlFor={addr.id}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                        selectedAddress === addr.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:border-primary/50"
                      )}
                    >
                      <RadioGroupItem value={addr.id} id={addr.id} className="mt-1" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-sm">{addr.full_name}</span>
                          {addr.is_default && (
                            <Badge variant="secondary" className="text-[10px] h-4">افتراضي</Badge>
                          )}
                        </div>
                        <p className="text-xs text-muted-foreground mt-0.5">{addr.phone_number}</p>
                        <p className="text-xs text-muted-foreground">
                          {addr.governorate} - {addr.area}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{addr.nearest_landmark}</p>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            )}
            
            <Textarea
              placeholder="ملاحظات التوصيل (اختياري)"
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="mt-3 text-sm"
              rows={2}
            />
          </CardContent>
        </Card>

        {/* Payment Method */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              طريقة الدفع
            </CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <div className="space-y-2">
                {/* Wallet */}
                <Label
                  htmlFor="wallet"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentMethod === 'wallet' 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="wallet" id="wallet" />
                  <Wallet className="h-5 w-5 text-primary" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">المحفظة</span>
                    <p className="text-xs text-muted-foreground">دفع كامل المبلغ من رصيدك</p>
                  </div>
                  <Badge variant="secondary" className="text-green-600 bg-green-500/10">
                    بدون عمولة
                  </Badge>
                </Label>

                {/* Partial Payment */}
                <Label
                  htmlFor="partial"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentMethod === 'partial' 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="partial" id="partial" />
                  <Percent className="h-5 w-5 text-amber-500" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">دفعة مقدمة ({partialPercent}%)</span>
                    <p className="text-xs text-muted-foreground">ادفع جزء الآن والباقي عند الاستلام</p>
                  </div>
                  <Badge variant="secondary" className="text-amber-600 bg-amber-500/10">
                    +5% عمولة
                  </Badge>
                </Label>

                {/* COD */}
                <Label
                  htmlFor="cod"
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors",
                    paymentMethod === 'cod' 
                      ? "border-primary bg-primary/5" 
                      : "border-border hover:border-primary/50"
                  )}
                >
                  <RadioGroupItem value="cod" id="cod" />
                  <Truck className="h-5 w-5 text-blue-500" />
                  <div className="flex-1">
                    <span className="font-medium text-sm">الدفع عند الاستلام</span>
                    <p className="text-xs text-muted-foreground">ادفع عند استلام الطلب</p>
                  </div>
                  <Badge variant="secondary" className="text-red-600 bg-red-500/10">
                    +10% عمولة
                  </Badge>
                </Label>
              </div>
            </RadioGroup>
          </CardContent>
        </Card>

        {/* Price Breakdown */}
        <Card className="bg-gradient-to-b from-primary/5 to-background">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">سعر المنتج</span>
              <span>{baseTotal.toLocaleString()} د.ع</span>
            </div>
            
            {commissionAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">عمولة الدفع ({commissionRate}%)</span>
                <span className="text-amber-600">+{commissionAmount.toLocaleString()} د.ع</span>
              </div>
            )}
            
            <Separator />
            
            <div className="flex items-center justify-between font-bold">
              <span>الإجمالي</span>
              <span className="text-lg text-primary">{finalTotal.toLocaleString()} د.ع</span>
            </div>

            {paymentMethod !== 'wallet' && (
              <>
                <Separator />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المطلوب دفعه الآن</span>
                  <span className="font-semibold text-green-600">{amountToPay.toLocaleString()} د.ع</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">عند الاستلام</span>
                  <span className="font-semibold text-amber-600">{remainingAmount.toLocaleString()} د.ع</span>
                </div>
              </>
            )}

            {paymentMethod !== 'cod' && (
              <div className="flex items-center justify-between text-xs pt-2 border-t">
                <span className="text-muted-foreground">رصيد المحفظة</span>
                <span className={insufficientBalance ? 'text-destructive' : 'text-green-600'}>
                  {walletBalance.toLocaleString()} د.ع
                </span>
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Fixed Bottom Button */}
      <div className="fixed bottom-0 left-0 right-0 bg-card border-t p-4 shadow-lg">
        <div className="container mx-auto max-w-lg">
          {insufficientBalance ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4" />
                <span>رصيد المحفظة غير كافٍ - تحتاج {(amountToPay - walletBalance).toLocaleString()} د.ع إضافية</span>
              </div>
              <Button
                className="w-full"
                onClick={() => navigate('/profile?tab=wallet')}
              >
                <Wallet className="h-4 w-4 ml-2" />
                شحن المحفظة
              </Button>
            </div>
          ) : (
            <Button
              className="w-full h-12 text-base"
              onClick={() => checkoutMutation.mutate()}
              disabled={!selectedAddress || checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  جاري إتمام الطلب...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5 ml-2" />
                  تأكيد الطلب {amountToPay > 0 ? `ودفع ${amountToPay.toLocaleString()} د.ع` : ''}
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Address Dialog */}
      <AddressDialog
        open={showAddressDialog}
        onOpenChange={(open) => {
          setShowAddressDialog(open);
          if (!open) {
            queryClient.invalidateQueries({ queryKey: ['user-addresses-checkout'] });
          }
        }}
      />
    </div>
  );
}