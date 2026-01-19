import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Loader2, Send, MessageCircle } from 'lucide-react';
import { toast } from 'sonner';

interface AdminMessageDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  orderId: string;
  orderNumber: string;
  userId: string;
  customerName: string;
}

const AdminMessageDialog = ({
  open,
  onOpenChange,
  orderId,
  orderNumber,
  userId,
  customerName
}: AdminMessageDialogProps) => {
  const [title, setTitle] = useState(`بخصوص طلبك رقم ${orderNumber}`);
  const [message, setMessage] = useState('');
  const queryClient = useQueryClient();

  const sendMessageMutation = useMutation({
    mutationFn: async () => {
      if (!message.trim()) throw new Error('الرسالة مطلوبة');

      // 1. Create notification for the user
      const { error: notifError } = await supabase
        .from('notifications')
        .insert({
          user_id: userId,
          title: title,
          message: message,
          type: 'admin_message',
          related_id: orderId,
          is_general: false
        });

      if (notifError) throw notifError;

      // 2. Send Telegram notification to the user
      try {
        await supabase.functions.invoke('send-user-telegram-notification', {
          body: {
            user_id: userId,
            title: title,
            message: message,
            notification_type: 'info'
          }
        });
      } catch (telegramError) {
        console.error('Telegram notification error:', telegramError);
        // Don't fail if Telegram fails
      }

      return { success: true };
    },
    onSuccess: () => {
      toast.success('تم إرسال الرسالة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
      setMessage('');
      setTitle(`بخصوص طلبك رقم ${orderNumber}`);
      onOpenChange(false);
    },
    onError: (error) => {
      console.error('Error sending message:', error);
      toast.error('فشل في إرسال الرسالة');
    }
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <MessageCircle className="h-5 w-5 text-primary" />
            إرسال رسالة للزبون
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="p-3 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">المستلم:</p>
            <p className="font-medium">{customerName}</p>
            <p className="text-xs text-muted-foreground mt-1">طلب رقم: {orderNumber}</p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-title">عنوان الرسالة</Label>
            <Input
              id="message-title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="عنوان الرسالة"
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="message-content">محتوى الرسالة *</Label>
            <Textarea
              id="message-content"
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="اكتب رسالتك هنا..."
              rows={4}
              className="resize-none"
            />
          </div>

          <p className="text-xs text-muted-foreground">
            سيتم إرسال إشعار للزبون داخل التطبيق وعبر التليجرام (إذا كان مربوطاً)
          </p>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={sendMessageMutation.isPending}
          >
            إلغاء
          </Button>
          <Button
            onClick={() => sendMessageMutation.mutate()}
            disabled={!message.trim() || sendMessageMutation.isPending}
            className="gap-2"
          >
            {sendMessageMutation.isPending ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                جاري الإرسال...
              </>
            ) : (
              <>
                <Send className="h-4 w-4" />
                إرسال الرسالة
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdminMessageDialog;
