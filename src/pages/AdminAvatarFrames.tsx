import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Frame, Plus, Trash2, Edit2, GripVertical, Coins, Eye, EyeOff } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout, { AdminSection } from "@/components/admin/AdminLayout";
import { ADMIN_ROUTES } from "@/config/adminConfig";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import AvatarWithFrame from "@/components/merchant/AvatarWithFrame";

interface AvatarFrame {
  id: string;
  name_ar: string;
  image_url: string;
  is_free: boolean;
  is_active: boolean;
  points_cost: number | null;
  display_order: number | null;
  created_at: string;
}

interface Props {
  embedded?: boolean;
}

export default function AdminAvatarFrames({ embedded }: Props) {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [selectedFrame, setSelectedFrame] = useState<AvatarFrame | null>(null);

  // Form state
  const [nameAr, setNameAr] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [isFree, setIsFree] = useState(true);
  const [isActive, setIsActive] = useState(true);
  const [pointsCost, setPointsCost] = useState(0);
  const [displayOrder, setDisplayOrder] = useState(0);
  const [uploading, setUploading] = useState(false);

  const { data: frames = [], isLoading } = useQuery({
    queryKey: ["admin-avatar-frames"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("avatar_frames")
        .select("*")
        .order("display_order", { ascending: true });
      if (error) throw error;
      return data as AvatarFrame[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (frame: Partial<AvatarFrame> & { id?: string }) => {
      if (frame.id) {
        const { error } = await supabase
          .from("avatar_frames")
          .update({
            name_ar: frame.name_ar,
            image_url: frame.image_url,
            is_free: frame.is_free,
            is_active: frame.is_active,
            points_cost: frame.points_cost,
            display_order: frame.display_order,
          })
          .eq("id", frame.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("avatar_frames").insert({
          name_ar: frame.name_ar,
          image_url: frame.image_url,
          is_free: frame.is_free,
          is_active: frame.is_active,
          points_cost: frame.points_cost,
          display_order: frame.display_order,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-avatar-frames"] });
      queryClient.invalidateQueries({ queryKey: ["avatar-frames"] });
      toast({ title: "تم الحفظ", description: "تم حفظ الإطار بنجاح." });
      setDialogOpen(false);
      resetForm();
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("avatar_frames").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-avatar-frames"] });
      queryClient.invalidateQueries({ queryKey: ["avatar-frames"] });
      toast({ title: "تم الحذف", description: "تم حذف الإطار." });
      setDeleteDialogOpen(false);
      setSelectedFrame(null);
    },
    onError: (err: any) => {
      toast({ title: "خطأ", description: err.message, variant: "destructive" });
    },
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async ({ id, is_active }: { id: string; is_active: boolean }) => {
      const { error } = await supabase
        .from("avatar_frames")
        .update({ is_active })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-avatar-frames"] });
      queryClient.invalidateQueries({ queryKey: ["avatar-frames"] });
    },
  });

  const resetForm = () => {
    setNameAr("");
    setImageUrl("");
    setIsFree(true);
    setIsActive(true);
    setPointsCost(0);
    setDisplayOrder(frames.length);
    setSelectedFrame(null);
  };

  const openEditDialog = (frame: AvatarFrame) => {
    setSelectedFrame(frame);
    setNameAr(frame.name_ar);
    setImageUrl(frame.image_url);
    setIsFree(frame.is_free);
    setIsActive(frame.is_active);
    setPointsCost(frame.points_cost || 0);
    setDisplayOrder(frame.display_order || 0);
    setDialogOpen(true);
  };

  const openCreateDialog = () => {
    resetForm();
    setDisplayOrder(frames.length);
    setDialogOpen(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `frames/frame-${Date.now()}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("public-assets")
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from("public-assets").getPublicUrl(path);
      setImageUrl(urlData.publicUrl);
    } catch {
      toast({ title: "خطأ", description: "فشل رفع الصورة.", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const handleSave = () => {
    if (!nameAr.trim() || !imageUrl.trim()) {
      toast({ title: "خطأ", description: "يرجى ملء جميع الحقول المطلوبة.", variant: "destructive" });
      return;
    }

    saveMutation.mutate({
      id: selectedFrame?.id,
      name_ar: nameAr.trim(),
      image_url: imageUrl.trim(),
      is_free: isFree,
      is_active: isActive,
      points_cost: isFree ? null : pointsCost,
      display_order: displayOrder,
    });
  };

  const actionButtons = (
    <Button onClick={openCreateDialog} className="gap-2">
      <Plus className="h-4 w-4" />
      إضافة إطار
    </Button>
  );

  const content = (
    <>
      <AdminSection title={embedded ? undefined : "الإطارات المتاحة"} actions={embedded ? actionButtons : undefined}>
        {isLoading ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="aspect-square rounded-xl" />
            ))}
          </div>
        ) : frames.length === 0 ? (
          <Card className="p-6 text-center text-muted-foreground">
            لا توجد إطارات. اضغط على "إضافة إطار" لإنشاء أول إطار.
          </Card>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {frames.map((frame) => (
              <Card
                key={frame.id}
                className={`p-4 relative transition-all ${
                  !frame.is_active ? "opacity-50" : ""
                }`}
              >
                <div className="flex flex-col items-center gap-3">
                  <div className="relative">
                    <AvatarWithFrame
                      imageUrl="/placeholder.svg"
                      frameUrl={frame.image_url}
                      size="lg"
                      animated
                    />
                  </div>

                  <div className="text-center">
                    <p className="font-semibold text-sm">{frame.name_ar}</p>
                    <div className="flex items-center justify-center gap-2 mt-1">
                      {frame.is_free ? (
                        <Badge variant="secondary" className="text-xs">مجاني</Badge>
                      ) : (
                        <Badge className="text-xs gap-1">
                          <Coins className="h-3 w-3" />
                          {frame.points_cost?.toLocaleString()}
                        </Badge>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => openEditDialog(frame)}
                    >
                      <Edit2 className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="outline"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() =>
                        toggleActiveMutation.mutate({
                          id: frame.id,
                          is_active: !frame.is_active,
                        })
                      }
                    >
                      {frame.is_active ? (
                        <Eye className="h-3.5 w-3.5" />
                      ) : (
                        <EyeOff className="h-3.5 w-3.5" />
                      )}
                    </Button>
                    <Button
                      variant="destructive"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => {
                        setSelectedFrame(frame);
                        setDeleteDialogOpen(true);
                      }}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Order badge */}
                <div className="absolute top-2 left-2 flex items-center gap-1 text-xs text-muted-foreground">
                  <GripVertical className="h-3 w-3" />
                  {frame.display_order}
                </div>
              </Card>
            ))}
          </div>
        )}
      </AdminSection>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-md" dir="rtl">
          <DialogHeader>
            <DialogTitle>
              {selectedFrame ? "تعديل الإطار" : "إضافة إطار جديد"}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4">
            {/* Preview */}
            <div className="flex justify-center">
              <AvatarWithFrame
                imageUrl="/placeholder.svg"
                frameUrl={imageUrl || undefined}
                size="xl"
                animated
              />
            </div>

            <div>
              <Label>اسم الإطار (عربي) *</Label>
              <Input
                value={nameAr}
                onChange={(e) => setNameAr(e.target.value)}
                placeholder="مثال: إطار ذهبي"
              />
            </div>

            <div>
              <Label>رابط صورة الإطار *</Label>
              <div className="flex gap-2">
                <Input
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                  placeholder="https://..."
                  dir="ltr"
                  className="flex-1"
                />
                <label className="shrink-0">
                  <Button variant="outline" asChild disabled={uploading}>
                    <span>{uploading ? "جارٍ الرفع..." : "رفع"}</span>
                  </Button>
                  <input
                    type="file"
                    accept="image/*,.svg"
                    className="hidden"
                    onChange={handleImageUpload}
                    disabled={uploading}
                  />
                </label>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                يفضل استخدام صور SVG أو PNG شفافة بحجم 200x200 بكسل
              </p>
            </div>

            <div className="flex items-center justify-between">
              <Label>إطار مجاني</Label>
              <Switch checked={isFree} onCheckedChange={setIsFree} />
            </div>

            {!isFree && (
              <div>
                <Label>سعر النقاط</Label>
                <Input
                  type="number"
                  value={pointsCost}
                  onChange={(e) => setPointsCost(Number(e.target.value))}
                  min={0}
                />
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>مفعّل</Label>
              <Switch checked={isActive} onCheckedChange={setIsActive} />
            </div>

            <div>
              <Label>ترتيب العرض</Label>
              <Input
                type="number"
                value={displayOrder}
                onChange={(e) => setDisplayOrder(Number(e.target.value))}
                min={0}
              />
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              إلغاء
            </Button>
            <Button onClick={handleSave} disabled={saveMutation.isPending}>
              {saveMutation.isPending ? "جارٍ الحفظ..." : "حفظ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent dir="rtl">
          <AlertDialogHeader>
            <AlertDialogTitle>حذف الإطار</AlertDialogTitle>
            <AlertDialogDescription>
              هل أنت متأكد من حذف "{selectedFrame?.name_ar}"؟ لن يمكن التراجع عن هذا الإجراء.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>إلغاء</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => selectedFrame && deleteMutation.mutate(selectedFrame.id)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {deleteMutation.isPending ? "جارٍ الحذف..." : "حذف"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );

  if (embedded) {
    return content;
  }

  return (
    <AdminLayout
      title="إدارة إطارات الصور"
      description="إضافة وتعديل إطارات الأفتار للمستخدمين والتجار"
      icon={<Frame className="h-5 w-5" />}
      backTo={ADMIN_ROUTES.levoCommunity}
      maxWidth="4xl"
      actions={actionButtons}
    >
      {content}
    </AdminLayout>
  );
}
