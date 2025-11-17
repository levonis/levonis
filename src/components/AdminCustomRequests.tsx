import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Pencil, Loader2, Eye, Trash2, Copy, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import { formatDate, formatPrice } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface AdminCustomRequestsProps {
  requests: any[] | undefined;
  isLoading: boolean;
  refetch: () => void;
}

const AdminCustomRequests = ({ requests, isLoading, refetch }: AdminCustomRequestsProps) => {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [viewDialogOpen, setViewDialogOpen] = useState(false);
  const [retryColorsDialogOpen, setRetryColorsDialogOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isRetryingColors, setIsRetryingColors] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);
  const [retryResult, setRetryResult] = useState<any>(null);
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

  const handleDelete = async (requestId: string) => {
    if (!confirm('هل أنت متأكد من حذف هذا الطلب؟')) return;

    try {
      const { error } = await supabase
        .from('custom_product_requests')
        .delete()
        .eq('id', requestId);

      if (error) throw error;

      toast.success('تم حذف الطلب بنجاح');
      refetch();
      queryClient.invalidateQueries({ queryKey: ['pending-requests-count'] });
    } catch (error) {
      console.error('Error deleting request:', error);
      toast.error('حدث خطأ أثناء حذف الطلب');
    }
  };

  const copyCode = (code: string) => {
    navigator.clipboard.writeText(code);
    toast.success('تم نسخ الكود');
  };

  const handleRetryColors = async (request: any) => {
    setSelectedRequest(request);
    setRetryColorsDialogOpen(true);
    setRetryProgress(0);
    setRetryResult(null);
    setIsRetryingColors(true);

    try {
      // Get existing product colors
      setRetryProgress(20);
      const { data: product } = await supabase
        .from('products')
        .select('colors')
        .eq('slug', request.code)
        .single();

      const existingColors = product?.colors || [];
      
      setRetryProgress(40);

      // Call retry-extract-colors function
      const { data, error } = await supabase.functions.invoke('retry-extract-colors', {
        body: {
          url: request.product_link,
          existingColors
        }
      });

      setRetryProgress(80);

      if (error) throw error;

      setRetryProgress(100);
      setRetryResult(data);

      if (data.newColorsCount > 0) {
        // Update product with new colors
        const existingColorsArray = Array.isArray(existingColors) ? existingColors : [];
        const updatedColors = [...existingColorsArray, ...data.addedColors];
        await supabase
          .from('products')
          .update({ colors: updatedColors })
          .eq('slug', request.code);

        toast.success(`تم إضافة ${data.newColorsCount} لون جديد`);
      } else {
        toast.info('لم يتم العثور على ألوان جديدة');
      }
    } catch (error) {
      console.error('Error retrying colors:', error);
      toast.error('حدث خطأ أثناء إعادة استخراج الألوان');
      setRetryResult({ error: error.message });
    } finally {
      setIsRetryingColors(false);
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
        <p className="text-muted-foreground">إدارة وحذف طلبات المنتجات المخصصة من العملاء</p>
      </div>

      <div className="glass-effect rounded-2xl border border-border/50 overflow-hidden">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>الكود</TableHead>
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
                <TableCell>
                  <div className="flex items-center gap-2">
                    <code className="text-xs font-mono bg-muted px-2 py-1 rounded">
                      {request.code || 'لا يوجد'}
                    </code>
                    {request.code && (
                      <Button
                        size="sm"
                        variant="ghost"
                        className="h-6 w-6 p-0"
                        onClick={() => copyCode(request.code)}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    )}
                  </div>
                </TableCell>
                <TableCell>{(request as any).profiles?.email || (request.user_id ? `${request.user_id.slice(0,8)}...` : 'غير متوفر')}</TableCell>
                <TableCell className="font-medium max-w-[200px] truncate">
                  {request.product_name}
                </TableCell>
                <TableCell>{request.quantity}</TableCell>
                <TableCell>{getStatusBadge(request.status)}</TableCell>
                <TableCell>
                  {request.suggested_price 
                    ? `${formatPrice(Number(request.suggested_price))} دينار عراقي`
                    : '-'}
                </TableCell>
                <TableCell>
                  {formatDate(request.created_at)}
                </TableCell>
                <TableCell className="text-left">
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleView(request)}
                      title="عرض"
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleEdit(request)}
                      title="تعديل"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => handleDelete(request.id)}
                      className="text-destructive hover:text-destructive"
                      title="حذف"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
            {(!requests || requests.length === 0) && (
              <TableRow>
                <TableCell colSpan={8} className="text-center text-muted-foreground py-8">
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
                  <Label className="text-muted-foreground">كود الطلب</Label>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-sm font-mono bg-muted px-3 py-1.5 rounded">
                      {selectedRequest.code || 'لا يوجد'}
                    </code>
                    {selectedRequest.code && (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => copyCode(selectedRequest.code)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        نسخ
                      </Button>
                    )}
                  </div>
                </div>
                <div>
                  <Label className="text-muted-foreground">الحالة</Label>
                  <div className="mt-1">{getStatusBadge(selectedRequest.status)}</div>
                </div>
              </div>
              
              <div>
                <Label className="text-muted-foreground">العميل</Label>
                <p className="font-medium">{(selectedRequest as any).profiles?.email || 'غير متوفر'}</p>
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
                      ? `${formatPrice(Number(selectedRequest.suggested_price))} دينار عراقي`
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
            <DialogTitle>تحديث الطلب</DialogTitle>
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

      {/* Retry Colors Dialog */}
      <Dialog open={retryColorsDialogOpen} onOpenChange={setRetryColorsDialogOpen}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>إعادة استخراج الألوان</DialogTitle>
          </DialogHeader>
          
          <div className="space-y-4">
            {isRetryingColors && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">جاري إعادة استخراج الألوان...</p>
                <Progress value={retryProgress} className="w-full" />
                <p className="text-xs text-muted-foreground text-center">{retryProgress}%</p>
              </div>
            )}

            {retryResult && !retryResult.error && (
              <div className="space-y-4">
                <div className="grid grid-cols-3 gap-4 text-center">
                  <div className="space-y-1 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">إجمالي الألوان</p>
                    <p className="text-2xl font-bold">{retryResult.totalColors}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-muted rounded-lg">
                    <p className="text-sm text-muted-foreground">الألوان السابقة</p>
                    <p className="text-2xl font-bold">{retryResult.existingColors}</p>
                  </div>
                  <div className="space-y-1 p-3 bg-primary/10 rounded-lg">
                    <p className="text-sm text-muted-foreground">ألوان جديدة</p>
                    <p className="text-2xl font-bold text-primary">{retryResult.newColorsCount}</p>
                  </div>
                </div>

                {retryResult.addedColors && retryResult.addedColors.length > 0 && (
                  <div className="space-y-2">
                    <h4 className="font-semibold">الألوان المضافة:</h4>
                    <div className="max-h-64 overflow-y-auto space-y-2">
                      {retryResult.addedColors.map((color: any, idx: number) => (
                        <div key={idx} className="flex items-center gap-3 p-2 bg-muted rounded-lg">
                          {color.image_url && (
                            <img 
                              src={color.image_url} 
                              alt={color.name}
                              className="w-12 h-12 object-cover rounded"
                            />
                          )}
                          <div className="flex-1">
                            <p className="font-medium">{color.name}</p>
                            <p className="text-sm text-muted-foreground">{color.name_ar}</p>
                          </div>
                          {color.hex_code && (
                            <div 
                              className="w-8 h-8 rounded border"
                              style={{ backgroundColor: color.hex_code }}
                            />
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {retryResult.newColorsCount === 0 && (
                  <p className="text-center text-muted-foreground py-4">
                    لم يتم العثور على ألوان جديدة. جميع الألوان مستخرجة بالفعل.
                  </p>
                )}
              </div>
            )}

            {retryResult?.error && (
              <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
                <p className="font-semibold">خطأ:</p>
                <p className="text-sm">{retryResult.error}</p>
              </div>
            )}

            {!isRetryingColors && retryResult && (
              <Button 
                onClick={() => setRetryColorsDialogOpen(false)}
                className="w-full"
              >
                إغلاق
              </Button>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminCustomRequests;