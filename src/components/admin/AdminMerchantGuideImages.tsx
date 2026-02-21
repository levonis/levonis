import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { toast } from "sonner";
import { Image, Trash2, Plus, Save, Loader2, Upload } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const SECTION_LABELS: Record<string, string> = {
  store: "🏪 متجرك الخاص",
  products: "🛍️ إدارة المنتجات",
  custom_requests: "📋 طلبات العملاء المخصصة",
  orders: "📦 إدارة الطلبات",
  messages: "💬 المحادثات والتواصل",
  revenue: "💰 الإيرادات والمحفظة",
  ratings: "⭐ التقييمات والسمعة",
  delivery: "🚚 إعدادات التوصيل",
  settings: "⚙️ إعدادات المتجر المتقدمة",
  giveaways: "🎁 الهدايا والسحوبات",
  ads: "📢 إعلانات المتجر المدفوعة",
  cart: "🛒 سلة التسوق المجتمعية",
  discounts: "🏷️ الخصومات والكوبونات",
  dashboard: "📊 لوحة التحكم الاحترافية",
  complaints: "🛡️ الشكاوى والدعم",
  customers: "💜 بناء قاعدة العملاء",
};

interface GuideImage {
  id: string;
  section_key: string;
  image_url: string;
  caption: string | null;
  display_order: number;
}

export default function AdminMerchantGuideImages() {
  const queryClient = useQueryClient();
  const [uploading, setUploading] = useState<string | null>(null);

  const { data: images, isLoading } = useQuery({
    queryKey: ["admin-guide-images"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_guide_images")
        .select("*")
        .order("section_key")
        .order("display_order");
      if (error) throw error;
      return data as GuideImage[];
    },
  });

  const updateMutation = useMutation({
    mutationFn: async ({ id, caption }: { id: string; caption: string }) => {
      const { error } = await supabase
        .from("merchant_guide_images")
        .update({ caption, updated_at: new Date().toISOString() })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guide-images"] });
      toast.success("تم تحديث الوصف");
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("merchant_guide_images")
        .delete()
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guide-images"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-guide-images"] });
      toast.success("تم حذف الصورة");
    },
  });

  const addImageMutation = useMutation({
    mutationFn: async ({ sectionKey }: { sectionKey: string }) => {
      const maxOrder = images
        ?.filter(img => img.section_key === sectionKey)
        .reduce((max, img) => Math.max(max, img.display_order), -1) ?? -1;
      
      const { error } = await supabase
        .from("merchant_guide_images")
        .insert({
          section_key: sectionKey,
          image_url: "",
          caption: "",
          display_order: maxOrder + 1,
        });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-guide-images"] });
      toast.success("تمت إضافة صورة جديدة");
    },
  });

  const handleUpload = async (id: string, file: File) => {
    setUploading(id);
    try {
      const ext = file.name.split(".").pop();
      const path = `merchant-guide/${id}.${ext}`;
      
      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(path, file, { upsert: true });
      
      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage
        .from("product-images")
        .getPublicUrl(path);

      const { error: updateError } = await supabase
        .from("merchant_guide_images")
        .update({ image_url: urlData.publicUrl, updated_at: new Date().toISOString() })
        .eq("id", id);
      
      if (updateError) throw updateError;

      queryClient.invalidateQueries({ queryKey: ["admin-guide-images"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-guide-images"] });
      toast.success("تم رفع الصورة بنجاح");
    } catch (err: any) {
      toast.error("فشل رفع الصورة: " + err.message);
    } finally {
      setUploading(null);
    }
  };

  // Group images by section
  const grouped = Object.keys(SECTION_LABELS).map(key => ({
    key,
    label: SECTION_LABELS[key],
    images: images?.filter(img => img.section_key === key) ?? [],
  }));

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-4">
        <Image className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-bold">صور دليل التاجر</h3>
        <Badge variant="secondary" className="text-[9px]">
          {images?.filter(img => img.image_url).length ?? 0} صورة مرفوعة
        </Badge>
      </div>

      <p className="text-[11px] text-muted-foreground">
        ارفع صور سكرين شوت من الموقع لكل قسم. هذه الصور تظهر في دليل التاجر لشرح كل ميزة بصرياً.
      </p>

      {grouped.map(section => (
        <Card key={section.key} className="border-border/50">
          <CardContent className="p-3 space-y-3">
            <div className="flex items-center justify-between">
              <p className="text-xs font-bold">{section.label}</p>
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-[10px] gap-1"
                onClick={() => addImageMutation.mutate({ sectionKey: section.key })}
              >
                <Plus className="h-3 w-3" />
                إضافة صورة
              </Button>
            </div>

            {section.images.length === 0 ? (
              <p className="text-[10px] text-muted-foreground text-center py-4">
                لا توجد صور لهذا القسم بعد
              </p>
            ) : (
              <div className="space-y-2">
                {section.images.map(img => (
                  <div key={img.id} className="flex gap-2 items-start p-2 rounded-lg bg-muted/20 border border-border/30">
                    {/* Image preview / upload */}
                    <div className="w-24 h-16 rounded-md bg-muted/50 border border-border/50 overflow-hidden shrink-0 relative">
                      {img.image_url ? (
                        <img src={img.image_url} alt={img.caption || ""} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center">
                          <Image className="h-4 w-4 text-muted-foreground/50" />
                        </div>
                      )}
                      {uploading === img.id && (
                        <div className="absolute inset-0 bg-background/80 flex items-center justify-center">
                          <Loader2 className="h-4 w-4 animate-spin" />
                        </div>
                      )}
                    </div>

                    <div className="flex-1 min-w-0 space-y-1.5">
                      <Input
                        defaultValue={img.caption || ""}
                        placeholder="وصف الصورة..."
                        className="h-7 text-[10px]"
                        onBlur={(e) => {
                          if (e.target.value !== (img.caption || "")) {
                            updateMutation.mutate({ id: img.id, caption: e.target.value });
                          }
                        }}
                      />
                      <div className="flex gap-1">
                        <Label className="cursor-pointer">
                          <input
                            type="file"
                            accept="image/*"
                            className="hidden"
                            onChange={(e) => {
                              const file = e.target.files?.[0];
                              if (file) handleUpload(img.id, file);
                            }}
                          />
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded text-[9px] bg-primary/10 text-primary hover:bg-primary/20 transition-colors">
                            <Upload className="h-2.5 w-2.5" />
                            {img.image_url ? "تغيير" : "رفع صورة"}
                          </span>
                        </Label>
                        <Button
                          size="sm"
                          variant="ghost"
                          className="h-6 w-6 p-0 text-destructive hover:text-destructive"
                          onClick={() => deleteMutation.mutate(img.id)}
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
