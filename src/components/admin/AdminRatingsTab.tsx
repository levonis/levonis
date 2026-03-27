import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Star, Loader2 } from 'lucide-react';
import { format } from 'date-fns';

export default function AdminRatingsTab() {
  const { data: ratings, isLoading } = useQuery({
    queryKey: ['admin-engineer-ratings'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('engineer_ratings')
        .select('*')
        .order('created_at', { ascending: false });
      if (error) throw error;

      const userIds = [...new Set(data?.map(r => r.user_id) || [])];
      const { data: profiles } = await supabase.from('profiles').select('id, username').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return data?.map(r => ({ ...r, profile: profileMap.get(r.user_id) }));
    },
  });

  // Calculate averages per engineer
  const engineerStats = React.useMemo(() => {
    if (!ratings) return [];
    const map = new Map<string, { total: number; count: number; name: string }>();
    for (const r of ratings) {
      const key = r.engineer_name;
      const existing = map.get(key) || { total: 0, count: 0, name: key };
      existing.total += r.rating;
      existing.count += 1;
      map.set(key, existing);
    }
    return Array.from(map.values()).map(e => ({ ...e, avg: (e.total / e.count).toFixed(1) }));
  }, [ratings]);

  return (
    <div className="space-y-4">
      {/* Engineer Summary */}
      {engineerStats.length > 0 && (
        <div className="grid gap-3 md:grid-cols-3">
          {engineerStats.map(e => (
            <Card key={e.name}>
              <CardContent className="p-4 flex items-center gap-3">
                <div className="p-2 bg-amber-500/10 rounded-lg">
                  <Star className="w-5 h-5 text-amber-500 fill-amber-500" />
                </div>
                <div>
                  <p className="font-medium">{e.name}</p>
                  <p className="text-sm text-muted-foreground">{e.avg} ★ ({e.count} تقييم)</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="w-5 h-5" />
            جميع التقييمات
          </CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>المستخدم</TableHead>
                  <TableHead>الفني</TableHead>
                  <TableHead>التقييم</TableHead>
                  <TableHead>التعليق</TableHead>
                  <TableHead>التاريخ</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {ratings?.map((r: any) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-sm">{r.profile?.username || 'غير معروف'}</TableCell>
                    <TableCell className="text-sm">{r.engineer_name}</TableCell>
                    <TableCell>
                      <div className="flex gap-0.5">
                        {[1, 2, 3, 4, 5].map(s => (
                          <Star key={s} className={`w-3.5 h-3.5 ${s <= r.rating ? 'fill-amber-400 text-amber-400' : 'text-muted-foreground/30'}`} />
                        ))}
                      </div>
                    </TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{r.comment || '-'}</TableCell>
                    <TableCell className="text-xs">{format(new Date(r.created_at), 'dd/MM/yyyy')}</TableCell>
                  </TableRow>
                ))}
                {(!ratings || ratings.length === 0) && (
                  <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground py-8">لا توجد تقييمات</TableCell></TableRow>
                )}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
