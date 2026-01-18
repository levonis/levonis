import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetClose } from "@/components/ui/sheet";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { 
  Shield, ShieldCheck, Printer, ChevronDown, ChevronUp, 
  Calendar, Clock, X, Wrench, AlertTriangle, Check, Loader2,
  ArrowUp, Sparkles
} from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";

interface InsuranceSectionProps {
  activeSubTab: SubTabId;
}

export default function InsuranceSection({ activeSubTab }: InsuranceSectionProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [expandedPrinter, setExpandedPrinter] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);

  // Fetch user's printers with subscriptions
  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['my-printers-with-subs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          *,
          printer_subscriptions(
            id, status, monthly_price, start_date, end_date,
            protection_plans(id, name_ar, plan_type, monthly_price, features, badge_text)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && (activeSubTab === 'status' || activeSubTab === 'maintenance'),
    staleTime: 2 * 60 * 1000,
  });

  // Fetch all protection plans
  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ['all-protection-plans-section'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('*')
        .eq('is_active', true)
        .order('monthly_price', { ascending: true });
      if (error) throw error;
      return data;
    },
    enabled: activeSubTab === 'plans',
    staleTime: 5 * 60 * 1000,
  });

  // Fetch user wallet
  const { data: userWallet } = useQuery({
    queryKey: ['user-wallet-insurance', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_wallet')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  // Subscribe mutation
  const subscribeMutation = useMutation({
    mutationFn: async ({ printerId, planId, price, isUpgrade, currentSubId }: any) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const balance = userWallet?.balance || 0;
      if (balance < price) {
        throw new Error('رصيد المحفظة غير كافٍ');
      }

      // Deduct from wallet
      const { error: walletError } = await supabase
        .from('user_wallet')
        .update({ balance: balance - price })
        .eq('user_id', user.id);
      if (walletError) throw walletError;

      if (isUpgrade && currentSubId) {
        // Cancel old subscription
        await supabase
          .from('printer_subscriptions')
          .update({ status: 'cancelled', cancelled_at: new Date().toISOString() })
          .eq('id', currentSubId);
      }

      // Calculate dates
      const startDate = new Date();
      const endDate = new Date();
      endDate.setMonth(endDate.getMonth() + 1);

      // Create new subscription
      const { error: subError } = await supabase
        .from('printer_subscriptions')
        .insert({
          user_id: user.id,
          user_printer_id: printerId,
          plan_id: planId,
          monthly_price: price,
          start_date: startDate.toISOString(),
          end_date: endDate.toISOString(),
          status: 'active',
        });
      if (subError) throw subError;

      return { isUpgrade };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-printers-with-subs'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet-insurance'] });
      toast.success(data.isUpgrade ? 'تم ترقية الاشتراك بنجاح!' : 'تم الاشتراك بنجاح!');
      setUpgradeDialogOpen(false);
      setSubscribeDialogOpen(false);
      setSelectedPlan(null);
      setSelectedPrinter(null);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const getActiveSub = (printer: any) => {
    return printer.printer_subscriptions?.find((s: any) => s.status === 'active');
  };

  const getDaysRemaining = (endDate: string) => {
    return Math.max(0, differenceInDays(new Date(endDate), new Date()));
  };

  const calculateUpgradeDiscount = (currentPlanPrice: number, newPlanPrice: number) => {
    // Discount = current plan price (no additional days, just upgrade)
    return Math.min(currentPlanPrice, newPlanPrice);
  };

  // Status sub-tab - Show printers with their status
  if (activeSubTab === 'status') {
    if (!user) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">سجّل الدخول لعرض حالة التأمين</p>
          </CardContent>
        </Card>
      );
    }

    if (loadingPrinters) {
      return (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (!printers || printers.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Printer className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-lg">لا توجد طابعات مسجلة</p>
            <p className="text-sm text-muted-foreground mt-2">
              أضف طابعتك للاستفادة من خدمات الحماية والصيانة
            </p>
            <Button className="mt-4" onClick={() => toast.info('سيتم فتح نموذج إضافة الطابعة')}>
              إضافة طابعة
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {printers.map((printer: any) => {
          const activeSub = getActiveSub(printer);
          const isExpanded = expandedPrinter === printer.id;
          
          return (
            <Card key={printer.id} className={activeSub ? 'border-green-200' : ''}>
              <Collapsible open={isExpanded} onOpenChange={() => setExpandedPrinter(isExpanded ? null : printer.id)}>
                <CollapsibleTrigger asChild>
                  <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className={`w-12 h-12 rounded-full flex items-center justify-center shrink-0 ${
                          activeSub ? 'bg-green-500/20' : 'bg-muted'
                        }`}>
                          {activeSub ? (
                            <ShieldCheck className="h-6 w-6 text-green-500" />
                          ) : (
                            <Printer className="h-6 w-6 text-muted-foreground" />
                          )}
                        </div>
                        <div>
                          <p className="font-medium">{printer.printer_name || 'طابعة'}</p>
                          <p className="text-xs text-muted-foreground">
                            {printer.serial_number || 'بدون رقم تسلسلي'}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {activeSub ? (
                          <Badge className="bg-green-500">محمية</Badge>
                        ) : (
                          <Badge variant="outline">غير محمية</Badge>
                        )}
                        {isExpanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                      </div>
                    </div>
                  </CardContent>
                </CollapsibleTrigger>
                
                <CollapsibleContent>
                  <div className="px-4 pb-4 border-t pt-4 space-y-3">
                    {activeSub ? (
                      <>
                        {/* Active Subscription Details */}
                        <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                          <div className="flex items-center justify-between mb-2">
                            <span className="font-medium text-green-700">
                              {activeSub.protection_plans?.name_ar}
                            </span>
                            <Badge variant="outline" className="text-green-600 border-green-300">
                              {activeSub.monthly_price?.toLocaleString()} د.ع/شهر
                            </Badge>
                          </div>
                          <div className="flex items-center gap-4 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <Calendar className="h-3 w-3" />
                              بدأ: {format(new Date(activeSub.start_date), 'dd MMM yyyy', { locale: ar })}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" />
                              متبقي: {getDaysRemaining(activeSub.end_date)} يوم
                            </span>
                          </div>
                        </div>

                        {/* Upgrade Options */}
                        {plans && plans.filter((p: any) => p.monthly_price > activeSub.monthly_price).length > 0 && (
                          <div className="space-y-2">
                            <p className="text-xs font-medium text-muted-foreground">ترقية الاشتراك:</p>
                            {plans
                              .filter((p: any) => p.monthly_price > activeSub.monthly_price)
                              .map((plan: any) => {
                                const discount = calculateUpgradeDiscount(activeSub.monthly_price, plan.monthly_price);
                                const upgradeCost = plan.monthly_price - discount;
                                
                                return (
                                  <Card key={plan.id} className="border-primary/20">
                                    <CardContent className="p-3">
                                      <div className="flex items-center justify-between">
                                        <div>
                                          <div className="flex items-center gap-2">
                                            <span className="font-medium">{plan.name_ar}</span>
                                            {plan.badge_text && (
                                              <Badge variant="secondary" className="text-[9px]">{plan.badge_text}</Badge>
                                            )}
                                          </div>
                                          <div className="flex items-center gap-2 mt-1">
                                            <span className="text-xs line-through text-muted-foreground">
                                              {plan.monthly_price?.toLocaleString()}
                                            </span>
                                            <span className="text-sm font-bold text-primary">
                                              {upgradeCost.toLocaleString()} د.ع
                                            </span>
                                            <Badge className="bg-amber-500 text-[9px]">خصم {discount.toLocaleString()}</Badge>
                                          </div>
                                        </div>
                                        <Button 
                                          size="sm"
                                          onClick={() => {
                                            setSelectedPlan({ ...plan, upgradeCost, currentSubId: activeSub.id });
                                            setSelectedPrinter(printer);
                                            setUpgradeDialogOpen(true);
                                          }}
                                        >
                                          <ArrowUp className="h-3 w-3 ml-1" />
                                          ترقية
                                        </Button>
                                      </div>
                                    </CardContent>
                                  </Card>
                                );
                              })}
                            <p className="text-[10px] text-amber-600 flex items-center gap-1">
                              <AlertTriangle className="h-3 w-3" />
                              الترقية لا تضيف أيام إضافية، فقط تغيير الباقة
                            </p>
                          </div>
                        )}

                        {/* Actions */}
                        <div className="flex gap-2">
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info('سيتم فتح الإعدادات')}>
                            الإعدادات
                          </Button>
                          <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info('سيتم فتح نموذج الصيانة')}>
                            <Wrench className="h-3.5 w-3.5 ml-1" />
                            طلب صيانة
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {/* No Subscription - Show available plans */}
                        <p className="text-sm text-muted-foreground">
                          هذه الطابعة غير مشمولة بالحماية. اختر باقة لحمايتها:
                        </p>
                        {plans?.map((plan: any) => (
                          <Card key={plan.id} className="border-primary/20 hover:shadow-md transition-shadow">
                            <CardContent className="p-3">
                              <div className="flex items-center justify-between">
                                <div>
                                  <div className="flex items-center gap-2">
                                    <span className="font-medium">{plan.name_ar}</span>
                                    {plan.badge_text && (
                                      <Badge variant="secondary" className="text-[9px]">{plan.badge_text}</Badge>
                                    )}
                                  </div>
                                  <p className="text-sm font-bold text-primary mt-0.5">
                                    {plan.monthly_price?.toLocaleString()} د.ع/شهر
                                  </p>
                                </div>
                                <Button 
                                  size="sm"
                                  onClick={() => {
                                    setSelectedPlan(plan);
                                    setSelectedPrinter(printer);
                                    setSubscribeDialogOpen(true);
                                  }}
                                >
                                  اشترك
                                </Button>
                              </div>
                            </CardContent>
                          </Card>
                        ))}
                      </>
                    )}
                  </div>
                </CollapsibleContent>
              </Collapsible>
            </Card>
          );
        })}
      </div>
    );
  }

  // Plans sub-tab
  if (activeSubTab === 'plans') {
    if (loadingPlans) {
      return (
        <div className="space-y-4">
          {[1, 2, 3].map(i => (
            <Skeleton key={i} className="h-48 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (!plans || plans.length === 0) {
      return (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            لا توجد باقات متاحة حالياً
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {plans.map((plan: any, index: number) => (
          <Card 
            key={plan.id}
            className={`overflow-hidden ${index === plans.length - 1 ? 'ring-2 ring-primary/50 shadow-lg' : ''}`}
          >
            {index === plans.length - 1 && (
              <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold px-3 py-1.5 flex items-center gap-1 justify-center">
                <Sparkles className="h-3 w-3" />
                الأفضل قيمة
              </div>
            )}
            <CardContent className="p-4">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-full bg-green-500/10 flex items-center justify-center shrink-0">
                  <Shield className="h-6 w-6 text-green-500" />
                </div>
                <div className="flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-bold text-lg">{plan.name_ar}</p>
                    {plan.badge_text && (
                      <Badge variant="secondary" className="text-[10px]">
                        {plan.badge_text}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xl font-bold text-primary mt-1">
                    {plan.monthly_price?.toLocaleString()} د.ع
                    <span className="text-sm font-normal text-muted-foreground">/شهر</span>
                  </p>
                </div>
              </div>

              {plan.description_ar && (
                <p className="text-sm text-muted-foreground mb-3">
                  {plan.description_ar}
                </p>
              )}

              {/* Features */}
              {plan.features && Array.isArray(plan.features) && (
                <div className="space-y-1.5 mb-4">
                  {(plan.features as string[]).map((feature, idx) => (
                    <div key={idx} className="flex items-center gap-2 text-sm">
                      <Check className="h-4 w-4 text-green-500 shrink-0" />
                      <span>{feature}</span>
                    </div>
                  ))}
                </div>
              )}

              <Button 
                className="w-full"
                variant={index === plans.length - 1 ? 'default' : 'outline'}
                onClick={() => {
                  if (!user) {
                    toast.error('سجّل الدخول أولاً');
                    return;
                  }
                  if (!printers || printers.length === 0) {
                    toast.error('أضف طابعة أولاً للاشتراك');
                    return;
                  }
                  // Show printer selection if multiple
                  if (printers.length === 1) {
                    setSelectedPlan(plan);
                    setSelectedPrinter(printers[0]);
                    setSubscribeDialogOpen(true);
                  } else {
                    toast.info('اختر الطابعة من تبويب "حالة التأمين"');
                  }
                }}
              >
                اشترك الآن
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  // Maintenance sub-tab
  if (activeSubTab === 'maintenance') {
    if (!user) {
      return (
        <Card>
          <CardContent className="p-6 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="text-muted-foreground">سجّل الدخول لإدارة طابعاتك</p>
          </CardContent>
        </Card>
      );
    }

    if (loadingPrinters) {
      return (
        <div className="space-y-3">
          {[1, 2].map(i => (
            <Skeleton key={i} className="h-32 w-full rounded-xl" />
          ))}
        </div>
      );
    }

    if (!printers || printers.length === 0) {
      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Printer className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-lg">لا توجد طابعات مسجلة</p>
            <p className="text-sm text-muted-foreground mt-2">
              أضف طابعتك للاستفادة من خدمات الصيانة
            </p>
            <Button className="mt-4" onClick={() => toast.info('سيتم فتح نموذج إضافة الطابعة')}>
              إضافة طابعة
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          إدارة طابعاتك وطلبات الصيانة
        </p>
        
        {printers.map((printer: any) => {
          const activeSub = getActiveSub(printer);
          
          return (
            <Card key={printer.id}>
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                    <Printer className="h-6 w-6 text-muted-foreground" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="font-medium">{printer.printer_name || 'طابعة'}</p>
                        <p className="text-xs text-muted-foreground">
                          {printer.serial_number || 'بدون رقم تسلسلي'}
                        </p>
                      </div>
                      {activeSub ? (
                        <Badge className="bg-green-500 shrink-0">
                          <ShieldCheck className="h-3 w-3 ml-1" />
                          محمية
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="shrink-0">غير محمية</Badge>
                      )}
                    </div>

                    {activeSub && (
                      <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                        <p className="text-xs font-medium text-green-700">
                          {activeSub.protection_plans?.name_ar}
                        </p>
                        <p className="text-[10px] text-muted-foreground">
                          متبقي {getDaysRemaining(activeSub.end_date)} يوم
                        </p>
                      </div>
                    )}

                    <div className="flex gap-2 mt-3">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => toast.info('إعدادات الطابعة')}
                      >
                        إعدادات
                      </Button>
                      {activeSub && (
                        <Button 
                          size="sm" 
                          className="flex-1"
                          onClick={() => toast.info('سيتم فتح نموذج طلب الصيانة')}
                        >
                          <Wrench className="h-3.5 w-3.5 ml-1" />
                          طلب صيانة
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return null;

  // Dialogs (moved outside render for cleaner code)
}
