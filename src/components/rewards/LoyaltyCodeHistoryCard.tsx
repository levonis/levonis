import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { History, ChevronDown, ChevronUp, Loader2 } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/lib/i18n';
import { pickLocalized } from '@/lib/i18n/localizedField';

type Status = 'active' | 'expired';

const formatDate = (d?: string | null) => {
  if (!d) return '—';
  try {
    return new Date(d).toLocaleDateString('ar-EG', { year: 'numeric', month: 'short', day: 'numeric' });
  } catch { return '—'; }
};

export default function LoyaltyCodeHistoryCard() {
  const { user } = useAuth();
  const { language } = useLanguage();
  const [open, setOpen] = useState(false);

  const { data: rows, isLoading } = useQuery({
    queryKey: ['user-loyalty-code-history', user?.id],
    queryFn: async () => {
      if (!user) return [];
      const { data, error } = await supabase
        .from('user_cards')
        .select('id, purchased_at, expires_at, is_active, payment_method, membership_cards:card_id(name_ar, name_en, name_ku, color)')
        .eq('user_id', user.id)
        .eq('payment_method', 'code')
        .order('purchased_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    enabled: !!user,
    staleTime: 60 * 1000,
  });

  if (!user) return null;

  const statusOf = (r: any): Status => {
    const expired = r.expires_at && new Date(r.expires_at).getTime() <= Date.now();
    return r.is_active && !expired ? 'active' : 'expired';
  };

  const labelFor = (s: Status) => s === 'active' ? 'فعّال' : 'منتهي';
  const colorFor = (s: Status) => s === 'active'
    ? 'bg-emerald-500/15 text-emerald-600 border-emerald-500/30'
    : 'bg-muted text-muted-foreground border-muted';

  const count = rows?.length || 0;

  return (
    <Card>
      <Collapsible open={open} onOpenChange={setOpen}>
        <CollapsibleTrigger asChild>
          <CardContent className="p-4 cursor-pointer hover:bg-muted/30 transition-colors">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-sky-500/20 flex items-center justify-center">
                  <History className="h-5 w-5 text-sky-600" />
                </div>
                <div className="text-right">
                  <p className="font-medium">سجل تفعيل أكواد الولاء</p>
                  <p className="text-xs text-muted-foreground">
                    {isLoading ? 'جاري التحميل…' : count ? `${count} عملية تفعيل` : 'لا يوجد سجل'}
                  </p>
                </div>
              </div>
              {open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </div>
          </CardContent>
        </CollapsibleTrigger>

        <CollapsibleContent>
          <div className="px-4 pb-4 border-t pt-3 space-y-2 max-h-72 overflow-y-auto">
            {isLoading ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : count === 0 ? (
              <p className="text-center text-sm text-muted-foreground py-4">لم تقم بتفعيل أي بطاقة بكود بعد</p>
            ) : (
              rows!.map((r: any) => {
                const s = statusOf(r);
                const cardName = r.membership_cards
                  ? pickLocalized(r.membership_cards as any, 'name', language)
                  : 'بطاقة ولاء';
                return (
                  <div key={r.id} className="p-3 rounded-lg bg-muted/40 border space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-medium truncate">{cardName}</p>
                      <Badge variant="outline" className={colorFor(s)}>{labelFor(s)}</Badge>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>التفعيل: {formatDate(r.purchased_at)}</span>
                      <span>الانتهاء: {formatDate(r.expires_at)}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>
    </Card>
  );
}
