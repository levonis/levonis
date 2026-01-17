import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Search, Plus, Minus, Download, Coins, User } from "lucide-react";
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
  const [adjustAmount, setAdjustAmount] = useState("");
  const [adjustReason, setAdjustReason] = useState("");
  const [exportingUser, setExportingUser] = useState<string | null>(null);

  const ITEMS_PER_PAGE = 15;

  const { data: usersWithPoints, isLoading } = useQuery({
    queryKey: ['admin-users-points', searchQuery, currentPage],
    queryFn: async () => {
      let query = supabase
        .from('user_points')
        .select(`
          *,
          profiles!inner(id, username, full_name, email)
        `, { count: 'exact' })
        .order('total_points', { ascending: false });

      if (searchQuery) {
        query = query.or(`profiles.username.ilike.%${searchQuery}%,profiles.full_name.ilike.%${searchQuery}%,profiles.email.ilike.%${searchQuery}%`);
      }

      const from = (currentPage - 1) * ITEMS_PER_PAGE;
      const to = from + ITEMS_PER_PAGE - 1;
      
      const { data, error, count } = await query.range(from, to);
      if (error) throw error;
      
      return { users: data, totalCount: count || 0 };
    },
    staleTime: 30 * 1000,
  });

  const adjustPoints = useMutation({
    mutationFn: async ({ userId, amount, type, reason }: { userId: string; amount: number; type: 'add' | 'subtract'; reason: string }) => {
      const pointsChange = type === 'add' ? amount : -amount;
      const transactionType = type === 'add' ? 'earn' : 'redeem';
      
      // Add transaction record
      const { error: transactionError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: userId,
          points: Math.abs(amount),
          type: transactionType,
          source: 'admin_adjustment',
          description: reason || (type === 'add' ? 'إضافة نقاط من الإدارة' : 'خصم نقاط من الإدارة'),
        });
      
      if (transactionError) throw transactionError;

      // Update user points
      const { data: currentPoints, error: getError } = await supabase
        .from('user_points')
        .select('total_points')
        .eq('user_id', userId)
        .single();
      
      if (getError) throw getError;
      
      const newTotal = Math.max(0, (currentPoints?.total_points || 0) + pointsChange);
      
      const { error: updateError } = await supabase
        .from('user_points')
        .update({ total_points: newTotal, updated_at: new Date().toISOString() })
        .eq('user_id', userId);
      
      if (updateError) throw updateError;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-users-points'] });
      toast.success(adjustDialog.type === 'add' ? 'تمت إضافة النقاط بنجاح' : 'تم خصم النقاط بنجاح');
      setAdjustDialog({ open: false, user: null, type: 'add' });
      setAdjustAmount("");
      setAdjustReason("");
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

      // Create CSV content
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

      // Add BOM for Arabic support
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
    });
  };

  const totalPages = Math.ceil((usersWithPoints?.totalCount || 0) / ITEMS_PER_PAGE);

  if (isLoading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map(i => (
          <div key={i} className="h-16 bg-muted/50 rounded animate-pulse" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Stats Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4 text-center">
            <Coins className="h-8 w-8 mx-auto text-primary mb-2" />
            <p className="text-2xl font-bold">{usersWithPoints?.totalCount || 0}</p>
            <p className="text-xs text-muted-foreground">مستخدم لديهم نقاط</p>
          </CardContent>
        </Card>
      </div>

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

      {/* Users Table */}
      {!usersWithPoints?.users || usersWithPoints.users.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center">
            <User className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
            <p className="text-lg font-medium">لا يوجد مستخدمين</p>
            <p className="text-sm text-muted-foreground">لم يتم العثور على مستخدمين مطابقين</p>
          </CardContent>
        </Card>
      ) : (
        <div className="border rounded-lg overflow-hidden">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>اليوزر</TableHead>
                <TableHead>النقاط</TableHead>
                <TableHead>الإجراءات</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {usersWithPoints.users.map((up: any) => (
                <TableRow key={up.user_id}>
                  <TableCell>
                    <div>
                      <p className="font-medium">{up.profiles?.full_name || 'بدون اسم'}</p>
                      <p className="text-xs text-muted-foreground">{up.profiles?.email}</p>
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline">@{up.profiles?.username || '-'}</Badge>
                  </TableCell>
                  <TableCell>
                    <Badge className="bg-gradient-to-r from-amber-500 to-yellow-500">
                      <Coins className="h-3 w-3 ml-1" />
                      {up.total_points?.toLocaleString() || 0}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1.5">
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-green-600"
                        onClick={() => setAdjustDialog({ open: true, user: up, type: 'add' })}
                      >
                        <Plus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        className="text-red-600"
                        onClick={() => setAdjustDialog({ open: true, user: up, type: 'subtract' })}
                      >
                        <Minus className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleExportTransactions(up.user_id, up.profiles?.username || up.user_id)}
                        disabled={exportingUser === up.user_id}
                      >
                        <Download className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
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
            <DialogTitle>
              {adjustDialog.type === 'add' ? 'إضافة نقاط' : 'خصم نقاط'}
            </DialogTitle>
            <DialogDescription>
              {adjustDialog.user?.profiles?.full_name || adjustDialog.user?.profiles?.username}
              <br />
              الرصيد الحالي: {adjustDialog.user?.total_points?.toLocaleString() || 0} نقطة
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>عدد النقاط</Label>
              <Input
                type="number"
                min="1"
                value={adjustAmount}
                onChange={(e) => setAdjustAmount(e.target.value)}
                placeholder="أدخل عدد النقاط"
              />
            </div>
            <div>
              <Label>السبب (اختياري)</Label>
              <Textarea
                value={adjustReason}
                onChange={(e) => setAdjustReason(e.target.value)}
                placeholder="سبب التعديل..."
                rows={2}
              />
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
    </div>
  );
}
