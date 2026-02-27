import { useState } from "react";
import { useAuth } from "@/hooks/useAuth";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { CheckCircle2, XCircle, Loader2, Clock } from "lucide-react";
import { toast } from "sonner";

export default function AdminTaskApprovalsTab() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: pendingApprovals, isLoading } = useQuery({
    queryKey: ['admin-pending-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_task_approvals' as any)
        .select('*')
        .eq('status', 'pending')
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  const { data: allApprovals } = useQuery({
    queryKey: ['admin-all-approvals'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('pending_task_approvals' as any)
        .select('*')
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data || [];
    },
    staleTime: 30 * 1000,
  });

  // Fetch user profiles for display
  const { data: userProfiles } = useQuery({
    queryKey: ['admin-approval-profiles', allApprovals?.map((a: any) => a.user_id)],
    queryFn: async () => {
      if (!allApprovals?.length) return {};
      const userIds = [...new Set(allApprovals.map((a: any) => a.user_id))];
      const { data } = await supabase
        .from('profiles')
        .select('id, full_name, username')
        .in('id', userIds);
      const map: Record<string, any> = {};
      data?.forEach(p => { map[p.id] = p; });
      return map;
    },
    enabled: !!allApprovals?.length,
  });

  // Fetch task info
  const { data: taskInfo } = useQuery({
    queryKey: ['admin-task-info'],
    queryFn: async () => {
      const { data } = await supabase
        .from('daily_tasks')
        .select('task_key, title_ar, points_reward');
      const map: Record<string, any> = {};
      data?.forEach(t => { map[t.task_key] = t; });
      return map;
    },
  });

  const approveMutation = useMutation({
    mutationFn: async ({ approvalId, userId, taskKey, adminNotes }: { approvalId: string; userId: string; taskKey: string; adminNotes?: string }) => {
      if (!user) throw new Error('غير مسجل');

      // Update approval status
      const { error: updateError } = await supabase
        .from('pending_task_approvals' as any)
        .update({ status: 'approved', reviewed_at: new Date().toISOString(), reviewed_by: user.id, admin_notes: adminNotes || null })
        .eq('id', approvalId);
      if (updateError) throw updateError;

      const task = taskInfo?.[taskKey];
      const totalPoints = task?.points_reward || 0;

      // Complete the task
      const { error: taskError } = await supabase
        .from('user_task_completions')
        .insert({ user_id: userId, task_key: taskKey, points_earned: totalPoints });
      if (taskError) throw taskError;

      // Add points transaction
      const { error: pointsError } = await supabase
        .from('points_transactions')
        .insert({
          user_id: userId, points: totalPoints, type: 'earned',
          source: 'daily_task', description: `مهمة (موافقة إدارية): ${task?.title_ar || taskKey}`,
        });
      if (pointsError) throw pointsError;

      // Update user points
      const { data: currentPoints } = await supabase
        .from('user_points').select('*').eq('user_id', userId).maybeSingle();

      if (currentPoints) {
        await supabase.from('user_points').update({
          total_points: (currentPoints.total_points || 0) + totalPoints,
          available_points: (currentPoints.available_points || 0) + totalPoints,
        }).eq('user_id', userId);
      } else {
        await supabase.from('user_points').insert({
          user_id: userId, total_points: totalPoints, available_points: totalPoints,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-approvals'] });
      toast.success('تمت الموافقة ومنح النقاط ✅');
    },
    onError: (error: any) => toast.error(error.message),
  });

  const rejectMutation = useMutation({
    mutationFn: async ({ approvalId, adminNotes }: { approvalId: string; adminNotes?: string }) => {
      if (!user) throw new Error('غير مسجل');
      const { error } = await supabase
        .from('pending_task_approvals' as any)
        .update({ status: 'rejected', reviewed_at: new Date().toISOString(), reviewed_by: user.id, admin_notes: adminNotes || null })
        .eq('id', approvalId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-pending-approvals'] });
      queryClient.invalidateQueries({ queryKey: ['admin-all-approvals'] });
      toast.success('تم الرفض');
    },
    onError: (error: any) => toast.error(error.message),
  });

  if (isLoading) return <div className="text-center py-8 text-muted-foreground">جاري التحميل...</div>;

  return (
    <div className="space-y-4">
      <h3 className="font-semibold">طلبات المهام المعلقة ({pendingApprovals?.length || 0})</h3>
      
      {(!pendingApprovals || pendingApprovals.length === 0) ? (
        <Card>
          <CardContent className="p-6 text-center text-muted-foreground">
            <Clock className="h-8 w-8 mx-auto mb-2 opacity-50" />
            لا توجد طلبات معلقة
          </CardContent>
        </Card>
      ) : (
        pendingApprovals.map((approval: any) => (
          <ApprovalCard
            key={approval.id}
            approval={approval}
            userName={userProfiles?.[approval.user_id]?.full_name || userProfiles?.[approval.user_id]?.username || 'مستخدم'}
            taskName={taskInfo?.[approval.task_key]?.title_ar || approval.task_key}
            taskPoints={taskInfo?.[approval.task_key]?.points_reward || 0}
            onApprove={(notes) => approveMutation.mutate({ approvalId: approval.id, userId: approval.user_id, taskKey: approval.task_key, adminNotes: notes })}
            onReject={(notes) => rejectMutation.mutate({ approvalId: approval.id, adminNotes: notes })}
            isLoading={approveMutation.isPending || rejectMutation.isPending}
          />
        ))
      )}

      {/* Recent history */}
      {allApprovals && allApprovals.filter((a: any) => a.status !== 'pending').length > 0 && (
        <div className="mt-6">
          <h3 className="font-semibold mb-3">السجل الأخير</h3>
          <div className="space-y-2">
            {allApprovals.filter((a: any) => a.status !== 'pending').slice(0, 20).map((a: any) => (
              <div key={a.id} className="flex items-center justify-between p-3 rounded-lg bg-muted/30 border text-sm">
                <div>
                  <span className="font-medium">{userProfiles?.[a.user_id]?.full_name || 'مستخدم'}</span>
                  <span className="text-muted-foreground mx-2">•</span>
                  <span>{taskInfo?.[a.task_key]?.title_ar || a.task_key}</span>
                </div>
                <Badge variant={a.status === 'approved' ? 'default' : 'destructive'}>
                  {a.status === 'approved' ? 'تمت الموافقة' : 'مرفوض'}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ApprovalCard({ approval, userName, taskName, taskPoints, onApprove, onReject, isLoading }: {
  approval: any; userName: string; taskName: string; taskPoints: number;
  onApprove: (notes?: string) => void; onReject: (notes?: string) => void; isLoading: boolean;
}) {
  const [notes, setNotes] = useState('');

  return (
    <Card className="border-amber-500/30">
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-sm">{userName}</p>
            <p className="text-xs text-muted-foreground">{taskName} • {taskPoints} نقطة</p>
            <p className="text-[10px] text-muted-foreground">
              {new Date(approval.created_at).toLocaleDateString('ar-IQ')} {new Date(approval.created_at).toLocaleTimeString('ar-IQ', { hour: '2-digit', minute: '2-digit' })}
            </p>
          </div>
          <Badge variant="outline" className="text-amber-600 border-amber-500/30">معلق</Badge>
        </div>
        
        <Textarea
          placeholder="ملاحظات الإدارة (اختياري)..."
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          rows={2}
          className="text-sm"
        />
        
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={() => onApprove(notes)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4 ml-1" />}
            موافقة
          </Button>
          <Button size="sm" variant="destructive" className="flex-1" onClick={() => onReject(notes)} disabled={isLoading}>
            {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4 ml-1" />}
            رفض
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
