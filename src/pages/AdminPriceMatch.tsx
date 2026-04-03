import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import AdminLayout, { AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { ADMIN_ROUTES } from '@/config/adminConfig';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { BadgeDollarSign, ExternalLink, Eye, Check, X, Clock, MessageSquare } from 'lucide-react';
import { toast } from 'sonner';
import { useState } from 'react';
import { formatPrice } from '@/lib/utils';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';

interface PriceMatchRequest {
  id: string;
  user_id: string;
  product_id: string;
  found_price: number;
  image_url: string | null;
  source_url: string | null;
  notes: string | null;
  status: string;
  admin_notes: string | null;
  created_at: string;
  products: { name_ar: string; price: number; image_url: string | null } | null;
  profiles: { full_name: string | null; phone: string | null } | null;
}

const AdminPriceMatch = () => {
  const queryClient = useQueryClient();
  const [selectedRequest, setSelectedRequest] = useState<PriceMatchRequest | null>(null);
  const [adminNotes, setAdminNotes] = useState('');
  const [imageModal, setImageModal] = useState<string | null>(null);

  const { data: requests, isLoading } = useQuery({
    queryKey: ['admin-price-match-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('price_match_requests')
        .select(`
          *,
          products:product_id (name_ar, price, image_url)
        `)
        .order('created_at', { ascending: false });
      if (error) throw error;

      // Fetch profiles separately since there's no FK
      const userIds = [...new Set((data || []).map((r: any) => r.user_id))];
      let profilesMap = new Map<string, { full_name: string | null; phone_number: string | null }>();
      if (userIds.length > 0) {
        const { data: profiles } = await supabase
          .from('profiles')
          .select('id, full_name, phone_number')
          .in('id', userIds);
        if (profiles) {
          profiles.forEach((p: any) => profilesMap.set(p.id, p));
        }
      }

      return (data || []).map((r: any) => {
        const prof = profilesMap.get(r.user_id);
        return {
          ...r,
          profiles: prof ? { full_name: prof.full_name, phone: prof.phone_number } : null,
        };
      }) as PriceMatchRequest[];
    },
  });

  const updateStatusMutation = useMutation({
    mutationFn: async ({ id, status, notes }: { id: string; status: string; notes?: string }) => {
      const updateData: any = { status };
      if (notes !== undefined) updateData.admin_notes = notes;
      const { error } = await supabase
        .from('price_match_requests')
        .update(updateData)
        .eq('id', id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-price-match-requests'] });
      toast.success('تم تحديث الحالة');
      setSelectedRequest(null);
      setAdminNotes('');
    },
    onError: () => toast.error('حدث خطأ'),
  });

  const pendingCount = requests?.filter(r => r.status === 'pending').length || 0;

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending': return <Badge variant="outline" className="text-amber-500 border-amber-500/30"><Clock className="h-3 w-3 ml-1" />قيد المراجعة</Badge>;
      case 'approved': return <Badge className="bg-green-500/10 text-green-500 border-green-500/30"><Check className="h-3 w-3 ml-1" />تمت الموافقة</Badge>;
      case 'rejected': return <Badge variant="destructive"><X className="h-3 w-3 ml-1" />مرفوض</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
    }
  };

  if (isLoading) return <AdminLayout title="مطابقة الأسعار" description="تحميل..." icon={<BadgeDollarSign className="h-5 w-5" />} backTo={ADMIN_ROUTES.dashboard}><AdminLoading /></AdminLayout>;

  return (
    <AdminLayout
      title={`مطابقة الأسعار ${pendingCount > 0 ? `(${pendingCount} معلق)` : ''}`}
      description="طلبات العملاء لمطابقة الأسعار"
      icon={<BadgeDollarSign className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.dashboard}
    >
      {!requests?.length ? (
        <AdminEmptyState icon={<BadgeDollarSign className="h-8 w-8" />} title="لا توجد طلبات" description="لم يتم استلام أي طلبات مطابقة أسعار بعد" />
      ) : (
        <div className="space-y-3">
          {requests.map((req) => (
            <div key={req.id} className="border border-border/30 rounded-xl p-4 bg-card/50 backdrop-blur-sm space-y-3">
              <div className="flex items-start justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  {req.products?.image_url && (
                    <img src={req.products.image_url} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0" />
                  )}
                  <div className="min-w-0">
                    <p className="text-sm font-bold truncate">{req.products?.name_ar || 'منتج محذوف'}</p>
                    <p className="text-xs text-muted-foreground">{req.profiles?.full_name || 'مستخدم'} • {req.profiles?.phone || ''}</p>
                    <p className="text-[10px] text-muted-foreground">{new Date(req.created_at).toLocaleDateString('ar-IQ', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</p>
                  </div>
                </div>
                {getStatusBadge(req.status)}
              </div>

              <div className="grid grid-cols-2 gap-2 text-xs">
                <div className="bg-muted/30 rounded-lg p-2">
                  <span className="text-muted-foreground block">سعرنا</span>
                  <span className="font-black text-primary">{formatPrice(req.products?.price || 0)}</span>
                </div>
                <div className="bg-muted/30 rounded-lg p-2">
                  <span className="text-muted-foreground block">السعر المُبلغ عنه</span>
                  <span className="font-black text-destructive">{formatPrice(req.found_price)}</span>
                </div>
              </div>

              {req.notes && (
                <p className="text-xs text-muted-foreground bg-muted/20 rounded-lg p-2">💬 {req.notes}</p>
              )}

              {req.admin_notes && (
                <p className="text-xs text-primary bg-primary/5 rounded-lg p-2">📝 ملاحظات الأدمن: {req.admin_notes}</p>
              )}

              <div className="flex items-center gap-2 flex-wrap">
                {req.image_url && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setImageModal(req.image_url)}>
                    <Eye className="h-3 w-3 ml-1" />
                    عرض الصورة
                  </Button>
                )}
                {req.source_url && (
                  <Button size="sm" variant="outline" className="h-7 text-xs" asChild>
                    <a href={req.source_url} target="_blank" rel="noopener noreferrer">
                      <ExternalLink className="h-3 w-3 ml-1" />
                      عرض المصدر
                    </a>
                  </Button>
                )}
                {req.status === 'pending' && (
                  <>
                    <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => { setSelectedRequest(req); setAdminNotes(req.admin_notes || ''); }}>
                      <MessageSquare className="h-3 w-3 ml-1" />
                      رد
                    </Button>
                    <Button size="sm" className="h-7 text-xs bg-green-600 hover:bg-green-700" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'approved' })}>
                      <Check className="h-3 w-3 ml-1" />
                      موافقة
                    </Button>
                    <Button size="sm" variant="destructive" className="h-7 text-xs" onClick={() => updateStatusMutation.mutate({ id: req.id, status: 'rejected' })}>
                      <X className="h-3 w-3 ml-1" />
                      رفض
                    </Button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Admin Notes Dialog */}
      <Dialog open={!!selectedRequest} onOpenChange={() => setSelectedRequest(null)}>
        <DialogContent dir="rtl">
          <DialogHeader>
            <DialogTitle>الرد على طلب مطابقة السعر</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <Textarea
              value={adminNotes}
              onChange={(e) => setAdminNotes(e.target.value)}
              placeholder="اكتب ملاحظاتك هنا..."
              className="min-h-[80px]"
            />
            <div className="flex gap-2">
              <Button
                className="flex-1 bg-green-600 hover:bg-green-700"
                onClick={() => selectedRequest && updateStatusMutation.mutate({ id: selectedRequest.id, status: 'approved', notes: adminNotes })}
              >
                <Check className="h-4 w-4 ml-1" />
                موافقة مع ملاحظة
              </Button>
              <Button
                variant="destructive"
                className="flex-1"
                onClick={() => selectedRequest && updateStatusMutation.mutate({ id: selectedRequest.id, status: 'rejected', notes: adminNotes })}
              >
                <X className="h-4 w-4 ml-1" />
                رفض مع ملاحظة
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Image Modal */}
      <Dialog open={!!imageModal} onOpenChange={() => setImageModal(null)}>
        <DialogContent className="max-w-lg p-2">
          {imageModal && <img src={imageModal} alt="Price proof" className="w-full rounded-lg" />}
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
};

export default AdminPriceMatch;
