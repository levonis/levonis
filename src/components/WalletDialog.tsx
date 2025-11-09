import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
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
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { toast } from "sonner";
import { Wallet, Upload, Download } from "lucide-react";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export default function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // جلب رصيد المحفظة
  const { data: wallet } = useQuery({
    queryKey: ["wallet", user?.id],
    queryFn: async () => {
      if (!user?.id) return null;
      const { data, error } = await supabase
        .from("user_wallets")
        .select("*")
        .eq("user_id", user.id)
        .maybeSingle();
      
      if (error && error.code !== "PGRST116") throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  // جلب معاملات المحفظة
  const { data: walletTransactions } = useQuery({
    queryKey: ["walletTransactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(50);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  // طلب تعبئة المحفظة
  const depositWallet = useMutation({
    mutationFn: async (amount: number) => {
      const { error } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user!.id,
          type: 'deposit',
          amount: amount,
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success('تم إرسال طلب التعبئة! سيتم المراجعة من قبل الإدارة');
      setDepositAmount("");
    },
    onError: (error) => {
      console.error('خطأ في طلب التعبئة:', error);
      toast.error('حدث خطأ في إرسال طلب التعبئة');
    },
  });

  // طلب سحب من المحفظة
  const withdrawWallet = useMutation({
    mutationFn: async (amount: number) => {
      if (!wallet || wallet.balance < amount) {
        throw new Error('رصيد غير كافٍ');
      }

      const { error } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user!.id,
          type: 'withdrawal',
          amount: amount,
          status: 'pending',
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success('تم إرسال طلب السحب! سيتم المراجعة من قبل الإدارة');
      setWithdrawAmount("");
    },
    onError: (error: any) => {
      console.error('خطأ في طلب السحب:', error);
      toast.error(error.message || 'حدث خطأ في إرسال طلب السحب');
    },
  });

  const handleDepositClick = () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    setShowDepositConfirm(true);
  };

  const handleWithdrawClick = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const confirmDeposit = () => {
    const amount = Number(depositAmount);
    depositWallet.mutate(amount);
    setShowDepositConfirm(false);
  };

  const confirmWithdraw = () => {
    const amount = Number(withdrawAmount);
    withdrawWallet.mutate(amount);
    setShowWithdrawConfirm(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent 
          className="max-w-4xl max-h-[90vh] overflow-y-auto" 
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Wallet className="h-6 w-6" />
            المحفظة
          </DialogTitle>
          <DialogDescription>
            إدارة رصيد المحفظة والمعاملات
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Wallet className="h-5 w-5" />
                رصيد المحفظة
              </CardTitle>
              <CardDescription>رصيدك الحالي في المحفظة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                <p className="text-4xl font-bold text-primary mb-2">
                  {wallet?.balance?.toFixed(2) || "0.00"}
                </p>
                <p className="text-sm text-muted-foreground">{wallet?.currency || "دينار عراقي"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-5 w-5" />
                  تعبئة المحفظة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="depositAmount">المبلغ</Label>
                  <Input
                    id="depositAmount"
                    type="number"
                    placeholder="أدخل المبلغ"
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    autoFocus={false}
                  />
                </div>
                <Button onClick={handleDepositClick} disabled={depositWallet.isPending} className="w-full">
                  {depositWallet.isPending ? "جاري الإرسال..." : "طلب التعبئة"}
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-5 w-5" />
                  سحب الرصيد
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">المبلغ</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    placeholder="أدخل المبلغ"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={wallet?.balance || 0}
                    autoFocus={false}
                  />
                </div>
                <Button onClick={handleWithdrawClick} disabled={withdrawWallet.isPending || !wallet || wallet.balance <= 0} className="w-full" variant="outline">
                  {withdrawWallet.isPending ? "جاري الإرسال..." : "طلب السحب"}
                </Button>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>سجل المعاملات</CardTitle>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[300px]">
                {walletTransactions && walletTransactions.length > 0 ? (
                  <div className="space-y-2">
                    {walletTransactions.map((transaction: any) => (
                      <div key={transaction.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/50">
                        <div className="flex-1">
                          <p className="font-medium">
                            {transaction.type === 'deposit' && 'تعبئة المحفظة'}
                            {transaction.type === 'withdrawal' && 'سحب من المحفظة'}
                            {transaction.type === 'points_conversion' && 'تحويل من النقاط'}
                            {transaction.type === 'order_payment' && 'دفع طلب'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleDateString('ar-IQ')}
                          </p>
                          <p className="text-xs">
                            الحالة: <span className={transaction.status === 'completed' || transaction.status === 'approved' ? 'text-green-600' : transaction.status === 'pending' ? 'text-yellow-600' : 'text-red-600'}>
                              {transaction.status === 'pending' && 'قيد المراجعة'}
                              {transaction.status === 'approved' && 'تمت الموافقة'}
                              {transaction.status === 'completed' && 'مكتمل'}
                              {transaction.status === 'rejected' && 'مرفوض'}
                            </span>
                          </p>
                          {transaction.admin_notes && (
                            <p className="text-xs text-muted-foreground mt-1">
                              ملاحظات: {transaction.admin_notes}
                            </p>
                          )}
                        </div>
                        <div className={`text-lg font-bold ${transaction.type === 'withdrawal' || transaction.type === 'order_payment' ? 'text-red-600' : 'text-green-600'}`}>
                          {transaction.type === 'withdrawal' || transaction.type === 'order_payment' ? '-' : '+'}
                          {transaction.amount}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-muted-foreground py-8">لا توجد معاملات بعد</p>
                )}
              </ScrollArea>
            </CardContent>
          </Card>
        </div>
      </DialogContent>
    </Dialog>

      {/* Deposit Confirmation Dialog */}
      <AlertDialog open={showDepositConfirm} onOpenChange={setShowDepositConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب التعبئة</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إرسال طلب تعبئة المحفظة بمبلغ {depositAmount} دينار عراقي؟
              <br />
              سيتم مراجعة الطلب من قبل الإدارة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeposit}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw Confirmation Dialog */}
      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب السحب</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من إرسال طلب سحب {withdrawAmount} دينار عراقي من محفظتك؟
              <br />
              سيتم مراجعة الطلب من قبل الإدارة.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWithdraw}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
