import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate, useParams } from 'react-router-dom';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, ExternalLink, Calendar, MapPin, Phone, CreditCard, ArrowRight, ShoppingBag, FileText, Printer } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import html2pdf from 'html2pdf.js';
import { OrderInvoice } from '@/components/OrderInvoice';
import CustomerChat from '@/components/CustomerChat';
import { useState } from 'react';
import { toast } from 'sonner';

const OrderDetail = () => {
  const { orderId } = useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  
  // Enable realtime notifications
  useOrderRealtimeNotifications();

  const canQuery = !!orderId && !authLoading && (!!user || isAdmin);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId, isAdmin, user?.id],
    queryFn: async () => {
      if (!orderId) return null;

      let query = supabase
        .from('orders')
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            *,
            products!order_items_product_id_fkey(name_ar, image_url, images)
          ),
          profiles(full_name, email)
        `)
        .eq('id', orderId);

      // If not admin, require user and filter by user_id
      if (!isAdmin) {
        if (!user) return null;
        query = query.eq('user_id', user.id);
      }

      const { data, error } = await query.maybeSingle();

      if (error) throw error;
      return data;
    },
    enabled: canQuery
  });

  const handleDownloadPDF = async () => {
    if (!order) return;
    
    setIsGeneratingPDF(true);
    
    try {
      const element = document.getElementById('invoice-content');
      
      // Save invoice HTML to database
      const invoiceHTML = element?.outerHTML || '';
      
      // Calculate warranty expiry (1 year from now as default)
      const warrantyExpiresAt = new Date();
      warrantyExpiresAt.setFullYear(warrantyExpiresAt.getFullYear() + 1);
      
      // Get the current template ID
      const { data: template } = await supabase
        .from("invoice_templates")
        .select("id")
        .eq("is_default", true)
        .single();
      
      // Save to database
      await supabase.from("saved_invoices").insert({
        order_id: order.id,
        invoice_html: invoiceHTML,
        template_id: template?.id || null,
        warranty_expires_at: warrantyExpiresAt.toISOString(),
        notes: null
      });
      
      // Generate PDF
      const options = {
        margin: 10,
        filename: `invoice-${order.order_number}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' as const }
      };

      await html2pdf().set(options).from(element).save();
      toast.success('تم حفظ الفاتورة وتنزيلها بنجاح');
    } catch (error) {
      console.error('Error generating PDF:', error);
      toast.error('حدث خطأ في توليد الفاتورة');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDirectPrint = () => {
    const printContents = document.getElementById('invoice-content');
    if (!printContents) return;
    
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }
    
    printWindow.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
        <head>
          <meta charset="UTF-8">
          <title>فاتورة - ${order?.order_number}</title>
          <style>
            * { box-sizing: border-box; margin: 0; padding: 0; }
            body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; }
            @media print { body { padding: 0; } }
            .space-y-3 > * + * { margin-top: 0.75rem; }
            .space-y-1 > * + * { margin-top: 0.25rem; }
            .grid { display: grid; }
            .grid-cols-2 { grid-template-columns: repeat(2, minmax(0, 1fr)); }
            .gap-4 { gap: 1rem; }
            .flex { display: flex; }
            .justify-between { justify-content: space-between; }
            .items-center { align-items: center; }
            .text-center { text-align: center; }
            .text-right { text-align: right; }
            .font-bold { font-weight: 700; }
            .font-semibold { font-weight: 600; }
            .font-medium { font-weight: 500; }
            .text-sm { font-size: 0.875rem; }
            .text-xs { font-size: 0.75rem; }
            .text-lg { font-size: 1.125rem; }
            .text-xl { font-size: 1.25rem; }
            .text-2xl { font-size: 1.5rem; }
            .mb-1 { margin-bottom: 0.25rem; }
            .mb-2 { margin-bottom: 0.5rem; }
            .mb-4 { margin-bottom: 1rem; }
            .mb-6 { margin-bottom: 1.5rem; }
            .mt-1 { margin-top: 0.25rem; }
            .mt-2 { margin-top: 0.5rem; }
            .mt-4 { margin-top: 1rem; }
            .mt-6 { margin-top: 1.5rem; }
            .mt-8 { margin-top: 2rem; }
            .pt-2 { padding-top: 0.5rem; }
            .pt-3 { padding-top: 0.75rem; }
            .pb-2 { padding-bottom: 0.5rem; }
            .px-3 { padding-left: 0.75rem; padding-right: 0.75rem; }
            .py-1 { padding-top: 0.25rem; padding-bottom: 0.25rem; }
            .opacity-70 { opacity: 0.7; }
            .opacity-80 { opacity: 0.8; }
            .border-b { border-bottom: 1px solid #e5e7eb; }
            .border-t { border-top: 1px solid #e5e7eb; }
            .border-t-2 { border-top: 2px solid #e5e7eb; }
            .rounded-lg { border-radius: 0.5rem; }
            .rounded-t-lg { border-top-left-radius: 0.5rem; border-top-right-radius: 0.5rem; }
            .rounded-b-lg { border-bottom-left-radius: 0.5rem; border-bottom-right-radius: 0.5rem; }
            .rounded-full { border-radius: 9999px; }
            .list-disc { list-style-type: disc; }
            .pr-5 { padding-right: 1.25rem; }
            .bg-green-100 { background-color: #dcfce7; }
            .bg-yellow-100 { background-color: #fef9c3; }
            .bg-blue-100 { background-color: #dbeafe; }
            .bg-red-100 { background-color: #fee2e2; }
            .text-green-600 { color: #16a34a; }
            .text-green-700 { color: #15803d; }
            .text-green-800 { color: #166534; }
            .text-yellow-800 { color: #854d0e; }
            .text-blue-800 { color: #1e40af; }
            .text-red-600 { color: #dc2626; }
            .text-red-800 { color: #991b1b; }
            table { width: 100%; border-collapse: collapse; }
          </style>
        </head>
        <body>
          ${printContents.outerHTML}
        </body>
      </html>
    `);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 500);
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { variant: 'default' | 'secondary' | 'destructive' | 'outline', label: string, color: string }> = {
      pending: { variant: 'outline', label: 'قيد الانتظار', color: 'text-amber-500' },
      confirmed: { variant: 'secondary', label: 'مؤكد', color: 'text-blue-500' },
      processing: { variant: 'default', label: 'قيد التجهيز', color: 'text-purple-500' },
      arrived_warehouse: { variant: 'default', label: 'وصل المخزن', color: 'text-indigo-500' },
      shipped: { variant: 'default', label: 'تم الشحن', color: 'text-cyan-500' },
      arrived_iraq: { variant: 'default', label: 'وصل العراق', color: 'text-teal-500' },
      delivered: { variant: 'secondary', label: 'تم التوصيل', color: 'text-green-500' },
      cancelled: { variant: 'destructive', label: 'ملغي', color: 'text-red-500' },
    };

    return statusMap[status] || { variant: 'outline' as const, label: status, color: 'text-muted-foreground' };
  };

  if (!canQuery || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!order && !isLoading && !authLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm">
        <main className="container mx-auto px-4 py-8 pt-24">
          <Card className="border-border/50">
            <CardContent className="py-12 text-center">
              <Package className="h-16 w-16 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-xl font-bold text-foreground mb-2">الطلب غير موجود</h3>
              <p className="text-muted-foreground mb-6">لم نتمكن من العثور على هذا الطلب</p>
              <Button onClick={() => navigate(isAdmin ? '/admin/orders' : '/my-orders')}>
                <ArrowRight className="ml-2 h-4 w-4" />
                {isAdmin ? 'العودة إلى لوحة الطلبات' : 'العودة إلى طلباتي'}
              </Button>
            </CardContent>
          </Card>
        </main>
      </div>
    );
  }

  const statusInfo = getStatusBadge(order.status);

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm relative overflow-hidden">
      <main className="container mx-auto px-4 py-8 pt-24 relative z-10 max-w-5xl">
        {/* Header */}
        <div className="mb-6">
          <Button 
            variant="ghost" 
            onClick={() => navigate(isAdmin ? '/admin/orders' : '/my-orders')}
            className="mb-4 hover:bg-primary/10"
          >
            <ArrowRight className="ml-2 h-4 w-4" />
            {isAdmin ? 'العودة إلى لوحة الطلبات' : 'العودة إلى طلباتي'}
          </Button>
          <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
            <div>
              <h1 className="text-4xl font-black text-primary mb-2">تفاصيل الطلب</h1>
              <p className="text-muted-foreground">رقم الطلب: {order.order_number}</p>
            </div>
            <div className="flex flex-col sm:flex-row gap-3 flex-wrap">
              {(order.status === 'arrived_warehouse' || 
                order.status === 'shipped' || 
                order.status === 'arrived_iraq' || 
                order.status === 'delivered') && (
                <>
                  <Button 
                    onClick={handleDirectPrint}
                    variant="outline"
                    className="border-primary text-primary hover:bg-primary/10"
                  >
                    <Printer className="ml-2 h-4 w-4" />
                    طباعة مباشرة
                  </Button>
                  <Button 
                    onClick={handleDownloadPDF}
                    disabled={isGeneratingPDF}
                    className="bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                  >
                    {isGeneratingPDF ? (
                      <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                    ) : (
                      <FileText className="ml-2 h-4 w-4" />
                    )}
                    تحميل PDF
                  </Button>
                </>
              )}
              <Badge variant={statusInfo.variant} className="text-lg px-4 py-2 w-fit">
                {statusInfo.label}
              </Badge>
            </div>
          </div>
        </div>

        {/* Order Timeline */}
        <Card className="mb-6 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Calendar className="h-5 w-5 text-primary" />
              مراحل الطلب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative">
              <div className="absolute right-4 top-0 bottom-0 w-0.5 bg-border"></div>
              <div className="space-y-6">
                {/* Created */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${order.created_at ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">تم إنشاء الطلب</h4>
                    {order.created_at && (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.created_at), 'PPP - p', { locale: ar })}
                      </p>
                    )}
                  </div>
                </div>

                {/* Confirmed */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${['confirmed', 'processing', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <CreditCard className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">تم تأكيد الطلب</h4>
                    {['confirmed', 'processing', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) && (
                      <p className="text-sm text-primary font-medium">تم التأكيد</p>
                    )}
                  </div>
                </div>

                {/* Processing */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${['processing', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">قيد التجهيز</h4>
                    {['processing', 'arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) && (
                      <p className="text-sm text-primary font-medium">جاري تجهيز الطلب</p>
                    )}
                  </div>
                </div>

                {/* Arrived Warehouse */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${['arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">وصل إلى المخزن</h4>
                    {order.arrived_warehouse_at ? (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.arrived_warehouse_at), 'PPP - p', { locale: ar })}
                      </p>
                    ) : ['arrived_warehouse', 'shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? (
                      <p className="text-sm text-primary font-medium">وصل المخزن</p>
                    ) : null}
                    {order.serial_number_image_url && (
                      <img src={order.serial_number_image_url} alt="Serial Number" className="mt-2 max-w-xs rounded border" />
                    )}
                  </div>
                </div>

                {/* Shipped */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${['shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <Truck className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">تم الشحن</h4>
                    {order.shipped_at ? (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.shipped_at), 'PPP - p', { locale: ar })}
                      </p>
                    ) : ['shipped', 'arrived_iraq', 'delivered'].includes(order.status) ? (
                      <p className="text-sm text-primary font-medium">تم الشحن</p>
                    ) : null}
                  </div>
                </div>

                {/* Arrived Iraq */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${['arrived_iraq', 'delivered'].includes(order.status) ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <MapPin className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">وصل إلى العراق</h4>
                    {order.arrived_iraq_at ? (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.arrived_iraq_at), 'PPP - p', { locale: ar })}
                      </p>
                    ) : ['arrived_iraq', 'delivered'].includes(order.status) ? (
                      <p className="text-sm text-primary font-medium">وصل العراق</p>
                    ) : null}
                  </div>
                </div>

                {/* Delivered */}
                <div className="relative flex gap-4 pr-10">
                  <div className={`absolute right-0 w-8 h-8 rounded-full border-2 flex items-center justify-center bg-background ${order.status === 'delivered' ? 'border-primary text-primary' : 'border-border text-muted-foreground'}`}>
                    <ShoppingBag className="h-4 w-4" />
                  </div>
                  <div className="flex-1">
                    <h4 className="font-bold text-foreground">تم التوصيل</h4>
                    {order.delivered_at ? (
                      <p className="text-sm text-muted-foreground">
                        {format(new Date(order.delivered_at), 'PPP - p', { locale: ar })}
                      </p>
                    ) : order.status === 'delivered' ? (
                      <p className="text-sm text-primary font-medium">تم التوصيل</p>
                    ) : null}
                  </div>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Delivery Confirmation (User Only) */}
        {!isAdmin && order.status === 'delivered' && !order.user_confirmed_delivery && (
          <Card className="mb-6 border-green-500/50 shadow-lg bg-green-50/50">
            <CardContent className="py-6">
              <div className="text-center space-y-4">
                <h3 className="text-xl font-bold text-green-700">هل استلمت طلبك؟</h3>
                <p className="text-muted-foreground">يرجى تأكيد استلام الطلب وتقييم المنتجات</p>
                <Button 
                  onClick={() => navigate(`/my-orders/${order.id}/confirm`)}
                  className="bg-green-600 hover:bg-green-700"
                >
                  تأكيد الاستلام وتقييم المنتج
                </Button>
                <p className="text-xs text-muted-foreground">
                  ملاحظة: سيتم تأكيد الاستلام تلقائياً بعد 7 أيام مع تقييم 5 نجوم
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {order.user_confirmed_delivery && (
          <Card className="mb-6 border-primary/20 shadow-lg">
            <CardContent className="py-4">
              <div className="flex items-center justify-center gap-2 text-green-600">
                <ShoppingBag className="h-4 w-4" />
                <span className="font-bold">تم تأكيد الاستلام</span>
                {order.auto_confirmed && <span className="text-sm text-muted-foreground">(تلقائياً)</span>}
              </div>
              {order.user_confirmed_at && (
                <p className="text-center text-sm text-muted-foreground mt-2">
                  {format(new Date(order.user_confirmed_at), 'PPP - p', { locale: ar })}
                </p>
              )}
            </CardContent>
          </Card>
        )}

        <div className="grid md:grid-cols-2 gap-6">
          {/* Shipping Info */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MapPin className="h-5 w-5 text-primary" />
                معلومات الشحن
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <div className="text-sm text-muted-foreground mb-1">العنوان</div>
                <div className="font-bold text-foreground">{order.shipping_address}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">المحافظة</div>
                <div className="font-bold text-foreground">{order.governorate}</div>
              </div>
              <div>
                <div className="text-sm text-muted-foreground mb-1">رقم الهاتف</div>
                <div className="font-bold text-foreground flex items-center gap-2">
                  <Phone className="h-4 w-4 text-primary" />
                  {order.phone_number}
                </div>
              </div>
            </CardContent>
          </Card>

          {/* Order Details Info */}
          <Card className="border-primary/20 shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="h-5 w-5 text-primary" />
                تفاصيل الطلب
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {order.payment_status && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">حالة الدفع</div>
                  <div className="font-bold text-foreground">
                    {order.payment_status === 'paid' ? 'مدفوع' : 
                     order.payment_status === 'partial' ? 'مدفوع جزئياً' :
                     order.payment_status === 'refunded' ? 'مسترجع' : 'قيد الانتظار'}
                  </div>
                </div>
              )}
              
              {order.payment_method && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">طريقة الدفع</div>
                  <div className="font-bold text-foreground">
                    {order.payment_method === 'cash' ? 'نقدي' :
                     order.payment_method === 'wallet' ? 'المحفظة' :
                     order.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                     order.payment_method === 'card' ? 'بطاقة' : order.payment_method}
                  </div>
                </div>
              )}

              {Number(order.paid_amount) > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">المبلغ المدفوع</div>
                  <div className="font-bold text-primary">{formatPrice(Number(order.paid_amount))} {order.currency}</div>
                </div>
              )}

              {Number(order.remaining_amount) > 0 && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">المبلغ المتبقي</div>
                  <div className="font-bold text-destructive">{formatPrice(Number(order.remaining_amount))} {order.currency}</div>
                </div>
              )}
              
              {order.shipping_notes && (
                <div>
                  <div className="text-sm text-muted-foreground mb-1">ملاحظات</div>
                  <div className="text-sm text-foreground p-3 bg-muted/50 rounded-lg">
                    {order.shipping_notes}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Products */}
        <Card className="mt-6 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="h-5 w-5 text-primary" />
              المنتجات ({order.order_items?.length || 0})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {order.order_items?.map((item: any) => (
                <div
                  key={item.id}
                  className="flex gap-4 p-4 border border-border/50 rounded-xl bg-card hover:border-primary/30 transition-colors"
                >
                  <div className="flex gap-3">
                    {(item.products?.image_url || (item.products?.images && item.products.images[0])) && (
                      <img
                        src={(item.products?.images && item.products.images[0]) || item.products?.image_url}
                        alt={item.product_name_ar}
                        className="w-20 h-20 object-cover rounded-lg border border-border/40"
                      />
                    )}
                    {item.color_image_url && (
                      <img
                        src={item.color_image_url}
                        alt={`لون ${item.selected_color}`}
                        className="w-20 h-20 object-cover rounded-lg border border-primary/40"
                        title={`لون: ${item.selected_color}`}
                      />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className="font-bold text-lg text-foreground mb-1">{item.product_name_ar}</div>
                    <div className="space-y-1 text-sm text-muted-foreground">
                      {item.selected_option && (
                        <div>الخيار: <span className="text-foreground font-medium">{item.selected_option}</span></div>
                      )}
                      {item.selected_color && (
                        <div className="flex items-center gap-2">
                          اللون: <span className="text-foreground font-medium">{item.selected_color}</span>
                        </div>
                      )}
                      {item.shipping_option_name_ar && (
                        <div>نوع الشحن: <span className="text-foreground font-medium">{item.shipping_option_name_ar}</span></div>
                      )}
                      <div>الكمية: <span className="text-foreground font-medium">{item.quantity}</span></div>
                    </div>
                  </div>
                  <div className="text-left space-y-1">
                    <div className="font-black text-xl text-primary">
                      {formatPrice(Number(item.total_price))}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {formatPrice(Number(item.unit_price))} × {item.quantity}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Order Summary */}
        <Card className="mt-6 border-primary/20 shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CreditCard className="h-5 w-5 text-primary" />
              ملخص الطلب
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex justify-between text-lg">
                <span className="text-muted-foreground">الإجمالي:</span>
                <span className="font-black text-2xl text-primary">
                  {formatPrice(Number(order.total_amount))} {order.currency}
                </span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">العملة:</span>
                <span className="font-medium">{order.currency}</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </main>

      {/* Hidden Invoice for PDF Generation */}
      <div className="hidden">
        <OrderInvoice order={order} />
      </div>
      
      <CustomerChat orderId={orderId} />
    </div>
  );
};

export default OrderDetail;
