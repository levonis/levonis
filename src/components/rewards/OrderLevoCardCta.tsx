import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useCart } from '@/hooks/useCart';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CreditCard, ShoppingCart, Loader2, AlertTriangle, Clock } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { useNumberFormat } from '@/lib/i18n/numberFormat';
import { cartHasLevoCard, isLevoCardItem } from '@/lib/isLevoCardCart';
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
import { Badge } from '@/components/ui/badge';

/**
 * Shown in "My Cards" for users who don't yet have a Levo physical card
 * assigned. Adds the reserved Levo card product to cart — but only if the
 * cart is empty (Levo card cannot be mixed with any other product).
 */
export default function OrderLevoCardCta() {
  const { user } = useAuth();
  const { addToCart, items, clearCart } = useCart();
  const { fmt } = useNumberFormat();
  const [busy, setBusy] = useState(false);
  const [confirmClear, setConfirmClear] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ['levo-card-my-lite', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from('levo_card_assignments' as any)
        .select('id')
        .eq('user_id', user!.id)
        .is('released_at', null)
        .maybeSingle();
      return data as any;
    },
    staleTime: 30_000,
  });

  const { data: pendingReq } = useQuery({
    queryKey: ['levo-card-my-pending', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await (supabase as any)
        .from('levo_card_orders')
        .select('id, status, rejection_reason, created_at')
        .eq('user_id', user!.id)
        .in('status', ['pending_payment', 'paid_pending_approval', 'rejected'])
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      return data as any;
    },
    staleTime: 15_000,
  });

  const { data: product } = useQuery({
    queryKey: ['levo-card-product'],
    queryFn: async () => {
      const { data: idRes } = await (supabase as any).rpc('get_levo_card_product_id');
      const productId = idRes as string;
      if (!productId) return null;
      const { data } = await supabase
        .from('products')
        .select('id, name_ar, price, image_url, images')
        .eq('id', productId)
        .maybeSingle();
      return data as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!user || assignment || !product) return null;

  // Show status card for pending / paid / rejected
  if (pendingReq && pendingReq.status !== 'rejected') {
    return (
      <Card className="border-amber-500/40 bg-gradient-to-br from-amber-500/10 to-transparent">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center shrink-0">
            <Clock className="h-6 w-6 text-amber-600" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm">طلب البطاقة قيد المراجعة</div>
            <div className="text-xs text-muted-foreground mt-0.5">
              {pendingReq.status === 'pending_payment'
                ? 'أكمل الدفع من السلة لإرسال الطلب للأدمن'
                : 'تم استلام الدفع — بانتظار موافقة الأدمن'}
            </div>
          </div>
          <Badge variant="outline" className="border-amber-500/40 text-amber-600">
            {pendingReq.status === 'pending_payment' ? 'بانتظار الدفع' : 'قيد المراجعة'}
          </Badge>
        </CardContent>
      </Card>
    );
  }

  const doAdd = async () => {
    setBusy(true);
    try {
      const ok = await addToCart(product.id, undefined, undefined, 1);
      if (ok) toast.success('تمت إضافة البطاقة إلى السلة');
    } catch (e: any) {
      toast.error(e?.message || 'فشلت الإضافة');
    } finally {
      setBusy(false);
    }
  };

  const handleOrder = async () => {
    // Block mixing: if cart already has non-card items → warn user, offer to clear
    const hasOther = (items || []).some((it: any) => !isLevoCardItem(it));
    const hasCardAlready = cartHasLevoCard(items);
    if (hasCardAlready) {
      toast.info('البطاقة موجودة في السلة بالفعل');
      return;
    }
    if (hasOther) {
      setConfirmClear(true);
      return;
    }
    await doAdd();
  };

  const handleClearAndAdd = async () => {
    setConfirmClear(false);
    setBusy(true);
    try {
      await clearCart();
      await new Promise((r) => setTimeout(r, 200));
      await doAdd();
    } catch (e: any) {
      toast.error(e?.message || 'فشل التفريغ');
      setBusy(false);
    }
  };

  const image = product.image_url || (Array.isArray(product.images) && product.images[0]) || null;

  return (
    <>
      {pendingReq?.status === 'rejected' && (
        <Card className="border-red-500/40 bg-red-500/5 mb-2">
          <CardContent className="p-3 text-xs flex items-start gap-2">
            <AlertTriangle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
            <div>
              <div className="font-semibold text-red-600">تم رفض طلبك السابق</div>
              {pendingReq.rejection_reason && (
                <div className="text-muted-foreground mt-0.5">{pendingReq.rejection_reason}</div>
              )}
              <div className="text-muted-foreground mt-1">يمكنك إعادة تقديم الطلب.</div>
            </div>
          </CardContent>
        </Card>
      )}

      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/10 via-primary/5 to-transparent">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-16 h-16 rounded-lg bg-primary/10 flex items-center justify-center overflow-hidden shrink-0">
            {image ? (
              <img
                src={image}
                alt={product.name_ar}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <CreditCard className="h-7 w-7 text-primary" />
            )}
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-sm truncate">
              {product.name_ar || 'بطاقة ليفو الفيزيائية'}
            </div>
            <div className="text-xs text-muted-foreground mt-0.5">
              بطاقة فيزيائية تصلك للمنزل — فعّلها بعد الاستلام
            </div>
            <div className="text-sm font-bold text-primary mt-1">
              {fmt(Number(product.price || 0))} د.ع
            </div>
          </div>
          <Button size="sm" onClick={handleOrder} disabled={busy}>
            {busy ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>
                <ShoppingCart className="h-4 w-4 ml-1" /> اطلب
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      <AlertDialog open={confirmClear} onOpenChange={setConfirmClear}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              يجب تفريغ السلة أولاً
            </AlertDialogTitle>
            <AlertDialogDescription>
              لا يمكن إضافة بطاقة ليفو الفيزيائية مع أي منتج آخر في السلة. سيتم إفراغ سلتك الحالية
              وإضافة البطاقة فقط. هل تريد المتابعة؟
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={handleClearAndAdd}>
              تفريغ السلة وإضافة البطاقة
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
