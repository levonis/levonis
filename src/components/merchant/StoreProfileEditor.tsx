import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Camera, Check, Coins, Droplets, Layers } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { useToast } from "@/hooks/use-toast";
import AvatarWithFrame from "./AvatarWithFrame";

type SpecialtyType = "resin" | "filament" | "both";

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
  const [frameDialogOpen, setFrameDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);

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
        })
        .eq("id", merchantApp.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["merchant-app"] });
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
      
      // Check points
      if ((userPoints || 0) < frame.points_cost) {
        throw new Error("نقاط غير كافية");
      }

      // Deduct points
      const { error: pointsError } = await supabase.from("points_transactions").insert({
        user_id: user.id,
        points: -frame.points_cost,
        type: "spend",
        source: "avatar_frame",
        description: `شراء إطار: ${frame.name_ar}`,
      });
      if (pointsError) throw pointsError;

      // Recalculate points
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

      // Add frame to user
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
      const path = `merchants/${user.id}/store-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(path);
      setStoreImageUrl(urlData.publicUrl);
    } catch {
      toast({ title: "خطأ", description: "فشل رفع الصورة.", variant: "destructive" });
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
        <DialogContent className="sm:max-w-md">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-lg">تعديل المتجر</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[55vh] overflow-y-auto px-0.5 py-2">
            {/* Store Image with Frame */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <AvatarWithFrame
                  imageUrl={storeImageUrl}
                  frameUrl={selectedFrame?.image_url}
                  size="xl"
                />
                <label className="absolute bottom-0 right-0 h-8 w-8 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors z-20 shadow-md">
                  <Camera className="h-3.5 w-3.5" />
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFrameDialogOpen(true)}
                className="gap-1.5 h-8 text-xs"
              >
                اختيار إطار
              </Button>
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/80">اسم المتجر *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="اسم المتجر"
                className="h-9 text-sm bg-background/50 border-border/60 focus:border-primary/50"
              />
            </div>

            <div className="space-y-1.5">
              <Label className="text-xs font-medium text-foreground/80">نبذة عن المتجر</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="وصف قصير عن متجرك..."
                rows={2}
                className="text-sm bg-background/50 border-border/60 focus:border-primary/50 resize-none"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80">فيسبوك</Label>
                <Input
                  value={facebook}
                  onChange={(e) => setFacebook(e.target.value)}
                  placeholder="الرابط..."
                  dir="ltr"
                  className="h-9 text-xs bg-background/50 border-border/60 focus:border-primary/50"
                />
              </div>
              <div className="space-y-1.5">
                <Label className="text-xs font-medium text-foreground/80">إنستقرام</Label>
                <Input
                  value={instagram}
                  onChange={(e) => setInstagram(e.target.value)}
                  placeholder="الرابط..."
                  dir="ltr"
                  className="h-9 text-xs bg-background/50 border-border/60 focus:border-primary/50"
                />
              </div>
            </div>

            {/* Specialty Selector */}
            <div className="space-y-2">
              <Label className="text-xs font-medium text-foreground/80">تخصص الطباعة</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSpecialty("resin")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    specialty === "resin"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                  }`}
                >
                  <Droplets className="h-3.5 w-3.5" />
                  رزن فقط
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialty("filament")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    specialty === "filament"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                  }`}
                >
                  <Layers className="h-3.5 w-3.5" />
                  فلمنت فقط
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialty("both")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                    specialty === "both"
                      ? "bg-primary text-primary-foreground border-primary shadow-sm"
                      : "bg-background/30 border-border/60 hover:border-primary/50 hover:bg-background/50"
                  }`}
                >
                  <Droplets className="h-3.5 w-3.5" />
                  <Layers className="h-3.5 w-3.5 -mr-0.5" />
                  كلاهما
                </button>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-border/50">
            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!displayName.trim() || saveMutation.isPending}
              className="w-full h-9 text-sm"
            >
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Frame Selection Dialog */}
      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader className="pb-3 border-b border-border/50">
            <DialogTitle className="text-lg">اختيار إطار الصورة</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between p-2.5 rounded-lg bg-primary/10 border border-primary/20">
            <span className="text-xs font-medium">نقاطك الحالية</span>
            <div className="flex items-center gap-1">
              <Coins className="h-3.5 w-3.5 text-primary" />
              <span className="text-sm font-bold text-primary">{userPoints?.toLocaleString() || 0}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-2 max-h-[45vh] overflow-y-auto py-2">
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
                  className={`relative p-2 rounded-lg border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border/50 hover:border-primary/50 bg-background/30"
                  }`}
                >
                  <div className="flex flex-col items-center gap-1.5">
                    <AvatarWithFrame
                      imageUrl={storeImageUrl}
                      frameUrl={frame.image_url}
                      size="sm"
                    />
                    <span className="text-[9px] font-medium text-center line-clamp-1">
                      {frame.name_ar}
                    </span>
                  </div>

                  {isSelected && (
                    <div className="absolute top-1 right-1 h-4 w-4 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-2.5 w-2.5" />
                    </div>
                  )}

                  {!owned && (
                    <Badge className="absolute bottom-0.5 left-0.5 right-0.5 text-[8px] gap-0.5 justify-center py-0">
                      <Coins className="h-2 w-2" />
                      {frame.points_cost}
                    </Badge>
                  )}

                  {frame.is_free && !isSelected && (
                    <Badge variant="secondary" className="absolute top-0.5 left-0.5 text-[8px] py-0">
                      مجاني
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <div className="pt-3 border-t border-border/50">
            <Button
              onClick={() => setFrameDialogOpen(false)}
              className="w-full h-9 text-sm"
            >
              تم
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
