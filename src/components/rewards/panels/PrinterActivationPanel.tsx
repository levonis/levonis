import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { QrCode, Printer, Shield, Calendar, Loader2, Camera, CheckCircle, AlertTriangle, Search, Clock } from 'lucide-react';
import { addMonths, format, differenceInDays } from 'date-fns';
import { ar } from 'date-fns/locale';

interface PrinterActivationPanelProps {
  onActivated?: () => void;
}

export default function PrinterActivationPanel({ onActivated }: PrinterActivationPanelProps) {
  const { user } = useAuth();
  const [searchParams] = useSearchParams();
  const [serialInput, setSerialInput] = useState(searchParams.get('serial') || '');
  const [printerData, setPrinterData] = useState<any>(null);
  const [warrantyData, setWarrantyData] = useState<any>(null); // For showing warranty of already-registered printers
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-scanner-rewards';

  useEffect(() => {
    const serial = searchParams.get('serial');
    if (serial && user) {
      lookupSerial(serial);
    }
  }, [searchParams, user]);

  const lookupSerial = async (serial: string) => {
    if (!serial.trim()) {
      setLookupError('الرجاء إدخال الرقم التسلسلي');
      return;
    }
    setLookupLoading(true);
    setLookupError('');
    setPrinterData(null);
    setWarrantyData(null);

    const { data, error } = await supabase
      .from('store_printers')
      .select('*')
      .eq('serial_number', serial.trim())
      .maybeSingle();

    setLookupLoading(false);

    if (error || !data) {
      setLookupError('لم يتم العثور على طابعة بهذا الرقم التسلسلي');
      return;
    }

    if (data.status === 'active' && data.buyer_user_id) {
      if (data.buyer_user_id === user?.id) {
        // Show warranty info for user's own printer
        setWarrantyData(data);
        return;
      } else {
        setLookupError('هذه الطابعة مسجلة بالفعل لدى مستخدم آخر');
        return;
      }
    }

    setPrinterData(data);
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!user || !printerData) throw new Error('بيانات غير كاملة');

      const activationDate = new Date();
      const expiryDate = addMonths(activationDate, printerData.warranty_months || 6);

      const { error: updateError } = await supabase
        .from('store_printers')
        .update({
          buyer_user_id: user.id,
          status: 'active',
          is_registered: true,
          activation_date: activationDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
        })
        .eq('id', printerData.id);

      if (updateError) throw updateError;

      const { error: upError } = await supabase
        .from('user_printers')
        .insert({
          user_id: user.id,
          store_printer_id: printerData.id,
          verification_status: 'verified',
        });

      if (upError) throw upError;

      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '🎉 تم تفعيل الطابعة بنجاح!',
        message: `تم تفعيل طابعتك "${printerData.model_name_ar}" بنجاح. فترة الضمان: ${printerData.warranty_months} شهر.`,
        type: 'success',
        related_id: printerData.id,
        is_general: false,
      });
    },
    onSuccess: () => {
      toast.success('🎉 تم تفعيل الطابعة بنجاح!');
      // Show warranty data after activation
      if (printerData) {
        const activationDate = new Date();
        const expiryDate = addMonths(activationDate, printerData.warranty_months || 6);
        setWarrantyData({
          ...printerData,
          activation_date: activationDate.toISOString(),
          expiry_date: expiryDate.toISOString(),
          status: 'active',
        });
      }
      setPrinterData(null);
      setSerialInput('');
      onActivated?.();
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء التفعيل');
    },
  });

  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      await new Promise(resolve => setTimeout(resolve, 100));
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          let serial = decodedText;
          try {
            const url = new URL(decodedText);
            serial = url.searchParams.get('serial') || decodedText;
          } catch {}
          setSerialInput(serial);
          stopScanner();
          lookupSerial(serial);
        },
        () => {}
      );
    } catch (err) {
      console.error('Scanner error:', err);
      toast.error('لا يمكن الوصول إلى الكاميرا');
      setScannerActive(false);
    }
  };

  const stopScanner = async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); } catch {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
          <p className="text-muted-foreground">سجّل الدخول لتفعيل طابعتك</p>
        </CardContent>
      </Card>
    );
  }

  const getWarrantyStatus = (expiryDate: string | null) => {
    if (!expiryDate) return { active: false, daysLeft: 0 };
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysLeft = differenceInDays(expiry, now);
    return { active: daysLeft > 0, daysLeft: Math.max(0, daysLeft) };
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="text-center space-y-1">
        <div className="w-12 h-12 mx-auto rounded-xl bg-primary/10 flex items-center justify-center">
          <QrCode className="w-6 h-6 text-primary" />
        </div>
        <h2 className="text-lg font-bold">تفعيل الطابعة</h2>
        <p className="text-xs text-muted-foreground">امسح رمز QR أو أدخل الرقم التسلسلي</p>
      </div>

      {/* Scanner + Input */}
      <Card>
        <CardContent className="p-4 space-y-4">
          {!scannerActive ? (
            <Button variant="outline" className="w-full h-28 flex-col gap-2" onClick={startScanner}>
              <Camera className="w-7 h-7 text-muted-foreground" />
              <span className="text-sm">فتح الكاميرا لمسح QR</span>
            </Button>
          ) : (
            <div className="space-y-2">
              <div id={scannerContainerId} className="rounded-lg overflow-hidden" />
              <Button variant="outline" size="sm" className="w-full" onClick={stopScanner}>
                إغلاق الكاميرا
              </Button>
            </div>
          )}

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-card px-2 text-muted-foreground">أو أدخل يدوياً</span>
            </div>
          </div>

          <div className="space-y-2">
            <Label>الرقم التسلسلي</Label>
            <div className="flex gap-2">
              <Input
                value={serialInput}
                onChange={(e) => setSerialInput(e.target.value)}
                placeholder="SN-XXXXXXXXX"
                dir="ltr"
                className="flex-1"
                onKeyDown={(e) => e.key === 'Enter' && lookupSerial(serialInput)}
              />
              <Button onClick={() => lookupSerial(serialInput)} disabled={lookupLoading}>
                {lookupLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Search className="w-4 h-4" />}
              </Button>
            </div>
          </div>

          {lookupError && (
            <div className="flex items-center gap-2 p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              {lookupError}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Warranty Info Card - for already registered printers */}
      {warrantyData && (() => {
        const { active, daysLeft } = getWarrantyStatus(warrantyData.expiry_date);
        return (
          <Card className={`border-2 ${active ? 'border-green-500/30 shadow-green-500/10' : 'border-destructive/30 shadow-destructive/10'} shadow-lg`}>
            <CardContent className="p-5 space-y-4">
              <div className="flex items-center gap-4">
                {warrantyData.image_url ? (
                  <img src={warrantyData.image_url} className="w-16 h-16 rounded-xl object-cover border" alt={warrantyData.model_name_ar} />
                ) : (
                  <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                    <Printer className="w-8 h-8 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="font-bold">{warrantyData.model_name_ar}</h3>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">{warrantyData.serial_number}</p>
                  {active ? (
                    <Badge className="mt-1 bg-green-500/20 text-green-600 border-green-500/30">
                      <CheckCircle className="w-3 h-3 ml-1" />
                      ضمان نشط
                    </Badge>
                  ) : (
                    <Badge className="mt-1 bg-destructive/20 text-destructive border-destructive/30">
                      <AlertTriangle className="w-3 h-3 ml-1" />
                      الضمان منتهي
                    </Badge>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Shield className="w-3.5 h-3.5" />
                    مدة الضمان
                  </div>
                  <p className="font-bold">{warrantyData.warranty_months} شهر</p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    بدء الضمان
                  </div>
                  <p className="font-bold text-xs">
                    {warrantyData.activation_date
                      ? format(new Date(warrantyData.activation_date), 'dd MMM yyyy', { locale: ar })
                      : '—'}
                  </p>
                </div>
                <div className="p-3 rounded-lg bg-muted/50">
                  <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                    <Calendar className="w-3.5 h-3.5" />
                    انتهاء الضمان
                  </div>
                  <p className="font-bold text-xs">
                    {warrantyData.expiry_date
                      ? format(new Date(warrantyData.expiry_date), 'dd MMM yyyy', { locale: ar })
                      : '—'}
                  </p>
                </div>
              </div>

              {active && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-center">
                  <p className="text-sm text-green-700 dark:text-green-400">
                    <Clock className="w-4 h-4 inline-block ml-1" />
                    متبقي <span className="font-bold">{daysLeft}</span> يوم على انتهاء الضمان
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        );
      })()}

      {/* Printer Preview - for new activation */}
      {printerData && (
        <Card className="border-primary/30 shadow-lg">
          <CardContent className="p-5 space-y-4">
            <div className="flex items-center gap-4">
              {printerData.image_url ? (
                <img src={printerData.image_url} className="w-16 h-16 rounded-xl object-cover border" alt={printerData.model_name_ar} />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-muted flex items-center justify-center">
                  <Printer className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div className="flex-1">
                <h3 className="font-bold">{printerData.model_name_ar}</h3>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{printerData.serial_number}</p>
                <Badge className="mt-1 bg-amber-500/20 text-amber-600 border-amber-500/30">
                  <Clock className="w-3 h-3 ml-1" />
                  في انتظار التفعيل
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Shield className="w-3.5 h-3.5" />
                  مدة الضمان
                </div>
                <p className="font-bold">{printerData.warranty_months} شهر</p>
              </div>
              <div className="p-3 rounded-lg bg-muted/50">
                <div className="flex items-center gap-1.5 text-xs text-muted-foreground mb-1">
                  <Calendar className="w-3.5 h-3.5" />
                  ينتهي في
                </div>
                <p className="font-bold text-sm">
                  {format(addMonths(new Date(), printerData.warranty_months || 6), 'dd MMM yyyy', { locale: ar })}
                </p>
              </div>
            </div>

            <Button
              className="w-full h-11"
              onClick={() => activateMutation.mutate()}
              disabled={activateMutation.isPending}
            >
              {activateMutation.isPending ? (
                <Loader2 className="w-5 h-5 animate-spin" />
              ) : (
                <>
                  <CheckCircle className="w-5 h-5 ml-2" />
                  تأكيد وتفعيل الطابعة
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
