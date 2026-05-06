import { useMemo, useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Download, Loader2, Search, History } from 'lucide-react';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';

interface CodeRow {
  id: string;
  card_id: string;
  code: string;
  batch_id: string;
  batch_label: string | null;
  duration_days: number;
  code_expires_at: string;
  valid_from: string | null;
  status: 'active' | 'redeemed' | 'expired' | 'revoked';
  redeemed_by_user_id: string | null;
  redeemed_at: string | null;
  created_at: string;
}

interface CardRow { id: string; name_ar: string | null; name_en: string | null }
interface ProfileRow { id: string; username: string | null; full_name: string | null; avatar_url: string | null }

const StatusBadge = ({ status }: { status: CodeRow['status'] }) => {
  const map: Record<string, { label: string; cls: string }> = {
    active:   { label: 'لم يُستخدم', cls: 'bg-emerald-500/15 text-emerald-700 border-emerald-500/30' },
    redeemed: { label: 'مُستهلك',    cls: 'bg-sky-500/15 text-sky-700 border-sky-500/30' },
    expired:  { label: 'منتهي',     cls: 'bg-muted text-muted-foreground border-border' },
    revoked:  { label: 'مُلغى',      cls: 'bg-rose-500/15 text-rose-700 border-rose-500/30' },
  };
  const m = map[status] || map.active;
  return <Badge variant="outline" className={`text-[10px] ${m.cls}`}>{m.label}</Badge>;
};

const AdminLoyaltyCodeRedemptions = () => {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'redeemed' | 'active' | 'expired' | 'revoked'>('redeemed');

  const { data: cards } = useQuery<CardRow[]>({
    queryKey: ['admin-membership-cards-list-min'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('membership_cards')
        .select('id, name_ar, name_en');
      if (error) throw error;
      return data as any;
    },
  });

  const { data: codes, isLoading } = useQuery<CodeRow[]>({
    queryKey: ['admin-loyalty-code-redemptions'],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('loyalty_card_codes')
        .select('*')
        .order('redeemed_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as any;
    },
  });

  const userIds = useMemo(
    () => Array.from(new Set((codes || []).map(c => c.redeemed_by_user_id).filter(Boolean) as string[])),
    [codes]
  );

  const { data: profiles } = useQuery<ProfileRow[]>({
    queryKey: ['admin-loyalty-redemption-profiles', userIds],
    enabled: userIds.length > 0,
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('get_public_profiles', { user_ids: userIds });
      if (error) throw error;
      return data as any;
    },
  });

  const profileMap = useMemo(() => {
    const m = new Map<string, ProfileRow>();
    (profiles || []).forEach(p => m.set(p.id, p));
    return m;
  }, [profiles]);

  const cardName = (id: string) => {
    const c = (cards || []).find(x => x.id === id);
    return c?.name_ar || c?.name_en || id.slice(0, 8);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (codes || []).filter(c => {
      if (statusFilter !== 'all' && c.status !== statusFilter) return false;
      if (!q) return true;
      const p = c.redeemed_by_user_id ? profileMap.get(c.redeemed_by_user_id) : null;
      return (
        c.code.toLowerCase().includes(q) ||
        (c.batch_label || '').toLowerCase().includes(q) ||
        (p?.username || '').toLowerCase().includes(q) ||
        (p?.full_name || '').toLowerCase().includes(q)
      );
    });
  }, [codes, search, statusFilter, profileMap]);

  const stats = useMemo(() => {
    const acc = { total: 0, redeemed: 0, active: 0, expired: 0, revoked: 0 } as Record<string, number>;
    (codes || []).forEach(c => { acc.total++; acc[c.status] = (acc[c.status] || 0) + 1; });
    return acc;
  }, [codes]);

  const exportCsv = () => {
    const rows = ['code,status,card,batch,user,redeemed_at,created_at,expires_at'].concat(
      filtered.map(c => {
        const p = c.redeemed_by_user_id ? profileMap.get(c.redeemed_by_user_id) : null;
        const user = p ? (p.username || p.full_name || p.id) : '';
        return [
          c.code, c.status, cardName(c.card_id), c.batch_label || c.batch_id.slice(0, 8),
          user, c.redeemed_at || '', c.created_at, c.code_expires_at,
        ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(',');
      })
    );
    const blob = new Blob([rows.join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `loyalty-code-redemptions.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const fmt = (d?: string | null) => d ? new Date(d).toLocaleString('ar') : '—';

  return (
    <div className="min-h-screen bg-background pb-12">
      <div className="container mx-auto px-3 py-4 max-w-5xl space-y-4">
        <div className="flex items-center justify-between gap-2">
          <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}/loyalty-levels`)}>
            <ArrowRight className="h-4 w-4 ml-1" /> رجوع
          </Button>
          <h1 className="text-base font-bold flex items-center gap-2">
            <History className="h-4 w-4" /> سجل استخدام أكواد التفعيل
          </h1>
          <Button size="sm" variant="outline" onClick={exportCsv}>
            <Download className="h-3 w-3 ml-1" /> CSV
          </Button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          <Card className="p-2 text-center">
            <div className="text-[10px] text-muted-foreground">الإجمالي</div>
            <div className="text-lg font-bold">{stats.total || 0}</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-[10px] text-muted-foreground">مُستهلك</div>
            <div className="text-lg font-bold text-sky-700">{stats.redeemed || 0}</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-[10px] text-muted-foreground">لم يُستخدم</div>
            <div className="text-lg font-bold text-emerald-700">{stats.active || 0}</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-[10px] text-muted-foreground">منتهي</div>
            <div className="text-lg font-bold">{stats.expired || 0}</div>
          </Card>
          <Card className="p-2 text-center">
            <div className="text-[10px] text-muted-foreground">مُلغى</div>
            <div className="text-lg font-bold text-rose-700">{stats.revoked || 0}</div>
          </Card>
        </div>

        <Card className="p-3 flex flex-col md:flex-row gap-2">
          <div className="relative flex-1">
            <Search className="absolute right-2 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="بحث بالكود، الدفعة، اسم المستخدم..."
              className="pr-8 h-9 text-sm"
            />
          </div>
          <Select value={statusFilter} onValueChange={v => setStatusFilter(v as any)}>
            <SelectTrigger className="h-9 w-full md:w-44 text-sm"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">كل الحالات</SelectItem>
              <SelectItem value="redeemed">مُستهلك فقط</SelectItem>
              <SelectItem value="active">لم يُستخدم</SelectItem>
              <SelectItem value="expired">منتهي</SelectItem>
              <SelectItem value="revoked">مُلغى</SelectItem>
            </SelectContent>
          </Select>
        </Card>

        {isLoading ? (
          <div className="flex justify-center py-12"><Loader2 className="h-5 w-5 animate-spin" /></div>
        ) : filtered.length === 0 ? (
          <Card className="p-8 text-center text-sm text-muted-foreground">لا توجد سجلات مطابقة</Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="divide-y divide-border/40">
              {filtered.map(c => {
                const p = c.redeemed_by_user_id ? profileMap.get(c.redeemed_by_user_id) : null;
                return (
                  <div key={c.id} className="p-3 flex flex-wrap items-center gap-2 hover:bg-muted/30">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <code className="text-sm font-mono font-bold tracking-wider">{c.code}</code>
                      <StatusBadge status={c.status} />
                      <Badge variant="outline" className="text-[10px]">{cardName(c.card_id)}</Badge>
                      {c.batch_label && (
                        <Badge variant="outline" className="text-[10px] text-muted-foreground">
                          {c.batch_label}
                        </Badge>
                      )}
                    </div>

                    <div className="flex items-center gap-3 text-[11px]">
                      <div className="text-right min-w-[140px]">
                        <div className="text-muted-foreground">المستخدم</div>
                        {p ? (
                          <button
                            className="font-medium hover:underline"
                            onClick={() => navigate(`/profile/${p.username || p.id}`)}
                          >
                            {p.username ? `@${p.username}` : (p.full_name || p.id.slice(0, 8))}
                          </button>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </div>
                      <div className="text-right min-w-[160px]">
                        <div className="text-muted-foreground">وقت الاستخدام</div>
                        <div className="font-medium">{fmt(c.redeemed_at)}</div>
                      </div>
                      <div className="text-right min-w-[160px] hidden md:block">
                        <div className="text-muted-foreground">تاريخ الإنشاء</div>
                        <div className="font-medium">{fmt(c.created_at)}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </Card>
        )}
      </div>
    </div>
  );
};

export default AdminLoyaltyCodeRedemptions;
