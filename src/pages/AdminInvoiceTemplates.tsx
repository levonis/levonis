import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Plus, Edit, Trash2, Eye } from "lucide-react";
import { toast } from "sonner";
import { useState } from "react";
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
import { InvoiceTemplateEditor } from "@/components/InvoiceTemplateEditor";
import { InvoiceTemplatePreview } from "@/components/InvoiceTemplatePreview";
import { useAuth } from "@/hooks/useAuth";
import { Navigate } from "react-router-dom";

export default function AdminInvoiceTemplates() {
  const { user, isAdmin } = useAuth();
  const queryClient = useQueryClient();
  const [editingTemplate, setEditingTemplate] = useState<any>(null);
  const [previewingTemplate, setPreviewingTemplate] = useState<any>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [isEditorOpen, setIsEditorOpen] = useState(false);

  const { data: templates, isLoading } = useQuery({
    queryKey: ["invoice-templates"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("invoice_templates")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
    enabled: !!user && isAdmin,
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("invoice_templates")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success("تم حذف القالب بنجاح");
      setDeletingId(null);
    },
    onError: () => {
      toast.error("حدث خطأ أثناء حذف القالب");
    },
  });

  const setDefaultMutation = useMutation({
    mutationFn: async (id: string) => {
      // First, unset all defaults
      await supabase
        .from("invoice_templates")
        .update({ is_default: false })
        .neq("id", id);

      // Then set the new default
      const { error } = await supabase
        .from("invoice_templates")
        .update({ is_default: true })
        .eq("id", id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success("تم تعيين القالب الافتراضي");
    },
    onError: () => {
      toast.error("حدث خطأ أثناء تعيين القالب الافتراضي");
    },
  });

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
        <h1 className="text-3xl font-bold">قوالب الفواتير</h1>
        <Button
          onClick={() => {
            setEditingTemplate(null);
            setIsEditorOpen(true);
          }}
        >
          <Plus className="ml-2 h-4 w-4" />
          إضافة قالب جديد
        </Button>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {templates?.map((template) => (
          <Card key={template.id} className="relative hover:shadow-lg transition-shadow border-2">
            {template.is_default && (
              <div className="absolute -top-3 -right-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold shadow-md">
                ⭐ افتراضي
              </div>
            )}
            <CardHeader className="pb-3">
              <CardTitle className="text-lg">{template.name_ar}</CardTitle>
              <p className="text-sm text-muted-foreground">{template.name}</p>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2 mb-4">
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => setPreviewingTemplate(template)}
                >
                  <Eye className="ml-2 h-4 w-4" />
                  معاينة
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  className="w-full"
                  onClick={() => {
                    setEditingTemplate(template);
                    setIsEditorOpen(true);
                  }}
                >
                  <Edit className="ml-2 h-4 w-4" />
                  تعديل
                </Button>
              </div>
              {!template.is_default && (
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    className="w-full"
                    onClick={() => setDefaultMutation.mutate(template.id)}
                  >
                    اجعله افتراضي
                  </Button>
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => setDeletingId(template.id)}
                  >
                    <Trash2 className="ml-2 h-4 w-4" />
                    حذف
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Dialog open={isEditorOpen} onOpenChange={setIsEditorOpen}>
        <DialogContent className="max-w-[95vw] max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4 border-b">
            <DialogTitle className="text-2xl">
              {editingTemplate ? "✏️ تعديل القالب" : "➕ إضافة قالب جديد"}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(95vh-80px)]">
            <InvoiceTemplateEditor
              template={editingTemplate}
              onClose={() => {
                setIsEditorOpen(false);
                setEditingTemplate(null);
              }}
            />
          </div>
        </DialogContent>
      </Dialog>

      <Dialog
        open={!!previewingTemplate}
        onOpenChange={() => setPreviewingTemplate(null)}
      >
        <DialogContent className="max-w-5xl max-h-[95vh] overflow-hidden p-0">
          <DialogHeader className="p-6 pb-4 border-b bg-muted/30">
            <DialogTitle className="text-2xl">
              👁️ معاينة القالب: {previewingTemplate?.name_ar}
            </DialogTitle>
          </DialogHeader>
          <div className="overflow-y-auto max-h-[calc(95vh-80px)] p-6 bg-muted/10">
            {previewingTemplate && (
              <div className="bg-white shadow-2xl rounded-lg p-4">
                <InvoiceTemplatePreview template={previewingTemplate} />
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={!!deletingId}
        onOpenChange={() => setDeletingId(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>هل أنت متأكد؟</AlertDialogTitle>
            <AlertDialogDescription>
              هذا الإجراء لا يمكن التراجع عنه. سيتم حذف القالب نهائياً.
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