import { useState, useEffect, memo, useCallback, Fragment } from 'react';
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
import { Loader2, Package, Truck, ExternalLink, Calendar, Pencil, Search, Trash2, Plus, Upload, X, Ship, Plane, ShoppingBag, Save, Gift, MessageCircle, CheckCircle, Eye, Copy } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';
import AdminCreateOrderDialog from '@/components/admin/AdminCreateOrderDialog';
import LevelBadge from '@/components/LevelBadge';
import AdminLayout, { AdminSection, AdminCard, AdminCardHeader, AdminCardContent, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import AdminPagination from '@/components/admin/AdminPagination';
import { usePagination } from '@/hooks/usePagination';
import OfferPurchasesTab from '@/components/admin/OfferPurchasesTab';
import AdminOrderChatDialog from '@/components/admin/AdminOrderChatDialog';
import { sendAllNotifications } from '@/lib/notifications';
import { ADMIN_ROUTES } from '@/config/adminConfig';

const directStatusOptions = [
  { value: 'pending', label: 'قيد الانتظار' },
  { value: 'confirmed', label: 'تم التأكيد' },
  { value: 'processing', label: 'قيد التجهيز' },
  { value: 'shipped', label: 'تم الشحن' },
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
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('orders');
  const [editingOrder, setEditingOrder] = useState<any>(null);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [messageDialogOpen, setMessageDialogOpen] = useState(false);
  const [selectedOrderForMessage, setSelectedOrderForMessage] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [shippingTypeFilter, setShippingTypeFilter] = useState<string>('all');
  const [orderTypeFilter, setOrderTypeFilter] = useState<string>('all');
  const [searchParams] = useSearchParams();
  const [uploadingImage, setUploadingImage] = useState(false);
  const [serialImageFile, setSerialImageFile] = useState<File | null>(null);
  const [adminImageFiles, setAdminImageFiles] = useState<File[]>([]);
  const [adminFilesArray, setAdminFilesArray] = useState<File[]>([]);
  const [adminImagePreviews, setAdminImagePreviews] = useState<string[]>([]);
  const [existingAdminImages, setExistingAdminImages] = useState<string[]>([]);
  const [existingAdminFiles, setExistingAdminFiles] = useState<string[]>([]);
  const [serialImagePreview, setSerialImagePreview] = useState<string>('');
  const [quickViewOrder, setQuickViewOrder] = useState<any>(null);
  
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
  
  // Calculate profit dynamically
  // Profit = total_amount - delivery_fee - admin_product_cost (delivery fee is NOT profit)
  const calculatedProfit = totalAmount - deliveryFee - adminProductCost;
  
  useEffect(() => {
    const status = searchParams.get('status');
    if (status) setStatusFilter(status);
  }, [searchParams]);

  const { data: orders, isLoading } = useQuery({
    queryKey: ['admin-orders', isAdmin],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select(`
          *,
          profiles(full_name, email, username),
          order_items!order_items_order_id_fkey(id, product_id, product_name_ar, product_name, quantity, unit_price, total_price, cost_price, selected_color, selected_option, color_image_url, option_image_url, shipping_option_name_ar, custom_request_id, sale_type, products!order_items_product_id_fkey(cost_price))
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin,
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
      const { data: order, error: orderError } = await supabase
        .from('orders')
        .select(`
          *,
          order_items!order_items_order_id_fkey(
            *,
            products!order_items_product_id_fkey(name_ar, image_url),
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
              <li>${item.product_name_ar} - الكمية: ${item.quantity} - السعر: ${item.total_price}</li>
            `).join('') || ''}
          </ul>
          <hr/>
          <p><strong>المجموع: ${order.total_amount} ${order.currency}</strong></p>
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
      const { error } = await supabase
        .from('orders')
        .update(values)
        .eq('id', id);

      if (error) throw error;
      
      // Auto-create invoice when order is confirmed
      if (values.status === 'confirmed' && previousStatus !== 'confirmed') {
        await createAutoInvoice(id);
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
        
        await sendAllNotifications({
          userId: order.user_id,
          title: 'تحديث حالة طلبك 📦',
          message: `تم تحديث حالة طلبك رقم ${order.order_number} إلى: ${statusLabel}`,
          type: values.status === 'delivered' ? 'success' : 'info',
          relatedId: id,
        });
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

      const { data, error } = await supabase
        .from('orders')
        .insert([{
          ...values,
          order_number: orderNumber,
          status: values.status || 'pending',
          currency: values.currency || 'دينار عراقي',
        }])
        .select()
        .single();

      if (error) throw error;
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
      
      const { error: updateError } = await supabase
        .from('orders')
        .update({
          status: 'cancelled',
          payment_status: 'refunded',
          updated_at: new Date().toISOString()
        })
        .eq('id', order.id);

      if (updateError) throw updateError;

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
    
    // For direct sale: auto-calculate product cost from order_items cost_price (from products)
    if (isDirectSale && (!order.admin_product_cost || order.admin_product_cost === 0)) {
      const items = order.order_items || [];
      let totalCost = 0;
      for (const item of items) {
        // Use cost_price from products table, fallback to order_item cost_price
        const itemCost = item.products?.cost_price || item.cost_price || 0;
        totalCost += itemCost * (item.quantity || 1);
      }
      setAdminProductCost(totalCost);
    } else {
      setAdminProductCost(order.admin_product_cost || 0);
    }
    
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

  // Filter orders
  const filteredOrders = orders?.filter(order => {
    const matchesSearch = 
      order.order_number?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.profiles?.username?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      order.phone_number?.includes(searchTerm);

    // When 'all' is selected, hide cancelled orders. Show them only via 'cancelled' filter.
    const matchesStatus = statusFilter === 'all' 
      ? order.status !== 'cancelled'
      : statusFilter === 'active'
        ? !['delivered', 'cancelled'].includes(order.status)
        : order.status === statusFilter;
    
    // Shipping type filter
    const shippingInfo = getShippingInfo(order.order_items || []);
    const isAirShipping = shippingInfo.isFast;
    const matchesShippingType = 
      shippingTypeFilter === 'all' || 
      (shippingTypeFilter === 'air' && isAirShipping) ||
      (shippingTypeFilter === 'sea' && !isAirShipping);
    
    // Order type filter - use order_type column if available
    const orderType = (order as any).order_type || (checkIfPreOrder(order.order_items || []) ? 'preorder' : 'direct');
    const matchesOrderType = 
      orderTypeFilter === 'all' || 
      (orderTypeFilter === 'preorder' && orderType === 'preorder') ||
      (orderTypeFilter === 'direct' && orderType === 'direct');

    return matchesSearch && matchesStatus && matchesShippingType && matchesOrderType;
  }) || [];

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

  if (!isAdmin) {
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
          {/* Stats Grid */}
          <AdminStatsGrid>
            <AdminStatCard
              icon={<Package className="h-5 w-5" />}
              value={orders?.length || 0}
              label="إجمالي الطلبات"
            />
            <AdminStatCard
              icon={<Loader2 className="h-5 w-5" />}
              value={statusCounts['pending'] || 0}
              label="قيد الانتظار"
              colorClass="text-amber-500"
              bgClass="bg-amber-500/10"
            />
            <AdminStatCard
              icon={<Truck className="h-5 w-5" />}
              value={statusCounts['shipped'] || 0}
              label="تم الشحن"
              colorClass="text-blue-500"
              bgClass="bg-blue-500/10"
            />
            <AdminStatCard
              icon={<ShoppingBag className="h-5 w-5" />}
              value={statusCounts['delivered'] || 0}
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
              <div className="flex flex-col md:flex-row gap-4">
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
                
                {/* Shipping Type Filter */}
                <Select value={shippingTypeFilter} onValueChange={(v) => { setShippingTypeFilter(v); pagination.resetPage(); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="نوع الشحن" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الشحنات</SelectItem>
                    <SelectItem value="air">
                      <span className="flex items-center gap-2">
                        <Plane className="h-4 w-4" />
                        شحن جوي
                      </span>
                    </SelectItem>
                    <SelectItem value="sea">
                      <span className="flex items-center gap-2">
                        <Ship className="h-4 w-4" />
                        شحن بحري
                      </span>
                    </SelectItem>
                  </SelectContent>
                </Select>
                
                {/* Order Type Filter */}
                <Select value={orderTypeFilter} onValueChange={(v) => { setOrderTypeFilter(v); pagination.resetPage(); }}>
                  <SelectTrigger className="w-[150px]">
                    <SelectValue placeholder="نوع الطلب" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">كل الطلبات</SelectItem>
                    <SelectItem value="preorder">طلب مسبق</SelectItem>
                    <SelectItem value="direct">طلب مباشر</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              
              {/* Status Filters */}
              <div className="flex gap-2 flex-wrap">
                <Button
                  variant={statusFilter === 'active' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('active'); pagination.resetPage(); }}
                >
                  النشطة ({orders?.filter(o => !['delivered', 'cancelled'].includes(o.status)).length || 0})
                </Button>
                <Button
                  variant={statusFilter === 'all' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('all'); pagination.resetPage(); }}
                >
                  الكل ({orders?.length || 0})
                </Button>
                <Button
                  variant={statusFilter === 'pending' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('pending'); pagination.resetPage(); }}
                >
                  قيد الانتظار ({statusCounts['pending'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'confirmed' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('confirmed'); pagination.resetPage(); }}
                >
                  تم التأكيد ({statusCounts['confirmed'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'processing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('processing'); pagination.resetPage(); }}
                >
                  قيد المعالجة ({statusCounts['processing'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'shipped' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('shipped'); pagination.resetPage(); }}
                >
                  تم الشحن ({statusCounts['shipped'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'delivered' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('delivered'); pagination.resetPage(); }}
                >
                  تم التوصيل ({statusCounts['delivered'] || 0})
                </Button>
                <Button
                  variant={statusFilter === 'cancelled' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => { setStatusFilter('cancelled'); pagination.resetPage(); }}
                  className="text-destructive"
                >
                  ملغي ({statusCounts['cancelled'] || 0})
                </Button>
              </div>
            </div>
          </AdminCardContent>
        </AdminCard>
      </AdminSection>

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
              <div className="admin-table-container overflow-x-auto">
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
                      
                      return (
                        <TableRow key={order.id} className="admin-table-row">
                          <TableCell className="font-mono text-sm font-medium">
                            {order.order_number}
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
                                onClick={() => setQuickViewOrder(order)}
                                title="عرض المنتجات"
                              >
                                <Eye className="h-4 w-4" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-8 w-8"
                                onClick={() => navigate(`/order/${order.id}`)}
                                title="عرض التفاصيل"
                              >
                                <ExternalLink className="h-4 w-4" />
                              </Button>
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
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل الطلب {editingOrder?.order_number}</DialogTitle>
          </DialogHeader>
          
          {editingOrder && (
            <div className="space-y-6 py-4">
              {/* Order Info */}
              <div className="grid grid-cols-2 gap-4 p-4 bg-muted/30 rounded-lg">
                <div>
                  <span className="text-sm text-muted-foreground">العميل:</span>
                  <p className="font-medium">{editingOrder.profiles?.full_name || editingOrder.profiles?.username}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">الهاتف:</span>
                  <p className="font-medium">{editingOrder.phone_number}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">المحافظة:</span>
                  <p className="font-medium">{editingOrder.governorate}</p>
                </div>
                <div>
                  <span className="text-sm text-muted-foreground">المبلغ:</span>
                  <p className="font-medium">{formatPrice(editingOrder.total_amount)}</p>
                </div>
              </div>

              {/* Status */}
              {(() => {
                const orderType = editingOrder.order_type || (checkIfPreOrder(editingOrder.order_items || []) ? 'preorder' : 'direct');
                const isDirectSale = orderType === 'direct';
                return (
                  <>
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                      <div className="space-y-2">
                        <Label>حالة الطلب</Label>
                        <Select value={editStatus} onValueChange={setEditStatus}>
                          <SelectTrigger>
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
                      <div className="space-y-2">
                        <Label>حالة الدفع</Label>
                        <Select value={editPaymentStatus} onValueChange={setEditPaymentStatus}>
                          <SelectTrigger>
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
                        <div className="space-y-2">
                          <Label className="flex items-center gap-2">
                            <Calendar className="h-4 w-4" />
                            التاريخ المتوقع للوصول
                          </Label>
                          <Input
                            type="date"
                            value={editEstimatedDeliveryDate}
                            onChange={(e) => setEditEstimatedDeliveryDate(e.target.value)}
                          />
                        </div>
                      )}
                    </div>

                    {/* Financial */}
                    <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                      <div className="space-y-2">
                        <Label>المبلغ الإجمالي</Label>
                        <Input
                          type="number"
                          value={totalAmount}
                          onChange={(e) => setTotalAmount(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>سعر التوصيل</Label>
                        <Input
                          type="number"
                          value={deliveryFee}
                          onChange={(e) => setDeliveryFee(Number(e.target.value))}
                        />
                        <p className="text-[10px] text-muted-foreground">لا يُحسب من الأرباح</p>
                      </div>
                      <div className="space-y-2">
                        <Label>تكلفة المنتجات</Label>
                        <Input
                          type="number"
                          value={adminProductCost}
                          onChange={(e) => setAdminProductCost(Number(e.target.value))}
                        />
                      </div>
                      <div className="space-y-2">
                        <Label>الربح المتوقع</Label>
                        <Input
                          type="number"
                          value={calculatedProfit}
                          readOnly
                          className={calculatedProfit >= 0 ? 'text-green-500' : 'text-red-500'}
                        />
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Admin Images and Files */}
              <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
                <h4 className="font-medium text-sm">صور وملفات الإدارة</h4>
                
                {/* Serial Number Image */}
                <div className="space-y-2">
                  <Label>صورة الرقم التسلسلي</Label>
                  <div className="flex items-center gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={(e) => {
                        const file = e.target.files?.[0];
                        if (file) {
                          setSerialImageFile(file);
                          setSerialImagePreview(URL.createObjectURL(file));
                        }
                      }}
                      className="flex-1"
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

                {/* Admin Images */}
                <div className="space-y-2">
                  <Label>صور إضافية</Label>
                  <Input
                    type="file"
                    accept="image/*"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAdminImageFiles([...adminImageFiles, ...files]);
                      const previews = files.map(f => URL.createObjectURL(f));
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
                          onClick={() => setExistingAdminImages(existingAdminImages.filter((_, i) => i !== idx))}
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

                {/* Admin Files */}
                <div className="space-y-2">
                  <Label>ملفات مرفقة (PDF, DOC...)</Label>
                  <Input
                    type="file"
                    accept=".pdf,.doc,.docx,.xls,.xlsx"
                    multiple
                    onChange={(e) => {
                      const files = Array.from(e.target.files || []);
                      setAdminFilesArray([...adminFilesArray, ...files]);
                    }}
                  />
                  <div className="flex flex-wrap gap-2 mt-2">
                    {existingAdminFiles.map((url, idx) => (
                      <Badge key={`existing-file-${idx}`} variant="secondary" className="gap-1">
                        <a href={url} target="_blank" rel="noopener noreferrer" className="text-xs">ملف {idx + 1}</a>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-4 w-4 p-0"
                          onClick={() => setExistingAdminFiles(existingAdminFiles.filter((_, i) => i !== idx))}
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
                          onClick={() => setAdminFilesArray(adminFilesArray.filter((_, i) => i !== idx))}
                        >
                          <X className="h-3 w-3" />
                        </Button>
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>

              {/* Notes */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>ملاحظات داخلية</Label>
                  <Textarea
                    value={editInternalNotes}
                    onChange={(e) => setEditInternalNotes(e.target.value)}
                    placeholder="ملاحظات للإدارة فقط..."
                    rows={3}
                  />
                </div>
                <div className="space-y-2">
                  <Label>ملاحظات الشحن</Label>
                  <Textarea
                    value={editShippingNotes}
                    onChange={(e) => setEditShippingNotes(e.target.value)}
                    placeholder="ملاحظات خاصة بالشحن..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
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
          </DialogFooter>
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
        />
      )}

      {/* Quick View Dialog */}
      <Dialog open={!!quickViewOrder} onOpenChange={(open) => !open && setQuickViewOrder(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-right">
              <Eye className="h-5 w-5 text-primary" />
              منتجات الطلب {quickViewOrder?.order_number}
            </DialogTitle>
          </DialogHeader>
          {quickViewOrder && (
            <div className="space-y-3 max-h-[60vh] overflow-y-auto">
              {/* Customer Info with copy */}
              <div className="rounded-lg border border-border bg-muted/30 p-3 space-y-1.5 text-sm">
                <div className="flex items-center gap-2">
                  <span className="text-muted-foreground">👤</span>
                  <span className="font-medium flex-1">{quickViewOrder.profiles?.full_name || quickViewOrder.profiles?.username}</span>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">📞</span>
                  <span className="flex-1 text-xs">{quickViewOrder.phone_number}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(quickViewOrder.phone_number || ''); toast.success('تم نسخ الرقم'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
                <div className="flex items-center gap-1">
                  <span className="text-muted-foreground">📍</span>
                  <span className="flex-1 text-xs">{quickViewOrder.shipping_address || quickViewOrder.governorate || '-'}</span>
                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => { navigator.clipboard.writeText(quickViewOrder.shipping_address || quickViewOrder.governorate || ''); toast.success('تم نسخ العنوان'); }}>
                    <Copy className="h-3 w-3" />
                  </Button>
                </div>
              </div>

              {/* Products */}
              <div className="space-y-2">
                {(quickViewOrder.order_items || []).map((item: any) => (
                  <div key={item.id} className="flex items-center gap-3 rounded-lg border border-border p-2.5">
                    {item.color_image_url && (
                      <img src={item.color_image_url} className="w-12 h-12 rounded-lg object-cover border border-border" alt="" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-foreground truncate">{item.product_name_ar}</p>
                      <div className="flex flex-wrap gap-1 mt-1">
                        {item.selected_color && (
                          <Badge variant="outline" className="text-[10px] px-1.5">{item.selected_color}</Badge>
                        )}
                        {item.selected_option && (
                          <Badge variant="outline" className="text-[10px] px-1.5">{item.selected_option}</Badge>
                        )}
                        {item.shipping_option_name_ar && (
                          <Badge variant="secondary" className="text-[10px] px-1.5">{item.shipping_option_name_ar}</Badge>
                        )}
                      </div>
                    </div>
                    <div className="text-left shrink-0">
                      <span className="text-sm font-bold text-foreground">×{item.quantity}</span>
                      <p className="text-[11px] text-muted-foreground">{formatPrice(item.unit_price)}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-2 border-t border-border text-sm font-bold">
                <span>المجموع</span>
                <span className="text-primary">{formatPrice(quickViewOrder.total_amount)}</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminOrders;
