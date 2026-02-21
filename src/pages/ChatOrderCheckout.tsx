import { useState, useEffect } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  ArrowRight, Package, MapPin, Wallet, Truck, Percent,
  CheckCircle, Loader2, AlertCircle, Plus, Shield, CreditCard, Banknote,
} from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import AddressDialog from '@/components/AddressDialog';
import { useCommissionSettings } from '@/hooks/useCommissionSettings';

type PaymentMethod = 'wallet' | 'half' | 'quarter' | 'cod';

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

// Commission rates are now dynamic from useCommissionSettings

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

  const { data: commissionConfig } = useCommissionSettings();

  const { data: order, isLoading: loadingOrder } = useQuery({
    queryKey: ['chat-order-checkout', orderId],
    queryFn: async () => {
      if (!orderId) return null;
      const { data, error } = await supabase.from('chat_orders').select('*').eq('id', orderId).single();
      if (error) throw error;
      return data as ChatOrder;
    },
    enabled: !!orderId,
  });

  const { data: addresses = [], isLoading: loadingAddresses } = useQuery({
    queryKey: ['user-addresses-checkout', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase.from('user_addresses').select('*').eq('user_id', user.id).order('is_default', { ascending: false });
      if (error) throw error;
      return data as UserAddress[];
    },
    enabled: !!user,
  });

  const { data: walletBalance = 0 } = useQuery({
    queryKey: ['wallet-balance-checkout', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data } = await supabase.from('user_wallets').select('balance').eq('user_id', user.id).maybeSingle();
      return data?.balance || 0;
    },
    enabled: !!user,
  });

  useEffect(() => {
    if (addresses.length && !selectedAddress) {
      const defaultAddr = addresses.find(a => a.is_default) || addresses[0];
      setSelectedAddress(defaultAddr.id);
    }
  }, [addresses, selectedAddress]);

  // Dynamic commission calculation
  const baseTotal = order?.total_price || 0;
  
  const getCommissionRate = (): number => {
    if (!commissionConfig) return 0;
    switch (paymentMethod) {
      case 'half': return commissionConfig.half_payment_fee;
      case 'quarter': return commissionConfig.quarter_payment_fee;
      case 'cod': return 0; // COD fee is from merchant, not customer
      default: return 0; // wallet = no extra fee
    }
  };

  const getPartialPercent = (): number => {
    switch (paymentMethod) {
      case 'half': return 50;
      case 'quarter': return 25;
      case 'cod': return 0;
      default: return 100;
    }
  };

  const commissionRate = getCommissionRate();
  const commissionAmount = Math.round(baseTotal * (commissionRate / 100));
  const finalTotal = baseTotal + commissionAmount;
  const partialPercent = getPartialPercent();
  const amountToPay = paymentMethod === 'wallet' ? finalTotal : Math.round(finalTotal * (partialPercent / 100));
  const remainingAmount = finalTotal - amountToPay;
  const insufficientBalance = paymentMethod !== 'cod' && amountToPay > walletBalance;

  const checkoutMutation = useMutation({
    mutationFn: async () => {
      if (!user || !order || !selectedAddress) throw new Error('بيانات ناقصة');
      if (insufficientBalance) throw new Error('رصيد المحفظة غير كافٍ');

      const paymentLabels: Record<PaymentMethod, string> = {
        wallet: 'المحفظة',
        half: 'نصف المبلغ',
        quarter: 'ربع المبلغ',
        cod: 'الدفع عند الاستلام',
      };

      // Deduct wallet for non-COD
      if (amountToPay > 0 && paymentMethod !== 'cod') {
        const { error: walletError } = await supabase.rpc('deduct_wallet_balance', {
          p_user_id: user.id,
          p_amount: amountToPay,
          p_description: `دفع طلب محادثة #${order.id.slice(0, 8)}`
        });
        if (walletError) throw new Error(walletError.message || 'فشل خصم المحفظة');
      }

      // For COD: charge merchant debt
      if (paymentMethod === 'cod' && commissionConfig) {
        const codFeeAmount = Math.round(baseTotal * (commissionConfig.cod_merchant_fee / 100));
        if (codFeeAmount > 0) {
          // Get merchant app id
          const { data: merchantApp } = await supabase
            .from('merchant_applications')
            .select('id, user_id')
            .eq('user_id', order.seller_id)
            .eq('status', 'approved')
            .maybeSingle();

          if (merchantApp) {
            // Try deduct from merchant wallet first
            const { data: merchantWallet } = await supabase
              .from('user_wallets')
              .select('balance')
              .eq('user_id', order.seller_id)
              .maybeSingle();

            const merchantBalance = merchantWallet?.balance || 0;

            if (merchantBalance >= codFeeAmount) {
              await supabase.rpc('deduct_wallet_balance', {
                p_user_id: order.seller_id,
                p_amount: codFeeAmount,
                p_description: `عمولة COD - طلب #${order.id.slice(0, 8)}`
              });
            } else {
              // Record as debt
              const debtAmount = codFeeAmount - Math.max(0, merchantBalance);
              if (merchantBalance > 0) {
                await supabase.rpc('deduct_wallet_balance', {
                  p_user_id: order.seller_id,
                  p_amount: merchantBalance,
                  p_description: `عمولة COD جزئية - طلب #${order.id.slice(0, 8)}`
                });
              }
              await supabase.from('merchant_debts').insert({
                merchant_user_id: order.seller_id,
                merchant_application_id: merchantApp.id,
                amount: debtAmount,
                reason: `عمولة الدفع عند الاستلام - طلب #${order.id.slice(0, 8)}`,
                order_id: order.id,
                status: 'pending',
              });
              // Update total debt
              await supabase
                .from('merchant_public_profiles')
                .update({ total_debt: (await supabase.from('merchant_debts').select('amount').eq('merchant_application_id', merchantApp.id).eq('status', 'pending').then(r => (r.data || []).reduce((s, d) => s + Number(d.amount), 0))) })
                .eq('id', merchantApp.id);
            }
          }
        }
      }

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
          partial_payment_percent: partialPercent,
          status: paymentMethod === 'cod' ? 'confirmed' : 'paid',
          checkout_completed_at: new Date().toISOString(),
        })
        .eq('id', order.id);
      if (orderError) throw orderError;

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
          status: paymentMethod === 'cod' ? 'confirmed' : 'paid',
        }),
      });

      await supabase.from('listing_messages').insert({
        conversation_id: order.conversation_id,
        sender_id: user.id,
        content: `🔔 تم إتمام الطلب بنجاح!\n${amountToPay > 0 ? `المبلغ المدفوع: ${amountToPay.toLocaleString()} د.ع\n` : ''}${remainingAmount > 0 ? `المتبقي عند الاستلام: ${remainingAmount.toLocaleString()} د.ع\n` : ''}طريقة الدفع: ${paymentLabels[paymentMethod]}`,
      });

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

      const { data: merchantApp } = await supabase
        .from('merchant_applications')
        .select('id')
        .eq('user_id', order.seller_id)
        .eq('status', 'approved')
        .maybeSingle();
      if (merchantApp) {
        await supabase.from('community_cart_items').delete().eq('user_id', user.id).eq('merchant_id', merchantApp.id);
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
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4 px-6">
        <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
          <AlertCircle className="h-7 w-7 text-destructive" />
        </div>
        <p className="font-bold text-foreground">الطلب غير موجود</p>
        <Button variant="outline" onClick={() => navigate(-1)} className="rounded-full">العودة</Button>
      </div>
    );
  }

  const selectedAddr = addresses.find(a => a.id === selectedAddress);

  return (
    <div className="min-h-screen bg-background pb-32" dir="rtl">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-card/90 backdrop-blur-xl border-b border-primary/10">
        <div className="flex items-center gap-3 px-4 h-[56px]">
          <button
            onClick={() => navigate(-1)}
            className="h-9 w-9 rounded-full bg-primary/10 flex items-center justify-center hover:bg-primary/20 transition-colors"
          >
            <ArrowRight className="h-4 w-4 text-primary" />
          </button>
          <div>
            <h1 className="text-base font-bold text-foreground">إتمام الطلب</h1>
            <p className="text-[10px] text-muted-foreground">#{order.id.slice(0, 8)}</p>
          </div>
        </div>
      </header>

      {/* Steps indicator */}
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-1">
          {['الطلب', 'العنوان', 'الدفع'].map((step, i) => (
            <div key={step} className="flex-1 flex flex-col items-center gap-1">
              <div className={cn(
                "h-1 w-full rounded-full transition-colors",
                "bg-primary"
              )} />
              <span className="text-[10px] text-primary font-medium">{step}</span>
            </div>
          ))}
        </div>
      </div>

      <main className="px-4 space-y-4 pb-4">
        {/* Order Summary */}
        <section className="rounded-2xl bg-card border border-primary/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/5">
            <Package className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">ملخص الطلب</h2>
          </div>
          <div className="p-4">
            <div className="flex gap-3">
              {order.product_image ? (
                <img
                  src={order.product_image}
                  alt={order.product_title}
                  className="h-20 w-20 rounded-xl object-cover border border-primary/10"
                />
              ) : (
                <div className="h-20 w-20 rounded-xl bg-background flex items-center justify-center border border-primary/10">
                  <Package className="h-7 w-7 text-primary/15" />
                </div>
              )}
              <div className="flex-1 min-w-0">
                <h3 className="font-semibold text-sm text-foreground line-clamp-2 leading-snug">{order.product_title}</h3>
                {order.description && (
                  <p className="text-[11px] text-muted-foreground mt-1 line-clamp-2">{order.description}</p>
                )}
                <div className="flex items-center gap-3 mt-2">
                  <span className="text-xs text-muted-foreground">×{order.quantity}</span>
                  <span className="text-sm font-bold text-primary">{order.unit_price.toLocaleString()} د.ع</span>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Delivery Address */}
        <section className="rounded-2xl bg-card border border-primary/10 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-primary/5">
            <div className="flex items-center gap-2">
              <MapPin className="h-4 w-4 text-primary" />
              <h2 className="text-sm font-bold text-foreground">عنوان التوصيل</h2>
            </div>
            <button
              onClick={() => setShowAddressDialog(true)}
              className="flex items-center gap-1 text-[11px] text-primary font-medium hover:underline"
            >
              <Plus className="h-3 w-3" />
              إضافة
            </button>
          </div>
          <div className="p-4">
            {addresses.length === 0 ? (
              <div className="text-center py-6">
                <MapPin className="h-8 w-8 text-primary/15 mx-auto mb-2" />
                <p className="text-sm text-muted-foreground mb-3">لا توجد عناوين</p>
                <Button size="sm" onClick={() => setShowAddressDialog(true)} className="rounded-full">
                  إضافة عنوان
                </Button>
              </div>
            ) : (
              <RadioGroup value={selectedAddress || ''} onValueChange={setSelectedAddress}>
                <div className="space-y-2">
                  {addresses.map((addr) => (
                    <Label
                      key={addr.id}
                      htmlFor={`addr-${addr.id}`}
                      className={cn(
                        "flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all",
                        selectedAddress === addr.id 
                          ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                          : "border-primary/10 hover:border-primary/30"
                      )}
                    >
                      <RadioGroupItem value={addr.id} id={`addr-${addr.id}`} className="mt-0.5" />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-sm text-foreground">{addr.full_name}</span>
                          {addr.is_default && (
                            <span className="text-[9px] bg-primary/15 text-primary px-1.5 py-0.5 rounded-full font-bold">
                              افتراضي
                            </span>
                          )}
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">{addr.phone_number}</p>
                        <p className="text-[11px] text-muted-foreground">{addr.governorate} - {addr.area}</p>
                      </div>
                    </Label>
                  ))}
                </div>
              </RadioGroup>
            )}
            
            <Textarea
              placeholder="ملاحظات التوصيل (اختياري)..."
              value={deliveryNotes}
              onChange={(e) => setDeliveryNotes(e.target.value)}
              className="mt-3 text-sm rounded-xl bg-background/50 border-primary/10 focus:border-primary/30 resize-none"
              rows={2}
            />
          </div>
        </section>

        {/* Payment Method */}
        <section className="rounded-2xl bg-card border border-primary/10 overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-primary/5">
            <CreditCard className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-bold text-foreground">طريقة الدفع</h2>
          </div>
          <div className="p-4">
            <RadioGroup value={paymentMethod} onValueChange={(v) => setPaymentMethod(v as PaymentMethod)}>
              <div className="space-y-2">
                {/* Wallet - always available */}
                <Label
                  htmlFor="pay-wallet"
                  className={cn(
                    "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                    paymentMethod === 'wallet' 
                      ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                      : "border-primary/10 hover:border-primary/30"
                  )}
                >
                  <RadioGroupItem value="wallet" id="pay-wallet" />
                  <div className="w-9 h-9 rounded-lg bg-primary/15 flex items-center justify-center">
                    <Wallet className="h-4 w-4 text-primary" />
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm text-foreground">المحفظة</p>
                    <p className="text-[10px] text-muted-foreground">دفع كامل المبلغ من رصيدك</p>
                  </div>
                  <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">
                    بدون عمولة
                  </span>
                </Label>

                {/* Half Payment */}
                {commissionConfig?.half_payment_enabled && (
                  <Label
                    htmlFor="pay-half"
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                      paymentMethod === 'half' 
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                        : "border-primary/10 hover:border-primary/30"
                    )}
                  >
                    <RadioGroupItem value="half" id="pay-half" />
                    <div className="w-9 h-9 rounded-lg bg-amber-500/15 flex items-center justify-center">
                      <Banknote className="h-4 w-4 text-amber-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">نصف المبلغ</p>
                      <p className="text-[10px] text-muted-foreground">ادفع 50% والباقي عند الاستلام</p>
                    </div>
                    <span className="text-[10px] bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full font-bold">
                      +{commissionConfig.half_payment_fee}%
                    </span>
                  </Label>
                )}

                {/* Quarter Payment */}
                {commissionConfig?.quarter_payment_enabled && (
                  <Label
                    htmlFor="pay-quarter"
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                      paymentMethod === 'quarter' 
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                        : "border-primary/10 hover:border-primary/30"
                    )}
                  >
                    <RadioGroupItem value="quarter" id="pay-quarter" />
                    <div className="w-9 h-9 rounded-lg bg-purple-500/15 flex items-center justify-center">
                      <Percent className="h-4 w-4 text-purple-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">ربع المبلغ</p>
                      <p className="text-[10px] text-muted-foreground">ادفع 25% والباقي عند الاستلام</p>
                    </div>
                    <span className="text-[10px] bg-purple-500/15 text-purple-400 px-2 py-0.5 rounded-full font-bold">
                      +{commissionConfig.quarter_payment_fee}%
                    </span>
                  </Label>
                )}

                {/* COD */}
                {commissionConfig?.cod_enabled && (
                  <Label
                    htmlFor="pay-cod"
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl border cursor-pointer transition-all",
                      paymentMethod === 'cod' 
                        ? "border-primary bg-primary/5 shadow-sm shadow-primary/10" 
                        : "border-primary/10 hover:border-primary/30"
                    )}
                  >
                    <RadioGroupItem value="cod" id="pay-cod" />
                    <div className="w-9 h-9 rounded-lg bg-orange-500/15 flex items-center justify-center">
                      <Truck className="h-4 w-4 text-orange-400" />
                    </div>
                    <div className="flex-1">
                      <p className="font-semibold text-sm text-foreground">الدفع عند الاستلام</p>
                      <p className="text-[10px] text-muted-foreground">ادفع كامل المبلغ عند التسليم</p>
                    </div>
                    <span className="text-[10px] bg-green-500/15 text-green-400 px-2 py-0.5 rounded-full font-bold">
                      بدون عمولة
                    </span>
                  </Label>
                )}
              </div>
            </RadioGroup>
          </div>
        </section>

        {/* Price Breakdown */}
        <section className="rounded-2xl bg-card border border-primary/10 overflow-hidden">
          <div className="p-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-muted-foreground">المنتجات</span>
              <span className="font-medium text-foreground">{baseTotal.toLocaleString()} د.ع</span>
            </div>
            
            {commissionAmount > 0 && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">عمولة الدفع ({commissionRate}%)</span>
                <span className="text-amber-400 font-medium">+{commissionAmount.toLocaleString()} د.ع</span>
              </div>
            )}
            
            <div className="h-px bg-primary/10" />
            
            <div className="flex items-center justify-between">
              <span className="font-bold text-foreground">الإجمالي</span>
              <span className="text-xl font-black text-primary">{finalTotal.toLocaleString()} د.ع</span>
            </div>

            {paymentMethod !== 'wallet' && (
              <>
                <div className="h-px bg-primary/10" />
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">المطلوب الآن</span>
                  <span className="font-bold text-green-400">{amountToPay.toLocaleString()} د.ع</span>
                </div>
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">عند الاستلام</span>
                  <span className="font-bold text-amber-400">{remainingAmount.toLocaleString()} د.ع</span>
                </div>
              </>
            )}

            <div className="h-px bg-primary/10" />
            <div className="flex items-center justify-between text-xs">
              <span className="text-muted-foreground">رصيد المحفظة</span>
              <span className={cn("font-bold", insufficientBalance ? 'text-destructive' : 'text-green-400')}>
                {walletBalance.toLocaleString()} د.ع
              </span>
            </div>
          </div>
        </section>

        {/* Security note */}
        <div className="flex items-center gap-2 px-2 pb-2">
          <Shield className="h-3.5 w-3.5 text-primary/40 shrink-0" />
          <p className="text-[10px] text-muted-foreground leading-relaxed">
            جميع المعاملات محمية ومشفرة. لن يتم تحويل أموالك للتاجر إلا بعد تأكيدك للاستلام.
          </p>
        </div>
      </main>

      {/* Fixed Bottom */}
      <div className="fixed bottom-0 left-0 right-0 z-30 safe-area-bottom" dir="rtl">
        <div className="bg-card/95 backdrop-blur-xl border-t border-primary/15 px-4 py-3">
          {insufficientBalance ? (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-destructive">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>تحتاج {(amountToPay - walletBalance).toLocaleString()} د.ع إضافية</span>
              </div>
              <Button
                className="w-full h-12 rounded-xl font-bold"
                onClick={() => navigate('/profile?tab=wallet')}
              >
                <Wallet className="h-4 w-4 ml-2" />
                شحن المحفظة
              </Button>
            </div>
          ) : (
            <Button
              className="w-full h-12 rounded-xl font-bold text-sm gap-2"
              onClick={() => checkoutMutation.mutate()}
              disabled={!selectedAddress || checkoutMutation.isPending}
            >
              {checkoutMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  جاري إتمام الطلب...
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  تأكيد الطلب — {amountToPay.toLocaleString()} د.ع
                </>
              )}
            </Button>
          )}
        </div>
      </div>

      <AddressDialog
        open={showAddressDialog}
        onOpenChange={(open) => {
          setShowAddressDialog(open);
          if (!open) queryClient.invalidateQueries({ queryKey: ['user-addresses-checkout'] });
        }}
      />
    </div>
  );
}
