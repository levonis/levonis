import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Download, Printer as PrinterIcon } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import logoImg from '@/assets/logo-new.png';

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
  delivery: number;
  total: number;
  invoiceNo: string;
  date: Date;
}

interface Props {
  printer: PrinterData;
  open: boolean;
  onClose: () => void;
}

export default function PrinterInvoiceGenerator({ printer, open, onClose }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [manualFields, setManualFields] = useState({
    subtotal: '',
    delivery: '12000',
  });
  const [step, setStep] = useState<'config' | 'preview'>('config');

  const fetchInvoiceData = async () => {
    setLoading(true);
    try {
      // Fetch user profile & address
      let customerName = '';
      let phone = '';
      let address = '';

      if (printer.buyer_user_id) {
        const { data: profile } = await supabase
          .from('profiles')
          .select('full_name, username, phone_number')
          .eq('id', printer.buyer_user_id)
          .single();

        customerName = profile?.full_name || profile?.username || '';
        phone = profile?.phone_number || '';

        // Get default address
        const { data: addr } = await supabase
          .from('user_addresses')
          .select('*')
          .eq('user_id', printer.buyer_user_id)
          .eq('is_default', true)
          .single();

        if (addr) {
          address = `${addr.governorate} - ${addr.area}${addr.neighborhood ? ' ' + addr.neighborhood : ''}${addr.nearest_landmark ? ' قرب ' + addr.nearest_landmark : ''}`;
          if (!phone && addr.phone_number) phone = addr.phone_number;
          if (!customerName && addr.full_name) customerName = addr.full_name;
        }
      }

      // Get order item price if available
      let subtotal = 0;
      if (printer.order_item_id) {
        const { data: orderItem } = await supabase
          .from('order_items')
          .select('total_price, quantity')
          .eq('id', printer.order_item_id)
          .single();
        if (orderItem) {
          subtotal = orderItem.total_price || 0;
        }
      }

      const sub = subtotal || parseFloat(manualFields.subtotal) || 0;
      const deliveryFee = parseFloat(manualFields.delivery) || 12000;
      const taxAmount = Math.round(sub * 0.03);

      const now = new Date();
      const invoiceNo = format(now, 'yyyyMMdd-HHmm');

      setInvoiceData({
        customerName,
        phone,
        address,
        printerModel: printer.model_name || printer.model_name_ar,
        serialNumber: printer.serial_number,
        qrCodeData: printer.qr_code_data || '',
        subtotal: sub,
        tax: taxAmount,
        delivery: deliveryFee,
        total: sub + taxAmount + deliveryFee,
        invoiceNo,
        date: now,
      });

      if (sub > 0) {
        setStep('preview');
      } else {
        // Need manual subtotal
        setManualFields(prev => ({ ...prev, subtotal: '' }));
      }
    } catch (err) {
      toast.error('حدث خطأ أثناء جلب البيانات');
    } finally {
      setLoading(false);
    }
  };

  const handleGeneratePreview = () => {
    if (!invoiceData) return;
    const sub = parseFloat(manualFields.subtotal) || invoiceData.subtotal;
    const deliveryFee = parseFloat(manualFields.delivery) || 12000;
    const taxAmount = Math.round(sub * 0.03);
    setInvoiceData({
      ...invoiceData,
      subtotal: sub,
      tax: taxAmount,
      delivery: deliveryFee,
      total: sub + taxAmount + deliveryFee,
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
      setStep('config');
      setInvoiceData(null);
      fetchInvoiceData();
    }
  }, [open]);

  const dayNames = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const monthNames = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC'];

  return (
    <Dialog open={open} onOpenChange={() => onClose()}>
      <DialogContent className="max-w-4xl max-h-[95vh] overflow-auto p-0">
        <DialogHeader className="p-6 pb-3 border-b">
          <DialogTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            توليد فاتورة وضمان
          </DialogTitle>
        </DialogHeader>

        {loading && (
          <div className="flex justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        )}

        {!loading && step === 'config' && invoiceData && invoiceData.subtotal === 0 && (
          <div className="p-6 space-y-4">
            <p className="text-muted-foreground">لم يتم العثور على سعر تلقائي. أدخل البيانات يدوياً:</p>
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
                <Label>المبلغ الفرعي (Sub-total) - د.ع</Label>
                <Input
                  type="number"
                  value={manualFields.subtotal}
                  onChange={(e) => setManualFields(prev => ({ ...prev, subtotal: e.target.value }))}
                  placeholder="مثال: 2185000"
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
            <Button onClick={handleGeneratePreview} disabled={!manualFields.subtotal}>
              عرض الفاتورة
            </Button>
          </div>
        )}

        {!loading && step === 'preview' && invoiceData && (
          <>
            <div className="flex gap-2 p-4 border-b bg-muted/30">
              <Button onClick={handlePrint} variant="outline" size="sm">
                <PrinterIcon className="w-4 h-4 ml-2" />
                طباعة
              </Button>
              <Button onClick={() => setStep('config')} variant="ghost" size="sm">
                تعديل البيانات
              </Button>
            </div>
            <div className="p-4 overflow-auto bg-white">
              <div ref={invoiceRef}>
                <InvoiceTemplate data={invoiceData} logoSrc={logoImg} />
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
    }}>
      {/* Header */}
      <div style={{ fontSize: '18px', fontWeight: 700, letterSpacing: '4px', marginBottom: '20px', fontVariant: 'small-caps' }}>
        INVOICE AND WARRANTY
      </div>

      {/* Two column layout */}
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '30px' }}>
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
            <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #ccc', paddingBottom: '8px', marginBottom: '15px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Description</span>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Subtotal</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '10px' }}>
              <span style={{ fontSize: '14px' }}>{data.printerModel}</span>
              <span style={{ fontSize: '14px' }} dir="rtl">{data.subtotal.toLocaleString()} د.ع</span>
            </div>
            {/* Empty rows like template */}
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
            <div style={{ borderBottom: '1px solid #ddd', marginBottom: '12px', paddingBottom: '12px' }}></div>
          </div>

          {/* Totals */}
          <div style={{ marginTop: '20px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>Sub-total:</span>
              <span style={{ fontSize: '14px' }} dir="rtl">{data.subtotal.toLocaleString()} د.ع</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>tax (3%):</span>
              <span style={{ fontSize: '14px' }} dir="rtl">{data.tax.toLocaleString()} د.ع</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '8px' }}>
              <span style={{ fontWeight: 700, fontSize: '13px' }}>delivery:</span>
              <span style={{ fontSize: '14px' }} dir="rtl">{data.delivery.toLocaleString()} د.ع</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '10px', borderTop: '1px solid #999', paddingTop: '10px' }}>
              <span style={{ fontWeight: 700, fontSize: '15px' }}>Total:</span>
              <span style={{ fontWeight: 700, fontSize: '18px' }} dir="rtl">{data.total.toLocaleString()} د.ع</span>
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
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: '8px' }}>
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
          <div>CASH</div>
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
