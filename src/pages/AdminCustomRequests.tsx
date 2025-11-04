import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Loader2, Eye } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

interface AdminCustomRequestsProps {
  requests: any[] | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const AdminCustomRequests = ({ requests, isLoading, refetch }: AdminCustomRequestsProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formData, setFormData] = useState({
    suggested_price: '',
    admin_notes: '',
    status: 'pending'
  });

  const handleEdit = (request: any) => {
    setSelectedRequest(request);
    setFormData({
      suggested_price: request.suggested_price || '',
      admin_notes: request.admin_notes || '',
      status: request.status || 'pending'
    });
    setDialogOpen(true);
  };

  const handleView = (request: any) => {
    setSelectedRequest(request);
    setViewDialogOpen(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedRequest) return;

    setIsSubmitting(true);
    try {
      const { error } = await supabase
        .from('custom_product_requests')
        .update({
          suggested_price: formData.suggested_price ? Number(formData.suggested_price) : null,
          admin_notes: formData.admin_notes || null,
          status: formData.status
        })
        .eq('id', selectedRequest.id);

      if (error) throw error;

      toast.success('تم تحديث الطلب بنجاح');
      setDialogOpen(false);
      refetch();
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
    } catch (error) {
      console.error('Error updating request:', error);
      toast.error('حدث خطأ أثناء تحديث الطلب');
    } finally {
      setIsSubmitting(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const variants: Record<string, { label: string; variant: any }> = {
      pending: { label: 'قيد الانتظار', variant: 'secondary' },
      reviewed: { label: 'تمت المراجعة', variant: 'default' },
      approved: { label: 'موافق عليه', variant: 'default' },
      rejected: { label: 'مرفوض', variant: 'destructive' }
    };
    const config = variants[status] || variants.pending;
    return <Badge variant={config.variant}>{config.label}</Badge>;
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <h2 className="text-2xl font-bold text-foreground">الطلبات المخصصة</h2>
        <p className="text-muted-foreground">إدارة طلبات المنتجات المخصصة من العملاء</p>
      </div>

      <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>العميل</TableHead>
              <TableHead>المنتج</TableHead>
              <TableHead>الكمية</TableHead>
              <TableHead>الحالة</TableHead>
              <TableHead>السعر المقترح</TableHead>
              <TableHead>التاريخ</TableHead>
              <TableHead className="text-left">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {requests?.map((request) => (
              <TableRow key={request.id}>
                <TableCell>{(request as any).profiles?.email || 'غير متوفر'}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {request.product_name}
                </TableCell>
                <TableCell>{request.quantity}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  {request.suggested_price 
                    ? `${Number(request.suggested_price).toFixed(2)} دينار عراقي`
                    : '-'}
                </TableCell>
                <TableCell>
                  {new Date(request.created_at).toLocaleDateString('ar-SA')}
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex gap-2">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(request)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(request)}
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow>
                <TableCell colSpan={7} className="text-center text-muted-foreground py-8">
                  لا توجد طلبات مخصصة
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* View Dialog */}
      <Dialog open={viewDialogOpen} onOpenChange={setViewDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>تفاصيل الطلب</DialogTitle>
          </DialogHeader>
          {selectedRequest && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">العميل</Label>
                  <p className="font-medium">{(selectedRequest as any).profiles?.email}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">اسم المنتج</Label>
                <p className="font-medium">{selectedRequest.product_name}</p>
              </div>
              
              <div>
                <Label className="text-muted-foreground">رابط المنتج</Label>
                <a 
                  href={selectedRequest.product_link} 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary hover:underline block truncate"
                >
                  {selectedRequest.product_link}
                </a>
              </div>
              
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <Label className="text-muted-foreground">الكمية</Label>
                  <p className="font-medium">{selectedRequest.quantity}</p>
                </div>
                <div>
                  <Label className="text-muted-foreground">السعر المقترح</Label>
                  <p className="font-medium">
                    {selectedRequest.suggested_price 
                      ? `${Number(selectedRequest.suggested_price).toFixed(2)} دينار عراقي`
                      : 'لم يتم التسعير'}
                  </p>
                </div>
              </div>
              
              {selectedRequest.image_url && (
                <div>
                  <Label className="text-muted-foreground">صورة المنتج</Label>
                  <img 
                    src={selectedRequest.image_url} 
                    alt="صورة المنتج"
                    className="w-full h-64 object-cover rounded-lg mt-2"
                  />
                </div>
              )}
              
              {selectedRequest.description && (
                <div>
                  <Label className="text-muted-foreground">الوصف</Label>
                  <p className="text-sm">{selectedRequest.description}</p>
                </div>
              )}
              
              {selectedRequest.admin_notes && (
                <div>
                  <Label className="text-muted-foreground">ملاحظات الإدارة</Label>
                  <p className="text-sm">{selectedRequest.admin_notes}</p>
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>تسعير وتحديث الطلب</DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="suggested_price">السعر المقترح (اختياري)</Label>
              <Input
                id="suggested_price"
                type="number"
                step="0.01"
                min="0"
                value={formData.suggested_price}
                onChange={(e) => setFormData({ ...formData, suggested_price: e.target.value })}
                placeholder="0.00"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="status">الحالة</Label>
              <select
                id="status"
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                <option value="pending">قيد الانتظار</option>
                <option value="reviewed">تمت المراجعة</option>
                <option value="approved">موافق عليه</option>
                <option value="rejected">مرفوض</option>
              </select>
            </div>

            <div className="space-y-2">
              <Label htmlFor="admin_notes">ملاحظات (اختياري)</Label>
              <Textarea
                id="admin_notes"
                value={formData.admin_notes}
                onChange={(e) => setFormData({ ...formData, admin_notes: e.target.value })}
                placeholder="أضف ملاحظات للعميل..."
                rows={3}
              />
            </div>

            <div className="flex gap-3 pt-4">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 bg-gradient-to-b from-primary to-accent"
              >
                {isSubmitting && <Loader2 className="ml-2 h-4 w-4 animate-spin" />}
                حفظ التغييرات
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setDialogOpen(false)}
                disabled={isSubmitting}
              >
                إلغاء
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomRequests;