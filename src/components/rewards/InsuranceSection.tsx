import { useNavigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Shield, ShieldCheck, Printer, Wrench, ArrowLeft, Loader2 } from "lucide-react";
import { SubTabId } from "./RewardsSubTabs";

interface InsuranceSectionProps {
  activeSubTab: SubTabId;
}

export default function InsuranceSection({ activeSubTab }: InsuranceSectionProps) {
  const navigate = useNavigate();
  const { user } = useAuth();

  // Fetch user's subscriptions
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
    enabled: !!user,
  });

  // Fetch protection plans
  const { data: plans, isLoading: loadingPlans } = useQuery({
    queryKey: ['protection-plans-preview'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('protection_plans')
        .select('id, name_ar, plan_type, monthly_price, badge_text')
        .eq('is_active', true)
        .order('display_order', { ascending: true })
        .limit(3);
      if (error) throw error;
      return data;
    },
  });

  const activeSubscriptions = subscriptions?.filter(s => s.status === 'active') || [];

  // Status sub-tab
  if (activeSubTab === 'status') {
    return (
      <div className="space-y-4">
        {!user ? (
          <Card>
            <CardContent className="p-6 text-center">
              <p className="text-muted-foreground mb-4">سجّل الدخول لعرض حالة التأمين</p>
              <Button onClick={() => navigate('/auth')}>تسجيل الدخول</Button>
            </CardContent>
          </Card>
        ) : loadingSubs ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
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
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/my-printers')}
            >
              إدارة الاشتراكات
              <ArrowLeft className="h-4 w-4 mr-1" />
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center">
              <Shield className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
              <p className="font-medium mb-2">لا توجد اشتراكات نشطة</p>
              <p className="text-sm text-muted-foreground mb-4">
                احمِ طابعاتك مع باقات الحماية
              </p>
              <Button onClick={() => navigate('/printer-protection')}>
                استكشف الباقات
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Plans sub-tab
  if (activeSubTab === 'plans') {
    return (
      <div className="space-y-4">
        {loadingPlans ? (
          <div className="flex justify-center py-8">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        ) : plans && plans.length > 0 ? (
          <div className="space-y-3">
            {plans.map((plan) => (
              <Card 
                key={plan.id} 
                className="cursor-pointer hover:shadow-md transition-shadow"
                onClick={() => navigate('/printer-protection')}
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-green-500/10 flex items-center justify-center">
                        <Shield className="h-5 w-5 text-green-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium">{plan.name_ar}</p>
                          {plan.badge_text && (
                            <Badge variant="secondary" className="text-[9px]">
                              {plan.badge_text}
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-primary font-bold">
                          {plan.monthly_price?.toLocaleString()} د.ع/شهر
                        </p>
                      </div>
                    </div>
                    <ArrowLeft className="h-4 w-4 text-muted-foreground" />
                  </div>
                </CardContent>
              </Card>
            ))}
            
            <Button 
              variant="outline" 
              className="w-full"
              onClick={() => navigate('/printer-protection')}
            >
              مقارنة جميع الباقات
            </Button>
          </div>
        ) : (
          <Card>
            <CardContent className="p-6 text-center text-muted-foreground">
              لا توجد باقات متاحة حالياً
            </CardContent>
          </Card>
        )}
      </div>
    );
  }

  // Maintenance sub-tab
  if (activeSubTab === 'maintenance') {
    return (
      <div className="space-y-4">
        <Card>
          <CardContent className="p-6 text-center">
            <Wrench className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
            <p className="font-medium mb-2">الصيانة والاستبدال</p>
            <p className="text-sm text-muted-foreground mb-4">
              إدارة طلبات الصيانة واستبدال الطابعات
            </p>
            <Button variant="outline" onClick={() => navigate('/my-printers')}>
              إدارة طابعاتي
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return null;
}
