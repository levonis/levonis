import { useEffect, useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { Wallet, Check, X, PlusCircle, MinusCircle, Search, User, Settings, Trash2, History, Image as ImageIcon, ExternalLink } from 'lucide-react';
import { formatPrice } from '@/lib/utils';
import AdminLayout, { AdminSection, AdminStatsGrid, AdminStatCard, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';

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

  const { data: searchResults, isLoading: searchLoading } = useQuery({
    queryKey: ['search-users', searchQuery, showAddFundsDialog, showDeductFundsDialog],
    queryFn: async () => {
      let query = supabase
        .from('profiles')
        .select('id, full_name, username, phone_number, email');
      
      if (searchQuery && searchQuery.length >= 2) {
        query = query.or(`full_name.ilike.%${searchQuery}%,username.ilike.%${searchQuery}%,phone_number.ilike.%${searchQuery}%,email.ilike.%${searchQuery}%`);
      }
      
      const { data, error } = await query.order('created_at', { ascending: false }).limit(15);
      if (error) throw error;
      return data || [];
    },
    enabled: isAdmin && (showAddFundsDialog || showDeductFundsDialog),
  });

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

  const { data: pendingTransactions, isLoading } = useQuery({
    queryKey: ['admin-wallet-transactions', 'pending'],
    queryFn: async () => {
      const { data: transactions, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      if (!transactions || transactions.length === 0) return [];
      
      const userIds = [...new Set(transactions.map(t => t.user_id))];
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone_number')
        .in('id', userIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return transactions.map(t => ({
        ...t,
        profiles: profilesMap.get(t.user_id) || null,
      }));
    },
    enabled: isAdmin,
  });

  const { data: customerWallets, isLoading: loadingWallets } = useQuery({
    queryKey: ['admin-customer-wallets'],
    queryFn: async () => {
      const { data: wallets, error } = await supabase
        .from('user_wallets')
        .select('*')
        .order('balance', { ascending: false });
      
      if (error) throw error;
      if (!wallets || wallets.length === 0) return [];
      
      const userIds = wallets.map(w => w.user_id);
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, full_name, username, phone_number, email')
        .in('id', userIds);
      
      const profilesMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return wallets.map(w => ({
        ...w,
        profile: profilesMap.get(w.user_id) || null,
      }));
    },
    enabled: isAdmin,
  });

  const [walletSearchQuery, setWalletSearchQuery] = useState('');
  const [selectedCustomerForHistory, setSelectedCustomerForHistory] = useState<any>(null);
  const [showCustomerHistoryDialog, setShowCustomerHistoryDialog] = useState(false);

  const { data: customerTransactionHistory } = useQuery({
    queryKey: ['customer-transaction-history', selectedCustomerForHistory?.user_id],
    queryFn: async () => {
      if (!selectedCustomerForHistory?.user_id) return [];
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', selectedCustomerForHistory.user_id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!selectedCustomerForHistory?.user_id,
  });

  const filteredCustomerWallets = useMemo(() => {
    if (!customerWallets) return [];
    if (!walletSearchQuery) return customerWallets;
    const search = walletSearchQuery.toLowerCase();
    return customerWallets.filter((w: any) => 
      w.profile?.full_name?.toLowerCase().includes(search) ||
      w.profile?.username?.toLowerCase().includes(search) ||
      w.profile?.phone_number?.includes(search) ||
      w.profile?.email?.toLowerCase().includes(search)
    );
  }, [customerWallets, walletSearchQuery]);

  const totalWalletBalance = useMemo(() => {
    return customerWallets?.reduce((sum: number, w: any) => sum + (w.balance || 0), 0) || 0;
  }, [customerWallets]);

  const approveTransaction = useMutation({
    mutationFn: async ({ transaction }: { transaction: any }) => {
      if (transaction.type === 'deposit') {
        // For deposits, add balance to user wallet using admin function
        const { error } = await supabase.rpc('admin_adjust_wallet', {
          p_user_id: transaction.user_id,
          p_amount: transaction.amount,
          p_type: 'deposit',
          p_description: 'تم الموافقة على طلب التعبئة'
        });
        if (error) throw error;
        
        // Mark original pending transaction as completed
        const { error: updateError } = await supabase
          .from('wallet_transactions')
          .update({ status: 'completed', admin_notes: 'تمت الموافقة', updated_at: new Date().toISOString() })
          .eq('id', transaction.id);
        if (updateError) throw updateError;
        
        // Send notification
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          title: 'تم الموافقة على طلب التعبئة',
          message: `تم إضافة ${transaction.amount.toLocaleString()} دينار عراقي إلى محفظتك`,
          type: 'success',
          is_general: false,
        });
      } else if (transaction.type === 'withdrawal') {
        // For withdrawals, deduct balance from user wallet
        const { error } = await supabase.rpc('admin_adjust_wallet', {
          p_user_id: transaction.user_id,
          p_amount: -transaction.amount, // Negative to deduct
          p_type: 'withdrawal',
          p_description: 'تم الموافقة على طلب السحب'
        });
        if (error) throw error;
        
        // Mark original pending transaction as completed
        const { error: updateError } = await supabase
          .from('wallet_transactions')
          .update({ status: 'completed', admin_notes: 'تمت الموافقة على السحب', updated_at: new Date().toISOString() })
          .eq('id', transaction.id);
        if (updateError) throw updateError;
        
        // Send notification
        await supabase.from('notifications').insert({
          user_id: transaction.user_id,
          title: 'تم الموافقة على طلب السحب',
          message: `تم سحب ${transaction.amount.toLocaleString()} دينار عراقي من محفظتك`,
          type: 'success',
          is_general: false,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      queryClient.invalidateQueries({ queryKey: ['admin-customer-wallets'] });
      toast.success('تمت الموافقة بنجاح');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ في الموافقة على المعاملة');
    },
  });

  const rejectTransaction = useMutation({
    mutationFn: async ({ id, admin_notes }: { id: string; admin_notes?: string }) => {
      const { error } = await supabase
        .from('wallet_transactions')
        .update({ status: 'rejected', admin_notes, updated_at: new Date().toISOString() })
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-wallet-transactions'] });
      toast.success('تم رفض المعاملة');
    },
    onError: (error) => {
      toast.error('حدث خطأ في رفض المعاملة');
    },
  });

  const addFundsToUser = useMutation({
    mutationFn: async ({ userId, amount, notes }: { userId: string; amount: number; notes: string }) => {
      // Use secure admin function
      const { error } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: userId,
        p_amount: amount,
        p_type: 'deposit',
        p_description: notes || 'تم إضافة الرصيد من قبل الإدارة'
      });
      if (error) throw error;

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
      queryClient.invalidateQueries({ queryKey: ['admin-customer-wallets'] });
      toast.success('تم إضافة الرصيد بنجاح');
      setShowAddFundsDialog(false);
      setSelectedUser(null);
      setAddAmount('');
      setAdminNotes('');
      setSearchQuery('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ في إضافة الرصيد');
    },
  });

  const deductFundsFromUser = useMutation({
    mutationFn: async ({ userId, amount, notes }: { userId: string; amount: number; notes: string }) => {
      // Use secure admin function (negative amount for deduction)
      const { error } = await supabase.rpc('admin_adjust_wallet', {
        p_user_id: userId,
        p_amount: -amount,
        p_type: 'admin_deduction',
        p_description: notes || 'تم خصم الرصيد من قبل الإدارة'
      });
      if (error) throw error;

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
      queryClient.invalidateQueries({ queryKey: ['admin-customer-wallets'] });
      toast.success('تم خصم الرصيد بنجاح');
      setShowDeductFundsDialog(false);
      setSelectedUser(null);
      setDeductAmount('');
      setDeductNotes('');
      setSearchQuery('');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ في خصم الرصيد');
    },
  });

  const handleApprove = async (transaction: any) => {
    if (!confirm('هل أنت متأكد من الموافقة على هذه المعاملة وإضافة الرصيد للمستخدم؟')) return;
    approveTransaction.mutate({ transaction });
  };

  const handleReject = (transactionId: string) => {
    const notes = prompt('الرجاء إدخال سبب الرفض (اختياري):');
    if (notes !== null) {
      rejectTransaction.mutate({
        id: transactionId,
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
    addFundsToUser.mutate({ userId: selectedUser.id, amount, notes: adminNotes });
  };

  const handleDeductFunds = () => {
    const amount = Number(deductAmount);
    if (!selectedUser || !amount || amount <= 0) {
      toast.error('الرجاء اختيار مستخدم وإدخال مبلغ صحيح');
      return;
    }
    deductFundsFromUser.mutate({ userId: selectedUser.id, amount, notes: deductNotes });
  };

  if (authLoading) {
    return (
      <AdminLayout title="إدارة المحفظة" icon={<Wallet className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة المحفظة"
      icon={<Wallet className="h-5 w-5" />}
      description="إدارة أرصدة المستخدمين والمعاملات المالية"
      actions={
        <div className="flex gap-2">
          <Button onClick={() => setShowAddFundsDialog(true)} className="admin-btn-primary gap-2">
            <PlusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">إضافة رصيد</span>
          </Button>
          <Button onClick={() => setShowDeductFundsDialog(true)} variant="outline" className="gap-2">
            <MinusCircle className="h-4 w-4" />
            <span className="hidden sm:inline">خصم رصيد</span>
          </Button>
          <Button onClick={() => navigate(ADMIN_ROUTES.walletSettings)} variant="outline" size="icon">
            <Settings className="h-4 w-4" />
          </Button>
        </div>
      }
    >
      {/* Stats */}
      <AdminStatsGrid>
        <AdminStatCard
          icon={<Wallet className="h-5 w-5" />}
          value={formatPrice(totalWalletBalance)}
          label="إجمالي الأرصدة"
          colorClass="text-primary"
          bgClass="bg-primary/10"
        />
        <AdminStatCard
          icon={<User className="h-5 w-5" />}
          value={customerWallets?.length || 0}
          label="عدد المحافظ"
          colorClass="text-blue-600"
          bgClass="bg-blue-500/10"
        />
        <AdminStatCard
          icon={<History className="h-5 w-5" />}
          value={pendingTransactions?.length || 0}
          label="معاملات معلقة"
          colorClass="text-yellow-600"
          bgClass="bg-yellow-500/10"
        />
      </AdminStatsGrid>

      {/* Tabs */}
      <Tabs defaultValue="pending" className="mt-6">
        <TabsList className="admin-tabs">
          <TabsTrigger value="pending" className="admin-tab">المعاملات المعلقة</TabsTrigger>
          <TabsTrigger value="wallets" className="admin-tab">أرصدة الزبائن</TabsTrigger>
        </TabsList>

        <TabsContent value="pending" className="mt-4">
          <AdminSection>
            {isLoading ? (
              <AdminLoading />
            ) : !pendingTransactions || pendingTransactions.length === 0 ? (
              <AdminEmptyState
                icon={<Wallet className="h-12 w-12" />}
                title="لا توجد معاملات معلقة"
                description="جميع المعاملات تمت معالجتها"
              />
            ) : (
              <div className="admin-table-wrapper">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">النوع</TableHead>
                      <TableHead className="text-right">طريقة الدفع</TableHead>
                      <TableHead className="text-right">المبلغ</TableHead>
                      <TableHead className="text-right">الإثبات</TableHead>
                      <TableHead className="text-right">الحالة</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {pendingTransactions.map((transaction: any) => (
                      <TableRow key={transaction.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{transaction.profiles?.full_name || transaction.profiles?.username}</p>
                            <p className="text-xs text-muted-foreground">{transaction.profiles?.phone_number}</p>
                          </div>
                        </TableCell>
                        <TableCell>
                          <Badge variant={transaction.type === 'deposit' ? 'default' : 'secondary'}>
                            {transaction.type === 'deposit' ? 'تعبئة' : 'سحب'}
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <span className="text-sm text-muted-foreground">
                            {transaction.payment_method || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="font-medium">{formatPrice(transaction.amount)}</TableCell>
                        <TableCell>
                          {transaction.payment_proof_url ? (
                            <a
                              href={transaction.payment_proof_url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 text-primary hover:underline"
                            >
                              <ImageIcon className="h-4 w-4" />
                              <span className="text-xs">عرض</span>
                              <ExternalLink className="h-3 w-3" />
                            </a>
                          ) : (
                            <span className="text-xs text-muted-foreground">-</span>
                          )}
                        </TableCell>
                        <TableCell>
                          <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600">
                            معلقة
                          </Badge>
                        </TableCell>
                        <TableCell>
                          <div className="flex gap-2">
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-green-600 hover:bg-green-50"
                              onClick={() => handleApprove(transaction)}
                            >
                              <Check className="h-4 w-4" />
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              className="text-red-600 hover:bg-red-50"
                              onClick={() => handleReject(transaction.id)}
                            >
                              <X className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AdminSection>
        </TabsContent>

        <TabsContent value="wallets" className="mt-4">
          <AdminSection>
            <div className="mb-4">
              <div className="relative">
                <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="بحث عن مستخدم..."
                  value={walletSearchQuery}
                  onChange={(e) => setWalletSearchQuery(e.target.value)}
                  className="pr-10"
                />
              </div>
            </div>

            {loadingWallets ? (
              <AdminLoading />
            ) : filteredCustomerWallets.length === 0 ? (
              <AdminEmptyState
                icon={<Wallet className="h-12 w-12" />}
                title="لا توجد محافظ"
                description="لم يتم إنشاء أي محفظة بعد"
              />
            ) : (
              <div className="admin-table-wrapper">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="text-right">المستخدم</TableHead>
                      <TableHead className="text-right">رقم الهاتف</TableHead>
                      <TableHead className="text-right">الرصيد</TableHead>
                      <TableHead className="text-right">الإجراءات</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredCustomerWallets.map((wallet: any) => (
                      <TableRow key={wallet.id}>
                        <TableCell>
                          <div>
                            <p className="font-medium">{wallet.profile?.full_name || wallet.profile?.username}</p>
                            <p className="text-xs text-muted-foreground">{wallet.profile?.email}</p>
                          </div>
                        </TableCell>
                        <TableCell>{wallet.profile?.phone_number || '-'}</TableCell>
                        <TableCell className="font-medium text-primary">{formatPrice(wallet.balance)}</TableCell>
                        <TableCell>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedCustomerForHistory(wallet);
                              setShowCustomerHistoryDialog(true);
                            }}
                          >
                            <History className="h-4 w-4 ml-1" />
                            السجل
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </AdminSection>
        </TabsContent>
      </Tabs>

      {/* Add Funds Dialog */}
      <Dialog open={showAddFundsDialog} onOpenChange={setShowAddFundsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>إضافة رصيد للمستخدم</DialogTitle>
            <DialogDescription>ابحث عن المستخدم وحدد المبلغ المراد إضافته</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="admin-form-group">
              <Label>البحث عن مستخدم</Label>
              <Input
                placeholder="اسم، هاتف، أو بريد إلكتروني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {searchResults && searchResults.length > 0 && !selectedUser && (
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {searchResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full p-3 text-right hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{u.full_name || u.username}</p>
                    <p className="text-xs text-muted-foreground">{u.phone_number}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedUser.full_name || selectedUser.username}</p>
                    <p className="text-xs text-muted-foreground">الرصيد الحالي: {formatPrice(selectedUserWallet?.balance || 0)}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="admin-form-group">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={addAmount}
                onChange={(e) => setAddAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div className="admin-form-group">
              <Label>ملاحظات (اختياري)</Label>
              <Input
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="سبب الإضافة..."
              />
            </div>

            <Button 
              onClick={handleAddFunds} 
              disabled={addFundsToUser.isPending || !selectedUser}
              className="w-full"
            >
              {addFundsToUser.isPending ? 'جاري الإضافة...' : 'إضافة الرصيد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deduct Funds Dialog */}
      <Dialog open={showDeductFundsDialog} onOpenChange={setShowDeductFundsDialog}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>خصم رصيد من المستخدم</DialogTitle>
            <DialogDescription>ابحث عن المستخدم وحدد المبلغ المراد خصمه</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="admin-form-group">
              <Label>البحث عن مستخدم</Label>
              <Input
                placeholder="اسم، هاتف، أو بريد إلكتروني..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
            
            {searchResults && searchResults.length > 0 && !selectedUser && (
              <div className="max-h-40 overflow-y-auto border rounded-lg divide-y">
                {searchResults.map((u: any) => (
                  <button
                    key={u.id}
                    onClick={() => setSelectedUser(u)}
                    className="w-full p-3 text-right hover:bg-muted/50 transition-colors"
                  >
                    <p className="font-medium">{u.full_name || u.username}</p>
                    <p className="text-xs text-muted-foreground">{u.phone_number}</p>
                  </button>
                ))}
              </div>
            )}

            {selectedUser && (
              <div className="p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{selectedUser.full_name || selectedUser.username}</p>
                    <p className="text-xs text-muted-foreground">الرصيد الحالي: {formatPrice(selectedUserWallet?.balance || 0)}</p>
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => setSelectedUser(null)}>
                    <X className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}

            <div className="admin-form-group">
              <Label>المبلغ</Label>
              <Input
                type="number"
                value={deductAmount}
                onChange={(e) => setDeductAmount(e.target.value)}
                placeholder="0"
              />
            </div>
            
            <div className="admin-form-group">
              <Label>سبب الخصم</Label>
              <Input
                value={deductNotes}
                onChange={(e) => setDeductNotes(e.target.value)}
                placeholder="سبب الخصم..."
              />
            </div>

            <Button 
              onClick={handleDeductFunds} 
              disabled={deductFundsFromUser.isPending || !selectedUser}
              className="w-full"
              variant="destructive"
            >
              {deductFundsFromUser.isPending ? 'جاري الخصم...' : 'خصم الرصيد'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Customer History Dialog */}
      <Dialog open={showCustomerHistoryDialog} onOpenChange={setShowCustomerHistoryDialog}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>سجل معاملات {selectedCustomerForHistory?.profile?.full_name}</DialogTitle>
          </DialogHeader>
          {customerTransactionHistory && customerTransactionHistory.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="text-right">النوع</TableHead>
                  <TableHead className="text-right">المبلغ</TableHead>
                  <TableHead className="text-right">الحالة</TableHead>
                  <TableHead className="text-right">التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {customerTransactionHistory.map((t: any) => (
                  <TableRow key={t.id}>
                    <TableCell>
                      <Badge variant={t.type === 'deposit' ? 'default' : 'secondary'}>
                        {t.type === 'deposit' ? 'تعبئة' : t.type === 'withdrawal' ? 'سحب' : 'خصم'}
                      </Badge>
                    </TableCell>
                    <TableCell className="font-medium">{formatPrice(t.amount)}</TableCell>
                    <TableCell>
                      <Badge variant={t.status === 'completed' ? 'default' : t.status === 'rejected' ? 'destructive' : 'outline'}>
                        {t.status === 'completed' ? 'مكتمل' : t.status === 'pending' ? 'معلق' : 'مرفوض'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(t.created_at).toLocaleDateString('ar-IQ')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-center text-muted-foreground py-8">لا توجد معاملات</p>
          )}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
