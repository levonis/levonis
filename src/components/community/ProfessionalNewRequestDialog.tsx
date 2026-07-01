import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient, useQuery } from "@tanstack/react-query";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { filterContent, validateBio } from "@/lib/contentFilter";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

import {
  Loader2,
  Image as ImageIcon,
  Link2,
  Plus,
  Trash2,
  FileText,
  Palette,
  Ruler,
  MessageSquare,
  CheckCircle2,
  Upload,
  Package,
  ArrowLeft,
  ArrowRight,
  Video,
  X,
  Layers,
  MapPin,
  Hash,
} from "lucide-react";

type LinkItem = { id: string; url: string };
type MediaFile = { id: string; url: string; type: "image" | "video" };

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const MATERIAL_TYPES = [
  { value: "filament", label: "فلمنت (FDM)", icon: "🧵" },
  { value: "resin", label: "رزن (SLA/DLP)", icon: "💧" },
  { value: "both", label: "كلاهما", icon: "🔗" },
  { value: "any", label: "لا يهم", icon: "✨" },
] as const;

const requestSchema = z.object({
  title: z.string().trim().min(3, "العنوان مطلوب (3 أحرف على الأقل)").max(120),
  description: z.string().trim().min(10, "الوصف مطلوب (10 أحرف على الأقل)").max(1500),
  size: z.string().trim().min(1, "الحجم مطلوب").max(80),
  colors: z.string().trim().min(1, "الألوان مطلوبة").max(120),
  notes: z.string().trim().max(500).optional(),
  materialType: z.enum(["filament", "resin", "both", "any"]),
  quantity: z.number().min(1).max(100),
});

type RequestData = z.infer<typeof requestSchema>;

interface UserAddress {
  id: string;
  full_name: string;
  governorate: string;
  area: string | null;
  is_default: boolean;
}

export default function ProfessionalNewRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const { toast } = useToast();
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);

  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [formData, setFormData] = useState<RequestData>({
    title: "",
    description: "",
    size: "",
    colors: "",
    notes: "",
    materialType: "" as any,
    quantity: 1,
  });
  const [selectedAddressId, setSelectedAddressId] = useState("");

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [mainImageIndex, setMainImageIndex] = useState(0);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [hasReferenceLinks, setHasReferenceLinks] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([{ id: safeId(), url: "" }]);

  // Fetch user addresses
  const { data: addresses = [] } = useQuery({
    queryKey: ["user-addresses", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_addresses")
        .select("id, full_name, governorate, area, is_default")
        .eq("user_id", user!.id)
        .order("is_default", { ascending: false });
      if (error) throw error;
      return data as UserAddress[];
    },
  });

  // Set default address
  useEffect(() => {
    if (addresses.length > 0 && !selectedAddressId) {
      const defaultAddr = addresses.find((a) => a.is_default) || addresses[0];
      setSelectedAddressId(defaultAddr.id);
    }
  }, [addresses, selectedAddressId]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFormData({ title: "", description: "", size: "", colors: "", notes: "", materialType: "" as any, quantity: 1 });
      setMediaFiles([]);
      setMainImageIndex(0);
      setHasReferenceLinks(false);
      setLinks([{ id: safeId(), url: "" }]);
      setSelectedAddressId("");
    }
  }, [open]);

  const addLink = () => setLinks((prev) => [...prev, { id: safeId(), url: "" }]);
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));
  const updateLink = (id: string, url: string) =>
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));

  const updateField = (field: keyof RequestData, value: any) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const removeMedia = (id: string) => {
    const idx = mediaFiles.findIndex((m) => m.id === id);
    setMediaFiles((prev) => prev.filter((m) => m.id !== id));
    if (idx <= mainImageIndex && mainImageIndex > 0) {
      setMainImageIndex((prev) => prev - 1);
    }
  };

  const setAsMainImage = (id: string) => {
    const idx = mediaFiles.findIndex((m) => m.id === id && m.type === "image");
    if (idx >= 0) setMainImageIndex(idx);
  };

  // Upload media mutation
  const uploadMediaMutation = useMutation({
    mutationFn: async ({ file, type }: { file: File; type: "image" | "video" }) => {
      if (!user?.id) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}_${Math.random().toString(16).slice(2)}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(`print-requests/${fileName}`, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(`print-requests/${fileName}`);

      return { url: publicUrl, type };
    },
  });

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    const imageCount = mediaFiles.filter((m) => m.type === "image").length;
    const maxImages = 5;
    const allowedCount = maxImages - imageCount;

    if (allowedCount <= 0) {
      toast({ title: "تم الوصول للحد الأقصى", description: `الحد الأقصى ${maxImages} صور`, variant: "destructive" });
      return;
    }

    const filesToUpload = files.slice(0, allowedCount);

    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast({ title: "الملف كبير جداً", description: `${file.name} - الحد الأقصى 5 ميغابايت`, variant: "destructive" });
        continue;
      }

      if (!file.type.startsWith("image/")) {
        toast({ title: "نوع الملف غير مدعوم", description: "الرجاء اختيار صورة", variant: "destructive" });
        continue;
      }

      setUploadingMedia(true);
      try {
        const result = await uploadMediaMutation.mutateAsync({ file, type: "image" });
        setMediaFiles((prev) => [...prev, { id: safeId(), url: result.url, type: "image" }]);
        toast({ title: "تم رفع الصورة بنجاح" });
      } catch (err: any) {
        toast({ title: "تعذر رفع الصورة", description: err?.message ?? "حدث خطأ", variant: "destructive" });
      } finally {
        setUploadingMedia(false);
      }
    }

    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasVideo = mediaFiles.some((m) => m.type === "video");
    if (hasVideo) {
      toast({ title: "فيديو موجود مسبقاً", description: "يمكنك رفع فيديو واحد فقط", variant: "destructive" });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({ title: "الملف كبير جداً", description: "الحد الأقصى 50 ميغابايت للفيديو", variant: "destructive" });
      return;
    }

    setUploadingMedia(true);
    try {
      const result = await uploadMediaMutation.mutateAsync({ file, type: "video" });
      setMediaFiles((prev) => [...prev, { id: safeId(), url: result.url, type: "video" }]);
      toast({ title: "تم رفع الفيديو بنجاح" });
    } catch (err: any) {
      toast({ title: "تعذر رفع الفيديو", description: err?.message ?? "حدث خطأ", variant: "destructive" });
    } finally {
      setUploadingMedia(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // Submit request mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      const validated = requestSchema.parse(formData);
      const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

      const titleCheck = filterContent(validated.title);
      if (!titleCheck.isClean) throw new Error("العنوان يحتوي على كلمات غير مناسبة");

      const descCheck = validateBio(validated.description);
      if (!descCheck.isClean) throw new Error("الوصف يحتوي على محتوى غير مناسب");

      const imageFiles = mediaFiles.filter((m) => m.type === "image");
      const sortedImages = [
        imageFiles[mainImageIndex],
        ...imageFiles.filter((_, i) => i !== mainImageIndex),
      ].map((m) => m.url);

      const video = mediaFiles.find((m) => m.type === "video")?.url || null;

      if (sortedImages.length === 0) throw new Error("صورة واحدة على الأقل مطلوبة");
      if (!validated.materialType) throw new Error("نوع المادة مطلوب");
      if (!selectedAddressId) throw new Error("يرجى اختيار العنوان");

      const validLinks = hasReferenceLinks
        ? links.filter((l) => l.url.trim()).map((l) => l.url.trim())
        : [];

      const { data, error } = await supabase
        .from("community_print_requests")
        .insert({
          user_id: user.id,
          title: validated.title,
          description: validated.description,
          size: validated.size,
          colors: validated.colors,
          notes: validated.notes?.trim() || null,
          image_url: sortedImages[0],
          images: sortedImages,
          video_url: video,
          material_type: validated.materialType,
          reference_links: validLinks.length > 0 ? validLinks : null,
          status: "approved",
          quantity: validated.quantity,
          customer_address_id: selectedAddressId,
          customer_governorate: selectedAddress?.governorate || null,
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["community-print-requests"] });
      toast({ title: "تم نشر الطلب بنجاح ✓", description: "طلبك متاح الآن للتجار" });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({ title: "تعذر إرسال الطلب", description: err?.message ?? "حدث خطأ غير متوقع", variant: "destructive" });
    },
  });

  const imageCount = mediaFiles.filter((m) => m.type === "image").length;
  const hasVideo = mediaFiles.some((m) => m.type === "video");
  const selectedAddress = addresses.find((a) => a.id === selectedAddressId);

  const step1Valid = formData.title.trim().length >= 3 && formData.description.trim().length >= 10 && imageCount >= 1;
  const step2Valid = formData.size.trim().length >= 1 && formData.colors.trim().length >= 1 && !!formData.materialType;
  const step3Valid = !!selectedAddressId && formData.quantity >= 1;

  const canSubmit = step1Valid && step2Valid && step3Valid;
  const progressPercent = step === 1 ? 33 : step === 2 ? 66 : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0 border-primary/20 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Compact Header */}
        <div className="relative bg-gradient-to-br from-primary/15 to-transparent border-b border-primary/20 px-4 py-4 shrink-0">
          <div className="flex items-center gap-3 mb-3">
            <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
              <Package className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h2 className="text-base font-bold">طلب طباعة جديد</h2>
              <p className="text-[10px] text-muted-foreground">الخطوة {step} من 3</p>
            </div>
          </div>

          {/* Progress Steps */}
          <div className="flex items-center gap-2">
            {[1, 2, 3].map((s) => (
              <button
                key={s}
                onClick={() => {
                  if (s === 1) setStep(1);
                  else if (s === 2 && step1Valid) setStep(2);
                  else if (s === 3 && step1Valid && step2Valid) setStep(3);
                }}
                disabled={s === 2 && !step1Valid || s === 3 && (!step1Valid || !step2Valid)}
                className={`flex-1 h-1.5 rounded-full transition-all ${
                  step >= s ? "bg-primary" : "bg-muted"
                }`}
              />
            ))}
          </div>
          <div className="flex justify-between mt-2 text-[10px] text-muted-foreground">
            <span className={step === 1 ? "text-primary font-medium" : ""}>المعلومات</span>
            <span className={step === 2 ? "text-primary font-medium" : ""}>التفاصيل</span>
            <span className={step === 3 ? "text-primary font-medium" : ""}>العنوان</span>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 min-h-0 overflow-y-auto p-4 space-y-4">
          {step === 1 && (
            <>
              {/* Media Upload */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <ImageIcon className="h-3.5 w-3.5" />
                  الصور والفيديو ({imageCount}/5)
                </Label>
                <div className="grid grid-cols-4 gap-2">
                  {mediaFiles.map((media, idx) => {
                    const isMain = media.type === "image" && idx === mainImageIndex;
                    return (
                      <div
                        key={media.id}
                        onClick={() => media.type === "image" && setAsMainImage(media.id)}
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
                  {imageCount < 5 && (
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
                <Label htmlFor="title" className="text-xs font-medium">عنوان الطلب *</Label>
                <Input
                  id="title"
                  value={formData.title}
                  onChange={(e) => updateField("title", e.target.value)}
                  placeholder="مثال: طباعة مجسم شخصية أنمي"
                  maxLength={120}
                  className="h-9 text-sm"
                />
              </div>

              {/* Description */}
              <div className="space-y-1.5">
                <Label htmlFor="desc" className="text-xs font-medium">وصف الطلب *</Label>
                <Textarea
                  id="desc"
                  value={formData.description}
                  onChange={(e) => updateField("description", e.target.value)}
                  placeholder="اكتب وصفاً تفصيلياً لما تريد طباعته..."
                  maxLength={1500}
                  className="min-h-[80px] text-sm resize-none"
                />
              </div>
            </>
          )}

          {step === 2 && (
            <>
              {/* Material Type */}
              <div className="space-y-2">
                <Label className="text-xs font-medium">نوع المادة *</Label>
                <div className="grid grid-cols-2 gap-2">
                  {MATERIAL_TYPES.map((type) => (
                    <button
                      key={type.value}
                      type="button"
                      onClick={() => updateField("materialType", type.value)}
                      className={`p-3 rounded-lg border-2 text-sm font-medium transition-all flex items-center gap-2 ${
                        formData.materialType === type.value
                          ? "border-primary bg-primary/10"
                          : "border-border hover:border-primary/50"
                      }`}
                    >
                      <span>{type.icon}</span>
                      {type.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Size */}
              <div className="space-y-1.5">
                <Label htmlFor="size" className="text-xs font-medium flex items-center gap-1.5">
                  <Ruler className="h-3.5 w-3.5" />
                  الحجم المطلوب *
                </Label>
                <Input
                  id="size"
                  value={formData.size}
                  onChange={(e) => updateField("size", e.target.value)}
                  placeholder="مثال: 10 سم ارتفاع / 15×10×8 سم"
                  maxLength={80}
                  className="h-9 text-sm"
                />
              </div>

              {/* Colors */}
              <div className="space-y-1.5">
                <Label htmlFor="colors" className="text-xs font-medium flex items-center gap-1.5">
                  <Palette className="h-3.5 w-3.5" />
                  الألوان المطلوبة *
                </Label>
                <Input
                  id="colors"
                  value={formData.colors}
                  onChange={(e) => updateField("colors", e.target.value)}
                  placeholder="مثال: أسود، أبيض، رمادي"
                  maxLength={120}
                  className="h-9 text-sm"
                />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label htmlFor="notes" className="text-xs font-medium">ملاحظات إضافية</Label>
                <Input
                  id="notes"
                  value={formData.notes || ""}
                  onChange={(e) => updateField("notes", e.target.value)}
                  placeholder="أي تفاصيل أو متطلبات خاصة..."
                  maxLength={500}
                  className="h-9 text-sm"
                />
              </div>

              {/* Reference Links Toggle */}
              <div className="flex items-center justify-between p-3 rounded-lg border border-border">
                <div className="flex items-center gap-2">
                  <Link2 className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium">روابط مرجعية</span>
                </div>
                <Switch checked={hasReferenceLinks} onCheckedChange={setHasReferenceLinks} />
              </div>
              {hasReferenceLinks && (
                <div className="space-y-2">
                  {links.map((l, idx) => (
                    <div key={l.id} className="flex items-center gap-2">
                      <Input
                        value={l.url}
                        onChange={(e) => updateLink(l.id, e.target.value)}
                        placeholder={`رابط ${idx + 1}`}
                        className="h-8 text-sm"
                      />
                      <Button type="button" variant="ghost" size="icon" onClick={() => removeLink(l.id)} disabled={links.length === 1} className="h-8 w-8">
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                  ))}
                  <Button type="button" variant="outline" size="sm" onClick={addLink} className="h-7 text-xs gap-1">
                    <Plus className="h-3 w-3" />
                    إضافة رابط
                  </Button>
                </div>
              )}
            </>
          )}

          {step === 3 && (
            <>
              {/* Quantity */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <Hash className="h-3.5 w-3.5" />
                  الكمية المطلوبة
                </Label>
                <div className="flex items-center gap-3">
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => updateField("quantity", Math.max(1, formData.quantity - 1))}
                    disabled={formData.quantity <= 1}
                  >
                    -
                  </Button>
                  <span className="w-10 text-center text-lg font-bold">{formData.quantity}</span>
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    className="h-9 w-9"
                    onClick={() => updateField("quantity", Math.min(100, formData.quantity + 1))}
                  >
                    +
                  </Button>
                </div>
              </div>

              {/* Address Selection */}
              <div className="space-y-2">
                <Label className="text-xs font-medium flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5" />
                  عنوان التوصيل *
                </Label>
                {addresses.length === 0 ? (
                  <div className="p-3 rounded-lg border border-amber-500/30 bg-amber-500/5 text-xs text-amber-600">
                    لا توجد عناوين محفوظة. أضف عنواناً من الملف الشخصي.
                  </div>
                ) : (
                  <Select value={selectedAddressId} onValueChange={setSelectedAddressId}>
                    <SelectTrigger className="h-10">
                      <SelectValue placeholder="اختر العنوان" />
                    </SelectTrigger>
                    <SelectContent>
                      {addresses.map((addr) => (
                        <SelectItem key={addr.id} value={addr.id}>
                          <div className="flex items-center gap-2">
                            <span>{addr.full_name}</span>
                            <Badge variant="outline" className="text-[10px]">{addr.governorate}</Badge>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                )}
              </div>

              {/* Summary */}
              <div className="p-4 rounded-xl bg-muted/50 border border-border space-y-3">
                <h4 className="text-sm font-bold">ملخص الطلب</h4>
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="text-muted-foreground">العنوان</div>
                  <div className="font-medium truncate">{formData.title || "-"}</div>
                  <div className="text-muted-foreground">المادة</div>
                  <div className="font-medium">{MATERIAL_TYPES.find(t => t.value === formData.materialType)?.label || "-"}</div>
                  <div className="text-muted-foreground">الحجم</div>
                  <div className="font-medium">{formData.size || "-"}</div>
                  <div className="text-muted-foreground">الكمية</div>
                  <div className="font-medium">{formData.quantity}×</div>
                  <div className="text-muted-foreground">الموقع</div>
                  <div className="font-medium text-primary">{selectedAddress?.governorate || "-"}</div>
                </div>
              </div>

              {/* Auto-publish Notice */}
              <div className="flex items-start gap-2 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30">
                <CheckCircle2 className="h-4 w-4 text-emerald-600 mt-0.5" />
                <div>
                  <p className="text-xs font-medium text-emerald-700">نشر تلقائي</p>
                  <p className="text-[10px] text-emerald-600/80">سيُنشر طلبك مباشرة ويكون متاحاً للتجار</p>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 p-4 flex items-center justify-between gap-3 shrink-0">
          {step === 1 && (
            <>
              <Button type="button" variant="ghost" onClick={() => onOpenChange(false)} className="text-muted-foreground">إلغاء</Button>
              <Button type="button" disabled={!step1Valid} onClick={() => setStep(2)} className="gap-2">
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === 2 && (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep(1)} className="gap-2">
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
              <Button type="button" disabled={!step2Valid} onClick={() => setStep(3)} className="gap-2">
                التالي <ArrowLeft className="h-4 w-4" />
              </Button>
            </>
          )}
          {step === 3 && (
            <>
              <Button type="button" variant="ghost" onClick={() => setStep(2)} className="gap-2">
                <ArrowRight className="h-4 w-4" /> رجوع
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="gap-2"
              >
                {submitMutation.isPending ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> جاري النشر...</>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> نشر الطلب</>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
