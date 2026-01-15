import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Printer, Shield, ShieldCheck, ShieldX, Loader2, 
  CheckCircle, XCircle, Clock, MessageCircle, Crown, Star,
  ArrowUp, Wrench, AlertCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, addDays } from 'date-fns';
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

interface ProtectionPlan {
  id: string;
  name_ar: string;
  name_en: string;
  plan_type: 'basic' | 'standard' | 'comprehensive';
  monthly_price: number;
  features: any;
  icon_name: string;
  badge_text: string | null;
  description_ar: string | null;
  max_service_requests_per_month: number | null;
  maintenance_discount_percentage: number | null;
  parts_discount_percentage: number | null;
  waiting_period_days: number | null;
  has_preventive_maintenance: boolean | null;
  has_replacement_printer: boolean | null;
  priority_level: number | null;
  annual_coverage_cap: number | null;
  display_order: number | null;
  is_active: boolean | null;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  monthly_price: number;
  auto_renew: boolean;
  waiting_period_ends_at: string | null;
  next_billing_date: string | null;
  plan_id: string;
  user_printer_id: string;
  user_printers: {
    id: string;
    store_printers: {
      serial_number: string;
      model_name_ar: string;
    };
  };
  protection_plans: ProtectionPlan;
}

const PLAN_ORDER: Record<string, number> = { basic: 1, standard: 2, comprehensive: 3 };

const MyPrinters = () => {
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [selectedPrinter, setSelectedPrinter] = useState<EligiblePrinter | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<ProtectionPlan | null>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [upgradingSubscription, setUpgradingSubscription] = useState<Subscription | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancellingSubscription, setCancellingSubscription] = useState<Subscription | null>(null);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);

  // Fetch protection plans
  const { data: plans } = useQuery({
    queryKey: ['protection-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });

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
          user_printers!inner (
            id,
            store_printers!inner (serial_number, model_name_ar)
          ),
          protection_plans!inner (*)
        `)
        .eq('user_id', user!.id)
        .in('status', ['active', 'paused', 'expired'])
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as unknown as Subscription[];
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

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async ({ printerId, planId }: { printerId: string; planId: string }) => {
      const plan = plans?.find(p => p.id === planId);
      if (!plan) throw new Error('الباقة غير موجودة');
      
      const printer = eligiblePrinters?.find(p => p.order_item_id === printerId);
      if (!printer?.serial_number) throw new Error('الطابعة غير مؤهلة');

      // First, get or create store_printer
      let { data: storePrinter } = await supabase
        .from('store_printers')
        .select('id')
        .eq('order_item_id', printer.order_item_id)
        .maybeSingle();

      if (!storePrinter) {
        const { data: newStorePrinter, error: storeError } = await supabase
          .from('store_printers')
          .insert({
            serial_number: printer.serial_number,
            model_name_ar: printer.product_name_ar,
            model_name: printer.product_name,
            order_item_id: printer.order_item_id,
            buyer_user_id: user!.id,
            is_registered: true,
          })
          .select('id')
          .single();

        if (storeError) throw storeError;
        storePrinter = newStorePrinter;
      }

      // Register user_printer
      let userPrinterId = printer.user_printer_id;
      if (!userPrinterId) {
        const { data: newUserPrinter, error: regError } = await supabase
          .from('user_printers')
          .insert({
            user_id: user!.id,
            store_printer_id: storePrinter.id,
            verification_status: 'verified',
          })
          .select('id')
          .single();

        if (regError) throw regError;
        userPrinterId = newUserPrinter.id;
      }

      const waitingPeriodDays = plan.waiting_period_days || 30;
      const startDate = new Date();
      const waitingPeriodEnds = addDays(startDate, waitingPeriodDays);
      const nextBillingDate = addDays(startDate, 30);

      // Create subscription
      const { data: subscription, error: subError } = await supabase
        .from('printer_subscriptions')
        .insert({
          user_id: user!.id,
          user_printer_id: userPrinterId,
          plan_id: planId,
          monthly_price: plan.monthly_price,
          start_date: startDate.toISOString(),
          waiting_period_ends_at: waitingPeriodEnds.toISOString(),
          next_billing_date: nextBillingDate.toISOString(),
          status: 'active',
          auto_renew: true,
        })
        .select('id')
        .single();

      if (subError) throw subError;

      // Record payment
      await supabase.from('subscription_payments').insert({
        user_id: user!.id,
        subscription_id: subscription.id,
        amount: plan.monthly_price,
        payment_type: 'payment',
        new_plan_id: planId,
        notes: `اشتراك جديد - ${plan.name_ar}`,
      });

      return subscription;
    },
    onSuccess: () => {
      toast.success('تم تفعيل الاشتراك بنجاح!');
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
      setSubscribeDialogOpen(false);
      setSelectedPrinter(null);
      setSelectedPlan(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الاشتراك');
    },
  });

  // Upgrade mutation with prorated credit
  const upgradeMutation = useMutation({
    mutationFn: async ({ subscription, newPlan }: { subscription: Subscription; newPlan: ProtectionPlan }) => {
      const oldPlan = subscription.protection_plans;
      const nextBilling = new Date(subscription.next_billing_date!);
      const now = new Date();
      const totalDays = 30;
      const daysRemaining = Math.max(0, differenceInDays(nextBilling, now));
      
      // Calculate prorated credit
      const creditAmount = (subscription.monthly_price * daysRemaining) / totalDays;
      const amountDue = Math.max(0, newPlan.monthly_price - creditAmount);

      // Update subscription
      const { error: updateError } = await supabase
        .from('printer_subscriptions')
        .update({
          plan_id: newPlan.id,
          monthly_price: newPlan.monthly_price,
          waiting_period_ends_at: addDays(now, newPlan.waiting_period_days || 0).toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      // Record upgrade payment
      await supabase.from('subscription_payments').insert({
        user_id: user!.id,
        subscription_id: subscription.id,
        amount: amountDue,
        payment_type: 'upgrade',
        old_plan_id: oldPlan.id,
        new_plan_id: newPlan.id,
        days_remaining: daysRemaining,
        credit_amount: creditAmount,
        notes: `ترقية من ${oldPlan.name_ar} إلى ${newPlan.name_ar}`,
      });

      return { amountDue, creditAmount };
    },
    onSuccess: (data) => {
      toast.success(`تمت الترقية بنجاح! الرصيد المتبقي: ${data.creditAmount.toLocaleString()} د.ع`);
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      setUpgradeDialogOpen(false);
      setUpgradingSubscription(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الترقية');
    },
  });

  // Cancel mutation with prorated refund
  const cancelMutation = useMutation({
    mutationFn: async (subscription: Subscription) => {
      const nextBilling = new Date(subscription.next_billing_date!);
      const now = new Date();
      const totalDays = 30;
      const daysRemaining = Math.max(0, differenceInDays(nextBilling, now));
      const usedDays = totalDays - daysRemaining;
      
      // Calculate refund
      const refundAmount = (subscription.monthly_price * daysRemaining) / totalDays;

      // Update subscription
      const { error: updateError } = await supabase
        .from('printer_subscriptions')
        .update({
          status: 'cancelled',
          cancelled_at: now.toISOString(),
          used_days: usedDays,
          remaining_days: daysRemaining,
          refund_amount: refundAmount,
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

      // Record refund
      if (refundAmount > 0) {
        await supabase.from('subscription_payments').insert({
          user_id: user!.id,
          subscription_id: subscription.id,
          amount: refundAmount,
          payment_type: 'cancellation_refund',
          days_remaining: daysRemaining,
          notes: `استرجاع عند الإلغاء - ${daysRemaining} يوم متبقي`,
        });
      }

      return { refundAmount, daysRemaining };
    },
    onSuccess: (data) => {
      if (data.refundAmount > 0) {
        toast.success(`تم الإلغاء. سيتم استرجاع ${data.refundAmount.toLocaleString()} د.ع (${data.daysRemaining} يوم متبقي)`);
      } else {
        toast.success('تم إلغاء الاشتراك');
      }
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
      setCancelDialogOpen(false);
      setCancellingSubscription(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الإلغاء');
    },
  });

  const getPlanIcon = (iconName: string, size = 'w-5 h-5') => {
    switch (iconName) {
      case 'shield': return <Shield className={size} />;
      case 'star': return <Star className={size} />;
      case 'crown': return <Crown className={size} />;
      case 'wrench': return <Wrench className={size} />;
      default: return <Shield className={size} />;
    }
  };

  const getPlanGradient = (planType: string) => {
    switch (planType) {
      case 'basic': return 'from-blue-500 to-blue-600';
      case 'standard': return 'from-purple-500 to-purple-600';
      case 'comprehensive': return 'from-amber-500 to-amber-600';
      default: return 'from-primary to-primary';
    }
  };

  const getAvailableUpgrades = (currentPlan: ProtectionPlan) => {
    if (!plans) return [];
    const currentOrder = PLAN_ORDER[currentPlan.plan_type] || 0;
    return plans.filter(p => (PLAN_ORDER[p.plan_type] || 0) > currentOrder);
  };

  const eligibleForSubscription = eligiblePrinters?.filter(p => p.serial_number && !p.has_active_subscription) || [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
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
    <div className="container mx-auto px-4 py-8" dir="rtl">
      {/* Page Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-foreground flex items-center gap-3">
            <Printer className="w-8 h-8 text-primary" />
            طابعاتي
          </h1>
          <p className="text-muted-foreground mt-2">إدارة الطابعات والاشتراكات في خدمة الحماية</p>
        </div>
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : (
        <div className="space-y-8">
          {/* Section A: Printers Carousel */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Printer className="w-5 h-5 text-primary" />
              طابعاتي المشتراة
            </h2>
            
            {eligiblePrinters && eligiblePrinters.length > 0 ? (
              <ScrollArea className="w-full whitespace-nowrap rounded-lg border p-4">
                <div className="flex gap-4">
                  {eligiblePrinters.map((printer) => {
                    const isEligible = !!printer.serial_number;
                    const hasSubscription = printer.has_active_subscription;
                    const isSelected = selectedPrinter?.order_item_id === printer.order_item_id;
                    
                    return (
                      <Card 
                        key={printer.order_item_id} 
                        className={`min-w-[280px] cursor-pointer transition-all ${
                          hasSubscription 
                            ? 'border-green-500/50 bg-green-500/5' 
                            : isEligible 
                              ? isSelected
                                ? 'border-primary ring-2 ring-primary bg-primary/5'
                                : 'border-blue-500/30 bg-blue-500/5 hover:border-primary/50'
                              : 'border-destructive/30 bg-destructive/5 cursor-not-allowed'
                        }`}
                        onClick={() => {
                          if (isEligible && !hasSubscription) {
                            setSelectedPrinter(isSelected ? null : printer);
                          }
                        }}
                      >
                        <CardHeader className="pb-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              <div className={`p-2 rounded-lg ${
                                hasSubscription 
                                  ? 'bg-green-500/20' 
                                  : isEligible 
                                    ? 'bg-blue-500/20' 
                                    : 'bg-muted'
                              }`}>
                                <Printer className={`w-5 h-5 ${
                                  hasSubscription 
                                    ? 'text-green-500' 
                                    : isEligible 
                                      ? 'text-blue-500' 
                                      : 'text-muted-foreground'
                                }`} />
                              </div>
                              <div>
                                <CardTitle className="text-sm font-medium whitespace-normal">
                                  {printer.product_name_ar}
                                </CardTitle>
                                {printer.serial_number ? (
                                  <p className="text-xs text-muted-foreground font-mono mt-0.5" dir="ltr">
                                    SN: {printer.serial_number}
                                  </p>
                                ) : (
                                  <p className="text-xs text-destructive mt-0.5">
                                    بدون رقم تسلسلي
                                  </p>
                                )}
                              </div>
                            </div>
                            <Badge 
                              variant="outline"
                              className={`text-[10px] ${
                                hasSubscription 
                                  ? 'bg-green-500/20 text-green-500 border-green-500/30' 
                                  : isEligible 
                                    ? 'bg-blue-500/20 text-blue-500 border-blue-500/30' 
                                    : 'bg-destructive/20 text-destructive border-destructive/30'
                              }`}
                            >
                              {hasSubscription ? (
                                <><ShieldCheck className="w-3 h-3 ml-1" />محمية</>
                              ) : isEligible ? (
                                <><CheckCircle className="w-3 h-3 ml-1" />مؤهلة</>
                              ) : (
                                <><XCircle className="w-3 h-3 ml-1" />غير مؤهلة</>
                              )}
                            </Badge>
                          </div>
                        </CardHeader>
                        <CardContent className="pt-2">
                          {!isEligible && (
                            <div className="space-y-2">
                              <p className="text-xs text-muted-foreground bg-muted/50 p-2 rounded whitespace-normal">
                                لا يمكن حماية الطابعة لأنك لا تملك رقمًا تسلسليًا. تواصل مع الإدارة لإضافته.
                              </p>
                              <Button
                                variant="outline"
                                size="sm"
                                className="w-full text-xs"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  requestSerialMutation.mutate(printer);
                                }}
                                disabled={printer.pending_serial_request || requestSerialMutation.isPending}
                              >
                                {printer.pending_serial_request ? (
                                  <><Clock className="w-3 h-3 ml-1" />طلب قيد المراجعة</>
                                ) : (
                                  <><MessageCircle className="w-3 h-3 ml-1" />طلب إضافة رقم تسلسلي</>
                                )}
                              </Button>
                            </div>
                          )}
                          {isEligible && !hasSubscription && (
                            <p className="text-xs text-muted-foreground">
                              اضغط لتحديد هذه الطابعة للاشتراك
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
                <ScrollBar orientation="horizontal" />
              </ScrollArea>
            ) : (
              <Card className="text-center py-8 bg-muted/20">
                <CardContent>
                  <Printer className="w-12 h-12 mx-auto text-muted-foreground mb-3" />
                  <h3 className="font-semibold mb-1">لا توجد طابعات مشتراة</h3>
                  <p className="text-sm text-muted-foreground">
                    ستظهر هنا الطابعات بعد توصيلها. يمكنك استعراض باقات الحماية الآن.
                  </p>
                </CardContent>
              </Card>
            )}
          </section>

          {/* Section B: Active Subscriptions */}
          {subscriptions && subscriptions.length > 0 && (
            <section>
              <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-green-500" />
                اشتراكاتي المفعلة
              </h2>
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                {subscriptions.map((sub) => {
                  const availableUpgrades = getAvailableUpgrades(sub.protection_plans);
                  const statusColors: Record<string, string> = {
                    active: 'bg-green-500/20 text-green-500 border-green-500/30',
                    paused: 'bg-amber-500/20 text-amber-500 border-amber-500/30',
                    expired: 'bg-destructive/20 text-destructive border-destructive/30',
                  };
                  
                  return (
                    <Card key={sub.id} className="border-primary/20">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanGradient(sub.protection_plans.plan_type)} text-white`}>
                              {getPlanIcon(sub.protection_plans.icon_name)}
                            </div>
                            <div>
                              <CardTitle className="text-base">
                                {sub.protection_plans.name_ar}
                              </CardTitle>
                              <CardDescription className="text-xs mt-0.5">
                                {sub.user_printers?.store_printers?.model_name_ar}
                              </CardDescription>
                            </div>
                          </div>
                          <Badge 
                            variant="outline" 
                            className={statusColors[sub.status] || statusColors.active}
                          >
                            {sub.status === 'active' ? 'نشط' : sub.status === 'paused' ? 'متوقف' : 'منتهي'}
                          </Badge>
                        </div>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-2 text-sm">
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">السعر الشهري:</span>
                            <span className="font-medium">{sub.monthly_price?.toLocaleString()} د.ع</span>
                          </div>
                          <div className="flex justify-between">
                            <span className="text-muted-foreground">تاريخ البداية:</span>
                            <span>{format(new Date(sub.start_date), 'dd/MM/yyyy')}</span>
                          </div>
                          {sub.next_billing_date && (
                            <div className="flex justify-between">
                              <span className="text-muted-foreground">التجديد القادم:</span>
                              <span>{format(new Date(sub.next_billing_date), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          {sub.waiting_period_ends_at && new Date(sub.waiting_period_ends_at) > new Date() && (
                            <div className="flex items-center gap-1 text-amber-500 text-xs bg-amber-500/10 p-2 rounded">
                              <Clock className="w-3 h-3" />
                              <span>فترة الانتظار تنتهي: {format(new Date(sub.waiting_period_ends_at), 'dd/MM/yyyy')}</span>
                            </div>
                          )}
                          <div className="flex justify-between text-xs">
                            <span className="text-muted-foreground">الرقم التسلسلي:</span>
                            <span className="font-mono" dir="ltr">{sub.user_printers?.store_printers?.serial_number}</span>
                          </div>
                        </div>
                        
                        {/* Action Buttons */}
                        <div className="flex gap-2 mt-4">
                          {availableUpgrades.length > 0 && sub.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="flex-1 text-xs"
                              onClick={() => {
                                setUpgradingSubscription(sub);
                                setUpgradeDialogOpen(true);
                              }}
                            >
                              <ArrowUp className="w-3 h-3 ml-1" />
                              ترقية الباقة
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="ghost"
                            className="text-destructive hover:text-destructive text-xs"
                            onClick={() => {
                              setCancellingSubscription(sub);
                              setCancelDialogOpen(true);
                            }}
                          >
                            إلغاء
                          </Button>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          )}

          {/* Section C: Protection Plans */}
          <section>
            <h2 className="text-xl font-semibold mb-4 flex items-center gap-2">
              <Shield className="w-5 h-5 text-primary" />
              خطط الاشتراك
            </h2>
            
            {selectedPrinter && (
              <div className="mb-4 p-3 bg-primary/10 rounded-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 text-primary" />
                  <span className="text-sm">
                    الطابعة المحددة: <strong>{selectedPrinter.product_name_ar}</strong>
                  </span>
                </div>
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={() => setSelectedPrinter(null)}
                >
                  تغيير
                </Button>
              </div>
            )}
            
            <div className="grid gap-4 md:grid-cols-3">
              {plans?.map((plan) => {
                const isPopular = plan.plan_type === 'standard';
                
                return (
                  <Card 
                    key={plan.id} 
                    className={`relative ${isPopular ? 'border-primary ring-1 ring-primary' : ''}`}
                  >
                    {isPopular && (
                      <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                        <Badge className="bg-primary text-primary-foreground">
                          الأكثر شيوعاً
                        </Badge>
                      </div>
                    )}
                    <CardHeader className="text-center pb-2">
                      <div className={`w-14 h-14 mx-auto rounded-full bg-gradient-to-br ${getPlanGradient(plan.plan_type)} flex items-center justify-center text-white mb-3`}>
                        {getPlanIcon(plan.icon_name, 'w-7 h-7')}
                      </div>
                      <CardTitle>{plan.name_ar}</CardTitle>
                      <div className="text-2xl font-bold text-primary mt-2">
                        {plan.monthly_price?.toLocaleString()} <span className="text-sm font-normal">د.ع/شهر</span>
                      </div>
                    </CardHeader>
                    <CardContent>
                      <ul className="space-y-2 text-sm mb-4">
                        {plan.max_service_requests_per_month && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>{plan.max_service_requests_per_month} طلب خدمة/شهر</span>
                          </li>
                        )}
                        {plan.maintenance_discount_percentage && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>خصم {plan.maintenance_discount_percentage}% على الصيانة</span>
                          </li>
                        )}
                        {plan.parts_discount_percentage && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>خصم {plan.parts_discount_percentage}% على قطع الغيار</span>
                          </li>
                        )}
                        {plan.has_preventive_maintenance && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>صيانة وقائية دورية</span>
                          </li>
                        )}
                        {plan.has_replacement_printer && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>طابعة بديلة (حسب التوفر)</span>
                          </li>
                        )}
                        {plan.priority_level && plan.priority_level > 1 && (
                          <li className="flex items-center gap-2">
                            <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                            <span>أولوية في الخدمة (المستوى {plan.priority_level})</span>
                          </li>
                        )}
                      </ul>
                      
                      <Button
                        className="w-full"
                        variant={isPopular ? 'default' : 'outline'}
                        onClick={() => {
                          if (!selectedPrinter) {
                            toast.error('اختر طابعة مؤهلة أولاً من الشريط أعلاه');
                            return;
                          }
                          setSelectedPlan(plan);
                          setSubscribeDialogOpen(true);
                        }}
                        disabled={eligibleForSubscription.length === 0}
                      >
                        اشترك الآن
                      </Button>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
            
            {eligibleForSubscription.length === 0 && eligiblePrinters && eligiblePrinters.length > 0 && (
              <div className="mt-4 p-4 bg-amber-500/10 rounded-lg flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />
                <div className="text-sm">
                  <p className="font-medium text-amber-600">لا توجد طابعات مؤهلة للاشتراك</p>
                  <p className="text-muted-foreground">جميع طابعاتك إما محمية بالفعل أو تحتاج لإضافة رقم تسلسلي.</p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}

      {/* Subscribe Confirmation Dialog */}
      <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>تأكيد الاشتراك</DialogTitle>
            <DialogDescription>
              مراجعة تفاصيل الاشتراك قبل التفعيل
            </DialogDescription>
          </DialogHeader>
          
          {selectedPrinter && selectedPlan && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الطابعة:</span>
                  <span className="font-medium">{selectedPrinter.product_name_ar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الرقم التسلسلي:</span>
                  <span className="font-mono" dir="ltr">{selectedPrinter.serial_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">الباقة:</span>
                  <span className="font-medium">{selectedPlan.name_ar}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">السعر الشهري:</span>
                  <span className="font-bold text-primary">{selectedPlan.monthly_price?.toLocaleString()} د.ع</span>
                </div>
                {selectedPlan.waiting_period_days && (
                  <div className="flex justify-between text-amber-600">
                    <span>فترة الانتظار:</span>
                    <span>{selectedPlan.waiting_period_days} يوم</span>
                  </div>
                )}
              </div>
              
              <p className="text-xs text-muted-foreground">
                بالضغط على "تأكيد الاشتراك" ستوافق على شروط خدمة الحماية وسيتم تفعيل الاشتراك فوراً.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setSubscribeDialogOpen(false)}>
              إلغاء
            </Button>
            <Button 
              onClick={() => {
                if (selectedPrinter && selectedPlan) {
                  subscribeMutation.mutate({
                    printerId: selectedPrinter.order_item_id,
                    planId: selectedPlan.id,
                  });
                }
              }}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الاشتراك'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>ترقية الاشتراك</DialogTitle>
            <DialogDescription>
              اختر الباقة الجديدة - سيتم احتساب رصيد الأيام المتبقية
            </DialogDescription>
          </DialogHeader>
          
          {upgradingSubscription && (
            <div className="space-y-4">
              <div className="p-3 bg-muted/50 rounded-lg text-sm">
                <p className="text-muted-foreground mb-2">الباقة الحالية:</p>
                <p className="font-medium">{upgradingSubscription.protection_plans.name_ar} - {upgradingSubscription.monthly_price?.toLocaleString()} د.ع/شهر</p>
              </div>
              
              <div className="space-y-2">
                <p className="text-sm font-medium">الباقات المتاحة للترقية:</p>
                {getAvailableUpgrades(upgradingSubscription.protection_plans).map((plan) => {
                  const nextBilling = new Date(upgradingSubscription.next_billing_date!);
                  const daysRemaining = Math.max(0, differenceInDays(nextBilling, new Date()));
                  const creditAmount = (upgradingSubscription.monthly_price * daysRemaining) / 30;
                  const amountDue = Math.max(0, plan.monthly_price - creditAmount);
                  
                  return (
                    <Card 
                      key={plan.id} 
                      className="cursor-pointer hover:border-primary transition-colors"
                      onClick={() => {
                        upgradeMutation.mutate({ subscription: upgradingSubscription, newPlan: plan });
                      }}
                    >
                      <CardContent className="p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanGradient(plan.plan_type)} text-white`}>
                              {getPlanIcon(plan.icon_name, 'w-4 h-4')}
                            </div>
                            <div>
                              <p className="font-medium">{plan.name_ar}</p>
                              <p className="text-xs text-muted-foreground">{plan.monthly_price?.toLocaleString()} د.ع/شهر</p>
                            </div>
                          </div>
                          <div className="text-left">
                            <p className="text-xs text-muted-foreground">المطلوب الآن:</p>
                            <p className="font-bold text-primary">{amountDue.toLocaleString()} د.ع</p>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeDialogOpen(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>إلغاء الاشتراك</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إلغاء الاشتراك؟
            </DialogDescription>
          </DialogHeader>
          
          {cancellingSubscription && (
            <div className="space-y-4">
              {(() => {
                const nextBilling = new Date(cancellingSubscription.next_billing_date!);
                const daysRemaining = Math.max(0, differenceInDays(nextBilling, new Date()));
                const refundAmount = (cancellingSubscription.monthly_price * daysRemaining) / 30;
                
                return (
                  <div className="p-3 bg-muted/50 rounded-lg space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الباقة:</span>
                      <span>{cancellingSubscription.protection_plans.name_ar}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">الأيام المتبقية:</span>
                      <span>{daysRemaining} يوم</span>
                    </div>
                    <div className="flex justify-between text-green-600">
                      <span>المبلغ المسترجع:</span>
                      <span className="font-bold">{refundAmount.toLocaleString()} د.ع</span>
                    </div>
                  </div>
                );
              })()}
              
              <p className="text-xs text-muted-foreground">
                سيتم إلغاء الاشتراك فوراً وسيتم استرجاع المبلغ المتبقي إلى محفظتك.
              </p>
            </div>
          )}
          
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelDialogOpen(false)}>
              تراجع
            </Button>
            <Button 
              variant="destructive"
              onClick={() => {
                if (cancellingSubscription) {
                  cancelMutation.mutate(cancellingSubscription);
                }
              }}
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : 'تأكيد الإلغاء'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default MyPrinters;