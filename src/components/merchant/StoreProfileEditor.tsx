import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Coins, Droplets, Layers, Sparkles, Image, Printer, MessageSquare, Clock, FolderOpen } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { useToast } from "@/hooks/use-toast";
import AvatarWithFrame from "./AvatarWithFrame";
import PrinterModelsEditor from "./PrinterModelsEditor";
import MerchantCategoriesManager from "./MerchantCategoriesManager";
import StoreLayoutSelector from "./StoreLayoutSelector";

type SpecialtyType = "resin" | "filament" | "both";
type LayoutType = "standard" | "grid_images" | "strip" | "taobao";

interface Frame {
  id: string;
  name_ar: string;
  image_url: string;
  is_free: boolean;
  points_cost: number;
}

interface StoreProfileEditorProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  merchantApp: {
    id: string;
    display_name: string;
    bio: string | null;
    store_image_url: string | null;
    social_links: { facebook?: string; instagram?: string } | null;
    selected_frame_id: string | null;
    specialty?: SpecialtyType | null;
    store_layout?: LayoutType | null;
    welcome_message?: string | null;
    away_message?: string | null;
    inquiry_template?: string | null;
    is_away?: boolean;
  };
}

export default function StoreProfileEditor({ open, onOpenChange, merchantApp }: StoreProfileEditorProps) {
  const { user } = useAuth();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [displayName, setDisplayName] = useState(merchantApp.display_name);
  const [bio, setBio] = useState(merchantApp.bio || "");
  const [facebook, setFacebook] = useState(merchantApp.social_links?.facebook || "");
  const [instagram, setInstagram] = useState(merchantApp.social_links?.instagram || "");
  const [storeImageUrl, setStoreImageUrl] = useState(merchantApp.store_image_url || "");
  const [selectedFrameId, setSelectedFrameId] = useState(merchantApp.selected_frame_id);
  const [specialty, setSpecialty] = useState<SpecialtyType>(merchantApp.specialty || "both");
  const [storeLayout, setStoreLayout] = useState<LayoutType>(merchantApp.store_layout || "standard");
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  
  // Auto-response settings
  const [welcomeMessage, setWelcomeMessage] = useState(merchantApp.welcome_message || "");
  const [awayMessage, setAwayMessage] = useState(merchantApp.away_message || "");
  const [inquiryTemplate, setInquiryTemplate] = useState(merchantApp.inquiry_template || "لدي عرضا لك، لكن هل يمكنك الإجابة على أسئلتي ؟");
  const [isAway, setIsAway] = useState(merchantApp.is_away || false);

  // Fetch available frames
  const { data: frames = [] } = useQuery({
    queryKey: ["avatar-frames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("*")
        .eq("is_active", true)
        .order("display_order");
      if (error) throw error;
      return data as Frame[];
    },
  });

  // Fetch user owned frames
  const { data: ownedFrames = [] } = useQuery({
    queryKey: ["user-avatar-frames", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_avatar_frames")
        .select("frame_id")
        .eq("user_id", user!.id);
      if (error) throw error;
      return data.map((f) => f.frame_id);
    },
  });

  // Fetch user points
  const { data: userPoints } = useQuery({
    queryKey: ["user-points", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_points")
        .select("available_points")
        .eq("user_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data?.available_points || 0;
    },
  });

  const selectedFrame = frames.find((f) => f.id === selectedFrameId);

  // Save profile mutation
  const saveMutation = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("merchant_applications")
        .update({
          display_name: displayName.trim(),
          bio: bio.trim() || null,
          store_image_url: storeImageUrl || null,
          social_links: { facebook: facebook.trim() || null, instagram: instagram.trim() || null },
          selected_frame_id: selectedFrameId,
          specialty: specialty,
          store_layout: storeLayout,
          welcome_message: welcomeMessage.trim() || null,
          away_message: awayMessage.trim() || null,
          inquiry_template: inquiryTemplate.trim() || "لدي عرضا لك، لكن هل يمكنك الإجابة على أسئلتي ؟",
          is_away: isAway,
        })
        .eq("id", merchantApp.id);
      if (error) throw error;
      
      // Sync store_layout to public profiles table
      await supabase
        .from("merchant_public_profiles")
        .update({ store_layout: storeLayout })
        .eq("id", merchantApp.id);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-app"] });
      queryClient.invalidateQueries({ queryKey: ["merchant-store"] });
      toast({ title: "تم الحفظ", description: "تم تحديث معلومات المتجر بنجاح." });
      onOpenChange(false);
    },
    onError: () => {
      toast({ title: "خطأ", description: "فشل حفظ التغييرات.", variant: "destructive" });
    },
  });

  // Purchase frame mutation
  const purchaseFrameMutation = useMutation({
    mutationFn: async (frame: Frame) => {
      if (!user?.id) throw new Error("Not authenticated");
      
      if ((userPoints || 0) < frame.points_cost) {
        throw new Error("نقاط غير كافية");
      }

      const { error: pointsError } = await supabase.from("points_transactions").insert({
        user_id: user.id,
        points: -frame.points_cost,
        type: "spend",
        source: "avatar_frame",
        description: `شراء إطار: ${frame.name_ar}`,
      });
      if (pointsError) throw pointsError;

      const { data: txns } = await supabase
        .from("points_transactions")
        .select("points")
        .eq("user_id", user.id);
      
      const total = txns?.reduce((sum, t) => sum + (Number(t.points) || 0), 0) || 0;
      
      await supabase.from("user_points").upsert({
        user_id: user.id,
        total_points: total,
        available_points: total,
      });

      const { error: frameError } = await supabase.from("user_avatar_frames").insert({
        user_id: user.id,
        frame_id: frame.id,
      });
      if (frameError) throw frameError;
    },
    onSuccess: (_, frame) => {
      queryClient.invalidateQueries({ queryKey: ["user-avatar-frames"] });
      queryClient.invalidateQueries({ queryKey: ["user-points"] });
      setSelectedFrameId(frame.id);
      toast({ title: "تم الشراء", description: "تم شراء الإطار بنجاح!" });
    },
    onError: (error: Error) => {
      toast({ title: "خطأ", description: error.message, variant: "destructive" });
    },
  });

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user?.id) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      // Use merchant_stores bucket with user_id as first folder for RLS policy
      const path = `${user.id}/store-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("merchant_stores")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("merchant_stores").getPublicUrl(path);
      setStoreImageUrl(urlData.publicUrl);
      toast({ title: "تم الرفع", description: "تم رفع صورة المتجر بنجاح." });
    } catch (err: any) {
      console.error("Upload error:", err);
      toast({ title: "خطأ", description: err?.message || "فشل رفع الصورة.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const canUseFrame = (frame: Frame) => {
    return frame.is_free || ownedFrames.includes(frame.id);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-xl font-bold flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-primary" />
              إعدادات المتجر
            </DialogTitle>
            <DialogDescription>
              قم بتخصيص مظهر متجرك ومعلوماته
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-6 max-h-[55vh] overflow-y-auto py-4 px-1">
            {/* Store Image with Frame - Premium Design */}
            <div className="flex flex-col items-center gap-4 p-6 rounded-2xl bg-gradient-to-br from-primary/10 via-primary/5 to-background border border-primary/20">
              <div className="relative group">
                <div className="absolute inset-0 bg-gradient-to-br from-primary/30 to-primary/10 rounded-full blur-xl opacity-50 group-hover:opacity-75 transition-opacity" />
                <AvatarWithFrame
                  imageUrl={storeImageUrl}
                  frameUrl={selectedFrame?.image_url}
                  size="xl"
                  animated
                />
                <label className="absolute bottom-0 right-0 h-10 w-10 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-all z-20 shadow-lg hover:scale-110">
                  <Camera className="h-4 w-4" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              
              <div className="flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFrameDialogOpen(true)}
                  className="gap-2 bg-background/50"
                >
                  <Image className="h-4 w-4" />
                  اختيار إطار
                </Button>
                {selectedFrame && (
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setSelectedFrameId(null)}
                    className="text-muted-foreground"
                  >
                    إزالة الإطار
                  </Button>
                )}
              </div>
            </div>

            {/* Store Name */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">اسم المتجر *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="اسم المتجر"
                maxLength={15}
                className="h-11"
              />
              <p className="text-[11px] text-muted-foreground">{displayName.length}/15 حرف</p>
            </div>

            {/* Bio */}
            <div className="space-y-2">
              <Label className="text-sm font-medium">نبذة عن المتجر</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="وصف قصير عن متجرك وخدماتك..."
                rows={3}
                maxLength={200}
              />
              <p className="text-[11px] text-muted-foreground">{bio.length}/200 حرف</p>
            </div>

            {/* Social Links */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">فيسبوك</Label>
                <Input
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="https://facebook.com/..."
                  dir="ltr"
                  className="h-11"
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">إنستقرام</Label>
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="https://instagram.com/..."
                  dir="ltr"
                  className="h-11"
                />
              </div>
            </div>

            {/* Specialty Selector */}
            <div className="space-y-3">
              <Label className="text-sm font-medium">تخصص الطباعة</Label>
              <div className="flex flex-wrap gap-2">
                {[
                  { value: "resin", label: "رزن فقط", icon: Droplets },
                  { value: "filament", label: "فلمنت فقط", icon: Layers },
                  { value: "both", label: "كلاهما", icons: [Droplets, Layers] },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setSpecialty(opt.value as SpecialtyType)}
                    className={`flex items-center gap-2 px-4 py-2.5 rounded-xl border text-sm font-medium transition-all ${
                      specialty === opt.value
                        ? "bg-primary text-primary-foreground border-primary shadow-sm"
                        : "bg-background border-border hover:border-primary/50"
                    }`}
                  >
                    {"icons" in opt ? (
                      <>
                        {opt.icons.map((Icon, i) => (
                          <Icon key={i} className="h-4 w-4" />
                        ))}
                      </>
                    ) : (
                      <opt.icon className="h-4 w-4" />
                    )}
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Store Categories Manager */}
            <div className="pt-4 border-t border-border/50">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <FolderOpen className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">أقسام المنتجات</h3>
                  <p className="text-[10px] text-muted-foreground">نظم منتجاتك في أقسام</p>
                </div>
              </div>
              <MerchantCategoriesManager merchantId={merchantApp.id} />
            </div>

            {/* Store Layout Selector */}
            <div className="pt-4 border-t border-border/50">
              <StoreLayoutSelector value={storeLayout} onChange={setStoreLayout} />
            </div>

            {/* Printer Models Editor */}
            <div className="pt-2 border-t border-border/50">
              <PrinterModelsEditor merchantId={merchantApp.id} />
            </div>

            {/* Auto-Response Settings */}
            <div className="pt-4 border-t border-border/50 space-y-4">
              <div className="flex items-center gap-2 mb-3">
                <div className="h-8 w-8 rounded-lg bg-primary/10 flex items-center justify-center">
                  <MessageSquare className="h-4 w-4 text-primary" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold">الرسائل التلقائية</h3>
                  <p className="text-[10px] text-muted-foreground">ردود آلية للعملاء</p>
                </div>
              </div>

              {/* Away Mode Toggle */}
              <div className="flex items-center justify-between p-3 rounded-xl border border-border bg-muted/30">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">وضع الغياب</p>
                    <p className="text-[10px] text-muted-foreground">سيتم إرسال رسالة الغياب تلقائياً</p>
                  </div>
                </div>
                <Switch
                  checked={isAway}
                  onCheckedChange={setIsAway}
                />
              </div>

              {/* Inquiry Template */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">رسالة الاستفسار (عند الدخول من طلب)</Label>
                <Textarea
                  value={inquiryTemplate}
                  onChange={(e) => setInquiryTemplate(e.target.value)}
                  placeholder="لدي عرضا لك، لكن هل يمكنك الإجابة على أسئلتي ؟"
                  rows={2}
                  maxLength={200}
                  className="text-sm"
                />
              </div>

              {/* Welcome Message */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">رسالة الترحيب (عند أول تواصل)</Label>
                <Textarea
                  value={welcomeMessage}
                  onChange={(e) => setWelcomeMessage(e.target.value)}
                  placeholder="أهلاً وسهلاً! كيف يمكنني مساعدتك؟"
                  rows={2}
                  maxLength={200}
                  className="text-sm"
                />
              </div>

              {/* Away Message */}
              <div className="space-y-2">
                <Label className="text-xs font-medium text-muted-foreground">رسالة الغياب</Label>
                <Textarea
                  value={awayMessage}
                  onChange={(e) => setAwayMessage(e.target.value)}
                  placeholder="شكراً لتواصلك! أنا غير متاح حالياً، سأرد عليك في أقرب وقت."
                  rows={2}
                  maxLength={200}
                  className="text-sm"
                />
              </div>
            </div>
          </div>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!displayName.trim() || saveMutation.isPending}
              className="w-full h-11 text-base"
            >
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Frame Selection Dialog - Premium Design */}
      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="sm:max-w-md max-h-[90vh] overflow-hidden">
          <DialogHeader className="pb-4 border-b border-border/50">
            <DialogTitle className="text-lg font-bold flex items-center gap-2">
              <Image className="h-5 w-5 text-primary" />
              اختيار إطار الصورة
            </DialogTitle>
            <DialogDescription>
              اختر إطاراً مميزاً لصورة متجرك
            </DialogDescription>
          </DialogHeader>

          {/* Points Balance */}
          <div className="flex items-center justify-between p-4 rounded-2xl bg-gradient-to-br from-primary/10 to-primary/5 border border-primary/20">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-primary/20 flex items-center justify-center">
                <Coins className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">رصيد النقاط</p>
                <p className="text-lg font-bold text-primary">{userPoints?.toLocaleString() || 0}</p>
              </div>
            </div>
          </div>

          {/* Frames Grid */}
          <div className="grid grid-cols-3 gap-3 max-h-[45vh] overflow-y-auto py-3">
            {frames.map((frame) => {
              const owned = canUseFrame(frame);
              const isSelected = selectedFrameId === frame.id;

              return (
                <button
                  key={frame.id}
                  type="button"
                  onClick={() => {
                    if (owned) {
                      setSelectedFrameId(frame.id);
                    } else {
                      purchaseFrameMutation.mutate(frame);
                    }
                  }}
                  disabled={purchaseFrameMutation.isPending}
                  className={`relative p-3 rounded-2xl border-2 transition-all hover:scale-105 ${
                    isSelected
                      ? "border-primary bg-primary/10 shadow-lg"
                      : "border-border/50 hover:border-primary/50 bg-card"
                  }`}
                >
                  <div className="flex flex-col items-center gap-2">
                    <AvatarWithFrame
                      imageUrl={storeImageUrl}
                      frameUrl={frame.image_url}
                      size="sm"
                    />
                    <span className="text-[10px] font-medium text-center line-clamp-1">
                      {frame.name_ar}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="absolute top-1.5 right-1.5 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center shadow-sm">
                      <Check className="h-3 w-3" />
                    </div>
                  )}

                  {!owned && (
                    <Badge className="absolute -bottom-1 left-1/2 -translate-x-1/2 text-[9px] gap-0.5 px-2 shadow-sm">
                      <Coins className="h-2.5 w-2.5" />
                      {frame.points_cost}
                    </Badge>
                  )}

                  {frame.is_free && !isSelected && (
                    <Badge variant="secondary" className="absolute top-1.5 left-1.5 text-[9px] px-1.5">
                      مجاني
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-4 border-t border-border/50">
            <Button
              onClick={() => setFrameDialogOpen(false)}
              className="w-full h-11"
            >
              تم الاختيار
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
