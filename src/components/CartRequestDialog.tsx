import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Loader2, MessageCircle, ClipboardCopy, Check, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { CartItem } from '@/hooks/useCart';
import CustomerChat from './CustomerChat';

interface CartRequestDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  cartItems: CartItem[];
  total: number;
}

export default function CartRequestDialog({ 
  open, 
  onOpenChange, 
  cartItems, 
  total 
}: CartRequestDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [showChat, setShowChat] = useState(false);

  // جلب طلب السلة الحالي للمستخدم
  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ['cart-request', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('cart_requests')
        .select('*')
        .eq('user_id', user.id)
        .eq('status', 'pending')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // إنشاء طلب سلة جديد
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      // توليد رمز السلة
      const { data: cartCode } = await supabase.rpc('generate_cart_code');

      // تحويل منتجات السلة إلى JSON
      const cartItemsJson = cartItems.map(item => ({
        id: item.id,
        product_id: item.product_id,
        custom_request_id: item.custom_request_id,
        quantity: item.quantity,
        product_name: item.products?.name_ar || (item as any).custom_product_requests?.product_name || 'منتج',
        image_url: item.products?.image_url || (item as any).custom_product_requests?.image_url,
        price: item.products?.price || (item as any).custom_product_requests?.suggested_price,
        selected_color: (item as any).selected_color,
        shipping_option_name_ar: (item as any).shipping_option_name_ar,
        product_option_id: item.product_option_id,
      }));

      const { data, error } = await supabase
        .from('cart_requests')
        .insert({
          user_id: user.id,
          cart_code: cartCode || `CART-${Date.now()}`,
          original_total: total,
          cart_items: cartItemsJson,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['cart-request', user?.id] });
      toast.success('تم إنشاء رمز السلة بنجاح');
    },
    onError: (error) => {
      console.error('Error creating cart request:', error);
      toast.error('حدث خطأ أثناء إنشاء رمز السلة');
    },
  });

  const copyCode = () => {
    if (existingRequest?.cart_code) {
      navigator.clipboard.writeText(existingRequest.cart_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
      toast.success('تم نسخ الرمز');
    }
  };

  const handleContactSupport = () => {
    onOpenChange(false);
    setShowChat(true);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">قيد المراجعة</Badge>;
      case 'adjusted':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">تم التعديل</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">تمت الموافقة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-primary" />
              رمز السلة
            </DialogTitle>
            <DialogDescription>
              أنشئ رمزاً لسلتك للتواصل مع الدعم لتعديل الأسعار
            </DialogDescription>
          </DialogHeader>

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-8 w-8 animate-spin text-primary" />
            </div>
          ) : existingRequest ? (
            <div className="space-y-4">
              {/* رمز السلة */}
              <div className="bg-gradient-to-br from-primary/10 to-primary/5 rounded-xl p-5 text-center border border-primary/20">
                <p className="text-sm text-muted-foreground mb-2">رمز السلة</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-3xl font-black text-primary tracking-widest">
                    {existingRequest.cart_code}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    className="h-9 w-9 rounded-full hover:bg-primary/20"
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              {/* حالة الطلب */}
              <div className="flex items-center justify-between p-3 bg-card rounded-lg border">
                <span className="text-sm text-muted-foreground">الحالة:</span>
                {getStatusBadge(existingRequest.status)}
              </div>

              {/* الأسعار */}
              <div className="space-y-2 p-3 bg-muted/30 rounded-lg">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإجمالي الأصلي:</span>
                  <span className="font-bold">{formatPrice(existingRequest.original_total)} د.ع</span>
                </div>
                {existingRequest.adjusted_total && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الإجمالي بعد التعديل:</span>
                    <span className="font-bold text-green-600 text-lg">{formatPrice(existingRequest.adjusted_total)} د.ع</span>
                  </div>
                )}
                {existingRequest.admin_notes && (
                  <div className="mt-3 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات الإدارة:</p>
                    <p className="text-sm font-medium">{existingRequest.admin_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <div className="w-16 h-16 rounded-full bg-primary/10 flex items-center justify-center mx-auto mb-4">
                <ShoppingCart className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold mb-2">لم تنشئ رمزاً لسلتك بعد</h3>
              <p className="text-sm text-muted-foreground mb-4">
                الإجمالي الحالي: <span className="font-bold text-primary text-lg">{formatPrice(total)} د.ع</span>
              </p>
            </div>
          )}

          <DialogFooter className="flex-col sm:flex-row gap-2">
            {!existingRequest ? (
              <Button
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isPending || cartItems.length === 0}
                className="w-full"
              >
                {createRequestMutation.isPending ? (
                  <>
                    <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    جاري الإنشاء...
                  </>
                ) : (
                  'إنشاء رمز السلة'
                )}
              </Button>
            ) : (
              <Button
                onClick={handleContactSupport}
                className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
              >
                <MessageCircle className="ml-2 h-4 w-4" />
                التواصل مع الدعم
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Chat Component */}
      {showChat && (
        <CustomerChat 
          cartRequestCode={existingRequest?.cart_code}
          defaultOpen={true}
          onClose={() => setShowChat(false)}
        />
      )}
    </>
  );
}
