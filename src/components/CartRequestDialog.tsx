import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
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

// Support account ID (admin)
const SUPPORT_USER_ID = "f632ba7b-60e7-4f2f-9cb7-2851f7f2ed2f";

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
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [copied, setCopied] = useState(false);
  const [contactingSupport, setContactingSupport] = useState(false);

  // Check for existing pending request
  const { data: existingRequest, isLoading } = useQuery({
    queryKey: ['cart-request', user?.id],
    queryFn: async () => {
      if (!user) return null;
      
      const { data, error } = await supabase
        .from('cart_requests')
        .select('*')
        .eq('user_id', user.id)
        .in('status', ['pending', 'adjusted'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: !!user && open,
  });

  // Create cart request mutation
  const createRequestMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');

      // Generate unique cart code
      const cartCode = `CART-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).substring(2, 6).toUpperCase()}`;

      // Prepare cart items data
      const cartItemsData = cartItems.map(item => ({
        product_id: item.product_id,
        name_ar: item.products?.name_ar,
        image_url: item.products?.image_url,
        price: item.products?.price || 0,
        quantity: item.quantity,
        selected_color: item.selected_color,
        color_image_url: item.color_image_url,
        product_option_id: item.product_option_id,
        option_name_ar: item.product_options?.name_ar,
        option_image_url: item.option_image_url,
        shipping_option_name_ar: item.shipping_option_name_ar,
        custom_request_id: item.custom_request_id,
      }));

      const { data, error } = await supabase
        .from('cart_requests')
        .insert({
          user_id: user.id,
          cart_code: cartCode,
          cart_items: cartItemsData,
          original_total: total,
          status: 'pending',
        })
        .select()
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async (data) => {
      queryClient.invalidateQueries({ queryKey: ['cart-request', user?.id] });
      toast.success('تم إنشاء رمز السلة بنجاح');
      
      // Auto-contact support after creating cart code
      if (data && user) {
        try {
          // Check if support conversation exists
          const { data: existing } = await supabase
            .from("listing_conversations")
            .select("id")
            .or(`and(buyer_id.eq.${user.id},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${user.id})`)
            .maybeSingle();

          let conversationId: string;

          if (existing) {
            conversationId = existing.id;
          } else {
            const convCode = `SUPPORT-${Date.now().toString(36).toUpperCase()}`;
            const { data: newConv, error: convError } = await supabase
              .from("listing_conversations")
              .insert([{
                buyer_id: user.id,
                seller_id: SUPPORT_USER_ID,
                listing_id: SUPPORT_USER_ID,
                conversation_code: convCode,
                status: "open",
              }])
              .select("id")
              .single();

            if (convError) throw convError;
            conversationId = newConv.id;
          }

          // Send cart request message automatically
          const cartMessage = `🛒 طلب تعديل سلة التسوق\n\n📋 رمز السلة: ${data.cart_code}\n💰 المبلغ الأصلي: ${formatPrice(data.original_total)} د.ع\n\nأرجو مراجعة السلة وتعديل السعر`;

          await supabase.from("listing_messages").insert({
            conversation_id: conversationId,
            sender_id: user.id,
            content: cartMessage,
          });

          await supabase.from("listing_conversations")
            .update({ updated_at: new Date().toISOString() })
            .eq("id", conversationId);

          onOpenChange(false);
          navigate(`/community/messages?auto_open=${conversationId}`);
        } catch (e) {
          console.error('Auto-contact support failed:', e);
        }
      }
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

  const handleContactSupport = async () => {
    if (!user || !existingRequest) return;
    
    setContactingSupport(true);
    
    try {
      // Check if support conversation exists
      const { data: existing } = await supabase
        .from("listing_conversations")
        .select("id")
        .or(`and(buyer_id.eq.${user.id},seller_id.eq.${SUPPORT_USER_ID}),and(buyer_id.eq.${SUPPORT_USER_ID},seller_id.eq.${user.id})`)
        .maybeSingle();

      let conversationId: string;

      if (existing) {
        conversationId = existing.id;
      } else {
        // Create new support conversation
        const convCode = `SUPPORT-${Date.now().toString(36).toUpperCase()}`;
        const { data: newConv, error } = await supabase
          .from("listing_conversations")
          .insert([{
            buyer_id: user.id,
            seller_id: SUPPORT_USER_ID,
            listing_id: SUPPORT_USER_ID,
            conversation_code: convCode,
            status: "open",
          }])
          .select("id")
          .single();

        if (error) throw error;
        conversationId = newConv.id;
      }

      // Send cart request message
      const cartMessage = `🛒 طلب تعديل سلة التسوق

📋 رمز السلة: ${existingRequest.cart_code}
💰 المبلغ الأصلي: ${formatPrice(existingRequest.original_total)} د.ع

أرجو مراجعة السلة وتعديل السعر`;

      await supabase.from("listing_messages").insert({
        conversation_id: conversationId,
        sender_id: user.id,
        content: cartMessage,
      });

      // Update conversation timestamp
      await supabase.from("listing_conversations")
        .update({ updated_at: new Date().toISOString() })
        .eq("id", conversationId);

      onOpenChange(false);
      navigate(`/community/messages?auto_open=${conversationId}`);
      toast.success('تم إرسال طلب السلة للدعم');
    } catch (error) {
      console.error('Error contacting support:', error);
      toast.error('فشل التواصل مع الدعم');
    } finally {
      setContactingSupport(false);
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
            {/* Existing request */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">رمز السلة:</span>
                <div className="flex items-center gap-2">
                  <code className="bg-primary/10 text-primary px-3 py-1 rounded font-mono text-sm">
                    {existingRequest.cart_code}
                  </code>
                  <Button
                    size="icon"
                    variant="ghost"
                    className="h-8 w-8"
                    onClick={copyCode}
                  >
                    {copied ? (
                      <Check className="h-4 w-4 text-green-500" />
                    ) : (
                      <ClipboardCopy className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">الحالة:</span>
                {getStatusBadge(existingRequest.status)}
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المبلغ الأصلي:</span>
                <span className="font-semibold">{formatPrice(existingRequest.original_total)} د.ع</span>
              </div>

              {existingRequest.adjusted_total && (
                <div className="flex items-center justify-between">
                  <span className="text-sm text-muted-foreground">المبلغ المعدّل:</span>
                  <span className="font-semibold text-green-600">{formatPrice(existingRequest.adjusted_total)} د.ع</span>
                </div>
              )}
            </div>

            <Button
              className="w-full gap-2"
              onClick={handleContactSupport}
              disabled={contactingSupport}
            >
              {contactingSupport ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <MessageCircle className="h-4 w-4" />
              )}
              التواصل مع الدعم
            </Button>
          </div>
        ) : (
          <div className="space-y-4">
            {/* New request */}
            <div className="bg-muted/50 rounded-lg p-4 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">عدد المنتجات:</span>
                <span className="font-semibold">{cartItems.length}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">المبلغ الإجمالي:</span>
                <span className="font-semibold">{formatPrice(total)} د.ع</span>
              </div>
            </div>

            <p className="text-sm text-muted-foreground">
              سيتم إنشاء رمز خاص بسلتك يمكنك مشاركته مع فريق الدعم لطلب تعديل الأسعار أو الاستفسار.
            </p>

            <DialogFooter>
              <Button
                onClick={() => createRequestMutation.mutate()}
                disabled={createRequestMutation.isPending || cartItems.length === 0}
                className="w-full gap-2"
              >
                {createRequestMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <ShoppingCart className="h-4 w-4" />
                )}
                إنشاء رمز السلة
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
