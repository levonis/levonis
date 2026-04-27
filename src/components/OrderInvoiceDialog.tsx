import React, { useRef } from 'react';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Printer as PrinterIcon, Download, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';

const logoImg = '/logo-medium.png';

interface OrderInvoiceDialogProps {
  order: any;
  open: boolean;
  onClose: () => void;
}

interface InvoiceLineItem {
  name: string;
  total: number;
}

export default function OrderInvoiceDialog({ order, open, onClose }: OrderInvoiceDialogProps) {
  const invoiceRef = useRef<HTMLDivElement>(null);

  if (!order) return null;

  // Build customer info from order
  const shippingAddr = (() => {
    try {
      const a = typeof order.shipping_address === 'string'
        ? JSON.parse(order.shipping_address)
        : order.shipping_address;
      return a || {};
    } catch {
      return {};
    }
  })();

  const customerName =
    shippingAddr.full_name ||
    shippingAddr.fullName ||
    order.profiles?.full_name ||
    order.profiles?.username ||
    'عميل';
  const phone = shippingAddr.phone || shippingAddr.phone_number || '';
  const address = [
    shippingAddr.governorate || shippingAddr.city,
    shippingAddr.area || shippingAddr.region,
    shippingAddr.neighborhood,
    shippingAddr.nearest_landmark || shippingAddr.landmark,
  ]
    .filter(Boolean)
    .join('، ');

  // Items
  const items: InvoiceLineItem[] = (order.order_items || []).map((it: any) => {
    const productName =
      it.products?.name_ar ||
      it.products?.name ||
      it.custom_product_requests?.product_name ||
      it.product_name ||
      'منتج';
    return {
      name: `${productName}${it.quantity > 1 ? ` × ${it.quantity}` : ''}`,
      total: Number(it.total_price ?? (it.unit_price ?? 0) * (it.quantity || 1)),
    };
  });

  const subtotal = items.reduce((s, i) => s + i.total, 0);
  const delivery = Number(order.delivery_fee || order.shipping_cost || 0);
  const discount = Number(order.discount_amount || 0);
  const total = Number(order.total_amount ?? subtotal + delivery - discount);
  const orderDate = order.created_at ? new Date(order.created_at) : new Date();

  // QR code points to order page
  const qrCodeData = `${window.location.origin}/order/${order.id}`;

  const data = {
    customerName,
    phone,
    address,
    items,
    subtotal,
    delivery,
    discount,
    total,
    invoiceNo: order.order_number || order.id?.slice(0, 8) || '',
    date: orderDate,
    paymentMethod: order.payment_method || 'نقداً',
    qrCodeData,
  };

  const handlePrint = () => {
    const content = invoiceRef.current;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) {
      toast.error('يرجى السماح بالنوافذ المنبثقة للطباعة');
      return;
    }
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="ar">
      <head>
        <meta charset="UTF-8">
        <title>فاتورة - ${data.invoiceNo}</title>
        <style>
          @media print { body { margin: 0; } @page { size: A4; margin: 10mm; } }
          body { font-family: 'Segoe UI', Tahoma, sans-serif; background: #fff; margin: 0; padding: 20px; }
        </style>
      </head>
      <body>${content.innerHTML}</body>
      </html>
    `);
    win.document.close();
    setTimeout(() => {
      win.print();
      win.close();
    }, 500);
  };

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const { jsPDF } = await import('jspdf');

      // Render an off-screen, full-size clone so html2canvas captures
      // the actual A4 layout instead of the visually-scaled preview.
      const offscreen = document.createElement('div');
      offscreen.style.position = 'fixed';
      offscreen.style.top = '0';
      offscreen.style.left = '-10000px';
      offscreen.style.width = '210mm';
      offscreen.style.background = '#fff';
      offscreen.setAttribute('dir', 'rtl');
      offscreen.innerHTML = invoiceRef.current.innerHTML;
      document.body.appendChild(offscreen);

      await new Promise((r) => requestAnimationFrame(() => r(null)));

      const canvas = await html2canvas(offscreen, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#fff',
        windowWidth: offscreen.scrollWidth,
        windowHeight: offscreen.scrollHeight,
      });

      document.body.removeChild(offscreen);

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pdfWidth = 210;
      const pdfHeight = 297;
      const contentHeight = (canvas.height * pdfWidth) / canvas.width;

      if (contentHeight <= pdfHeight) {
        pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, contentHeight);
      } else {
        let position = 0;
        let remaining = contentHeight;
        pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
        remaining -= pdfHeight;
        while (remaining > 0) {
          pdf.addPage();
          position = -(contentHeight - remaining);
          pdf.addImage(imgData, 'PNG', 0, position, pdfWidth, contentHeight);
          remaining -= pdfHeight;
        }
      }
      pdf.save(`invoice-${data.invoiceNo}.pdf`);
      toast.success('تم تنزيل الفاتورة');
    } catch (err) {
      console.error('PDF generation error:', err);
      toast.error('حدث خطأ أثناء توليد PDF');
    }
  };

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-auto p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            فاتورة الطلب
          </DialogTitle>
        </DialogHeader>

        <div className="flex gap-2 p-4 border-b bg-muted/20 sticky top-0 z-10">
          <Button onClick={handlePrint} variant="outline" size="sm">
            <PrinterIcon className="w-4 h-4 ml-2" />
            طباعة
          </Button>
          <Button onClick={handleDownloadPDF} size="sm">
            <Download className="w-4 h-4 ml-2" />
            تنزيل PDF
          </Button>
        </div>

        <div className="p-4 overflow-auto bg-white">
          <div
            style={{
              transform: 'scale(0.55)',
              transformOrigin: 'top center',
              width: '210mm',
              margin: '0 auto',
              marginBottom: 'calc(297mm * -0.45)',
            }}
          >
            <div ref={invoiceRef}>
              <InvoiceTemplate data={data} logoSrc={logoImg} />
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function InvoiceTemplate({
  data,
  logoSrc,
}: {
  data: {
    customerName: string;
    phone: string;
    address: string;
    items: InvoiceLineItem[];
    subtotal: number;
    delivery: number;
    discount: number;
    total: number;
    invoiceNo: string;
    date: Date;
    paymentMethod: string;
    qrCodeData: string;
  };
  logoSrc: string;
}) {
  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  // Show up to 6 item rows; pad with empty rows for layout consistency
  const maxRows = Math.max(data.items.length, 4);
  const rows = [...data.items];
  while (rows.length < maxRows) rows.push({ name: '', total: 0 });

  return (
    <div
      style={{
        width: '210mm',
        minHeight: '297mm',
        padding: '15mm 20mm',
        fontFamily: "'Segoe UI', Tahoma, sans-serif",
        color: '#1a1a1a',
        background: '#fff',
        position: 'relative',
        boxSizing: 'border-box',
      }}
    >
      {/* Header */}
      <div
        style={{
          fontSize: '18px',
          fontWeight: 700,
          letterSpacing: '4px',
          marginBottom: '20px',
          fontVariant: 'small-caps',
        }}
      >
        INVOICE
      </div>

      {/* Two column layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px' }}>
        {/* Left Column */}
        <div style={{ flex: '1.2' }}>
          {/* Brand */}
          <div
            style={{
              fontFamily: "'Brush Script MT', 'Segoe Script', cursive",
              fontSize: '64px',
              fontWeight: 400,
              fontStyle: 'italic',
              lineHeight: 1,
              marginBottom: '25px',
              color: '#1a1a1a',
            }}
          >
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
              <div style={{ fontWeight: 700, fontSize: '14px' }}>LEVONIS IQ</div>
              <div style={{ fontSize: '13px', color: '#555' }}>ليفو</div>
            </div>
          </div>

          {/* Table */}
          <div style={{ marginBottom: '10px' }}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                borderBottom: '1px solid #ccc',
                paddingBottom: '8px',
                marginBottom: '15px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Description</span>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Subtotal</span>
            </div>
            {rows.map((row, idx) => (
              <div
                key={idx}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  borderBottom: '1px solid #ddd',
                  paddingBottom: '12px',
                  marginBottom: '12px',
                  minHeight: '20px',
                }}
              >
                <span style={{ fontSize: '14px' }}>{row.name || ''}</span>
                <span style={{ fontSize: '14px' }} dir="rtl">
                  {row.total > 0 ? `${row.total.toLocaleString()} د.ع` : ''}
                </span>
              </div>
            ))}
          </div>

          {/* Totals */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Sub-total:</span>
              <span style={{ fontSize: '14px' }} dir="rtl">
                {data.subtotal.toLocaleString()} د.ع
              </span>
            </div>
            {data.discount > 0 && (
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
                <span style={{ fontWeight: 700, fontSize: '13px' }}>discount:</span>
                <span style={{ fontSize: '14px', color: '#c00' }} dir="rtl">
                  -{data.discount.toLocaleString()} د.ع
                </span>
              </div>
            )}
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>delivery:</span>
              <span style={{ fontSize: '14px' }} dir="rtl">
                {data.delivery.toLocaleString()} د.ع
              </span>
            </div>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                marginTop: '10px',
                borderTop: '1px solid #999',
                paddingTop: '10px',
              }}
            >
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Total:</span>
              <span style={{ fontWeight: 700, fontSize: '18px' }} dir="rtl">
                {data.total.toLocaleString()} د.ع
              </span>
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
          <div
            style={{
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
            }}
          >
            <img
              src={logoSrc}
              alt="LEVONIS"
              style={{ width: '100px', height: '100px', objectFit: 'contain' }}
            />
          </div>

          {/* Customer info */}
          <div style={{ marginBottom: '10px' }}>
            <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>
              الفاتورة الى :
            </div>
            <div style={{ fontWeight: 700, fontSize: '16px' }}>{data.customerName}</div>
          </div>
          {data.phone && (
            <div style={{ marginBottom: '10px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>الرقم :</div>
              <div style={{ fontWeight: 700, fontSize: '15px' }} dir="ltr">
                {data.phone}
              </div>
            </div>
          )}
          {data.address && (
            <div style={{ marginBottom: '15px' }}>
              <div style={{ fontSize: '14px', color: '#666', marginBottom: '4px' }}>العنوان :</div>
              <div style={{ fontWeight: 700, fontSize: '14px' }}>{data.address}</div>
            </div>
          )}

          {/* QR Section - links to order page */}
          <div style={{ fontSize: '12px', color: '#555', marginBottom: '8px', lineHeight: 1.6 }}>
            قم بمسح الباركود لمتابعة الطلب
            <br />
            ومعرفة حالته الحالية :
          </div>
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '8px' }}>
            <QRCodeSVG value={data.qrCodeData} size={120} level="H" />
          </div>
          <div style={{ fontSize: '11px', color: '#888', marginTop: '5px' }} dir="ltr">
            #{data.invoiceNo}
          </div>
        </div>
      </div>

      {/* Signature section */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '40px',
          borderTop: '2px solid #1a1a1a',
          paddingTop: '20px',
        }}
      >
        {['البائع', 'الزبون', 'الحسابات'].map((label) => (
          <div key={label} style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '16px', fontWeight: 600, marginBottom: '8px' }}>{label}</div>
            <div style={{ borderBottom: '1px dashed #ccc', marginBottom: '10px' }}></div>
            <div style={{ height: '50px', background: '#f5f5f5', borderRadius: '4px' }}></div>
          </div>
        ))}
      </div>

      {/* Footer */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          marginTop: '30px',
          borderTop: '2px solid #1a1a1a',
          paddingTop: '15px',
          fontSize: '13px',
        }}
      >
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>
            PAYMENT DETAILS
          </div>
          <div>{data.paymentMethod || 'CASH'}</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>
            MOBILE
          </div>
          <div>07838455220</div>
        </div>
        <div>
          <div style={{ fontWeight: 700, fontSize: '12px', letterSpacing: '2px', marginBottom: '4px' }}>
            WEBSITE
          </div>
          <div>LEVONISIQ.COM</div>
        </div>
      </div>
    </div>
  );
}
