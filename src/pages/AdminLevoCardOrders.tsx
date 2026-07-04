import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import { CreditCard, Check, X, Loader2, Mail, Calendar, User, Package, Pencil, Send } from 'lucide-react';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type Status = 'paid_pending_approval' | 'pending_payment' | 'approved' | 'rejected' | 'cancelled';

interface Row {
  id: string;
  user_id: string;
  order_id: string | null;
  status: Status;
  full_name_triple: string;
  birth_date: string;
  email: string;
  admin_notes: string | null;
  rejection_reason: string | null;
  approved_at: string | null;
  created_at: string;
  assigned_card_id: string | null;
  profiles?: { full_name?: string; username?: string; phone_number?: string } | null;
  orders?: { order_number?: string; payment_status?: string; total_amount?: number } | null;
}

export default function AdminLevoCardOrders() {
  const qc = useQueryClient();
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [rejectFor, setRejectFor] = useState<Row | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editEmailFor, setEditEmailFor] = useState<Row | null>(null);
  const [emailDraft, setEmailDraft] = useState('');
  const [resendFor, setResendFor] = useState<Row | null>(null);
  const [resendEmail, setResendEmail] = useState('');

  const saveEmail = async () => {
    if (!editEmailFor) return;
    const email = emailDraft.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error('صيغة البريد غير صحيحة');
      return;
    }
    setBusyId(editEmailFor.id);
    try {
      const { error } = await (supabase as any)
        .from('levo_card_orders')
        .update({ email, updated_at: new Date().toISOString() })
        .eq('id', editEmailFor.id);
      if (error) throw error;
      toast.success('تم تحديث البريد');
      setEditEmailFor(null);
      qc.invalidateQueries({ queryKey: ['admin-levo-orders'] });
    } catch (e: any) {
      toast.error(e?.message || 'فشل التحديث');
    } finally {
      setBusyId(null);
    }
  };

  const doResend = async () => {
    if (!resendFor) return;
    const email = resendEmail.trim().toLowerCase();
    if (!EMAIL_RE.test(email)) {
      toast.error('صيغة البريد غير صحيحة');
      return;
    }
    setBusyId(resendFor.id);
    try {
      // Update email if changed
      if (email !== resendFor.email) {
        const { error: uErr } = await (supabase as any)
          .from('levo_card_orders')
          .update({ email, updated_at: new Date().toISOString() })
          .eq('id', resendFor.id);
        if (uErr) throw uErr;
      }
      // Fetch card details
      if (!resendFor.assigned_card_id) throw new Error('لا توجد بطاقة مرتبطة بالطلب');
      const { data: card, error: cErr } = await (supabase as any)
        .from('levo_physical_cards')
        .select('card_number, pin_plaintext, qr_token, nfc_token')
        .eq('id', resendFor.assigned_card_id)
        .maybeSingle();
      if (cErr) throw cErr;
      if (!card) throw new Error('البطاقة غير موجودة');

      let card_number = card.card_number;
      let pin = card.pin_plaintext;
      let qr_token = card.qr_token;
      let nfc_token = card.nfc_token;

      // If any secret is missing (cleared post-assignment), regenerate them
      if (!pin || !qr_token || !nfc_token) {
        const { data: regen, error: rErr } = await (supabase as any).rpc(
          'admin_regen_levo_card_secrets',
          { p_card_id: resendFor.assigned_card_id },
        );
        if (rErr) throw rErr;
        if (!regen?.success) throw new Error(regen?.error || 'regen_failed');
        card_number = regen.card_number;
        pin = regen.pin;
        qr_token = regen.qr_token;
        nfc_token = regen.nfc_token;
      }

      const { error: eErr } = await supabase.functions.invoke('send-levo-card-approval', {
        body: {
          recipient_email: email,
          full_name: resendFor.full_name_triple,
          card_number,
          pin,
          qr_token,
          nfc_token,
        },
      });
      if (eErr) throw eErr;
      toast.success('تم إعادة إرسال البريد بنجاح');
      setResendFor(null);
      qc.invalidateQueries({ queryKey: ['admin-levo-orders'] });
    } catch (e: any) {
      toast.error(e?.message || 'فشل إعادة الإرسال');
    } finally {
      setBusyId(null);
    }
  };

  const statusFilter =
    tab === 'pending' ? ['paid_pending_approval', 'pending_payment'] :
    tab === 'approved' ? ['approved'] :
    ['rejected', 'cancelled'];

  const { data: rows, isLoading } = useQuery({
    queryKey: ['admin-levo-orders', tab],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from('levo_card_orders')
        .select('*')
        .in('status', statusFilter)
        .order('created_at', { ascending: false });
      if (error) throw error;
      const list = (data || []) as Row[];
      const userIds = Array.from(new Set(list.map((r) => r.user_id).filter(Boolean)));
      const orderIds = Array.from(new Set(list.map((r) => r.order_id).filter(Boolean) as string[]));
      const [{ data: profs }, { data: ords }] = await Promise.all([
        userIds.length
          ? (supabase as any)
              .from('profiles')
              .select('id, full_name, username, phone_number')
              .in('id', userIds)
          : Promise.resolve({ data: [] }),
        orderIds.length
          ? (supabase as any)
              .from('orders')
              .select('id, order_number, payment_status, total_amount')
              .in('id', orderIds)
          : Promise.resolve({ data: [] }),
      ]);
      const pmap = new Map<string, any>((profs || []).map((p: any) => [p.id, p]));
      const omap = new Map<string, any>((ords || []).map((o: any) => [o.id, o]));
      return list.map((r) => ({
        ...r,
        profiles: (pmap.get(r.user_id) as any) || null,
        orders: r.order_id ? ((omap.get(r.order_id) as any) || null) : null,
      })) as Row[];
    },
    staleTime: 15_000,
  });

  const approve = async (row: Row) => {
    setBusyId(row.id);
    try {
      const { data, error } = await (supabase as any).rpc('approve_levo_card_order', {
        p_request_id: row.id,
        p_admin_notes: null,
      });
      if (error) throw error;
      if (!data?.success) {
        const errMap: Record<string, string> = {
          no_cards_available: 'لا توجد بطاقات فيزيائية متاحة في المخزون',
          user_already_has_card: 'المستخدم لديه بطاقة نشطة بالفعل',
          forbidden: 'صلاحية أدمن مطلوبة',
          not_found: 'الطلب غير موجود',
          invalid_status: `لا يمكن الموافقة على طلب بحالة: ${data.status}`,
        };
        throw new Error(errMap[data?.error] || data?.error || 'failed');
      }
      // Fire email (non-blocking for UX; awaited to surface errors)
      try {
        const { error: emailErr } = await supabase.functions.invoke('send-levo-card-approval', {
          body: {
            recipient_email: data.email,
            full_name: data.full_name,
            card_number: data.card.card_number,
            pin: data.card.pin,
            qr_token: data.card.qr_token,
            nfc_token: data.card.nfc_token,
          },
        });
        if (emailErr) {
          toast.warning('تمت الموافقة، لكن فشل إرسال الإيميل. راجع سجلات edge function.');
        } else {
          toast.success('تمت الموافقة وإرسال البريد للمستخدم');
        }
      } catch (e) {
        toast.warning('تمت الموافقة، لكن الإيميل قد لا يكون أُرسل');
      }
      qc.invalidateQueries({ queryKey: ['admin-levo-orders'] });
    } catch (e: any) {
      toast.error(e?.message || 'فشلت الموافقة');
    } finally {
      setBusyId(null);
    }
  };

  const doReject = async () => {
    if (!rejectFor || !rejectReason.trim()) return;
    setBusyId(rejectFor.id);
    try {
      const { data, error } = await (supabase as any).rpc('reject_levo_card_order', {
        p_request_id: rejectFor.id,
        p_reason: rejectReason.trim(),
      });
      if (error) throw error;
      if (!data?.success) throw new Error(data?.error || 'failed');
      toast.success('تم رفض الطلب');
      setRejectFor(null);
      setRejectReason('');
      qc.invalidateQueries({ queryKey: ['admin-levo-orders'] });
    } catch (e: any) {
      toast.error(e?.message || 'فشل الرفض');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="container mx-auto p-4 max-w-5xl" dir="rtl">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
          <CreditCard className="h-6 w-6 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">طلبات بطاقة ليفو الفيزيائية</h1>
          <p className="text-xs text-muted-foreground">
            راجع بيانات المستخدم ووافق لتخصيص البطاقة وإرسال البريد
          </p>
        </div>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList className="grid w-full grid-cols-3">
          <TabsTrigger value="pending">قيد المراجعة</TabsTrigger>
          <TabsTrigger value="approved">الموافَق عليها</TabsTrigger>
          <TabsTrigger value="rejected">المرفوضة/الملغاة</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-3">
          {isLoading ? (
            <div className="flex justify-center p-8">
              <Loader2 className="h-6 w-6 animate-spin text-primary" />
            </div>
          ) : rows?.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center text-muted-foreground text-sm">
                لا توجد طلبات في هذه الفئة
              </CardContent>
            </Card>
          ) : (
            rows?.map((row) => (
              <Card key={row.id}>
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base flex items-center gap-2">
                      <User className="h-4 w-4 text-primary" />
                      {row.profiles?.full_name || row.profiles?.username || row.user_id.slice(0, 8)}
                    </CardTitle>
                    <Badge
                      variant={
                        row.status === 'approved' ? 'default' :
                        row.status === 'rejected' || row.status === 'cancelled' ? 'destructive' :
                        'outline'
                      }
                    >
                      {row.status === 'paid_pending_approval' ? 'مدفوع - بانتظار الموافقة' :
                       row.status === 'pending_payment' ? 'بانتظار الدفع' :
                       row.status === 'approved' ? 'موافَق' :
                       row.status === 'rejected' ? 'مرفوض' : 'ملغى'}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm bg-muted/40 rounded-lg p-3">
                    <div>
                      <div className="text-xs text-muted-foreground">الاسم الثلاثي</div>
                      <div className="font-medium">{row.full_name_triple}</div>
                    </div>
                    <div>
                      <div className="text-xs text-muted-foreground flex items-center gap-1">
                        <Calendar className="h-3 w-3" /> تاريخ الميلاد
                      </div>
                      <div className="font-medium">{row.birth_date}</div>
                    </div>
                    <div className="sm:col-span-2">
                      <div className="text-xs text-muted-foreground flex items-center gap-1 justify-between">
                        <span className="flex items-center gap-1">
                          <Mail className="h-3 w-3" /> البريد الإلكتروني
                        </span>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 px-2 text-xs"
                          onClick={() => {
                            setEditEmailFor(row);
                            setEmailDraft(row.email || '');
                          }}
                        >
                          <Pencil className="h-3 w-3 ml-1" /> تعديل
                        </Button>
                      </div>
                      <div className="font-medium ltr:text-left" dir="ltr">{row.email}</div>
                    </div>
                    {row.profiles?.phone_number && (
                      <div>
                        <div className="text-xs text-muted-foreground">هاتف الحساب</div>
                        <div className="font-medium" dir="ltr">{row.profiles.phone_number}</div>
                      </div>
                    )}
                    {row.orders && (
                      <div>
                        <div className="text-xs text-muted-foreground flex items-center gap-1">
                          <Package className="h-3 w-3" /> رقم الطلب
                        </div>
                        <div className="font-medium">
                          {row.orders.order_number}
                          {row.orders.payment_status && (
                            <Badge variant="outline" className="mr-1 text-xs">
                              {row.orders.payment_status}
                            </Badge>
                          )}
                        </div>
                      </div>
                    )}
                  </div>

                  {row.rejection_reason && (
                    <div className="text-xs bg-red-500/10 border border-red-500/30 rounded p-2 text-red-600">
                      سبب الرفض: {row.rejection_reason}
                    </div>
                  )}

                  {row.status === 'paid_pending_approval' && (
                    <div className="flex gap-2">
                      <Button
                        onClick={() => approve(row)}
                        disabled={busyId === row.id}
                        className="flex-1"
                      >
                        {busyId === row.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <>
                            <Check className="h-4 w-4 ml-1" /> موافقة وإرسال البطاقة
                          </>
                        )}
                      </Button>
                      <Button
                        variant="outline"
                        onClick={() => {
                          setRejectFor(row);
                          setRejectReason('');
                        }}
                        disabled={busyId === row.id}
                      >
                        <X className="h-4 w-4 ml-1" /> رفض
                      </Button>
                    </div>
                  )}

                  {row.status === 'pending_payment' && (
                    <div className="text-xs text-amber-600 bg-amber-500/10 border border-amber-500/30 rounded p-2">
                      المستخدم لم يُتم الدفع بعد. لا يمكن الموافقة حتى تنتقل الحالة إلى "مدفوع".
                    </div>
                  )}

                  {row.status === 'approved' && row.assigned_card_id && (
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => {
                        setResendFor(row);
                        setResendEmail(row.email || '');
                      }}
                      disabled={busyId === row.id}
                    >
                      {busyId === row.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4 ml-1" /> إعادة إرسال بيانات البطاقة
                        </>
                      )}
                    </Button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!rejectFor} onOpenChange={(o) => !o && setRejectFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>رفض طلب البطاقة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              سبب الرفض (سيظهر للمستخدم):
            </label>
            <Textarea
              rows={3}
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="مثال: البيانات المُدخلة غير مطابقة للوثائق"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectFor(null)}>
              إلغاء
            </Button>
            <Button
              variant="destructive"
              onClick={doReject}
              disabled={!rejectReason.trim() || !!busyId}
            >
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'تأكيد الرفض'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Edit email */}
      <Dialog open={!!editEmailFor} onOpenChange={(o) => !o && setEditEmailFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>تعديل البريد الإلكتروني</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              البريد الجديد الذي سترسل إليه بيانات البطاقة:
            </label>
            <Input
              type="email"
              dir="ltr"
              value={emailDraft}
              onChange={(e) => setEmailDraft(e.target.value)}
              placeholder="user@example.com"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditEmailFor(null)}>إلغاء</Button>
            <Button onClick={saveEmail} disabled={!!busyId}>
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : 'حفظ'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Resend approval email */}
      <Dialog open={!!resendFor} onOpenChange={(o) => !o && setResendFor(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>إعادة إرسال بيانات البطاقة</DialogTitle>
          </DialogHeader>
          <div className="space-y-2">
            <label className="text-sm text-muted-foreground">
              يمكنك تعديل البريد قبل الإرسال إذا كان المستخدم قد أدخله خطأً:
            </label>
            <Input
              type="email"
              dir="ltr"
              value={resendEmail}
              onChange={(e) => setResendEmail(e.target.value)}
              placeholder="user@example.com"
            />
            <p className="text-xs text-amber-600">
              سيتم إرسال رقم البطاقة والـ PIN ورموز QR/NFC إلى هذا البريد.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setResendFor(null)}>إلغاء</Button>
            <Button onClick={doResend} disabled={!!busyId}>
              {busyId ? <Loader2 className="h-4 w-4 animate-spin" /> : (
                <><Send className="h-4 w-4 ml-1" /> إرسال</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
