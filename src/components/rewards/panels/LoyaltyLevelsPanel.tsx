import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CreditCard, Loader2, Clock, ShoppingCart, Sparkles } from "lucide-react";
import { toast } from "sonner";
import UserLoyaltyCard from "@/components/UserLoyaltyCard";
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

export default function LoyaltyLevelsPanel() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [purchaseDialogOpen, setPurchaseDialogOpen] = useState(false);
  const [selectedLevel, setSelectedLevel] = useState<any>(null);

  const { data: userPoints } = useQuery({
    queryKey: ['user-points-levels', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_points')
        .select('total_points, available_points')
        .eq('user_id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 5 * 60 * 1000,
  });

  const { data: userCard } = useQuery({
    queryKey: ['user-active-card', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('user_cards')
        .select(`
          *,
          loyalty_levels:level_id(*)
        `)
        .eq('user_id', user.id)
        .eq('is_active', true)
        .gt('expires_at', new Date().toISOString())
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 2 * 60 * 1000,
  });

  const { data: userProfile } = useQuery({
    queryKey: ['user-profile-name-panel', user?.id],
    queryFn: async () => {
      if (!user) return null;
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, username')
        .eq('id', user.id)
        .maybeSingle();
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!user,
    staleTime: 10 * 60 * 1000,
  });

  const { data: levels, isLoading } = useQuery({
    queryKey: ['all-loyalty-levels-panel'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('loyalty_levels')
        .select('*')
        .order('display_order', { ascending: true });
      if (error) throw error;
      return data;
    },
    staleTime: 5 * 60 * 1000,
  });

  const purchaseCardMutation = useMutation({
    mutationFn: async (level: any) => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      
      const availablePoints = userPoints?.available_points || 0;
      if (availablePoints < level.purchase_price_points) {
        throw new Error('نقاطك غير كافية لشراء هذه البطاقة');
      }

      // Deduct points
      const { error: pointsError } = await supabase
        .from('user_points')
        .update({
          available_points: availablePoints - level.purchase_price_points,
        })
        .eq('user_id', user.id);
      if (pointsError) throw pointsError;

      // Add points transaction
      const { error: transError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id,
          points: -level.purchase_price_points,
          type: 'spent',
          source: 'card_purchase',
          description: `شراء بطاقة ${level.name_ar}`,
          related_id: level.id,
        });
      if (transError) throw transError;

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (level.duration_days || 30));

      // Create user card
      const { error: cardError } = await supabase
        .from('user_cards')
        .insert({
          user_id: user.id,
          level_id: level.id,
          expires_at: expiresAt.toISOString(),
          points_paid: level.purchase_price_points,
        });
      if (cardError) throw cardError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-active-card'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-levels'] });
      toast.success('تم شراء البطاقة بنجاح! 🎉');
      setPurchaseDialogOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const handlePurchaseClick = (level: any) => {
    setSelectedLevel(level);
    setPurchaseDialogOpen(true);
  };

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map(i => (
          <Skeleton key={i} className="h-28 w-full" />
        ))}
      </div>
    );
  }

  const availablePoints = userPoints?.available_points || 0;
  const currentCardLevel = userCard?.loyalty_levels;
  const daysRemaining = userCard ? Math.max(0, Math.ceil((new Date(userCard.expires_at).getTime() - Date.now()) / (1000 * 60 * 60 * 24))) : 0;
  const userName = userProfile?.full_name || userProfile?.username || '';

  return (
    <div className="space-y-4">
      {/* Current Card Status - Professional Design */}
      {userCard && currentCardLevel && (
        <div className="space-y-2">
          <h3 className="text-sm font-semibold text-muted-foreground">بطاقتك الحالية</h3>
          <UserLoyaltyCard
            level={{
              id: currentCardLevel.id,
              name_ar: currentCardLevel.name_ar,
              name_en: currentCardLevel.name_en,
              color: currentCardLevel.color,
              discount_percentage: currentCardLevel.discount_percentage,
              bonus_points_percentage: currentCardLevel.bonus_points_percentage,
              free_shipping: currentCardLevel.free_shipping,
              free_shipping_min_order: currentCardLevel.free_shipping_min_order,
              duration_days: currentCardLevel.duration_days,
              vip_support: currentCardLevel.vip_support,
              priority_shipping: currentCardLevel.priority_shipping,
              early_access: currentCardLevel.early_access,
              exclusive_products: currentCardLevel.exclusive_products,
              special_name_style: currentCardLevel.special_name_style as any,
              profile_effects: currentCardLevel.profile_effects as any,
              benefits: currentCardLevel.benefits as any,
            }}
            userName={userName}
            expiresAt={userCard.expires_at}
            isActive={true}
            showDetails={false}
          />
        </div>
      )}

      {/* Available Cards */}
      <div className="space-y-3">
        <h3 className="text-sm font-semibold text-muted-foreground">البطاقات المتاحة</h3>
        {levels?.map((level) => {
          const isCurrentCard = currentCardLevel?.id === level.id;
          const canPurchase = level.is_purchasable && availablePoints >= (level.purchase_price_points || 0);
          const isPurchasable = level.is_purchasable;
          
          return (
            <Card 
              key={level.id}
              className={`transition-all ${isCurrentCard ? 'ring-2 opacity-60' : ''}`}
              style={{ 
                borderColor: level.color + '40',
                ...(isCurrentCard && { '--tw-ring-color': level.color } as any)
              }}
            >
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <div 
                    className="w-12 h-12 rounded-full flex items-center justify-center shrink-0"
                    style={{ backgroundColor: level.color + '20' }}
                  >
                    <CreditCard className="h-6 w-6" style={{ color: level.color }} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-bold" style={{ color: level.color }}>
                        {level.name_ar}
                      </p>
                      {isCurrentCard && (
                        <Badge variant="outline" className="text-[9px]">
                          بطاقتك الحالية
                        </Badge>
                      )}
                    </div>
                    
                    {/* Price/Points requirement */}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {isPurchasable ? (
                        <span className="flex items-center gap-1">
                          <ShoppingCart className="h-3 w-3" />
                          {(level.purchase_price_points || 0).toLocaleString()} نقطة
                        </span>
                      ) : (
                        <span>يتطلب {(level.min_points || 0).toLocaleString()} نقطة</span>
                      )}
                    </p>
                    
                    {/* Duration */}
                    <p className="text-[10px] text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Clock className="h-3 w-3" />
                      صالحة لمدة {level.duration_days || 30} يوم
                    </p>
                    
                    {/* Benefits */}
                    <div className="mt-2 space-y-1">
                      {level.discount_percentage && level.discount_percentage > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>خصم {level.discount_percentage}%</span>
                        </div>
                      )}
                      {level.bonus_points_percentage && level.bonus_points_percentage > 0 && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>نقاط إضافية {level.bonus_points_percentage}%</span>
                        </div>
                      )}
                      {level.free_shipping && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Check className="h-3 w-3 text-green-500" />
                          <span>
                            شحن مجاني
                            {level.free_shipping_min_order && level.free_shipping_min_order > 0 && ` (طلبات أكثر من ${level.free_shipping_min_order.toLocaleString()} د.ع)`}
                          </span>
                        </div>
                      )}
                      {level.vip_support && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>دعم عملاء VIP مميز</span>
                        </div>
                      )}
                      {level.card_discounts_enabled && (
                        <div className="flex items-center gap-1.5 text-xs">
                          <Sparkles className="h-3 w-3 text-amber-500" />
                          <span>خصومات حصرية على منتجات مختارة</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Purchase Button */}
                  {isPurchasable && !isCurrentCard && (
                    <Button
                      size="sm"
                      variant={canPurchase ? 'default' : 'outline'}
                      className="shrink-0"
                      disabled={!canPurchase || !user}
                      onClick={() => handlePurchaseClick(level)}
                    >
                      {canPurchase ? 'شراء' : 'نقاط غير كافية'}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Purchase Confirmation Dialog */}
      <AlertDialog open={purchaseDialogOpen} onOpenChange={setPurchaseDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد شراء البطاقة</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>
                هل تريد شراء بطاقة <strong style={{ color: selectedLevel?.color }}>{selectedLevel?.name_ar}</strong>؟
              </p>
              <p className="text-sm">
                سيتم خصم <strong>{(selectedLevel?.purchase_price_points || 0).toLocaleString()}</strong> نقطة من رصيدك.
              </p>
              <p className="text-sm">
                البطاقة صالحة لمدة <strong>{selectedLevel?.duration_days || 30}</strong> يوم.
              </p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedLevel && purchaseCardMutation.mutate(selectedLevel)}
              disabled={purchaseCardMutation.isPending}
            >
              {purchaseCardMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin ml-2" />
              ) : null}
              تأكيد الشراء
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}