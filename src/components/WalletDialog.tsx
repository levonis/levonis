import { useState, useRef } from "react";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import OriginExpandShell, { type OriginRect } from "@/components/profile/OriginExpandShell";
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
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { 
  Wallet, 
  Upload, 
  Download, 
  Image as ImageIcon, 
  Copy, 
  Check, 
  Loader2, 
  ArrowUpRight,
  ArrowDownLeft,
  Clock,
  CheckCircle2,
  XCircle,
  History,
  Plus,
  Minus,
  Banknote
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/lib/i18n";

interface WalletDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  originRect?: OriginRect | null;
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

export default function WalletDialog({ open, onOpenChange, originRect }: WalletDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { t, language, dir } = useLanguage();
  const numLocale = language === 'en' ? 'en-US' : language === 'ku' ? 'ckb-IQ' : 'ar-IQ';
  const dateLocaleCode = language === 'en' ? 'en-US' : 'ar-IQ';
  const fmt = (n: number | undefined | null) => Number(n ?? 0).toLocaleString(numLocale);
  
  // Form states
  const [depositAmount, setDepositAmount] = useState("");
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState("");
  const [paymentProofUrl, setPaymentProofUrl] = useState("");
  const [uploadingProof, setUploadingProof] = useState(false);
  const [copiedNumber, setCopiedNumber] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  
  // UI states
  const [showDepositConfirm, setShowDepositConfirm] = useState(false);
  const [showWithdrawConfirm, setShowWithdrawConfirm] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState("deposit");

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
        .limit(15);
      
      if (error) throw error;
      return data;
    },
    enabled: !!user?.id && open,
  });

  const activePaymentMethods = walletSettings?.payment_methods?.filter(m => m.is_active) || [];
  const minWithdrawal = walletSettings?.min_withdrawal_amount || 5000;

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
      toast.success(t('wallet_toast_image_uploaded'));
    } catch (error) {
      console.error('Error uploading proof:', error);
      toast.error(t('wallet_toast_image_upload_error'));
    } finally {
      setUploadingProof(false);
    }
  };

  // Copy account number
  const copyAccountNumber = (number: string) => {
    navigator.clipboard.writeText(number);
    setCopiedNumber(number);
    toast.success(t('wallet_toast_number_copied'));
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
      toast.success(t('wallet_toast_deposit_sent'));
      resetDepositForm();
    },
    onError: (error) => {
      console.error('Error:', error);
      toast.error(t('wallet_toast_deposit_error'));
    },
  });

  // Withdrawal request
  const withdrawWallet = useMutation({
    mutationFn: async (amount: number) => {
      if (!wallet || wallet.balance < amount) {
        throw new Error(t('wallet_toast_insufficient_balance'));
      }

      if (amount < minWithdrawal) {
        throw new Error(t('wallet_toast_min_withdrawal', { amount: fmt(minWithdrawal) }));
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
      toast.success(t('wallet_toast_withdraw_sent'));
      setWithdrawAmount("");
    },
    onError: (error: any) => {
      toast.error(error.message || t('wallet_toast_generic_error'));
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
      toast.error(t('wallet_toast_invalid_amount'));
      return;
    }
    if (!selectedPaymentMethod) {
      toast.error(t('wallet_toast_choose_method'));
      return;
    }
    if (!paymentProofUrl) {
      toast.error(t('wallet_toast_upload_proof'));
      return;
    }
    setShowDepositConfirm(true);
  };

  const handleWithdrawClick = () => {
    const amount = Number(withdrawAmount);
    if (!amount || amount <= 0 || amount < minWithdrawal) {
      toast.error(t('wallet_toast_min_withdrawal', { amount: fmt(minWithdrawal) }));
      return;
    }
    if (wallet && amount > wallet.balance) {
      toast.error(t('wallet_toast_insufficient_balance'));
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

  const getTransactionIcon = (type: string, status: string) => {
    if (status === 'pending') return <Clock className="h-3.5 w-3.5" />;
    if (status === 'rejected') return <XCircle className="h-3.5 w-3.5" />;
    if (type === 'deposit' || type === 'admin_addition' || type === 'points_conversion') {
      return <ArrowDownLeft className="h-3.5 w-3.5" />;
    }
    return <ArrowUpRight className="h-3.5 w-3.5" />;
  };

  const getTransactionColor = (type: string, status: string) => {
    if (status === 'pending') return 'text-yellow-500 bg-yellow-500/10';
    if (status === 'rejected') return 'text-destructive bg-destructive/10';
    if (status === 'approved' || status === 'completed') {
      if (type === 'deposit' || type === 'admin_addition' || type === 'points_conversion') {
        return 'text-green-500 bg-green-500/10';
      }
    }
    if (type === 'deposit' || type === 'admin_addition' || type === 'points_conversion') {
      return 'text-green-500 bg-green-500/10';
    }
    return 'text-red-500 bg-red-500/10';
  };

  const getTransactionLabel = (type: string) => {
    const labels: Record<string, string> = {
      deposit: t('wallet_type_deposit'),
      withdrawal: t('wallet_type_withdrawal'),
      points_conversion: t('wallet_type_points_conversion'),
      order_payment: t('wallet_type_order_payment'),
      admin_deduction: t('wallet_type_admin_deduction'),
      admin_addition: t('wallet_type_admin_addition'),
      purchase: t('wallet_type_purchase'),
      product_purchase: t('wallet_type_product_purchase'),
      competition_ticket: t('wallet_type_competition_ticket'),
    };
    return labels[type] || type;
  };

  const getStatusLabel = (status: string) => {
    const labels: Record<string, string> = {
      pending: t('wallet_status_pending'),
      completed: t('wallet_status_completed'),
      approved: t('wallet_status_approved'),
      rejected: t('wallet_status_rejected'),
    };
    return labels[status] || status;
  };

  const isIncome = (type: string) => {
    return ['deposit', 'admin_addition', 'points_conversion'].includes(type);
  };

  return (
    <>
      <OriginExpandShell
        open={open}
        onOpenChange={(o) => {
          onOpenChange(o);
          if (!o) resetDepositForm();
        }}
        originRect={originRect ?? null}
        size="lg"
        bodyClassName="!p-0"
        title={
          <span className="flex items-center gap-2">
            <Wallet className="h-4 w-4 text-primary" />
            {t('wallet_title')}
          </span>
        }
      >


          {/* Compact Balance Header */}
          <div className="relative p-4 pb-3 border-b border-border/50">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 rounded-xl bg-gradient-to-br from-primary/20 to-primary/5 border border-primary/20 flex items-center justify-center">
                <Wallet className="h-5 w-5 text-primary" />
              </div>
              <div className="flex-1">
                <p className="text-xs text-muted-foreground">{t('wallet_balance_label')}</p>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-2xl font-bold text-foreground">
                    {fmt(wallet?.balance) || "0"}
                  </span>
                  <span className="text-xs text-muted-foreground">{t('wallet_currency_iqd')}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Main Tabs */}
          <Tabs value={activeMainTab} onValueChange={setActiveMainTab} className="flex-1 flex flex-col min-h-0">
            <TabsList className="grid grid-cols-3 m-3 mb-0 bg-muted/50 p-1 h-10">
              <TabsTrigger value="deposit" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Plus className="h-3.5 w-3.5" />
                {t('wallet_tab_deposit')}
              </TabsTrigger>
              <TabsTrigger value="withdraw" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <Minus className="h-3.5 w-3.5" />
                {t('wallet_tab_withdraw')}
              </TabsTrigger>
              <TabsTrigger value="history" className="text-xs gap-1.5 data-[state=active]:bg-background">
                <History className="h-3.5 w-3.5" />
                {t('wallet_tab_history')}
              </TabsTrigger>
            </TabsList>

            {/* Deposit Tab */}
            <TabsContent value="deposit" className="flex-1 m-0 overflow-y-auto">
              <div className="p-3 space-y-3">
                {/* Bank Transfer Info */}
                <div className="p-3 rounded-xl bg-gradient-to-br from-primary/5 to-transparent border border-primary/10">
                  <div className="flex items-start gap-2">
                    <Banknote className="h-4 w-4 text-primary mt-0.5 shrink-0" />
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {t('wallet_deposit_instruction')}
                    </p>
                  </div>
                </div>

                {/* Payment Methods */}
                {activePaymentMethods.length > 0 && (
                  <div className="space-y-2">
                    <Label className="text-xs font-medium">{t('wallet_choose_payment_method')}</Label>
                    <RadioGroup
                      value={selectedPaymentMethod}
                      onValueChange={setSelectedPaymentMethod}
                      className="space-y-2"
                    >
                      {activePaymentMethods.map((method) => (
                        <div
                          key={method.id}
                          className={cn(
                            "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer",
                            selectedPaymentMethod === method.id
                              ? "border-primary bg-primary/5"
                              : "border-border/50 bg-card/30 hover:border-border"
                          )}
                          onClick={() => setSelectedPaymentMethod(method.id)}
                        >
                          <RadioGroupItem value={method.id} id={method.id} />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium">{method.name}</p>
                            <div className="flex items-center gap-2 mt-1">
                              <code className="text-xs bg-muted px-2 py-0.5 rounded font-mono">
                                {method.account_number}
                              </code>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  copyAccountNumber(method.account_number);
                                }}
                                className="p-1 hover:bg-muted rounded"
                              >
                                {copiedNumber === method.account_number ? (
                                  <Check className="h-3 w-3 text-green-500" />
                                ) : (
                                  <Copy className="h-3 w-3 text-muted-foreground" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      ))}
                    </RadioGroup>
                  </div>
                )}

                {/* Amount Input */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t('wallet_amount_transferred')}</Label>
                  <Input
                    type="number"
                    placeholder={t('wallet_amount_placeholder')}
                    value={depositAmount}
                    onChange={(e) => setDepositAmount(e.target.value)}
                    className="h-11 text-base"
                  />
                </div>

                {/* Proof Upload */}
                <div className="space-y-2">
                  <Label className="text-xs font-medium">{t('wallet_proof_image')}</Label>
                  <input
                    type="file"
                    accept="image/*"
                    ref={fileInputRef}
                    className="hidden"
                    onChange={handleUploadProof}
                  />
                  {paymentProofUrl ? (
                    <div className="relative rounded-xl overflow-hidden border border-border/50 bg-card/30">
                      <img
                        src={paymentProofUrl}
                        alt={t('wallet_proof_alt')}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
                      <div className="absolute bottom-2 right-2 flex gap-2">
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => fileInputRef.current?.click()}
                          className="h-7 text-xs"
                        >
                          {t('wallet_change')}
                        </Button>
                      </div>
                      <div className="absolute top-2 left-2">
                        <div className="h-6 w-6 rounded-full bg-green-500 flex items-center justify-center">
                          <Check className="h-3.5 w-3.5 text-white" />
                        </div>
                      </div>
                    </div>
                  ) : (
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingProof}
                      className="w-full h-24 rounded-xl border-2 border-dashed border-border/50 bg-card/30 hover:border-primary/50 hover:bg-primary/5 transition-all flex flex-col items-center justify-center gap-2"
                    >
                      {uploadingProof ? (
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      ) : (
                        <>
                          <div className="h-10 w-10 rounded-lg bg-muted flex items-center justify-center">
                            <ImageIcon className="h-5 w-5 text-muted-foreground" />
                          </div>
                          <span className="text-xs text-muted-foreground">{t('wallet_upload_image')}</span>
                        </>
                      )}
                    </button>
                  )}
                </div>

                <Button
                  onClick={handleDepositClick}
                  disabled={depositWallet.isPending || !depositAmount || !selectedPaymentMethod || !paymentProofUrl}
                  className="w-full h-11 gap-2"
                >
                  {depositWallet.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="h-4 w-4" />
                  )}
                  {t('wallet_send_deposit_request')}
                </Button>
              </div>
            </TabsContent>

            {/* Withdraw Tab */}
            <TabsContent value="withdraw" className="flex-1 m-0 overflow-y-auto">
              <div className="p-3 space-y-3">
                <div className="p-3 rounded-xl bg-gradient-to-br from-orange-500/5 to-transparent border border-orange-500/10">
                  <div className="flex items-start gap-2">
                    <Download className="h-4 w-4 text-orange-500 mt-0.5 shrink-0" />
                    <div className="space-y-1">
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {t('wallet_withdraw_instruction')}
                      </p>
                      <p className="text-xs text-orange-600">
                        {t('wallet_min_withdrawal', { amount: fmt(minWithdrawal) })}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-xl bg-card/50 border border-border/50">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-sm text-muted-foreground">{t('wallet_available_balance')}</span>
                    <span className="text-lg font-bold text-foreground">
                      {fmt(wallet?.balance) || 0} <span className="text-xs text-muted-foreground">{t('wallet_currency_iqd')}</span>
                    </span>
                  </div>

                  <div className="space-y-2">
                    <Label className="text-xs font-medium">{t('wallet_withdraw_amount')}</Label>
                    <Input
                      type="number"
                      placeholder={t('wallet_min_placeholder', { amount: fmt(minWithdrawal) })}
                      value={withdrawAmount}
                      onChange={(e) => setWithdrawAmount(e.target.value)}
                      className="h-11 text-base"
                    />
                  </div>
                </div>

                <Button
                  onClick={handleWithdrawClick}
                  disabled={withdrawWallet.isPending || !withdrawAmount}
                  variant="outline"
                  className="w-full h-11 gap-2 border-orange-500/30 text-orange-600 hover:bg-orange-500/10"
                >
                  {withdrawWallet.isPending ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4" />
                  )}
                  {t('wallet_request_withdraw')}
                </Button>
              </div>
            </TabsContent>

            {/* History Tab */}
            <TabsContent value="history" className="flex-1 m-0 overflow-hidden">
              <ScrollArea className="h-full">
                <div className="p-3 space-y-2">
                  {walletTransactions && walletTransactions.length > 0 ? (
                    walletTransactions.map((tx) => (
                      <div 
                        key={tx.id}
                        className="flex items-center gap-3 p-3 rounded-xl bg-card/30 border border-border/30"
                      >
                        <div className={cn(
                          "h-8 w-8 rounded-lg flex items-center justify-center shrink-0",
                          getTransactionColor(tx.type, tx.status)
                        )}>
                          {getTransactionIcon(tx.type, tx.status)}
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium">{getTransactionLabel(tx.type)}</span>
                            {tx.status === 'pending' && (
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-yellow-500/10 text-yellow-600">
                                {getStatusLabel(tx.status)}
                              </span>
                            )}
                          </div>
                          <p className="text-[10px] text-muted-foreground mt-0.5">
                            {new Date(tx.created_at).toLocaleDateString(dateLocaleCode, {
                              year: 'numeric',
                              month: 'short',
                              day: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </p>
                        </div>
                        <div className={cn(
                          "text-sm font-bold",
                          isIncome(tx.type) && tx.status !== 'rejected' ? "text-green-500" : "text-foreground"
                        )}>
                          {isIncome(tx.type) && tx.status !== 'rejected' ? '+' : ''}{Math.abs(tx.amount).toLocaleString(numLocale)}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-center py-8 text-muted-foreground text-sm">
                      {t('wallet_no_history')}
                    </div>
                  )}
                </div>
              </ScrollArea>
            </TabsContent>
          </Tabs>
      </OriginExpandShell>

      {/* Deposit Confirmation */}
      <AlertDialog open={showDepositConfirm} onOpenChange={setShowDepositConfirm}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wallet_confirm_deposit_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wallet_confirm_deposit_desc', { amount: fmt(Number(depositAmount)) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('wallet_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeposit}>
              {t('wallet_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Withdraw Confirmation */}
      <AlertDialog open={showWithdrawConfirm} onOpenChange={setShowWithdrawConfirm}>
        <AlertDialogContent dir={dir}>
          <AlertDialogHeader>
            <AlertDialogTitle>{t('wallet_confirm_withdraw_title')}</AlertDialogTitle>
            <AlertDialogDescription>
              {t('wallet_confirm_withdraw_desc', { amount: fmt(Number(withdrawAmount)) })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter className="gap-2">
            <AlertDialogCancel>{t('wallet_cancel')}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmWithdraw}>
              {t('wallet_confirm')}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
