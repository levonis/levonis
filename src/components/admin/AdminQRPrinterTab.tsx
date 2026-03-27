import React, { useState, useRef, useCallback } from 'react';
import PrinterInvoiceGenerator from './PrinterInvoiceGenerator';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Plus, QrCode, Printer, Download, Eye, CheckCircle, Clock, AlertTriangle, FileText, Upload, X } from 'lucide-react';
import { format } from 'date-fns';

const AdminQRPrinterTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewQRDialogOpen, setViewQRDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [invoicePrinter, setInvoicePrinter] = useState<any>(null);
  const qrRef = useRef<HTMLDivElement>(null);

  const [newPrinter, setNewPrinter] = useState({
    serial_number: '',
    model_name_ar: '',
    model_name: '',
    image_url: '',
    warranty_months: 6,
  });

  // Fetch all admin-created printers (with QR)
  const { data: printers, isLoading } = useQuery({
    queryKey: ['admin-qr-printers'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_printers')
        .select('*')
        .not('qr_code_data', 'is', null)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Fetch profiles for claimed printers
  const { data: profiles } = useQuery({
    queryKey: ['qr-printer-profiles', printers],
    queryFn: async () => {
      const userIds = printers?.filter(p => p.buyer_user_id).map(p => p.buyer_user_id!) || [];
      if (userIds.length === 0) return {};
      const { data } = await supabase.from('profiles').select('id, username, full_name').in('id', userIds);
      const map: Record<string, any> = {};
      data?.forEach(p => { map[p.id] = p; });
      return map;
    },
    enabled: !!printers && printers.length > 0,
  });

  const createMutation = useMutation({
    mutationFn: async (printer: typeof newPrinter) => {
      const origin = window.location.origin;
      const qrData = `${origin}/activate-printer?serial=${encodeURIComponent(printer.serial_number)}`;
      
      const { error } = await supabase.from('store_printers').insert({
        serial_number: printer.serial_number,
        model_name_ar: printer.model_name_ar,
        model_name: printer.model_name || printer.model_name_ar,
        image_url: printer.image_url || null,
        warranty_months: printer.warranty_months,
        status: 'pending',
        qr_code_data: qrData,
        is_registered: false,
      });
      if (error) throw error;

      // Log
      await supabase.from('printer_protection_logs').insert({
        admin_id: user?.id,
        action: 'create_qr_printer',
        entity_type: 'store_printer',
        details: { serial_number: printer.serial_number, warranty_months: printer.warranty_months },
      });
    },
    onSuccess: () => {
      toast.success('تم إنشاء الطابعة وتوليد رمز QR بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-qr-printers'] });
      setCreateDialogOpen(false);
      setNewPrinter({ serial_number: '', model_name_ar: '', model_name: '', image_url: '', warranty_months: 6 });
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('الرقم التسلسلي مستخدم بالفعل');
      } else {
        toast.error(error.message || 'حدث خطأ');
      }
    },
  });

  const downloadQR = (printer: any) => {
    const svg = document.getElementById(`qr-${printer.id}`);
    if (!svg) return;
    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    canvas.width = 400;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    const img = new Image();
    img.onload = () => {
      ctx?.drawImage(img, 0, 0, 400, 400);
      const link = document.createElement('a');
      link.download = `QR-${printer.serial_number}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    };
    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30"><Clock className="w-3 h-3 ml-1" />معلّقة</Badge>;
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30"><CheckCircle className="w-3 h-3 ml-1" />مُفعّلة</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <QrCode className="w-5 h-5" />
          إنشاء طابعات مع رمز QR
        </CardTitle>
        <Button onClick={() => setCreateDialogOpen(true)}>
          <Plus className="w-4 h-4 ml-2" />
          إنشاء طابعة جديدة
        </Button>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="flex justify-center py-8">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : printers && printers.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>الطراز</TableHead>
                <TableHead>الرقم التسلسلي</TableHead>
                <TableHead>الضمان</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>المستخدم</TableHead>
                <TableHead>تاريخ التفعيل</TableHead>
                <TableHead>انتهاء الضمان</TableHead>
                <TableHead>QR</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {printers.map((printer) => (
                <TableRow key={printer.id}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {printer.image_url ? (
                        <img src={printer.image_url} className="w-8 h-8 rounded object-cover" alt="" />
                      ) : (
                        <Printer className="w-5 h-5 text-muted-foreground" />
                      )}
                      <span className="font-medium">{printer.model_name_ar}</span>
                    </div>
                  </TableCell>
                  <TableCell className="font-mono text-xs" dir="ltr">{printer.serial_number}</TableCell>
                  <TableCell>{printer.warranty_months} شهر</TableCell>
                  <TableCell>{getStatusBadge(printer.status)}</TableCell>
                  <TableCell>
                    {printer.buyer_user_id ? (
                      <span className="text-sm">{profiles?.[printer.buyer_user_id]?.username || profiles?.[printer.buyer_user_id]?.full_name || '—'}</span>
                    ) : (
                      <span className="text-xs text-muted-foreground">لم يُطالب بها</span>
                    )}
                  </TableCell>
                  <TableCell className="text-xs">
                    {printer.activation_date ? format(new Date(printer.activation_date), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell className="text-xs">
                    {printer.expiry_date ? format(new Date(printer.expiry_date), 'dd/MM/yyyy') : '—'}
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => { setSelectedPrinter(printer); setViewQRDialogOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => downloadQR(printer)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="توليد فاتورة" onClick={() => setInvoicePrinter(printer)}>
                        <FileText className="w-4 h-4" />
                      </Button>
                    </div>
                    {/* Hidden QR for download */}
                    <div className="hidden">
                      <QRCodeSVG id={`qr-${printer.id}`} value={printer.qr_code_data || ''} size={400} />
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <div className="text-center py-8 text-muted-foreground">
            <QrCode className="w-12 h-12 mx-auto mb-3 opacity-50" />
            <p>لم يتم إنشاء أي طابعات بعد</p>
            <p className="text-xs mt-1">أنشئ طابعة جديدة لتوليد رمز QR للتفعيل</p>
          </div>
        )}
      </CardContent>

      {/* Create Dialog */}
      <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إنشاء طابعة جديدة</DialogTitle>
            <DialogDescription>أدخل بيانات الطابعة وسيتم توليد رمز QR تلقائياً</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الرقم التسلسلي *</Label>
              <Input
                value={newPrinter.serial_number}
                onChange={(e) => setNewPrinter({ ...newPrinter, serial_number: e.target.value })}
                placeholder="SN-XXXXXXXXX"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الطراز (عربي) *</Label>
              <Input
                value={newPrinter.model_name_ar}
                onChange={(e) => setNewPrinter({ ...newPrinter, model_name_ar: e.target.value })}
                placeholder="مثال: طابعة Creality Ender 3"
              />
            </div>
            <div className="space-y-2">
              <Label>اسم الطراز (إنجليزي)</Label>
              <Input
                value={newPrinter.model_name}
                onChange={(e) => setNewPrinter({ ...newPrinter, model_name: e.target.value })}
                placeholder="e.g. Creality Ender 3"
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>رابط الصورة</Label>
              <Input
                value={newPrinter.image_url}
                onChange={(e) => setNewPrinter({ ...newPrinter, image_url: e.target.value })}
                placeholder="https://..."
                dir="ltr"
              />
            </div>
            <div className="space-y-2">
              <Label>مدة الضمان</Label>
              <Select
                value={String(newPrinter.warranty_months)}
                onValueChange={(v) => setNewPrinter({ ...newPrinter, warranty_months: Number(v) })}
              >
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="3">3 أشهر</SelectItem>
                  <SelectItem value="6">6 أشهر</SelectItem>
                  <SelectItem value="12">12 شهر (سنة)</SelectItem>
                  <SelectItem value="24">24 شهر (سنتان)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCreateDialogOpen(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!newPrinter.serial_number.trim() || !newPrinter.model_name_ar.trim()) {
                  toast.error('الرجاء إدخال الرقم التسلسلي واسم الطراز');
                  return;
                }
                createMutation.mutate(newPrinter);
              }}
              disabled={createMutation.isPending}
            >
              {createMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء وتوليد QR'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View QR Dialog */}
      <Dialog open={viewQRDialogOpen} onOpenChange={setViewQRDialogOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-center">رمز QR للتفعيل</DialogTitle>
            <DialogDescription className="text-center">
              {selectedPrinter?.model_name_ar} — {selectedPrinter?.serial_number}
            </DialogDescription>
          </DialogHeader>
          <div className="flex flex-col items-center gap-4 py-4" ref={qrRef}>
            {selectedPrinter?.qr_code_data && (
              <div className="p-4 bg-white rounded-xl">
                <QRCodeSVG value={selectedPrinter.qr_code_data} size={250} level="H" />
              </div>
            )}
            <p className="text-xs text-muted-foreground text-center">
              امسح هذا الرمز لتفعيل الطابعة وبدء فترة الضمان
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" className="w-full" onClick={() => selectedPrinter && downloadQR(selectedPrinter)}>
              <Download className="w-4 h-4 ml-2" />
              تحميل QR
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Invoice Generator */}
      <PrinterInvoiceGenerator
        printer={invoicePrinter}
        open={!!invoicePrinter}
        onClose={() => setInvoicePrinter(null)}
      />
    </Card>
  );
};

export default AdminQRPrinterTab;
