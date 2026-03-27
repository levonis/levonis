import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, Calendar, MapPin, Phone, CreditCard, ArrowRight, ShoppingBag, FileText, Printer, Image, File, Download, Ship, Plane, MessageCircle, XCircle, Wallet, Clock, CheckCircle2, Receipt, Hash, Info } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import generatePDF, { Margin, Resolution } from 'react-to-pdf';
import { OrderInvoice } from '@/components/OrderInvoice';
import UnifiedChatButton from '@/components/UnifiedChatButton';
import AdminUserChat from '@/components/AdminUserChat';
import { useState } from 'react';
import { toast } from 'sonner';
import { OrderTimeline } from '@/components/OrderTimeline';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import TaobaoLinkButton from '@/components/admin/TaobaoLinkButton';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { motion } from 'framer-motion';

// Helper function to determine if order is pre-order - uses order_type field first
const checkIfPreOrder = (order: any): boolean => {
  if (order?.order_type === 'direct') return false;
  if (order?.order_type === 'preorder') return true;
  // Fallback: check order items
  const orderItems = order?.order_items;
  if (!orderItems || orderItems.length === 0) return true;
  for (const item of orderItems) {
    if (item.custom_request_id) return true;
    if (item.shipping_option_name_ar && item.shipping_option_name_ar.includes('متاح في المخزون')) continue;
    return true;
  }
  return false;
};

// Glass card wrapper
const GlassCard = ({ children, className = '', delay = 0 }: { children: React.ReactNode; className?: string; delay?: number }) => (
  <motion.div
    initial={{ opacity: 0, y: 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ delay, duration: 0.5, ease: "easeOut" }}
    className={`rounded-2xl border border-border/40 bg-card/50 backdrop-blur-md shadow-[0_8px_32px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)] ${className}`}
  >
    {children}
  </motion.div>
);

const SectionHeader = ({ icon: Icon, title }: { icon: any; title: string }) => (
  <div className="flex items-center gap-2.5 mb-4 px-1">
    <div className="w-9 h-9 rounded-xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-[0_0_12px_hsl(var(--primary)/0.1)]">
      <Icon className="h-4.5 w-4.5 text-primary" />
    </div>
    <h3 className="text-base font-black text-foreground">{title}</h3>
  </div>
);

const InfoRow = ({ label, value, icon: Icon, valueClass = '' }: { label: string; value: string; icon?: any; valueClass?: string }) => (
  <div className="flex items-start gap-3 py-2.5 border-b border-border/20 last:border-0">
    {Icon && <Icon className="h-4 w-4 text-primary/60 mt-0.5 shrink-0" />}
    <div className="flex-1 min-w-0">
      <p className="text-[11px] text-muted-foreground font-medium">{label}</p>
      <p className={`text-sm font-bold mt-0.5 ${valueClass || 'text-foreground'}`}>{value}</p>
    </div>
  </div>
);

const OrderDetail = () => {
  const { orderId } = useParams();
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [showAdminChat, setShowAdminChat] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const queryClient = useQueryClient();
  
  useOrderRealtimeNotifications();

  const canQuery = !!orderId && !authLoading && (!!user || isAdmin);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId, isAdmin, user?.id],
    queryFn: async () => {
      if (!orderId) return null;
      let query = supabase
        .from('orders')
        .select(`*, order_items!order_items_order_id_fkey(*, products!order_items_product_id_fkey(id, name_ar, image_url, images, taobao_url), custom_product_requests(product_name, image_url, suggested_price)), profiles(full_name, email)`)
        .eq('id', orderId);
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
      const invoiceHTML = element?.outerHTML || '';
      const warrantyExpiresAt = new Date();
      warrantyExpiresAt.setFullYear(warrantyExpiresAt.getFullYear() + 1);
      const { data: template } = await supabase.from("invoice_templates").select("id").eq("is_default", true).single();
      await supabase.from("saved_invoices").insert({ order_id: order.id, invoice_html: invoiceHTML, template_id: template?.id || null, warranty_expires_at: warrantyExpiresAt.toISOString(), notes: null });
      const getTargetElement = () => element;
      await generatePDF(getTargetElement, { filename: `invoice-${order.order_number}.pdf`, resolution: Resolution.HIGH, page: { margin: Margin.SMALL, format: 'A4', orientation: 'portrait' }, canvas: { mimeType: 'image/jpeg', qualityRatio: 0.98 } });
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
    if (!printWindow) { toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة'); return; }
    printWindow.document.write(`<!DOCTYPE html><html dir="rtl" lang="ar"><head><meta charset="UTF-8"><title>فاتورة - ${order?.order_number}</title><style>* { box-sizing: border-box; margin: 0; padding: 0; } body { font-family: 'Cairo', Arial, sans-serif; direction: rtl; padding: 20px; } @media print { body { padding: 0; } } table { width: 100%; border-collapse: collapse; }</style></head><body>${printContents.outerHTML}</body></html>`);
    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => { printWindow.print(); printWindow.close(); }, 500);
  };

  const handleCancelOrder = async () => {
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    try {
      const cancelledBy = isAdmin ? 'admin' : 'customer';
      const { data: result, error } = await supabase.rpc('cancel_order', { p_order_id: orderId, p_cancelled_by: cancelledBy });
      if (error) throw error;
      const res = result as any;
      if (!res?.success) { toast.error(res?.error || 'حدث خطأ أثناء إلغاء الطلب'); return; }
      try {
        await supabase.functions.invoke('send-telegram-notification', {
          body: { message: `❌ <b>تم إلغاء طلب</b>\\n\\n📋 رقم الطلب: ${res.order_number}\\n📦 نوع الطلب: ${res.order_type === 'direct' ? 'بيع مباشر' : 'حجز مسبق'}\\n🔄 تم الإلغاء بواسطة: ${cancelledBy === 'admin' ? 'الإدارة' : 'الزبون'}\\n${res.refunded_amount > 0 ? `💰 المبلغ المسترد: ${Number(res.refunded_amount).toLocaleString()} د.ع\\n` : ''}${res.order_type === 'direct' ? '📦 تم إرجاع المنتجات إلى المخزون' : ''}` }
        });
      } catch (e) { console.error('Telegram error:', e); }
      toast.success('تم إلغاء الطلب بنجاح' + (res.refunded_amount > 0 ? ` وتم استرداد ${Number(res.refunded_amount).toLocaleString()} د.ع` : ''));
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
    } catch (error) {
      console.error('Cancel order error:', error);
      toast.error('حدث خطأ أثناء إلغاء الطلب');
    } finally { setIsCancelling(false); setShowCancelDialog(false); }
  };

  const canCancelOrder = (order: any) => {
    if (!order || order.status === 'cancelled' || order.status === 'delivered' || order.status === 'shipped' || order.status === 'arrived_iraq') return false;
    if (isAdmin) return true;
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation <= 1) return true;
    return order.status === 'pending' || order.status === 'confirmed';
  };

  const getStatusConfig = (status: string) => {
    const map: Record<string, { label: string; color: string; bg: string; border: string }> = {
      pending: { label: 'قيد الانتظار', color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
      confirmed: { label: 'تم التأكيد', color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
      processing: { label: 'قيد التجهيز', color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
      purchased: { label: 'تم الشراء', color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
      arrived_warehouse: { label: 'وصل المخزن', color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
      shipped: { label: 'تم الشحن', color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
      arrived_iraq: { label: 'وصل العراق', color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
      on_the_way: { label: 'في الطريق', color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
      delivered: { label: 'تم التوصيل', color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
      cancelled: { label: 'ملغي', color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
    };
    return map[status] || { label: status, color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border' };
  };

  if (!canQuery || isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center">
            <Loader2 className="h-6 w-6 animate-spin text-primary" />
          </div>
          <p className="text-sm text-muted-foreground font-medium">جاري تحميل تفاصيل الطلب...</p>
        </div>
      </div>
    );
  }

  if (!order && !isLoading && !authLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm flex items-center justify-center p-4">
        <GlassCard className="max-w-sm w-full p-8 text-center">
          <div className="w-16 h-16 rounded-2xl bg-muted/30 flex items-center justify-center mx-auto mb-4">
            <Package className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-xl font-black text-foreground mb-2">الطلب غير موجود</h3>
          <p className="text-sm text-muted-foreground mb-6">لم نتمكن من العثور على هذا الطلب</p>
          <Button onClick={() => navigate(isAdmin ? ADMIN_ROUTES.orders : '/my-orders')} className="w-full">
            <ArrowRight className="ml-2 h-4 w-4" />
            {isAdmin ? 'العودة إلى لوحة الطلبات' : 'العودة إلى طلباتي'}
          </Button>
        </GlassCard>
      </div>
    );
  }

  const statusConfig = getStatusConfig(order.status);
  const isPreOrder = checkIfPreOrder(order);
  const shippingItem = order.order_items?.find((item: any) => item.shipping_option_name_ar);
  const shippingOptionName = shippingItem?.shipping_option_name_ar || '';
  const isFastShipping = shippingOptionName.includes('سريع') || shippingOptionName.includes('جوي');

  return (
    <div className="min-h-screen bg-background relative" dir="rtl">
      <main className="container mx-auto px-4 py-6 pb-32 max-w-2xl space-y-4">
        
        {/* Back Button */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
          <Button 
            variant="ghost" 
            size="sm"
            onClick={() => navigate(isAdmin ? ADMIN_ROUTES.orders : '/my-orders')}
            className="hover:bg-primary/10 -mr-2"
          >
            <ArrowRight className="ml-1 h-4 w-4" />
            {isAdmin ? 'لوحة الطلبات' : 'طلباتي'}
          </Button>
        </motion.div>

        {/* Hero Header Card */}
        <GlassCard className="p-5 relative overflow-hidden" delay={0.05}>
          {/* Decorative gradient */}
          <div className="absolute inset-0 bg-gradient-to-bl from-primary/5 via-transparent to-transparent pointer-events-none" />
          
          <div className="relative">
            {/* Order number + Status */}
            <div className="flex items-start justify-between gap-3 mb-4">
              <div>
                <p className="text-[11px] text-muted-foreground font-medium mb-1 flex items-center gap-1">
                  <Hash className="h-3 w-3" /> رقم الطلب
                </p>
                <h1 className="text-2xl font-black text-foreground tracking-tight">
                  {order.order_number}
                </h1>
              </div>
              <div className={`px-3 py-1.5 rounded-xl text-xs font-black border ${statusConfig.bg} ${statusConfig.color} ${statusConfig.border}`}>
                {statusConfig.label}
              </div>
            </div>

            {/* Type + Shipping badges */}
            <div className="flex flex-wrap gap-2 mb-4">
              <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                isPreOrder 
                  ? 'bg-amber-500/10 text-amber-600 border-amber-500/20 dark:text-amber-400' 
                  : 'bg-emerald-500/10 text-emerald-600 border-emerald-500/20 dark:text-emerald-400'
              }`}>
                <ShoppingBag className="h-3 w-3" />
                {isPreOrder ? 'طلب مسبق' : 'بيع مباشر'}
              </div>
              {isPreOrder && shippingOptionName && (
                <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border ${
                  isFastShipping ? 'bg-amber-500/10 text-amber-600 border-amber-500/20' : 'bg-blue-500/10 text-blue-600 border-blue-500/20'
                }`}>
                  {isFastShipping ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                  {shippingOptionName}
                </div>
              )}
            </div>

            {/* Date */}
            <p className="text-[11px] text-muted-foreground flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {format(new Date(order.created_at), 'PPP - p', { locale: ar })}
            </p>
          </div>
        </GlassCard>

        {/* Action Buttons */}
        {(canCancelOrder(order) || (order.status === 'arrived_warehouse' || order.status === 'shipped' || order.status === 'arrived_iraq' || order.status === 'delivered') || (isAdmin)) && (
          <GlassCard className="p-3" delay={0.1}>
            <div className="flex flex-wrap gap-2">
              {(order.status === 'arrived_warehouse' || order.status === 'shipped' || order.status === 'arrived_iraq' || order.status === 'delivered') && (
                <>
                  <Button onClick={handleDirectPrint} variant="outline" size="sm" className="flex-1 min-w-[120px]">
                    <Printer className="ml-1.5 h-3.5 w-3.5" />
                    طباعة
                  </Button>
                  <Button onClick={handleDownloadPDF} disabled={isGeneratingPDF} size="sm" className="flex-1 min-w-[120px]">
                    {isGeneratingPDF ? <Loader2 className="ml-1.5 h-3.5 w-3.5 animate-spin" /> : <FileText className="ml-1.5 h-3.5 w-3.5" />}
                    تحميل PDF
                  </Button>
                </>
              )}
              {isAdmin && (
                <Button onClick={() => setShowAdminChat(true)} variant="outline" size="sm" className="flex-1 min-w-[120px]">
                  <MessageCircle className="ml-1.5 h-3.5 w-3.5" />
                  التواصل
                </Button>
              )}
              {canCancelOrder(order) && (
                <Button variant="destructive" size="sm" onClick={() => setShowCancelDialog(true)} disabled={isCancelling} className="flex-1 min-w-[120px]">
                  {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" /> : <XCircle className="h-3.5 w-3.5 ml-1.5" />}
                  إلغاء الطلب
                </Button>
              )}
            </div>
          </GlassCard>
        )}

        {/* Delivery Confirmation */}
        {!isAdmin && order.status === 'delivered' && !order.user_confirmed_delivery && !order.auto_confirmed && (
          <GlassCard className="p-5 border-emerald-500/30" delay={0.15}>
            <div className="text-center space-y-3">
              <div className="w-14 h-14 rounded-2xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center mx-auto">
                <CheckCircle2 className="h-7 w-7 text-emerald-500" />
              </div>
              <h3 className="text-lg font-black text-foreground">هل استلمت طلبك؟</h3>
              <p className="text-xs text-muted-foreground">يرجى تأكيد الاستلام وتقييم المنتجات</p>
              <Button onClick={() => navigate(`/my-orders/${order.id}/confirm`)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                تأكيد الاستلام وتقييم المنتج
              </Button>
              <p className="text-[10px] text-muted-foreground">سيتم التأكيد تلقائياً بعد 7 أيام</p>
            </div>
          </GlassCard>
        )}

        {(order.user_confirmed_delivery || order.auto_confirmed) && (
          <GlassCard className="p-4" delay={0.15}>
            <div className="flex items-center justify-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-bold text-sm">تم تأكيد الاستلام</span>
              {order.auto_confirmed && <span className="text-xs text-muted-foreground">(تلقائياً)</span>}
            </div>
            {order.user_confirmed_at && (
              <p className="text-center text-[11px] text-muted-foreground mt-1">
                {format(new Date(order.user_confirmed_at), 'PPP - p', { locale: ar })}
              </p>
            )}
          </GlassCard>
        )}

        {/* Order Timeline */}
        <GlassCard className="p-5" delay={0.2}>
          <SectionHeader icon={Truck} title="مراحل الطلب" />
          <OrderTimeline order={order} isPreOrder={isPreOrder} />
        </GlassCard>

        {/* Products */}
        <GlassCard className="p-5" delay={0.25}>
          <SectionHeader icon={Package} title={`المنتجات (${order.order_items?.length || 0})`} />
          <div className="space-y-3">
            {order.order_items?.map((item: any, index: number) => {
              const isCustomRequest = !!item.custom_request_id;
              const imageUrl = isCustomRequest 
                ? item.custom_product_requests?.image_url 
                : (item.products?.images?.[0] || item.products?.image_url);
              const productName = isCustomRequest
                ? item.custom_product_requests?.product_name || item.product_name_ar
                : item.product_name_ar;
              
              return (
                <motion.div
                  key={item.id}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 + index * 0.06 }}
                  className="rounded-xl border border-border/30 bg-card/30 backdrop-blur-sm p-3 hover:border-primary/20 transition-all duration-300"
                >
                  <div className="flex gap-3">
                    {/* Images */}
                    <div className="flex gap-2 shrink-0">
                      {imageUrl && (
                        <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-border/30 shadow-sm">
                          <img src={imageUrl} alt={productName} className="w-full h-full object-cover" />
                        </div>
                      )}
                      {item.color_image_url && (
                        <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-primary/30 shadow-sm">
                          <img src={item.color_image_url} alt={`لون ${item.selected_color}`} className="w-full h-full object-cover" />
                        </div>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground leading-tight truncate flex items-center gap-1.5">
                            {productName}
                            {isCustomRequest && (
                              <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">خاص</span>
                            )}
                          </h4>
                          {isAdmin && !isCustomRequest && item.products?.taobao_url && (
                            <TaobaoLinkButton taobaoUrl={item.products.taobao_url} />
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          <p className="font-black text-base text-primary">{formatPrice(Number(item.total_price))}</p>
                          <p className="text-[10px] text-muted-foreground">{formatPrice(Number(item.unit_price))} × {item.quantity}</p>
                        </div>
                      </div>
                      
                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {item.selected_option && (
                          <span className="text-[11px] text-muted-foreground">
                            الخيار: <span className="text-foreground font-medium">{item.selected_option}</span>
                          </span>
                        )}
                        {item.selected_color && (
                          <span className="text-[11px] text-muted-foreground">
                            اللون: <span className="text-foreground font-medium">{item.selected_color}</span>
                          </span>
                        )}
                        {item.shipping_option_name_ar && (
                          <span className="text-[11px] text-muted-foreground">
                            الشحن: <span className="text-foreground font-medium">{item.shipping_option_name_ar}</span>
                          </span>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          الكمية: <span className="text-foreground font-medium">{item.quantity}</span>
                        </span>
                      </div>
                    </div>
                  </div>
                </motion.div>
              );
            })}
          </div>
        </GlassCard>

        {/* Shipping & Payment Info - 2 cards side by side on desktop */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Shipping */}
          <GlassCard className="p-5" delay={0.3}>
            <SectionHeader icon={MapPin} title="معلومات الشحن" />
            <div className="space-y-0">
              <InfoRow icon={MapPin} label="العنوان" value={order.shipping_address} />
              <InfoRow icon={MapPin} label="المحافظة" value={order.governorate} />
              <InfoRow icon={Phone} label="رقم الهاتف" value={order.phone_number} />
            </div>
          </GlassCard>

          {/* Payment */}
          <GlassCard className="p-5" delay={0.35}>
            <SectionHeader icon={Wallet} title="معلومات الدفع" />
            <div className="space-y-0">
              {order.payment_status && (
                <InfoRow icon={Info} label="حالة الدفع" value={
                  order.payment_status === 'paid' ? 'مدفوع' : 
                  order.payment_status === 'partial' ? 'مدفوع جزئياً' :
                  order.payment_status === 'refunded' ? 'مسترجع' : 'قيد الانتظار'
                } />
              )}
              {order.payment_method && (
                <InfoRow icon={CreditCard} label="طريقة الدفع" value={
                  order.payment_method === 'cash' ? 'نقدي' :
                  order.payment_method === 'wallet' ? 'المحفظة' :
                  order.payment_method === 'bank_transfer' ? 'تحويل بنكي' :
                  order.payment_method === 'card' ? 'بطاقة' : order.payment_method
                } />
              )}
              {Number(order.paid_amount) > 0 && (
                <InfoRow icon={CheckCircle2} label="المبلغ المدفوع" value={`${formatPrice(Number(order.paid_amount))} ${order.currency}`} valueClass="text-primary" />
              )}
              {Number(order.remaining_amount) > 0 && (
                <InfoRow icon={Clock} label="المبلغ المتبقي" value={`${formatPrice(Number(order.remaining_amount))} ${order.currency}`} valueClass="text-destructive" />
              )}
            </div>
          </GlassCard>
        </div>

        {/* Notes */}
        {order.shipping_notes && (
          <GlassCard className="p-5" delay={0.38}>
            <SectionHeader icon={Info} title="ملاحظات" />
            <p className="text-sm text-foreground bg-muted/20 rounded-xl p-3 border border-border/20">{order.shipping_notes}</p>
          </GlassCard>
        )}

        {/* Order Summary */}
        <GlassCard className="p-5" delay={0.4}>
          <SectionHeader icon={Receipt} title="ملخص الطلب" />
          <div className="space-y-2.5">
            {Number(order.subtotal) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المبلغ الفرعي</span>
                <span className="font-medium">{formatPrice(Number(order.subtotal))} {order.currency}</span>
              </div>
            )}
            {Number(order.tax_amount) > 0 && (
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">الضريبة ({order.tax_percentage || 0}%)</span>
                <span className="font-medium">{formatPrice(Number(order.tax_amount))} {order.currency}</span>
              </div>
            )}
            {Number(order.discount_amount) > 0 && (
              <div className="flex justify-between text-sm text-emerald-500">
                <span>الخصم</span>
                <span className="font-medium">-{formatPrice(Number(order.discount_amount))} {order.currency}</span>
              </div>
            )}
            <div className="h-px bg-border/30 my-1" />
            <div className="flex justify-between items-center">
              <span className="text-sm text-muted-foreground font-bold">الإجمالي</span>
              <span className="font-black text-2xl text-primary">
                {formatPrice(Number(order.total_amount))} <span className="text-sm font-bold">{order.currency}</span>
              </span>
            </div>
          </div>
        </GlassCard>

        {/* Additional Images and Files */}
        {((order.admin_images && order.admin_images.length > 0) || (order.admin_files && order.admin_files.length > 0)) && (
          <GlassCard className="p-5" delay={0.45}>
            <SectionHeader icon={Image} title="صور وملفات إضافية" />
            {order.admin_images && order.admin_images.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">الصور</p>
                <div className="grid grid-cols-3 gap-2">
                  {order.admin_images.map((imageUrl: string, index: number) => (
                    <a key={index} href={imageUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-border/30 hover:border-primary/40 transition-colors shadow-sm">
                      <img src={imageUrl} alt={`صورة ${index + 1}`} className="w-full h-full object-cover" />
                    </a>
                  ))}
                </div>
              </div>
            )}
            {order.admin_files && order.admin_files.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">الملفات</p>
                <div className="space-y-2">
                  {order.admin_files.map((fileUrl: string, index: number) => {
                    const fileName = fileUrl.split('/').pop() || `ملف ${index + 1}`;
                    return (
                      <a key={index} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20 hover:border-primary/30 transition-colors">
                        <File className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{fileName}</span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </a>
                    );
                  })}
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </main>

      {/* Hidden Invoice */}
      <div className="hidden"><OrderInvoice order={order} /></div>
      
      {!isAdmin && <UnifiedChatButton />}
      
      {isAdmin && order && (
        <AdminUserChat userId={order.user_id} orderId={orderId} open={showAdminChat} onOpenChange={setShowAdminChat} userName={order.profiles?.full_name || 'العميل'} />
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent dir="rtl" className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              إلغاء الطلب
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>هل أنت متأكد من إلغاء الطلب رقم <strong>#{order?.order_number}</strong>؟</p>
              {order?.order_type === 'direct' && <p className="text-muted-foreground text-xs">📦 سيتم إرجاع المنتجات إلى المخزون</p>}
              {order?.paid_amount > 0 && order?.payment_status !== 'cod' && <p className="text-muted-foreground text-xs">💰 سيتم استرداد {formatPrice(order.paid_amount)} د.ع إلى محفظتك</p>}
              <p className="text-destructive text-xs font-bold">⚠️ لا يمكن التراجع عن هذا الإجراء</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>تراجع</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isCancelling}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              تأكيد الإلغاء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderDetail;
