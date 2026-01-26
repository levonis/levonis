import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Dialog, DialogContent } from "@/components/ui/dialog";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ScrollArea } from "@/components/ui/scroll-area";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { toast } from "sonner";
import { 
  Wallet, 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Loader2, 
  CreditCard,
  ChevronDown,
  ChevronUp,
  TrendingUp,
  TrendingDown,
  Clock,
  CheckCircle2,
  XCircle,
  Sparkles
} from "lucide-react";
import { cn } from "@/lib/utils";

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
  usd_to_iqd_rate: number;
  payment_methods: PaymentMethod[];
}

export default function WalletDialog({ open, onOpenChange }: WalletDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  
  // Form states
  const [depositAmount, setDepositAmount] = useState("");
  const [stripeAmount, setStripeAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const [stripeLoading, setStripeLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI states
  const [activeTab, setActiveTab] = useState<"stripe" | "transfer">("stripe");
  const [withdrawOpen, setWithdrawOpen] = useState(false);
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);

  // Fetch wallet settings
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

  // Fetch wallet balance
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

  // Fetch wallet transactions
  const { data: walletTransactions } = useQuery({
    queryKey: ["walletTransactions", user?.id],
    queryFn: async () => {
      if (!user?.id) return [];
      const { data, error } = await supabase
        .from("wallet_transactions")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })
        .limit(20);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  const activePaymentMethods = walletSettings?.payment_methods?.filter(m => m.is_active) || [];
  const minWithdrawal = walletSettings?.min_withdrawal_amount || 5000;
  const usdRate = walletSettings?.usd_to_iqd_rate || 1460;

  // Upload payment proof
  const handleUploadProof = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !user?.id) return;

    setUploadingProof(true);
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;
      
      const { error: uploadError } = await supabase.storage
        .from('payment-proofs')
        .upload(fileName, file);

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('payment-proofs')
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

  // Copy account number
  const copyAccountNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success('تم نسخ الرقم');
    setTimeout(() => setCopiedNumber(null), 2000);
  };

  // Deposit via bank transfer
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
      toast.success('تم إرسال طلب التعبئة بنجاح');
      resetDepositForm();
    },
    onError: (error) => {
      console.error('Error:', error);
      toast.error('حدث خطأ في إرسال الطلب');
    },
  });

  // Withdrawal request
  const withdrawWallet = useMutation({
    mutationFn: async (amount: number) => {
      if (!wallet || wallet.balance < amount) {
        throw new Error('رصيد غير كافٍ');
      }

      if (amount < minWithdrawal) {
        throw new Error(`الحد الأدنى للسحب هو ${minWithdrawal.toLocaleString()} د.ع`);
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
      toast.success('تم إرسال طلب السحب بنجاح');
      setWithdrawAmount("");
      setWithdrawOpen(false);
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ');
    },
  });

  const resetDepositForm = () => {
    setDepositAmount("");
    setStripeAmount("");
    setSelectedPaymentMethod("");
    setPaymentProofUrl("");
  };

  // Stripe payment handler
  const handleStripePayment = async () => {
    const amount = Number(stripeAmount);
    const minAmount = Math.ceil(50 * usdRate / 100); // Minimum $0.50 in IQD
    
    if (!amount || amount < minAmount) {
      toast.error(`الحد الأدنى للدفع هو ${minAmount.toLocaleString()} د.ع`);
      return;
    }

    setStripeLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('create-wallet-payment', {
        body: { amount, usdRate },
      });

      if (error) throw error;
      if (data?.url) {
        window.open(data.url, '_blank');
        onOpenChange(false);
      } else {
        throw new Error('لم يتم الحصول على رابط الدفع');
      }
    } catch (err: any) {
      console.error('Stripe payment error:', err);
      toast.error(err.message || 'حدث خطأ في بدء عملية الدفع');
    } finally {
      setStripeLoading(false);
    }
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
    if (!amount || amount <= 0 || amount < minWithdrawal) {
      toast.error(`الحد الأدنى للسحب هو ${minWithdrawal.toLocaleString()} د.ع`);
      return;
    }
    if (wallet && amount > wallet.balance) {
      toast.error('رصيد غير كافٍ');
      return;
    }
    setShowWithdrawConfirm(true);
  };

  const confirmDeposit = () => {
    depositWallet.mutate({
      amount: Number(depositAmount),
      paymentMethod: selectedPaymentMethod,
      proofUrl: paymentProofUrl,
    });
    setShowDepositConfirm(false);
  };

  const confirmWithdraw = () => {
    withdrawWallet.mutate(Number(withdrawAmount));
    setShowWithdrawConfirm(false);
  };

  const getSelectedMethodDetails = () => {
    return activePaymentMethods.find(m => m.id === selectedPaymentMethod);
  };

  const getTransactionIcon = (type: string, status: string) => {
    if (status === 'pending') return <Clock className="h-4 w-4 text-yellow-500" />;
    if (status === 'rejected') return <XCircle className="h-4 w-4 text-destructive" />;
    if (type === 'deposit' || type === 'admin_addition' || type === 'points_conversion') {
      return <TrendingUp className="h-4 w-4 text-green-500" />;
    }
    return <TrendingDown className="h-4 w-4 text-red-500" />;
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: 'تعبئة',
      withdrawal: 'سحب',
      points_conversion: 'تحويل نقاط',
      order_payment: 'دفع طلب',
      admin_deduction: 'خصم إداري',
      admin_addition: 'إضافة إدارية',
      purchase: 'شراء',
      competition_ticket: 'تذكرة مسابقة',
    };
    return labels[type] || type;
  };

  const getStatusBadge = (status: string) => {
    const styles: Record<string, string> = {
      pending: 'bg-yellow-500/10 text-yellow-600 border-yellow-500/20',
      completed: 'bg-green-500/10 text-green-600 border-green-500/20',
      approved: 'bg-green-500/10 text-green-600 border-green-500/20',
      rejected: 'bg-destructive/10 text-destructive border-destructive/20',
    };
    const labels: Record<string, string> = {
      pending: 'قيد المراجعة',
      completed: 'مكتمل',
      approved: 'موافق عليه',
      rejected: 'مرفوض',
    };
    return (
      <span className={cn("text-[10px] px-1.5 py-0.5 rounded border", styles[status] || '')}>
        {labels[status] || status}
      </span>
    );
  };

  return (
    <>
      <Dialog open={open} onOpenChange={(open) => {
        onOpenChange(open);
        if (!open) resetDepositForm();
      }}>
        <DialogContent 
          className="max-w-lg p-0 gap-0 overflow-hidden max-h-[90vh] flex flex-col" 
          dir="rtl"
          onOpenAutoFocus={(e) => e.preventDefault()}
        >
          {/* Premium Header */}
          <header className="relative overflow-hidden bg-gradient-to-br from-primary/20 via-accent/10 to-transparent p-5 border-b border-primary/20">
            <div className="absolute top-0 left-0 w-40 h-40 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 right-0 w-32 h-32 bg-accent/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />
            
            <div className="relative flex items-center gap-4">
              <div className="h-14 w-14 rounded-2xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
                <div className="h-full w-full rounded-2xl bg-card flex items-center justify-center">
                  <Wallet className="h-6 w-6 text-primary" />
                </div>
              </div>
              
              <div className="flex-1">
                <h2 className="text-lg font-bold text-foreground mb-0.5">المحفظة</h2>
                <p className="text-xs text-muted-foreground">إدارة رصيدك ومعاملاتك</p>
              </div>
            </div>
            
            {/* Balance Card */}
            <div className="relative mt-4 p-4 rounded-xl bg-gradient-to-br from-card via-card to-primary/5 border border-primary/20 shadow-lg">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground mb-1">رصيدك الحالي</p>
                  <p className="text-3xl font-bold text-foreground">
                    {wallet?.balance?.toLocaleString() || "0"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">دينار عراقي</p>
                </div>
                <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
              </div>
            </div>
          </header>

          {/* Scrollable Content */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {/* Deposit Section */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="p-4 border-b border-border/30 bg-muted/30">
                <div className="flex items-center gap-2">
                  <div className="h-8 w-8 rounded-lg bg-green-500/10 flex items-center justify-center">
                    <Upload className="h-4 w-4 text-green-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold">تعبئة المحفظة</h3>
                    <p className="text-[11px] text-muted-foreground">اختر طريقة الدفع المناسبة</p>
                  </div>
                </div>
              </div>
              
              <div className="p-4 space-y-4">
                {/* Payment Method Tabs */}
                <div className="flex gap-2">
                  <button
                    onClick={() => setActiveTab("stripe")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all",
                      activeTab === "stripe"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <CreditCard className="h-4 w-4" />
                    بطاقة ائتمان
                  </button>
                  <button
                    onClick={() => setActiveTab("transfer")}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg text-sm font-medium transition-all",
                      activeTab === "transfer"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted/50 text-muted-foreground hover:bg-muted"
                    )}
                  >
                    <Upload className="h-4 w-4" />
                    تحويل بنكي
                  </button>
                </div>

                {/* Stripe Tab Content */}
                {activeTab === "stripe" && (
                  <div className="space-y-3">
                    <div className="p-3 rounded-lg bg-primary/5 border border-primary/10">
                      <p className="text-xs text-muted-foreground">
                        💳 ادفع ببطاقتك الائتمانية وسيتم إضافة الرصيد فوراً
                      </p>
                    </div>
                    
                    <div className="space-y-2">
                      <Label className="text-xs">المبلغ (دينار عراقي)</Label>
                      <Input
                        type="number"
                        placeholder={`الحد الأدنى ${Math.ceil(50 * usdRate / 100).toLocaleString()}`}
                        value={stripeAmount}
                        onChange={(e) => setStripeAmount(e.target.value)}
                        className="h-11"
                      />
                      {stripeAmount && Number(stripeAmount) > 0 && (
                        <p className="text-xs text-muted-foreground">
                          ≈ ${(Number(stripeAmount) / usdRate).toFixed(2)} دولار أمريكي
                        </p>
                      )}
                    </div>

                    <Button 
                      onClick={handleStripePayment}
                      disabled={stripeLoading || !stripeAmount || Number(stripeAmount) < Math.ceil(50 * usdRate / 100)}
                      className="w-full h-11 gap-2 bg-gradient-to-r from-primary to-accent"
                    >
                      {stripeLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          جاري التحميل...
                        </>
                      ) : (
                        <>
                          <CreditCard className="h-4 w-4" />
                          الدفع الآن
                        </>
                      )}
                    </Button>
                  </div>
                )}

                {/* Bank Transfer Tab Content */}
                {activeTab === "transfer" && (
                  <div className="space-y-3">
                    <div className="space-y-2">
                      <Label className="text-xs">المبلغ</Label>
                      <Input
                        type="number"
                        placeholder="أدخل المبلغ"
                        value={depositAmount}
                        onChange={(e) => setDepositAmount(e.target.value)}
                        className="h-10"
                      />
                    </div>

                    {activePaymentMethods.length > 0 && (
                      <div className="space-y-2">
                        <Label className="text-xs">طريقة الدفع</Label>
                        <RadioGroup
                          value={selectedPaymentMethod}
                          onValueChange={setSelectedPaymentMethod}
                          className="space-y-1.5"
                        >
                          {activePaymentMethods.map((method) => (
                            <div key={method.id} className="flex items-center gap-2 p-2 rounded-lg border border-border/50 hover:bg-muted/30 transition-colors">
                              <RadioGroupItem value={method.id} id={method.id} />
                              <Label htmlFor={method.id} className="flex-1 text-sm cursor-pointer">
                                {method.name}
                              </Label>
                            </div>
                          ))}
                        </RadioGroup>
                      </div>
                    )}

                    {selectedPaymentMethod && getSelectedMethodDetails() && (
                      <div className="p-3 bg-muted/50 rounded-lg space-y-2">
                        <p className="text-xs font-medium">رقم الحساب للتحويل:</p>
                        <div className="flex items-center gap-2">
                          <code className="flex-1 text-xs bg-background p-2 rounded border font-mono">
                            {getSelectedMethodDetails()?.account_number}
                          </code>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-8 w-8 p-0"
                            onClick={() => copyAccountNumber(getSelectedMethodDetails()?.account_number || '')}
                          >
                            {copiedNumber === getSelectedMethodDetails()?.account_number ? (
                              <Check className="h-3.5 w-3.5 text-green-600" />
                            ) : (
                              <Copy className="h-3.5 w-3.5" />
                            )}
                          </Button>
                        </div>
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label className="text-xs">صورة إثبات الدفع</Label>
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
                            className="w-full h-24 object-cover rounded-lg border"
                          />
                          <Button
                            size="sm"
                            variant="destructive"
                            className="absolute top-1.5 left-1.5 h-6 text-[10px] px-2"
                            onClick={() => setPaymentProofUrl("")}
                          >
                            حذف
                          </Button>
                        </div>
                      ) : (
                        <button
                          onClick={() => fileInputRef.current?.click()}
                          disabled={uploadingProof}
                          className="w-full h-20 border-2 border-dashed border-border/50 rounded-lg flex flex-col items-center justify-center gap-1 hover:bg-muted/30 transition-colors"
                        >
                          {uploadingProof ? (
                            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                          ) : (
                            <>
                              <ImageIcon className="h-5 w-5 text-muted-foreground" />
                              <span className="text-[11px] text-muted-foreground">اضغط لرفع الصورة</span>
                            </>
                          )}
                        </button>
                      )}
                    </div>

                    <Button 
                      onClick={handleDepositClick} 
                      disabled={depositWallet.isPending || !depositAmount || !selectedPaymentMethod || !paymentProofUrl} 
                      className="w-full h-10"
                    >
                      {depositWallet.isPending ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin ml-2" />
                          جاري الإرسال...
                        </>
                      ) : (
                        "طلب التعبئة"
                      )}
                    </Button>
                  </div>
                )}
              </div>
            </div>

            {/* Withdrawal Section - Collapsible */}
            <Collapsible open={withdrawOpen} onOpenChange={setWithdrawOpen}>
              <CollapsibleTrigger asChild>
                <button className="w-full rounded-xl border border-border/50 bg-card p-4 flex items-center justify-between hover:bg-muted/30 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-red-500/10 flex items-center justify-center">
                      <Download className="h-4 w-4 text-red-600" />
                    </div>
                    <div className="text-right">
                      <h3 className="text-sm font-semibold">سحب الرصيد</h3>
                      <p className="text-[11px] text-muted-foreground">الحد الأدنى: {minWithdrawal.toLocaleString()} د.ع</p>
                    </div>
                  </div>
                  {withdrawOpen ? (
                    <ChevronUp className="h-5 w-5 text-muted-foreground" />
                  ) : (
                    <ChevronDown className="h-5 w-5 text-muted-foreground" />
                  )}
                </button>
              </CollapsibleTrigger>
              
              <CollapsibleContent className="mt-2">
                <div className="rounded-xl border border-border/50 bg-card p-4 space-y-3">
                  <div className="space-y-2">
                    <Label className="text-xs">المبلغ</Label>
                    <Input
                      type="number"
                      placeholder={`الحد الأدنى ${minWithdrawal.toLocaleString()}`}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      max={wallet?.balance || 0}
                      min={minWithdrawal}
                      className="h-10"
                    />
                    {Number(withdrawAmount) > 0 && Number(withdrawAmount) < minWithdrawal && (
                      <p className="text-[10px] text-destructive">
                        الحد الأدنى للسحب {minWithdrawal.toLocaleString()} د.ع
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
                    className="w-full h-10" 
                    variant="outline"
                  >
                    {withdrawWallet.isPending ? (
                      <>
                        <Loader2 className="h-4 w-4 animate-spin ml-2" />
                        جاري الإرسال...
                      </>
                    ) : (
                      "طلب السحب"
                    )}
                  </Button>
                </div>
              </CollapsibleContent>
            </Collapsible>

            {/* Transactions */}
            <div className="rounded-xl border border-border/50 bg-card overflow-hidden">
              <div className="p-3 border-b border-border/30 bg-muted/30">
                <h3 className="text-sm font-semibold">سجل المعاملات</h3>
              </div>
              <ScrollArea className="h-[200px]">
                {walletTransactions && walletTransactions.length > 0 ? (
                  <div className="divide-y divide-border/30">
                    {walletTransactions.map((tx: any) => (
                      <div key={tx.id} className="flex items-center gap-3 p-3 hover:bg-muted/20">
                        {getTransactionIcon(tx.type, tx.status)}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getTransactionLabel(tx.type)}</span>
                            {getStatusBadge(tx.status)}
                          </div>
                          <p className="text-[10px] text-muted-foreground">
                            {new Date(tx.created_at).toLocaleDateString('ar-IQ', {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                            })}
                          </p>
                        </div>
                        <span className={cn(
                          "text-sm font-bold",
                          tx.type === 'withdrawal' || tx.type === 'order_payment' || tx.type === 'admin_deduction' || tx.type === 'purchase' || tx.type === 'competition_ticket' || tx.amount < 0
                            ? 'text-red-600'
                            : 'text-green-600'
                        )}>
                          {tx.type === 'withdrawal' || tx.type === 'order_payment' || tx.type === 'admin_deduction' || tx.type === 'purchase' || tx.type === 'competition_ticket' || tx.amount < 0 ? '-' : '+'}
                          {Math.abs(tx.amount).toLocaleString()}
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-muted-foreground">
                    <Wallet className="h-8 w-8 mb-2 opacity-40" />
                    <p className="text-sm">لا توجد معاملات بعد</p>
                  </div>
                )}
              </ScrollArea>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Deposit Confirmation */}
      <AlertDialog open={showDepositConfirm} onOpenChange={setShowDepositConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب التعبئة</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>المبلغ: <strong>{Number(depositAmount).toLocaleString()} د.ع</strong></p>
              <p>طريقة الدفع: <strong>{getSelectedMethodDetails()?.name}</strong></p>
              <p className="text-xs">سيتم مراجعة الطلب من قبل الإدارة</p>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeposit}>تأكيد</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw Confirmation */}
      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد طلب السحب</AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>المبلغ: <strong>{Number(withdrawAmount).toLocaleString()} د.ع</strong></p>
              <p className="text-xs">سيتم مراجعة الطلب من قبل الإدارة</p>
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
