import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { Loader2, MessageCircle, ClipboardCopy, Check, Send, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { formatPrice } from '@/lib/utils';
import { CartItem } from '@/hooks/useCart';

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
  const [showContactDialog, setShowContactDialog] = useState(false);
  const [userNotes, setUserNotes] = useState('');

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

  // إرسال طلب للدعم
  const sendToSupportMutation = useMutation({
    mutationFn: async () => {
      if (!user || !existingRequest) throw new Error('لا يوجد طلب');

      // إنشاء محادثة جديدة أو استخدام المحادثة الموجودة
      let conversationId = existingRequest.conversation_id;

      if (!conversationId) {
        const { data: conv, error: convError } = await supabase
          .from('conversations')
          .insert({
            user_id: user.id,
            status: 'open',
          })
          .select()
          .single();

        if (convError) throw convError;
        conversationId = conv.id;

        // تحديث طلب السلة بمعرف المحادثة
        await supabase
          .from('cart_requests')
          .update({ conversation_id: conversationId })
          .eq('id', existingRequest.id);
      }

      // إرسال رسالة تلقائية للدعم
      const messageContent = `🛒 طلب تعديل سلة\n\nرقم السلة: ${existingRequest.cart_code}\nالإجمالي الأصلي: ${formatPrice(existingRequest.original_total)} د.ع\n\n${userNotes ? `ملاحظات العميل:\n${userNotes}` : 'يرجى مراجعة السلة والتعديل على السعر'}`;

      const { error: msgError } = await supabase
        .from('messages')
        .insert({
          conversation_id: conversationId,
          sender_id: user.id,
          content: messageContent,
        });

      if (msgError) throw msgError;

      // إرسال إشعار للتيليجرام
      const { data: profile } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .single();

      await supabase.functions.invoke('send-telegram-notification', {
        body: {
          message: `🛒 <b>طلب تعديل سلة</b>\n\n👤 العميل: ${profile?.full_name || 'غير محدد'}\n📱 اليوزر: @${profile?.username || 'غير محدد'}\n\n📋 رقم السلة: ${existingRequest.cart_code}\n💰 الإجمالي: ${formatPrice(existingRequest.original_total)} د.ع\n\n${userNotes ? `📝 ملاحظات:\n${userNotes}` : ''}`,
        },
      });

      return conversationId;
    },
    onSuccess: () => {
      setShowContactDialog(false);
      setUserNotes('');
      toast.success('تم إرسال الطلب للدعم بنجاح');
      queryClient.invalidateQueries({ queryKey: ['cart-request', user?.id] });
    },
    onError: (error) => {
      console.error('Error sending to support:', error);
      toast.error('حدث خطأ أثناء إرسال الطلب');
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
              <div className="bg-muted/50 rounded-lg p-4 text-center">
                <p className="text-sm text-muted-foreground mb-2">رمز السلة</p>
                <div className="flex items-center justify-center gap-2">
                  <span className="text-2xl font-black text-primary tracking-wider">
                    {existingRequest.cart_code}
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={copyCode}
                    className="h-8 w-8"
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
              <div className="space-y-2">
                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">الإجمالي الأصلي:</span>
                  <span className="font-bold">{formatPrice(existingRequest.original_total)} د.ع</span>
                </div>
                {existingRequest.adjusted_total && (
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">الإجمالي بعد التعديل:</span>
                    <span className="font-bold text-green-600">{formatPrice(existingRequest.adjusted_total)} د.ع</span>
                  </div>
                )}
                {existingRequest.admin_notes && (
                  <div className="mt-2 p-2 bg-primary/5 rounded-lg border border-primary/20">
                    <p className="text-xs text-muted-foreground mb-1">ملاحظات الإدارة:</p>
                    <p className="text-sm">{existingRequest.admin_notes}</p>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="text-center py-6">
              <ShoppingCart className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <p className="text-muted-foreground mb-4">
                لم تنشئ رمزاً لسلتك بعد
              </p>
              <p className="text-sm text-muted-foreground mb-4">
                الإجمالي الحالي: <span className="font-bold text-primary">{formatPrice(total)} د.ع</span>
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
                onClick={() => setShowContactDialog(true)}
                className="w-full"
                variant="outline"
              >
                <MessageCircle className="ml-2 h-4 w-4" />
                التواصل مع الدعم
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* حوار التواصل مع الدعم */}
      <AlertDialog open={showContactDialog} onOpenChange={setShowContactDialog}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <Send className="h-5 w-5 text-primary" />
              إرسال طلب للإدارة
            </AlertDialogTitle>
            <AlertDialogDescription>
              هل تريد إرسال الطلب ({existingRequest?.cart_code}) إلى الإدارة للتعديل أو الاستفسار؟
            </AlertDialogDescription>
          </AlertDialogHeader>

          <div className="space-y-3 my-4">
            <Textarea
              placeholder="أضف ملاحظاتك هنا (اختياري)..."
              value={userNotes}
              onChange={(e) => setUserNotes(e.target.value)}
              rows={3}
            />
          </div>

          <AlertDialogFooter className="flex-row-reverse gap-2">
            <AlertDialogAction
              onClick={() => sendToSupportMutation.mutate()}
              disabled={sendToSupportMutation.isPending}
              className="bg-primary hover:bg-primary/90"
            >
              {sendToSupportMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الإرسال...
                </>
              ) : (
                <>
                  <Send className="ml-2 h-4 w-4" />
                  إرسال
                </>
              )}
            </AlertDialogAction>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
