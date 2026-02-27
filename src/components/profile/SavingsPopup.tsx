import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { TrendingUp, Tag, Ticket } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { formatPrice } from '@/lib/utils';

interface SavingsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
}

interface SavingsItem {
  orderId: string;
  orderNumber: string;
  productName: string;
  productImage?: string;
  originalPrice: number;
  paidPrice: number;
  quantity: number;
  savedAmount: number;
  type: 'discount' | 'coupon';
}

export default function SavingsPopup({ open, onOpenChange, userId }: SavingsPopupProps) {
  const { data, isLoading } = useQuery({
    queryKey: ['user-savings-popup', userId],
    enabled: open && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
      // Get orders with their items and product original prices
      const { data: orders, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, discount_amount, status,
          order_items!order_items_order_id_fkey(
            product_name_ar, quantity, unit_price, total_price, product_id,
            products!order_items_product_id_fkey(price, original_price, image_url, name_ar)
          )
        `)
        .eq('user_id', userId)
        .in('status', ['delivered', 'confirmed', 'processing', 'shipped', 'arrived_warehouse', 'arrived_iraq', 'on_the_way', 'purchased'])
        .order('created_at', { ascending: false });

      if (error) throw error;

      const items: SavingsItem[] = [];
      let totalProductSavings = 0;
      let totalCouponSavings = 0;

      orders?.forEach((order) => {
        // Product discount savings
        order.order_items?.forEach((item: any) => {
          const product = item.products;
          if (product?.original_price && product.original_price > product.price) {
            const savedPerUnit = product.original_price - item.unit_price;
            if (savedPerUnit > 0) {
              const totalSaved = savedPerUnit * item.quantity;
              totalProductSavings += totalSaved;
              items.push({
                orderId: order.id,
                orderNumber: order.order_number,
                productName: item.product_name_ar || product.name_ar,
                productImage: product.image_url,
                originalPrice: product.original_price,
                paidPrice: item.unit_price,
                quantity: item.quantity,
                savedAmount: totalSaved,
                type: 'discount',
              });
            }
          }
        });

        // Coupon discount savings
        const couponDiscount = Number(order.discount_amount) || 0;
        if (couponDiscount > 0) {
          totalCouponSavings += couponDiscount;
          items.push({
            orderId: order.id,
            orderNumber: order.order_number,
            productName: `كوبون خصم - طلب #${order.order_number}`,
            originalPrice: 0,
            paidPrice: 0,
            quantity: 1,
            savedAmount: couponDiscount,
            type: 'coupon',
          });
        }
      });

      return {
        items,
        totalProductSavings,
        totalCouponSavings,
        totalSavings: totalProductSavings + totalCouponSavings,
      };
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <TrendingUp className="h-5 w-5 text-green-500" />
            التوفير الخاص بك
          </DialogTitle>
        </DialogHeader>

        {/* Total Savings Summary */}
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, hsl(142 71% 45% / 0.15), hsl(142 71% 45% / 0.05))' }}>
          <p className="text-xs text-muted-foreground mb-1">إجمالي التوفير</p>
          <p className="text-3xl font-black text-green-600 tabular-nums">
            {isLoading ? '...' : (data?.totalSavings ?? 0).toLocaleString('ar-IQ')}
          </p>
          <p className="text-xs text-muted-foreground mt-1">د.ع</p>
        </div>

        {/* Breakdown */}
        {!isLoading && data && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 text-center">
              <Tag className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-sm font-bold tabular-nums">{data.totalProductSavings.toLocaleString('ar-IQ')}</p>
              <p className="text-[10px] text-muted-foreground">وفر من الخصومات</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 text-center">
              <Ticket className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-sm font-bold tabular-nums">{data.totalCouponSavings.toLocaleString('ar-IQ')}</p>
              <p className="text-[10px] text-muted-foreground">وفر من الكوبونات</p>
            </div>
          </div>
        )}

        {/* Savings Items */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">تفاصيل التوفير</h3>
          <div className="max-h-[35vh] overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : !data?.items.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">لم تقم بأي توفير بعد! تسوق واستفد من الخصومات</p>
            ) : (
              data.items.map((item, i) => (
                <div key={`${item.orderId}-${i}`} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
                  {item.type === 'discount' && item.productImage ? (
                    <img src={item.productImage} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
                  ) : (
                    <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center shrink-0">
                      <Ticket className="h-5 w-5 text-amber-500" />
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium truncate">{item.productName}</p>
                    {item.type === 'discount' && (
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[10px] text-muted-foreground line-through">{item.originalPrice.toLocaleString('ar-IQ')}</span>
                        <span className="text-[10px] text-green-600 font-medium">{item.paidPrice.toLocaleString('ar-IQ')}</span>
                        {item.quantity > 1 && <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">#{item.orderNumber}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600 tabular-nums shrink-0">
                    -{item.savedAmount.toLocaleString('ar-IQ')}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
