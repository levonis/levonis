import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Printer, Settings, ShieldCheck, Wrench, AlertTriangle, Shield, Link2, Link2Off, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { Link, useNavigate } from "react-router-dom";
import { useLanguage } from "@/lib/i18n";
import { useNumberFormat } from "@/lib/i18n/numberFormat";

export default function MyPrintersPanel() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const { fmt } = useNumberFormat();
  const navigate = useNavigate();

  const { data: printers, isLoading } = useQuery({
    queryKey: ['my-printers-panel', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_printers')
        .select(`
          *,
          store_printers:store_printer_id(model_name_ar, serial_number, image_url, expiry_date, activation_date),
          printer_subscriptions(
            id, 
            status, 
            monthly_price,
            protection_plans(name_ar, plan_type)
          )
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground">{t('mp_login_required')}</p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2].map(i => (
          <Skeleton key={i} className="h-32 w-full" />
        ))}
      </div>
    );
  }

  if (!printers || printers.length === 0) {
    return (
      <Card>
        <CardContent className="p-8 text-center">
          <Printer className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
          <p className="font-medium text-lg">{t('mp_no_printers')}</p>
          <p className="text-sm text-muted-foreground mt-2">
            {t('mp_no_printers_desc')}
          </p>
          <Button className="mt-4" onClick={() => toast.info(t('mp_add_printer_form'))}>
            {t('mp_add_printer')}
          </Button>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {printers.map((printer: any) => {
        const activeSub = printer.printer_subscriptions?.find((s: any) => s.status === 'active');
        const expiryDate = printer.store_printers?.expiry_date ? new Date(printer.store_printers.expiry_date) : null;
        const isExpired = !!expiryDate && expiryDate.getTime() <= Date.now();
        const showExpiredBanner = isExpired && !activeSub;

        return (
          <Card key={printer.id} className={showExpiredBanner ? 'border-destructive/40' : undefined}>
            <CardContent className="p-4">
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center shrink-0">
                  <Printer className="h-6 w-6 text-muted-foreground" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <p className="font-medium">{printer.store_printers?.model_name_ar || t('mp_unknown_printer')}</p>
                      <p className="text-xs text-muted-foreground">
                        {printer.store_printers?.serial_number || t('mp_no_serial')}
                      </p>
                    </div>
                    {activeSub ? (
                      <Badge className="bg-green-500 shrink-0">
                        <ShieldCheck className="h-3 w-3 ml-1" />
                        {t('mp_protected')}
                      </Badge>
                    ) : isExpired ? (
                      <Badge className="bg-destructive shrink-0">
                        <AlertTriangle className="h-3 w-3 ml-1" />
                        {t('warranty_expired_short_badge')}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="shrink-0">{t('mp_unprotected')}</Badge>
                    )}
                  </div>

                  {activeSub && (
                    <div className="mt-2 p-2 rounded-lg bg-green-500/10 border border-green-500/20">
                      <p className="text-xs font-medium text-green-700">
                        {activeSub.protection_plans?.name_ar}
                      </p>
                      <p className="text-[10px] text-muted-foreground">
                        {fmt(activeSub.monthly_price ?? 0)} {t('mp_per_month')}
                      </p>
                    </div>
                  )}

                  {showExpiredBanner && (
                    <div className="mt-2 p-3 rounded-lg bg-destructive/10 border border-destructive/30 space-y-2">
                      <p className="text-xs text-foreground leading-relaxed">
                        {t('warranty_expired_panel_desc')}
                      </p>
                      <Button
                        size="sm"
                        className="w-full bg-destructive hover:bg-destructive/90"
                        onClick={() => navigate('/rewards')}
                      >
                        <Shield className="h-3.5 w-3.5 ml-1" />
                        {t('warranty_expired_cta')}
                      </Button>
                    </div>
                  )}

                  <div className="flex gap-2 mt-3">
                    <Button 
                      size="sm" 
                      variant="outline" 
                      className="flex-1"
                      onClick={() => toast.info(t('mp_settings_action'))}
                    >
                      <Settings className="h-3.5 w-3.5 ml-1" />
                      {t('mp_settings')}
                    </Button>
                    {activeSub && (
                      <Button 
                        size="sm" 
                        variant="outline" 
                        className="flex-1"
                        onClick={() => toast.info(t('mp_maintenance_action'))}
                      >
                        <Wrench className="h-3.5 w-3.5 ml-1" />
                        {t('mp_maintenance')}
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
