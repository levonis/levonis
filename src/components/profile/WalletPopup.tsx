import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { format } from 'date-fns';
import { ar, enUS } from 'date-fns/locale';
import { useLanguage } from '@/lib/i18n';

interface WalletPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  balance: number;
}

export default function WalletPopup({ open, onOpenChange, userId, balance }: WalletPopupProps) {
  const { t, language, dir } = useLanguage();
  const numLocale = language === 'en' ? 'en-US' : language === 'ku' ? 'ckb-IQ' : 'ar-IQ';
  const dateLocale = language === 'en' ? enUS : ar;

  const { data: transactions, isLoading } = useQuery({
    queryKey: ['wallet-transactions-popup', userId],
    enabled: open && !!userId,
    staleTime: 15_000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(20);
      if (error) throw error;
      return data ?? [];
    },
  });

  const getTypeInfo = (type: string, _amount: number) => {
    if (type === 'deposit' || type === 'refund' || type === 'admin_credit') {
      const label = type === 'deposit' ? t('wallet_type_deposit') : type === 'refund' ? t('wallet_type_refund') : t('wallet_type_admin_credit');
      return { icon: ArrowUpCircle, color: 'text-green-500', label, sign: '+' };
    }
    const label = type === 'withdrawal' ? t('wallet_type_withdrawal') : type === 'payment' ? t('wallet_type_payment') : type;
    return { icon: ArrowDownCircle, color: 'text-red-500', label, sign: '-' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 gap-1"><CheckCircle className="h-2.5 w-2.5" />{t('wallet_status_completed')}</Badge>;
      case 'pending': return <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 gap-1"><Clock className="h-2.5 w-2.5" />{t('wallet_status_pending')}</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 gap-1"><XCircle className="h-2.5 w-2.5" />{t('wallet_status_rejected')}</Badge>;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden" dir={dir}>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            {t('wallet_title')}
          </DialogTitle>
        </DialogHeader>

        {/* Balance */}
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))' }}>
          <p className="text-xs text-muted-foreground mb-1">{t('wallet_current_balance')}</p>
          <p className="text-3xl font-black text-primary tabular-nums">{balance.toLocaleString(numLocale)}</p>
          <p className="text-xs text-muted-foreground mt-1">{t('ph_currency_iqd')}</p>
        </div>

        {/* Transactions */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">{t('wallet_recent_transactions')}</h3>
          <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : !transactions?.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">{t('wallet_no_transactions')}</p>
            ) : (
              transactions.map((tx) => {
                const info = getTypeInfo(tx.type, tx.amount);
                const Icon = info.icon;
                return (
                  <div key={tx.id} className="flex items-center gap-3 p-3 rounded-xl border border-border/30 bg-card/50">
                    <Icon className={`h-5 w-5 shrink-0 ${info.color}`} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium">{info.label}</span>
                        {getStatusBadge(tx.status)}
                      </div>
                      {tx.admin_notes && <p className="text-[10px] text-muted-foreground truncate mt-0.5">{tx.admin_notes}</p>}
                      <p className="text-[10px] text-muted-foreground">
                        {format(new Date(tx.created_at), 'dd MMM yyyy - hh:mm a', { locale: dateLocale })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${info.color}`}>
                      {info.sign}{Number(tx.amount).toLocaleString(numLocale)}
                    </span>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
