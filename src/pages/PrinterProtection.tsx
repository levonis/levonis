import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';

import Footer from '@/components/Footer';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Shield, ShieldCheck, Check, Printer, Loader2, Crown, Star, 
  Calendar, AlertCircle, ChevronLeft, ChevronRight, Wrench,
  MessageCircle, CheckCircle2, XCircle, Clock, Sparkles
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { addMonths, addDays, format } from 'date-fns';
import { ar } from 'date-fns/locale';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

interface ProtectionPlan {
  id: string;
  plan_type: 'basic' | 'standard' | 'comprehensive';
  name_ar: string;
  name_en: string;
  description_ar: string;
  monthly_price: number;
  features: string[];
  display_order: number;
  max_service_requests_per_month: number;
  maintenance_discount_percentage: number;
  parts_discount_percentage: number;
  waiting_period_days: number;
  priority_level: number;
  has_preventive_maintenance: boolean;
  preventive_maintenance_interval_months: number | null;
  has_replacement_printer: boolean;
  icon_name: string;
  badge_text: string | null;
}

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
  end_date: string | null;
  next_billing_date: string | null;
  monthly_price: number;
  auto_renew: boolean;
  waiting_period_ends_at: string | null;
  plan_id: string;
  user_printer_id: string;
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

const PrinterProtection = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<ProtectionPlan | null>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<EligiblePrinter | null>(null);
  const [confirmStep, setConfirmStep] = useState(1);

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
          protection_plans (name_ar, plan_type, icon_name)
        `)
        .eq('user_id', user!.id)
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

  // Build a map: user_printer_id -> active subscription (for upgrade detection)
  const activeSubByPrinterId = React.useMemo(() => {
    const map: Record<string, Subscription & { plan_id?: string }> = {};
    (subscriptions || []).forEach((s: any) => {
      if (s.status === 'active' && s.user_printer_id) {
        map[s.user_printer_id] = s;
      }
    });
    return map;
  }, [subscriptions]);

  // Get the active subscription for the currently selected printer (if any)
  const currentActiveSub = selectedPrinter?.user_printer_id
    ? activeSubByPrinterId[selectedPrinter.user_printer_id]
    : null;

  // Determine the relationship between selectedPlan and current sub
  // 'new' | 'same' | 'upgrade' | 'downgrade'
  const subscriptionMode: 'new' | 'same' | 'upgrade' | 'downgrade' = (() => {
    if (!currentActiveSub || !selectedPlan) return 'new';
    if ((currentActiveSub as any).plan_id === selectedPlan.id) return 'same';
    if (selectedPlan.monthly_price > (currentActiveSub.monthly_price || 0)) return 'upgrade';
    return 'downgrade';
  })();

  const upgradeDiscount = subscriptionMode === 'upgrade' && currentActiveSub
    ? Math.min(currentActiveSub.monthly_price || 0, selectedPlan?.monthly_price || 0)
    : 0;
  const upgradeCost = selectedPlan
    ? Math.max(0, (selectedPlan.monthly_price || 0) - upgradeDiscount)
    : 0;

  // Subscribe / Upgrade mutation (uses RPC for atomic wallet+sub handling)
  const subscribeMutation = useMutation({
    mutationFn: async () => {
      if (!selectedPlan || !selectedPrinter) {
        throw new Error('الرجاء اختيار الطابعة والباقة');
      }

      // Block "same" plan
      if (subscriptionMode === 'same') {
        throw new Error('هذه الطابعة محمية بالفعل بنفس الباقة');
      }
      // Block downgrade
      if (subscriptionMode === 'downgrade') {
        throw new Error('لا يمكن التحويل إلى باقة أقل. الطابعة محمية بباقة أعلى بالفعل');
      }

      // First register the printer if not registered
      let userPrinterId = selectedPrinter.user_printer_id;

      if (!userPrinterId) {
        let { data: storePrinter } = await supabase
          .from('store_printers')
          .select('id')
          .eq('serial_number', selectedPrinter.serial_number!)
          .maybeSingle();

        if (!storePrinter) {
          const { data: newPrinter, error: createError } = await supabase
            .from('store_printers')
            .insert({
              serial_number: selectedPrinter.serial_number!,
              model_name: selectedPrinter.product_name_ar,
              model_name_ar: selectedPrinter.product_name_ar,
            })
            .select('id')
            .single();
          if (createError) throw createError;
          storePrinter = newPrinter;
        }

        const { data: newUserPrinter, error: userPrinterError } = await supabase
          .from('user_printers')
          .insert({
            user_id: user!.id,
            store_printer_id: storePrinter.id,
            verification_status: 'verified',
            verified_at: new Date().toISOString(),
          })
          .select('id')
          .single();
        if (userPrinterError) throw userPrinterError;
        userPrinterId = newUserPrinter.id;
      }

      const isUpgrade = subscriptionMode === 'upgrade';
      const price = isUpgrade ? upgradeCost : selectedPlan.monthly_price;

      const { error } = await supabase.rpc('purchase_printer_subscription', {
        p_printer_id: userPrinterId,
        p_plan_id: selectedPlan.id,
        p_price: price,
        p_is_upgrade: isUpgrade,
        p_current_sub_id: isUpgrade && currentActiveSub ? currentActiveSub.id : null,
      });
      if (error) throw new Error(error.message);

      return { isUpgrade };
    },
    onSuccess: (data) => {
      toast.success(data?.isUpgrade ? 'تمت ترقية الباقة بنجاح! 🎉' : 'تم الاشتراك بنجاح! 🎉');
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
      queryClient.invalidateQueries({ queryKey: ['my-printers-with-subs'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      setSubscribeDialogOpen(false);
      setSelectedPlan(null);
      setSelectedPrinter(null);
      setConfirmStep(1);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الاشتراك');
    },
  });

  const getPlanIcon = (iconName: string) => {
    switch (iconName) {
      case 'shield':
        return <Shield className="w-8 h-8" />;
      case 'star':
        return <Star className="w-8 h-8" />;
      case 'crown':
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
    setSelectedPlan(plan);
    setConfirmStep(selectedPrinter ? 2 : 1);
    setSubscribeDialogOpen(true);
  };

  const selectPrinterForSubscription = (printer: EligiblePrinter) => {
    if (!printer.serial_number) {
      toast.error('هذه الطابعة غير مؤهلة للحماية - الرقم التسلسلي غير متوفر');
      return;
    }
    setSelectedPrinter(printer);
    const activeSub = printer.user_printer_id ? activeSubByPrinterId[printer.user_printer_id] : null;
    if (activeSub) {
      toast.info(`الطابعة محمية حالياً بباقة "${activeSub.protection_plans?.name_ar}". اختر باقة أعلى للترقية.`);
    } else {
      toast.success('تم تحديد الطابعة، اختر الباقة المناسبة');
    }
  };

  const handleConfirmSubscription = () => {
    if (confirmStep === 1) {
      if (!selectedPrinter) {
        toast.error('الرجاء اختيار طابعة أولاً');
        return;
      }
      setConfirmStep(2);
    } else if (confirmStep === 2) {
      // Pre-validate before showing summary
      if (subscriptionMode === 'same') {
        toast.error('هذه الطابعة محمية بالفعل بنفس الباقة');
        return;
      }
      if (subscriptionMode === 'downgrade') {
        toast.error('لا يمكن التحويل إلى باقة أقل. الطابعة محمية بباقة أعلى بالفعل');
        return;
      }
      setConfirmStep(3);
    } else {
      subscribeMutation.mutate();
    }
  };

  // Get printers that can subscribe (have serial - includes already-subscribed for upgrade)
  const eligibleForSubscription = eligiblePrinters?.filter(
    p => p.serial_number
  ) || [];

  // Get printers without serial
  const printersWithoutSerial = eligiblePrinters?.filter(
    p => !p.serial_number
  ) || [];

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background p-4">
        <div className="max-w-4xl mx-auto space-y-4">
          <div className="h-8 w-48 rounded bg-muted animate-pulse mb-4" />
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">{[1,2,3].map(i=><div key={i} className="rounded-lg border bg-card p-4 space-y-3"><div className="h-6 w-24 rounded bg-muted animate-pulse" /><div className="h-8 w-20 rounded bg-muted animate-pulse" /><div className="h-3 w-full rounded bg-muted animate-pulse" /><div className="h-10 w-full rounded-lg bg-muted animate-pulse" /></div>)}</div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col bg-background" dir="rtl">
      
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

        {/* My Eligible Printers Section */}
        {user && (
          <section className="mb-12">
            <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
              <Printer className="w-6 h-6 text-primary" />
              طابعاتي المؤهلة للحماية
            </h2>

            {printersLoading ? (
              <div className="flex justify-center py-8">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
              </div>
            ) : eligiblePrinters && eligiblePrinters.length > 0 ? (
              <div className="relative">
                <Carousel
                  opts={{
                    align: "start",
                    direction: "rtl",
                  }}
                  className="w-full"
                >
                  <CarouselContent className="-mr-4">
                    {eligiblePrinters.map((printer) => (
                      <CarouselItem key={printer.order_item_id} className="pr-4 md:basis-1/2 lg:basis-1/3">
                        <Card 
                          className={`h-full cursor-pointer transition-all ${
                            selectedPrinter?.order_item_id === printer.order_item_id 
                              ? 'border-primary ring-2 ring-primary/20' 
                              : printer.serial_number && !printer.has_active_subscription
                                ? 'hover:border-primary/50'
                                : 'opacity-80'
                          }`}
                          onClick={() => selectPrinterForSubscription(printer)}
                        >
                          <CardHeader className="pb-3">
                            <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3">
                                <div className={`p-2 rounded-lg ${
                                  printer.serial_number 
                                    ? 'bg-primary/10' 
                                    : 'bg-muted'
                                }`}>
                                  <Printer className={`w-6 h-6 ${
                                    printer.serial_number 
                                      ? 'text-primary' 
                                      : 'text-muted-foreground'
                                  }`} />
                                </div>
                                <div>
                                  <CardTitle className="text-base line-clamp-1">
                                    {printer.product_name_ar}
                                  </CardTitle>
                                  {printer.serial_number ? (
                                    <CardDescription className="font-mono text-xs mt-1" dir="ltr">
                                      SN: {printer.serial_number}
                                    </CardDescription>
                                  ) : (
                                    <CardDescription className="text-xs mt-1 text-destructive">
                                      الرقم التسلسلي غير متوفر
                                    </CardDescription>
                                  )}
                                </div>
                              </div>
                            </div>
                          </CardHeader>
                          <CardContent className="pt-0">
                            {/* Status Badge */}
                            {printer.has_active_subscription ? (
                              <Badge className="bg-green-500/20 text-green-400 border-green-500/30 mb-3">
                                <ShieldCheck className="w-3 h-3 ml-1" />
                                مشتركة في الحماية
                              </Badge>
                            ) : printer.serial_number ? (
                              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30 mb-3">
                                <CheckCircle2 className="w-3 h-3 ml-1" />
                                مؤهلة للحماية
                              </Badge>
                            ) : (
                              <Badge className="bg-destructive/20 text-destructive border-destructive/30 mb-3">
                                <XCircle className="w-3 h-3 ml-1" />
                                غير مؤهلة
                              </Badge>
                            )}

                            <div className="text-sm text-muted-foreground mb-3">
                              تاريخ التوصيل: {format(new Date(printer.delivered_at), 'dd MMMM yyyy', { locale: ar })}
                            </div>

                            {/* Action for printers without serial */}
                            {!printer.serial_number && (
                              <div className="space-y-2">
                                <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                                  لا يمكن حماية الطابعة لأنك لا تملك رقمًا تسلسليًا. تواصل مع الإدارة لإضافته.
                                </p>
                                <Button
                                  variant="outline"
                                  size="sm"
                                  className="w-full"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    requestSerialMutation.mutate(printer);
                                  }}
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
                            )}

                            {/* Selected indicator */}
                            {selectedPrinter?.order_item_id === printer.order_item_id && (
                              <div className="mt-2 p-2 bg-primary/10 rounded text-center text-sm text-primary font-medium">
                                ✓ تم التحديد
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      </CarouselItem>
                    ))}
                  </CarouselContent>
                  <CarouselPrevious className="right-auto left-0 -translate-x-1/2" />
                  <CarouselNext className="left-auto right-0 translate-x-1/2" />
                </Carousel>
              </div>
            ) : (
              <Card className="text-center py-12 bg-muted/30">
                <CardContent>
                  <Printer className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد طابعات مشتراة</h3>
                  <p className="text-muted-foreground mb-4 max-w-md mx-auto">
                    لا توجد طابعات مشتراة على حسابك بعد. يمكنك استعراض باقات الحماية الآن، وعند شراء طابعة ستظهر تلقائيًا هنا.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Plans */}
        <section className="mb-16">
          <h2 className="text-2xl font-bold mb-6 flex items-center gap-2">
            <Shield className="w-6 h-6 text-primary" />
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
                    plan.badge_text ? 'border-purple-500/50 ring-1 ring-purple-500/20' : ''
                  }`}
                >
                  {plan.badge_text && (
                    <div className="absolute top-0 left-0 right-0 bg-gradient-to-r from-purple-500 to-purple-600 text-white text-center py-1 text-sm font-medium">
                      {plan.badge_text}
                    </div>
                  )}
                  
                  <CardHeader className={plan.badge_text ? 'pt-10' : ''}>
                    <div className={`inline-flex p-3 rounded-xl bg-gradient-to-br ${getPlanColor(plan.plan_type)} text-white w-fit mb-4`}>
                      {getPlanIcon(plan.icon_name)}
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

                    {/* Plan details */}
                    <div className="mt-4 pt-4 border-t border-border space-y-2 text-xs text-muted-foreground">
                      <div className="flex items-center gap-2">
                        <Wrench className="w-3.5 h-3.5" />
                        <span>خصم الصيانة: {plan.maintenance_discount_percentage}%</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <Clock className="w-3.5 h-3.5" />
                        <span>فترة الانتظار: {plan.waiting_period_days} يوم</span>
                      </div>
                    </div>
                  </CardContent>
                  
                  <CardFooter>
                    <Button 
                      className="w-full"
                      variant={plan.badge_text ? 'default' : 'outline'}
                      onClick={() => openSubscribeDialog(plan)}
                      disabled={!user}
                    >
                      {!user ? 'سجل دخول للاشتراك' : 'اشترك الآن'}
                    </Button>
                  </CardFooter>
                </Card>
              ))}
            </div>
          )}
        </section>

        {/* My Subscriptions */}
        {user && (
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
                          <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanColor(sub.protection_plans?.plan_type)} text-white`}>
                            {getPlanIcon(sub.protection_plans?.icon_name)}
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
                        {sub.waiting_period_ends_at && new Date(sub.waiting_period_ends_at) > new Date() && (
                          <div className="flex justify-between text-amber-500">
                            <span>انتهاء فترة الانتظار:</span>
                            <span>{format(new Date(sub.waiting_period_ends_at), 'dd MMMM yyyy', { locale: ar })}</span>
                          </div>
                        )}
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
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">التجديد التلقائي:</span>
                          <span>{sub.auto_renew ? 'مفعل' : 'معطل'}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : (
              <Card className="text-center py-12 bg-muted/30">
                <CardContent>
                  <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
                  <h3 className="text-xl font-semibold mb-2">لا توجد اشتراكات</h3>
                  <p className="text-muted-foreground mb-4">
                    اختر طابعة من القائمة أعلاه ثم اختر إحدى باقات الحماية للبدء
                  </p>
                </CardContent>
              </Card>
            )}
          </section>
        )}

        {/* Not logged in message */}
        {!user && !authLoading && (
          <Card className="text-center py-12 bg-muted/30 mb-12">
            <CardContent>
              <Shield className="w-16 h-16 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">سجل دخول للاشتراك</h3>
              <p className="text-muted-foreground mb-4">
                يرجى تسجيل الدخول لعرض طابعاتك والاشتراك في باقات الحماية
              </p>
              <Button onClick={() => navigate('/auth')}>
                تسجيل الدخول
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Subscribe Dialog - Stepper */}
        <Dialog open={subscribeDialogOpen} onOpenChange={(open) => {
          setSubscribeDialogOpen(open);
          if (!open) {
            setConfirmStep(1);
          }
        }}>
          <DialogContent className="sm:max-w-lg">
            <DialogHeader>
              <DialogTitle>
                {confirmStep === 1 && 'الخطوة 1: تأكيد الطابعة'}
                {confirmStep === 2 && 'الخطوة 2: تأكيد الباقة'}
                {confirmStep === 3 && 'الخطوة 3: تأكيد الاشتراك'}
              </DialogTitle>
              <DialogDescription>
                {confirmStep === 1 && 'تأكد من اختيار الطابعة الصحيحة'}
                {confirmStep === 2 && 'راجع تفاصيل الباقة المختارة'}
                {confirmStep === 3 && 'راجع ملخص الاشتراك قبل التأكيد'}
              </DialogDescription>
            </DialogHeader>

            {/* Stepper indicator */}
            <div className="flex items-center justify-center gap-2 my-4">
              {[1, 2, 3].map((step) => (
                <div key={step} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                    step === confirmStep 
                      ? 'bg-primary text-primary-foreground' 
                      : step < confirmStep 
                        ? 'bg-green-500 text-white'
                        : 'bg-muted text-muted-foreground'
                  }`}>
                    {step < confirmStep ? <Check className="w-4 h-4" /> : step}
                  </div>
                  {step < 3 && (
                    <div className={`w-8 h-0.5 ${step < confirmStep ? 'bg-green-500' : 'bg-muted'}`} />
                  )}
                </div>
              ))}
            </div>
            
            <div className="space-y-4 py-4">
              {/* Step 1: Select/Confirm Printer */}
              {confirmStep === 1 && (
                <div className="space-y-4">
                  {selectedPrinter && (
                    <Card className="bg-primary/5 border-primary/30">
                      <CardContent className="p-4">
                        <div className="flex items-center justify-between gap-3">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-primary/10 rounded-lg shrink-0">
                              <Printer className="w-5 h-5 text-primary" />
                            </div>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{selectedPrinter.product_name_ar}</p>
                              <p className="text-sm text-muted-foreground font-mono truncate" dir="ltr">
                                SN: {selectedPrinter.serial_number}
                              </p>
                              {currentActiveSub && (
                                <Badge className="mt-1 bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">
                                  <ShieldCheck className="w-3 h-3 ml-1" />
                                  محمية حالياً: {currentActiveSub.protection_plans?.name_ar}
                                </Badge>
                              )}
                            </div>
                          </div>
                          {eligibleForSubscription.length > 1 && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => setSelectedPrinter(null)}
                            >
                              تغيير
                            </Button>
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  )}

                  {!selectedPrinter && eligibleForSubscription.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground mb-3">
                        اختر الطابعة التي تريد تأمينها:
                      </p>
                      {eligibleForSubscription.map((printer) => {
                        const sub = printer.user_printer_id ? activeSubByPrinterId[printer.user_printer_id] : null;
                        return (
                          <Card 
                            key={printer.order_item_id}
                            className="cursor-pointer hover:border-primary/50 transition-colors"
                            onClick={() => setSelectedPrinter(printer)}
                          >
                            <CardContent className="p-3">
                              <div className="flex items-center gap-3">
                                <Printer className="w-5 h-5 text-primary shrink-0" />
                                <div className="min-w-0 flex-1">
                                  <p className="font-medium text-sm truncate">{printer.product_name_ar}</p>
                                  <p className="text-xs text-muted-foreground font-mono truncate" dir="ltr">
                                    SN: {printer.serial_number}
                                  </p>
                                  {sub && (
                                    <Badge className="mt-1 bg-green-500/20 text-green-500 border-green-500/30 text-[10px]">
                                      <ShieldCheck className="w-3 h-3 ml-1" />
                                      محمية: {sub.protection_plans?.name_ar}
                                    </Badge>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        );
                      })}
                    </div>
                  )}

                  {!selectedPrinter && eligibleForSubscription.length === 0 && (
                    <div className="text-center py-6">
                      <AlertCircle className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                      <p className="text-muted-foreground">
                        لا توجد طابعات مؤهلة للاشتراك. تأكد من وجود رقم تسلسلي لطابعتك.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Step 2: Show Plan Details + Upgrade/Same notice */}
              {confirmStep === 2 && selectedPlan && (
                <div className="space-y-3">
                  {subscriptionMode === 'same' && (
                    <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/30 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-amber-500">التأمين موجود بالفعل</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          هذه الطابعة محمية بنفس الباقة. اختر باقة مختلفة أو طابعة أخرى.
                        </p>
                      </div>
                    </div>
                  )}
                  {subscriptionMode === 'downgrade' && (
                    <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 flex items-start gap-2">
                      <AlertCircle className="w-5 h-5 text-destructive shrink-0 mt-0.5" />
                      <div className="text-sm">
                        <p className="font-medium text-destructive">لا يمكن التخفيض</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          الطابعة محمية حالياً بباقة أعلى ({currentActiveSub?.protection_plans?.name_ar}). لا يمكن التحويل إلى باقة أقل.
                        </p>
                      </div>
                    </div>
                  )}
                  {subscriptionMode === 'upgrade' && currentActiveSub && (
                    <div className="p-3 rounded-lg bg-blue-500/10 border border-blue-500/30 flex items-start gap-2">
                      <Sparkles className="w-5 h-5 text-blue-500 shrink-0 mt-0.5" />
                      <div className="text-sm flex-1">
                        <p className="font-medium text-blue-500">ترقية الباقة</p>
                        <p className="text-muted-foreground text-xs mt-1">
                          من <span className="font-medium">{currentActiveSub.protection_plans?.name_ar}</span> إلى <span className="font-medium">{selectedPlan.name_ar}</span>
                        </p>
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs line-through text-muted-foreground">
                            {selectedPlan.monthly_price.toLocaleString()} د.ع
                          </span>
                          <span className="text-sm font-bold text-primary">
                            {upgradeCost.toLocaleString()} د.ع
                          </span>
                          <Badge className="bg-amber-500 text-[9px]">خصم {upgradeDiscount.toLocaleString()}</Badge>
                        </div>
                      </div>
                    </div>
                  )}

                  <Card className="bg-muted/50">
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-center gap-3 mb-4">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanColor(selectedPlan.plan_type)} text-white`}>
                          {getPlanIcon(selectedPlan.icon_name)}
                        </div>
                        <div>
                          <h4 className="font-bold">{selectedPlan.name_ar}</h4>
                          <p className="text-sm text-muted-foreground">{selectedPlan.description_ar}</p>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">السعر الشهري:</span>
                          <span className="font-medium">{selectedPlan.monthly_price.toLocaleString()} د.ع</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">خصم الصيانة:</span>
                          <span>{selectedPlan.maintenance_discount_percentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">خصم قطع الغيار:</span>
                          <span>{selectedPlan.parts_discount_percentage}%</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">طلبات الخدمة شهرياً:</span>
                          <span>{selectedPlan.max_service_requests_per_month}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">فترة الانتظار:</span>
                          <span>{selectedPlan.waiting_period_days} يوم</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              )}

              {/* Step 3: Summary */}
              {confirmStep === 3 && selectedPlan && selectedPrinter && (
                <div className="space-y-4">
                  <Card className="bg-muted/50">
                    <CardContent className="p-4 space-y-3">
                      <h4 className="font-bold mb-3">
                        {subscriptionMode === 'upgrade' ? 'ملخص الترقية' : 'ملخص الاشتراك'}
                      </h4>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الطابعة:</span>
                          <span className="font-medium">{selectedPrinter.product_name_ar}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">الرقم التسلسلي:</span>
                          <span className="font-mono" dir="ltr">{selectedPrinter.serial_number}</span>
                        </div>
                        {subscriptionMode === 'upgrade' && currentActiveSub && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">الباقة الحالية:</span>
                            <span>{currentActiveSub.protection_plans?.name_ar}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {subscriptionMode === 'upgrade' ? 'الباقة الجديدة:' : 'الباقة:'}
                          </span>
                          <span className="font-medium">{selectedPlan.name_ar}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">
                            {subscriptionMode === 'upgrade' ? 'تكلفة الترقية:' : 'السعر الشهري:'}
                          </span>
                          <span className="font-medium text-primary">
                            {(subscriptionMode === 'upgrade' ? upgradeCost : selectedPlan.monthly_price).toLocaleString()} د.ع
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">تاريخ البدء:</span>
                          <span>{format(new Date(), 'dd MMMM yyyy', { locale: ar })}</span>
                        </div>
                        {subscriptionMode !== 'upgrade' && (
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">انتهاء فترة الانتظار:</span>
                            <span>{format(addDays(new Date(), selectedPlan.waiting_period_days), 'dd MMMM yyyy', { locale: ar })}</span>
                          </div>
                        )}
                      </div>
                    </CardContent>
                  </Card>

                  <div className="flex items-start gap-2 p-3 bg-primary/5 rounded-lg border border-primary/20">
                    <AlertCircle className="w-5 h-5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground">
                      {subscriptionMode === 'upgrade'
                        ? 'سيتم خصم تكلفة الترقية من المحفظة فوراً وستحصل على مزايا الباقة الجديدة.'
                        : `بالاشتراك، أنت توافق على شروط الخدمة والدفع الشهري للباقة المختارة. فترة الانتظار (${selectedPlan.waiting_period_days} يوم) ستبدأ من تاريخ الاشتراك.`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            <DialogFooter className="gap-2">
              {confirmStep > 1 && (
                <Button
                  variant="outline"
                  onClick={() => setConfirmStep(confirmStep - 1)}
                >
                  <ChevronRight className="w-4 h-4 ml-1" />
                  السابق
                </Button>
              )}
              <Button
                onClick={handleConfirmSubscription}
                disabled={
                  (confirmStep === 1 && !selectedPrinter) || 
                  subscribeMutation.isPending
                }
              >
                {subscribeMutation.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 ml-2 animate-spin" />
                    جاري الاشتراك...
                  </>
                ) : confirmStep === 3 ? (
                  <>
                    <Check className="w-4 h-4 ml-2" />
                    تأكيد الاشتراك
                  </>
                ) : (
                  <>
                    التالي
                    <ChevronLeft className="w-4 h-4 mr-1" />
                  </>
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