import { useEffect, useMemo, useRef, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
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
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";

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
  Send,
  CheckCircle2,
  Upload,
  Package,
  ArrowLeft,
  ArrowRight,
  Video,
  X,
  Layers,
} from "lucide-react";

type LinkItem = { id: string; url: string };
type MediaFile = { id: string; url: string; type: "image" | "video" };

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const MATERIAL_TYPES = [
  { value: "filament", label: "فلمنت (FDM)" },
  { value: "resin", label: "رزن (SLA/DLP)" },
  { value: "both", label: "كلاهما" },
  { value: "any", label: "لا يهم" },
] as const;

const requestSchema = z.object({
  title: z.string().trim().min(3, "العنوان مطلوب (3 أحرف على الأقل)").max(120),
  description: z.string().trim().min(10, "الوصف مطلوب (10 أحرف على الأقل)").max(1500),
  size: z.string().trim().min(1, "الحجم مطلوب").max(80),
  colors: z.string().trim().min(1, "الألوان مطلوبة").max(120),
  notes: z.string().trim().max(500).optional(),
  materialType: z.enum(["filament", "resin", "both", "any"]),
});

type RequestData = z.infer<typeof requestSchema>;

interface FieldConfig {
  id: keyof Omit<RequestData, "materialType">;
  label: string;
  placeholder: string;
  icon: React.ReactNode;
  type?: "input" | "textarea";
  maxLength?: number;
  required?: boolean;
}

export default function NewPrintRequestDialog({
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

  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<RequestData>({
    title: "",
    description: "",
    size: "",
    colors: "",
    notes: "",
    materialType: "any",
  });

  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [uploadingMedia, setUploadingMedia] = useState(false);

  const [hasReferenceLinks, setHasReferenceLinks] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([{ id: safeId(), url: "" }]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFormData({ title: "", description: "", size: "", colors: "", notes: "", materialType: "any" });
      setMediaFiles([]);
      setHasReferenceLinks(false);
      setLinks([{ id: safeId(), url: "" }]);
    }
  }, [open]);

  const addLink = () => setLinks((prev) => [...prev, { id: safeId(), url: "" }]);
  const removeLink = (id: string) => setLinks((prev) => prev.filter((l) => l.id !== id));
  const updateLink = (id: string, url: string) =>
    setLinks((prev) => prev.map((l) => (l.id === id ? { ...l, url } : l)));

  const updateField = (field: keyof RequestData, value: string) => {
    setFormData((prev) => ({ ...prev, [field]: value }));
  };

  const removeMedia = (id: string) => {
    setMediaFiles((prev) => prev.filter((m) => m.id !== id));
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
      toast({
        title: "تم الوصول للحد الأقصى",
        description: `الحد الأقصى ${maxImages} صور`,
        variant: "destructive",
      });
      return;
    }

    const filesToUpload = files.slice(0, allowedCount);

    for (const file of filesToUpload) {
      if (file.size > 5 * 1024 * 1024) {
        toast({
          title: "الملف كبير جداً",
          description: `${file.name} - الحد الأقصى 5 ميغابايت`,
          variant: "destructive",
        });
        continue;
      }

      if (!file.type.startsWith("image/")) {
        toast({
          title: "نوع الملف غير مدعوم",
          description: "الرجاء اختيار صورة",
          variant: "destructive",
        });
        continue;
      }

      setUploadingMedia(true);
      try {
        const result = await uploadMediaMutation.mutateAsync({ file, type: "image" });
        setMediaFiles((prev) => [...prev, { id: safeId(), url: result.url, type: "image" }]);
        toast({ title: "تم رفع الصورة بنجاح" });
      } catch (err: any) {
        toast({
          title: "تعذر رفع الصورة",
          description: err?.message ?? "حدث خطأ",
          variant: "destructive",
        });
      } finally {
        setUploadingMedia(false);
      }
    }

    // Reset input
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const handleVideoSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const hasVideo = mediaFiles.some((m) => m.type === "video");
    if (hasVideo) {
      toast({
        title: "فيديو موجود مسبقاً",
        description: "يمكنك رفع فيديو واحد فقط",
        variant: "destructive",
      });
      return;
    }

    if (file.size > 50 * 1024 * 1024) {
      toast({
        title: "الملف كبير جداً",
        description: "الحد الأقصى 50 ميغابايت للفيديو",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("video/")) {
      toast({
        title: "نوع الملف غير مدعوم",
        description: "الرجاء اختيار فيديو",
        variant: "destructive",
      });
      return;
    }

    setUploadingMedia(true);
    try {
      const result = await uploadMediaMutation.mutateAsync({ file, type: "video" });
      setMediaFiles((prev) => [...prev, { id: safeId(), url: result.url, type: "video" }]);
      toast({ title: "تم رفع الفيديو بنجاح" });
    } catch (err: any) {
      toast({
        title: "تعذر رفع الفيديو",
        description: err?.message ?? "حدث خطأ",
        variant: "destructive",
      });
    } finally {
      setUploadingMedia(false);
      if (videoInputRef.current) videoInputRef.current.value = "";
    }
  };

  // Submit request mutation
  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!user?.id) throw new Error("Not authenticated");

      // Validate form data
      const validated = requestSchema.parse(formData);

      // Content filtering
      const titleCheck = filterContent(validated.title);
      if (!titleCheck.isClean) {
        throw new Error("العنوان يحتوي على كلمات غير مناسبة");
      }

      const descCheck = validateBio(validated.description);
      if (!descCheck.isClean) {
        throw new Error("الوصف يحتوي على محتوى غير مناسب");
      }

      const images = mediaFiles.filter((m) => m.type === "image").map((m) => m.url);
      const video = mediaFiles.find((m) => m.type === "video")?.url || null;

      if (images.length === 0) {
        throw new Error("صورة واحدة على الأقل مطلوبة");
      }

      // Prepare reference links
      const validLinks = hasReferenceLinks
        ? links.filter((l) => l.url.trim()).map((l) => l.url.trim())
        : [];

      // Insert request - auto-publish (approved status)
      const { data, error } = await supabase
        .from("community_print_requests")
        .insert({
          user_id: user.id,
          title: validated.title,
          description: validated.description,
          size: validated.size,
          colors: validated.colors,
          notes: validated.notes?.trim() || null,
          image_url: images[0], // Keep first image for backward compatibility
          images: images,
          video_url: video,
          material_type: validated.materialType,
          reference_links: validLinks.length > 0 ? validLinks : null,
          status: "approved", // Auto-publish without manual review
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["community-print-requests"] });
      toast({
        title: "تم نشر الطلب بنجاح ✓",
        description: "طلبك متاح الآن للتجار",
      });
      onOpenChange(false);
    },
    onError: (err: any) => {
      toast({
        title: "تعذر إرسال الطلب",
        description: err?.message ?? "حدث خطأ غير متوقع",
        variant: "destructive",
      });
    },
  });

  // Validation
  const step1Fields: FieldConfig[] = [
    {
      id: "title",
      label: "عنوان الطلب",
      placeholder: "مثال: طباعة مجسم شخصية أنمي",
      icon: <FileText className="h-4 w-4" />,
      maxLength: 120,
      required: true,
    },
    {
      id: "description",
      label: "وصف الطلب",
      placeholder: "اكتب وصفاً تفصيلياً لما تريد طباعته...",
      icon: <MessageSquare className="h-4 w-4" />,
      type: "textarea",
      maxLength: 1500,
      required: true,
    },
  ];

  const step2Fields: FieldConfig[] = [
    {
      id: "size",
      label: "الحجم المطلوب",
      placeholder: "مثال: 10 سم ارتفاع / 15×10×8 سم",
      icon: <Ruler className="h-4 w-4" />,
      maxLength: 80,
      required: true,
    },
    {
      id: "colors",
      label: "الألوان المطلوبة",
      placeholder: "مثال: أسود، أبيض، رمادي",
      icon: <Palette className="h-4 w-4" />,
      maxLength: 120,
      required: true,
    },
    {
      id: "notes",
      label: "ملاحظات إضافية",
      placeholder: "أي تفاصيل أو متطلبات خاصة...",
      icon: <MessageSquare className="h-4 w-4" />,
      maxLength: 500,
      required: false,
    },
  ];

  const imageCount = mediaFiles.filter((m) => m.type === "image").length;
  const hasVideo = mediaFiles.some((m) => m.type === "video");

  const step1Valid = useMemo(() => {
    return (
      formData.title.trim().length >= 3 &&
      formData.description.trim().length >= 10 &&
      imageCount >= 1
    );
  }, [formData.title, formData.description, imageCount]);

  const step2Valid = useMemo(() => {
    return formData.size.trim().length >= 1 && formData.colors.trim().length >= 1;
  }, [formData.size, formData.colors]);

  const canSubmit = step1Valid && step2Valid;
  const progressPercent = step === 1 ? 50 : 100;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg p-0 gap-0 border-primary/20 flex flex-col max-h-[90vh] overflow-hidden">
        {/* Premium Header */}
        <div className="relative bg-gradient-to-br from-primary/20 via-accent/10 to-transparent border-b border-primary/20 p-5 shrink-0">
          {/* Decorative elements */}
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -translate-x-1/2 -translate-y-1/2" />
          <div className="absolute bottom-0 right-0 w-24 h-24 bg-accent/10 rounded-full blur-2xl translate-x-1/2 translate-y-1/2" />

          <div className="relative flex items-center gap-4">
            <div className="h-12 w-12 rounded-2xl bg-gradient-to-br from-primary to-accent p-[2px] shadow-lg shadow-primary/25">
              <div className="h-full w-full rounded-2xl bg-card flex items-center justify-center">
                <Package className="h-5 w-5 text-primary" />
              </div>
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-bold text-foreground">طلب طباعة جديد</h2>
              <p className="text-xs text-muted-foreground">أضف تفاصيل طلبك وسيُنشر تلقائياً</p>
            </div>
          </div>

          {/* Progress */}
          <div className="relative mt-4">
            <Progress value={progressPercent} className="h-1.5 bg-muted/30" />
            <div className="flex justify-between mt-3">
              <button
                type="button"
                onClick={() => setStep(1)}
                className={`flex items-center gap-2 text-xs font-medium transition-colors ${
                  step === 1 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    step >= 1
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > 1 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "1"}
                </div>
                المعلومات الأساسية
              </button>
              <button
                type="button"
                onClick={() => step1Valid && setStep(2)}
                disabled={!step1Valid}
                className={`flex items-center gap-2 text-xs font-medium transition-colors disabled:opacity-50 ${
                  step === 2 ? "text-primary" : "text-muted-foreground"
                }`}
              >
                <div
                  className={`h-6 w-6 rounded-lg flex items-center justify-center text-[10px] font-bold ${
                    step >= 2
                      ? "bg-primary text-primary-foreground"
                      : "bg-muted text-muted-foreground"
                  }`}
                >
                  {step > 2 ? <CheckCircle2 className="h-3.5 w-3.5" /> : "2"}
                </div>
                التفاصيل والإرسال
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div
          className="flex-1 min-h-0 overflow-y-auto overscroll-contain p-5"
          style={{ WebkitOverflowScrolling: "touch" }}
        >
          {step === 1 && (
            <div className="space-y-5">
              {/* Media Upload Section */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  صور وفيديو الطلب
                  <span className="text-destructive">*</span>
                  <span className="text-xs text-muted-foreground font-normal mr-auto">
                    ({imageCount}/5 صور)
                  </span>
                </Label>

                {/* Media Grid */}
                <div className="grid grid-cols-4 gap-2">
                  {/* Existing Media */}
                  {mediaFiles.map((media) => (
                    <div
                      key={media.id}
                      className="relative aspect-square rounded-xl border-2 border-primary/40 bg-primary/10 overflow-hidden group"
                    >
                      {media.type === "image" ? (
                        <img
                          src={media.url}
                          alt="معاينة"
                          className="h-full w-full object-cover"
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center bg-muted">
                          <Video className="h-6 w-6 text-primary" />
                        </div>
                      )}
                      <button
                        type="button"
                        onClick={() => removeMedia(media.id)}
                        className="absolute top-1 right-1 h-6 w-6 rounded-full bg-destructive text-destructive-foreground flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                      {media.type === "video" && (
                        <div className="absolute bottom-1 left-1 text-[9px] bg-black/60 text-white px-1.5 py-0.5 rounded">
                          فيديو
                        </div>
                      )}
                    </div>
                  ))}

                  {/* Add Image Button */}
                  {imageCount < 5 && (
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {uploadingMedia ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">صورة</span>
                        </>
                      )}
                    </div>
                  )}

                  {/* Add Video Button */}
                  {!hasVideo && (
                    <div
                      onClick={() => videoInputRef.current?.click()}
                      className="aspect-square rounded-xl border-2 border-dashed border-border bg-muted/50 flex flex-col items-center justify-center gap-1 cursor-pointer hover:border-primary hover:bg-primary/5 transition-all"
                    >
                      {uploadingMedia ? (
                        <Loader2 className="h-5 w-5 animate-spin text-primary" />
                      ) : (
                        <>
                          <Video className="h-5 w-5 text-muted-foreground" />
                          <span className="text-[9px] text-muted-foreground">فيديو</span>
                        </>
                      )}
                    </div>
                  )}
                </div>

                <p className="text-xs text-muted-foreground">
                  حد أقصى: 5 صور (5MB لكل صورة) + فيديو واحد (50MB)
                </p>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  multiple
                  className="hidden"
                  onChange={handleImageSelect}
                />
                <input
                  ref={videoInputRef}
                  type="file"
                  accept="video/*"
                  className="hidden"
                  onChange={handleVideoSelect}
                />
              </div>

              {/* Step 1 Fields */}
              {step1Fields.map((field) => {
                const hasValue = !!formData[field.id]?.toString().trim();
                const Component = field.type === "textarea" ? Textarea : Input;

                return (
                  <div
                    key={field.id}
                    className={`rounded-xl border-2 transition-all duration-200 ${
                      hasValue
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-muted/50"
                    }`}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                            hasValue
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {hasValue ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            field.icon
                          )}
                        </div>
                        <Label
                          htmlFor={field.id}
                          className={`text-[11px] font-medium ${
                            hasValue ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {field.label}
                          {field.required && (
                            <span className="text-destructive mr-1">*</span>
                          )}
                        </Label>
                      </div>
                      <Component
                        id={field.id}
                        value={formData[field.id] || ""}
                        onChange={(e: any) => updateField(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        className={`border-0 bg-transparent px-0 text-sm focus-visible:ring-0 ${
                          field.type === "textarea" ? "min-h-24 resize-none" : "h-9"
                        }`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {step === 2 && (
            <div className="space-y-5">
              {/* Material Type Selection */}
              <div className="rounded-xl border-2 border-border bg-muted/50 p-4">
                <div className="flex items-center gap-2 mb-3">
                  <div className="h-7 w-7 rounded-lg bg-muted flex items-center justify-center">
                    <Layers className="h-4 w-4 text-muted-foreground" />
                  </div>
                  <Label className="text-[11px] font-medium text-muted-foreground">
                    نوع المادة المطلوبة
                    <span className="text-destructive mr-1">*</span>
                  </Label>
                </div>
                <RadioGroup
                  value={formData.materialType}
                  onValueChange={(v) => updateField("materialType", v)}
                  className="grid grid-cols-2 gap-2"
                >
                  {MATERIAL_TYPES.map((type) => (
                    <div key={type.value} className="flex items-center">
                      <RadioGroupItem
                        value={type.value}
                        id={`material-${type.value}`}
                        className="peer sr-only"
                      />
                      <Label
                        htmlFor={`material-${type.value}`}
                        className="flex-1 flex items-center justify-center gap-2 rounded-lg border-2 border-muted bg-card p-3 cursor-pointer transition-all peer-data-[state=checked]:border-primary peer-data-[state=checked]:bg-primary/10 hover:bg-muted/50"
                      >
                        <span className="text-sm font-medium">{type.label}</span>
                      </Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              {/* Step 2 Fields */}
              {step2Fields.map((field) => {
                const hasValue = !!formData[field.id]?.toString().trim();

                return (
                  <div
                    key={field.id}
                    className={`rounded-xl border-2 transition-all duration-200 ${
                      hasValue
                        ? "border-primary/40 bg-primary/10"
                        : "border-border bg-muted/50"
                    }`}
                  >
                    <div className="px-4 py-3">
                      <div className="flex items-center gap-2 mb-2">
                        <div
                          className={`h-7 w-7 rounded-lg flex items-center justify-center ${
                            hasValue
                              ? "bg-primary/20 text-primary"
                              : "bg-muted text-muted-foreground"
                          }`}
                        >
                          {hasValue ? (
                            <CheckCircle2 className="h-3.5 w-3.5" />
                          ) : (
                            field.icon
                          )}
                        </div>
                        <Label
                          htmlFor={field.id}
                          className={`text-[11px] font-medium ${
                            hasValue ? "text-primary" : "text-muted-foreground"
                          }`}
                        >
                          {field.label}
                          {field.required && (
                            <span className="text-destructive mr-1">*</span>
                          )}
                        </Label>
                      </div>
                      <Input
                        id={field.id}
                        value={formData[field.id] || ""}
                        onChange={(e) => updateField(field.id, e.target.value)}
                        placeholder={field.placeholder}
                        maxLength={field.maxLength}
                        className="h-9 border-0 bg-transparent px-0 text-sm focus-visible:ring-0"
                      />
                    </div>
                  </div>
                );
              })}

              {/* Reference Links */}
              <div className="rounded-xl border-2 border-border bg-muted/50 p-4">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3">
                    <div className="h-8 w-8 rounded-lg bg-muted flex items-center justify-center">
                      <Link2 className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">روابط مرجعية</p>
                      <p className="text-[10px] text-muted-foreground">
                        أضف روابط لنماذج مشابهة
                      </p>
                    </div>
                  </div>
                  <Switch checked={hasReferenceLinks} onCheckedChange={setHasReferenceLinks} />
                </div>

                {hasReferenceLinks && (
                  <div className="mt-4 space-y-2">
                    {links.map((l, idx) => (
                      <div key={l.id} className="flex items-center gap-2">
                        <Input
                          value={l.url}
                          onChange={(e) => updateLink(l.id, e.target.value)}
                          maxLength={500}
                          placeholder={`رابط ${idx + 1}`}
                          inputMode="url"
                          className="h-9 text-sm"
                        />
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => removeLink(l.id)}
                          disabled={links.length === 1}
                          className="h-9 w-9 shrink-0"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    ))}
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={addLink}
                      className="gap-2 h-8"
                    >
                      <Plus className="h-3.5 w-3.5" />
                      إضافة رابط
                    </Button>
                  </div>
                )}
              </div>

              {/* Auto-publish Notice */}
              <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-4">
                <div className="flex items-start gap-3">
                  <CheckCircle2 className="h-5 w-5 text-emerald-600 dark:text-emerald-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-emerald-700 dark:text-emerald-300">
                      نشر تلقائي
                    </p>
                    <p className="text-xs text-emerald-600/80 dark:text-emerald-400/80 mt-1">
                      سيُنشر طلبك مباشرة ويكون متاحاً للتجار
                    </p>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="border-t border-border/50 bg-muted/30 p-4 flex items-center justify-between gap-3 shrink-0">
          {step === 1 ? (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => onOpenChange(false)}
                className="text-muted-foreground"
              >
                إلغاء
              </Button>
              <Button
                type="button"
                disabled={!step1Valid}
                onClick={() => setStep(2)}
                className="gap-2 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90"
              >
                التالي
                <ArrowLeft className="h-4 w-4" />
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep(1)}
                className="gap-2"
              >
                <ArrowRight className="h-4 w-4" />
                رجوع
              </Button>
              <Button
                type="button"
                disabled={!canSubmit || submitMutation.isPending}
                onClick={() => submitMutation.mutate()}
                className="gap-2 bg-gradient-to-b from-primary to-accent text-primary-foreground hover:opacity-90 shadow-lg shadow-primary/25"
              >
                {submitMutation.isPending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    جارٍ النشر...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    نشر الطلب
                  </>
                )}
              </Button>
            </>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
