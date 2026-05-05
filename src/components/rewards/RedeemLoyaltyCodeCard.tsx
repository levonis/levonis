import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Ticket, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { useQueryClient } from '@tanstack/react-query';

const ERROR_MESSAGES: Record<string, string> = {
  code_not_found: 'الكود غير صالح',
  code_already_used: 'تم استخدام هذا الكود مسبقاً',
  code_expired: 'انتهت صلاحية هذا الكود',
  no_active_warranty: 'تحتاج إلى طابعة فعّالة في الضمان لتفعيل هذا الكود',
  already_has_active_card: 'لديك بطاقة فعّالة بالفعل',
  auth_required: 'يرجى تسجيل الدخول',
};

export default function RedeemLoyaltyCodeCard() {
  const [open, setOpen] = useState(false);
  const [code, setCode] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    const trimmed = code.trim().toUpperCase();
    if (!trimmed) { toast.error('أدخل الكود'); return; }
    setSubmitting(true);
    try {
      const { error } = await (supabase as any).rpc('redeem_loyalty_card_code', { p_code: trimmed });
      if (error) {
        const key = (error.message || '').match(/[a-z_]+/)?.[0] || '';
        toast.error(ERROR_MESSAGES[key] || error.message || 'فشل التفعيل');
        return;
      }
      toast.success('تم تفعيل البطاقة بنجاح');
      setOpen(false);
      setCode('');
      qc.invalidateQueries({ queryKey: ['user-active-card-benefits'] });
      qc.invalidateQueries({ queryKey: ['user-cards'] });
    } catch (e: any) {
      toast.error(e?.message || 'فشل التفعيل');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Card className="cursor-pointer hover:bg-muted/30 transition-colors">
          <CardContent className="p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Ticket className="h-5 w-5 text-emerald-600" />
              </div>
              <div className="text-right">
                <p className="font-medium">تفعيل بطاقة بكود</p>
                <p className="text-xs text-muted-foreground">يتطلب طابعة فعّالة في الضمان</p>
              </div>
            </div>
            <Button size="sm" variant="outline">إدخال كود</Button>
          </CardContent>
        </Card>
      </DialogTrigger>
      <DialogContent className="!overflow-hidden !max-h-none max-w-sm">
        <DialogHeader><DialogTitle>تفعيل بطاقة الولاء بكود</DialogTitle></DialogHeader>
        <div className="space-y-3 overflow-y-auto max-h-[70vh] px-1">
          <p className="text-xs text-muted-foreground leading-relaxed">
            أدخل الكود الذي حصلت عليه. يجب أن تكون لديك طابعة فعّالة في الضمان لتفعيل البطاقة،
            وستبدأ صلاحية البطاقة من لحظة التفعيل.
          </p>
          <Input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            placeholder="مثال: A1B2C3D4E5F6"
            className="font-mono tracking-wider text-center"
            autoFocus
          />
          <Button className="w-full" onClick={submit} disabled={submitting}>
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تفعيل'}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
