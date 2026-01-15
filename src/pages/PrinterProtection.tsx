import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import Header from '@/components/Header';
import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Shield, ShieldCheck, Check, Printer, Loader2, Crown, Star, Zap, Calendar, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addMonths, format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface ProtectionPlan {
  id: string;
  plan_type: 'basic' | 'standard' | 'comprehensive';
  name_ar: string;
  name_en: string;
  description_ar: string;
  monthly_price: number;
  features: string[];
  display_order: number;
}

interface UserPrinter {
  id: string;
  store_printers: {
    model_name_ar: string;
    serial_number: string;
  };
  printer_subscriptions: Array<{
    id: string;
    status: string;
  }>;
}

interface Subscription {
  id: string;
  status: 'active' | 'paused' | 'expired' | 'cancelled';
  start_date: string;
  end_date: string | null;
  next_billing_date: string | null;
  monthly_price: number;
  user_printers: {
    store_printers: {
      model_name_ar: string;
      serial_number: string;
    };
  };
  protection_plans: {
    name_ar: string;
    plan_type: string;
  };
}

const PrinterProtection = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ProtectionPlan | null>(null);
  const [selectedPrinterId, setSelectedPrinterId] = useState<string>('');

  // Fetch protection plans
  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['protection-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order');

      if (error) throw error;
      return data as ProtectionPlan[];
    },
  });

  // Fetch user's printers without active subscriptions
  const { data: availablePrinters } = useQuery({
    queryKey: ['available-printers', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          id,
          store_printers (model_name_ar, serial_number),
          printer_subscriptions (id, status)
        `)
        .eq('user_id', user!.id)
        .eq('verification_status', 'verified');

      if (error) throw error;
      
      // Filter out printers with active subscriptions
      return (data as UserPrinter[]).filter(p => 
        !p.printer_subscriptions?.some(s => s.status === 'active')
      );
    },
    enabled: !!user,
  });

  // Fetch user's subscriptions
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
          protection_plans (name_ar, plan_type)
        `)
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Subscription[];
    },
    enabled: !!user,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan || !selectedPrinterId) {
        throw new Error('الرجاء اختيار الطابعة والباقة');
      }

      const startDate = new Date();
      const nextBillingDate = addMonths(startDate, 1);

      const { error } = await supabase
        .from('printer_subscriptions')
        .insert({
          user_id: user!.id,
          user_printer_id: selectedPrinterId,
          plan_id: selectedPlan.id,
          status: 'active',
          start_date: startDate.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
          monthly_price: selectedPlan.monthly_price,
        });

      if (error) throw error;

      // Log the action
      await supabase.from('printer_protection_logs').insert({
        user_id: user!.id,
        action: 'subscribe',
        entity_type: 'subscription',
        details: {
          plan_type: selectedPlan.plan_type,
          printer_id: selectedPrinterId,
        },
      });
    },
    onSuccess: () => {
      toast.success('تم الاشتراك بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['available-printers'] });
      queryClient.invalidateQueries({ queryKey: ['user-printers'] });
      setSubscribeDialogOpen(false);
      setSelectedPlan(null);
      setSelectedPrinterId('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الاشتراك');
    },
  });

  const getPlanIcon = (planType: string) => {
    switch (planType) {
      case 'basic':
        return <Shield className="w-8 h-8" />;
      case 'standard':
        return <Star className="w-8 h-8" />;
      case 'comprehensive':
        return <Crown className="w-8 h-8" />;
      default:
        return <Shield className="w-8 h-8" />;
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

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'active':
        return <Badge className="bg-green-500/20 text-green-400 border-green-500/30">نشط</Badge>;
      case 'paused':
        return <Badge className="bg-yellow-500/20 text-yellow-400 border-yellow-500/30">متوقف</Badge>;
      case 'expired':
        return <Badge className="bg-destructive/20 text-destructive border-destructive/30">منتهي</Badge>;
      case 'cancelled':
        return <Badge className="bg-muted text-muted-foreground">ملغي</Badge>;
      default:
        return null;
    }
  };

  const openSubscribeDialog = (plan: ProtectionPlan) => {
    if (!availablePrinters || availablePrinters.length === 0) {
      toast.error('لا توجد طابعات متاحة للاشتراك. قم بتسجيل طابعة أولاً.');
      navigate('/my-printers');
      return;
    }
    setSelectedPlan(plan);
    setSubscribeDialogOpen(true);
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
        {/* Header */}
        <div className="text-center mb-12">
          <div className="inline-flex items-center justify-center p-3 bg-primary/10 rounded-full mb-4">
            <ShieldCheck className="w-12 h-12 text-primary" />
          </div>
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-4">
            نظام حماية الطابعات ثلاثية الأبعاد
          </h1>
          <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
            احمِ استثمارك مع باقات الحماية الشاملة. صيانة دورية، دعم فني متخصص، وراحة بال كاملة.
          </p>
        </div>

        {/* Plans */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Zap className="w-6 h-6 text-primary" />
            باقات الحماية
          </h2>

          {plansLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : (
            <div className="grid gap-6 md:grid-cols-3">
              {plans?.map((plan) => (
                <Card 
                  key={plan.id} 
                  className={`relative overflow-hidden hover:border-primary/50 transition-all ${
                    plan.plan_type === 'comprehensive' ? 'border-amber-500/50 ring-1 ring-amber-500/20' : ''
                  }`}
                >
                  {plan.plan_type === 'comprehensive' && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-amber-500 to-amber-600 text-white text-center py-1 text-sm font-medium">
                      الأكثر شعبية
                    </div>
                  )}
                  
                  <CardHeader className={plan.plan_type === 'comprehensive' ? 'pt-10' : ''}>
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${getPlanColor(plan.plan_type)} text-white w-fit mb-4`}>
                      {getPlanIcon(plan.plan_type)}
                    </div>
                    <CardTitle className="text-xl">{plan.name_ar}</CardTitle>
                    <CardDescription>{plan.description_ar}</CardDescription>
                  </CardHeader>
                  
                  <CardContent>
                    <div className="mb-6">
                      <span className="text-3xl font-bold text-foreground">
                        {plan.monthly_price.toLocaleString()}
                      </span>
                      <span className="text-muted-foreground mr-1">د.ع / شهرياً</span>
                    </div>

                    <ul className="space-y-3">
                      {(plan.features as string[])?.map((feature, idx) => (
                        <li key={idx} className="flex items-start gap-2 text-sm">
                          <Check className="w-5 h-5 text-green-500 flex-shrink-0 mt-0.5" />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className="w-full"
                      variant={plan.plan_type === 'comprehensive' ? 'default' : 'outline'}
                      onClick={() => openSubscribeDialog(plan)}
                    >
                      اشترك الآن
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My Subscriptions */}
        <section>
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Calendar className="w-6 h-6 text-primary" />
            اشتراكاتي
          </h2>

          {subscriptionsLoading ? (
            <div className="flex justify-center py-12">
              <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
          ) : subscriptions && subscriptions.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2">
              {subscriptions.map((sub) => (
                <Card key={sub.id}>
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/10 rounded-lg">
                          <Printer className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                          <CardTitle className="text-lg">
                            {sub.user_printers?.store_printers?.model_name_ar}
                          </CardTitle>
                          <CardDescription className="font-mono text-xs" dir="ltr">
                            {sub.user_printers?.store_printers?.serial_number}
                          </CardDescription>
                        </div>
                      </div>
                      {getStatusBadge(sub.status)}
                    </div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">الباقة:</span>
                        <span className="font-medium">{sub.protection_plans?.name_ar}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">تاريخ البدء:</span>
                        <span>{format(new Date(sub.start_date), 'dd MMMM yyyy', { locale: ar })}</span>
                      </div>
                      {sub.next_billing_date && sub.status === 'active' && (
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الفاتورة القادمة:</span>
                          <span>{format(new Date(sub.next_billing_date), 'dd MMMM yyyy', { locale: ar })}</span>
                        </div>
                      )}
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">السعر الشهري:</span>
                        <span className="font-medium">{sub.monthly_price.toLocaleString()} د.ع</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <Card className="text-center py-12">
              <CardContent>
                <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                <h3 className="text-xl font-semibold mb-2">لا توجد اشتراكات</h3>
                <p className="text-muted-foreground mb-4">
                  اختر إحدى باقات الحماية أعلاه للبدء
                </p>
                <Button variant="outline" onClick={() => navigate('/my-printers')}>
                  <Printer className="w-4 h-4 ml-2" />
                  عرض طابعاتي
                </Button>
              </CardContent>
            </Card>
          )}
        </section>

        {/* Subscribe Dialog */}
        <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>الاشتراك في {selectedPlan?.name_ar}</DialogTitle>
            </DialogHeader>
            
            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <Label>اختر الطابعة</Label>
                <Select value={selectedPrinterId} onValueChange={setSelectedPrinterId}>
                  <SelectTrigger>
                    <SelectValue placeholder="اختر طابعة" />
                  </SelectTrigger>
                  <SelectContent>
                    {availablePrinters?.map((printer) => (
                      <SelectItem key={printer.id} value={printer.id}>
                        {printer.store_printers?.model_name_ar} - {printer.store_printers?.serial_number}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {selectedPlan && (
                <Card className="bg-muted/50">
                  <CardContent className="p-4 space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الباقة:</span>
                      <span className="font-medium">{selectedPlan.name_ar}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">السعر الشهري:</span>
                      <span className="font-medium">{selectedPlan.monthly_price.toLocaleString()} د.ع</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">تاريخ البدء:</span>
                      <span>{format(new Date(), 'dd MMMM yyyy', { locale: ar })}</span>
                    </div>
                  </CardContent>
                </Card>
              )}

              <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-sm text-muted-foreground">
                  بالاشتراك، أنت توافق على شروط الخدمة والدفع الشهري للباقة المختارة.
                </p>
              </div>
            </div>

            <DialogFooter>
              <Button
                variant="outline"
                onClick={() => {
                  setSubscribeDialogOpen(false);
                  setSelectedPlan(null);
                  setSelectedPrinterId('');
                }}
              >
                إلغاء
              </Button>
              <Button
                onClick={() => subscribeMutation.mutate()}
                disabled={!selectedPrinterId || subscribeMutation.isPending}
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الاشتراك...
                  </>
                ) : (
                  'تأكيد الاشتراك'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>

      <Footer />
    </div>
  );
};

export default PrinterProtection;
