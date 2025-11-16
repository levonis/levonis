import { useState } from "react";
import { useQueryClient, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { Loader2, Upload, Plus, X } from "lucide-react";

interface InvoiceTemplateEditorProps {
  template: any;
  onClose: () => void;
}

export const InvoiceTemplateEditor = ({
  template,
  onClose,
}: InvoiceTemplateEditorProps) => {
  const queryClient = useQueryClient();
  
  const defaultConfig = {
    layout: {
      pageSize: "A4",
      margin: "20px",
      direction: "rtl",
      backgroundColor: "#ffffff",
      borderWidth: "0px",
      borderColor: "#e5e7eb",
      borderRadius: "0px",
      boxShadow: "none",
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
      logoWidth: "120px",
      logoPosition: "center",
      padding: "20px",
      borderRadius: "0px",
      boxShadow: "none",
    },
    companyInfo: {
      show: false,
      companyName: "",
      companyNameEn: "",
      address: "",
      phone: "",
      email: "",
      website: "",
      taxNumber: "",
      fontSize: "12px",
      textColor: "#1f2937",
      padding: "15px",
    },
    serialSection: {
      show: true,
      backgroundColor: "#f8f9fa",
      fontSize: "14px",
      fontFamily: "Cairo",
      padding: "15px",
      borderRadius: "8px",
      borderWidth: "0px",
      borderColor: "#e5e7eb",
      showSerialImage: true,
      serialImageUrl: "",
      serialImageWidth: "200px",
    },
    customerInfo: {
      show: true,
      fontSize: "14px",
      fontFamily: "Cairo",
      labelColor: "#123f35",
      valueColor: "#1f2937",
      padding: "10px",
      backgroundColor: "transparent",
      borderRadius: "0px",
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
      borderRadius: "0px",
      headerFontWeight: "bold",
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
      borderRadius: "8px",
      borderWidth: "2px",
      borderColor: "#123f35",
    },
    warrantySection: {
      show: true,
      fontSize: "12px",
      fontFamily: "Cairo",
      textColor: "#6b7280",
      padding: "15px",
      borderTop: "1px solid #e5e7eb",
      backgroundColor: "transparent",
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
      borderRadius: "0px",
    },
    signature: {
      show: false,
      label: "التوقيع",
      labelEn: "Signature",
      imageUrl: "",
      position: "left",
      width: "150px",
      padding: "20px",
    },
    customFields: [],
  };

  const [formData, setFormData] = useState({
    name: template?.name || "",
    name_ar: template?.name_ar || "",
    template_config: {
      ...defaultConfig,
      ...(template?.template_config || {}),
      companyInfo: {
        ...defaultConfig.companyInfo,
        ...(template?.template_config?.companyInfo || {}),
      },
      header: {
        ...defaultConfig.header,
        ...(template?.template_config?.header || {}),
      },
      layout: {
        ...defaultConfig.layout,
        ...(template?.template_config?.layout || {}),
      },
      serialSection: {
        ...defaultConfig.serialSection,
        ...(template?.template_config?.serialSection || {}),
      },
      customerInfo: {
        ...defaultConfig.customerInfo,
        ...(template?.template_config?.customerInfo || {}),
      },
      itemsTable: {
        ...defaultConfig.itemsTable,
        ...(template?.template_config?.itemsTable || {}),
      },
      totalsSection: {
        ...defaultConfig.totalsSection,
        ...(template?.template_config?.totalsSection || {}),
      },
      warrantySection: {
        ...defaultConfig.warrantySection,
        ...(template?.template_config?.warrantySection || {}),
      },
      footer: {
        ...defaultConfig.footer,
        ...(template?.template_config?.footer || {}),
      },
      signature: {
        ...defaultConfig.signature,
        ...(template?.template_config?.signature || {}),
      },
      customFields: template?.template_config?.customFields || defaultConfig.customFields,
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

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("invoice-assets")
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("invoice-assets")
        .getPublicUrl(fileName);

      updateConfig("header", "logoUrl", urlData.publicUrl);
      toast.success("تم رفع الشعار بنجاح");
    } catch (error) {
      toast.error("حدث خطأ في رفع الشعار");
    }
  };

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("invoice-assets")
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("invoice-assets")
        .getPublicUrl(fileName);

      updateConfig("signature", "imageUrl", urlData.publicUrl);
      toast.success("تم رفع التوقيع بنجاح");
    } catch (error) {
      toast.error("حدث خطأ في رفع التوقيع");
    }
  };

  const handleSerialImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `serial-${Math.random()}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("invoice-assets")
        .upload(fileName, file);

      if (error) throw error;

      const { data: urlData } = supabase.storage
        .from("invoice-assets")
        .getPublicUrl(fileName);

      updateConfig("serialSection", "serialImageUrl", urlData.publicUrl);
      toast.success("تم رفع صورة الرقم التسلسلي بنجاح");
    } catch (error) {
      toast.error("حدث خطأ في رفع الصورة");
    }
  };

  const addCustomField = () => {
    setFormData((prev) => ({
      ...prev,
      template_config: {
        ...prev.template_config,
        customFields: [
          ...prev.template_config.customFields,
          {
            id: Math.random().toString(),
            label: "",
            labelEn: "",
            value: "",
            show: true,
          },
        ],
      },
    }));
  };

  const updateCustomField = (id: string, field: string, value: any) => {
    setFormData((prev) => ({
      ...prev,
      template_config: {
        ...prev.template_config,
        customFields: prev.template_config.customFields.map((f: any) =>
          f.id === id ? { ...f, [field]: value } : f
        ),
      },
    }));
  };

  const removeCustomField = (id: string) => {
    setFormData((prev) => ({
      ...prev,
      template_config: {
        ...prev.template_config,
        customFields: prev.template_config.customFields.filter(
          (f: any) => f.id !== id
        ),
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

      <Tabs defaultValue="layout" className="w-full">
        <TabsList className="grid w-full grid-cols-6">
          <TabsTrigger value="layout">التخطيط</TabsTrigger>
          <TabsTrigger value="header">الرأسية</TabsTrigger>
          <TabsTrigger value="content">المحتوى</TabsTrigger>
          <TabsTrigger value="table">الجدول</TabsTrigger>
          <TabsTrigger value="footer">التذييل</TabsTrigger>
          <TabsTrigger value="advanced">متقدم</TabsTrigger>
        </TabsList>

        <TabsContent value="layout" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>إعدادات التخطيط العامة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label>هامش الصفحة</Label>
                <Input
                  value={formData.template_config.layout.margin}
                  onChange={(e) =>
                    updateConfig("layout", "margin", e.target.value)
                  }
                  placeholder="20px"
                />
              </div>
              <div>
                <Label>لون الخلفية</Label>
                <Input
                  type="color"
                  value={formData.template_config.layout.backgroundColor}
                  onChange={(e) =>
                    updateConfig("layout", "backgroundColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>عرض الحدود</Label>
                <Input
                  value={formData.template_config.layout.borderWidth}
                  onChange={(e) =>
                    updateConfig("layout", "borderWidth", e.target.value)
                  }
                  placeholder="0px"
                />
              </div>
              <div>
                <Label>لون الحدود</Label>
                <Input
                  type="color"
                  value={formData.template_config.layout.borderColor}
                  onChange={(e) =>
                    updateConfig("layout", "borderColor", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>تقريب الزوايا</Label>
                <Input
                  value={formData.template_config.layout.borderRadius}
                  onChange={(e) =>
                    updateConfig("layout", "borderRadius", e.target.value)
                  }
                  placeholder="0px"
                />
              </div>
              <div>
                <Label>الظل</Label>
                <Input
                  value={formData.template_config.layout.boxShadow}
                  onChange={(e) =>
                    updateConfig("layout", "boxShadow", e.target.value)
                  }
                  placeholder="none أو 0 4px 6px rgba(0,0,0,0.1)"
                />
              </div>
            </CardContent>
          </Card>
        </TabsContent>

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
                <Label>شعار الفاتورة</Label>
                <div className="space-y-2">
                  {formData.template_config.header.logoUrl && (
                    <img
                      src={formData.template_config.header.logoUrl}
                      alt="Logo"
                      className="h-20 object-contain"
                    />
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleLogoUpload}
                      className="hidden"
                      id="logo-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        document.getElementById("logo-upload")?.click()
                      }
                    >
                      <Upload className="ml-2 h-4 w-4" />
                      رفع شعار
                    </Button>
                    {formData.template_config.header.logoUrl && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() => updateConfig("header", "logoUrl", "")}
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>عرض الشعار</Label>
                <Input
                  value={formData.template_config.header.logoWidth}
                  onChange={(e) =>
                    updateConfig("header", "logoWidth", e.target.value)
                  }
                  placeholder="120px"
                />
              </div>

              <div>
                <Label>موضع الشعار</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={formData.template_config.header.logoPosition}
                  onChange={(e) =>
                    updateConfig("header", "logoPosition", e.target.value)
                  }
                >
                  <option value="left">يسار</option>
                  <option value="center">وسط</option>
                  <option value="right">يمين</option>
                </select>
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
              <div>
                <Label>تقريب الزوايا</Label>
                <Input
                  value={formData.template_config.header.borderRadius}
                  onChange={(e) =>
                    updateConfig("header", "borderRadius", e.target.value)
                  }
                  placeholder="0px"
                />
              </div>
              <div>
                <Label>الظل</Label>
                <Input
                  value={formData.template_config.header.boxShadow}
                  onChange={(e) =>
                    updateConfig("header", "boxShadow", e.target.value)
                  }
                  placeholder="none"
                />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>معلومات الشركة</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار معلومات الشركة</Label>
                <Switch
                  checked={formData.template_config.companyInfo.show}
                  onCheckedChange={(checked) =>
                    updateConfig("companyInfo", "show", checked)
                  }
                />
              </div>
              <div>
                <Label>اسم الشركة (العربية)</Label>
                <Input
                  value={formData.template_config.companyInfo.companyName}
                  onChange={(e) =>
                    updateConfig("companyInfo", "companyName", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>اسم الشركة (English)</Label>
                <Input
                  value={formData.template_config.companyInfo.companyNameEn}
                  onChange={(e) =>
                    updateConfig("companyInfo", "companyNameEn", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>العنوان</Label>
                <Textarea
                  value={formData.template_config.companyInfo.address}
                  onChange={(e) =>
                    updateConfig("companyInfo", "address", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>رقم الهاتف</Label>
                <Input
                  value={formData.template_config.companyInfo.phone}
                  onChange={(e) =>
                    updateConfig("companyInfo", "phone", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>البريد الإلكتروني</Label>
                <Input
                  type="email"
                  value={formData.template_config.companyInfo.email}
                  onChange={(e) =>
                    updateConfig("companyInfo", "email", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>الموقع الإلكتروني</Label>
                <Input
                  value={formData.template_config.companyInfo.website}
                  onChange={(e) =>
                    updateConfig("companyInfo", "website", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>الرقم الضريبي</Label>
                <Input
                  value={formData.template_config.companyInfo.taxNumber}
                  onChange={(e) =>
                    updateConfig("companyInfo", "taxNumber", e.target.value)
                  }
                />
              </div>
              <div>
                <Label>لون النص</Label>
                <Input
                  type="color"
                  value={formData.template_config.companyInfo.textColor}
                  onChange={(e) =>
                    updateConfig("companyInfo", "textColor", e.target.value)
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
              
              <div className="space-y-3 border-t pt-4">
                <div className="flex items-center justify-between">
                  <Label>إظهار صورة الرقم التسلسلي</Label>
                  <Switch
                    checked={formData.template_config.serialSection.showSerialImage}
                    onCheckedChange={(checked) =>
                      updateConfig("serialSection", "showSerialImage", checked)
                    }
                  />
                </div>
                
                {formData.template_config.serialSection.showSerialImage && (
                  <>
                    <div>
                      <Label>رفع صورة افتراضية للرقم التسلسلي (اختياري)</Label>
                      <div className="flex gap-2 mt-2">
                        <Input
                          type="file"
                          accept="image/*"
                          onChange={handleSerialImageUpload}
                        />
                        {formData.template_config.serialSection.serialImageUrl && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            onClick={() =>
                              updateConfig("serialSection", "serialImageUrl", "")
                            }
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        )}
                      </div>
                      {formData.template_config.serialSection.serialImageUrl && (
                        <div className="mt-2 border rounded p-2">
                          <img
                            src={formData.template_config.serialSection.serialImageUrl}
                            alt="صورة الرقم التسلسلي"
                            className="max-w-[200px] h-auto"
                          />
                        </div>
                      )}
                    </div>
                    
                    <div>
                      <Label>عرض الصورة</Label>
                      <Input
                        value={formData.template_config.serialSection.serialImageWidth}
                        onChange={(e) =>
                          updateConfig("serialSection", "serialImageWidth", e.target.value)
                        }
                        placeholder="200px"
                      />
                    </div>
                  </>
                )}
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

        <TabsContent value="advanced" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>التوقيع</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between">
                <Label>إظهار التوقيع</Label>
                <Switch
                  checked={formData.template_config.signature.show}
                  onCheckedChange={(checked) =>
                    updateConfig("signature", "show", checked)
                  }
                />
              </div>

              <div>
                <Label>صورة التوقيع</Label>
                <div className="space-y-2">
                  {formData.template_config.signature.imageUrl && (
                    <img
                      src={formData.template_config.signature.imageUrl}
                      alt="Signature"
                      className="h-20 object-contain"
                    />
                  )}
                  <div className="flex gap-2">
                    <Input
                      type="file"
                      accept="image/*"
                      onChange={handleSignatureUpload}
                      className="hidden"
                      id="signature-upload"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() =>
                        document.getElementById("signature-upload")?.click()
                      }
                    >
                      <Upload className="ml-2 h-4 w-4" />
                      رفع توقيع
                    </Button>
                    {formData.template_config.signature.imageUrl && (
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={() =>
                          updateConfig("signature", "imageUrl", "")
                        }
                      >
                        حذف
                      </Button>
                    )}
                  </div>
                </div>
              </div>

              <div>
                <Label>التسمية (العربية)</Label>
                <Input
                  value={formData.template_config.signature.label}
                  onChange={(e) =>
                    updateConfig("signature", "label", e.target.value)
                  }
                />
              </div>

              <div>
                <Label>التسمية (English)</Label>
                <Input
                  value={formData.template_config.signature.labelEn}
                  onChange={(e) =>
                    updateConfig("signature", "labelEn", e.target.value)
                  }
                />
              </div>

              <div>
                <Label>عرض التوقيع</Label>
                <Input
                  value={formData.template_config.signature.width}
                  onChange={(e) =>
                    updateConfig("signature", "width", e.target.value)
                  }
                  placeholder="150px"
                />
              </div>

              <div>
                <Label>الموضع</Label>
                <select
                  className="w-full p-2 border rounded"
                  value={formData.template_config.signature.position}
                  onChange={(e) =>
                    updateConfig("signature", "position", e.target.value)
                  }
                >
                  <option value="left">يسار</option>
                  <option value="center">وسط</option>
                  <option value="right">يمين</option>
                </select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle>حقول مخصصة</CardTitle>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={addCustomField}
                >
                  <Plus className="ml-2 h-4 w-4" />
                  إضافة حقل
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              {formData.template_config.customFields.map((field: any) => (
                <Card key={field.id} className="p-4">
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>عرض الحقل</Label>
                      <div className="flex gap-2">
                        <Switch
                          checked={field.show}
                          onCheckedChange={(checked) =>
                            updateCustomField(field.id, "show", checked)
                          }
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeCustomField(field.id)}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                    <div>
                      <Label>التسمية (العربية)</Label>
                      <Input
                        value={field.label}
                        onChange={(e) =>
                          updateCustomField(field.id, "label", e.target.value)
                        }
                        placeholder="مثال: رقم السجل التجاري"
                      />
                    </div>
                    <div>
                      <Label>التسمية (English)</Label>
                      <Input
                        value={field.labelEn}
                        onChange={(e) =>
                          updateCustomField(field.id, "labelEn", e.target.value)
                        }
                        placeholder="Example: Commercial Registration No."
                      />
                    </div>
                    <div>
                      <Label>القيمة</Label>
                      <Input
                        value={field.value}
                        onChange={(e) =>
                          updateCustomField(field.id, "value", e.target.value)
                        }
                        placeholder="القيمة الافتراضية"
                      />
                    </div>
                  </div>
                </Card>
              ))}

              {formData.template_config.customFields.length === 0 && (
                <p className="text-center text-muted-foreground py-8">
                  لم يتم إضافة أي حقول مخصصة بعد. اضغط على "إضافة حقل" للبدء.
                </p>
              )}
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