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
import { 
  Printer, Shield, ShieldCheck, ShieldX, Loader2, 
  CheckCircle, XCircle, Clock, MessageCircle, Crown, Star
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface EligiblePrinter {
  order_item_id: string;
  order_id: string;
  product_id: string;
  product_name: string;
  product_name_ar: string;
  serial_number: string | null;
  delivered_at: string;
  is_registered: boolean;
  user_printer_id: string | null;
  has_active_subscription: boolean;
  pending_serial_request: boolean;
}

interface Subscription {
  id: string;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  start_date: string;
  monthly_price: number;
  auto_renew: boolean;
  waiting_period_ends_at: string | null;
  next_billing_date: string | null;
  user_printers: {
    store_printers: {
      model_name_ar: string;
      serial_number: string;
    };
  };
  protection_plans: {
    name_ar: string;
    plan_type: string;
    icon_name: string;
  };
}

const MyPrinters = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // Fetch user's eligible printers
  const { data: eligiblePrinters, isLoading: printersLoading } = useQuery({
    queryKey: ['eligible-printers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc('get_user_eligible_printers', { p_user_id: user!.id });

      if (error) throw error;
      return data as EligiblePrinter[];
    },
    enabled: !!user,
  });

  // Fetch user's active subscriptions
  const { data: subscriptions, isLoading: subscriptionsLoading } = useQuery({
    queryKey: ['user-subscriptions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_subscriptions')
        .select(`
          *,
          user_printers (
            store_printers (model_name_ar, serial_number)
          ),
          protection_plans (name_ar, plan_type, icon_name)
        `)
        .eq('user_id', user!.id)
        .in('status', ['active', 'paused'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!user,
  });

  // Request serial number mutation
  const requestSerialMutation = useMutation({
    mutationFn: async (printer: EligiblePrinter) => {
      const { error } = await supabase
        .from('serial_number_requests')
        .insert({
          user_id: user!.id,
          order_item_id: printer.order_item_id,
          product_name_ar: printer.product_name_ar,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إرسال طلب إضافة الرقم التسلسلي بنجاح');
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
    },
    onError: (error: any) => {
      if (error.message?.includes('duplicate')) {
        toast.error('تم إرسال طلب مسبقاً لهذه الطابعة');
      } else {
        toast.error(error.message || 'حدث خطأ');
      }
    },
  });

  const getPlanIcon = (iconName: string) => {
    switch (iconName) {
      case 'shield':
        return <Shield className="w-4 h-4" />;
      case 'star':
        return <Star className="w-4 h-4" />;
      case 'crown':
        return <Crown className="w-4 h-4" />;
      default:
        return <Shield className="w-4 h-4" />;
    }
  };

  const getPlanColor = (planType: string) => {
    switch (planType) {
      case 'basic':
        return 'from-blue-500 to-blue-600';
      case 'standard':
        return 'from-purple-500 to-purple-600';
      case 'comprehensive':
        return 'from-amber-500 to-amber-600';
      default:
        return 'from-primary to-primary';
    }
  };

  // Group printers by subscription status
  const printersWithSubscription = eligiblePrinters?.filter(p => p.has_active_subscription) || [];
  const printersEligible = eligiblePrinters?.filter(p => p.serial_number && !p.has_active_subscription) || [];
  const printersNotEligible = eligiblePrinters?.filter(p => !p.serial_number) || [];

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

  const isLoading = printersLoading || subscriptionsLoading;

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
            <p className="text-muted-foreground mt-2">إدارة الطابعات وحالة الحماية</p>
          </div>
          <Button onClick={() => navigate('/printer-protection')}>
            <Shield className="w-4 h-4 ml-2" />
            عرض باقات الحماية
          </Button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-8">
            {/* Active Subscriptions */}
            {subscriptions && subscriptions.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-green-500" />
                  الطابعات المحمية
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {subscriptions.map((sub) => (
                    <Card key={sub.id} className="border-green-500/30 bg-green-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanColor(sub.protection_plans?.plan_type)} text-white`}>
                              {getPlanIcon(sub.protection_plans?.icon_name)}
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {sub.user_printers?.store_printers?.model_name_ar}
                              </CardTitle>
                              <CardDescription className="font-mono text-xs mt-1" dir="ltr">
                                SN: {sub.user_printers?.store_printers?.serial_number}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className="bg-green-500/20 text-green-400 border-green-500/30">
                            <ShieldCheck className="w-3 h-3 ml-1" />
                            محمية
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الباقة:</span>
                            <span className="font-medium">{sub.protection_plans?.name_ar}</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">السعر الشهري:</span>
                            <span>{sub.monthly_price?.toLocaleString()} د.ع</span>
                          </div>
                          {sub.next_billing_date && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">الفاتورة القادمة:</span>
                              <span>{format(new Date(sub.next_billing_date), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          {sub.waiting_period_ends_at && new Date(sub.waiting_period_ends_at) > new Date() && (
                            <div className="flex justify-between text-amber-500">
                              <span>فترة الانتظار تنتهي:</span>
                              <span>{format(new Date(sub.waiting_period_ends_at), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Eligible for Protection */}
            {printersEligible.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <CheckCircle className="w-5 h-5 text-blue-500" />
                  مؤهلة للحماية
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {printersEligible.map((printer) => (
                    <Card key={printer.order_item_id} className="border-blue-500/30 bg-blue-500/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-blue-500/10 rounded-lg">
                              <Printer className="w-6 h-6 text-blue-500" />
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
                          <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                            مؤهلة
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            تاريخ التوصيل: {format(new Date(printer.delivered_at), 'dd MMMM yyyy', { locale: ar })}
                          </div>
                          <Button
                            className="w-full"
                            onClick={() => navigate('/printer-protection')}
                          >
                            <Shield className="w-4 h-4 ml-2" />
                            اشترك في الحماية
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </section>
            )}

            {/* Not Eligible (no serial) */}
            {printersNotEligible.length > 0 && (
              <section>
                <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                  <XCircle className="w-5 h-5 text-destructive" />
                  غير مؤهلة للحماية
                </h2>
                <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                  {printersNotEligible.map((printer) => (
                    <Card key={printer.order_item_id} className="border-destructive/30 bg-destructive/5">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className="p-2 bg-muted rounded-lg">
                              <Printer className="w-6 h-6 text-muted-foreground" />
                            </div>
                            <div>
                              <CardTitle className="text-lg">
                                {printer.product_name_ar}
                              </CardTitle>
                              <CardDescription className="text-xs mt-1 text-destructive">
                                الرقم التسلسلي غير متوفر
                              </CardDescription>
                            </div>
                          </div>
                          <Badge className="bg-destructive/20 text-destructive border-destructive/30">
                            غير مؤهلة
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-3">
                          <div className="text-sm text-muted-foreground">
                            تاريخ التوصيل: {format(new Date(printer.delivered_at), 'dd MMMM yyyy', { locale: ar })}
                          </div>
                          <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                            لا يمكن حماية الطابعة لأنك لا تملك رقمًا تسلسليًا. تواصل مع الإدارة لإضافته.
                          </p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="w-full"
                            onClick={() => requestSerialMutation.mutate(printer)}
                            disabled={printer.pending_serial_request || requestSerialMutation.isPending}
                          >
                            {printer.pending_serial_request ? (
                              <>
                                <Clock className="w-4 h-4 ml-2" />
                                طلب قيد المراجعة
                              </>
                            ) : requestSerialMutation.isPending ? (
                              <Loader2 className="w-4 h-4 animate-spin" />
                            ) : (
                              <>
                                <MessageCircle className="w-4 h-4 ml-2" />
                                طلب إضافة رقم تسلسلي
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

            {/* Empty State */}
            {eligiblePrinters?.length === 0 && (
              <Card className="text-center py-12">
                <CardContent>
                  <Printer className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد طابعات</h3>
                  <p className="text-muted-foreground mb-4">
                    ستظهر هنا الطابعات التي اشتريتها بعد توصيلها
                  </p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>

      <Footer />
    </div>
  );
};

export default MyPrinters;