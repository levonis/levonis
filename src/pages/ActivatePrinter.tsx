import React, { useState, useEffect, useRef } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useMutation } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { QrCode, Printer, Shield, Calendar, Loader2, Camera, CheckCircle, AlertTriangle, Search } from 'lucide-react';
import { addMonths, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import Footer from '@/components/Footer';

const ActivatePrinter = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [serialInput, setSerialInput] = useState(searchParams.get('serial') || '');
  const [printerData, setPrinterData] = useState<any>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState('');
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const scannerContainerId = 'qr-scanner-container';

  // Auto-lookup if serial from URL
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
        setLookupError('هذه الطابعة مسجلة بالفعل في حسابك');
      } else {
        setLookupError('هذه الطابعة مسجلة بالفعل لدى مستخدم آخر');
      }
      return;
    }

    setPrinterData(data);
  };

  const activateMutation = useMutation({
    mutationFn: async () => {
      if (!user || !printerData) throw new Error('بيانات غير كاملة');

      const activationDate = new Date();
      const expiryDate = addMonths(activationDate, printerData.warranty_months || 6);

      // Update store_printers
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

      // Create user_printers entry
      const { data: userPrinter, error: upError } = await supabase
        .from('user_printers')
        .insert({
          user_id: user.id,
          store_printer_id: printerData.id,
          verification_status: 'verified',
        })
        .select('id')
        .single();

      if (upError) throw upError;

      // Send notification
      await supabase.from('notifications').insert({
        user_id: user.id,
        title: '🎉 تم تفعيل الطابعة بنجاح!',
        message: `تم تفعيل طابعتك "${printerData.model_name_ar}" بنجاح. فترة الضمان: ${printerData.warranty_months} شهر.`,
        type: 'success',
        related_id: printerData.id,
        is_general: false,
      });

      return { userPrinterId: userPrinter.id, printerId: printerData.id };
    },
    onSuccess: (data) => {
      toast.success('🎉 تم تفعيل الطابعة بنجاح!');
      navigate(`/warranty-dashboard/${data.printerId}`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء التفعيل');
    },
  });

  const startScanner = async () => {
    setScannerActive(true);
    try {
      const { Html5Qrcode } = await import('html5-qrcode');
      
      // Small delay to ensure DOM element exists
      await new Promise(resolve => setTimeout(resolve, 100));
      
      const scanner = new Html5Qrcode(scannerContainerId);
      scannerRef.current = scanner;

      await scanner.start(
        { facingMode: 'environment' },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          // Extract serial from URL or use as-is
          let serial = decodedText;
          try {
            const url = new URL(decodedText);
            serial = url.searchParams.get('serial') || decodedText;
          } catch {
            // Not a URL, use as serial directly
          }
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
      try {
        await scannerRef.current.stop();
      } catch {}
      scannerRef.current = null;
    }
    setScannerActive(false);
  };

  useEffect(() => {
    return () => { stopScanner(); };
  }, []);

  if (authLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <Shield className="w-16 h-16 mx-auto text-primary mb-4" />
            <h2 className="text-xl font-bold mb-2">سجّل الدخول لتفعيل طابعتك</h2>
            <p className="text-muted-foreground mb-4">يجب تسجيل الدخول لتتمكن من تفعيل الطابعة وبدء فترة الضمان</p>
            <Button onClick={() => navigate('/auth')} className="w-full">تسجيل الدخول</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-8 space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <div className="w-16 h-16 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
            <QrCode className="w-8 h-8 text-primary" />
          </div>
          <h1 className="text-2xl font-bold">تفعيل الطابعة</h1>
          <p className="text-muted-foreground">امسح رمز QR أو أدخل الرقم التسلسلي لتفعيل طابعتك</p>
        </div>

        {/* Scanner */}
        <Card>
          <CardContent className="p-4 space-y-4">
            {!scannerActive ? (
              <Button variant="outline" className="w-full h-32 flex-col gap-3" onClick={startScanner}>
                <Camera className="w-8 h-8 text-muted-foreground" />
                <span>فتح الكاميرا لمسح QR</span>
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

        {/* Printer Preview Card */}
        {printerData && (
          <Card className="border-primary/30 shadow-lg">
            <CardContent className="p-6 space-y-4">
              <div className="flex items-center gap-4">
                {printerData.image_url ? (
                  <img src={printerData.image_url} className="w-20 h-20 rounded-xl object-cover border" alt={printerData.model_name_ar} />
                ) : (
                  <div className="w-20 h-20 rounded-xl bg-muted flex items-center justify-center">
                    <Printer className="w-10 h-10 text-muted-foreground" />
                  </div>
                )}
                <div className="flex-1">
                  <h3 className="text-lg font-bold">{printerData.model_name_ar}</h3>
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
                className="w-full h-12 text-base" 
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
      <Footer />
    </div>
  );
};

export default ActivatePrinter;
