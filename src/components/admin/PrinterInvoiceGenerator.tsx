import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Printer as PrinterIcon, Search, User, Check, Save, Download } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
const logoImg = '/logo-medium.png';

interface PrinterData {
  id: string;
  serial_number: string;
  model_name: string;
  model_name_ar: string;
  qr_code_data: string | null;
  buyer_user_id: string | null;
  warranty_months: number | null;
  order_item_id: string | null;
}

interface InvoiceData {
  customerName: string;
  phone: string;
  address: string;
  printerModel: string;
  serialNumber: string;
  qrCodeData: string;
  subtotal: number;
  tax: number;
  taxPercent: number;
  delivery: number;
  paymentFee: number;
  paymentFeeLabel: string;
  discount: number;
  cardDiscount: number;
  total: number;
  invoiceNo: string;
  date: Date;
  paymentMethod: string;
}

interface Props {
  printer: PrinterData;
  open: boolean;
  onClose: () => void;
}

interface BuyerOption {
  userId: string;
  fullName: string;
  username: string;
  phone: string;
  address: string;
  printerSerial: string;
  printerModel: string;
  orderNumber?: string;
  orderId?: string;
  totalPrice?: number;
  orderItemId?: string;
  paymentMethod?: string;
  paymentStatus?: string;
  orderSubtotal?: number;
  orderTaxAmount?: number;
  orderTaxPercent?: number;
  orderTotalAmount?: number;
  orderDiscountAmount?: number;
  orderPaidAmount?: number;
  orderRemainingAmount?: number;
  orderDeliveryMethod?: string;
  orderAdminShippingCost?: number;
  orderCardDiscountAmount?: number;
}

interface DiscountBreakdown {
  discount: number;
  cardDiscount: number;
  totalDiscount: number;
}

const toInvoiceNumber = (value: unknown, fallback = 0) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeDiscountBreakdown = (discountAmount: number, cardDiscountAmount: number): DiscountBreakdown => {
  const cardDiscount = Math.max(0, Math.round(cardDiscountAmount || 0));
  const rawDiscount = Math.max(0, Math.round(discountAmount || 0));
  const discount = cardDiscount > 0 && rawDiscount >= cardDiscount
    ? rawDiscount - cardDiscount
    : rawDiscount;

  return {
    discount,
    cardDiscount,
    totalDiscount: discount + cardDiscount,
  };
};

const getPaymentFeeLabel = (paymentMethod?: string | null, paymentStatus?: string | null) => (
  paymentMethod === 'cod' || paymentStatus === 'cod'
    ? 'COD fee:'
    : paymentStatus === 'partial'
      ? 'payment fee:'
      : 'extra fee:'
);

const deriveCustomerDeliveryFee = ({
  subtotal,
  taxAmount,
  totalAmount,
  discountAmount,
  cardDiscountAmount,
  adminShippingCost,
  deliveryMethod,
  calculatedDeliveryFee,
}: {
  subtotal: number;
  taxAmount: number;
  totalAmount: number;
  discountAmount: number;
  cardDiscountAmount: number;
  adminShippingCost: number;
  deliveryMethod?: string | null;
  calculatedDeliveryFee?: number;
}) => {
  if (deliveryMethod === 'pickup') {
    return { deliveryFee: 0, paymentFee: Math.max(0, Math.round(totalAmount + discountAmount + cardDiscountAmount - subtotal - taxAmount)) };
  }

  const storedDelivery = Math.max(0, Math.round(adminShippingCost || 0));
  const expectedDelivery = Math.max(0, Math.round(calculatedDeliveryFee || storedDelivery || 0));
  const derivedFromCustomerTotal = Math.max(0, Math.round(totalAmount + discountAmount + cardDiscountAmount - subtotal - taxAmount));

  if (derivedFromCustomerTotal <= 0) {
    return { deliveryFee: expectedDelivery, paymentFee: 0 };
  }

  if (expectedDelivery > 0) {
    return {
      deliveryFee: Math.min(expectedDelivery, derivedFromCustomerTotal),
      paymentFee: Math.max(0, derivedFromCustomerTotal - expectedDelivery),
    };
  }

  return { deliveryFee: derivedFromCustomerTotal, paymentFee: 0 };
};

const calculateOrderDeliveryFeeFromRules = async ({
  orderId,
  deliveryMethod,
  governorate,
  orderTotalForFreeDelivery,
}: {
  orderId?: string | null;
  deliveryMethod?: string | null;
  governorate?: string | null;
  orderTotalForFreeDelivery: number;
}) => {
  const methodKey = deliveryMethod || 'standard';
  if (!orderId || methodKey === 'pickup') return 0;

  const [{ data: items }, { data: methods }, { data: govExceptions }, { data: catExceptions }] = await Promise.all([
    supabase
      .from('order_items')
      .select('quantity, products!order_items_product_id_fkey(category_id)')
      .eq('order_id', orderId),
    supabase
      .from('delivery_methods')
      .select('*')
      .eq('is_active', true),
    supabase
      .from('delivery_governorate_exceptions')
      .select('*')
      .eq('delivery_method_key', methodKey),
    supabase
      .from('delivery_category_exceptions')
      .select('*')
      .eq('delivery_method_key', methodKey),
  ]);

  const method = (methods || []).find((m: any) => m.method_key === methodKey);
  if (!method) return 0;

  const basePrice = Number((method as any).base_price) || 0;
  if ((method as any).free_delivery_enabled) {
    const minOrder = Number((method as any).free_delivery_min_order) || 0;
    if (minOrder === 0 || orderTotalForFreeDelivery >= minOrder) return 0;
  }

  const categoryQty: Record<string, number> = {};
  let hasNoCategoryItems = false;
  (items || []).forEach((item: any) => {
    const catId = item.products?.category_id;
    if (!catId) {
      hasNoCategoryItems = true;
      return;
    }
    categoryQty[catId] = (categoryQty[catId] || 0) + (Number(item.quantity) || 1);
  });

  let totalFee = 0;
  const handledCategories = new Set<string>();
  for (const exc of (catExceptions || []) as any[]) {
    const catId = exc.category_id;
    if (!catId || handledCategories.has(catId) || !categoryQty[catId]) continue;

    const matchesGov = !exc.governorate || exc.governorate === governorate || exc.governorate === '__follow_gov__';
    if (!matchesGov) continue;

    handledCategories.add(catId);
    const deliveryCount = Math.ceil(categoryQty[catId] / (Number(exc.units_per_delivery) || 1));
    const govMatch = (govExceptions || []).find((g: any) => g.governorate === governorate);
    const price = exc.governorate === '__follow_gov__'
      ? (govMatch ? Number((govMatch as any).delivery_price) : basePrice)
      : Number(exc.delivery_price);
    totalFee += Math.max(0, price) * deliveryCount;
  }

  const hasUncoveredItems = Object.keys(categoryQty).some(catId => !handledCategories.has(catId));
  if (handledCategories.size > 0) {
    if (hasUncoveredItems || hasNoCategoryItems) {
      const govMatch = (govExceptions || []).find((exc: any) => exc.governorate === governorate);
      totalFee += govMatch ? Number((govMatch as any).delivery_price) : basePrice;
    }
    return Math.max(0, Math.round(totalFee));
  }

  const govMatch = (govExceptions || []).find((exc: any) => exc.governorate === governorate);
  return Math.max(0, Math.round(govMatch ? Number((govMatch as any).delivery_price) : basePrice));
};

const invoiceLineStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: '18px',
  marginBottom: '8px',
};

const invoiceLabelStyle: React.CSSProperties = {
  fontWeight: 700,
  fontSize: '13px',
  whiteSpace: 'nowrap',
};

const invoiceAmountStyle: React.CSSProperties = {
  fontSize: '14px',
  minWidth: '120px',
  textAlign: 'right',
  direction: 'rtl',
};

const captureInvoiceElementToPdf = async (source: HTMLElement, fileName: string) => {
  const html2canvas = (await import('html2canvas')).default;
  const { jsPDF } = await import('jspdf');
  let offscreen: HTMLDivElement | null = null;

  try {
    offscreen = document.createElement('div');
    offscreen.style.position = 'fixed';
    offscreen.style.top = '0';
    offscreen.style.left = '-10000px';
    offscreen.style.width = '210mm';
    offscreen.style.background = '#fff';
    offscreen.style.direction = 'ltr';
    offscreen.innerHTML = source.innerHTML;
    document.body.appendChild(offscreen);

    await new Promise((r) => requestAnimationFrame(() => r(null)));
    const canvas = await html2canvas(offscreen, { scale: 2, useCORS: true, backgroundColor: '#fff' });
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = 210;
    const pdfHeight = 297;
    const margin = 5;
    const contentWidth = pdfWidth - margin * 2;
    const contentHeight = (canvas.height * contentWidth) / canvas.width;

    if (contentHeight <= pdfHeight - margin * 2) {
      pdf.addImage(imgData, 'PNG', margin, margin, contentWidth, contentHeight);
    } else {
      let remainingHeight = contentHeight;
      let position = margin;
      pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
      remainingHeight -= (pdfHeight - margin * 2);
      while (remainingHeight > 0) {
        pdf.addPage();
        position = margin - (contentHeight - remainingHeight);
        pdf.addImage(imgData, 'PNG', margin, position, contentWidth, contentHeight);
        remainingHeight -= (pdfHeight - margin * 2);
      }
    }

    pdf.save(fileName);
  } finally {
    if (offscreen?.parentNode) {
      offscreen.parentNode.removeChild(offscreen);
    }
  }
};

export default function PrinterInvoiceGenerator({ printer, open, onClose }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [manualFields, setManualFields] = useState({ subtotal: '', delivery: '0', taxPercent: '0' });
  const [step, setStep] = useState<'select-user' | 'config' | 'preview'>('select-user');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [selectedOrderId, setSelectedOrderId] = useState<string | null>(null);
  const [buyerSearch, setBuyerSearch] = useState('');

  // Fetch buyers from store_printers AND completed orders for printer category
  const { data: buyers, isLoading: buyersLoading } = useQuery({
    queryKey: ['printer-buyers'],
    queryFn: async () => {
      const PRINTER_CATEGORY_ID = '3cd72a43-3af6-4adb-83e4-a482b4feca25';

      // Source 1: store_printers with buyer_user_id
      const { data: registeredPrinters } = await supabase
        .from('store_printers')
        .select('buyer_user_id, serial_number, model_name, model_name_ar')
        .not('buyer_user_id', 'is', null);

      // Source 2: completed orders containing printer products
      const { data: printerOrders } = await (supabase as any)
        .from('orders_admin')
        .select(`
          id,
          order_number,
          user_id,
          shipping_address,
          payment_method,
          payment_status,
          subtotal,
          tax_amount,
          tax_percentage,
          total_amount,
          discount_amount,
          card_discount_amount,
          paid_amount,
          remaining_amount,
          delivery_method,
          admin_shipping_cost,
          order_items!order_items_order_id_fkey (
            id,
            product_id,
            total_price,
            products!order_items_product_id_fkey (
              name,
              name_ar,
              category_id
            )
          )
        `)
        .not('status', 'in', '("cancelled","refunded")')
        .order('created_at', { ascending: false });

      // Filter order items to printer category
      const orderBuyers: Array<{
        userId: string;
        orderNumber: string;
        orderId: string;
        productName: string;
        productNameAr: string;
        totalPrice: number;
        orderItemId: string;
        shippingAddress: string;
        paymentMethod: string;
        paymentStatus: string;
        subtotal: number;
        taxAmount: number;
        taxPercent: number;
        totalAmount: number;
        discountAmount: number;
        cardDiscountAmount: number;
        paidAmount: number;
        remainingAmount: number;
        deliveryMethod: string;
        adminShippingCost: number;
      }> = [];

      const typedPrinterOrders = (printerOrders || []) as Array<{
        id: string; order_number?: string | null; user_id: string; shipping_address?: string | null;
        payment_method?: string | null; payment_status?: string | null; subtotal?: number | null;
        tax_amount?: number | null; tax_percentage?: number | null; total_amount?: number | null;
        discount_amount?: number | null; card_discount_amount?: number | null; paid_amount?: number | null; remaining_amount?: number | null;
        delivery_method?: string | null; admin_shipping_cost?: number | null;
        order_items?: Array<{ id: string; total_price?: number | null; products?: { name?: string | null; name_ar?: string | null; category_id?: string | null } | null }>;
      }>;
      typedPrinterOrders.forEach((order) => {
        const items = order.order_items || [];
        items.forEach((item) => {
          const product = item.products;
          if (product && product.category_id === PRINTER_CATEGORY_ID) {
            orderBuyers.push({
              userId: order.user_id,
              orderNumber: order.order_number || order.id?.slice(0, 8),
              orderId: order.id,
              productName: product.name || '',
              productNameAr: product.name_ar || product.name || '',
              totalPrice: item.total_price || 0,
              orderItemId: item.id,
              shippingAddress: order.shipping_address || '',
              paymentMethod: order.payment_method || '',
              paymentStatus: order.payment_status || '',
              subtotal: Number(order.subtotal || 0),
              taxAmount: Number(order.tax_amount || 0),
              taxPercent: Number(order.tax_percentage || 0),
              totalAmount: Number(order.total_amount || 0),
              discountAmount: Number(order.discount_amount || 0),
              cardDiscountAmount: Number(order.card_discount_amount || 0),
              paidAmount: Number(order.paid_amount || 0),
              remainingAmount: Number(order.remaining_amount || 0),
              deliveryMethod: order.delivery_method || '',
              adminShippingCost: Number(order.admin_shipping_cost || 0),
            });
          }
        });
      });

      // Collect all user IDs
      const printerUserIds = registeredPrinters?.filter(p => p.buyer_user_id).map(p => p.buyer_user_id!) || [];
      const orderUserIds = orderBuyers.map(o => o.userId);
      const allUserIds = [...new Set([...printerUserIds, ...orderUserIds])];

      if (allUserIds.length === 0) return [];

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone_number')
        .in('id', allUserIds);

      const { data: addresses } = await supabase
        .from('user_addresses')
        .select('user_id, governorate, area, neighborhood, nearest_landmark, phone_number, full_name, is_default')
        .in('user_id', allUserIds)
        .order('is_default', { ascending: false });

      const profileMap: Record<string, { full_name?: string | null; username?: string | null; phone_number?: string | null }> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });
      const addrMap: Record<string, { governorate?: string | null; area?: string | null; neighborhood?: string | null; nearest_landmark?: string | null; phone_number?: string | null; full_name?: string | null }> = {};
      addresses?.forEach(a => { addrMap[a.user_id] = a; });

      const results: BuyerOption[] = [];
      const seen = new Set<string>();

      // Add order-based buyers first (more data available)
      orderBuyers.forEach(ob => {
        const key = `${ob.userId}-${ob.orderNumber}`;
        if (seen.has(key)) return;
        seen.add(key);
        const prof = profileMap[ob.userId];
        const addr = addrMap[ob.userId];
        results.push({
          userId: ob.userId,
          fullName: prof?.full_name || addr?.full_name || '',
          username: prof?.username || '',
          phone: prof?.phone_number || addr?.phone_number || '',
          address: addr ? [addr.governorate, addr.area, addr.neighborhood, addr.nearest_landmark].filter(Boolean).join(' - ') : (ob.shippingAddress || ''),
          printerSerial: '',
          printerModel: ob.productNameAr || ob.productName,
          orderNumber: ob.orderNumber,
          orderId: ob.orderId,
          totalPrice: ob.totalPrice,
          orderItemId: ob.orderItemId,
          paymentMethod: ob.paymentMethod,
          paymentStatus: ob.paymentStatus,
          orderSubtotal: ob.subtotal,
          orderTaxAmount: ob.taxAmount,
          orderTaxPercent: ob.taxPercent,
          orderTotalAmount: ob.totalAmount,
          orderDiscountAmount: ob.discountAmount,
          orderCardDiscountAmount: ob.cardDiscountAmount,
          orderPaidAmount: ob.paidAmount,
          orderRemainingAmount: ob.remainingAmount,
          orderDeliveryMethod: ob.deliveryMethod,
          orderAdminShippingCost: ob.adminShippingCost,
        });
      });

      // Add registered printer buyers
      registeredPrinters?.forEach(p => {
        const prof = profileMap[p.buyer_user_id!];
        const addr = addrMap[p.buyer_user_id!];
        results.push({
          userId: p.buyer_user_id!,
          fullName: prof?.full_name || addr?.full_name || '',
          username: prof?.username || '',
          phone: prof?.phone_number || addr?.phone_number || '',
address: addr ? [addr.governorate, addr.area, addr.neighborhood, addr.nearest_landmark].filter(Boolean).join(' - ') : '',
          printerSerial: p.serial_number,
          printerModel: p.model_name_ar || p.model_name || '',
        });
      });

      return results;
    },
    enabled: open,
  });

  const filteredBuyers = buyers?.filter(b => {
    if (!buyerSearch) return true;
    const q = buyerSearch.toLowerCase();
    return b.fullName.toLowerCase().includes(q) ||
      b.username.toLowerCase().includes(q) ||
      b.phone.includes(q) ||
      b.printerSerial.toLowerCase().includes(q) ||
      b.printerModel.toLowerCase().includes(q) ||
      (b.orderNumber && b.orderNumber.toLowerCase().includes(q));
  });

  const handleSelectUser = async (buyer: BuyerOption) => {
    setSelectedUserId(buyer.userId);
    setLoading(true);
    try {
      let subtotal = toInvoiceNumber(buyer.orderSubtotal || buyer.totalPrice || 0);
      let taxAmount = toInvoiceNumber(buyer.orderTaxAmount || 0);
      let taxPercent = toInvoiceNumber(buyer.orderTaxPercent || 0);
      let orderTotal = toInvoiceNumber(buyer.orderTotalAmount || 0);
      let orderDiscount = toInvoiceNumber(buyer.orderDiscountAmount || 0);
      let cardDiscount = toInvoiceNumber(buyer.orderCardDiscountAmount || 0);
      let paidAmount = toInvoiceNumber(buyer.orderPaidAmount || 0);
      let remainingAmount = toInvoiceNumber(buyer.orderRemainingAmount || 0);
      let deliveryMethod = buyer.orderDeliveryMethod || '';
      let adminShippingCost = toInvoiceNumber(buyer.orderAdminShippingCost || 0);
      let orderCodFee = 0;
      
      // Fallback: check printer's order_item_id
      if (!subtotal && printer.order_item_id) {
        const { data: orderItem } = await supabase
          .from('order_items')
          .select('total_price')
          .eq('id', printer.order_item_id)
          .single();
        if (orderItem) subtotal = orderItem.total_price || 0;
      }
      
      // Fallback: check buyer's orderItemId
      if (!subtotal && buyer.orderItemId) {
        const { data: orderItem } = await supabase
          .from('order_items')
          .select('total_price')
          .eq('id', buyer.orderItemId)
          .single();
        if (orderItem) subtotal = orderItem.total_price || 0;
      }

      // Pull real invoice totals from the order so warranty invoice matches order invoice/payment choice
      if (buyer.orderId) {
        const { data: orderData } = await (supabase as any)
          .from('orders_admin')
          .select('subtotal, tax_amount, tax_percentage, total_amount, discount_amount, card_discount_amount, paid_amount, remaining_amount, payment_method, payment_status, delivery_method, admin_shipping_cost, cod_fee')
          .eq('id', buyer.orderId)
          .maybeSingle();
        if (orderData) {
          subtotal = toInvoiceNumber(orderData.subtotal ?? subtotal);
          taxAmount = toInvoiceNumber(orderData.tax_amount ?? 0);
          taxPercent = toInvoiceNumber(orderData.tax_percentage ?? 0);
          orderTotal = toInvoiceNumber(orderData.total_amount ?? 0);
          orderDiscount = toInvoiceNumber(orderData.discount_amount ?? 0);
          paidAmount = toInvoiceNumber(orderData.paid_amount ?? 0);
          remainingAmount = toInvoiceNumber(orderData.remaining_amount ?? 0);
          deliveryMethod = orderData.delivery_method || '';
          adminShippingCost = toInvoiceNumber(orderData.admin_shipping_cost ?? 0);
          buyer.paymentMethod = orderData.payment_method || buyer.paymentMethod;
          buyer.paymentStatus = orderData.payment_status || buyer.paymentStatus;
          cardDiscount = toInvoiceNumber(orderData.card_discount_amount ?? cardDiscount);
          orderCodFee = toInvoiceNumber(orderData.cod_fee ?? 0);
        }
      }

      // Auto-link the serial number to this buyer (preserve admin-set warranty dates)
      if (printer.id && buyer.userId) {
        const { error: linkError } = await supabase
          .from('store_printers')
          .update({
            buyer_user_id: buyer.userId,
            is_registered: true,
            status: 'active',
          })
          .eq('id', printer.id);

        if (linkError) {
          console.error('Failed to link serial to buyer:', linkError);
        } else {
          await supabase
            .from('user_printers')
            .upsert({
              user_id: buyer.userId,
              store_printer_id: printer.id,
            }, { onConflict: 'store_printer_id' })
            .select();
        }
      }

      const sub = subtotal || parseFloat(manualFields.subtotal) || 0;
      const finalTaxAmount = Math.max(0, taxAmount);
      const finalTaxPercent = taxPercent || (sub > 0 && finalTaxAmount > 0
        ? Number(((finalTaxAmount / sub) * 100).toFixed(2)) : 0);
      const discounts = normalizeDiscountBreakdown(orderDiscount, cardDiscount);
      const calculatedDeliveryFee = await calculateOrderDeliveryFeeFromRules({
        orderId: buyer.orderId,
        deliveryMethod,
        governorate: buyer.address?.split(' - ')?.[0] || null,
        orderTotalForFreeDelivery: sub,
      });
      const { deliveryFee, paymentFee: derivedPaymentFee } = deriveCustomerDeliveryFee({
        subtotal: sub,
        taxAmount: finalTaxAmount,
        totalAmount: orderTotal,
        discountAmount: discounts.discount,
        cardDiscountAmount: discounts.cardDiscount,
        adminShippingCost,
        deliveryMethod,
        calculatedDeliveryFee,
      });
      const paymentFee = orderCodFee > 0 ? orderCodFee : derivedPaymentFee;
      const finalTotal = orderTotal > 0
        ? orderTotal
        : Math.max(0, sub + finalTaxAmount + deliveryFee + paymentFee - discounts.totalDiscount);
      const now = new Date();

      // Sync manual fields so the config step reflects real values
      setManualFields(prev => ({
        ...prev,
        subtotal: sub ? String(sub) : prev.subtotal,
        delivery: String(deliveryFee),
        taxPercent: String(finalTaxPercent),
      }));

      setSelectedOrderId(buyer.orderId || null);
      setInvoiceData({
        customerName: buyer.fullName,
        phone: buyer.phone,
        address: buyer.address,
        printerModel: buyer.printerModel || printer.model_name || printer.model_name_ar,
        serialNumber: printer.serial_number,
        qrCodeData: printer.qr_code_data || '',
        subtotal: sub,
        tax: finalTaxAmount,
        taxPercent: finalTaxPercent,
        delivery: deliveryFee,
        paymentFee,
        paymentFeeLabel: getPaymentFeeLabel(buyer.paymentMethod, buyer.paymentStatus),
        discount: discounts.discount,
        cardDiscount: discounts.cardDiscount,
        total: finalTotal,
        invoiceNo: buyer.orderNumber || format(now, 'yyyyMMdd-HHmm'),
        date: now,
        paymentMethod: buyer.paymentStatus === 'cod'
          ? 'دفع عند الاستلام'
          : buyer.paymentStatus === 'partial'
            ? `دفع جزئي${paidAmount > 0 ? ` - مدفوع ${paidAmount.toLocaleString()} د.ع` : ''}${remainingAmount > 0 ? ` - متبقي ${remainingAmount.toLocaleString()} د.ع` : ''}`
            : (buyer.paymentMethod || 'نقداً'),
      });
      setStep(sub > 0 ? 'preview' : 'config');
    } catch {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleManualEntry = () => {
    const now = new Date();
    setInvoiceData({
      customerName: '',
      phone: '',
      address: '',
      printerModel: printer.model_name || printer.model_name_ar,
      serialNumber: printer.serial_number,
      qrCodeData: printer.qr_code_data || '',
      subtotal: 0,
      tax: 0,
      taxPercent: 0,
      delivery: 0,
      paymentFee: 0,
      paymentFeeLabel: 'extra fee:',
      discount: 0,
      cardDiscount: 0,
      total: 0,
      invoiceNo: format(now, 'yyyyMMdd-HHmm'),
      date: now,
      paymentMethod: 'نقداً',
    });
    setSelectedUserId(null);
    setSelectedOrderId(null);
    setStep('config');
  };

  const handleGeneratePreview = () => {
    if (!invoiceData) return;
    const sub = parseFloat(manualFields.subtotal) || invoiceData.subtotal;
    const deliveryFee = manualFields.delivery !== '' ? parseFloat(manualFields.delivery) : 0;
    const parsedTax = parseFloat(manualFields.taxPercent);
    const taxPercent = isNaN(parsedTax) ? 0 : parsedTax;
    const taxAmount = taxPercent === invoiceData.taxPercent && sub === invoiceData.subtotal
      ? invoiceData.tax
      : Math.round(sub * (taxPercent / 100));
    setInvoiceData({
      ...invoiceData,
      subtotal: sub,
      tax: taxAmount,
      taxPercent: taxPercent,
      delivery: deliveryFee,
      total: Math.max(0, sub + taxAmount + deliveryFee + (invoiceData.paymentFee || 0) - (invoiceData.discount || 0) - (invoiceData.cardDiscount || 0)),
    });
    setStep('preview');
  };

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>Invoice</title>
        <style>
          @media print { body { margin: 0; } @page { size: A4; margin: 10mm; } }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; margin: 0; padding: 20px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => { win.print(); win.close(); }, 500);
  };

  React.useEffect(() => {
    if (open) {
      setStep('select-user');
      setInvoiceData(null);
      setSelectedUserId(null);
      setSelectedOrderId(null);
      setBuyerSearch('');
      setManualFields({ subtotal: '', delivery: '0', taxPercent: '0' });
    }
  }, [open]);

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-auto p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            توليد فاتورة وضمان
          </DialogTitle>
        </DialogHeader>

        {/* Step 1: Select user */}
        {step === 'select-user' && (
          <div className="p-6 space-y-4">
             <p className="text-sm text-muted-foreground">اختر المستخدم الذي اشترى الطابعة لجلب بياناته تلقائياً:</p>
            <div className="relative">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
              <Input
                value={buyerSearch}
                onChange={(e) => setBuyerSearch(e.target.value)}
                placeholder="بحث بالاسم، رقم الطلب، اسم المنتج، أو السيريال..."
                className="pr-10"
              />
            </div>
            {buyersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-6 h-6 animate-spin text-primary" />
              </div>
            ) : filteredBuyers && filteredBuyers.length > 0 ? (
              <ScrollArea className="h-[300px] rounded-md border">
                <div className="divide-y">
                  {filteredBuyers.map((buyer, idx) => (
                    <button
                      key={`${buyer.userId}-${buyer.printerSerial}-${idx}`}
                      onClick={() => handleSelectUser(buyer)}
                      className="w-full flex items-center gap-3 p-3 hover:bg-accent/50 transition-colors text-right"
                    >
                      <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                        <User className="w-4 h-4 text-primary" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm truncate">
                          {buyer.fullName || buyer.username || 'بدون اسم'}
                        </div>
                        <div className="text-xs text-muted-foreground truncate">
                          {buyer.phone && <span className="ml-3" dir="ltr">{buyer.phone}</span>}
                          {buyer.address && <span>{buyer.address}</span>}
                        </div>
                        <div className="text-xs text-muted-foreground mt-0.5">
                          🖨 {buyer.printerModel}
                          {buyer.printerSerial && <span> — <span className="font-mono">{buyer.printerSerial}</span></span>}
                          {buyer.orderNumber && <span className="mr-2">📦 طلب #{buyer.orderNumber}</span>}
                        </div>
                      </div>
                      {selectedUserId === buyer.userId && (
                        <Check className="w-4 h-4 text-green-500 shrink-0" />
                      )}
                    </button>
                  ))}
                </div>
              </ScrollArea>
            ) : (
              <div className="text-center py-6 text-muted-foreground text-sm">
                لا يوجد مشترون مسجلون
              </div>
            )}
            <Button variant="outline" onClick={handleManualEntry} className="w-full">
              إدخال البيانات يدوياً
            </Button>
          </div>
        )}

        {loading && step !== 'select-user' && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {/* Step 2: Config / manual fields */}
        {!loading && step === 'config' && invoiceData && (
          <div className="p-6 space-y-4">
            <p className="text-muted-foreground text-sm">أكمل أو عدّل البيانات:</p>
            <div className="grid gap-4 md:grid-cols-2">
              <div>
                <Label>اسم العميل</Label>
                <Input
                  value={invoiceData.customerName}
                  onChange={(e) => setInvoiceData({ ...invoiceData, customerName: e.target.value })}
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  value={invoiceData.phone}
                  onChange={(e) => setInvoiceData({ ...invoiceData, phone: e.target.value })}
                />
              </div>
              <div className="md:col-span-2">
                <Label>العنوان</Label>
                <Input
                  value={invoiceData.address}
                  onChange={(e) => setInvoiceData({ ...invoiceData, address: e.target.value })}
                />
              </div>
              <div>
                <Label>طريقة الدفع</Label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={invoiceData.paymentMethod}
                  onChange={(e) => setInvoiceData({ ...invoiceData, paymentMethod: e.target.value })}
                >
                  <option value="نقداً">نقداً (عند الاستلام)</option>
                  <option value="مقدماً">مقدماً (دفع كامل)</option>
                  <option value="ربع المبلغ مقدماً">ربع المبلغ مقدماً</option>
                  <option value="نصف المبلغ مقدماً">نصف المبلغ مقدماً</option>
                  <option value="تحويل بنكي">تحويل بنكي</option>
                  <option value="محفظة إلكترونية">محفظة إلكترونية</option>
                </select>
              </div>
              <div>
                <Label>المبلغ الفرعي (Sub-total) - د.ع</Label>
                <Input
                  type="number"
                  value={manualFields.subtotal || (invoiceData.subtotal > 0 ? String(invoiceData.subtotal) : '')}
                  onChange={(e) => setManualFields(prev => ({ ...prev, subtotal: e.target.value }))}
                  placeholder="مثال: 2185000"
                />
              </div>
              <div>
                <Label>نسبة الضريبة (%)</Label>
                <Input
                  type="number"
                  value={manualFields.taxPercent}
                  onChange={(e) => setManualFields(prev => ({ ...prev, taxPercent: e.target.value }))}
                  placeholder="3"
                />
              </div>
              <div>
                <Label>رسوم التوصيل - د.ع</Label>
                <Input
                  type="number"
                  value={manualFields.delivery}
                  onChange={(e) => setManualFields(prev => ({ ...prev, delivery: e.target.value }))}
                />
              </div>
            </div>
            <div className="flex gap-2">
              <Button onClick={handleGeneratePreview} disabled={!manualFields.subtotal && invoiceData.subtotal === 0}>
                عرض الفاتورة
              </Button>
              <Button variant="ghost" onClick={() => setStep('select-user')}>رجوع</Button>
            </div>
          </div>
        )}

        {/* Step 3: Preview */}
        {!loading && step === 'preview' && invoiceData && (
          <>
            <div className="flex gap-2 p-4 border-b bg-muted/30">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <PrinterIcon className="w-4 h-4 ml-2" />
                طباعة
              </Button>
              <Button onClick={async () => {
                if (!invoiceRef.current) return;
                try {
                  const invoiceHtml = invoiceRef.current.innerHTML;
                  const warrantyMonths = printer.warranty_months || 12;
                  const warrantyExpiresAt = new Date(invoiceData.date);
                  warrantyExpiresAt.setMonth(warrantyExpiresAt.getMonth() + warrantyMonths);
                  
                  const { data, error } = await supabase.from('saved_invoices').insert({
                    order_id: selectedOrderId || null,
                    user_id: selectedUserId || null,
                    printer_id: printer.id || null,
                    invoice_html: invoiceHtml,
                    warranty_expires_at: warrantyExpiresAt.toISOString(),
                    notes: `طابعة: ${invoiceData.printerModel} - رقم تسلسلي: ${invoiceData.serialNumber}`,
                  }).select('id').single();
                  if (error) throw error;
                  console.log('Invoice saved:', data?.id);
                  toast.success('تم حفظ الفاتورة بنجاح');
                } catch (err: unknown) {
                  console.error('Error saving invoice:', err);
                  toast.error(`حدث خطأ أثناء حفظ الفاتورة: ${err instanceof Error ? err.message : 'غير معروف'}`);
                }
              }} size="sm">
                <Save className="w-4 h-4 ml-2" />
                حفظ الفاتورة
              </Button>
              <Button onClick={async () => {
                if (!invoiceRef.current) return;
                try {
                  await captureInvoiceElementToPdf(invoiceRef.current, `invoice-${invoiceData.invoiceNo}.pdf`);
                } catch (err) {
                  console.error('PDF generation error:', err);
                  toast.error('حدث خطأ أثناء توليد PDF');
                }
              }} variant="outline" size="sm">
                <Download className="w-4 h-4 ml-2" />
                تنزيل PDF
              </Button>
              <Button onClick={() => setStep('config')} variant="ghost" size="sm">
                تعديل البيانات
              </Button>
            </div>
            <div className="p-4 overflow-auto bg-white">
              <div style={{ transform: 'scale(0.55)', transformOrigin: 'top center', width: '210mm', margin: '0 auto' }}>
                <div ref={invoiceRef}>
                  <InvoiceTemplate data={invoiceData} logoSrc={logoImg} />
                </div>
              </div>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}

function InvoiceTemplate({ data, logoSrc }: { data: InvoiceData; logoSrc: string }) {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];
  const totalCheck = Math.max(0, data.subtotal + data.tax + data.delivery + data.paymentFee - data.discount - data.cardDiscount);
  const displayTotal = data.total > 0 ? data.total : totalCheck;

  return (
    <div style={{
      width: '210mm',
      minHeight: '297mm',
      padding: '15mm 20mm',
      fontFamily: "'Segoe UI', Tahoma, sans-serif",
      color: '#1a1a1a',
      background: '#fff',
      position: 'relative',
      boxSizing: 'border-box',
      direction: 'ltr',
    }}>
      {/* Header */}
      <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '3px', marginBottom: '20px', fontVariant: 'small-caps', whiteSpace: 'nowrap' }}>
        INVOICE AND WARRANTY
      </div>

      {/* Two column layout */}
      <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.9fr', gap: '30px', alignItems: 'start' }}>
        {/* Left Column */}
        <div style={{ flex: '1.2' }}>
          {/* Brand */}
          <div style={{
            fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
            fontSize: '64px',
            fontWeight: 400,
            fontStyle: 'italic',
            lineHeight: 1,
            marginBottom: '25px',
            color: '#1a1a1a',
          }}>
            levonis.iq
          </div>

          {/* Invoice number */}
          <div style={{ fontSize: '14px', fontWeight: 600, letterSpacing: '2px', marginBottom: '20px' }}>
            INVOICE NO. {data.invoiceNo}
          </div>

          {/* Invoice from */}
          <div style={{ marginBottom: '40px' }}>
            <span style={{ fontSize: '13px', color: '#666', marginRight: '20px' }}>Invoice from</span>
            <div style={{ marginTop: '5px' }}>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>ALI AMER MUSA</div>
              <div style={{ fontSize: '13px', color: '#555' }}>MUSTAFA FALAH</div>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '16px', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Description</span>
              <span style={{ fontWeight: 700, fontSize: '13px', textAlign: 'right' }}>Subtotal</span>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 140px', gap: '16px', paddingBottom: '10px', alignItems: 'start' }}>
              <span style={{ fontSize: '14px', lineHeight: 1.5 }}>{data.printerModel}</span>
              <span style={{ fontSize: '14px', textAlign: 'right', direction: 'rtl', whiteSpace: 'nowrap' }}>{data.subtotal.toLocaleString()} د.ع</span>
            </div>
            {/* Empty rows like template */}
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
          </div>

          {/* Totals */}
          <div style={{ marginTop: '20px' }}>
            <div style={invoiceLineStyle}>
              <span style={invoiceLabelStyle}>Sub-total:</span>
              <span style={invoiceAmountStyle}>{data.subtotal.toLocaleString()} د.ع</span>
            </div>
            <div style={invoiceLineStyle}>
              <span style={invoiceLabelStyle}>tax ({data.taxPercent}%):</span>
              <span style={invoiceAmountStyle}>{data.tax.toLocaleString()} د.ع</span>
            </div>
            <div style={invoiceLineStyle}>
              <span style={invoiceLabelStyle}>delivery:</span>
              <span style={invoiceAmountStyle}>{data.delivery.toLocaleString()} د.ع</span>
            </div>
            {data.paymentFee > 0 && (
              <div style={invoiceLineStyle}>
                <span style={invoiceLabelStyle}>{data.paymentFeeLabel}</span>
                <span style={invoiceAmountStyle}>{data.paymentFee.toLocaleString()} د.ع</span>
              </div>
            )}
            {data.discount > 0 && (
              <div style={invoiceLineStyle}>
                <span style={invoiceLabelStyle}>discount:</span>
                <span style={{ ...invoiceAmountStyle, color: '#c0392b' }}>- {data.discount.toLocaleString()} د.ع</span>
              </div>
            )}
            {data.cardDiscount > 0 && (
              <div style={invoiceLineStyle}>
                <span style={invoiceLabelStyle}>card discount:</span>
                <span style={{ ...invoiceAmountStyle, color: '#c0392b' }}>- {data.cardDiscount.toLocaleString()} د.ع</span>
              </div>
            )}
            <div style={{ ...invoiceLineStyle, marginTop: '10px', borderTop: '1px solid #999', paddingTop: '10px' }}>
              <span style={{ ...invoiceLabelStyle, fontSize: '15px' }}>Total:</span>
              <span style={{ ...invoiceAmountStyle, fontWeight: 700, fontSize: '18px' }}>{displayTotal.toLocaleString()} د.ع</span>
            </div>
          </div>
        </div>

        {/* Right Column - Customer Details & QR */}
        <div style={{ flex: '0.9', textAlign: 'right' }} dir="rtl">
          {/* Date */}
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '5px' }}>
            {dayNames[data.date.getDay()]}
          </div>
          <div style={{ fontWeight: 700, fontSize: '16px', marginBottom: '2px' }}>
            {monthNames[data.date.getMonth()]} {data.date.getDate()}
          </div>
          <div style={{ fontWeight: 700, fontSize: '20px', marginBottom: '15px' }}>
            {data.date.getFullYear()}
          </div>

          {/* Logo image */}
          <div style={{
            width: '140px',
            height: '140px',
            border: '3px solid #ccc',
            borderRadius: '8px',
            marginLeft: 'auto',
            marginBottom: '20px',
            overflow: 'hidden',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: '#e8f5e9',
          }}>
            <img src={logoSrc} alt="LEVONIS" style={{ width: '100px', height: '100px', objectFit: 'contain' }} />
          </div>

          {/* Customer info */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>الفاتورة الى :</div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{data.customerName}</div>
          </div>
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>الرقم :</div>
            <div style={{ fontWeight: 700, fontSize: '15px' }} dir="ltr">{data.phone}</div>
          </div>
          <div style={{ marginBottom: '15px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>العنوان :</div>
            <div style={{ fontWeight: 700, fontSize: '14px' }}>{data.address}</div>
          </div>

          {/* QR Section */}
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', lineHeight: 1.6 }}>
            قم بمسح الباركود لمشاهده الضمان<br />
            وتفعيل التأمين والاستفاده من الخصومات :
          </div>
          {data.qrCodeData && (
            <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
              <QRCodeSVG value={data.qrCodeData} size={120} level="H" />
            </div>
          )}
          <div style={{ fontSize: '12px', fontWeight: 700, color: '#c00', marginTop: '5px' }}>
            لا تقم بمشاركه الباركود لاي احد !!!
          </div>
        </div>
      </div>

      {/* Signature section */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '40px', borderTop: '2px solid #1a1a1a', paddingTop: '20px' }}>
        {['البائع', 'الزبون', 'الحسابات'].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{label}</div>
            <div style={{ borderBottom: '1px dashed #ccc', marginBottom: '10px' }}></div>
            <div style={{ height: '50px', background: '#f5f5f5', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '30px', borderTop: '2px solid #1a1a1a', paddingTop: '15px', fontSize: '13px' }}>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>PAYMENT DETAILS</div>
          <div>{data.paymentMethod || 'CASH'}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>MOBILE</div>
          <div>07838455220</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>WEBSITE</div>
          <div>LEVONISIQ.COM</div>
        </div>
      </div>
    </div>
  );
}
