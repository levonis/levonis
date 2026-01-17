import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Wrench } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";
import { LevelCardSkeleton } from "./SkeletonLoaders";
import AllPlansPanel from "./panels/AllPlansPanel";
import MyPrintersPanel from "./panels/MyPrintersPanel";

interface InsuranceSectionProps {
  activeSubTab: SubTabId;
}

export default function InsuranceSection({ activeSubTab }: InsuranceSectionProps) {
  const { user } = useAuth();

  // Only fetch when status tab is active
  const { data: subscriptions, isLoading: loadingSubs } = useQuery({
    queryKey: ['my-printer-subscriptions', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('printer_subscriptions')
        .select(`
          id, 
          status, 
          monthly_price,
          protection_plans(name_ar, plan_type),
          user_printers(id)
        `)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user && activeSubTab === 'status',
    staleTime: 5 * 60 * 1000,
  });

  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];

  // Status sub-tab
  if (activeSubTab === 'status') {
    return (
      <div className="space-y-4">
        {!user ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground">سجّل الدخول لعرض حالة التأمين</p>
            </CardContent>
          </Card>
        ) : loadingSubs ? (
          <LevelCardSkeleton />
        ) : activeSubscriptions.length > 0 ? (
          <div className="space-y-3">
            {activeSubscriptions.map((sub: any) => (
              <Card key={sub.id} className="border-green-500/20 bg-green-500/5">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/20 flex items-center justify-center">
                        <ShieldCheck className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <p className="font-medium">{sub.protection_plans?.name_ar}</p>
                        <p className="text-xs text-muted-foreground">
                          {sub.monthly_price?.toLocaleString()} د.ع/شهر
                        </p>
                      </div>
                    </div>
                    <Badge className="bg-green-500">نشط</Badge>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-2">لا توجد اشتراكات نشطة</p>
              <p className="text-sm text-muted-foreground">
                احمِ طابعاتك مع باقات الحماية
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Plans sub-tab - Show all plans inline
  if (activeSubTab === 'plans') {
    return <AllPlansPanel />;
  }

  // Maintenance sub-tab - Show printers management inline
  if (activeSubTab === 'maintenance') {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">
          إدارة طابعاتك وطلبات الصيانة
        </p>
        <MyPrintersPanel />
      </div>
    );
  }

  return null;
}
