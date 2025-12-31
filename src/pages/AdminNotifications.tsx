import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Send, Bell, Type, Palette } from 'lucide-react';
import { toast } from 'sonner';
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminLoading } from '@/components/admin/AdminLayout';

const AdminNotifications = () => {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [type, setType] = useState('info');
  const [fontFamily, setFontFamily] = useState('Cairo');
  const [textColor, setTextColor] = useState('#efe6c9');
  const [backgroundColor, setBackgroundColor] = useState('#123f35');

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
      
      // Update styling for all newly created notifications
      const { error: styleError } = await supabase
        .from('notifications')
        .update({
          font_family: fontFamily,
          text_color: textColor,
          background_color: backgroundColor,
        })
        .eq('title', title)
        .eq('message', message)
        .is('font_family', null);
      
      if (styleError) console.error('Error updating notification styles:', styleError);
    },
    onSuccess: () => {
      toast.success('تم إرسال الإشعار لجميع المستخدمين');
      setTitle('');
      setMessage('');
      setType('info');
      setFontFamily('Cairo');
      setTextColor('#efe6c9');
      setBackgroundColor('#123f35');
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
      <AdminLayout title="إدارة الإشعارات" icon={<Bell className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="إدارة الإشعارات"
      description="إرسال إشعارات عامة لجميع المستخدمين"
      icon={<Bell className="h-5 w-5" />}
      maxWidth="2xl"
    >
      <AdminCard>
        <AdminCardHeader 
          title="إرسال إشعار عام" 
          icon={<Send className="h-5 w-5" />}
          description="سيتم إرسال هذا الإشعار لجميع المستخدمين المسجلين"
        />
        <AdminCardContent>
          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="admin-form-group">
              <Label className="admin-form-label">عنوان الإشعار</Label>
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="مثال: عرض خاص"
                className="admin-input"
                required
              />
            </div>

            <div className="admin-form-group">
              <Label className="admin-form-label">نص الإشعار</Label>
              <Textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="مثال: خصم 20% على جميع المنتجات"
                className="admin-textarea"
                rows={4}
                required
              />
            </div>

            <div className="admin-form-group">
              <Label className="admin-form-label">نوع الإشعار</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger className="admin-select">
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

            <div className="admin-divider" />

            <div className="admin-form-group">
              <Label className="admin-form-label flex items-center gap-2">
                <Type className="h-4 w-4 text-muted-foreground" />
                نوع الخط
              </Label>
              <Select value={fontFamily} onValueChange={setFontFamily}>
                <SelectTrigger className="admin-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Cairo">Cairo (القاهرة)</SelectItem>
                  <SelectItem value="Tajawal">Tajawal (تجوال)</SelectItem>
                  <SelectItem value="Almarai">Almarai (المراعي)</SelectItem>
                  <SelectItem value="Amiri">Amiri (أميري)</SelectItem>
                  <SelectItem value="Scheherazade New">Scheherazade New</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="admin-form-row-2">
              <div className="admin-form-group">
                <Label className="admin-form-label flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  لون النص
                </Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="w-14 h-10 p-1 rounded-lg cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={textColor}
                    onChange={(e) => setTextColor(e.target.value)}
                    className="admin-input flex-1 font-mono text-sm"
                  />
                </div>
              </div>

              <div className="admin-form-group">
                <Label className="admin-form-label flex items-center gap-2">
                  <Palette className="h-4 w-4 text-muted-foreground" />
                  لون الخلفية
                </Label>
                <div className="flex gap-2 items-center">
                  <Input
                    type="color"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="w-14 h-10 p-1 rounded-lg cursor-pointer"
                  />
                  <Input
                    type="text"
                    value={backgroundColor}
                    onChange={(e) => setBackgroundColor(e.target.value)}
                    className="admin-input flex-1 font-mono text-sm"
                  />
                </div>
              </div>
            </div>

            {/* Preview */}
            <div className="admin-form-group">
              <Label className="admin-form-label">معاينة الإشعار</Label>
              <div 
                className="p-4 rounded-xl border border-border/30"
                style={{
                  fontFamily: fontFamily,
                  color: textColor,
                  backgroundColor: backgroundColor,
                }}
              >
                <h3 className="font-bold mb-1">{title || 'عنوان الإشعار'}</h3>
                <p className="text-sm opacity-90">{message || 'نص الإشعار سيظهر هنا'}</p>
              </div>
            </div>

            <Button
              type="submit"
              className="admin-btn-primary w-full gap-2"
              disabled={sendNotification.isPending}
            >
              {sendNotification.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              <Send className="h-4 w-4" />
              إرسال الإشعار
            </Button>
          </form>
        </AdminCardContent>
      </AdminCard>
    </AdminLayout>
  );
};

export default AdminNotifications;
