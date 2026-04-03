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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { toast } from 'sonner';
import { QRCodeSVG } from 'qrcode.react';
import { Loader2, Plus, QrCode, Printer, Download, Eye, CheckCircle, Clock, AlertTriangle, FileText, Upload, X, Pencil, Trash2, CalendarIcon, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const AdminQRPrinterTab = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [viewQRDialogOpen, setViewQRDialogOpen] = useState(false);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [invoicePrinter, setInvoicePrinter] = useState<any>(null);
  const qrRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);

  // Edit serial dialog state
  const [editSerialDialog, setEditSerialDialog] = useState(false);
  const [editingPrinter, setEditingPrinter] = useState<any>(null);
  const [newSerialNumber, setNewSerialNumber] = useState('');

  // Delete confirm dialog state
  const [deleteConfirmDialog, setDeleteConfirmDialog] = useState(false);
  const [deletingPrinter, setDeletingPrinter] = useState<any>(null);

  // Warranty date dialog state
  const [warrantyDialog, setWarrantyDialog] = useState(false);
  const [warrantyPrinter, setWarrantyPrinter] = useState<any>(null);
  const [warrantyStartDate, setWarrantyStartDate] = useState<Date | undefined>();
  const [warrantyEndDate, setWarrantyEndDate] = useState<Date | undefined>();
  const [warrantyPeriod, setWarrantyPeriod] = useState<string>('6'); // months or 'custom'

  const [newPrinter, setNewPrinter] = useState({
    serial_number: '',
    model_name_ar: '',
    model_name: '',
    image_url: '',
    warranty_months: 6,
  });

  const handleImageSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      toast.error('الرجاء اختيار ملف صورة');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast.error('حجم الصورة يجب أن لا يتجاوز 5MB');
      return;
    }
    setImageFile(file);
    setImagePreview(URL.createObjectURL(file));
  }, []);

  const clearImage = useCallback(() => {
    setImageFile(null);
    if (imagePreview) URL.revokeObjectURL(imagePreview);
    setImagePreview(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }, [imagePreview]);

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
      let finalImageUrl = printer.image_url || null;

      if (imageFile) {
        setUploading(true);
        const ext = imageFile.name.split('.').pop();
        const filePath = `printers/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
        const { error: uploadError } = await supabase.storage
          .from('product-images')
          .upload(filePath, imageFile, { cacheControl: '3600', upsert: false });
        setUploading(false);
        if (uploadError) throw new Error('فشل رفع الصورة: ' + uploadError.message);
        const { data: urlData } = supabase.storage.from('product-images').getPublicUrl(filePath);
        finalImageUrl = urlData.publicUrl;
      }

      const origin = window.location.origin;
      const qrData = `${origin}/activate-printer?serial=${encodeURIComponent(printer.serial_number)}`;
      
      const { error } = await supabase.from('store_printers').insert({
        serial_number: printer.serial_number,
        model_name_ar: printer.model_name_ar,
        model_name: printer.model_name || printer.model_name_ar,
        image_url: finalImageUrl,
        warranty_months: printer.warranty_months,
        status: 'pending',
        qr_code_data: qrData,
        is_registered: false,
      });
      if (error) throw error;

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
      clearImage();
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('الرقم التسلسلي مستخدم بالفعل');
      } else {
        toast.error(error.message || 'حدث خطأ');
      }
    },
  });

  // Edit serial mutation
  const editSerialMutation = useMutation({
    mutationFn: async ({ printerId, oldSerial, newSerial }: { printerId: string; oldSerial: string; newSerial: string }) => {
      const origin = window.location.origin;
      const newQrData = `${origin}/activate-printer?serial=${encodeURIComponent(newSerial)}`;
      
      const { error } = await supabase
        .from('store_printers')
        .update({ serial_number: newSerial, qr_code_data: newQrData })
        .eq('id', printerId);
      if (error) throw error;

      await supabase.from('printer_protection_logs').insert({
        admin_id: user?.id,
        action: 'edit_serial_number',
        entity_type: 'store_printer',
        entity_id: printerId,
        details: { old_serial: oldSerial, new_serial: newSerial },
      });
    },
    onSuccess: () => {
      toast.success('تم تعديل الرقم التسلسلي بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-qr-printers'] });
      setEditSerialDialog(false);
      setEditingPrinter(null);
      setNewSerialNumber('');
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate') || error.message?.includes('unique')) {
        toast.error('الرقم التسلسلي مستخدم بالفعل');
      } else {
        toast.error(error.message || 'حدث خطأ في تعديل الرقم التسلسلي');
      }
    },
  });

  // Delete printer mutation - fully removes the serial number record
  const deletePrinterMutation = useMutation({
    mutationFn: async (printer: any) => {
      // Remove user_printers records first (FK dependency)
      await supabase.from('user_printers').delete().eq('store_printer_id', printer.id);

      // Remove any subscription records referencing this printer via user_printers
      // (already handled by cascading from user_printers delete above)

      // Log the deletion before removing
      await supabase.from('printer_protection_logs').insert({
        admin_id: user?.id,
        action: 'delete_printer',
        entity_type: 'store_printer',
        entity_id: printer.id,
        details: { serial_number: printer.serial_number, previous_user: printer.buyer_user_id },
      });

      // Actually delete the printer record
      const { error } = await supabase
        .from('store_printers')
        .delete()
        .eq('id', printer.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف السيريال نمبر بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-qr-printers'] });
      setDeleteConfirmDialog(false);
      setDeletingPrinter(null);
    },
    onError: (error: any) => {
      console.error('Delete printer error:', error);
      toast.error(error.message || 'حدث خطأ في حذف السيريال');
    },
  });

  // Set warranty dates mutation
  const setWarrantyMutation = useMutation({
    mutationFn: async ({ printerId, startDate, endDate }: { printerId: string; startDate: Date; endDate: Date }) => {
      const { error } = await supabase
        .from('store_printers')
        .update({
          activation_date: startDate.toISOString(),
          expiry_date: endDate.toISOString(),
          status: 'active',
          is_registered: true,
        })
        .eq('id', printerId);
      if (error) throw error;

      await supabase.from('printer_protection_logs').insert({
        admin_id: user?.id,
        action: 'set_warranty_dates',
        entity_type: 'store_printer',
        entity_id: printerId,
        details: { start_date: startDate.toISOString(), end_date: endDate.toISOString() },
      });
    },
    onSuccess: () => {
      toast.success('تم تحديد تواريخ الضمان بنجاح');
      queryClient.invalidateQueries({ queryKey: ['admin-qr-printers'] });
      setWarrantyDialog(false);
      setWarrantyPrinter(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ في تحديد تواريخ الضمان');
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
                <TableHead>الإجراءات</TableHead>
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
                      <Button variant="ghost" size="icon" title="عرض QR" onClick={() => { setSelectedPrinter(printer); setViewQRDialogOpen(true); }}>
                        <Eye className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="تحميل QR" onClick={() => downloadQR(printer)}>
                        <Download className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="تعديل السيريال" onClick={() => {
                        setEditingPrinter(printer);
                        setNewSerialNumber(printer.serial_number);
                        setEditSerialDialog(true);
                      }}>
                        <Pencil className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="تحديد تاريخ الضمان" onClick={() => {
                        setWarrantyPrinter(printer);
                        setWarrantyStartDate(printer.activation_date ? new Date(printer.activation_date) : new Date());
                        setWarrantyEndDate(printer.expiry_date ? new Date(printer.expiry_date) : undefined);
                        setWarrantyPeriod(printer.expiry_date ? 'custom' : '6');
                        setWarrantyDialog(true);
                      }}>
                        <Shield className="w-4 h-4" />
                      </Button>
                      <Button variant="ghost" size="icon" title="إعادة تعيين" className="text-destructive hover:text-destructive" onClick={() => {
                        setDeletingPrinter(printer);
                        setDeleteConfirmDialog(true);
                      }}>
                        <Trash2 className="w-4 h-4" />
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
              <Label>صورة الطابعة</Label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handleImageSelect}
              />
              {imagePreview ? (
                <div className="relative w-full">
                  <img src={imagePreview} alt="معاينة" className="w-full h-32 object-contain rounded-lg border bg-muted" />
                  <Button
                    type="button"
                    variant="destructive"
                    size="icon"
                    className="absolute top-1 left-1 h-6 w-6"
                    onClick={clearImage}
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ) : (
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-20 flex-col gap-1"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <Upload className="w-5 h-5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">اختر صورة (حد أقصى 5MB)</span>
                </Button>
              )}
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
              disabled={createMutation.isPending || uploading}
            >
              {(createMutation.isPending || uploading) ? <Loader2 className="w-4 h-4 animate-spin" /> : 'إنشاء وتوليد QR'}
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

      {/* Edit Serial Dialog */}
      <Dialog open={editSerialDialog} onOpenChange={setEditSerialDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>تعديل الرقم التسلسلي</DialogTitle>
            <DialogDescription>
              الطراز: {editingPrinter?.model_name_ar}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>الرقم التسلسلي الحالي</Label>
              <Input value={editingPrinter?.serial_number || ''} disabled dir="ltr" className="opacity-60" />
            </div>
            <div className="space-y-2">
              <Label>الرقم التسلسلي الجديد</Label>
              <Input
                value={newSerialNumber}
                onChange={(e) => setNewSerialNumber(e.target.value)}
                placeholder="أدخل الرقم التسلسلي الجديد"
                dir="ltr"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditSerialDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!newSerialNumber.trim()) {
                  toast.error('الرجاء إدخال الرقم التسلسلي الجديد');
                  return;
                }
                if (newSerialNumber.trim() === editingPrinter?.serial_number) {
                  toast.error('الرقم التسلسلي الجديد مطابق للحالي');
                  return;
                }
                editSerialMutation.mutate({
                  printerId: editingPrinter.id,
                  oldSerial: editingPrinter.serial_number,
                  newSerial: newSerialNumber.trim(),
                });
              }}
              disabled={editSerialMutation.isPending}
            >
              {editSerialMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ التعديل'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete/Reset Confirm Dialog */}
      <AlertDialog open={deleteConfirmDialog} onOpenChange={setDeleteConfirmDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>إعادة تعيين الطابعة</AlertDialogTitle>
            <AlertDialogDescription>
              سيتم إلغاء ربط الطابعة "{deletingPrinter?.model_name_ar}" (السيريال: {deletingPrinter?.serial_number}) من المستخدم الحالي وإعادة حالتها إلى "معلّقة".
              {deletingPrinter?.buyer_user_id && (
                <span className="block mt-2 text-destructive font-medium">
                  ⚠️ هذا الإجراء سيزيل الطابعة من حساب المستخدم ويلغي الضمان.
                </span>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingPrinter && deletePrinterMutation.mutate(deletingPrinter)}
              disabled={deletePrinterMutation.isPending}
            >
              {deletePrinterMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الإعادة'}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Warranty Date Dialog */}
      <Dialog open={warrantyDialog} onOpenChange={setWarrantyDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تحديد تاريخ الضمان</DialogTitle>
            <DialogDescription>
              {warrantyPrinter?.model_name_ar} — {warrantyPrinter?.serial_number}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            {/* Start Date - manual */}
            <div className="space-y-2">
              <Label>تاريخ بدء الضمان</Label>
              <Popover>
                <PopoverTrigger asChild>
                  <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !warrantyStartDate && "text-muted-foreground")}>
                    <CalendarIcon className="ml-2 h-4 w-4" />
                    {warrantyStartDate ? format(warrantyStartDate, 'dd/MM/yyyy') : 'اختر التاريخ'}
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-auto p-0" align="start">
                  <Calendar
                    mode="single"
                    selected={warrantyStartDate}
                    onSelect={(d) => {
                      setWarrantyStartDate(d);
                      // Auto-calc end date if period is not custom
                      if (d && warrantyPeriod !== 'custom') {
                        const months = parseInt(warrantyPeriod);
                        const end = new Date(d);
                        end.setMonth(end.getMonth() + months);
                        setWarrantyEndDate(end);
                      }
                    }}
                    initialFocus
                    className={cn("p-3 pointer-events-auto")}
                  />
                </PopoverContent>
              </Popover>
            </div>

            {/* Warranty Period Selection */}
            <div className="space-y-2">
              <Label>مدة الضمان</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: '3', label: '3 أشهر' },
                  { value: '6', label: '6 أشهر' },
                  { value: '12', label: 'سنة' },
                  { value: '24', label: 'سنتين' },
                  { value: 'custom', label: 'تاريخ مخصص' },
                ].map(opt => (
                  <Button
                    key={opt.value}
                    type="button"
                    size="sm"
                    variant={warrantyPeriod === opt.value ? 'default' : 'outline'}
                    className="text-xs"
                    onClick={() => {
                      setWarrantyPeriod(opt.value);
                      if (opt.value !== 'custom' && warrantyStartDate) {
                        const months = parseInt(opt.value);
                        const end = new Date(warrantyStartDate);
                        end.setMonth(end.getMonth() + months);
                        setWarrantyEndDate(end);
                      }
                    }}
                  >
                    {opt.label}
                  </Button>
                ))}
              </div>
            </div>

            {/* End Date */}
            <div className="space-y-2">
              <Label>تاريخ انتهاء الضمان {warrantyPeriod !== 'custom' && warrantyEndDate ? '(محسوب تلقائياً)' : ''}</Label>
              {warrantyPeriod === 'custom' ? (
                <Popover>
                  <PopoverTrigger asChild>
                    <Button variant="outline" className={cn("w-full justify-start text-left font-normal", !warrantyEndDate && "text-muted-foreground")}>
                      <CalendarIcon className="ml-2 h-4 w-4" />
                      {warrantyEndDate ? format(warrantyEndDate, 'dd/MM/yyyy') : 'اختر التاريخ'}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0" align="start">
                    <Calendar
                      mode="single"
                      selected={warrantyEndDate}
                      onSelect={setWarrantyEndDate}
                      initialFocus
                      className={cn("p-3 pointer-events-auto")}
                    />
                  </PopoverContent>
                </Popover>
              ) : (
                <div className="flex items-center gap-2 p-2.5 rounded-lg border bg-muted/30 text-sm">
                  <CalendarIcon className="h-4 w-4 text-muted-foreground" />
                  <span>{warrantyEndDate ? format(warrantyEndDate, 'dd/MM/yyyy') : 'حدد تاريخ البدء أولاً'}</span>
                </div>
              )}
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setWarrantyDialog(false)}>إلغاء</Button>
            <Button
              onClick={() => {
                if (!warrantyStartDate || !warrantyEndDate) {
                  toast.error('الرجاء تحديد تاريخ البدء والانتهاء');
                  return;
                }
                if (warrantyEndDate <= warrantyStartDate) {
                  toast.error('تاريخ الانتهاء يجب أن يكون بعد تاريخ البدء');
                  return;
                }
                setWarrantyMutation.mutate({
                  printerId: warrantyPrinter.id,
                  startDate: warrantyStartDate,
                  endDate: warrantyEndDate,
                });
              }}
              disabled={setWarrantyMutation.isPending}
            >
              {setWarrantyMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'حفظ تواريخ الضمان'}
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
