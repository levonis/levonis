import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Wrench, Search, Loader2 } from 'lucide-react';
import { format } from 'date-fns';
import { ar } from 'date-fns/locale';
import { toast } from 'sonner';

const statusMap: Record<string, { label: string; class: string }> = {
  open: { label: 'مفتوح', class: 'bg-blue-500/20 text-blue-600' },
  in_progress: { label: 'قيد التنفيذ', class: 'bg-amber-500/20 text-amber-600' },
  resolved: { label: 'تم الحل', class: 'bg-green-500/20 text-green-600' },
  closed: { label: 'مغلق', class: 'bg-muted text-muted-foreground' },
};

export default function AdminMaintenanceTab() {
  const queryClient = useQueryClient();
  const [statusFilter, setStatusFilter] = useState('all');
  const [editTicket, setEditTicket] = useState<any>(null);
  const [engineerName, setEngineerName] = useState('');
  const [engineerId, setEngineerId] = useState('');
  const [newStatus, setNewStatus] = useState('');
  const [resolutionNotes, setResolutionNotes] = useState('');

  const { data: tickets, isLoading } = useQuery({
    queryKey: ['admin-maintenance-tickets', statusFilter],
    queryFn: async () => {
      let query = supabase
        .from('maintenance_tickets')
        .select('*')
        .order('created_at', { ascending: false });
      if (statusFilter !== 'all') query = query.eq('status', statusFilter);
      const { data, error } = await query;
      if (error) throw error;

      const userIds = [...new Set(data?.map(t => t.user_id) || [])];
      const { data: profiles } = await supabase.from('profiles').select('id, username, email').in('id', userIds);
      const profileMap = new Map(profiles?.map(p => [p.id, p]) || []);
      return data?.map(t => ({ ...t, profile: profileMap.get(t.user_id) }));
    },
  });

  const updateMutation = useMutation({
    mutationFn: async () => {
      if (!editTicket) return;
      const updates: any = {};
      if (newStatus) updates.status = newStatus;
      if (engineerName) updates.assigned_engineer_name = engineerName;
      if (engineerId) updates.assigned_engineer_id = engineerId;
      if (resolutionNotes) updates.resolution_notes = resolutionNotes;
      if (newStatus === 'resolved') updates.resolved_at = new Date().toISOString();
      if (newStatus === 'closed') updates.closed_at = new Date().toISOString();
      updates.updated_at = new Date().toISOString();

      const { error } = await supabase.from('maintenance_tickets').update(updates).eq('id', editTicket.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم تحديث طلب الصيانة');
      queryClient.invalidateQueries({ queryKey: ['admin-maintenance-tickets'] });
      setEditTicket(null);
    },
    onError: (e: any) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wrench className="w-5 h-5" />
          طلبات الصيانة
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex gap-4 mb-4">
          <Select value={statusFilter} onValueChange={setStatusFilter}>
            <SelectTrigger className="w-40"><SelectValue placeholder="الحالة" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="all">الكل</SelectItem>
              <SelectItem value="open">مفتوح</SelectItem>
              <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
              <SelectItem value="resolved">تم الحل</SelectItem>
              <SelectItem value="closed">مغلق</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {isLoading ? (
          <div className="flex justify-center py-8"><Loader2 className="w-6 h-6 animate-spin" /></div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>المستخدم</TableHead>
                <TableHead>العنوان</TableHead>
                <TableHead>الأولوية</TableHead>
                <TableHead>الفني</TableHead>
                <TableHead>الحالة</TableHead>
                <TableHead>التاريخ</TableHead>
                <TableHead>إجراء</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tickets?.map((t: any) => {
                const s = statusMap[t.status] || statusMap.open;
                return (
                  <TableRow key={t.id}>
                    <TableCell className="text-sm">{t.profile?.username || 'غير معروف'}</TableCell>
                    <TableCell className="text-sm max-w-48 truncate">{t.title}</TableCell>
                    <TableCell><Badge variant="outline" className="text-xs">{t.priority}</Badge></TableCell>
                    <TableCell className="text-sm">{t.assigned_engineer_name || '-'}</TableCell>
                    <TableCell><Badge className={s.class}>{s.label}</Badge></TableCell>
                    <TableCell className="text-xs">{format(new Date(t.created_at), 'dd/MM/yyyy')}</TableCell>
                    <TableCell>
                      <Button size="sm" variant="outline" onClick={() => {
                        setEditTicket(t);
                        setNewStatus(t.status);
                        setEngineerName(t.assigned_engineer_name || '');
                        setEngineerId(t.assigned_engineer_id || '');
                        setResolutionNotes(t.resolution_notes || '');
                      }}>تعديل</Button>
                    </TableCell>
                  </TableRow>
                );
              })}
              {(!tickets || tickets.length === 0) && (
                <TableRow><TableCell colSpan={7} className="text-center text-muted-foreground py-8">لا توجد طلبات</TableCell></TableRow>
              )}
            </TableBody>
          </Table>
        )}

        <Dialog open={!!editTicket} onOpenChange={(o) => !o && setEditTicket(null)}>
          <DialogContent dir="rtl">
            <DialogHeader><DialogTitle>تعديل طلب الصيانة</DialogTitle></DialogHeader>
            <div className="space-y-3 py-2">
              <div><Label>الحالة</Label>
                <Select value={newStatus} onValueChange={setNewStatus}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="open">مفتوح</SelectItem>
                    <SelectItem value="in_progress">قيد التنفيذ</SelectItem>
                    <SelectItem value="resolved">تم الحل</SelectItem>
                    <SelectItem value="closed">مغلق</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div><Label>اسم الفني</Label><Input value={engineerName} onChange={e => setEngineerName(e.target.value)} /></div>
              <div><Label>معرف الفني</Label><Input value={engineerId} onChange={e => setEngineerId(e.target.value)} /></div>
              <div><Label>ملاحظات الحل</Label><Textarea value={resolutionNotes} onChange={e => setResolutionNotes(e.target.value)} rows={3} /></div>
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setEditTicket(null)}>إلغاء</Button>
              <Button onClick={() => updateMutation.mutate()} disabled={updateMutation.isPending}>
                {updateMutation.isPending && <Loader2 className="w-4 h-4 animate-spin ml-2" />}حفظ
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
