import { SignedImage, SignedLink } from '@/components/media/SignedImage';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useOrderRealtimeNotifications } from '@/hooks/useOrderRealtimeNotifications';
import { useNavigate, useParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, Package, Truck, Calendar, MapPin, Phone, CreditCard, ArrowRight, ShoppingBag, FileText, Printer, Image, File, Download, Ship, Plane, MessageCircle, XCircle, Wallet, Clock, CheckCircle2, Receipt, Hash, Info, Sparkles, Copy, Check } from 'lucide-react';
import WavyColors from '@/components/WavyColors';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';

import OrderInvoiceDialog from '@/components/OrderInvoiceDialog';
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

// Copy button for order number
function OrderNumberCopyButton({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={() => {
        navigator.clipboard.writeText(orderNumber);
        setCopied(true);
        toast.success('تم نسخ رقم الطلب');
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center h-6 w-6 rounded-md hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="نسخ رقم الطلب"
    >
      {copied ? <Check className="h-3.5 w-3.5 text-emerald-600" /> : <Copy className="h-3.5 w-3.5" />}
    </button>
  );
}

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

const ORDER_DETAIL_SELECT = `
  id, user_id, order_number, status, total_amount, currency, shipping_address,
  phone_number, governorate, shipping_notes, created_at, updated_at, shipped_at,
  delivered_at, serial_number_image_url, arrived_warehouse_at, arrived_iraq_at,
  user_confirmed_delivery, user_confirmed_at, auto_confirmed, admin_images, admin_files,
  estimated_delivery_date, actual_weight, package_dimensions, customs_declaration_number,
  priority, payment_status, payment_method, subtotal, tax_amount, tax_percentage,
  discount_amount, paid_amount, remaining_amount, shipping_route_type,
  shipping_duration_days, shipping_route_waypoints, confirmed_at, processing_at,
  purchased_at, on_the_way_at, cancelled_at, order_type, stock_deducted,
  delivery_method, card_discount_amount, card_discount_level_name,
  cod_fee, customer_paid_amount,
  points_redeemed, points_discount_amount, points_earned,
  referral_coupon_id, referral_owner_earnings_iqd,
  order_items!order_items_order_id_fkey(
    id, order_id, product_id, product_option_id, product_name, product_name_ar,
    selected_option, selected_color, quantity, unit_price, total_price, created_at,
    shipping_option_name_ar, shipping_price_adjustment, color_image_url, custom_request_id,
    serial_number, customer_notes, bundle_id, is_gift, rf_offer_id,
    products!order_items_product_id_fkey(id, name_ar, image_url, images, taobao_url),
    custom_product_requests(product_name, image_url, suggested_price),
    random_filament_offers!order_items_rf_offer_id_fkey(id, title_ar, description_ar, image_url)
  )
`;

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
  const { t, language, dir } = useLanguage();
  const [showAdminChat, setShowAdminChat] = useState(false);
  const [showCancelDialog, setShowCancelDialog] = useState(false);
  const [isCancelling, setIsCancelling] = useState(false);
  const [showInvoice, setShowInvoice] = useState(false);
  const queryClient = useQueryClient();
  const dateLocale = language === 'ar' || language === 'ku' ? ar : enUS;

  useOrderRealtimeNotifications();

  const canQuery = !!orderId && !authLoading && (!!user || isAdmin);

  const { data: order, isLoading } = useQuery({
    queryKey: ['order-detail', orderId, isAdmin, user?.id],
    queryFn: async () => {
      if (!orderId) return null;
      let query = supabase
        .from('orders')
        .select(ORDER_DETAIL_SELECT)
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

  const { data: rfRows } = useQuery({
    queryKey: ['order-rf-rows', orderId],
    queryFn: async () => {
      if (!orderId) return [] as any[];
      const { data } = await (supabase as any)
        .from('random_filament_orders')
        .select('id, product_id, product_option_id, selected_color, revealed_at, sale_type')
        .eq('order_id', orderId);
      return (data || []) as any[];
    },
    enabled: !!orderId,
  });

  const { data: customerProfile } = useQuery({
    queryKey: ['order-customer-profile', (order as any)?.user_id, isAdmin],
    queryFn: async () => {
      const uid = (order as any)?.user_id;
      if (!uid) return null;
      const { data } = await supabase.from('profiles').select('full_name, email').eq('id', uid).maybeSingle();
      return data;
    },
    enabled: !!isAdmin && !!(order as any)?.user_id,
  });

  const hasRandomFilament = (rfRows?.length || 0) > 0;
  // Build a key -> rf row map for per-item lookups
  const rfByKey = new Map<string, any>();
  (rfRows || []).forEach((r: any) => {
    const k = `${r.product_id || ''}_${r.product_option_id || ''}`;
    rfByKey.set(k, r);
  });

  const handleCancelOrder = async () => {
    if (!orderId || isCancelling) return;
    setIsCancelling(true);
    try {
      const cancelledBy = isAdmin ? 'admin' : 'customer';
      const { data: result, error } = await supabase.rpc('cancel_order', { p_order_id: orderId, p_cancelled_by: cancelledBy });
      if (error) throw error;
      const res = result as any;
      if (!res?.success) { toast.error(res?.error || t('od_toast_cancel_error')); return; }
      try {
        await supabase.functions.invoke('send-telegram-notification', {
          body: { message: `❌ <b>تم إلغاء طلب</b>\n\n📋 رقم الطلب: ${res.order_number}\n📦 نوع الطلب: ${res.order_type === 'direct' ? 'بيع مباشر' : 'حجز مسبق'}\n🔄 تم الإلغاء بواسطة: ${cancelledBy === 'admin' ? 'الإدارة' : 'الزبون'}\n${res.refunded_amount > 0 ? `💰 المبلغ المسترد: ${Number(res.refunded_amount).toLocaleString()} د.ع\n` : ''}${res.order_type === 'direct' ? '📦 تم إرجاع المنتجات إلى المخزون' : ''}` }
        });
      } catch (e) { console.error('Telegram error:', e); }
      toast.success(t('od_toast_cancel_success') + (res.refunded_amount > 0 ? ` ${t('od_toast_refunded_suffix')} ${Number(res.refunded_amount).toLocaleString()} د.ع` : ''));
      queryClient.invalidateQueries({ queryKey: ['order-detail', orderId] });
    } catch (error: any) {
      console.error('Cancel order error:', error);
      const msg = String(error?.message || '');
      if (msg.includes('RANDOM_FILAMENT_ORDER_LOCKED')) {
        toast.error('لا يمكن إلغاء طلب يحتوي على فلمنت عشوائي');
      } else {
        toast.error(t('od_toast_cancel_error'));
      }
    } finally { setIsCancelling(false); setShowCancelDialog(false); }
  };

  const canCancelOrder = (order: any) => {
    if (!order || order.status === 'cancelled' || order.status === 'delivered' || order.status === 'shipped' || order.status === 'arrived_iraq') return false;
    if (isAdmin) return true;
    // Allow cancel only if no RF row has been revealed (paid from wallet)
    const hasRevealedRF = (rfRows || []).some((r: any) => !!r.revealed_at);
    if (hasRevealedRF) return false;
    const createdAt = new Date(order.created_at);
    const now = new Date();
    const hoursSinceCreation = (now.getTime() - createdAt.getTime()) / (1000 * 60 * 60);
    if (hoursSinceCreation <= 1) return true;
    return order.status === 'pending' || order.status === 'confirmed';
  };

  const getStatusConfig = (status: string) => {
    const labels: Record<string, string> = {
      pending: t('order_status_pending'),
      confirmed: t('order_status_confirmed'),
      processing: t('order_status_processing'),
      purchased: t('order_status_purchased'),
      arrived_warehouse: t('order_status_arrived_warehouse'),
      shipped: t('order_status_shipped'),
      arrived_iraq: t('order_status_arrived_iraq'),
      on_the_way: t('order_status_on_the_way'),
      delivered: t('order_status_delivered'),
      cancelled: t('order_status_cancelled'),
    };
    const colorMap: Record<string, { color: string; bg: string; border: string }> = {
      pending: { color: 'text-amber-500', bg: 'bg-amber-500/10', border: 'border-amber-500/30' },
      confirmed: { color: 'text-blue-500', bg: 'bg-blue-500/10', border: 'border-blue-500/30' },
      processing: { color: 'text-purple-500', bg: 'bg-purple-500/10', border: 'border-purple-500/30' },
      purchased: { color: 'text-indigo-500', bg: 'bg-indigo-500/10', border: 'border-indigo-500/30' },
      arrived_warehouse: { color: 'text-cyan-500', bg: 'bg-cyan-500/10', border: 'border-cyan-500/30' },
      shipped: { color: 'text-sky-500', bg: 'bg-sky-500/10', border: 'border-sky-500/30' },
      arrived_iraq: { color: 'text-teal-500', bg: 'bg-teal-500/10', border: 'border-teal-500/30' },
      on_the_way: { color: 'text-primary', bg: 'bg-primary/10', border: 'border-primary/30' },
      delivered: { color: 'text-emerald-500', bg: 'bg-emerald-500/10', border: 'border-emerald-500/30' },
      cancelled: { color: 'text-destructive', bg: 'bg-destructive/10', border: 'border-destructive/30' },
    };
    const c = colorMap[status] || { color: 'text-muted-foreground', bg: 'bg-muted/10', border: 'border-border' };
    return { label: labels[status] || status, ...c };
  };

  if (!canQuery || isLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-12 h-12 rounded-2xl bg-muted animate-pulse" />
            <div className="space-y-2"><div className="h-5 w-32 rounded bg-muted animate-pulse" /><div className="h-3 w-48 rounded bg-muted animate-pulse" /></div>
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-3">
            {[1,2,3].map(i=><div key={i} className="flex items-center gap-3"><div className="w-14 h-14 rounded-lg bg-muted animate-pulse shrink-0" /><div className="flex-1 space-y-2"><div className="h-4 w-3/4 rounded bg-muted animate-pulse" /><div className="h-3 w-1/3 rounded bg-muted animate-pulse" /></div></div>)}
          </div>
          <div className="rounded-lg border bg-card p-4 space-y-2">
            <div className="h-4 w-24 rounded bg-muted animate-pulse" />
            <div className="h-4 w-32 rounded bg-muted animate-pulse" />
            <div className="h-4 w-28 rounded bg-muted animate-pulse" />
          </div>
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
          <h3 className="text-xl font-black text-foreground mb-2">{t('od_not_found_title')}</h3>
          <p className="text-sm text-muted-foreground mb-6">{t('od_not_found_desc')}</p>
          <Button onClick={() => navigate(isAdmin ? ADMIN_ROUTES.orders : '/my-orders')} className="w-full">
            <ArrowRight className="ml-2 h-4 w-4" />
            {isAdmin ? t('od_back_to_orders_admin') : t('od_back_to_orders_user')}
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
    <div className="min-h-screen bg-background relative" dir={dir}>
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
            {isAdmin ? t('od_back_to_panel') : t('od_back_to_my_orders')}
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
                  <Hash className="h-3 w-3" /> {t('od_order_number_label')}
                </p>
                <div className="flex items-center gap-2">
                  <h1 className="text-2xl font-black text-foreground tracking-tight">
                    {order.order_number}
                  </h1>
                  <OrderNumberCopyButton orderNumber={order.order_number} />
                </div>
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
                {isPreOrder ? t('od_type_preorder') : t('od_type_direct')}
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
              {format(new Date(order.created_at), 'PPP - p', { locale: dateLocale })}
            </p>
          </div>
        </GlassCard>

        {/* Action Buttons */}
        {(canCancelOrder(order) || (order.status === 'arrived_warehouse' || order.status === 'shipped' || order.status === 'arrived_iraq' || order.status === 'delivered') || (isAdmin)) && (
          <GlassCard className="p-3" delay={0.1}>
            <div className="flex flex-wrap gap-2">
              {(order.status === 'arrived_warehouse' || order.status === 'shipped' || order.status === 'arrived_iraq' || order.status === 'delivered') && (
                <Button onClick={() => setShowInvoice(true)} size="sm" className="flex-1 min-w-[120px]">
                  <FileText className="ml-1.5 h-3.5 w-3.5" />
                  {t('od_btn_invoice')}
                </Button>
              )}
              {isAdmin && (
                <Button onClick={() => setShowAdminChat(true)} variant="outline" size="sm" className="flex-1 min-w-[120px]">
                  <MessageCircle className="ml-1.5 h-3.5 w-3.5" />
                  {t('od_btn_contact')}
                </Button>
              )}
              {canCancelOrder(order) && (
                <Button variant="destructive" size="sm" onClick={() => setShowCancelDialog(true)} disabled={isCancelling} className="flex-1 min-w-[120px]">
                  {isCancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin ml-1.5" /> : <XCircle className="h-3.5 w-3.5 ml-1.5" />}
                  {t('od_btn_cancel')}
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
              <h3 className="text-lg font-black text-foreground">{t('od_received_question')}</h3>
              <p className="text-xs text-muted-foreground">{t('od_received_subtitle')}</p>
              <Button onClick={() => navigate(`/my-orders/${order.id}/confirm`)} className="w-full bg-emerald-600 hover:bg-emerald-700 text-white">
                {t('od_confirm_receive_btn')}
              </Button>
              <p className="text-[10px] text-muted-foreground">{t('od_auto_confirm_note')}</p>
            </div>
          </GlassCard>
        )}

        {(order.user_confirmed_delivery || order.auto_confirmed) && (
          <GlassCard className="p-4" delay={0.15}>
            <div className="flex items-center justify-center gap-2 text-emerald-500">
              <CheckCircle2 className="h-4 w-4" />
              <span className="font-bold text-sm">{t('od_received_confirmed')}</span>
              {order.auto_confirmed && <span className="text-xs text-muted-foreground">{t('od_received_auto')}</span>}
            </div>
            {order.user_confirmed_at && (
              <p className="text-center text-[11px] text-muted-foreground mt-1">
                {format(new Date(order.user_confirmed_at), 'PPP - p', { locale: dateLocale })}
              </p>
            )}
          </GlassCard>
        )}

        {/* Order Timeline */}
        <GlassCard className="p-5" delay={0.2}>
          <SectionHeader icon={Truck} title={t('od_section_timeline')} />
          <OrderTimeline order={order} isPreOrder={isPreOrder} />
        </GlassCard>

        {/* Products */}
        <GlassCard className="p-5" delay={0.25}>
          <SectionHeader icon={Package} title={`${t('od_section_products')} (${order.order_items?.length || 0})`} />
          <div className="space-y-3">
            {order.order_items?.map((item: any, index: number) => {
              const isCustomRequest = !!item.custom_request_id;
              const rfRow = rfByKey.get(`${item.product_id || ''}_${item.product_option_id || ''}`);
              const isRandomFilament = !!rfRow;
              const isRevealed = !!rfRow?.revealed_at;
              // Non-admin user sees the mystery image until reveal (after delivery or full wallet payment)
              const hideRfDetails = isRandomFilament && !isRevealed && !isAdmin;
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
                      {hideRfDetails ? (
                        <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-primary/40 shadow-sm relative">
                          <WavyColors seed={item.id} />
                          <div className="absolute inset-0 flex items-center justify-center bg-background/15">
                            <Sparkles className="h-6 w-6 text-white drop-shadow" />
                          </div>
                        </div>
                      ) : (
                        <>
                          {imageUrl && (
                            <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-border/30 shadow-sm">
                              <img src={imageUrl} alt={productName} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            </div>
                          )}
                          {item.color_image_url && (
                            <div className="w-[72px] h-[72px] rounded-xl overflow-hidden border border-primary/30 shadow-sm">
                              <img src={item.color_image_url} alt={`لون ${item.selected_color}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                            </div>
                          )}
                        </>
                      )}
                    </div>
                    
                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="font-bold text-sm text-foreground leading-tight truncate flex items-center gap-1.5">
                            {hideRfDetails ? (
                              <>
                                <Sparkles className="h-3.5 w-3.5 text-primary shrink-0" />
                                فلمنت عشوائي
                                <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">مفاجأة</span>
                              </>
                            ) : (
                              <>
                                {productName}
                                {isRandomFilament && isRevealed && (
                                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 border border-emerald-500/20">عشوائي</span>
                                )}
                                {isCustomRequest && (
                                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-600 border border-amber-500/20">{t('od_badge_custom')}</span>
                                )}
                                {item.is_gift && (
                                  <span className="shrink-0 text-[9px] font-bold px-1.5 py-0.5 rounded bg-primary/10 text-primary border border-primary/20">{t('od_badge_gift')}</span>
                                )}
                              </>
                            )}
                          </h4>
                          {isAdmin && !isCustomRequest && item.products?.taobao_url && (
                            <TaobaoLinkButton taobaoUrl={item.products.taobao_url} />
                          )}
                        </div>
                        <div className="text-left shrink-0">
                          {item.is_gift ? (
                            <p className="font-black text-base text-primary">{t('od_free')}</p>
                          ) : (
                            <>
                              <p className="font-black text-base text-primary">{formatPrice(Number(item.total_price))}</p>
                              <p className="text-[10px] text-muted-foreground">{formatPrice(Number(item.unit_price))} × {item.quantity}</p>
                            </>
                          )}
                        </div>
                      </div>
                      
                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-3 gap-y-1 mt-2">
                        {hideRfDetails ? (
                          <span className="text-[11px] text-muted-foreground italic">
                            سيتم الكشف عن المنتج واللون عند تأكيد التوصيل
                          </span>
                        ) : (
                          <>
                            {item.selected_option && (
                              <span className="text-[11px] text-muted-foreground">
                                {t('od_meta_option')}: <span className="text-foreground font-medium">{item.selected_option}</span>
                              </span>
                            )}
                            {item.selected_color && (
                              <span className="text-[11px] text-muted-foreground">
                                {t('od_meta_color')}: <span className="text-foreground font-medium">{item.selected_color}</span>
                              </span>
                            )}
                            {item.shipping_option_name_ar && (
                              <span className="text-[11px] text-muted-foreground">
                                {t('od_meta_shipping')}: <span className="text-foreground font-medium">{item.shipping_option_name_ar}</span>
                              </span>
                            )}
                          </>
                        )}
                        <span className="text-[11px] text-muted-foreground">
                          {t('od_meta_quantity')}: <span className="text-foreground font-medium">{item.quantity}</span>
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
            <SectionHeader icon={MapPin} title={t('od_section_shipping')} />
            <div className="space-y-0">
              <InfoRow icon={MapPin} label={t('od_label_address')} value={order.shipping_address} />
              <InfoRow icon={MapPin} label={t('od_label_governorate')} value={order.governorate} />
              <InfoRow icon={Phone} label={t('od_label_phone')} value={order.phone_number} />
            </div>
          </GlassCard>

          {/* Payment */}
          <GlassCard className="p-5" delay={0.35}>
            <SectionHeader icon={Wallet} title={t('od_section_payment')} />
            <div className="space-y-0">
              {order.payment_status && (
                <InfoRow icon={Info} label={t('od_label_payment_status')} value={
                  order.payment_status === 'paid' ? t('od_payment_paid') :
                  order.payment_status === 'partial' ? t('od_payment_partial') :
                  order.payment_status === 'refunded' ? t('od_payment_refunded') : t('od_payment_pending')
                } />
              )}
              {order.payment_method && (
                <InfoRow icon={CreditCard} label={t('od_label_payment_method')} value={
                  order.payment_method === 'cash' ? t('od_method_cash') :
                  order.payment_method === 'wallet' ? t('od_method_wallet') :
                  order.payment_method === 'bank_transfer' ? t('od_method_bank') :
                  order.payment_method === 'card' ? t('od_method_card') : order.payment_method
                } />
              )}
              {Number(order.paid_amount) > 0 && (
                <InfoRow icon={CheckCircle2} label={t('od_label_paid_amount')} value={`${formatPrice(Number(order.paid_amount))} ${order.currency}`} valueClass="text-primary" />
              )}
              {Number(order.remaining_amount) > 0 && (
                <InfoRow icon={Clock} label={t('od_label_remaining_amount')} value={`${formatPrice(Number(order.remaining_amount))} ${order.currency}`} valueClass="text-destructive" />
              )}
            </div>
          </GlassCard>
        </div>

        {/* Notes */}
        {order.shipping_notes && (
          <GlassCard className="p-5" delay={0.38}>
            <SectionHeader icon={Info} title={t('od_section_notes')} />
            <p className="text-sm text-foreground bg-muted/20 rounded-xl p-3 border border-border/20">{order.shipping_notes}</p>
          </GlassCard>
        )}

        {/* Order Summary */}
        <GlassCard className="p-5" delay={0.4}>
          <SectionHeader icon={Receipt} title={t('od_section_summary')} />
          {(() => {
            const cur = order.currency;
            const subtotal = Number(order.subtotal) || 0;
            const tax = Number(order.tax_amount) || 0;
            const discount = Number(order.discount_amount) || 0;
            const cardDiscount = Number(order.card_discount_amount) || 0;
            const codFee = Number(order.cod_fee) || 0;
            const walletPaid = Number(order.customer_paid_amount) || Number(order.paid_amount) || 0;
            const remaining = Number(order.remaining_amount) || 0;
            const total = Number(order.total_amount) || 0;
            const shippingAddon = (order.order_items || []).reduce(
              (s: number, it: any) => s + (Number(it.shipping_price_adjustment) || 0) * (Number(it.quantity) || 1),
              0
            );
            const Row = ({ label, value, cls = '' }: { label: string; value: string; cls?: string }) => (
              <div className={`flex justify-between text-sm ${cls}`}>
                <span className="text-muted-foreground">{label}</span>
                <span className="font-medium">{value}</span>
              </div>
            );
            return (
              <div className="space-y-2.5">
                {subtotal > 0 && <Row label={t('od_summary_subtotal')} value={`${formatPrice(subtotal)} ${cur}`} />}
                {shippingAddon > 0 && <Row label="رسوم الشحن / التوصيل" value={`+${formatPrice(shippingAddon)} ${cur}`} />}
                {codFee > 0 && <Row label="رسوم الدفع عند الاستلام" value={`+${formatPrice(codFee)} ${cur}`} />}
                {tax > 0 && <Row label={`${t('od_summary_tax')} (${order.tax_percentage || 0}%)`} value={`${formatPrice(tax)} ${cur}`} />}
                {discount > 0 && (
                  <Row label={t('od_summary_discount')} value={`-${formatPrice(discount)} ${cur}`} cls="text-emerald-500" />
                )}
                {cardDiscount > 0 && (
                  <Row
                    label={`خصم بطاقة ${order.card_discount_level_name || 'الولاء'}`}
                    value={`-${formatPrice(cardDiscount)} ${cur}`}
                    cls="text-emerald-500"
                  />
                )}
                {Number(order.points_discount_amount) > 0 && (
                  <Row
                    label={`خصم النقاط (${Number(order.points_redeemed).toLocaleString()} نقطة)`}
                    value={`-${formatPrice(Number(order.points_discount_amount))} ${cur}`}
                    cls="text-amber-500"
                  />
                )}
                {Number(order.points_earned) > 0 && (
                  <Row
                    label="نقاط مكتسبة من هذا الطلب"
                    value={`+${Number(order.points_earned).toLocaleString()} نقطة`}
                    cls="text-amber-600"
                  />
                )}
                {order.referral_coupon_id && (
                  <Row label="كوبون إحالة مُطبّق" value="✓" cls="text-fuchsia-500" />
                )}

                <div className="h-px bg-border/30 my-1" />
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground font-bold">{t('od_summary_total')}</span>
                  <span className="font-black text-2xl text-primary">
                    {formatPrice(total)} <span className="text-sm font-bold">{cur}</span>
                  </span>
                </div>

                {(walletPaid > 0 || remaining > 0) && (
                  <>
                    <div className="h-px bg-border/30 my-1" />
                    {walletPaid > 0 && (
                      <Row
                        label="مدفوع من المحفظة"
                        value={`${formatPrice(walletPaid)} ${cur}`}
                        cls="text-emerald-600"
                      />
                    )}
                    {remaining > 0 && (
                      <Row
                        label="المتبقي (الدفع عند الاستلام)"
                        value={`${formatPrice(remaining)} ${cur}`}
                        cls="text-amber-600"
                      />
                    )}
                    {remaining <= 0 && walletPaid > 0 && (
                      <Row label="حالة الدفع" value="مدفوع بالكامل ✓" cls="text-emerald-600" />
                    )}
                  </>
                )}
              </div>
            );
          })()}
        </GlassCard>


        {/* Additional Images and Files */}
        {((order.admin_images && order.admin_images.length > 0) || (order.admin_files && order.admin_files.length > 0)) && (
          <GlassCard className="p-5" delay={0.45}>
            <SectionHeader icon={Image} title={t('od_section_extra')} />
            {order.admin_images && order.admin_images.length > 0 && (
              <div className="mb-4">
                <p className="text-xs font-bold text-muted-foreground mb-2">{t('od_extra_images')}</p>
                <div className="grid grid-cols-3 gap-2">
                  {order.admin_images.map((imageUrl: string, index: number) => (
                    <SignedLink key={index} href={imageUrl} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-xl overflow-hidden border border-border/30 hover:border-primary/40 transition-colors shadow-sm">
                      <SignedImage src={imageUrl} alt={`#${index + 1}`} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    </SignedLink>
                  ))}
                </div>
              </div>
            )}
            {order.admin_files && order.admin_files.length > 0 && (
              <div>
                <p className="text-xs font-bold text-muted-foreground mb-2">{t('od_extra_files')}</p>
                <div className="space-y-2">
                  {order.admin_files.map((fileUrl: string, index: number) => {
                    const fileName = fileUrl.split('/').pop() || `#${index + 1}`;
                    return (
                      <SignedLink key={index} href={fileUrl} target="_blank" rel="noopener noreferrer" className="flex items-center gap-3 p-3 rounded-xl bg-muted/20 border border-border/20 hover:border-primary/30 transition-colors">
                        <File className="h-4 w-4 text-primary shrink-0" />
                        <span className="flex-1 text-sm font-medium truncate">{fileName}</span>
                        <Download className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      </SignedLink>
                    );
                  })}
                </div>
              </div>
            )}
          </GlassCard>
        )}
      </main>

      {/* Invoice Dialog */}
      <OrderInvoiceDialog order={order} open={showInvoice} onClose={() => setShowInvoice(false)} />
      
      {!isAdmin && <UnifiedChatButton />}
      
      {isAdmin && order && (
        <AdminUserChat userId={order.user_id} orderId={orderId} open={showAdminChat} onOpenChange={setShowAdminChat} userName={customerProfile?.full_name || t('od_admin_default_customer')} />
      )}

      {/* Cancel Dialog */}
      <AlertDialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
        <AlertDialogContent dir={dir} className="rounded-2xl">
          <AlertDialogHeader>
            <AlertDialogTitle className="text-destructive flex items-center gap-2">
              <XCircle className="h-5 w-5" />
              {t('od_cancel_dialog_title')}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{t('od_cancel_dialog_confirm_q')} <strong>#{order?.order_number}</strong>؟</p>
              {order?.order_type === 'direct' && <p className="text-muted-foreground text-xs">{t('od_cancel_dialog_stock_note')}</p>}
              {order?.paid_amount > 0 && order?.payment_status !== 'cod' && <p className="text-muted-foreground text-xs">{t('od_cancel_dialog_refund_note')} ({formatPrice(order.paid_amount)} د.ع)</p>}
              <p className="text-destructive text-xs font-bold">{t('od_cancel_dialog_irreversible')}</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('od_cancel_dialog_back')}</AlertDialogCancel>
            <AlertDialogAction onClick={handleCancelOrder} className="bg-destructive text-destructive-foreground hover:bg-destructive/90" disabled={isCancelling}>
              {isCancelling ? <Loader2 className="h-4 w-4 animate-spin ml-2" /> : null}
              {t('od_cancel_dialog_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
};

export default OrderDetail;
