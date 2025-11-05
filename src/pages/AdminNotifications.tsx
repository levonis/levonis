import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Bell } from 'lucide-react';
import { toast } from 'sonner';

const AdminNotifications = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');

  useEffect(() => {
    if (!authLoading && (!user || !isAdmin)) {
      navigate('/');
      toast.error('ليس لديك صلاحية الوصول');
    }
  }, [user, isAdmin, authLoading, navigate]);

  const sendNotification = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.rpc('send_general_notification', {
        _title: title,
        _message: message,
        _type: type,
      });
      
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إرسال الإشعار لجميع المستخدمين');
      setTitle('');
      setMessage('');
      setType('info');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
    onError: (error) => {
      toast.error('حدث خطأ أثناء إرسال الإشعار');
      console.error(error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !message.trim()) {
      toast.error('يجب ملء جميع الحقول');
      return;
    }
    sendNotification.mutate();
  };

  if (authLoading) {
    return (
      <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
        <div className="flex items-center justify-center py-20">
          <Loader2 className="h-8 w-8 animate-spin text-primary" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background/95 backdrop-blur-sm pt-24">
      <main className="container mx-auto px-4 py-8 max-w-4xl">
        <div className="mb-8">
          <h1 className="text-4xl font-black text-primary mb-2 flex items-center gap-3">
            <Bell className="h-8 w-8" />
            إدارة الإشعارات
          </h1>
          <p className="text-muted-foreground">إرسال إشعارات عامة لجميع المستخدمين</p>
        </div>

        <Card className="glass-effect border-border/50">
          <CardHeader>
            <CardTitle>إرسال إشعار عام</CardTitle>
            <CardDescription>
              سيتم إرسال هذا الإشعار لجميع المستخدمين المسجلين في النظام
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="title">عنوان الإشعار</Label>
                <Input
                  id="title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="مثال: عرض خاص"
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="message">نص الإشعار</Label>
                <Textarea
                  id="message"
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="مثال: خصم 20% على جميع المنتجات"
                  rows={4}
                  required
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="type">نوع الإشعار</Label>
                <Select value={type} onValueChange={setType}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="info">معلومات</SelectItem>
                    <SelectItem value="success">نجاح</SelectItem>
                    <SelectItem value="warning">تحذير</SelectItem>
                    <SelectItem value="error">خطأ</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Button
                type="submit"
                className="w-full bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
                disabled={sendNotification.isPending}
              >
                {sendNotification.isPending && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                <Send className="ml-2 h-4 w-4" />
                إرسال الإشعار
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
};

export default AdminNotifications;