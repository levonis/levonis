import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, ExternalLink, Calendar, MapPin, Phone, CreditCard, Ship, Plane, ShoppingBag } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';

const MyOrders = () => {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { t } = useLanguage();
  
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
    enabled: !!user
  });

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string }> = {
      pending: { variant: 'outline', label: t('order_pending') },
      confirmed: { variant: 'secondary', label: t('order_confirmed') },
      processing: { variant: 'default', label: t('order_processing') },
      arrived_warehouse: { variant: 'default', label: t('order_arrived_warehouse') },
      shipped: { variant: 'default', label: t('order_shipped') },
      arrived_iraq: { variant: 'default', label: t('order_arrived_iraq') },
      on_the_way: { variant: 'default', label: t('order_on_the_way') },
      delivered: { variant: 'secondary', label: t('order_delivered') },
      cancelled: { variant: 'destructive', label: t('order_cancelled') },
    };

    const statusInfo = statusMap[status] || { variant: 'outline' as const, label: status };
    return <Badge variant={statusInfo.variant}>{statusInfo.label}</Badge>;
  };

  if (!user || isLoading) {
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
          <h1 className="text-4xl font-black text-primary mb-2">{t('order_title')}</h1>
          <p className="text-muted-foreground">{t('order_desc')}</p>
        </div>

        {!orders || orders.length === 0 ? (
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">{t('order_no_orders')}</h3>
              <p className="text-muted-foreground mb-6">{t('order_no_orders_desc')}</p>
              <Button onClick={() => navigate('/products')}>
                {t('products_browse')}
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {orders.map((order: any) => {
              const isPreOrder = order.order_items?.some((item: any) => item.shipping_option_name_ar && item.shipping_option_name_ar.trim() !== '');
              const shippingItem = order.order_items?.find((item: any) => item.shipping_option_name_ar);
              const shippingOptionName = shippingItem?.shipping_option_name_ar || '';
              const isFastShipping = shippingOptionName.includes('سريع') || shippingOptionName.includes('جوي');
              
              return (
              <Card key={order.id} className="border-primary/20 shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader className="border-b border-border/50">
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
                    <div className="space-y-2">
                      <div className="flex items-center gap-3 flex-wrap">
                        <CardTitle className="text-xl">{t('order_number')}: {order.order_number}</CardTitle>
                        {getStatusBadge(order.status)}
                        <Badge variant={isPreOrder ? "outline" : "secondary"} className="flex items-center gap-1">
                          <ShoppingBag className="h-3 w-3" />
                          {isPreOrder ? t('order_pre_order') : t('order_direct')}
                        </Badge>
                        {isPreOrder && shippingOptionName && (
                          <Badge 
                            variant="outline" 
                            className={`flex items-center gap-1 ${isFastShipping ? 'border-amber-500 text-amber-600' : 'border-blue-500 text-blue-600'}`}
                          >
                            {isFastShipping ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                            {shippingOptionName}
                          </Badge>
                        )}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Calendar className="h-4 w-4" />
                        <span>{format(new Date(order.created_at), 'PPP', { locale: ar })}</span>
                      </div>
                    </div>
                    <div className="text-left md:text-right">
                      <div className="text-sm text-muted-foreground">{t('common_total')}</div>
                      <div className="text-2xl font-black text-primary">
                        {formatPrice(Number(order.total_amount))} {order.currency}
                      </div>
                    </div>
                  </div>
                </CardHeader>

                <CardContent className="pt-6">
                  <div className="grid md:grid-cols-2 gap-6 mb-6">
                    <div className="space-y-3">
                      <h4 className="font-bold text-foreground flex items-center gap-2">
                        <MapPin className="h-4 w-4 text-primary" />
                        {t('order_shipping_info')}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">{t('order_address')}:</span>
                          <span className="font-medium">{order.shipping_address}</span>
                        </div>
                        <div className="flex gap-2">
                          <span className="text-muted-foreground">{t('order_governorate')}:</span>
                          <span className="font-medium">{order.governorate}</span>
                        </div>
                        <div className="flex gap-2">
                          <Phone className="h-4 w-4 text-muted-foreground" />
                          <span className="font-medium">{order.phone_number}</span>
                        </div>
                      </div>
                    </div>

                    {(order.tracking_number || order.tracking_url) && (
                      <div className="space-y-3">
                        <h4 className="font-bold text-foreground flex items-center gap-2">
                          <Truck className="h-4 w-4 text-primary" />
                          {t('order_tracking_info')}
                        </h4>
                        <div className="space-y-2 text-sm">
                          {order.shipping_company && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">{t('order_shipping_company')}:</span>
                              <span className="font-medium">{order.shipping_company}</span>
                            </div>
                          )}
                          {order.tracking_number && (
                            <div className="flex gap-2">
                              <span className="text-muted-foreground">{t('order_tracking_number')}:</span>
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
                              {t('order_track_shipment')}
                            </Button>
                          )}
                          {order.shipped_at && (
                            <div className="flex gap-2 text-xs text-muted-foreground">
                              <Calendar className="h-3 w-3" />
                              <span>{t('order_ship_date')}: {format(new Date(order.shipped_at), 'PPP', { locale: ar })}</span>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {order.shipping_notes && (
                    <div className="mb-6 p-4 bg-muted/50 rounded-lg">
                      <h4 className="font-bold text-foreground mb-2">{t('order_shipping_notes')}:</h4>
                      <p className="text-sm text-muted-foreground">{order.shipping_notes}</p>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h4 className="font-bold text-foreground flex items-center gap-2">
                      <CreditCard className="h-4 w-4 text-primary" />
                      {t('order_products')} ({order.order_items?.length || 0})
                    </h4>
                    <div className="space-y-3">
                      {order.order_items?.slice(0, 2).map((item: any) => {
                        const isCustomRequest = !!item.custom_request_id;
                        const imageUrl = isCustomRequest 
                          ? item.custom_product_requests?.image_url 
                          : item.products?.image_url;
                        const productName = isCustomRequest
                          ? item.custom_product_requests?.product_name || item.product_name_ar
                          : item.product_name_ar;
                        
                        return (
                          <div
                            key={item.id}
                            className="flex gap-4 p-3 border border-border/50 rounded-lg bg-card/50"
                          >
                            {imageUrl && (
                              <img
                                src={imageUrl}
                                alt={productName}
                                className="w-16 h-16 object-cover rounded"
                              />
                            )}
                            <div className="flex-1">
                              <div className="font-bold text-foreground flex items-center gap-2">
                                {productName}
                                {isCustomRequest && (
                                  <Badge variant="secondary" className="text-xs">{t('order_custom_request')}</Badge>
                                )}
                              </div>
                              {item.selected_option && (
                                <div className="text-sm text-muted-foreground">
                                  {t('order_option')}: {item.selected_option}
                                </div>
                              )}
                              {item.selected_color && (
                                <div className="text-sm text-muted-foreground">
                                  {t('order_color')}: {item.selected_color}
                                </div>
                              )}
                              <div className="text-sm text-muted-foreground">
                                {t('common_quantity')}: {item.quantity}
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
                        );
                      })}
                      {order.order_items && order.order_items.length > 2 && (
                        <div className="text-sm text-muted-foreground text-center">
                          {t('order_more_products', { count: order.order_items.length - 2 })}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="mt-6 pt-4 border-t border-border/50">
                    <Button
                      onClick={() => navigate(`/order/${order.id}`)}
                      className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                    >
                      {t('order_view_full')}
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
            })}
          </div>
        )}
      </main>
    </div>
  );
};

export default MyOrders;
