import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { Loader2, Shield, Calendar, Wrench, Package, Clock, ChevronLeft, Printer, ShieldCheck, AlertTriangle } from 'lucide-react';
import { format, differenceInDays, differenceInCalendarDays } from 'date-fns';
import { ar } from 'date-fns/locale';
import Footer from '@/components/Footer';

const WarrantyDashboard = () => {
  const { printerId } = useParams<{ printerId: string }>();
  const { user, loading: authLoading } = useAuth();
  const navigate = useNavigate();

  const { data: printer, isLoading } = useQuery({
    queryKey: ['warranty-dashboard', printerId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_printers')
        .select('*')
        .eq('id', printerId!)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!printerId && !!user,
  });

  // Fetch active subscription for this printer
  const { data: subscription } = useQuery({
    queryKey: ['warranty-subscription', printerId],
    queryFn: async () => {
      const { data: userPrinter } = await supabase
        .from('user_printers')
        .select('id')
        .eq('store_printer_id', printerId!)
        .eq('user_id', user!.id)
        .maybeSingle();

      if (!userPrinter) return null;

      const { data } = await supabase
        .from('printer_subscriptions')
        .select('*, protection_plans(*)')
        .eq('user_printer_id', userPrinter.id)
        .in('status', ['active', 'paused'])
        .maybeSingle();

      return data;
    },
    enabled: !!printerId && !!user,
  });

  if (authLoading || isLoading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!printer || printer.buyer_user_id !== user?.id) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4" dir="rtl">
        <Card className="max-w-md w-full">
          <CardContent className="p-8 text-center">
            <AlertTriangle className="w-16 h-16 mx-auto text-destructive mb-4" />
            <p className="font-medium">لا يمكن الوصول إلى هذه الطابعة</p>
            <Button variant="outline" className="mt-4" onClick={() => navigate('/rewards')}>العودة</Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  const now = new Date();
  const activationDate = printer.activation_date ? new Date(printer.activation_date) : now;
  const expiryDate = printer.expiry_date ? new Date(printer.expiry_date) : now;
  const totalDays = differenceInCalendarDays(expiryDate, activationDate);
  const daysRemaining = Math.max(0, differenceInCalendarDays(expiryDate, now));
  const daysUsed = totalDays - daysRemaining;
  const progressPercent = totalDays > 0 ? Math.min(100, (daysUsed / totalDays) * 100) : 100;
  const isExpired = daysRemaining <= 0;
  const isExpiringSoon = daysRemaining > 0 && daysRemaining <= 15;

  const plan = subscription?.protection_plans as any;

  return (
    <div className="min-h-screen bg-background" dir="rtl">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-4">
        {/* Back Button */}
        <Button variant="ghost" size="sm" onClick={() => navigate('/rewards')} className="gap-1">
          <ChevronLeft className="w-4 h-4" />
          العودة
        </Button>

        {/* Printer Header */}
        <Card className="overflow-hidden">
          <div className="bg-gradient-to-l from-primary/10 to-primary/5 p-6">
            <div className="flex items-center gap-4">
              {printer.image_url ? (
                <img src={printer.image_url} className="w-16 h-16 rounded-xl object-cover border bg-white" alt="" />
              ) : (
                <div className="w-16 h-16 rounded-xl bg-card flex items-center justify-center">
                  <Printer className="w-8 h-8 text-muted-foreground" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-bold">{printer.model_name_ar}</h1>
                <p className="text-xs text-muted-foreground font-mono" dir="ltr">{printer.serial_number}</p>
                <Badge className={`mt-1 ${isExpired ? 'bg-destructive/20 text-destructive' : 'bg-green-500/20 text-green-600'}`}>
                  {isExpired ? (
                    <><AlertTriangle className="w-3 h-3 ml-1" />منتهي الضمان</>
                  ) : (
                    <><ShieldCheck className="w-3 h-3 ml-1" />ضمان نشط</>
                  )}
                </Badge>
              </div>
            </div>
          </div>
        </Card>

        {/* Warranty Progress */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-base flex items-center gap-2">
              <Shield className="w-4 h-4 text-primary" />
              حالة الضمان
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">المتبقي</span>
                <span className={`font-bold ${isExpiringSoon ? 'text-amber-500' : isExpired ? 'text-destructive' : 'text-green-600'}`}>
                  {isExpired ? 'منتهي' : `${daysRemaining} يوم`}
                </span>
              </div>
              <Progress value={progressPercent} className="h-2.5" />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>بدأ: {format(activationDate, 'dd MMM yyyy', { locale: ar })}</span>
                <span>ينتهي: {format(expiryDate, 'dd MMM yyyy', { locale: ar })}</span>
              </div>
            </div>

            {isExpiringSoon && !isExpired && (
              <div className="p-3 rounded-lg bg-amber-500/10 border border-amber-500/20 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
                <span>ضمانك سينتهي قريباً! قم بالترقية للحفاظ على حماية طابعتك.</span>
              </div>
            )}

            {isExpired && (
              <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-sm flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-destructive shrink-0" />
                <span>انتهى ضمانك. اشترك في باقة حماية للاستفادة من المزايا.</span>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Current Plan */}
        {plan && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base flex items-center gap-2">
                <ShieldCheck className="w-4 h-4 text-primary" />
                الباقة الحالية
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="p-3 rounded-lg bg-primary/5 border border-primary/20">
                <div className="flex items-center justify-between mb-2">
                  <span className="font-bold">{plan.name_ar}</span>
                  <Badge>{plan.plan_type}</Badge>
                </div>
                <div className="grid grid-cols-2 gap-2 text-xs text-muted-foreground">
                  <div>خصم الصيانة: <span className="text-foreground font-medium">{plan.maintenance_discount_percentage}%</span></div>
                  <div>خصم قطع الغيار: <span className="text-foreground font-medium">{plan.parts_discount_percentage}%</span></div>
                  <div>طلبات/شهر: <span className="text-foreground font-medium">{plan.max_service_requests_per_month}</span></div>
                  <div>السعر: <span className="text-foreground font-medium">{subscription?.monthly_price?.toLocaleString()} د.ع</span></div>
                </div>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Quick Actions */}
        <div className="grid grid-cols-2 gap-3">
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/rewards')}
          >
            <Wrench className="w-5 h-5 text-primary" />
            <span className="text-xs">طلب صيانة</span>
          </Button>
          <Button
            variant="outline"
            className="h-auto py-4 flex-col gap-2"
            onClick={() => navigate('/rewards')}
          >
            <Package className="w-5 h-5 text-primary" />
            <span className="text-xs">خصومات قطع الغيار</span>
          </Button>
          {(isExpired || isExpiringSoon) && (
            <Button
              className="h-auto py-4 flex-col gap-2 col-span-2"
              onClick={() => navigate('/rewards')}
            >
              <Shield className="w-5 h-5" />
              <span className="text-xs">{isExpired ? 'اشترك في باقة حماية' : 'ترقية أو تجديد'}</span>
            </Button>
          )}
        </div>

        {/* Info */}
        <Card>
          <CardContent className="p-4">
            <div className="space-y-2 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>رقم تسلسلي:</span>
                <span className="font-mono" dir="ltr">{printer.serial_number}</span>
              </div>
              <div className="flex justify-between">
                <span>تاريخ التفعيل:</span>
                <span>{format(activationDate, 'dd/MM/yyyy')}</span>
              </div>
              <div className="flex justify-between">
                <span>مدة الضمان:</span>
                <span>{printer.warranty_months} شهر</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
      <Footer />
    </div>
  );
};

export default WarrantyDashboard;
