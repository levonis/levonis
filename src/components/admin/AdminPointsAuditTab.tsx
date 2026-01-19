import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { toast } from "sonner";
import { 
  AlertTriangle, CheckCircle2, RefreshCw, Coins, CreditCard, 
  User, Calendar, Shield, Sparkles
} from "lucide-react";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface PointsDiscrepancy {
  user_id: string;
  available_points: number;
  total_points: number;
  calculated_balance: number;
  difference: number;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
}

interface ActiveCard {
  id: string;
  user_id: string;
  loyalty_level_id: string;
  purchased_at: string;
  expires_at: string | null;
  is_active: boolean;
  full_name: string | null;
  username: string | null;
  avatar_url: string | null;
  level_name: string;
  level_color: string;
}

export default function AdminPointsAuditTab() {
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("discrepancies");

  // جلب الفروقات في النقاط
  const { data: discrepancies, isLoading: loadingDiscrepancies, refetch: refetchDiscrepancies } = useQuery({
    queryKey: ['points-discrepancies'],
    queryFn: async () => {
      // First, get all user_points
      const { data: userPoints, error: upError } = await supabase
        .from('user_points')
        .select('user_id, available_points, total_points');
      
      if (upError) throw upError;
      if (!userPoints || userPoints.length === 0) return [];

      // Get all transactions grouped by user
      const { data: transactions, error: txError } = await supabase
        .from('points_transactions')
        .select('user_id, type, points');
      
      if (txError) throw txError;

      // Calculate balance from transactions
      const transactionBalances = new Map<string, number>();
      transactions?.forEach(tx => {
        const current = transactionBalances.get(tx.user_id) || 0;
        transactionBalances.set(tx.user_id, current + (tx.type === 'earn' ? tx.points : -tx.points));
      });

      // Get user profiles
      const userIds = userPoints.map(up => up.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      // Find discrepancies
      const discrepancyList: PointsDiscrepancy[] = [];
      userPoints.forEach(up => {
        const calculated = transactionBalances.get(up.user_id) || 0;
        const available = up.available_points || 0;
        const difference = available - calculated;
        
        if (Math.abs(difference) > 0) {
          const profile = profilesMap.get(up.user_id);
          discrepancyList.push({
            user_id: up.user_id,
            available_points: available,
            total_points: up.total_points || 0,
            calculated_balance: calculated,
            difference,
            full_name: profile?.full_name || null,
            username: profile?.username || null,
            avatar_url: profile?.avatar_url || null,
          });
        }
      });

      // Sort by absolute difference descending
      return discrepancyList.sort((a, b) => Math.abs(b.difference) - Math.abs(a.difference));
    },
  });

  // جلب البطاقات النشطة
  const { data: activeCards, isLoading: loadingCards, refetch: refetchCards } = useQuery({
    queryKey: ['active-loyalty-cards'],
    queryFn: async () => {
      const { data: cards, error: cardsError } = await supabase
        .from('user_cards')
        .select(`
          id,
          user_id,
          level_id,
          purchased_at,
          expires_at,
          is_active,
          loyalty_levels:level_id (
            name_ar,
            color
          )
        `)
        .eq('is_active', true)
        .order('purchased_at', { ascending: false });
      
      if (cardsError) throw cardsError;
      if (!cards || cards.length === 0) return [];

      // Get profiles for card holders
      const userIds = cards.map((c: any) => c.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, avatar_url')
        .in('id', userIds);

      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);

      return cards.map((card: any) => {
        const profile = profilesMap.get(card.user_id);
        const level = card.loyalty_levels as any;
        return {
          id: card.id,
          user_id: card.user_id,
          loyalty_level_id: card.level_id,
          purchased_at: card.purchased_at,
          expires_at: card.expires_at,
          is_active: card.is_active,
          full_name: profile?.full_name || null,
          username: profile?.username || null,
          avatar_url: profile?.avatar_url || null,
          level_name: level?.name_ar || 'غير معروف',
          level_color: level?.color || '#6b7280',
        };
      }) as ActiveCard[];
    },
  });

  // تصحيح نقاط مستخدم واحد
  const fixSingleUser = useMutation({
    mutationFn: async (userId: string) => {
      // Get calculated balance from transactions
      const { data: transactions, error: txError } = await supabase
        .from('points_transactions')
        .select('type, points')
        .eq('user_id', userId);
      
      if (txError) throw txError;

      const calculatedBalance = transactions?.reduce((sum, tx) => 
        sum + (tx.type === 'earn' ? tx.points : -tx.points), 0) || 0;

      // Update user_points
      const { error: updateError } = await supabase
        .from('user_points')
        .update({ 
          available_points: Math.max(0, calculatedBalance),
          updated_at: new Date().toISOString()
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-points'] });
      toast.success('تم تصحيح النقاط بنجاح');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء التصحيح');
    },
  });

  // تصحيح جميع الفروقات
  const fixAllDiscrepancies = useMutation({
    mutationFn: async () => {
      if (!discrepancies || discrepancies.length === 0) return;

      for (const disc of discrepancies) {
        const { error } = await supabase
          .from('user_points')
          .update({ 
            available_points: Math.max(0, disc.calculated_balance),
            updated_at: new Date().toISOString()
          })
          .eq('user_id', disc.user_id);

        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['points-discrepancies'] });
      queryClient.invalidateQueries({ queryKey: ['admin-users-points'] });
      toast.success(`تم تصحيح ${discrepancies?.length || 0} حساب بنجاح`);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء التصحيح');
    },
  });

  const isLoading = loadingDiscrepancies || loadingCards;

  return (
    <div className="space-y-6">
      {/* ملخص */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-destructive/10">
                <AlertTriangle className="h-6 w-6 text-destructive" />
              </div>
              <div>
                <p className="text-2xl font-bold">{discrepancies?.length || 0}</p>
                <p className="text-sm text-muted-foreground">فروقات في النقاط</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10">
                <CreditCard className="h-6 w-6 text-primary" />
              </div>
              <div>
                <p className="text-2xl font-bold">{activeCards?.length || 0}</p>
                <p className="text-sm text-muted-foreground">بطاقات نشطة</p>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-green-500/10">
                <CheckCircle2 className="h-6 w-6 text-green-500" />
              </div>
              <div>
                <p className="text-2xl font-bold">
                  {discrepancies?.length === 0 ? 'متطابقة' : 'تحتاج مراجعة'}
                </p>
                <p className="text-sm text-muted-foreground">حالة النظام</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات */}
      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="discrepancies" className="gap-2">
            <AlertTriangle className="h-4 w-4" />
            فروقات النقاط ({discrepancies?.length || 0})
          </TabsTrigger>
          <TabsTrigger value="cards" className="gap-2">
            <CreditCard className="h-4 w-4" />
            البطاقات النشطة ({activeCards?.length || 0})
          </TabsTrigger>
        </TabsList>

        {/* فروقات النقاط */}
        <TabsContent value="discrepancies" className="space-y-4">
          {discrepancies && discrepancies.length > 0 && (
            <div className="flex justify-between items-center">
              <p className="text-sm text-muted-foreground">
                يوجد {discrepancies.length} مستخدم لديهم فروقات في الأرصدة
              </p>
              <AlertDialog>
                <AlertDialogTrigger asChild>
                  <Button variant="destructive" size="sm">
                    <RefreshCw className="h-4 w-4 ml-2" />
                    تصحيح الكل
                  </Button>
                </AlertDialogTrigger>
                <AlertDialogContent>
                  <AlertDialogHeader>
                    <AlertDialogTitle>تأكيد تصحيح جميع الحسابات</AlertDialogTitle>
                    <AlertDialogDescription>
                      سيتم تحديث أرصدة {discrepancies.length} مستخدم لتتطابق مع مجموع معاملاتهم الفعلية.
                      هذا الإجراء لا يمكن التراجع عنه.
                    </AlertDialogDescription>
                  </AlertDialogHeader>
                  <AlertDialogFooter>
                    <AlertDialogCancel>إلغاء</AlertDialogCancel>
                    <AlertDialogAction
                      onClick={() => fixAllDiscrepancies.mutate()}
                      disabled={fixAllDiscrepancies.isPending}
                    >
                      {fixAllDiscrepancies.isPending ? 'جاري التصحيح...' : 'تصحيح الكل'}
                    </AlertDialogAction>
                  </AlertDialogFooter>
                </AlertDialogContent>
              </AlertDialog>
            </div>
          )}

          {loadingDiscrepancies ? (
            <div className="grid gap-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : discrepancies?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CheckCircle2 className="h-16 w-16 mx-auto text-green-500 mb-4" />
                <p className="text-lg font-medium">جميع الحسابات متطابقة</p>
                <p className="text-sm text-muted-foreground">
                  لا توجد فروقات بين أرصدة المستخدمين ومعاملاتهم
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {discrepancies?.map((disc) => (
                  <Card key={disc.user_id} className="border-destructive/30">
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2 border-destructive/30">
                            <AvatarImage src={disc.avatar_url || undefined} />
                            <AvatarFallback className="bg-destructive/10 text-destructive">
                              {disc.full_name?.charAt(0) || disc.username?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{disc.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground">@{disc.username || '-'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">الرصيد المسجل</p>
                            <Badge variant="outline" className="mt-1">
                              <Coins className="h-3 w-3 ml-1" />
                              {disc.available_points.toLocaleString()}
                            </Badge>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">الرصيد الفعلي</p>
                            <Badge className="mt-1 bg-green-500/10 text-green-600 border-green-500/30">
                              <Coins className="h-3 w-3 ml-1" />
                              {disc.calculated_balance.toLocaleString()}
                            </Badge>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">الفرق</p>
                            <Badge 
                              variant="destructive" 
                              className="mt-1"
                            >
                              {disc.difference > 0 ? '+' : ''}{disc.difference.toLocaleString()}
                            </Badge>
                          </div>

                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => fixSingleUser.mutate(disc.user_id)}
                            disabled={fixSingleUser.isPending}
                          >
                            <RefreshCw className={`h-4 w-4 ml-1 ${fixSingleUser.isPending ? 'animate-spin' : ''}`} />
                            تصحيح
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>

        {/* البطاقات النشطة */}
        <TabsContent value="cards" className="space-y-4">
          {loadingCards ? (
            <div className="grid gap-3">
              {[1, 2, 3].map(i => (
                <Card key={i} className="animate-pulse">
                  <CardContent className="p-4">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-full bg-muted" />
                      <div className="flex-1 space-y-2">
                        <div className="h-4 bg-muted rounded w-1/3" />
                        <div className="h-3 bg-muted rounded w-1/4" />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : activeCards?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <CreditCard className="h-16 w-16 mx-auto text-muted-foreground mb-4" />
                <p className="text-lg font-medium">لا توجد بطاقات نشطة</p>
                <p className="text-sm text-muted-foreground">
                  لم يقم أي مستخدم بشراء بطاقة ولاء حتى الآن
                </p>
              </CardContent>
            </Card>
          ) : (
            <ScrollArea className="h-[500px]">
              <div className="space-y-3 pr-4">
                {activeCards?.map((card) => (
                  <Card key={card.id} className="overflow-hidden">
                    <div 
                      className="h-1" 
                      style={{ backgroundColor: card.level_color }}
                    />
                    <CardContent className="p-4">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                          <Avatar className="h-12 w-12 border-2" style={{ borderColor: card.level_color }}>
                            <AvatarImage src={card.avatar_url || undefined} />
                            <AvatarFallback style={{ backgroundColor: `${card.level_color}20`, color: card.level_color }}>
                              {card.full_name?.charAt(0) || card.username?.charAt(0) || 'U'}
                            </AvatarFallback>
                          </Avatar>
                          <div>
                            <p className="font-medium">{card.full_name || 'بدون اسم'}</p>
                            <p className="text-sm text-muted-foreground">@{card.username || '-'}</p>
                          </div>
                        </div>
                        
                        <div className="flex items-center gap-6">
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">نوع البطاقة</p>
                            <Badge 
                              className="mt-1"
                              style={{ backgroundColor: `${card.level_color}20`, color: card.level_color, borderColor: card.level_color }}
                            >
                              <Sparkles className="h-3 w-3 ml-1" />
                              {card.level_name}
                            </Badge>
                          </div>
                          
                          <div className="text-center">
                            <p className="text-xs text-muted-foreground">تاريخ الشراء</p>
                            <p className="text-sm font-medium mt-1">
                              {format(new Date(card.purchased_at), 'dd MMM yyyy', { locale: ar })}
                            </p>
                          </div>
                          
                          {card.expires_at && (
                            <div className="text-center">
                              <p className="text-xs text-muted-foreground">تاريخ الانتهاء</p>
                              <p className="text-sm font-medium mt-1">
                                {format(new Date(card.expires_at), 'dd MMM yyyy', { locale: ar })}
                              </p>
                            </div>
                          )}
                          
                          <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">
                            <Shield className="h-3 w-3 ml-1" />
                            نشطة
                          </Badge>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </ScrollArea>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
