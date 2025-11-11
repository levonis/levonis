import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

interface InvoiceTemplateEditorProps {
  template: any;
  onClose: () => void;
}

export const InvoiceTemplateEditor = ({
  template,
  onClose,
}: InvoiceTemplateEditorProps) => {
  const queryClient = useQueryClient();
  const [formData, setFormData] = useState({
    name: template?.name || "",
    name_ar: template?.name_ar || "",
    template_config: template?.template_config || {
      layout: {
        pageSize: "A4",
        margin: "20px",
        direction: "rtl",
      },
      header: {
        show: true,
        backgroundColor: "#123f35",
        textColor: "#d4af37",
        fontSize: "24px",
        fontFamily: "Cairo",
        title: "فاتورة مبيعات",
        titleEn: "Sales Invoice",
        logoUrl: "",
        padding: "20px",
      },
      serialSection: {
        show: true,
        backgroundColor: "#f8f9fa",
        fontSize: "14px",
        fontFamily: "Cairo",
        padding: "15px",
        borderRadius: "8px",
      },
      customerInfo: {
        show: true,
        fontSize: "14px",
        fontFamily: "Cairo",
        labelColor: "#123f35",
        valueColor: "#1f2937",
        padding: "10px",
      },
      itemsTable: {
        show: true,
        headerBackgroundColor: "#123f35",
        headerTextColor: "#d4af37",
        rowBackgroundColor: "#ffffff",
        alternateRowColor: "#f8f9fa",
        borderColor: "#e5e7eb",
        fontSize: "14px",
        fontFamily: "Cairo",
        padding: "12px",
      },
      totalsSection: {
        show: true,
        backgroundColor: "#f8f9fa",
        fontSize: "16px",
        fontFamily: "Cairo",
        labelColor: "#123f35",
        valueColor: "#1f2937",
        fontWeight: "bold",
        padding: "15px",
      },
      warrantySection: {
        show: true,
        fontSize: "12px",
        fontFamily: "Cairo",
        textColor: "#6b7280",
        padding: "15px",
        borderTop: "1px solid #e5e7eb",
      },
      footer: {
        show: true,
        backgroundColor: "#123f35",
        textColor: "#d4af37",
        fontSize: "12px",
        fontFamily: "Cairo",
        text: "شكراً لتعاملكم معنا",
        textEn: "Thank you for your business",
        padding: "15px",
      },
    },
  });

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (template?.id) {
        const { error } = await supabase
          .from("invoice_templates")
          .update(formData)
          .eq("id", template.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("invoice_templates")
          .insert(formData);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["invoice-templates"] });
      toast.success(template?.id ? "تم تحديث القالب" : "تم إضافة القالب");
      onClose();
    },
    onError: () => {
      toast.error("حدث خطأ");
    },
  });

  const updateConfig = (section: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      template_config: {
        ...prev.template_config,
        [section]: {
          ...prev.template_config[section],
          [field]: value,
        },
      },
    }));
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="grid gap-4">
        <div>
          <Label htmlFor="name">اسم القالب (English)</Label>
          <Input
            id="name"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
          />
        </div>
        <div>
          <Label htmlFor="name_ar">اسم القالب (العربية)</Label>
          <Input
            id="name_ar"
            value={formData.name_ar}
            onChange={(e) =>
              setFormData({ ...formData, name_ar: e.target.value })
            }
          />
        </div>
      </div>

      <Tabs defaultValue="header" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="header">الرأسية</TabsTrigger>
          <TabsTrigger value="content">المحتوى</TabsTrigger>
          <TabsTrigger value="table">الجدول</TabsTrigger>
          <TabsTrigger value="footer">التذييل</TabsTrigger>
        </TabsList>

        <TabsContent value="header" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات الرأسية</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار الرأسية</Label>
                <Switch
                  checked={formData.template_config.header.show}
                  onCheckedChange={(checked) =>
                    updateConfig("header", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>العنوان (العربية)</Label>
                <Input
                  value={formData.template_config.header.title}
                  onChange={(e) =>
                    updateConfig("header", "title", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>العنوان (English)</Label>
                <Input
                  value={formData.template_config.header.titleEn}
                  onChange={(e) =>
                    updateConfig("header", "titleEn", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون الخلفية</Label>
                <Input
                  type="color"
                  value={formData.template_config.header.backgroundColor}
                  onChange={(e) =>
                    updateConfig("header", "backgroundColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون النص</Label>
                <Input
                  type="color"
                  value={formData.template_config.header.textColor}
                  onChange={(e) =>
                    updateConfig("header", "textColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>حجم الخط</Label>
                <Input
                  value={formData.template_config.header.fontSize}
                  onChange={(e) =>
                    updateConfig("header", "fontSize", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>عائلة الخط</Label>
                <Input
                  value={formData.template_config.header.fontFamily}
                  onChange={(e) =>
                    updateConfig("header", "fontFamily", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="content" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>معلومات العميل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار معلومات العميل</Label>
                <Switch
                  checked={formData.template_config.customerInfo.show}
                  onCheckedChange={(checked) =>
                    updateConfig("customerInfo", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>حجم الخط</Label>
                <Input
                  value={formData.template_config.customerInfo.fontSize}
                  onChange={(e) =>
                    updateConfig("customerInfo", "fontSize", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون العنوان</Label>
                <Input
                  type="color"
                  value={formData.template_config.customerInfo.labelColor}
                  onChange={(e) =>
                    updateConfig("customerInfo", "labelColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون القيمة</Label>
                <Input
                  type="color"
                  value={formData.template_config.customerInfo.valueColor}
                  onChange={(e) =>
                    updateConfig("customerInfo", "valueColor", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قسم الرقم التسلسلي</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار قسم الرقم التسلسلي</Label>
                <Switch
                  checked={formData.template_config.serialSection.show}
                  onCheckedChange={(checked) =>
                    updateConfig("serialSection", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>لون الخلفية</Label>
                <Input
                  type="color"
                  value={formData.template_config.serialSection.backgroundColor}
                  onChange={(e) =>
                    updateConfig(
                      "serialSection",
                      "backgroundColor",
                      e.target.value
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="table" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>جدول المنتجات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار الجدول</Label>
                <Switch
                  checked={formData.template_config.itemsTable.show}
                  onCheckedChange={(checked) =>
                    updateConfig("itemsTable", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>لون خلفية الرأسية</Label>
                <Input
                  type="color"
                  value={
                    formData.template_config.itemsTable.headerBackgroundColor
                  }
                  onChange={(e) =>
                    updateConfig(
                      "itemsTable",
                      "headerBackgroundColor",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label>لون نص الرأسية</Label>
                <Input
                  type="color"
                  value={formData.template_config.itemsTable.headerTextColor}
                  onChange={(e) =>
                    updateConfig("itemsTable", "headerTextColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون الصفوف البديلة</Label>
                <Input
                  type="color"
                  value={formData.template_config.itemsTable.alternateRowColor}
                  onChange={(e) =>
                    updateConfig(
                      "itemsTable",
                      "alternateRowColor",
                      e.target.value
                    )
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>قسم الإجماليات</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>لون الخلفية</Label>
                <Input
                  type="color"
                  value={formData.template_config.totalsSection.backgroundColor}
                  onChange={(e) =>
                    updateConfig(
                      "totalsSection",
                      "backgroundColor",
                      e.target.value
                    )
                  }
                />
              </div>
              <div>
                <Label>حجم الخط</Label>
                <Input
                  value={formData.template_config.totalsSection.fontSize}
                  onChange={(e) =>
                    updateConfig("totalsSection", "fontSize", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="footer" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>قسم الضمان</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار قسم الضمان</Label>
                <Switch
                  checked={formData.template_config.warrantySection.show}
                  onCheckedChange={(checked) =>
                    updateConfig("warrantySection", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>لون النص</Label>
                <Input
                  type="color"
                  value={formData.template_config.warrantySection.textColor}
                  onChange={(e) =>
                    updateConfig("warrantySection", "textColor", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>التذييل</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار التذييل</Label>
                <Switch
                  checked={formData.template_config.footer.show}
                  onCheckedChange={(checked) =>
                    updateConfig("footer", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>النص (العربية)</Label>
                <Input
                  value={formData.template_config.footer.text}
                  onChange={(e) =>
                    updateConfig("footer", "text", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>النص (English)</Label>
                <Input
                  value={formData.template_config.footer.textEn}
                  onChange={(e) =>
                    updateConfig("footer", "textEn", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون الخلفية</Label>
                <Input
                  type="color"
                  value={formData.template_config.footer.backgroundColor}
                  onChange={(e) =>
                    updateConfig("footer", "backgroundColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون النص</Label>
                <Input
                  type="color"
                  value={formData.template_config.footer.textColor}
                  onChange={(e) =>
                    updateConfig("footer", "textColor", e.target.value)
                  }
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>

      <div className="flex gap-2 justify-end">
        <Button variant="outline" onClick={onClose}>
          إلغاء
        </Button>
        <Button
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending}
        >
          {saveMutation.isPending && (
            <Loader2 className="ml-2 h-4 w-4 animate-spin" />
          )}
          حفظ
        </Button>
      </div>
    </div>
  );
};