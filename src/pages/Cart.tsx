import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart, CartItem } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X, Wallet, CreditCard, Package, MessageCircle, Hash } from 'lucide-react';
import GroupedCartItem from '@/components/GroupedCartItem';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';

import WalletDialog from '@/components/WalletDialog';
import CartRequestDialog from '@/components/CartRequestDialog';

const Cart = () => {
  const { items, loading, total, updateQuantity, removeFromCart, clearCart, itemCount } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [preOrderPaymentOption, setPreOrderPaymentOption] = useState<'full' | 'quarter'>('full');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [showCartRequestDialog, setShowCartRequestDialog] = useState(false);

  // التحقق من وجود منتجات طلب مسبق
  const hasPreOrderItems = items.some((item: any) => 
    item.shipping_option_name_ar || 
    (item as any).shipping_option_index !== null
  );

  const { data: profile } = useQuery({
    queryKey: ['profile', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data } = await supabase
        .from('profiles')
        .select('governorate')
        .eq('id', user.id)
        .single();
      return data;
    },
    enabled: !!user?.id
  });

  // جلب رصيد المحفظة
  const { data: wallet } = useQuery({
    queryKey: ['wallet', user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user?.id,
  });


  // جلب إعدادات الدفع الجزئي
  interface FeeTier {
    min_amount: number;
    max_amount: number;
    fee_percentage: number;
  }
  
  interface PartialPaymentSettingsData {
    fee_label_ar: string;
    fee_label_en: string;
    fee_tiers?: FeeTier[];
    quarter_payment_fee_percentage?: number; // للتوافق مع الإعدادات القديمة
  }
  
  const { data: partialPaymentSettings } = useQuery({
    queryKey: ['partial-payment-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'partial_payment_settings')
        .single();
      return data?.setting_value as unknown as PartialPaymentSettingsData | null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  // جلب إعدادات الضريبة
  interface TaxSettingsData {
    tax_percentage: number;
  }

  const { data: taxSettings } = useQuery({
    queryKey: ['tax-settings'],
    queryFn: async () => {
      const { data } = await supabase
        .from('default_settings')
        .select('setting_value')
        .eq('setting_key', 'tax_settings')
        .maybeSingle();
      return data?.setting_value as unknown as TaxSettingsData | null;
    },
    staleTime: 0,
    refetchOnMount: 'always',
  });

  const taxPercentage = taxSettings?.tax_percentage ?? 30;

  const getDeliveryFee = (governorate: string | null) => {
    if (!governorate) return 6000;
    if (governorate.toLowerCase().includes('بغداد') || governorate.toLowerCase().includes('baghdad')) {
      return 5000;
    }
    return 6000;
  };

  const deliveryFee = getDeliveryFee(profile?.governorate || null);
  
  // Calculate discount
  const calculateDiscount = () => {
    if (!appliedCoupon) return 0;
    
    if (appliedCoupon.discount_type === 'percentage') {
      return (total * appliedCoupon.discount_value) / 100;
    }
    return appliedCoupon.discount_value;
  };
  
  const discount = calculateDiscount();
  
  // حساب المبلغ الفرعي بناءً على خيار الدفع للطلب المسبق
  const subtotalAfterDiscount = total - discount;
  
  // حساب الضريبة
  const taxAmount = Math.ceil(subtotalAfterDiscount * (taxPercentage / 100));
  
  // المبلغ بعد إضافة الضريبة
  const subtotalWithTax = subtotalAfterDiscount + taxAmount;
  
  // حساب رسوم الدفع الجزئي بناءً على الشرائح (تُضاف للمبلغ المتبقي وليس للدفعة الأولى)
  const calculatePartialPaymentFee = () => {
    if (!hasPreOrderItems || preOrderPaymentOption !== 'quarter') return 0;
    
    // استخدام الشرائح إذا كانت موجودة
    if (partialPaymentSettings?.fee_tiers && partialPaymentSettings.fee_tiers.length > 0) {
      const applicableTier = partialPaymentSettings.fee_tiers.find(
        tier => subtotalWithTax >= tier.min_amount && subtotalWithTax <= tier.max_amount
      );
      if (applicableTier) {
        return Math.ceil(subtotalWithTax * (applicableTier.fee_percentage / 100));
      }
      // إذا لم يجد شريحة مطابقة، استخدم آخر شريحة إذا كان المبلغ أكبر
      const lastTier = partialPaymentSettings.fee_tiers[partialPaymentSettings.fee_tiers.length - 1];
      if (subtotalWithTax > lastTier.max_amount) {
        return Math.ceil(subtotalWithTax * (lastTier.fee_percentage / 100));
      }
    }
    
    // للتوافق مع الإعدادات القديمة
    const fallbackPercentage = partialPaymentSettings?.quarter_payment_fee_percentage ?? 10;
    return Math.ceil(subtotalWithTax * (fallbackPercentage / 100));
  };
  
  const partialPaymentFee = calculatePartialPaymentFee();
  
  const preOrderPaymentAmount = hasPreOrderItems && preOrderPaymentOption === 'quarter' 
    ? Math.ceil(subtotalWithTax * 0.25) 
    : subtotalWithTax;
  
  // حساب المبلغ المستخدم من المحفظة (بدون رسوم الدفع الجزئي لأنها تُدفع لاحقاً)
  const walletDeduction = useWalletBalance && wallet?.balance 
    ? Math.min(wallet.balance, preOrderPaymentAmount + deliveryFee)
    : 0;
  
  const grandTotal = Math.max(0, preOrderPaymentAmount + deliveryFee - walletDeduction);
  
  // المبلغ المتبقي للطلب المسبق (يشمل رسوم الدفع الجزئي)
  const remainingAmount = hasPreOrderItems && preOrderPaymentOption === 'quarter' 
    ? (subtotalWithTax - preOrderPaymentAmount) + partialPaymentFee
    : 0;

  const applyCoupon = async () => {
    if (!couponCode.trim()) {
      toast({
        title: "خطأ",
        description: "الرجاء إدخال رمز الكوبون",
        variant: "destructive",
      });
      return;
    }

    setCouponLoading(true);
    try {
      // Use secure RPC function with rate limiting to validate coupon
      const { data: result, error } = await supabase
        .rpc('validate_coupon_with_rate_limit', { coupon_code: couponCode.toUpperCase().trim() });

      if (error) {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء التحقق من الكوبون",
          variant: "destructive",
        });
        return;
      }

      const couponResult = result as { valid: boolean; error?: string; id?: string; code?: string; discount_type?: string; discount_value?: number; min_purchase_amount?: number; rate_limited?: boolean };

      if (!couponResult.valid) {
        toast({
          title: couponResult.rate_limited ? "تم تجاوز الحد المسموح" : "كوبون غير صالح",
          description: couponResult.error || "الكوبون غير صحيح",
          variant: "destructive",
        });
        return;
      }

      // Check minimum purchase
      if (couponResult.min_purchase_amount && total < couponResult.min_purchase_amount) {
        toast({
          title: "الحد الأدنى للطلب غير مستوفى",
          description: `الحد الأدنى للطلب هو ${formatPrice(couponResult.min_purchase_amount)} دينار عراقي`,
          variant: "destructive",
        });
        return;
      }

      setAppliedCoupon({
        id: couponResult.id,
        code: couponResult.code,
        discount_type: couponResult.discount_type,
        discount_value: couponResult.discount_value,
        min_purchase_amount: couponResult.min_purchase_amount,
      });
      
      toast({
        title: "تم تطبيق الكوبون",
        description: `تم خصم ${couponResult.discount_type === 'percentage' ? `${couponResult.discount_value}%` : `${formatPrice(couponResult.discount_value || 0)} دينار عراقي`}`,
      });
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء تطبيق الكوبون",
        variant: "destructive",
      });
    } finally {
      setCouponLoading(false);
    }
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    setCouponCode('');
    toast({
      title: "تم إزالة الكوبون",
      description: "تم إزالة الكوبون من طلبك",
    });
  };

  // حساب المبلغ المطلوب دفعه الآن
  const requiredPaymentNow = preOrderPaymentAmount + deliveryFee;
  const walletBalance = wallet?.balance || 0;
  const hasEnoughBalance = walletBalance >= requiredPaymentNow;

  const handleCheckoutClick = () => {
    if (!user) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول أولاً لإتمام الطلب",
        variant: "destructive",
      });
      return;
    }

    if (!hasEnoughBalance) {
      toast({
        title: "رصيد المحفظة غير كافٍ",
        description: `رصيدك الحالي: ${formatPrice(walletBalance)} د.ع - المطلوب: ${formatPrice(requiredPaymentNow)} د.ع`,
        variant: "destructive",
      });
      return;
    }

    setShowConfirmDialog(true);
  };

  const handleCheckout = async () => {
    if (isCheckingOut) return; // Prevent double-click
    
    setShowConfirmDialog(false);
    
    if (!user) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول أولاً لإتمام الطلب",
        variant: "destructive",
      });
      return;
    }

    setIsCheckingOut(true);
    try {
      // Check if user has at least one address
      const { data: addresses, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (addressError || !addresses || addresses.length === 0) {
        toast({
          title: "يجب إضافة عنوان",
          description: "الرجاء إضافة عنوان توصيل أولاً لإتمام الطلب",
          variant: "destructive",
        });
        navigate('/addresses');
        return;
      }

      // Get default address or first address
      const { data: defaultAddress } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const selectedAddress = defaultAddress || addresses[0];

      // Get user profile information
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number, governorate, username')
        .eq('id', user.id)
        .single();

      if (error || !profile) {
        toast({
          title: "خطأ",
          description: "لم نتمكن من الحصول على معلومات الملف الشخصي",
          variant: "destructive",
        });
        return;
      }

      const deliveryFee = getDeliveryFee(selectedAddress.governorate);

      // Generate order number
      const { data: orderNumberData } = await supabase
        .rpc('generate_order_number');
      
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      // Create order in database with full address details
      const shippingAddressText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;
      
      // Calculate payment info for pre-orders
      const isPreOrderWithPartialPayment = hasPreOrderItems && preOrderPaymentOption === 'quarter';
      const orderSubtotal = total - discount;
      const paidNow = isPreOrderWithPartialPayment ? Math.ceil(orderSubtotal * 0.25) : orderSubtotal;
      const orderRemaining = isPreOrderWithPartialPayment ? orderSubtotal - paidNow : 0;
      
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .insert([{
          user_id: user.id,
          order_number: orderNumber,
          total_amount: orderSubtotal + deliveryFee,
          subtotal: orderSubtotal,
          paid_amount: paidNow + deliveryFee - walletDeduction,
          remaining_amount: orderRemaining,
          payment_status: isPreOrderWithPartialPayment ? 'partial' : 'pending',
          status: 'pending',
          currency: 'دينار عراقي',
          shipping_address: shippingAddressText,
          phone_number: selectedAddress.phone_number,
          governorate: selectedAddress.governorate,
        }])
        .select()
        .single();

      if (orderError || !order) {
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء إنشاء الطلب",
          variant: "destructive",
        });
        return;
      }

      // إرسال إشعار للتيليجرام عند إنشاء طلب جديد
      try {
        const isPreOrderWithPartialPayment = hasPreOrderItems && preOrderPaymentOption === 'quarter';
        const paymentStatusText = isPreOrderWithPartialPayment ? 'دفع جزئي (ربع المبلغ)' : 'مطلوب الدفع الكامل';
        const orderTotalAmount = (total - discount) + deliveryFee;
        const paidAmountNow = grandTotal;
        const remainingToPay = isPreOrderWithPartialPayment ? remainingAmount : 0;
        
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🛒 <b>طلب جديد</b>\n\n` +
              `👤 العميل: ${profile?.full_name || 'غير محدد'}\n` +
              `📱 اليوزر: @${profile?.username || 'غير محدد'}\n` +
              `📞 الهاتف: ${selectedAddress.phone_number}\n\n` +
              `📋 رقم الطلب: ${order.order_number}\n` +
              `📦 عدد المنتجات: ${items.length}\n` +
              `📍 المحافظة: ${selectedAddress.governorate}\n\n` +
              `💰 <b>تفاصيل الدفع:</b>\n` +
              `• المبلغ الإجمالي: ${orderTotalAmount.toLocaleString()} د.ع\n` +
              `• المدفوع الآن: ${paidAmountNow.toLocaleString()} د.ع\n` +
              (remainingToPay > 0 ? `• المتبقي عند الاستلام: ${remainingToPay.toLocaleString()} د.ع\n` : '') +
              `• حالة الدفع: ${paymentStatusText}` +
              (useWalletBalance && walletDeduction > 0 ? `\n• خصم المحفظة: ${walletDeduction.toLocaleString()} د.ع` : ''),
          },
        });
      } catch (telegramError) {
        console.error('خطأ في إرسال إشعار التيليجرام:', telegramError);
      }

      // إذا تم استخدام المحفظة، خصم المبلغ وتسجيل المعاملة
      // الدفع إجباري من المحفظة
      if (wallet) {
        const amountToDeduct = requiredPaymentNow;
        
        // خصم المبلغ من المحفظة
        const { error: walletUpdateError } = await supabase
          .from('user_wallets')
          .update({
            balance: wallet.balance - amountToDeduct,
            updated_at: new Date().toISOString()
          })
          .eq('user_id', user.id);

        if (walletUpdateError) {
          console.error('Error updating wallet:', walletUpdateError);
          toast({
            title: "خطأ",
            description: "حدث خطأ في خصم المبلغ من المحفظة",
            variant: "destructive",
          });
          return;
        }
        
        // تسجيل معاملة المحفظة
        await supabase
          .from('wallet_transactions')
          .insert({
            user_id: user.id,
            type: 'order_payment',
            amount: -amountToDeduct,
            status: 'completed',
            admin_notes: `دفع طلب رقم ${order.order_number}`,
          });
        
        // تحديث الطلب بالمبلغ المدفوع من المحفظة
        await supabase
          .from('orders')
          .update({
            customer_paid_amount: amountToDeduct,
            payment_status: isPreOrderWithPartialPayment ? 'partial' : 'paid',
          })
          .eq('id', order.id);
      }

      // Fetch custom request data directly if needed
      const customRequestIds = items
        .filter(item => item.custom_request_id && !item.custom_product_requests?.product_name)
        .map(item => item.custom_request_id)
        .filter(Boolean) as string[];

      let customRequestsData: Record<string, any> = {};
      if (customRequestIds.length > 0) {
        const { data: fetchedRequests } = await supabase
          .from('custom_product_requests')
          .select('id, product_name, suggested_price, image_url')
          .in('id', customRequestIds);
        
        if (fetchedRequests) {
          customRequestsData = fetchedRequests.reduce((acc, req) => {
            acc[req.id] = req;
            return acc;
          }, {} as Record<string, any>);
        }
      }

      // Create order items
      const orderItems = items
        .filter((item) => {
          // Include item if it has a product_id OR custom_request_id
          return item.product_id || item.custom_request_id;
        })
        .map((item) => {
          const isCustomRequest = !!item.custom_request_id;
          // Use product_options data directly from the cart item
          const itemOption = (item as any).product_options;
          
          const itemColor = (item as any).selected_color;
          const colorData = itemColor && item.products?.colors
            ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
            : null;
          
          // Get custom request data from either the item or fetched data
          const customRequest = item.custom_product_requests || 
            (item.custom_request_id ? customRequestsData[item.custom_request_id] : null);
          
          let itemPrice = isCustomRequest
            ? Number(customRequest?.suggested_price || 0)
            : Number(item.products?.price || 0);
          
          if (colorData?.price != null) {
            itemPrice = Number(colorData.price);
          }
          
          if (itemOption?.price_adjustment) {
            itemPrice += Number(itemOption.price_adjustment);
          }

          // Add pre-order shipping adjustment (if chosen)
          const shippingIndex = (item as any).shipping_option_index;
          const shippingOptions = item.products?.pre_order_shipping_options;
          if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
            const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
            itemPrice += shippingAdjustment;
          }

          // Get product name - ensure it's never empty
          const productName = isCustomRequest 
            ? (customRequest?.product_name || 'طلب مخصص')
            : (item.products?.name || 'منتج');
          const productNameAr = isCustomRequest 
            ? (customRequest?.product_name || 'طلب مخصص')
            : (item.products?.name_ar || 'منتج');

          return {
            order_id: order.id,
            product_id: isCustomRequest ? null : item.product_id,
            custom_request_id: isCustomRequest ? item.custom_request_id : null,
            product_option_id: (item as any).product_option_id || null,
            quantity: item.quantity,
            unit_price: itemPrice,
            total_price: itemPrice * item.quantity,
            selected_color: itemColor || null,
            color_image_url: (item as any).color_image_url || null,
            selected_option: itemOption?.name_ar || null,
            shipping_option_name_ar: (item as any).shipping_option_name_ar || null,
            product_name: productName,
            product_name_ar: productNameAr,
          };
        });

      // Check if we have valid items to insert
      if (orderItems.length === 0) {
        toast({
          title: "خطأ",
          description: "لا توجد منتجات صالحة في السلة",
          variant: "destructive",
        });
        return;
      }

      console.log('Inserting order items:', orderItems);

      const { error: itemsError } = await supabase
        .from('order_items')
        .insert(orderItems);

      if (itemsError) {
        console.error('Order items insert error:', itemsError);
        toast({
          title: "خطأ",
          description: "حدث خطأ أثناء حفظ عناصر الطلب: " + itemsError.message,
          variant: "destructive",
        });
        return;
      }

      // تحديث استخدام الكوبون إذا كان موجوداً
      if (appliedCoupon && user) {
        await supabase
          .from('coupon_usage')
          .insert([{
            coupon_id: appliedCoupon.id,
            user_id: user.id
          }]);

        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Build WhatsApp message
      let message = `مرحباً، أريد إتمام طلب:\n\n`;
      message += `🔖 *رقم الطلب:* ${order.order_number}\n\n`;
      message += `📦 *المنتجات:*\n`;
      
      items.forEach((item, index) => {
        const isCustomRequest = !!item.custom_request_id;
        
        // Get custom request data from either the item or fetched data
        const customRequest = item.custom_product_requests || 
          (item.custom_request_id ? customRequestsData[item.custom_request_id] : null);
        
        const itemName = isCustomRequest 
          ? (customRequest?.product_name || 'طلب مخصص')
          : (item.products?.name_ar || 'منتج');
        
        let itemPrice = isCustomRequest
          ? Number(customRequest?.suggested_price || 0)
          : Number(item.products?.price || 0);
        
        // Use product_options data directly from the cart item
        const itemOption = (item as any).product_options;
        
        const itemColor = (item as any).selected_color;
        const colorData = itemColor && item.products?.colors
          ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
          : null;
        
        if (colorData?.price != null) {
          itemPrice = Number(colorData.price);
        }
        
        if (itemOption?.price_adjustment) {
          itemPrice += Number(itemOption.price_adjustment);
        }

        // Add pre-order shipping adjustment (if chosen)
        const shippingIndex = (item as any).shipping_option_index;
        const shippingOptions = item.products?.pre_order_shipping_options;
        if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
          const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
          itemPrice += shippingAdjustment;
        }
        
        message += `${index + 1}. ${itemName}${isCustomRequest ? ' ⭐ (طلب خاص)' : ''}\n`;
        if (itemOption) {
          message += `   الخيار: ${itemOption.name_ar}\n`;
        }
        if (colorData) {
          message += `   اللون: ${colorData.name_ar}\n`;
        }
        message += `   الكمية: ${item.quantity}\n`;
        message += `   السعر: ${formatPrice(itemPrice)} دينار عراقي\n`;
        message += `   المجموع: ${formatPrice(itemPrice * item.quantity)} دينار عراقي\n\n`;
      });

      message += `\n👤 *معلومات المشتري:*\n`;
      message += `الاسم: ${selectedAddress.full_name}\n`;
      message += `رقم الهاتف: ${selectedAddress.phone_number}\n`;
      message += `\n📍 *عنوان التوصيل:*\n`;
      message += `المحافظة: ${selectedAddress.governorate}\n`;
      message += `المنطقة: ${selectedAddress.area}\n`;
      if (selectedAddress.neighborhood) {
        message += `الحي: ${selectedAddress.neighborhood}\n`;
      }
      message += `أقرب نقطة دالة: ${selectedAddress.nearest_landmark}\n`;
      if (selectedAddress.additional_notes) {
        message += `ملاحظات: ${selectedAddress.additional_notes}\n`;
      }
      message += `\n`;
      
      message += `💰 *ملخص الطلب:*\n`;
      message += `المجموع الفرعي: ${formatPrice(total)} دينار عراقي\n`;
      if (appliedCoupon) {
        message += `الخصم (${appliedCoupon.code}): -${formatPrice(discount)} دينار عراقي\n`;
      }
      message += `التوصيل: ${formatPrice(deliveryFee)} دينار عراقي\n`;
      if (walletDeduction > 0) {
        message += `الدفع من المحفظة: -${formatPrice(walletDeduction)} دينار عراقي\n`;
      }
      message += `الإجمالي${walletDeduction > 0 ? ' المتبقي' : ''}: ${formatPrice(grandTotal)} دينار عراقي`;
      if (grandTotal === 0 && walletDeduction > 0) {
        message += ` ✓ تم الدفع بالكامل من المحفظة`;
      }

      // If coupon was used, record it
      if (appliedCoupon && user) {
        await supabase.from('coupon_usage').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
        });
        
        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Clear cart after successful order
      await clearCart();

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappURL = `https://wa.me/9647838455220?text=${encodedMessage}`;
      
      // Open WhatsApp in new window
      window.open(whatsappURL, '_blank');
      
      toast({
        title: "تم إنشاء الطلب بنجاح",
        description: `رقم الطلب: ${order.order_number}`,
      });
      
    } catch (error) {
      console.error('Error during checkout:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إتمام الطلب",
        variant: "destructive",
      });
    } finally {
      setIsCheckingOut(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm">
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-3xl font-black text-primary mb-2">سلة التسوق</h1>
          <p className="text-muted-foreground text-sm">
            {itemCount > 0 ? `لديك ${itemCount} ${itemCount === 1 ? 'منتج' : 'منتجات'} في السلة` : 'السلة فارغة'}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
            <div className="w-20 h-20 mx-auto mb-6 opacity-20">
              <ShoppingBag className="w-full h-full text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">سلة التسوق فارغة</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              لم تقم بإضافة أي منتجات إلى السلة بعد
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <ArrowRight className="ml-2 h-4 w-4" />
                تصفح المنتجات
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid lg:grid-cols-3 gap-6">
            {/* Cart Items */}
            <div className="lg:col-span-2 space-y-4">
              {(() => {
                // Group items by product + option + color combination
                const groupedItems = items.reduce((acc, item) => {
                  // Custom requests are not grouped
                  if (item.custom_request_id) {
                    acc.push({ type: 'single', items: [item] });
                    return acc;
                  }
                  
                  // Create a key for grouping (product + option + color)
                  const key = `${item.product_id || ''}_${item.product_option_id || ''}_${(item as any).selected_color || ''}`;
                  
                  // Find existing group
                  const existingGroup = acc.find(
                    (g) => g.type === 'grouped' && g.key === key
                  );
                  
                  if (existingGroup) {
                    existingGroup.items.push(item);
                  } else {
                    acc.push({ type: 'grouped', key, items: [item] });
                  }
                  
                  return acc;
                }, [] as { type: string; key?: string; items: CartItem[] }[]);

                return groupedItems.map((group, groupIndex) => {
                  // If it's a single item (custom request or single shipping option)
                  if (group.type === 'single' || group.items.length === 1) {
                    const item = group.items[0];
                    const itemOption = (item as any).product_options;
                    const itemColor = (item as any).selected_color;
                    const colorData = itemColor && item.products?.colors
                      ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
                      : null;
                    
                    let itemPrice = item.products 
                      ? Number(item.products.price)
                      : Number(item.custom_product_requests?.suggested_price || 0);
                    
                    if (colorData?.price != null) {
                      itemPrice = Number(colorData.price);
                    }
                    
                    if (itemOption?.price_adjustment) {
                      itemPrice += Number(itemOption.price_adjustment);
                    }

                    const shippingIndex = (item as any).shipping_option_index;
                    const shippingOptions = item.products?.pre_order_shipping_options;
                    if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
                      const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
                      itemPrice += shippingAdjustment;
                    }
                    
                    return (
                      <div 
                        key={item.id}
                        className="glass-effect rounded-2xl p-4 border border-border/50 group hover:border-primary/30 transition-all"
                      >
                        <div className="flex flex-col sm:flex-row gap-4">
                          {((item.products?.image_url) || (item.custom_product_requests?.image_url) || (item as any).option_image_url || (item as any).color_image_url) && (
                            <Link 
                              to={item.products ? `/product/${item.products.slug}` : '#'}
                              className="flex-shrink-0 mx-auto sm:mx-0"
                            >
                              <img 
                                src={(item as any).option_image_url || (item as any).color_image_url || (item.products?.images && item.products.images[0]) || item.products?.image_url || item.custom_product_requests?.image_url || ''}
                                alt={item.products?.name_ar || item.custom_product_requests?.product_name || ''}
                                className="w-32 h-32 sm:w-24 sm:h-24 object-cover rounded-xl border border-border/40 hover:border-primary/50 transition-colors"
                              />
                            </Link>
                          )}
                          
                          <div className="flex-1 flex flex-col gap-3">
                            <div className="text-center sm:text-right">
                              {item.products ? (
                                <Link 
                                  to={`/product/${item.products.slug}`}
                                  className="font-bold text-base text-foreground mb-1 inline-flex items-center gap-2 hover:text-primary transition-colors"
                                >
                                  {item.products.name_ar}
                                </Link>
                              ) : (
                                <div className="font-bold text-base text-foreground mb-1 inline-flex items-center gap-2">
                                  {item.custom_product_requests?.product_name}
                                  <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                                    طلب خاص ⭐
                                  </span>
                                </div>
                              )}
                              
                              {(itemOption || colorData || (item as any).shipping_option_name_ar) && (
                                <div className="text-sm text-muted-foreground mb-2 space-y-1">
                                  {itemOption && (
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                      <span className="font-medium">الخيار:</span>
                                      <span>{itemOption.name_ar}</span>
                                    </div>
                                  )}
                                   {colorData && (
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                      <span className="font-medium">اللون:</span>
                                      <div className="flex items-center gap-1.5">
                                        <div 
                                          className="w-4 h-4 rounded-full border border-border"
                                          style={{ backgroundColor: colorData.hex_code }}
                                        />
                                        <span>{colorData.name_ar}</span>
                                      </div>
                                    </div>
                                  )}
                                  {(item as any).shipping_option_name_ar && (
                                    <div className="flex items-center justify-center sm:justify-start gap-2">
                                      <span className="font-medium">الشحن:</span>
                                      <span>{(item as any).shipping_option_name_ar}</span>
                                    </div>
                                  )}
                                </div>
                              )}
                              
                              <div className="flex items-center justify-center sm:justify-start gap-2 mb-3">
                                <span className="text-lg font-black text-primary">
                                  {formatPrice(itemPrice)} دينار عراقي
                                </span>
                                {item.products?.original_price && item.products.original_price > itemPrice && (
                                  <span className="text-sm line-through text-muted-foreground/60">
                                    {formatPrice(Number(item.products.original_price))} دينار عراقي
                                  </span>
                                )}
                              </div>
                            </div>

                            <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-3 border-t border-border/20">
                              <div className="flex items-center gap-3 w-full sm:w-auto">
                                <div className="flex items-center gap-2 bg-background/50 rounded-lg p-1 border border-border/40">
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-10 w-10 sm:h-8 sm:w-8 touch-manipulation"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      updateQuantity(item.id, item.quantity - 1);
                                    }}
                                    disabled={item.quantity <= 1}
                                    aria-label="تقليل الكمية"
                                  >
                                    <Minus className="h-4 w-4" />
                                  </Button>
                                  
                                  <span className="w-10 sm:w-8 text-center font-bold" aria-live="polite">
                                    {item.quantity}
                                  </span>
                                  
                                  <Button
                                    type="button"
                                    size="icon"
                                    variant="ghost"
                                    className="h-10 w-10 sm:h-8 sm:w-8 touch-manipulation"
                                    onClick={(e) => {
                                      e.preventDefault();
                                      e.stopPropagation();
                                      updateQuantity(item.id, item.quantity + 1);
                                    }}
                                    aria-label="زيادة الكمية"
                                  >
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </div>

                                <Button
                                  type="button"
                                  size="sm"
                                  variant="ghost"
                                  className="text-destructive hover:text-destructive hover:bg-destructive/10 h-10 px-4 sm:h-8 touch-manipulation"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    removeFromCart(item.id);
                                  }}
                                  aria-label="حذف المنتج"
                                >
                                  <Trash2 className="h-4 w-4 ml-2" />
                                  <span className="hidden sm:inline">حذف</span>
                                </Button>
                              </div>

                              <div className="text-center sm:text-left">
                                <div className="text-sm text-muted-foreground mb-1">المجموع</div>
                                <div className="text-lg font-black text-primary">
                                  {formatPrice(itemPrice * item.quantity)} دينار عراقي
                                </div>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }
                  
                  // Grouped items (same product with different shipping options)
                  return (
                    <GroupedCartItem
                      key={group.key}
                      productId={group.items[0].product_id || ''}
                      items={group.items}
                      updateQuantity={updateQuantity}
                      removeFromCart={removeFromCart}
                      formatPrice={formatPrice}
                    />
                  );
                });
              })()}

              {/* Cart Actions */}
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1 border-primary/30 text-primary hover:bg-primary/10"
                  onClick={() => {
                    if (!user) {
                      toast({
                        title: "يجب تسجيل الدخول",
                        description: "الرجاء تسجيل الدخول أولاً",
                        variant: "destructive",
                      });
                      return;
                    }
                    setShowCartRequestDialog(true);
                  }}
                >
                  <Hash className="ml-2 h-4 w-4" />
                  رمز السلة
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  onClick={clearCart}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  تفريغ السلة
                </Button>
              </div>
            </div>

            {/* Order Summary */}
            <div className="lg:col-span-1">
              <div className="glass-effect rounded-2xl p-6 border border-border/50 sticky top-24">
                
                {/* Coupon Section */}
                <div className="mb-6">
                  <Label htmlFor="coupon" className="text-foreground mb-2 block flex items-center gap-2">
                    <Ticket className="h-4 w-4" />
                    كوبون الخصم
                  </Label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder="أدخل رمز الكوبون"
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                      />
                      <Button
                        onClick={applyCoupon}
                        disabled={couponLoading}
                        variant="outline"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تطبيق'}
                      </Button>
                    </div>
                  ) : (
                    <div className="flex items-center justify-between p-3 rounded-lg bg-green-500/10 border border-green-500/30">
                      <div className="flex items-center gap-2">
                        <Ticket className="h-4 w-4 text-green-600" />
                        <span className="font-bold text-green-600">{appliedCoupon.code}</span>
                      </div>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={removeCoupon}
                        className="h-6 w-6 p-0"
                      >
                        <X className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between text-foreground">
                    <span>المجموع الفرعي</span>
                    <span className="font-bold">{formatPrice(total)} دينار عراقي</span>
                  </div>
                  
                  {appliedCoupon && discount > 0 && (
                    <div className="flex justify-between text-green-600">
                      <span>الخصم ({appliedCoupon.code})</span>
                      <span className="font-bold">-{formatPrice(discount)} دينار عراقي</span>
                    </div>
                  )}
                  
                  {/* الضريبة */}
                  {taxAmount > 0 && (
                    <div className="flex justify-between text-foreground">
                      <span>الضريبة ({taxPercentage}%)</span>
                      <span className="font-bold">{formatPrice(taxAmount)} دينار عراقي</span>
                    </div>
                  )}
                  
                  <div className="flex justify-between text-foreground">
                    <span>التوصيل</span>
                    <span className="font-bold">{formatPrice(deliveryFee)} دينار عراقي</span>
                  </div>
                  
                  {/* خيارات الدفع للطلب المسبق */}
                  {hasPreOrderItems && (
                    <div className="py-4 px-4 rounded-lg bg-accent/10 border border-accent/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-5 w-5 text-accent" />
                        <span className="font-bold text-foreground">خيارات الدفع للطلب المسبق</span>
                      </div>
                      <RadioGroup 
                        value={preOrderPaymentOption} 
                        onValueChange={(value) => setPreOrderPaymentOption(value as 'full' | 'quarter')}
                        className="space-y-3"
                      >
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          preOrderPaymentOption === 'full' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border/40 hover:border-primary/50'
                        }`}>
                          <RadioGroupItem value="full" id="payment-full" />
                          <Label htmlFor="payment-full" className="flex-1 cursor-pointer">
                            <div className="font-bold text-foreground">الدفع الكامل مقدماً</div>
                            <div className="text-xs text-muted-foreground">
                              ادفع المبلغ كاملاً الآن ({formatPrice(subtotalWithTax)} د.ع)
                            </div>
                          </Label>
                        </div>
                        <div className={`flex items-center gap-3 p-3 rounded-lg border transition-all cursor-pointer ${
                          preOrderPaymentOption === 'quarter' 
                            ? 'border-primary bg-primary/5' 
                            : 'border-border/40 hover:border-primary/50'
                        }`}>
                          <RadioGroupItem value="quarter" id="payment-quarter" />
                          <Label htmlFor="payment-quarter" className="flex-1 cursor-pointer">
                            <div className="font-bold text-foreground">دفع ربع المبلغ</div>
                            <div className="text-xs text-muted-foreground">
                              ادفع الآن: {formatPrice(Math.ceil(subtotalWithTax * 0.25))} د.ع
                            </div>
                            <div className="text-xs text-orange-500 mt-1">
                              المتبقي عند الاستلام: {formatPrice(remainingAmount)} د.ع (يشمل رسوم إضافية)
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                  
                  {/* رصيد المحفظة المطلوب */}
                  <div className={`py-3 px-4 rounded-lg border ${hasEnoughBalance ? 'bg-card border-primary/30' : 'bg-card border-destructive/30'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <Wallet className={`h-5 w-5 ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`} />
                      <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                        الدفع من المحفظة (إلزامي)
                      </span>
                    </div>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">رصيد المحفظة:</span>
                        <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                          {formatPrice(walletBalance)} د.ع
                        </span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">المطلوب دفعه:</span>
                        <span className="font-bold text-foreground">{formatPrice(requiredPaymentNow)} د.ع</span>
                      </div>
                      {!hasEnoughBalance && (
                        <div className="mt-2 text-xs text-destructive">
                          ⚠️ يجب شحن المحفظة بمبلغ {formatPrice(requiredPaymentNow - walletBalance)} د.ع إضافي
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="border-t border-border/40 pt-3 mt-3">
                    {hasPreOrderItems && preOrderPaymentOption === 'quarter' && (
                      <>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>ربع المبلغ (25%)</span>
                          <span className="font-bold">{formatPrice(preOrderPaymentAmount)} د.ع</span>
                        </div>
                        <div className="flex justify-between text-sm text-amber-600 mb-2">
                          <span>{partialPaymentSettings?.fee_label_ar || 'رسوم إضافية'}</span>
                          <span className="font-bold">+{formatPrice(partialPaymentFee)} د.ع</span>
                        </div>
                        <div className="flex justify-between text-sm text-muted-foreground mb-2">
                          <span>التوصيل</span>
                          <span className="font-bold">{formatPrice(deliveryFee)} د.ع</span>
                        </div>
                        <div className="flex justify-between text-sm text-orange-500 mb-3">
                          <span>المتبقي عند الاستلام</span>
                          <span className="font-bold">{formatPrice(remainingAmount)} دينار عراقي</span>
                        </div>
                      </>
                    )}
                    <div className="flex justify-between text-xl font-black">
                      <span className="text-foreground">
                        {hasPreOrderItems && preOrderPaymentOption === 'quarter' ? 'المطلوب الآن' : 'الإجمالي'}
                      </span>
                      <span className="text-primary">{formatPrice(grandTotal)} دينار عراقي</span>
                    </div>
                    {useWalletBalance && walletDeduction > 0 && grandTotal === 0 && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        ✓ تم الدفع بالكامل من المحفظة
                      </p>
                    )}
                  </div>
                </div>

                <Button 
                  className={`w-full mb-3 ${hasEnoughBalance ? 'bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90' : 'bg-muted text-muted-foreground cursor-not-allowed'}`}
                  size="lg"
                  onClick={handleCheckoutClick}
                  disabled={isCheckingOut || !hasEnoughBalance}
                >
                  {isCheckingOut ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      جاري إتمام الطلب...
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <Wallet className="ml-2 h-4 w-4" />
                      رصيد غير كافٍ
                    </>
                  ) : (
                    'إتمام الطلب'
                  )}
                </Button>
                
                {!hasEnoughBalance && (
                  <Button 
                    className="w-full mb-3 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    size="lg"
                    onClick={() => setShowWalletDialog(true)}
                  >
                    <Wallet className="ml-2 h-4 w-4" />
                    شحن المحفظة
                  </Button>
                )}

                <Link to="/products">
                  <Button 
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowRight className="ml-2 h-4 w-4" />
                    متابعة التسوق
                  </Button>
                </Link>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Confirmation Dialog */}
      <AlertDialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد إتمام الطلب</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>سيتم خصم <span className="font-bold text-primary">{formatPrice(requiredPaymentNow)} دينار عراقي</span> من رصيد محفظتك.</p>
              <p className="text-sm text-muted-foreground">
                الرصيد الحالي: {formatPrice(walletBalance)} د.ع → الرصيد بعد الخصم: {formatPrice(walletBalance - requiredPaymentNow)} د.ع
              </p>
              {hasPreOrderItems && preOrderPaymentOption === 'quarter' && remainingAmount > 0 && (
                <p className="text-orange-600 text-sm">
                  ⚠️ المتبقي عند الاستلام: {formatPrice(remainingAmount)} دينار عراقي
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={handleCheckout}
              className="bg-primary hover:bg-primary/90"
            >
              تأكيد الطلب
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Wallet Dialog */}
      <WalletDialog open={showWalletDialog} onOpenChange={setShowWalletDialog} />

      {/* Cart Request Dialog */}
      <CartRequestDialog 
        open={showCartRequestDialog} 
        onOpenChange={setShowCartRequestDialog}
        cartItems={items}
        total={total}
      />
    </div>
  );
};

export default Cart;