import { useState, useEffect, memo, useCallback, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Loader2, Package, Truck, Calendar, Pencil, Search, Trash2, Plus, Upload, X, Ship, Plane, ShoppingBag, Save, Gift, MessageCircle, CheckCircle, Wallet, Copy, Check } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import { useHorizontalWheelScroll } from '@/hooks/useHorizontalWheelScroll';
import AdminCreateOrderDialog from '@/components/admin/AdminCreateOrderDialog';
import LevelBadge from '@/components/LevelBadge';
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { usePagination } from '@/hooks/usePagination';
import { useShippingSettings } from '@/hooks/useShippingCalculator';
import OfferPurchasesTab from '@/components/admin/OfferPurchasesTab';
import AdminOrderChatDialog from '@/components/admin/AdminOrderChatDialog';
import { sendAllNotifications } from '@/lib/notifications';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { calcAutoOrderProductCost } from '@/lib/orderFinancials';
import AdminOrderItemEditor from '@/components/admin/AdminOrderItemEditor';
import { adminCreateOrder, adminUpdateOrder } from '@/lib/adminMutations';
import OrderWalletAuditLog from '@/components/admin/OrderWalletAuditLog';
import { exportToExcel } from '@/lib/exportUtils';

function OrderNumberCopyButton({ orderNumber }: { orderNumber: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        navigator.clipboard.writeText(orderNumber);
        setCopied(true);
        toast.success('تم نسخ رقم الطلب');
        setTimeout(() => setCopied(false), 1500);
      }}
      className="inline-flex items-center justify-center h-5 w-5 rounded hover:bg-muted/60 text-muted-foreground hover:text-foreground transition-colors shrink-0"
      title="نسخ رقم الطلب"
    >
      {copied ? <Check className="h-3 w-3 text-emerald-600" /> : <Copy className="h-3 w-3" />}
    </button>
  );
}

const directStatusOptions = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'processing', label: 'قيد التجهيز' },
  { value: 'on_the_way', label: 'في الطريق إليك' },
  { value: 'delivered', label: 'تم التوصيل' },
  { value: 'cancelled', label: 'ملغي' },
];

const preorderStatusOptions = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'purchased', label: 'تم الشراء' },
  { value: 'arrived_warehouse', label: 'وصل المخزن' },
  { value: 'shipped', label: 'تم الشحن إلى العراق' },
  { value: 'arrived_iraq', label: 'وصل العراق' },
  { value: 'on_the_way', label: 'في الطريق إليك' },
  { value: 'delivered', label: 'تم التوصيل' },
  { value: 'cancelled', label: 'ملغي' },
];

const allStatusOptions = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'processing', label: 'قيد التجهيز' },
  { value: 'purchased', label: 'تم الشراء' },
  { value: 'shipped', label: 'تم الشحن' },
  { value: 'arrived_warehouse', label: 'وصل المخزن' },
  { value: 'arrived_iraq', label: 'وصل العراق' },
  { value: 'on_the_way', label: 'في الطريق إليك' },
  { value: 'delivered', label: 'تم التوصيل' },
  { value: 'cancelled', label: 'ملغي' },
];

const getStatusOptionsForOrder = (order: any, checkFn: (items: any[]) => boolean): typeof allStatusOptions => {
  const orderType = order?.order_type || (checkFn(order?.order_items || []) ? 'preorder' : 'direct');
  return orderType === 'direct' ? directStatusOptions : preorderStatusOptions;
};

const AdminOrders = () => {
  const { user, isAdmin, isAssistant, isAdminOrAssistant, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const ordersTableScrollRef = useHorizontalWheelScroll<HTMLDivElement>();
  const preorderSummaryScrollRef = useRef<HTMLDivElement | null>(null);
  const { data: shippingSettings } = useShippingSettings();
  const usdToIqdRate = shippingSettings?.usd_to_iqd_rate ?? 1500;
  const [activeTab, setActiveTab] = useState('orders');
  const [orderTab, setOrderTab] = useState<'preorder' | 'direct'>('preorder');
  const [preorderShippingTab, setPreorderShippingTab] = useState<'all' | 'sea' | 'air'>('all');
  const [preorderSummaryOpen, setPreorderSummaryOpen] = useState(false);
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedOrderForMessage, setSelectedOrderForMessage] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [searchParams] = useSearchParams();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [serialImageFile, setSerialImageFile] = useState<File | null>(null);
  const [adminImageFiles, setAdminImageFiles] = useState<File[]>([]);
  const [adminFilesArray, setAdminFilesArray] = useState<File[]>([]);
  const [adminImagePreviews, setAdminImagePreviews] = useState<string[]>([]);
  const [existingAdminImages, setExistingAdminImages] = useState<string[]>([]);
  const [existingAdminFiles, setExistingAdminFiles] = useState<string[]>([]);
  const [serialImagePreview, setSerialImagePreview] = useState<string>('');
  const [itemEditorOpen, setItemEditorOpen] = useState(false);
  // Edit form state
  const [editStatus, setEditStatus] = useState('');
  const [editPaymentStatus, setEditPaymentStatus] = useState('');
  const [editInternalNotes, setEditInternalNotes] = useState('');
  const [editShippingNotes, setEditShippingNotes] = useState('');
  const [editEstimatedDeliveryDate, setEditEstimatedDeliveryDate] = useState('');
  
  // Financial fields state for live calculation
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [adminProductCost, setAdminProductCost] = useState<number>(0);
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [taxAmount, setTaxAmount] = useState<number>(0);
  const [subtotalAmount, setSubtotalAmount] = useState<number>(0);
  const [taxPercentage, setTaxPercentage] = useState<number>(0);
  
  // Auto-calculate tax_amount when tax_percentage or subtotal changes
  useEffect(() => {
    if (taxPercentage > 0 && subtotalAmount > 0) {
      const calculatedTax = Math.round((subtotalAmount * taxPercentage) / 100);
      setTaxAmount(calculatedTax);
    }
  }, [taxPercentage, subtotalAmount]);
  
  // Profit = commission from product + stored COD fee when available.
  // Falls back to total - delivery - cost if no commission data.
  const [commissionProfit, setCommissionProfit] = useState(0);
  const calculatedProfit = commissionProfit > 0
    ? commissionProfit
    : (totalAmount - deliveryFee - adminProductCost);
  
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status);
  }, [searchParams]);

  useEffect(() => {
    if (!editingOrder) return;

    const manualProductCost = editingOrder.admin_product_cost || editingOrder.admin_other_costs || 0;
    if (manualProductCost > 0) {
      setAdminProductCost(manualProductCost);
    } else {
      setAdminProductCost(calcAutoOrderProductCost(editingOrder, usdToIqdRate));
    }

    const items = editingOrder.order_items || [];
    const isDirectSale = editingOrder.order_type === 'direct' || items.every((item: any) => (
      !item.custom_request_id &&
      (!item.shipping_option_name_ar || item.shipping_option_name_ar.includes('متاح في المخزون'))
    ));

    if (manualProductCost <= 0) {
      // Compute commission per item based on its shipping type:
      // - Direct sale (in-stock) => commission_direct_iqd
      // - Pre-order Air (سريع/جوي) => commission_air_iqd
      // - Pre-order Sea (default) => commission_sea_iqd, fallback commission_iqd
      const totalCommission = items.reduce((sum: number, item: any) => {
        const p = item.products || {};
        const qty = item.quantity || 1;
        const shipName = item.shipping_option_name_ar || '';
        const isItemDirect = isDirectSale || !shipName || shipName.includes('متاح في المخزون');
        let perUnit = 0;
        if (isItemDirect) {
          perUnit = p.commission_direct_iqd || 0;
        } else if (shipName.includes('سريع') || shipName.includes('جوي')) {
          perUnit = p.commission_air_iqd || p.commission_iqd || 0;
        } else {
          perUnit = p.commission_sea_iqd || p.commission_iqd || 0;
        }
        return sum + perUnit * qty;
      }, 0);

      // For COD orders, the extra amount (orderTotal - productsTotal - delivery) is the COD fee
      // which is pure commission added on top of the product price. Include it in profit.
      const isCod = (editingOrder.payment_method === 'cod') || (editingOrder.payment_status === 'cod');
      let codCommission = Number(editingOrder.cod_fee || 0);
      if (isCod) {
        const productsTotal = items.reduce(
          (s: number, it: any) => s + (Number(it.total_price) || (Number(it.unit_price) || 0) * (Number(it.quantity) || 1)),
          0,
        );
        const orderTotal = Number(editingOrder.total_amount || 0);
        const delivery = Number(editingOrder.delivery_fee || 0);
        codCommission = codCommission > 0 ? codCommission : Math.max(0, orderTotal - productsTotal - delivery);
      }

      setCommissionProfit(totalCommission + codCommission);
    } else {
      setCommissionProfit(0);
    }
  }, [editingOrder, usdToIqdRate]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', isAdminOrAssistant],
    queryFn: async () => {
      // Fetch orders via admin view (includes internal cost/profit columns)
      const { data: ordersData, error: ordersErr } = await supabase
        .from('orders_admin' as any)
        .select('*')
        .order('created_at', { ascending: false });
      if (ordersErr) throw ordersErr;
      const orderIds = (ordersData || []).map((o: any) => o.id);
      if (orderIds.length === 0) return [];

      // Fetch related data via admin views (cost columns are restricted on base tables)
      const [itemsRes, profilesRes, rfRes] = await Promise.all([
        supabase.from('order_items_admin' as any).select('*').in('order_id', orderIds),
        supabase.from('profiles').select('id, full_name, email, username').in('id', Array.from(new Set((ordersData || []).map((o: any) => o.user_id).filter(Boolean)))),
        supabase.from('random_filament_orders').select('id, order_id, sale_type, product_id, product_option_id, selected_color, offer_id, random_filament_offers(title_ar)').in('order_id', orderIds),
      ]);
      if (itemsRes.error) throw itemsRes.error;

      const itemsRaw = ((itemsRes.data as any[]) || []);
      const productIds = Array.from(new Set(itemsRaw.map((it: any) => it.product_id).filter(Boolean)));
      let productMap = new Map<string, any>();
      if (productIds.length > 0) {
        const { data: prodData } = await (supabase as any)
          .from('products_admin')
          .select('id, name_ar, image_url, price_usd, cost_price, other_costs_iqd, shipping_cost_iqd, commission_direct_iqd, commission_air_iqd, commission_sea_iqd, commission_iqd')
          .in('id', productIds);
        ((prodData as any[]) || []).forEach((p) => productMap.set(p.id, p));
      }
      const bundleIds = Array.from(new Set(itemsRaw.map((it: any) => it.bundle_id).filter(Boolean)));
      let bundleMap = new Map<string, any>();
      if (bundleIds.length > 0) {
        const { data: bundleData } = await supabase
          .from('product_bundles')
          .select('id, title_ar, image_url, bundle_items(quantity, products(name_ar, image_url))')
          .in('id', bundleIds);
        ((bundleData as any[]) || []).forEach((b) => bundleMap.set(b.id, b));
      }

      const itemsByOrder = new Map<string, any[]>();
      itemsRaw.forEach((it) => {
        const enriched = { ...it, products: productMap.get(it.product_id) || null, product_bundles: it.bundle_id ? bundleMap.get(it.bundle_id) || null : null };
        const arr = itemsByOrder.get(it.order_id) || [];
        arr.push(enriched); itemsByOrder.set(it.order_id, arr);
      });
      const profileById = new Map<string, any>();
      ((profilesRes.data as any[]) || []).forEach((p) => profileById.set(p.id, p));
      const rfByOrder = new Map<string, any[]>();
      ((rfRes.data as any[]) || []).forEach((r) => {
        const arr = rfByOrder.get(r.order_id) || [];
        arr.push(r); rfByOrder.set(r.order_id, arr);
      });

      return (ordersData || []).map((o: any) => ({
        ...o,
        profiles: profileById.get(o.user_id) || null,
        order_items: itemsByOrder.get(o.id) || [],
        random_filament_orders: rfByOrder.get(o.id) || [],
      }));
    },
    enabled: isAdminOrAssistant,
    refetchOnMount: true,
    refetchOnWindowFocus: true,
  });


  // Helper function to check if order is pre-order
  const checkIfPreOrder = (orderItems: any[]): boolean => {
    if (!orderItems || orderItems.length === 0) return true;
    for (const item of orderItems) {
      if (item.custom_request_id) return true;
      if (item.shipping_option_name_ar && item.shipping_option_name_ar.includes('متاح في المخزون')) continue;
      return true;
    }
    return false;
  };

  // Helper function to get shipping info
  const getShippingInfo = (orderItems: any[]): { name: string; isFast: boolean } => {
    const shippingItem = orderItems?.find((item: any) => item.shipping_option_name_ar);
    const name = shippingItem?.shipping_option_name_ar || '';
    const isFast = name.includes('سريع') || name.includes('جوي');
    return { name, isFast };
  };

  // Helper: random-filament summary for an order (counts + sale_type breakdown)
  const getRandomFilamentInfo = (order: any): { total: number; direct: number; preorder: number; offerTitle?: string } => {
    const rfos = (order?.random_filament_orders as any[]) || [];
    let direct = 0, preorder = 0;
    let offerTitle: string | undefined;
    for (const r of rfos) {
      if (r?.sale_type === 'direct') direct++;
      else if (r?.sale_type === 'preorder') preorder++;
      if (!offerTitle) offerTitle = r?.random_filament_offers?.title_ar;
    }
    return { total: rfos.length, direct, preorder, offerTitle };
  };

  // Helper: check if a specific order_item came from random-filament
  const isRandomFilamentItem = (order: any, item: any): { isRf: boolean; saleType?: string } => {
    const rfos = (order?.random_filament_orders as any[]) || [];
    const match = rfos.find((r: any) =>
      r.product_id === item.product_id &&
      (r.product_option_id || null) === (item.product_option_id || null)
    );
    return { isRf: !!match, saleType: match?.sale_type };
  };

  // Helper function to create invoice automatically
  const createAutoInvoice = async (orderId: string) => {
    try {
      // Check if invoice already exists for this order
      const { data: existingInvoice } = await supabase
        .from('saved_invoices')
        .select('id')
        .eq('order_id', orderId)
        .maybeSingle();
      
      if (existingInvoice) {
        console.log('Invoice already exists for order:', orderId);
        return; // Invoice already exists
      }
      
      // Get order details for invoice
      const { data: order, error: orderError } = await (supabase as any)
        .from('orders_admin')
        .select(`
          *,
          order_items:order_items_admin!order_items_order_id_fkey(
            *,
            products:products_admin!order_items_product_id_fkey(name_ar, image_url),
            custom_product_requests(product_name, image_url)
          ),
          profiles(full_name, email)
        `)
        .eq('id', orderId)
        .single();
      
      if (orderError || !order) {
        console.error('Error fetching order for invoice:', orderError);
        return;
      }
      
      // Get default template
      const { data: template } = await supabase
        .from('invoice_templates')
        .select('id')
        .eq('is_default', true)
        .maybeSingle();
      
      // Calculate warranty expiry (1 year from now)
      const warrantyExpiresAt = new Date();
      warrantyExpiresAt.setFullYear(warrantyExpiresAt.getFullYear() + 1);
      
      // Compute totals breakdown
      const fmt = (n: number) => Math.round(Number(n) || 0).toLocaleString('en-US');
      const itemsSubtotal = (order.order_items || []).reduce(
        (s: number, it: any) => s + (Number(it.total_price) || 0), 0
      );
      const subtotal = Number(order.subtotal) > 0 ? Number(order.subtotal) : itemsSubtotal;
      const shippingCost = Number(order.admin_shipping_cost) || 0;
      const taxAmt = Number(order.tax_amount) || 0;
      const taxPct = Number(order.tax_percentage) || 0;
      const discount = Number(order.discount_amount) || 0;
      const cardDiscount = Number(order.card_discount_amount) || 0;
      const grandTotal = Number(order.total_amount) || (subtotal + shippingCost + taxAmt - discount - cardDiscount);
      const cur = order.currency || 'د.ع';

      // Create simple invoice HTML
      const invoiceHTML = `
        <div style="direction: rtl; font-family: Cairo, sans-serif; padding: 20px;">
          <h1 style="color: #d4af37;">فاتورة رقم ${order.order_number}</h1>
          <p>تاريخ الإنشاء: ${new Date().toLocaleDateString('ar-IQ')}</p>
          <p>العميل: ${order.profiles?.full_name || 'غير معروف'}</p>
          <p>العنوان: ${order.shipping_address}</p>
          <p>الهاتف: ${order.phone_number}</p>
          <hr/>
          <h3>المنتجات:</h3>
          <ul>
             ${order.order_items?.map((item: any) => `
               <li>${item.is_gift ? '🎁 ' : ''}${item.product_name_ar} - الكمية: ${item.quantity} - السعر: ${fmt(item.total_price)} ${cur}</li>
            `).join('') || ''}
          </ul>
          <hr/>
          <table style="width:100%; font-size:14px;">
            <tr><td>المجموع الفرعي</td><td style="text-align:left;">${fmt(subtotal)} ${cur}</td></tr>
            ${shippingCost > 0 ? `<tr><td>التوصيل</td><td style="text-align:left;">${fmt(shippingCost)} ${cur}</td></tr>` : ''}
            ${taxAmt > 0 ? `<tr><td>الضريبة${taxPct > 0 ? ` (${taxPct}%)` : ''}</td><td style="text-align:left;">${fmt(taxAmt)} ${cur}</td></tr>` : ''}
            ${discount > 0 ? `<tr><td>الخصم</td><td style="text-align:left;">- ${fmt(discount)} ${cur}</td></tr>` : ''}
            ${cardDiscount > 0 ? `<tr><td>خصم البطاقة</td><td style="text-align:left;">- ${fmt(cardDiscount)} ${cur}</td></tr>` : ''}
            <tr style="font-weight:bold; border-top:1px solid #ccc;"><td>الإجمالي</td><td style="text-align:left;">${fmt(grandTotal)} ${cur}</td></tr>
          </table>
        </div>
      `;
      
      // Insert invoice
      const { error: invoiceError } = await supabase
        .from('saved_invoices')
        .insert({
          order_id: orderId,
          invoice_html: invoiceHTML,
          template_id: template?.id || null,
          warranty_expires_at: warrantyExpiresAt.toISOString(),
          notes: 'تم إنشاء الفاتورة تلقائياً عند تأكيد الطلب'
        });
      
      if (invoiceError) {
        console.error('Error creating auto invoice:', invoiceError);
      } else {
        console.log('Auto invoice created for order:', orderId);
      }
    } catch (error) {
      console.error('Error in createAutoInvoice:', error);
    }
  };

  const updateOrderMutation = useMutation({
    mutationFn: async ({ id, values, previousStatus, order }: { id: string; values: any; previousStatus?: string; order?: any }) => {
      // If changing to cancelled, use cancel_order RPC to restore stock
      if (values.status === 'cancelled' && previousStatus !== 'cancelled') {
        try {
          const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_order', {
            p_order_id: id,
            p_cancelled_by: 'admin'
          });
          if (cancelError) {
            console.error('cancel_order RPC error:', cancelError);
            throw cancelError;
          }
          const result = cancelResult as any;
          if (result && !result.success) {
            console.error('cancel_order RPC failed:', result.error);
            throw new Error(result.error || 'فشل إلغاء الطلب');
          }
        } catch (rpcError) {
          console.error('cancel_order exception:', rpcError);
          throw rpcError;
        }

        // Apply any extra fields from values (like timestamps, notes) that cancel_order doesn't set
        const extraFields = { ...values };
        delete extraFields.status; // Already set by RPC
        if (Object.keys(extraFields).length > 0) {
          await adminUpdateOrder(id, extraFields);
        }
      } else if (values.status === 'confirmed' && previousStatus === 'cancelled') {
        // Re-confirm a cancelled order: update status first, then re-deduct stock
        await adminUpdateOrder(id, { ...values, stock_deducted: false });

        // Re-deduct stock since order is being re-activated
        if (order?.order_type === 'direct') {
          const { error: stockError } = await supabase.rpc('deduct_order_stock', { p_order_id: id });
          if (stockError) {
            console.error('Stock re-deduction error:', stockError);
          }
        }
      } else {
        await adminUpdateOrder(id, values);
      }
      
      // Auto-create invoice when order is confirmed
      if (values.status === 'confirmed' && previousStatus !== 'confirmed') {
        try { await createAutoInvoice(id); } catch (e) { console.error('Auto invoice error:', e); }
      }

      // Send notification when status changes
      if (values.status && values.status !== previousStatus && order) {
        const statusLabels: Record<string, string> = {
          pending: 'قيد الانتظار',
          confirmed: 'تم التأكيد',
          processing: 'قيد المعالجة',
          purchased: 'تم الشراء',
          shipped: 'تم الشحن',
          arrived_warehouse: 'وصل المخزن',
          arrived_iraq: 'وصل العراق',
          on_the_way: 'في الطريق إليك',
          delivered: 'تم التوصيل',
          cancelled: 'ملغي',
        };
        const statusLabel = statusLabels[values.status] || values.status;
        
        try {
          await sendAllNotifications({
            userId: order.user_id,
            title: 'تحديث حالة طلبك 📦',
            message: `تم تحديث حالة طلبك رقم ${order.order_number} إلى: ${statusLabel}`,
            type: values.status === 'delivered' ? 'success' : 'info',
            relatedId: id,
          });
        } catch (notifError) {
          console.error('Notification error (non-blocking):', notifError);
        }
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم تحديث الطلب بنجاح');
      setDialogOpen(false);
      setEditingOrder(null);
      resetEditForm();
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء تحديث الطلب');
      console.error(error);
    }
  });

  const createOrderMutation = useMutation({
    mutationFn: async (values: any) => {
      const { data: orderNumberData } = await supabase.rpc('generate_order_number');
      const orderNumber = orderNumberData || `ORD-${Date.now()}`;

      const data = await adminCreateOrder({
        ...values,
        order_number: orderNumber,
        status: values.status || 'pending',
        currency: values.currency || 'دينار عراقي',
      });
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم إنشاء الطلب بنجاح');
      setCreateDialogOpen(false);
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إنشاء الطلب');
      console.error(error);
    }
  });

  const deleteOrderMutation = useMutation({
    mutationFn: async (orderId: string) => {
      // Cancel instead of hard delete - calls cancel_order RPC which also restores stock
      const { data, error } = await supabase.rpc('cancel_order', { 
        p_order_id: orderId, 
        p_cancelled_by: 'admin' 
      });
      if (error) throw error;
      const result = data as any;
      if (result && !result.success) throw new Error(result.error || 'فشل إلغاء الطلب');
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      toast.success('تم إلغاء الطلب بنجاح');
    },
    onError: (error: any) => {
      toast.error(error?.message || 'حدث خطأ أثناء إلغاء الطلب');
      console.error(error);
    }
  });

  const cancelOrderWithRefundMutation = useMutation({
    mutationFn: async (order: any) => {
      const paidAmount = Number(order.customer_paid_amount) || Number(order.paid_amount) || 0;
      
      // Use cancel_order RPC to properly restore stock
      const { data: cancelResult, error: cancelError } = await supabase.rpc('cancel_order', {
        p_order_id: order.id,
        p_cancelled_by: 'admin'
      });
      if (cancelError) throw cancelError;
      const result = cancelResult as any;
      if (result && !result.success) throw new Error(result.error || 'فشل إلغاء الطلب');

      // Update payment status to refunded
      await adminUpdateOrder(order.id, {
        payment_status: 'refunded',
        updated_at: new Date().toISOString()
      });

      if (paidAmount > 0) {
        const { data: wallet, error: walletFetchError } = await supabase
          .from('user_wallets')
          .select('balance')
          .eq('user_id', order.user_id)
          .maybeSingle();

        if (walletFetchError) throw walletFetchError;

        const currentBalance = wallet?.balance || 0;

        const { error: walletError } = await supabase
          .from('user_wallets')
          .upsert({
            user_id: order.user_id,
            balance: currentBalance + paidAmount,
            updated_at: new Date().toISOString()
          }, { onConflict: 'user_id' });

        if (walletError) throw walletError;

        const { error: transactionError } = await supabase
          .from('wallet_transactions')
          .insert({
            user_id: order.user_id,
            type: 'refund',
            amount: paidAmount,
            status: 'completed',
            admin_notes: `استرجاع مبلغ الطلب الملغي رقم ${order.order_number}`,
          });

        if (transactionError) throw transactionError;

        // Send all notifications (in-app and Telegram only)
        await sendAllNotifications({
          userId: order.user_id,
          title: 'تم إلغاء طلبك واسترجاع المبلغ',
          message: `تم إلغاء الطلب رقم ${order.order_number} واسترجاع مبلغ ${paidAmount.toLocaleString()} دينار عراقي إلى محفظتك`,
          type: 'info',
          relatedId: order.id,
        });
      }

      return { paidAmount };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
      if (data.paidAmount > 0) {
        toast.success(`تم إلغاء الطلب واسترجاع ${data.paidAmount.toLocaleString()} د.ع للمحفظة`);
      } else {
        toast.success('تم إلغاء الطلب بنجاح');
      }
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إلغاء الطلب');
      console.error(error);
    }
  });

  const resetEditForm = () => {
    setSerialImageFile(null);
    setSerialImagePreview('');
    setAdminImageFiles([]);
    setAdminFilesArray([]);
    setAdminImagePreviews([]);
    setExistingAdminImages([]);
    setExistingAdminFiles([]);
    setEditStatus('');
    setEditPaymentStatus('');
    setEditInternalNotes('');
    setEditShippingNotes('');
    setEditEstimatedDeliveryDate('');
    setTotalAmount(0);
    setAdminProductCost(0);
    setDeliveryFee(0);
    setTaxAmount(0);
    setSubtotalAmount(0);
    setTaxPercentage(0);
  };

  const openEditDialog = (order: any) => {
    setEditingOrder(order);
    const orderType = order.order_type || (checkIfPreOrder(order.order_items || []) ? 'preorder' : 'direct');
    const isDirectSale = orderType === 'direct';
    
    setEditStatus(order.status || '');
    // Direct sale orders default to COD payment
    setEditPaymentStatus(order.payment_status || (isDirectSale ? 'cod' : ''));
    setEditInternalNotes(order.internal_notes || '');
    setEditShippingNotes(order.shipping_notes || '');
    // Direct sale orders don't need estimated delivery date
    setEditEstimatedDeliveryDate(isDirectSale ? '' : (order.estimated_delivery_date ? order.estimated_delivery_date.split('T')[0] : ''));
    setTotalAmount(order.total_amount || 0);
    
    // Calculate delivery fee from subtotal vs total
    const orderSubtotal = order.subtotal || 0;
    const orderDiscount = order.discount_amount || 0;
    const orderDeliveryFee = orderSubtotal > 0 ? Math.max(0, (order.total_amount || 0) - orderSubtotal + orderDiscount) : 0;
    setDeliveryFee(order.admin_shipping_cost || orderDeliveryFee);
    
    setAdminProductCost(order.admin_product_cost || order.admin_other_costs || 0);
    setCommissionProfit(0);
    
    setTaxAmount(order.tax_amount || 0);
    setSubtotalAmount(order.subtotal || 0);
    setTaxPercentage(order.tax_percentage || 0);
    setExistingAdminImages(order.admin_images || []);
    setExistingAdminFiles(order.admin_files || []);
    if (order.serial_number_image_url) {
      setSerialImagePreview(order.serial_number_image_url);
    }
    setDialogOpen(true);
  };

  const handleSaveOrder = async () => {
    if (!editingOrder) return;
    
    // Upload images first
    let serialImageUrl = editingOrder.serial_number_image_url;
    let adminImagesUrls = [...existingAdminImages];
    let adminFilesUrls = [...existingAdminFiles];
    
    try {
      // Upload serial image if new file selected
      if (serialImageFile) {
        setUploadingImage(true);
        const fileExt = serialImageFile.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `serial-${editingOrder.id}-${Date.now()}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(fileName, serialImageFile);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('order-files')
          .getPublicUrl(fileName);
        
        serialImageUrl = publicUrl;
      }
      
      // Upload admin images
      for (const file of adminImageFiles) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'jpg';
        const fileName = `admin-img-${editingOrder.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('order-files')
          .getPublicUrl(fileName);
        
        adminImagesUrls.push(publicUrl);
      }
      
      // Upload admin files
      for (const file of adminFilesArray) {
        const fileExt = file.name.split('.').pop()?.toLowerCase() || 'pdf';
        const fileName = `admin-file-${editingOrder.id}-${Date.now()}-${Math.random().toString(36).substring(7)}.${fileExt}`;
        
        const { error: uploadError } = await supabase.storage
          .from('order-files')
          .upload(fileName, file);
        
        if (uploadError) throw uploadError;
        
        const { data: { publicUrl } } = supabase.storage
          .from('order-files')
          .getPublicUrl(fileName);
        
        adminFilesUrls.push(publicUrl);
      }
    } catch (error) {
      console.error('Error uploading files:', error);
      toast.error('حدث خطأ أثناء رفع الملفات');
      setUploadingImage(false);
      return;
    }
    setUploadingImage(false);
    
    const updateData: any = {
      status: editStatus,
      payment_status: editPaymentStatus,
      internal_notes: editInternalNotes,
      shipping_notes: editShippingNotes,
      estimated_delivery_date: editEstimatedDeliveryDate ? new Date(editEstimatedDeliveryDate).toISOString() : null,
      total_amount: totalAmount,
      admin_product_cost: adminProductCost,
      admin_shipping_cost: deliveryFee,
      admin_other_costs: 0,
      tax_amount: taxAmount,
      tax_percentage: taxPercentage,
      profit_amount: calculatedProfit,
      serial_number_image_url: serialImageUrl,
      admin_images: adminImagesUrls,
      admin_files: adminFilesUrls,
      updated_at: new Date().toISOString(),
    };

    // Handle status-based timestamps for all statuses
    const now = new Date().toISOString();
    if (editStatus === 'confirmed' && !editingOrder.confirmed_at) {
      updateData.confirmed_at = now;
    }
    if (editStatus === 'processing' && !editingOrder.processing_at) {
      updateData.processing_at = now;
    }
    if (editStatus === 'purchased' && !editingOrder.purchased_at) {
      updateData.purchased_at = now;
    }
    if (editStatus === 'shipped' && !editingOrder.shipped_at) {
      updateData.shipped_at = now;
    }
    if (editStatus === 'arrived_warehouse' && !editingOrder.arrived_warehouse_at) {
      updateData.arrived_warehouse_at = now;
    }
    if (editStatus === 'arrived_iraq' && !editingOrder.arrived_iraq_at) {
      updateData.arrived_iraq_at = now;
    }
    if (editStatus === 'on_the_way' && !editingOrder.on_the_way_at) {
      updateData.on_the_way_at = now;
    }
    if (editStatus === 'delivered' && !editingOrder.delivered_at) {
      updateData.delivered_at = now;
    }
    if (editStatus === 'cancelled' && !editingOrder.cancelled_at) {
      updateData.cancelled_at = now;
    }

    updateOrderMutation.mutate({ id: editingOrder.id, values: updateData, previousStatus: editingOrder.status, order: editingOrder });
  };

  const handleQuickStatusChange = (orderId: string, newStatus: string, currentStatus?: string, order?: any) => {
    const now = new Date().toISOString();
    const updateData: any = {
      status: newStatus,
      updated_at: now,
    };

    // Handle status-based timestamps for all statuses
    if (newStatus === 'confirmed') {
      updateData.confirmed_at = now;
    }
    if (newStatus === 'processing') {
      updateData.processing_at = now;
    }
    if (newStatus === 'purchased') {
      updateData.purchased_at = now;
    }
    if (newStatus === 'shipped') {
      updateData.shipped_at = now;
    }
    if (newStatus === 'arrived_warehouse') {
      updateData.arrived_warehouse_at = now;
    }
    if (newStatus === 'arrived_iraq') {
      updateData.arrived_iraq_at = now;
    }
    if (newStatus === 'on_the_way') {
      updateData.on_the_way_at = now;
    }
    if (newStatus === 'delivered') {
      updateData.delivered_at = now;
    }
    if (newStatus === 'cancelled') {
      updateData.cancelled_at = now;
    }

    updateOrderMutation.mutate({ id: orderId, values: updateData, previousStatus: currentStatus, order });
  };

  const getStatusBadge = (status: string) => {
    const statusConfig: Record<string, { label: string; className: string }> = {
      pending: { label: 'قيد الانتظار', className: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
      confirmed: { label: 'تم التأكيد', className: 'bg-sky-500/20 text-sky-400 border-sky-500/30' },
      processing: { label: 'قيد المعالجة', className: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
      purchased: { label: 'تم الشراء', className: 'bg-indigo-500/20 text-indigo-400 border-indigo-500/30' },
      shipped: { label: 'تم الشحن', className: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
      arrived_warehouse: { label: 'وصل المخزن', className: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
      arrived_iraq: { label: 'وصل العراق', className: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
      on_the_way: { label: 'في الطريق إليك', className: 'bg-orange-500/20 text-orange-400 border-orange-500/30' },
      delivered: { label: 'تم التوصيل', className: 'bg-green-500/20 text-green-400 border-green-500/30' },
      cancelled: { label: 'ملغي', className: 'bg-red-500/20 text-red-400 border-red-500/30' },
    };

    const config = statusConfig[status] || { label: status, className: 'bg-muted text-muted-foreground' };
    return <Badge variant="outline" className={config.className}>{config.label}</Badge>;
  };

  // Base orders: filtered by tab + shipping type + search only (NOT by status).
  // Used for stat cards and status-filter button counts so they reflect real totals.
  const baseOrders = (orders || []).filter(order => {
    const matchesSearch =
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone_number?.includes(searchTerm);

    const shippingInfo = getShippingInfo(order.order_items || []);
    const isAirShipping = shippingInfo.isFast;
    const matchesShippingType =
      orderTab !== 'preorder' || preorderShippingTab === 'all' ||
      (preorderShippingTab === 'air' && isAirShipping) ||
      (preorderShippingTab === 'sea' && !isAirShipping);

    const orderType = (order as any).order_type || (checkIfPreOrder(order.order_items || []) ? 'preorder' : 'direct');
    const matchesOrderType =
      (orderTab === 'preorder' && orderType === 'preorder') ||
      (orderTab === 'direct' && orderType === 'direct');

    return matchesSearch && matchesShippingType && matchesOrderType;
  });

  // Apply status filter on top of baseOrders for the visible list.
  const filteredOrders = baseOrders.filter(order => {
    const matchesStatus = statusFilter === 'all'
      ? order.status !== 'cancelled'
      : statusFilter === 'active'
        ? !['delivered', 'cancelled'].includes(order.status)
        : order.status === statusFilter;
    return matchesStatus;
  });

  // Per-customer ordering index + distinct color stripe
  // يُحسب فقط للطلبات بحالة: قيد الانتظار / تم التأكيد / تم الشراء
  const COUNTED_STATUSES = new Set(['pending', 'confirmed', 'purchased']);
  const customerKey = (o: any) => o.user_id || o.phone_number || 'guest';
  const customerOrdersMap = new Map<string, string[]>();
  [...(orders || [])]
    .filter((o: any) => COUNTED_STATUSES.has(o.status))

    .sort((a: any, b: any) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
    .forEach((o: any) => {
      const k = customerKey(o);
      const arr = customerOrdersMap.get(k) || [];
      arr.push(o.id);
      customerOrdersMap.set(k, arr);
    });
  const getCustomerIndex = (o: any) => {
    const arr = customerOrdersMap.get(customerKey(o)) || [];
    const idx = arr.indexOf(o.id);
    return { index: idx + 1, total: arr.length };
  };
  const getCustomerColor = (o: any) => {
    const k = String(customerKey(o));
    let hash = 0;
    for (let i = 0; i < k.length; i++) hash = (hash * 31 + k.charCodeAt(i)) >>> 0;
    const hue = hash % 360;
    return `hsl(${hue} 75% 50%)`;
  };

  // Pagination
  const pagination = usePagination(filteredOrders, { pageSize: 25 });


  // Count by status
  const statusCounts = orders?.reduce((acc, order) => {
    acc[order.status] = (acc[order.status] || 0) + 1;
    return acc;
  }, {} as Record<string, number>) || {};

  if (authLoading) {
    return <AdminLoading />;
  }

  if (!isAdminOrAssistant) {
    navigate('/');
    return null;
  }

  return (
    <AdminLayout
      title="إدارة الطلبات"
      description="عرض وإدارة جميع طلبات العملاء وطلبات شحن العروض"
      icon={<Package className="h-5 w-5" />}
      actions={
        activeTab === 'orders' ? (
          <AdminCreateOrderDialog
            open={createDialogOpen}
            onOpenChange={setCreateDialogOpen}
          />
        ) : undefined
      }
    >
      <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
        <TabsList className="mb-6">
          <TabsTrigger value="orders" className="gap-2">
            <Package className="h-4 w-4" />
            طلبات الموقع
          </TabsTrigger>
          <TabsTrigger value="offer-purchases" className="gap-2">
            <Gift className="h-4 w-4" />
            طلبات شحن العروض
          </TabsTrigger>
          <TabsTrigger value="delivered-registry" className="gap-2" onClick={() => window.open(`${window.location.origin}${ADMIN_ROUTES.deliveredOrders}`, '_blank')}>
            <CheckCircle className="h-4 w-4" />
            الطلبات المسلّمة
          </TabsTrigger>
        </TabsList>

        <TabsContent value="orders">
          {/* Inner Order Type Tabs */}
          <Tabs value={orderTab} onValueChange={(v) => { setOrderTab(v as 'preorder' | 'direct'); pagination.resetPage(); }} className="w-full">
            <TabsList className="mb-4 w-full justify-start">
              <TabsTrigger value="preorder" className="gap-2 flex-1 md:flex-none">
                <Package className="h-4 w-4" />
                حجز مسبق
              </TabsTrigger>
              <TabsTrigger value="direct" className="gap-2 flex-1 md:flex-none">
                <Truck className="h-4 w-4" />
                طلب مباشر
              </TabsTrigger>
            </TabsList>

            {/* Preorder sub-tabs (sea/air) - only when preorder tab is active */}
            {orderTab === 'preorder' && (
              <div className="flex gap-2 mb-4">
                <Button
                  variant={preorderShippingTab === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setPreorderShippingTab('all'); pagination.resetPage(); }}
                >
                  الكل
                </Button>
                <Button
                  variant={preorderShippingTab === 'sea' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setPreorderShippingTab('sea'); pagination.resetPage(); }}
                  className="gap-1.5"
                >
                  <Ship className="h-4 w-4" />
                  بحري
                </Button>
                <Button
                  variant={preorderShippingTab === 'air' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setPreorderShippingTab('air'); pagination.resetPage(); }}
                  className="gap-1.5"
                >
                  <Plane className="h-4 w-4" />
                  جوي
                </Button>
              </div>
            )}
          </Tabs>

          {/* Stats Grid */}
          <AdminStatsGrid>
            <AdminStatCard
              icon={<Package className="h-5 w-5" />}
              value={baseOrders.length}
              label="إجمالي الطلبات"
            />
            <AdminStatCard
              icon={<Loader2 className="h-5 w-5" />}
              value={baseOrders.filter(o => o.status === 'pending').length}
              label="قيد الانتظار"
              colorClass="text-amber-500"
              bgClass="bg-amber-500/10"
            />
            <AdminStatCard
              icon={<Truck className="h-5 w-5" />}
              value={baseOrders.filter(o => o.status === 'shipped').length}
              label="تم الشحن"
              colorClass="text-blue-500"
              bgClass="bg-blue-500/10"
            />
            <AdminStatCard
              icon={<ShoppingBag className="h-5 w-5" />}
              value={baseOrders.filter(o => o.status === 'delivered').length}
              label="تم التوصيل"
              colorClass="text-green-500"
              bgClass="bg-green-500/10"
            />
          </AdminStatsGrid>

      {/* Filters */}
      <AdminSection className="mt-6">
        <AdminCard>
          <AdminCardContent>
            <div className="flex flex-col gap-4">
              {/* Search */}
              <div className="flex-1 relative">
                <Search className="absolute right-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث بالرقم، الاسم، أو الهاتف..."
                  value={searchTerm}
                  onChange={(e) => {
                    setSearchTerm(e.target.value);
                    pagination.resetPage();
                  }}
                  className="pr-10"
                />
              </div>
              
              {/* Status Filters */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('active'); pagination.resetPage(); }}
                >
                  النشطة ({baseOrders.filter(o => !['delivered', 'cancelled'].includes(o.status)).length})
                </Button>
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('all'); pagination.resetPage(); }}
                >
                  الكل ({baseOrders.filter(o => o.status !== 'cancelled').length})
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('pending'); pagination.resetPage(); }}
                >
                  قيد الانتظار ({baseOrders.filter(o => o.status === 'pending').length})
                </Button>
                <Button
                  variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('confirmed'); pagination.resetPage(); }}
                >
                  تم التأكيد ({baseOrders.filter(o => o.status === 'confirmed').length})
                </Button>
                <Button
                  variant={statusFilter === 'processing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('processing'); pagination.resetPage(); }}
                >
                  قيد المعالجة ({baseOrders.filter(o => o.status === 'processing').length})
                </Button>
                <Button
                  variant={statusFilter === 'shipped' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('shipped'); pagination.resetPage(); }}
                >
                  تم الشحن ({baseOrders.filter(o => o.status === 'shipped').length})
                </Button>
                <Button
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('delivered'); pagination.resetPage(); }}
                >
                  تم التوصيل ({baseOrders.filter(o => o.status === 'delivered').length})
                </Button>
                <Button
                  variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('cancelled'); pagination.resetPage(); }}
                  className="text-destructive"
                >
                  ملغي ({baseOrders.filter(o => o.status === 'cancelled').length})
                </Button>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </AdminSection>

      {/* Preorder Products Aggregated Summary */}
      {orderTab === 'preorder' && (() => {
        const activeOrders = baseOrders.filter(o => !['cancelled', 'delivered'].includes(o.status));
        const map = new Map<string, { name: string; option: string; color: string; qty: number; isGift: boolean; orders: Set<string> }>();
        for (const o of activeOrders) {
          const items = ((o as any).order_items || []) as any[];
          for (const it of items) {
            // Skip pure shipping-fee rows (no product attached) — actual products may also carry
            // shipping_option_name_ar as their selected shipping mode, so we filter by product_id only.
            if (!it?.product_id && it?.shipping_option_name_ar) continue;
            const name = String(it?.product_name_ar || it?.product_name || 'منتج').trim();
            const option = String(it?.selected_option || '').trim();
            const color = String(it?.selected_color || '').trim();
            const isGift = !!it?.is_gift;
            const key = `${name}||${option}||${color}||${isGift ? '1' : '0'}`;
            const q = Number(it?.quantity) || 0;
            const existing = map.get(key);
            if (existing) {
              existing.qty += q;
              existing.orders.add(o.id);
            } else {
              map.set(key, { name, option, color, qty: q, isGift, orders: new Set([o.id]) });
            }
          }
        }
        const rows = Array.from(map.values()).sort((a, b) => b.qty - a.qty);
        const totalQty = rows.reduce((s, r) => s + r.qty, 0);
        const copyText = rows.map(r => {
          const parts = [r.name];
          if (r.color) parts.push(`لون ${r.color}`);
          if (r.option) parts.push(`خيار ${r.option}`);
          parts.push(`عدد ${r.qty}`);
          return (r.isGift ? '🎁 ' : '') + parts.join(' • ');
        }).join('\n');

        return (
          <AdminSection className="mt-6">
            <AdminCard>
              <AdminCardHeader
                icon={<Package className="h-5 w-5" />}
                title={`ملخص منتجات الطلبات المسبقة النشطة (${activeOrders.length} طلب • ${totalQty} قطعة)`}
                actions={
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => setPreorderSummaryOpen(true)}
                    disabled={rows.length === 0}
                  >
                    عرض التفاصيل
                  </Button>
                }
              />
            </AdminCard>

            <Dialog open={preorderSummaryOpen} onOpenChange={setPreorderSummaryOpen}>
              <DialogContent className="!max-w-2xl !overflow-hidden !max-h-none flex flex-col" style={{ height: 'min(90vh, 720px)' }}>
                <DialogHeader>
                  <DialogTitle className="flex items-center gap-2">
                    <Package className="h-5 w-5" />
                    تفاصيل منتجات الطلبات المسبقة
                  </DialogTitle>
                  <div className="text-xs text-muted-foreground mt-1">
                    {activeOrders.length} طلب نشط • {rows.length} منتج فريد • {totalQty} قطعة إجمالية
                  </div>
                </DialogHeader>

                <div className="flex items-center justify-end gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => preorderSummaryScrollRef.current?.scrollTo({ top: 0, behavior: 'smooth' })}
                    disabled={rows.length === 0}
                  >
                    أعلى
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    className="h-8 px-3 text-xs"
                    onClick={() => {
                      const el = preorderSummaryScrollRef.current;
                      if (el) el.scrollTo({ top: el.scrollHeight, behavior: 'smooth' });
                    }}
                    disabled={rows.length === 0}
                  >
                    نزول للأسفل
                  </Button>
                </div>

                <div ref={preorderSummaryScrollRef} className="min-h-0 flex-1 overflow-y-auto overscroll-contain -mx-1 px-1 pr-2" style={{ WebkitOverflowScrolling: 'touch' }}>
                  {rows.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-8">لا توجد منتجات نشطة في الطلبات المسبقة</p>
                  ) : (
                    <div className="space-y-2">
                      {rows.map((r, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-muted/30 border border-border/40"
                        >
                          <div className="flex items-center gap-2 flex-wrap flex-1 min-w-0 text-sm">
                            <span className="text-[10px] text-muted-foreground tabular-nums shrink-0">#{idx + 1}</span>
                            {r.isGift && <Gift className="h-3.5 w-3.5 text-emerald-600 shrink-0" />}
                            <span className="font-bold">{r.name}</span>
                            {r.color && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                لون: <span className="font-semibold mx-1">{r.color}</span>
                              </Badge>
                            )}
                            {r.option && (
                              <Badge variant="outline" className="text-[10px] shrink-0">
                                خيار: <span className="font-semibold mx-1">{r.option}</span>
                              </Badge>
                            )}
                            <span className="text-[10px] text-muted-foreground shrink-0">({r.orders.size} طلب)</span>
                          </div>
                          <div className="text-base font-extrabold text-primary shrink-0 tabular-nums">
                            ×{r.qty}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <DialogFooter className="flex-row !justify-end gap-2 pt-2 border-t border-border/40">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => { navigator.clipboard.writeText(copyText); toast.success('تم نسخ الملخص'); }}
                    disabled={rows.length === 0}
                  >
                    نسخ الكل
                  </Button>
                  <Button
                    variant="default"
                    size="sm"
                    onClick={() => {
                      const data = rows.map((r, i) => ({
                        '#': i + 1,
                        'المنتج': r.name,
                        'اللون': r.color || '—',
                        'الخيار': r.option || '—',
                        'هدية': r.isGift ? 'نعم' : 'لا',
                        'العدد': r.qty,
                        'عدد الطلبات': r.orders.size,
                      }));
                      data.push({
                        '#': '' as any,
                        'المنتج': 'الإجمالي',
                        'اللون': '',
                        'الخيار': '',
                        'هدية': '',
                        'العدد': totalQty,
                        'عدد الطلبات': activeOrders.length,
                      });
                      const date = new Date().toISOString().slice(0, 10);
                      exportToExcel(data, { filename: `preorder-products-summary-${date}.xlsx` });
                      toast.success('تم تصدير الملخص');
                    }}
                    disabled={rows.length === 0}
                  >
                    تصدير Excel
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </AdminSection>
        );
      })()}

      {/* Orders Table */}
      <AdminSection className="mt-6">
        <AdminCard hover={false}>
          {isLoading ? (
            <AdminLoading />
          ) : filteredOrders.length === 0 ? (
            <AdminEmptyState
              icon={<Package className="h-12 w-12" />}
              title="لا توجد طلبات"
              description="لم يتم العثور على طلبات تطابق معايير البحث"
            />
          ) : (
            <>
              {/* Mobile Card View */}
              <div className="md:hidden space-y-3 p-3">
                {pagination.paginatedItems.map((order) => {
                  const shippingInfo = getShippingInfo(order.order_items || []);
                  const isPreOrder = checkIfPreOrder(order.order_items || []);
                  const rfInfo = getRandomFilamentInfo(order);
                  const custIdx = getCustomerIndex(order);
                  const custColor = getCustomerColor(order);
                  return (
                    <div key={order.id} className="relative rounded-xl border border-border bg-card p-3 pt-4 space-y-3 overflow-hidden">
                      {custIdx.total > 0 && (
                        <div className="absolute inset-x-0 top-0 h-1" style={{ background: custColor }} aria-hidden />
                      )}
                      {/* Header row: order number + status */}
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 flex-wrap">
                          <span className="font-mono text-sm font-bold text-foreground">{order.order_number}</span>
                          <OrderNumberCopyButton orderNumber={order.order_number} />
                          {custIdx.total > 1 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] gap-0.5"
                              style={{ borderColor: custColor, color: custColor }}
                              title="ترتيب الطلب لهذا العميل"
                            >
                              طلب {custIdx.index} من {custIdx.total}
                            </Badge>
                          )}
                        </div>

                        <div className="flex items-center gap-1.5 flex-wrap justify-end">
                          {getStatusBadge(order.status)}
                          {(order as any).order_type === 'direct' ? (
                            <Badge variant="outline" className="text-[10px] border-emerald-500/40 text-emerald-600 gap-0.5"><Truck className="h-3 w-3" />مباشر</Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px] gap-0.5">
                              {shippingInfo.isFast ? <Plane className="h-3 w-3" /> : <Ship className="h-3 w-3" />}
                              {isPreOrder ? 'مسبق' : 'متوفر'}
                            </Badge>
                          )}
                          {rfInfo.total > 0 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-fuchsia-500/40 text-fuchsia-600 dark:text-fuchsia-300 gap-0.5"
                              title={rfInfo.offerTitle ? `عرض: ${rfInfo.offerTitle}` : 'فلامنت عشوائي'}
                            >
                              🎲 عشوائي ×{rfInfo.total}
                              {rfInfo.direct > 0 && rfInfo.preorder > 0 ? ' (مختلط)' : rfInfo.direct > 0 ? ' • مباشر' : ' • مسبق'}
                            </Badge>
                          )}
                        </div>
                      </div>

                      {/* Customer + amount */}
                      <div className="flex items-center justify-between text-sm">
                        <div className="flex flex-col min-w-0">
                          <span className="font-medium truncate">{order.profiles?.full_name || order.profiles?.username}</span>
                          <span className="text-xs text-muted-foreground">{order.governorate} • {order.phone_number}</span>
                        </div>
                        <div className="text-left whitespace-nowrap">
                          <span className="font-bold text-foreground">{formatPrice(order.total_amount)}</span>
                          {(Number(order.paid_amount) > 0 || Number(order.customer_paid_amount) > 0) && (
                            <div className="text-[10px] leading-tight">
                              <span className="text-emerald-600">محفظة: {formatPrice(Number(order.customer_paid_amount) || Number(order.paid_amount))}</span>
                              {Number(order.remaining_amount) > 0 && (
                                <>
                                  <br />
                                  <span className="text-amber-600">متبقي: {formatPrice(order.remaining_amount)}</span>
                                </>
                              )}
                              {Number(order.remaining_amount) <= 0 && (
                                <>
                                  <br />
                                  <span className="text-emerald-600">مدفوع بالكامل ✓</span>
                                </>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Date */}
                      <div className="text-xs text-muted-foreground">
                        {format(new Date(order.created_at), 'dd/MM/yyyy HH:mm', { locale: ar })}
                      </div>

                      {/* Quick status + actions */}
                      <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                        <Select
                          value={order.status}
                          onValueChange={(value) => handleQuickStatusChange(order.id, value, order.status, order)}
                        >
                          <SelectTrigger className="flex-1 h-8 text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {getStatusOptionsForOrder(order, checkIfPreOrder).map((option) => (
                              <SelectItem key={option.value} value={option.value}>
                                {option.label}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0" onClick={() => openEditDialog(order)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-primary" onClick={() => { setSelectedOrderForMessage(order); setMessageDialogOpen(true); }}>
                          <MessageCircle className="h-4 w-4" />
                        </Button>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="icon" className="h-8 w-8 shrink-0 text-destructive">
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
                              <AlertDialogDescription>هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع المخزون والمبلغ المدفوع للزبون.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>تراجع</AlertDialogCancel>
                              <AlertDialogAction className="bg-destructive text-destructive-foreground hover:bg-destructive/90" onClick={() => deleteOrderMutation.mutate(order.id)}>إلغاء الطلب</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Desktop Table View */}
              <div ref={ordersTableScrollRef} className="admin-table-container overflow-x-auto hidden md:block">
                <Table className="min-w-[900px]">
                  <TableHeader>
                    <TableRow className="admin-table-header">
                      <TableHead>رقم الطلب</TableHead>
                      <TableHead>العميل</TableHead>
                      <TableHead>المحافظة</TableHead>
                      <TableHead>المبلغ</TableHead>
                      <TableHead>الحالة</TableHead>
                      <TableHead>تغيير سريع</TableHead>
                      <TableHead>نوع الشحن</TableHead>
                      <TableHead>التاريخ</TableHead>
                      <TableHead>الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pagination.paginatedItems.map((order) => {
                      const shippingInfo = getShippingInfo(order.order_items || []);
                      const isPreOrder = checkIfPreOrder(order.order_items || []);
                      const custIdx = getCustomerIndex(order);
                      const custColor = getCustomerColor(order);
                      return (
                        <TableRow key={order.id} className="admin-table-row" style={custIdx.total > 0 ? { boxShadow: `inset 4px 0 0 ${custColor}` } : undefined}>
                          <TableCell className="font-mono text-sm font-medium">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span>{order.order_number}</span>
                              <OrderNumberCopyButton orderNumber={order.order_number} />
                              {custIdx.total > 1 && (
                                <Badge
                                  variant="outline"
                                  className="text-[10px] gap-0.5"
                                  style={{ borderColor: custColor, color: custColor }}
                                  title="ترتيب الطلب لهذا العميل"
                                >
                                  طلب {custIdx.index} من {custIdx.total}
                                </Badge>
                              )}

                              {(() => {
                                const rfInfo = getRandomFilamentInfo(order);
                                if (rfInfo.total === 0) return null;
                                return (
                                  <Badge
                                    variant="outline"
                                    className="text-[10px] border-fuchsia-500/40 text-fuchsia-600 dark:text-fuchsia-300 gap-0.5"
                                    title={rfInfo.offerTitle ? `عرض: ${rfInfo.offerTitle}` : 'فلامنت عشوائي'}
                                  >
                                    🎲 عشوائي ×{rfInfo.total}
                                    {rfInfo.direct > 0 && rfInfo.preorder > 0 ? ' (مختلط)' : rfInfo.direct > 0 ? ' • مباشر' : ' • مسبق'}
                                  </Badge>
                                );
                              })()}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col">
                              <span className="font-medium">{order.profiles?.full_name || order.profiles?.username}</span>
                              <span className="text-xs text-muted-foreground">{order.phone_number}</span>
                            </div>
                          </TableCell>
                          <TableCell>{order.governorate}</TableCell>
                          <TableCell className="font-medium">{formatPrice(order.total_amount)}</TableCell>
                          <TableCell>{getStatusBadge(order.status)}</TableCell>
                          <TableCell>
                            <Select
                              value={order.status}
                              onValueChange={(value) => handleQuickStatusChange(order.id, value, order.status, order)}
                            >
                              <SelectTrigger className="w-[140px] h-8 text-xs">
                                <SelectValue />
                              </SelectTrigger>
                              <SelectContent>
                                {getStatusOptionsForOrder(order, checkIfPreOrder).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              {(order as any).order_type === 'direct' ? (
                                <>
                                  <Truck className="h-4 w-4 text-emerald-500" />
                                  <span className="text-xs font-bold text-emerald-600">بيع مباشر</span>
                                </>
                              ) : (
                                <>
                                  {shippingInfo.isFast ? (
                                    <Plane className="h-4 w-4 text-blue-500" />
                                  ) : (
                                    <Ship className="h-4 w-4 text-green-500" />
                                  )}
                                  <span className="text-xs">{isPreOrder ? 'طلب مسبق' : 'متوفر'}</span>
                                </>
                              )}
                            </div>
                          </TableCell>
                          <TableCell className="text-sm text-muted-foreground">
                            {format(new Date(order.created_at), 'dd/MM/yyyy', { locale: ar })}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => openEditDialog(order)}
                                title="تعديل الطلب"
                              >
                                <Pencil className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8 text-primary hover:text-primary"
                                onClick={() => {
                                  setSelectedOrderForMessage(order);
                                  setMessageDialogOpen(true);
                                }}
                                title="إرسال رسالة للزبون"
                              >
                                <MessageCircle className="h-4 w-4" />
                              </Button>
                              {isAdmin && (
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                  <Button
                                    variant="ghost"
                                    size="icon"
                                    className="h-8 w-8 text-destructive hover:text-destructive"
                                    title="حذف الطلب"
                                  >
                                    <Trash2 className="h-4 w-4" />
                                  </Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                  <AlertDialogHeader>
                                    <AlertDialogTitle>إلغاء الطلب</AlertDialogTitle>
                                    <AlertDialogDescription>
                                      هل أنت متأكد من إلغاء هذا الطلب؟ سيتم إرجاع المخزون والمبلغ المدفوع للزبون.
                                    </AlertDialogDescription>
                                  </AlertDialogHeader>
                                  <AlertDialogFooter>
                                    <AlertDialogCancel>تراجع</AlertDialogCancel>
                                    <AlertDialogAction
                                      className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                                      onClick={() => deleteOrderMutation.mutate(order.id)}
                                    >
                                      إلغاء الطلب
                                    </AlertDialogAction>
                                  </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                              )}
                            </div>
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
              
              {/* Pagination */}
              {pagination.showPagination && (
                <AdminPagination
                  currentPage={pagination.currentPage}
                  totalPages={pagination.totalPages}
                  totalItems={pagination.totalItems}
                  startIndex={pagination.startIndex}
                  endIndex={pagination.endIndex}
                  onPageChange={pagination.goToPage}
                  hasNextPage={pagination.hasNextPage}
                  hasPrevPage={pagination.hasPrevPage}
                />
              )}
            </>
          )}
        </AdminCard>
      </AdminSection>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent
          className="!max-w-4xl !overflow-hidden !max-h-none flex flex-col p-0 gap-0"
          style={{ height: 'min(92vh, 860px)' }}
          dir="rtl"
        >
          {editingOrder && (() => {
            // ===== Live customer-facing totals (driven by edit state, not stale order) =====
            const liveSubtotal = Number(subtotalAmount) || Number(editingOrder.subtotal) || 0;
            const liveDelivery = Number(deliveryFee) || 0;
            const liveTax = Number(taxAmount) || 0;
            const discountAmt = Number(editingOrder.discount_amount) || 0;
            const cardDiscountAmt = Number((editingOrder as any).card_discount_amount) || 0;
            const codFeeStored = Number(editingOrder.cod_fee) || 0;

            // Derive COD fee implicitly = totalAmount - subtotal - delivery - tax + discounts
            const liveCodFee = Math.max(
              0,
              Number(totalAmount) - liveSubtotal - liveDelivery - liveTax + discountAmt + cardDiscountAmt
            ) || codFeeStored;

            const liveCustomerTotal = Number(totalAmount) || (
              liveSubtotal + liveDelivery + liveTax + liveCodFee - discountAmt - cardDiscountAmt
            );
            const originalTotal = Number(editingOrder.total_amount) || 0;
            const totalDelta = liveCustomerTotal - originalTotal;

            const walletPaid =
              Number(editingOrder.customer_paid_amount) ||
              Number(editingOrder.paid_amount) ||
              0;
            const remainingAmt = Math.max(0, liveCustomerTotal - walletPaid);
            const isFullyPaid = walletPaid >= liveCustomerTotal && liveCustomerTotal > 0;

            const items = (editingOrder.order_items || []) as any[];
            const itemsCount = items.reduce((s, it) => s + (Number(it?.quantity) || 0), 0);
            const giftsCount = items
              .filter((it: any) => it?.is_gift)
              .reduce((s, it) => s + (Number(it?.quantity) || 0), 0);

            const paymentMethod = (editingOrder as any).payment_method || 'cash_on_delivery';
            const couponCode = (editingOrder as any).coupon_code || null;

            const orderType =
              editingOrder.order_type ||
              (checkIfPreOrder(editingOrder.order_items || []) ? 'preorder' : 'direct');
            const isDirectSale = orderType === 'direct';

            return (
              <>
                {/* ===== Sticky Pro Header ===== */}
                <div className="shrink-0 px-5 py-3 border-b border-border/40 bg-gradient-to-l from-primary/5 via-background to-background">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h2 className="text-base font-bold flex items-center gap-1.5">
                          <Pencil className="h-4 w-4 text-primary" />
                          تعديل الطلب
                        </h2>
                        <Badge variant="outline" className="font-mono text-[11px]">
                          {editingOrder.order_number}
                        </Badge>
                        {editingOrder.order_number && (
                          <OrderNumberCopyButton orderNumber={editingOrder.order_number} />
                        )}
                        <Badge variant="secondary" className="text-[10px]">
                          {isDirectSale ? 'بيع مباشر' : 'طلب مسبق'}
                        </Badge>
                      </div>
                      <p className="text-[11px] text-muted-foreground mt-1 truncate">
                        {editingOrder.profiles?.full_name || editingOrder.profiles?.username || 'زبون'}
                        {editingOrder.phone_number && <span className="mx-1">•</span>}
                        {editingOrder.phone_number}
                        {editingOrder.governorate && <span className="mx-1">•</span>}
                        {editingOrder.governorate}
                      </p>
                    </div>

                    {/* Live Customer Total */}
                    <div className="rounded-xl border-2 border-primary/40 bg-gradient-to-br from-primary/10 to-primary/5 px-3 py-2 min-w-[180px]">
                      <div className="text-[10px] text-muted-foreground font-medium flex items-center gap-1">
                        <Wallet className="h-3 w-3" />
                        المجموع الذي سيراه الزبون
                      </div>
                      <div className="text-xl font-extrabold text-primary leading-tight">
                        {formatPrice(liveCustomerTotal)}
                        <span className="text-[10px] font-normal mx-1">د.ع</span>
                      </div>
                      {Math.abs(totalDelta) > 0 && (
                        <div
                          className={`text-[10px] font-bold ${
                            totalDelta > 0 ? 'text-amber-600' : 'text-emerald-600'
                          }`}
                        >
                          {totalDelta > 0 ? '▲' : '▼'} {formatPrice(Math.abs(totalDelta))} د.ع عن الأصلي
                        </div>
                      )}
                    </div>
                  </div>
                </div>

                {/* ===== Tabs Body ===== */}
                <Tabs defaultValue={isAdmin ? "finance" : "status"} className="flex-1 flex flex-col min-h-0">
                  <TabsList className={`shrink-0 mx-4 mt-3 grid ${isAdmin ? 'grid-cols-5' : 'grid-cols-4'} h-9`}>
                    {isAdmin && (
                      <TabsTrigger value="finance" className="text-[11px] gap-1">
                        <Wallet className="h-3.5 w-3.5" />
                        المالية
                      </TabsTrigger>
                    )}
                    <TabsTrigger value="status" className="text-[11px] gap-1">
                      <Truck className="h-3.5 w-3.5" />
                      الحالة
                    </TabsTrigger>
                    <TabsTrigger value="items" className="text-[11px] gap-1">
                      <Package className="h-3.5 w-3.5" />
                      المنتجات
                    </TabsTrigger>
                    <TabsTrigger value="files" className="text-[11px] gap-1">
                      <Upload className="h-3.5 w-3.5" />
                      المرفقات
                    </TabsTrigger>
                    <TabsTrigger value="notes" className="text-[11px] gap-1">
                      <MessageCircle className="h-3.5 w-3.5" />
                      ملاحظات
                    </TabsTrigger>
                  </TabsList>


                  <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* ============ FINANCE TAB ============ */}
                    {isAdmin && <TabsContent value="finance" className="mt-0 space-y-4">
                      {/* Editable financial inputs */}
                      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                        <h4 className="text-xs font-bold flex items-center gap-1.5">
                          <Pencil className="h-3.5 w-3.5 text-primary" />
                          الحقول القابلة للتعديل
                        </h4>
                        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px]">المجموع الإجمالي (للزبون)</Label>
                            <Input
                              type="number"
                              value={totalAmount}
                              onChange={(e) => setTotalAmount(Number(e.target.value))}
                              className="h-9 text-sm font-bold"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">رسوم التوصيل</Label>
                            <Input
                              type="number"
                              value={deliveryFee}
                              onChange={(e) => setDeliveryFee(Number(e.target.value))}
                              className="h-9 text-sm"
                            />
                            <p className="text-[9px] text-muted-foreground">لا يُحسب من الأرباح</p>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">تكلفة المنتجات</Label>
                            <Input
                              type="number"
                              value={adminProductCost}
                              onChange={(e) => setAdminProductCost(Number(e.target.value))}
                              className="h-9 text-sm"
                            />
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">الربح المتوقع</Label>
                            <Input
                              type="number"
                              value={calculatedProfit}
                              readOnly
                              className={`h-9 text-sm font-bold ${
                                calculatedProfit >= 0 ? 'text-emerald-600' : 'text-red-500'
                              }`}
                            />
                          </div>
                        </div>
                      </div>

                      {/* Customer-facing preview */}
                      <div className="rounded-xl border-2 border-primary/30 bg-gradient-to-b from-primary/5 to-transparent p-4">
                        <h4 className="text-xs font-bold text-foreground flex items-center gap-1.5 mb-3">
                          <Wallet className="h-3.5 w-3.5 text-primary" />
                          معاينة الفاتورة كما يراها الزبون
                          <Badge variant="outline" className="text-[9px] mr-auto">مباشر</Badge>
                        </h4>

                        <div className="space-y-1.5 text-sm">
                          <div className="flex justify-between items-center text-[11px] text-muted-foreground">
                            <span>عدد القطع</span>
                            <span>
                              {itemsCount}
                              {giftsCount > 0 && (
                                <span className="text-emerald-600 mx-1">
                                  (منها {giftsCount} هدية 🎁)
                                </span>
                              )}
                            </span>
                          </div>

                          <div className="flex justify-between items-center">
                            <span className="text-muted-foreground">سعر المنتجات</span>
                            <span className="font-medium">{formatPrice(liveSubtotal)}</span>
                          </div>

                          {liveCodFee > 0 && (
                            <div className="flex justify-between items-center text-amber-600">
                              <span>عمولة الدفع عند الاستلام</span>
                              <span className="font-medium">{formatPrice(liveCodFee)}</span>
                            </div>
                          )}

                          {liveDelivery > 0 ? (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">رسوم التوصيل</span>
                              <span className="font-medium">{formatPrice(liveDelivery)}</span>
                            </div>
                          ) : (
                            <div className="flex justify-between items-center text-emerald-600">
                              <span>التوصيل</span>
                              <span className="font-bold">مجاني</span>
                            </div>
                          )}

                          {liveTax > 0 && (
                            <div className="flex justify-between items-center">
                              <span className="text-muted-foreground">ضريبة</span>
                              <span className="font-medium">{formatPrice(liveTax)}</span>
                            </div>
                          )}

                          {discountAmt > 0 && (
                            <div className="flex justify-between items-center text-red-500">
                              <span>خصم {couponCode ? `(${couponCode})` : '(كوبون)'}</span>
                              <span className="font-medium">- {formatPrice(discountAmt)}</span>
                            </div>
                          )}

                          {cardDiscountAmt > 0 && (
                            <div className="flex justify-between items-center text-amber-600">
                              <span>💳 خصم بطاقة {(editingOrder as any).card_discount_level_name || 'ولاء'}</span>
                              <span className="font-medium">- {formatPrice(cardDiscountAmt)}</span>
                            </div>
                          )}

                          <div className="border-t border-border/40 my-2" />

                          <div className="flex justify-between items-center font-extrabold text-lg bg-primary/10 rounded-lg px-3 py-2">
                            <span>المجموع النهائي للزبون</span>
                            <span className="text-primary">{formatPrice(liveCustomerTotal)}</span>
                          </div>

                          {walletPaid > 0 && (
                            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 p-2 mt-2">
                              <div className="flex justify-between items-center text-emerald-700 text-xs font-bold">
                                <span>💳 مدفوع من المحفظة</span>
                                <span>- {formatPrice(walletPaid)}</span>
                              </div>
                            </div>
                          )}

                          <div className="text-[10px] text-muted-foreground flex justify-between mt-1">
                            <span>طريقة الدفع</span>
                            <span className="font-medium">
                              {paymentMethod === 'wallet'
                                ? 'محفظة'
                                : paymentMethod === 'cash_on_delivery'
                                ? 'الدفع عند الاستلام'
                                : paymentMethod}
                            </span>
                          </div>

                          {/* Slip amount */}
                          <div
                            className={`mt-3 rounded-xl border-2 p-3 ${
                              isFullyPaid
                                ? 'border-emerald-500/60 bg-emerald-500/10'
                                : 'border-amber-500/60 bg-amber-500/10'
                            }`}
                          >
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-1.5 text-xs font-bold">
                                <Truck className="h-4 w-4" />
                                <span>
                                  {isFullyPaid
                                    ? 'مدفوع بالكامل — لا يطلب من الزبون'
                                    : 'المبلغ المطلوب على ورقة التوصيل'}
                                </span>
                              </div>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                className="h-7 px-2 text-[10px]"
                                onClick={() => {
                                  navigator.clipboard.writeText(String(remainingAmt));
                                  toast.success('تم نسخ المبلغ');
                                }}
                              >
                                نسخ
                              </Button>
                            </div>
                            <div
                              className={`text-2xl font-extrabold mt-1 text-center ${
                                isFullyPaid ? 'text-emerald-700' : 'text-amber-700'
                              }`}
                            >
                              {isFullyPaid ? '✓ 0 د.ع' : `${formatPrice(remainingAmt)} د.ع`}
                            </div>
                          </div>
                        </div>
                      </div>

                      {/* Wallet audit log */}
                      <OrderWalletAuditLog orderId={editingOrder.id} formatPrice={formatPrice} />
                    </TabsContent>}

                    {/* ============ STATUS TAB ============ */}
                    <TabsContent value="status" className="mt-0 space-y-4">
                      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-3">
                        <h4 className="text-xs font-bold flex items-center gap-1.5">
                          <Truck className="h-3.5 w-3.5 text-primary" />
                          حالة الطلب والدفع
                        </h4>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="space-y-1">
                            <Label className="text-[11px]">حالة الطلب</Label>
                            <Select value={editStatus} onValueChange={setEditStatus}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="اختر الحالة" />
                              </SelectTrigger>
                              <SelectContent>
                                {getStatusOptionsForOrder(editingOrder, checkIfPreOrder).map((option) => (
                                  <SelectItem key={option.value} value={option.value}>
                                    {option.label}
                                  </SelectItem>
                                ))}
                              </SelectContent>
                            </Select>
                          </div>
                          <div className="space-y-1">
                            <Label className="text-[11px]">حالة الدفع</Label>
                            <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                              <SelectTrigger className="h-9">
                                <SelectValue placeholder="اختر حالة الدفع" />
                              </SelectTrigger>
                              <SelectContent>
                                <SelectItem value="cod">الدفع عند الاستلام</SelectItem>
                                <SelectItem value="pending">قيد الانتظار</SelectItem>
                                <SelectItem value="partial">دفع جزئي</SelectItem>
                                <SelectItem value="paid">مدفوع</SelectItem>
                                <SelectItem value="refunded">مسترجع</SelectItem>
                              </SelectContent>
                            </Select>
                          </div>
                          {!isDirectSale && (
                            <div className="space-y-1">
                              <Label className="text-[11px] flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                التاريخ المتوقع للوصول
                              </Label>
                              <Input
                                type="date"
                                value={editEstimatedDeliveryDate}
                                onChange={(e) => setEditEstimatedDeliveryDate(e.target.value)}
                                className="h-9"
                              />
                            </div>
                          )}
                        </div>
                      </div>
                    </TabsContent>

                    {/* ============ ITEMS TAB ============ */}
                    <TabsContent value="items" className="mt-0 space-y-3">
                      <div className="rounded-xl border border-border/60 bg-card/50 p-4">
                        <p className="text-xs text-muted-foreground mb-3 leading-relaxed">
                          افتح محرر المنتجات لإضافة، حذف، تعديل الكميات أو الألوان مع مزامنة المخزون تلقائياً.
                        </p>
                        <Button
                          variant="default"
                          className="w-full gap-2"
                          onClick={() => setItemEditorOpen(true)}
                        >
                          <Package className="h-4 w-4" />
                          فتح محرر المنتجات والمخزون
                        </Button>
                      </div>

                      {/* Quick items preview */}
                      {items.length > 0 && (
                        <div className="rounded-xl border border-border/40 bg-muted/20 p-3 space-y-2">
                          <h5 className="text-[11px] font-bold text-muted-foreground">
                            المنتجات الحالية ({items.length})
                          </h5>
                          <div className="space-y-1.5 max-h-[280px] overflow-y-auto">
                            {items.map((it: any, idx: number) => (
                              <div
                                key={idx}
                                className="flex items-center justify-between text-xs bg-background/60 rounded-lg px-2 py-1.5"
                              >
                                <div className="flex items-center gap-2 min-w-0">
                                  {it.is_gift && <Gift className="h-3 w-3 text-emerald-600 shrink-0" />}
                                  <span className="truncate">
                                    {it.products?.name_ar || it.product_name || 'منتج'}
                                  </span>
                                </div>
                                <div className="flex items-center gap-2 shrink-0">
                                  <Badge variant="outline" className="text-[10px] h-5">
                                    × {it.quantity}
                                  </Badge>
                                  <span className="font-medium">
                                    {formatPrice(Number(it.total_price) || 0)}
                                  </span>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </TabsContent>

                    {/* ============ FILES TAB ============ */}
                    <TabsContent value="files" className="mt-0 space-y-4">
                      <div className="rounded-xl border border-border/60 bg-card/50 p-4 space-y-4">
                        <h4 className="text-xs font-bold flex items-center gap-1.5">
                          <Upload className="h-3.5 w-3.5 text-primary" />
                          صور وملفات الإدارة
                        </h4>

                        {/* Serial */}
                        <div className="space-y-2">
                          <Label className="text-[11px]">صورة الرقم التسلسلي</Label>
                          <div className="flex items-center gap-2">
                            <Input
                              type="file"
                              accept="image/*"
                              className="flex-1 h-9"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  setSerialImageFile(file);
                                  setSerialImagePreview(URL.createObjectURL(file));
                                }
                              }}
                            />
                            {serialImagePreview && (
                              <div className="relative">
                                <img src={serialImagePreview} alt="Serial" className="w-12 h-12 object-cover rounded" />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-5 w-5"
                                  onClick={() => {
                                    setSerialImageFile(null);
                                    setSerialImagePreview('');
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Admin images */}
                        <div className="space-y-2">
                          <Label className="text-[11px]">صور إضافية</Label>
                          <Input
                            type="file"
                            accept="image/*"
                            multiple
                            className="h-9"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setAdminImageFiles([...adminImageFiles, ...files]);
                              const previews = files.map((f) => URL.createObjectURL(f));
                              setAdminImagePreviews([...adminImagePreviews, ...previews]);
                            }}
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {existingAdminImages.map((url, idx) => (
                              <div key={`existing-${idx}`} className="relative">
                                <img src={url} alt={`Admin ${idx}`} className="w-16 h-16 object-cover rounded" />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-5 w-5"
                                  onClick={() =>
                                    setExistingAdminImages(existingAdminImages.filter((_, i) => i !== idx))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                            {adminImagePreviews.map((url, idx) => (
                              <div key={`new-${idx}`} className="relative">
                                <img src={url} alt={`New ${idx}`} className="w-16 h-16 object-cover rounded border-2 border-primary" />
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="destructive"
                                  className="absolute -top-2 -right-2 h-5 w-5"
                                  onClick={() => {
                                    setAdminImageFiles(adminImageFiles.filter((_, i) => i !== idx));
                                    setAdminImagePreviews(adminImagePreviews.filter((_, i) => i !== idx));
                                  }}
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </div>
                            ))}
                          </div>
                        </div>

                        {/* Admin files */}
                        <div className="space-y-2">
                          <Label className="text-[11px]">ملفات مرفقة (PDF, DOC...)</Label>
                          <Input
                            type="file"
                            accept=".pdf,.doc,.docx,.xls,.xlsx"
                            multiple
                            className="h-9"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              setAdminFilesArray([...adminFilesArray, ...files]);
                            }}
                          />
                          <div className="flex flex-wrap gap-2 mt-2">
                            {existingAdminFiles.map((url, idx) => (
                              <Badge key={`existing-file-${idx}`} variant="secondary" className="gap-1">
                                <a
                                  href={url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs"
                                >
                                  ملف {idx + 1}
                                </a>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-4 w-4 p-0"
                                  onClick={() =>
                                    setExistingAdminFiles(existingAdminFiles.filter((_, i) => i !== idx))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                            {adminFilesArray.map((file, idx) => (
                              <Badge key={`new-file-${idx}`} variant="outline" className="gap-1 border-primary">
                                <span className="text-xs">{file.name}</span>
                                <Button
                                  type="button"
                                  size="icon"
                                  variant="ghost"
                                  className="h-4 w-4 p-0"
                                  onClick={() =>
                                    setAdminFilesArray(adminFilesArray.filter((_, i) => i !== idx))
                                  }
                                >
                                  <X className="h-3 w-3" />
                                </Button>
                              </Badge>
                            ))}
                          </div>
                        </div>
                      </div>
                    </TabsContent>

                    {/* ============ NOTES TAB ============ */}
                    <TabsContent value="notes" className="mt-0 space-y-3">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[11px]">ملاحظات داخلية (للإدارة فقط)</Label>
                          <Textarea
                            value={editInternalNotes}
                            onChange={(e) => setEditInternalNotes(e.target.value)}
                            placeholder="ملاحظات للإدارة فقط..."
                            rows={6}
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[11px]">ملاحظات الشحن</Label>
                          <Textarea
                            value={editShippingNotes}
                            onChange={(e) => setEditShippingNotes(e.target.value)}
                            placeholder="ملاحظات خاصة بالشحن..."
                            rows={6}
                          />
                        </div>
                      </div>
                    </TabsContent>
                  </div>
                </Tabs>

                {/* ===== Sticky Footer ===== */}
                <div className="shrink-0 border-t border-border/40 bg-background/95 backdrop-blur px-5 py-3 flex items-center justify-between gap-3">
                  <div className="text-[11px] text-muted-foreground">
                    سيظهر للزبون:{' '}
                    <span className="font-bold text-foreground">
                      {formatPrice(liveCustomerTotal)} د.ع
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDialogOpen(false)}>
                      إلغاء
                    </Button>
                    <Button
                      size="sm"
                      onClick={handleSaveOrder}
                      disabled={updateOrderMutation.isPending}
                      className="gap-2"
                    >
                      {updateOrderMutation.isPending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Save className="h-4 w-4" />
                      )}
                      حفظ التغييرات
                    </Button>
                  </div>
                </div>
              </>
            );
          })()}
        </DialogContent>
      </Dialog>
        </TabsContent>

        <TabsContent value="offer-purchases">
          <OfferPurchasesTab />
        </TabsContent>
      </Tabs>

      {/* Chat Dialog - Opens real conversation */}
      {selectedOrderForMessage && (
        <AdminOrderChatDialog
          open={messageDialogOpen}
          onOpenChange={(open) => {
            setMessageDialogOpen(open);
            if (!open) setSelectedOrderForMessage(null);
          }}
          orderId={selectedOrderForMessage.id}
          orderNumber={selectedOrderForMessage.order_number}
          userId={selectedOrderForMessage.user_id}
          customerName={selectedOrderForMessage.profiles?.full_name || selectedOrderForMessage.profiles?.username || 'زبون'}
          initialOrderData={selectedOrderForMessage}
        />
      )}

      {/* Order Item Editor */}
      {editingOrder && (
        <AdminOrderItemEditor
          open={itemEditorOpen}
          onOpenChange={setItemEditorOpen}
          orderId={editingOrder.id}
          orderItems={editingOrder.order_items || []}
          onSaved={(updated) => {
            queryClient.invalidateQueries({ queryKey: ['admin-orders'] });
            if (updated && editingOrder) {
              // Update local editingOrder so the financial summary refreshes immediately
              setEditingOrder({
                ...editingOrder,
                subtotal: updated.subtotal,
                total_amount: updated.total_amount,
                order_items: updated.items as any,
              });
              setSubtotalAmount(updated.subtotal);
              setTotalAmount(updated.total_amount);
            }
          }}
        />
      )}

    </AdminLayout>
  );
};

export default AdminOrders;
