import { useState, useRef } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Package, Palette, Settings2, Box, Clock, Eye, Star, Wallet, 
  CreditCard, Plus, X, Upload, Loader2, Droplets, Layers, Image as ImageIcon
} from "lucide-react";
import MerchantProductMediaUpload from "./MerchantProductMediaUpload";
import ProductCategorySelector from "./ProductCategorySelector";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { useCommissionSettings } from "@/hooks/useCommissionSettings";

interface ProductColor {
  name: string;
  hex_code: string;
  image_url: string | null;
  stock_quantity: number | null;
}

interface ProductOption {
  name: string;
  image_url: string | null;
  price_adjustment: number;
  stock_quantity: number | null;
}

type MaterialType = "resin" | "filament" | "both";

export interface ProductFormData {
  title: string;
  description: string;
  price_iqd: string;
  original_price_iqd: string;
  estimated_days: string;
  is_active: boolean;
  is_featured: boolean;
  material_type: MaterialType | "";
  category_ids: string[];
  stock_quantity: string;
  colors: ProductColor[];
  options: ProductOption[];
  is_preorder: boolean;
  preorder_end_date: string;
  preorder_queue_total: string;
  allow_partial_payment: boolean;
  allow_wallet_payment: boolean;
}

export interface MediaState {
  image_urls: string[];
  video_url: string;
  primary_image_index: number;
}

interface ProductFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  formData: ProductFormData;
  setFormData: (data: ProductFormData) => void;
  mediaState: MediaState;
  setMediaState: (state: MediaState) => void;
  merchantId: string;
  isEditing: boolean;
  onSave: () => void;
  isSaving: boolean;
}

export default function ProductFormDialog({
  open, onOpenChange, formData, setFormData, mediaState, setMediaState,
  merchantId, isEditing, onSave, isSaving,
}: ProductFormDialogProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [uploadingColorImage, setUploadingColorImage] = useState<number | null>(null);
  const [uploadingOptionImage, setUploadingOptionImage] = useState<number | null>(null);

  const { data: commissionSettings } = useCommissionSettings();
  const COMMISSION_RATE = commissionSettings?.platform_rate ?? 0.017;

  const uploadImage = async (file: File): Promise<string | null> => {
    if (!user?.id) return null;
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;
      const { error } = await supabase.storage.from("merchant_product_media").upload(path, file, { upsert: false });
      if (error) throw error;
      const { data } = supabase.storage.from("merchant_product_media").getPublicUrl(path);
      return data.publicUrl;
    } catch {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
      return null;
    }
  };

  // Colors
  const addColor = () => {
    setFormData({ ...formData, colors: [...formData.colors, { name: "", hex_code: "#000000", image_url: null, stock_quantity: null }] });
  };
  const updateColor = (idx: number, field: keyof ProductColor, value: any) => {
    const updated = [...formData.colors];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, colors: updated });
  };
  const removeColor = (idx: number) => {
    setFormData({ ...formData, colors: formData.colors.filter((_, i) => i !== idx) });
  };
  const handleColorImage = async (idx: number, file: File) => {
    setUploadingColorImage(idx);
    const url = await uploadImage(file);
    if (url) updateColor(idx, "image_url", url);
    setUploadingColorImage(null);
  };

  // Options
  const addOption = () => {
    setFormData({ ...formData, options: [...formData.options, { name: "", image_url: null, price_adjustment: 0, stock_quantity: null }] });
  };
  const updateOption = (idx: number, field: keyof ProductOption, value: any) => {
    const updated = [...formData.options];
    updated[idx] = { ...updated[idx], [field]: value };
    setFormData({ ...formData, options: updated });
  };
  const removeOption = (idx: number) => {
    setFormData({ ...formData, options: formData.options.filter((_, i) => i !== idx) });
  };
  const handleOptionImage = async (idx: number, file: File) => {
    setUploadingOptionImage(idx);
    const url = await uploadImage(file);
    if (url) updateOption(idx, "image_url", url);
    setUploadingOptionImage(null);
  };

  const priceNum = parseInt(formData.price_iqd) || 0;
  const netAmount = Math.floor(priceNum * (1 - COMMISSION_RATE));
  const halfCommission = Math.floor(priceNum * (1 - COMMISSION_RATE * 2));
  const quarterCommission = Math.floor(priceNum * (1 - COMMISSION_RATE * 2));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-hidden rounded-2xl border-border/50 p-0" dir="rtl">
        <DialogHeader className="p-5 pb-0">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <Package className="h-5 w-5 text-primary" />
            {isEditing ? "تعديل المنتج" : "إضافة منتج جديد"}
          </DialogTitle>
          <DialogDescription className="text-xs">أضف تفاصيل منتجك وخياراته</DialogDescription>
        </DialogHeader>

        <Tabs defaultValue="basic" className="flex-1 flex flex-col overflow-hidden">
          <TabsList className="mx-5 grid grid-cols-4 h-9">
            <TabsTrigger value="basic" className="text-xs gap-1"><Package className="h-3 w-3" />أساسي</TabsTrigger>
            <TabsTrigger value="variants" className="text-xs gap-1"><Palette className="h-3 w-3" />متغيرات</TabsTrigger>
            <TabsTrigger value="stock" className="text-xs gap-1"><Box className="h-3 w-3" />مخزون</TabsTrigger>
            <TabsTrigger value="payment" className="text-xs gap-1"><Wallet className="h-3 w-3" />دفع</TabsTrigger>
          </TabsList>

          <div className="overflow-y-auto flex-1 px-5 pb-5">
            {/* Basic Tab */}
            <TabsContent value="basic" className="space-y-4 mt-4">
              <MerchantProductMediaUpload
                imageUrls={mediaState.image_urls}
                onImagesChange={(urls) => setMediaState({ ...mediaState, image_urls: urls })}
                videoUrl={mediaState.video_url}
                onVideoUrlChange={(url) => setMediaState({ ...mediaState, video_url: url })}
                primaryImageIndex={mediaState.primary_image_index}
                onPrimaryImageChange={(idx) => setMediaState({ ...mediaState, primary_image_index: idx })}
              />

              <div className="space-y-2">
                <Label className="text-sm font-medium">اسم المنتج *</Label>
                <Input value={formData.title} onChange={(e) => setFormData({ ...formData, title: e.target.value })} placeholder="مثال: مجسم شخصية أنمي" maxLength={100} />
              </div>

              <div className="space-y-2">
                <Label className="text-sm font-medium">الوصف</Label>
                <Textarea value={formData.description} onChange={(e) => setFormData({ ...formData, description: e.target.value })} placeholder="وصف تفصيلي..." rows={3} maxLength={500} />
              </div>

              <ProductCategorySelector merchantId={merchantId} selectedIds={formData.category_ids} onChange={(ids) => setFormData({ ...formData, category_ids: ids })} />

              {/* Material Type */}
              <div className="space-y-2">
                <Label className="text-sm font-medium">نوع المادة *</Label>
                <div className="flex flex-wrap gap-2">
                  {[
                    { value: "resin", label: "رزن", icon: Droplets, color: "text-blue-400" },
                    { value: "filament", label: "فلمنت", icon: Layers, color: "text-orange-400" },
                    { value: "both", label: "كلاهما" },
                  ].map((opt) => (
                    <button key={opt.value} type="button"
                      onClick={() => setFormData({ ...formData, material_type: opt.value as MaterialType })}
                      className={`flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-medium transition-all ${formData.material_type === opt.value ? "bg-primary text-primary-foreground border-primary" : "bg-background border-border hover:border-primary/50"}`}>
                      {opt.value === "both" ? <><Droplets className="h-3.5 w-3.5 text-blue-400" /><Layers className="h-3.5 w-3.5 text-orange-400" /></> : opt.icon && <opt.icon className={`h-3.5 w-3.5 ${opt.color}`} />}
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Price with commission */}
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">السعر (د.ع)</Label>
                  <Input type="number" value={formData.price_iqd} onChange={(e) => setFormData({ ...formData, price_iqd: e.target.value })} placeholder="25000" />
                  {priceNum > 0 && (
                    <div className="flex items-center justify-between text-[11px] p-1.5 rounded-lg bg-green-500/10 border border-green-500/20">
                      <span className="text-muted-foreground">ستحصل على:</span>
                      <span className="font-bold text-green-500">{netAmount.toLocaleString()} د.ع</span>
                    </div>
                  )}
                </div>
                <div className="space-y-1.5">
                  <Label className="text-sm font-medium">السعر قبل الخصم</Label>
                  <Input type="number" value={formData.original_price_iqd} onChange={(e) => setFormData({ ...formData, original_price_iqd: e.target.value })} placeholder="30000" />
                </div>
              </div>

              <div className="space-y-1.5">
                <Label className="text-sm font-medium">مدة التنفيذ (أيام)</Label>
                <Input type="number" value={formData.estimated_days} onChange={(e) => setFormData({ ...formData, estimated_days: e.target.value })} placeholder="3" />
              </div>

              {/* Switches */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-1.5"><Eye className="h-3.5 w-3.5 text-muted-foreground" /><Label className="text-xs">نشط</Label></div>
                  <Switch checked={formData.is_active} onCheckedChange={(c) => setFormData({ ...formData, is_active: c })} />
                </div>
                <div className="flex items-center justify-between p-3 rounded-xl border border-border/50 bg-muted/20">
                  <div className="flex items-center gap-1.5"><Star className="h-3.5 w-3.5 text-muted-foreground" /><Label className="text-xs">مميز</Label></div>
                  <Switch checked={formData.is_featured} onCheckedChange={(c) => setFormData({ ...formData, is_featured: c })} />
                </div>
              </div>
            </TabsContent>

            {/* Variants Tab - Colors & Options */}
            <TabsContent value="variants" className="space-y-5 mt-4">
              {/* Colors */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5"><Palette className="h-4 w-4 text-primary" />الألوان</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addColor}><Plus className="h-3 w-3" />إضافة لون</Button>
                </div>

                {formData.colors.length === 0 && (
                  <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">لا توجد ألوان. أضف ألواناً لمنتجك (اختياري)</div>
                )}

                {formData.colors.map((color, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <input type="color" value={color.hex_code} onChange={(e) => updateColor(idx, "hex_code", e.target.value)}
                        className="h-8 w-8 rounded-lg border-0 cursor-pointer" />
                      <Input value={color.name} onChange={(e) => updateColor(idx, "name", e.target.value)} placeholder="اسم اللون" className="h-8 text-xs flex-1" />
                      <Input type="number" value={color.stock_quantity ?? ""} onChange={(e) => updateColor(idx, "stock_quantity", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞" className="h-8 text-xs w-20" />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeColor(idx)}><X className="h-3 w-3" /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {color.image_url ? (
                        <div className="relative h-12 w-12 rounded-lg border overflow-hidden">
                          <img src={color.image_url} alt="" className="h-full w-full object-cover" />
                          <button onClick={() => updateColor(idx, "image_url", null)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleColorImage(idx, e.target.files[0]); }} />
                          {uploadingColorImage === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                        </label>
                      )}
                      <span className="text-[10px] text-muted-foreground">صورة اللون (اختياري) • المخزون: {color.stock_quantity === null ? "غير محدود" : color.stock_quantity}</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Options */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm font-medium flex items-center gap-1.5"><Settings2 className="h-4 w-4 text-primary" />الخيارات (أحجام، قياسات...)</Label>
                  <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={addOption}><Plus className="h-3 w-3" />إضافة خيار</Button>
                </div>

                {formData.options.length === 0 && (
                  <div className="text-center py-6 border border-dashed rounded-xl text-xs text-muted-foreground">لا توجد خيارات. أضف خيارات مثل الأحجام والقياسات (اختياري)</div>
                )}

                {formData.options.map((opt, idx) => (
                  <div key={idx} className="p-3 rounded-xl border border-border/50 bg-muted/10 space-y-2">
                    <div className="flex items-center gap-2">
                      <Input value={opt.name} onChange={(e) => updateOption(idx, "name", e.target.value)} placeholder="اسم الخيار (مثل: كبير)" className="h-8 text-xs flex-1" />
                      <Input type="number" value={opt.price_adjustment || ""} onChange={(e) => updateOption(idx, "price_adjustment", parseInt(e.target.value) || 0)}
                        placeholder="± السعر" className="h-8 text-xs w-24" />
                      <Input type="number" value={opt.stock_quantity ?? ""} onChange={(e) => updateOption(idx, "stock_quantity", e.target.value ? parseInt(e.target.value) : null)}
                        placeholder="∞" className="h-8 text-xs w-20" />
                      <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive" onClick={() => removeOption(idx)}><X className="h-3 w-3" /></Button>
                    </div>
                    <div className="flex items-center gap-2">
                      {opt.image_url ? (
                        <div className="relative h-12 w-12 rounded-lg border overflow-hidden">
                          <img src={opt.image_url} alt="" className="h-full w-full object-cover" />
                          <button onClick={() => updateOption(idx, "image_url", null)} className="absolute inset-0 bg-black/50 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                            <X className="h-3 w-3 text-white" />
                          </button>
                        </div>
                      ) : (
                        <label className="cursor-pointer h-12 w-12 rounded-lg border border-dashed flex items-center justify-center text-muted-foreground hover:border-primary/50 transition-colors">
                          <input type="file" accept="image/*" className="hidden" onChange={(e) => { if (e.target.files?.[0]) handleOptionImage(idx, e.target.files[0]); }} />
                          {uploadingOptionImage === idx ? <Loader2 className="h-3 w-3 animate-spin" /> : <ImageIcon className="h-3 w-3" />}
                        </label>
                      )}
                      <span className="text-[10px] text-muted-foreground">
                        {opt.price_adjustment !== 0 && `فرق السعر: ${opt.price_adjustment > 0 ? "+" : ""}${opt.price_adjustment.toLocaleString()} • `}
                        المخزون: {opt.stock_quantity === null ? "غير محدود" : opt.stock_quantity}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>

            {/* Stock & Preorder Tab */}
            <TabsContent value="stock" className="space-y-5 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium flex items-center gap-1.5"><Box className="h-4 w-4 text-primary" />المخزون العام</Label>
                <Input type="number" value={formData.stock_quantity} onChange={(e) => setFormData({ ...formData, stock_quantity: e.target.value })} placeholder="اتركه فارغاً لمخزون غير محدود" />
                <p className="text-[10px] text-muted-foreground">اتركه فارغاً = مخزون غير محدود. يمكنك أيضاً تحديد المخزون لكل لون/خيار بشكل منفصل.</p>
              </div>

              {/* Pre-order */}
              <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><Clock className="h-4 w-4 text-amber-500" />حجز مسبق</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">يتيح للعملاء حجز المنتج مسبقاً مع نظام طابور</p>
                  </div>
                  <Switch checked={formData.is_preorder} onCheckedChange={(c) => setFormData({ ...formData, is_preorder: c })} />
                </div>

                {formData.is_preorder && (
                  <div className="space-y-3 pt-2 border-t border-border/30">
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-xs">عدد الطابور الكلي</Label>
                        <Input type="number" value={formData.preorder_queue_total} onChange={(e) => setFormData({ ...formData, preorder_queue_total: e.target.value })} placeholder="20" />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">تاريخ انتهاء الحجز</Label>
                        <Input type="date" value={formData.preorder_end_date} onChange={(e) => setFormData({ ...formData, preorder_end_date: e.target.value })} />
                      </div>
                    </div>
                    <p className="text-[10px] text-muted-foreground bg-amber-500/10 p-2 rounded-lg">
                      💡 عند الحجز سيظهر للعميل ترتيبه (مثلاً: أنت رقم ٥ من أصل ٢٠)
                    </p>
                  </div>
                )}
              </div>
            </TabsContent>

            {/* Payment Tab */}
            <TabsContent value="payment" className="space-y-5 mt-4">
              {/* Wallet Payment */}
              <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><Wallet className="h-4 w-4 text-primary" />الدفع من المحفظة</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">يتيح للعميل الدفع مباشرة من رصيد محفظته</p>
                  </div>
                  <Switch checked={formData.allow_wallet_payment} onCheckedChange={(c) => setFormData({ ...formData, allow_wallet_payment: c })} />
                </div>
              </div>

              {/* Partial Payment */}
              <div className="p-4 rounded-xl border border-border/50 bg-muted/10 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <Label className="text-sm font-medium flex items-center gap-1.5"><CreditCard className="h-4 w-4 text-blue-500" />خيارات دفع إضافية</Label>
                    <p className="text-[10px] text-muted-foreground mt-0.5">دفع جزئي أو عند الاستلام (عمولة مضاعفة)</p>
                  </div>
                  <Switch checked={formData.allow_partial_payment} onCheckedChange={(c) => setFormData({ ...formData, allow_partial_payment: c })} />
                </div>

                {formData.allow_partial_payment && priceNum > 0 && (
                  <div className="space-y-2 pt-2 border-t border-border/30">
                    <p className="text-[10px] text-amber-600 bg-amber-500/10 p-2 rounded-lg">
                      ⚠️ الدفع الجزئي يضاعف عمولة الموقع ({(COMMISSION_RATE * 2 * 100).toFixed(1)}% بدلاً من {(COMMISSION_RATE * 100).toFixed(1)}%)
                    </p>
                    <div className="grid grid-cols-3 gap-2">
                      <div className="p-2.5 rounded-lg border border-border/50 bg-background text-center">
                        <p className="text-[10px] text-muted-foreground">نصف المبلغ</p>
                        <p className="text-xs font-bold text-primary">{Math.floor(priceNum / 2).toLocaleString()}</p>
                        <p className="text-[9px] text-green-500">تحصل: {Math.floor((priceNum / 2) * (1 - COMMISSION_RATE * 2)).toLocaleString()}</p>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/50 bg-background text-center">
                        <p className="text-[10px] text-muted-foreground">ربع المبلغ</p>
                        <p className="text-xs font-bold text-primary">{Math.floor(priceNum / 4).toLocaleString()}</p>
                        <p className="text-[9px] text-green-500">تحصل: {Math.floor((priceNum / 4) * (1 - COMMISSION_RATE * 2)).toLocaleString()}</p>
                      </div>
                      <div className="p-2.5 rounded-lg border border-border/50 bg-background text-center">
                        <p className="text-[10px] text-muted-foreground">عند الاستلام</p>
                        <p className="text-xs font-bold text-primary">الكامل</p>
                        <p className="text-[9px] text-green-500">تحصل: {halfCommission.toLocaleString()}</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </TabsContent>
          </div>
        </Tabs>

        <div className="p-5 pt-0">
          <Button onClick={onSave} disabled={!formData.title.trim() || !formData.material_type || isSaving} className="w-full h-11 text-sm">
            {isSaving ? "جاري الحفظ..." : isEditing ? "حفظ التغييرات" : "إضافة المنتج"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
