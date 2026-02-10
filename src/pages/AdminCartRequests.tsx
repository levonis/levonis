import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
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
  Eye,
  Truck,
  CreditCard,
  StickyNote,
  X,
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
  const [showDetailDialog, setShowDetailDialog] = useState(false);
  const [adjustedTotal, setAdjustedTotal] = useState('');
  const [taxAmount, setTaxAmount] = useState('');
  const [deliveryFee, setDeliveryFee] = useState('');
  const [partialPaymentFee, setPartialPaymentFee] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [itemNotes, setItemNotes] = useState<Record<number, string>>({});

  // جلب طلبات السلة
  const { data: cartRequests = [], isLoading } = useQuery({
    queryKey: ['admin-cart-requests'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('cart_requests')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const requestsWithUsers = await Promise.all(
        (data || []).map(async (request) => {
          const { data: profile } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url')
            .eq('id', request.user_id)
            .single();

          return { ...request, user: profile };
        })
      );

      return requestsWithUsers as CartRequest[];
    },
    enabled: !!user && isAdmin,
  });

  // تعديل السعر
  const updatePriceMutation = useMutation({
    mutationFn: async ({ requestId, updates }: { requestId: string; updates: any }) => {
      const { error } = await supabase
        .from('cart_requests')
        .update({
          ...updates,
          status: 'adjusted',
          updated_at: new Date().toISOString(),
        })
        .eq('id', requestId);

      if (error) throw error;

      const request = cartRequests.find(r => r.id === requestId);
      if (request) {
        const finalTotal = updates.adjusted_total || request.original_total;
        await sendAllNotifications({
          userId: request.user_id,
          title: 'تم تعديل سعر السلة',
          message: `تم تعديل سعر السلة (${request.cart_code}) إلى ${formatPrice(finalTotal)} د.ع${updates.admin_notes ? `\n📝 ملاحظات: ${updates.admin_notes}` : ''}`,
          type: 'info',
          relatedId: requestId,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cart-requests'] });
      setShowEditDialog(false);
      setSelectedRequest(null);
      resetForm();
      toast.success('تم تحديث السعر بنجاح');
    },
    onError: (error) => {
      console.error('Error updating price:', error);
      toast.error('حدث خطأ أثناء تحديث السعر');
    },
  });

  const resetForm = () => {
    setAdjustedTotal('');
    setTaxAmount('');
    setDeliveryFee('');
    setPartialPaymentFee('');
    setAdminNotes('');
    setItemNotes({});
  };

  const handleEditClick = (request: CartRequest) => {
    setSelectedRequest(request);
    setAdjustedTotal(request.adjusted_total?.toString() || request.original_total.toString());
    setAdminNotes(request.admin_notes || '');
    // Parse existing notes for tax/delivery/partial if stored in admin_notes JSON
    try {
      const existingMeta = request.admin_notes ? JSON.parse(request.admin_notes) : {};
      setTaxAmount(existingMeta.tax?.toString() || '');
      setDeliveryFee(existingMeta.delivery?.toString() || '');
      setPartialPaymentFee(existingMeta.partialFee?.toString() || '');
      setAdminNotes(existingMeta.notes || request.admin_notes || '');
      setItemNotes(existingMeta.itemNotes || {});
    } catch {
      setTaxAmount('');
      setDeliveryFee('');
      setPartialPaymentFee('');
    }
    setShowEditDialog(true);
  };

  const handleViewClick = (request: CartRequest) => {
    setSelectedRequest(request);
    setShowDetailDialog(true);
  };

  const handleSavePrice = () => {
    if (!selectedRequest) return;

    const price = parseFloat(adjustedTotal);
    if (isNaN(price) || price < 0) {
      toast.error('الرجاء إدخال سعر صحيح');
      return;
    }

    const metaNotes = JSON.stringify({
      notes: adminNotes,
      tax: taxAmount ? parseFloat(taxAmount) : 0,
      delivery: deliveryFee ? parseFloat(deliveryFee) : 0,
      partialFee: partialPaymentFee ? parseFloat(partialPaymentFee) : 0,
      itemNotes,
    });

    updatePriceMutation.mutate({
      requestId: selectedRequest.id,
      updates: {
        adjusted_total: price,
        admin_notes: metaNotes,
      },
    });
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <Badge variant="outline" className="bg-accent/50 text-accent-foreground border-accent">قيد المراجعة</Badge>;
      case 'adjusted':
        return <Badge variant="outline" className="bg-primary/10 text-primary border-primary/30">تم التعديل</Badge>;
      case 'approved':
        return <Badge variant="outline" className="bg-secondary text-secondary-foreground border-secondary">تمت الموافقة</Badge>;
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

  if (authLoading || isLoading) return <AdminLoading />;
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
                              <span className="font-bold text-primary">{formatPrice(request.adjusted_total)} د.ع</span>
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

                    <div className="flex items-center gap-2 flex-shrink-0">
                      <Button variant="outline" size="sm" onClick={() => handleViewClick(request)}>
                        <Eye className="h-4 w-4 ml-1" />
                        عرض
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleEditClick(request)}>
                        <Edit className="h-4 w-4 ml-1" />
                        تعديل
                      </Button>
                      {request.conversation_id && (
                        <Button variant="ghost" size="sm" onClick={() => navigate('/cp-x9A3kL7m/chats')}>
                          <MessageCircle className="h-4 w-4 ml-1" />
                          المحادثة
                        </Button>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </AdminCardContent>
      </AdminCard>

      {/* حوار عرض التفاصيل */}
      <Dialog open={showDetailDialog} onOpenChange={setShowDetailDialog}>
        <DialogContent className="sm:max-w-lg max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Eye className="h-5 w-5 text-primary" />
              تفاصيل السلة
            </DialogTitle>
            <DialogDescription>
              رقم السلة: {selectedRequest?.cart_code}
            </DialogDescription>
          </DialogHeader>

          {selectedRequest && (
            <div className="space-y-4">
              {/* معلومات العميل */}
              <div className="flex items-center gap-3 p-3 bg-muted/50 rounded-lg">
                <img
                  src={selectedRequest.user?.avatar_url || '/placeholder.svg'}
                  alt=""
                  className="h-10 w-10 rounded-full object-cover"
                />
                <div>
                  <p className="font-medium text-sm">{selectedRequest.user?.full_name || 'مستخدم'}</p>
                  <p className="text-xs text-muted-foreground">@{selectedRequest.user?.username || 'N/A'}</p>
                </div>
                {getStatusBadge(selectedRequest.status)}
              </div>

              {/* الأسعار */}
              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground">السعر الأصلي</p>
                  <p className="text-lg font-bold">{formatPrice(selectedRequest.original_total)} د.ع</p>
                </div>
                {selectedRequest.adjusted_total && (
                  <div className="p-3 bg-primary/10 rounded-lg">
                    <p className="text-xs text-muted-foreground">السعر المعدّل</p>
                    <p className="text-lg font-bold text-primary">{formatPrice(selectedRequest.adjusted_total)} د.ع</p>
                  </div>
                )}
              </div>

              {/* ملاحظات العميل */}
              {selectedRequest.user_notes && (
                <div className="p-3 bg-muted/50 rounded-lg">
                  <p className="text-xs text-muted-foreground mb-1">ملاحظات العميل:</p>
                  <p className="text-sm">{selectedRequest.user_notes}</p>
                </div>
              )}

              {/* المنتجات */}
              <div>
                <p className="text-sm font-medium mb-2">المنتجات ({selectedRequest.cart_items?.length || 0})</p>
                <div className="space-y-2">
                  {selectedRequest.cart_items?.map((item: any, idx: number) => (
                    <div key={idx} className="flex items-center gap-3 p-2.5 bg-muted/30 rounded-lg border">
                      {item.image_url && (
                        <img src={item.image_url} alt="" className="h-12 w-12 rounded-lg object-cover" />
                      )}
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">{item.product_name}</p>
                        <div className="flex items-center gap-2 text-xs text-muted-foreground">
                          <span>الكمية: {item.quantity}</span>
                          {item.price && <span>• {formatPrice(item.price)} د.ع</span>}
                          {item.selected_color && <span>• {item.selected_color}</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* حوار تعديل السعر */}
      <Dialog open={showEditDialog} onOpenChange={setShowEditDialog}>
        <DialogContent className="sm:max-w-md max-h-[85vh] overflow-y-auto" dir="rtl">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Edit className="h-5 w-5 text-primary" />
              تعديل سعر السلة
            </DialogTitle>
            <DialogDescription>
              رقم السلة: {selectedRequest?.cart_code}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 my-2">
            {/* السعر الأصلي */}
            <div className="p-3 bg-muted/50 rounded-lg">
              <p className="text-sm text-muted-foreground">السعر الأصلي:</p>
              <p className="text-lg font-bold">{selectedRequest && formatPrice(selectedRequest.original_total)} د.ع</p>
            </div>

            {/* السعر الجديد */}
            <div>
              <label className="text-sm font-medium mb-1.5 block">السعر الكلي بعد التعديل (د.ع):</label>
              <Input
                type="number"
                value={adjustedTotal}
                onChange={(e) => setAdjustedTotal(e.target.value)}
                placeholder="أدخل السعر الجديد..."
              />
            </div>

            <Separator />

            {/* الضريبة */}
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                مبلغ الضريبة (د.ع):
              </label>
              <Input
                type="number"
                value={taxAmount}
                onChange={(e) => setTaxAmount(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* التوصيل */}
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <Truck className="h-3.5 w-3.5 text-muted-foreground" />
                رسوم التوصيل (د.ع):
              </label>
              <Input
                type="number"
                value={deliveryFee}
                onChange={(e) => setDeliveryFee(e.target.value)}
                placeholder="0"
              />
            </div>

            {/* رسوم الدفع الجزئي */}
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <CreditCard className="h-3.5 w-3.5 text-muted-foreground" />
                رسوم الدفع الجزئي (د.ع):
              </label>
              <Input
                type="number"
                value={partialPaymentFee}
                onChange={(e) => setPartialPaymentFee(e.target.value)}
                placeholder="0"
              />
            </div>

            <Separator />

            {/* ملاحظات الإدارة */}
            <div>
              <label className="text-sm font-medium mb-1.5 flex items-center gap-1.5">
                <StickyNote className="h-3.5 w-3.5 text-muted-foreground" />
                ملاحظات للعميل:
              </label>
              <Textarea
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="أضف ملاحظاتك هنا..."
                rows={2}
              />
            </div>

            {/* ملاحظات لكل منتج */}
            {selectedRequest?.cart_items && selectedRequest.cart_items.length > 0 && (
              <div>
                <p className="text-sm font-medium mb-2">ملاحظات لكل منتج:</p>
                <div className="space-y-2">
                  {selectedRequest.cart_items.map((item: any, idx: number) => (
                    <div key={idx} className="p-2 bg-muted/30 rounded-lg">
                      <p className="text-xs font-medium mb-1 truncate">{item.product_name}</p>
                      <Input
                        value={itemNotes[idx] || ''}
                        onChange={(e) => setItemNotes(prev => ({ ...prev, [idx]: e.target.value }))}
                        placeholder="ملاحظة على هذا المنتج..."
                        className="h-8 text-xs"
                      />
                    </div>
                  ))}
                </div>
              </div>
            )}
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
