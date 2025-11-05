import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useCart } from '@/hooks/useCart';
import { useAuth } from '@/hooks/useAuth';
import { Loader2, Minus, Plus, Trash2, ShoppingBag, ArrowRight, Ticket, X } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useQuery } from '@tanstack/react-query';
import { formatPrice } from '@/lib/utils';
import { useState } from 'react';
import { Badge } from '@/components/ui/badge';

const Cart = () => {
  const { items, loading, total, updateQuantity, removeFromCart, clearCart, itemCount } = useCart();
  const { user } = useAuth();
  const { toast } = useToast();
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<any>(null);
  const [couponLoading, setCouponLoading] = useState(false);

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

  const { data: productOptions } = useQuery({
    queryKey: ['cart-product-options'],
    queryFn: async () => {
      const optionIds = items
        .map((item: any) => item.product_option_id)
        .filter((id: string | null) => id !== null);
      
      if (optionIds.length === 0) return [];
      
      const { data } = await supabase
        .from('product_options')
        .select('*')
        .in('id', optionIds);
      
      return data || [];
    },
    enabled: items.length > 0
  });

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
  const grandTotal = Math.max(0, total - discount + deliveryFee);

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
      const { data: coupon, error } = await supabase
        .from('coupons')
        .select('*')
        .eq('code', couponCode.toUpperCase().trim())
        .eq('active', true)
        .single();

      if (error || !coupon) {
        toast({
          title: "كوبون غير صحيح",
          description: "الكوبون غير موجود أو غير فعال",
          variant: "destructive",
        });
        return;
      }

      // Check if expired
      if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) {
        toast({
          title: "كوبون منتهي",
          description: "هذا الكوبون قد انتهت صلاحيته",
          variant: "destructive",
        });
        return;
      }

      // Check if max uses reached
      if (coupon.max_uses && coupon.current_uses >= coupon.max_uses) {
        toast({
          title: "كوبون مكتمل",
          description: "تم استخدام هذا الكوبون بالحد الأقصى",
          variant: "destructive",
        });
        return;
      }

      // Check minimum purchase
      if (coupon.min_purchase_amount && total < coupon.min_purchase_amount) {
        toast({
          title: "الحد الأدنى للطلب غير مستوفى",
          description: `الحد الأدنى للطلب هو ${formatPrice(coupon.min_purchase_amount)} دينار عراقي`,
          variant: "destructive",
        });
        return;
      }

      // Check if user already used this coupon
      if (user) {
        const { data: usage } = await supabase
          .from('coupon_usage')
          .select('*')
          .eq('coupon_id', coupon.id)
          .eq('user_id', user.id)
          .single();

        if (usage) {
          toast({
            title: "تم استخدامه مسبقاً",
            description: "لقد استخدمت هذا الكوبون من قبل",
            variant: "destructive",
          });
          return;
        }
      }

      setAppliedCoupon(coupon);
      toast({
        title: "تم تطبيق الكوبون",
        description: `تم خصم ${coupon.discount_type === 'percentage' ? `${coupon.discount_value}%` : `${formatPrice(coupon.discount_value)} دينار عراقي`}`,
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

  const handleCheckout = async () => {
    if (!user) {
      toast({
        title: "يجب تسجيل الدخول",
        description: "الرجاء تسجيل الدخول أولاً لإتمام الطلب",
        variant: "destructive",
      });
      return;
    }

    try {
      // Get user profile information
      const { data: profile, error } = await supabase
        .from('profiles')
        .select('full_name, phone_number, governorate')
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

      const deliveryFee = getDeliveryFee(profile.governorate);

      // Build WhatsApp message
      let message = `مرحباً، أريد إتمام طلب:\n\n`;
      message += `📦 *المنتجات:*\n`;
      
      items.forEach((item, index) => {
        const isCustomRequest = !!item.custom_request_id;
        const itemName = isCustomRequest 
          ? item.custom_product_requests?.product_name 
          : item.products?.name_ar;
        
        // Calculate item price based on color and option
        let itemPrice = isCustomRequest
          ? Number(item.custom_product_requests?.suggested_price || 0)
          : Number(item.products?.price || 0);
        
        // Get option name and price adjustment if exists
        const itemOption = (item as any).product_option_id 
          ? productOptions?.find((opt: any) => opt.id === (item as any).product_option_id)
          : null;
        
        // Get color name and price if exists
        const itemColor = (item as any).selected_color;
          const colorData = itemColor && item.products?.colors
            ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
            : null;
        
        // Use color price if available
        if (colorData?.price != null) {
          itemPrice = Number(colorData.price);
        }
        
        // Add option price adjustment
        if (itemOption?.price_adjustment) {
          itemPrice += Number(itemOption.price_adjustment);
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
      message += `الاسم: ${profile.full_name || 'غير محدد'}\n`;
      message += `رقم الهاتف: ${profile.phone_number || 'غير محدد'}\n`;
      message += `المحافظة: ${profile.governorate || 'غير محددة'}\n\n`;
      
      message += `💰 *ملخص الطلب:*\n`;
      message += `المجموع الفرعي: ${formatPrice(total)} دينار عراقي\n`;
      if (appliedCoupon) {
        message += `الخصم (${appliedCoupon.code}): -${formatPrice(discount)} دينار عراقي\n`;
      }
      message += `التوصيل: ${formatPrice(deliveryFee)} دينار عراقي\n`;
      message += `الإجمالي: ${formatPrice(grandTotal)} دينار عراقي`;

      // If coupon was used, record it
      if (appliedCoupon && user) {
        await supabase.from('coupon_usage').insert({
          coupon_id: appliedCoupon.id,
          user_id: user.id,
        });
        
        // Increment current_uses
        await supabase
          .from('coupons')
          .update({ current_uses: appliedCoupon.current_uses + 1 })
          .eq('id', appliedCoupon.id);
      }

      // Encode the message for URL
      const encodedMessage = encodeURIComponent(message);
      const whatsappURL = `https://wa.me/9647838455220?text=${encodedMessage}`;
      
      // Open WhatsApp in new window
      window.open(whatsappURL, '_blank');
      
    } catch (error) {
      console.error('Error during checkout:', error);
      toast({
        title: "خطأ",
        description: "حدث خطأ أثناء إتمام الطلب",
        variant: "destructive",
      });
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
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      {/* Decorative elements */}
      <div className="fixed top-20 right-20 w-64 h-64 pointer-events-none opacity-10 animate-float">
        <svg viewBox="0 0 200 200" className="w-full h-full">
          <circle cx="100" cy="100" r="80" stroke="hsl(var(--primary) / 0.3)" strokeWidth="0.5" fill="none" />
          <circle cx="100" cy="100" r="60" stroke="hsl(var(--ring) / 0.2)" strokeWidth="0.5" fill="none" />
        </svg>
      </div>
      
      <main className="container mx-auto px-4 py-8 pt-24">
        <div className="mb-6">
          <h1 className="text-4xl font-black text-primary mb-2">سلة التسوق</h1>
          <p className="text-muted-foreground">
            {itemCount > 0 ? `لديك ${itemCount} ${itemCount === 1 ? 'منتج' : 'منتجات'} في السلة` : 'السلة فارغة'}
          </p>
        </div>

        {items.length === 0 ? (
          <div className="text-center py-16 glass-effect rounded-2xl border border-border/50">
            <div className="w-24 h-24 mx-auto mb-6 opacity-20">
              <ShoppingBag className="w-full h-full text-muted-foreground" />
            </div>
            <h2 className="text-2xl font-bold text-foreground mb-2">سلة التسوق فارغة</h2>
            <p className="text-muted-foreground mb-6">
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
              {items.map((item) => {
                const itemOption = (item as any).product_option_id 
                  ? productOptions?.find((opt: any) => opt.id === (item as any).product_option_id)
                  : null;
                
                const itemColor = (item as any).selected_color;
                const colorData = itemColor && item.products?.colors
                  ? (item.products.colors as any[]).find((c: any) => c.name === itemColor || c.name_ar === itemColor || c.hex_code === itemColor)
                  : null;
                
                // Calculate item price based on color and option
                let itemPrice = item.products 
                  ? Number(item.products.price)
                  : Number(item.custom_product_requests?.suggested_price || 0);
                
                // Use color price if available
                if (colorData?.price != null) {
                  itemPrice = Number(colorData.price);
                }
                
                // Add option price adjustment
                if (itemOption?.price_adjustment) {
                  itemPrice += Number(itemOption.price_adjustment);
                }
                
                return (
                  <div 
                    key={item.id}
                    className="glass-effect rounded-2xl p-4 border border-border/50 group hover:border-primary/30 transition-all"
                  >
                    <div className="flex gap-4">
                      {/* Product Image */}
                      {((item.products?.image_url) || (item.custom_product_requests?.image_url)) && (
                        <Link 
                          to={item.products ? `/product/${item.products.slug}` : '#'}
                          className="flex-shrink-0"
                        >
                          <img 
                            src={item.products?.image_url || item.custom_product_requests?.image_url || ''}
                            alt={item.products?.name_ar || item.custom_product_requests?.product_name || ''}
                            className="w-24 h-24 object-cover rounded-xl border border-border/40 hover:border-primary/50 transition-colors"
                          />
                        </Link>
                      )}
                      
                      {/* Product Info */}
                      <div className="flex-1 min-w-0">
                        {item.products ? (
                          <Link 
                            to={`/product/${item.products.slug}`}
                            className="font-bold text-lg text-foreground mb-1 flex items-center gap-2 hover:text-primary transition-colors"
                          >
                            {item.products.name_ar}
                          </Link>
                        ) : (
                          <div className="font-bold text-lg text-foreground mb-1 flex items-center gap-2">
                            {item.custom_product_requests?.product_name}
                            <span className="text-xs bg-primary/20 text-primary px-2 py-1 rounded-full">
                              طلب خاص ⭐
                            </span>
                          </div>
                        )}
                        
                        {/* Display option and color info */}
                        {(itemOption || colorData) && (
                          <div className="text-sm text-muted-foreground mb-2 space-y-1">
                            {itemOption && (
                              <div className="flex items-center gap-2">
                                <span className="font-medium">الخيار:</span>
                                <span>{itemOption.name_ar}</span>
                              </div>
                            )}
                            {colorData && (
                              <div className="flex items-center gap-2">
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
                          </div>
                        )}
                        
                        <div className="flex items-center gap-2 mb-3">
                          <span className="text-xl font-black text-primary">
                            {formatPrice(itemPrice)} دينار عراقي
                          </span>
                          {item.products?.original_price && item.products.original_price > itemPrice && (
                            <span className="text-sm line-through text-muted-foreground/60">
                              {formatPrice(Number(item.products.original_price))} دينار عراقي
                            </span>
                          )}
                        </div>

                        {/* Quantity Controls */}
                        <div className="flex items-center gap-3">
                          <div className="flex items-center gap-2 bg-background/50 rounded-lg p-1 border border-border/40">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity - 1)}
                              disabled={item.quantity <= 1}
                            >
                              <Minus className="h-4 w-4" />
                            </Button>
                            
                            <span className="w-8 text-center font-bold">
                              {item.quantity}
                            </span>
                            
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-8 w-8"
                              onClick={() => updateQuantity(item.id, item.quantity + 1)}
                            >
                              <Plus className="h-4 w-4" />
                            </Button>
                          </div>

                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive hover:bg-destructive/10"
                            onClick={() => removeFromCart(item.id)}
                          >
                            <Trash2 className="h-4 w-4 ml-2" />
                            حذف
                          </Button>
                        </div>
                      </div>

                      {/* Item Total */}
                      <div className="text-left">
                        <div className="text-sm text-muted-foreground mb-1">المجموع</div>
                        <div className="text-xl font-black text-primary">
                          {formatPrice(itemPrice * item.quantity)} دينار عراقي
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}

              {/* Clear Cart Button */}
              <Button
                variant="outline"
                className="w-full border-destructive/30 text-destructive hover:bg-destructive/10 hover:border-destructive"
                onClick={clearCart}
              >
                <Trash2 className="ml-2 h-4 w-4" />
                تفريغ السلة
              </Button>
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
                  
                  <div className="flex justify-between text-foreground">
                    <span>التوصيل</span>
                    <span className="font-bold">{formatPrice(deliveryFee)} دينار عراقي</span>
                  </div>
                  
                  <div className="border-t border-border/40 pt-3 mt-3">
                    <div className="flex justify-between text-xl font-black">
                      <span className="text-foreground">الإجمالي</span>
                      <span className="text-primary">{formatPrice(grandTotal)} دينار عراقي</span>
                    </div>
                  </div>
                </div>

                <Button 
                  className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 mb-3"
                  size="lg"
                  onClick={handleCheckout}
                >
                  إتمام الطلب
                </Button>

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
    </div>
  );
};

export default Cart;