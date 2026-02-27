import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Check, CreditCard, Loader2, Clock, ShoppingCart, Sparkles, Wallet, Coins } from "lucide-react";
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

  // Fetch user points balance
  const { data: userPointsData } = useQuery({
    queryKey: ['user-points-loyalty', user?.id],
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
    staleTime: 2 * 60 * 1000,
  });

  const availablePoints = userPointsData?.available_points || 0;

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
      
      const pointsCost = level.purchase_price_points || 0;
      
      if (pointsCost <= 0) {
        throw new Error('سعر البطاقة غير محدد');
      }
      
      if (availablePoints < pointsCost) {
        throw new Error('رصيد النقاط غير كافٍ لشراء هذه البطاقة');
      }

      // Deduct points using secure RPC
      const { error: pointsError } = await supabase.rpc('deduct_user_points', {
        p_user_id: user.id,
        p_amount: pointsCost,
      });
      if (pointsError) throw pointsError;

      // Record points transaction
      const { error: transError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: user.id,
          points: pointsCost,
          type: 'spent',
          source: 'card_purchase',
          description: `شراء بطاقة ${level.name_ar}`,
          related_id: level.id,
        });
      if (transError) throw transError;

      // Calculate expiration date
      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + (level.duration_days || 30));

      // Deactivate any existing active cards first
      await supabase
        .from('user_cards')
        .update({ is_active: false })
        .eq('user_id', user.id)
        .eq('is_active', true);

      // Create user card
      const { error: cardError } = await supabase
        .from('user_cards')
        .insert({
          user_id: user.id,
          level_id: level.id,
          expires_at: expiresAt.toISOString(),
          points_spent: pointsCost,
          is_active: true,
        });
      if (cardError) throw cardError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-points'] });
      queryClient.invalidateQueries({ queryKey: ['user-points-loyalty'] });
      queryClient.invalidateQueries({ queryKey: ['user-active-card'] });
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

  const getCardPrice = (level: any) => {
    if (!level) return 0;
    return level.purchase_price_points || 0;
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

  const currentCardLevel = userCard?.loyalty_levels;
  const userName = userProfile?.full_name || userProfile?.username || '';

  return (
    <div className="space-y-4">
      {/* Wallet Balance Display */}
      <Card className="bg-gradient-to-br from-primary/10 to-primary/5 border-primary/20">
        <CardContent className="p-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-full bg-primary/20 flex items-center justify-center">
            <Coins className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-xs text-muted-foreground">رصيد النقاط المتاح</p>
            <p className="text-xl font-bold">{availablePoints.toLocaleString()} نقطة</p>
          </div>
        </CardContent>
      </Card>

      {/* Current Card Status */}
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
        <h3 className="text-sm font-semibold text-muted-foreground">البطاقات المتاحة للشراء</h3>
        <div className="grid gap-6">
          {levels?.filter(level => level.is_purchasable).map((level) => {
            const isCurrentCard = currentCardLevel?.id === level.id;
            const cardPrice = getCardPrice(level);
            const canPurchase = availablePoints >= cardPrice;
            
            if (isCurrentCard) return null;
            
            return (
              <div 
                key={level.id} 
                className="p-4 rounded-xl bg-card border border-border/50 shadow-sm space-y-4"
              >
                <UserLoyaltyCard
                  level={{
                    id: level.id,
                    name_ar: level.name_ar,
                    name_en: level.name_en,
                    color: level.color,
                    discount_percentage: level.discount_percentage,
                    bonus_points_percentage: level.bonus_points_percentage,
                    free_shipping: level.free_shipping,
                    free_shipping_min_order: level.free_shipping_min_order,
                    duration_days: level.duration_days,
                    vip_support: level.vip_support,
                    priority_shipping: level.priority_shipping,
                    early_access: level.early_access,
                    exclusive_products: level.exclusive_products,
                    special_name_style: level.special_name_style as any,
                    profile_effects: level.profile_effects as any,
                    benefits: level.benefits as any,
                    purchase_price_points: level.purchase_price_points,
                  }}
                  isActive={false}
                  showDetails={true}
                  showPurchaseInfo={true}
                />
                <Button
                  className="w-full"
                  variant={canPurchase ? 'default' : 'outline'}
                  disabled={!canPurchase || !user}
                  onClick={() => handlePurchaseClick(level)}
                >
                  {canPurchase ? (
                    <>
                      <Coins className="h-4 w-4 ml-2" />
                      شراء بـ {cardPrice.toLocaleString()} نقطة
                    </>
                  ) : (
                    `تحتاج ${(cardPrice - availablePoints).toLocaleString()} نقطة إضافية`
                  )}
                </Button>
              </div>
            );
          })}
        </div>
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
                سيتم خصم <strong>{getCardPrice(selectedLevel).toLocaleString()}</strong> نقطة من رصيدك.
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