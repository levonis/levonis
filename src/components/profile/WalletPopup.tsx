import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Wallet, ArrowUpCircle, ArrowDownCircle, Clock, CheckCircle, XCircle } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { formatPrice } from '@/lib/utils';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';

interface WalletPopupProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId: string;
  balance: number;
}

export default function WalletPopup({ open, onOpenChange, userId, balance }: WalletPopupProps) {
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

  const getTypeInfo = (type: string, amount: number) => {
    if (type === 'deposit' || type === 'refund' || type === 'admin_credit') {
      return { icon: ArrowUpCircle, color: 'text-green-500', label: type === 'deposit' ? 'إيداع' : type === 'refund' ? 'استرداد' : 'رصيد إداري', sign: '+' };
    }
    return { icon: ArrowDownCircle, color: 'text-red-500', label: type === 'withdrawal' ? 'سحب' : type === 'payment' ? 'دفع' : type, sign: '-' };
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'completed': return <Badge variant="outline" className="text-[10px] border-green-500/30 text-green-600 gap-1"><CheckCircle className="h-2.5 w-2.5" />مكتمل</Badge>;
      case 'pending': return <Badge variant="outline" className="text-[10px] border-amber-500/30 text-amber-600 gap-1"><Clock className="h-2.5 w-2.5" />معلق</Badge>;
      case 'rejected': return <Badge variant="outline" className="text-[10px] border-red-500/30 text-red-600 gap-1"><XCircle className="h-2.5 w-2.5" />مرفوض</Badge>;
      default: return null;
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md max-h-[80vh] overflow-hidden" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet className="h-5 w-5 text-primary" />
            المحفظة
          </DialogTitle>
        </DialogHeader>
        
        {/* Balance */}
        <div className="rounded-2xl p-5 text-center" style={{ background: 'linear-gradient(135deg, hsl(var(--primary) / 0.15), hsl(var(--primary) / 0.05))' }}>
          <p className="text-xs text-muted-foreground mb-1">الرصيد الحالي</p>
          <p className="text-3xl font-black text-primary tabular-nums">{balance.toLocaleString('ar-IQ')}</p>
          <p className="text-xs text-muted-foreground mt-1">د.ع</p>
        </div>

        {/* Transactions */}
        <div className="space-y-1">
          <h3 className="text-sm font-bold text-foreground">آخر العمليات</h3>
          <div className="max-h-[40vh] overflow-y-auto space-y-2 pr-1">
            {isLoading ? (
              Array.from({ length: 4 }).map((_, i) => (
                <Skeleton key={i} className="h-14 rounded-xl" />
              ))
            ) : !transactions?.length ? (
              <p className="text-center text-sm text-muted-foreground py-6">لا توجد عمليات بعد</p>
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
                        {format(new Date(tx.created_at), 'dd MMM yyyy - hh:mm a', { locale: ar })}
                      </p>
                    </div>
                    <span className={`text-sm font-bold tabular-nums ${info.color}`}>
                      {info.sign}{Number(tx.amount).toLocaleString('ar-IQ')}
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
