import { useState, useRef } from "react";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { toast } from "sonner";
import { Wallet, Upload, Download, Image as ImageIcon, Copy, Check, Loader2 } from "lucide-react";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

interface PaymentMethod {
  id: string;
  name: string;
  name_en: string;
  account_number: string;
  is_active: boolean;
}

interface WalletSettings {
  min_withdrawal_amount: number;
  max_withdrawal_amount: number;
  payment_methods: PaymentMethod[];
}

export default function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // جلب إعدادات المحفظة
  const { data: walletSettings } = useQuery({
    queryKey: ["wallet-settings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("default_settings")
        .select("setting_value")
        .eq("setting_key", "wallet_settings")
        .maybeSingle();
      
      if (error) throw error;
      return data?.setting_value as unknown as WalletSettings | null;
    },
    enabled: open,
  });

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

  const activePaymentMethods = walletSettings?.payment_methods?.filter(m => m.is_active) || [];
  const minWithdrawal = walletSettings?.min_withdrawal_amount || 5000;

  // رفع صورة إثبات الدفع
  const handleUploadProof = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('order-files')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('order-files')
        .getPublicUrl(fileName);

      setPaymentProofUrl(publicUrl);
      toast.success('تم رفع الصورة بنجاح');
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error('حدث خطأ في رفع الصورة');
    } finally {
      setUploadingProof(false);
    }
  };

  // نسخ رقم الحساب
  const copyAccountNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success('تم نسخ الرقم');
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  // طلب تعبئة المحفظة
  const depositWallet = useMutation({
    mutationFn: async ({ amount, paymentMethod, proofUrl }: { amount: number; paymentMethod: string; proofUrl: string }) => {
      const { error } = await supabase
        .from('wallet_transactions')
        .insert({
          user_id: user!.id,
          type: 'deposit',
          amount: amount,
          status: 'pending',
          payment_method: paymentMethod,
          payment_proof_url: proofUrl,
        });

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["walletTransactions"] });
      queryClient.invalidateQueries({ queryKey: ["wallet"] });
      queryClient.invalidateQueries({ queryKey: ["wallet-balance"] });
      toast.success('تم إرسال طلب التعبئة! سيتم المراجعة من قبل الإدارة');
      resetDepositForm();
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

      if (amount < minWithdrawal) {
        throw new Error(`الحد الأدنى للسحب هو ${minWithdrawal.toLocaleString()} دينار عراقي`);
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

  const resetDepositForm = () => {
    setDepositAmount("");
    setSelectedPaymentMethod("");
    setPaymentProofUrl("");
  };

  const handleDepositClick = () => {
    const amount = Number(depositAmount);
    if (!amount || amount <= 0) {
      toast.error('الرجاء إدخال مبلغ صحيح');
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error('الرجاء اختيار طريقة الدفع');
      return;
    }
    if (!paymentProofUrl) {
      toast.error('الرجاء رفع صورة إثبات الدفع');
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
    if (amount < minWithdrawal) {
      toast.error(`الحد الأدنى للسحب هو ${minWithdrawal.toLocaleString()} دينار عراقي`);
      return;
    }
    if (wallet && amount > wallet.balance) {
      toast.error('رصيد غير كافٍ');
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const confirmDeposit = () => {
    const amount = Number(depositAmount);
    depositWallet.mutate({
      amount,
      paymentMethod: selectedPaymentMethod,
      proofUrl: paymentProofUrl,
    });
    setShowDepositConfirm(false);
  };

  const confirmWithdraw = () => {
    const amount = Number(withdrawAmount);
    withdrawWallet.mutate(amount);
    setShowWithdrawConfirm(false);
  };

  const getSelectedMethodDetails = () => {
    return activePaymentMethods.find(m => m.id === selectedPaymentMethod);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetDepositForm();
      }}>
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
                <Wallet className="h-4 w-4" />
                رصيد المحفظة
              </CardTitle>
              <CardDescription>رصيدك الحالي في المحفظة</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="text-center p-6 bg-gradient-to-br from-primary/10 to-primary/5 rounded-lg">
                <p className="text-4xl font-bold text-primary mb-2">
                  {wallet?.balance?.toLocaleString() || "0"}
                </p>
                <p className="text-sm text-muted-foreground">{wallet?.currency || "دينار عراقي"}</p>
              </div>
            </CardContent>
          </Card>

          <div className="grid md:grid-cols-2 gap-6">
            {/* قسم التعبئة */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Upload className="h-4 w-4" />
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

                {/* اختيار طريقة الدفع */}
                {activePaymentMethods.length > 0 && (
                  <div className="space-y-2">
                    <Label>طريقة الدفع</Label>
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                      className="space-y-2"
                    >
                      {activePaymentMethods.map((method) => (
                        <div key={method.id} className="flex items-center space-x-2 space-x-reverse">
                          <RadioGroupItem value={method.id} id={method.id} />
                          <Label htmlFor={method.id} className="flex-1 cursor-pointer">
                            <div className="flex items-center justify-between">
                              <span>{method.name}</span>
                            </div>
                          </Label>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* عرض رقم الحساب المحدد */}
                {selectedPaymentMethod && getSelectedMethodDetails() && (
                  <div className="p-3 bg-muted rounded-lg space-y-2">
                    <p className="text-sm font-medium">رقم الحساب للتحويل:</p>
                    <div className="flex items-center justify-between gap-2">
                      <code className="flex-1 text-sm bg-background p-2 rounded border">
                        {getSelectedMethodDetails()?.account_number}
                      </code>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyAccountNumber(getSelectedMethodDetails()?.account_number || '')}
                      >
                        {copiedNumber === getSelectedMethodDetails()?.account_number ? (
                          <Check className="h-4 w-4" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                    </div>
                  </div>
                )}

                {/* رفع صورة إثبات الدفع */}
                <div className="space-y-2">
                  <Label>صورة إثبات الدفع</Label>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleUploadProof}
                    className="hidden"
                  />
                  {paymentProofUrl ? (
                    <div className="relative">
                      <img
                        src={paymentProofUrl}
                        alt="إثبات الدفع"
                        className="w-full h-32 object-cover rounded-lg border"
                      />
                      <Button
                        size="sm"
                        variant="destructive"
                        className="absolute top-2 left-2"
                        onClick={() => setPaymentProofUrl("")}
                      >
                        حذف
                      </Button>
                    </div>
                  ) : (
                    <Button
                      variant="outline"
                      className="w-full h-24 border-dashed"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingProof}
                    >
                      {uploadingProof ? (
                        <Loader2 className="h-6 w-6 animate-spin" />
                      ) : (
                        <div className="flex flex-col items-center gap-2">
                          <ImageIcon className="h-6 w-6" />
                          <span className="text-sm">اضغط لرفع الصورة</span>
                        </div>
                      )}
                    </Button>
                  )}
                </div>

                <Button 
                  onClick={handleDepositClick} 
                  disabled={depositWallet.isPending || !depositAmount || !selectedPaymentMethod || !paymentProofUrl} 
                  className="w-full"
                >
                  {depositWallet.isPending ? "جاري الإرسال..." : "طلب التعبئة"}
                </Button>
              </CardContent>
            </Card>

            {/* قسم السحب */}
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Download className="h-4 w-4" />
                  سحب الرصيد
                </CardTitle>
                <CardDescription>
                  الحد الأدنى للسحب: {minWithdrawal.toLocaleString()} دينار عراقي
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="withdrawAmount">المبلغ</Label>
                  <Input
                    id="withdrawAmount"
                    type="number"
                    placeholder={`أدخل المبلغ (الحد الأدنى ${minWithdrawal.toLocaleString()})`}
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={wallet?.balance || 0}
                    min={minWithdrawal}
                    autoFocus={false}
                  />
                  {Number(withdrawAmount) > 0 && Number(withdrawAmount) < minWithdrawal && (
                    <p className="text-xs text-destructive">
                      الحد الأدنى للسحب {minWithdrawal.toLocaleString()} دينار عراقي
                    </p>
                  )}
                </div>
                <Button 
                  onClick={handleWithdrawClick} 
                  disabled={
                    withdrawWallet.isPending || 
                    !wallet || 
                    wallet.balance <= 0 ||
                    Number(withdrawAmount) < minWithdrawal
                  } 
                  className="w-full" 
                  variant="outline"
                >
                  {withdrawWallet.isPending ? "جاري الإرسال..." : "طلب السحب"}
                </Button>
              </CardContent>
            </Card>
          </div>

          {/* سجل المعاملات */}
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
                            {transaction.type === 'admin_deduction' && 'خصم إداري'}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {new Date(transaction.created_at).toLocaleDateString('ar-IQ')}
                          </p>
                          {transaction.payment_method && (
                            <p className="text-xs text-muted-foreground">
                              طريقة الدفع: {transaction.payment_method === 'mastercard_rafidain' ? 'ماستر كارد الرافدين' : transaction.payment_method === 'zaincash' ? 'زين كاش' : transaction.payment_method}
                            </p>
                          )}
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
                        <div className={`text-lg font-bold ${transaction.type === 'withdrawal' || transaction.type === 'order_payment' || transaction.type === 'admin_deduction' ? 'text-red-600' : 'text-green-600'}`}>
                          {transaction.type === 'withdrawal' || transaction.type === 'order_payment' || transaction.type === 'admin_deduction' ? '-' : '+'}
                          {transaction.amount?.toLocaleString()}
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
              هل أنت متأكد من إرسال طلب تعبئة المحفظة بمبلغ {Number(depositAmount).toLocaleString()} دينار عراقي؟
              <br />
              طريقة الدفع: {getSelectedMethodDetails()?.name}
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
              هل أنت متأكد من إرسال طلب سحب {Number(withdrawAmount).toLocaleString()} دينار عراقي من محفظتك؟
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
