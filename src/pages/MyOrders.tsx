import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Loader2, Package, Truck, ExternalLink, Calendar, MapPin,
  CreditCard, Ship, Plane, ShoppingBag, ArrowRight,
  Clock, CheckCircle, XCircle, Warehouse, PackageCheck
} from 'lucide-react';
import { formatPrice, cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';
import Footer from '@/components/Footer';

const STATUS_TABS = [
  { key: 'all', label: 'الكل', icon: Package },
  { key: 'pending', label: 'بانتظار الدفع', icon: Clock },
  { key: 'confirmed', label: 'مؤكد', icon: PackageCheck },
  { key: 'processing', label: 'قيد التجهيز', icon: Package },
  { key: 'arrived_warehouse', label: 'في المخزن', icon: Warehouse },
  { key: 'shipped', label: 'تم الشحن', icon: Truck },
  { key: 'arrived_iraq', label: 'وصل العراق', icon: MapPin },
  { key: 'on_the_way', label: 'في الطريق', icon: Truck },
  { key: 'delivered', label: 'تم التسليم', icon: CheckCircle },
  { key: 'cancelled', label: 'ملغي', icon: XCircle },
] as const;

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20',
  confirmed: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20',
  processing: 'bg-primary/10 text-primary border-primary/20',
  arrived_warehouse: 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border-indigo-500/20',
  shipped: 'bg-sky-500/10 text-sky-600 dark:text-sky-400 border-sky-500/20',
  arrived_iraq: 'bg-teal-500/10 text-teal-600 dark:text-teal-400 border-teal-500/20',
  on_the_way: 'bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 border-cyan-500/20',
  delivered: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20',
  cancelled: 'bg-destructive/10 text-destructive border-destructive/20',
};

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const initialStatus = searchParams.get('status') || 'all';
  const [activeTab, setActiveTab] = useState(initialStatus);

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
  });

  // Count per status
  const statusCounts: Record<string, number> = {};
  orders?.forEach((o: any) => {
    statusCounts[o.status] = (statusCounts[o.status] || 0) + 1;
  });

  const filtered = activeTab === 'all'
    ? orders
    : orders?.filter((o: any) => o.status === activeTab);

  const getStatusLabel = (status: string) => {
    const found = STATUS_TABS.find(s => s.key === status);
    return found?.label || status;
  };

  if (!user) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      {/* Sticky Header */}
      <div className="sticky top-0 z-50 bg-card border-b shadow-sm">
        {/* Title bar */}
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            <h1 className="text-base font-bold text-foreground">طلباتي</h1>
            {orders && (
              <span className="text-xs text-muted-foreground">({orders.length})</span>
            )}
          </div>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={() => navigate(-1)}>
            <ArrowRight className="h-4 w-4" />
          </Button>
        </div>

        {/* Status Tabs - Horizontal Scroll */}
        <div className="flex gap-1 overflow-x-auto scrollbar-hide px-3 pb-2.5">
          {STATUS_TABS.map((tab) => {
            const count = tab.key === 'all' ? (orders?.length || 0) : (statusCounts[tab.key] || 0);
            const isActive = activeTab === tab.key;
            const Icon = tab.icon;

            return (
              <button
                key={tab.key}
                onClick={() => setActiveTab(tab.key)}
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all border",
                  isActive
                    ? "bg-foreground text-background border-foreground shadow-sm"
                    : "bg-muted/50 text-muted-foreground border-transparent hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-3 w-3" />
                <span>{tab.label}</span>
                {count > 0 && (
                  <span className={cn(
                    "min-w-[18px] h-[18px] flex items-center justify-center rounded-full text-[10px] font-bold px-1",
                    isActive
                      ? "bg-background text-foreground"
                      : "bg-primary/10 text-primary"
                  )}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 px-3 py-3 space-y-2.5">
        {isLoading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => (
              <div key={i} className="rounded-2xl border bg-card p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-5 w-20 rounded-full" />
                </div>
                <div className="flex gap-3">
                  <Skeleton className="h-16 w-16 rounded-xl" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                  </div>
                </div>
                <Skeleton className="h-8 w-full rounded-lg" />
              </div>
            ))}
          </div>
        ) : !filtered || filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="w-20 h-20 rounded-full bg-muted/50 flex items-center justify-center mb-4">
              <Package className="h-10 w-10 text-muted-foreground/50" />
            </div>
            <h3 className="font-bold text-foreground mb-1">
              {activeTab === 'all' ? 'لا توجد طلبات بعد' : `لا توجد طلبات ${getStatusLabel(activeTab)}`}
            </h3>
            <p className="text-sm text-muted-foreground mb-4">
              {activeTab === 'all' ? 'ابدأ التسوق واطلب منتجاتك المفضلة' : 'جرب تصفية أخرى'}
            </p>
            {activeTab === 'all' ? (
              <Button size="sm" onClick={() => navigate('/products')}>
                <ShoppingBag className="h-4 w-4 ml-1.5" />
                تصفح المنتجات
              </Button>
            ) : (
              <Button size="sm" variant="outline" onClick={() => setActiveTab('all')}>
                عرض كل الطلبات
              </Button>
            )}
          </div>
        ) : (
          filtered.map((order: any) => {
            const isPreOrder = order.order_items?.some((item: any) => item.shipping_option_name_ar?.trim());
            const shippingItem = order.order_items?.find((item: any) => item.shipping_option_name_ar);
            const shippingName = shippingItem?.shipping_option_name_ar || '';
            const isFastShipping = shippingName.includes('سريع') || shippingName.includes('جوي');
            const statusColor = STATUS_COLORS[order.status] || 'bg-muted text-muted-foreground border-border';
            const itemCount = order.order_items?.length || 0;
            const firstItem = order.order_items?.[0];
            const firstImage = firstItem?.custom_request_id
              ? firstItem?.custom_product_requests?.image_url
              : firstItem?.products?.image_url;
            const firstName = firstItem?.custom_request_id
              ? firstItem?.custom_product_requests?.product_name || firstItem?.product_name_ar
              : firstItem?.product_name_ar;

            return (
              <div
                key={order.id}
                onClick={() => navigate(`/order/${order.id}`)}
                className="rounded-2xl border bg-card shadow-sm hover:shadow-md transition-all active:scale-[0.99] cursor-pointer overflow-hidden"
              >
                {/* Order header */}
                <div className="flex items-center justify-between px-4 pt-3 pb-2">
                  <div className="flex items-center gap-2 text-xs text-muted-foreground">
                    <Calendar className="h-3 w-3" />
                    <span>{format(new Date(order.created_at), 'dd MMM yyyy', { locale: ar })}</span>
                    <span className="text-muted-foreground/40">•</span>
                    <span className="font-mono text-[11px]">#{order.order_number}</span>
                  </div>
                  <Badge variant="outline" className={cn("text-[10px] px-2 py-0.5 font-medium border", statusColor)}>
                    {getStatusLabel(order.status)}
                  </Badge>
                </div>

                {/* Items preview */}
                <div className="px-4 pb-3">
                  <div className="flex gap-3 items-start">
                    {/* Image stack */}
                    <div className="relative flex-shrink-0">
                      {firstImage ? (
                        <img
                          src={firstImage}
                          alt={firstName}
                          className="w-16 h-16 object-cover rounded-xl border bg-muted"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded-xl border bg-muted flex items-center justify-center">
                          <Package className="h-6 w-6 text-muted-foreground/40" />
                        </div>
                      )}
                      {itemCount > 1 && (
                        <span className="absolute -bottom-1 -left-1 bg-foreground text-background text-[10px] font-bold rounded-full w-5 h-5 flex items-center justify-center shadow-sm">
                          {itemCount}
                        </span>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-foreground line-clamp-1 mb-1">
                        {firstName}
                        {itemCount > 1 && (
                          <span className="text-muted-foreground font-normal"> و{itemCount - 1} منتج آخر</span>
                        )}
                      </p>

                      {/* Tags row */}
                      <div className="flex flex-wrap gap-1 mb-1.5">
                        <span className={cn(
                          "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md",
                          isPreOrder
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                            : "bg-muted text-muted-foreground"
                        )}>
                          <ShoppingBag className="h-2.5 w-2.5" />
                          {isPreOrder ? 'طلب مسبق' : 'مباشر'}
                        </span>
                        {isPreOrder && shippingName && (
                          <span className={cn(
                            "inline-flex items-center gap-0.5 text-[10px] px-1.5 py-0.5 rounded-md",
                            isFastShipping
                              ? "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                              : "bg-sky-500/10 text-sky-600 dark:text-sky-400"
                          )}>
                            {isFastShipping ? <Plane className="h-2.5 w-2.5" /> : <Ship className="h-2.5 w-2.5" />}
                            {shippingName}
                          </span>
                        )}
                      </div>

                      {/* Tracking */}
                      {order.tracking_number && (
                        <div className="flex items-center gap-1 text-[11px] text-primary">
                          <Truck className="h-3 w-3" />
                          <code className="font-mono">{order.tracking_number}</code>
                        </div>
                      )}
                    </div>

                    {/* Price */}
                    <div className="text-left flex-shrink-0">
                      <p className="text-sm font-bold text-foreground">
                        {formatPrice(Number(order.total_amount))}
                      </p>
                      <p className="text-[10px] text-muted-foreground">{order.currency}</p>
                    </div>
                  </div>
                </div>

                {/* Bottom action bar */}
                {(order.status === 'delivered' || order.tracking_url) && (
                  <div className="border-t px-4 py-2 flex gap-2">
                    {order.tracking_url && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          window.open(order.tracking_url, '_blank');
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-primary bg-primary/5 hover:bg-primary/10 rounded-lg py-1.5 transition-colors"
                      >
                        <ExternalLink className="h-3 w-3" />
                        تتبع الشحنة
                      </button>
                    )}
                    {order.status === 'delivered' && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          navigate(`/my-orders/${order.id}/confirm`);
                        }}
                        className="flex-1 flex items-center justify-center gap-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 hover:bg-emerald-500/10 rounded-lg py-1.5 transition-colors"
                      >
                        <CheckCircle className="h-3 w-3" />
                        تأكيد الاستلام
                      </button>
                    )}
                  </div>
                )}
              </div>
            );
          })
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyOrders;
