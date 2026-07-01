import { useState, useRef, useEffect } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Package, Image as ImageIcon, Video, Upload, X, Loader2, DollarSign,
  Clock, FileText, Layers, CheckCircle2, Sparkles, Trash2, CalendarClock, Users
} from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { FormattedNumberInput } from "@/components/ui/formatted-number-input";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface AddProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantId: string;
  editProduct?: {
    id: string;
    title: string;
    description: string | null;
    price_iqd: number | null;
    original_price_iqd: number | null;
    image_urls: string[] | null;
    video_url: string | null;
    primary_image_index: number;
    estimated_days: number | null;
    is_featured: boolean;
    material_type: string | null;
  } | null;
}

type MediaItem = { id: string; url: string; type: "image" | "video" };

const MATERIAL_TYPES = [
  { value: "filament", label: "فلمنت (FDM)", icon: "🧵" },
  { value: "resin", label: "رزن (SLA)", icon: "💧" },
  { value: "both", label: "كلاهما", icon: "🔗" },
] as const;

const productSchema = z.object({
  title: z.string().trim().min(3, "العنوان مطلوب").max(150),
  description: z.string().trim().max(1000).optional(),
  price_iqd: z.number().min(0).optional(),
  original_price_iqd: z.number().min(0).optional(),
  estimated_days: z.number().min(1).max(90).optional(),
  is_featured: z.boolean(),
  material_type: z.enum(["filament", "resin", "both"]).nullable(),
});

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

export default function AddProductDialog({
  open,
  onOpenChange,
  merchantId,
  editProduct,
}: AddProductDialogProps) {
  const { toast } = useToast();
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2>(1);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [priceNum, setPriceNum] = useState(0);
  const [originalPriceNum, setOriginalPriceNum] = useState(0);
  const [estimatedDaysStr, setEstimatedDaysStr] = useState("");
  const [isFeatured, setIsFeatured] = useState(false);
  const [materialType, setMaterialType] = useState<string | null>(null);
  const [saleType, setSaleType] = useState<string>("normal");
  const [maxQueueSlots, setMaxQueueSlots] = useState("");
  const [preorderDepositPercent, setPreorderDepositPercent] = useState("");
  const [preorderNote, setPreorderNote] = useState("");

  const [mediaItems, setMediaItems] = useState<MediaItem[]>([]);
  const [primaryIndex, setPrimaryIndex] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  // Reset form when dialog opens/closes
  useEffect(() => {
    if (open) {
      if (editProduct) {
        setTitle(editProduct.title);
        setDescription(editProduct.description || "");
        setPriceNum(editProduct.price_iqd || 0);
        setOriginalPriceNum(editProduct.original_price_iqd || 0);
        setEstimatedDaysStr(editProduct.estimated_days?.toString() || "");
        setIsFeatured(editProduct.is_featured || false);
        setMaterialType(editProduct.material_type);
        
        const items: MediaItem[] = [];
        editProduct.image_urls?.forEach((url) => items.push({ id: safeId(), url, type: "image" }));
        if (editProduct.video_url) items.push({ id: safeId(), url: editProduct.video_url, type: "video" });
        setMediaItems(items);
        setPrimaryIndex(editProduct.primary_image_index || 0);
      } else {
        setTitle("");
        setDescription("");
        setPriceNum(0);
        setOriginalPriceNum(0);
        setEstimatedDaysStr("");
        setIsFeatured(false);
        setMaterialType(null);
        setSaleType("normal");
        setMaxQueueSlots("");
        setPreorderDepositPercent("");
        setPreorderNote("");
        setMediaItems([]);
        setPrimaryIndex(0);
      }
      setStep(1);
    }
  }, [open, editProduct]);

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageCount = mediaItems.filter((m) => m.type === "image").length;
    const maxImages = 6;
    const allowedCount = maxImages - imageCount;

    if (allowedCount <= 0) {
      toast({ title: "الحد الأقصى 6 صور", variant: "destructive" });
      return;
    }

    for (const file of files.slice(0, allowedCount)) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "الملف كبير جداً", description: "الحد الأقصى 5 ميغابايت", variant: "destructive" });
        continue;
      }

      setUploadingMedia(true);
      try {
        const fileExt = file.name.split(".").pop();
        const fileName = `${merchantId}/${Date.now()}_${Math.random().toString(16).slice(2)}.${fileExt}`;
        const { error } = await supabase.storage.from("product-images").upload(`merchant-products/${fileName}`, file, { upsert: true });
        if (error) throw error;

        const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(`merchant-products/${fileName}`);
        setMediaItems((prev) => [...prev, { id: safeId(), url: publicUrl, type: "image" }]);
      } catch (err: any) {
        toast({ title: "تعذر رفع الصورة", description: err?.message, variant: "destructive" });
      } finally {
        setUploadingMedia(false);
      }
    }
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasVideo = mediaItems.some((m) => m.type === "video");
    if (hasVideo) {
      toast({ title: "فيديو موجود مسبقاً", variant: "destructive" });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "الفيديو كبير جداً", description: "الحد الأقصى 50 ميغابايت", variant: "destructive" });
      return;
    }

    setUploadingMedia(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${merchantId}/${Date.now()}_${Math.random().toString(16).slice(2)}.${fileExt}`;
      const { error } = await supabase.storage.from("product-images").upload(`merchant-products/${fileName}`, file, { upsert: true });
      if (error) throw error;

      const { data: { publicUrl } } = supabase.storage.from("product-images").getPublicUrl(`merchant-products/${fileName}`);
      setMediaItems((prev) => [...prev, { id: safeId(), url: publicUrl, type: "video" }]);
      toast({ title: "تم رفع الفيديو بنجاح" });
    } catch (err: any) {
      toast({ title: "تعذر رفع الفيديو", description: err?.message, variant: "destructive" });
    } finally {
      setUploadingMedia(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  const removeMedia = (id: string) => {
    const idx = mediaItems.findIndex((m) => m.id === id);
    setMediaItems((prev) => prev.filter((m) => m.id !== id));
    if (idx <= primaryIndex && primaryIndex > 0) {
      setPrimaryIndex((prev) => prev - 1);
    }
  };

  const setAsPrimary = (id: string) => {
    const idx = mediaItems.findIndex((m) => m.id === id && m.type === "image");
    if (idx >= 0) setPrimaryIndex(idx);
  };

  const submitMutation = useMutation({
    mutationFn: async () => {
      const price = priceNum || null;
      const originalPrice = originalPriceNum || null;
      const daysNum = estimatedDaysStr ? parseInt(estimatedDaysStr, 10) : null;

      const imageUrls = mediaItems.filter((m) => m.type === "image").map((m) => m.url);
      const videoUrl = mediaItems.find((m) => m.type === "video")?.url || null;

      const payload: any = {
        merchant_id: merchantId,
        title: title.trim(),
        description: description.trim() || null,
        price_iqd: price,
        original_price_iqd: originalPrice,
        estimated_days: daysNum,
        is_featured: isFeatured,
        material_type: materialType,
        image_urls: imageUrls.length > 0 ? imageUrls : null,
        video_url: videoUrl,
        primary_image_index: primaryIndex,
        is_active: true,
        sale_type: saleType,
        max_queue_slots: maxQueueSlots ? parseInt(maxQueueSlots, 10) : null,
        preorder_deposit_percent: preorderDepositPercent ? parseInt(preorderDepositPercent, 10) : null,
        preorder_note: preorderNote.trim() || null,
      };

      if (editProduct) {
        const { error } = await supabase
          .from("merchant_products")
          .update(payload)
          .eq("id", editProduct.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("merchant_products").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-store-products", merchantId] });
      toast({ title: editProduct ? "تم تعديل المنتج" : "تم إضافة المنتج بنجاح" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر حفظ المنتج", description: err?.message, variant: "destructive" });
    },
  });

  const imageCount = mediaItems.filter((m) => m.type === "image").length;
  const hasVideo = mediaItems.some((m) => m.type === "video");
  const step1Valid = title.trim().length >= 3 && imageCount >= 1;
  const canSubmit = step1Valid;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <DialogHeader className="p-4 pb-3 border-b border-border/50 shrink-0">
          <div className="flex items-center gap-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <DialogTitle className="text-base font-bold">
                {editProduct ? "تعديل المنتج" : "إضافة منتج جديد"}
              </DialogTitle>
              <DialogDescription className="text-[11px]">
                الخطوة {step} من 2
              </DialogDescription>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={() => setStep(1)}
              className={`flex-1 h-1.5 rounded-full transition-all ${step >= 1 ? "bg-primary" : "bg-muted"}`}
            />
            <button
              onClick={() => step1Valid && setStep(2)}
              disabled={!step1Valid}
              className={`flex-1 h-1.5 rounded-full transition-all ${step >= 2 ? "bg-primary" : "bg-muted"}`}
            />
          </div>
        </DialogHeader>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {step === 1 && (
            <>
              {/* Media Upload */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  الصور والفيديو ({imageCount}/6)
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {mediaItems.map((media, idx) => {
                    const isMain = media.type === "image" && idx === primaryIndex;
                    return (
                      <div
                        key={media.id}
                        onClick={() => media.type === "image" && setAsPrimary(media.id)}
                        className={`relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer group ${
                          isMain ? "border-primary" : "border-border"
                        }`}
                      >
                        {media.type === "image" ? (
                          <img src={media.url} alt="" className="h-full w-full object-cover" />
                        ) : (
                          <video src={media.url} className="h-full w-full object-cover" muted />
                        )}
                        {isMain && (
                          <Badge className="absolute bottom-0.5 right-0.5 text-[8px] px-1 h-4">رئيسية</Badge>
                        )}
                        {media.type === "video" && (
                          <Badge className="absolute bottom-0.5 right-0.5 bg-red-500 text-[8px] px-1 h-4">فيديو</Badge>
                        )}
                        <button
                          type="button"
                          onClick={(e) => { e.stopPropagation(); removeMedia(media.id); }}
                          className="absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-destructive text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    );
                  })}
                  {imageCount < 6 && (
                    <button
                      type="button"
                      onClick={() => fileInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {uploadingMedia ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
                      <span className="text-[9px]">صورة</span>
                    </button>
                  )}
                  {!hasVideo && (
                    <button
                      type="button"
                      onClick={() => videoInputRef.current?.click()}
                      disabled={uploadingMedia}
                      className="aspect-square rounded-lg border-2 border-dashed border-border flex flex-col items-center justify-center gap-1 hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      <Video className="h-4 w-4" />
                      <span className="text-[9px]">فيديو</span>
                    </button>
                  )}
                </div>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleImageSelect} />
                <input ref={videoInputRef} type="file" accept="video/*" className="hidden" onChange={handleVideoSelect} />
              </div>

              {/* Title */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">العنوان *</Label>
                <Input
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  maxLength={150}
                  placeholder="اسم المنتج"
                  className="h-9"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label className="text-xs font-medium">الوصف</Label>
                <Textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  maxLength={1000}
                  placeholder="وصف المنتج..."
                  className="min-h-20"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Price */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <DollarSign className="h-3.5 w-3.5" />
                    السعر (د.ع)
                  </Label>
                  <FormattedNumberInput
                    value={priceNum}
                    onChange={setPriceNum}
                    placeholder="25,000"
                    className="h-9"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium text-muted-foreground">السعر الأصلي</Label>
                  <FormattedNumberInput
                    value={originalPriceNum}
                    onChange={setOriginalPriceNum}
                    placeholder="30,000"
                    className="h-9"
                  />
                </div>
              </div>

              {/* Days & Material */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Clock className="h-3.5 w-3.5" />
                    مدة التنفيذ (أيام)
                  </Label>
                  <Input
                    type="number"
                    value={estimatedDaysStr}
                    onChange={(e) => setEstimatedDaysStr(e.target.value)}
                    placeholder="3"
                    className="h-9"
                    min={1}
                    max={90}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-medium flex items-center gap-1">
                    <Layers className="h-3.5 w-3.5" />
                    نوع المادة
                  </Label>
                  <Select value={materialType || ""} onValueChange={(v) => setMaterialType(v || null)}>
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue placeholder="اختر النوع" />
                    </SelectTrigger>
                    <SelectContent>
                      {MATERIAL_TYPES.map((m) => (
                        <SelectItem key={m.value} value={m.value}>
                          <span className="flex items-center gap-2">
                            <span>{m.icon}</span>
                            <span>{m.label}</span>
                          </span>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Featured Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-amber-500" />
                  <div>
                    <p className="text-xs font-medium">منتج مميز</p>
                    <p className="text-[10px] text-muted-foreground">يظهر في أعلى القائمة</p>
                  </div>
                </div>
                <Switch checked={isFeatured} onCheckedChange={setIsFeatured} />
              </div>

              {/* Sale Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1">
                  <CalendarClock className="h-3.5 w-3.5" />
                  نوع البيع
                </Label>
                <Select value={saleType} onValueChange={setSaleType}>
                  <SelectTrigger className="h-9 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="normal">عادي - متوفر الآن</SelectItem>
                    <SelectItem value="preorder">حجز مسبق بدفع</SelectItem>
                    <SelectItem value="waitlist">قائمة انتظار (مجانية)</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Preorder/Waitlist Settings */}
              {(saleType === "preorder" || saleType === "waitlist") && (
                <div className="space-y-3 p-3 rounded-xl border border-amber-500/30 bg-amber-500/5">
                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium flex items-center gap-1">
                      <Users className="h-3.5 w-3.5" />
                      عدد الأماكن المتاحة
                    </Label>
                    <Input
                      type="number"
                      value={maxQueueSlots}
                      onChange={(e) => setMaxQueueSlots(e.target.value)}
                      placeholder="مثلا 10 (اتركه فارغاً لعدد غير محدود)"
                      className="h-9"
                      min={1}
                    />
                  </div>

                  {saleType === "preorder" && (
                    <div className="space-y-1.5">
                      <Label className="text-xs font-medium">نسبة العربون (%)</Label>
                      <Input
                        type="number"
                        value={preorderDepositPercent}
                        onChange={(e) => setPreorderDepositPercent(e.target.value)}
                        placeholder="مثلا 25"
                        className="h-9"
                        min={1}
                        max={100}
                      />
                    </div>
                  )}

                  <div className="space-y-1.5">
                    <Label className="text-xs font-medium">ملاحظة للعملاء</Label>
                    <Input
                      value={preorderNote}
                      onChange={(e) => setPreorderNote(e.target.value)}
                      placeholder="مثلا: التوصيل خلال أسبوعين"
                      className="h-9"
                    />
                  </div>
                </div>
              )}

              {/* Preview Summary */}
              <div className="p-3 rounded-xl bg-primary/5 border border-primary/20 space-y-2">
                <p className="text-xs font-medium flex items-center gap-1.5">
                  <CheckCircle2 className="h-3.5 w-3.5 text-primary" />
                  ملخص المنتج
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="text-muted-foreground">العنوان:</div>
                  <div className="font-medium truncate">{title || "-"}</div>
                  <div className="text-muted-foreground">السعر:</div>
                  <div className="font-medium">{priceNum ? `${priceNum.toLocaleString()} د.ع` : "-"}</div>
                  <div className="text-muted-foreground">الصور:</div>
                  <div className="font-medium">{imageCount} صور</div>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 pt-3 border-t border-border/50 shrink-0 flex gap-2">
          {step === 1 ? (
            <>
              <Button variant="outline" className="flex-1 h-9" onClick={() => onOpenChange(false)}>
                إلغاء
              </Button>
              <Button
                className="flex-1 h-9"
                onClick={() => setStep(2)}
                disabled={!step1Valid}
              >
                التالي
              </Button>
            </>
          ) : (
            <>
              <Button variant="outline" className="flex-1 h-9" onClick={() => setStep(1)}>
                السابق
              </Button>
              <Button
                className="flex-1 h-9"
                onClick={() => submitMutation.mutate()}
                disabled={!canSubmit || submitMutation.isPending}
              >
                {submitMutation.isPending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : editProduct ? (
                  "حفظ التعديلات"
                ) : (
                  "إضافة المنتج"
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
