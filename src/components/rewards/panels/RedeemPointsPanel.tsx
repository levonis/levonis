import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Coins, Ticket, Wallet } from "lucide-react";
import { toast } from "sonner";

export default function RedeemPointsPanel() {
  const { user } = useAuth();
  const [selectedOption, setSelectedOption] = useState<'coupon' | 'wallet' | null>(null);

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-redeem', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const redeemOptions = [
    {
      id: 'coupon',
      title: 'تحويل إلى كوبون',
      description: 'احصل على كود خصم لاستخدامه في مشترياتك',
      icon: Ticket,
      rate: '1000 نقطة = 5,000 د.ع خصم',
      color: 'purple'
    },
    {
      id: 'wallet',
      title: 'تحويل إلى المحفظة',
      description: 'أضف رصيد إلى محفظتك مباشرة',
      icon: Wallet,
      rate: '1000 نقطة = 4,000 د.ع رصيد',
      color: 'green'
    }
  ];

  if (!user) {
    return (
      <Card>
        <CardContent className="p-6 text-center">
          <p className="text-muted-foreground mb-4">سجّل الدخول لاستبدال نقاطك</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Current Balance */}
      <Card className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border-amber-500/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-amber-500/20 flex items-center justify-center">
            <Coins className="h-6 w-6 text-amber-500" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">رصيدك المتاح للاستبدال</p>
            <p className="text-2xl font-bold">{(userPoints?.available_points || 0).toLocaleString()} نقطة</p>
          </div>
        </CardContent>
      </Card>

      {/* Redeem Options */}
      <div className="space-y-3">
        <p className="text-sm font-medium">اختر طريقة الاستبدال:</p>
        
        {redeemOptions.map((option) => {
          const Icon = option.icon;
          const isSelected = selectedOption === option.id;
          
          return (
            <Card 
              key={option.id}
              className={`cursor-pointer transition-all ${
                isSelected ? 'ring-2 ring-primary' : 'hover:shadow-md'
              }`}
              onClick={() => setSelectedOption(option.id as 'coupon' | 'wallet')}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-${option.color}-500/10`}>
                    <Icon className={`h-5 w-5 text-${option.color}-500`} />
                  </div>
                  <div className="flex-1">
                    <p className="font-medium">{option.title}</p>
                    <p className="text-xs text-muted-foreground mt-0.5">{option.description}</p>
                    <p className="text-xs text-primary font-medium mt-1">{option.rate}</p>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {selectedOption && (
        <div className="space-y-3 pt-2">
          <div>
            <label className="text-sm font-medium">عدد النقاط للاستبدال</label>
            <Input 
              type="number" 
              placeholder="1000" 
              className="mt-1"
              min={1000}
              step={500}
            />
            <p className="text-xs text-muted-foreground mt-1">
              الحد الأدنى: 1,000 نقطة
            </p>
          </div>
          
          <Button 
            className="w-full"
            onClick={() => toast.success('سيتم تنفيذ الطلب قريباً')}
          >
            تأكيد الاستبدال
          </Button>
        </div>
      )}
    </div>
  );
}
