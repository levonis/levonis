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
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>تعديل المتجر</DialogTitle>
          </DialogHeader>

          <div className="space-y-4 max-h-[65vh] overflow-y-auto px-1">
            {/* Store Image with Frame */}
            <div className="flex flex-col items-center gap-3">
              <div className="relative">
                <AvatarWithFrame
                  imageUrl={storeImageUrl}
                  frameUrl={selectedFrame?.image_url}
                  size="xl"
                />
                <label className="absolute bottom-0 right-0 h-9 w-9 rounded-full bg-primary text-primary-foreground flex items-center justify-center cursor-pointer hover:bg-primary/90 transition-colors z-20">
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
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => setFrameDialogOpen(true)}
                className="gap-2"
              >
                اختيار إطار
              </Button>
            </div>

            <div>
              <Label>اسم المتجر *</Label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="اسم المتجر"
              />
            </div>

            <div>
              <Label>نبذة عن المتجر</Label>
              <Textarea
                value={bio}
                onChange={(e) => setBio(e.target.value)}
                placeholder="وصف قصير عن متجرك..."
                rows={3}
              />
            </div>

            <div>
              <Label>رابط فيسبوك</Label>
              <Input
                value={facebook}
                onChange={(e) => setFacebook(e.target.value)}
                placeholder="https://facebook.com/..."
                dir="ltr"
              />
            </div>

            <div>
              <Label>رابط إنستقرام</Label>
              <Input
                value={instagram}
                onChange={(e) => setInstagram(e.target.value)}
                placeholder="https://instagram.com/..."
                dir="ltr"
              />
            </div>

            {/* Specialty Selector */}
            <div>
              <Label className="mb-2 block">تخصص الطباعة</Label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => setSpecialty("resin")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    specialty === "resin"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Droplets className="h-4 w-4" />
                  <span className="text-sm">رزن فقط</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialty("filament")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    specialty === "filament"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Layers className="h-4 w-4" />
                  <span className="text-sm">فلمنت فقط</span>
                </button>
                <button
                  type="button"
                  onClick={() => setSpecialty("both")}
                  className={`flex items-center gap-2 px-3 py-2 rounded-lg border transition-colors ${
                    specialty === "both"
                      ? "bg-primary text-primary-foreground border-primary"
                      : "border-border hover:border-primary/50"
                  }`}
                >
                  <Droplets className="h-4 w-4" />
                  <Layers className="h-4 w-4 -mr-1" />
                  <span className="text-sm">كلاهما</span>
                </button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">اختر نوع الطباعة التي تقدمها</p>
            </div>

            <Button
              onClick={() => saveMutation.mutate()}
              disabled={!displayName.trim() || saveMutation.isPending}
              className="w-full"
            >
              {saveMutation.isPending ? "جاري الحفظ..." : "حفظ التغييرات"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Frame Selection Dialog */}
      <Dialog open={frameDialogOpen} onOpenChange={setFrameDialogOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>اختيار إطار الصورة</DialogTitle>
          </DialogHeader>

          <div className="flex items-center justify-between mb-4 p-3 rounded-xl bg-primary/10">
            <span className="text-sm font-medium">نقاطك الحالية</span>
            <div className="flex items-center gap-1">
              <Coins className="h-4 w-4 text-primary" />
              <span className="font-bold text-primary">{userPoints?.toLocaleString() || 0}</span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 max-h-[50vh] overflow-y-auto">
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
                  className={`relative p-2 rounded-xl border-2 transition-all ${
                    isSelected
                      ? "border-primary bg-primary/10"
                      : "border-border hover:border-primary/50"
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
                    <div className="absolute top-1 right-1 h-5 w-5 rounded-full bg-primary text-primary-foreground flex items-center justify-center">
                      <Check className="h-3 w-3" />
                    </div>
                  )}

                  {!owned && (
                    <Badge className="absolute bottom-1 left-1 right-1 text-[9px] gap-0.5 justify-center">
                      <Coins className="h-2.5 w-2.5" />
                      {frame.points_cost}
                    </Badge>
                  )}

                  {frame.is_free && !isSelected && (
                    <Badge variant="secondary" className="absolute top-1 left-1 text-[9px]">
                      مجاني
                    </Badge>
                  )}
                </button>
              );
            })}
          </div>

          <Button
            onClick={() => setFrameDialogOpen(false)}
            className="w-full mt-2"
          >
            تم
          </Button>
        </DialogContent>
      </Dialog>
    </>
  );
}
