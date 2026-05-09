import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { ArrowRight, Loader2, RefreshCw, Trash2 } from 'lucide-react';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';
import { toast } from '@/hooks/use-toast';

interface Row {
  id: string;
  created_at: string;
  url: string | null;
  asset_url: string | null;
  message: string | null;
  error_type: string | null;
  user_agent: string | null;
  platform: string | null;
  is_mobile: boolean | null;
  network_type: string | null;
  downlink: number | null;
  rtt: number | null;
  save_data: boolean | null;
  viewport_width: number | null;
  viewport_height: number | null;
  language: string | null;
  referrer: string | null;
  recovery_attempts: number | null;
  ms_since_load: number | null;
}

const TYPE_COLORS: Record<string, string> = {
  'chunk': 'bg-rose-500/15 text-rose-700 border-rose-500/30',
  'resource': 'bg-orange-500/15 text-orange-700 border-orange-500/30',
  'unhandledrejection': 'bg-amber-500/15 text-amber-700 border-amber-500/30',
  'mount-timeout': 'bg-violet-500/15 text-violet-700 border-violet-500/30',
};

export default function AdminChunkErrors() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [hours, setHours] = useState<string>('24');
  const [typeFilter, setTypeFilter] = useState<string>('all');

  const { data, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['chunk-load-errors', hours, typeFilter],
    queryFn: async () => {
      const since = new Date(Date.now() - Number(hours) * 60 * 60 * 1000).toISOString();
      let q = supabase
        .from('chunk_load_errors')
        .select('*')
        .gte('created_at', since)
        .order('created_at', { ascending: false })
        .limit(500);
      if (typeFilter !== 'all') q = q.eq('error_type', typeFilter);
      const { data, error } = await q;
      if (error) throw error;
      return (data || []) as Row[];
    },
    staleTime: 30_000,
  });

  const purge = useMutation({
    mutationFn: async () => {
      const cutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
      const { error } = await supabase.from('chunk_load_errors').delete().lt('created_at', cutoff);
      if (error) throw error;
    },
    onSuccess: () => {
      toast({ title: 'تم حذف السجلات الأقدم من 7 أيام' });
      qc.invalidateQueries({ queryKey: ['chunk-load-errors'] });
    },
    onError: (e: any) => toast({ title: 'فشل الحذف', description: e?.message, variant: 'destructive' }),
  });

  // Aggregate stats
  const rows = data || [];
  const stats = {
    total: rows.length,
    mobile: rows.filter(r => r.is_mobile).length,
    byType: rows.reduce((acc, r) => {
      const k = r.error_type || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byNetwork: rows.reduce((acc, r) => {
      const k = r.network_type || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
    byPlatform: rows.reduce((acc, r) => {
      const k = r.platform || 'unknown';
      acc[k] = (acc[k] || 0) + 1;
      return acc;
    }, {} as Record<string, number>),
  };

  return (
    <div className="container mx-auto p-4 space-y-4 max-w-7xl">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" onClick={() => navigate(`${ADMIN_BASE_PATH}`)}>
          <ArrowRight className="w-4 h-4" />
        </Button>
        <div>
          <h1 className="text-xl font-bold">سجل أخطاء التحميل</h1>
          <p className="text-xs text-muted-foreground">أخطاء فشل تحميل ملفات JS / تأخر تركيب التطبيق لدى المستخدمين</p>
        </div>
        <div className="flex-1" />
        <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
          {isFetching ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
        </Button>
        <Button variant="outline" size="sm" onClick={() => purge.mutate()} disabled={purge.isPending}>
          <Trash2 className="w-4 h-4 me-1" /> تنظيف >7 أيام
        </Button>
      </div>

      <div className="flex flex-wrap gap-3">
        <Select value={hours} onValueChange={setHours}>
          <SelectTrigger className="w-40"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="1">آخر ساعة</SelectItem>
            <SelectItem value="6">آخر 6 ساعات</SelectItem>
            <SelectItem value="24">آخر 24 ساعة</SelectItem>
            <SelectItem value="72">آخر 3 أيام</SelectItem>
            <SelectItem value="168">آخر أسبوع</SelectItem>
          </SelectContent>
        </Select>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            <SelectItem value="chunk">Chunk Failure</SelectItem>
            <SelectItem value="resource">Resource Failure</SelectItem>
            <SelectItem value="unhandledrejection">Unhandled Rejection</SelectItem>
            <SelectItem value="mount-timeout">Mount Timeout</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">إجمالي الأخطاء</div>
          <div className="text-2xl font-bold">{stats.total}</div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground">من جوال</div>
          <div className="text-2xl font-bold">{stats.mobile} <span className="text-xs text-muted-foreground">({stats.total ? Math.round(stats.mobile/stats.total*100) : 0}%)</span></div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">حسب النوع</div>
          <div className="text-xs space-y-0.5">
            {Object.entries(stats.byType).slice(0, 4).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span className="truncate">{k}</span><span className="font-mono">{v}</span></div>
            ))}
          </div>
        </Card>
        <Card className="p-3">
          <div className="text-xs text-muted-foreground mb-1">حسب الشبكة</div>
          <div className="text-xs space-y-0.5">
            {Object.entries(stats.byNetwork).slice(0, 4).map(([k, v]) => (
              <div key={k} className="flex justify-between"><span>{k}</span><span className="font-mono">{v}</span></div>
            ))}
          </div>
        </Card>
      </div>

      {/* Table */}
      <Card className="p-0 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-muted/40">
              <tr className="text-start">
                <th className="p-2 text-start">الوقت</th>
                <th className="p-2 text-start">النوع</th>
                <th className="p-2 text-start">الجهاز</th>
                <th className="p-2 text-start">الشبكة</th>
                <th className="p-2 text-start">الصفحة</th>
                <th className="p-2 text-start">الرسالة / الملف</th>
                <th className="p-2 text-start">منذ التحميل</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr><td colSpan={7} className="p-6 text-center"><Loader2 className="w-4 h-4 animate-spin inline" /></td></tr>
              ) : rows.length === 0 ? (
                <tr><td colSpan={7} className="p-6 text-center text-muted-foreground">لا توجد أخطاء في هذه الفترة 🎉</td></tr>
              ) : rows.map(r => (
                <tr key={r.id} className="border-t border-border/50 hover:bg-muted/20 align-top">
                  <td className="p-2 whitespace-nowrap">{new Date(r.created_at).toLocaleString('ar-IQ', { hour12: false })}</td>
                  <td className="p-2">
                    <Badge variant="outline" className={`text-[10px] ${TYPE_COLORS[r.error_type || ''] || ''}`}>{r.error_type}</Badge>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-medium">{r.platform} {r.is_mobile ? '📱' : '💻'}</div>
                    <div className="text-muted-foreground">{r.viewport_width}×{r.viewport_height}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <div className="font-medium">{r.network_type || '—'}</div>
                    <div className="text-muted-foreground">
                      {r.downlink ? `${r.downlink}Mb/s` : '—'} · {r.rtt ? `${r.rtt}ms` : '—'}
                      {r.save_data ? ' · saver' : ''}
                    </div>
                  </td>
                  <td className="p-2 max-w-[200px] truncate" title={r.url || ''}>{r.url}</td>
                  <td className="p-2 max-w-[320px]">
                    <div className="text-rose-700 break-all">{r.message}</div>
                    {r.asset_url && <div className="text-muted-foreground break-all mt-1">{r.asset_url}</div>}
                    <div className="text-[10px] text-muted-foreground mt-1 truncate" title={r.user_agent || ''}>{r.user_agent}</div>
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    {r.ms_since_load != null ? `${(r.ms_since_load / 1000).toFixed(1)}s` : '—'}
                    {(r.recovery_attempts ?? 0) > 0 && <div className="text-[10px] text-amber-700">retry #{r.recovery_attempts}</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </Card>
    </div>
  );
}
