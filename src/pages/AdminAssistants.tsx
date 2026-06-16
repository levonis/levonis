import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, UserPlus, Trash2, ArrowRight, ShieldCheck, ExternalLink } from 'lucide-react';
import { ADMIN_BASE_PATH } from '@/config/adminConfig';
import { toast } from 'sonner';
import { useNavigate } from 'react-router-dom';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog';

interface Assistant {
  user_id: string;
  email: string;
  full_name: string | null;
  created_at: string;
}

const AdminAssistants = () => {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [email, setEmail] = useState('');

  const { data: assistants = [], isLoading } = useQuery({
    queryKey: ['admin-assistants'],
    queryFn: async () => {
      const { data, error } = await (supabase as any).rpc('admin_list_assistants');
      if (error) throw error;
      return (data ?? []) as Assistant[];
    },
  });

  const addMutation = useMutation({
    mutationFn: async (em: string) => {
      const { data, error } = await (supabase as any).rpc('admin_add_assistant_by_email', { _email: em });
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      toast.success('تمت إضافة المساعد بنجاح');
      setEmail('');
      queryClient.invalidateQueries({ queryKey: ['admin-assistants'] });
    },
    onError: (err: any) => {
      toast.error(err?.message || 'تعذرت إضافة المساعد');
    },
  });

  const removeMutation = useMutation({
    mutationFn: async (userId: string) => {
      const { error } = await (supabase as any).rpc('admin_remove_assistant', { _user_id: userId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم حذف المساعد');
      queryClient.invalidateQueries({ queryKey: ['admin-assistants'] });
    },
    onError: (err: any) => toast.error(err?.message || 'تعذر الحذف'),
  });

  return (
    <div className="container mx-auto p-4 md:p-6 max-w-3xl space-y-6" dir="rtl">
      <div className="flex items-center gap-3">
        <Button variant="outline" size="icon" onClick={() => navigate(-1)} className="rounded-full">
          <ArrowRight className="h-4 w-4" />
        </Button>
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-6 w-6 text-primary" />
          <h1 className="text-2xl font-bold">مساعدو الأدمن</h1>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">إضافة مساعد جديد</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!email.trim()) return;
              addMutation.mutate(email.trim());
            }}
            className="flex flex-col sm:flex-row gap-2"
          >
            <Input
              type="email"
              required
              placeholder="البريد الإلكتروني للمستخدم المسجل"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="flex-1"
            />
            <Button type="submit" disabled={addMutation.isPending}>
              {addMutation.isPending ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <UserPlus className="h-4 w-4 ml-2" />
                  إضافة
                </>
              )}
            </Button>
          </form>
          <p className="text-xs text-muted-foreground mt-2">
            يجب أن يكون المستخدم مسجَّلاً في النظام مسبقاً. لن يستطيع المساعد رؤية الأرباح، التكاليف، تفاصيل الدفع، أو حذف الطلبات/المنتجات.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">المساعدون الحاليون ({assistants.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : assistants.length === 0 ? (
            <p className="text-center text-muted-foreground py-8">لا يوجد مساعدون بعد</p>
          ) : (
            <div className="space-y-2">
              {assistants.map((a) => (
                <div
                  key={a.user_id}
                  className="flex items-center justify-between gap-3 p-3 rounded-lg border bg-card"
                >
                  <div className="min-w-0 flex-1">
                    <p className="font-medium truncate">{a.full_name || 'مستخدم'}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" className="text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>حذف صلاحيات المساعد</AlertDialogTitle>
                        <AlertDialogDescription>
                          هل تريد إزالة صلاحية المساعد عن {a.email}؟
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>تراجع</AlertDialogCancel>
                        <AlertDialogAction
                          className="bg-destructive text-destructive-foreground"
                          onClick={() => removeMutation.mutate(a.user_id)}
                        >
                          حذف
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default AdminAssistants;
