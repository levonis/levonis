import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';
import { Wallet, Check, X, ArrowLeft } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function AdminWallet() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // جلب جميع معاملات المحفظة المعلقة
  const { data: pendingTransactions, isLoading } = useQuery({
    queryKey: ['admin-wallet-transactions', 'pending'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            phone_number
          )
        `)
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // جلب جميع المعاملات
  const { data: allTransactions } = useQuery({
    queryKey: ['admin-wallet-transactions', 'all'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select(`
          *,
          profiles:user_id (
            full_name,
            username,
            phone_number
          )
        `)
        .order('created_at', { ascending: false })
        .limit(100);
      
      if (error) throw error;
      return data;
    },
    enabled: isAdmin,
  });

  // تحديث حالة المعاملة
  const updateTransactionStatus = useMutation({
    mutationFn: async ({ 
      id, 
      status, 
      admin_notes 
    }: { 
      id: string; 
      status: string; 
      admin_notes?: string;
    }) => {
      const { error } = await supabase
        .from('wallet_transactions')
        .update({ 
          status, 
          admin_notes,
          updated_at: new Date().toISOString()
        })
        .eq('id', id);
      
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      toast.success('تم تحديث حالة المعاملة بنجاح');
    },
    onError: (error) => {
      console.error('خطأ في تحديث المعاملة:', error);
      toast.error('حدث خطأ في تحديث المعاملة');
    },
  });

  const handleApprove = (transactionId: string) => {
    if (confirm('هل أنت متأكد من الموافقة على هذه المعاملة؟')) {
      updateTransactionStatus.mutate({
        id: transactionId,
        status: 'approved',
      });
    }
  };

  const handleReject = (transactionId: string) => {
    const notes = prompt('الرجاء إدخال سبب الرفض (اختياري):');
    if (notes !== null) {
      updateTransactionStatus.mutate({
        id: transactionId,
        status: 'rejected',
        admin_notes: notes || 'تم الرفض من قبل الإدارة',
      });
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'deposit':
        return 'تعبئة';
      case 'withdrawal':
        return 'سحب';
      case 'points_conversion':
        return 'تحويل نقاط';
      case 'order_payment':
        return 'دفع طلب';
      default:
        return type;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-700">قيد المراجعة</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-green-500/10 text-green-700">تمت الموافقة</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-700">مكتمل</Badge>;
      case 'rejected':
        return <Badge variant="outline" className="bg-red-500/10 text-red-700">مرفوض</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (authLoading || !isAdmin) {
    return null;
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-7xl">
      <div className="mb-6">
        <Button
          variant="ghost"
          onClick={() => navigate('/admin')}
          className="mb-4"
        >
          <ArrowLeft className="ml-2 h-4 w-4" />
          العودة إلى لوحة التحكم
        </Button>
        
        <div className="flex items-center gap-3 mb-2">
          <Wallet className="h-8 w-8 text-primary" />
          <h1 className="text-3xl font-bold">إدارة المحفظة</h1>
        </div>
        <p className="text-muted-foreground">
          إدارة طلبات تعبئة وسحب المحفظة
        </p>
      </div>

      {/* الطلبات المعلقة */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle>الطلبات المعلقة ({pendingTransactions?.length || 0})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-center py-8 text-muted-foreground">جاري التحميل...</p>
          ) : pendingTransactions && pendingTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>الإجراءات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {pendingTransactions.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{transaction.profiles?.full_name || 'غير معروف'}</p>
                          <p className="text-sm text-muted-foreground">@{transaction.profiles?.username}</p>
                          {transaction.profiles?.phone_number && (
                            <p className="text-xs text-muted-foreground">{transaction.profiles.phone_number}</p>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(transaction.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${
                          transaction.type === 'withdrawal' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'withdrawal' ? '-' : '+'}
                          {formatPrice(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString('ar-IQ')}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-2">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleApprove(transaction.id)}
                            disabled={updateTransactionStatus.isPending}
                            className="text-green-600 hover:text-green-700"
                          >
                            <Check className="h-4 w-4 ml-1" />
                            موافقة
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleReject(transaction.id)}
                            disabled={updateTransactionStatus.isPending}
                            className="text-red-600 hover:text-red-700"
                          >
                            <X className="h-4 w-4 ml-1" />
                            رفض
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              لا توجد طلبات معلقة
            </p>
          )}
        </CardContent>
      </Card>

      {/* جميع المعاملات */}
      <Card>
        <CardHeader>
          <CardTitle>سجل جميع المعاملات</CardTitle>
        </CardHeader>
        <CardContent>
          {allTransactions && allTransactions.length > 0 ? (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>المستخدم</TableHead>
                    <TableHead>النوع</TableHead>
                    <TableHead>المبلغ</TableHead>
                    <TableHead>الحالة</TableHead>
                    <TableHead>التاريخ</TableHead>
                    <TableHead>ملاحظات</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {allTransactions.map((transaction: any) => (
                    <TableRow key={transaction.id}>
                      <TableCell>
                        <div>
                          <p className="font-medium">{transaction.profiles?.full_name || 'غير معروف'}</p>
                          <p className="text-sm text-muted-foreground">@{transaction.profiles?.username}</p>
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">{getTypeLabel(transaction.type)}</Badge>
                      </TableCell>
                      <TableCell>
                        <span className={`font-bold ${
                          transaction.type === 'withdrawal' || transaction.type === 'order_payment' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'withdrawal' || transaction.type === 'order_payment' ? '-' : '+'}
                          {formatPrice(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell>
                        {getStatusBadge(transaction.status)}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground">
                        {new Date(transaction.created_at).toLocaleString('ar-IQ')}
                      </TableCell>
                      <TableCell className="text-sm text-muted-foreground max-w-xs truncate">
                        {transaction.admin_notes || '-'}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <p className="text-center py-8 text-muted-foreground">
              لا توجد معاملات
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
