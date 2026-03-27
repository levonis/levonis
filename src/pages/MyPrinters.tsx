import React, { useState, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ScrollArea, ScrollBar } from '@/components/ui/scroll-area';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { 
  Printer, Shield, ShieldCheck, Loader2, 
  CheckCircle, XCircle, Clock, MessageCircle, Crown, Star,
  ArrowUp, Wrench, AlertCircle, Calendar, Timer, Package
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { format, differenceInDays, addDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import Footer from '@/components/Footer';
import MaintenanceTicketDialog from '@/components/printer/MaintenanceTicketDialog';
import MaintenanceTicketsList from '@/components/printer/MaintenanceTicketsList';

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
  image_url?: string | null;
  is_verified?: boolean;
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
  max_parts_discount_per_month?: number | null;
  parts_discount_categories?: string[] | null;
}

interface Subscription {
  id: string;
  status: string;
  start_date: string;
  monthly_price: number;
  auto_renew: boolean;
  waiting_period_ends_at: string | null;
  next_billing_date: string | null;
  end_date: string | null;
  plan_id: string;
  user_printer_id: string;
  user_printers: {
    id: string;
    store_printers: {
      serial_number: string;
      model_name_ar: string;
      image_url?: string | null;
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
  const [maintenanceDialogOpen, setMaintenanceDialogOpen] = useState(false);
  const [maintenanceSubscription, setMaintenanceSubscription] = useState<Subscription | null>(null);

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
  const { data: eligiblePrinters, isLoading: printersLoading, refetch: refetchPrinters } = useQuery({
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
  const { data: subscriptions, isLoading: subscriptionsLoading, refetch: refetchSubscriptions } = useQuery({
    queryKey: ['user-subscriptions', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('printer_subscriptions')
        .select(`
          *,
          user_printers!inner (
            id,
            store_printers!inner (serial_number, model_name_ar, image_url)
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

  // Listen for realtime updates on serial_number_requests
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('serial-requests-updates')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'serial_number_requests',
          filter: `user_id=eq.${user.id}`,
        },
        (payload) => {
          const newData = payload.new as any;
          console.log('Serial request update:', newData);
          
          if (newData.status === 'approved') {
            toast.success('🎉 تم قبول طلبك!', {
              description: 'الطابعة أصبحت مؤهلة للاشتراك في خدمة الحماية',
              duration: 6000,
            });
          } else if (newData.status === 'rejected') {
            toast.error('تم رفض الطلب', {
              description: newData.admin_notes || 'تواصل مع الإدارة لمزيد من التفاصيل',
              duration: 6000,
            });
          }
          
          // Always refetch on any change
          setTimeout(() => {
            refetchPrinters();
            queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
          }, 500);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchPrinters, queryClient]);

  // Also listen for order_items updates (when admin adds serial number)
  useEffect(() => {
    if (!user) return;

    const channel = supabase
      .channel('order-items-updates')
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'order_items',
        },
        (payload) => {
          const newData = payload.new as any;
          const oldData = payload.old as any;
          
          // Check if serial_number was added
          if (!oldData.serial_number && newData.serial_number) {
            toast.success('🎉 تم إضافة الرقم التسلسلي!', {
              description: 'الطابعة أصبحت مؤهلة للاشتراك في خدمة الحماية',
              duration: 6000,
            });
            
            setTimeout(() => {
              refetchPrinters();
              queryClient.invalidateQueries({ queryKey: ['eligible-printers'] });
            }, 500);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refetchPrinters, queryClient]);

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
      toast.success('تم إرسال الطلب ✅', {
        description: 'سيتم مراجعة طلبك وإبلاغك بالنتيجة',
      });
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
            image_url: printer.image_url,
          })
          .select('id')
          .single();

        if (storeError) throw storeError;
        storePrinter = newStorePrinter;
      }

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
      toast.success('تم تفعيل الاشتراك بنجاح! ✅');
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

  // Upgrade mutation
  const upgradeMutation = useMutation({
    mutationFn: async ({ subscription, newPlan }: { subscription: Subscription; newPlan: ProtectionPlan }) => {
      const oldPlan = subscription.protection_plans;
      const nextBilling = new Date(subscription.next_billing_date!);
      const now = new Date();
      const totalDays = 30;
      const daysRemaining = Math.max(0, differenceInDays(nextBilling, now));
      
      const creditAmount = (subscription.monthly_price * daysRemaining) / totalDays;
      const amountDue = Math.max(0, newPlan.monthly_price - creditAmount);

      const { error: updateError } = await supabase
        .from('printer_subscriptions')
        .update({
          plan_id: newPlan.id,
          monthly_price: newPlan.monthly_price,
          waiting_period_ends_at: addDays(now, newPlan.waiting_period_days || 0).toISOString(),
        })
        .eq('id', subscription.id);

      if (updateError) throw updateError;

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
      toast.success(`تمت الترقية بنجاح! ✅`, {
        description: `الرصيد المتبقي: ${data.creditAmount.toLocaleString()} د.ع`,
      });
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      setUpgradeDialogOpen(false);
      setUpgradingSubscription(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء الترقية');
    },
  });

  // Cancel mutation
  const cancelMutation = useMutation({
    mutationFn: async (subscription: Subscription) => {
      const nextBilling = new Date(subscription.next_billing_date!);
      const now = new Date();
      const totalDays = 30;
      const daysRemaining = Math.max(0, differenceInDays(nextBilling, now));
      const usedDays = totalDays - daysRemaining;
      
      const refundAmount = (subscription.monthly_price * daysRemaining) / totalDays;

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
        toast.success(`تم الإلغاء ✅`, {
          description: `سيتم استرجاع ${data.refundAmount.toLocaleString()} د.ع (${data.daysRemaining} يوم)`,
        });
      } else {
        toast.success('تم إلغاء الاشتراك ✅');
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

  const getPlanIcon = (iconName: string, size = 'w-4 h-4') => {
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

  // Calculate remaining days from start_date (30 day cycle)
  const getRemainingDays = (startDate: string, nextBillingDate: string | null) => {
    if (nextBillingDate) {
      const next = new Date(nextBillingDate);
      const now = new Date();
      return Math.max(0, differenceInDays(next, now));
    }
    // Fallback: calculate from start_date
    const start = new Date(startDate);
    const endOfCycle = addDays(start, 30);
    const now = new Date();
    return Math.max(0, differenceInDays(endOfCycle, now));
  };

  // Get eligibility status with clearer messages
  const getEligibilityStatus = (printer: EligiblePrinter) => {
    if (printer.has_active_subscription) {
      return { 
        label: 'محمية', 
        icon: <ShieldCheck className="w-3 h-3" />,
        color: 'bg-green-500/20 text-green-700 border-green-500/40' 
      };
    }
    if (printer.serial_number) {
      return { 
        label: 'مؤهلة للاشتراك', 
        icon: <CheckCircle className="w-3 h-3" />,
        color: 'bg-blue-500/20 text-blue-700 border-blue-500/40' 
      };
    }
    if (printer.pending_serial_request) {
      return { 
        label: 'قيد المراجعة', 
        icon: <Clock className="w-3 h-3" />,
        color: 'bg-amber-500/20 text-amber-700 border-amber-500/40' 
      };
    }
    return { 
      label: 'تحتاج رقم تسلسلي', 
      icon: <AlertCircle className="w-3 h-3" />,
      color: 'bg-red-500/20 text-red-700 border-red-500/40' 
    };
  };

  // Printer image component
  const PrinterImage = ({ imageUrl, size = 56 }: { imageUrl?: string | null; size?: number }) => {
    const [hasError, setHasError] = useState(false);
    
    if (imageUrl && !hasError) {
      return (
        <img 
          src={imageUrl} 
          alt="Printer" 
          className="rounded-lg object-cover bg-muted border border-border/50"
          style={{ width: size, height: size }}
          onError={() => setHasError(true)}
        />
      );
    }
    return (
      <div 
        className="bg-muted/50 rounded-lg flex items-center justify-center border border-border/50"
        style={{ width: size, height: size }}
      >
        <Printer className="w-6 h-6 text-muted-foreground/60" />
      </div>
    );
  };

  const eligibleForSubscription = eligiblePrinters?.filter(p => p.serial_number && !p.has_active_subscription) || [];

  if (authLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-6 h-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!user) {
    navigate('/auth');
    return null;
  }

  const isLoading = printersLoading || subscriptionsLoading;

  return (
    <>
      <div className="container mx-auto px-4 py-4 max-w-6xl" dir="rtl">
        {/* Page Header */}
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-primary/10 rounded-xl">
            <Shield className="w-5 h-5 text-primary" />
          </div>
          <div>
            <h1 className="text-lg font-bold">حماية الطابعات</h1>
            <p className="text-xs text-muted-foreground">إدارة الاشتراكات وخدمات الحماية</p>
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="w-6 h-6 animate-spin text-primary" />
          </div>
        ) : (
          <div className="space-y-6">
            {/* Section A: My Printers */}
            <section>
              <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-semibold flex items-center gap-2">
                  <Printer className="w-4 h-4 text-primary" />
                  طابعاتي المشتراة
                  <Badge variant="secondary" className="text-xs">{eligiblePrinters?.length || 0}</Badge>
                </h2>
              </div>
              
              {eligiblePrinters && eligiblePrinters.length > 0 ? (
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {eligiblePrinters.map((printer) => {
                    const isEligible = !!printer.serial_number;
                    const hasSubscription = printer.has_active_subscription;
                    const isSelected = selectedPrinter?.order_item_id === printer.order_item_id;
                    const status = getEligibilityStatus(printer);
                    
                    return (
                      <Card 
                        key={printer.order_item_id} 
                        className={`transition-all cursor-pointer ${
                          hasSubscription 
                            ? 'border-green-500/50 bg-green-500/5' 
                            : isEligible 
                              ? isSelected
                                ? 'border-primary ring-2 ring-primary/30 bg-primary/5'
                                : 'border-border hover:border-primary/50 hover:shadow-md'
                              : 'border-muted bg-muted/20'
                        }`}
                        onClick={() => {
                          if (isEligible && !hasSubscription) {
                            setSelectedPrinter(isSelected ? null : printer);
                          }
                        }}
                      >
                        <CardContent className="p-3">
                          <div className="flex gap-3">
                            {/* Printer Image */}
                            <PrinterImage imageUrl={printer.image_url} size={64} />
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-1">
                                <h3 className="text-sm font-medium line-clamp-2 leading-snug">
                                  {printer.product_name_ar}
                                </h3>
                              </div>
                              
                              {/* Status Badge */}
                              <Badge 
                                variant="outline"
                                className={`text-[10px] px-1.5 py-0.5 gap-1 ${status.color}`}
                              >
                                {status.icon}
                                {status.label}
                              </Badge>
                              
                              {/* Serial Number or Request Button */}
                              {printer.serial_number ? (
                                <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                                  <Package className="w-3 h-3" />
                                  <span className="font-mono text-[11px]" dir="ltr">
                                    SN: {printer.serial_number}
                                  </span>
                                </div>
                              ) : (
                                <div className="mt-2">
                                  {!printer.pending_serial_request ? (
                                    <Button
                                      variant="outline"
                                      size="sm"
                                      className="h-7 text-xs w-full"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        requestSerialMutation.mutate(printer);
                                      }}
                                      disabled={requestSerialMutation.isPending}
                                    >
                                      {requestSerialMutation.isPending ? (
                                        <Loader2 className="w-3 h-3 animate-spin ml-1" />
                                      ) : (
                                        <MessageCircle className="w-3 h-3 ml-1" />
                                      )}
                                      طلب إضافة الرقم التسلسلي
                                    </Button>
                                  ) : (
                                    <p className="text-[11px] text-amber-600 flex items-center gap-1">
                                      <Clock className="w-3 h-3" />
                                      في انتظار مراجعة الإدارة
                                    </p>
                                  )}
                                </div>
                              )}
                            </div>
                          </div>
                        </CardContent>
                      </Card>
                    );
                  })}
                </div>
              ) : (
                <Card className="text-center py-8 bg-muted/10 border-dashed">
                  <CardContent className="p-0">
                    <Printer className="w-10 h-10 mx-auto text-muted-foreground/40 mb-2" />
                    <h3 className="text-sm font-medium text-muted-foreground">لا توجد طابعات</h3>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      ستظهر هنا بعد توصيل طلباتك
                    </p>
                  </CardContent>
                </Card>
              )}
            </section>

            {/* Section B: Active Subscriptions */}
            {subscriptions && subscriptions.length > 0 && (
              <section>
                <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-green-500" />
                  اشتراكاتي النشطة
                  <Badge variant="secondary" className="text-xs bg-green-500/10 text-green-600">{subscriptions.length}</Badge>
                </h2>
                
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {subscriptions.map((sub) => {
                    const availableUpgrades = getAvailableUpgrades(sub.protection_plans);
                    const remainingDays = getRemainingDays(sub.start_date, sub.next_billing_date);
                    const isWaiting = sub.waiting_period_ends_at && new Date(sub.waiting_period_ends_at) > new Date();
                    const waitingDaysLeft = isWaiting ? differenceInDays(new Date(sub.waiting_period_ends_at!), new Date()) : 0;
                    
                    const statusConfig: Record<string, { label: string; color: string }> = {
                      active: { label: 'نشط', color: 'bg-green-500/20 text-green-700 border-green-500/40' },
                      paused: { label: 'متوقف', color: 'bg-amber-500/20 text-amber-700 border-amber-500/40' },
                      expired: { label: 'منتهي', color: 'bg-red-500/20 text-red-700 border-red-500/40' },
                    };
                    const statusInfo = statusConfig[sub.status] || statusConfig.active;
                    
                    return (
                      <Card key={sub.id} className="border-green-500/30 bg-gradient-to-br from-green-500/5 to-transparent">
                        <CardContent className="p-4">
                          {/* Header */}
                          <div className="flex items-start gap-3 mb-3">
                            <div className={`p-2 rounded-xl bg-gradient-to-br ${getPlanGradient(sub.protection_plans.plan_type)} text-white shrink-0`}>
                              {getPlanIcon(sub.protection_plans.icon_name, 'w-4 h-4')}
                            </div>
                            
                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-2">
                                <h3 className="text-sm font-semibold">{sub.protection_plans.name_ar}</h3>
                                <Badge variant="outline" className={`text-[10px] ${statusInfo.color}`}>
                                  {statusInfo.label}
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground truncate">
                                {sub.user_printers?.store_printers?.model_name_ar}
                              </p>
                            </div>
                          </div>
                          
                          {/* Remaining Days - PROMINENT */}
                          <div className="bg-primary/10 rounded-lg p-3 mb-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <Timer className="w-4 h-4 text-primary" />
                                <span className="text-xs text-muted-foreground">الأيام المتبقية</span>
                              </div>
                              <span className="text-lg font-bold text-primary">{remainingDays}</span>
                            </div>
                            {isWaiting && (
                              <div className="mt-2 flex items-center gap-1 text-[10px] text-amber-600">
                                <Clock className="w-3 h-3" />
                                <span>فترة الانتظار: {waitingDaysLeft} يوم متبقي</span>
                              </div>
                            )}
                          </div>
                          
                          {/* Details */}
                          <div className="grid grid-cols-2 gap-2 text-xs mb-3">
                            <div className="flex justify-between bg-muted/30 rounded-lg px-2 py-1.5">
                              <span className="text-muted-foreground">الشهري</span>
                              <span className="font-medium">{sub.monthly_price?.toLocaleString()} د.ع</span>
                            </div>
                            <div className="flex justify-between bg-muted/30 rounded-lg px-2 py-1.5">
                              <span className="text-muted-foreground">التجديد</span>
                              <span>{sub.next_billing_date ? format(new Date(sub.next_billing_date), 'dd/MM') : '-'}</span>
                            </div>
                          </div>
                          
                          {/* Action Buttons */}
                          <div className="flex gap-2">
                            {sub.status === 'active' && (
                              <Button
                                size="sm"
                                variant="outline"
                                className="flex-1 h-8 text-xs"
                                onClick={() => {
                                  setMaintenanceSubscription(sub);
                                  setMaintenanceDialogOpen(true);
                                }}
                              >
                                <Wrench className="w-3 h-3 ml-1" />
                                طلب صيانة
                              </Button>
                            )}
                            {availableUpgrades.length > 0 && sub.status === 'active' && (
                              <Button
                                size="sm"
                                variant="default"
                                className="flex-1 h-8 text-xs"
                                onClick={() => {
                                  setUpgradingSubscription(sub);
                                  setUpgradeDialogOpen(true);
                                }}
                              >
                                <ArrowUp className="w-3 h-3 ml-1" />
                                ترقية
                              </Button>
                            )}
                            <Button
                              size="sm"
                              variant="ghost"
                              className="text-destructive hover:text-destructive hover:bg-destructive/10 h-8 text-xs"
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
              <h2 className="text-sm font-semibold mb-3 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary" />
                خطط الحماية المتاحة
              </h2>
              
              {selectedPrinter && (
                <div className="mb-3 p-3 bg-primary/10 rounded-xl flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="w-4 h-4 text-primary" />
                    <span className="text-sm">
                      الطابعة المختارة: <strong>{selectedPrinter.product_name_ar}</strong>
                    </span>
                  </div>
                  <Button 
                    variant="ghost" 
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setSelectedPrinter(null)}
                  >
                    تغيير
                  </Button>
                </div>
              )}
              
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {plans?.map((plan) => {
                  const isPopular = plan.plan_type === 'standard';
                  
                  return (
                    <Card 
                      key={plan.id} 
                      className={`relative transition-all hover:shadow-lg ${
                        isPopular 
                          ? 'border-primary ring-2 ring-primary/20 shadow-md' 
                          : 'border-border hover:border-primary/50'
                      }`}
                    >
                      {isPopular && (
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                          <Badge className="bg-primary text-primary-foreground text-xs px-3 shadow-sm">
                            الأكثر شيوعاً
                          </Badge>
                        </div>
                      )}
                      
                      <CardContent className="p-4 pt-5">
                        {/* Plan Header */}
                        <div className="text-center mb-4">
                          <div className={`w-12 h-12 mx-auto rounded-2xl bg-gradient-to-br ${getPlanGradient(plan.plan_type)} flex items-center justify-center text-white mb-2 shadow-lg`}>
                            {getPlanIcon(plan.icon_name, 'w-6 h-6')}
                          </div>
                          <h3 className="text-base font-bold">{plan.name_ar}</h3>
                          <div className="mt-1">
                            <span className="text-2xl font-bold text-primary">{plan.monthly_price?.toLocaleString()}</span>
                            <span className="text-xs text-muted-foreground mr-1">د.ع/شهر</span>
                          </div>
                        </div>
                        
                        {/* Features */}
                        <ul className="space-y-2 text-xs mb-4">
                          {plan.max_service_requests_per_month && (
                            <li className="flex items-center gap-2">
                              <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />
                              <span>{plan.max_service_requests_per_month} طلب صيانة/شهر</span>
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
                              {plan.max_parts_discount_per_month && (
                                <Badge variant="secondary" className="text-[9px] px-1">
                                  {plan.max_parts_discount_per_month} طلب/شهر
                                </Badge>
                              )}
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
                              <span>طابعة بديلة مؤقتة</span>
                            </li>
                          )}
                          {plan.waiting_period_days && (
                            <li className="flex items-center gap-2 text-muted-foreground">
                              <Clock className="w-4 h-4 shrink-0" />
                              <span>فترة انتظار: {plan.waiting_period_days} يوم</span>
                            </li>
                          )}
                        </ul>
                        
                        {/* Subscribe Button */}
                        <Button
                          className="w-full h-10"
                          variant={isPopular ? 'default' : 'outline'}
                          onClick={() => {
                            if (!selectedPrinter) {
                              if (eligibleForSubscription.length === 0) {
                                toast.error('لا توجد طابعات مؤهلة للاشتراك');
                              } else {
                                toast.error('اختر طابعة مؤهلة أولاً');
                              }
                              return;
                            }
                            setSelectedPlan(plan);
                            setSubscribeDialogOpen(true);
                          }}
                          disabled={eligibleForSubscription.length === 0 && !selectedPrinter}
                        >
                          اشترك الآن
                        </Button>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            </section>
          </div>
        )}
      </div>

      {/* Subscribe Dialog */}
      <Dialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>تأكيد الاشتراك</DialogTitle>
            <DialogDescription>
              أنت على وشك الاشتراك في خطة الحماية
            </DialogDescription>
          </DialogHeader>
          
          {selectedPlan && selectedPrinter && (
            <div className="space-y-4 py-4">
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <PrinterImage imageUrl={selectedPrinter.image_url} size={48} />
                <div>
                  <p className="font-medium text-sm">{selectedPrinter.product_name_ar}</p>
                  <p className="text-xs text-muted-foreground font-mono" dir="ltr">
                    SN: {selectedPrinter.serial_number}
                  </p>
                </div>
              </div>
              
              <div className="flex items-center gap-3 p-3 bg-primary/10 rounded-lg">
                <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanGradient(selectedPlan.plan_type)} text-white`}>
                  {getPlanIcon(selectedPlan.icon_name)}
                </div>
                <div>
                  <p className="font-medium">{selectedPlan.name_ar}</p>
                  <p className="text-sm text-primary font-bold">
                    {selectedPlan.monthly_price?.toLocaleString()} د.ع/شهر
                  </p>
                </div>
              </div>
              
              {selectedPlan.waiting_period_days && (
                <div className="flex items-center gap-2 p-3 bg-amber-500/10 rounded-lg text-amber-700 text-sm">
                  <Clock className="w-4 h-4" />
                  <span>فترة انتظار: {selectedPlan.waiting_period_days} يوم قبل تفعيل التغطية</span>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
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
              {subscribeMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              تأكيد الاشتراك
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Upgrade Dialog */}
      <Dialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>ترقية الاشتراك</DialogTitle>
            <DialogDescription>
              اختر الخطة التي تريد الترقية إليها
            </DialogDescription>
          </DialogHeader>
          
          {upgradingSubscription && (
            <div className="space-y-3 py-4">
              <p className="text-sm text-muted-foreground">
                الخطة الحالية: <strong>{upgradingSubscription.protection_plans.name_ar}</strong>
              </p>
              
              {getAvailableUpgrades(upgradingSubscription.protection_plans).map((plan) => {
                const priceDiff = plan.monthly_price - upgradingSubscription.monthly_price;
                
                return (
                  <Card 
                    key={plan.id}
                    className="cursor-pointer hover:border-primary transition-all"
                    onClick={() => {
                      upgradeMutation.mutate({
                        subscription: upgradingSubscription,
                        newPlan: plan,
                      });
                    }}
                  >
                    <CardContent className="p-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`p-2 rounded-lg bg-gradient-to-br ${getPlanGradient(plan.plan_type)} text-white`}>
                          {getPlanIcon(plan.icon_name)}
                        </div>
                        <div>
                          <p className="font-medium">{plan.name_ar}</p>
                          <p className="text-sm text-primary">{plan.monthly_price?.toLocaleString()} د.ع/شهر</p>
                        </div>
                      </div>
                      <Badge variant="secondary">+{priceDiff.toLocaleString()}</Badge>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onOpenChange={setCancelDialogOpen}>
        <DialogContent className="max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-destructive">إلغاء الاشتراك</DialogTitle>
            <DialogDescription>
              هل أنت متأكد من إلغاء اشتراكك؟
            </DialogDescription>
          </DialogHeader>
          
          {cancellingSubscription && (
            <div className="py-4">
              <div className="p-3 bg-destructive/10 rounded-lg text-destructive text-sm">
                <p className="font-medium mb-2">تحذير:</p>
                <p>سيتم إلغاء اشتراكك في خطة "{cancellingSubscription.protection_plans.name_ar}" وستفقد جميع مزايا الحماية.</p>
              </div>
              
              {cancellingSubscription.next_billing_date && (
                <div className="mt-3 p-3 bg-muted/50 rounded-lg text-sm">
                  <p>سيتم حساب المبلغ المسترجع بناءً على الأيام المتبقية من دورة الفوترة الحالية.</p>
                </div>
              )}
            </div>
          )}
          
          <DialogFooter className="gap-2">
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
              {cancelMutation.isPending ? (
                <Loader2 className="w-4 h-4 animate-spin ml-2" />
              ) : null}
              تأكيد الإلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      <Footer />
    </>
  );
};

export default MyPrinters;