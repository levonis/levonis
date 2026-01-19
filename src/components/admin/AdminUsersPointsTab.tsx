import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { 
  Search, Plus, Minus, Download, Coins, User, TrendingUp, 
  Calendar, ArrowUpRight, ArrowDownRight, History, Crown, Bell
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import AdminPagination from "./AdminPagination";

export default function AdminUsersPointsTab() {
  const queryClient = useQueryClient();
  const [searchQuery, setSearchQuery] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [adjustDialog, setAdjustDialog] = useState<{ open: boolean; user: any; type: 'add' | 'subtract' }>({ 
    open: false, 
    user: null, 
    type: 'add' 
  });
  const [historyDialog, setHistoryDialog] = useState<{ open: boolean; user: any }>({ open: false, user: null });
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [sendNotification, setSendNotification] = useState(true);
  const [exportingUser, setExportingUser] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 12;

  const { data: usersWithPoints, isLoading } = useQuery({
    queryKey: ['admin-users-points', searchQuery, currentPage],
    queryFn: async () => {
      // First get user_points ordered by total_points
      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;

      let pointsQuery = supabase
        .from('user_points')
        .select('*', { count: 'exact' })
        .order('total_points', { ascending: false });

      const { data: pointsData, error: pointsError, count } = await pointsQuery.range(from, to);
      if (pointsError) throw pointsError;

      if (!pointsData || pointsData.length === 0) {
        return { users: [], totalCount: count || 0 };
      }

      // Get all user_ids from pointsData
      const userIds = pointsData.map(p => p.user_id);

      // Fetch profiles for these users
      const { data: profilesData, error: profilesError } = await supabase
        .from('profiles')
        .select('id, username, full_name, email, avatar_url')
        .in('id', userIds);

      if (profilesError) throw profilesError;

      // Create a map of profiles by id
      const profilesMap = new Map(profilesData?.map(p => [p.id, p]) || []);

      // Combine data
      let combinedData = pointsData.map(up => ({
        ...up,
        profiles: profilesMap.get(up.user_id) || { 
          id: up.user_id, 
          username: null, 
          full_name: null, 
          email: null, 
          avatar_url: null 
        }
      }));

      // Filter by search query if provided
      if (searchQuery) {
        const query = searchQuery.toLowerCase();
        combinedData = combinedData.filter(up => 
          up.profiles?.username?.toLowerCase().includes(query) ||
          up.profiles?.full_name?.toLowerCase().includes(query) ||
          up.profiles?.email?.toLowerCase().includes(query)
        );
      }

      return { users: combinedData, totalCount: count || 0 };
    },
    staleTime: 30 * 1000,
  });

  const { data: userTransactions, isLoading: loadingTransactions } = useQuery({
    queryKey: ['user-transactions', historyDialog.user?.user_id],
    queryFn: async () => {
      if (!historyDialog.user?.user_id) return [];
      const { data, error } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', historyDialog.user.user_id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data;
    },
    enabled: !!historyDialog.user?.user_id,
  });

  const adjustPoints = useMutation({
    mutationFn: async ({ userId, amount, type, reason, notify }: { userId: string; amount: number; type: 'add' | 'subtract'; reason: string; notify: boolean }) => {
      const pointsChange = type === 'add' ? amount : -amount;
      const transactionType = type === 'add' ? 'earn' : 'redeem';
      const description = reason || (type === 'add' ? 'إضافة نقاط من الإدارة' : 'خصم نقاط من الإدارة');
      
      // إضافة معاملة النقاط
      const { error: transactionError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: userId,
          points: Math.abs(amount),
          type: transactionType,
          source: 'admin_adjustment',
          description,
        });
      
      if (transactionError) throw transactionError;

      // إعادة حساب رصيد النقاط من المعاملات مباشرة لضمان الدقة
      const { data: transactionsSum } = await supabase
        .from('points_transactions')
        .select('type, points')
        .eq('user_id', userId);
      
      let calculatedBalance = 0;
      if (transactionsSum) {
        for (const tx of transactionsSum) {
          if (tx.type === 'earn' || tx.type === 'earned') {
            calculatedBalance += tx.points;
          } else {
            calculatedBalance -= tx.points;
          }
        }
      }
      
      const { data: currentPoints } = await supabase
        .from('user_points')
        .select('id')
        .eq('user_id', userId)
        .maybeSingle();
      
      if (currentPoints) {
        // تحديث الصف الموجود
        const { error: updateError } = await supabase
          .from('user_points')
          .update({
            total_points: calculatedBalance,
            available_points: calculatedBalance,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);
        
        if (updateError) throw updateError;
      } else {
        // إنشاء صف جديد
        const { error: insertError } = await supabase
          .from('user_points')
          .insert({
            user_id: userId,
            total_points: calculatedBalance,
            available_points: calculatedBalance,
          });
        
        if (insertError) throw insertError;
      }

      // إرسال إشعار للمستخدم
      if (notify) {
        const notificationTitle = type === 'add' ? '🎉 تم إضافة نقاط لحسابك' : '📢 تعديل على رصيد نقاطك';
        const notificationMessage = type === 'add' 
          ? `تمت إضافة ${amount.toLocaleString()} نقطة إلى رصيدك. ${reason ? `السبب: ${reason}` : ''}`
          : `تم خصم ${amount.toLocaleString()} نقطة من رصيدك. ${reason ? `السبب: ${reason}` : ''}`;

        const { error: notifyError } = await supabase
          .from('notifications')
          .insert({
            user_id: userId,
            title: notificationTitle,
            message: notificationMessage,
            type: 'points',
            is_general: false,
          });

        if (notifyError) console.error('Failed to send notification:', notifyError);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-points'] });
      queryClient.invalidateQueries({ queryKey: ['points-stats'] });
      toast.success(adjustDialog.type === 'add' ? 'تمت إضافة النقاط بنجاح' : 'تم خصم النقاط بنجاح');
      if (sendNotification) {
        toast.success('تم إرسال إشعار للمستخدم');
      }
      setAdjustDialog({ open: false, user: null, type: 'add' });
      setAdjustAmount("");
      setAdjustReason("");
      setSendNotification(true);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const handleExportTransactions = async (userId: string, username: string) => {
    setExportingUser(userId);
    try {
      const { data: transactions, error } = await supabase
        .from('points_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (!transactions || transactions.length === 0) {
        toast.error('لا توجد معاملات لهذا المستخدم');
        return;
      }

      const headers = ['التاريخ', 'النوع', 'المصدر', 'النقاط', 'الوصف'];
      const rows = transactions.map((t: any) => [
        format(new Date(t.created_at), 'yyyy-MM-dd HH:mm', { locale: ar }),
        t.type === 'earn' ? 'كسب' : t.type === 'redeem' ? 'استخدام' : 'تحويل',
        getSourceLabel(t.source),
        t.type === 'earn' ? `+${t.points}` : `-${t.points}`,
        t.description || '-'
      ]);

      const csvContent = [
        headers.join(','),
        ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
      ].join('\n');

      const BOM = '\uFEFF';
      const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `transactions_${username}_${format(new Date(), 'yyyy-MM-dd')}.csv`;
      link.click();
      URL.revokeObjectURL(url);
      
      toast.success('تم تحميل الملف بنجاح');
    } catch (error: any) {
      toast.error(error.message || 'حدث خطأ أثناء التصدير');
    } finally {
      setExportingUser(null);
    }
  };

  const getSourceLabel = (source: string) => {
    const labels: Record<string, string> = {
      'order': 'طلب',
      'order_delivered': 'طلب مكتمل',
      'review': 'تقييم',
      'verified_review': 'تقييم مؤكد',
      'daily_task': 'مهمة يومية',
      'referral': 'دعوة صديق (داعي)',
      'referred': 'دعوة صديق (مدعو)',
      'coupon': 'كوبون خصم',
      'cash': 'تحويل نقدي',
      'wallet_conversion': 'تحويل للمحفظة',
      'admin_adjustment': 'تعديل الإدارة',
      'tickets_conversion': 'تحويل لتذاكر',
      'welcome_bonus': 'مكافأة ترحيب',
      'birthday_bonus': 'مكافأة عيد ميلاد',
      'streak_bonus': 'مكافأة تسلسل',
      'instagram_share': 'مشاركة انستجرام',
      'product_redemption': 'استبدال قسيمة',
    };
    return labels[source] || source;
  };

  const handleAdjust = () => {
    const amount = parseInt(adjustAmount);
    if (isNaN(amount) || amount <= 0) {
      toast.error('الرجاء إدخال قيمة صحيحة');
      return;
    }
    adjustPoints.mutate({
      userId: adjustDialog.user.user_id,
      amount,
      type: adjustDialog.type,
      reason: adjustReason,
      notify: sendNotification,
    });
  };

  const totalPages = Math.ceil((usersWithPoints?.totalCount || 0) / ITEMS_PER_PAGE);

  // Get rank badge
  const getRankBadge = (index: number) => {
    const rank = (currentPage - 1) * ITEMS_PER_PAGE + index + 1;
    if (rank === 1) return <Crown className="h-4 w-4 text-yellow-500" />;
    if (rank === 2) return <Crown className="h-4 w-4 text-gray-400" />;
    if (rank === 3) return <Crown className="h-4 w-4 text-amber-700" />;
    return <span className="text-xs text-muted-foreground">#{rank}</span>;
  };

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {[1, 2, 3, 4, 5, 6].map(i => (
          <Card key={i} className="animate-pulse">
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-full bg-muted" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 bg-muted rounded w-2/3" />
                  <div className="h-3 bg-muted rounded w-1/2" />
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="بحث بالاسم أو اليوزر أو الإيميل..."
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="pr-10"
          />
        </div>
      </div>

      {/* Users Grid */}
      {!usersWithPoints?.users || usersWithPoints.users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">لا يوجد مستخدمين</p>
            <p className="text-sm text-muted-foreground">لم يتم العثور على مستخدمين مطابقين</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {usersWithPoints.users.map((up: any, idx: number) => (
            <Card key={up.user_id} className="hover:border-primary/50 transition-colors">
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative">
                      <Avatar className="h-12 w-12 border-2 border-primary/20">
                        <AvatarImage src={up.profiles?.avatar_url} />
                        <AvatarFallback className="bg-primary/10 text-primary">
                          {up.profiles?.full_name?.charAt(0) || up.profiles?.username?.charAt(0) || 'U'}
                        </AvatarFallback>
                      </Avatar>
                      <div className="absolute -bottom-1 -right-1 bg-background rounded-full p-0.5">
                        {getRankBadge(idx)}
                      </div>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium truncate">{up.profiles?.full_name || 'بدون اسم'}</p>
                      <p className="text-xs text-muted-foreground truncate">@{up.profiles?.username || '-'}</p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between mb-3">
                  <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500 text-white px-3 py-1">
                    <Coins className="h-3.5 w-3.5 ml-1" />
                    {up.total_points?.toLocaleString() || 0}
                  </Badge>
                  {up.available_points !== undefined && up.available_points !== up.total_points && (
                    <span className="text-xs text-muted-foreground">
                      متاح: {up.available_points?.toLocaleString()}
                    </span>
                  )}
                </div>

                <div className="flex gap-1.5">
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-green-600 hover:text-green-700 hover:bg-green-500/10"
                    onClick={() => setAdjustDialog({ open: true, user: up, type: 'add' })}
                  >
                    <Plus className="h-4 w-4 ml-1" />
                    إضافة
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="flex-1 text-red-600 hover:text-red-700 hover:bg-red-500/10"
                    onClick={() => setAdjustDialog({ open: true, user: up, type: 'subtract' })}
                  >
                    <Minus className="h-4 w-4 ml-1" />
                    خصم
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setHistoryDialog({ open: true, user: up })}
                  >
                    <History className="h-4 w-4" />
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => handleExportTransactions(up.user_id, up.profiles?.username || up.user_id)}
                    disabled={exportingUser === up.user_id}
                  >
                    <Download className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <AdminPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={usersWithPoints?.totalCount || 0}
          startIndex={(currentPage - 1) * ITEMS_PER_PAGE + 1}
          endIndex={Math.min(currentPage * ITEMS_PER_PAGE, usersWithPoints?.totalCount || 0)}
          onPageChange={setCurrentPage}
          hasNextPage={currentPage < totalPages}
          hasPrevPage={currentPage > 1}
        />
      )}

      {/* Adjust Points Dialog */}
      <Dialog open={adjustDialog.open} onOpenChange={(open) => !open && setAdjustDialog({ open: false, user: null, type: 'add' })}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              {adjustDialog.type === 'add' ? (
                <><Plus className="h-5 w-5 text-green-500" /> إضافة نقاط</>
              ) : (
                <><Minus className="h-5 w-5 text-red-500" /> خصم نقاط</>
              )}
            </DialogTitle>
            <DialogDescription>
              <div className="flex items-center gap-3 mt-2">
                <Avatar className="h-10 w-10">
                  <AvatarImage src={adjustDialog.user?.profiles?.avatar_url} />
                  <AvatarFallback>{adjustDialog.user?.profiles?.full_name?.charAt(0) || 'U'}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="font-medium">{adjustDialog.user?.profiles?.full_name || adjustDialog.user?.profiles?.username}</p>
                  <p className="text-xs">الرصيد الحالي: {adjustDialog.user?.total_points?.toLocaleString() || 0} نقطة</p>
                </div>
              </div>
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label>عدد النقاط</Label>
              <Input
                type="number"
                min="1"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="أدخل عدد النقاط"
              />
            </div>
            <div className="space-y-2">
              <Label>السبب <span className="text-muted-foreground">(يظهر للمستخدم)</span></Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder={adjustDialog.type === 'add' ? 'مثال: مكافأة لمشاركتك الفعالة' : 'مثال: تصحيح خطأ في النظام'}
                rows={2}
              />
            </div>
            <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
              <div className="flex items-center gap-2">
                <Bell className="h-4 w-4 text-muted-foreground" />
                <Label className="text-sm">إرسال إشعار للمستخدم</Label>
              </div>
              <Switch checked={sendNotification} onCheckedChange={setSendNotification} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAdjustDialog({ open: false, user: null, type: 'add' })}>
              إلغاء
            </Button>
            <Button 
              onClick={handleAdjust}
              disabled={adjustPoints.isPending}
              className={adjustDialog.type === 'add' ? 'bg-green-600 hover:bg-green-700' : 'bg-red-600 hover:bg-red-700'}
            >
              {adjustPoints.isPending ? 'جاري...' : adjustDialog.type === 'add' ? 'إضافة' : 'خصم'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* History Dialog */}
      <Dialog open={historyDialog.open} onOpenChange={(open) => !open && setHistoryDialog({ open: false, user: null })}>
        <DialogContent className="max-w-lg max-h-[80vh]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <History className="h-5 w-5" />
              سجل النقاط
            </DialogTitle>
            <DialogDescription>
              {historyDialog.user?.profiles?.full_name || historyDialog.user?.profiles?.username}
            </DialogDescription>
          </DialogHeader>
          <ScrollArea className="h-[400px] pr-4">
            {loadingTransactions ? (
              <div className="space-y-3">
                {[1, 2, 3, 4, 5].map(i => (
                  <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
                ))}
              </div>
            ) : !userTransactions || userTransactions.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <History className="h-12 w-12 mx-auto mb-4 opacity-50" />
                <p>لا توجد معاملات</p>
              </div>
            ) : (
              <div className="space-y-2">
                {userTransactions.map((tx: any) => (
                  <Card key={tx.id}>
                    <CardContent className="p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-full ${tx.type === 'earn' ? 'bg-green-500/10' : 'bg-red-500/10'}`}>
                            {tx.type === 'earn' ? (
                              <ArrowUpRight className="h-4 w-4 text-green-500" />
                            ) : (
                              <ArrowDownRight className="h-4 w-4 text-red-500" />
                            )}
                          </div>
                          <div>
                            <p className="text-sm font-medium">{getSourceLabel(tx.source)}</p>
                            <p className="text-xs text-muted-foreground">{tx.description}</p>
                          </div>
                        </div>
                        <div className="text-left">
                          <p className={`font-bold ${tx.type === 'earn' ? 'text-green-500' : 'text-red-500'}`}>
                            {tx.type === 'earn' ? '+' : '-'}{tx.points}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {format(new Date(tx.created_at), 'dd/MM', { locale: ar })}
                          </p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )}
          </ScrollArea>
        </DialogContent>
      </Dialog>
    </div>
  );
}