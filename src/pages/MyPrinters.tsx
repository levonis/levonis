import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Printer, Plus, Shield, ShieldCheck, ShieldX, AlertCircle, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface StorePrinter {
  id: string;
  model_name: string;
  model_name_ar: string;
  serial_number: string;
}

interface UserPrinter {
  id: string;
  user_id: string;
  store_printer_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  store_printers: StorePrinter;
  printer_subscriptions: Array<{
    id: string;
    status: 'active' | 'paused' | 'expired' | 'cancelled';
    protection_plans: {
      name_ar: string;
      plan_type: string;
    };
  }>;
}

const MyPrinters = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [serialNumber, setSerialNumber] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [verifiedPrinter, setVerifiedPrinter] = useState<{ id: string; model_name_ar: string } | null>(null);

  // Fetch user's printers
  const { data: printers, isLoading } = useQuery({
    queryKey: ['user-printers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          *,
          store_printers (*),
          printer_subscriptions (
            id,
            status,
            protection_plans (name_ar, plan_type)
          )
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as UserPrinter[];
    },
    enabled: !!user,
  });

  // Verify serial number
  const verifySerial = async () => {
    if (!serialNumber.trim()) {
      toast.error('الرجاء إدخال الرقم التسلسلي');
      return;
    }

    setVerifying(true);
    try {
      const { data, error } = await supabase
        .rpc('verify_printer_serial', { p_serial_number: serialNumber.trim() });

      if (error) throw error;

      if (!data || data.length === 0) {
        toast.error('الرقم التسلسلي غير موجود في سجلات المتجر');
        setVerifiedPrinter(null);
        return;
      }

      const printer = data[0];
      if (!printer.is_available) {
        toast.error('هذه الطابعة مسجلة مسبقاً لمستخدم آخر');
        setVerifiedPrinter(null);
        return;
      }

      setVerifiedPrinter({
        id: printer.store_printer_id,
        model_name_ar: printer.model_name_ar,
      });
      toast.success('تم التحقق من الرقم التسلسلي بنجاح!');
    } catch (error: any) {
      toast.error('حدث خطأ أثناء التحقق');
      console.error(error);
    } finally {
      setVerifying(false);
    }
  };

  // Register printer mutation
  const registerMutation = useMutation({
    mutationFn: async () => {
      const { data, error } = await supabase
        .rpc('register_user_printer', {
          p_user_id: user!.id,
          p_serial_number: serialNumber.trim(),
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم تسجيل الطابعة بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['user-printers'] });
      setAddDialogOpen(false);
      setSerialNumber('');
      setVerifiedPrinter(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء التسجيل');
    },
  });

  const getStatusBadge = (printer: UserPrinter) => {
    const activeSubscription = printer.printer_subscriptions?.find(s => s.status === 'active');
    
    if (activeSubscription) {
      return (
        <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
          <ShieldCheck className="w-3 h-3 ml-1" />
          مشتركة - {activeSubscription.protection_plans?.name_ar}
        </Badge>
      );
    }

    const expiredSubscription = printer.printer_subscriptions?.find(s => s.status === 'expired');
    if (expiredSubscription) {
      return (
        <Badge className="bg-destructive/20 text-destructive border-destructive/30">
          <ShieldX className="w-3 h-3 ml-1" />
          منتهية الحماية
        </Badge>
      );
    }

    return (
      <Badge className="bg-muted text-muted-foreground border-border">
        <Shield className="w-3 h-3 ml-1" />
        غير مشتركة
      </Badge>
    );
  };

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      <Header />
      
      <main className="flex-1 container mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
              <Printer className="w-8 h-8 text-primary" />
              طابعاتي
            </h1>
            <p className="text-muted-foreground mt-2">إدارة الطابعات المسجلة وحالة الحماية</p>
          </div>

          <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Plus className="w-4 h-4" />
                إضافة طابعة
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-md">
              <DialogHeader>
                <DialogTitle>إضافة طابعة جديدة</DialogTitle>
              </DialogHeader>
              
              <div className="space-y-4 py-4">
                <div className="space-y-2">
                  <Label htmlFor="serial">الرقم التسلسلي (Serial Number)</Label>
                  <Input
                    id="serial"
                    placeholder="أدخل الرقم التسلسلي للطابعة"
                    value={serialNumber}
                    onChange={(e) => {
                      setSerialNumber(e.target.value);
                      setVerifiedPrinter(null);
                    }}
                    dir="ltr"
                    className="text-left"
                  />
                </div>

                {!verifiedPrinter && (
                  <Button 
                    onClick={verifySerial} 
                    disabled={verifying || !serialNumber.trim()}
                    variant="outline"
                    className="w-full"
                  >
                    {verifying ? (
                      <>
                        <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                        جاري التحقق...
                      </>
                    ) : (
                      'التحقق من الرقم التسلسلي'
                    )}
                  </Button>
                )}

                {verifiedPrinter && (
                  <Card className="bg-green-500/10 border-green-500/30">
                    <CardContent className="p-4">
                      <div className="flex items-center gap-2 text-green-400">
                        <ShieldCheck className="w-5 h-5" />
                        <span>تم التحقق بنجاح!</span>
                      </div>
                      <p className="text-sm text-muted-foreground mt-2">
                        الموديل: {verifiedPrinter.model_name_ar}
                      </p>
                    </CardContent>
                  </Card>
                )}

                <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
                  <AlertCircle className="w-5 h-5 text-muted-foreground flex-shrink-0 mt-0.5" />
                  <p className="text-sm text-muted-foreground">
                    يمكنك فقط تسجيل الطابعات التي تم شراؤها من متجرنا. الرقم التسلسلي موجود على ملصق الطابعة.
                  </p>
                </div>
              </div>

              <DialogFooter>
                <Button
                  variant="outline"
                  onClick={() => {
                    setAddDialogOpen(false);
                    setSerialNumber('');
                    setVerifiedPrinter(null);
                  }}
                >
                  إلغاء
                </Button>
                <Button
                  onClick={() => registerMutation.mutate()}
                  disabled={!verifiedPrinter || registerMutation.isPending}
                >
                  {registerMutation.isPending ? (
                    <>
                      <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                      جاري التسجيل...
                    </>
                  ) : (
                    'تسجيل الطابعة'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : printers && printers.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {printers.map((printer) => (
              <Card key={printer.id} className="hover:border-primary/50 transition-colors">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-3">
                      <div className="p-2 bg-primary/10 rounded-lg">
                        <Printer className="w-6 h-6 text-primary" />
                      </div>
                      <div>
                        <CardTitle className="text-lg">
                          {printer.store_printers?.model_name_ar}
                        </CardTitle>
                        <CardDescription className="font-mono text-xs mt-1" dir="ltr">
                          {printer.store_printers?.serial_number}
                        </CardDescription>
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {getStatusBadge(printer)}
                    
                    <div className="text-sm text-muted-foreground">
                      تاريخ التسجيل: {new Date(printer.created_at).toLocaleDateString('ar-IQ')}
                    </div>

                    {!printer.printer_subscriptions?.some(s => s.status === 'active') && (
                      <Button
                        variant="outline"
                        size="sm"
                        className="w-full mt-2"
                        onClick={() => navigate('/printer-protection')}
                      >
                        <Shield className="w-4 h-4 ml-2" />
                        اشترك في الحماية
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card className="text-center py-12">
            <CardContent>
              <Printer className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">لا توجد طابعات مسجلة</h3>
              <p className="text-muted-foreground mb-4">
                قم بإضافة طابعتك الأولى للبدء في نظام الحماية
              </p>
              <Button onClick={() => setAddDialogOpen(true)}>
                <Plus className="w-4 h-4 ml-2" />
                إضافة طابعة
              </Button>
            </CardContent>
          </Card>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyPrinters;
