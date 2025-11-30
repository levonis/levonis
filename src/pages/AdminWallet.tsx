import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { toast } from 'sonner';
import { Wallet, Check, X, ArrowLeft, PlusCircle, MinusCircle, Search, User, Settings } from 'lucide-react';
import { formatPrice } from '@/lib/utils';

export default function AdminWallet() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  
  const [showAddFundsDialog, setShowAddFundsDialog] = useState(false);
  const [showDeductFundsDialog, setShowDeductFundsDialog] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<any>(null);
  const [addAmount, setAddAmount] = useState('');
  const [deductAmount, setDeductAmount] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [deductNotes, setDeductNotes] = useState('');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  // البحث عن المستخدمين
  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users', searchQuery, showAddFundsDialog, showDeductFundsDialog],
    queryFn: async () => {
      console.log('Searching for users with query:', searchQuery);
      
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, phone_number, email');
      
      // إذا كان هناك بحث، استخدم الفلترة
      if (searchQuery && searchQuery.length >= 2) {
        query = query.or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(15);
      
      if (error) {
        console.error('Error searching users:', error);
        throw error;
      }
      
      console.log('Search results:', data);
      return data || [];
    },
    enabled: isAdmin && (showAddFundsDialog || showDeductFundsDialog),
  });

  // جلب رصيد المستخدم المحدد
  const { data: selectedUserWallet } = useQuery({
    queryKey: ['user-wallet', selectedUser?.id],
    queryFn: async () => {
      if (!selectedUser?.id) return null;
      
      const { data, error } = await supabase
        .from('user_wallets')
        .select('*')
        .eq('user_id', selectedUser.id)
        .maybeSingle();
      
      if (error && error.code !== 'PGRST116') throw error;
      return data;
    },
    enabled: !!selectedUser?.id,
  });

  // جلب جميع معاملات المحفظة المعلقة
  const { data: pendingTransactions, isLoading } = useQuery({
    queryKey: ['admin-wallet-transactions', 'pending'],
    queryFn: async () => {
      console.log('Fetching pending wallet transactions...');
      
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
      
      if (error) {
        console.error('Error fetching pending transactions:', error);
        throw error;
      }
      
      console.log('Pending transactions:', data);
      return data || [];
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

  // إضافة رصيد للمستخدم
  const addFundsToUser = useMutation({
    mutationFn: async ({ userId, amount, notes }: { userId: string; amount: number; notes: string }) => {
      // التحقق من وجود المحفظة أولاً
      const { data: existingWallet, error: walletCheckError } = await supabase
        .from('user_wallets')
        .select('id, balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletCheckError && walletCheckError.code !== 'PGRST116') {
        throw walletCheckError;
      }

      if (existingWallet) {
        // تحديث المحفظة الموجودة
        const { error: updateError } = await supabase
          .from('user_wallets')
          .update({
            balance: existingWallet.balance + amount,
            updated_at: new Date().toISOString(),
          })
          .eq('user_id', userId);

        if (updateError) throw updateError;
      } else {
        // إنشاء محفظة جديدة
        const { error: walletError } = await supabase
          .from('user_wallets')
          .insert({
            user_id: userId,
            balance: amount,
            currency: 'دينار عراقي',
          });

        if (walletError) throw walletError;
      }

      // إضافة المعاملة للسجل
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'deposit',
          amount: amount,
          status: 'completed',
          admin_notes: notes || 'تم إضافة الرصيد من قبل الإدارة',
        });

      if (transactionError) throw transactionError;

      // إرسال إشعار للمستخدم
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'تم إضافة رصيد لمحفظتك',
        message: `تم إضافة ${amount} دينار عراقي إلى محفظتك من قبل الإدارة`,
        type: 'success',
        is_general: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      toast.success('تم إضافة الرصيد بنجاح');
      setShowAddFundsDialog(false);
      setSelectedUser(null);
      setAddAmount('');
      setAdminNotes('');
      setSearchQuery('');
    },
    onError: (error: any) => {
      console.error('خطأ في إضافة الرصيد:', error);
      toast.error(error.message || 'حدث خطأ في إضافة الرصيد');
    },
  });

  // خصم رصيد من المستخدم
  const deductFundsFromUser = useMutation({
    mutationFn: async ({ userId, amount, notes }: { userId: string; amount: number; notes: string }) => {
      // التحقق من وجود رصيد كافٍ
      const { data: wallet, error: walletError } = await supabase
        .from('user_wallets')
        .select('balance')
        .eq('user_id', userId)
        .maybeSingle();

      if (walletError) throw walletError;
      
      if (!wallet || wallet.balance < amount) {
        throw new Error('رصيد المستخدم غير كافٍ');
      }

      // إضافة المعاملة
      const { error: transactionError } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: userId,
          type: 'admin_deduction',
          amount: amount,
          status: 'completed',
          admin_notes: notes || 'تم خصم الرصيد من قبل الإدارة',
        });

      if (transactionError) throw transactionError;

      // خصم المبلغ من المحفظة
      const { error: updateError } = await supabase
        .from('user_wallets')
        .update({
          balance: wallet.balance - amount,
          updated_at: new Date().toISOString(),
        })
        .eq('user_id', userId);

      if (updateError) throw updateError;

      // إرسال إشعار للمستخدم
      await supabase.from('notifications').insert({
        user_id: userId,
        title: 'تم خصم رصيد من محفظتك',
        message: `تم خصم ${amount} دينار عراقي من محفظتك من قبل الإدارة. ${notes ? `السبب: ${notes}` : ''}`,
        type: 'info',
        is_general: false,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['user-wallet'] });
      toast.success('تم خصم الرصيد بنجاح');
      setShowDeductFundsDialog(false);
      setSelectedUser(null);
      setDeductAmount('');
      setDeductNotes('');
      setSearchQuery('');
    },
    onError: (error: any) => {
      console.error('خطأ في خصم الرصيد:', error);
      toast.error(error.message || 'حدث خطأ في خصم الرصيد');
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

  const handleAddFunds = () => {
    const amount = Number(addAmount);
    if (!selectedUser || !amount || amount <= 0) {
      toast.error('الرجاء اختيار مستخدم وإدخال مبلغ صحيح');
      return;
    }
    addFundsToUser.mutate({
      userId: selectedUser.id,
      amount,
      notes: adminNotes,
    });
  };

  const handleDeductFunds = () => {
    const amount = Number(deductAmount);
    if (!selectedUser || !amount || amount <= 0) {
      toast.error('الرجاء اختيار مستخدم وإدخال مبلغ صحيح');
      return;
    }
    if (selectedUserWallet && amount > selectedUserWallet.balance) {
      toast.error('المبلغ أكبر من الرصيد المتاح');
      return;
    }
    deductFundsFromUser.mutate({
      userId: selectedUser.id,
      amount,
      notes: deductNotes,
    });
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
      case 'admin_deduction':
        return 'خصم إداري';
      default:
        return type;
    }
  };

  const getPaymentMethodLabel = (method: string) => {
    switch (method) {
      case 'mastercard_rafidain':
        return 'ماستر كارد الرافدين';
      case 'zaincash':
        return 'زين كاش';
      default:
        return method || '-';
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
        
        <div className="flex items-center justify-between flex-wrap gap-4 mb-2">
          <div className="flex items-center gap-3">
            <Wallet className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">إدارة المحفظة</h1>
          </div>
          <div className="flex gap-2">
            <Button onClick={() => navigate('/admin/wallet-settings')} variant="outline" className="gap-2">
              <Settings className="h-4 w-4" />
              الإعدادات
            </Button>
            <Button onClick={() => setShowAddFundsDialog(true)} className="gap-2">
              <PlusCircle className="h-4 w-4" />
              إضافة رصيد
            </Button>
            <Button onClick={() => setShowDeductFundsDialog(true)} variant="outline" className="gap-2 text-destructive border-destructive hover:bg-destructive/10">
              <MinusCircle className="h-4 w-4" />
              خصم رصيد
            </Button>
          </div>
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
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>إثبات الدفع</TableHead>
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
                      <TableCell className="text-sm">
                        {getPaymentMethodLabel(transaction.payment_method)}
                      </TableCell>
                      <TableCell>
                        {transaction.payment_proof_url ? (
                          <a 
                            href={transaction.payment_proof_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            عرض الصورة
                          </a>
                        ) : '-'}
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
                    <TableHead>طريقة الدفع</TableHead>
                    <TableHead>إثبات الدفع</TableHead>
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
                          transaction.type === 'withdrawal' || transaction.type === 'order_payment' || transaction.type === 'admin_deduction' ? 'text-red-600' : 'text-green-600'
                        }`}>
                          {transaction.type === 'withdrawal' || transaction.type === 'order_payment' || transaction.type === 'admin_deduction' ? '-' : '+'}
                          {formatPrice(transaction.amount)}
                        </span>
                      </TableCell>
                      <TableCell className="text-sm">
                        {getPaymentMethodLabel(transaction.payment_method)}
                      </TableCell>
                      <TableCell>
                        {transaction.payment_proof_url ? (
                          <a 
                            href={transaction.payment_proof_url} 
                            target="_blank" 
                            rel="noopener noreferrer"
                            className="text-primary hover:underline text-sm"
                          >
                            عرض الصورة
                          </a>
                        ) : '-'}
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

      {/* Dialog إضافة رصيد لمستخدم */}
      <Dialog open={showAddFundsDialog} onOpenChange={(open) => {
        setShowAddFundsDialog(open);
        if (!open) {
          setSelectedUser(null);
          setAddAmount('');
          setAdminNotes('');
          setSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <PlusCircle className="h-5 w-5" />
              إضافة رصيد لمستخدم
            </DialogTitle>
            <DialogDescription>
              البحث عن مستخدم وإضافة رصيد إلى محفظته
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* البحث عن المستخدم */}
            <div className="space-y-2">
              <Label>البحث عن مستخدم</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو رقم الهاتف أو اسم المستخدم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              {/* نتائج البحث */}
              {!selectedUser && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchLoading ? (
                    <p className="p-3 text-center text-muted-foreground">جاري التحميل...</p>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery('');
                        }}
                        className={`w-full p-3 text-right hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-3 ${
                          selectedUser?.id === user.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <User className="h-8 w-8 p-1.5 bg-muted rounded-full" />
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name || 'بدون اسم'}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          {user.phone_number && (
                            <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-center text-muted-foreground">لا يوجد مستخدمين</p>
                  )}
                </div>
              )}
            </div>

            {/* المستخدم المحدد */}
            {selectedUser && (
              <Card className="bg-primary/5 border-primary/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-10 w-10 p-2 bg-primary/10 rounded-full text-primary" />
                      <div>
                        <p className="font-bold">{selectedUser.full_name || 'بدون اسم'}</p>
                        <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                        {selectedUser.phone_number && (
                          <p className="text-xs text-muted-foreground">{selectedUser.phone_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                      <p className="font-bold text-lg text-primary">
                        {formatPrice(selectedUserWallet?.balance || 0)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="mt-2 text-xs"
                  >
                    تغيير المستخدم
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* المبلغ */}
            <div className="space-y-2">
              <Label htmlFor="addAmount">المبلغ</Label>
              <Input
                id="addAmount"
                type="number"
                placeholder="أدخل المبلغ المراد إضافته"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                min="0"
              />
            </div>

            {/* ملاحظات */}
            <div className="space-y-2">
              <Label htmlFor="adminNotes">ملاحظات (اختياري)</Label>
              <Input
                id="adminNotes"
                placeholder="سبب الإضافة..."
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
              />
            </div>

            {/* زر الإضافة */}
            <Button
              onClick={handleAddFunds}
              disabled={!selectedUser || !addAmount || Number(addAmount) <= 0 || addFundsToUser.isPending}
              className="w-full"
            >
              {addFundsToUser.isPending ? 'جاري الإضافة...' : 'إضافة الرصيد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Dialog خصم رصيد من مستخدم */}
      <Dialog open={showDeductFundsDialog} onOpenChange={(open) => {
        setShowDeductFundsDialog(open);
        if (!open) {
          setSelectedUser(null);
          setDeductAmount('');
          setDeductNotes('');
          setSearchQuery('');
        }
      }}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <MinusCircle className="h-5 w-5" />
              خصم رصيد من مستخدم
            </DialogTitle>
            <DialogDescription>
              البحث عن مستخدم وخصم مبلغ من محفظته
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 mt-4">
            {/* البحث عن المستخدم */}
            <div className="space-y-2">
              <Label>البحث عن مستخدم</Label>
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="ابحث بالاسم أو رقم الهاتف أو اسم المستخدم..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
              
              {/* نتائج البحث */}
              {!selectedUser && (
                <div className="border rounded-lg max-h-48 overflow-y-auto">
                  {searchLoading ? (
                    <p className="p-3 text-center text-muted-foreground">جاري التحميل...</p>
                  ) : searchResults && searchResults.length > 0 ? (
                    searchResults.map((user: any) => (
                      <button
                        key={user.id}
                        onClick={() => {
                          setSelectedUser(user);
                          setSearchQuery('');
                        }}
                        className={`w-full p-3 text-right hover:bg-muted/50 border-b last:border-b-0 flex items-center gap-3 ${
                          selectedUser?.id === user.id ? 'bg-primary/10' : ''
                        }`}
                      >
                        <User className="h-8 w-8 p-1.5 bg-muted rounded-full" />
                        <div className="flex-1">
                          <p className="font-medium">{user.full_name || 'بدون اسم'}</p>
                          <p className="text-sm text-muted-foreground">@{user.username}</p>
                          {user.phone_number && (
                            <p className="text-xs text-muted-foreground">{user.phone_number}</p>
                          )}
                        </div>
                      </button>
                    ))
                  ) : (
                    <p className="p-3 text-center text-muted-foreground">لا يوجد مستخدمين</p>
                  )}
                </div>
              )}
            </div>

            {/* المستخدم المحدد */}
            {selectedUser && (
              <Card className="bg-destructive/5 border-destructive/20">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <User className="h-10 w-10 p-2 bg-destructive/10 rounded-full text-destructive" />
                      <div>
                        <p className="font-bold">{selectedUser.full_name || 'بدون اسم'}</p>
                        <p className="text-sm text-muted-foreground">@{selectedUser.username}</p>
                        {selectedUser.phone_number && (
                          <p className="text-xs text-muted-foreground">{selectedUser.phone_number}</p>
                        )}
                      </div>
                    </div>
                    <div className="text-left">
                      <p className="text-xs text-muted-foreground">الرصيد الحالي</p>
                      <p className="font-bold text-lg text-primary">
                        {formatPrice(selectedUserWallet?.balance || 0)}
                      </p>
                    </div>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedUser(null)}
                    className="mt-2 text-xs"
                  >
                    تغيير المستخدم
                  </Button>
                </CardContent>
              </Card>
            )}

            {/* المبلغ */}
            <div className="space-y-2">
              <Label htmlFor="deductAmount">المبلغ المراد خصمه</Label>
              <Input
                id="deductAmount"
                type="number"
                placeholder="أدخل المبلغ المراد خصمه"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                min="0"
                max={selectedUserWallet?.balance || 0}
              />
              {selectedUserWallet && Number(deductAmount) > selectedUserWallet.balance && (
                <p className="text-xs text-destructive">المبلغ أكبر من الرصيد المتاح</p>
              )}
            </div>

            {/* ملاحظات */}
            <div className="space-y-2">
              <Label htmlFor="deductNotes">سبب الخصم</Label>
              <Input
                id="deductNotes"
                placeholder="أدخل سبب الخصم..."
                value={deductNotes}
                onChange={(e) => setDeductNotes(e.target.value)}
              />
            </div>

            {/* زر الخصم */}
            <Button
              onClick={handleDeductFunds}
              disabled={
                !selectedUser || 
                !deductAmount || 
                Number(deductAmount) <= 0 || 
                (selectedUserWallet && Number(deductAmount) > selectedUserWallet.balance) ||
                deductFundsFromUser.isPending
              }
              variant="destructive"
              className="w-full"
            >
              {deductFundsFromUser.isPending ? 'جاري الخصم...' : 'خصم الرصيد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}