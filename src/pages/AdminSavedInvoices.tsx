import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Eye, Trash2, Download, AlertCircle } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
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
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="container mx-auto py-8 px-4" dir="rtl">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-3xl font-bold mb-2">الفواتير المحفوظة</h1>
          <p className="text-muted-foreground">إجمالي الفواتير: {invoices?.length || 0}</p>
        </div>
      </div>

      {!invoices || invoices.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <p className="text-muted-foreground">لا توجد فواتير محفوظة</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4">
          {invoices.map((invoice) => {
            const expired = isWarrantyExpired(invoice.warranty_expires_at);
            const soonExpiring = isWarrantySoonExpiring(invoice.warranty_expires_at);
            
            return (
              <Card key={invoice.id} className={`hover:shadow-lg transition-shadow ${expired ? 'border-red-300' : soonExpiring ? 'border-yellow-300' : ''}`}>
                <CardHeader>
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <CardTitle className="text-lg mb-2">
                        فاتورة #{invoice.orders?.order_number || 'غير معروف'}
                      </CardTitle>
                      <div className="space-y-1 text-sm text-muted-foreground">
                        <p>العميل: {invoice.orders?.profiles?.full_name || invoice.orders?.profiles?.username || 'غير معروف'}</p>
                        <p>تاريخ التوليد: {format(new Date(invoice.generated_at), 'dd/MM/yyyy - hh:mm a', { locale: ar })}</p>
                        {invoice.warranty_expires_at && (
                          <div className="flex items-center gap-2">
                            <p>انتهاء الضمان: {format(new Date(invoice.warranty_expires_at), 'dd/MM/yyyy', { locale: ar })}</p>
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
                        )}
                        {invoice.notes && (
                          <p className="text-xs bg-muted p-2 rounded mt-2">ملاحظات: {invoice.notes}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex gap-2">
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
                </CardContent>
              </Card>
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
              dangerouslySetInnerHTML={{ __html: viewingInvoice.invoice_html }}
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
    </div>
  );
}
