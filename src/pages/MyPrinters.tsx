import React from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { Printer, Shield, ShieldCheck, ShieldX, Loader2, Package, CheckCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface UserPrinter {
  id: string;
  user_id: string;
  store_printer_id: string;
  verification_status: 'pending' | 'verified' | 'rejected';
  verified_at: string | null;
  notes: string | null;
  created_at: string;
  store_printers: {
    id: string;
    model_name: string;
    model_name_ar: string;
    serial_number: string;
  };
  printer_subscriptions: Array<{
    id: string;
    status: 'active' | 'paused' | 'expired' | 'cancelled';
    protection_plans: {
      name_ar: string;
      plan_type: string;
    };
  }>;
}

interface DeliveredPrinter {
  order_item_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_name_ar: string;
  serial_number: string;
  delivered_at: string;
  is_registered: boolean;
  user_printer_id: string | null;
}

const MyPrinters = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user's registered printers
  const { data: registeredPrinters, isLoading: registeredLoading } = useQuery({
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

  // Fetch delivered printers from orders (with serial numbers added by admin)
  const { data: deliveredPrinters, isLoading: deliveredLoading } = useQuery({
    queryKey: ['delivered-printers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_user_delivered_printers', { p_user_id: user!.id });

      if (error) throw error;
      return data as DeliveredPrinter[];
    },
    enabled: !!user,
  });

  // Register printer from order mutation
  const registerMutation = useMutation({
    mutationFn: async (serialNumber: string) => {
      const { data, error } = await supabase
        .rpc('register_printer_from_order', {
          p_user_id: user!.id,
          p_serial_number: serialNumber,
        });

      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تم تسجيل الطابعة للحماية بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['user-printers'] });
      queryClient.invalidateQueries({ queryKey: ['delivered-printers'] });
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

  // Filter delivered printers that are not registered yet
  const unregisteredDelivered = deliveredPrinters?.filter(p => !p.is_registered) || [];

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

  const isLoading = registeredLoading || deliveredLoading;

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
        </div>

        {/* Delivered printers awaiting registration */}
        {unregisteredDelivered.length > 0 && (
          <section className="mb-8">
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Package className="w-5 h-5 text-primary" />
              طابعات جاهزة للتسجيل في الحماية
            </h2>
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {unregisteredDelivered.map((printer) => (
                <Card key={printer.order_item_id} className="border-primary/50 bg-primary/5">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Printer className="w-6 h-6 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {printer.product_name_ar}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs mt-1" dir="ltr">
                            SN: {printer.serial_number}
                          </CardDescription>
                        </div>
                      </div>
                      <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30">
                        <CheckCircle className="w-3 h-3 ml-1" />
                        تم التوصيل
                      </Badge>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="text-sm text-muted-foreground">
                        تاريخ التوصيل: {new Date(printer.delivered_at).toLocaleDateString('ar-IQ')}
                      </div>
                      <Button
                        className="w-full"
                        onClick={() => registerMutation.mutate(printer.serial_number)}
                        disabled={registerMutation.isPending}
                      >
                        {registerMutation.isPending ? (
                          <>
                            <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                            جاري التسجيل...
                          </>
                        ) : (
                          <>
                            <Shield className="w-4 h-4 ml-2" />
                            تسجيل للحماية
                          </>
                        )}
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </section>
        )}

        {/* Registered printers */}
        <section>
          <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-primary" />
            الطابعات المسجلة في الحماية
          </h2>

          {isLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : registeredPrinters && registeredPrinters.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
              {registeredPrinters.map((printer) => (
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
                            SN: {printer.store_printers?.serial_number}
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
          ) : unregisteredDelivered.length === 0 ? (
            <Card className="text-center py-12">
              <CardContent>
                <Printer className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">لا توجد طابعات</h3>
                <p className="text-muted-foreground mb-4">
                  ستظهر هنا الطابعات التي اشتريتها بعد توصيلها وإضافة الرقم التسلسلي من قبل الإدارة
                </p>
                <Button variant="outline" onClick={() => navigate('/my-orders')}>
                  <Package className="w-4 h-4 ml-2" />
                  عرض طلباتي
                </Button>
              </CardContent>
            </Card>
          ) : null}
        </section>
      </main>

      <Footer />
    </div>
  );
};

export default MyPrinters;
