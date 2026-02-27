import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Package, Truck, ExternalLink, MapPin,
  Ship, Plane, ShoppingBag, ArrowRight,
  Clock, CheckCircle, XCircle, Warehouse, PackageCheck,
  ChevronDown, Store
} from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';
import Footer from '@/components/Footer';

const PREORDER_TABS = [
  { key: 'all', label: 'الكل', icon: Package },
  { key: 'pending', label: 'بانتظار الدفع', icon: Clock },
  { key: 'confirmed', label: 'مؤكد', icon: PackageCheck },
  { key: 'purchased', label: 'تم الشراء', icon: ShoppingBag },
  { key: 'arrived_warehouse', label: 'في المخزن', icon: Warehouse },
  { key: 'shipped', label: 'تم الشحن', icon: Ship },
  { key: 'arrived_iraq', label: 'وصل العراق', icon: MapPin },
  { key: 'on_the_way', label: 'في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', icon: CheckCircle },
  { key: 'cancelled', label: 'ملغي', icon: XCircle },
] as const;

const DIRECT_TABS = [
  { key: 'all', label: 'الكل', icon: Package },
  { key: 'pending', label: 'بانتظار الدفع', icon: Clock },
  { key: 'confirmed', label: 'مؤكد', icon: PackageCheck },
  { key: 'processing', label: 'قيد التجهيز', icon: Package },
  { key: 'shipped', label: 'تم الشحن', icon: Truck },
  { key: 'on_the_way', label: 'في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', icon: CheckCircle },
  { key: 'cancelled', label: 'ملغي', icon: XCircle },
] as const;

const STATUS_ACCENT: Record<string, string> = {
  pending: 'bg-amber-500',
  confirmed: 'bg-blue-500',
  processing: 'bg-primary',
  purchased: 'bg-violet-500',
  arrived_warehouse: 'bg-indigo-500',
  shipped: 'bg-sky-500',
  arrived_iraq: 'bg-teal-500',
  on_the_way: 'bg-cyan-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-destructive',
};

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  processing: 'bg-primary/10 text-primary border-primary/20',
  purchased: 'bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20',
  arrived_warehouse: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  shipped: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  arrived_iraq: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  on_the_way: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const ALL_STATUS_LABELS: Record<string, string> = {};
[...PREORDER_TABS, ...DIRECT_TABS].forEach(t => { ALL_STATUS_LABELS[t.key] = t.label; });

const OrderSkeleton = () => (
  <div className="space-y-3 px-4 py-4">
    {[1, 2, 3].map(i => (
      <div key={i} className="rounded-2xl border bg-card overflow-hidden">
        <div className="flex">
          <Skeleton className="w-1.5 shrink-0" />
          <div className="flex-1 p-4 space-y-3">
            <div className="flex justify-between">
              <Skeleton className="h-3 w-28" />
              <Skeleton className="h-5 w-16 rounded-full" />
            </div>
            <div className="flex gap-3">
              <Skeleton className="h-14 w-14 rounded-xl" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="flex justify-between items-center">
              <Skeleton className="h-6 w-24" />
              <Skeleton className="h-3 w-16" />
            </div>
          </div>
        </div>
      </div>
    ))}
  </div>
);

interface OrderCardProps {
  order: any;
  navigate: (path: string) => void;
}

const OrderCard = ({ order, navigate }: OrderCardProps) => {
  const isPreOrder = order.order_type !== 'direct';
  const shippingItem = order.order_items?.find((item: any) => item.shipping_option_name_ar);
  const shippingName = shippingItem?.shipping_option_name_ar || '';
  const isFastShipping = shippingName.includes('سريع') || shippingName.includes('جوي');
  const accentColor = STATUS_ACCENT[order.status] || 'bg-muted';
  const statusColor = STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground border-border';
  const itemCount = order.order_items?.length || 0;
  const firstItem = order.order_items?.[0];
  const firstImage = firstItem?.custom_request_id
    ? firstItem?.custom_product_requests?.image_url
    : firstItem?.products?.image_url;
  const firstName = firstItem?.custom_request_id
    ? firstItem?.custom_product_requests?.product_name || firstItem?.product_name_ar
    : firstItem?.product_name_ar;

  const relativeTime = (() => {
    try {
      return formatDistanceToNow(new Date(order.created_at), { addSuffix: true, locale: ar });
    } catch {
      return '';
    }
  })();

  return (
    <div
      onClick={() => navigate(`/order/${order.id}`)}
      className="rounded-2xl border border-border/40 bg-card overflow-hidden hover:border-primary/20 transition-all active:scale-[0.98] cursor-pointer"
    >
      <div className="flex">
        <div className={cn("w-1.5 shrink-0 rounded-r-none", accentColor)} />
        <div className="flex-1 p-3.5">
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[11px] text-muted-foreground">#{order.order_number}</span>
              <span className="text-muted-foreground/30">•</span>
              <span className="text-[11px] text-muted-foreground">{relativeTime}</span>
            </div>
            <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-bold border rounded-lg", statusColor)}>
              {ALL_STATUS_LABELS[order.status] || order.status}
            </Badge>
          </div>

          <div className="flex gap-3 items-start">
            <div className="relative shrink-0">
              {firstImage ? (
                <img src={firstImage} alt={firstName} className="w-14 h-14 object-cover rounded-xl border border-border/30 bg-muted" loading="lazy" decoding="async" />
              ) : (
                <div className="w-14 h-14 rounded-xl border border-border/30 bg-muted flex items-center justify-center">
                  <Package className="h-5 w-5 text-muted-foreground/30" />
                </div>
              )}
              {itemCount > 1 && (
                <span className="absolute -bottom-1 -left-1 bg-primary text-primary-foreground text-[9px] font-black rounded-full w-5 h-5 flex items-center justify-center">
                  {itemCount}
                </span>
              )}
            </div>

            <div className="flex-1 min-w-0">
              <p className="text-sm font-bold text-foreground line-clamp-1 mb-1">
                {firstName}
                {itemCount > 1 && <span className="text-muted-foreground font-normal text-xs"> و{itemCount - 1} آخر</span>}
              </p>
              <div className="flex flex-wrap gap-1">
                {order.order_type === 'direct' ? (
                  <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600">
                    <Truck className="h-2.5 w-2.5" />
                    بيع مباشر
                  </span>
                ) : (
                  <>
                    <span className="inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md bg-amber-500/10 text-amber-600">
                      <ShoppingBag className="h-2.5 w-2.5" />
                      طلب مسبق
                    </span>
                    {shippingName && (
                      <span className={cn(
                        "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md",
                        isFastShipping ? "bg-amber-500/10 text-amber-600" : "bg-sky-500/10 text-sky-600"
                      )}>
                        {isFastShipping ? <Plane className="h-2.5 w-2.5" /> : <Ship className="h-2.5 w-2.5" />}
                        {shippingName}
                      </span>
                    )}
                  </>
                )}
              </div>
            </div>

            <div className="text-left shrink-0">
              <p className="text-base font-black text-primary">{formatPrice(Number(order.total_amount))}</p>
              <p className="text-[10px] text-muted-foreground">{order.currency}</p>
            </div>
          </div>

          {order.tracking_number && (
            <div className="flex items-center gap-1.5 mt-2 text-[11px] text-primary bg-primary/5 rounded-lg px-2 py-1">
              <Truck className="h-3 w-3" />
              <code className="font-mono">{order.tracking_number}</code>
            </div>
          )}

          {(order.status === 'delivered' || order.tracking_url) && (
            <div className="flex gap-2 mt-2.5">
              {order.tracking_url && (
                <button
                  onClick={(e) => { e.stopPropagation(); window.open(order.tracking_url, '_blank'); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-primary bg-primary/10 hover:bg-primary/15 rounded-xl py-2 transition-colors"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                  تتبع الشحنة
                </button>
              )}
              {order.status === 'delivered' && (
                <button
                  onClick={(e) => { e.stopPropagation(); navigate(`/my-orders/${order.id}/confirm`); }}
                  className="flex-1 flex items-center justify-center gap-1.5 text-xs font-bold text-emerald-600 bg-emerald-500/10 hover:bg-emerald-500/15 rounded-xl py-2 transition-colors"
                >
                  <CheckCircle className="h-3.5 w-3.5" />
                  تأكيد الاستلام
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();

  const [preorderExpanded, setPreorderExpanded] = useState(true);
  const [directExpanded, setDirectExpanded] = useState(false);
  const [preorderTab, setPreorderTab] = useState('all');
  const [directTab, setDirectTab] = useState('all');

  useOrderRealtimeNotifications();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            *,
            products!order_items_product_id_fkey(name_ar, image_url),
            custom_product_requests(product_name, image_url, suggested_price)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const preorders = orders?.filter((o: any) => o.order_type !== 'direct') || [];
  const directOrders = orders?.filter((o: any) => o.order_type === 'direct') || [];

  const preorderCounts: Record<string, number> = {};
  preorders.forEach((o: any) => { preorderCounts[o.status] = (preorderCounts[o.status] || 0) + 1; });

  const directCounts: Record<string, number> = {};
  directOrders.forEach((o: any) => { directCounts[o.status] = (directCounts[o.status] || 0) + 1; });

  const filteredPreorders = preorderTab === 'all' ? preorders : preorders.filter((o: any) => o.status === preorderTab);
  const filteredDirect = directTab === 'all' ? directOrders : directOrders.filter((o: any) => o.status === directTab);

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Package className="h-8 w-8 animate-pulse text-primary" />
      </div>
    );
  }

  const renderTabs = (
    tabs: readonly { key: string; label: string; icon: any }[],
    activeTab: string,
    setTab: (k: string) => void,
    counts: Record<string, number>,
    totalCount: number
  ) => (
    <div className="flex gap-1.5 overflow-x-auto scrollbar-hide px-4 pb-3 pt-2">
      {tabs.map((tab) => {
        const count = tab.key === 'all' ? totalCount : (counts[tab.key] || 0);
        const isActive = activeTab === tab.key;
        const Icon = tab.icon;
        return (
          <button
            key={tab.key}
            onClick={() => setTab(tab.key)}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-all border",
              isActive
                ? "bg-primary text-primary-foreground border-primary shadow-md"
                : "bg-card text-muted-foreground border-border/40 hover:border-primary/30 hover:text-foreground"
            )}
          >
            <Icon className="h-3.5 w-3.5" />
            <span>{tab.label}</span>
            {count > 0 && (
              <span className={cn(
                "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-black px-1",
                isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-primary/10 text-primary"
              )}>
                {count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );

  const renderOrderList = (filtered: any[], emptyLabel: string) => {
    if (filtered.length === 0) {
      return (
        <div className="flex flex-col items-center justify-center py-12 text-center px-6">
          <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center mb-4">
            <Package className="h-8 w-8 text-primary/40" />
          </div>
          <h3 className="font-bold text-foreground mb-1 text-sm">لا توجد طلبات {emptyLabel}</h3>
          <p className="text-xs text-muted-foreground">جرب تصفية أخرى أو ابدأ التسوق</p>
        </div>
      );
    }
    return (
      <div className="px-3 py-2 space-y-2.5">
        {filtered.map((order: any) => (
          <OrderCard key={order.id} order={order} navigate={navigate} />
        ))}
      </div>
    );
  };

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Header */}
      <div className="sticky top-0 z-50 bg-card border-b border-border/30">
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-primary/15 flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
              <div>
                <h1 className="text-lg font-black text-foreground">طلباتي</h1>
                {orders && <p className="text-xs text-muted-foreground">{orders.length} طلب</p>}
              </div>
            </div>
            <Button variant="ghost" size="icon" className="h-9 w-9 rounded-xl" onClick={() => navigate(-1 as any)}>
              <ArrowRight className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-24">
        {isLoading ? (
          <OrderSkeleton />
        ) : !orders || orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 text-center px-6">
            <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center mb-5">
              <Package className="h-10 w-10 text-primary/40" />
            </div>
            <h3 className="font-black text-foreground mb-1.5 text-lg">لا توجد طلبات بعد</h3>
            <p className="text-sm text-muted-foreground mb-5">ابدأ التسوق واطلب منتجاتك المفضلة</p>
            <Button onClick={() => navigate('/products')} className="rounded-xl">
              <ShoppingBag className="h-4 w-4 ml-1.5" />
              تصفح المنتجات
            </Button>
          </div>
        ) : (
          <div className="space-y-3 pt-3">
            {/* Preorder Section */}
            <div className="mx-3">
              <button
                onClick={() => setPreorderExpanded(!preorderExpanded)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all",
                  preorderExpanded
                    ? "bg-amber-500/10 border-amber-500/20"
                    : "bg-card border-border/40 hover:border-amber-500/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    preorderExpanded ? "bg-amber-500/20" : "bg-amber-500/10"
                  )}>
                    <ShoppingBag className="h-4.5 w-4.5 text-amber-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground">الحجز المسبق</p>
                    <p className="text-[11px] text-muted-foreground">{preorders.length} طلب</p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  preorderExpanded && "rotate-180"
                )} />
              </button>

              {preorderExpanded && (
                <div className="mt-2">
                  {renderTabs(PREORDER_TABS, preorderTab, setPreorderTab, preorderCounts, preorders.length)}
                  {renderOrderList(filteredPreorders, ALL_STATUS_LABELS[preorderTab] || '')}
                </div>
              )}
            </div>

            {/* Direct Sale Section */}
            <div className="mx-3">
              <button
                onClick={() => setDirectExpanded(!directExpanded)}
                className={cn(
                  "w-full flex items-center justify-between px-4 py-3.5 rounded-2xl border transition-all",
                  directExpanded
                    ? "bg-emerald-500/10 border-emerald-500/20"
                    : "bg-card border-border/40 hover:border-emerald-500/30"
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn(
                    "w-9 h-9 rounded-xl flex items-center justify-center",
                    directExpanded ? "bg-emerald-500/20" : "bg-emerald-500/10"
                  )}>
                    <Store className="h-4.5 w-4.5 text-emerald-600" />
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-black text-foreground">البيع المباشر</p>
                    <p className="text-[11px] text-muted-foreground">{directOrders.length} طلب</p>
                  </div>
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  directExpanded && "rotate-180"
                )} />
              </button>

              {directExpanded && (
                <div className="mt-2">
                  {renderTabs(DIRECT_TABS, directTab, setDirectTab, directCounts, directOrders.length)}
                  {renderOrderList(filteredDirect, ALL_STATUS_LABELS[directTab] || '')}
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyOrders;
