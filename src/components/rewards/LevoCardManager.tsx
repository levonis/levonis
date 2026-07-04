import { useState } from 'react';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { CreditCard, Trash2, Eye, EyeOff, ArrowUpCircle, Loader2, Calendar, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useNumberFormat } from '@/lib/i18n/numberFormat';
import SubscriptionDurationDialog from '@/components/subscriptions/SubscriptionDurationDialog';

interface Assignment {
  id: string; card_id: string; user_id: string;
  assigned_at: string; released_at: string | null;
  levo_physical_cards: { card_number: string; card_number_last4: string };
}
interface Subscription {
  id: string; assignment_id: string; membership_card_id: string;
  started_at: string; expires_at: string; status: string;
  paid_amount: number;
  membership_cards: { id: string; name_ar: string; card_key: string; display_order: number; wallet_price: number; duration_days: number; color: string | null };
}
interface Plan {
  id: string; name_ar: string; card_key: string; display_order: number;
  wallet_price: number; duration_days: number; color: string | null;
}

export default function LevoCardManager() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const { fmt } = useNumberFormat();
  const [showFull, setShowFull] = useState(false);
  const [subOpen, setSubOpen] = useState(false);
  const [upgradeOpen, setUpgradeOpen] = useState(false);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [upgradeQuote, setUpgradeQuote] = useState<any>(null);
  const [durationOpen, setDurationOpen] = useState(false);
  const [durationPlan, setDurationPlan] = useState<Plan | null>(null);

  const { data: myCard, isLoading } = useQuery({
    queryKey: ['levo-card-my', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data: a, error } = await supabase
        .from('levo_card_assignments' as any)
        .select('*, levo_physical_cards:card_id(card_number, card_number_last4)')
        .eq('user_id', user!.id)
        .is('released_at', null)
        .maybeSingle();
      if (error && (error as any).code !== 'PGRST116') throw error;
      if (!a) return null;
      const { data: sub } = await supabase
        .from('levo_card_subscriptions' as any)
        .select('*, membership_cards:membership_card_id(id, name_ar, card_key, display_order, wallet_price, duration_days, color)')
        .eq('assignment_id', (a as any).id)
        .eq('status', 'active')
        .maybeSingle();
      return { assignment: a as any as Assignment, subscription: (sub as any) as Subscription | null };
    },
    staleTime: 30_000,
  });

  const { data: plans } = useQuery<Plan[]>({
    queryKey: ['levo-membership-plans'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('id, name_ar, card_key, display_order, wallet_price, duration_days, color, is_purchasable, is_active')
        .eq('is_active', true)
        .eq('is_purchasable', true)
        .order('display_order');
      if (error) throw error;
      return (data || []) as any;
    },
    staleTime: 5 * 60 * 1000,
  });

  if (!user || isLoading || !myCard) return null;

  const { assignment, subscription } = myCard;
  const displayNumber = showFull
    ? assignment.levo_physical_cards.card_number.replace(/(.{4})/g, '$1 ').trim()
    : `•••• •••• •••• ${assignment.levo_physical_cards.card_number_last4}`;

  const daysRemaining = subscription
    ? Math.max(0, Math.ceil((new Date(subscription.expires_at).getTime() - Date.now()) / 86400000))
    : 0;

  const currentOrder = subscription?.membership_cards?.display_order ?? 0;
  const upgradablePlans = (plans || []).filter(p => p.display_order > currentOrder);
  const subscribablePlans = subscription ? [] : (plans || []);

  const releaseCard = async () => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('levo_release_card', { p_assignment_id: assignment.id });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      toast.success('تم حذف البطاقة من حسابك');
      qc.invalidateQueries({ queryKey: ['levo-card-my'] });
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
    } catch (e: any) { toast.error(e?.message || 'فشل الحذف'); }
    finally { setBusy(false); }
  };

  const subscribe = async (planId: string, price: number, durationMonths: number, discountPercent: number) => {
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('levo_subscribe_card', {
        p_assignment_id: assignment.id,
        p_membership_card_id: planId,
        p_payment_method: 'wallet',
        p_amount: price,
        p_duration_months: durationMonths,
        p_discount_percentage: discountPercent,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      toast.success('تم تفعيل الاشتراك');
      setSubOpen(false);
      setDurationOpen(false);
      setDurationPlan(null);
      qc.invalidateQueries({ queryKey: ['levo-card-my'] });
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
    } catch (e: any) { toast.error(e?.message || 'فشل الاشتراك'); }
    finally { setBusy(false); }
  };

  const openDurationDialog = (plan: Plan) => {
    setDurationPlan(plan);
    setDurationOpen(true);
  };

  const openUpgrade = async (planId: string) => {
    setSelectedPlanId(planId);
    setUpgradeQuote(null);
    try {
      const { data, error } = await (supabase as any).rpc('levo_upgrade_quote', {
        p_assignment_id: assignment.id, p_new_plan_id: planId,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      setUpgradeQuote(data);
      setUpgradeOpen(true);
    } catch (e: any) { toast.error(e?.message || 'فشل حساب السعر'); }
  };

  const confirmUpgrade = async () => {
    if (!selectedPlanId || !upgradeQuote) return;
    setBusy(true);
    try {
      const { data, error } = await (supabase as any).rpc('levo_upgrade_subscription', {
        p_assignment_id: assignment.id,
        p_new_plan_id: selectedPlanId,
        p_payment_method: 'wallet',
        p_amount_paid: upgradeQuote.amount_due,
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      toast.success('تمت الترقية بنجاح');
      setUpgradeOpen(false);
      setSubOpen(false);
      qc.invalidateQueries({ queryKey: ['levo-card-my'] });
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
    } catch (e: any) { toast.error(e?.message || 'فشل الترقية'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <Card className="overflow-hidden border-primary/30 bg-gradient-to-br from-primary/5 to-transparent">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <CreditCard className="h-4 w-4 text-primary" />
              <span className="text-sm font-semibold">بطاقتي</span>
            </div>
            {subscription && (
              <Badge variant="secondary" className="text-[10px]">
                {subscription.membership_cards.name_ar}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between p-3 rounded-lg bg-background/80 border">
            <code className="text-base font-mono tracking-widest">{displayNumber}</code>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setShowFull(v => !v)}>
              {showFull ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
            </Button>
          </div>

          {subscription ? (
            <div className="grid grid-cols-2 gap-2 text-xs">
              <div className="p-2 rounded-md bg-muted/50">
                <div className="text-muted-foreground">بدأ</div>
                <div className="font-medium">{new Date(subscription.started_at).toLocaleDateString('ar')}</div>
              </div>
              <div className="p-2 rounded-md bg-muted/50">
                <div className="text-muted-foreground">متبقي</div>
                <div className="font-medium">{daysRemaining} يوم</div>
              </div>
            </div>
          ) : (
            <div className="p-3 rounded-md bg-amber-500/10 border border-amber-500/30 text-xs text-amber-700 dark:text-amber-300">
              لا يوجد اشتراك نشط على هذه البطاقة. اختر خطة للبدء.
            </div>
          )}

          <div className="flex gap-2">
            {subscription ? (
              <Button
                size="sm" className="flex-1"
                onClick={() => setSubOpen(true)}
                disabled={upgradablePlans.length === 0}
              >
                <ArrowUpCircle className="h-4 w-4 ml-1" /> ترقية
              </Button>
            ) : (
              <Button size="sm" className="flex-1" onClick={() => setSubOpen(true)}>
                <Sparkles className="h-4 w-4 ml-1" /> اختر اشتراك
              </Button>
            )}

            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button size="sm" variant="outline" className="text-destructive" disabled={busy}>
                  <Trash2 className="h-4 w-4 ml-1" /> حذف البطاقة
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>حذف البطاقة من حسابك</AlertDialogTitle>
                  <AlertDialogDescription>
                    سيتم إلغاء الاشتراك الحالي بدون استرداد المبلغ، وستتحرر البطاقة لتفعيلها على حساب آخر.
                    هل أنت متأكد؟
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>إلغاء</AlertDialogCancel>
                  <AlertDialogAction onClick={releaseCard} className="bg-destructive text-destructive-foreground">
                    حذف
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </CardContent>
      </Card>

      {/* Subscribe / Upgrade plans dialog */}
      <Dialog open={subOpen} onOpenChange={setSubOpen}>
        <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
          <DialogHeader>
            <DialogTitle>{subscription ? 'ترقية الاشتراك' : 'اختر اشتراكاً'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-2 overflow-y-auto max-h-[70vh] px-1">
            {(subscription ? upgradablePlans : subscribablePlans).length === 0 && (
              <div className="text-center py-6 text-sm text-muted-foreground">
                {subscription ? 'أنت على أعلى خطة متاحة' : 'لا توجد خطط متاحة'}
              </div>
            )}
            {(subscription ? upgradablePlans : subscribablePlans).map(plan => (
              <button
                key={plan.id}
                onClick={() => subscription ? openUpgrade(plan.id) : openDurationDialog(plan)}
                disabled={busy}
                className="w-full text-right p-3 rounded-lg border hover:bg-muted/40 transition-colors flex items-center justify-between"
              >
                <div>
                  <div className="font-semibold">{plan.name_ar}</div>
                  <div className="text-xs text-muted-foreground">{plan.duration_days} يوم</div>
                </div>
                <Badge variant="outline">{fmt(plan.wallet_price || 0)} د.ع</Badge>
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>

      {/* Upgrade confirmation dialog with prorated math */}
      <Dialog open={upgradeOpen} onOpenChange={setUpgradeOpen}>
        <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
          <DialogHeader><DialogTitle>تأكيد الترقية</DialogTitle></DialogHeader>
          {upgradeQuote && (
            <div className="space-y-2 text-sm">
              <div className="flex justify-between p-2 rounded bg-muted/40">
                <span className="text-muted-foreground">أيام مستهلكة</span>
                <span>{upgradeQuote.days_used}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/40">
                <span className="text-muted-foreground">أيام متبقية</span>
                <span>{upgradeQuote.days_remaining}</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-muted/40">
                <span className="text-muted-foreground">سعر الخطة الجديدة</span>
                <span>{fmt(upgradeQuote.new_price)} د.ع</span>
              </div>
              <div className="flex justify-between p-2 rounded bg-emerald-500/10 border border-emerald-500/30">
                <span className="text-emerald-700 dark:text-emerald-300">خصم رصيد الأيام</span>
                <span className="text-emerald-700 dark:text-emerald-300">−{fmt(upgradeQuote.credit)} د.ع</span>
              </div>
              <div className="flex justify-between p-3 rounded-lg bg-primary/10 border border-primary/30 font-bold">
                <span>المبلغ المستحق</span>
                <span>{fmt(upgradeQuote.amount_due)} د.ع</span>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setUpgradeOpen(false)}>إلغاء</Button>
            <Button onClick={confirmUpgrade} disabled={busy}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الترقية'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Duration selection dialog (initial subscription) */}
      {durationPlan && (
        <SubscriptionDurationDialog
          open={durationOpen}
          onOpenChange={(v) => { setDurationOpen(v); if (!v) setDurationPlan(null); }}
          targetType="card"
          title={durationPlan.name_ar}
          monthlyPrice={durationPlan.wallet_price || 0}
          confirming={busy}
          onConfirm={async ({ tier, quote }) => {
            await subscribe(durationPlan.id, quote.final, tier.duration_months, tier.discount_percentage);
          }}
        />
      )}
    </>
  );
}
