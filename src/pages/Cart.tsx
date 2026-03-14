import { Link, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart, CartItem } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X, Wallet, CreditCard, Package, MessageCircle, Hash, FileText, Truck, MapPin } from 'lucide-react';
import GroupedCartItem from '@/components/GroupedCartItem';
import DirectSaleCheckoutDialog from '@/components/DirectSaleCheckoutDialog';
import OrderSuccessAnimation from '@/components/ui/OrderSuccessAnimation';
import AnimatedPrice from '@/components/ui/AnimatedPrice';
import AnimatedQuantity from '@/components/ui/AnimatedQuantity';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { useState, useEffect } from 'react';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { useLanguage } from '@/lib/i18n';

import WalletDialog from '@/components/WalletDialog';
import CartRequestDialog from '@/components/CartRequestDialog';
import TermsAndConditionsSheet from '@/components/cart/TermsAndConditionsSheet';
import CartUpsellOffers from '@/components/cart/CartUpsellOffers';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

const Cart = () => {
  const { items, loading, total, updateQuantity, removeFromCart, clearCart, itemCount, pendingCartRequest, deleteCartRequest, refreshCart, cartSaleType } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqd = shippingSettings?.usd_to_iqd_rate || 1300;
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);
  const [useWalletBalance, setUseWalletBalance] = useState(false);
  const [isCheckingOut, setIsCheckingOut] = useState(false);
  const [preOrderPaymentOption, setPreOrderPaymentOption] = useState<'full' | 'quarter'>('full');
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);
  const [showWalletDialog, setShowWalletDialog] = useState(false);
  const [showCartRequestDialog, setShowCartRequestDialog] = useState(false);
  const [showCartChangeWarning, setShowCartChangeWarning] = useState(false);
  const [showTermsSheet, setShowTermsSheet] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);
  const [showDirectSaleDialog, setShowDirectSaleDialog] = useState(false);
  const [isDirectSaleProcessing, setIsDirectSaleProcessing] = useState(false);
  const [showOrderSuccess, setShowOrderSuccess] = useState(false);
  const [successOrderNumber, setSuccessOrderNumber] = useState<string>('');
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [removingItemIds, setRemovingItemIds] = useState<Set<string>>(new Set());
  const [showAddressSwitcher, setShowAddressSwitcher] = useState(false);
  // Refresh cart data on mount to get latest pendingCartRequest
  useEffect(() => {
    refreshCart();
  }, []);

  // Check cart sale type
  const isDirectSaleCart = cartSaleType === 'direct';

  // التحقق من وجود منتجات طلب مسبق
  const hasPreOrderItems = !isDirectSaleCart && items.some((item: any) => 
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

  // Fetch max quantities for bundle items in cart
  const bundleIds = items.filter(i => i.bundle_id).map(i => i.bundle_id!);
  const { data: bundleMaxQtyMap } = useQuery({
    queryKey: ['bundle-max-qty', bundleIds.join(',')],
    queryFn: async () => {
      if (bundleIds.length === 0) return {} as Record<string, number>;
      const { data: bundleItems } = await supabase
        .from('bundle_items')
        .select('bundle_id, quantity, selected_color, selected_option_id, products:product_id(colors, direct_stock)')
        .in('bundle_id', bundleIds);
      if (!bundleItems) return {} as Record<string, number>;

      const map: Record<string, number> = {};
      for (const bid of bundleIds) {
        const bItems = bundleItems.filter((bi: any) => bi.bundle_id === bid);
        let maxQty = Infinity;
        for (const bi of bItems) {
          const product = (bi as any).products;
          const colors = Array.isArray(product?.colors) ? product.colors : [];
          let stock = 0;
          if (colors.length === 0) {
            stock = product?.direct_stock != null ? Number(product.direct_stock) : 0;
          } else {
            const colorName = (bi as any).selected_color;
            const optId = (bi as any).selected_option_id;
            const color = colorName ? colors.find((c: any) => (c.color || c.name) === colorName) : null;
            if (color) {
              const stocks = color.option_stocks;
              if (stocks && typeof stocks === 'object') {
                if (optId && stocks[optId] != null) stock = Math.max(0, Number(stocks[optId]));
                else stock = Object.values(stocks).reduce<number>((s: number, v: any) => s + Math.max(0, Number(v)), 0);
              } else if (color.stock_quantity != null) {
                stock = Math.max(0, Number(color.stock_quantity));
              }
            }
          }
          const perBundle = (bi as any).quantity || 1;
          maxQty = Math.min(maxQty, Math.floor(stock / perBundle));
        }
        map[bid] = maxQty === Infinity ? 0 : maxQty;
      }
      return map;
    },
    enabled: bundleIds.length > 0,
    staleTime: 30_000,
  });

  const { data: userAddresses } = useQuery({
    queryKey: ['user-addresses', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .order('is_default', { ascending: false });
      return data || [];
    },
    enabled: !!user?.id,
  });

  // Check if user has active direct sale orders
  const { data: activeDirectOrders } = useQuery({
    queryKey: ['active-direct-orders', user?.id],
    queryFn: async (): Promise<{id: string}[]> => {
      if (!user?.id) return [];
      const result = await (supabase as any)
        .from('orders')
        .select('id, status')
        .eq('user_id', user.id)
        .eq('sale_type', 'direct');
      const filtered = (result.data || []).filter((o: any) => 
        ['pending', 'confirmed', 'processing'].includes(o.status)
      );
      return filtered.slice(0, 1) as {id: string}[];
    },
    enabled: !!user?.id && isDirectSaleCart,
  });

  // Set default selected address
  useEffect(() => {
    if (userAddresses && userAddresses.length > 0 && !selectedAddressId) {
      const def = userAddresses.find((a: any) => a.is_default) || userAddresses[0];
      setSelectedAddressId(def.id);
    }
  }, [userAddresses, selectedAddressId]);

  const selectedAddress = userAddresses?.find((a: any) => a.id === selectedAddressId) || null;
  const defaultUserAddress = selectedAddress;

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

  // الضريبة مدمجة مع سعر المنتج - لا تُعرض بشكل منفصل

  const PRINTER_SECTION_ID = '0a7d1d66-1ddb-4398-8e4a-c6ca8deac5b6';
  const hasPrinterItems = items.some(item => item.products?.categories?.main_section_id === PRINTER_SECTION_ID);

  // Check if user has existing direct sale orders in the current "business day" (resets at 5PM)
  // Also requires same address for free delivery
  const { data: todayDirectOrders } = useQuery({
    queryKey: ['today-direct-orders', user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const now = new Date();
      const hour = now.getHours();
      
      // Business day starts at 5PM previous day and ends at 5PM today
      // If before 5PM: window = yesterday 5PM → today 5PM
      // If after 5PM: window = today 5PM → tomorrow 5PM (no previous orders yet, so empty)
      const windowStart = new Date(now);
      if (hour < 17) {
        // Before 5PM - look for orders since yesterday 5PM
        windowStart.setDate(windowStart.getDate() - 1);
        windowStart.setHours(17, 0, 0, 0);
      } else {
        // After 5PM - look for orders since today 5PM (current window just started)
        windowStart.setHours(17, 0, 0, 0);
      }
      
      const { data } = await supabase
        .from('orders')
        .select('id, shipping_address')
        .eq('user_id', user.id)
        .eq('order_type', 'direct')
        .neq('status', 'cancelled')
        .gte('created_at', windowStart.toISOString())
        .order('created_at', { ascending: false })
        .limit(5);
      return data || [];
    },
    enabled: !!user?.id && isDirectSaleCart,
  });

  // Free delivery only if there's a previous order with the SAME address
  const hasExistingDirectOrderToday = (() => {
    if (!todayDirectOrders || todayDirectOrders.length === 0) return false;
    if (!selectedAddressId && !selectedAddress) return false;
    // Check if any previous order was shipped to same address (compare the full stored shipping_address)
    return todayDirectOrders.some((o: any) => {
      if (!selectedAddress || !o.shipping_address) return false;
      // Reconstruct the same shipping address text format used during checkout
      const currentAddrText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;
      return o.shipping_address === currentAddrText;
    });
  })();

  const getDeliveryFee = (governorate: string | null) => {
    // Free delivery for 2nd+ direct sale orders before 5PM
    if (isDirectSaleCart && hasExistingDirectOrderToday) return 0;
    if (hasPrinterItems) return 12000;
    if (!governorate) return 6000;
    if (governorate.includes('بغداد') || governorate.toLowerCase().includes('baghdad')) {
      return 5000;
    }
    if (governorate.includes('بابل')) {
      return 4000;
    }
    return 6000;
  };

  // Use selected address governorate first, fallback to profile governorate
  const deliveryFee = getDeliveryFee(selectedAddress?.governorate || profile?.governorate || null);
  
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
  
  // الضريبة مدمجة مع سعر المنتج - لا تظهر بشكل منفصل
  const subtotalWithTax = subtotalAfterDiscount;
  
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
        title: t('common_error'),
        description: t('cart_coupon_error_empty'),
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
          title: t('common_error'),
          description: t('cart_coupon_invalid'),
          variant: "destructive",
        });
        return;
      }

      const couponResult = result as { valid: boolean; error?: string; id?: string; code?: string; discount_type?: string; discount_value?: number; min_purchase_amount?: number; rate_limited?: boolean };

      if (!couponResult.valid) {
        toast({
          title: couponResult.rate_limited ? t('cart_coupon_rate_limited') : t('cart_coupon_invalid'),
          description: couponResult.error || t('cart_coupon_invalid'),
          variant: "destructive",
        });
        return;
      }

      // Check minimum purchase
      if (couponResult.min_purchase_amount && total < couponResult.min_purchase_amount) {
        toast({
          title: t('cart_coupon_min_purchase'),
          description: `${formatPrice(couponResult.min_purchase_amount)} ${t('common_iqd_full')}`,
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
        title: t('cart_coupon_applied'),
        description: `${couponResult.discount_type === 'percentage' ? `${couponResult.discount_value}%` : `${formatPrice(couponResult.discount_value || 0)} ${t('common_iqd_full')}`}`,
      });
    } catch (error) {
      console.error('Error applying coupon:', error);
      toast({
        title: t('common_error'),
        description: t('cart_order_error'),
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
      title: t('cart_coupon_removed'),
      description: t('cart_coupon_removed'),
    });
  };

  // Helper to wrap cart-changing actions with cart request warning
  const wrapWithCartRequestCheck = async (action: () => Promise<void>) => {
    // Always check database for latest pending cart request
    const { data } = await supabase
      .from('cart_requests')
      .select('id, cart_code, adjusted_total, admin_notes, status')
      .eq('user_id', user?.id)
      .eq('status', 'pending')
      .limit(1)
      .maybeSingle();
    
    if (data) {
      // Update local state to show correct cart code in warning dialog
      await refreshCart();
      setPendingAction(() => action);
      setShowCartChangeWarning(true);
    } else {
      action();
    }
  };

  const handleConfirmCartChange = async () => {
    setShowCartChangeWarning(false);
    if (pendingAction) {
      const deleted = await deleteCartRequest();
      console.log('Cart request deleted:', deleted);
      await pendingAction();
      setPendingAction(null);
      // Refresh cart to update pendingCartRequest state
      await refreshCart();
      // Invalidate the cart-request query cache to update CartRequestDialog
      queryClient.invalidateQueries({ queryKey: ['cart-request', user?.id] });
    }
  };

  // Wrapped cart actions
  const handleUpdateQuantity = (itemId: string, quantity: number) => {
    wrapWithCartRequestCheck(() => updateQuantity(itemId, quantity));
  };

  const handleRemoveFromCart = (itemId: string) => {
    wrapWithCartRequestCheck(() => removeFromCart(itemId));
  };

  const [showClearCartDialog, setShowClearCartDialog] = useState(false);

  const handleClearCart = () => {
    setShowClearCartDialog(true);
  };

  const confirmClearCart = () => {
    wrapWithCartRequestCheck(() => clearCart());
    setShowClearCartDialog(false);
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

    if (!termsAccepted) {
      toast({
        title: "الشروط والأحكام",
        description: "يجب الموافقة على الشروط والأحكام لإتمام الطلب",
        variant: "destructive",
      });
      return;
    }

    if (isDirectSaleCart) {
      if (!selectedAddress) {
        toast({
          title: "يجب اختيار عنوان",
          description: "الرجاء اختيار أو إضافة عنوان توصيل أولاً",
          variant: "destructive",
        });
        return;
      }
      setShowDirectSaleDialog(true);
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

    // فتح dialog التأكيد مباشرة
    setShowConfirmDialog(true);
  };

  const handleTermsAccepted = () => {
    setTermsAccepted(true);
    setShowTermsSheet(false);
  };

   // Direct sale checkout handler (with optional wallet payment)
  const handleDirectSaleCheckout = async (data: { notes: string; useWallet: boolean; walletDeduction: number }) => {
    if (!user || isDirectSaleProcessing) return;
    setIsDirectSaleProcessing(true);

    try {
      // Check address
      const { data: addresses, error: addressError } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .limit(1);

      if (addressError || !addresses || addresses.length === 0) {
        toast({ title: "يجب إضافة عنوان", description: "الرجاء إضافة عنوان توصيل أولاً", variant: "destructive" });
        navigate('/addresses');
        return;
      }

      const { data: defaultAddress } = await supabase
        .from('user_addresses')
        .select('*')
        .eq('user_id', user.id)
        .eq('is_default', true)
        .maybeSingle();

      const selectedAddress = defaultAddress || addresses[0];
      const deliveryFeeCalc = getDeliveryFee(selectedAddress.governorate);

      const { data: profileData } = await supabase
        .from('profiles')
        .select('full_name, phone_number, governorate, username')
        .eq('id', user.id)
        .single();

      const shippingAddressText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;

      const orderSubtotal = total - (appliedCoupon ? calculateDiscount() : 0);

      // Generate order number
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      // Wallet deduction for direct sale
      const walletDeductionAmount = data.useWallet ? Math.min(data.walletDeduction, orderSubtotal + deliveryFeeCalc) : 0;
      const codRemaining = (orderSubtotal + deliveryFeeCalc) - walletDeductionAmount;

      // Deduct from wallet if applicable
      if (walletDeductionAmount > 0) {
        const { error: walletError } = await supabase.rpc('deduct_wallet_balance', {
          p_user_id: user.id,
          p_amount: walletDeductionAmount,
          p_description: `خصم من المحفظة لطلب بيع مباشر`,
        });
        if (walletError) {
          toast({ title: "خطأ", description: "فشل في خصم رصيد المحفظة", variant: "destructive" });
          return;
        }
      }

      const orderInsertData = {
        user_id: user.id,
        order_number: orderNumber,
        total_amount: orderSubtotal + deliveryFeeCalc,
        subtotal: orderSubtotal,
        paid_amount: walletDeductionAmount,
        remaining_amount: codRemaining,
        shipping_address: shippingAddressText,
        phone_number: selectedAddress.phone_number,
        governorate: selectedAddress.governorate,
        status: 'confirmed',
        payment_status: codRemaining <= 0 ? 'paid' : 'cod',
        order_type: 'direct',
      } as any;

      const { data: orderResult, error: orderError } = await supabase
        .from('orders')
        .insert([orderInsertData])
        .select('*')
        .single();

      if (orderError || !orderResult) {
        toast({ title: "خطأ", description: orderError?.message || "حدث خطأ أثناء إنشاء الطلب", variant: "destructive" });
        return;
      }

      // Create order items
      const orderItems = items
        .filter(item => item.product_id || item.custom_request_id)
        .map(item => {
          const isCustomRequest = !!item.custom_request_id;
          const itemOption = (item as any).product_options;
          const itemColor = (item as any).selected_color;
          const colorData = itemColor && item.products?.colors
            ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
            : null;

          let itemPrice = isCustomRequest
            ? Number(item.custom_product_requests?.suggested_price || 0)
            : Number(item.products?.price || 0);

          const isDirect = (item as any).sale_type === 'direct';

          if (!isCustomRequest && isDirect && item.products?.direct_sale_price != null) {
            itemPrice = Number(item.products.direct_sale_price);
          } else if (!isCustomRequest && !isDirect) {
            const shippingType = (item.products as any)?.shipping_type;
            const seaPrice = (item.products as any)?.sea_price;
            const airPrice = (item.products as any)?.air_price;
            if (shippingType === 'sea' && seaPrice != null) itemPrice = Number(seaPrice);
            else if (shippingType === 'air' && airPrice != null) itemPrice = Number(airPrice);
            else if (shippingType === 'both' && seaPrice != null && airPrice != null) itemPrice = Math.min(Number(seaPrice), Number(airPrice));
          }

          if (colorData?.direct_sale_price != null && isDirect) {
            itemPrice = Number(colorData.direct_sale_price);
          } else if (colorData?.price != null) {
            itemPrice = Number(colorData.price);
          }
          if (itemOption?.price_adjustment) {
            itemPrice += Math.round(Number(itemOption.price_adjustment) * usdToIqd);
          }

          // Round to nearest 250 if enabled
          if ((item.products as any)?.round_up_price === true) {
            itemPrice = Math.ceil(itemPrice / 250) * 250;
          }

          return {
            order_id: orderResult.id,
            product_id: isCustomRequest ? null : item.product_id,
            custom_request_id: isCustomRequest ? item.custom_request_id : null,
            product_option_id: (item as any).product_option_id || null,
            quantity: item.quantity,
            unit_price: itemPrice,
            total_price: itemPrice * item.quantity,
            selected_color: itemColor || null,
            color_image_url: (item as any).color_image_url || null,
            selected_option: itemOption?.name_ar || null,
            product_name: isCustomRequest ? (item.custom_product_requests?.product_name || 'طلب مخصص') : (item.products?.name || 'منتج'),
            product_name_ar: isCustomRequest ? (item.custom_product_requests?.product_name || 'طلب مخصص') : (item.products?.name_ar || 'منتج'),
          };
        });

      if (orderItems.length > 0) {
        const { error: itemsError } = await supabase.from('order_items').insert(orderItems);
        if (itemsError) {
          console.error('Order items insert error:', itemsError);
        }
        
        // Deduct stock for direct sale items - retry up to 3 times
        let stockDeducted = false;
        for (let attempt = 0; attempt < 3 && !stockDeducted; attempt++) {
          const { error: stockError } = await supabase.rpc('deduct_order_stock', { p_order_id: orderResult.id });
          if (!stockError) {
            stockDeducted = true;
          } else {
            console.error(`Stock deduction attempt ${attempt + 1} error:`, stockError);
            if (attempt < 2) await new Promise(r => setTimeout(r, 500));
          }
        }
      }

      // Invalidate caches
      queryClient.invalidateQueries({ queryKey: ['today-direct-orders'] });
      if (walletDeductionAmount > 0) {
        queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      }

      // Send telegram notification
      try {
        const itemDetailsList = items.map((item, idx) => {
          const name = item.custom_request_id
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : (item.products?.name_ar || item.products?.name || 'منتج');
          const color = (item as any).selected_color;
          const option = (item as any).product_options?.name_ar;
          const shippingOpt = (item as any).shipping_option_name_ar;
          let detail = `${idx + 1}. ${name} × ${item.quantity}`;
          if (color) detail += `\n   🎨 اللون: ${color}`;
          if (option) detail += `\n   📐 الخيار: ${option}`;
          if (shippingOpt) detail += `\n   🚚 الشحن: ${shippingOpt}`;
          return detail;
        }).join('\n');

        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🛒 <b>طلب جديد - بيع مباشر ${walletDeductionAmount > 0 ? (codRemaining > 0 ? '(دفع مختلط)' : '(مدفوع من المحفظة)') : '(دفع عند الاستلام)'}</b>\n\n` +
              `👤 العميل: ${profileData?.full_name || 'غير محدد'}\n` +
              `📱 اليوزر: @${profileData?.username || 'غير محدد'}\n` +
              `📞 الهاتف: ${selectedAddress.phone_number}\n\n` +
              `📋 رقم الطلب: ${orderResult.order_number}\n` +
              `📦 عدد المنتجات: ${items.length}\n` +
              `📍 المحافظة: ${selectedAddress.governorate}\n\n` +
              `📝 <b>تفاصيل المنتجات:</b>\n${itemDetailsList}\n\n` +
              `💰 الإجمالي: ${(orderSubtotal + deliveryFeeCalc).toLocaleString()} د.ع\n` +
              (walletDeductionAmount > 0 ? `💳 مدفوع من المحفظة: ${walletDeductionAmount.toLocaleString()} د.ع\n` : '') +
              `💳 ${codRemaining > 0 ? `المتبقي عند الاستلام: ${codRemaining.toLocaleString()} د.ع` : 'تم الدفع بالكامل من المحفظة ✅'}`,
          },
        });
      } catch (e) { console.error('Telegram error:', e); }

      // Update offer purchase statuses to 'shipping_requested'
      const offerPurchaseIds = items
        .filter(item => (item as any).offer_purchase_id)
        .map(item => (item as any).offer_purchase_id);
      if (offerPurchaseIds.length > 0) {
        await supabase
          .from('product_offer_purchases')
          .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
          .in('id', offerPurchaseIds);
      }

      await clearCart();
      setShowDirectSaleDialog(false);
      setSuccessOrderNumber(orderResult.order_number);
      setShowOrderSuccess(true);
    } catch (error) {
      console.error('Direct sale checkout error:', error);
      toast({ title: "خطأ", description: "حدث خطأ أثناء إتمام الطلب", variant: "destructive" });
    } finally {
      setIsDirectSaleProcessing(false);
    }
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

      // Create order in database with full address details
      const shippingAddressText = `${selectedAddress.governorate} - ${selectedAddress.area}${selectedAddress.neighborhood ? ` - ${selectedAddress.neighborhood}` : ''} - ${selectedAddress.nearest_landmark}${selectedAddress.additional_notes ? ` - ${selectedAddress.additional_notes}` : ''}`;
      
      // Calculate payment info for pre-orders
      const isPreOrderWithPartialPayment = hasPreOrderItems && preOrderPaymentOption === 'quarter';
      const orderSubtotal = total - discount;
      const paidNow = isPreOrderWithPartialPayment ? Math.ceil(orderSubtotal * 0.25) : orderSubtotal;
      const orderRemaining = isPreOrderWithPartialPayment ? orderSubtotal - paidNow : 0;
      
      // استخدام الدالة الذرية الجديدة التي تنشئ الطلب وتخصم المبلغ في عملية واحدة
      const orderData = {
        total_amount: orderSubtotal + deliveryFee,
        subtotal: orderSubtotal,
        paid_amount: paidNow + deliveryFee,
        remaining_amount: orderRemaining,
        shipping_address: shippingAddressText,
        phone_number: selectedAddress.phone_number,
        governorate: selectedAddress.governorate,
      };

      const { data: orderId, error: orderError } = await supabase.rpc('create_order_with_wallet_payment', {
        p_user_id: user.id,
        p_order_data: orderData,
        p_payment_amount: requiredPaymentNow,
      });

      if (orderError || !orderId) {
        console.error('Error creating order with payment:', orderError);
        toast({
          title: "خطأ",
          description: orderError?.message || "حدث خطأ أثناء إنشاء الطلب",
          variant: "destructive",
        });
        return;
      }

      // Fetch the created order to get order_number
      const { data: order, error: fetchOrderError } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId)
        .single();

      if (fetchOrderError || !order) {
        console.error('Error fetching order:', fetchOrderError);
        toast({
          title: "خطأ",
          description: "تم إنشاء الطلب لكن حدث خطأ في جلب التفاصيل",
          variant: "destructive",
        });
        return;
      }

      // إرسال إشعار للتيليجرام عند إنشاء طلب جديد
      try {
        const paymentStatusText = isPreOrderWithPartialPayment ? 'دفع جزئي (ربع المبلغ)' : 'مدفوع بالكامل';
        const orderTotalAmount = (total - discount) + deliveryFee;
        const paidAmountNow = grandTotal;
        const remainingToPay = isPreOrderWithPartialPayment ? remainingAmount : 0;

        const paidItemDetailsList = items.map((item, idx) => {
          const name = item.custom_request_id
            ? (item.custom_product_requests?.product_name || 'طلب مخصص')
            : (item.products?.name_ar || item.products?.name || 'منتج');
          const color = (item as any).selected_color;
          const option = (item as any).product_options?.name_ar;
          const shippingOpt = (item as any).shipping_option_name_ar;
          let detail = `${idx + 1}. ${name} × ${item.quantity}`;
          if (color) detail += `\n   🎨 اللون: ${color}`;
          if (option) detail += `\n   📐 الخيار: ${option}`;
          if (shippingOpt) detail += `\n   🚚 الشحن: ${shippingOpt}`;
          return detail;
        }).join('\n');
        
        await supabase.functions.invoke('send-telegram-notification', {
          body: {
            message: `🛒 <b>طلب جديد - مدفوع</b>\n\n` +
              `👤 العميل: ${profile?.full_name || 'غير محدد'}\n` +
              `📱 اليوزر: @${profile?.username || 'غير محدد'}\n` +
              `📞 الهاتف: ${selectedAddress.phone_number}\n\n` +
              `📋 رقم الطلب: ${order.order_number}\n` +
              `📦 عدد المنتجات: ${items.length}\n` +
              `📍 المحافظة: ${selectedAddress.governorate}\n\n` +
              `📝 <b>تفاصيل المنتجات:</b>\n${paidItemDetailsList}\n\n` +
              `💰 <b>تفاصيل الدفع:</b>\n` +
              `• المبلغ الإجمالي: ${orderTotalAmount.toLocaleString()} د.ع\n` +
              `• المدفوع الآن: ${paidAmountNow.toLocaleString()} د.ع\n` +
              (remainingToPay > 0 ? `• المتبقي عند الاستلام: ${remainingToPay.toLocaleString()} د.ع\n` : '') +
              `• حالة الدفع: ${paymentStatusText}`,
          },
        });
      } catch (telegramError) {
        console.error('خطأ في إرسال إشعار التيليجرام:', telegramError);
      }

      // للطلبات المسبقة بالدفع الجزئي، تحديث حالة الدفع
      if (isPreOrderWithPartialPayment) {
        await supabase
          .from('orders')
          .update({
            payment_status: 'partial',
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
            itemPrice += Math.round(Number(itemOption.price_adjustment) * usdToIqd);
          }

          // Add pre-order shipping adjustment (if chosen)
          const shippingIndex = (item as any).shipping_option_index;
          const shippingOptions = item.products?.pre_order_shipping_options;
          if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
            const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
            itemPrice += shippingAdjustment;
          }

          // Round to nearest 250 if enabled
          if ((item.products as any)?.round_up_price === true) {
            itemPrice = Math.ceil(itemPrice / 250) * 250;
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
        
        const isDirect = (item as any).sale_type === 'direct';
        let itemPrice = isCustomRequest
          ? Number(customRequest?.suggested_price || 0)
          : Number(item.products?.price || 0);
        
        if (!isCustomRequest && item.products) {
          if (isDirect && item.products.direct_sale_price != null) {
            itemPrice = Number(item.products.direct_sale_price);
          } else if (!isDirect) {
            const shippingType = (item as any).shipping_type;
            if (shippingType === 'sea' && item.products.sea_price != null) {
              itemPrice = Number(item.products.sea_price);
            } else if (shippingType === 'air' && item.products.air_price != null) {
              itemPrice = Number(item.products.air_price);
            }
          }
        }
        
        // Use product_options data directly from the cart item
        const itemOption = (item as any).product_options;
        
        const itemColor = (item as any).selected_color;
        const colorData = itemColor && item.products?.colors
          ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
          : null;
        
        if (colorData) {
          if (isDirect && colorData.direct_sale_price != null) {
            itemPrice = Number(colorData.direct_sale_price);
          } else if (colorData.price != null) {
            itemPrice = Number(colorData.price);
          }
        }
        
        if (itemOption?.price_adjustment) {
          itemPrice += Math.round(Number(itemOption.price_adjustment) * usdToIqd);
        }

        // Add pre-order shipping adjustment (if chosen)
        const shippingIndex = (item as any).shipping_option_index;
        const shippingOptions = item.products?.pre_order_shipping_options;
        if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
          const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
          itemPrice += shippingAdjustment;
        }
        
        // Round to nearest 250 if enabled
        if ((item.products as any)?.round_up_price === true) {
          itemPrice = Math.ceil(itemPrice / 250) * 250;
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

      // Update offer purchase statuses to 'shipping_requested'
      const offerPurchaseIds2 = items
        .filter(item => (item as any).offer_purchase_id)
        .map(item => (item as any).offer_purchase_id);
      if (offerPurchaseIds2.length > 0) {
        await supabase
          .from('product_offer_purchases')
          .update({ purchase_status: 'shipping_requested', shipping_requested_at: new Date().toISOString() })
          .in('id', offerPurchaseIds2);
      }

      // Clear cart after successful order
      await clearCart();

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappURL = `https://wa.me/9647838455220?text=${encodedMessage}`;
      
      // Open WhatsApp in new window
      window.open(whatsappURL, '_blank');
      
      toast({
        title: "تم إنشاء الطلب بنجاح ✅",
        description: `رقم الطلب: ${order.order_number} — لا تنسَ تقييم المنتجات بعد الاستلام للحصول على خصومات وهدايا! ⭐`,
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
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-6">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm" dir="rtl">
      <main className="max-w-4xl mx-auto px-4 py-8 w-full">
        <div className="mb-6">
          <div className="flex items-center gap-3 mb-2">
            <h1 className="text-3xl font-black text-primary">{t('cart_title')}</h1>
            {itemCount > 0 && (
              <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border ${
                isDirectSaleCart
                  ? 'bg-primary/10 text-primary border-primary/20'
                  : 'bg-accent/10 text-accent-foreground border-accent/20'
              }`}>
                {isDirectSaleCart ? (
                  <><Package className="w-3 h-3" /> بيع مباشر</>
                ) : (
                  <><Truck className="w-3 h-3" /> حجز مسبق</>
                )}
              </span>
            )}
          </div>
          <p className="text-muted-foreground text-sm">
            {itemCount > 0 ? t('cart_items_in_cart', { count: itemCount, label: itemCount === 1 ? t('cart_product') : t('cart_products') }) : t('cart_empty')}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
            <div className="w-20 h-20 mx-auto mb-6 opacity-20">
              <ShoppingBag className="w-full h-full text-muted-foreground" />
            </div>
            <h2 className="text-xl font-bold text-foreground mb-2">{t('cart_empty')}</h2>
            <p className="text-muted-foreground mb-6 text-sm">
              {t('cart_no_items_yet')}
            </p>
            <Link to="/">
              <Button className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90">
                <ArrowRight className="ml-2 h-4 w-4" />
                {t('cart_browse_products')}
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
                  // Offer purchase items (from storage) are rendered as single items
                  if ((item as any).offer_purchase_id) {
                    acc.push({ type: 'offer_purchase', items: [item] });
                    return acc;
                  }

                  // Custom requests are not grouped
                  if (item.custom_request_id) {
                    acc.push({ type: 'single', items: [item] });
                    return acc;
                  }

                  // Bundle items are rendered as single items
                  if (item.bundle_id) {
                    acc.push({ type: 'bundle', items: [item] });
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
                  // Bundle item rendering
                  if (group.type === 'bundle') {
                    const item = group.items[0];
                    const bundle = (item as any).product_bundles;
                    if (!bundle) return null;
                    const bundlePrice = Number(bundle.bundle_price);
                    const isRemoving = removingItemIds.has(item.id);
                    const bundleMaxQty = item.bundle_id && bundleMaxQtyMap ? (bundleMaxQtyMap[item.bundle_id] ?? 99) : 99;
                    const isDirect = (item as any).sale_type === 'direct';
                    const effectiveMax = isDirect ? bundleMaxQty : 99;
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                      }, 300);
                    };
                    return (
                      <div key={item.id} className={`rounded-xl p-2.5 sm:p-4 border border-primary/20 bg-primary/5 transition-all duration-300 ${isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : ''}`}>
                        <div className="flex gap-2.5 sm:gap-4">
                          {bundle.image_url && (
                            <Link to="/bundles" className="flex-shrink-0">
                              <img src={bundle.image_url} alt={bundle.title_ar} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-primary/30" />
                            </Link>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <Link to="/bundles" className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block">
                                  {bundle.title_ar}
                                </Link>
                                <span className="text-[9px] bg-primary/20 text-primary px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5">
                                  <Package className="h-2.5 w-2.5" /> باقة
                                </span>
                              </div>
                              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0" onClick={handleAnimatedRemove}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-sm sm:text-base font-black text-primary">
                                <AnimatedPrice value={bundlePrice} formatFn={formatPrice} /> <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                              </span>
                              <div className="flex items-center gap-1 bg-muted/30 rounded-lg border border-border/40">
                                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity - 1)} disabled={item.quantity <= 1}>
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <AnimatedQuantity value={item.quantity} className="w-6 text-center font-bold text-xs" />
                                <Button type="button" size="icon" variant="ghost" className="h-7 w-7" onClick={() => handleUpdateQuantity(item.id, item.quantity + 1)} disabled={item.quantity >= effectiveMax}>
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                            {isDirect && effectiveMax < 99 && (
                              <div className="text-[9px] text-muted-foreground mt-0.5">
                                الحد الأقصى: <span className="font-bold text-foreground">{effectiveMax}</span> باقة
                              </div>
                            )}
                            {item.quantity > 1 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 text-left">
                                المجموع: <AnimatedPrice value={bundlePrice * item.quantity} formatFn={formatPrice} className="font-bold text-foreground" /> د.ع
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // Offer purchase items (from storage - price = 0)
                  if (group.type === 'offer_purchase') {
                    const item = group.items[0];
                    const offerData = (item as any).offer_purchase;
                    const offerInfo = offerData?.product_offers;
                    const isRemoving = removingItemIds.has(item.id);
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => { const next = new Set(prev); next.delete(item.id); return next; });
                      }, 300);
                    };
                    return (
                      <div key={item.id} className={`rounded-xl p-2.5 sm:p-4 border border-amber-500/30 bg-amber-500/5 transition-all duration-300 ${isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : ''}`}>
                        <div className="flex gap-2.5 sm:gap-4">
                          {offerInfo?.image_url && (
                            <div className="flex-shrink-0">
                              <img src={offerInfo.image_url} alt={offerInfo?.title_ar || ''} className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-amber-500/30" />
                            </div>
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                <span className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 block">
                                  {offerInfo?.title_ar || 'منتج من المخزن'}
                                </span>
                                <span className="text-[9px] bg-amber-500/20 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 rounded-full inline-flex items-center gap-0.5 mt-0.5">
                                  <Package className="h-2.5 w-2.5" /> من المخزن
                                </span>
                              </div>
                              <Button type="button" size="icon" variant="ghost" className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0" onClick={handleAnimatedRemove}>
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-sm sm:text-base font-black text-emerald-600">
                                مجاني <span className="text-[10px] font-normal text-muted-foreground">(مدفوع مسبقاً)</span>
                              </span>
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  }

                  // If it's a single item (custom request or single shipping option)
                  if (group.type === 'single' || group.items.length === 1) {
                    const item = group.items[0];
                    const itemOption = (item as any).product_options;
                    const itemColor = (item as any).selected_color;
                    const colorData = itemColor && item.products?.colors
                      ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
                      : null;
                    
                    const isDirect = (item as any).sale_type === 'direct';
                    let itemPrice = item.products 
                      ? Number(item.products.price)
                      : Number(item.custom_product_requests?.suggested_price || 0);
                    
                    if (item.products) {
                      if (isDirect && item.products.direct_sale_price != null) {
                        itemPrice = Number(item.products.direct_sale_price);
                      } else if (!isDirect) {
                        const shippingType = (item as any).shipping_type;
                        if (shippingType === 'sea' && item.products.sea_price != null) {
                          itemPrice = Number(item.products.sea_price);
                        } else if (shippingType === 'air' && item.products.air_price != null) {
                          itemPrice = Number(item.products.air_price);
                        }
                      }
                    }
                    
                    if (colorData) {
                      if (isDirect && colorData.direct_sale_price != null) {
                        itemPrice = Number(colorData.direct_sale_price);
                      } else if (colorData.price != null) {
                        itemPrice = Number(colorData.price);
                      }
                    }
                    
                    if (itemOption?.price_adjustment) {
                      itemPrice += Math.round(Number(itemOption.price_adjustment) * usdToIqd);
                    }

                    const shippingIndex = (item as any).shipping_option_index;
                    const shippingOptions = item.products?.pre_order_shipping_options;
                    if (shippingIndex != null && Array.isArray(shippingOptions) && shippingOptions[shippingIndex]) {
                      const shippingAdjustment = Number((shippingOptions[shippingIndex] as any).price_adjustment || 0);
                      itemPrice += shippingAdjustment;
                    }
                    
                    // Round to nearest 250 if enabled
                    if ((item.products as any)?.round_up_price === true) {
                      itemPrice = Math.ceil(itemPrice / 250) * 250;
                    }
                    
                    const isRemoving = removingItemIds.has(item.id);
                    
                    const handleAnimatedRemove = () => {
                      setRemovingItemIds(prev => new Set(prev).add(item.id));
                      setTimeout(() => {
                        handleRemoveFromCart(item.id);
                        setRemovingItemIds(prev => {
                          const next = new Set(prev);
                          next.delete(item.id);
                          return next;
                        });
                      }, 300);
                    };

                    return (
                      <div 
                        key={item.id}
                        className={`rounded-xl p-2.5 sm:p-4 border border-border/50 bg-card hover:border-primary/30 transition-all duration-300 ${
                          isRemoving ? 'opacity-0 scale-95 -translate-x-4 max-h-0 !p-0 !my-0 overflow-hidden' : 'opacity-100 scale-100 translate-x-0'
                        }`}
                      >
                        <div className="flex gap-2.5 sm:gap-4">
                          {/* Product Image - compact on mobile */}
                          {((item.products?.image_url) || (item.custom_product_requests?.image_url) || (item as any).option_image_url || (item as any).color_image_url) && (
                            <Link 
                              to={item.products ? `/product/${item.products.slug}` : '#'}
                              className="flex-shrink-0"
                            >
                              <img 
                                src={(item as any).option_image_url || (item as any).color_image_url || (item.products?.images && item.products.images[0]) || item.products?.image_url || item.custom_product_requests?.image_url || ''}
                                alt={item.products?.name_ar || item.custom_product_requests?.product_name || ''}
                                className="w-16 h-16 sm:w-24 sm:h-24 object-cover rounded-lg border border-border/40"
                              />
                            </Link>
                          )}
                          
                          {/* Product Info - compact */}
                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-1">
                              <div className="min-w-0 flex-1">
                                {item.products ? (
                                  <Link 
                                    to={`/product/${item.products.slug}`}
                                    className="font-bold text-xs sm:text-sm text-foreground hover:text-primary transition-colors line-clamp-1 block"
                                  >
                                    {item.products.name_ar}
                                  </Link>
                                ) : (
                                  <div className="font-bold text-xs sm:text-sm text-foreground line-clamp-1 flex items-center gap-1">
                                    {item.custom_product_requests?.product_name}
                                    <span className="text-[9px] bg-primary/20 text-primary px-1 py-0.5 rounded-full shrink-0">طلب خاص</span>
                                  </div>
                                )}
                                
                                {/* Option/Color/Shipping tags inline */}
                                {(itemOption || colorData || (item as any).shipping_option_name_ar) && (
                                  <div className="flex flex-wrap gap-1 mt-0.5">
                                    {itemOption && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded">{itemOption.name_ar}</span>
                                    )}
                                    {colorData && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded flex items-center gap-0.5">
                                        <span className="w-2.5 h-2.5 rounded-full border border-border/50 inline-block" style={{ backgroundColor: colorData.hex_code }} />
                                        {colorData.name_ar}
                                      </span>
                                    )}
                                    {(item as any).shipping_option_name_ar && (
                                      <span className="text-[10px] text-muted-foreground bg-border/30 px-1.5 py-0.5 rounded">{(item as any).shipping_option_name_ar}</span>
                                    )}
                                  </div>
                                )}
                              </div>

                              {/* Delete button */}
                              <Button
                                type="button"
                                size="icon"
                                variant="ghost"
                                className="text-destructive hover:text-destructive hover:bg-destructive/10 h-6 w-6 shrink-0 active:scale-75 transition-transform"
                                onClick={(e) => {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  handleAnimatedRemove();
                                }}
                                aria-label="حذف المنتج"
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>

                            {/* Price + Quantity row */}
                            <div className="flex items-center justify-between mt-1.5">
                              <span className="text-sm sm:text-base font-black text-primary">
                                <AnimatedPrice value={itemPrice} formatFn={formatPrice} /> <span className="text-[10px] font-normal text-muted-foreground">د.ع</span>
                              </span>
                              
                              <div className="flex items-center gap-1 bg-muted/30 rounded-lg border border-border/40">
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 touch-manipulation active:scale-90 transition-transform"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateQuantity(item.id, item.quantity - 1);
                                  }}
                                  disabled={item.quantity <= 1}
                                >
                                  <Minus className="h-3 w-3" />
                                </Button>
                                <AnimatedQuantity value={item.quantity} className="w-6 text-center font-bold text-xs" />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-7 w-7 touch-manipulation active:scale-90 transition-transform"
                                  onClick={(e) => {
                                    e.preventDefault();
                                    e.stopPropagation();
                                    handleUpdateQuantity(item.id, item.quantity + 1);
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>

                            {/* Total if quantity > 1 */}
                            {item.quantity > 1 && (
                              <div className="text-[11px] text-muted-foreground mt-0.5 text-left">
                                المجموع: <AnimatedPrice value={itemPrice * item.quantity} formatFn={formatPrice} className="font-bold text-foreground" /> د.ع
                              </div>
                            )}
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
                      updateQuantity={handleUpdateQuantity}
                      removeFromCart={handleRemoveFromCart}
                      formatPrice={formatPrice}
                    />
                  );
                });
              })()}

              {/* Cart Upsell Offers */}
              <CartUpsellOffers />

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
                  {t('cart_code')}
                </Button>
                <Button
                  variant="outline"
                  className="flex-1 border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                  onClick={handleClearCart}
                >
                  <Trash2 className="ml-2 h-4 w-4" />
                  {t('cart_clear')}
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
                    {t('cart_coupon_label')}
                  </Label>
                  {!appliedCoupon ? (
                    <div className="flex gap-2">
                      <Input
                        id="coupon"
                        value={couponCode}
                        onChange={(e) => setCouponCode(e.target.value)}
                        placeholder={t('cart_coupon_placeholder')}
                        className="flex-1"
                        onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                      />
                      <Button
                        onClick={applyCoupon}
                        disabled={couponLoading}
                        variant="outline"
                      >
                        {couponLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : t('cart_coupon_apply')}
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
                    <span>{t('cart_subtotal')}</span>
                    <span className="font-bold"><AnimatedPrice value={total} formatFn={formatPrice} /> دينار عراقي</span>
                  </div>
                  
                  {appliedCoupon && discount > 0 && (
                    <div className="flex justify-between animate-fade-in">
                      <span className="text-green-600">{t('cart_discount')} ({appliedCoupon.code})</span>
                      <div className="flex flex-col items-end">
                        <span className="text-muted-foreground line-through text-xs animate-fade-in" style={{ animationDelay: '0.1s' }}>
                          {formatPrice(total)} د.ع
                        </span>
                        <span className="font-bold text-green-600 animate-scale-in" style={{ animationDelay: '0.3s' }}>
                          -<AnimatedPrice value={discount} formatFn={formatPrice} /> دينار عراقي
                        </span>
                      </div>
                    </div>
                  )}
                  
                  {/* الضريبة مدمجة مع سعر المنتج - لا تظهر بشكل منفصل */}
                  
                  <div className="flex justify-between text-foreground">
                    <span>{t('cart_delivery')}</span>
                    <span className="font-bold"><AnimatedPrice value={deliveryFee} formatFn={formatPrice} /> دينار عراقي</span>
                  </div>
                  
                  {/* Address selector for direct sale */}
                  {isDirectSaleCart && (
                    <>
                    <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2 text-sm font-bold text-foreground">
                          <MapPin className="h-4 w-4 text-primary" />
                          عنوان التوصيل
                        </div>
                        <div className="flex items-center gap-1">
                          {userAddresses && userAddresses.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 text-xs text-primary hover:text-primary/80"
                              onClick={() => setShowAddressSwitcher(true)}
                            >
                              تبديل العنوان
                            </Button>
                          )}
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-7 text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => navigate('/addresses')}
                          >
                            {userAddresses && userAddresses.length > 0 ? 'إدارة' : 'إضافة عنوان'}
                          </Button>
                        </div>
                      </div>
                      {selectedAddress ? (
                        <div className="flex items-start gap-2 p-2.5 rounded-lg border border-primary/30 bg-background">
                          <MapPin className="h-3.5 w-3.5 text-primary mt-0.5 shrink-0" />
                          <div className="text-xs space-y-0.5 flex-1">
                            {selectedAddress.label && <p className="font-black text-primary text-[11px]">{selectedAddress.label}</p>}
                            <p className="font-bold text-foreground">{selectedAddress.full_name}</p>
                            <p className="text-muted-foreground">{selectedAddress.governorate} - {selectedAddress.area}</p>
                            <p className="text-muted-foreground" dir="ltr">{selectedAddress.phone_number}</p>
                          </div>
                        </div>
                      ) : (
                        <div className="text-center py-3">
                          <p className="text-xs text-muted-foreground mb-2">لا يوجد عنوان محفوظ</p>
                          <Button
                            size="sm"
                            variant="outline"
                            className="text-xs"
                            onClick={() => navigate('/addresses')}
                          >
                            <MapPin className="h-3 w-3 ml-1" />
                            إضافة عنوان جديد
                          </Button>
                        </div>
                      )}
                    </div>

                    <Dialog open={showAddressSwitcher} onOpenChange={setShowAddressSwitcher}>
                      <DialogContent dir="rtl" className="max-w-sm">
                        <DialogHeader>
                          <DialogTitle className="flex items-center gap-2">
                            <MapPin className="h-5 w-5 text-primary" />
                            اختر عنوان التوصيل
                          </DialogTitle>
                        </DialogHeader>
                        <div className="space-y-2 max-h-[60vh] overflow-y-auto">
                          {userAddresses?.map((addr: any) => (
                            <div
                              key={addr.id}
                              onClick={() => {
                                setSelectedAddressId(addr.id);
                                setShowAddressSwitcher(false);
                              }}
                              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-all ${
                                selectedAddressId === addr.id
                                  ? 'border-primary bg-primary/5 ring-1 ring-primary/20'
                                  : 'border-border/50 hover:border-primary/30 hover:bg-muted/30'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full border-2 mt-0.5 shrink-0 flex items-center justify-center ${
                                selectedAddressId === addr.id ? 'border-primary' : 'border-muted-foreground/40'
                              }`}>
                                {selectedAddressId === addr.id && (
                                  <div className="w-2.5 h-2.5 rounded-full bg-primary" />
                                )}
                              </div>
                              <div className="text-sm space-y-0.5 flex-1">
                                {addr.label && <p className="font-black text-primary text-xs">{addr.label}</p>}
                                <p className="font-bold text-foreground">{addr.full_name}</p>
                                <p className="text-muted-foreground text-xs">{addr.governorate} - {addr.area}</p>
                                {addr.nearest_landmark && <p className="text-muted-foreground text-xs">{addr.nearest_landmark}</p>}
                                <p className="text-muted-foreground text-xs" dir="ltr">{addr.phone_number}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </DialogContent>
                    </Dialog>
                    </>
                  )}

                  {/* خيارات الدفع للطلب المسبق */}
                  {hasPreOrderItems && (
                    <div className="py-4 px-4 rounded-lg bg-accent/10 border border-accent/30">
                      <div className="flex items-center gap-2 mb-3">
                        <CreditCard className="h-5 w-5 text-accent" />
                        <span className="font-bold text-foreground">{t('cart_preorder_options')}</span>
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
                            <div className="font-bold text-foreground">{t('cart_preorder_full')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('cart_preorder_full_desc', { amount: formatPrice(subtotalWithTax) })}
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
                            <div className="font-bold text-foreground">{t('cart_preorder_quarter')}</div>
                            <div className="text-xs text-muted-foreground">
                              {t('cart_preorder_quarter_pay', { amount: formatPrice(Math.ceil(subtotalWithTax * 0.25)) })}
                            </div>
                            <div className="text-xs text-orange-500 mt-1">
                              {t('cart_preorder_remaining', { amount: formatPrice(remainingAmount) })}
                            </div>
                          </Label>
                        </div>
                      </RadioGroup>
                    </div>
                  )}
                  
                  {/* Payment section - different for direct sale vs preorder */}
                  {isDirectSaleCart ? (
                    <div className="py-3 px-4 rounded-lg border bg-primary/5 border-primary/30">
                      <div className="flex items-center gap-2 mb-2">
                        <Truck className="h-5 w-5 text-primary" />
                        <span className="font-bold text-primary">الدفع عند الاستلام</span>
                      </div>
                      <p className="text-xs text-muted-foreground">سيتم الدفع نقداً عند استلام الطلب</p>
                    </div>
                  ) : (
                    <div className={`py-3 px-4 rounded-lg border ${hasEnoughBalance ? 'bg-card border-primary/30' : 'bg-card border-destructive/30'}`}>
                      <div className="flex items-center gap-2 mb-2">
                        <Wallet className={`h-5 w-5 ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`} />
                        <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                          {t('cart_wallet_payment')}
                        </span>
                      </div>
                      <div className="space-y-1 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('cart_wallet_balance')}:</span>
                          <span className={`font-bold ${hasEnoughBalance ? 'text-primary' : 'text-destructive'}`}>
                            {formatPrice(walletBalance)} {t('common_iqd')}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">{t('cart_wallet_required')}:</span>
                          <span className="font-bold text-foreground">{formatPrice(requiredPaymentNow)} {t('common_iqd')}</span>
                        </div>
                        {!hasEnoughBalance && (
                          <div className="mt-2 text-xs text-destructive">
                            {t('cart_wallet_charge_extra', { amount: formatPrice(requiredPaymentNow - walletBalance) })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                  
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
                        {hasPreOrderItems && preOrderPaymentOption === 'quarter' ? t('cart_preorder_required_now') : t('common_total')}
                      </span>
                      <span className="text-primary"><AnimatedPrice value={grandTotal} formatFn={formatPrice} /> دينار عراقي</span>
                    </div>
                    {useWalletBalance && walletDeduction > 0 && grandTotal === 0 && (
                      <p className="text-xs text-green-600 mt-2 text-center">
                        {t('cart_wallet_paid_full')}
                      </p>
                    )}
                  </div>
                </div>

                {/* Terms and Conditions Checkbox */}
                <div className="flex items-center gap-2 mb-3">
                  <Checkbox
                    id="terms-checkbox"
                    checked={termsAccepted}
                    onCheckedChange={(checked) => setTermsAccepted(checked === true)}
                    className="h-3.5 w-3.5"
                  />
                  <label htmlFor="terms-checkbox" className="text-xs text-muted-foreground cursor-pointer">
                    {t('cart_terms_agree')}{' '}
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        setShowTermsSheet(true);
                      }}
                      className="text-primary hover:underline"
                    >
                      {t('cart_terms_link')}
                    </button>
                  </label>
                </div>

                <Button 
                  className="w-full mb-3 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 disabled:from-primary/40 disabled:to-accent/40 disabled:text-primary-foreground/60"
                  size="lg"
                  onClick={handleCheckoutClick}
                  disabled={isCheckingOut || isDirectSaleProcessing || (!isDirectSaleCart && !hasEnoughBalance) || !termsAccepted}
                >
                  {isCheckingOut || isDirectSaleProcessing ? (
                    <>
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                      {t('cart_processing')}
                    </>
                  ) : !termsAccepted ? (
                    <>
                      <FileText className="ml-2 h-4 w-4" />
                      {t('cart_terms_accept_first')}
                    </>
                  ) : isDirectSaleCart ? (
                    <>
                      <Truck className="ml-2 h-4 w-4" />
                      إتمام الطلب - الدفع عند الاستلام
                    </>
                  ) : !hasEnoughBalance ? (
                    <>
                      <Wallet className="ml-2 h-4 w-4" />
                      {t('cart_wallet_insufficient')}
                    </>
                  ) : (
                    t('cart_confirm_order')
                  )}
                </Button>
                
                {!isDirectSaleCart && !hasEnoughBalance && (
                  <Button 
                    className="w-full mb-3 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    size="lg"
                    onClick={() => setShowWalletDialog(true)}
                  >
                    <Wallet className="ml-2 h-4 w-4" />
                    {t('cart_wallet_charge')}
                  </Button>
                )}

                <Link to="/products">
                  <Button 
                    variant="outline"
                    className="w-full"
                  >
                    <ArrowRight className="ml-2 h-4 w-4" />
                    {t('cart_continue_shopping')}
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
            <AlertDialogTitle>{t('cart_confirm_title')}</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('cart_confirm_deduct', { amount: formatPrice(requiredPaymentNow) })}</p>
              <p className="text-sm text-muted-foreground">
                {t('cart_confirm_balance_after', { current: formatPrice(walletBalance), after: formatPrice(walletBalance - requiredPaymentNow) })}
              </p>
              {hasPreOrderItems && preOrderPaymentOption === 'quarter' && remainingAmount > 0 && (
                <p className="text-orange-600 text-sm">
                  {t('cart_confirm_remaining', { amount: formatPrice(remainingAmount) })}
                </p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction 
              onClick={handleCheckout}
              className="bg-primary hover:bg-primary/90"
            >
              {t('common_confirm')}
            </AlertDialogAction>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Cart Change Warning Dialog */}
      <AlertDialog open={showCartChangeWarning} onOpenChange={setShowCartChangeWarning}>
        <AlertDialogContent 
          dir="rtl" 
          className="bg-card border-destructive/30 max-w-[90vw] sm:max-w-lg z-[200]"
        >
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-foreground">
              <Trash2 className="h-5 w-5 text-destructive" />
              {t('cart_change_warning')}
            </AlertDialogTitle>
            <AlertDialogDescription className="text-foreground/70 space-y-2">
              <p>{t('cart_change_warning_desc', { code: pendingCartRequest?.cart_code || '' })}</p>
              {pendingCartRequest?.adjusted_total && (
                <p className="text-orange-500">{t('cart_change_warning_price', { amount: formatPrice(pendingCartRequest.adjusted_total) })}</p>
              )}
              <p>{t('common_confirm')}?</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="flex-col-reverse sm:flex-row-reverse gap-3 mt-4">
            <AlertDialogAction 
              onClick={(e) => {
                e.stopPropagation();
                handleConfirmCartChange();
              }}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 min-h-[48px] w-full sm:w-auto text-base"
            >
              {t('cart_change_confirm')}
            </AlertDialogAction>
            <AlertDialogCancel 
              onClick={(e) => {
                e.stopPropagation();
                setPendingAction(null);
              }}
              className="bg-muted text-foreground hover:bg-muted/80 min-h-[48px] w-full sm:w-auto text-base"
            >
              {t('common_cancel')}
            </AlertDialogCancel>
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

      {/* Terms and Conditions Sheet */}
      <TermsAndConditionsSheet
        open={showTermsSheet}
        onOpenChange={setShowTermsSheet}
        onAccept={handleTermsAccepted}
        isLoading={isCheckingOut}
      />

      {/* Direct Sale Checkout Dialog */}
      <DirectSaleCheckoutDialog
        open={showDirectSaleDialog}
        onOpenChange={setShowDirectSaleDialog}
        onConfirm={handleDirectSaleCheckout}
        address={defaultUserAddress}
        totalAmount={total}
        deliveryFee={deliveryFee}
        itemCount={itemCount}
        isProcessing={isDirectSaleProcessing}
        walletBalance={walletBalance}
        hasActiveDirectOrders={(activeDirectOrders?.length || 0) > 0}
      />

      {/* Order Success Animation */}
      <OrderSuccessAnimation
        open={showOrderSuccess}
        onClose={() => setShowOrderSuccess(false)}
        orderNumber={successOrderNumber}
        timeUntilCutoff={(() => {
          const now = new Date();
          const cutoff = new Date();
          cutoff.setHours(17, 0, 0, 0);
          if (now >= cutoff) return null;
          const ms = cutoff.getTime() - now.getTime();
          const h = Math.floor(ms / 3600000);
          const m = Math.floor((ms % 3600000) / 60000);
          return `${h} ساعة و ${m} دقيقة`;
        })()}
      />

      {/* Clear Cart Confirmation Dialog */}
      <AlertDialog open={showClearCartDialog} onOpenChange={setShowClearCartDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2 text-destructive">
              <Trash2 className="h-5 w-5" />
              تفريغ السلة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من تفريغ السلة؟ سيتم حذف جميع المنتجات ({itemCount} منتج) من السلة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmClearCart}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              تفريغ السلة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default Cart;