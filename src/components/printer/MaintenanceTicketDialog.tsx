import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, Wrench } from 'lucide-react';
import { toast } from 'sonner';

interface MaintenanceTicketDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  subscriptionId: string;
  userPrinterId: string;
  printerName: string;
}

export default function MaintenanceTicketDialog({
  open,
  onOpenChange,
  subscriptionId,
  userPrinterId,
  printerName,
}: MaintenanceTicketDialogProps) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [priority, setPriority] = useState('normal');

  const createTicketMutation = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error('يجب تسجيل الدخول');
      if (!title.trim()) throw new Error('يرجى إدخال عنوان المشكلة');

      const { error } = await supabase.from('maintenance_tickets').insert({
        user_id: user.id,
        subscription_id: subscriptionId,
        user_printer_id: userPrinterId,
        title: title.trim(),
        description: description.trim() || null,
        priority,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success('تم إنشاء طلب الصيانة بنجاح');
      queryClient.invalidateQueries({ queryKey: ['maintenance-tickets'] });
      queryClient.invalidateQueries({ queryKey: ['user-subscriptions'] });
      onOpenChange(false);
      setTitle('');
      setDescription('');
      setPriority('normal');
    },
    onError: (error: any) => {
      toast.error(error.message || 'حدث خطأ أثناء إنشاء الطلب');
    },
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md" dir="rtl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wrench className="w-5 h-5 text-primary" />
            طلب صيانة جديد
          </DialogTitle>
          <DialogDescription>
            طلب صيانة للطابعة: {printerName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <div className="space-y-2">
            <Label>عنوان المشكلة *</Label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="مثال: الطابعة لا تطبع بشكل صحيح"
            />
          </div>

          <div className="space-y-2">
            <Label>وصف المشكلة</Label>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="صف المشكلة بالتفصيل..."
              rows={4}
            />
          </div>

          <div className="space-y-2">
            <Label>الأولوية</Label>
            <Select value={priority} onValueChange={setPriority}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="low">منخفضة</SelectItem>
                <SelectItem value="normal">عادية</SelectItem>
                <SelectItem value="high">عالية</SelectItem>
                <SelectItem value="urgent">عاجلة</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            إلغاء
          </Button>
          <Button
            onClick={() => createTicketMutation.mutate()}
            disabled={createTicketMutation.isPending || !title.trim()}
          >
            {createTicketMutation.isPending && (
              <Loader2 className="w-4 h-4 animate-spin ml-2" />
            )}
            إرسال الطلب
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
