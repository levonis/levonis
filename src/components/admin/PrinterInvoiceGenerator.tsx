import React, { useRef, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { QRCodeSVG } from 'qrcode.react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Loader2, FileText, Printer as PrinterIcon, Search, User, Check } from 'lucide-react';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { useQuery } from '@tanstack/react-query';
import { ScrollArea } from '@/components/ui/scroll-area';
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

interface BuyerOption {
  userId: string;
  fullName: string;
  username: string;
  phone: string;
  address: string;
  printerSerial: string;
  printerModel: string;
  orderNumber?: string;
  totalPrice?: number;
  orderItemId?: string;
}

export default function PrinterInvoiceGenerator({ printer, open, onClose }: Props) {
  const invoiceRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(false);
  const [invoiceData, setInvoiceData] = useState<InvoiceData | null>(null);
  const [manualFields, setManualFields] = useState({ subtotal: '', delivery: '12000', tax: '' });
  const [step, setStep] = useState<'select-user' | 'config' | 'preview'>('select-user');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
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
      const { data: printerOrders } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          user_id,
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
        productName: string;
        productNameAr: string;
        totalPrice: number;
        orderItemId: string;
      }> = [];

      printerOrders?.forEach((order: any) => {
        const items = order.order_items || [];
        items.forEach((item: any) => {
          const product = item.products;
          if (product && product.category_id === PRINTER_CATEGORY_ID) {
            orderBuyers.push({
              userId: order.user_id,
              orderNumber: order.order_number || order.id?.slice(0, 8),
              productName: product.name || '',
              productNameAr: product.name_ar || product.name || '',
              totalPrice: item.total_price || 0,
              orderItemId: item.id,
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
        .select('user_id, governorate, area, neighborhood, nearest_landmark, phone_number, full_name')
        .in('user_id', allUserIds)
        .eq('is_default', true);

      const profileMap: Record<string, any> = {};
      profiles?.forEach(p => { profileMap[p.id] = p; });
      const addrMap: Record<string, any> = {};
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
address: addr ? [addr.governorate, addr.area, addr.neighborhood, addr.nearest_landmark].filter(Boolean).join(' - ') : '',
          printerSerial: '',
          printerModel: ob.productNameAr || ob.productName,
          orderNumber: ob.orderNumber,
          totalPrice: ob.totalPrice,
          orderItemId: ob.orderItemId,
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
      let subtotal = buyer.totalPrice || 0;
      
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

      const sub = subtotal || parseFloat(manualFields.subtotal) || 0;
      const deliveryFee = parseFloat(manualFields.delivery) || 12000;
      const taxAmount = Math.round(sub * 0.03);
      const now = new Date();

      setInvoiceData({
        customerName: buyer.fullName,
        phone: buyer.phone,
        address: buyer.address,
        printerModel: buyer.printerModel || printer.model_name || printer.model_name_ar,
        serialNumber: printer.serial_number,
        qrCodeData: printer.qr_code_data || '',
        subtotal: sub,
        tax: taxAmount,
        delivery: deliveryFee,
        total: sub + taxAmount + deliveryFee,
        invoiceNo: format(now, 'yyyyMMdd-HHmm'),
        date: now,
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
      delivery: 12000,
      total: 12000,
      invoiceNo: format(now, 'yyyyMMdd-HHmm'),
      date: now,
    });
    setSelectedUserId(null);
    setStep('config');
  };

  const handleGeneratePreview = () => {
    if (!invoiceData) return;
    const sub = parseFloat(manualFields.subtotal) || invoiceData.subtotal;
    const deliveryFee = parseFloat(manualFields.delivery) || 12000;
    const taxAmount = manualFields.tax !== '' ? parseFloat(manualFields.tax) || 0 : Math.round(sub * 0.03);
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
      setStep('select-user');
      setInvoiceData(null);
      setSelectedUserId(null);
      setBuyerSearch('');
      setManualFields({ subtotal: '', delivery: '12000' });
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
                <Label>المبلغ الفرعي (Sub-total) - د.ع</Label>
                <Input
                  type="number"
                  value={manualFields.subtotal || (invoiceData.subtotal > 0 ? String(invoiceData.subtotal) : '')}
                  onChange={(e) => setManualFields(prev => ({ ...prev, subtotal: e.target.value }))}
                  placeholder="مثال: 2185000"
                />
              </div>
              <div>
                <Label>الضريبة - د.ع (افتراضي 3%)</Label>
                <Input
                  type="number"
                  value={manualFields.tax}
                  onChange={(e) => setManualFields(prev => ({ ...prev, tax: e.target.value }))}
                  placeholder={`تلقائي: ${Math.round((parseFloat(manualFields.subtotal) || invoiceData?.subtotal || 0) * 0.03).toLocaleString()}`}
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
