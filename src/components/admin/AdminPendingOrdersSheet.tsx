import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
import { Button } from '@/components/ui/button';
import { ClipboardList, Package, ChevronDown, ChevronUp, Copy, Check } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useToast } from '@/hooks/use-toast';

interface OrderItem {
  id: string;
  product_name_ar: string;
  selected_option: string | null;
  selected_color: string | null;
  quantity: number;
  unit_price: number;
  color_image_url: string | null;
  shipping_option_name_ar: string | null;
}

interface Order {
  id: string;
  order_number: string;
  status: string;
  total_amount: number;
  shipping_address: string | null;
  phone_number: string | null;
  governorate: string | null;
  created_at: string;
  priority: string | null;
  order_items: OrderItem[];
}

const STATUS_LABELS: Record<string, string> = {
  pending: 'قيد الانتظار',
  processing: 'قيد التجهيز',
  confirmed: 'مؤكد',
  shipped: 'تم الشحن',
  arrived_warehouse: 'وصل المخزن',
  arrived_iraq: 'وصل العراق',
  delivered: 'تم التوصيل',
  cancelled: 'ملغي',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-yellow-500/15 text-yellow-700 border-yellow-500/30',
  processing: 'bg-blue-500/15 text-blue-700 border-blue-500/30',
  confirmed: 'bg-green-500/15 text-green-700 border-green-500/30',
};

export default function AdminPendingOrdersSheet() {
  const [open, setOpen] = useState(false);
  const [expandedOrder, setExpandedOrder] = useState<string | null>(null);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const { toast } = useToast();

  const { data: orders = [], isLoading } = useQuery({
    queryKey: ['admin-pending-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          id, order_number, status, total_amount, shipping_address, phone_number, governorate, created_at, priority,
          order_items (id, product_name_ar, selected_option, selected_color, quantity, unit_price, color_image_url, shipping_option_name_ar)
        `)
        .in('status', ['pending', 'processing', 'confirmed'])
        .order('created_at', { ascending: false })
        .limit(50);

      if (error) throw error;
      return (data || []) as Order[];
    },
    enabled: open,
    staleTime: 30000,
  });

  // Aggregate all items across orders for a summary
  const allItems = orders.flatMap(o => o.order_items.map(item => ({
    ...item,
    orderNumber: o.order_number,
  })));

  // Group by product + option + color
  const grouped = allItems.reduce<Record<string, { name: string; option: string | null; color: string | null; totalQty: number; image: string | null }>>((acc, item) => {
    const key = `${item.product_name_ar}||${item.selected_option || ''}||${item.selected_color || ''}`;
    if (!acc[key]) {
      acc[key] = { name: item.product_name_ar, option: item.selected_option, color: item.selected_color, totalQty: 0, image: item.color_image_url };
    }
    acc[key].totalQty += item.quantity;
    return acc;
  }, {});

  const copyOrderText = (order: Order) => {
    const lines = [
      `📦 ${order.order_number}`,
      `📍 ${order.governorate || ''} - ${order.shipping_address || ''}`,
      `📞 ${order.phone_number || ''}`,
      '',
      ...order.order_items.map(i =>
        `• ${i.product_name_ar}${i.selected_color ? ` (${i.selected_color})` : ''}${i.selected_option ? ` - ${i.selected_option}` : ''} × ${i.quantity}`
      ),
    ];
    navigator.clipboard.writeText(lines.join('\n'));
    setCopiedId(order.id);
    setTimeout(() => setCopiedId(null), 2000);
    toast({ title: 'تم النسخ', description: 'تم نسخ تفاصيل الطلب' });
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        <Button
          variant="outline"
          size="icon"
          className="relative rounded-full border-primary/30 hover:border-primary"
          title="طلبات التجهيز"
          aria-label="طلبات التجهيز"
        >
          <ClipboardList className="h-4 w-4" />
          {/* We'll show count after data loads */}
        </Button>
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-lg p-0 flex flex-col">
        <SheetHeader className="p-4 pb-2 border-b border-border">
          <SheetTitle className="text-right flex items-center gap-2">
            <ClipboardList className="h-5 w-5 text-primary" />
            طلبات تحتاج تجهيز
            {orders.length > 0 && (
              <Badge variant="secondary" className="mr-auto text-xs">{orders.length} طلب</Badge>
            )}
          </SheetTitle>
        </SheetHeader>

        <ScrollArea className="flex-1">
          {isLoading ? (
            <div className="flex items-center justify-center p-8 text-muted-foreground text-sm">جاري التحميل...</div>
          ) : orders.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 gap-2 text-muted-foreground">
              <Package className="h-10 w-10 opacity-40" />
              <p className="text-sm">لا توجد طلبات بحاجة للتجهيز</p>
            </div>
          ) : (
            <div className="p-3 space-y-4">
              {/* Product Summary */}
              <div className="rounded-xl border border-border bg-muted/30 p-3">
                <h3 className="text-xs font-bold text-foreground mb-2">📋 ملخص المنتجات المطلوبة</h3>
                <div className="space-y-1.5">
                  {Object.values(grouped).map((g, i) => (
                    <div key={i} className="flex items-center gap-2 text-xs">
                      {g.image && <img src={g.image} className="w-6 h-6 rounded object-cover" alt="" />}
                      <span className="flex-1 font-medium text-foreground truncate">
                        {g.name}
                        {g.color && <span className="text-muted-foreground"> ({g.color})</span>}
                        {g.option && <span className="text-muted-foreground"> - {g.option}</span>}
                      </span>
                      <Badge variant="outline" className="text-[10px] px-1.5 font-bold">{g.totalQty}×</Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Individual Orders */}
              {orders.map(order => {
                const isExpanded = expandedOrder === order.id;
                return (
                  <div key={order.id} className="rounded-xl border border-border bg-card/60 overflow-hidden">
                    <button
                      type="button"
                      onClick={() => setExpandedOrder(isExpanded ? null : order.id)}
                      className="w-full p-3 flex items-center gap-2 text-right hover:bg-muted/30 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-xs font-bold text-foreground">{order.order_number}</span>
                          <Badge className={`text-[10px] px-1.5 border ${STATUS_COLORS[order.status] || 'bg-muted'}`}>
                            {STATUS_LABELS[order.status] || order.status}
                          </Badge>
                          {order.priority === 'urgent' && <Badge variant="destructive" className="text-[10px] px-1.5">عاجل</Badge>}
                        </div>
                        <p className="text-[11px] text-muted-foreground truncate">
                          {order.governorate} • {order.order_items.length} منتج • {format(new Date(order.created_at), 'dd MMM HH:mm', { locale: ar })}
                        </p>
                      </div>
                      {isExpanded ? <ChevronUp className="h-4 w-4 text-muted-foreground" /> : <ChevronDown className="h-4 w-4 text-muted-foreground" />}
                    </button>

                    {isExpanded && (
                      <div className="border-t border-border p-3 space-y-2 bg-muted/10">
                        {/* Items */}
                        {order.order_items.map(item => (
                          <div key={item.id} className="flex items-center gap-2 text-xs">
                            {item.color_image_url && <img src={item.color_image_url} className="w-8 h-8 rounded object-cover border border-border" alt="" />}
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">{item.product_name_ar}</p>
                              <p className="text-muted-foreground text-[11px]">
                                {[item.selected_color, item.selected_option, item.shipping_option_name_ar].filter(Boolean).join(' • ')}
                              </p>
                            </div>
                            <span className="font-bold text-foreground whitespace-nowrap">×{item.quantity}</span>
                          </div>
                        ))}

                        {/* Address & Phone */}
                        <div className="pt-2 border-t border-border/50 text-[11px] text-muted-foreground space-y-1">
                          <div className="flex items-center gap-1">
                            <span className="flex-1 truncate">📍 {order.governorate} - {order.shipping_address}</span>
                            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { navigator.clipboard.writeText(`${order.governorate} - ${order.shipping_address}`); toast({ title: 'تم نسخ العنوان' }); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <div className="flex items-center gap-1">
                            <span className="flex-1">📞 {order.phone_number}</span>
                            <Button size="icon" variant="ghost" className="h-5 w-5 shrink-0" onClick={() => { navigator.clipboard.writeText(order.phone_number || ''); toast({ title: 'تم نسخ الرقم' }); }}>
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                        </div>

                        {/* Copy button */}
                        <Button
                          size="sm"
                          variant="outline"
                          className="w-full text-xs h-7 mt-1"
                          onClick={() => copyOrderText(order)}
                        >
                          {copiedId === order.id ? <Check className="h-3 w-3 ml-1" /> : <Copy className="h-3 w-3 ml-1" />}
                          {copiedId === order.id ? 'تم النسخ' : 'نسخ تفاصيل الطلب'}
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </SheetContent>
    </Sheet>
  );
}
