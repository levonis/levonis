import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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
  Shield, ShieldCheck, Printer, ChevronDown, ChevronUp, 
  Calendar, Clock, Wrench, AlertTriangle, Check, Loader2,
  ArrowUp, Sparkles
} from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { toast } from "sonner";
import { format, differenceInDays } from "date-fns";
import { ar } from "date-fns/locale";
import { useLanguage } from "@/lib/i18n";

interface InsuranceSectionProps {
  activeSubTab: SubTabId;
}

export default function InsuranceSection({ activeSubTab }: InsuranceSectionProps) {
  const { user } = useAuth();
  const { t } = useLanguage();
  const queryClient = useQueryClient();
  const [expandedPrinter, setExpandedPrinter] = useState<string | null>(null);
  const [selectedPlan, setSelectedPlan] = useState<any>(null);
  const [selectedPrinter, setSelectedPrinter] = useState<any>(null);
  const [upgradeDialogOpen, setUpgradeDialogOpen] = useState(false);
  const [subscribeDialogOpen, setSubscribeDialogOpen] = useState(false);

  const { data: printers, isLoading: loadingPrinters } = useQuery({
    queryKey: ['my-printers-with-subs', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          *,
          store_printers:store_printer_id(model_name_ar, serial_number, image_url),
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
    enabled: activeSubTab === 'plans' || activeSubTab === 'status',
    staleTime: 5 * 60 * 1000,
  });

  const { data: walletBalance } = useQuery({
    queryKey: ['wallet-balance-insurance', user?.id],
    queryFn: async () => {
      if (!user) return 0;
      const { data, error } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data?.balance || 0;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const subscribeMutation = useMutation({
    mutationFn: async ({ printerId, planId, price, isUpgrade, currentSubId }: any) => {
      if (!user) throw new Error(t('points_login_required'));

      const { data, error } = await supabase.rpc('purchase_printer_subscription', {
        p_printer_id: printerId,
        p_plan_id: planId,
        p_price: price,
        p_is_upgrade: isUpgrade || false,
        p_current_sub_id: currentSubId || null,
      });

      if (error) throw new Error(error.message);
      return { isUpgrade };
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['my-printers-with-subs'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance-insurance'] });
      queryClient.invalidateQueries({ queryKey: ['wallet'] });
      queryClient.invalidateQueries({ queryKey: ['wallet-balance'] });
      toast.success(data.isUpgrade ? t('insurance_upgrade_success') : t('insurance_subscribe_success'));
      setUpgradeDialogOpen(false);
      setSubscribeDialogOpen(false);
      setSelectedPlan(null);
      setSelectedPrinter(null);
    },
    onError: (error: any) => {
      toast.error(error.message || t('common_error'));
    },
  });

  const getActiveSub = (printer: any) => {
    return printer.printer_subscriptions?.find((s: any) => s.status === 'active');
  };

  const getDaysRemaining = (endDate: string) => {
    return Math.max(0, differenceInDays(new Date(endDate), new Date()));
  };

  const calculateUpgradeDiscount = (currentPlanPrice: number, newPlanPrice: number) => {
    return Math.min(currentPlanPrice, newPlanPrice);
  };

  const validPrinters = printers?.filter((p: any) => p.store_printers?.model_name_ar && p.store_printers.model_name_ar.trim() !== '') || [];

  const renderContent = () => {
    // Status sub-tab
    if (activeSubTab === 'status') {
      if (!user) {
        return (
          <Card>
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="text-muted-foreground">{t('insurance_login_required')}</p>
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

      if (validPrinters.length === 0) {
        return (
          <Card>
            <CardContent className="p-8 text-center">
              <Printer className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
              <p className="font-medium text-lg">{t('insurance_no_printers')}</p>
              <p className="text-sm text-muted-foreground mt-2">
                {t('insurance_no_printers_desc')}
              </p>
              <Button className="mt-4" onClick={() => toast.info(t('insurance_add_printer'))}>
                {t('insurance_add_printer')}
              </Button>
            </CardContent>
          </Card>
        );
      }

      return (
        <div className="space-y-4">
          {validPrinters.map((printer: any) => {
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
                            <p className="font-medium">{printer.store_printers?.model_name_ar || t('insurance_unknown_printer')}</p>
                            <p className="text-xs text-muted-foreground">
                              {printer.store_printers?.serial_number || t('insurance_no_serial')}
                            </p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {activeSub ? (
                            <Badge className="bg-green-500">{t('insurance_protected')}</Badge>
                          ) : (
                            <Badge variant="outline">{t('insurance_not_protected')}</Badge>
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
                          <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20">
                            <div className="flex items-center justify-between mb-2">
                              <span className="font-medium text-green-700">
                                {activeSub.protection_plans?.name_ar}
                              </span>
                              <Badge variant="outline" className="text-green-600 border-green-300">
                                {activeSub.monthly_price?.toLocaleString()} {t('insurance_per_month')}
                              </Badge>
                            </div>
                            <div className="flex items-center gap-4 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <Calendar className="h-3 w-3" />
                                {t('insurance_started')}: {format(new Date(activeSub.start_date), 'dd MMM yyyy', { locale: ar })}
                              </span>
                              <span className="flex items-center gap-1">
                                <Clock className="h-3 w-3" />
                                {t('insurance_remaining')}: {getDaysRemaining(activeSub.end_date)} {t('comp_day')}
                              </span>
                            </div>
                          </div>

                          {plans && plans.filter((p: any) => p.monthly_price > activeSub.monthly_price).length > 0 && (
                            <div className="space-y-2">
                              <p className="text-xs font-medium text-muted-foreground">{t('insurance_upgrade_sub')}</p>
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
                                                {upgradeCost.toLocaleString()} {t('common_iqd')}
                                              </span>
                                              <Badge className="bg-amber-500 text-[9px]">{t('insurance_discount')} {discount.toLocaleString()}</Badge>
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
                                            {t('insurance_upgrade')}
                                          </Button>
                                        </div>
                                      </CardContent>
                                    </Card>
                                  );
                                })}
                              <p className="text-[10px] text-amber-600 flex items-center gap-1">
                                <AlertTriangle className="h-3 w-3" />
                                {t('insurance_upgrade_note')}
                              </p>
                            </div>
                          )}

                          <div className="flex gap-2">
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(t('insurance_settings'))}>
                              {t('insurance_settings')}
                            </Button>
                            <Button size="sm" variant="outline" className="flex-1" onClick={() => toast.info(t('insurance_maintenance_request'))}>
                              <Wrench className="h-3.5 w-3.5 ml-1" />
                              {t('insurance_maintenance_request')}
                            </Button>
                          </div>
                        </>
                      ) : (
                        <>
                          <p className="text-sm text-muted-foreground">
                            {t('insurance_no_protection_desc')}
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
                                      {plan.monthly_price?.toLocaleString()} {t('insurance_per_month')}
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
                                    {t('insurance_subscribe')}
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
              {t('insurance_no_plans')}
            </CardContent>
          </Card>
        );
      }

      return (
        <div className="space-y-4">
          {plans.map((plan: any, index: number) => {
            const features = plan.features as any[] || [];
            const isPopular = index === plans.length - 1;
            
            return (
              <Card 
                key={plan.id}
                className={`overflow-hidden ${isPopular ? 'ring-2 ring-primary/50 shadow-lg' : ''}`}
              >
                {isPopular && (
                  <div className="bg-gradient-to-r from-primary to-primary/80 text-primary-foreground text-xs font-bold px-3 py-1.5 flex items-center gap-1 justify-center">
                    <Sparkles className="h-3 w-3" />
                    {t('insurance_best_value')}
                  </div>
                )}
                <CardContent className="p-4">
                  <div className="flex items-start justify-between mb-3">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-bold text-lg">{plan.name_ar}</h3>
                        {plan.badge_text && (
                          <Badge variant="secondary">{plan.badge_text}</Badge>
                        )}
                      </div>
                      <p className="text-2xl font-bold text-primary mt-1">
                        {plan.monthly_price?.toLocaleString()} <span className="text-sm font-normal text-muted-foreground">{t('insurance_per_month')}</span>
                      </p>
                    </div>
                    <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                      <Shield className="h-6 w-6 text-primary" />
                    </div>
                  </div>

                  {features.length > 0 && (
                    <div className="space-y-2 mt-4">
                      {features.map((feature: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-2 text-sm">
                          <Check className="h-4 w-4 text-green-500 shrink-0" />
                          <span>{typeof feature === 'string' ? feature : feature.text || feature.name_ar}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  <Button className="w-full mt-4" variant={isPopular ? 'default' : 'outline'}>
                    {t('insurance_choose_plan')}
                  </Button>
                </CardContent>
              </Card>
            );
          })}
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
              <p className="text-muted-foreground">{t('insurance_login_maintenance')}</p>
            </CardContent>
          </Card>
        );
      }

      return (
        <Card>
          <CardContent className="p-8 text-center">
            <Wrench className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
            <p className="font-medium text-lg">{t('insurance_maintenance_title')}</p>
            <p className="text-sm text-muted-foreground mt-2">
              {t('insurance_maintenance_desc')}
            </p>
            <Button className="mt-4" onClick={() => toast.info(t('insurance_new_maintenance'))}>
              {t('insurance_new_maintenance')}
            </Button>
          </CardContent>
        </Card>
      );
    }

    return null;
  };

  return (
    <>
      {renderContent()}

      {/* Upgrade Dialog */}
      <AlertDialog open={upgradeDialogOpen} onOpenChange={setUpgradeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('insurance_confirm_upgrade')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlan && selectedPrinter && (
                <div className="space-y-3 mt-3">
                  <p>
                    {t('insurance_confirm_upgrade_desc')
                      .replace('{printer}', selectedPrinter.store_printers?.model_name_ar || t('insurance_unknown_printer'))
                      .replace('{plan}', selectedPlan.name_ar)}
                  </p>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('insurance_cost_after_discount')}</span>
                      <span className="font-bold text-primary text-lg">
                        {selectedPlan.upgradeCost?.toLocaleString()} {t('common_iqd')}
                      </span>
                    </div>
                  </div>
                  <p className="text-xs text-amber-600 flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" />
                    {t('insurance_upgrade_note')}
                  </p>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPlan && selectedPrinter) {
                  subscribeMutation.mutate({
                    printerId: selectedPrinter.id,
                    planId: selectedPlan.id,
                    price: selectedPlan.upgradeCost,
                    isUpgrade: true,
                    currentSubId: selectedPlan.currentSubId,
                  });
                }
              }}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  {t('insurance_upgrading')}
                </>
              ) : (
                t('insurance_confirm_upgrade_action')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Subscribe Dialog */}
      <AlertDialog open={subscribeDialogOpen} onOpenChange={setSubscribeDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('insurance_confirm_subscribe')}</AlertDialogTitle>
            <AlertDialogDescription>
              {selectedPlan && selectedPrinter && (
                <div className="space-y-3 mt-3">
                  <p>
                    {t('insurance_confirm_subscribe_desc')
                      .replace('{plan}', selectedPlan.name_ar)
                      .replace('{printer}', selectedPrinter.store_printers?.model_name_ar || t('insurance_unknown_printer'))}
                  </p>
                  <div className="p-3 rounded-lg bg-muted">
                    <div className="flex items-center justify-between text-sm">
                      <span>{t('insurance_monthly_cost')}</span>
                      <span className="font-bold text-primary text-lg">
                        {selectedPlan.monthly_price?.toLocaleString()} {t('common_iqd')}
                      </span>
                    </div>
                  </div>
                </div>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t('common_cancel')}</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (selectedPlan && selectedPrinter) {
                  subscribeMutation.mutate({
                    printerId: selectedPrinter.id,
                    planId: selectedPlan.id,
                    price: selectedPlan.monthly_price,
                    isUpgrade: false,
                    currentSubId: null,
                  });
                }
              }}
              disabled={subscribeMutation.isPending}
            >
              {subscribeMutation.isPending ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin ml-2" />
                  {t('insurance_subscribing')}
                </>
              ) : (
                t('insurance_confirm_subscribe_action')
              )}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
