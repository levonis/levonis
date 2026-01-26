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
  Sparkles,
  CheckCircle2,
  Upload,
  Package,
  ArrowLeft,
  ArrowRight,
  AlertCircle,
} from "lucide-react";

type LinkItem = { id: string; url: string };

function safeId() {
  return `${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

const requestSchema = z.object({
  title: z.string().trim().min(3, "العنوان مطلوب (3 أحرف على الأقل)").max(120),
  description: z.string().trim().min(10, "الوصف مطلوب (10 أحرف على الأقل)").max(1500),
  size: z.string().trim().min(1, "الحجم مطلوب").max(80),
  colors: z.string().trim().min(1, "الألوان مطلوبة").max(120),
  notes: z.string().trim().max(500).optional(),
});

type RequestData = z.infer<typeof requestSchema>;

interface FieldConfig {
  id: keyof RequestData;
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

  const [step, setStep] = useState<1 | 2>(1);
  const [formData, setFormData] = useState<RequestData>({
    title: "",
    description: "",
    size: "",
    colors: "",
    notes: "",
  });

  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imageUrl, setImageUrl] = useState<string>("");
  const [uploadingImage, setUploadingImage] = useState(false);

  const [hasReferenceLinks, setHasReferenceLinks] = useState(false);
  const [links, setLinks] = useState<LinkItem[]>([{ id: safeId(), url: "" }]);

  const imagePreviewUrl = useMemo(() => {
    if (imageUrl) return imageUrl;
    if (!imageFile) return null;
    return URL.createObjectURL(imageFile);
  }, [imageFile, imageUrl]);

  useEffect(() => {
    return () => {
      if (imagePreviewUrl && !imageUrl) {
        URL.revokeObjectURL(imagePreviewUrl);
      }
    };
  }, [imagePreviewUrl, imageUrl]);

  // Reset form when dialog closes
  useEffect(() => {
    if (!open) {
      setStep(1);
      setFormData({ title: "", description: "", size: "", colors: "", notes: "" });
      setImageFile(null);
      setImageUrl("");
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

  // Upload image mutation
  const uploadImageMutation = useMutation({
    mutationFn: async (file: File) => {
      if (!user?.id) throw new Error("Not authenticated");

      const fileExt = file.name.split(".").pop();
      const fileName = `${user.id}/${Date.now()}.${fileExt}`;

      const { error: uploadError } = await supabase.storage
        .from("product-images")
        .upload(`print-requests/${fileName}`, file, { upsert: true });

      if (uploadError) throw uploadError;

      const {
        data: { publicUrl },
      } = supabase.storage.from("product-images").getPublicUrl(`print-requests/${fileName}`);

      return publicUrl;
    },
    onSuccess: (url) => {
      setImageUrl(url);
      toast({ title: "تم رفع الصورة بنجاح" });
    },
    onError: (err: any) => {
      toast({
        title: "تعذر رفع الصورة",
        description: err?.message ?? "حدث خطأ",
        variant: "destructive",
      });
    },
  });

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
      toast({
        title: "الملف كبير جداً",
        description: "الحد الأقصى 5 ميغابايت",
        variant: "destructive",
      });
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast({
        title: "نوع الملف غير مدعوم",
        description: "الرجاء اختيار صورة",
        variant: "destructive",
      });
      return;
    }

    setImageFile(file);
    setUploadingImage(true);
    try {
      await uploadImageMutation.mutateAsync(file);
    } finally {
      setUploadingImage(false);
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

      if (!imageUrl) {
        throw new Error("الصورة مطلوبة");
      }

      // Prepare reference links
      const validLinks = hasReferenceLinks
        ? links.filter((l) => l.url.trim()).map((l) => l.url.trim())
        : [];

      // Insert request
      const { data, error } = await supabase
        .from("community_print_requests")
        .insert({
          user_id: user.id,
          title: validated.title,
          description: validated.description,
          size: validated.size,
          colors: validated.colors,
          notes: validated.notes?.trim() || null,
          image_url: imageUrl,
          reference_links: validLinks.length > 0 ? validLinks : null,
          status: "pending_review", // Pending admin review
        })
        .select("id")
        .single();

      if (error) throw error;
      return data;
    },
    onSuccess: async () => {
      await qc.invalidateQueries({ queryKey: ["community-print-requests"] });
      toast({
        title: "تم إرسال الطلب بنجاح ✓",
        description: "سيتم مراجعة طلبك من قبل الإدارة",
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

  const step1Valid = useMemo(() => {
    return (
      formData.title.trim().length >= 3 &&
      formData.description.trim().length >= 10 &&
      !!imageUrl
    );
  }, [formData.title, formData.description, imageUrl]);

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
              <p className="text-xs text-muted-foreground">أضف تفاصيل طلبك وسيتم مراجعته</p>
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
              {/* Image Upload */}
              <div className="space-y-3">
                <Label className="text-sm font-semibold flex items-center gap-2">
                  <ImageIcon className="h-4 w-4 text-primary" />
                  صورة الطلب
                  <span className="text-destructive">*</span>
                </Label>
                <div className="flex gap-4">
                  <div
                    onClick={() => fileInputRef.current?.click()}
                    className={`relative h-28 w-28 rounded-2xl border-2 border-dashed transition-all overflow-hidden group cursor-pointer hover:border-primary ${
                      imagePreviewUrl
                        ? "border-primary/60 bg-primary/10"
                        : "border-border bg-muted/50"
                    }`}
                  >
                    {uploadingImage ? (
                      <div className="h-full w-full flex items-center justify-center">
                        <Loader2 className="h-6 w-6 animate-spin text-primary" />
                      </div>
                    ) : imagePreviewUrl ? (
                      <>
                        <img
                          src={imagePreviewUrl}
                          alt="معاينة"
                          className="h-full w-full object-cover"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                          <Upload className="h-6 w-6 text-white" />
                        </div>
                      </>
                    ) : (
                      <div className="h-full w-full flex flex-col items-center justify-center gap-1 text-muted-foreground">
                        <Upload className="h-6 w-6" />
                        <span className="text-[10px]">رفع صورة</span>
                      </div>
                    )}
                  </div>
                  <div className="flex-1">
                    <p className="text-sm text-muted-foreground">
                      {imageUrl
                        ? "✓ تم رفع الصورة بنجاح"
                        : "ارفع صورة توضح ما تريد طباعته"}
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      الحد الأقصى: 5 ميغابايت
                    </p>
                  </div>
                </div>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleFileSelect}
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

              {/* Review Notice */}
              <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4">
                <div className="flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
                  <div>
                    <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                      ملاحظة هامة
                    </p>
                    <p className="text-xs text-amber-600/80 dark:text-amber-400/80 mt-1">
                      سيتم مراجعة طلبك من قبل الإدارة قبل عرضه للتجار
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
                    جارٍ الإرسال...
                  </>
                ) : (
                  <>
                    <Send className="h-4 w-4" />
                    إرسال الطلب
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
