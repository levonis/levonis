import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Loader2, Eye, Trash2, Download, AlertCircle, FileText } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
import DOMPurify from "dompurify";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { format } from "date-fns";
import { ar } from "date-fns/locale";
import { Badge } from "@/components/ui/badge";
import AdminLayout, { AdminCard, AdminCardHeader, AdminCardContent, AdminEmptyState, AdminLoading } from "@/components/admin/AdminLayout";

export default function AdminSavedInvoices() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [viewingInvoice, setViewingInvoice] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const { data: invoices, isLoading } = useQuery({
    queryKey: ["saved-invoices"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("saved_invoices")
        .select(`
          *,
          orders (
            order_number,
            user_id,
            profiles (username, full_name)
          )
        `)
        .order("generated_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("saved_invoices")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["saved-invoices"] });
      toast.success("تم حذف الفاتورة بنجاح");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف الفاتورة");
    },
  });

  const downloadInvoice = (invoice: any) => {
    const blob = new Blob([invoice.invoice_html], { type: "text/html" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `invoice-${invoice.orders?.order_number || invoice.id}.html`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast.success("تم تنزيل الفاتورة");
  };

  const isWarrantyExpired = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    return new Date(expiryDate) < new Date();
  };

  const isWarrantySoonExpiring = (expiryDate: string | null) => {
    if (!expiryDate) return false;
    const expiry = new Date(expiryDate);
    const now = new Date();
    const daysUntilExpiry = Math.ceil((expiry.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
    return daysUntilExpiry <= 30 && daysUntilExpiry > 0;
  };

  if (!user || !isAdmin) {
    return <Navigate to="/" replace />;
  }

  if (isLoading) {
    return (
      <AdminLayout title="الفواتير المحفوظة" icon={<FileText className="h-5 w-5" />}>
        <AdminLoading />
      </AdminLayout>
    );
  }

  return (
    <AdminLayout
      title="الفواتير المحفوظة"
      description={`إجمالي الفواتير: ${invoices?.length || 0}`}
      icon={<FileText className="h-5 w-5" />}
    >
      {!invoices || invoices.length === 0 ? (
        <AdminEmptyState
          icon={<FileText className="h-12 w-12" />}
          title="لا توجد فواتير محفوظة"
          description="ستظهر الفواتير المحفوظة هنا"
        />
      ) : (
        <div className="space-y-4">
          {invoices.map((invoice) => {
            const expired = isWarrantyExpired(invoice.warranty_expires_at);
            const soonExpiring = isWarrantySoonExpiring(invoice.warranty_expires_at);
            
            return (
              <AdminCard 
                key={invoice.id} 
                className={expired ? 'border-destructive/30' : soonExpiring ? 'border-yellow-500/30' : ''}
              >
                <AdminCardContent className="py-4">
                  <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <h3 className="font-bold text-foreground">
                          فاتورة #{invoice.orders?.order_number || 'غير معروف'}
                        </h3>
                        {expired && (
                          <Badge variant="destructive" className="gap-1">
                            <AlertCircle className="h-3 w-3" />
                            منتهي
                          </Badge>
                        )}
                        {soonExpiring && (
                          <Badge variant="secondary" className="gap-1 bg-yellow-100 text-yellow-800">
                            <AlertCircle className="h-3 w-3" />
                            ينتهي قريباً
                          </Badge>
                        )}
                      </div>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>العميل: {invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.username || 'غير معروف'}</p>
                        <p>تاريخ التوليد: {format(new Date(invoice.generated_at), 'dd/MM/yyyy - hh:mm a', { locale: ar })}</p>
                        {invoice.warranty_expires_at && (
                          <p>انتهاء الضمان: {format(new Date(invoice.warranty_expires_at), 'dd/MM/yyyy', { locale: ar })}</p>
                        )}
                        {invoice.notes && (
                          <p className="text-xs bg-muted p-2 rounded mt-2">ملاحظات: {invoice.notes}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2 flex-wrap">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => setViewingInvoice(invoice)}
                      >
                        <Eye className="h-4 w-4 ml-2" />
                        معاينة
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadInvoice(invoice)}
                      >
                        <Download className="h-4 w-4 ml-2" />
                        تنزيل
                      </Button>
                      <Button
                        size="sm"
                        variant="destructive"
                        onClick={() => setDeletingId(invoice.id)}
                      >
                        <Trash2 className="h-4 w-4 ml-2" />
                        حذف
                      </Button>
                    </div>
                  </div>
                </AdminCardContent>
              </AdminCard>
            );
          })}
        </div>
      )}

      {/* Preview Dialog */}
      <Dialog open={!!viewingInvoice} onOpenChange={() => setViewingInvoice(null)}>
        <DialogContent className="max-w-5xl max-h-[90vh] overflow-auto">
          <DialogHeader>
            <DialogTitle>معاينة الفاتورة</DialogTitle>
          </DialogHeader>
          {viewingInvoice && (
            <div 
              className="border rounded-lg p-4"
              dangerouslySetInnerHTML={{ __html: DOMPurify.sanitize(viewingInvoice.invoice_html) }}
            />
          )}
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deletingId} onOpenChange={() => setDeletingId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>تأكيد الحذف</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف هذه الفاتورة؟ لا يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingId && deleteMutation.mutate(deletingId)}
            >
              حذف
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AdminLayout>
  );
}