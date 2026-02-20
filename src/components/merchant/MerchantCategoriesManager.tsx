import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Plus, Trash2, GripVertical, Pencil, FolderPlus, Upload, Loader2, X, Image } from "lucide-react";

interface Category {
  id: string;
  merchant_id: string;
  name_ar: string;
  image_url: string | null;
  parent_id: string | null;
  display_order: number;
  is_active: boolean;
}

interface Props {
  merchantId: string;
}

export default function MerchantCategoriesManager({ merchantId }: Props) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const [editingCategory, setEditingCategory] = useState<Category | null>(null);
  const [addDialogOpen, setAddDialogOpen] = useState(false);
  const [addParentId, setAddParentId] = useState<string | null>(null);
  const [sectionType, setSectionType] = useState<"standard" | "sidebar">("standard");
  const [newName, setNewName] = useState("");
  const [newImageUrl, setNewImageUrl] = useState("");
  const [uploading, setUploading] = useState(false);

  const { data: categories = [], isLoading } = useQuery({
    queryKey: ["merchant-store-categories", merchantId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("merchant_store_categories")
        .select("*")
        .eq("merchant_id", merchantId)
        .order("display_order");
      if (error) throw error;
      return data as Category[];
    },
  });

  const mainCategories = categories.filter(c => !c.parent_id);
  const getSubCategories = (parentId: string) => categories.filter(c => c.parent_id === parentId);

  const handleUploadImage = async (file: File) => {
    if (!user?.id) return;
    setUploading(true);
    try {
      const ext = file.name.split(".").pop();
      const path = `${user.id}/category-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("merchant_stores").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data: urlData } = supabase.storage.from("merchant_stores").getPublicUrl(path);
      setNewImageUrl(urlData.publicUrl);
    } catch (err: any) {
      toast({ title: "فشل رفع الصورة", variant: "destructive" });
    } finally {
      setUploading(false);
    }
  };

  const addMutation = useMutation({
    mutationFn: async () => {
      const maxOrder = categories.filter(c => c.parent_id === addParentId).length;
      const { error } = await supabase.from("merchant_store_categories").insert({
        merchant_id: merchantId,
        name_ar: newName.trim(),
        image_url: newImageUrl || null,
        parent_id: addParentId,
        display_order: maxOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-store-categories", merchantId] });
      setAddDialogOpen(false);
      setNewName("");
      setNewImageUrl("");
      setAddParentId(null);
      toast({ title: "تمت إضافة القسم" });
    },
    onError: () => toast({ title: "فشلت الإضافة", variant: "destructive" }),
  });

  const updateMutation = useMutation({
    mutationFn: async (cat: Category) => {
      const { error } = await supabase
        .from("merchant_store_categories")
        .update({ name_ar: cat.name_ar, image_url: cat.image_url })
        .eq("id", cat.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-store-categories", merchantId] });
      setEditingCategory(null);
      toast({ title: "تم التحديث" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("merchant_store_categories").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["merchant-store-categories", merchantId] });
      toast({ title: "تم حذف القسم" });
    },
  });

  const openAddDialog = (parentId: string | null = null) => {
    setAddParentId(parentId);
    setSectionType("standard");
    setNewName("");
    setNewImageUrl("");
    setAddDialogOpen(true);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold">أقسام المنتجات</h3>
        <div className="flex gap-1.5">
          <Button size="sm" variant="outline" className="h-7 text-xs gap-1" onClick={() => openAddDialog()}>
            <Plus className="h-3 w-3" />
            قسم رئيسي
          </Button>
          <Button size="sm" variant="ghost" className="h-7 text-xs gap-1 text-muted-foreground" onClick={() => { setAddParentId(null); setNewName(""); setNewImageUrl(""); setSectionType("sidebar"); setAddDialogOpen(true); }}>
            <Plus className="h-3 w-3" />
            شريط جانبي
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="text-xs text-muted-foreground text-center py-4">جاري التحميل...</div>
      ) : mainCategories.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="p-4 text-center text-sm text-muted-foreground">
            لا توجد أقسام بعد. أضف أقساماً لتنظيم منتجاتك.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {mainCategories.map((cat) => {
            const subs = getSubCategories(cat.id);
            return (
              <Card key={cat.id} className="border-border/50">
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <GripVertical className="h-3.5 w-3.5 text-muted-foreground/50" />
                      {cat.image_url && (
                        <img src={cat.image_url} alt="" className="h-7 w-7 rounded object-cover" />
                      )}
                      <span className="text-sm font-medium">{cat.name_ar}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => openAddDialog(cat.id)}>
                        <FolderPlus className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => {
                        setEditingCategory(cat);
                        setNewName(cat.name_ar);
                        setNewImageUrl(cat.image_url || "");
                      }}>
                        <Pencil className="h-3 w-3" />
                      </Button>
                      <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => deleteMutation.mutate(cat.id)}>
                        <Trash2 className="h-3 w-3" />
                      </Button>
                    </div>
                  </div>
                  {subs.length > 0 && (
                    <div className="mr-6 space-y-1">
                      {subs.map((sub) => (
                        <div key={sub.id} className="flex items-center justify-between py-1 px-2 rounded bg-muted/30">
                          <div className="flex items-center gap-2">
                            {sub.image_url && <img src={sub.image_url} alt="" className="h-5 w-5 rounded object-cover" />}
                            <span className="text-xs">{sub.name_ar}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="icon" variant="ghost" className="h-5 w-5" onClick={() => {
                              setEditingCategory(sub);
                              setNewName(sub.name_ar);
                              setNewImageUrl(sub.image_url || "");
                            }}>
                              <Pencil className="h-2.5 w-2.5" />
                            </Button>
                            <Button size="icon" variant="ghost" className="h-5 w-5 text-destructive" onClick={() => deleteMutation.mutate(sub.id)}>
                              <Trash2 className="h-2.5 w-2.5" />
                            </Button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Add Category Dialog */}
      <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">
              {sectionType === "sidebar" ? "إضافة شريط جانبي" : addParentId ? "إضافة قسم فرعي" : "إضافة قسم رئيسي"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">اسم القسم</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} placeholder={sectionType === "sidebar" ? "مثال: عروض خاصة" : "مثال: أكشن فيغرز"} className="h-9 mt-1" />
            </div>
            {sectionType === "standard" && (
              <div>
                <Label className="text-xs">صورة القسم (اختياري)</Label>
                <div className="flex items-center gap-2 mt-1">
                  {newImageUrl && (
                    <div className="h-10 w-10 rounded border overflow-hidden shrink-0">
                      <img src={newImageUrl} alt="" className="h-full w-full object-cover" />
                    </div>
                  )}
                  <label className="cursor-pointer flex-1">
                    <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadImage(e.target.files[0]); }} />
                    <div className="h-9 rounded-md border border-dashed flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:bg-accent">
                      {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5" /> رفع صورة</>}
                    </div>
                  </label>
                  {newImageUrl && (
                    <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setNewImageUrl("")}>
                      <X className="h-3.5 w-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            )}
            {sectionType === "sidebar" && (
              <p className="text-[10px] text-muted-foreground">هذا القسم لا يتطلب صوراً أو أقساماً فرعية</p>
            )}
            <Button className="w-full h-9" disabled={!newName.trim() || addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "جاري الإضافة..." : "إضافة"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Category Dialog */}
      <Dialog open={!!editingCategory} onOpenChange={(open) => !open && setEditingCategory(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="text-base">تعديل القسم</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label className="text-xs">اسم القسم</Label>
              <Input value={newName} onChange={e => setNewName(e.target.value)} className="h-9 mt-1" />
            </div>
            <div>
              <Label className="text-xs">صورة القسم</Label>
              <div className="flex items-center gap-2 mt-1">
                {newImageUrl && (
                  <div className="h-10 w-10 rounded border overflow-hidden shrink-0">
                    <img src={newImageUrl} alt="" className="h-full w-full object-cover" />
                  </div>
                )}
                <label className="cursor-pointer flex-1">
                  <input type="file" accept="image/*" className="hidden" onChange={e => { if (e.target.files?.[0]) handleUploadImage(e.target.files[0]); }} />
                  <div className="h-9 rounded-md border border-dashed flex items-center justify-center gap-1.5 text-xs text-muted-foreground hover:bg-accent">
                    {uploading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <><Upload className="h-3.5 w-3.5" /> رفع صورة</>}
                  </div>
                </label>
                {newImageUrl && (
                  <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => setNewImageUrl("")}>
                    <X className="h-3.5 w-3.5" />
                  </Button>
                )}
              </div>
            </div>
            <Button className="w-full h-9" disabled={!newName.trim() || updateMutation.isPending}
              onClick={() => editingCategory && updateMutation.mutate({ ...editingCategory, name_ar: newName, image_url: newImageUrl || null })}>
              {updateMutation.isPending ? "جاري الحفظ..." : "حفظ"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
