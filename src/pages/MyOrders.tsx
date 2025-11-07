import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, ExternalLink, Calendar, MapPin, Phone, CreditCard } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  // Enable realtime notifications
  useOrderRealtimeNotifications();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders', user?.id],
    queryFn: async () => {
      if (!user) return [];

      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          order_items(
            *,
            products(name_ar, image_url)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: !!user
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: 'قيد الانتظار' },
      confirmed: { variant: 'secondary', label: 'مؤكد' },
      processing: { variant: 'default', label: 'قيد التجهيز' },
      shipped: { variant: 'default', label: 'تم الشحن' },
      delivered: { variant: 'secondary', label: 'تم التوصيل' },
      cancelled: { variant: 'destructive', label: 'ملغي' },
    };

    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2">طلباتي</h1>
          <p className="text-muted-foreground">تتبع حالة طلباتك ومعلومات الشحن</p>
        </div>

        {!orders || orders.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">لا توجد طلبات</h3>
              <p className="text-muted-foreground mb-6">لم تقم بإنشاء أي طلبات بعد</p>
              <Button onClick={() => navigate('/products')}>
                تصفح المنتجات
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => (
              <Card key={order.id} className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="border-b border-border/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3">
                        <CardTitle className="text-xl">طلب رقم: {order.order_number}</CardTitle>
                        {getStatusBadge(order.status)}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(order.created_at), 'PPP', { locale: ar })}</span>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-sm text-muted-foreground">المجموع</div>
                      <div className="text-2xl font-black text-primary">
                        {formatPrice(Number(order.total_amount))} {order.currency}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  {/* معلومات الشحن */}
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        معلومات الشحن
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">العنوان:</span>
                          <span className="font-medium">{order.shipping_address}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">المحافظة:</span>
                          <span className="font-medium">{order.governorate}</span>
                        </div>
                        <div className="flex gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.phone_number}</span>
                        </div>
                      </div>
                    </div>

                    {/* معلومات التتبع */}
                    {(order.tracking_number || order.tracking_url) && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-foreground flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          معلومات التتبع
                        </h4>
                        <div className="space-y-2 text-sm">
                          {order.shipping_company && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">شركة الشحن:</span>
                              <span className="font-medium">{order.shipping_company}</span>
                            </div>
                          )}
                          {order.tracking_number && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">رقم التتبع:</span>
                              <code className="font-mono font-bold text-primary bg-primary/10 px-2 py-1 rounded">
                                {order.tracking_number}
                              </code>
                            </div>
                          )}
                          {order.tracking_url && (
                            <Button
                              variant="outline"
                              size="sm"
                              className="w-full mt-2"
                              onClick={() => window.open(order.tracking_url, '_blank')}
                            >
                              <ExternalLink className="h-4 w-4 ml-2" />
                              تتبع الشحنة
                            </Button>
                          )}
                          {order.shipped_at && (
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>تاريخ الشحن: {format(new Date(order.shipped_at), 'PPP', { locale: ar })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {/* ملاحظات الشحن */}
                  {order.shipping_notes && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-bold text-foreground mb-2">ملاحظات الشحن:</h4>
                      <p className="text-sm text-muted-foreground">{order.shipping_notes}</p>
                    </div>
                  )}

                  {/* المنتجات */}
                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      المنتجات ({order.order_items?.length || 0})
                    </h4>
                    <div className="space-y-3">
                      {order.order_items?.slice(0, 2).map((item: any) => (
                        <div
                          key={item.id}
                          className="flex gap-4 p-3 border border-border/50 rounded-lg bg-card/50"
                        >
                          {item.products?.image_url && (
                            <img
                              src={item.products.image_url}
                              alt={item.product_name_ar}
                              className="w-16 h-16 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <div className="font-bold text-foreground">{item.product_name_ar}</div>
                            {item.selected_option && (
                              <div className="text-sm text-muted-foreground">
                                الخيار: {item.selected_option}
                              </div>
                            )}
                            {item.selected_color && (
                              <div className="text-sm text-muted-foreground">
                                اللون: {item.selected_color}
                              </div>
                            )}
                            <div className="text-sm text-muted-foreground">
                              الكمية: {item.quantity}
                            </div>
                          </div>
                          <div className="text-left">
                            <div className="font-bold text-primary">
                              {formatPrice(Number(item.total_price))}
                            </div>
                            <div className="text-xs text-muted-foreground">
                              {formatPrice(Number(item.unit_price))} × {item.quantity}
                            </div>
                          </div>
                        </div>
                      ))}
                      {order.order_items && order.order_items.length > 2 && (
                        <div className="text-sm text-muted-foreground text-center">
                          و {order.order_items.length - 2} منتجات أخرى
                        </div>
                      )}
                    </div>
                  </div>

                  {/* زر عرض التفاصيل */}
                  <div className="mt-6 pt-4 border-t border-border/50">
                    <Button
                      onClick={() => navigate(`/order/${order.id}`)}
                      className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    >
                      عرض تفاصيل الطلب كاملة
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
