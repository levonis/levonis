import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Receipt, Wallet, Truck, Package, Tag, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface Props {
  orderId?: string;
  orderNumber?: string;
  className?: string;
  compact?: boolean;
}

const fmt = (n: number) => `${Math.round(Number(n) || 0).toLocaleString()} د.ع`;

export default function OrderInvoiceBreakdown({ orderId, orderNumber, className, compact = false }: Props) {
  const { data, isLoading } = useQuery({
    queryKey: ['order-invoice-breakdown', orderId, orderNumber],
    enabled: !!(orderId || orderNumber),
    staleTime: 60_000,
    queryFn: async () => {
      let query = supabase
        .from('orders')
        .select('id, order_number, subtotal, total_amount, discount_amount, card_discount_amount, cod_fee, paid_amount, remaining_amount, delivery_method')
        .limit(1);
      query = orderId ? query.eq('id', orderId) : query.eq('order_number', orderNumber!);
      const { data: order, error } = await query.maybeSingle();
      if (error) throw error;
      if (!order) return null;

      const { data: walletLog } = await supabase.rpc('get_order_wallet_log' as any, {
        p_order_id: order.id,
      });

      const subtotal = Number(order.subtotal || 0);
      const total = Number(order.total_amount || 0);
      const discount = Number(order.discount_amount || 0) + Number(order.card_discount_amount || 0);
      // delivery fee = total - subtotal + discount (i.e. anything above products & after discounts)
      const deliveryFee = Math.max(0, total - subtotal + discount);
      const walletPaid = (walletLog || []).reduce((s: number, r: any) => s + Number(r.amount || 0), 0)
        || Number(order.paid_amount || 0);
      const remaining = Math.max(0, total - walletPaid);

      return {
        orderNumber: order.order_number,
        subtotal,
        deliveryFee,
        discount,
        total,
        walletPaid,
        remaining,
      };
    },
  });

  if (!orderId && !orderNumber) return null;
  if (isLoading) {
    return (
      <div className={cn('p-3 rounded-xl border border-border/50 bg-muted/20 flex items-center justify-center', className)}>
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (!data) return null;

  const Row = ({ icon: Icon, label, value, accent }: { icon: any; label: string; value: string; accent?: string }) => (
    <div className="flex items-center justify-between gap-2 text-xs">
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Icon className="h-3.5 w-3.5" />
        {label}
      </span>
      <span className={cn('font-bold tabular-nums', accent || 'text-foreground')}>{value}</span>
    </div>
  );

  return (
    <div
      dir="rtl"
      className={cn(
        'rounded-xl border border-border/60 bg-gradient-to-br from-card to-muted/30 p-3 space-y-2 shadow-sm',
        className,
      )}
    >
      <div className="flex items-center justify-between pb-1.5 border-b border-border/40">
        <h4 className="text-xs font-bold flex items-center gap-1.5 text-foreground">
          <Receipt className="h-3.5 w-3.5 text-primary" />
          تفاصيل الفاتورة
        </h4>
        {data.orderNumber && (
          <span className="text-[10px] font-mono text-muted-foreground">#{data.orderNumber}</span>
        )}
      </div>

      <Row icon={Package} label="سعر المنتجات" value={fmt(data.subtotal)} />
      <Row icon={Truck} label="سعر التوصيل" value={data.deliveryFee > 0 ? fmt(data.deliveryFee) : 'مجاني'} accent={data.deliveryFee > 0 ? undefined : 'text-emerald-600'} />
      {data.discount > 0 && (
        <Row icon={Tag} label="خصم" value={`- ${fmt(data.discount)}`} accent="text-red-500" />
      )}

      <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-border/40">
        <span className="text-xs font-bold text-foreground">الإجمالي النهائي</span>
        <span className="text-sm font-black tabular-nums text-primary">{fmt(data.total)}</span>
      </div>

      {data.walletPaid > 0 && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-2 space-y-1 mt-1">
          <Row icon={Wallet} label="المخصوم من المحفظة" value={`- ${fmt(data.walletPaid)}`} accent="text-emerald-700" />
          {data.remaining > 0 && (
            <div className="flex items-center justify-between gap-2 text-xs pt-1 border-t border-emerald-500/20">
              <span className="text-muted-foreground">المتبقي عند الاستلام</span>
              <span className="font-bold tabular-nums text-orange-600">{fmt(data.remaining)}</span>
            </div>
          )}
          {data.remaining === 0 && !compact && (
            <p className="text-[10px] text-emerald-700/80 text-center pt-0.5">تم سداد الطلب بالكامل من المحفظة ✓</p>
          )}
        </div>
      )}

      {data.walletPaid === 0 && data.total > 0 && (
        <p className="text-[10px] text-muted-foreground text-center pt-0.5">الدفع عند الاستلام</p>
      )}
    </div>
  );
}
