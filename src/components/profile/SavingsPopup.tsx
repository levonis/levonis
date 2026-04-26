import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { TrendingUp, Tag, Ticket } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { useLanguage } from '@/lib/i18n';
import OriginExpandShell, { type OriginRect } from './OriginExpandShell';

interface SavingsPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  originRect?: OriginRect | null;
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

export default function SavingsPopup({ open, onOpenChange, userId, originRect }: SavingsPopupProps) {
  const { t, language } = useLanguage();
  const numLocale = language === 'en' ? 'en-US' : language === 'ku' ? 'ckb-IQ' : 'ar-IQ';
  const { data, isLoading } = useQuery({
    queryKey: ['user-savings-popup', userId],
    enabled: open && !!userId,
    staleTime: 30_000,
    queryFn: async () => {
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

        const couponDiscount = Number(order.discount_amount) || 0;
        if (couponDiscount > 0) {
          totalCouponSavings += couponDiscount;
          items.push({
            orderId: order.id,
            orderNumber: order.order_number,
            productName: t('savings_coupon_for_order', { n: order.order_number }),
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
    <OriginExpandShell
      open={open}
      onOpenChange={onOpenChange}
      originRect={originRect ?? null}
      title={
        <span className="flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-green-500" />
          {t('savings_your_savings')}
        </span>
      }
    >
      <div className="space-y-4">
        {/* Total Savings Summary */}
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, hsl(142 71% 45% / 0.15), hsl(142 71% 45% / 0.05))' }}>
          <p className="text-xs text-muted-foreground mb-1">{t('savings_total')}</p>
          <p className="text-3xl font-black text-green-600 tabular-nums">
            {isLoading ? '...' : (data?.totalSavings ?? 0).toLocaleString(numLocale)}
          </p>
          <p className="text-xs text-muted-foreground mt-1">{t('savings_currency')}</p>
        </div>

        {/* Breakdown */}
        {!isLoading && data && (
          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 text-center">
              <Tag className="h-4 w-4 text-primary mx-auto mb-1" />
              <p className="text-sm font-bold tabular-nums">{data.totalProductSavings.toLocaleString(numLocale)}</p>
              <p className="text-[10px] text-muted-foreground">{t('savings_from_discounts')}</p>
            </div>
            <div className="rounded-xl border border-border/30 bg-card/50 p-3 text-center">
              <Ticket className="h-4 w-4 text-amber-500 mx-auto mb-1" />
              <p className="text-sm font-bold tabular-nums">{data.totalCouponSavings.toLocaleString(numLocale)}</p>
              <p className="text-[10px] text-muted-foreground">{t('savings_from_coupons')}</p>
            </div>
          </div>
        )}

        {/* Savings Items */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">{t('savings_details')}</h3>
          <div className="space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))
            ) : !data?.items.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t('savings_empty')}</p>
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
                        <span className="text-[10px] text-muted-foreground line-through">{item.originalPrice.toLocaleString(numLocale)}</span>
                        <span className="text-[10px] text-green-600 font-medium">{item.paidPrice.toLocaleString(numLocale)}</span>
                        {item.quantity > 1 && <span className="text-[10px] text-muted-foreground">×{item.quantity}</span>}
                      </div>
                    )}
                    <p className="text-[10px] text-muted-foreground">#{item.orderNumber}</p>
                  </div>
                  <span className="text-sm font-bold text-green-600 tabular-nums shrink-0">
                    -{item.savedAmount.toLocaleString(numLocale)}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </OriginExpandShell>
  );
}
