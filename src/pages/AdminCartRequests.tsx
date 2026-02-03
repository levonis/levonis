import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { 
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { 
  ShoppingCart, 
  Loader2, 
  Edit, 
  MessageCircle, 
  Check,
  Package,
  Search,
  Send,
} from 'lucide-react';
import { toast } from 'sonner';
import { formatDistanceToNow } from 'date-fns';
import { ar } from 'date-fns/locale';
import { formatPrice } from '@/lib/utils';
import AdminLayout, { AdminCard, AdminCardContent, AdminLoading, AdminEmptyState } from '@/components/admin/AdminLayout';
import { sendAllNotifications } from '@/lib/notifications';

interface CartRequest {
  id: string;
  user_id: string;
  cart_code: string;
  status: string;
  original_total: number;
  adjusted_total: number | null;
  admin_notes: string | null;
  user_notes: string | null;
  cart_items: any[];
  conversation_id: string | null;
  created_at: string;
  updated_at: string;
  user?: {
    id: string;
    full_name: string | null;
    username: string | null;
    avatar_url: string | null;
  };
}

export default function AdminCartRequests() {
  const { user, isAdmin, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRequest, setSelectedRequest] = useState<CartRequest | null>(null);
  const [showEditDialog, setShowEditDialog] = useState(false);
  const [showProductSendDialog, setShowProductSendDialog] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState('');
  const [adminNotes, setAdminNotes] = useState('');

  // جلب طلبات السلة
  const { data: cartRequests = [], isLoading } = useQuery({
    queryKey: ['admin-cart-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cart_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      // جلب معلومات المستخدمين
      const requestsWithUsers = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', request.user_id)
            .single();

          return {
            ...request,
            user: profile,
          };
        })
      );

      return requestsWithUsers as CartRequest[];
    },
    enabled: !!user && isAdmin,
  });

  // تعديل السعر
  const updatePriceMutation = useMutation({
    mutationFn: async ({ requestId, adjustedTotal, adminNotes }: { requestId: string; adjustedTotal: number; adminNotes: string }) => {
      const { error } = await supabase
        .from('cart_requests')
        .update({
          adjusted_total: adjustedTotal,
          admin_notes: adminNotes,
          status: 'adjusted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      // Send all notifications (in-app, Telegram, Email)
      const request = cartRequests.find(r => r.id === requestId);
      if (request) {
        await sendAllNotifications({
          userId: request.user_id,
          title: 'تم تعديل سعر السلة',
          message: `تم تعديل سعر السلة (${request.cart_code}) من ${formatPrice(request.original_total)} إلى ${formatPrice(adjustedTotal)} د.ع${adminNotes ? `\n📝 ملاحظات: ${adminNotes}` : ''}`,
          type: 'info',
          relatedId: requestId,
          notificationType: 'order_status',
          metadata: {
            orderNumber: request.cart_code,
            amount: adjustedTotal,
          }
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cart-requests'] });
      setShowEditDialog(false);
      setSelectedRequest(null);
      setAdjustedTotal('');
      setAdminNotes('');
      toast.success('تم تحديث السعر بنجاح');
    },
    onError: (error) => {
      console.error('Error updating price:', error);
      toast.error('حدث خطأ أثناء تحديث السعر');
    },
  });

  const handleEditClick = (request: CartRequest) => {
    setSelectedRequest(request);
    setAdjustedTotal(request.adjusted_total?.toString() || request.original_total.toString());
    setAdminNotes(request.admin_notes || '');
    setShowEditDialog(true);
  };

  const handleSavePrice = () => {
    if (!selectedRequest) return;

    const price = parseFloat(adjustedTotal);
    if (isNaN(price) || price < 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }

    updatePriceMutation.mutate({
      requestId: selectedRequest.id,
      adjustedTotal: price,
      adminNotes,
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-yellow-500/10 text-yellow-600 border-yellow-500/30">قيد المراجعة</Badge>;
      case 'adjusted':
        return <Badge variant="outline" className="bg-green-500/10 text-green-600 border-green-500/30">تم التعديل</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-blue-500/10 text-blue-600 border-blue-500/30">تمت الموافقة</Badge>;
      case 'completed':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">مكتمل</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const filteredRequests = cartRequests.filter(request =>
    request.cart_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.user?.full_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    request.user?.username?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (authLoading || isLoading) {
    return <AdminLoading />;
  }

  if (!user || !isAdmin) return null;

  return (
    <AdminLayout
      title="طلبات تعديل السلة"
      description="إدارة طلبات تعديل أسعار السلات"
      icon={<ShoppingCart className="h-5 w-5" />}
    >
      {/* شريط البحث */}
      <AdminCard className="mb-4">
        <AdminCardContent className="py-3">
          <div className="relative">
            <Search className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="بحث برقم السلة أو اسم المستخدم..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pr-10"
            />
          </div>
        </AdminCardContent>
      </AdminCard>

      {/* قائمة الطلبات */}
      <AdminCard>
        <AdminCardContent>
          {filteredRequests.length === 0 ? (
            <AdminEmptyState
              icon={<ShoppingCart className="h-12 w-12" />}
              title="لا توجد طلبات"
              description="لم يتم إرسال أي طلبات تعديل سلة بعد"
            />
          ) : (
            <div className="space-y-3">
              {filteredRequests.map((request) => (
                <div
                  key={request.id}
                  className="p-4 rounded-lg border bg-card hover:bg-muted/50 transition-colors"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    {/* معلومات المستخدم والطلب */}
                    <div className="flex items-start gap-3">
                      <img
                        src={request.user?.avatar_url || '/placeholder.svg'}
                        alt={request.user?.full_name || 'مستخدم'}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-bold text-sm">
                            {request.user?.full_name || request.user?.username || 'مستخدم'}
                          </span>
                          {getStatusBadge(request.status)}
                        </div>
                        <div className="flex items-center gap-2 mt-1">
                          <Badge variant="secondary" className="font-mono text-xs">
                            {request.cart_code}
                          </Badge>
                          <span className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(request.created_at), {
                              addSuffix: true,
                              locale: ar,
                            })}
                          </span>
                        </div>
                        <div className="mt-2 text-sm">
                          <span className="text-muted-foreground">الأصلي: </span>
                          <span className="font-bold">{formatPrice(request.original_total)} د.ع</span>
                          {request.adjusted_total && (
                            <>
                              <span className="mx-2 text-muted-foreground">→</span>
                              <span className="font-bold text-green-600">{formatPrice(request.adjusted_total)} د.ع</span>
                            </>
                          )}
                        </div>
                        {request.cart_items && request.cart_items.length > 0 && (
                          <div className="mt-2 flex items-center gap-1 text-xs text-muted-foreground">
                            <Package className="h-3 w-3" />
                            <span>{request.cart_items.length} منتجات</span>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* أزرار الإجراءات */}
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleEditClick(request)}
                      >
                        <Edit className="h-4 w-4 ml-1" />
                        تعديل السعر
                      </Button>
                      {request.conversation_id && (
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => navigate('/cp-x9A3kL7m/chats')}
                        >
                          <MessageCircle className="h-4 w-4 ml-1" />
                          المحادثة
                        </Button>
                      )}
                    </div>
                  </div>

                  {/* عرض المنتجات */}
                  {request.cart_items && request.cart_items.length > 0 && (
                    <div className="mt-3 pt-3 border-t border-border/50">
                      <div className="flex flex-wrap gap-2">
                        {request.cart_items.slice(0, 4).map((item: any, idx: number) => (
                          <div key={idx} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg text-xs">
                            {item.image_url && (
                              <img src={item.image_url} alt="" className="h-8 w-8 rounded object-cover" />
                            )}
                            <div>
                              <p className="font-medium truncate max-w-[120px]">{item.product_name}</p>
                              <p className="text-muted-foreground">x{item.quantity}</p>
                            </div>
                          </div>
                        ))}
                        {request.cart_items.length > 4 && (
                          <div className="flex items-center justify-center p-2 bg-muted/50 rounded-lg text-xs text-muted-foreground">
                            +{request.cart_items.length - 4} أخرى
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      {/* حوار تعديل السعر */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              تعديل سعر السلة
            </DialogTitle>
            <DialogDescription>
              رقم السلة: {selectedRequest?.cart_code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-4">
            {/* السعر الأصلي */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">السعر الأصلي:</p>
              <p className="text-lg font-bold">{selectedRequest && formatPrice(selectedRequest.original_total)} د.ع</p>
            </div>

            {/* السعر الجديد */}
            <div>
              <label className="text-sm font-medium mb-2 block">السعر بعد التعديل (د.ع):</label>
              <Input
                type="number"
                value={adjustedTotal}
                onChange={(e) => setAdjustedTotal(e.target.value)}
                placeholder="أدخل السعر الجديد..."
              />
            </div>

            {/* ملاحظات الإدارة */}
            <div>
              <label className="text-sm font-medium mb-2 block">ملاحظات للعميل (اختياري):</label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="أضف ملاحظاتك هنا..."
                rows={3}
              />
            </div>
          </div>

          <DialogFooter className="flex-row-reverse gap-2">
            <Button
              onClick={handleSavePrice}
              disabled={updatePriceMutation.isPending}
            >
              {updatePriceMutation.isPending ? (
                <>
                  <Loader2 className="ml-2 h-4 w-4 animate-spin" />
                  جاري الحفظ...
                </>
              ) : (
                <>
                  <Check className="ml-2 h-4 w-4" />
                  حفظ التعديل
                </>
              )}
            </Button>
            <Button variant="outline" onClick={() => setShowEditDialog(false)}>
              إلغاء
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AdminLayout>
  );
}
